// tests/aprovacoes-api.test.js
// Regressão: decisão de trabalhador_add criado pelo encarregado, aprovada por
// admin comum e por super_admin operando outro tenant — sem permission_denied.
import { describe, it, expect } from 'vitest';
import { handleAprovacaoRequest, papelPodeDecidir } from '../functions/aprovacoes-api.js';
import { criarFakeDB, aprovacaoBase, baseTenant, DIA } from './helpers/fake-db.js';

// A validação usa Date.now(); fixture deve estar viva em relação ao relógio.
const AGORA = Date.now();

function req(dados, uid) {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer token-falso', 'x-forwarded-for': '10.0.0.1' },
    body: { acao: 'decidir_aprovacao', ...dados, _uid: uid }
  };
}

function resposta() {
  return {
    status: null,
    corpo: null,
    headers: {},
    set(k, v) { this.headers[k] = v; return this; },
    status(code) { this.status = code; return this; },
    json(payload) { this.corpo = payload; return this; }
  };
}

function opcoes(db, uid, papel, tenant = 't1', email = 'adm@obra.com') {
  return {
    db,
    auth: {
      async verifyIdToken() { return { uid, email, role: papel, tenantId: tenant }; },
      async getUser() { return { uid, email, disabled: false }; }
    }
  };
}

function estado(cenarios = {}) {
  const inicial = baseTenant();
  const ap = aprovacaoBase({
    id: 'AP1',
    tipo: 'trabalhador_add',
    status: 'pendente',
    solicitadoPor: 'uid-enc',
    solicitadoEm: AGORA - 3 * DIA,
    expiraEm: AGORA + 12 * DIA,
    payload: { trabalhador: { nome: 'João', obra: 'OB1' } }
  });
  delete ap.decididoPor;
  delete ap.decididoPorPapel;
  delete ap.decididoEm;
  inicial.tenants.t1.aprovacoes = { AP1: ap };
  Object.assign(inicial.tenants.t1, cenarioTenant(cenarios));
  Object.assign(inicial.profiles, cenarioPerfis(cenarios));
  return inicial;
}

function cenarioTenant(cenarios) {
  if (cenarios.billing) return { billingState: cenarios.billing };
  return {};
}

function cenarioPerfis(cenarios) {
  const perfis = {};
  if (cenarios.superAdmin) {
    perfis['uid-master'] = { tenantId: 'MASTER_SYSTEM', role: 'super_admin' };
    perfis['uid-master-outro'] = { tenantId: 't2', role: 'admin' };
  }
  return perfis;
}

function dados(sobrescrever = {}) {
  return {
    acao: 'decidir_aprovacao',
    tenantId: 't1',
    aprovacaoId: 'AP1',
    decisao: 'aprovado',
    ...sobrescrever
  };
}

describe('aprovacoes-api — decisão server-side', () => {
  it('admin comum aprova trabalhador_add pedido pelo encarregado', async () => {
    const db = criarFakeDB(estado());
    const res = resposta();
    await handleAprovacaoRequest(
      req(dados()), res,
      opcoes(db, 'uid-admin', 'admin')
    );
    expect(res.status).toBe(200);
    expect(res.corpo).toMatchObject({ ok: true, status: 'aprovado' });
    const ap = db.ler('tenants/t1/aprovacoes/AP1');
    expect(ap).toMatchObject({
      status: 'aprovado',
      decididoPor: 'uid-admin',
      decididoPorPapel: 'admin'
    });
  });

  it('super_admin operando tenant alheio aprova sem cair em permission_denied', async () => {
    const inicial = estado({ superAdmin: true });
    inicial.super_admins = { 'uid-master': { ativo: true, role: 'super_admin' } };
    const db = criarFakeDB(inicial);
    const res = resposta();
    await handleAprovacaoRequest(
      req(dados()), res,
      opcoes(db, 'uid-master', 'super_admin', 'MASTER_SYSTEM', 'master@obra.com')
    );
    expect(res.status).toBe(200);
    expect(db.ler('tenants/t1/aprovacoes/AP1')).toMatchObject({
      status: 'aprovado',
      decididoPor: 'uid-master',
      decididoPorPapel: 'admin'
    });
  });

  it('aprova quando a claim é admin mas o perfil está desatualizado como encarregado', async () => {
    const db = criarFakeDB(estado());
    await db.ref('profiles/uid-admin').update({ role: 'encarregado' });
    const res = resposta();
    await handleAprovacaoRequest(
      req(dados()), res,
      opcoes(db, 'uid-admin', 'admin')
    );
    expect(res.status).toBe(200);
    expect(db.ler('tenants/t1/aprovacoes/AP1')).toMatchObject({
      status: 'aprovado',
      decididoPorPapel: 'admin'
    });
  });

  it('aprova quando o perfil é admin mas a claim é antiga (encarregado)', async () => {
    const db = criarFakeDB(estado());
    const res = resposta();
    await handleAprovacaoRequest(
      req(dados()), res,
      opcoes(db, 'uid-admin', 'encarregado')
    );
    expect(res.status).toBe(200);
  });

  it('aprova pelo emailAdmin do tenant mesmo com papel comum no perfil', async () => {
    const inicial = estado();
    inicial.tenants.t1.emailAdmin = 'dono@obra.com';
    const db = criarFakeDB(inicial);
    await db.ref('profiles/uid-admin').update({ role: 'comprador' });
    const res = resposta();
    await handleAprovacaoRequest(
      req(dados()), res,
      opcoes(db, 'uid-admin', 'comprador', 't1', 'dono@obra.com')
    );
    expect(res.status).toBe(200);
    expect(db.ler('tenants/t1/aprovacoes/AP1')).toMatchObject({
      status: 'aprovado',
      decididoPorPapel: 'admin'
    });
  });

  it('bloqueia decisão quando o plano está em somente_leitura', async () => {
    const db = criarFakeDB(estado({ billing: 'somente_leitura' }));
    const res = resposta();
    await handleAprovacaoRequest(
      req(dados()), res,
      opcoes(db, 'uid-admin', 'admin')
    );
    expect(res.status).toBe(403);
    expect(res.corpo).toMatchObject({ ok: false, erro: 'plano_bloqueado' });
    expect(db.ler('tenants/t1/aprovacoes/AP1/status')).toBe('pendente');
  });

  it('bloqueia admin de outro tenant e engenheiro em trabalhador_add', async () => {
    const db1 = criarFakeDB(estado());
    const res1 = resposta();
    await handleAprovacaoRequest(
      req(dados()), res1,
      opcoes(db1, 'uid-outro', 'admin', 't2')
    );
    expect(res1.status).toBe(403);
    expect(res1.corpo).toMatchObject({ erro: 'tenant_invalido' });

    const db2 = criarFakeDB(estado());
    const res2 = resposta();
    await handleAprovacaoRequest(
      req(dados()), res2,
      opcoes(db2, 'uid-eng', 'engenheiro')
    );
    expect(res2.status).toBe(403);
    expect(res2.corpo).toMatchObject({ erro: 'sem_permissao' });
    expect(db2.ler('tenants/t1/aprovacoes/AP1/status')).toBe('pendente');
  });

  it('rejeição exige motivo e grava o papel do decisor', async () => {
    const db = criarFakeDB(estado());
    const semMotivo = resposta();
    await handleAprovacaoRequest(
      req(dados({ decisao: 'rejeitado' })), semMotivo,
      opcoes(db, 'uid-admin', 'admin')
    );
    expect(semMotivo.status).toBe(400);

    const comMotivo = resposta();
    await handleAprovacaoRequest(
      req(dados({ decisao: 'rejeitado', motivo: 'Dados incompletos' })), comMotivo,
      opcoes(db, 'uid-admin', 'admin')
    );
    expect(comMotivo.status).toBe(200);
    expect(db.ler('tenants/t1/aprovacoes/AP1')).toMatchObject({
      status: 'rejeitado',
      motivo: 'Dados incompletos',
      decididoPorPapel: 'admin'
    });
  });

  it('não reaplica decisão concorrente', async () => {
    const db = criarFakeDB(estado());
    const r1 = resposta();
    const r2 = resposta();
    await Promise.all([
      handleAprovacaoRequest(req(dados()), r1, opcoes(db, 'uid-admin', 'admin')),
      handleAprovacaoRequest(req(dados()), r2, opcoes(db, 'uid-admin', 'admin'))
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
  });
});

describe('aprovacoes-api — autoridade', () => {
  it('admin e super_admin decidem; encarregado nunca', () => {
    const ap = aprovacaoBase({ tipo: 'trabalhador_add' });
    expect(papelPodeDecidir('admin', ap)).toBe(true);
    expect(papelPodeDecidir('super_admin', ap)).toBe(true);
    expect(papelPodeDecidir('encarregado', ap)).toBe(false);
    expect(papelPodeDecidir('mestre', ap)).toBe(false);
  });
});
