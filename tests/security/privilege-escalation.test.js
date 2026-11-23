// Fase 1 — fechar escalação de privilégios.
// Regras do RTDB, sincronização de claims e centralização de cargos no servidor.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { avaliarSuperAdmin, normalizarRole } from '../../functions/claims.js';
import { handleCargoRequest } from '../../functions/cargos.js';

const root = path.resolve(import.meta.dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const rules = JSON.parse(read('database.rules.json')).rules;

function definirNoEstado(estado, caminho, valor) {
  const partes = String(caminho).split('/').filter(Boolean);
  let alvo = estado;
  for (const parte of partes.slice(0, -1)) {
    if (!alvo[parte] || typeof alvo[parte] !== 'object') alvo[parte] = {};
    alvo = alvo[parte];
  }
  const ultima = partes[partes.length - 1];
  if (valor == null) delete alvo[ultima];
  else alvo[ultima] = valor;
}

function lerNoEstado(estado, caminho) {
  return String(caminho).split('/').filter(Boolean).reduce(
    (acc, chave) => (acc == null ? null : acc[chave]), estado
  );
}

function criarDb(estadoInicial) {
  const estado = JSON.parse(JSON.stringify(estadoInicial));
  const escritas = [];
  const auditorias = [];

  function ref(caminho) {
    return {
      once: async () => {
        const valor = lerNoEstado(estado, caminho);
        return { val: () => valor ?? null, exists: () => valor != null };
      },
      update: async (dados) => {
        escritas.push({ tipo: 'update', caminho, dados });
        for (const [chave, valor] of Object.entries(dados)) definirNoEstado(estado, `${caminho}/${chave}`, valor);
      },
      set: async (valor) => {
        escritas.push({ tipo: 'set', caminho, valor });
        definirNoEstado(estado, caminho, valor);
      },
      push: async (dados) => {
        auditorias.push(dados);
        return { key: `audit_${auditorias.length}` };
      },
      child: (chave) => ref(`${caminho}/${chave}`),
      orderByChild: () => ({
        equalTo: (valor) => ({
          once: async () => {
            const pai = lerNoEstado(estado, caminho) || {};
            const encontrados = Object.fromEntries(
              Object.entries(pai).filter(([, item]) => item && Object.values(item).includes(valor))
            );
            return { val: () => Object.keys(encontrados).length ? encontrados : null };
          }
        })
      })
    };
  }
  return { estado, escritas, auditorias, ref };
}

function criarAuth(chamador = { uid: 'adminUid', email: 'admin@empresa.com', role: 'admin', tenantId: 'tenant1' }) {
  const chamadas = { revogacoes: [], desabilitados: [] };
  const auth = {
    verifyIdToken: async () => chamador,
    getUser: async (uid) => ({ uid, disabled: false }),
    getUserByEmail: async (email) => ({ uid: 'alvoUid', email, disabled: false }),
    revokeRefreshTokens: async (uid) => { chamadas.revogacoes.push(uid); },
    updateUser: async (uid) => { chamadas.desabilitados.push(uid); }
  };
  return { auth, chamadas };
}

function estadoBase() {
  return {
    profiles: {
      adminUid: { uid: 'adminUid', email: 'admin@empresa.com', role: 'admin', tenantId: 'tenant1', status: 'ativo' },
      masterUid: { uid: 'masterUid', email: 'tonycampelo@gmail.com', role: 'super_admin', tenantId: 'MASTER_SYSTEM', status: 'ativo' },
      alvoUid: { uid: 'alvoUid', email: 'alvo@empresa.com', role: 'engenheiro', tenantId: 'tenant1', status: 'ativo' }
    },
    users: {
      'admin@empresa,com': { uid: 'adminUid', email: 'admin@empresa.com', role: 'admin', tenantId: 'tenant1' },
      'tonycampelo@gmail,com': { role: 'super_admin', tenantId: 'MASTER_SYSTEM' },
      'alvo@empresa,com': { uid: 'alvoUid', email: 'alvo@empresa.com', role: 'engenheiro', tenantId: 'tenant1' }
    },
    invites: {},
    super_admins: {},
    tenants: { tenant1: { usuarios: [{ email: 'alvo@empresa.com', uid: 'alvoUid' }] } },
    admin_audit: {}
  };
}

async function chamar(body, { db, auth, authorization = 'Bearer token', method = 'POST' } = {}) {
  const saida = { statusCode: 200, payload: null };
  const res = {
    status(codigo) { saida.statusCode = codigo; return this; },
    json(payload) { saida.payload = payload; return payload; }
  };
  await handleCargoRequest(
    { method, body, headers: { authorization } },
    res,
    { db, auth }
  );
  return saida;
}

describe('database.rules.json — profiles/<uid> sem autoescalada', () => {
  const perfil = rules.profiles.$uid;

  it('o usuário não pode alterar cargo, tenant ou status do próprio perfil', () => {
    expect(perfil['.write']).toContain("newData.child('role').val() === data.child('role').val()");
    expect(perfil['.write']).toContain("newData.child('tenantId').val() === data.child('tenantId').val()");
    expect(perfil['.write']).toContain("newData.child('status').val() === data.child('status').val()");
    expect(perfil['.write']).not.toContain("newData.child('role').val() !== 'super_admin'");
    expect(perfil['.write']).not.toContain("root.child('profiles/' + auth.uid + '/role').val() === 'admin'");
  });

  it('a criação do perfil exige uid/e-mail do próprio usuário e status ativo', () => {
    expect(perfil['.write']).toContain("newData.child('uid').val() === auth.uid");
    expect(perfil['.write']).toContain("newData.child('email').val() === auth.token.email");
    expect(perfil['.write']).toContain("newData.child('status').val() === 'ativo'");
  });

  it('role nunca pode ser criado como super_admin pelo cliente e é imutável depois', () => {
    const role = perfil.role['.validate'];
    expect(role).toContain("data.exists() ? newData.val() === data.val()");
    expect(role).not.toContain("'super_admin'");
    for (const cargo of ['admin', 'engenheiro', 'encarregado', 'comprador', 'pendente']) {
      expect(role).toContain(`newData.val() === '${cargo}'`);
    }
  });

  it('tenantId do perfil é imutável ou precisa casar com passaporte/convite', () => {
    const tenant = perfil.tenantId['.validate'];
    expect(tenant).toContain("data.exists() ? newData.val() === data.val()");
    expect(tenant).toContain("root.child('users/'");
    expect(tenant).toContain("root.child('invites/'");
  });

  it('uid/e-mail do perfil são imutáveis', () => {
    expect(perfil.uid['.validate']).toContain('newData.val() === data.val()');
    expect(perfil.email['.validate']).toContain('newData.val() === data.val()');
  });
});

describe('database.rules.json — users/<email> não é fonte de privilégio', () => {
  const usuario = rules.users.$email;

  it('cliente não pode gravar role super_admin no passaporte', () => {
    const role = usuario.role['.validate'];
    expect(role).not.toContain("'super_admin'");
    expect(role).toContain("data.exists() ? newData.val() === data.val()");
  });

  it('criação exige uid do próprio usuário; role e tenant são imutáveis depois', () => {
    expect(usuario['.write']).toContain("!data.exists() && newData.child('uid').val() === auth.uid");
    expect(usuario['.write']).toContain("newData.child('role').val() === data.child('role').val()");
    expect(usuario['.write']).toContain("newData.child('tenantId').val() === data.child('tenantId').val()");
    expect(usuario.tenantId['.validate']).toContain('data.exists() ? newData.val() === data.val()');
  });

  it('convites também não podem conceder super_admin', () => {
    expect(rules.invites.$email.role['.validate']).not.toContain("'super_admin'");
  });

  it('allowlist de mestres é somente leitura para o cliente', () => {
    expect(rules.super_admins['.write']).toBe(false);
    expect(rules.super_admins['.read']).toContain("=== 'super_admin'");
  });
});

describe('claims.js — autoridade de super_admin', () => {
  it('normaliza o alias legado mestre', () => {
    expect(normalizarRole('mestre')).toBe('encarregado');
    expect(normalizarRole('engenheiro')).toBe('engenheiro');
  });

  it('users/<email> sozinho NÃO promove ninguém', async () => {
    const db = criarDb({ users: { 'atacante@gmail,com': { role: 'super_admin' } }, super_admins: {} });
    const decisao = await avaliarSuperAdmin({
      uid: 'atacanteUid',
      email: 'atacante@gmail.com',
      currentClaims: { role: 'engenheiro' },
      db
    });
    expect(decisao).toEqual({ autorizado: false, motivo: 'nao_autorizado' });
    expect(db.estado.super_admins.atacanteUid).toBeUndefined();
  });

  it('allowlist do servidor promove e o e-mail mestre continua autorizado', async () => {
    const db = criarDb({
      super_admins: { masterUid: { uid: 'masterUid', email: 'master@empresa.com', role: 'super_admin' } }
    });
    const permitido = await avaliarSuperAdmin({ uid: 'masterUid', email: 'master@empresa.com', currentClaims: {}, db });
    expect(permitido.motivo).toBe('allowlist');

    const mestre = await avaliarSuperAdmin({ uid: 'outroUid', email: 'tonycampelo@gmail.com', currentClaims: {}, db });
    expect(mestre.autorizado).toBe(true);
  });

  it('o legado só migra quem já tinha a claim de super_admin', async () => {
    const db = criarDb({
      users: { 'legado@gmail,com': { role: 'super_admin' } },
      super_admins: {}
    });
    const decisao = await avaliarSuperAdmin({
      uid: 'legadoUid',
      email: 'legado@gmail.com',
      currentClaims: { role: 'super_admin' },
      db
    });
    expect(decisao.motivo).toBe('legado_migrado');
    expect(db.estado.super_admins.legadoUid.email).toBe('legado@gmail.com');
  });
});

describe('API /api/admin/cargo — cargos centralizados no servidor', () => {
  it('exige token válido e papel administrativo', async () => {
    const db = criarDb(estadoBase());
    const { auth } = criarAuth();
    expect((await chamar({ acao: 'definir_cargo' }, { db, auth, authorization: '' })).statusCode).toBe(401);

    const { auth: comum } = criarAuth({ uid: 'comumUid', email: 'comum@empresa.com', role: 'engenheiro' });
    const resposta = await chamar({ acao: 'definir_cargo', email: 'alvo@empresa.com', role: 'admin' }, { db: criarDb(estadoBase()), auth: comum });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.payload.erro).toBe('sem_permissao');
  });

  it('admin do tenant não promove a super_admin, não cruza tenant e não se altera', async () => {
    const db = criarDb(estadoBase());
    const { auth } = criarAuth();

    const promocao = await chamar({ acao: 'definir_cargo', email: 'alvo@empresa.com', role: 'super_admin' }, { db, auth });
    expect(promocao.statusCode).toBe(403);
    expect(promocao.payload.erro).toBe('sem_permissao');

    db.estado.profiles.outroUid = { role: 'admin', tenantId: 'tenant2', email: 'outro@empresa2.com' };
    const cruzado = await chamar({ acao: 'definir_cargo', uid: 'outroUid', role: 'admin' }, { db, auth });
    expect(cruzado.statusCode).toBe(403);
    expect(cruzado.payload.erro).toBe('tenant_invalido');

    const proprio = await chamar({ acao: 'definir_cargo', uid: 'adminUid', role: 'engenheiro' }, { db, auth });
    expect(proprio.statusCode).toBe(400);
    expect(proprio.payload.erro).toBe('auto_alteracao');
  });

  it('super admin concede cargo gravando perfil, passaporte e allowlist', async () => {
    const db = criarDb(estadoBase());
    const { auth, chamadas } = criarAuth({ uid: 'masterUid', email: 'tonycampelo@gmail.com', role: 'super_admin' });

    const resposta = await chamar({ acao: 'definir_cargo', uid: 'alvoUid', role: 'super_admin' }, { db, auth });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.payload.role).toBe('super_admin');
    expect(resposta.payload.tenantId).toBe('MASTER_SYSTEM');
    expect(db.estado.profiles.alvoUid.role).toBe('super_admin');
    expect(db.estado.users['alvo@empresa,com'].role).toBe('super_admin');
    expect(db.estado.super_admins.alvoUid.email).toBe('alvo@empresa.com');
    expect(chamadas.revogacoes).toContain('alvoUid');
    expect(db.auditorias.at(-1).acao).toBe('definir_cargo');
  });

  it('ao remover o cargo de master, a allowlist é apagada e o tenant é preservado', async () => {
    const db = criarDb(estadoBase());
    db.estado.profiles.alvoUid.role = 'super_admin';
    db.estado.profiles.alvoUid.tenantId = 'MASTER_SYSTEM';
    db.estado.super_admins.alvoUid = { uid: 'alvoUid', role: 'super_admin' };
    const { auth } = criarAuth({ uid: 'masterUid', email: 'tonycampelo@gmail.com', role: 'super_admin' });

    await chamar({ acao: 'definir_cargo', uid: 'alvoUid', role: 'admin', tenantId: 'tenant1' }, { db, auth });
    expect(db.estado.super_admins.alvoUid).toBeUndefined();
    expect(db.estado.profiles.alvoUid.role).toBe('admin');
    expect(db.estado.profiles.alvoUid.tenantId).toBe('tenant1');
    expect(db.estado.profiles.alvoUid.status).toBe('ativo');
  });

  it('remover_usuario desvincula, apaga convite e bloqueia a credencial', async () => {
    const db = criarDb(estadoBase());
    db.estado.invites['alvo@empresa,com'] = { role: 'engenheiro', tenantId: 'tenant1' };
    const { auth, chamadas } = criarAuth();

    const resposta = await chamar({ acao: 'remover_usuario', uid: 'alvoUid', email: 'alvo@empresa.com' }, { db, auth });
    expect(resposta.statusCode).toBe(200);
    expect(db.estado.profiles.alvoUid.role).toBe('desativado');
    expect(db.estado.profiles.alvoUid.tenantId).toBeUndefined();
    expect(db.estado.invites['alvo@empresa,com']).toBeUndefined();
    expect(db.estado.tenants.tenant1.usuarios).toEqual([]);
    expect(chamadas.desabilitados).toContain('alvoUid');
  });
});

describe('front-end e deploy — nenhuma escrita privilegiada no cliente', () => {
  const index = read('functions/index.js');
  const claims = read('functions/claims.js');
  const app = read('public/js/app_core.js');
  const auth = read('public/js/auth_core.js');
  const hosting = JSON.parse(read('firebase.json')).hosting.rewrites;

  it('a função de claims usa a allowlist e não promove pelo nó users', () => {
    expect(index).toContain("require('./claims')");
    expect(index).toContain('avaliarSuperAdmin(');
    expect(claims).toContain('super_admins/${id}');
    expect(claims).toContain("currentClaims.role === 'super_admin'");
    expect(index).not.toContain('Se o usuário está cadastrado no nó users como super_admin');
  });

  it('o endpoint de cargos está exportado e roteado', () => {
    expect(index).toContain('exports.gerenciarCargo = onRequest(');
    expect(hosting).toContainEqual({ source: '/api/admin/cargo', function: 'gerenciarCargo' });
  });

  it('o painel troca cargo pela API autenticada', () => {
    expect(app).toContain("const CARGO_API_URL = '/api/admin/cargo'");
    expect(app).toContain('cargoApiRequest({');
    expect(app).toContain("acao: 'definir_cargo'");
    expect(app).toContain("acao: 'remover_usuario'");
    expect(app).not.toMatch(/profiles\/\$\{[^}]*\}\/role'\)\.set/);
    expect(app).not.toMatch(/users\/\$\{[^}]*\}\/role'\)\.set/);
  });

  it('o bootstrap de super admin pelo navegador foi removido', () => {
    expect(auth).not.toContain('bootstrapSuperAdmin');
    expect(auth).not.toContain("role: 'super_admin'");
    expect(auth).toContain("profileRef.update({ name: userProfile.name })");
  });
});
