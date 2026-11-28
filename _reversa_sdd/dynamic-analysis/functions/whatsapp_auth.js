/**
 * functions/whatsapp_auth.js
 *
 * Autorização do webhook de WhatsApp depois da validação criptográfica.
 *
 * O HMAC da Meta protege a porta de entrada, mas NÃO prova qual tenant deve
 * receber a mensagem. Antes deste módulo a associação usava campos que o próprio
 * usuário podia alterar (`users/<email>.telefone` / `.whatsappId`), matching por
 * substring e o "primeiro tenant que casou" — combinando isso com o Admin SDK,
 * qualquer número podia ganhar acesso de escrita em outra empresa.
 *
 * Aqui a associação é:
 *   - normalizada (E.164 -> DDD+número, sem substring),
 *   - única (empate entre tenants = rejeição, nunca "primeiro vence"),
 *   - validada na origem (WABA + phone_number_id esperados),
 *   - checada contra status do usuário e billing do tenant,
 *   - deduplicada por `msg.id` com transação atômica (replay não duplica tarefa).
 */
'use strict';

const crypto = require('crypto');

const DOMINIO_GRAPH = 'graph.facebook.com';
const LIMITE_AUDIO = 8 * 1024 * 1024; // 8 MB: suficiente para áudio de 2 min.

/** Comparação em tempo constante, com hash prévio para esconder o tamanho. */
function seguroEqual(a, b) {
  const esquerda = crypto.createHash('sha256').update(String(a == null ? '' : a)).digest();
  const direita = crypto.createHash('sha256').update(String(b == null ? '' : b)).digest();
  return crypto.timingSafeEqual(esquerda, direita);
}

function validarVerifyToken(tokenRecebido, tokenEsperado) {
  if (!tokenEsperado || !tokenRecebido) return false;
  return seguroEqual(tokenRecebido, tokenEsperado);
}

/** HMAC-SHA256 sobre o corpo cru, exatamente como a Meta calcula. */
function validarAssinatura(req, appSecret) {
  const assinatura = req && req.headers && req.headers['x-hub-signature-256'];
  if (!appSecret || !assinatura || !Buffer.isBuffer(req.rawBody) || req.rawBody.length === 0) {
    return false;
  }
  const esperado = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
  return seguroEqual(String(assinatura).toLowerCase().trim(), esperado);
}

/** Remove formatação e código do país; devolve DDD(2)+número(8/9) ou ''. */
function normalizarTelefone(valor) {
  let digitos = String(valor == null ? '' : valor).replace(/\D/g, '');
  if (digitos.length > 11 && digitos.startsWith('55')) digitos = digitos.slice(2);
  return digitos.length >= 10 && digitos.length <= 11 ? digitos : '';
}

/**
 * Confere se o payload veio da WABA e do número configurados no servidor.
 * Valores não configurados são ignorados (compatibilidade com instalações
 * antigas), mas valores configurados são obrigatórios e exatos.
 */
function validarOrigem(entryId, value, { wabaId, phoneNumberId } = {}) {
  if (wabaId && !seguroEqual(entryId, wabaId)) return false;
  const recebido = value && value.metadata && value.metadata.phone_number_id;
  if (phoneNumberId && !seguroEqual(recebido, phoneNumberId)) return false;
  return true;
}

/** Aceita apenas o objeto da WhatsApp Business API (não Messenger/`page`). */
function extrairMensagem(body) {
  if (!body || body.object !== 'whatsapp_business_account') return null;
  const entradas = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entradas) {
    const mudancas = entry && Array.isArray(entry.changes) ? entry.changes : [];
    for (const mudanca of mudancas) {
      const value = mudanca && mudanca.value;
      const msg = value && Array.isArray(value.messages) ? value.messages[0] : null;
      if (!msg || !msg.from) continue;
      const audio = Array.isArray(msg.audio) ? msg.audio[0] : null;
      return {
        from: String(msg.from),
        msgId: msg.id ? String(msg.id) : '',
        texto: (msg.text && msg.text.body) || (msg.button && msg.button.text) || '',
        audioUrl: audio && audio.id ? `https://${DOMINIO_GRAPH}/${encodeURIComponent(audio.id)}` : null,
        entryId: entry.id,
        value
      };
    }
  }
  return null;
}

/** URL de mídia precisa ser o domínio da Graph API — nunca um host arbitrário. */
function urlAudioPermitida(url) {
  try {
    const parsed = new URL(String(url || ''));
    return parsed.protocol === 'https:' &&
      (parsed.hostname === DOMINIO_GRAPH || parsed.hostname.endsWith('.fbcdn.net'));
  } catch (_) {
    return false;
  }
}

/**
 * Resolve o tenant de forma estrita. Usa `users` primeiro (fonte canônica) e,
 * na ausência, a allowlist `config.telefonesPermitidos`. Empate entre tenants
 * diferentes é ambiguidade e deve ser rejeitada — nunca escolher o primeiro.
 */
async function autorizarRemetente(db, { from }) {
  const chave = normalizarTelefone(from);
  if (!chave) return { ok: false, motivo: 'telefone_invalido' };

  const usersSnap = await db.ref('users').once('value');
  const users = usersSnap.val() || {};
  const candidatos = [];
  for (const email in users) {
    const u = users[email];
    if (!u || !u.tenantId) continue;
    const ids = [u.whatsappId, u.telefone].map(normalizarTelefone).filter(Boolean);
    if (ids.includes(chave)) candidatos.push({ tenantId: String(u.tenantId), user: u });
  }
  if (candidatos.length > 0) {
    const tenants = new Set(candidatos.map((c) => c.tenantId));
    if (tenants.size > 1) return { ok: false, motivo: 'numero_ambigu', tenants: [...tenants] };
    return { ok: true, tenantId: candidatos[0].tenantId, user: candidatos[0].user, origem: 'users' };
  }

  const tenantsSnap = await db.ref('tenants').once('value');
  const tenants = tenantsSnap.val() || {};
  const permitidos = [];
  for (const [tid, tenant] of Object.entries(tenants)) {
    const bruto = tenant && tenant.config && tenant.config.telefonesPermitidos;
    const lista = bruto == null ? [] : [bruto].flat();
    if (lista.some((t) => normalizarTelefone(t) === chave)) permitidos.push(String(tid));
  }
  if (permitidos.length === 1) {
    return { ok: true, tenantId: permitidos[0], user: null, origem: 'telefonesPermitidos' };
  }
  if (permitidos.length > 1) return { ok: false, motivo: 'numero_ambigu', tenants: permitidos };
  return { ok: false, motivo: 'numero_nao_autorizado' };
}

/** Status da conta e do tenant precisam permitir escrita. */
function verificarEstado(user, tenant) {
  if (!tenant) return { ok: false, motivo: 'tenant_inexistente' };
  if (tenant.status === 'inativo' || tenant.status === 'bloqueado') {
    return { ok: false, motivo: 'tenant_inativo' };
  }
  if (tenant.billingState === 'bloqueado' || tenant.billingState === 'somente_leitura') {
    return { ok: false, motivo: 'tenant_bloqueado' };
  }
  if (user && ['inativo', 'bloqueado', 'desativado'].includes(String(user.status || '').toLowerCase())) {
    return { ok: false, motivo: 'usuario_inativo' };
  }
  return { ok: true };
}

function chaveDedup(msgId) {
  return String(msgId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
}

/** Reserva o msg.id antes de processar; transação impede duas instâncias. */
async function reservarMensagem(db, msgId) {
  const chave = chaveDedup(msgId);
  if (!chave) return { ok: true, ref: null }; // payload sem id: não bloqueia legados
  const ref = db.ref(`whatsapp_messages/${chave}`);
  if (typeof ref.transaction === 'function') {
    const tx = await ref.transaction((atual) => (atual ? undefined : { recebidaEm: Date.now(), status: 'processing' }));
    if (!tx.committed) return { ok: false, ref };
  } else {
    const snap = await ref.once('value');
    if (snap.exists()) return { ok: false, ref };
    await ref.set({ recebidaEm: Date.now(), status: 'processing' });
  }
  return { ok: true, ref };
}

async function concluirMensagem(ref, status) {
  if (!ref || typeof ref.update !== 'function') return;
  try {
    await ref.update({ status, concluidaEm: Date.now() });
  } catch (_) {
    // A reserva expira sozinha via job de limpeza; não pode falhar a resposta.
  }
}

/**
 * Orquestrador HTTP. `processar` e `responder` são injetados por index.js para
 * manter a lógica de negócio (GPT, tarefas, envio pela Graph) fora deste módulo.
 */
async function handleWhatsappWebhook(req, res, { db, secrets = {}, processar, responder }) {
  const { verifyToken, appSecret, wabaId, phoneNumberId } = secrets;

  if (req.method === 'GET') {
    const ok = validarVerifyToken(
      req.query && req.query['hub.verify_token'],
      verifyToken
    ) && String(req.query && req.query['hub.mode']) === 'subscribe';
    if (!ok) return res.status(403).send('Token inválido');
    return res.status(200).send(req.query['hub.challenge'] || '');
  }

  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  if (!validarAssinatura(req, appSecret)) {
    console.error('[WhatsApp] Assinatura inválida detectada.');
    return res.status(401).send('Invalid signature');
  }

  const mensagem = extrairMensagem(req.body);
  if (!mensagem) return res.status(404).send('Not Found');
  if (!validarOrigem(mensagem.entryId, mensagem.value, { wabaId, phoneNumberId })) {
    console.warn('[WhatsApp] Origem (WABA/phone_number_id) não confere.');
    return res.status(403).send('Origin not allowed');
  }

  const reserva = await reservarMensagem(db, mensagem.msgId);
  if (!reserva.ok) {
    // 200 evita que a Meta reenvie um evento já entregue.
    return res.status(200).send('DUPLICATE');
  }

  let respondido = false;
  try {
    const autorizacao = await autorizarRemetente(db, { from: mensagem.from });
    if (!autorizacao.ok) {
      console.warn(`[WhatsApp] Remetente não autorizado: ${autorizacao.motivo}`);
      if (typeof responder === 'function') {
        await responder(normalizarTelefone(mensagem.from) || mensagem.from,
          'Número não autorizado. Fale com o administrador.');
        respondido = true;
      }
      await concluirMensagem(reserva.ref, 'rejected');
      return res.status(403).send('Forbidden');
    }

    const tenantSnap = await db.ref(`tenants/${autorizacao.tenantId}`).once('value');
    const tenant = tenantSnap.val();
    const estado = verificarEstado(autorizacao.user, tenant);
    if (!estado.ok) {
      console.warn(`[WhatsApp] Tenant/usuário bloqueado: ${estado.motivo} (${autorizacao.tenantId})`);
      await concluirMensagem(reserva.ref, 'rejected');
      return res.status(403).send('Forbidden');
    }

    if (mensagem.audioUrl && !urlAudioPermitida(mensagem.audioUrl)) {
      console.warn('[WhatsApp] URL de áudio rejeitada (host não permitido).');
      await concluirMensagem(reserva.ref, 'rejected');
      return res.status(400).send('Invalid audio URL');
    }

    // ACK somente depois de processar: falha devolve 5xx para a Meta reenviar
    // (a reserva é liberada no catch, então o retry não cai em DUPLICATE).
    await processar({
      from: mensagem.from,
      texto: mensagem.texto,
      audioUrl: mensagem.audioUrl,
      tenantId: autorizacao.tenantId,
      user: autorizacao.user || {}
    });
    await concluirMensagem(reserva.ref, 'done');
    return res.status(200).send('OK');
  } catch (err) {
    console.error('[WhatsApp] Erro no processamento:', err);
    if (reserva.ref && typeof reserva.ref.remove === 'function') {
      try { await reserva.ref.remove(); } catch (_) { /* reserva expira por TTL */ }
    }
    if (!respondido && typeof responder === 'function') {
      await responder(normalizarTelefone(mensagem.from) || mensagem.from, 'Erro no servidor.')
        .catch(() => {});
    }
    return res.status(500).send('Internal error');
  }
}

module.exports = {
  seguroEqual,
  validarVerifyToken,
  validarAssinatura,
  normalizarTelefone,
  validarOrigem,
  extrairMensagem,
  urlAudioPermitida,
  autorizarRemetente,
  verificarEstado,
  chaveDedup,
  reservarMensagem,
  handleWhatsappWebhook,
  DOMINIO_GRAPH,
  LIMITE_AUDIO
};
