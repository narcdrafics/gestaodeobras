const functions = require("firebase-functions");
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const OpenAI = require('openai');
const axios = require('axios');

if (!admin.apps.length) {
  admin.initializeApp();
}

const OPENAI_KEY = defineSecret('OPENAI_KEY');
const TWILIO_SID = defineSecret('TWILIO_SID');
const TWILIO_TOKEN = defineSecret('TWILIO_TOKEN');
const TWILIO_WHATSAPP_FROM = defineSecret('TWILIO_WHATSAPP_FROM');

// ============================================================
// MAPEAMENTO DE PRODUTOS KIWIFY → PLANO
// Preencha com os IDs reais dos seus produtos na Kiwify:
// Acesse Kiwify > Produtos > (seu produto) > copie o ID da URL
// ============================================================
const PLANOS_MAP = {
   // 'PRODUCT_ID_KIWIFY': { plano, limiteObras, limiteTrabalhadores, subdominio }
   
   // IDs do Plano Pro
   'UeoKVpn': { plano: 'pro', limiteObras: 99, limiteTrabalhadores: 50, subdominio: false },
   // Adicione o ID numérico do produto Pro aqui se for diferente:
   
   // IDs do Plano Master
   'd2qkT1E': { plano: 'master', limiteObras: 99, limiteTrabalhadores: 9999, subdominio: true },
   '560979':  { plano: 'master', limiteObras: 99, limiteTrabalhadores: 9999, subdominio: true },
};

// Configuração dos limites do plano Free (downgrade / inadimplência)
const FREE_PLAN_CONFIG = { plano: 'free_trial', limiteObras: 1, limiteTrabalhadores: 5, subdominio: false };

/**
 * Gera um slug de subdomínio a partir do nome da empresa.
 * Ex: "Construtora ABC Ltda." → "construtoraabc"
 */
function gerarSlug(nomeEmpresa) {
   return (nomeEmpresa || 'empresa')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^a-z0-9]/g, '');      // só letras e números
}

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

         // --- Detecta o plano pelo ID do produto ou ID da oferta Kiwify ---
         const productId = String(payload.product_id || payload.product?.id || payload.Product?.id || '');
         const planId = String(payload.plan_id || payload.plan?.id || payload.Plan?.id || '');
         
         // Tenta mapear pelo ID do plano/oferta primeiro, depois pelo produto
         const planoConfig = PLANOS_MAP[planId] || PLANOS_MAP[productId] || { plano: 'pro', limiteObras: 99, limiteTrabalhadores: 9999, subdominio: false };
         functions.logger.info(`📦 Produto: ${productId}, Plano/Oferta: ${planId} → Mapeado para: ${planoConfig.plano}`);

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
            let slugOriginal = gerarSlug(nome);
            if (slugOriginal.length < 3) slugOriginal = 'empresa' + Math.floor(Math.random() * 1000);
            slugFinal = slugOriginal;
            let exists = (await db.ref(`tenants/${slugFinal}`).once('value')).exists();
            let salt = 1;
            while (exists) {
               slugFinal = slugOriginal + salt;
               exists = (await db.ref(`tenants/${slugFinal}`).once('value')).exists();
               salt++;
            }
         }

         // --- Busca dados atuais do tenant para compor o slug de subdomínio ---
         const tenantSnap = await db.ref(`tenants/${slugFinal}`).once('value');
         const tenantAtual = tenantSnap.val() || {};
         const nomeEmpresa = tenantAtual.config?.nomeEmpresa || tenantAtual.nomeEmpresa || nome || 'Minha Empresa';

         // --- Monta atualização base ---
         const tenantUpdate = {
            status: 'ativo',
            plano: planoConfig.plano,
            planoVencimento: Date.now() + (32 * 24 * 60 * 60 * 1000),
            ultimaAtualizacaoWebhook: Date.now(),
            'config/limiteObras': planoConfig.limiteObras,
            'config/limiteTrabalhadores': planoConfig.limiteTrabalhadores,
         };

         // --- Plano MASTER: provisiona slug de subdomínio ---
         if (planoConfig.subdominio) {
            let subdominioSlug = gerarSlug(nomeEmpresa);
            if (subdominioSlug.length < 3) subdominioSlug = slugFinal;

            // Garante slug único entre todos os tenants
            const slugSnap = await db.ref('tenants').orderByChild('subdominioSlug').equalTo(subdominioSlug).once('value');
            if (slugSnap.exists() && !slugSnap.child(slugFinal).exists()) {
               subdominioSlug = subdominioSlug + '1'; // sufixo mínimo para unicidade
            }

            tenantUpdate.subdominioSlug = subdominioSlug;
            tenantUpdate['config/slug'] = subdominioSlug;

            // Atualiza tenants_public (lido pelo Worker/app para detectar tenant)
            await db.ref(`tenants_public/${slugFinal}`).update({
               slug: subdominioSlug,
               plano: 'master'
            });

            functions.logger.info(`🌐 Subdomínio provisionado: ${subdominioSlug}.obrareal.com → tenant ${slugFinal}`);
         }

         functions.logger.info(`🚀 Atualizando tenant: ${slugFinal} → plano: ${planoConfig.plano}`);
         await db.ref(`tenants/${slugFinal}`).update(tenantUpdate);

         // --- Vincular/Atualizar Usuário se tiver e-mail ---
         if (email) {
            const safeEmail = email.replace(/\./g, ',');
            await db.ref(`users/${safeEmail}`).update({
               email: email,
               tenantId: slugFinal,
               role: 'admin',
               nome: nome || 'Administrador',
               plano: planoConfig.plano,
               lastPayment: admin.database.ServerValue.TIMESTAMP
            });
         }

         await db.ref(`webhook_debug/${logId}/result`).set(`Success: ${planoConfig.plano} ativado para ${slugFinal}`);
         return res.status(200).send(`✅ Sucesso: Plano ${planoConfig.plano} ativado para [${slugFinal}]`);
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
            functions.logger.warn(`🚫 Downgrade tenant por status: ${status} -> ${targetTenantId}`);
            await db.ref(`tenants/${targetTenantId}`).update({
               status: 'bloqueado_pagamento',
               plano: FREE_PLAN_CONFIG.plano,
               'config/limiteObras': FREE_PLAN_CONFIG.limiteObras,
               'config/limiteTrabalhadores': FREE_PLAN_CONFIG.limiteTrabalhadores,
            });
            await db.ref(`webhook_debug/${logId}/result`).set(`Downgraded+Blocked: ${targetTenantId}`);
            return res.status(200).send(`Downgrade e bloqueio aplicados ao tenant: ${targetTenantId}`);
         }
      }

      await db.ref(`webhook_debug/${logId}/result`).set(`Processed: ${status} (No action)`);
      return res.status(200).send(`Recebido: ${status} (Nenhuma ação necessária)`);

   } catch (err) {
      functions.logger.error("💥 CRASH NO WEBHOOK:", err.message);
      if (admin.apps.length) {
         await admin.database().ref(`webhook_debug/${Date.now()}`).set({ error: err.message, stack: err.stack });
      }
      return res.status(500).send("Internal Error.");
   }
});

/**
 * SaaS: Sincroniza o TenantId para o Token de Autenticação (Custom Claims)
 * Isso permite que o Firebase Storage e Firestore isolem dados por empresa de forma segura.
 */
exports.syncTenantClaim = functions.database.ref('/users/{emailSafe}')
   .onWrite(async (change, context) => {
      const data = change.after.val();

      // Se o usuário foi removido, nada a fazer aqui (o access control de login cuidará disso)
      if (!data || !data.tenantId) {
         functions.logger.info(`ℹ️ Usuário ${context.params.emailSafe} sem tenant associado.`);
         return null;
      }

      const email = context.params.emailSafe.replace(/,/g, '.');

      try {
         // 1. Localizar o UID do usuário pelo e-mail
         const userRecord = await admin.auth().getUserByEmail(email);
         const uid = userRecord.uid;

         // 2. Definir Custom Claims (Tenant e Role)
         await admin.auth().setCustomUserClaims(uid, {
            tenantId: data.tenantId,
            role: data.role || 'admin'
         });

         functions.logger.info(`✅ Custom Claims definidos para ${email} (UID: ${uid}): { tenantId: ${data.tenantId}, role: ${data.role} }`);

         // 3. Opcional: Marcar no RTDB que o claim está sincronizado (para debug)
         await admin.database().ref(`users/${context.params.emailSafe}/claimSynced`).set(true);

         return null;
      } catch (error) {
         if (error.code === 'auth/user-not-found') {
            functions.logger.warn(`⚠️ Usuário ${email} ainda não criou conta no Firebase Auth. Claim será aplicado no próximo login.`);
         } else {
            functions.logger.error("💥 Erro ao sincronizar Custom Claims:", error);
         }
         return null;
      }
   });

// ============================================================
// WEBHOOK WHATSAPP (TWILIO + OPENAI)
// ============================================================
exports.whatsappWebhook = onRequest({
  secrets: [OPENAI_KEY, TWILIO_SID, TWILIO_TOKEN, TWILIO_WHATSAPP_FROM],
  cors: true
}, async (req, res) => {
  // Twilio exige resposta 200 rápida e em formato TwiML (XML)
  res.status(200).type('text/xml').send('<Response></Response>');

  // Twilio envia dados como urlencoded. Vamos garantir a extração correta:
  const data = req.body || {};
  const From = data.From || req.query.From;
  const Body = data.Body || req.query.Body;
  const MediaUrl0 = data.MediaUrl0 || req.query.MediaUrl0;
  const MediaContentType0 = data.MediaContentType0 || req.query.MediaContentType0;
  
  let textoTarefa = Body;

  console.log(`📡 Mensagem recebida de: ${From}. Mídia: ${MediaUrl0 ? 'Sim' : 'Não'}`);
  
  if (!From) {
    console.error('❌ Erro: "From" não encontrado no corpo da requisição. Body:', JSON.stringify(req.body));
    return;
  }

  try {
    const openai = new OpenAI({ apiKey: OPENAI_KEY.value() });
    const db = admin.database();
    
    // 1. Valida se o número pode criar tarefa
    const telefoneAlvo = From.replace('whatsapp:', '').replace('+', '');
    console.log(`🔍 Buscando usuário para o telefone: ${telefoneAlvo}`);
    
    const usersSnap = await db.ref('users').once('value');
    const usersData = usersSnap.val() || {};
    
    let user = null;
    let userKey = null;

    // Busca manual para garantir que funcione independente de índice ou tipo de dado
    for (const key in usersData) {
      const u = usersData[key];
      const telUser = String(u.telefone || '').replace('+', '');
      if (telUser === telefoneAlvo) {
        user = u;
        userKey = key;
        break;
      }
    }

    if (!user) {
      console.log(`⚠️ Usuário não encontrado para: ${telefoneAlvo}`);
      await responderWhatsApp(From, `Seu número não está autorizado. (Tel: ${telefoneAlvo})`);
      return;
    }
    
    console.log(`✅ Usuário encontrado: ${user.nome} (Tenant: ${user.tenantId})`);
    const tenantId = user.tenantId;
    const telefone = From.replace('whatsapp:', ''); // Define telefone para uso posterior

    // 2. Se mandou áudio, transcreve com Whisper
    if (MediaUrl0 && MediaContentType0?.includes('audio')) {
      const response = await axios.get(MediaUrl0, {
        responseType: 'arraybuffer',
        auth: { username: TWILIO_SID.value(), password: TWILIO_TOKEN.value() }
      });

      // Whisper exige um arquivo com nome e extensão
      const buffer = Buffer.from(response.data);
      // Criar um blob simulado para o SDK da OpenAI
      const transcription = await openai.audio.transcriptions.create({
        file: await OpenAI.toFile(buffer, 'audio.ogg'),
        model: 'whisper-1',
        language: 'pt'
      });
      textoTarefa = transcription.text;
    }

    if (!textoTarefa) return;

    // 3. Usa GPT para identificar a INTENÇÃO e extrair os campos
    const extracao = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: "json_object" },
      messages: [{
        role: 'system',
        content: `Você é um assistente de gestão de obras. Analise a mensagem e retorne JSON com a intenção e os dados.
Data de hoje: ${new Date().toISOString().split('T')[0]}

Retorne exatamente neste formato:
{
  "intencao": "criar_tarefa" | "lancar_ponto" | "desconhecido",
  "tarefa": {
    "titulo": "...",
    "obra_nome": "...",
    "responsavel": "...",
    "prazo": "YYYY-MM-DD ou null"
  },
  "ponto": {
    "trabalhadores": ["Nome1", "Nome2"],
    "presenca": "Presente" | "Falta" | "Meio período",
    "obra_nome": "...",
    "data": "YYYY-MM-DD",
    "obs": "..."
  }
}

Regras:
- Se falar em tarefa, serviço, problema a resolver → intencao = "criar_tarefa"
- Se falar em presença, ponto, falta, trabalhador, peão, chegou, trabalhou → intencao = "lancar_ponto"
- Para ponto sem data explícita, use a data de hoje
- Para ponto sem status, assuma "Presente"
- Pode listar múltiplos trabalhadores para ponto`
      }, {
        role: 'user',
        content: textoTarefa
      }]
    });

    const dados = JSON.parse(extracao.choices[0].message.content);
    console.log(`🤖 Intenção detectada: ${dados.intencao}`, JSON.stringify(dados));

    // ==================== HELPER: busca obra ====================
    const buscarObra = async () => {
      const nomeOuId = (dados.intencao === 'criar_tarefa' ? dados.tarefa?.obra_nome : dados.ponto?.obra_nome) || '';
      const obrasSnap = await db.ref(`tenants/${tenantId}/obras`).once('value');
      const obras = obrasSnap.val();
      if (!obras || !nomeOuId) return null;

      const termo = nomeOuId.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const listaObras = Array.isArray(obras)
        ? obras.map((o, i) => ({ ...o, _id: String(i) }))
        : Object.entries(obras).map(([id, o]) => ({ ...o, _id: id }));

      return listaObras.find(o => {
        if (!o || !o.nome) return false;
        const nomeObra = String(o.nome).toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const codObra = String(o.cod || '').toLowerCase().trim();
        return nomeObra.includes(termo) || termo.includes(nomeObra) || codObra === termo || o._id === termo;
      });
    };

    // ==================== FLUXO: CRIAR TAREFA ====================
    if (dados.intencao === 'criar_tarefa') {
      const obraMatch = await buscarObra();
      if (!obraMatch) {
        await responderWhatsApp(From, `Não achei a obra "${dados.tarefa?.obra_nome}". Confere o nome e manda de novo.`);
        return;
      }

      const tarefasRef = db.ref(`tenants/${tenantId}/tarefas`);
      const tarefasSnap = await tarefasRef.once('value');
      let listaTarefas = tarefasSnap.val() || [];
      if (!Array.isArray(listaTarefas)) listaTarefas = Object.values(listaTarefas || {});

      const nums = listaTarefas.map(x => parseInt(String(x.cod || '').replace('TF', '')) || 0);
      const novoCod = `TF${String((nums.length > 0 ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`;

      const novaTarefa = {
        cod: novoCod,
        obra: obraMatch.cod || obraMatch._id,
        etapa: 'WhatsApp',
        frente: 'WhatsApp',
        desc: dados.tarefa.titulo,
        resp: dados.tarefa.responsavel || 'Equipe',
        prior: 'Média',
        status: 'Pendente',
        prazo: dados.tarefa.prazo || null,
        perc: 0,
        criadoPor: user.nome || 'WhatsApp Bot',
        criadoEm: admin.database.ServerValue.TIMESTAMP,
        origem: 'WhatsApp',
        telefoneAutor: telefone
      };

      listaTarefas.push(novaTarefa);
      await tarefasRef.set(listaTarefas);
      console.log(`✅ Tarefa ${novoCod} criada na obra ${obraMatch.nome}`);

      const msg = `✅ Tarefa "${String(dados.tarefa.titulo).trim()}" criada na obra "${String(obraMatch.nome).trim()}" (${novoCod})`;
      await responderWhatsApp(From, msg);

    // ==================== FLUXO: LANÇAR PONTO ====================
    } else if (dados.intencao === 'lancar_ponto') {
      const obraMatch = await buscarObra();
      if (!obraMatch) {
        await responderWhatsApp(From, `Não achei a obra "${dados.ponto?.obra_nome}". Confere o nome e manda de novo.`);
        return;
      }

      // Carrega trabalhadores do tenant
      const trabSnap = await db.ref(`tenants/${tenantId}/trabalhadores`).once('value');
      const trabalhadores = trabSnap.val() || [];
      const listaTrab = Array.isArray(trabalhadores) ? trabalhadores : Object.values(trabalhadores);

      const presencaRef = db.ref(`tenants/${tenantId}/presenca`);
      const presencaSnap = await presencaRef.once('value');
      let listaPresenca = presencaSnap.val() || [];
      if (!Array.isArray(listaPresenca)) listaPresenca = Object.values(listaPresenca || {});

      const nomesTrab = dados.ponto?.trabalhadores || [];
      if (nomesTrab.length === 0) {
        await responderWhatsApp(From, 'Não entendi quem é o trabalhador. Tenta: "João presente hoje na Timbumba"');
        return;
      }

      const dataLanc = dados.ponto?.data || new Date().toISOString().split('T')[0];
      const statusPresenca = dados.ponto?.presenca || 'Presente';
      const resultados = [];

      for (const nomeBuscado of nomesTrab) {
        const termoBusca = nomeBuscado.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // Busca fuzzy pelo nome do trabalhador
        const trab = listaTrab.find(t => {
          if (!t || !t.nome) return false;
          const nomeTNorm = String(t.nome).toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return nomeTNorm.includes(termoBusca) || termoBusca.includes(nomeTNorm);
        });

        if (!trab) {
          resultados.push(`⚠️ "${nomeBuscado}" não encontrado`);
          continue;
        }

        // Verifica duplicidade (mesmo trabalhador, mesma data, mesma obra)
        const jaExiste = listaPresenca.some(p =>
          p && p.data === dataLanc && p.trab === trab.cod && p.obra === (obraMatch.cod || obraMatch._id)
        );

        if (jaExiste) {
          resultados.push(`⚠️ ${trab.nome} já tem ponto em ${dataLanc}`);
          continue;
        }

        // Calcula o total com base na presença e diária
        let totalDia = 0;
        if (statusPresenca === 'Presente') totalDia = trab.diaria || 0;
        else if (statusPresenca === 'Meio período') totalDia = (trab.diaria || 0) / 2;

        const novoRegistro = {
          data: dataLanc,
          obra: obraMatch.cod || obraMatch._id,
          trab: trab.cod,
          nome: trab.nome,
          funcao: trab.funcao || '',
          vinculo: trab.vinculo || 'Informal',
          equipe: trab.equipe || '',
          frente: '',
          entrada: '',
          saida: '',
          hnorm: statusPresenca === 'Presente' ? 8 : statusPresenca === 'Meio período' ? 4 : 0,
          hextra: 0,
          presenca: statusPresenca,
          justif: dados.ponto?.obs || '',
          diaria: trab.diaria || 0,
          total: totalDia,
          pgtoStatus: 'Pendente',
          valpago: 0,
          lancador: user.nome || 'WhatsApp Bot',
          hrLanc: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          obs: dados.ponto?.obs || '',
          origem: 'WhatsApp',
          telefoneAutor: telefone
        };

        listaPresenca.push(novoRegistro);
        resultados.push(`✅ ${trab.nome} — ${statusPresenca}`);
        console.log(`✅ Ponto lançado: ${trab.nome} em ${dataLanc} (${statusPresenca})`);
      }

      await presencaRef.set(listaPresenca);

      const dataFmt = new Date(dataLanc + 'T12:00:00').toLocaleDateString('pt-BR');
      const resumo = resultados.join('\n');
      await responderWhatsApp(From, `📋 Ponto lançado em "${String(obraMatch.nome).trim()}" — ${dataFmt}:\n${resumo}`);

    // ==================== FLUXO: INTENÇÃO DESCONHECIDA ====================
    } else {
      await responderWhatsApp(From, `Não entendi. Você pode me pedir:\n📌 *Criar tarefa:* "Rebocar parede da Timbumba"\n👷 *Lançar ponto:* "João e Vicente presentes hoje na Timbumba"`);
    }

  } catch (err) {
    console.error('Erro webhook whatsapp:', err);
    await responderWhatsApp(From, 'Deu erro aqui. Tenta mandar de novo com: Tarefa X na obra Y');
  }
});

async function responderWhatsApp(para, msg) {
  const sid = TWILIO_SID.value();
  const token = TWILIO_TOKEN.value();
  let from = TWILIO_WHATSAPP_FROM.value();

  // Garante que o From tenha o prefixo whatsapp:
  if (from && !from.startsWith('whatsapp:')) {
    from = `whatsapp:${from}`;
  }

  if (!sid || !token || !from) {
    console.error('❌ Erro: Credenciais Twilio incompletas nos Secrets.');
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  try {
    await axios.post(url, new URLSearchParams({
      To: para,
      From: from,
      Body: msg
    }), {
      auth: { username: sid, password: token }
    });
  } catch (e) {
    console.error('Erro ao responder WhatsApp:', e.response?.data || e.message);
  }
}
