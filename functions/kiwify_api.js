/**
 * functions/kiwify_api.js
 * Cliente somente leitura da API pública da Kiwify, usado pelo painel master.
 *
 * Documentação: https://docs.kiwify.com.br/api-reference/general
 * Base: https://public-api.kiwify.com/v1
 * Autenticação: POST /oauth/token (client_id/client_secret) -> Bearer token,
 *               header obrigatório x-kiwify-account-id.
 *
 * Este módulo não conhece Firebase:(db/auth ficam em super_admin.js), o que o
 * mantém testável. Nenhum segredo é devolvido ao navegador.
 */

const { planoPorProduto } = require('./plan_catalog');

const BASE_URL = 'https://public-api.kiwify.com/v1';
const MAX_DIAS_VENDAS = 90;
const MS_DIA = 24 * 60 * 60 * 1000;

const RECURSOS = {
  account: { path: '/account-details', params: [] },
  products: { path: '/products', params: ['page_size', 'page_number'] },
  sales: {
    path: '/sales',
    params: ['start_date', 'end_date', 'page_size', 'page_number', 'status', 'product_id', 'payment_method']
  },
  webhooks: { path: '/webhooks', params: ['page_size', 'page_number'] }
};

function erroKiwify(status, message, code) {
  const e = new Error(message);
  e.status = status;
  e.code = code || 'kiwify_erro';
  return e;
}

function credenciaisKiwify({ clientId, clientSecret, accountId, apiToken } = {}) {
  const id = String(accountId || '').trim();
  const token = String(apiToken || '').trim();
  const temOAuth = Boolean(String(clientId || '').trim() && String(clientSecret || '').trim());
  return {
    configurado: Boolean(id && (token || temOAuth)),
    modo: token ? 'token' : (temOAuth ? 'oauth' : 'nao_configurado'),
    clientId: String(clientId || '').trim(),
    clientSecret: String(clientSecret || '').trim(),
    accountId: id,
    apiToken: token
  };
}

function isoData(dt) {
  return (dt instanceof Date ? dt : new Date(dt)).toISOString();
}

/** Intervalo padrão (últimos 30 dias) respeitando o limite de 90 dias da Kiwify. */
function intervaloVendas(params = {}, agora = Date.now()) {
  let fim = params.end_date ? new Date(params.end_date) : new Date(agora);
  let inicio = params.start_date
    ? new Date(params.start_date)
    : new Date(agora - 30 * MS_DIA);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
    throw erroKiwify(400, 'Datas de início/fim inválidas.', 'kiwify_datas_invalidas');
  }
  if (fim < inicio) {
    throw erroKiwify(400, 'A data final deve ser maior que a inicial.', 'kiwify_datas_invalidas');
  }
  if (fim.getTime() - inicio.getTime() > MAX_DIAS_VENDAS * MS_DIA) {
    inicio = new Date(fim.getTime() - MAX_DIAS_VENDAS * MS_DIA);
  }
  return { start_date: isoData(inicio), end_date: isoData(fim) };
}

async function obterTokenKiwify({ credenciais, http, cache, agora = Date.now() }) {
  if (!credenciais.configurado) return null;
  if (credenciais.apiToken) return credenciais.apiToken;
  if (cache && cache.token && cache.expiraEm && cache.expiraEm > agora + 5 * 60 * 1000) {
    return cache.token;
  }

  const corpo = new URLSearchParams({
    client_id: credenciais.clientId,
    client_secret: credenciais.clientSecret
  }).toString();

  let resposta;
  try {
    resposta = await http.post(`${BASE_URL}/oauth/token`, corpo, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    });
  } catch (err) {
    console.error('[KiwifyAPI] Falha ao gerar token OAuth:', err.message || err);
    throw erroKiwify(502, 'Não foi possível autenticar na Kiwify.', 'kiwify_auth_falhou');
  }

  const token = resposta && resposta.data && resposta.data.access_token;
  if (!token) {
    throw erroKiwify(502, 'A Kiwify não devolveu um token de acesso.', 'kiwify_sem_token');
  }

  if (cache) {
    const segundos = Number(resposta.data.expires_in) || 86400;
    cache.token = token;
    cache.expiraEm = agora + segundos * 1000;
  }
  return token;
}

function extrairReferenciaVenda(venda) {
  const tracking = (venda && venda.tracking) || {};
  return String(
    tracking.src ||
    tracking.sck ||
    tracking.utm_source ||
    venda?.external_reference ||
    venda?.reference ||
    ''
  ).trim();
}

function normalizarProdutoKiwify(produto) {
  const p = produto || {};
  const nome = String(p.name || p.product_name || '');
  const anual = /anual|yearly/i.test(nome);
  const plano = planoPorProduto(nome, anual);
  const preco = Number(p.price);
  return {
    id: p.id || null,
    nome,
    status: p.status || null,
    tipo: p.type || null,
    recorrencia: p.payment_type || null,
    moeda: p.currency || 'BRL',
    preco: Number.isFinite(preco) ? preco / 100 : null,
    precoExibicao: plano.preco,
    criadoEm: p.created_at || null,
    planoLocal: plano.id,
    planoNome: plano.nome,
    checkout: plano.checkout,
    limites: plano.limites
  };
}

function normalizarVendaKiwify(venda) {
  const v = venda || {};
  const nomeProduto = String(v.product?.name || v.product_name || '');
  const anual = /anual|yearly/i.test(nomeProduto);
  const plano = planoPorProduto(nomeProduto, anual);
  const valorCentavos = Number(v.payment?.charge_amount);
  const cliente = v.customer || {};
  return {
    id: v.id || null,
    referencia: extrairReferenciaVenda(v),
    status: v.status || null,
    criadoEm: v.created_at || null,
    atualizadoEm: v.updated_at || null,
    produtoId: v.product?.id || null,
    produtoNome: nomeProduto,
    planoLocal: plano.id,
    valor: Number.isFinite(valorCentavos) ? valorCentavos / 100 : (v.net_amount ?? null),
    moeda: v.currency || 'BRL',
    metodoPagamento: v.payment_method || null,
    clienteNome: cliente.name || null,
    clienteEmail: String(cliente.email || '').trim().toLowerCase() || null,
    tenantRef: extrairReferenciaVenda(v)
  };
}

function normalizarContaKiwify(conta) {
  const c = conta || {};
  return {
    id: c.id || null,
    nomeEmpresa: c.company_name || null,
    entidades: (Array.isArray(c.legal_entities) ? c.legal_entities : []).map((e) => ({
      id: e.id || null,
      ativa: Boolean(e.active),
      nomeEmpresa: e.company_name || null
    }))
  };
}

/**
 * Consulta um recurso da API da Kiwify.
 * @returns {Promise<{configurado:boolean, recurso:string, data:Array|Object, pagination:Object|null}>}
 */
async function consultarKiwify({ recurso, params = {}, credenciais, http, cache, agora = Date.now() }) {
  const config = credenciais || credenciaisKiwify();
  if (!config.configurado) {
    return {
      configurado: false,
      recurso,
      data: [],
      pagination: null,
      mensagem: 'Credenciais da API Kiwify não configuradas (KIWIFY_CLIENT_ID / KIWIFY_CLIENT_SECRET / KIWIFY_ACCOUNT_ID).'
    };
  }

  const definition = RECURSOS[recurso];
  if (!definition) {
    throw erroKiwify(400, `Recurso Kiwify desconhecido: ${recurso}`, 'kiwify_recurso_invalido');
  }

  const token = await obterTokenKiwify({ credenciais: config, http, cache, agora });
  const headers = {
    Authorization: `Bearer ${token}`,
    'x-kiwify-account-id': config.accountId,
    Accept: 'application/json'
  };

  const query = new URLSearchParams();
  for (const nome of definition.params) {
    if (params[nome] != null && String(params[nome]).trim() !== '') {
      query.set(nome, String(params[nome]).trim());
    }
  }
  if (recurso === 'sales') {
    const periodo = intervaloVendas(params, agora);
    query.set('start_date', periodo.start_date);
    query.set('end_date', periodo.end_date);
  }
  if (recurso === 'products' && !query.has('page_size')) query.set('page_size', '100');

  const url = `${BASE_URL}${definition.path}${query.toString() ? `?${query.toString()}` : ''}`;

  let resposta;
  try {
    resposta = await http.get(url, { headers, timeout: 15000 });
  } catch (err) {
    const statusUpstream = err?.response?.status;
    console.error('[KiwifyAPI] Falha na consulta:', recurso, statusUpstream || err.message || err);
    if (statusUpstream === 401 || statusUpstream === 403) {
      throw erroKiwify(502, 'Credenciais da Kiwify inválidas ou sem escopo.', 'kiwify_nao_autorizado');
    }
    if (statusUpstream === 429) {
      throw erroKiwify(429, 'Limite de requisições da Kiwify atingido. Tente novamente em instantes.', 'kiwify_rate_limit');
    }
    throw erroKiwify(502, 'Não foi possível consultar a Kiwify.', 'kiwify_consulta_falhou');
  }

  const corpo = (resposta && resposta.data) || {};
  const bruto = Array.isArray(corpo.data) ? corpo.data : [];
  let data;

  if (recurso === 'products') data = bruto.map(normalizarProdutoKiwify);
  else if (recurso === 'sales') data = bruto.map(normalizarVendaKiwify);
  else if (recurso === 'account') data = normalizarContaKiwify(corpo);
  else data = bruto;

  return {
    configurado: true,
    recurso,
    data,
    pagination: corpo.pagination || null
  };
}

module.exports = {
  BASE_URL,
  credenciaisKiwify,
  intervaloVendas,
  obterTokenKiwify,
  extrairReferenciaVenda,
  normalizarProdutoKiwify,
  normalizarVendaKiwify,
  normalizarContaKiwify,
  consultarKiwify
};
