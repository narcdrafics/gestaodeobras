// Controles de abuso compartilhados pelas APIs administrativas.
// Usa apenas Admin SDK + Realtime Database (transaction), sem dependências novas.
const crypto = require('crypto');

const LIMITE_PADRAO_BODY = 16 * 1024; // 16 KB: payloads administrativos são < 2 KB.

function erro(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

/** Rejeita bodies grandes antes de qualquer chamada ao Auth/DB. */
function validarCorpo(req, limite = LIMITE_PADRAO_BODY) {
  const informado = Number(req && req.headers && req.headers['content-length']);
  if (Number.isFinite(informado) && informado > limite) {
    throw erro(413, 'payload_muito_grande', 'Payload muito grande.');
  }
  const body = (req && req.body) || {};
  try {
    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > limite) {
      throw erro(413, 'payload_muito_grande', 'Payload muito grande.');
    }
  } catch (e) {
    if (e.status === 413) throw e;
    throw erro(400, 'payload_invalido', 'Payload inválido.');
  }
  return body;
}

/** IP do cliente, hashado para não virar PII no Realtime Database. */
function hashIp(req) {
  const headers = (req && req.headers) || {};
  const bruto = String(
    headers['x-forwarded-for'] ? headers['x-forwarded-for'].split(',')[0].trim() :
      (req.ip || headers['x-real-ip'] || '')
  );
  if (!bruto) return 'sem-ip';
  return crypto.createHash('sha256').update(`obrareal:cargo:${bruto}`).digest('hex').slice(0, 32);
}

/**
 * Consome uma cota atômica em rate_limits/<chave>/<bucket>/n.
 * `transaction` é usada quando disponível (Admin SDK em produção); o fallback
 * once+set existe apenas para mocks de teste e não é a porta de entrada real.
 */
async function consumirCota(db, chave, limite, janelaMs) {
  if (!db || !chave) return;
  const bucket = Math.floor(Date.now() / janelaMs);
  // RTDB não aceita '.', '#', '$', '[', ']' nem '/' em chaves. ':' é seguro.
  const base = `rate_limits/${String(chave).replace(/[^A-Za-z0-9_:@-]/g, '_')}/${bucket}`;
  const contador = db.ref(`${base}/n`);

  let total;
  if (typeof contador.transaction === 'function') {
    const tx = await contador.transaction((atual) => (Number(atual) || 0) + 1);
    total = (tx && tx.snapshot && tx.snapshot.val && tx.snapshot.val()) || 0;
  } else {
    const snap = await contador.once('value');
    total = (snap && snap.val && snap.val()) || 0;
    total += 1;
    await contador.set(total);
  }

  try {
    await db.ref(`${base}/expiraEm`).set(Date.now() + (2 * janelaMs));
  } catch (e) {
    // TTL é limpeza; não pode derrubar a operação por causa dele.
  }

  if (total > limite) {
    const e = erro(429, 'muitas_tentativas', 'Muitas tentativas. Aguarde e tente novamente.');
    e.retryAfter = Math.ceil(janelaMs / 1000);
    throw e;
  }
}

module.exports = { erro, validarCorpo, hashIp, consumirCota, LIMITE_PADRAO_BODY };
