// tests/security/rules.test.js
// Garante que os limites de plano não voltem a ser controlados só pelo cliente.
//
// Modelo de defesa:
//  1. Firebase Rules: metadados de plano/limites imutáveis para o tenant.
//  2. Cloud Functions (Admin SDK): enforcement da QUANTIDADE de obras/usuários,
//     pois o RTDB não suporta numChildren() nas rules.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const rules = JSON.parse(fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8'));
const tenantRules = rules.rules.tenants.$tenantId;
const functionsSrc = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
const authSrc = fs.readFileSync(path.join(root, 'public', 'js', 'auth_core.js'), 'utf8');

describe('database.rules.json — proteção do paywall', () => {
  it('campos de plano são imutáveis para o tenant', () => {
    for (const field of ['plano', 'planoVencimento', 'trialExpiracao', 'status', 'emailAdmin']) {
      expect(tenantRules[field]?.['.validate']).toContain("=== 'super_admin'");
    }
  });

  it('limites do plano só podem ser alterados por super_admin', () => {
    for (const field of ['limiteObras', 'limiteUsuarios', 'limiteTrabalhadores']) {
      const validate = tenantRules.config[field]?.['.validate'];
      expect(validate).toContain("=== 'super_admin'");
      expect(validate).toMatch(/data\.exists\(\)\s*\?\s*newData\.val\(\)\s*===\s*data\.val\(\)/);
    }
  });

  it('status do perfil não pode ser auto-reativado pelo usuário', () => {
    const validate = rules.rules.profiles.$uid.status?.['.validate'];
    expect(validate).toContain("=== 'super_admin'");
    expect(validate).toMatch(/data\.exists\(\)\s*\?\s*newData\.val\(\)\s*===\s*data\.val\(\)/);
  });

  it('rules não usam numChildren() (método inexistente no RTDB)', () => {
    expect(JSON.stringify(rules)).not.toContain('numChildren');
  });
});

describe('functions/index.js — enforcement de quantidade', () => {
  it('exporta os triggers de obras e usuários', () => {
    expect(functionsSrc).toMatch(/exports\.enforceObrasLimit\s*=\s*onValueWritten\(\s*"tenants\/\{tenantId\}\/obras"/);
    expect(functionsSrc).toMatch(/exports\.enforceUsuariosLimit\s*=\s*onValueWritten\(\s*"tenants\/\{tenantId\}\/usuarios"/);
  });

  it('lê o limite do tenant (campo protegido pelas rules)', () => {
    expect(functionsSrc).toContain('config/${campo}');
    expect(functionsSrc).toContain('limiteObras');
    expect(functionsSrc).toContain('limiteUsuarios');
  });

  it('reverte crescimento acima do limite sem apagar registros legados', () => {
    expect(functionsSrc).toContain('reverterCrescimentoAcimaDoLimite');
    expect(functionsSrc).toMatch(/transaction\(/);
    expect(functionsSrc).toContain('contarFilhos(beforeVal) === 0');
  });

  it('não trata limite ausente como 0 (Number(null) === 0)', () => {
    expect(functionsSrc).toContain('LIMITE_FALLBACK');
    expect(functionsSrc).toMatch(/n <= 0\)\s*return LIMITE_FALLBACK/);
  });

  it('marca perfis acima do limite como pendentes em vez de excluir', () => {
    expect(functionsSrc).toContain('aplicarLimiteDeAssentos');
    expect(functionsSrc).toMatch(/profiles\/\$\{uid\}\/status.*set\('pendente'\)/);
  });
});

describe('auth_core.js — o login não desfaz a trava', () => {
  it('o touch de lastLogin não reescreve role/tenantId', () => {
    const touch = authSrc.match(/profileRef\.update\(\{[^}]*lastLogin[^}]*\}\)/g) || [];
    expect(touch.length).toBeGreaterThan(0);
    for (const snippet of touch) {
      expect(snippet).not.toContain('role');
      expect(snippet).not.toContain('tenantId');
    }
  });

  it('bloqueia login de perfil pendente', () => {
    expect(authSrc).toContain("status === 'pendente'");
  });
});
