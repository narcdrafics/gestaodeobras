// ==================== ESTOQUE MODULE ====================

function renderEstoque() {
  safeSetInner('est-tbody', DB.estoque.length
    ? DB.estoque.map((e, i) => {
      const saldo = window.calcSaldo(e);
      const s = window.estoqueStatus(e);
      return `<tr>
          <td><span class="cod">${sanitizeHTML(e.cod)}</span></td>
          <td>${sanitizeHTML(e.mat)}</td>
          <td>${sanitizeHTML(e.unid)}</td>
          <td>${obName(e.obra)}</td>
          <td>${e.min}</td>
          <td>${e.entrada}</td>
          <td>${e.saida}</td>
          <td><b style="color:${saldo <= e.min ? 'var(--red)' : saldo <= e.min * 1.5 ? 'var(--orange)' : 'var(--green)'}">${saldo}</b></td>
          <td>${fmt(e.custo)}</td>
          <td>${fmt(saldo * e.custo)}</td>
          <td>${statusBadge(s)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="editEstoque(${i})" style="margin-right:8px">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteItem('estoque',${i})">Excluir</button>
          </td>
        </tr>`;
    }).join('')
    : uiEmptyState('Estoque Zerado', 'Cadastre cimento, areia ou ferramentas no almoxarifado virtual.', '📦', 'Cadastrar Material', 'openModal(\'modal-estoque\')'));
}

window.renderEstoque = renderEstoque;

function renderMovEstoque() {
  safeSetInner('movest-tbody', DB.movEstoque.length
    ? DB.movEstoque.map((m, i) => `<tr>
        <td>${fmtDate(m.data)}</td>
        <td><span class="cod">${sanitizeHTML(m.codMat)}</span></td>
        <td>${sanitizeHTML(m.mat)}</td>
        <td>${obName(m.obra)}</td>
        <td><span class="badge ${m.tipo === 'Entrada' ? 'badge-green' : m.tipo === 'Saída' ? 'badge-orange' : m.tipo.includes('Entrada') ? 'badge-blue' : 'badge-purple'}">${sanitizeHTML(m.tipo)}</span></td>
        <td>${m.qtd}</td>
        <td>${sanitizeHTML(m.frente || '—')}</td>
        <td>${sanitizeHTML(m.retirado || '—')}</td>
        <td>${sanitizeHTML(m.autor || '—')}</td>
        <td>${sanitizeHTML(m.nf || '—')}</td>
        <td>${fmt(m.vunit)}</td>
        <td>${fmt(m.vtotal)}</td>
        <td>${sanitizeHTML(m.obs || '—')}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editMovEstoque(${i})" style="margin-right:8px">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem('movEstoque',${i})">Excluir</button>
        </td>
      </tr>`).join('')
    : uiEmptyState('Sem Movimentações', 'O depósito não teve entradas ou saídas de materiais ainda.', '🔄', 'Registrar Movimento', 'openModal(\'modal-movest\')'));
}


window.renderMovEstoque = renderMovEstoque;

async function saveEstoque() {
  const data = {
    cod: document.getElementById('es-cod').value,
    mat: document.getElementById('es-mat').value,
    unid: document.getElementById('es-unid').value,
    obra: document.getElementById('es-obra').value,
    min: parseFloat(document.getElementById('es-min').value) || 0,
    entrada: parseFloat(document.getElementById('es-entrada').value) || 0,
    saida: 0,
    custo: parseFloat(document.getElementById('es-custo').value) || 0,
    obs: document.getElementById('es-obs').value
  };
  const editIdx = parseInt(document.getElementById('es-edit-idx').value) || -1;
  if (editIdx >= 0) {
    if (DB.estoque[editIdx].saida !== undefined) {
      data.saida = DB.estoque[editIdx].saida;
    }
    DB.estoque[editIdx] = data;
    toast('Item de estoque atualizado!');
  } else {
    DB.estoque.push(data);
    toast('Item de estoque cadastrado!');
  }
  closeModal('modal-estoque'); 
  await persistDB(); 
  renderEstoque();
}

async function editEstoque(idx) {
  await openModal('modal-estoque');
  document.getElementById('es-edit-idx').value = idx;
  const e = DB.estoque[idx];
  document.getElementById('es-cod').value = e.cod;
  document.getElementById('es-mat').value = e.mat;
  document.getElementById('es-unid').value = e.unid;
  document.getElementById('es-obra').value = e.obra;
  document.getElementById('es-min').value = e.min;
  document.getElementById('es-entrada').value = e.entrada;
  document.getElementById('es-custo').value = e.custo;
  document.getElementById('es-obs').value = e.obs || '';
}

async function saveMovEstoque() {
  const codMat = document.getElementById('mv-mat').value;
  let e = DB.estoque.find(x => x.cod === codMat);
  const tipo = document.getElementById('mv-tipo').value;
  const qtd = parseFloat(document.getElementById('mv-qtd').value) || 0;

  const obraOrigem = document.getElementById('mv-obra').value;
  const obraDestino = document.getElementById('mv-destino-obra') ? document.getElementById('mv-destino-obra').value : '';
  const matName = document.getElementById('mv-matname').value;

  if (tipo === 'Transferência') {
    if (!obraDestino || obraOrigem === obraDestino) {
      toast('Selecione uma Obra Destino diferente da Origem!', 'error');
      return;
    }
    if (e) {
      if (qtd > window.calcSaldo(e)) { toast('Qtd. maior que saldo na Origem!', 'error'); return; }
      e.saida += qtd;
    }
    let eDest = DB.estoque.find(x => x.obra === obraDestino && x.mat === e.mat && x.unid === e.unid);
    if (!eDest) {
      eDest = {
        cod: 'MAT-' + Date.now() + Math.floor(Math.random() * 1000),
        mat: e.mat, unid: e.unid, obra: obraDestino,
        min: e.min || 0, entrada: 0, saida: 0, custo: e.custo || 0, obs: 'Transferido.'
      };
      DB.estoque.push(eDest);
    }
    eDest.entrada += qtd;

    const dataSaida = {
      data: document.getElementById('mv-data').value,
      codMat, mat: matName,
      obra: obraOrigem,
      tipo: 'Transferência (Saída)', qtd,
      frente: document.getElementById('mv-frente').value,
      retirado: document.getElementById('mv-retirado').value,
      autor: document.getElementById('mv-autor').value,
      nf: document.getElementById('mv-nf').value,
      vunit: parseFloat(document.getElementById('mv-vunit').value) || 0,
      vtotal: parseFloat(document.getElementById('mv-vtotal').value) || 0,
      obs: 'Destino: ' + obraDestino + '. ' + document.getElementById('mv-obs').value
    };
    DB.movEstoque.push(dataSaida);

    const dataEntrada = {
      ...dataSaida,
      tipo: 'Transferência (Entrada)',
      obra: obraDestino,
      codMat: eDest.cod,
      obs: 'Origem: ' + obraOrigem + '. ' + document.getElementById('mv-obs').value
    };
    DB.movEstoque.push(dataEntrada);
    toast('Transferência Dupla registrada!');
  } else {
    if (e) {
      if (tipo === 'Entrada') e.entrada += qtd;
      else { if (qtd > window.calcSaldo(e)) { toast('Qtd. maior que saldo!', 'error'); return; } e.saida += qtd; }
    }
    const data = {
      data: document.getElementById('mv-data').value,
      codMat, mat: matName,
      obra: obraOrigem,
      tipo, qtd,
      frente: document.getElementById('mv-frente').value,
      retirado: document.getElementById('mv-retirado').value,
      autor: document.getElementById('mv-autor').value,
      nf: document.getElementById('mv-nf').value,
      vunit: parseFloat(document.getElementById('mv-vunit').value) || 0,
      vtotal: parseFloat(document.getElementById('mv-vtotal').value) || 0,
      obs: document.getElementById('mv-obs').value
    };
    const editIdx = parseInt(document.getElementById('mv-edit-idx').value) || -1;
    if (editIdx >= 0) {
      DB.movEstoque[editIdx] = data;
      toast('Movimentação atualizada!');
    } else {
      DB.movEstoque.push(data);
      toast('Movimentação registrada!');
    }
  }
  closeModal('modal-movest'); 
  await persistDB(); 
  renderMovEstoque(); 
  renderEstoque();
}

async function editMovEstoque(idx) {
  await openModal('modal-movest');
  document.getElementById('mv-edit-idx').value = idx;
  const m = DB.movEstoque[idx];
  document.getElementById('mv-data').value = m.data;
  document.getElementById('mv-mat').value = m.codMat;
  document.getElementById('mv-matname').value = m.mat;
  document.getElementById('mv-obra').value = m.obra;
  if (m.tipo.includes('Transferência')) {
    document.getElementById('mv-tipo').value = 'Transferência';
    if (typeof window.toggleDestinoMov === 'function') window.toggleDestinoMov();
  } else {
    document.getElementById('mv-tipo').value = m.tipo;
    if (typeof window.toggleDestinoMov === 'function') window.toggleDestinoMov();
  }
  document.getElementById('mv-qtd').value = m.qtd;
  document.getElementById('mv-frente').value = m.frente;
  document.getElementById('mv-retirado').value = m.retirado;
  document.getElementById('mv-autor').value = m.autor;
  document.getElementById('mv-nf').value = m.nf;
  document.getElementById('mv-vunit').value = m.vunit;
  document.getElementById('mv-vtotal').value = m.vtotal;
  document.getElementById('mv-obs').value = m.obs || '';
}

window.saveEstoque = saveEstoque;
window.editEstoque = editEstoque;
window.saveMovEstoque = saveMovEstoque;
window.editMovEstoque = editMovEstoque;

function calcMovTotal() {
  const q = parseFloat(document.getElementById('mv-qtd').value) || 0;
  const v = parseFloat(document.getElementById('mv-vunit').value) || 0;
  document.getElementById('mv-vtotal').value = (q * v).toFixed(2);
}

function fillMatInfo() {
  const cod = document.getElementById('mv-mat').value;
  const mat = DB.estoque.find(x => x.cod === cod);
  if (mat) {
    document.getElementById('mv-matname').value = mat.mat;
    document.getElementById('mv-vunit').value = mat.custo || 0;
    calcMovTotal();
  }
}

window.calcMovTotal = calcMovTotal;
window.fillMatInfo = fillMatInfo;
