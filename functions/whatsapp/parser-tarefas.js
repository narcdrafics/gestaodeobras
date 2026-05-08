const admin = require('firebase-admin');
const { extrairTarefas, detectarEtapas } = require('./obra-etapas');

async function handleAudioTarefas(transcricao, tenantId, from) {
  const tarefas = extrairTarefas(transcricao);

  if (!tarefas.length) {
    return {
      response: `🎤 Ouvi: _"${transcricao}"_\n\n❓ Não identifiquei tarefas. Tente ser mais específico.\n\nExemplo: _"fazer reboco no quarto 2, instalar tubos de esgoto no banheiro"_`
    };
  }

  const db = admin.database();
  await db.ref(`tenants/${tenantId}/tarefas_pendentes/${from}`).set({
    transcricao,
    tarefas,
    timestamp: Date.now()
  });

  return {
    response: buildConfirmacaoPreview(transcricao, tarefas)
  };
}

function buildConfirmacaoPreview(transcricao, tarefas) {
  const linhas = tarefas.map((t, i) => {
    const etapaLabel = t.etapa ? `📂 ${t.etapa}` : `⚠️ Etapa não identificada`;
    const confiancaIcon = { alta: '🟢', media: '🟡', baixa: '🔴' }[t.confianca] || '⚪';
    return `${i + 1}. ${confiancaIcon} *${t.titulo}*\n   ${etapaLabel}`;
  }).join('\n\n');

  const semEtapa = tarefas.filter(t => !t.etapa).length;
  const aviso = semEtapa > 0 ? `\n\n⚠️ ${semEtapa} tarefa(s) com etapa não identificada — serão salvas para revisão.` : '';

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

async function confirmarTarefas(tenantId, from, prazo = null, responsavel = null) {
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
      prazo,
      responsavel,
     createdEm: hoje,
      createdPor: from
    });
    tarefasSalvas.push(tarefa.titulo);
  }

  await db.ref(`tenants/${tenantId}/tarefas_pendentes/${from}`).remove();

  const lista = tarefasSalvas.map((t, i) => `${i + 1}. ${t}`).join('\n');
  return {
    response: `✅ *${tarefasSalvas.length} tarefa(s) salva(s):*\n\n${lista}\n\nDigite *TAREFA lista* para ver todas as tarefas abertas.`
  };
}

async function editarTarefaPendente(texto, tenantId, from) {
  const match = texto.match(/^EDITAR (\d+) (.+)$/i);
  if (!match) return { response: '❓ Use: *EDITAR [número] [nova descrição]*\nEx: EDITAR 2 reboco no quarto 3' };

  const [, numStr, novaDescricao] = match;
  const idx = parseInt(numStr) - 1;

  const db = admin.database();
  const pendingRef = db.ref(`tenants/${tenantId}/tarefas_pendentes/${from}`);
  const pendingSnap = await pendingRef.once('value');
  const pending = pendingSnap.val();

  if (!pending || !pending.tarefas[idx]) {
    return { response: `❓ Tarefa número ${numStr} não encontrada. Verifique a lista.` };
  }

  const etapasDetectadas = detectarEtapas(novaDescricao);
  const etapa = etapasDetectadas[0] || null;

  pending.tarefas[idx] = {
    ...pending.tarefas[idx],
    titulo: novaDescricao,
    etapa: etapa?.etapa || null,
    etapaCodigo: etapa?.codigo || null,
    termosDetectados: etapa?.termos || [],
    confianca: etapa ? (etapa.score >= 3 ? 'alta' : 'media') : 'baixa'
  };

  await pendingRef.set(pending);
  return { response: buildConfirmacaoPreview(pending.transcricao, pending.tarefas) };
}

async function cancelarTarefas(tenantId, from) {
  const db = admin.database();
  await db.ref(`tenants/${tenantId}/tarefas_pendentes/${from}`).remove();
  return { response: '❌ Tarefas descartadas.' };
}

module.exports = {
  handleAudioTarefas,
  confirmarTarefas,
  editarTarefaPendente,
  cancelarTarefas,
  buildConfirmacaoPreview
};