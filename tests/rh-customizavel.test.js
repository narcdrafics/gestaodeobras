// tests/rh-customizavel.test.js
// Cargo RH: fica entre admin e engenheiro. O admin escolhe módulos e obras;
// o servidor normaliza e as regras/cliente respeitam exatamente essa escolha.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import cargos from '../functions/cargos.js';
import aprovacoes from '../functions/aprovacoes.js';
import aprovacoesApi from '../functions/aprovacoes-api.js';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const {
  ROLES_TENANT, MODULOS_RH, MODULOS_RH_PADRAO, normalizarModulosRh
} = cargos;
const { papelPodeDecidir: decidirNoTrigger } = aprovacoes;
const { papelPodeDecidir: decidirNaApi, moduloDaAprovacao } = aprovacoesApi;

describe('RH — normalização no servidor', () => {
  it('é um cargo de tenant e fica abaixo de admin na hierarquia da API', () => {
    expect(ROLES_TENANT.has('rh')).toBe(true);
    const api = read('functions/aprovacoes-api.js');
    expect(api).toContain("'super_admin', 'admin', 'rh', 'engenheiro'");
    const ui = read('public/js/aprovacoes_ui.js');
    expect(ui).toContain("'super_admin', 'admin', 'rh', 'engenheiro'");
  });

  it('usa funcionários/presença/almocos como padrão e ignora chaves desconhecidas', () => {
    expect(normalizarModulosRh(null, 'rh')).toEqual(MODULOS_RH_PADRAO);
    expect(normalizarModulosRh({ compras: true, __proto__: true, admin: true }, 'rh'))
      .toEqual({ compras: true });
    expect(normalizarModulosRh({ compras: true, financeiro: 'sim', obras: 1 }, 'rh'))
      .toEqual({ compras: true });
    expect(MODULOS_RH.has('aprovacoes')).toBe(true);
  });

  it('só guarda módulos/obras para RH', () => {
    expect(normalizarModulosRh({ compras: true }, 'engenheiro')).toBeNull();
    const src = read('functions/cargos.js');
    expect(src).toContain("cargo === 'rh'");
    expect(src).toContain("perfilUpdates.obrasPermitidas = perfilUpdates.acessoObras === 'especificas'");
  });

  it('sincroniza módulos e obras nas custom claims e na assinatura de mudanças', () => {
    const index = read('functions/index.js');
    expect(index).toContain('claimsUpdate.modulosPermitidos');
    expect(index).toContain('claimsUpdate.obrasPermitidas');
    expect(index).toContain('assinaturaPerfil');
    expect(index).toContain('.sort()');
  });
});

describe('RH — decisão de aprovações restrita aos módulos', () => {
  const ap = (tipo) => ({ tipo, notificarAdmin: true });

  it('cada tipo pertence a um módulo', () => {
    expect(moduloDaAprovacao('compra_criacao')).toBe('compras');
    expect(moduloDaAprovacao('trabalhador_add')).toBe('funcionarios');
    expect(moduloDaAprovacao('movimentacao_estoque')).toBe('estoque');
    expect(moduloDaAprovacao('tipo_inexistente')).toBeNull();
  });

  it('sem aprovacoes habilitado, RH não decide nada', () => {
    const modulos = { funcionarios: true, compras: true };
    expect(decidirNaApi('rh', ap('compra_criacao'), modulos)).toBe(false);
    expect(decidirNoTrigger('rh', ap('compra_criacao'), modulos)).toBe(false);
  });

  it('com aprovacoes, decide apenas tipos do módulo liberado', () => {
    const modulos = { aprovacoes: true, compras: true };
    expect(decidirNaApi('rh', ap('compra_criacao'), modulos)).toBe(true);
    expect(decidirNoTrigger('rh', ap('compra_criacao'), modulos)).toBe(true);
    expect(decidirNaApi('rh', ap('trabalhador_add'), modulos)).toBe(false);
    expect(decidirNoTrigger('rh', ap('medicao_fechamento'), modulos)).toBe(false);
  });

  it('admin continua decidindo tudo; engenheiro mantém a delegação atual', () => {
    expect(decidirNaApi('admin', ap('compra_criacao'), null)).toBe(true);
    expect(decidirNoTrigger('engenheiro', ap('movimentacao_estoque'), null)).toBe(true);
    expect(decidirNoTrigger('engenheiro', ap('compra_criacao'), null)).toBe(false);
  });

  it('o registro da decisão guarda os módulos usados pelo RH', () => {
    expect(read('functions/aprovacoes-api.js')).toContain('decididoPorModulos');
  });
});

describe('RH — fiação da UI e das regras', () => {
  const modal = read('public/modals/modal-usuario.html');
  const app = read('public/js/app_core.js');
  const auth = read('public/js/auth_core.js');
  const data = read('public/js/data_core.js');
  const ui = read('public/js/aprovacoes_ui.js');
  const regras = JSON.parse(read('database.rules.json'));
  const storage = read('storage.rules');

  it('o modal oferece o cargo e os módulos, com padrão marcado', () => {
    expect(modal).toContain('<option value="rh">Recursos Humanos');
    for (const modulo of ['funcionarios', 'presenca', 'almocos', 'aprovacoes']) {
      expect(modal).toContain(`class="usr-modulo-chk" value="${modulo}"`);
    }
    expect(app).toContain('function lerModulosRhDoModal()');
    expect(app).toContain("modulosPermitidos: modulosRh");
    expect(modal).toContain('id="usr-modulos-wrap"');
  });

  it('a sessão e a navegação respeitam os módulos', () => {
    expect(auth).toContain('function camposRhSessao(');
    expect(auth).toContain('camposRhSessao({ ...globalData');
    expect(auth).toContain('...camposRhSessao(inviteData');
    expect(auth).toContain('camposRhSessao(user, registro.role)');
    expect(auth).toContain('modulosPermitidos: (dados && dados.modulosPermitidos)');
    expect(auth).toContain("role === 'rh'");
    expect(auth).toContain("modulosRh[modulo] !== true");
    expect(data).toContain('function rhNosPermitidos(');
    expect(data).toContain("role === 'rh'");
    expect(data).toContain('RH_MODULOS_PADRAO');
    expect(data).toContain('function sanitizeComprasForRole(db, role, modulos)');
    expect(ui).toContain('modulosRh[modulo] === true');
  });

  it('as regras exigem módulo, tenant e faturamento para cada escrita RH', () => {
    const texto = JSON.stringify(regras);
    expect(texto).toContain("'rh'");
    expect(texto).toContain('modulosPermitidos');
    const escritas = [
      regras.rules.tenants['$tenantId'].presenca['.write'],
      regras.rules.tenants['$tenantId'].trabalhadores['.write'],
      regras.rules.tenants['$tenantId'].aprovacoes['$id']['.write'],
      regras.rules.comprasPrivadas['$tenantId']['.read']
    ];
    for (const regra of escritas) {
      expect(regra).toContain("'rh'");
      expect(regra).toContain('modulosPermitidos');
    }
    const n = texto.split("root.child('profiles/' + auth.uid + '/tenantId').val() === $tenantId && root.child('tenants/' + $tenantId + '/billingState').val() !== 'somente_leitura' && root.child('tenants/' + $tenantId + '/billingState').val() !== 'bloqueado') && (auth.token.role === 'rh'").length - 1;
    expect(n).toBeGreaterThanOrEqual(14);
    // Usuários do sistema continuam sendo gestão exclusiva do admin.
    expect(regras.rules.tenants['$tenantId'].usuarios['.write']).not.toContain("'rh'");
  });

  it('o Storage aceita o cargo RH com as claims sincronizadas', () => {
    expect(storage).toContain("request.auth.token.role == 'rh'");
  });

  it('o badge de RH tem cor própria', () => {
    expect(read('public/css/app.css')).toContain('.badge-purple');
    expect(app).toContain("u.role === 'rh' ? 'badge-purple'");
  });
});
