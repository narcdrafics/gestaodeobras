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
    functions.logger.info("📡 Webhook Acionado. Payload Recebido:", payload);

    /**
     * ESTRUTURA DA KIWIFY:
     * order_status: "approved", "refunded", "chargeback"
     * Customer: { email: "...", full_name: "..." }
     */

    // Adaptação flexível para mapear Kiwify, Asaas ou Genérico
    const status = payload.order_status || payload.status || 'paid';
    
    // Mapeia E-mail e Nome
    let email = payload.email || payload.customer_email;
    let nome = payload.nome || payload.customer_name;

    // Se vier da Kiwify, extrai de "Customer"
    if (payload.Customer) {
        email = email || payload.Customer.email;
        nome = nome || payload.Customer.full_name;
    }
    
    nome = nome || "Empresa " + Date.now();

    if (!email) {
       console.error("Payload não continha E-mail");
       return res.status(400).send('Falta E-mail do Cliente');
    }

    const db = admin.database();

    // =============== CENÁRIO 1: DINHEIRO ENTROU (CRIAR TENANT OU PROMOVER) ===============
    if (status === 'paid' || status === 'approved') {
       
       // 1. Gera um slug temporário e único
       let slugOriginal = nome.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, '');
       if(slugOriginal.length < 3) slugOriginal = 'empresa' + Math.floor(Math.random()*100);
       let slugFinal = slugOriginal;

       let exists = (await db.ref(`tenants/${slugFinal}`).once('value')).exists();
       let salt = 1;
       while(exists) {
          slugFinal = slugOriginal + salt;
          exists = (await db.ref(`tenants/${slugFinal}`).once('value')).exists();
          salt++;
       }

       // 2. Injeta o Tenant no Database Master
       await db.ref(`tenants/${slugFinal}`).set({
          nome: nome,
          emailAdmin: email,
          status: 'ativo',
          plano: 'premium',
          webhookCriacao: admin.database.ServerValue.TIMESTAMP,
          limiteObras: 5,
          limiteTrab: 50
       });

       // 3. Cadastra o cara no dicionário Global de Usuários (Users Core)
       // Transforma e-mail mari@ex.com em mari_ex_com (Firebase Keys não aceitam ponto)
       const safeEmail = email.replace(/\./g, ',');
       await db.ref(`users/${safeEmail}`).set({
          tenantId: slugFinal,
          role: 'admin',
          nome: nome,
          origem: 'webhook'
       });

       return res.status(200).send(`✅ Tenant [${slugFinal}] providenciado com sucesso.`);
    }

    // =============== CENÁRIO 2: CALOTE OU CANCELED (BLOQUEAR TENANT) ===============
    else if (status === 'overdue' || status === 'canceled' || status === 'refunded' || status === 'chargeback') {
       
       const safeEmail = email.replace(/\./g, ',');
       const userSnap = await db.ref(`users/${safeEmail}`).once('value');
       
       if (userSnap.exists()) {
          const tId = userSnap.val().tenantId;
          // Pune o caloteiro travando a conta toda.
          await db.ref(`tenants/${tId}/status`).set('bloqueado_pagamento');
          return res.status(200).send(`🚫 Assinatura [${tId}] suspensa por inadimplência/cancelamento.`);
       } else {
          return res.status(200).send(`⚠️ Nenhum usuário achado para bloqueio: ${email}`);
       }
    }

    // Outros cenários...
    return res.status(200).send('Processado (Sem Ação Necessária).');

  } catch (err) {
    functions.logger.error("ERRO GRAVE NO WEBHOOK", err);
    return res.status(500).send("Cloud Function Error.");
  }
});
