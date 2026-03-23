const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

/**
 * Esse Webhook é uma URL pública que gateways (Asaas, Kiwify) baterão
 * toda vez que um cliente pagar o boleto ou pix da assinatura do plano.
 */
exports.webhookPagamento = functions.https.onRequest(async (req, res) => {
  // Configuração padrão de CORS para comunicação Web
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).send('');
  }

  // Só aceita chamadas do Gateway avisando que pingou grana (POST)
  if (req.method !== 'POST') {
     return res.status(405).send('Só chamadas POST permitidas');
  }

  try {
    const payload = req.body;
    const db = admin.database();
    
    // LOG DE AUDITORIA: Salva a tentativa de recebimento para o Saul ver no banco
    const logId = Date.now();
    await db.ref(`webhook_debug/${logId}`).set({
        timestamp: admin.database.ServerValue.TIMESTAMP,
        payload: payload,
        method: req.method
    });

    functions.logger.info("📡 Webhook Acionado. Payload Receive:", JSON.stringify(payload));

    // Mapeamento Flexível Kiwify / Asaas / Genérico
    const status = (payload.order_status || payload.status || '').toLowerCase();
    
    // Extração de E-mail (Kiwify usa objeto Customer ou customer)
    let email = payload.email || payload.customer_email;
    let nome = payload.nome || payload.customer_name;
    const customerObj = payload.Customer || payload.customer;

    if (customerObj) {
        email = email || customerObj.email;
        nome = nome || customerObj.full_name || customerObj.name;
    }

    // SaaS: Extrai o ID da empresa enviado no checkout
    const tenantIdFromRef = payload.external_id || payload.external_reference || payload.externalReference || '';

    functions.logger.info(`🔍 Processando: Email=${email}, TenantID=${tenantIdFromRef}, Status=${status}`);

    if (!email && !tenantIdFromRef) {
       functions.logger.error("❌ Erro: Payload sem identificação (E-mail ou ID)");
       await db.ref(`webhook_debug/${logId}/result`).set("Error: Missing identification");
       return res.status(400).send('Falta identificação do cliente.');
    }

    // =============== CENÁRIO 1: PAGAMENTO APROVADO ===============
    if (status === 'approved' || status === 'paid' || status === 'active') {
       
       let slugFinal = tenantIdFromRef;

       // Fallback: Se não veio o ID, tenta achar o Tenant pelo e-mail do usuário
       if (!slugFinal && email) {
          const safeEmailSearch = email.replace(/\./g, ',');
          const userSnap = await db.ref(`users/${safeEmailSearch}`).once('value');
          if (userSnap.exists()) {
             slugFinal = userSnap.val().tenantId;
             functions.logger.info(`🔗 Tenant localizado via e-mail: ${slugFinal}`);
          }
       }

       // Se ainda não temos ID (Novo Cadastro vindo direto da Kiwify)
       if (!slugFinal) {
           functions.logger.info("✨ Criando novo Tenant para novo cliente.");
           let slugOriginal = (nome || 'empresa').toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, '');
           if(slugOriginal.length < 3) slugOriginal = 'empresa' + Math.floor(Math.random()*1000);
           slugFinal = slugOriginal;

           let exists = (await db.ref(`tenants/${slugFinal}`).once('value')).exists();
           let salt = 1;
           while(exists) {
              slugFinal = slugOriginal + salt;
              exists = (await db.ref(`tenants/${slugFinal}`).once('value')).exists();
              salt++;
           }
       }

       // 2. Upgrade do Tenant para PRO
       functions.logger.info(`🚀 Fazendo upgrade do tenant: ${slugFinal}`);
       await db.ref(`tenants/${slugFinal}`).update({
          status: 'ativo',
          plano: 'premium', 
          planoVencimento: admin.database.ServerValue.TIMESTAMP + (32 * 24 * 60 * 60 * 1000), 
          ultimaAtualizacaoWebhook: admin.database.ServerValue.TIMESTAMP,
          "config/limiteObras": 99,
          "config/limiteTrabalhadores": 99
       });

       // 3. Vincular/Atualizar Usuário se tiver e-mail
       if (email) {
          const safeEmail = email.replace(/\./g, ',');
          await db.ref(`users/${safeEmail}`).update({
             tenantId: slugFinal,
             role: 'admin',
             nome: nome || 'Administrador',
             lastPayment: admin.database.ServerValue.TIMESTAMP
          });
       }

       await db.ref(`webhook_debug/${logId}/result`).set(`Success: Promoted ${slugFinal}`);
       return res.status(200).send(`✅ Sucesso: Plano ativado para [${slugFinal}]`);
    }

    // =============== CENÁRIO 2: FALHA / REEMBOLSO / CANCELAMENTO ===============
    else if (['refunded', 'chargeback', 'canceled', 'overdue', 'expired'].includes(status)) {
       if (!tenantIdFromRef && !email) {
          await db.ref(`webhook_debug/${logId}/result`).set("Skipped: No ID for block");
          return res.status(200).send('Sem ID para bloqueio.');
       }
       
       let targetTenantId = tenantIdFromRef;
       if (!targetTenantId && email) {
          const safeEmail = email.replace(/\./g, ',');
          const uSnap = await db.ref(`users/${safeEmail}`).once('value');
          if (uSnap.exists()) targetTenantId = uSnap.val().tenantId;
       }

       if (targetTenantId) {
          functions.logger.warn(`🚫 Bloqueando tenant por status: ${status} -> ${targetTenantId}`);
          await db.ref(`tenants/${targetTenantId}/status`).set('bloqueado_pagamento');
          await db.ref(`webhook_debug/${logId}/result`).set(`Blocked: ${targetTenantId}`);
          return res.status(200).send(`Bloqueio aplicado ao tenant: ${targetTenantId}`);
       }
    }

    await db.ref(`webhook_debug/${logId}/result`).set(`Processed: ${status} (No action)`);
    return res.status(200).send(`Recebido: ${status} (Nenhuma ação necessária)`);

  } catch (err) {
    functions.logger.error("💥 CRASH NO WEBHOOK:", err.message);
    if(admin.apps.length) {
       await admin.database().ref(`webhook_debug/${Date.now()}`).set({ error: err.message, stack: err.stack });
    }
    return res.status(500).send("Internal Error.");
  }
});
