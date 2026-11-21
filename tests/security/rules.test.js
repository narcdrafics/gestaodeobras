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
const slugSrc = fs.readFileSync(path.join(root, 'public', 'js', 'slug.js'), 'utf8');
const dataSrc = fs.readFileSync(path.join(root, 'public', 'js', 'data_core.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'public', 'js', 'app_core.js'), 'utf8');

describe('database.rules.json — proteção do paywall', () => {
  it('campos de plano são imutáveis para o tenant', () => {
    for (const field of ['plano', 'planoVencimento', 'trialExpiracao', 'status', 'emailAdmin', 'billingState']) {
      expect(tenantRules[field]?.['.validate']).toContain("=== 'super_admin'");
    }
  });

  it('nega leitura quando tenant estiver com billingState = bloqueado', () => {
    const readRule = tenantRules['.read'];
    expect(readRule).toContain("data.child('billingState').val() !== 'bloqueado'");
    expect(readRule).toContain("=== 'super_admin'");
  });

  it('nega escrita quando tenant estiver com billingState = somente_leitura ou bloqueado', () => {
    const writeRule = tenantRules['.write'];
    expect(writeRule).toContain("data.child('billingState').val() !== 'somente_leitura'");
    expect(writeRule).toContain("data.child('billingState').val() !== 'bloqueado'");
    expect(writeRule).toContain("=== 'super_admin'");
  });

  it('o campo billingState continua legível para exibir a tela de bloqueio', () => {
    // Sem esta exceção o .read negado no pai impede o front de saber que está bloqueado.
    const statusRule = tenantRules.billingState['.read'];
    expect(statusRule).toContain("auth != null");
    expect(statusRule).toContain("root.child('profiles/' + auth.uid + '/tenantId').val() === $tenantId");
    expect(statusRule).toContain("data.parent().child('emailAdmin').val() === auth.token.email");
  });

  it('billingState só pode ser escrito pelo servidor (admin SDK)', () => {
    const validate = tenantRules.billingState['.validate'];
    expect(validate).toContain("auth.token.role === 'super_admin'");
    expect(validate).toContain("auth.token.email === 'tonycampelo@gmail.com'");
    expect(validate).toMatch(/data\.exists\(\)\s*\?\s*newData\.val\(\)\s*===\s*data\.val\(\)/);
    expect(validate).toContain("newData.val() === 'ativo'");
  });

  it('tarefas_pendentes também respeita carência/somente leitura/bloqueio', () => {
    const tarefas = rules.rules.tarefas_pendentes.$tenantId;
    expect(tarefas['.read']).toContain("root.child('tenants/' + $tenantId + '/billingState').val() !== 'bloqueado'");
    expect(tarefas['.write']).toContain("root.child('tenants/' + $tenantId + '/billingState').val() !== 'somente_leitura'");
    expect(tarefas['.write']).toContain("root.child('tenants/' + $tenantId + '/billingState').val() !== 'bloqueado'");
  });

  it('estoque e canteiro respeitam o estado de cobrança', () => {
    const estoque = tenantRules.estoque;
    expect(estoque['.read']).toContain("data.parent().child('billingState').val() !== 'bloqueado'");
    expect(estoque['.write']).toContain("data.parent().child('billingState').val() !== 'somente_leitura'");
    const canteiro = estoque.canteiro.$obraId;
    expect(canteiro['.read']).toContain("data.parent().parent().child('billingState').val() !== 'bloqueado'");
    expect(canteiro['.write']).toContain("data.parent().parent().child('billingState').val() !== 'somente_leitura'");
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

describe('database.rules.json — tenants_public sem enumeração', () => {
  const publicRules = rules.rules.tenants_public;

  it('o nó pai não pode ser listado (sem .read no pai)', () => {
    expect(publicRules['.read']).toBeUndefined();
    expect(publicRules['.indexOn']).toBeUndefined();
  });

  it('a leitura pública é apenas pela chave direta do slug', () => {
    expect(publicRules.$slug?.['.read']).toBe(true);
  });

  it('o slug é a chave e o tenantId é obrigatório', () => {
    const validate = publicRules.$slug?.['.validate'];
    expect(validate).toContain("newData.child('slug').val() === $slug");
    expect(validate).toContain("newData.child('tenantId').isString()");
  });

  it('escrita exige super_admin ou o próprio tenant', () => {
    const write = publicRules.$slug?.['.write'];
    expect(write).toContain("=== 'super_admin'");
    expect(write).toContain("profiles/' + auth.uid + '/tenantId");
  });

  it('o tenant não altera o subdomínio público quando está bloqueado ou em leitura', () => {
    const write = publicRules.$slug?.['.write'];
    expect(write).toContain("'/billingState').val() !== 'somente_leitura'");
    expect(write).toContain("'/billingState').val() !== 'bloqueado'");
  });

  it('o cliente nunca consulta tenants_public com orderByChild/equalTo', () => {
    const allSrc = [dataSrc, appSrc, authSrc].join('\n');
    expect(allSrc).not.toMatch(/tenants_public'\)\s*\.orderByChild|tenants_public[\s\S]{0,80}orderByChild\('slug'\)/);
  });

  it('escritas do nó público incluem tenantId', () => {
    // auto-cadastro (escolha do slug): a escrita mora em slug.js
    expect(slugSrc).toMatch(/tenants_public\/\$\{slug\}`\]\s*=\s*\{[\s\S]{0,160}tenantId:\s*slug/);
    expect(appSrc).toMatch(/tenants_public\/\$\{slugVal\}[\s\S]{0,160}tenantId:\s*slugVal/);
  });

  it('renomear o slug move o nó público para a nova chave', () => {
    expect(dataSrc).toMatch(/tenants_public\/\$\{oldSlug\}`\]\s*=\s*null/);
    expect(dataSrc).toMatch(/tenants_public\/\$\{newSlug\}`\]\s*=\s*\{/);
  });
});

describe('database.rules.json — logs de webhook', () => {
  it('webhook_debug é legível apenas por super_admin e não aceita escrita do cliente', () => {
    const debug = rules.rules.webhook_debug;
    expect(debug?.['.read']).toContain("=== 'super_admin'");
    expect(debug?.['.write']).toBe(false);
  });
});

describe('functions/index.js — enforcement de quantidade', () => {
  it('exporta os triggers de obras e usuários', () => {
    expect(functionsSrc).toMatch(/exports\.enforceObrasLimit\s*=\s*onValueWritten\(\s*"tenants\/\{tenantId\}\/obras"/);
    expect(functionsSrc).toMatch(/exports\.enforceUsuariosLimit\s*=\s*onValueWritten\(\s*"tenants\/\{tenantId\}\/usuarios"/);
  });

  it('exporta o job diário de cobrança (dailyBillingStateJob)', () => {
    expect(functionsSrc).toMatch(/exports\.dailyBillingStateJob\s*=\s*onSchedule\(/);
    expect(functionsSrc).toContain('atualizarBillingStatesJob');
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

describe('bloqueio no servidor — integração front-end', () => {
  const appHtml = fs.readFileSync(path.join(root, 'public', 'app.html'), 'utf8');

  it('a tela de bloqueio substitui o alert + logout', () => {
    expect(appHtml).toContain('id="screen-blocked"');
    expect(appHtml).toContain("startKiwifyCheckout('start')");
    expect(appHtml).toContain("startKiwifyCheckout('pro')");

    const handler = dataSrc.slice(
      dataSrc.indexOf('function _onFirebaseValue'),
      dataSrc.indexOf('function processCloudUpdate')
    );
    expect(handler).toContain('renderBillingEnforcement(data)');
    expect(handler).not.toContain('alert(');
    expect(handler).not.toContain('doLogout()');
  });

  it('lê billingState isoladamente mesmo quando o nó do tenant é negado', () => {
    expect(dataSrc).toContain("firebase.database().ref('tenants/' + tenantId + '/billingState')");
    expect(dataSrc).toContain('function _onBillingStateValue');
    expect(dataSrc).toContain('billingStateRef.off(\'value\')');
  });

  it('não reenvia metadados de cobrança no update do cliente', () => {
    const bloco = dataSrc.slice(
      dataSrc.indexOf('const PROTECTED_TENANT_FIELDS'),
      dataSrc.indexOf('const PROTECTED_CONFIG_FIELDS')
    );
    for (const campo of ['billingState', 'billingStateMotivo', 'carenciaAte', 'status', 'planoVencimento']) {
      expect(bloco).toContain(`'${campo}'`);
    }
  });

  it('o banner de cobrança sobrevive à troca de página', () => {
    const showPage = appSrc.slice(appSrc.indexOf('window.showPage'), appSrc.indexOf('function renderPage'));
    expect(showPage).toContain("#billing-banner-container");
    expect(showPage).toContain('bannerHtml');
  });

  it('o job roda diariamente no fuso do Brasil', () => {
    const job = functionsSrc.slice(functionsSrc.indexOf('exports.dailyBillingStateJob'));
    expect(job).toContain('onSchedule(');
    expect(job).toContain('America/Sao_Paulo');
    expect(job).toContain('atualizarBillingStatesJob(admin.database())');
  });

  it('os checks do navegador são apenas UX, não autoridade', () => {
    expect(dataSrc).toContain('apenas experiência de uso');
    expect(dataSrc).toContain('IS_READONLY_MODE');
    expect(dataSrc).toContain('as regras do servidor barram no backend');
  });
});
