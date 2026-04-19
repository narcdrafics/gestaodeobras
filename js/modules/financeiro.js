// ==================== FINANCEIRO MODULE ====================

function renderFinanceiro() {
  const selMonth = document.getElementById('fin-month');
  const selYear = document.getElementById('fin-year');
  const selView = document.getElementById('fin-view-type');

  if (!selMonth || !selYear || !selView) return;

  if (selYear.options.length === 0) {
    const curY = new Date().getFullYear();
    [curY, curY - 1, curY - 2].forEach(y => {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      selYear.appendChild(opt);
    });
    selMonth.value = new Date().getMonth() + 1;
  }

  const mm = selMonth.value;
  const yy = selYear.value;
  const view = selView.value;
  window.finViewType = view; 

  const getNome = (c) => { const o = DB.obras.find(x => x.cod === c); return o ? o.nome : (c || 'Geral'); };
  
  const summary = window.summarizeFinance(DB.financeiro, DB.presenca, DB.medicao, DB.almocos, yy, mm, view) || {};
  let allFin = summary.all || [];
  const perTotals = summary.totalsByPeriod || {};

  let sumHtml = '';
  const periods = view === 'quinzenal' ? ['1ª Quinzena', '2ª Quinzena'] : ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'];
  
  periods.forEach(p => {
    const data = perTotals[p] || { real: 0, items: 0 };
    if (data.items === 0 && p === 'Semana 5') return; 

    sumHtml += `<div class="kpi-card" style="border-left:4px solid var(--accent); background: var(--bg2);">
      <div class="kpi-label" style="opacity:0.8">${sanitizeHTML(p)}</div>
      <div class="kpi-val" style="font-size:20px; font-weight:800; margin: 4px 0;">${fmt(data.real)}</div>
      <div style="font-size:11px; color:var(--text3)">${data.items} registros</div>
    </div>`;
  });

  safeSetInner('fin-summary', sumHtml);

  const grouped = {};
  allFin.forEach(f => {
    const type = f.tipo || 'Outros';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(f);
  });

  const typeOrder = ['mão de obra própria', 'empreiteiro', 'material', 'equipamento', 'almoço empreiteiro'];
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const ia = typeOrder.indexOf(a.toLowerCase());
    const ib = typeOrder.indexOf(b.toLowerCase());
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  let tbodyHtml = '';
  sortedKeys.forEach(type => {
    const rows = grouped[type];
    const subPrev = rows.reduce((a, b) => a + (Number(b.prev) || 0), 0);
    const subReal = rows.reduce((a, b) => a + (Number(b.real) || 0), 0);

    tbodyHtml += `<tr class="group-header-fin" data-group="${sanitizeHTML(type.toLowerCase())}" style="background:var(--bg3); font-weight:700;">
      <td colspan="6" style="text-transform:uppercase; font-size:11px; color:var(--accent); letter-spacing:1px">📂 ${sanitizeHTML(type)} <small style="color:var(--text3); font-weight:400">(${rows.length})</small></td>
      <td style="font-family:'IBM Plex Mono', monospace; font-size:12px">${fmt(subPrev)}</td>
      <td style="font-family:'IBM Plex Mono', monospace; font-size:12px">${fmt(subReal)}</td>
      <td colspan="5" style="color:${subReal > subPrev ? 'var(--red)' : 'var(--green)'}; font-size:12px; font-weight:bold">Subtotal: ${fmt(subReal - subPrev)}</td>
    </tr>`;

    rows.forEach(f => {
      const diff = f.real - f.prev;
      let editBtn = '';
      if (f.source === 'fin') editBtn = `<button class="btn btn-secondary btn-sm" onclick="editFinanceiro(${f.idx})" style="margin-right:8px">✏️</button>`;
      else if (f.source === 'med') editBtn = `<button class="btn btn-secondary btn-sm" onclick="editMedicao(${f.idx})" style="margin-right:8px">📐 Med.</button>`;
      else if (f.source === 'pre') editBtn = `<button class="btn btn-secondary btn-sm" onclick="editPresenca(${f.idx})" style="margin-right:8px">⏱️ Dia.</button>`;
      else if (f.source === 'alm') editBtn = `<button class="btn btn-secondary btn-sm" onclick="editAlmoco(${f.idx})" style="margin-right:8px">🍱 Alm.</button>`;

      let delBtn = '';
      if (f.source === 'fin') delBtn = `<button class="btn btn-danger btn-sm" onclick="deleteItem('financeiro',${f.idx})">Excluir</button>`;
      else if (f.source === 'alm') delBtn = `<button class="btn btn-danger btn-sm" onclick="deleteItem('almocos',${f.idx})">Excluir</button>`;

      let payBtn = '';
      if (f.status !== 'Pago') payBtn = `<button class="btn btn-success btn-sm" onclick="initiatePixPayment('${f.source}', ${f.idx})" style="margin-right:8px; background:var(--green); border-color:var(--green);" title="Pagar via PIX">💸</button>`;

      const isIncome = (f.tipo || '').toLowerCase().includes('receita') || (f.tipo || '').toLowerCase().includes('entrada');
      const valColor = isIncome ? 'var(--green)' : 'var(--text)';
      
      const sourceMap = { 'fin': { icon: '💳' }, 'pre': { icon: '⏱️' }, 'med': { icon: '📐' }, 'alm': { icon: '🍱' } };
      const src = sourceMap[f.source] || { icon: '❓' };
      const srcBadge = f.source !== 'fin' ? `<span class="badge badge-gray" style="font-size:10px;margin-left:4px;opacity:0.7">Automático</span>` : '';

      tbodyHtml += `<tr class="fin-row" data-group-ref="${sanitizeHTML(type.toLowerCase())}" data-tipo="${sanitizeHTML((f.tipo||'').toLowerCase())}" data-status="${sanitizeHTML((f.status||'').toLowerCase())}" data-busca="${sanitizeHTML(getNome(f.obra).toLowerCase())} ${sanitizeHTML((f.desc||'').toLowerCase())} ${sanitizeHTML((f.forn||'').toLowerCase())}">
          <td data-label="Data">${fmtDate(f.data)}</td>
          <td data-label="Obra">${sanitizeHTML(getNome(f.obra))}</td>
          <td data-label="Etapa"><small>${sanitizeHTML(f.etapa)}</small></td>
          <td data-label="Tipo" style="white-space:nowrap">${src.icon} ${sanitizeHTML(f.tipo)}${srcBadge}</td>
          <td data-label="Descrição"><b>${sanitizeHTML(f.desc)}</b></td>
          <td data-label="Fornec./Benef."><small>${sanitizeHTML(f.forn)}</small></td>
          <td data-label="Vl. Prev.">${fmt(f.prev)}</td>
          <td data-label="Vl. Real." style="color:${valColor};font-weight:${isIncome?'600':'400'}">${fmt(f.real)}</td>
          <td data-label="Diferença" style="color:${diff > 0 ? 'var(--red)' : diff < 0 ? 'var(--green)' : 'var(--text)'}">${fmt(diff)}</td>
          <td data-label="Pgto"><small>${sanitizeHTML(f.pgto)}</small></td>
          <td data-label="Status">${statusBadge(f.status)}</td>
          <td data-label="NF"><small>${sanitizeHTML(f.nf)}</small></td>
          <td>${payBtn}${editBtn}${delBtn}</td>
        </tr>`;
    });
  });

  safeSetInner('fin-tbody', tbodyHtml || uiEmptyState('Financeiro Limpo', 'Suas contas a pagar, recebimentos e extratos aparecerão agrupados aqui.', '💰', 'Lançar Custo ou Receita', "openModal('modal-financeiro')"));

  window._allFinRows = allFin;
  
  if (typeof filterFinanceiro === 'function') filterFinanceiro();
  if (typeof renderWeeklyPaymentReport === 'function') renderWeeklyPaymentReport();
  if (typeof renderWorkerPaymentReport === 'function') renderWorkerPaymentReport();
  if (typeof renderDetailedWeeklyPaymentReport === 'function') renderDetailedWeeklyPaymentReport();
  
  const attachReportListeners = () => {
    const btnToggleWeekly = document.getElementById('btn-toggle-weekly');
    if (btnToggleWeekly) btnToggleWeekly.onclick = () => toggleWeeklyReport();
    
    const btnCopyWorker = document.getElementById('btn-copy-worker');
    if (btnCopyWorker) btnCopyWorker.onclick = () => copyWorkerReport();
    
    const btnToggleWorker = document.getElementById('btn-toggle-worker');
    if (btnToggleWorker) btnToggleWorker.onclick = () => toggleWorkerReport();
    
    const btnCopyDetailed = document.getElementById('btn-copy-detailed');
    if (btnCopyDetailed) btnCopyDetailed.onclick = () => copyDetailedWeeklyReport();
    
    const btnPrintDetailed = document.getElementById('btn-print-detailed');
    if (btnPrintDetailed) btnPrintDetailed.onclick = () => printDetailedWeeklyReport();
    
    const btnToggleDetailed = document.getElementById('btn-toggle-detailed');
    if (btnToggleDetailed) btnToggleDetailed.onclick = () => toggleDetailedWeeklyReport();
  };
  
  attachReportListeners();
}

window.renderFinanceiro = renderFinanceiro;

function filterFinanceiro() {
  const tipo   = (document.getElementById('fin-tipo-filter')?.value   || '').toLowerCase().trim();
  const status = (document.getElementById('fin-status-filter')?.value || '').toLowerCase().trim();
  const busca  = (document.getElementById('fin-busca')?.value         || '').toLowerCase().trim();
  
  const headers = {};
  document.querySelectorAll('#fin-tbody .group-header-fin').forEach(h => {
    headers[h.dataset.group] = h;
    h.style.display = 'none'; 
  });

  document.querySelectorAll('#fin-tbody .fin-row').forEach(row => {
    const rt = (row.dataset.tipo   || '');
    const rs = (row.dataset.status || '');
    const rb = (row.dataset.busca  || '') + ' ' + (row.innerText || '').toLowerCase();
    const ok = (!tipo   || rt.includes(tipo))
            && (!status || rs.includes(status))
            && (!busca  || rb.includes(busca));
    
    if (ok) {
      row.style.display = '';
      const groupRef = row.dataset.groupRef;
      if (headers[groupRef]) headers[groupRef].style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

window.filterFinanceiro = filterFinanceiro;

let expandedWeeks = [];

function renderWeeklyPaymentReport() {
  const selMonth = document.getElementById('fin-month');
  const selYear = document.getElementById('fin-year');
  
  if (!selMonth || !selYear) return;
  
  const mm = selMonth.value;
  const yy = selYear.value;
  
  const report = window.generateWeeklyPaymentReport(DB.financeiro, DB.presenca, DB.medicao, DB.almocos, yy, mm);
  
  if (!report || report.length === 0) {
    safeSetInner('weekly-report-content', `
      <div style="padding:20px; text-align:center; color:var(--text3)">
        <div style="font-size:32px; margin-bottom:8px">📭</div>
        <div>Nenhum pagamento registrado neste mês</div>
      </div>
    `);
    return;
  }
  
  const totalGeral = report.reduce((sum, w) => sum + w.total, 0);
  const totalRegistros = report.reduce((sum, w) => sum + w.count, 0);
  
  let html = `
    <div style="padding:12px; background:var(--bg2); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <div>
        <span style="font-weight:600; color:var(--text2)">Total do Mês:</span>
        <span style="font-size:18px; font-weight:800; color:var(--green); margin-left:8px">${fmt(totalGeral)}</span>
      </div>
      <div style="font-size:13px; color:var(--text3)">
        ${totalRegistros} pagamentos em ${report.length} semana(s)
      </div>
    </div>
    <table style="width:100%; border-collapse:collapse; font-size:13px">
      <thead>
        <tr style="background:var(--bg3); text-align:left">
          <th style="padding:10px; border-bottom:2px solid var(--border)">Período</th>
          <th style="padding:10px; border-bottom:2px solid var(--border); text-align:right">Total Pago</th>
          <th style="padding:10px; border-bottom:2px solid var(--border); text-align:center">Registros</th>
          <th style="padding:10px; border-bottom:2px solid var(--border); text-align:right">% do Mês</th>
          <th style="padding:10px; border-bottom:2px solid var(--border)">Detalhes</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  report.forEach((week, idx) => {
    const pct = totalGeral > 0 ? ((week.total / totalGeral) * 100).toFixed(1) : 0;
    const isExpanded = expandedWeeks.includes(idx);
    
    html += `
      <tr style="border-bottom:1px solid var(--border); cursor:pointer" onclick="toggleWeekDetails(${idx})">
        <td style="padding:10px; font-weight:600">
          <span style="color:var(--accent)">▶</span> ${sanitizeHTML(week.label)}
        </td>
        <td style="padding:10px; text-align:right; font-weight:700; color:var(--green)">${fmt(week.total)}</td>
        <td style="padding:10px; text-align:center">${week.count}</td>
        <td style="padding:10px; text-align:right">
          <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px">
            <div style="width:60px; height:6px; background:var(--bg); border-radius:3px; overflow:hidden">
              <div style="width:${pct}%; height:100%; background:var(--accent); border-radius:3px"></div>
            </div>
            <span>${pct}%</span>
          </div>
        </td>
        <td style="padding:10px">
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); toggleWeekDetails(${idx})">
            ${isExpanded ? 'Ocultar' : 'Ver Detalhes'}
          </button>
        </td>
      </tr>
    `;
    
    if (isExpanded) {
      html += `
        <tr style="background:var(--bg2)">
          <td colspan="5" style="padding:8px 10px">
            <div style="font-size:11px; color:var(--text3); margin-bottom:4px; text-transform:uppercase; letter-spacing:1px">Por Tipo de Custo</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px">
              ${Object.entries(week.byType).map(([tipo, val]) => `
                <span style="background:var(--bg); padding:4px 8px; border-radius:4px; font-size:12px">
                  <b>${sanitizeHTML(tipo)}:</b> ${fmt(val)}
                </span>
              `).join('')}
            </div>
          </td>
        </tr>
        <tr style="background:var(--bg2); border-bottom:1px solid var(--border)">
          <td colspan="5" style="padding:8px 10px">
            <div style="font-size:11px; color:var(--text3); margin-bottom:4px; text-transform:uppercase; letter-spacing:1px">Por Obra</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px">
              ${Object.entries(week.byObra).map(([obra, val]) => `
                <span style="background:var(--bg); padding:4px 8px; border-radius:4px; font-size:12px">
                  <b>${obName(obra)}:</b> ${fmt(val)}
                </span>
              `).join('')}
            </div>
          </td>
        </tr>
      `;
    }
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  safeSetInner('weekly-report-content', html);
}

window.renderWeeklyPaymentReport = renderWeeklyPaymentReport;

function toggleWeekDetails(idx) {
  if (expandedWeeks.includes(idx)) {
    expandedWeeks = expandedWeeks.filter(i => i !== idx);
  } else {
    expandedWeeks.push(idx);
  }
  renderWeeklyPaymentReport();
}

window.toggleWeekDetails = toggleWeekDetails;

function toggleWeeklyReport() {
  const content = document.getElementById('weekly-report-content');
  if (content) {
    content.style.display = content.style.display === 'none' ? 'block' : 'none';
  }
}


window.toggleWeeklyReport = toggleWeeklyReport;

async function saveFinanceiro() {
  const prev = parseFloat(document.getElementById('fn-prev').value) || 0;
  const real = parseFloat(document.getElementById('fn-real').value) || 0;
  const status = document.getElementById('fn-status').value;
  let valpago = parseFloat(document.getElementById('fn-valpago').value) || 0;

  if (status === 'Pago') {
    valpago = real > 0 ? real : prev;
  } else if (status === 'Pendente' || status === 'Atrasado') {
    valpago = 0;
  }

  const data = {
    data: document.getElementById('fn-data').value,
    obra: document.getElementById('fn-obra').value,
    etapa: document.getElementById('fn-etapa').value,
    tipo: document.getElementById('fn-tipo').value,
    desc: document.getElementById('fn-desc').value,
    forn: document.getElementById('fn-forn').value,
    prev, real,
    pgto: document.getElementById('fn-pgto').value,
    status,
    valpago,
    nf: document.getElementById('fn-nf').value,
    obs: document.getElementById('fn-obs').value
  };

  const editIdx = parseInt(document.getElementById('fn-edit-idx').value) || -1;
  if (editIdx >= 0) {
    DB.financeiro[editIdx] = data;
    toast('Lançamento financeiro atualizado!');
  } else {
    DB.financeiro.push(data);
    toast('Lançamento financeiro salvo!');
  }
  closeModal('modal-financeiro'); 
  await persistDB(); 
  renderFinanceiro(); 
  if (typeof renderDashboard === 'function') renderDashboard();
}

async function editFinanceiro(idx) {
  await openModal('modal-financeiro');
  document.getElementById('fn-edit-idx').value = idx;
  const f = DB.financeiro[idx];
  document.getElementById('fn-data').value = f.data;
  document.getElementById('fn-obra').value = f.obra;
  document.getElementById('fn-etapa').value = f.etapa;
  document.getElementById('fn-tipo').value = f.tipo;
  document.getElementById('fn-desc').value = f.desc;
  document.getElementById('fn-forn').value = f.forn;
  document.getElementById('fn-prev').value = f.prev;
  document.getElementById('fn-real').value = f.real;
  document.getElementById('fn-pgto').value = f.pgto || 'PIX';
  document.getElementById('fn-status').value = f.status;
  document.getElementById('fn-valpago').value = f.valpago || '';
  document.getElementById('fn-nf').value = f.nf || '';
  document.getElementById('fn-obs').value = f.obs || '';
  calcFinDiff();
  if (typeof window.toggleParcial === 'function') window.toggleParcial('fn');
  if (f.status === 'Parcial' && typeof window.calcParcial === 'function') window.calcParcial('fn');
}

function calcFinDiff() {
  const p = parseFloat(document.getElementById('fn-prev').value) || 0;
  const r = parseFloat(document.getElementById('fn-real').value) || 0;
  const diffEl = document.getElementById('fn-diff');
  if (diffEl) diffEl.value = (r - p).toFixed(2);
}

window.saveFinanceiro = saveFinanceiro;
window.editFinanceiro = editFinanceiro;
window.calcFinDiff = calcFinDiff;
window.renderBilling = renderFinanceiro;
