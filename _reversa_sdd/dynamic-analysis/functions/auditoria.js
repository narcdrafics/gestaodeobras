/**
 * functions/auditoria.js
 * Trilha de auditoria das APIs administrativas.
 *
 * Antes, cada handler gravava timestamp/ator/ação sem contexto de rede e
 * engolia falhas de gravação. Agora toda entrada carrega requestId, IP hashado,
 * User-Agent e duração; operações destrutivas exigem que a auditoria tenha sido
 * gravada (fail-closed) e são idempotentes por requestId.
 */
'use strict';

const crypto = require('crypto');
const { hashIp } = require('./abuso');

const ACOES_DESTRUTIVAS = new Set([
  'excluir_usuario', 'bloquear_tenant', 'bloquear_usuario', 'remover_usuario',
  'definir_plano', 'definir_cargo'
]);

function contextoRequisicao(req, inicio = Date.now(), roteiro = 'admin') {
  const headers = (req && req.headers) || {};
  const externo = String(headers['x-request-id'] || (req && req.body && req.body.requestId) || '')
    .replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
  return {
    inicio,
    requestId: externo || crypto.randomUUID(),
    ipHash: hashIp(req),
    userAgent: String(headers['user-agent'] || '').slice(0, 200),
    roteiro,
    duracaoMs: Math.max(0, Date.now() - inicio)
  };
}

/**
 * @returns {Promise<boolean>} true se gravou; lança quando obrigatoria=true.
 */
async function registrar(db, { ator, acao, alvo, sucesso = true, detalhes = '', contexto = {}, obrigatoria = false }) {
  const duracaoMs = contexto.inicio == null
    ? contexto.duracaoMs
    : Math.max(0, Date.now() - contexto.inicio);
  const registro = {
    timestamp: Date.now(),
    requestId: contexto.requestId || null,
    roteiro: contexto.roteiro || null,
    ipHash: contexto.ipHash || null,
    userAgent: contexto.userAgent || null,
    duracaoMs: duracaoMs == null ? null : duracaoMs,
    atorUid: ator ? ator.uid : null,
    atorEmail: ator ? ator.email : null,
    acao: String(acao || 'desconhecida').slice(0, 64),
    alvo: String(alvo || '').slice(0, 300),
    sucesso: sucesso !== false,
    detalhes: String(detalhes == null ? '' : detalhes).slice(0, 300)
  };

  if (!db) {
    if (obrigatoria) throw Object.assign(new Error('Auditoria indisponível.'), { status: 503, code: 'auditoria_indisponivel' });
    return false;
  }
  try {
    await db.ref('admin_audit').push(registro);
    return true;
  } catch (e) {
    console.error('[Auditoria] Falha ao gravar:', e && (e.message || e));
    if (obrigatoria) throw Object.assign(new Error('Não foi possível registrar a auditoria.'), { status: 503, code: 'auditoria_falhou' });
    return false;
  }
}

/**
 * Reserva uma operação destrutiva pelo requestId. Um double-submit (mesmo
 * requestId) recebe committed=false e não reaplica a ação.
 */
async function reservarOperacao(db, requestId, { acao, alvo, atorUid } = {}) {
  const chave = String(requestId || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!chave || !db) return { committed: true, idempotente: false };
  const ref = db.ref(`admin_ops/${chave}`);
  const info = {
    acao: String(acao || '').slice(0, 64),
    alvo: String(alvo || '').slice(0, 300),
    atorUid: atorUid || null,
    reservadoEm: Date.now()
  };

  if (typeof ref.transaction === 'function') {
    const tx = await ref.transaction((atual) => (atual ? undefined : info));
    return { committed: !!tx.committed, idempotente: !tx.committed };
  }
  const snap = await ref.once('value');
  if (snap && snap.exists && snap.exists()) return { committed: false, idempotente: true };
  await ref.set(info);
  return { committed: true, idempotente: false };
}

/** Remove a reserva se a operação falhou, permitindo nova tentativa. */
async function liberarOperacao(db, requestId) {
  const chave = String(requestId || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!chave || !db) return;
  try {
    const ref = db.ref(`admin_ops/${chave}`);
    if (typeof ref.remove === 'function') await ref.remove();
    else await ref.set(null);
  } catch (_) {
    // Reserva expira pelo job de retenção.
  }
}

module.exports = {
  ACOES_DESTRUTIVAS,
  contextoRequisicao,
  registrar,
  reservarOperacao,
  liberarOperacao
};
