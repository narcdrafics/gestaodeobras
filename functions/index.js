// v2.1 - Percepção inteligente de nomes e respostas formatadas
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onValueWritten } = require("firebase-functions/v2/database");
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const axios = require('axios');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const { detectarEtapas } = require('./whatsapp/obra-etapas');

const OPENAI_KEY = defineSecret('OPENAI_KEY');
const META_ACCESS_TOKEN = defineSecret('META_ACCESS_TOKEN');
const META_PHONE_NUMBER_ID = defineSecret('META_PHONE_NUMBER_ID');
const META_VERIFY_TOKEN = defineSecret('META_VERIFY_TOKEN');
const META_APP_SECRET = defineSecret('META_APP_SECRET');
const META_WABA_ID = defineSecret('META_WABA_ID');

admin.initializeApp();

function getHojeBR() {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()).split('/').reverse().join('-');
}

function formatarDataBR(isoStr) {
  if (!isoStr) return '';
  const partes = isoStr.split('-');
  if (partes.length !== 3) return isoStr;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function norm(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

function similarity(s1, s2) {
  const na = norm(s1), nb = norm(s2);
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.95;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

function melhorMatch(termo, lista, getFn, threshold = 0.4) {
  let best = null, bestScore = threshold - 0.001;
  for (const item of lista) {
    const score = similarity(termo, getFn(item));
    if (score > bestScore) { bestScore = score; best = item; }
  }
  return best;
}

exports.whatsappWebhook = onRequest({
  secrets: [OPENAI_KEY, META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, META_VERIFY_TOKEN, META_APP_SECRET, META_WABA_ID],
  cors: true,
  memory: '512MiB',
  timeoutSeconds: 300
}, async (req, res) => {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === META_VERIFY_TOKEN.value()) {
      console.log('✅ Webhook verificado com sucesso!');
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send('Token inválido');
    }
  }

  // Validação de assinatura para POST (segurança)
  if (req.method === 'POST') {
    if (!validateSignature(req)) {
      console.error('❌ Assinatura inválida detectada.');
      return res.status(401).send('Invalid signature');
    }
  }

  const body = req.body || {};

  if (body.object === 'whatsapp_business_account' || body.object === 'page') {
    res.status(200).send('OK');
    
    if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
      const msg = body.entry[0].changes[0].value.messages[0];
      const From = msg.from;
      const texto = msg.text?.body || '';
      await processarMensagem(From, texto, null);
    } else {
      const entry = body.entry?.[0];
      const msg = entry?.messaging?.[0];
      if (msg) {
        const From = msg.sender?.id;
        const audioUrl = msg.message?.attachments?.find(a => a.type === 'audio')?.payload?.url;
        const texto = msg.message?.text;
        await processarMensagem(From, texto || '', audioUrl);
      }
    }
  } else {
    res.status(404).send('Not Found');
  }
});

async function processarMensagem(From, textoTarefa, audioUrl) {
  console.log(`📡 Mensagem de ${From}: ${textoTarefa}`);
  if (!From) return;

  try {
    const openai = new OpenAI({ apiKey: OPENAI_KEY.value() });
    const db = admin.database();
    const phoneId = From.replace(/\D/g, '');
    
    const usersSnap = await db.ref('users').once('value');
    const usersData = usersSnap.val();
    
    let user = null;
    let tenantId = null;
    for (const key in usersData) {
      const u = usersData[key];
      const uTelefone = u.telefone ? String(u.telefone).replace(/\D/g, '') : '';
      if ((u.whatsappId && u.whatsappId === From) || 
          (uTelefone && uTelefone.includes(phoneId))) {
        user = u;
        tenantId = u.tenantId;
        break;
      }
    }

    if (!user || !tenantId) {
      const tenantsSnap = await db.ref('tenants').once('value');
      const tenants = tenantsSnap.val() || {};
      const phoneLimpo = phoneId.replace(/\D/g, '');
      let encontrado = false;
      
      for (const [tid, tenantData] of Object.entries(tenants)) {
        const telefonesData = tenantData?.config?.telefonesPermitidos;
        const telefonesPermitidos = telefonesData ? [telefonesData].flat() : [];
        const permitido = telefonesPermitidos.length > 0 && telefonesPermitidos.some(t => String(t || '').replace(/\D/g, '').includes(phoneLimpo));
        if (permitido) {
          tenantId = tid;
          encontrado = true;
          console.log(`✅ Telefone permitido: ${From} | tenantId: ${tenantId}`);
          break;
        }
      }
      
      if (!encontrado) {
        console.log(`⚠️ WhatsApp ID ${phoneId} não autorizado.`);
        await responderWhatsApp(phoneId, "Número não autorizado. Fale com o administrator.");
        return;
      }
    }

    if (audioUrl) {
      console.log('🎙️ Baixando áudio...');
      const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
      const tempFilePath = path.join(os.tmpdir(), `audio-${Date.now()}.ogg`);
      fs.writeFileSync(tempFilePath, Buffer.from(response.data));
      const transcription = await openai.audio.transcriptions.create({ file: fs.createReadStream(tempFilePath), model: "whisper-1", language: "pt" });
      textoTarefa = transcription.text;
      console.log(`📝 Transcrito: "${textoTarefa}"`);
      fs.unlinkSync(tempFilePath);
    }

if (!textoTarefa) return;

    const txt = textoTarefa.trim();
    const txtUpper = txt.toUpperCase();
    const isTextoCurto = !audioUrl && txt.length < 200;
    let dados = null;
    let usarGPT = true;

    if (isTextoCurto) {
      const matchTarefa = txt.replace(/^(TAREFA| TAREFAS?)\s*-?\s*/i, '').trim();
      const matchPonto = txt.replace(/^(PONTO|PRESENÇA|ENTRADA|SAÍDA|FALTA)\s*/i, '').trim();
      
      if (txt.match(/^TAREFA\b/i) && !txtUpper.includes('LISTA')) {
        const isObra = matchTarefa.includes(' - ') ? matchTarefa.split(' - ')[0].trim() : null;
        const titulo = isObra ? matchTarefa.split(' - ').slice(1).join(' - ').trim() : matchTarefa;
        const etapas = detectarEtapas(titulo);
        dados = { intencao: 'criar_tarefa', tarefa: { titulo, obra_nome: isObra }, _etapas: etapas };
        usarGPT = false;
      } else if (txtUpper.match(/^PONTO\s/i) || txtUpper.match(/^PRESEN/i)) {
        const presenca = txtUpper.includes('SAÍTA') || txtUpper.includes('SAÍDA') ? 'Saída' : txtUpper.includes('FALTA') ? 'Falta' : 'Presente';
        dados = { intencao: 'lancar_ponto', ponto: { trabalhadores: [matchPonto || 'Equipe'], presenca, obra_nome: null } };
        usarGPT = false;
      } else if (txtUpper === 'OI' || txtUpper === 'OLA' || txtUpper.match(/^BOM DIA/i)) {
        dados = { intencao: 'consultar' };
        usarGPT = false;
      } else if (txtUpper === 'PONTO' || txtUpper === 'PRESENÇA') {
        dados = { intencao: 'consultar_ponto' };
        usarGPT = false;
      } else if (txtUpper.includes('RDO')) {
        dados = { intencao: 'consultar_rdo' };
        usarGPT = false;
      } else if (txtUpper.includes('TAREFA') || txtUpper === 'LISTA' || txtUpper === 'MENU') {
        dados = { intencao: 'consultar' };
        usarGPT = false;
      } else {
        const etapas = detectarEtapas(txt);
        if (etapas.length > 0) {
          dados = { intencao: 'criar_tarefa', tarefa: { titulo: txt, obra_nome: null }, _etapas: etapas };
          usarGPT = false;
        }
      }
    }

    const dataHojeBR = getHojeBR();

    if (!dados) {
      const prompt = `Você é um assistente de gestão de obras. Extraia as informações da mensagem para o seguinte formato JSON:
      { 
        "intencao": "lancar_ponto" | "criar_tarefa" | "consultar" | "consultar_rdo", 
        "ponto": { 
          "trabalhadores": ["Nomes mencionados"], 
          "presenca": "Presente" | "Falta" | "Meio período", 
          "obra_nome": "Nome da obra mencionado (ex: Timbumba, Fachada, etc)", 
          "data": "${dataHojeBR}" 
        }, 
        "tarefa": { 
          "titulo": "Descrição clara da tarefa", 
          "obra_nome": "Nome da obra mencionado" 
        } 
      }
      Instruções:
      - Se a mensagem for "Oi", "Bom dia", etc, intencao = "consultar".
      - Se o usuário pedir o "RDO", "Relatório de hoje" ou "o que foi feito hoje", intencao = "consultar_rdo".
      - No campo "trabalhadores", se disser "toda a equipe", tente identificar se há nomes específicos ou use a frase.
      - Seja inteligente ao extrair o nome da obra, ignore preposições como "na", "da", "em".
      
      Mensagem do usuário: "${textoTarefa}"`;

      const gptRes = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você é um especialista em extração de dados JSON para construção civil. Retorne apenas o objeto JSON, sem explicações." }, 
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });

      dados = JSON.parse(gptRes.choices[0].message.content);
      console.log(`🤖 GPT JSON:`, JSON.stringify(dados));
    } else {
      console.log(`🔍 Detecção local:`, JSON.stringify(dados));
    }

    const buscarObra = async () => {
      const nomeOuId = dados.tarefa?.obra_nome || dados.ponto?.obra_nome;
      if (!nomeOuId || nomeOuId === 'nao_informada') return null;
      
      const obrasSnap = await db.ref(`tenants/${tenantId}/obras`).once('value');
      console.log(`🔍 DB path: tenants/${tenantId}/obras`);
      const obras = obrasSnap.val() || [];
      const listaObras = Array.isArray(obras) ? obras : Object.values(obras);
      
      // Filtrar obras ativas com mais flexibilidade no status
      const listaAtivas = listaObras.filter(o => o && (
        ['ativa', 'em andamento', 'planejada', 'execucao'].includes(norm(o.status))
      ));

      console.log(`🔍 Debug busca obra: "${nomeOuId}" | Total: ${listaObras.length} | Ativas: ${listaAtivas.length}`);
      console.log(`🔍 Obras ativas:`, listaAtivas.map(o => ({ nome: o.nome, cod: o.cod, status: o.status })));

      // 1. Busca exata (Nome, Código ou ID)
      const buscaNorm = norm(nomeOuId);
      const exata = listaAtivas.find(o => 
        norm(o.nome) === buscaNorm || 
        norm(o.cod) === buscaNorm || 
        o._id === nomeOuId
      );
      console.log(`🔍 Busca exata: "${buscaNorm}" | Encontrada:`, exata ? exata.nome : 'null');
      if (exata) return exata;

      // 2. Busca por contém (ex: usuário disse "Timbumba" e a obra chama "Residencial Timbumba")
      const contem = listaAtivas.find(o => norm(o.nome).includes(buscaNorm));
      console.log(`🔍 Busca contém: "${buscaNorm}" | Encontrada:`, contem ? contem.nome : 'null');
      if (contem) return contem;

      // 3. Busca por similaridade (Fuzzy) - Threshold baixo para captar erros de digitação
      return melhorMatch(nomeOuId, listaAtivas, o => o.nome, 0.3);
    };

    if (dados.intencao === 'criar_tarefa') {
      const obraMatch = await buscarObra();
      if (!obraMatch) { await responderWhatsApp(phoneId, `Obra "${dados.tarefa?.obra_nome}" não encontrada.`); return; }
      const tarefasRef = db.ref(`tenants/${tenantId}/tarefas`);
      const snapshot = await tarefasRef.once('value');
      let lista = Array.isArray(snapshot.val()) ? snapshot.val() : Object.values(snapshot.val() || {});
      const novoCod = `TF${String(lista.length + 1).padStart(3, '0')}`;
      
      const melhorEtapa = dados._etapas?.[0];
      const tarefaData = { 
        cod: novoCod, 
        obra: obraMatch.cod || obraMatch._id, 
        desc: dados.tarefa.titulo, 
        etapa: melhorEtapa?.etapa || null,
        etapaCodigo: melhorEtapa?.codigo || null,
        frente: melhorEtapa?.frente || null,
        prioridade: melhorEtapa?.prioridade || 'Média',
        resp: 'Equipe', 
        status: 'Pendente', 
        criadoPor: user?.nome || 'WhatsApp', 
        criadoEm: admin.database.ServerValue.TIMESTAMP, 
        origem: 'WhatsApp' 
      };
      lista.push(tarefaData);
      await tarefasRef.set(lista);
      
      const etapaInfo = melhorEtapa ? `\n📂 ${melhorEtapa.etapa} | 🔨 ${melhorEtapa.frente} | ${melhorEtapa.prioridade}` : '';
      const msgSucesso = `🎯 *Tarefa Registrada!* \n\n📋 *O que:* ${dados.tarefa.titulo}\n🏗️ *Obra:* ${obraMatch.nome.trim()}${etapaInfo}\n\nJá está no painel! ✅`;
      await responderWhatsApp(phoneId, msgSucesso);

    } else if (dados.intencao === 'lancar_ponto') {
      const obraMatch = await buscarObra();
      if (!obraMatch) { await responderWhatsApp(phoneId, `Obra "${dados.ponto?.obra_nome}" não identificada.`); return; }

      const trabSnap = await db.ref(`tenants/${tenantId}/trabalhadores`).once('value');
      const trabalhadores = trabSnap.val() || [];
      const listaTrab = Array.isArray(trabalhadores) ? trabalhadores : Object.values(trabalhadores);
      const listaAtivos = listaTrab.filter(t => t && norm(t.status) === 'ativo');

      const presencaRef = db.ref(`tenants/${tenantId}/presenca`);
      const nomesTrab = dados.ponto?.trabalhadores || [];
      const dataLanc = dados.ponto?.data || dataHojeBR;
      const statusP = dados.ponto?.presenca || 'Presente';
      const resultados = [];
      const novos = [];

      for (const nomeB of nomesTrab) {
        const trab = melhorMatch(nomeB, listaAtivos, t => t.nome, 0.5);
        if (!trab) { resultados.push(`⚠️ "${nomeB}" não achado`); continue; }

        let total = 0, hnorm = 0;
        if (statusP === 'Presente') { total = trab.diaria || 0; hnorm = 8; }
        else if (statusP === 'Meio período') { total = (trab.diaria || 0) / 2; hnorm = 4; }
        else if (statusP === 'Falta') { total = 0; hnorm = 0; }

        novos.push({
          data: dataLanc, obra: obraMatch.cod || obraMatch._id, trab: trab.cod, nome: trab.nome,
          funcao: trab.funcao || '', vinculo: trab.vinculo || 'Informal', equipe: trab.equipe || '',
          entrada: statusP === 'Falta' ? '00:00' : '07:00', saida: statusP === 'Meio período' ? '12:00' : (statusP === 'Falta' ? '00:00' : '17:00'),
          hnorm, hextra: 0, presenca: statusP, diaria: parseFloat(trab.diaria) || 0, total: parseFloat(total),
          pgtoStatus: 'Pendente', valpago: 0, lancador: user.nome || 'WhatsApp Bot', 
          hrLanc: new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date()), 
          origem: 'WhatsApp', telefoneAutor: phoneId, _s: statusP
        });
      }

      if (novos.length > 0) {
        await presencaRef.transaction((current) => {
          let lista = Array.isArray(current) ? current : Object.values(current || {});
          for (const n of novos) {
            const idx = lista.findIndex(p => p && p.data === n.data && p.trab === n.trab);
            const { _s, ...final } = n;
            if (idx === -1) {
              lista.push(final);
              resultados.push(`✅ ${n.nome} — ${_s}`);
            } else {
              lista[idx] = { ...lista[idx], ...final };
              resultados.push(`🔄 ${n.nome} alterado para ${_s} em ${obraMatch.nome}`);
            }
          }
          return lista;
        });
      }
      const dataFmt = formatarDataBR(dataLanc);
      await responderWhatsApp(phoneId, `📋 Presença — ${dataFmt}:\n${resultados.join('\n')}`);
    } else if (dados.intencao === 'consultar') {
      await processarConsultaGeral(phoneId, tenantId, user);
    } else if (dados.intencao === 'consultar_rdo') {
      await processarConsultaRDO(phoneId, tenantId, user);
    }
  } catch (err) {
    console.error('Erro:', err);
    await responderWhatsApp(From, 'Erro no servidor.');
  }
}

async function responderWhatsApp(para, msg) {
  const accessToken = META_ACCESS_TOKEN.value();
  const phoneNumberId = META_PHONE_NUMBER_ID.value();
  
  if (!accessToken || !phoneNumberId) {
    console.error('❌ Falta configuração da Meta (Token ou PhoneID)');
    return;
  }
  
  if (!msg) {
    console.warn('⚠️ Tentativa de enviar mensagem vazia para:', para);
    return;
  }

  let payload = null;
  try {
    const cleanPhoneId = phoneNumberId.trim();
    const url = `https://graph.facebook.com/v20.0/${cleanPhoneId}/messages`;
    payload = {
      messaging_product: "whatsapp",
      to: para.trim(),
      type: "text",
      text: { body: msg }
    };
    
    console.log(`📤 Enviando para ${para} via ${cleanPhoneId}...`);
    
    await axios.post(url, payload, {
      headers: { 
        'Authorization': `Bearer ${accessToken.trim()}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(`✅ Resposta enviada para ${para}:`, msg.substring(0, 200));
  } catch (error) {
    console.error('❌ Erro Meta API:', error.response?.data || error.message);
    if (error.response?.data && payload) {
      console.error('Payload enviado:', JSON.stringify(payload, null, 2));
    }
  }
}

function validateSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', META_APP_SECRET.value())
    .update(req.rawBody)
    .digest('hex');


  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (e) {
    return false;
  }
}

exports.dailyReport = onSchedule({
  schedule: '0 21 * * *', // 18h Brasília (UTC-3)
  timeZone: 'America/Sao_Paulo',
  secrets: [META_ACCESS_TOKEN, META_PHONE_NUMBER_ID]
}, async (event) => {
  const db = admin.database();
  const hoje = getHojeBR();

  console.log(`🕒 Iniciando relatório diário agendado para ${hoje}`);

  try {
    const tenantsSnap = await db.ref('tenants').once('value');
    const tenants = tenantsSnap.val();
    if (!tenants) return;

    for (const tenantId in tenants) {
      const tenant = tenants[tenantId];
      // Verifica se o tenant está ativo e possui telefone de admin configurado
      if (!tenant.adminPhone || tenant.status === 'inativo') continue;

      console.log(`📊 Gerando relatório para tenant: ${tenantId} (${tenant.nome || 'Sem nome'})`);

      const [pontoSnap, tarefasSnap] = await Promise.all([
        db.ref(`tenants/${tenantId}/ponto/${hoje}`).once('value'),
        db.ref(`tenants/${tenantId}/tarefas`).once('value')
      ]);

      const ponto = Object.values(pontoSnap.val() || {});
      const tarefas = Object.values(tarefasSnap.val() || {});

      const presentes = ponto.filter(p => p.entrada && !p.falta).length;
      const ausentes = ponto.filter(p => p.falta).length;
      const totalPessoal = ponto.length;

      const concluidasHoje = tarefas.filter(t => t.status === 'Concluída' && t.concluidaEm?.startsWith(hoje)).length;
      const pendentes = tarefas.filter(t => t.status === 'Pendente').length;
      const atrasadas = tarefas.filter(t => t.status === 'Pendente' && t.prazo < hoje).length;

      const msg = `📊 *Relatório Diário — ${tenant.nome || 'Obra Real'}*\n` +
                  `📅 Data: ${formatarDataBR(hoje)}\n\n` +
                  `👷 *Pessoal*\n` +
                  `✅ Presentes: ${presentes}\n` +
                  `❌ Faltas: ${ausentes}\n` +
                  `👥 Total: ${totalPessoal}\n\n` +
                  `📋 *Tarefas*\n` +
                  `✅ Concluídas hoje: ${concluidasHoje}\n` +
                  `🔵 Em aberto: ${pendentes}\n` +
                  `🔴 Em atraso: ${atrasadas}\n\n` +
                  `Para detalhes, responda *MENU*.`;

      await responderWhatsApp(tenant.adminPhone, msg);
    }
    console.log('✅ Relatórios diários enviados com sucesso.');
  } catch (error) {
    console.error('❌ Erro ao processar relatórios diários:', error);
  }
});

async function processarConsultaGeral(para, tenantId, user) {
  const db = admin.database();
  const hoje = getHojeBR();
  
  const [obrasSnap, tarefasSnap, pontoSnap] = await Promise.all([
    db.ref(`tenants/${tenantId}/obras`).once('value'),
    db.ref(`tenants/${tenantId}/tarefas`).once('value'),
    db.ref(`tenants/${tenantId}/presenca`).once('value')
  ]);
  
  const obras = Object.values(obrasSnap.val() || {}).filter(o => o && ['ativa', 'em andamento', 'planejada', 'execucao'].includes(norm(o.status)));
  const hojePonto = Object.values(pontoSnap.val() || {}).filter(p => p && p.data === hoje);
  const tarefasAbertas = Object.values(tarefasSnap.val() || {}).filter(t => t && t.status !== 'Concluída');
  
  const nomeEmpresa = 'Empresa';
  const nomeObra = obras[0]?.nome || 'Sem obra';
  const presentes = hojePonto.filter(p => p.presenca === 'Presente').length;
  const faltantes = hojePonto.filter(p => p.presenca === 'Falta').length;
  const tarefasPendentes = tarefasAbertas.length;
  
  const msg = `👋 *Olá!* ${user?.nome || ''}\n\n📅 *${hoje}*\n\n🏗️ *${nomeObra}*\n\n👷 *Presentes:* ${presentes}\n❌ *Faltas:* ${faltantes}\n📋 *Tarefas abertas:* ${tarefasPendentes}\n\nUse:\n• *TAREFA* - listar tarefas\n• *PONTO* - lancar ponto\n• *MENU* - ver opcoes`;
  
  await responderWhatsApp(para, msg);
}

async function processarConsultaRDO(para, tenantId, user) {
  const db = admin.database();
  const hoje = getHojeBR();
  
  const [obrasSnap, tarefasSnap, pontoSnap, movSnap] = await Promise.all([
    db.ref(`tenants/${tenantId}/obras`).once('value'),
    db.ref(`tenants/${tenantId}/tarefas`).once('value'),
db.ref(`tenants/${tenantId}/presenca`).once('value'),
    db.ref(`tenants/${tenantId}/movEstoque`).once('value'),
  ]);
  
  const obras = Object.values(obrasSnap.val() || {}).filter(o => o && ['ativa', 'em andamento', 'execucao'].includes(norm(o.status)));
  const hojePonto = Object.values(pontoSnap.val() || {}).filter(p => p && p.data === hoje && (p.presenca === 'Presente' || p.presenca === 'Meio período'));
  const hojeMov = Object.values(movSnap.val() || {}).filter(m => m && m.data === hoje && m.tipo === 'Saída');
  const tarefasH = Object.values(tarefasSnap.val() || {}).filter(t => t && t.status !== 'Concluída');
  
  const dataFmt = formatarDataBR(hoje);
  let msg = `📊 *RDO de Hoje* — ${dataFmt}\n\n`;

  // 1. Presentes
  msg += `👷 *Equipe Presente:*`;
  if (hojePonto.length > 0) {
    const nomes = hojePonto.map(p => `• ${p.nome}`).join('\n');
    msg += `\n${nomes}`;
  } else {
    msg += `\n_Nenhum registro de presença até agora._`;
  }

  // 2. Ferramentas / Movimentação
  msg += `\n\n🔧 *Ferramentas / Saídas:*`;
  if (hojeMov.length > 0) {
    const itens = hojeMov.map(m => `• ${m.mat} (${m.qtd}${m.unid || ''})`).join('\n');
    msg += `\n${itens}`;
  } else {
    msg += `\n_Nenhuma movimentação de material registrada._`;
  }

  // 3. Tarefas
  msg += `\n\n📋 *Tarefas:*`;
  const tarefasHoje = tarefasH.filter(t => t.prazo === hoje);
  if (tarefasHoje.length > 0) {
    const listT = tarefasHoje.map(t => `• [${t.status}] ${t.desc}`).join('\n');
    msg += `\n${listT}`;
  } else {
    msg += `\n_Nenhuma tarefa específica para hoje._`;
  }

  msg += `\n\n✅ *RDO Finalizado*`;
  
  await responderWhatsApp(para, msg);
}

exports.syncCustomClaims = onValueWritten("profiles/{uid}", async (event) => {
  const uid = event.params.uid;
  const after = event.data.after.val();

  if (!after) {
    // Perfil deletado
    return null;
  }

  const role = after.role || 'admin';
  const tenantId = after.tenantId || null;

  try {
    const currentClaims = (await admin.auth().getUser(uid)).customClaims || {};
    
    // Evitar updates desnecessários (otimização de cota e performance)
    if (currentClaims.role === role && currentClaims.tenantId === tenantId) {
      console.log(`[syncCustomClaims] Claims inalteradas para uid: ${uid}`);
      return null;
    }

    await admin.auth().setCustomUserClaims(uid, {
      role: role,
      tenantId: tenantId
    });
    
    console.log(`[syncCustomClaims] Atualizado uid: ${uid} -> role: ${role}, tenant: ${tenantId}`);
    return { success: true };
  } catch (err) {
    console.error(`[syncCustomClaims] Erro ao atualizar claims para uid: ${uid}`, err);
    return null;
  }
});
