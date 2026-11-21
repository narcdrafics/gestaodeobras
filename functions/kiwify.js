const crypto = require('crypto');

/**
 * Valida a assinatura HMAC-SHA1 enviada pela Kiwify.
 * @param {Buffer|string} rawBody - Corpo bruto da requisição
 * @param {string} signature - Assinatura recebida (query ?signature=... ou header)
 * @param {string} secret - Token do webhook configurado na Kiwify
 * @returns {boolean}
 */
function validateKiwifySignature(rawBody, signature, secret) {
  if (!signature || !secret || !rawBody) return false;
  try {
    const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
    const computedHex = crypto.createHmac('sha1', secret).update(rawBuffer).digest('hex');

    const sigClean = String(signature).toLowerCase().trim();
    if (sigClean.length !== computedHex.length) return false;

    const sigBuf = Buffer.from(sigClean, 'hex');
    const compBuf = Buffer.from(computedHex, 'hex');

    if (sigBuf.length !== compBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, compBuf);
  } catch (err) {
    console.error('[Kiwify] Erro na validação criptográfica da assinatura:', err);
    return false;
  }
}

/**
 * Identifica o tenant associado ao pedido.
 * 1. Tenta extrair de external_reference ou parâmetros de tracking (src, sck, utm).
 * 2. Plano B: Procura o tenant pelo e-mail do comprador casado com emailAdmin.
 * @param {Object} body - Payload JSON da Kiwify
 * @param {Object} query - Query parameters da requisição
 * @param {Object} db - Instância do Firebase Realtime Database
 * @returns {Promise<string|null>} tenantId encontrado ou null
 */
async function identifyTenant(body, query, db) {
  const candidate =
    body.external_reference ||
    body.order?.external_reference ||
    body.Subscription?.external_reference ||
    body.trackingParameters?.external_reference ||
    body.trackingParameters?.src ||
    body.trackingParameters?.sck ||
    body.trackingParameters?.utm_source ||
    query?.external_reference;

  if (candidate && typeof candidate === 'string') {
    const cleaned = candidate.trim();
    if (cleaned) {
      // 1.1 Verifica se o ID existe direto em tenants
      const snap = await db.ref(`tenants/${cleaned}`).once('value');
      if (snap.exists()) {
        return cleaned;
      }

      // 1.2 Verifica se foi passado como slug em tenants_public
      const slugSnap = await db.ref(`tenants_public/${cleaned}/tenantId`).once('value');
      if (slugSnap.exists()) {
        return slugSnap.val();
      }
    }
  }

  // Plano B: Casar pelo e-mail do comprador com emailAdmin
  const customerEmail = (
    body.Customer?.email ||
    body.customer?.email ||
    body.email ||
    ''
  ).toLowerCase().trim();

  if (customerEmail) {
    const tenantsSnap = await db.ref('tenants').once('value');
    const tenants = tenantsSnap.val() || {};

    // 2.1 Busca por emailAdmin em tenants
    for (const [tid, tData] of Object.entries(tenants)) {
      if (tData && tData.emailAdmin && tData.emailAdmin.toLowerCase().trim() === customerEmail) {
        return tid;
      }
    }

    // 2.2 Busca por profile de admin/usuário com esse e-mail
    const profilesSnap = await db.ref('profiles').once('value');
    const profiles = profilesSnap.val() || {};
    for (const p of Object.values(profiles)) {
      if (p && p.email && p.email.toLowerCase().trim() === customerEmail && p.tenantId && p.tenantId !== 'MASTER_SYSTEM') {
        return p.tenantId;
      }
    }

    // 2.3 Busca em convites pendentes
    const sanitizedEmail = customerEmail.replace(/\./g, ',');
    const inviteSnap = await db.ref(`invites/${sanitizedEmail}/tenantId`).once('value');
    if (inviteSnap.exists()) {
      return inviteSnap.val();
    }
  }

  return null;
}

/**
 * Mapeia o produto e frequência para plano, limites e data de vencimento.
 * @param {Object} body - Payload do webhook
 * @returns {Object} { plano, limites, planoVencimento, isYearly }
 */
function mapProductToPlan(body) {
  const prodName = (
    body.Product?.product_name ||
    body.product_name ||
    body.order?.product_name ||
    ''
  ).toLowerCase();

  const isYearly =
    prodName.includes('anual') ||
    body.Subscription?.plan?.frequency === 'yearly' ||
    body.Subscription?.charging_frequency === 'yearly';

  const durationDays = isYearly ? 365 : 31;
  const planoVencimento = Date.now() + (durationDays * 24 * 60 * 60 * 1000);

  if (prodName.includes('start')) {
    return {
      plano: isYearly ? 'start_anual' : 'start',
      limites: { limiteObras: 2, limiteUsuarios: 2, limiteTrabalhadores: 9999 },
      planoVencimento,
      isYearly
    };
  }

  if (prodName.includes('ilimitado') || prodName.includes('master')) {
    return {
      plano: isYearly ? 'full_anual' : 'ilimitado',
      limites: { limiteObras: 9999, limiteUsuarios: 9999, limiteTrabalhadores: 9999 },
      planoVencimento,
      isYearly
    };
  }

  // Padrão: Pro / Premium
  return {
    plano: isYearly ? 'pro_anual' : 'pro',
    limites: { limiteObras: 5, limiteUsuarios: 5, limiteTrabalhadores: 9999 },
    planoVencimento,
    isYearly
  };
}

/**
 * Registra o log detalhado no nó webhook_debug para auditoria em tempo real no painel master.
 */
async function recordWebhookDebug(db, { payload, result, signatureValid, orderId, eventType, orderStatus }) {
  try {
    const agora = Date.now();
    const p = payload || {};
    const email = p.email || (p.Customer && p.Customer.email) || 'N/A';
    const tenantId = p.external_id || p.external_reference || (p.order && p.order.external_reference) || 'N/A';

    await db.ref('webhook_debug').push({
      timestamp: agora,
      payload: p,
      result: result || 'Processado',
      signatureValid: !!signatureValid,
      orderId: orderId || p.order_id || 'N/A',
      eventType: eventType || p.webhook_event_type || 'N/A',
      status: orderStatus || p.order_status || 'N/A',
      email,
      tenantId
    });
  } catch (err) {
    console.error('[Kiwify] Erro ao gravar webhook_debug:', err);
  }
}

/**
 * Processador principal do webhook da Kiwify.
 * Executa autenticação, idempotência, roteamento de eventos e gravação com Admin SDK.
 * @param {Object} req - Request Express
 * @param {Object} res - Response Express
 * @param {Object} options - { secret, db }
 */
async function handleKiwifyWebhook(req, res, { secret, db }) {
  const body = req.body || {};
  const orderId = body.order_id || body.id || (body.order && body.order.id) || 'SEM_ORDER_ID';
  const eventType = body.webhook_event_type || body.event || 'unknown';
  const orderStatus = (body.order_status || body.status || '').toLowerCase();

  // 1. Validar método POST
  if (req.method !== 'POST') {
    await recordWebhookDebug(db, {
      payload: body,
      result: `Método ${req.method} rejeitado (Requer POST)`,
      signatureValid: false,
      orderId, eventType, orderStatus
    });
    return res.status(401).send('Unauthorized: POST required');
  }

  // 2. Validar Assinatura
  const signature = req.query.signature || req.headers['x-kiwify-signature'];
  const isValid = validateKiwifySignature(req.rawBody, signature, secret);

  if (!isValid) {
    const motivoAssinatura = !secret
      ? 'KIWIFY_TOKEN ausente/não configurado no Cloud Functions'
      : (!signature ? 'Parâmetro ?signature ausente na URL' : 'Assinatura HMAC-SHA1 inválida (token divergente)');

    console.warn(`[Kiwify] Assinatura inválida: ${motivoAssinatura}`);

    await recordWebhookDebug(db, {
      payload: body,
      result: `Rejeitado 401: ${motivoAssinatura}`,
      signatureValid: false,
      orderId, eventType, orderStatus
    });

    return res.status(401).send(`Unauthorized: Invalid signature (${motivoAssinatura})`);
  }

    if (!orderId || orderId === 'SEM_ORDER_ID') {
      console.warn('[Kiwify] Payload sem order_id recebido:', body);
      await recordWebhookDebug(db, {
        payload: body,
        result: 'Rejeitado 400: order_id ausente no payload',
        signatureValid: true,
        orderId, eventType, orderStatus
      });
      return res.status(400).json({ error: 'Missing order_id' });
    }

    console.log(`[Kiwify] Recebido evento: orderId=${orderId}, type=${eventType}, status=${orderStatus}`);

    // 3. Idempotência: grava billing_events/{orderId}/{eventType}
    const eventKey = `${eventType}_${orderStatus}`.replace(/[.#$[\]/]/g, '_');
    const eventRef = db.ref(`billing_events/${orderId}/${eventKey}`);
    const eventSnap = await eventRef.once('value');

    if (eventSnap.exists()) {
      console.log(`[Kiwify] Evento duplicado ignorado: orderId=${orderId}, event=${eventKey}`);
      await recordWebhookDebug(db, {
        payload: body,
        result: `Ignorado: Evento já processado anteriormente (${eventKey})`,
        signatureValid: true,
        orderId, eventType, orderStatus
      });
      return res.status(200).json({ status: 'already_processed', orderId, eventKey });
    }

    // 4. Identificar o Tenant
    const tenantId = await identifyTenant(body, req.query, db);
    if (!tenantId) {
      console.warn(`[Kiwify] Tenant não identificado para orderId: ${orderId}, email: ${body.Customer?.email}`);
      // Registra o evento para auditoria mesmo sem tenant localizado
      await eventRef.set({
        orderId,
        eventType,
        orderStatus,
        tenantId: null,
        customerEmail: body.Customer?.email || body.email || null,
        receivedAt: Date.now(),
        status: 'tenant_not_found',
        payload: body
      });

      await recordWebhookDebug(db, {
        payload: body,
        result: 'Aviso: Tenant não encontrado (Comprador sem conta ativa)',
        signatureValid: true,
        orderId, eventType, orderStatus
      });

      return res.status(200).json({ warning: 'Tenant not found', orderId });
    }

    // 5. Tratar eventos
    const updates = {};
    const chargeAmount = body.Commissions?.charge_amount ? (body.Commissions.charge_amount / 100) : (body.order_value || 0);
    const paymentMethod = body.payment_method || 'kiwify';
    const agora = Date.now();
    let resultadoLog = 'Success: Evento processado';

    const ultimoPagamento = {
      orderId,
      valor: chargeAmount,
      data: agora,
      metodo: paymentMethod,
      origem: 'kiwify',
      status: orderStatus,
      eventType
    };

    // A. Pagamento Aprovado / Assinatura Renovada
    if (orderStatus === 'paid' || eventType === 'order_approved' || eventType === 'subscription_renewed') {
      const { plano, limites, planoVencimento } = mapProductToPlan(body);

      updates[`tenants/${tenantId}/plano`] = plano;
      updates[`tenants/${tenantId}/status`] = 'ativo';
      updates[`tenants/${tenantId}/billingState`] = 'ativo';
      updates[`tenants/${tenantId}/billingStateMotivo`] = 'pagamento_aprovado';
      updates[`tenants/${tenantId}/planoVencimento`] = planoVencimento;
      updates[`tenants/${tenantId}/origemAtivacao`] = 'kiwify';
      updates[`tenants/${tenantId}/ultimoPagamento`] = ultimoPagamento;
      updates[`tenants/${tenantId}/config/limiteObras`] = limites.limiteObras;
      updates[`tenants/${tenantId}/config/limiteUsuarios`] = limites.limiteUsuarios;
      updates[`tenants/${tenantId}/config/limiteTrabalhadores`] = limites.limiteTrabalhadores;

      // Remove qualquer flag de carência ou bloqueio anterior
      updates[`tenants/${tenantId}/carenciaAte`] = null;
      updates[`tenants/${tenantId}/motivoBloqueio`] = null;

      resultadoLog = `Success: Ativado plano ${plano.toUpperCase()} para tenant ${tenantId}`;
      console.log(`[Kiwify] Ativando tenant ${tenantId}: plano=${plano}, vencimento=${new Date(planoVencimento).toISOString()}`);
    }
    // B. Reembolso ou Chargeback (bloqueio imediato)
    else if (orderStatus === 'refunded' || orderStatus === 'chargedback' || eventType === 'order_refunded' || eventType === 'chargeback') {
      const motivo = eventType === 'chargeback' || orderStatus === 'chargedback' ? 'chargeback' : 'reembolso';
      updates[`tenants/${tenantId}/status`] = 'bloqueado_pagamento';
      updates[`tenants/${tenantId}/billingState`] = 'bloqueado';
      updates[`tenants/${tenantId}/billingStateMotivo`] = motivo;
      updates[`tenants/${tenantId}/motivoBloqueio`] = motivo;
      updates[`tenants/${tenantId}/dataBloqueio`] = agora;
      updates[`tenants/${tenantId}/ultimoPagamento`] = ultimoPagamento;

      resultadoLog = `Success: Tenant ${tenantId} bloqueado por ${motivo}`;
      console.warn(`[Kiwify] Tenant ${tenantId} bloqueado por ${eventType || orderStatus}`);
    }
    // C. Cancelamento de Assinatura (Carência até o fim do período já pago)
    else if (eventType === 'subscription_canceled') {
      const tenantSnap = await db.ref(`tenants/${tenantId}`).once('value');
      const tenantData = tenantSnap.val() || {};
      const vencimentoAtual = tenantData.planoVencimento || agora;

      if (vencimentoAtual > agora) {
        updates[`tenants/${tenantId}/cancelamentoAgendado`] = true;
        updates[`tenants/${tenantId}/dataCancelamento`] = agora;
        updates[`tenants/${tenantId}/billingState`] = 'ativo';
        resultadoLog = `Success: Cancelamento agendado para o fim do ciclo (Tenant ${tenantId})`;
      } else {
        updates[`tenants/${tenantId}/status`] = 'carencia';
        updates[`tenants/${tenantId}/billingState`] = 'carencia';
        updates[`tenants/${tenantId}/billingStateMotivo`] = 'cancelamento_em_carencia';
        updates[`tenants/${tenantId}/carenciaAte`] = agora + (3 * 24 * 60 * 60 * 1000);
        updates[`tenants/${tenantId}/cancelamentoAgendado`] = true;
        resultadoLog = `Success: Tenant ${tenantId} em carência de 3 dias pós-cancelamento`;
      }
      updates[`tenants/${tenantId}/ultimoPagamento`] = ultimoPagamento;
      console.log(`[Kiwify] Assinatura cancelada para tenant ${tenantId}.`);
    }
    // D. Atraso de Pagamento / Falha de Renovação (Carência da A2 - 5 dias de tolerância)
    else if (eventType === 'subscription_late' || orderStatus === 'refused') {
      updates[`tenants/${tenantId}/status`] = 'carencia';
      updates[`tenants/${tenantId}/billingState`] = 'carencia';
      updates[`tenants/${tenantId}/billingStateMotivo`] = 'atraso_em_carencia';
      updates[`tenants/${tenantId}/carenciaAte`] = agora + (5 * 24 * 60 * 60 * 1000);
      updates[`tenants/${tenantId}/avisoCarencia`] = 'Sua assinatura está com renovação pendente. Regularize o pagamento para evitar suspensão.';
      updates[`tenants/${tenantId}/ultimoPagamento`] = ultimoPagamento;

      resultadoLog = `Success: Tenant ${tenantId} colocado em carência de 5 dias (Atraso)`;
      console.warn(`[Kiwify] Tenant ${tenantId} colocado em carência por atraso de pagamento.`);
    }

    // 6. Grava atualizações do Tenant
    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }

    // 7. Registra evento de auditoria e idempotência
    await eventRef.set({
      orderId,
      eventType,
      orderStatus,
      tenantId,
      processedAt: agora,
      status: 'success',
      chargeAmount,
      paymentMethod,
      customerEmail: body.Customer?.email || body.email || null
    });

    // 8. Registra no webhook_debug para exibição imediata no painel master
    await recordWebhookDebug(db, {
      payload: body,
      result: resultadoLog,
      signatureValid: true,
      orderId, eventType, orderStatus
    });

    return res.status(200).json({
      status: 'processed',
      orderId,
      eventType,
      tenantId
    });
  }

  module.exports = {
    validateKiwifySignature,
    identifyTenant,
    mapProductToPlan,
    handleKiwifyWebhook
  };
