import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ACOES_DESTRUTIVAS,
  contextoRequisicao,
  registrar,
  reservarOperacao,
  liberarOperacao
} from '../functions/auditoria.js';
import { executarLimpeza } from '../functions/retencao.js';
import { handleAdminRequest } from '../functions/super_admin.js';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

function criarDb(estadoInicial = {}) {
  const estado = JSON.parse(JSON.stringify(estadoInicial));
  const escritas = [];
  const auditorias = [];
  const removidos = [];

  function ler(caminho) {
    const partes = String(caminho).split('/').filter(Boolean);
    let alvo = estado;
    for (const p of partes) {
      if (alvo == null || typeof alvo !== 'object') return null;
      alvo = alvo[p];
    }
    return alvo == null ? null : alvo;
  }
  function definir(caminho, valor) {
    const partes = String(caminho).split('/').filter(Boolean);
    let alvo = estado;
    for (const p of partes.slice(0, -1)) {
      if (!alvo[p] || typeof alvo[p] !== 'object') alvo[p] = {};
      alvo = alvo[p];
    }
    const ultima = partes[partes.length - 1];
    if (valor == null) delete alvo[ultima];
    else alvo[ultima] = valor;
  }
  function ref(caminho = '') {
    return {
      once: async () => { const v = ler(caminho); return { val: () => v, exists: () => v != null }; },
      set: async (v) => { escritas.push({ caminho, valor: v }); definir(caminho, v); },
      update: async (v) => {
        escritas.push({ caminho, dados: v });
        if (!caminho) {
          for (const [k, valor] of Object.entries(v)) definir(k, valor);
        } else {
          for (const [k, valor] of Object.entries(v)) definir(`${caminho}/${k}`, valor);
        }
      },
      push: async (v) => {
        auditorias.push({ caminho, dados: v });
        return { key: `a${auditorias.length}` };
      },
      remove: async () => { removidos.push(caminho); definir(caminho, null); },
      transaction: async (fn) => {
        const anterior = ler(caminho);
        const proximo = fn(anterior);
        if (proximo !== undefined) definir(caminho, proximo);
        return { committed: proximo !== undefined, snapshot: { val: () => proximo === undefined ? anterior : proximo } };
      },
      child: (p) => ref(`${caminho}/${p}`),
      orderByChild: (campo) => ({
        equalTo: (valor) => ({
          once: async () => {
            const pai = ler(caminho) || {};
            const encontrados = Object.fromEntries(
              Object.entries(pai).filter(([, item]) => item && item[campo] === valor)
            );
            return { val: () => Object.keys(encontrados).length ? encontrados : null };
          }
        })
      })
    };
  }
  return { ref, estado, escritas, auditorias, removidos };
}

function criarAuth() {
  return {
    verifyIdToken: async () => ({ uid: 'masterUid', email: 'tonycampelo@gmail.com', role: 'super_admin' }),
    getUser: async (uid) => ({ uid, disabled: false }),
    getUserByEmail: async (email) => ({ uid: 'alvoUid', email, disabled: false }),
    deleteUser: async () => {},
    updateUser: async () => {},
    revokeRefreshTokens: async () => {}
  };
}

function estadoBase() {
  return {
    profiles: { masterUid: { role: 'super_admin', email: 'tonycampelo@gmail.com' } },
    users: { 'tonycampelo@gmail,com': { role: 'super_admin' } },
    super_admins: { masterUid: { ativo: true } },
    tenants: { t1: { plano: 'start', status: 'ativo', config: { limiteObras: 2, limiteUsuarios: 2 } } },
    admin_audit: {}
  };
}

function resMock() {
  return {
    codigo: 200,
    payload: null,
    status(c) { this.codigo = c; return this; },
    json(p) { this.payload = p; return p; }
  };
}

describe('Auditoria administrativa', () => {
  it('contexto traz requestId, IP hashado, User-Agent e duração', () => {
    const req = {
      headers: { 'x-request-id': 'req-123', 'x-forwarded-for': '200.1.2.3', 'user-agent': 'Mozilla/5.0' },
      body: {}
    };
    const ctx = contextoRequisicao(req, Date.now() - 12, 'admin:conta');
    expect(ctx.requestId).toBe('req-123');
    expect(ctx.ipHash).toMatch(/^[a-f0-9]{32}$/);
    expect(ctx.ipHash).not.toContain('200.1.2.3');
    expect(ctx.userAgent).toBe('Mozilla/5.0');
    expect(ctx.roteiro).toBe('admin:conta');
    expect(ctx.duracaoMs).toBeGreaterThanOrEqual(12);
  });

  it('gera requestId quando o cliente não informa e higieniza o valor recebido', () => {
    const ctx = contextoRequisicao({ headers: {}, body: {} });
    expect(ctx.requestId).toMatch(/^[a-f0-9-]{36}$/);
    const outro = contextoRequisicao({ headers: { 'x-request-id': '../../bad id' }, body: {} });
    expect(outro.requestId).toBe('badid');
  });

  it('registro contém campos de rastro e não vaza IP em claro', async () => {
    const db = criarDb();
    const ctx = contextoRequisicao({
      headers: { 'x-request-id': 'abc123', 'x-forwarded-for': '200.1.2.3', 'user-agent': 'curl/8' },
      body: {}
    }, Date.now() - 5);
    await registrar(db, {
      ator: { uid: 'u1', email: 'master@x.com' },
      acao: 'excluir_usuario', alvo: 'alvo@x.com', sucesso: true, detalhes: 'ok', contexto: ctx
    });
    const r = db.auditorias[0].dados;
    expect(r).toMatchObject({
      requestId: 'abc123', roteiro: 'admin', atorUid: 'u1', acao: 'excluir_usuario',
      alvo: 'alvo@x.com', sucesso: true, detalhes: 'ok'
    });
    expect(r.ipHash).not.toContain('200.1.2.3');
    expect(JSON.stringify(r)).not.toContain('200.1.2.3');
    expect(r.duracaoMs).toBeGreaterThanOrEqual(5);
  });

  it('fail-closed: auditoria obrigatória lança e opcional apenas sinaliza', async () => {
    const db = criarDb();
    db.ref = () => ({ push: async () => { throw new Error('RTDB fora do ar'); } });
    const ctx = contextoRequisicao({ headers: {}, body: {} });
    await expect(registrar(db, { acao: 'x', contexto: ctx, obrigatoria: true }))
      .rejects.toMatchObject({ status: 503, code: 'auditoria_falhou' });
    await expect(registrar(db, { acao: 'x', contexto: ctx })).resolves.toBe(false);
  });

  it('reserva destrutiva é idempotente por requestId e pode ser liberada', async () => {
    const db = criarDb();
    const primeira = await reservarOperacao(db, 'req-1', { acao: 'excluir_usuario', alvo: 'u1' });
    const repetida = await reservarOperacao(db, 'req-1', { acao: 'excluir_usuario', alvo: 'u1' });
    expect(primeira.committed).toBe(true);
    expect(repetida.committed).toBe(false);
    expect(repetida.idempotente).toBe(true);
    await liberarOperacao(db, 'req-1');
    const nova = await reservarOperacao(db, 'req-1', { acao: 'excluir_usuario', alvo: 'u1' });
    expect(nova.committed).toBe(true);
  });

  it('tipos sensíveis estão na lista de ações destrutivas', () => {
    for (const acao of ['excluir_usuario', 'bloquear_tenant', 'remover_usuario', 'definir_cargo']) {
      expect(ACOES_DESTRUTIVAS.has(acao)).toBe(true);
    }
  });

  it('handler não reaplica ação destrutiva no mesmo requestId', async () => {
    const db = criarDb(estadoBase());
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer ok', 'x-request-id': 'dup-1', 'x-forwarded-for': '10.0.0.1' },
      body: { acao: 'excluir_usuario', email: 'alvo@empresa.com', requestId: 'dup-1' }
    };
    const r1 = resMock();
    const r2 = resMock();
    await handleAdminRequest(req, r1, { auth: criarAuth(), db });
    await handleAdminRequest(req, r2, { auth: criarAuth(), db });

    expect(r1.codigo).toBe(200);
    expect(r2.codigo).toBe(200);
    expect(r1.payload.ok).toBe(true);
    expect(r2.payload.idempotente).toBe(true);
    expect(`${r1.payload.requestId}`).toBe('dup-1');
    // Uma reserva, uma auditoria, um efeito.
    expect(db.estado.admin_ops['dup-1']).toBeTruthy();
    expect(db.auditorias).toHaveLength(1);
    expect(db.auditorias[0].dados).toMatchObject({
      requestId: 'dup-1', acao: 'excluir_usuario', sucesso: true
    });
  });

  it('auditoria obrigatória falha depois do efeito: mantém a reserva e não reaplica', async () => {
    const db = criarDb(estadoBase());
    const refOriginal = db.ref;
    let falharAuditoria = true;
    db.ref = (caminho) => {
      const ref = refOriginal(caminho);
      if (caminho !== 'admin_audit') return ref;
      return {
        ...ref,
        push: async (dados) => {
          if (falharAuditoria) {
            falharAuditoria = false;
            throw new Error('RTDB indisponível');
          }
          return refOriginal(caminho).push(dados);
        }
      };
    };

    const auth = criarAuth();
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer ok', 'x-request-id': 'audit-fail-1' },
      body: { acao: 'excluir_usuario', email: 'alvo@empresa.com' }
    };

    const primeira = resMock();
    await handleAdminRequest(req, primeira, { auth, db });
    expect(primeira.codigo).toBe(503);
    expect(primeira.payload).toMatchObject({
      erro: 'auditoria_falhou', idempotente: true, requestId: 'audit-fail-1'
    });
    expect(db.estado.users['alvo@empresa,com']).toBeUndefined();

    const repetida = resMock();
    await handleAdminRequest(req, repetida, { auth, db });
    expect(repetida.codigo).toBe(200);
    expect(repetida.payload.idempotente).toBe(true);
    expect(db.estado.users['alvo@empresa,com']).toBeUndefined();
    expect(db.estado.admin_ops['audit-fail-1']).toBeTruthy();
  });

  it('rules: admin_ops é somente leitura para o master e nunca gravável pelo cliente', () => {
    const rules = JSON.parse(read('database.rules.json')).rules;
    expect(rules.admin_ops['.write']).toBe(false);
    expect(rules.admin_ops['.read']).toContain('super_admin');
    expect(rules.admin_audit['.write']).toBe(false);
  });
});

describe('Retenção dos dados temporários', () => {
  it('apaga apenas registros vencidos, sem derrubar os demais', async () => {
    const agora = 1_800_000_000_000;
    const dia = 24 * 60 * 60 * 1000;
    const db = criarDb({
      admin_audit: {
        antigo: { timestamp: agora - 91 * dia },
        recente: { timestamp: agora - 2 * dia }
      },
      admin_ops: {
        velha: { reservadoEm: agora - 2 * dia },
        nova: { reservadoEm: agora - 1000 }
      },
      whatsapp_messages: {
        velha: { recebidaEm: agora - 2 * dia },
        nova: { recebidaEm: agora - 1000 }
      },
      rate_limits: {
        'admin:ip:abc': {
          1: { expiraEm: agora - 1000, n: 5 },
          2: { expiraEm: agora + 1000, n: 1 }
        }
      }
    });

    const resumo = await executarLimpeza(db, agora);
    expect(resumo).toEqual({ admin_audit: 1, admin_ops: 1, whatsapp_messages: 1, rate_limits: 1 });
    expect(db.estado.admin_audit.recente).toBeTruthy();
    expect(db.estado.admin_audit.antigo).toBeFalsy();
    expect(db.estado.admin_ops.nova).toBeTruthy();
    expect(db.estado.whatsapp_messages.nova).toBeTruthy();
    expect(db.estado.rate_limits['admin:ip:abc']['2']).toBeTruthy();
    expect(db.estado.rate_limits['admin:ip:abc']['1']).toBeFalsy();
  });

  it('job de retenção está registrado no índice de functions', () => {
    const index = read('functions/index.js');
    expect(index).toContain('exports.retencaoSegurancaJob');
    expect(index).toContain('executarLimpeza');
  });
});
