// Aplicação de solicitações de aprovação (servidor).
//
// O cliente só pode criar a solicitação (status 'pendente') e, quando tem
// autoridade, mudar o status para 'aprovado'/'rejeitado'. Toda operação de
// verdade — mexer em estoque, pessoas, dinheiro ou compras — acontece AQUI,
// com Admin SDK (que ignora as rules do cliente).
//
// Contrato de idempotência:
//   1. `reservadoEm` é gravado numa transação no próprio nó da aprovação;
//      só a primeira execução consegue reservar.
//   2. A operação e `aplicadoEm` são gravados num único update multi-path
//      (atômico no Realtime Database), junto com auditoria e notificações.
//   3. Se algo falhar depois da reserva, o status vira 'erro' e o job diário
//      também reprocessa reservas órfãs.
//
// Os dados sensíveis das compras ficam em `comprasPrivadas/{tenantId}`, fora
// do tenant, porque uma rule de pai não pode revogar o .read de um filho.

'use strict';

const MS_DIA = 24 * 60 * 60 * 1000;
// Reserva mais antiga que isso pode ser órfã (processo morreu no meio da aplicação).
// O job diário pode retomá-la; chamadas normais nunca "roubam" uma reserva recente.
const RESERVA_STALE_MS = 10 * 60 * 1000;
const PRAZO_APROVACAO_DIAS = 15;
const DIAS_ALERTA = [7, 12, 15];
const ADMIN_ROLES = new Set(['admin', 'super_admin']);
const STATUS_PAGAMENTO = new Set(['Pago', 'Parcial', 'Pendente', 'Atrasado']);
const CAMPOS_COMPRAS_PRIVADOS = ['forn', 'pixkey', 'vunit', 'vtotal', 'vorc', 'prazo'];

const TIPOS_APROVACAO = new Set([
  'movimentacao_estoque',
  'trabalhador_add',
  'trabalhador_remove',
  'financeiro_lancamento',
  'financeiro_status',
  'orcamento_fechamento',
  'compra_criacao',
  'medicao_fechamento'
]);

// ==================== FUNÇÕES PURAS (testáveis) ====================

function normalizarRole(role) {
  return role === 'mestre' ? 'encarregado' : (role || '');
}

function ehAdmin(role) {
  return ADMIN_ROLES.has(normalizarRole(role));
}

function diasDecorridos(solicitadoEm, agora) {
  const inicio = Number(solicitadoEm);
  if (!Number.isFinite(inicio)) return -1;
  return Math.floor((Number(agora) - inicio) / MS_DIA);
}

/** Alertos devidos (7, 12 e expiração em 15 dias) que ainda não foram gravados. */
function alertasDevidos(aprovacao, agora) {
  if (!aprovacao || aprovacao.status !== 'pendente') return [];
  const decorridos = diasDecorridos(aprovacao.solicitadoEm, agora);
  if (decorridos < 0) return [];
  const existentes = aprovacao.alertas || {};
  return DIAS_ALERTA.filter(dia => decorridos >= dia && !existentes[String(dia)]);
}

function deveExpirar(aprovacao, agora) {
  if (!aprovacao || aprovacao.status !== 'pendente') return false;
  const expiraEm = Number(aprovacao.expiraEm);
  return Number.isFinite(expiraEm) && Number(agora) >= expiraEm;
}

/** Engenheiro só decide movimentação de estoque e é obrigado a avisar o admin. */
function papelPodeDecidir(papel, aprovacao) {
  const role = normalizarRole(papel);
  if (ehAdmin(role)) return true;
  return role === 'engenheiro'
    && aprovacao.tipo === 'movimentacao_estoque'
    && aprovacao.notificarAdmin === true;
}

/** Revalidação no servidor antes de aplicar (as rules já filtram o cliente). */
function podeAplicar(aprovacao, agora) {
  if (!aprovacao || aprovacao.status !== 'aprovado') {
    return { ok: false, motivo: 'status_invalido' };
  }
  // `deveExpirar()` só vale para pendentes; aqui a solicitação já está aprovada,
  // então comparamos o prazo diretamente (não se aplica nada depois de 15 dias).
  const expiraEm = Number(aprovacao.expiraEm);
  const vencida = Number.isFinite(expiraEm) && Number(agora) >= expiraEm;
  if (aprovacao.expiradoEm || vencida) {
    return { ok: false, motivo: 'expirada' };
  }
  if (!TIPOS_APROVACAO.has(aprovacao.tipo)) {
    return { ok: false, motivo: 'tipo_invalido' };
  }
  if (!aprovacao.payload || typeof aprovacao.payload !== 'object') {
    return { ok: false, motivo: 'sem_payload' };
  }
  if (!aprovacao.decididoPor) {
    return { ok: false, motivo: 'sem_decisor' };
  }
  if (!papelPodeDecidir(aprovacao.decididoPorPapel, aprovacao)) {
    return { ok: false, motivo: 'decisor_sem_autoridade' };
  }
  return { ok: true };
}

/**
 * Regras de integridade do financeiro (espelho reforçado do frontend).
 * 'Pago' → total; 'Pendente'/'Atrasado' → 0; 'Parcial' → valor informado.
 */
function validarIntegridadeFinanceira(lancamento) {
  const l = { ...(lancamento || {}) };
  const prev = Number(l.prev) || 0;
  const real = Number(l.real) || 0;
  const total = real > 0 ? real : prev;
  const status = String(l.status || '');
  if (!STATUS_PAGAMENTO.has(status)) throw new Error('status_pagamento_invalido');

  if (status === 'Pago') l.valpago = total;
  else if (status === 'Pendente' || status === 'Atrasado') l.valpago = 0;
  else {
    const informado = Number(l.valpago) || 0;
    l.valpago = Math.min(Math.max(informado, 0), total);
  }
  l.prev = prev;
  l.real = real;
  return l;
}

/** O DB do app usa arrays; o RTDB pode devolver objetos com chaves numéricas. */
function comoArray(colecao) {
  if (Array.isArray(colecao)) return [...colecao];
  if (!colecao || typeof colecao !== 'object') return [];
  return Object.keys(colecao)
    .filter(k => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b))
    .map(k => colecao[k]);
}

function proximoIndice(colecao) {
  const itens = comoArray(colecao);
  return itens.length;
}

function indiceValido(colecao, indice) {
  return Number.isInteger(indice) && indice >= 0 && indice < comoArray(colecao).length;
}

// ==================== CONSTRUÇÃO DOS EFEITOS ====================

function efeitosMovimentacao(payload, estado, base, agora) {
  const m = payload.movimentacao || payload;
  const codMat = String(m.codMat || m.cod || '').trim();
  const qtd = Number(m.qtd);
  if (!codMat || !Number.isFinite(qtd) || qtd <= 0) throw new Error('movimentacao_invalida');

  const estoque = comoArray(estado.estoque);
  const idx = estoque.findIndex(e => e && e.cod === codMat);
  if (idx < 0) throw new Error('material_inexistente');
  const origem = { ...estoque[idx] };
  const saldo = (Number(origem.entrada) || 0) - (Number(origem.saida) || 0);
  const tipo = String(m.tipo || '');

  const mov = {
    data: m.data || new Date(agora).toISOString().slice(0, 10),
    codMat,
    mat: m.mat || origem.mat || codMat,
    obra: m.obra || origem.obra || '',
    tipo, qtd,
    frente: m.frente || '',
    retirado: m.retirado || '',
    autor: m.autor || '',
    nf: m.nf || '',
    vunit: Number(m.vunit) || 0,
    vtotal: Number(m.vtotal) || 0,
    obs: m.obs || ''
  };

  const movimentos = [];
  let destinoApos = origem;

  if (tipo === 'Transferência') {
    const obraDestino = String(m.obraDestino || '').trim();
    if (!obraDestino || obraDestino === mov.obra) throw new Error('destino_invalido');
    if (qtd > saldo) throw new Error('saldo_insuficiente');

    estoque[idx] = { ...origem, saida: (Number(origem.saida) || 0) + qtd };
    destinoApos = estoque[idx];

    let idxDest = estoque.findIndex(e => e && e.obra === obraDestino
      && e.mat === origem.mat && e.unid === origem.unid);
    if (idxDest < 0) {
      estoque.push({
        cod: m.codDestino || `MAT-${agora}`,
        mat: origem.mat, unid: origem.unid, obra: obraDestino,
        min: Number(origem.min) || 0, entrada: 0, saida: 0,
        custo: Number(origem.custo) || 0, obs: 'Transferido.'
      });
      idxDest = estoque.length - 1;
    }
    estoque[idxDest] = {
      ...estoque[idxDest],
      entrada: (Number(estoque[idxDest].entrada) || 0) + qtd
    };

    movimentos.push({ ...mov, tipo: 'Transferência (Saída)', obs: `Destino: ${obraDestino}. ${mov.obs}` });
    movimentos.push({
      ...mov,
      tipo: 'Transferência (Entrada)',
      obra: obraDestino,
      codMat: estoque[idxDest].cod,
      obs: `Origem: ${mov.obra}. ${mov.obs}`
    });
  } else if (tipo === 'Entrada' || tipo === 'Retorno') {
    estoque[idx] = { ...origem, entrada: (Number(origem.entrada) || 0) + qtd };
    destinoApos = estoque[idx];
    movimentos.push(mov);
  } else if (tipo === 'Saída') {
    if (qtd > saldo) throw new Error('saldo_insuficiente');
    estoque[idx] = { ...origem, saida: (Number(origem.saida) || 0) + qtd };
    destinoApos = estoque[idx];
    movimentos.push(mov);
  } else {
    throw new Error('tipo_movimentacao_invalido');
  }

  const updates = { [`${base}/estoque`]: estoque };
  let prox = proximoIndice(estado.movEstoque);
  movimentos.forEach(mv => { updates[`${base}/movEstoque/${prox++}`] = mv; });

  return { updates, antes: origem, depois: destinoApos, resumo: `${tipo} de ${qtd} ${origem.unid || ''} — ${origem.mat}`.trim() };
}

function efeitosTrabalhadorAdd(payload, estado, base) {
  const t = payload.trabalhador || payload;
  const cod = String(t.cod || '').trim();
  const nome = String(t.nome || '').trim();
  if (!cod || !nome) throw new Error('trabalhador_invalido');
  const trabalhadores = comoArray(estado.trabalhadores);
  if (trabalhadores.some(x => x && x.cod === cod)) throw new Error('trabalhador_duplicado');
  const novo = { ...t, cod, nome };
  trabalhadores.push(novo);
  return {
    updates: { [`${base}/trabalhadores`]: trabalhadores },
    antes: null, depois: novo, resumo: `Inclusão de ${nome} (${cod})`
  };
}

function efeitosTrabalhadorRemove(payload, estado, base) {
  const cod = String(payload.cod || (payload.trabalhador && payload.trabalhador.cod) || '').trim();
  if (!cod) throw new Error('codigo_inexistente');
  const trabalhadores = comoArray(estado.trabalhadores);
  const idx = trabalhadores.findIndex(x => x && x.cod === cod);
  if (idx < 0) throw new Error('trabalhador_inexistente');
  const removido = trabalhadores[idx];
  trabalhadores.splice(idx, 1);
  return {
    updates: { [`${base}/trabalhadores`]: trabalhadores },
    antes: removido, depois: null, resumo: `Remoção de ${removido.nome || cod} (${cod})`
  };
}

function efeitosFinanceiroLancamento(payload, estado, base) {
  const l = payload.lancamento || payload;
  if (!l.obra || !String(l.desc || '').trim()) throw new Error('lancamento_invalido');
  const prev = Number(l.prev) || 0;
  const real = Number(l.real) || 0;
  if (prev <= 0 && real <= 0) throw new Error('valor_invalido');
  // Solicitação nunca nasce paga: o status só muda com outra aprovação.
  const financeiro = comoArray(estado.financeiro);
  const indice = Number(payload.indice);
  const editando = indiceValido(estado.financeiro, indice);
  const anterior = editando ? { ...financeiro[indice] } : null;
  const novo = validarIntegridadeFinanceira({
    ...(anterior || {}), ...l, prev, real, status: 'Pendente', valpago: 0
  });
  if (editando) financeiro[indice] = novo;
  else financeiro.push(novo);
  return {
    updates: { [`${base}/financeiro`]: financeiro },
    antes: anterior, depois: novo, resumo: `Lançamento ${novo.desc} — ${novo.obra}`
  };
}

function efeitosFinanceiroStatus(payload, estado, base) {
  const indice = Number(payload.indice);
  if (!indiceValido(estado.financeiro, indice)) throw new Error('lancamento_inexistente');
  const financeiro = comoArray(estado.financeiro);
  const antes = { ...financeiro[indice] };
  financeiro[indice] = validarIntegridadeFinanceira({
    ...antes, status: payload.status, valpago: payload.valpago
  });
  return {
    updates: { [`${base}/financeiro`]: financeiro },
    antes, depois: financeiro[indice],
    resumo: `${antes.desc || 'Lançamento'}: ${antes.status} → ${financeiro[indice].status}`
  };
}

function efeitosOrcamento(payload, estado, base, aprovacao, agora) {
  const indice = Number(payload.indice);
  // Engenheiro prepara itens novos; o admin aplica somente após decidir.
  const criando = payload.criar === true;
  if (!criando && !indiceValido(estado.orcamento, indice)) throw new Error('servico_inexistente');
  const orcamento = comoArray(estado.orcamento);
  const antes = criando ? null : { ...orcamento[indice] };
  const item = { ...(antes || {}), ...(payload.item || {}) };
  item.id = (antes && antes.id) || item.id || `SVC-${agora}`;
  item.qtd = Number(item.qtd) || 0;
  item.vunit = Number(item.vunit) || 0;
  item.vtotal = item.qtd * item.vunit;
  item.aprovacao = 'Aprovado';
  item.aprovadoPor = aprovacao.decididoPor;
  item.aprovadoEm = agora;
  if (criando) orcamento.push(item);
  else orcamento[indice] = item;
  return {
    updates: { [`${base}/orcamento`]: orcamento },
    antes, depois: item, resumo: `Fechamento de orçamento — ${item.desc || item.id || ''}`.trim()
  };
}

function efeitosCompra(payload, estado, base, tenantId, aprovacao, agora) {
  const c = { ...(payload.compra || {}) };
  const mat = String(c.mat || '').trim();
  const qtd = Number(c.qtd);
  if (!mat || !Number.isFinite(qtd) || qtd <= 0) throw new Error('compra_invalida');

  // Nunca gravar campo comercial no nó público (defesa em profundidade).
  CAMPOS_COMPRAS_PRIVADOS.forEach(campo => { delete c[campo]; });
  c.id = String(c.id || aprovacao.id || `CP-${agora}`);
  const compras = comoArray(estado.compras);
  compras.push(c);

  const privada = { ...(payload.compraPrivada || {}) };
  return {
    updates: {
      [`${base}/compras`]: compras,
      [`comprasPrivadas/${tenantId}/${c.id}`]: {
        ...privada,
        compraId: c.id,
        aprovacaoId: aprovacao.id,
        criadoEm: agora
      }
    },
    antes: null, depois: c,
    resumo: `Compra aprovada — ${mat} (${qtd} ${c.unid || ''})`.trim()
  };
}

function efeitosMedicao(payload, estado, base, aprovacao, agora) {
  const indice = Number(payload.indice);
  const criando = payload.criar === true;
  if (!criando && !indiceValido(estado.medicao, indice)) throw new Error('medicao_inexistente');
  const medicao = comoArray(estado.medicao);
  const antes = criando ? null : { ...medicao[indice] };
  const item = { ...(antes || {}), ...(payload.item || {}) };
  item.qreal = Number(item.qreal) || 0;
  item.vunit = Number(item.vunit) || 0;
  item.vtotal = item.qreal * item.vunit;
  item.aprovacao = 'Aprovado';
  item.aprovadoPor = aprovacao.decididoPor;
  item.aprovadoEm = agora;
  if (criando) medicao.push(item);
  else medicao[indice] = item;
  return {
    updates: { [`${base}/medicao`]: medicao },
    antes, depois: item, resumo: `Fechamento de medição — ${item.servico || item.obra || ''}`.trim()
  };
}

/**
 * Executa a operação contra um snapshot do tenant e devolve um mapa de updates.
 * Não faz I/O: tudo é calculado para ser gravado depois num update atômico.
 */
function construirEfeitos(db, tenantId, aprovacao, estado, agora) {
  const base = `tenants/${tenantId}`;
  const p = aprovacao.payload;
  switch (aprovacao.tipo) {
    case 'movimentacao_estoque': return efeitosMovimentacao(p, estado, base, agora);
    case 'trabalhador_add': return efeitosTrabalhadorAdd(p, estado, base);
    case 'trabalhador_remove': return efeitosTrabalhadorRemove(p, estado, base);
    case 'financeiro_lancamento': return efeitosFinanceiroLancamento(p, estado, base);
    case 'financeiro_status': return efeitosFinanceiroStatus(p, estado, base);
    case 'orcamento_fechamento': return efeitosOrcamento(p, estado, base, aprovacao, agora);
    case 'compra_criacao': return efeitosCompra(p, estado, base, tenantId, aprovacao, agora);
    case 'medicao_fechamento': return efeitosMedicao(p, estado, base, aprovacao, agora);
    default: throw new Error('tipo_nao_implementado');
  }
}

// ==================== AUDITORIA E NOTIFICAÇÕES ====================

function limiteTexto(valor) {
  try {
    const texto = JSON.stringify(valor === undefined ? null : valor);
    return texto.length > 4000 ? `${texto.slice(0, 4000)}…` : valor;
  } catch (e) {
    return String(valor).slice(0, 4000);
  }
}

function chaveAuditoria(db, tenantId, aprovacao, efeitos, agora) {
  const id = db.ref(`auditoria/${tenantId}`).push().key;
  return {
    [`auditoria/${tenantId}/${id}`]: {
      acao: aprovacao.tipo,
      aprovacaoId: aprovacao.id || null,
      ator: aprovacao.decididoPor || '',
      atorRole: normalizarRole(aprovacao.decididoPorPapel) || null,
      solicitadoPor: aprovacao.solicitadoPor || null,
      alvo: aprovacao.alvo || efeitos.resumo,
      antes: limiteTexto(efeitos.antes),
      depois: limiteTexto(efeitos.depois),
      criadoEm: agora
    }
  };
}

/**
 * Uma cópia por destinatário em `notificacoes/{tenantId}/{uid}/{id}`.
 * O uid faz parte do caminho para a rules poder autorizar a leitura sem
 * expor as notificações dos outros membros do tenant.
 */
function chaveNotificacao(db, tenantId, dados) {
  const id = db.ref(`notificacoes/${tenantId}`).push().key;
  const uids = Object.entries(dados.destinatarios || {})
    .filter(([, permitido]) => permitido === true)
    .map(([uid]) => uid)
    .filter(Boolean);
  const base = {
    id,
    tipo: dados.tipo,
    titulo: dados.titulo,
    mensagem: dados.mensagem,
    aprovacaoId: dados.aprovacaoId || null,
    paraAdmin: !!dados.paraAdmin,
    lido: false,
    criadoEm: dados.criadoEm
  };
  return uids.reduce((updates, uid) => {
    updates[`notificacoes/${tenantId}/${uid}/${id}`] = { ...base, uid };
    return updates;
  }, {});
}

function mapaDestinatarios(uids) {
  return (uids || []).filter(Boolean).reduce((mapa, uid) => {
    mapa[uid] = true;
    return mapa;
  }, {});
}

/** Uids de admin/super_admin do tenant (a rules de notificações exige o uid no mapa). */
async function carregarAdminsPorTenant(db, tenantId) {
  const snap = await db.ref('profiles').once('value');
  const perfis = snap.val() || {};
  const admins = {};
  Object.entries(perfis).forEach(([uid, perfil]) => {
    if (perfil && perfil.tenantId === tenantId && ehAdmin(perfil.role)) admins[uid] = true;
  });
  return admins;
}

function destinatariosDecisao(aprovacao, admins, incluirSolicitante) {
  const mapa = { ...(admins || {}) };
  if (incluirSolicitante && aprovacao.solicitadoPor) mapa[aprovacao.solicitadoPor] = true;
  return mapa;
}

// ==================== APLICAÇÃO ====================

async function lerEstado(db, tenantId) {
  const snap = await db.ref(`tenants/${tenantId}`).once('value');
  return snap.val() || {};
}

async function marcarFalha(db, tenantId, aprovacaoId, aprovacao, motivo, agora) {
  const path = `tenants/${tenantId}/aprovacoes/${aprovacaoId}`;
  const updates = {
    [`${path}/status`]: 'erro',
    [`${path}/motivo`]: String(motivo).slice(0, 500),
    [`${path}/falhaEm`]: agora,
    [`${path}/reservadoEm`]: null
  };
  try {
    const admins = await carregarAdminsPorTenant(db, tenantId);
    Object.assign(updates, chaveNotificacao(db, tenantId, {
      tipo: 'aprovacao_erro',
      titulo: 'Falha ao aplicar aprovação',
      mensagem: `A solicitação ${aprovacaoId} não pôde ser aplicada: ${motivo}.`,
      aprovacaoId,
      destinatarios: mapaDestinatarios(Object.keys(admins)),
      paraAdmin: true,
      criadoEm: agora
    }));
  } catch (e) {
    console.error('[aprovacoes] falha ao notificar erro:', e);
  }
  await db.ref().update(updates);
}

/**
 * Aplica uma aprovação já decidida. Seguro para chamadas concorrentes:
 * a reserva via transaction só é obtida por uma execução.
 */
async function aplicarAprovacaoPorId(db, tenantId, aprovacaoId, agora = Date.now(), retomar = false) {
  const path = `tenants/${tenantId}/aprovacoes/${aprovacaoId}`;
  const reserva = await db.ref(path).transaction((atual) => {
    if (!atual || atual.status !== 'aprovado') return atual;
    if (atual.aplicadoEm || atual.expiradoEm || atual.status === 'erro') return atual;
    if (atual.reservadoEm) {
      const reservaEm = Number(atual.reservadoEm);
      const reservaAntiga = Number.isFinite(reservaEm) && (agora - reservaEm) >= RESERVA_STALE_MS;
      if (!retomar || !reservaAntiga) return atual;
    }
    return { ...atual, reservadoEm: agora };
  });

  if (!reserva.committed) {
    return { aplicado: false, motivo: 'ja_processada_ou_reservada' };
  }

  const aprovacao = reserva.snapshot.val();
  const validacao = podeAplicar(aprovacao, agora);
  if (!validacao.ok) {
    await marcarFalha(db, tenantId, aprovacaoId, aprovacao, validacao.motivo, agora);
    return { aplicado: false, motivo: validacao.motivo };
  }

  try {
    const [estado, admins] = await Promise.all([
      lerEstado(db, tenantId),
      carregarAdminsPorTenant(db, tenantId)
    ]);
    const efeitos = construirEfeitos(db, tenantId, aprovacao, estado, agora);
    const updates = {
      ...efeitos.updates,
      [`${path}/aplicadoEm`]: agora
    };

    Object.assign(updates, chaveAuditoria(db, tenantId, aprovacao, efeitos, agora));

    const decididaPorEngenheiro = normalizarRole(aprovacao.decididoPorPapel) === 'engenheiro';
    Object.assign(updates, chaveNotificacao(db, tenantId, {
      tipo: 'aprovacao_decidida',
      titulo: aprovacao.status === 'aprovado' ? 'Solicitação aprovada' : 'Solicitação decidida',
      mensagem: `${efeitos.resumo}. Decidido por ${decididaPorEngenheiro ? 'Engenheiro' : 'administrador'}.`,
      aprovacaoId,
      destinatarios: destinatariosDecisao(aprovacao, admins, !decididaPorEngenheiro),
      paraAdmin: decididaPorEngenheiro,
      criadoEm: agora
    }));

    // Aviso obrigatório ao admin quando o engenheiro decide movimentação de estoque.
    if (decididaPorEngenheiro && aprovacao.notificarAdmin === true) {
      Object.assign(updates, chaveNotificacao(db, tenantId, {
        tipo: 'decisao_engenheiro',
        titulo: 'Engenheiro aceitou movimentação de estoque',
        mensagem: `${efeitos.resumo}. Solicitação ${aprovacaoId} (solicitada por ${aprovacao.solicitadoPor || '—'}).`,
        aprovacaoId,
        destinatarios: mapaDestinatarios(Object.keys(admins)),
        paraAdmin: true,
        criadoEm: agora
      }));
    }

    await db.ref().update(updates);
    return { aplicado: true, aprovacaoId, tenantId };
  } catch (e) {
    console.error('[aprovacoes] erro ao aplicar', tenantId, aprovacaoId, e);
    await marcarFalha(db, tenantId, aprovacaoId, aprovacao, e.message, agora);
    return { aplicado: false, motivo: e.message };
  }
}

/** Trigger: só age na transição para 'aprovado' feita pelo cliente. */
async function aoEscreverAprovacao(db, tenantId, aprovacaoId, depois, antes, agora = Date.now()) {
  if (!depois) return { ignorado: true };
  if (depois.status !== 'aprovado') return { ignorado: true };
  if (antes && antes.status === 'aprovado') return { ignorado: true }; // update de aplicação
  return aplicarAprovacaoPorId(db, tenantId, aprovacaoId, agora);
}

// ==================== JOB DIÁRIO: 7 / 12 / 15 DIAS ====================

async function registrarAlerta(db, tenantId, aprovacaoId, aprovacao, dia, agora, admins) {
  const path = `tenants/${tenantId}/aprovacoes/${aprovacaoId}`;
  const transacao = await db.ref(path).transaction((atual) => {
    if (!atual || atual.status !== 'pendente') return atual;
    if (atual.alertas && atual.alertas[String(dia)]) return atual;
    return {
      ...atual,
      alertas: { ...(atual.alertas || {}), [String(dia)]: agora }
    };
  });

  if (!transacao.committed) return false;

  await db.ref().update(chaveNotificacao(db, tenantId, {
    tipo: dia === 15 ? 'aprovacao_expirando' : 'aprovacao_prazo',
    titulo: dia === 15 ? 'Solicitação expirada' : `Solicitação com ${dia} dias`,
    mensagem: dia === 15
      ? `A solicitação ${aprovacaoId} expirou e não foi aplicada.`
      : `A solicitação ${aprovacaoId} aguarda decisão há ${dia} dias.`,
    aprovacaoId,
    destinatarios: destinatariosDecisao(aprovacao, admins, true),
    paraAdmin: false,
    criadoEm: agora
  }));
  return true;
}

async function expirarAprovacao(db, tenantId, aprovacaoId, aprovacao, agora, admins) {
  const path = `tenants/${tenantId}/aprovacoes/${aprovacaoId}`;
  const transacao = await db.ref(path).transaction((atual) => {
    if (!atual || atual.status !== 'pendente') return atual;
    return { ...atual, status: 'expirado', expiradoEm: agora };
  });

  if (!transacao.committed) return false;

  await db.ref().update(chaveNotificacao(db, tenantId, {
    tipo: 'aprovacao_expirada',
    titulo: 'Solicitação expirada',
    mensagem: `A solicitação ${aprovacaoId} completou ${PRAZO_APROVACAO_DIAS} dias e foi encerrada sem aplicação.`,
    aprovacaoId,
    destinatarios: destinatariosDecisao(aprovacao, admins, true),
    paraAdmin: false,
    criadoEm: agora
  }));
  return true;
}

async function processarAprovacoesJob(db, agora = Date.now()) {
  const resultado = { tenants: 0, alertas: 0, expiradas: 0, retomadas: 0, erros: 0 };
  const tenantsSnap = await db.ref('tenants').once('value');
  const tenants = tenantsSnap.val() || {};

  for (const tenantId of Object.keys(tenants)) {
    resultado.tenants++;
    let admins = {};
    let aprovacoes = {};
    try {
      [admins, aprovacoes] = await Promise.all([
        carregarAdminsPorTenant(db, tenantId),
        db.ref(`tenants/${tenantId}/aprovacoes`).once('value').then(s => s.val() || {})
      ]);
    } catch (e) {
      console.error('[aprovacoes] erro ao ler tenant', tenantId, e);
      resultado.erros++;
      continue;
    }

    for (const [aprovacaoId, aprovacao] of Object.entries(aprovacoes)) {
      if (!aprovacao) continue;
      try {
        // Reserva órfã: a aplicação começou mas não terminou.
        if (aprovacao.status === 'aprovado' && aprovacao.reservadoEm && !aprovacao.aplicadoEm) {
          const retomada = await aplicarAprovacaoPorId(db, tenantId, aprovacaoId, agora, true);
          if (retomada.aplicado) resultado.retomadas++;
          continue;
        }
        if (aprovacao.status !== 'pendente') continue;

        if (deveExpirar(aprovacao, agora)) {
          if (await expirarAprovacao(db, tenantId, aprovacaoId, aprovacao, agora, admins)) {
            resultado.expiradas++;
          }
          continue;
        }

        for (const dia of alertasDevidos(aprovacao, agora)) {
          if (await registrarAlerta(db, tenantId, aprovacaoId, aprovacao, dia, agora, admins)) {
            resultado.alertas++;
          }
        }
      } catch (e) {
        console.error('[aprovacoes] erro ao processar', tenantId, aprovacaoId, e);
        resultado.erros++;
      }
    }
  }
  return resultado;
}

module.exports = {
  MS_DIA,
  RESERVA_STALE_MS,
  PRAZO_APROVACAO_DIAS,
  DIAS_ALERTA,
  TIPOS_APROVACAO,
  normalizarRole,
  ehAdmin,
  diasDecorridos,
  alertasDevidos,
  deveExpirar,
  papelPodeDecidir,
  podeAplicar,
  validarIntegridadeFinanceira,
  comoArray,
  construirEfeitos,
  aplicarAprovacaoPorId,
  aoEscreverAprovacao,
  processarAprovacoesJob
};
