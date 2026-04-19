// ==================== ALMOÇOS MODULE ====================

function renderAlmocos() {
  const tbody = document.getElementById('almocos-tbody');
  if (!tbody) return;

  const list = DB.almocos || [];
  const qStr = (document.getElementById('almoco-busca')?.value || '').toLowerCase();

  const filtered = list.map((a, i) => ({ ...a, _idx: i }))
                       .filter(a => JSON.stringify(a).toLowerCase().includes(qStr))
                       .sort((a, b) => new Date(b.data) - new Date(a.data));

  if (!filtered.length) {
    safeSetInner('almocos-tbody', '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text3)">Nenhum almoço registrado.</td></tr>');
  } else {
    const html = filtered.map(a => `
      <tr>
        <td>${fmtDate(a.data)}</td>
        <td>${obName(a.obra)}</td>
        <td><b>${sanitizeHTML(a.empreiteiro)}</b></td>
        <td>${a.qtd}</td>
        <td>${fmt(a.vunit)}</td>
        <td><b style="color:var(--accent)">${fmt(a.vtotal)}</b></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editAlmoco(${a._idx})" style="margin-right:8px">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem('almocos',${a._idx})">Excluir</button>
        </td>
      </tr>
    `).join('');
    safeSetInner('almocos-tbody', html);
  }

  renderAlmocosKPI(list);
}

window.renderAlmocos = renderAlmocos;

function renderAlmocosKPI(list) {
  const container = document.getElementById('almocos-kpi');
  if(!container) return;
  const hoje = today;
  const almoHoje = list.filter(a => a.data === hoje).reduce((acc, a) => acc + (parseFloat(a.qtd)||0), 0);
  const custoHoje = list.filter(a => a.data === hoje).reduce((acc, a) => acc + (parseFloat(a.vtotal)||0), 0);
  
  const todayDate = new Date();
  const fSemana = new Date(todayDate);
  const dayOfWeek = todayDate.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 
  fSemana.setDate(todayDate.getDate() - diff);
  const strSemana = fSemana.toISOString().split('T')[0];
  const qtdSemana = list.filter(a => a.data >= strSemana && a.data <= hoje).reduce((acc, a) => acc + (parseFloat(a.qtd)||0), 0);
  const custoSemana = list.filter(a => a.data >= strSemana && a.data <= hoje).reduce((acc, a) => acc + (parseFloat(a.vtotal)||0), 0);

  safeSetInner(container, `
    <div class="kpi-card">
      <div>
        <div class="kpi-label">Refeições Hoje</div>
        <div class="kpi-value">${almoHoje} un</div>
      </div>
    </div>
    <div class="kpi-card">
      <div>
        <div class="kpi-label">Custo Dia (Hj)</div>
        <div class="kpi-value">${fmt(custoHoje)}</div>
      </div>
    </div>
    <div class="kpi-card">
      <div>
        <div class="kpi-label">Refeições Semana</div>
        <div class="kpi-value">${qtdSemana} un</div>
      </div>
    </div>
    <div class="kpi-card">
      <div>
        <div class="kpi-label">Custo Semana</div>
        <div class="kpi-value">${fmt(custoSemana)}</div>
      </div>
    </div>
  `);

  // Resumo Semanal por Obra
  const resumoContainer = document.getElementById('almocos-resumo');
  if(resumoContainer) {
    const weeklyList = list.filter(a => a.data >= strSemana && a.data <= hoje);
    const agrupadoSemanal = {};
    weeklyList.forEach(a => {
      if(!agrupadoSemanal[a.obra]) agrupadoSemanal[a.obra] = { qtd: 0, total: 0 };
      agrupadoSemanal[a.obra].qtd += (parseFloat(a.qtd)||0);
      agrupadoSemanal[a.obra].total += (parseFloat(a.vtotal)||0);
    });
    
    safeSetInner(resumoContainer, Object.keys(agrupadoSemanal).map(obra => `
      <div class="kpi-card" style="padding:16px;">
        <div style="font-size:12px;color:var(--text3)">${obName(obra)}</div>
        <div style="font-weight:600;margin-top:6px">${agrupadoSemanal[obra].qtd} <small style="font-size:10px;font-weight:normal">ref. somadas</small></div>
        <div style="font-size:14px;color:var(--red);margin-top:4px">${fmt(agrupadoSemanal[obra].total)}</div>
      </div>
    `).join('') || '<div style="color:var(--text3);">Sem consolidação semanal.</div>');
  }
}

function calcAlmocoTotal() {
  const q = parseFloat(document.getElementById('al-qtd').value) || 0;
  const u = parseFloat(document.getElementById('al-vunit').value) || 0;
  const target = document.getElementById('al-vtotal');
  if (target) target.value = (q * u).toFixed(2);
}

window.calcAlmocoTotal = calcAlmocoTotal;

async function saveAlmoco() {
  const data = {
    data: document.getElementById('al-data').value,
    obra: document.getElementById('al-obra').value,
    empreiteiro: document.getElementById('al-empreiteiro').value,
    qtd: parseFloat(document.getElementById('al-qtd').value) || 0,
    vunit: parseFloat(document.getElementById('al-vunit').value) || 0,
    vtotal: parseFloat(document.getElementById('al-vtotal').value) || 0,
    obs: document.getElementById('al-obs').value
  };
  const editIdx = parseInt(document.getElementById('al-edit-idx').value) || -1;
  if (editIdx >= 0) {
    DB.almocos[editIdx] = data;
    toast('Lançamento de almoço atualizado!');
  } else {
    DB.almocos.push(data);
    toast('Almoço registrado!');
  }
  closeModal('modal-almoco'); await persistDB(); 
  if (typeof renderAlmocos === 'function') renderAlmocos();
}

window.saveAlmoco = saveAlmoco;

async function editAlmoco(idx) {
  await openModal('modal-almoco');
  document.getElementById('al-edit-idx').value = idx;
  const a = DB.almocos[idx];
  document.getElementById('al-data').value = a.data;
  document.getElementById('al-obra').value = a.obra;
  document.getElementById('al-empreiteiro').value = a.empreiteiro;
  document.getElementById('al-qtd').value = a.qtd;
  document.getElementById('al-vunit').value = a.vunit;
  document.getElementById('al-vtotal').value = a.vtotal;
  document.getElementById('al-obs').value = a.obs || '';
}

window.editAlmoco = editAlmoco;
