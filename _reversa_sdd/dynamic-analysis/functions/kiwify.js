const crypto = require('crypto');
const { planoPorProduto, MS_DIA } = require('./plan_catalog');

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
function mapProductToPlan(body, agora = Date.now()) {
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

  // Catálogo único com o painel master (functions/plan_catalog.js).
  // O carimbo vem da reserva persistida: retries não podem presentear dias extras.
  const escolhido = planoPorProduto(prodName, isYearly);
  const planoVencimento = agora + (escolhido.dias * MS_DIA);

  return {
    plano: escolhido.id,
    limites: {
      limiteObras: escolhido.limites.obras,
      limiteUsuarios: escolhido.limites.usuarios,
      limiteTrabalhadores: escolhido.limites.trabalhadores
    },
    planoVencimento,
    isYearly
  };
}

/**
 * Registra o log detalhado no nó webhook_debug para auditoria em tempo real no painel master.
 */
async function recordWebhookDebug(db, { payload, result, signatureValid, orderId, eventType, orderStatus, incluirPayload = true }) {
  try {
    const agora = Date.now();
    const p = payload || {};
    const email = incluirPayload ? (p.email || (p.Customer && p.Customer.email) || 'N/A') : 'N/A';
    const tenantId = incluirPayload ? (p.external_id || p.external_reference || (p.order && p.order.external_reference) || 'N/A') : 'N/A';
    // Requisições rejeitadas não podem virar depósito de PII arbitrário.
    const registro = incluirPayload ? p : {
      order_id: p.order_id || null,
      webhook_event_type: p.webhook_event_type || null,
      order_status: p.order_status || null
    };

    await db.ref('webhook_debug').push({
      timestamp: agora,
      payload: registro,
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
 * Reserva o evento de forma atômica ANTES de qualquer efeito no tenant.
 * - transaction() é usada em produção (Admin SDK); o fallback once+set atende
 *   apenas mocks de teste.
 * - Um lease 'processing' com mais de 2 minutos é considerado abandonado e
 *   pode ser retomado, evitando que uma falha parcial trave o evento forever.
 */
async function reservarEvento(eventRef, { agora, payloadHash, tenantId, orderId, eventType, orderStatus }) {
  const info = {
    status: 'processing',
    claimedAt: agora,
    payloadHash,
    tenantId,
    orderId,
    eventType,
    orderStatus
  };

  if (typeof eventRef.transaction === 'function') {
    const tx = await eventRef.transaction((atual) => {
      if (!atual) return info;
      if (atual.status === 'success') return undefined;
      // pending_tenant/failed não são terminais: podem ser retomados quando o
      // comprador cria a conta ou quando uma entrega anterior falhou.
      if (atual.status === 'pending_tenant' || atual.status === 'failed') return info;
      const expirado = agora - (Number(atual.claimedAt) || 0) > 2 * 60 * 1000;
      if (atual.status === 'processing' && expirado) return info;
      return undefined;
    });
    if (!tx.committed) {
      return { jaProcessado: true, existente: (tx.snapshot && tx.snapshot.val && tx.snapshot.val()) || null };
    }
    return { claimedAt: agora };
  }

  const snap = await eventRef.once('value');
  if (snap.exists()) return { jaProcessado: true, existente: snap.val() };
  await eventRef.set(info);
  return { claimedAt: agora };
}

/** Chave de nó segura para o Realtime Database. */
function chaveSegura(valor) {
  return String(valor || 'unknown').replace(/[.#$[\]/]/g, '_').slice(0, 128);
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
  const orderId = String(body.order_id || body.id || (body.order && body.order.id) || 'SEM_ORDER_ID').trim();
  const eventType = String(body.webhook_event_type || body.event || 'unknown').trim();
  const orderStatus = String(body.order_status || body.status || '').toLowerCase().trim();

  // 1. Validar método POST
  if (req.method !== 'POST') {
    await recordWebhookDebug(db, {
      payload: body,
      result: `Método ${req.method} rejeitado (Requer POST)`,
      signatureValid: false,
      orderId, eventType, orderStatus,
      incluirPayload: false
    });
    return res.status(401).send('Unauthorized: POST required');
  }

  // 2. Validar Assinatura: aceita query OU header, mas exige rawBody íntegro.
  const assinaturas = [
    req.query && req.query.signature,
    req.headers && req.headers['x-kiwify-signature']
  ].filter(Boolean);
  const isValid = Buffer.isBuffer(req.rawBody) && req.rawBody.length > 0 &&
    assinaturas.some((s) => validateKiwifySignature(req.rawBody, s, secret));

  if (!isValid) {
    const motivoAssinatura = !secret
      ? 'KIWIFY_TOKEN ausente/não configurado no Cloud Functions'
      : (!assinaturas.length ? 'Assinatura ausente (?signature= ou x-kiwify-signature)' : 'Assinatura HMAC-SHA1 inválida (token divergente)');

    console.warn(`[Kiwify] Assinatura inválida: ${motivoAssinatura}`);

    await recordWebhookDebug(db, {
      payload: body,
      result: `Rejeitado 401: ${motivoAssinatura}`,
      signatureValid: false,
      orderId, eventType, orderStatus,
      incluirPayload: false
    });

    return res.status(401).send(`Unauthorized: Invalid signature (${motivoAssinatura})`);
  }

    if (!orderId || orderId === 'SEM_ORDER_ID') {
      console.warn('[Kiwify] Payload sem order_id recebido:', body);
      await recordWebhookDebug(db, {
        payload: body,
        result: 'Rejeitado 400: order_id ausente no payload',
        signatureValid: true,
        orderId, eventType, orderStatus,
        incluirPayload: false
      });
      return res.status(400).json({ error: 'Missing order_id' });
    }

    console.log(`[Kiwify] Recebido evento: orderId=${orderId}, type=${eventType}, status=${orderStatus}`);

    // 3. Identificar o tenant antes da reserva, para gravá-lo na marca.
    const tenantId = await identifyTenant(body, req.query, db);

    // 4. Reserva atômica ANTES dos efeitos. A chave canônica é orderId+eventType:
    //    a Kiwify documenta order_status como variável entre entregas do mesmo
    //    evento, incluí-lo na chave criava eventos paralelos e duplicava efeitos.
    const eventKey = chaveSegura(eventType);
    const eventRef = db.ref(`billing_events/${chaveSegura(orderId)}/${eventKey}`);
    const agora = Date.now();
    // order_status é volátil entre entregas do MESMO evento (documentação
    // Kiwify), então não entra no hash de conflito — só os dados de negócio.
    const canonico = { ...body };
    delete canonico.order_status;
    delete canonico.status;
    const payloadHash = crypto.createHash('sha256')
      .update(JSON.stringify(canonico))
      .digest('hex');

    const reserva = await reservarEvento(eventRef, {
      agora, payloadHash, tenantId, orderId, eventType, orderStatus
    });

    if (reserva.jaProcessado) {
      const anterior = reserva.existente || {};
      // Conflito só faz sentido contra um evento JÁ concluído. Um evento
      // pendente/falho está sendo reavaliado e pode mudar de tenant.
      const divergente = anterior.status === 'success' && (
        (!!anterior.payloadHash && anterior.payloadHash !== payloadHash) ||
        (!!anterior.tenantId && !!tenantId && anterior.tenantId !== tenantId)
      );
      if (divergente) {
        console.warn(`[Kiwify] Conflito em orderId=${orderId}, event=${eventKey}: tenant/payload divergentes`);
        await recordWebhookDebug(db, {
          payload: body,
          result: 'Ignorado: conflito de tenant/payload na reentrega',
          signatureValid: true,
          orderId, eventType, orderStatus,
          incluirPayload: false
        });
        return res.status(409).json({ status: 'conflict_ignored', orderId, eventKey });
      }
      console.log(`[Kiwify] Evento duplicado ignorado: orderId=${orderId}, event=${eventKey}`);
      await recordWebhookDebug(db, {
        payload: body,
        result: `Ignorado: Evento já processado anteriormente (${eventKey})`,
        signatureValid: true,
        orderId, eventType, orderStatus,
        incluirPayload: false
      });
      return res.status(200).json({ status: 'already_processed', orderId, eventKey });
    }

    // 5. Sem tenant: a marca NÃO é terminal. Quando o comprador criar a conta,
    //    uma nova entrega (ou o job) pode ativar normalmente a assinatura.
    if (!tenantId) {
      console.warn(`[Kiwify] Tenant não identificado para orderId: ${orderId}, email: ${body.Customer?.email}`);
      await eventRef.update({
        status: 'pending_tenant',
        tenantId: null,
        customerEmail: body.Customer?.email || body.email || null,
        updatedAt: Date.now()
      });
      await recordWebhookDebug(db, {
        payload: body,
        result: 'Aviso: Tenant não encontrado (Comprador sem conta ativa)',
        signatureValid: true,
        orderId, eventType, orderStatus,
        incluirPayload: false
      });
      return res.status(202).json({ warning: 'Tenant not found', orderId });
    }

    // 6. Tratar eventos. `agora` é o carimbo persistido na reserva: retries e
    //    instâncias concorrentes produzem exatamente os mesmos relativos.
    const updates = {};
    const chargeAmount = body.Commissions?.charge_amount ? (body.Commissions.charge_amount / 100) : (body.order_value || 0);
    const paymentMethod = body.payment_method || 'kiwify';
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
      const { plano, limites, planoVencimento } = mapProductToPlan(body, agora);

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
        // Um chargeback/reembolso anterior não pode ser "desbloqueado" por um
        // cancelamento agendado (evento fora de ordem).
        if (tenantData.status !== 'bloqueado_pagamento' && tenantData.billingState !== 'bloqueado') {
          updates[`tenants/${tenantId}/billingState`] = 'ativo';
        }
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
    // 7. Efeitos no tenant + marca final na MESMA escrita multi-path. Se ela
    //    falhar, a reserva permanece 'processing' e expira em 2 min para retry.
    updates[`billing_events/${chaveSegura(orderId)}/${eventKey}`] = {
      orderId,
      eventType,
      orderStatus,
      tenantId,
      payloadHash,
      claimedAt: agora,
      processedAt: agora,
      status: 'success',
      chargeAmount,
      paymentMethod,
      customerEmail: body.Customer?.email || body.email || null
    };
    try {
      await db.ref().update(updates);
    } catch (err) {
      // A escrita multi-path é atômica: se falhou, nenhum efeito foi aplicado.
      // Libera a reserva para que o retry da Kiwify não caia em already_processed.
      console.error('[Kiwify] Falha ao gravar efeitos; liberando reserva:', err && err.message);
      try {
        if (typeof eventRef.remove === 'function') await eventRef.remove();
        else await eventRef.set(null);
      } catch (_) {
        // Se nem a liberação der certo, o lease expira em 2 minutos.
      }
      throw err;
    }

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
