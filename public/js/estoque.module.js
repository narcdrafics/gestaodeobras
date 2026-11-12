// js/estoque.module.js
// Regras de validação e UI do modal de movimentação do estoque.
// O estado canônico fica em DB.estoque / DB.movEstoque (persistido por persistDB).
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

function buscarItemNoCanteiro(itemId) {
  // Deriva o saldo no canteiro do mesmo histórico usado por confirmarMovimentacao(),
  // mantendo a UI consistente com a validação de retorno.
  const saldoPorObra = {};
  (DB.movEstoque || []).forEach(mov => {
    if (mov.codMat !== itemId || !mov.obra) return;
    const tipo = (mov.tipo || '').toLowerCase();
    const qtd = parseFloat(mov.qtd) || 0;
    if (tipo.includes('saída') || tipo.includes('saida')) {
      saldoPorObra[mov.obra] = (saldoPorObra[mov.obra] || 0) + qtd;
    } else if (tipo === 'retorno') {
      saldoPorObra[mov.obra] = (saldoPorObra[mov.obra] || 0) - qtd;
    }
  });

  const item = (DB.estoque || []).find(e => e.cod === itemId);
  const result = {};
  Object.entries(saldoPorObra).forEach(([obraId, quantidade]) => {
    if (quantidade <= 0) return;
    const obra = (DB.obras || []).find(o => o.cod === obraId);
    result[obraId] = {
      obraId,
      obraNome: obra?.nome || obraId,
      quantidade,
      unidade: item?.unid,
    };
  });
  return result;
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
  const editIdx = document.getElementById('mov-edit-idx'); if (editIdx) editIdx.value = '-1';
  const titulo = document.getElementById('mov-modal-titulo'); if (titulo) titulo.textContent = 'Movimentação de Estoque';
  const aviso = document.querySelector('.mov-aviso-entrada'); if (aviso) aviso.style.display = '';
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

    // Verificar modo edição
    const editIdxEl = document.getElementById('mov-edit-idx');
    const editIdx = editIdxEl ? parseInt(editIdxEl.value) : -1;

    if (editIdx >= 0) {
      // MODO EDIÇÃO: apenas atualiza o registro sem mexer nos saldos
      const movAntigo = DB.movEstoque[editIdx];
      DB.movEstoque[editIdx] = {
        ...movAntigo,
        data: dataHoje,
        codMat: itemId,
        mat: item.mat,
        qtd: quantidade,
        obs: motivo || movAntigo.obs || '',
        obra: obraDestinoId || obraOrigemId || movAntigo.obra || '',
      };
      fecharModalMovimentacao();
      await persistDB();
      mostrarToast('✅ Movimentação atualizada!', 'success');
      if (typeof renderMovEstoque === 'function') renderMovEstoque();
      if (typeof recarregarEstoque === 'function') recarregarEstoque();
      return;
    }

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

// Abre o novo modal em modo edição, pré-populando os campos com o registro existente
function editarMovimentacaoNovoModal(idx) {
  const m = DB.movEstoque[idx];
  if (!m) return;

  // Mapeia tipo legado → tipo do novo modal
  const mapaLegadoParaNovo = {
    'saída': 'saida_canteiro', 'saida': 'saida_canteiro',
    'retorno': 'retorno',
    'transferência (saída)': 'transferencia', 'transferencia': 'transferencia',
    'ajuste': 'ajuste',
  };
  const tipoNovo = mapaLegadoParaNovo[(m.tipo || '').toLowerCase()];

  // Inicializa o modal (abre + reseta)
  abrirModalMovimentacao(m.codMat);

  // Aguarda o próximo tick para garantir que o DOM foi populado
  setTimeout(() => {
    // Marca modo edição
    const editIdxEl = document.getElementById('mov-edit-idx');
    if (editIdxEl) editIdxEl.value = idx;

    // Atualiza título e oculta aviso (não é nova movimentação)
    const titulo = document.getElementById('mov-modal-titulo');
    if (titulo) titulo.textContent = '✏️ Editar Movimentação';
    const aviso = document.querySelector('.mov-aviso-entrada');
    if (aviso) aviso.style.display = 'none';

    // Seleciona o tipo correto
    if (tipoNovo) {
      selecionarTipoMov(tipoNovo);
    }

    // Pré-preenche item
    const selectItem = document.getElementById('mov-item');
    if (selectItem && m.codMat) {
      selectItem.value = m.codMat;
      if (typeof onItemChange === 'function') onItemChange();
    }

    // Quantidade
    const qEl = document.getElementById('mov-quantidade');
    if (qEl) qEl.value = m.qtd;

    // Motivo/obs
    const motEl = document.getElementById('mov-motivo');
    if (motEl) motEl.value = m.obs || '';

    // Obra conforme tipo
    if (tipoNovo === 'saida_canteiro') {
      const sel = document.getElementById('mov-obra-destino');
      if (sel) sel.value = m.obra || '';
    } else if (tipoNovo === 'retorno') {
      const sel = document.getElementById('mov-obra-origem-ret');
      if (sel) { sel.value = m.obra || ''; if (typeof onObraOrigemRetornoChange === 'function') onObraOrigemRetornoChange(); }
    } else if (tipoNovo === 'transferencia') {
      const selOrig = document.getElementById('mov-transf-origem');
      if (selOrig) selOrig.value = m.obra || '';
    }

    // Habilita o botão confirmar
    const btnC = document.getElementById('mov-btn-confirmar');
    if (btnC) btnC.disabled = false;
    const btnTxt = document.getElementById('mov-btn-texto');
    if (btnTxt) btnTxt.textContent = '💾 Salvar Alterações';
  }, 50);
}
window.editarMovimentacaoNovoModal = editarMovimentacaoNovoModal;

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
