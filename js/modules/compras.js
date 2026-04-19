// ==================== COMPRAS MODULE ====================

function renderCompras() {
  safeSetInner('compras-tbody', DB.compras.length
    ? DB.compras.map((c, i) => `<tr>
        <td><b>${sanitizeHTML(c.num)}</b></td>
        <td>${fmtDate(c.data)}</td>
        <td>${obName(c.obra)}</td>
        <td><span class="cod">${sanitizeHTML(c.mat)}</span></td>
        <td>${c.qtd} ${sanitizeHTML(c.unid)}</td>
        <td>${statusBadge(c.status)}</td>
        <td>${sanitizeHTML(c.forn)}</td>
        <td>${fmt(c.vtotal)}</td>
        <td>${fmtDate(c.prazo)}</td>
        <td>${sanitizeHTML(c.conf || '—')}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editCompra(${i})" style="margin-right:8px">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem('compras',${i})">Excluir</button>
        </td>
      </tr>`).join('')
    : uiEmptyState('Nenhuma Compra', 'Crie um pedido de material novo para acompanhar as entregas dos fornecedores.', '🛒', 'Novo Pedido', 'openModal(\'modal-compra\')'));
}


window.renderCompras = renderCompras;

async function saveCompra() {
  const data = {
    num: document.getElementById('cp-num').value,
    data: document.getElementById('cp-data').value,
    obra: document.getElementById('cp-obra').value,
    etapa: document.getElementById('cp-etapa').value,
    mat: document.getElementById('cp-mat').value,
    qtd: parseFloat(document.getElementById('cp-qtd').value) || 0,
    unid: document.getElementById('cp-unid').value,
    status: document.getElementById('cp-status').value,
    forn: document.getElementById('cp-forn').value,
    vunit: parseFloat(document.getElementById('cp-vunit').value) || 0,
    vtotal: parseFloat(document.getElementById('cp-vtotal').value) || 0,
    pixkey: document.getElementById('cp-pixkey').value,
    vorc: parseFloat(document.getElementById('cp-vorc').value) || 0,
    prazo: document.getElementById('cp-prazo').value,
    receb: document.getElementById('cp-receb').value,
    conf: document.getElementById('cp-conf').value,
    obs: document.getElementById('cp-obs').value
  };
  const editIdx = parseInt(document.getElementById('cp-edit-idx').value) || -1;
  if (editIdx >= 0) {
    DB.compras[editIdx] = data;
    toast('Compra atualizada!');
  } else {
    DB.compras.push(data);
    toast('Compra registrada!');
  }
  closeModal('modal-compra'); 
  await persistDB(); 
  renderCompras();
}

async function editCompra(idx) {
  await openModal('modal-compra');
  document.getElementById('cp-edit-idx').value = idx;
  const c = DB.compras[idx];
  document.getElementById('cp-num').value = c.num;
  document.getElementById('cp-data').value = c.data;
  document.getElementById('cp-obra').value = c.obra;
  document.getElementById('cp-etapa').value = c.etapa || '';
  document.getElementById('cp-mat').value = c.mat;
  document.getElementById('cp-qtd').value = c.qtd;
  document.getElementById('cp-unid').value = c.unid;
  document.getElementById('cp-status').value = c.status;
  document.getElementById('cp-forn').value = c.forn;
  document.getElementById('cp-vunit').value = c.vunit;
  document.getElementById('cp-vtotal').value = c.vtotal;
  document.getElementById('cp-pixkey').value = c.pixkey || '';
  document.getElementById('cp-vorc').value = c.vorc;
  document.getElementById('cp-prazo').value = c.prazo;
  document.getElementById('cp-receb').value = c.receb;
  document.getElementById('cp-conf').value = c.conf;
  document.getElementById('cp-obs').value = c.obs || '';
}

window.saveCompra = saveCompra;
window.editCompra = editCompra;

function calcCompraTotal() {
  const q = parseFloat(document.getElementById('cp-qtd').value) || 0;
  const v = parseFloat(document.getElementById('cp-vunit').value) || 0;
  document.getElementById('cp-vtotal').value = (q * v).toFixed(2);
}

window.calcCompraTotal = calcCompraTotal;
