// js/estoque.module.js
// Motor de estoque — todas as regras de negócio centralizadas aqui
// Usa Firebase v8 namespaced API (global firebase.*)
// Carregar via: <script src="js/estoque.module.js" defer></script>

// ─────────────────────────────────────────────────────────────
// TIPOS DE MOVIMENTAÇÃO
// ─────────────────────────────────────────────────────────────
window.TIPO_MOV = {
  ENTRADA:        'entrada',
  SAIDA_CANTEIRO: 'saida_canteiro',
  RETORNO:        'retorno',
  TRANSFERENCIA:  'transferencia',
  AJUSTE:         'ajuste',
  EXCLUSAO:       'exclusao',
};

// ─────────────────────────────────────────────────────────────
// NORMALIZAÇÃO — previne duplicação por nome
// ─────────────────────────────────────────────────────────────
function normalizarNome(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_\/\\]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
window.normalizarNome = normalizarNome;

async function buscarItemDuplicado(tenantId, nomeNovo, excluirId = null) {
  const snap = await firebase.database().ref(`tenants/${tenantId}/estoque/itens`).once('value');
  if (!snap.exists()) return null;
  const nomeNorm = normalizarNome(nomeNovo);
  for (const [id, item] of Object.entries(snap.val())) {
    if (id === excluirId) continue;
    if (normalizarNome(item.nome) === nomeNorm) return { id, ...item };
  }
  return null;
}
window.buscarItemDuplicado = buscarItemDuplicado;

// ─────────────────────────────────────────────────────────────
// CRIAR ITEM NO ESTOQUE
// ─────────────────────────────────────────────────────────────
async function criarItem(tenantId, dados, uid) {
  const { nome, unidade, quantidadeInicial = 0, estoqueMinimo = 0, categoria = '' } = dados;
  if (!nome?.trim()) return { ok: false, erro: 'Nome do item é obrigatório.' };
  if (!unidade?.trim()) return { ok: false, erro: 'Unidade é obrigatória.' };
  if (quantidadeInicial < 0) return { ok: false, erro: 'Quantidade inicial não pode ser negativa.' };

  const duplicado = await buscarItemDuplicado(tenantId, nome);
  if (duplicado) {
    return { ok: false, erro: `Já existe "${duplicado.nome}". Use Entrada para adicionar quantidade.`, duplicado };
  }

  const itensRef = firebase.database().ref(`tenants/${tenantId}/estoque/itens`).push();
  const itemId = itensRef.key;
  const agora = Date.now();

  await itensRef.set({
    nome: nome.trim(),
    nomeNorm: normalizarNome(nome),
    unidade: unidade.trim(),
    categoria: categoria.trim(),
    quantidade: Number(quantidadeInicial),
    estoqueMinimo: Number(estoqueMinimo),
    qtdNoCanteiro: 0,
    criadoEm: agora,
    criadoPor: uid,
    atualizadoEm: agora,
  });

  if (quantidadeInicial > 0) {
    await _registrarMovimentacao(tenantId, {
      tipo: window.TIPO_MOV.ENTRADA, itemId, itemNome: nome.trim(),
      unidade: unidade.trim(), quantidade: quantidadeInicial,
      motivo: 'Cadastro inicial do item', uid,
    });
  }
  return { ok: true, itemId };
}
window.criarItem = criarItem;

// ─────────────────────────────────────────────────────────────
// ENTRADA NO ESTOQUE (reposição / compra)
// ─────────────────────────────────────────────────────────────
async function registrarEntrada(tenantId, itemId, quantidade, motivo, uid) {
  if (!motivo?.trim()) return { ok: false, erro: 'Motivo da entrada é obrigatório.' };
  if (quantidade <= 0) return { ok: false, erro: 'Quantidade deve ser maior que zero.' };

  const itemRef = firebase.database().ref(`tenants/${tenantId}/estoque/itens/${itemId}`);
  const snap = await itemRef.once('value');
  if (!snap.exists()) return { ok: false, erro: 'Item não encontrado.' };

  const item = snap.val();
  await itemRef.transaction(current => {
    if (!current) return current;
    current.quantidade = (current.quantidade || 0) + quantidade;
    current.atualizadoEm = Date.now();
    return current;
  });

  await _registrarMovimentacao(tenantId, {
    tipo: window.TIPO_MOV.ENTRADA, itemId, itemNome: item.nome,
    unidade: item.unidade, quantidade, motivo, uid,
  });
  return { ok: true };
}
window.registrarEntrada = registrarEntrada;

// ─────────────────────────────────────────────────────────────
// SAÍDA PARA O CANTEIRO
// ─────────────────────────────────────────────────────────────
async function registrarSaidaCanteiro(tenantId, itemId, obraId, obraNome, quantidade, uid) {
  if (quantidade <= 0) return { ok: false, erro: 'Quantidade deve ser maior que zero.' };
  if (!obraId) return { ok: false, erro: 'Obra de destino é obrigatória.' };

  const itemRef = firebase.database().ref(`tenants/${tenantId}/estoque/itens/${itemId}`);
  let resultado = { ok: false };

  await itemRef.transaction(current => {
    if (!current) return;
    const disponivel = (current.quantidade || 0);
    if (disponivel < quantidade) {
      resultado = { ok: false, erro: `Estoque insuficiente. Disponível: ${disponivel} ${current.unidade}. Solicitado: ${quantidade}.` };
      return;
    }
    current.quantidade = disponivel - quantidade;
    current.qtdNoCanteiro = (current.qtdNoCanteiro || 0) + quantidade;
    current.atualizadoEm = Date.now();
    resultado = { ok: true, itemNome: current.nome, unidade: current.unidade };
    return current;
  });

  if (!resultado.ok) return resultado;

  const canteiroRef = firebase.database().ref(`tenants/${tenantId}/estoque/canteiro/${obraId}/${itemId}`);
  await canteiroRef.transaction(current => {
    if (!current) {
      return { itemId, itemNome: resultado.itemNome, unidade: resultado.unidade, quantidade, saidaEm: Date.now(), retornos: [] };
    }
    current.quantidade = (current.quantidade || 0) + quantidade;
    return current;
  });

  await _registrarMovimentacao(tenantId, {
    tipo: window.TIPO_MOV.SAIDA_CANTEIRO, itemId, itemNome: resultado.itemNome,
    unidade: resultado.unidade, quantidade, motivo: `Saída para obra: ${obraNome}`,
    obraDestinoId: obraId, obraDestinoNome: obraNome, uid,
  });
  return { ok: true };
}
window.registrarSaidaCanteiro = registrarSaidaCanteiro;

// ─────────────────────────────────────────────────────────────
// RETORNO DO CANTEIRO PARA O ESTOQUE
// ─────────────────────────────────────────────────────────────
async function registrarRetorno(tenantId, itemId, obraId, obraNome, quantidade, motivo, uid) {
  if (quantidade <= 0) return { ok: false, erro: 'Quantidade deve ser maior que zero.' };

  const canteiroRef = firebase.database().ref(`tenants/${tenantId}/estoque/canteiro/${obraId}/${itemId}`);
  const canteiroSnap = await canteiroRef.once('value');
  if (!canteiroSnap.exists()) {
    return { ok: false, erro: 'Este item não consta como saído para esta obra.' };
  }
  const canteiro = canteiroSnap.val();
  const qtdNoCanteiro = canteiro.quantidade || 0;

  if (quantidade > qtdNoCanteiro) {
    return { ok: false, erro: `Não é possível retornar ${quantidade} ${canteiro.unidade}. No canteiro: ${qtdNoCanteiro}.` };
  }

  const novaQtd = qtdNoCanteiro - quantidade;
  if (novaQtd === 0) {
    await canteiroRef.remove();
  } else {
    await canteiroRef.update({ quantidade: novaQtd });
  }

  const itemRef = firebase.database().ref(`tenants/${tenantId}/estoque/itens/${itemId}`);
  await itemRef.transaction(current => {
    if (!current) return current;
    current.quantidade = (current.quantidade || 0) + quantidade;
    current.qtdNoCanteiro = Math.max(0, (current.qtdNoCanteiro || 0) - quantidade);
    current.atualizadoEm = Date.now();
    return current;
  });

  await _registrarMovimentacao(tenantId, {
    tipo: window.TIPO_MOV.RETORNO, itemId, itemNome: canteiro.itemNome,
    unidade: canteiro.unidade, quantidade, motivo: motivo || `Retorno da obra: ${obraNome}`,
    obraOrigemId: obraId, obraOrigemNome: obraNome, uid,
  });
  return { ok: true };
}
window.registrarRetorno = registrarRetorno;

// ─────────────────────────────────────────────────────────────
// TRANSFERÊNCIA ENTRE OBRAS
// ─────────────────────────────────────────────────────────────
async function registrarTransferencia(tenantId, itemId, obraOrigemId, obraOrigemNome, obraDestinoId, obraDestinoNome, quantidade, uid) {
  if (obraOrigemId === obraDestinoId) return { ok: false, erro: 'Origem e destino não podem ser a mesma obra.' };
  if (quantidade <= 0) return { ok: false, erro: 'Quantidade deve ser maior que zero.' };

  const canteiroOrigemRef = firebase.database().ref(`tenants/${tenantId}/estoque/canteiro/${obraOrigemId}/${itemId}`);
  const snap = await canteiroOrigemRef.once('value');
  if (!snap.exists()) return { ok: false, erro: 'Item não encontrado no canteiro de origem.' };

  const canteiro = snap.val();
  if (quantidade > canteiro.quantidade) {
    return { ok: false, erro: `Disponível na origem: ${canteiro.quantidade} ${canteiro.unidade}. Solicitado: ${quantidade}.` };
  }

  const novaQtd = canteiro.quantidade - quantidade;
  if (novaQtd === 0) {
    await canteiroOrigemRef.remove();
  } else {
    await canteiroOrigemRef.update({ quantidade: novaQtd });
  }

  const canteiroDestinoRef = firebase.database().ref(`tenants/${tenantId}/estoque/canteiro/${obraDestinoId}/${itemId}`);
  await canteiroDestinoRef.transaction(current => {
    if (!current) return { itemId, itemNome: canteiro.itemNome, unidade: canteiro.unidade, quantidade, saidaEm: Date.now() };
    current.quantidade = (current.quantidade || 0) + quantidade;
    return current;
  });

  await _registrarMovimentacao(tenantId, {
    tipo: window.TIPO_MOV.TRANSFERENCIA, itemId, itemNome: canteiro.itemNome,
    unidade: canteiro.unidade, quantidade,
    motivo: `Transferência de ${obraOrigemNome} → ${obraDestinoNome}`,
    obraOrigemId, obraOrigemNome, obraDestinoId, obraDestinoNome, uid,
  });
  return { ok: true };
}
window.registrarTransferencia = registrarTransferencia;

// ─────────────────────────────────────────────────────────────
// EXCLUSÃO SEGURA
// ─────────────────────────────────────────────────────────────
async function excluirItem(tenantId, itemId, uid) {
  const itemRef = firebase.database().ref(`tenants/${tenantId}/estoque/itens/${itemId}`);
  const snap = await itemRef.once('value');
  if (!snap.exists()) return { ok: false, erro: 'Item não encontrado.' };

  const item = snap.val();
  if ((item.qtdNoCanteiro || 0) > 0) {
    return { ok: false, erro: `"${item.nome}" ainda tem ${item.qtdNoCanteiro} ${item.unidade} no canteiro. Registre retorno antes.` };
  }
  if ((item.quantidade || 0) > 0) {
    return { ok: false, erro: `"${item.nome}" tem saldo ${item.quantidade} ${item.unidade}. Zere antes de excluir.` };
  }

  const canteiroSnap = await firebase.database().ref(`tenants/${tenantId}/estoque/canteiro`).once('value');
  if (canteiroSnap.exists()) {
    for (const [obraId, itens] of Object.entries(canteiroSnap.val())) {
      if (itens[itemId]) return { ok: false, erro: `Item ainda no canteiro da obra ${obraId}.` };
    }
  }

  await _registrarMovimentacao(tenantId, {
    tipo: window.TIPO_MOV.EXCLUSAO, itemId, itemNome: item.nome,
    unidade: item.unidade, quantidade: 0, motivo: 'Item excluído do cadastro', uid,
  });
  await itemRef.remove();
  return { ok: true };
}
window.excluirItem = excluirItem;

// ─────────────────────────────────────────────────────────────
// AJUSTE MANUAL
// ─────────────────────────────────────────────────────────────
async function registrarAjuste(tenantId, itemId, novaQuantidade, motivo, uid) {
  if (!motivo || motivo.trim().length < 10) return { ok: false, erro: 'Motivo mínimo: 10 caracteres.' };
  if (novaQuantidade < 0) return { ok: false, erro: 'Quantidade não pode ser negativa.' };

  let quantidadeAnterior = 0, itemNome = '', unidade = '';
  const itemRef = firebase.database().ref(`tenants/${tenantId}/estoque/itens/${itemId}`);

  await itemRef.transaction(current => {
    if (!current) return current;
    quantidadeAnterior = current.quantidade || 0;
    itemNome = current.nome;
    unidade = current.unidade;
    current.quantidade = novaQuantidade;
    current.atualizadoEm = Date.now();
    return current;
  });

  const diferenca = novaQuantidade - quantidadeAnterior;
  await _registrarMovimentacao(tenantId, {
    tipo: window.TIPO_MOV.AJUSTE, itemId, itemNome, unidade,
    quantidade: Math.abs(diferenca),
    motivo: `Ajuste: ${diferenca >= 0 ? '+' : ''}${diferenca} ${unidade}. ${motivo}`, uid,
  });
  return { ok: true, diferenca };
}
window.registrarAjuste = registrarAjuste;

// ─────────────────────────────────────────────────────────────
// CONSULTAS
// ─────────────────────────────────────────────────────────────
async function listarItensComAlerta(tenantId) {
  const snap = await firebase.database().ref(`tenants/${tenantId}/estoque/itens`).once('value');
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, item]) => ({ id, ...item }))
    .filter(item => (item.quantidade || 0) <= (item.estoqueMinimo || 0))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}
window.listarItensComAlerta = listarItensComAlerta;

async function listarCanteiro(tenantId, obraId) {
  const snap = await firebase.database().ref(`tenants/${tenantId}/estoque/canteiro/${obraId}`).once('value');
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, item]) => ({ id, ...item }));
}
window.listarCanteiro = listarCanteiro;

async function listarMovimentacoes(tenantId, itemId, limit = 50) {
  const snap = await firebase.database().ref(`tenants/${tenantId}/estoque/movimentacoes`).once('value');
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, mov]) => ({ id, ...mov }))
    .filter(mov => !itemId || mov.itemId === itemId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}
window.listarMovimentacoes = listarMovimentacoes;

// ─────────────────────────────────────────────────────────────
// INTERNO — registrar movimentação
// ─────────────────────────────────────────────────────────────
async function _registrarMovimentacao(tenantId, dados) {
  const movRef = firebase.database().ref(`tenants/${tenantId}/estoque/movimentacoes`).push();
  await movRef.set({ ...dados, timestamp: Date.now(), movId: movRef.key });
}

// ─────────────────────────────────────────────────────────────
// VALIDAÇÕES DO MODAL
// ─────────────────────────────────────────────────────────────
function validarFormMovimentacao(dados) {
  const erros = [];
  const { tipo, itemId, quantidade, obraOrigemId, obraDestinoId, motivo } = dados;
  if (!itemId) erros.push('Selecione um item.');
  if (!tipo) erros.push('Selecione o tipo de movimentação.');
  if (!quantidade || quantidade <= 0) erros.push('Quantidade deve ser maior que zero.');
  if (tipo === window.TIPO_MOV.ENTRADA) erros.push('⛔ Entrada não permitida neste modal. Use "Nova Entrada".');
  if (tipo === window.TIPO_MOV.SAIDA_CANTEIRO && !obraDestinoId) erros.push('Selecione a obra de destino.');
  if (tipo === window.TIPO_MOV.RETORNO && !obraOrigemId) erros.push('Selecione a obra de origem do retorno.');
  if (tipo === window.TIPO_MOV.TRANSFERENCIA) {
    if (!obraOrigemId) erros.push('Selecione a obra de origem.');
    if (!obraDestinoId) erros.push('Selecione a obra de destino.');
    if (obraOrigemId && obraDestinoId && obraOrigemId === obraDestinoId) erros.push('Origem e destino não podem ser iguais.');
  }
  if (tipo === window.TIPO_MOV.AJUSTE && (!motivo || motivo.trim().length < 10)) erros.push('Motivo mínimo: 10 caracteres.');
  return erros;
}
window.validarFormMovimentacao = validarFormMovimentacao;

async function despacharMovimentacao(tenantId, dados, uid) {
  const erros = validarFormMovimentacao(dados);
  if (erros.length > 0) return { ok: false, erros };

  const { tipo, itemId, quantidade, obraOrigemId, obraOrigemNome, obraDestinoId, obraDestinoNome, motivo } = dados;

  switch (tipo) {
    case window.TIPO_MOV.SAIDA_CANTEIRO:
      return registrarSaidaCanteiro(tenantId, itemId, obraDestinoId, obraDestinoNome, quantidade, uid);
    case window.TIPO_MOV.RETORNO:
      return registrarRetorno(tenantId, itemId, obraOrigemId, obraOrigemNome, quantidade, motivo, uid);
    case window.TIPO_MOV.TRANSFERENCIA:
      return registrarTransferencia(tenantId, itemId, obraOrigemId, obraOrigemNome, obraDestinoId, obraDestinoNome, quantidade, uid);
    case window.TIPO_MOV.AJUSTE:
      return registrarAjuste(tenantId, itemId, quantidade, motivo, uid);
    case window.TIPO_MOV.ENTRADA:
      return { ok: false, erro: 'Entrada bloqueada neste fluxo.' };
    default:
      return { ok: false, erro: `Tipo desconhecido: ${tipo}` };
  }
}
window.despacharMovimentacao = despacharMovimentacao;

console.log('✅ estoque.module.js carregado');

// ─────────────────────────────────────────────────────────────
// FUNÇÕES DO MODAL DE MOVIMENTAÇÃO (CANTEIRO)
// ─────────────────────────────────────────────────────────────
async function buscarItemPorId(itemId) {
  const item = (DB.estoque || []).find(e => e.cod === itemId);
  if (!item) return null;
  return {
    nome: item.mat,
    unidade: item.unid,
    quantidade: (parseFloat(item.entrada)||0) - (parseFloat(item.saida)||0),
    qtdNoCanteiro: 0
  };
}
window.buscarItemPorId = buscarItemPorId;

async function buscarItemNoCanteiro(itemId) {
  const tenantId = (() => { try { return JSON.parse(sessionStorage.getItem('gestaoUser') || '{}').tenantId; } catch { return ''; } })();
  if (!tenantId) return {};
  try {
    const snap = await firebase.database().ref(`tenants/${tenantId}/estoque/canteiro`).once('value');
    if (!snap.exists()) return {};
    const result = {};
    for (const [obraId, itens] of Object.entries(snap.val())) {
      if (itens[itemId]) {
        const obra = (DB.obras || []).find(o => o.cod === obraId);
        result[obraId] = { obraId, obraNome: obra?.nome || obraId, quantidade: itens[itemId].quantidade, unidade: itens[itemId].unidade };
      }
    }
    return result;
  } catch { return {}; }
}
window.buscarItemNoCanteiro = buscarItemNoCanteiro;

function getItemCache(itemId) {
  const item = (DB.estoque || []).find(e => e.cod === itemId);
  if (!item) return null;
  const saldo = (parseFloat(item.entrada)||0) - (parseFloat(item.saida)||0);
  return { nome: item.mat, unidade: item.unid, quantidade: saldo };
}
window.getItemCache = getItemCache;

function popularSelectItens(preSelected) {
  const sel = document.getElementById('mov-item');
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione um item...</option>';
  (DB.estoque || []).forEach(e => {
    const saldo = (parseFloat(e.entrada)||0) - (parseFloat(e.saida)||0);
    sel.innerHTML += `<option value="${e.cod}" ${e.cod === preSelected ? 'selected' : ''}>${e.mat} (${e.unid}) — saldo: ${saldo}</option>`;
  });
}
window.popularSelectItens = popularSelectItens;

function popularSelectObras() {
  const obras = DB.obras || [];
  const opts = '<option value="">Selecione a obra...</option>' +
    obras.filter(o => ['ativa', 'em andamento', 'planejada', 'execucao'].includes((o.status||'').toLowerCase()))
      .map(o => `<option value="${o.cod}">${o.cod} — ${o.nome}</option>`).join('');
  ['mov-obra-destino', 'mov-obra-origem-ret', 'mov-transf-origem', 'mov-transf-destino'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}
window.popularSelectObras = popularSelectObras;

function mostrarToast(msg, tipo) {
  if (typeof toast === 'function') toast(msg, tipo);
  else alert(msg);
}
window.mostrarToast = mostrarToast;

function recarregarEstoque() {
  if (typeof renderEstoque === 'function') renderEstoque();
  if (typeof renderMovEstoque === 'function') renderMovEstoque();
}
window.recarregarEstoque = recarregarEstoque;

// ─────────────────────────────────────────────────────────────
// FUNÇÕES UI DO MODAL DE MOVIMENTAÇÃO
// ─────────────────────────────────────────────────────────────
let _movTipoAtual = null;
let _movItemAtual = null;
let _movCanteiroData = {};

function abrirModalMovimentacao(itemIdPreSelecionado = null) {
  resetarModalMovimentacao();
  popularSelectItens(itemIdPreSelecionado);
  popularSelectObras();
  document.getElementById('modal-movimentacao-estoque').style.display = 'flex';
}
window.abrirModalMovimentacao = abrirModalMovimentacao;

function fecharModalMovimentacao() {
  document.getElementById('modal-movimentacao-estoque').style.display = 'none';
  resetarModalMovimentacao();
}
window.fecharModalMovimentacao = fecharModalMovimentacao;

function resetarModalMovimentacao() {
  _movTipoAtual = null; _movItemAtual = null; _movCanteiroData = {};
  document.querySelectorAll('.mov-tipo-btn').forEach(b => b.classList.remove('ativo'));
  ['mov-item','mov-quantidade','mov-motivo'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  const info = document.getElementById('mov-item-info'); if (info) info.style.display = 'none';
  const erros = document.getElementById('mov-erros-lista'); if (erros) { erros.style.display = 'none'; erros.innerHTML = ''; }
  const btn = document.getElementById('mov-btn-confirmar'); if (btn) { btn.disabled = true; btn.textContent = 'Selecione um tipo'; }
  ocultarTodosCamposCondicionais();
}

function selecionarTipoMov(tipo) {
  _movTipoAtual = tipo;
  document.querySelectorAll('.mov-tipo-btn').forEach(b => b.classList.toggle('ativo', b.dataset.tipo === tipo));
  ocultarTodosCamposCondicionais();
  const mapa = { saida_canteiro: ['campo-obra-destino'], retorno: ['campo-obra-origem-retorno'], transferencia: ['campo-transferencia'], ajuste: [] };
  (mapa[tipo] || []).forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'block'; });
  const isAjuste = tipo === 'ajuste';
  ['motivo-required-label','motivo-opcional-label','mov-motivo-counter'].forEach(id => {
    const e = document.getElementById(id); if (!e) return;
    if (id === 'motivo-required-label') e.style.display = isAjuste ? 'inline' : 'none';
    else if (id === 'motivo-opcional-label') e.style.display = isAjuste ? 'none' : 'inline';
    else e.style.display = isAjuste ? 'block' : 'none';
  });
  const rotulos = { saida_canteiro: '📤 Registrar Saída', retorno: '📥 Registrar Retorno', transferencia: '🔄 Registrar Transferência', ajuste: '✏️ Aplicar Ajuste' };
  const btn = document.getElementById('mov-btn-texto'); if (btn) btn.textContent = rotulos[tipo] || 'Confirmar';
  const btnC = document.getElementById('mov-btn-confirmar'); if (btnC) btnC.disabled = false;
  if (_movItemAtual) onItemChange();
}
window.selecionarTipoMov = selecionarTipoMov;

function ocultarTodosCamposCondicionais() {
  ['campo-obra-destino','campo-obra-origem-retorno','campo-transferencia'].forEach(id => {
    const e = document.getElementById(id); if (e) e.style.display = 'none';
  });
}

function alertarEntradaBloqueada() {
  alert('⚠️ Para entrada de itens, use "Nova Entrada" na tela de estoque.');
}
window.alertarEntradaBloqueada = alertarEntradaBloqueada;

async function onItemChange() {
  const itemId = document.getElementById('mov-item').value;
  const infoDiv = document.getElementById('mov-item-info');
  if (!itemId) { if (infoDiv) infoDiv.style.display = 'none'; return; }
  _movItemAtual = itemId;
  const item = await buscarItemPorId(itemId);
  if (!item) return;
  const unidLabel = document.getElementById('mov-unidade-label');
  if (unidLabel) unidLabel.textContent = item.unidade || '—';
  const qtdEst = document.getElementById('mov-item-qtd-estoque');
  if (qtdEst) qtdEst.textContent = `${item.quantidade || 0} ${item.unidade}`;
  if (infoDiv) infoDiv.style.display = 'block';
  _movCanteiroData = await buscarItemNoCanteiro(itemId);
  atualizarInfoCanteiro();
}

function atualizarInfoCanteiro() {
  const total = Object.values(_movCanteiroData).reduce((s, v) => s + (v.quantidade || 0), 0);
  const row = document.getElementById('mov-item-canteiro-row');
  const qtd = document.getElementById('mov-item-qtd-canteiro');
  if (row) row.style.display = total > 0 ? 'flex' : 'none';
  if (qtd) qtd.textContent = total > 0 ? `${total} (em ${Object.keys(_movCanteiroData).length} obra(s))` : '—';
}

async function onObraOrigemRetornoChange() {
  const obraId = document.getElementById('mov-obra-origem-ret')?.value;
  const infoDiv = document.getElementById('mov-qtd-canteiro-info');
  if (!infoDiv) return;
  if (!obraId || !_movCanteiroData[obraId]) { infoDiv.style.display = 'none'; return; }
  const dado = _movCanteiroData[obraId];
  infoDiv.textContent = `📦 ${dado.quantidade} ${dado.unidade || ''} disponível para retorno`;
  infoDiv.style.display = 'block';
}
window.onObraOrigemRetornoChange = onObraOrigemRetornoChange;

async function onTransfOrigemChange() {
  const obraId = document.getElementById('mov-transf-origem')?.value;
  const infoDiv = document.getElementById('mov-transf-canteiro-info');
  if (!infoDiv) return;
  if (!obraId || !_movCanteiroData[obraId]) { infoDiv.style.display = 'none'; return; }
  const dado = _movCanteiroData[obraId];
  infoDiv.textContent = `📦 ${dado.quantidade} ${dado.unidade || ''} disponível para transferência`;
  infoDiv.style.display = 'block';
}
window.onTransfOrigemChange = onTransfOrigemChange;

function validarQuantidadeInput() {
  const qty = parseFloat(document.getElementById('mov-quantidade')?.value);
  const erroDiv = document.getElementById('mov-quantidade-erro');
  if (!erroDiv) return;
  if (!qty || qty <= 0) { erroDiv.textContent = 'Quantidade deve ser maior que zero.'; erroDiv.style.display = 'block'; return; }
  if (_movTipoAtual === 'saida_canteiro') {
    const item = getItemCache(_movItemAtual);
    if (item && qty > (item.quantidade || 0)) { erroDiv.textContent = `⚠ Excede o estoque (${item.quantidade} ${item.unidade}).`; erroDiv.style.display = 'block'; return; }
  }
  erroDiv.style.display = 'none';
}

async function confirmarMovimentacao() {
  const errosDiv = document.getElementById('mov-erros-lista');
  if (errosDiv) { errosDiv.style.display = 'none'; errosDiv.innerHTML = ''; }
  const dados = coletarDadosModal();
  const erros = validarFormMovimentacaoUI(dados);
  if (erros.length > 0) { exibirErrosModal(erros); return; }
  setBotaoCarregando(true);
  try {
    const dataHoje = new Date().toISOString().split('T')[0];
    const { tipo, itemId, quantidade, obraDestinoId, obraDestinoNome, obraOrigemId, obraOrigemNome, motivo } = dados;
    const item = DB.estoque.find(e => e.cod === itemId);
    if (!item) { exibirErrosModal(['Item não encontrado no estoque.']); setBotaoCarregando(false); return; }
    const saldo = (parseFloat(item.entrada)||0) - (parseFloat(item.saida)||0);

    if (tipo === 'saida_canteiro') {
      if (quantidade > saldo) { exibirErrosModal([`Estoque insuficiente. Disponível: ${saldo} ${item.unid}.`]); setBotaoCarregando(false); return; }
      item.saida = (parseFloat(item.saida)||0) + quantidade;
      DB.movEstoque.push({ data: dataHoje, codMat: itemId, mat: item.mat, obra: obraDestinoId, tipo: 'Saída', qtd: quantidade, frente: '', retirado: '', autor: '', obs: motivo || '' });
    } else if (tipo === 'retorno') {
      const qtdCanteiro = (DB.movEstoque.filter(m =>
        m.codMat === itemId && m.obra === obraOrigemId &&
        ((m.tipo||'').toLowerCase().includes('saída') || (m.tipo||'').toLowerCase().includes('saida'))
      ).reduce((s, m) => s + (parseFloat(m.qtd)||0), 0)) -
      (DB.movEstoque.filter(m =>
        m.codMat === itemId && m.obra === obraOrigemId &&
        ((m.tipo||'').toLowerCase() === 'retorno')
      ).reduce((s, m) => s + (parseFloat(m.qtd)||0), 0));
      if (quantidade > qtdCanteiro) { exibirErrosModal([`Disponível para retorno: ${qtdCanteiro} ${item.unid}.`]); setBotaoCarregando(false); return; }
      item.entrada = (parseFloat(item.entrada)||0) + quantidade;
      DB.movEstoque.push({ data: dataHoje, codMat: itemId, mat: item.mat, obra: obraOrigemId, tipo: 'Retorno', qtd: quantidade, frente: '', retirado: '', autor: '', obs: motivo || '' });
    } else if (tipo === 'transferencia') {
      if (quantidade > saldo) { exibirErrosModal([`Saldo insuficiente. Disponível: ${saldo} ${item.unid}.`]); setBotaoCarregando(false); return; }
      if (obraOrigemId === obraDestinoId) { exibirErrosModal(['Origem e destino não podem ser iguais.']); setBotaoCarregando(false); return; }
      item.saida = (parseFloat(item.saida)||0) + quantidade;
      DB.movEstoque.push({ data: dataHoje, codMat: itemId, mat: item.mat, obra: obraDestinoId, tipo: 'Transferência (Entrada)', qtd: quantidade, obs: `De: ${obraOrigemNome}` });
    } else if (tipo === 'ajuste') {
      if (!motivo || motivo.trim().length < 10) { exibirErrosModal(['Motivo mínimo: 10 caracteres.']); setBotaoCarregando(false); return; }
      const diff = quantidade - saldo;
      item.entrada = (parseFloat(item.entrada)||0) + diff;
      DB.movEstoque.push({ data: dataHoje, codMat: itemId, mat: item.mat, obra: '', tipo: 'Ajuste', qtd: Math.abs(diff), obs: motivo });
    }

    fecharModalMovimentacao();
    await persistDB();
    mostrarToast('✅ Movimentação registrada!', 'success');
    recarregarEstoque();
  } catch (err) {
    console.error(err);
    exibirErrosModal(['Erro inesperado.']);
  } finally { setBotaoCarregando(false); }
}
window.confirmarMovimentacao = confirmarMovimentacao;

function coletarDadosModal() {
  return {
    tipo: _movTipoAtual,
    itemId: document.getElementById('mov-item')?.value,
    quantidade: parseFloat(document.getElementById('mov-quantidade')?.value),
    motivo: document.getElementById('mov-motivo')?.value,
    obraDestinoId: document.getElementById('mov-obra-destino')?.value || null,
    obraDestinoNome: document.getElementById('mov-obra-destino')?.selectedOptions?.[0]?.text || null,
    obraOrigemId: document.getElementById('mov-obra-origem-ret')?.value || document.getElementById('mov-transf-origem')?.value || null,
    obraOrigemNome: document.getElementById('mov-obra-origem-ret')?.selectedOptions?.[0]?.text || document.getElementById('mov-transf-origem')?.selectedOptions?.[0]?.text || null,
  };
}

function validarFormMovimentacaoUI(dados) {
  const erros = [];
  const { tipo, itemId, quantidade, obraOrigemId, obraDestinoId, motivo } = dados;
  if (!tipo) erros.push('Selecione o tipo.');
  if (!itemId) erros.push('Selecione um item.');
  if (!quantidade || quantidade <= 0) erros.push('Quantidade inválida.');
  if (tipo === 'entrada') erros.push('⛔ Entrada não permitida neste modal.');
  if (tipo === 'saida_canteiro' && !obraDestinoId) erros.push('Selecione a obra de destino.');
  if (tipo === 'retorno' && !obraOrigemId) erros.push('Selecione a obra de origem.');
  if (tipo === 'transferencia') {
    if (!obraOrigemId) erros.push('Selecione a origem.');
    if (!obraDestinoId) erros.push('Selecione o destino.');
    if (obraOrigemId && obraDestinoId && obraOrigemId === obraDestinoId) erros.push('Origem e destino não podem ser iguais.');
  }
  if (tipo === 'ajuste' && (!motivo || motivo.trim().length < 10)) erros.push('Motivo mínimo: 10 caracteres.');
  return erros;
}

function exibirErrosModal(erros) {
  const div = document.getElementById('mov-erros-lista');
  if (!div) return;
  div.innerHTML = `<ul>${erros.map(e => `<li>${e}</li>`).join('')}</ul>`;
  div.style.display = 'block';
  div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function ocultarErrosModal() {
  const div = document.getElementById('mov-erros-lista');
  if (div) { div.style.display = 'none'; div.innerHTML = ''; }
}

function setBotaoCarregando(loading) {
  const btn = document.getElementById('mov-btn-confirmar');
  const spinner = document.getElementById('mov-btn-spinner');
  const texto = document.getElementById('mov-btn-texto');
  if (btn) btn.disabled = loading;
  if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
  if (texto) texto.style.display = loading ? 'none' : 'inline';
}
