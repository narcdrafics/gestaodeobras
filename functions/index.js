const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const axios = require('axios');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');

const OPENAI_KEY = defineSecret('OPENAI_KEY');
const TWILIO_SID = defineSecret('TWILIO_SID');
const TWILIO_TOKEN = defineSecret('TWILIO_TOKEN');
const TWILIO_WHATSAPP_FROM = defineSecret('TWILIO_WHATSAPP_FROM');

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

function melhorMatch(termo, lista, getFn, threshold = 0.6) {
  let best = null, bestScore = threshold - 0.001;
  for (const item of lista) {
    const score = similarity(termo, getFn(item));
    if (score > bestScore) { bestScore = score; best = item; }
  }
  return best;
}

exports.whatsappWebhook = onRequest({
  secrets: [OPENAI_KEY, TWILIO_SID, TWILIO_TOKEN, TWILIO_WHATSAPP_FROM],
  cors: true,
  memory: '512MiB',
  timeoutSeconds: 300
}, async (req, res) => {
  res.status(200).type('text/xml').send('<Response></Response>');

  const data = req.body || {};
  const From = data.From || req.query.From;
  const Body = data.Body || req.query.Body;
  const MediaUrl0 = data.MediaUrl0 || req.query.MediaUrl0;
  const MediaContentType0 = data.MediaContentType0 || req.query.MediaContentType0;
  
  let textoTarefa = Body;
  console.log(`📡 Mensagem: ${From}`);
  
  if (!From) return;

  try {
    const openai = new OpenAI({ apiKey: OPENAI_KEY.value() });
    const db = admin.database();
    
    const telefone = From.replace('whatsapp:', '').replace('+', '');
    const usersSnap = await db.ref('users').once('value');
    const usersData = usersSnap.val();
    
    let user = null;
    let tenantId = null;

    for (const key in usersData) {
      const u = usersData[key];
      if (u.telefone && String(u.telefone).replace(/\D/g, '').includes(telefone)) {
        user = u;
        tenantId = u.tenantId;
        break;
      }
    }

    if (!user || !tenantId) {
      console.log(`⚠️ Telefone ${telefone} não autorizado.`);
      await responderWhatsApp(From, "Número não autorizado.");
      return;
    }

    if (MediaUrl0 && (MediaContentType0.includes('audio') || MediaContentType0.includes('ogg'))) {
      console.log('🎙️ Baixando áudio com autenticação...');
      const response = await axios.get(MediaUrl0, { 
        responseType: 'arraybuffer',
        auth: {
          username: TWILIO_SID.value(),
          password: TWILIO_TOKEN.value()
        }
      });
      const tempFilePath = path.join(os.tmpdir(), `audio-${Date.now()}.ogg`);
      fs.writeFileSync(tempFilePath, Buffer.from(response.data));
      const transcription = await openai.audio.transcriptions.create({ file: fs.createReadStream(tempFilePath), model: "whisper-1", language: "pt" });
      textoTarefa = transcription.text;
      console.log(`📝 Transcrito: "${textoTarefa}"`);
      fs.unlinkSync(tempFilePath);
    }

    if (!textoTarefa) return;

    const dataHojeBR = getHojeBR();

    const prompt = `Extraia JSON: { "intencao": "lancar_ponto"|"criar_tarefa", "ponto": { "trabalhadores": [], "presenca": "Presente"|"Falta"|"Meio período", "obra_nome": "", "data": "${dataHojeBR}" }, "tarefa": { "titulo": "", "obra_nome": "" } }. Mensagem: "${textoTarefa}"`;

    const gptRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: "JSON puro." }, { role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const dados = JSON.parse(gptRes.choices[0].message.content);
    console.log(`🤖 GPT JSON:`, JSON.stringify(dados));

    const buscarObra = async () => {
      const nomeOuId = dados.tarefa?.obra_nome || dados.ponto?.obra_nome;
      if (!nomeOuId || nomeOuId === 'nao_informada') return null;
      const obrasSnap = await db.ref(`tenants/${tenantId}/obras`).once('value');
      const obras = obrasSnap.val() || [];
      const listaObras = Array.isArray(obras) ? obras : Object.values(obras);
      const listaAtivas = listaObras.filter(o => o && (norm(o.status) === 'ativa' || norm(o.status) === 'em andamento' || norm(o.status) === 'planejada'));
      const exata = listaAtivas.find(o => norm(o.nome) === norm(nomeOuId) || o.cod === nomeOuId || o._id === nomeOuId);
      if (exata) return exata;
      const fuzzy = melhorMatch(nomeOuId, listaAtivas, o => o.nome, 0.4);
      return fuzzy;
    };

    if (dados.intencao === 'criar_tarefa') {
      const obraMatch = await buscarObra();
      if (!obraMatch) { await responderWhatsApp(From, `Obra "${dados.tarefa?.obra_nome}" não encontrada.`); return; }
      const tarefasRef = db.ref(`tenants/${tenantId}/tarefas`);
      const snapshot = await tarefasRef.once('value');
      let lista = Array.isArray(snapshot.val()) ? snapshot.val() : Object.values(snapshot.val() || {});
      const novoCod = `TF${String(lista.length + 1).padStart(3, '0')}`;
      lista.push({ cod: novoCod, obra: obraMatch.cod || obraMatch._id, desc: dados.tarefa.titulo, resp: 'Equipe', status: 'Pendente', criadoPor: user.nome, criadoEm: admin.database.ServerValue.TIMESTAMP, origem: 'WhatsApp' });
      await tarefasRef.set(lista);
      await responderWhatsApp(From, `✅ Tarefa criada: ${dados.tarefa.titulo} na obra ${obraMatch.nome}`);

    } else if (dados.intencao === 'lancar_ponto') {
      const obraMatch = await buscarObra();
      if (!obraMatch) { await responderWhatsApp(From, `Obra "${dados.ponto?.obra_nome}" não identificada.`); return; }

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

        novos.push({
          data: dataLanc, obra: obraMatch.cod || obraMatch._id, trab: trab.cod, nome: trab.nome,
          funcao: trab.funcao || '', vinculo: trab.vinculo || 'Informal', equipe: trab.equipe || '',
          entrada: '07:00', saida: statusP === 'Meio período' ? '12:00' : '17:00',
          hnorm, hextra: 0, presenca: statusP, diaria: parseFloat(trab.diaria) || 0, total: parseFloat(total),
          pgtoStatus: 'Pendente', valpago: 0, lancador: user.nome || 'WhatsApp Bot', 
          hrLanc: new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date()), 
          origem: 'WhatsApp', telefoneAutor: telefone, _s: statusP
        });
      }

      if (novos.length > 0) {
        await presencaRef.transaction((current) => {
          let lista = Array.isArray(current) ? current : Object.values(current || {});
          for (const n of novos) {
            const idx = lista.findIndex(p => p && p.data === n.data && p.trab === n.trab && p.obra === n.obra);
            const { _s, ...final } = n;
            if (idx === -1) {
              lista.push(final);
              resultados.push(`✅ ${n.nome} — ${_s}`);
            } else {
              lista[idx] = { ...lista[idx], ...final };
              resultados.push(`🔄 ${n.nome} atualizado para ${_s}`);
            }
          }
          return lista;
        });
      }
      const dataFmt = formatarDataBR(dataLanc);
      await responderWhatsApp(From, `📋 Ponto — ${obraMatch.nome} — ${dataFmt}:\n${resultados.join('\n')}`);
    }
  } catch (err) {
    console.error('Erro:', err);
    await responderWhatsApp(From, 'Erro no servidor.');
  }
});

async function responderWhatsApp(para, msg) {
  const sid = TWILIO_SID.value();
  const token = TWILIO_TOKEN.value();
  let from = TWILIO_WHATSAPP_FROM.value();
  if (from && !from.startsWith('whatsapp:')) from = `whatsapp:${from}`;
  if (!sid || !token || !from) return;
  try { await axios.post(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, new URLSearchParams({ To: para, From: from, Body: msg }), { auth: { username: sid, password: token } }); } catch (e) { console.error('Erro Twilio:', e.message); }
}
