/**
 * functions/retencao.js
 * Limpeza programada dos nós temporários criados pelos controles de segurança.
 *
 * Sem isso, rate_limits/whatsapp_messages/admin_ops cresceriam para sempre e
 * admin_audit reteria PII/UA por tempo indeterminado. O job roda diário e só
 * apaga o que passou do prazo; uma falha em qualquer nó não impede os demais.
 */
'use strict';

const RETENCAO = {
  admin_audit: 90 * 24 * 60 * 60 * 1000,   // 90 dias (trilha de auditoria)
  admin_ops: 24 * 60 * 60 * 1000,          // 24h (idempotência de ações)
  whatsapp_messages: 24 * 60 * 60 * 1000,  // 24h (dedup de mensagens)
  rate_limits: 2 * 60 * 60 * 1000          // janelas expiradas
};

function campoNode(nome) {
  if (nome === 'admin_audit') return 'timestamp';
  if (nome === 'admin_ops') return 'reservadoEm';
  if (nome === 'whatsapp_messages') return 'recebidaEm';
  return 'expiraEm';
}

async function limparNo(db, nome, agora) {
  const limite = RETENCAO[nome];
  const snap = await db.ref(nome).once('value');
  const dados = (snap && snap.val()) || null;
  if (!dados || typeof dados !== 'object') return 0;

  const campo = campoNode(nome);
  const atualizacoes = {};
  for (const [chave, valor] of Object.entries(dados)) {
    const filhos = nome === 'rate_limits' && valor && typeof valor === 'object'
      ? Object.entries(valor)
      : [[chave, valor]];
    for (const [subchave, registro] of filhos) {
      const bruto = registro && typeof registro === 'object' ? registro[campo] : null;
      const instante = Number(bruto);
      if (!Number.isFinite(instante) || instante <= 0) continue;
      // rate_limits guarda expiraEm (já é o prazo); os demais guardam criação.
      const vencido = nome === 'rate_limits' ? instante < agora : (agora - instante) > limite;
      if (vencido) {
        atualizacoes[nome === 'rate_limits' ? `${chave}/${subchave}` : chave] = null;
      }
    }
  }
  const total = Object.keys(atualizacoes).length;
  if (!total) return 0;
  await db.ref(nome).update(atualizacoes);
  return total;
}

async function executarLimpeza(db, agora = Date.now()) {
  const resumo = {};
  for (const nome of Object.keys(RETENCAO)) {
    try {
      resumo[nome] = await limparNo(db, nome, agora);
    } catch (e) {
      resumo[nome] = -1;
      console.error(`[Retencao] Falha ao limpar ${nome}:`, e && (e.message || e));
    }
  }
  console.log('[Retencao] Resumo:', JSON.stringify(resumo));
  return resumo;
}

module.exports = { RETENCAO, executarLimpeza };
