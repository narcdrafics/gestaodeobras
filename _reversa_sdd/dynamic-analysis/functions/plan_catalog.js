/**
 * functions/plan_catalog.js
 * Catálogo canônico de planos usado pelo painel super admin, pelo webhook da
 * Kiwify e pelo enforcement de limites.
 *
 * A matriz de permissões (features) continua em plan_features.js; aqui ficam
 * apenas limites, validade e vínculo com os produtos/checkouts da Kiwify.
 */

const MS_DIA = 24 * 60 * 60 * 1000;
const ILIMITADO = 9999;

const CHECKOUT = {
  start: 'https://pay.kiwify.com.br/hHQz2Zu',
  pro: 'https://pay.kiwify.com.br/d0Gfv34',
  ilimitado: 'https://pay.kiwify.com.br/z2hLFKq'
};

/**
 * @typedef {Object} PlanoCatalogo
 * @property {string} id
 * @property {string} nome
 * @property {{obras:number, usuarios:number, trabalhadores:number}} limites
 * @property {number} dias - validade padrão concedida pelo painel
 * @property {string|null} checkout
 * @property {string} preco - exibição apenas
 * @property {string} familia - start | pro | ilimitado | trial | sistema
 */

const PLANOS = {
  free_trial: {
    id: 'free_trial', nome: 'Teste grátis', familia: 'trial', dias: 30,
    limites: { obras: 1, usuarios: 1, trabalhadores: ILIMITADO },
    checkout: null, preco: 'Grátis'
  },
  start: {
    id: 'start', nome: 'Start', familia: 'start', dias: 31,
    limites: { obras: 2, usuarios: 2, trabalhadores: ILIMITADO },
    checkout: CHECKOUT.start, preco: 'R$ 69,90'
  },
  start_anual: {
    id: 'start_anual', nome: 'Start Anual', familia: 'start', dias: 365,
    limites: { obras: 2, usuarios: 2, trabalhadores: ILIMITADO },
    checkout: CHECKOUT.start, preco: 'Anual'
  },
  pro: {
    id: 'pro', nome: 'Pro', familia: 'pro', dias: 31,
    limites: { obras: 5, usuarios: 5, trabalhadores: ILIMITADO },
    checkout: CHECKOUT.pro, preco: 'R$ 105,90'
  },
  pro_anual: {
    id: 'pro_anual', nome: 'Pro Anual', familia: 'pro', dias: 365,
    limites: { obras: 5, usuarios: 5, trabalhadores: ILIMITADO },
    checkout: CHECKOUT.pro, preco: 'Anual'
  },
  premium: {
    id: 'premium', nome: 'Premium Pro', familia: 'pro', dias: 31,
    limites: { obras: 5, usuarios: 5, trabalhadores: ILIMITADO },
    checkout: CHECKOUT.pro, preco: 'R$ 105,90'
  },
  ilimitado: {
    id: 'ilimitado', nome: 'Ilimitado', familia: 'ilimitado', dias: 31,
    limites: { obras: ILIMITADO, usuarios: ILIMITADO, trabalhadores: ILIMITADO },
    checkout: CHECKOUT.ilimitado, preco: 'R$ 299,00'
  },
  ilimitado_anual: {
    id: 'ilimitado_anual', nome: 'Ilimitado Anual', familia: 'ilimitado', dias: 365,
    limites: { obras: ILIMITADO, usuarios: ILIMITADO, trabalhadores: ILIMITADO },
    checkout: CHECKOUT.ilimitado, preco: 'Anual'
  },
  full_anual: {
    id: 'full_anual', nome: 'Full Anual', familia: 'ilimitado', dias: 365,
    limites: { obras: ILIMITADO, usuarios: ILIMITADO, trabalhadores: ILIMITADO },
    checkout: CHECKOUT.ilimitado, preco: 'Anual'
  },
  master: {
    id: 'master', nome: 'Master', familia: 'ilimitado', dias: 3650,
    limites: { obras: ILIMITADO, usuarios: ILIMITADO, trabalhadores: ILIMITADO },
    checkout: CHECKOUT.ilimitado, preco: 'Sob consulta'
  },
  MASTER_SYSTEM: {
    id: 'MASTER_SYSTEM', nome: 'Master System', familia: 'sistema', dias: 3650,
    limites: { obras: ILIMITADO, usuarios: ILIMITADO, trabalhadores: ILIMITADO },
    checkout: null, preco: 'Interno'
  }
};

const ALIASES = {
  full: 'ilimitado',
  ilimitadoanual: 'ilimitado_anual',
  mastersystem: 'MASTER_SYSTEM',
  startanual: 'start_anual',
  proanual: 'pro_anual'
};

function normalizarPlanoAdmin(plano) {
  const bruto = String(plano || '').trim();
  if (Object.prototype.hasOwnProperty.call(PLANOS, bruto)) return bruto;
  const chave = bruto.replace(/[\s_-]/g, '').toLowerCase();
  if (ALIASES[chave]) return ALIASES[chave];
  const encontrado = Object.keys(PLANOS).find((p) =>
    p.replace(/[\s_-]/g, '').toLowerCase() === chave
  );
  return encontrado || null;
}

function planoPorProduto(nomeProduto, isYearly) {
  const nome = String(nomeProduto || '').toLowerCase();
  if (nome.includes('start')) return isYearly ? PLANOS.start_anual : PLANOS.start;
  if (nome.includes('ilimitado') || nome.includes('full') || nome.includes('master')) {
    return isYearly ? PLANOS.full_anual : PLANOS.ilimitado;
  }
  return isYearly ? PLANOS.pro_anual : PLANOS.pro;
}

function normalizarLimite(valor, padrao, maximo = ILIMITADO) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return padrao;
  return Math.min(Math.floor(n), maximo);
}

/**
 * Mescla os limites do plano com ajustes manuais do super admin.
 * Nunca aceita 0/negativo/NaN (isso deixaria a conta inutilizável).
 */
function limitesDoPlano(plano, ajustes = {}) {
  const basico = PLANOS[normalizarPlanoAdmin(plano) || 'free_trial'].limites;
  const entrada = ajustes && typeof ajustes === 'object' ? ajustes : {};
  const campos = ['obras', 'usuarios', 'trabalhadores'];
  const limites = {};
  for (const campo of campos) {
    limites[campo] = normalizarLimite(
      entrada[campo] == null ? basico[campo] : entrada[campo],
      basico[campo]
    );
  }
  return limites;
}

function diasDoPlano(plano, diasSolicitados) {
  const padrao = PLANOS[normalizarPlanoAdmin(plano) || 'free_trial'].dias;
  return normalizarLimite(diasSolicitados, padrao, 3650);
}

function checkoutDoPlano(plano) {
  const id = normalizarPlanoAdmin(plano);
  return id ? PLANOS[id].checkout : null;
}

module.exports = {
  MS_DIA,
  ILIMITADO,
  CHECKOUT,
  PLANOS,
  normalizarPlanoAdmin,
  planoPorProduto,
  normalizarLimite,
  limitesDoPlano,
  diasDoPlano,
  checkoutDoPlano
};
