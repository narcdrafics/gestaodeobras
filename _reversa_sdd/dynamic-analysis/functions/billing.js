/**
 * functions/billing.js
 * Módulo de gestão de ciclo de vida e cobrança SaaS (Server-Side Billing Enforcement)
 *
 * Estados de Cobrança (billingState):
 *  - 'ativo': Acesso total (leitura e escrita).
 *  - 'carencia': Tolerância de 3 a 5 dias para planos pagos com renovação pendente
 *                (leitura e escrita liberadas, com alerta na UI).
 *  - 'somente_leitura': Trial expirado (7 dias) ou plano pago com carência esgotada
 *                       (7 dias adicionais). Leitura permitida; escritas bloqueadas
 *                       no servidor (database.rules.json).
 *  - 'bloqueado': Prazo esgotado ou bloqueio forçado (chargeback/reembolso).
 *                 Leitura e escrita negadas no servidor, exceto o próprio
 *                 billingState, que precisa ser legível para exibir a tela de bloqueio.
 */

const MS_DIA = 24 * 60 * 60 * 1000;
const TRIAL_READONLY_DAYS = 7;  // Dias de somente leitura após o trial
const PAID_GRACE_DAYS = 5;      // Carência padrão pós-vencimento do plano pago
const PAID_READONLY_DAYS = 7;   // Dias de somente leitura após esgotada a carência

/**
 * Calcula o billingState de um tenant com base em plano, datas e status.
 * Função pura e determinística para facilitar testes unitários.
 *
 * Regras de precedência:
 *  1. MASTER_SYSTEM nunca é bloqueado (o id do tenant é passado pelo job).
 *  2. Bloqueios forçados (chargeback/reembolso/suspensão manual) são imediatos.
 *  3. Trial: 30 dias ativos + 7 dias somente leitura + bloqueio.
 *  4. Pago: carência (3 ou 5 dias, conforme carenciaAte do webhook) + 7 dias
 *     somente leitura + bloqueio. `carenciaAte` tem precedência sobre a regra
 *     genérica de 5 dias porque o webhook registra 3 dias em cancelamentos.
 *
 * @param {Object} tenantData - Dados do tenant (nó tenants/{id})
 * @param {number} agora - Timestamp atual em ms (padrão Date.now())
 * @param {string|null} tenantId - Chave do tenant, usada para identificar o MASTER_SYSTEM
 * @returns {{ billingState: 'ativo'|'carencia'|'somente_leitura'|'bloqueado', motivo: string, diasRestantes?: number }}
 */
function calcularBillingState(tenantData, agora = Date.now(), tenantId = null) {
  const t = tenantData && typeof tenantData === 'object' ? tenantData : {};
  const tid = tenantId || t.tenantId || '';

  // 1. Tenants do sistema interno (painel master) nunca entram em cobrança.
  if (tid === 'MASTER_SYSTEM' || t.tenantId === 'MASTER_SYSTEM' || t.role === 'super_admin') {
    return { billingState: 'ativo', motivo: 'master_system' };
  }

  // 2. Bloqueio imediato forçado (Chargeback, Reembolso ou Suspensão Manual).
  if (t.status === 'bloqueado_pagamento' || t.status === 'bloqueado') {
    return {
      billingState: 'bloqueado',
      motivo: t.motivoBloqueio || t.billingStateMotivo || 'bloqueio_manual'
    };
  }

  const plano = t.plano || 'free_trial';

  // 3. Ciclo de Vida: Free Trial (30 dias + 7 dias de leitura).
  if (plano === 'free_trial') {
    const trialExpiracao = Number(t.trialExpiracao) ||
      ((Number(t.webhookCriacao) || agora) + (30 * MS_DIA));
    const msRestantes = trialExpiracao - agora;

    if (msRestantes > 0) {
      return {
        billingState: 'ativo',
        motivo: 'trial_vigente',
        diasRestantes: Math.ceil(msRestantes / MS_DIA)
      };
    }

    const msAposVencimento = agora - trialExpiracao;
    if (msAposVencimento <= (TRIAL_READONLY_DAYS * MS_DIA)) {
      return {
        billingState: 'somente_leitura',
        motivo: 'trial_expirado',
        diasRestantes: Math.max(0, Math.ceil(((TRIAL_READONLY_DAYS * MS_DIA) - msAposVencimento) / MS_DIA))
      };
    }

    return { billingState: 'bloqueado', motivo: 'trial_encerrado' };
  }

  // 4. Ciclo de Vida: Planos Pagos.
  const vencimento = Number(t.planoVencimento) || 0;
  const carenciaAte = Number(t.carenciaAte) || 0;

  // `carenciaAte` é gravado pelo webhook (3 dias no cancelamento, 5 na falha de
  // renovação). Um valor antigo e inconsistente não pode bloquear um plano vigente.
  const carenciaValida = carenciaAte > 0 &&
    (carenciaAte > agora || (vencimento > 0 && agora >= vencimento));

  if (carenciaValida) {
    if (agora <= carenciaAte) {
      return {
        billingState: 'carencia',
        motivo: 'carencia_webhook',
        diasRestantes: Math.max(0, Math.ceil((carenciaAte - agora) / MS_DIA))
      };
    }
  } else {
    // Sem data de vencimento confiável, não bloqueie o acesso por segurança.
    if (vencimento <= 0) {
      return { billingState: 'ativo', motivo: 'sem_vencimento' };
    }
    if (agora < vencimento) {
      return {
        billingState: 'ativo',
        motivo: 'plano_vigente',
        diasRestantes: Math.ceil((vencimento - agora) / MS_DIA)
      };
    }
    if (agora <= vencimento + (PAID_GRACE_DAYS * MS_DIA)) {
      return {
        billingState: 'carencia',
        motivo: 'vencido_em_carencia',
        diasRestantes: Math.max(0, Math.ceil((vencimento + (PAID_GRACE_DAYS * MS_DIA) - agora) / MS_DIA))
      };
    }
  }

  // Carência esgotada: janela de somente leitura e, depois, bloqueio total.
  const inicioReadOnly = carenciaValida
    ? carenciaAte
    : vencimento + (PAID_GRACE_DAYS * MS_DIA);
  const fimReadOnly = inicioReadOnly + (PAID_READONLY_DAYS * MS_DIA);

  if (agora <= fimReadOnly) {
    return {
      billingState: 'somente_leitura',
      motivo: 'carencia_expirada',
      diasRestantes: Math.max(0, Math.ceil((fimReadOnly - agora) / MS_DIA))
    };
  }

  return { billingState: 'bloqueado', motivo: 'inadimplente' };
}

/**
 * Job diário que analisa todos os tenants no RTDB e atualiza billingState quando necessário.
 * @param {Object} db - Instância do Firebase Realtime Database (Admin SDK)
 * @param {number} agora - Timestamp atual em ms
 * @returns {Promise<{ total: number, alterados: number, updates: Object }>}
 */
async function atualizarBillingStatesJob(db, agora = Date.now()) {
  const snap = await db.ref('tenants').once('value');
  const tenants = snap.val() || {};
  const updates = {};
  let alterados = 0;
  const total = Object.keys(tenants).length;

  for (const [tid, tData] of Object.entries(tenants)) {
    if (!tData || typeof tData !== 'object') continue;

    // O id da chave é a fonte confiável para identificar o MASTER_SYSTEM.
    const calculo = calcularBillingState(tData, agora, tid);
    const estadoAtual = tData.billingState || 'ativo';

    if (estadoAtual !== calculo.billingState) {
      updates[`tenants/${tid}/billingState`] = calculo.billingState;
      updates[`tenants/${tid}/billingStateMotivo`] = calculo.motivo;
      updates[`tenants/${tid}/billingStateAtualizadoEm`] = agora;
      alterados++;

      console.log(`[BillingJob] Tenant ${tid} transição: ${estadoAtual} -> ${calculo.billingState} (${calculo.motivo})`);
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.ref().update(updates);
  }

  console.log(`[BillingJob] Concluído: ${alterados}/${total} tenants atualizados.`);
  return { total, alterados, updates };
}

module.exports = {
  calcularBillingState,
  atualizarBillingStatesJob,
  TRIAL_READONLY_DAYS,
  PAID_GRACE_DAYS,
  PAID_READONLY_DAYS,
  MS_DIA
};
