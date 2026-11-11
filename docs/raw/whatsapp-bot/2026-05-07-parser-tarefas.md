---
title: parser-tarefas.js
description: Parser de tarefas com suporte a áudio WhatsApp - integra com obra-etapas.js para detecção automática de etapas
url: local-file
collected: 2026-05-07
published: Unknown
---

// functions/whatsapp/parser-tarefas.js
// Extensão do parser.js — lida com áudio e criação preemptiva de tarefas
// Integra com obra-etapas.js para mapeamento semântico automático

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { extrairTarefas, detectarEtapas } = require('./obra-etapas');

const GRAPH_API = 'https://graph.facebook.com/v19.0';

/**
 * Transcreve áudio recebido via WhatsApp usando Whisper (OpenAI)
 * A Meta envia o áudio como mediaId — primeiro baixamos, depois transcrevemos
 */
async function transcreverAudio(mediaId) {
  const token = functions.config().meta.token;

  // 1. Obtém a URL real do arquivo de áudio
  const metaRes = await fetch(`${GRAPH_API}/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { url } = await metaRes.json();

  // 2. Baixa o arquivo de áudio
  const audioRes = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const audioBuffer = await audioRes.arrayBuffer();

  // 3. Envia para Whisper (OpenAI) para transcrição
  const openaiKey = functions.config().openai.key;
  const formData  = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'audio.ogg');
  formData.append('model', 'whisper-1');
  formData.append('language', 'pt');
  formData.append('response_format', 'text');

  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${openaiKey}` },
    body:    formData
  });

  const transcricao = await whisperRes.text();
  return transcricao.trim();
}

/**
 * Processa mensagem de áudio recebida via WhatsApp
 * Fluxo: áudio → transcrição → detecção de etapas → confirmação
 */
async function handleAudioTarefas(mediaId, tenant, from) {
  const { tenantId } = tenant;

  // Indica que está processando (áudio pode demorar alguns segundos)
  // (o sendMessage deve ser importado do sender.js no webhook.js)

  let transcricao;
  try {
    transcricao = await transcreverAudio(mediaId);
  } catch (err) {
    console.error('Erro na transcrição:', err);
    return {
      response: '❌ Não consegui transcrever o áudio. Tente novamente ou envie como texto.'
    };
  }

  // Extrai tarefas estruturadas com etapas detectadas
  const tarefas = extrairTarefas(transcricao);

  if (!tarefas.length) {
    return {
      response: `🎤 Ouvi: _"${transcricao}"_\n\n❓ Não identifiquei tarefas. Tente ser mais específico.\n\nExemplo: _"fazer reboco no quarto 2, instalar tubos de esgoto no banheiro"_`
    };
  }

  // Salva as tarefas pendentes de confirmação no Firebase (estado temporário)
  const db = admin.database();
  await db.ref(`tenants/${tenantId}/tarefas_pendentes/${from}`).set({
    transcricao,
    tarefas,
    timestamp: Date.now()
  });

  // Monta preview para o usuário confirmar
  return {
    response: buildConfirmacaoPreview(transcricao, tarefas)
  };
}

/**
 * Monta a mensagem de confirmação com as tarefas detectadas
 */
function buildConfirmacaoPreview(transcricao, tarefas) {
  const linhas = tarefas.map((t, i) => {
    const etapaLabel = t.etapa
      ? `📂 ${t.etapa}`
      : `⚠️ Etapa não identificada`;

    const confiancaIcon = {
      alta:  '🟢',
      media: '🟡',
      baixa: '🔴'
    }[t.confianca] || '⚪';

    return `${i + 1}. ${confiancaIcon} *${t.titulo}*\n   ${etapaLabel}`;
  }).join('\n\n');

  const semEtapa = tarefas.filter(t => !t.etapa).length;
  const aviso = semEtapa > 0
    ? `\n\n⚠️ ${semEtapa} tarefa(s) com etapa não identificada — serão salvas para revisão.`
    : '';

  return (
    `🎤 *Transcrição:*\n_"${transcricao}"_\n\n` +
    `📋 *Tarefas detectadas (${tarefas.length}):*\n\n` +
    linhas +
    aviso +
    `\n\n✅ Responda *CONFIRMAR* para salvar todas\n` +
    `✏️ Ou *EDITAR [número] [correção]* para ajustar\n` +
    `❌ Ou *CANCELAR* para descartar`
  );
}

/**
 * Confirma e salva as tarefas pendentes no Firebase definitivamente
 */
async function confirmarTarefas(tenant, from, prazo = null, responsavel = null) {
  const { tenantId } = tenant;
  const db = admin.database();

  const pendingSnap = await db.ref(`tenants/${tenantId}/tarefas_pendentes/${from}`).once('value');
  const pending = pendingSnap.val();

  if (!pending) {
    return { response: '❓ Nenhuma tarefa pendente de confirmação. Envie um áudio ou texto com as tarefas primeiro.' };
  }

  const hoje = new Date().toISOString().split('T')[0];
  const tarefasSalvas = [];

  for (const tarefa of pending.tarefas) {
    const novaRef = db.ref(`tenants/${tenantId}/tarefas`).push();
    await novaRef.set({
      ...tarefa,
      prazo:        prazo || null,
      responsavel:  responsavel || null,
      criadaEm:     hoje,
      criadaPor:    from
    });
    tarefasSalvas.push(tarefa.titulo);
  }

  // Remove pendentes
  await db.ref(`tenants/${tenantId}/tarefas_pendentes/${from}`).remove();

  const lista = tarefasSalvas.map((t, i) => `${i + 1}. ${t}`).join('\n');
  return {
    response: `✅ *${tarefasSalvas.length} tarefa(s) salva(s):*\n\n${lista}\n\nDigite *TAREFA lista* para ver todas as tarefas abertas.`
  };
}

/**
 * Edita uma tarefa pendente antes de confirmar
 * Ex: "EDITAR 2 instalar tubos de esgoto no banheiro social"
 */
async function editarTarefaPendente(texto, tenant, from) {
  const { tenantId } = tenant;
  const db = admin.database();

  const match = texto.match(/^EDITAR (\d+) (.+)$/i);
  if (!match) return { response: '❓ Use: *EDITAR [número] [nova descrição]*\nEx: EDITAR 2 reboco no quarto 3' };

  const [, numStr, novaDescricao] = match;
  const idx = parseInt(numStr) - 1;

  const pendingRef  = db.ref(`tenants/${tenantId}/tarefas_pendentes/${from}`);
  const pendingSnap = await pendingRef.once('value');
  const pending     = pendingSnap.val();

  if (!pending || !pending.tarefas[idx]) {
    return { response: `❓ Tarefa número ${numStr} não encontrada. Verifique a lista.` };
  }

  // Redetecta etapa na nova descrição
  const etapasDetectadas = detectarEtapas(novaDescricao);
  const etapa            = etapasDetectadas[0] || null;

  pending.tarefas[idx] = {
    ...pending.tarefas[idx],
    titulo:           novaDescricao,
    etapa:            etapa?.etapa       || null,
    etapaCodigo:      etapa?.codigo      || null,
    termosDetectados: etapa?.termos      || [],
    confianca:        etapa ? (etapa.score >= 3 ? 'alta' : 'media') : 'baixa'
  };

  await pendingRef.set(pending);

  return {
    response: buildConfirmacaoPreview(pending.transcricao, pending.tarefas)
  };
}

module.exports = {
  handleAudioTarefas,
  confirmarTarefas,
  editarTarefaPendente
};