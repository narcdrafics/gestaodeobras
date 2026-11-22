// tests/super-admin.test.js
// Cobre o painel Super Admin: catálogo de planos, normalização da Kiwify,
// autorização/ações do endpoint e integração front/back.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  PLANOS,
  normalizarPlanoAdmin,
  planoPorProduto,
  limitesDoPlano,
  diasDoPlano,
  checkoutDoPlano
} from '../functions/plan_catalog.js';
import {
  credenciaisKiwify,
  intervaloVendas,
  normalizarProdutoKiwify,
  normalizarVendaKiwify,
  normalizarContaKiwify
} from '../functions/kiwify_api.js';
import { handleAdminRequest, ACOES } from '../functions/super_admin.js';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function definirNoEstado(estado, caminho, valor) {
  const partes = String(caminho).split('/').filter(Boolean);
  let alvo = estado;
  for (let i = 0; i < partes.length - 1; i++) {
    if (!alvo[partes[i]] || typeof alvo[partes[i]] !== 'object') alvo[partes[i]] = {};
    alvo = alvo[partes[i]];
  }
  const ultima = partes[partes.length - 1];
  if (valor == null) delete alvo[ultima];
  else alvo[ultima] = valor;
}

function lerDoEstado(estado, caminho) {
  if (!caminho) return estado;
  return String(caminho).split('/').filter(Boolean).reduce(
    (acc, chave) => (acc == null ? null : acc[chave]), estado
  );
}

function criarDb(estadoInicial) {
  const estado = JSON.parse(JSON.stringify(estadoInicial));
  const escritas = [];
  const auditorias = [];

  function ref(caminho) {
    const api = {
      once: async () => {
        const valor = lerDoEstado(estado, caminho);
        return { val: () => valor ?? null, exists: () => valor != null };
      },
      update: async (dados) => {
        escritas.push({ caminho, dados });
        for (const [chave, valor] of Object.entries(dados)) definirNoEstado(estado, chave, valor);
      },
      set: async (valor) => {
        escritas.push({ caminho, valor });
        definirNoEstado(estado, caminho, valor);
      },
      push: async (dados) => {
        auditorias.push({ caminho, dados });
        return { key: `audit_${auditorias.length}` };
      },
      child: (chave) => ref(`${caminho}/${chave}`),
      orderByChild: () => ({
        equalTo: (valor) => ({
          once: async () => {
            const pai = lerDoEstado(estado, caminho) || {};
            const encontrados = Object.fromEntries(
              Object.entries(pai).filter(([, item]) => item && Object.values(item).includes(valor))
            );
            return { val: () => Object.keys(encontrados).length ? encontrados : null };
          }
        })
      })
    };
    return api;
  }

  return { estado, escritas, auditorias, ref };
}

function criarAuth(overrides = {}) {
  const chamadas = { updateUser: [], revokeRefreshTokens: [], deleteUser: [] };
  const auth = {
    verifyIdToken: async () => ({ uid: 'masterUid', email: 'tonycampelo@gmail.com' }),
    getUser: async () => ({ uid: 'masterUid', disabled: false }),
    getUserByEmail: async (email) => ({ uid: 'alvoUid', email, disabled: false }),
    generatePasswordResetLink: async (email) => `https://example.test/reset?email=${email}&token=LINK_SECRETO`,
    updateUser: async (uid, dados) => { chamadas.updateUser.push({ uid, dados }); },
    revokeRefreshTokens: async (uid) => { chamadas.revokeRefreshTokens.push(uid); },
    deleteUser: async (uid) => { chamadas.deleteUser.push(uid); },
    ...overrides
  };
  return { auth, chamadas };
}

function criarRes() {
  const saida = { statusCode: 200, payload: null };
  return {
    saida,
    status(codigo) { saida.statusCode = codigo; return this; },
    json(payload) { saida.payload = payload; return payload; }
  };
}

function estadoBase() {
  return {
    profiles: {
      'masterUid': { uid: 'masterUid', email: 'tonycampelo@gmail.com', role: 'super_admin' },
      'alvoUid': { uid: 'alvoUid', email: 'alvo@empresa.com', role: 'admin', status: 'ativo', tenantId: 'tenant1' }
    },
    users: {
      'tonycampelo@gmail,com': { role: 'super_admin' },
      'alvo@empresa,com': { role: 'admin' }
    },
    tenants: {
      tenant1: {
        plano: 'start',
        status: 'ativo',
        billingState: 'ativo',
        config: { limiteObras: 2, limiteUsuarios: 2, limiteTrabalhadores: 9999 }
      }
    },
    admin_audit: {}
  };
}

async function chamarApi({ body, query = {}, authorization = 'Bearer token-valido', db, auth, extras = {} }) {
  const req = { method: body ? 'POST' : 'GET', body, query, headers: { authorization } };
  const res = criarRes();
  await handleAdminRequest(req, res, { db, auth, http: { get: async () => ({ data: {} }), post: async () => ({ data: {} }) }, ...extras });
  return res.saida;
}

describe('catálogo canônico de planos', () => {
  it('normaliza aliases e nomes vindos da Kiwify', () => {
    expect(normalizarPlanoAdmin('FULL')).toBe('ilimitado');
    expect(normalizarPlanoAdmin('start-anual')).toBe('start_anual');
    expect(normalizarPlanoAdmin('MASTER_SYSTEM')).toBe('MASTER_SYSTEM');
    expect(normalizarPlanoAdmin('inexistente')).toBeNull();
    expect(planoPorProduto('Start', true).id).toBe('start_anual');
    expect(planoPorProduto('Plano Ilimitado').id).toBe('ilimitado');
    expect(planoPorProduto('Full Anual', true).id).toBe('full_anual');
    expect(planoPorProduto('Outro', false).id).toBe('pro');
  });

  it('aplica limites do plano com ajustes manuais e validade padrão', () => {
    expect(limitesDoPlano('start')).toEqual({ obras: 2, usuarios: 2, trabalhadores: 9999 });
    expect(limitesDoPlano('start', { usuarios: 7 })).toEqual({ obras: 2, usuarios: 7, trabalhadores: 9999 });
    expect(limitesDoPlano('pro', { usuarios: 0, obras: -5 })).toEqual({ obras: 5, usuarios: 5, trabalhadores: 9999 });
    expect(diasDoPlano('pro_anual')).toBe(365);
    expect(diasDoPlano('start', 60)).toBe(60);
    expect(checkoutDoPlano('ilimitado')).toBe('https://pay.kiwify.com.br/z2hLFKq');
    expect(checkoutDoPlano('MASTER_SYSTEM')).toBeNull();
    expect(Object.keys(PLANOS)).toContain('free_trial');
  });
});

describe('cliente de leitura da Kiwify', () => {
  it('só considera configurado quando há conta e credencial', () => {
    expect(credenciaisKiwify().configurado).toBe(false);
    expect(credenciaisKiwify({ accountId: 'abc' }).configurado).toBe(false);
    expect(credenciaisKiwify({ accountId: 'abc', apiToken: 'xyz' }).modo).toBe('token');
    expect(credenciaisKiwify({ accountId: 'abc', clientId: 'id', clientSecret: 'secret' }).modo).toBe('oauth');
  });

  it('limita o intervalo de vendas a 90 dias', () => {
    const fim = new Date('2026-11-20T00:00:00.000Z').getTime();
    const periodo = intervaloVendas({ start_date: '2026-01-01T00:00:00.000Z', end_date: '2026-11-20T00:00:00.000Z' }, fim);
    const dias = (new Date(periodo.end_date) - new Date(periodo.start_date)) / 86400000;
    expect(dias).toBe(90);
    expect(() => intervaloVendas({ start_date: '2026-12-01', end_date: '2026-01-01' })).toThrow();
  });

  it('normaliza produtos, vendas e conta sem expor segredos', () => {
    const produto = normalizarProdutoKiwify({ id: 'p1', name: 'Start Anual', price: 6990, status: 'active' });
    expect(produto.planoLocal).toBe('start_anual');
    expect(produto.preco).toBe(69.9);
    expect(produto.checkout).toBe(checkoutDoPlano('start'));
    expect(produto.limites.usuarios).toBe(2);

    const venda = normalizarVendaKiwify({
      id: 'v1',
      status: 'approved',
      product: { id: 'p1', name: 'Pro' },
      payment: { charge_amount: 10590 },
      customer: { name: 'Ana', email: 'ANA@EMPRESA.COM' },
      tracking: { src: 'tenant42' }
    });
    expect(venda.planoLocal).toBe('pro');
    expect(venda.valor).toBe(105.9);
    expect(venda.clienteEmail).toBe('ana@empresa.com');
    expect(venda.tenantRef).toBe('tenant42');

    const conta = normalizarContaKiwify({ id: 'c1', company_name: 'Minha Empresa', legal_entities: [] });
    expect(conta).toEqual({ id: 'c1', nomeEmpresa: 'Minha Empresa', entidades: [] });
  });
});

describe('API /api/admin/conta', () => {
  it('exige token e papel de super admin', async () => {
    const db = criarDb(estadoBase());
    const { auth } = criarAuth();

    const semToken = await chamarApi({ body: { acao: 'definir_limites' }, authorization: '', db, auth });
    expect(semToken.statusCode).toBe(401);
    expect(semToken.payload.ok).toBe(false);

    const { auth: authComum } = criarAuth({
      verifyIdToken: async () => ({ uid: 'outro-uid', email: 'comum@empresa.com' }),
      getUser: async () => ({ uid: 'outro-uid', disabled: false })
    });
    const semPermissao = await chamarApi({ body: { acao: 'definir_limites' }, db, auth: authComum });
    expect(semPermissao.statusCode).toBe(403);
    expect(semPermissao.payload.erro).toBe('sem_permissao');
  });

  it('aceita apenas ações conhecidas', async () => {
    const db = criarDb(estadoBase());
    const { auth } = criarAuth();
    expect(Object.keys(ACOES)).toEqual(expect.arrayContaining([
      'reset_password', 'bloquear_usuario', 'excluir_usuario',
      'definir_limites', 'definir_plano', 'bloquear_tenant'
    ]));
    const saida = await chamarApi({ body: { acao: 'excluir_tudo' }, db, auth });
    expect(saida.statusCode).toBe(400);
    expect(saida.payload.erro).toBe('acao_invalida');
  });

  it('gera link de senha sem gravar o segredo na auditoria', async () => {
    const db = criarDb(estadoBase());
    const { auth } = criarAuth();
    const saida = await chamarApi({ body: { acao: 'reset_password', email: 'alvo@empresa.com' }, db, auth });

    expect(saida.statusCode).toBe(200);
    expect(saida.payload.ok).toBe(true);
    expect(saida.payload.link).toContain('LINK_SECRETO');
    expect(JSON.stringify(db.auditorias)).not.toContain('LINK_SECRETO');
    expect(db.auditorias[0].dados.acao).toBe('reset_password');
  });

  it('bloqueia e desbloqueia usuário no Auth e no perfil', async () => {
    const db = criarDb(estadoBase());
    const { auth, chamadas } = criarAuth();

    const bloqueio = await chamarApi({
      body: { acao: 'bloquear_usuario', uid: 'alvoUid', email: 'alvo@empresa.com', bloqueado: true }, db, auth
    });
    expect(bloqueio.payload.bloqueado).toBe(true);
    expect(chamadas.updateUser[0]).toEqual({ uid: 'alvoUid', dados: { disabled: true } });
    expect(chamadas.revokeRefreshTokens).toContain('alvoUid');
    expect(db.estado.profiles['alvoUid'].status).toBe('bloqueado');

    const libera = await chamarApi({
      body: { acao: 'bloquear_usuario', uid: 'alvoUid', bloqueado: false }, db, auth
    });
    expect(libera.payload.bloqueado).toBe(false);
    expect(chamadas.updateUser[1].dados).toEqual({ disabled: false });
    expect(db.estado.profiles['alvoUid'].status).toBe('ativo');
  });

  it('impede auto-bloqueio e auto-exclusão', async () => {
    const db = criarDb(estadoBase());
    const { auth } = criarAuth();
    const bloqueio = await chamarApi({
      body: { acao: 'bloquear_usuario', uid: 'masterUid', email: 'tonycampelo@gmail.com', bloqueado: true }, db, auth
    });
    const exclusao = await chamarApi({
      body: { acao: 'excluir_usuario', uid: 'masterUid' }, db, auth
    });
    expect(bloqueio.statusCode).toBe(400);
    expect(exclusao.statusCode).toBe(400);
    expect(db.estado.profiles['masterUid']).toBeTruthy();
  });

  it('aplica plano e limites pelo servidor, preservando o ciclo de cobrança', async () => {
    const db = criarDb(estadoBase());
    const { auth } = criarAuth();
    const antes = Date.now();

    const limites = await chamarApi({
      body: { acao: 'definir_limites', tenantId: 'tenant1', plano: 'start', limites: { usuarios: 7 } }, db, auth
    });
    expect(limites.payload.limites.usuarios).toBe(7);
    expect(db.estado.tenants.tenant1.config.limiteUsuarios).toBe(7);
    expect(db.estado.tenants.tenant1.plano).toBe('start');

    const plano = await chamarApi({
      body: { acao: 'definir_plano', tenantId: 'tenant1', plano: 'pro_anual', dias: 45 }, db, auth
    });
    expect(plano.statusCode).toBe(200);
    expect(db.estado.tenants.tenant1.plano).toBe('pro_anual');
    expect(db.estado.tenants.tenant1.billingState).toBe('ativo');
    expect(db.estado.tenants.tenant1.config.limiteUsuarios).toBe(5);
    expect(db.estado.tenants.tenant1.planoVencimento).toBeGreaterThan(antes + 44 * 86400000);
  });

  it('bloqueia e libera a empresa inteira', async () => {
    const db = criarDb(estadoBase());
    const { auth } = criarAuth();
    const bloqueio = await chamarApi({
      body: { acao: 'bloquear_tenant', tenantId: 'tenant1', bloqueado: true }, db, auth
    });
    expect(bloqueio.payload.bloqueado).toBe(true);
    expect(db.estado.tenants.tenant1.billingState).toBe('bloqueado');
    expect(db.estado.tenants.tenant1.status).toBe('bloqueado_pagamento');

    await chamarApi({ body: { acao: 'bloquear_tenant', tenantId: 'tenant1', bloqueado: false }, db, auth });
    expect(db.estado.tenants.tenant1.billingState).toBe('ativo');
  });

  it('exclui usuário no Admin SDK e limpa o passaporte global', async () => {
    const db = criarDb(estadoBase());
    const { auth, chamadas } = criarAuth();
    const saida = await chamarApi({
      body: { acao: 'excluir_usuario', uid: 'alvoUid', email: 'alvo@empresa.com', tenantId: 'tenant1' }, db, auth
    });
    expect(saida.payload.excluido).toBe(true);
    expect(chamadas.deleteUser).toContain('alvoUid');
    expect(db.estado.profiles['alvoUid']).toBeUndefined();
    expect(db.estado.users['alvo@empresa,com']).toBeUndefined();
    expect(db.estado.tenants.tenant1).toBeTruthy();
  });

  it('responde sem erro quando a Kiwify não está configurada', async () => {
    const db = criarDb(estadoBase());
    const { auth } = criarAuth();
    const saida = await chamarApi({ query: { tipo: 'products' }, db, auth });
    expect(saida.statusCode).toBe(200);
    expect(saida.payload.ok).toBe(true);
    expect(saida.payload.configurado).toBe(false);
    expect(saida.payload.data).toEqual([]);
    expect(Array.isArray(saida.payload.catalogoLocal)).toBe(true);
  });

  it('lê produtos da Kiwify com token e account-id no servidor', async () => {
    const db = criarDb(estadoBase());
    const { auth } = criarAuth();
    const headersVistos = [];
    const http = {
      post: async () => ({ data: { access_token: 'TOKEN_OAUTH', expires_in: 3600 } }),
      get: async (url, opts) => {
        headersVistos.push(opts.headers);
        expect(url).toContain('/products');
        return { data: { data: [{ id: 'p1', name: 'Plano Start Anual', price: 6990, status: 'active' }] } };
      }
    };
    const saida = await chamarApi({
      query: { tipo: 'products' }, db, auth,
      extras: {
        http,
        credenciaisKiwify: credenciaisKiwify({ clientId: 'id', clientSecret: 'secret', accountId: 'conta-1' })
      }
    });
    expect(saida.statusCode).toBe(200);
    expect(saida.payload.configurado).toBe(true);
    expect(saida.payload.data[0].planoLocal).toBe('start_anual');
    expect(headersVistos[0].Authorization).toBe('Bearer TOKEN_OAUTH');
    expect(headersVistos[0]['x-kiwify-account-id']).toBe('conta-1');
    expect(JSON.stringify(saida.payload)).not.toContain('secret');
  });
});

describe('integração do painel no projeto', () => {
  it('expõe o rewrite da API e registra a função com secrets', () => {
    const hosting = JSON.parse(read('firebase.json')).hosting.rewrites;
    expect(hosting).toContainEqual({ source: '/api/admin/conta', function: 'adminAccountApi' });
    const index = read('functions/index.js');
    expect(index).toContain('exports.adminAccountApi');
    expect(index).toContain('KIWIFY_CLIENT_ID');
    expect(index).toContain('KIWIFY_CLIENT_SECRET');
    expect(index).toContain('KIWIFY_ACCOUNT_ID');
    expect(index).toContain("after.status === 'bloqueado'");
  });

  it('painel traz Kiwify, auditoria e modais no HTML', () => {
    const html = read('public/pages/super_admin.html');
    for (const trecho of [
      'loadKiwifyData(', 'loadAdminAudit(', 'masterApplyPlan(', 'masterOpenCheckout(',
      'id="mr-link"', 'id="mu-plano"', 'id="admin-audit-tbody"'
    ]) {
      expect(html).toContain(trecho);
    }
  });

  it('front usa o endpoint autorizado e nunca grava plano/limites direto', () => {
    const app = read('public/js/app_core.js');
    expect(app).toContain("const ADMIN_API_URL = '/api/admin/conta'");
    expect(app).toContain("acao: 'definir_plano'");
    expect(app).toContain("acao: 'definir_limites'");
    expect(app).toContain("acao: 'bloquear_usuario'");
    expect(app).toContain("acao: 'reset_password'");
    expect(app).toContain('window.loadKiwifyData = loadKiwifyData');
    for (const acao of [
      'masterResetUserPassword(', 'masterToggleUserBlock(', 'masterDeleteUserApi(',
      'masterToggleTenantBlock(', 'openMasterUpgradeModal('
    ]) {
      expect(app).toContain(acao);
    }
    const trechoSalvar = app.slice(app.indexOf('async function saveMasterTenant'), app.indexOf('async function deleteTenant'));
    expect(trechoSalvar).not.toContain('updates[`tenants/${tid}/plano`]');
    expect(trechoSalvar).not.toContain('updates[`tenants/${tid}/config/limiteUsuarios`]');
  });

  it('checkout aceita os IDs anuais/legados do catálogo do servidor', () => {
    const urls = [];
    const fake = { open: (url) => urls.push(url), APP_WHATSAPP: '5598985262006' };
    vm.runInNewContext(read('public/js/plans.js'), {
      window: fake,
      sessionStorage: { getItem: () => null },
      encodeURIComponent,
      console
    });

    fake.startKiwifyCheckoutFor('full_anual', 'tenant_123');
    fake.startKiwifyCheckoutFor('start_anual', 'tenant_456');
    expect(urls[0]).toBe('https://pay.kiwify.com.br/z2hLFKq?external_reference=tenant_123');
    expect(urls[1]).toBe('https://pay.kiwify.com.br/hHQz2Zu?external_reference=tenant_456');
  });

  it('sessões bloqueadas são encerradas no cliente', () => {
    const auth = read('public/js/auth_core.js');
    expect(auth).toContain("perfilAtual.status === 'bloqueado'");
    expect(auth).toContain('observarStatusPerfil(user)');
    expect(auth).toContain("sessionUser.status === 'bloqueado'");
  });

  it('auditoria só é legível pelo master e nunca gravável pelo cliente', () => {
    const rules = JSON.parse(read('database.rules.json')).rules.admin_audit;
    expect(rules['.read']).toContain("=== 'super_admin'");
    expect(rules['.read']).toContain("root.child('users/'");
    expect(rules['.read']).toContain("replace('.', ',')");
    expect(rules['.write']).toBe(false);
  });
});
