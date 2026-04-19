// ==================== PRESENÇA MODULE ====================

let currentWeekOffset = 0;

function changeWeek(offset) {
  currentWeekOffset += offset;
  renderQuadroSemanal();
}

window.changeWeek = changeWeek;

function renderQuadroSemanal() {
  const container = document.getElementById('pres-quadro-semanal');
  if (!container) return;

  const todayObj = new Date();
  const startOfWeek = new Date(todayObj);
  const dayOfWeek = todayObj.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 
  startOfWeek.setDate(todayObj.getDate() - diff + (currentWeekOffset * 7));
  
  const days = [];
  const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    days.push({
      date: d.toISOString().split('T')[0],
      name: dayNames[i],
      display: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    });
  }

  const workers = (DB?.trabalhadores || []).filter(t => t.status === 'Ativo');
  if (workers.length === 0) {
    safeSetInner(container, '<p style="text-align:center; padding:20px; color:var(--text3)">Nenhum trabalhador ativo para exibir no quadro.</p>');
    return;
  }

  let html = `<table class="presence-board">
    <thead>
      <tr>
        <th class="worker-info">Trabalhador</th>
        ${days.map(d => `
          <th>
            <div class="day-header">
              <span class="day-name">${d.name}</span>
              <span class="day-date">${d.display}</span>
            </div>
          </th>
        `).join('')}
      </tr>
    </thead>
    <tbody>`;

  workers.forEach(w => {
    html += `<tr>
      <td class="worker-info">
        <b>${sanitizeHTML(w.nome)}</b><br>
        <small style="color:var(--text3)">${sanitizeHTML(w.funcao || '—')}</small>
      </td>`;
    
    days.forEach(d => {
      const pIdx = (DB.presenca || []).findIndex(record => (record && (record.trab === w.cod || record.nome === w.nome) && record.data === d.date));
      const p = pIdx !== -1 ? DB.presenca[pIdx] : null;

      let iconClass = 'none';
      let icon = '•';
      let title = 'Sem registro';

      if (p) {
        if (p.presenca === 'Presente') { iconClass = 'presente'; icon = '✅'; title = 'Presente'; }
        else if (p.presenca === 'Falta') { iconClass = 'falta'; icon = '❌'; title = 'Falta'; }
        else if (p.presenca === 'Meio período') { iconClass = 'meio'; icon = '🌓'; title = 'Meio Período'; }
      }

      html += `<td>
        <div class="presence-cell" title="${title}" onclick="openPresenceModal('${sanitizeHTML(w.cod)}', '${d.date}', ${pIdx})">
          <div class="pres-icon ${iconClass}">${icon}</div>
        </div>
      </td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  safeSetInner(container, html);
}

window.renderQuadroSemanal = renderQuadroSemanal;

function openPresenceModal(workerCod, date, existingIdx = -1) {
  if (existingIdx !== -1) {
    editPresenca(existingIdx);
  } else {
    openModal('modal-presenca');
    setTimeout(() => {
      const tsel = document.getElementById('pr-trab');
      const dsel = document.getElementById('pr-data');
      if (tsel) tsel.value = workerCod;
      if (dsel) dsel.value = date;
      if (typeof fillTrabInfo === 'function') fillTrabInfo();
    }, 300);
  }
}

window.openPresenceModal = openPresenceModal;

function renderPresenca() {
  const allPres = DB.presenca || [];
  const validPres = allPres.filter(p => p && p.data);

  const hoje = validPres.filter(p => p.data === today);
  const presentes = hoje.filter(p => p.presenca === 'Presente').length;
  const faltas = hoje.filter(p => p.presenca === 'Falta').length;
  const totalPagar = hoje.reduce((a, p) => a + (Number(p.total) || 0), 0);

  safeSetInner('pres-kpi', `
    <div class="kpi-card"><div class="kpi-label">Presentes Hoje</div><div class="kpi-val green">${presentes}</div></div>
    <div class="kpi-card"><div class="kpi-label">Faltas Hoje</div><div class="kpi-val ${faltas > 0 ? 'red' : 'green'}">${faltas}</div></div>
    <div class="kpi-card"><div class="kpi-label">Total a Pagar Hoje</div><div class="kpi-val yellow" style="font-size:20px">${fmt(totalPagar)}</div></div>
  `);

  const sortSelect = document.getElementById('pres-sort-select');
  const sortVal = sortSelect ? sortSelect.value : 'data_desc';

  let listForTable = allPres.map((p, i) => (p ? { ...p, _idx: i } : null)).filter(p => p !== null);

  listForTable.sort((a, b) => {
    if (sortVal === 'data_desc') return String(b.data || '').localeCompare(String(a.data || ''));
    if (sortVal === 'data_asc') return String(a.data || '').localeCompare(String(b.data || ''));
    return 0;
  });

  const groupSelect = document.getElementById('pres-group-select');
  const groupMode = groupSelect ? groupSelect.value : 'trab';

  if (listForTable.length === 0) {
    safeSetInner('pres-tbody', uiEmptyState('Folha em Branco', 'Ninguém bateu ponto hoje. Inicie o lançamento diário da obra.', '✅', 'Lançar Presença', 'openModal(\'modal-presenca\')'));
  } else if (!groupMode) {
    safeSetInner('pres-tbody', listForTable.map(p => `<tr>
        <td data-label="Data / Local"><b>${fmtDate(p.data)}</b><br><small style="color:var(--text3)">${obName(p.obra)}${p.frente ? ' · ' + sanitizeHTML(p.frente) : ''}</small></td>
        <td data-label="Profissional"><b>${sanitizeHTML(p.nome)}</b><br><small style="color:var(--text3)">${sanitizeHTML(p.funcao)}</small></td>
        <td data-label="Horários">${sanitizeHTML(p.entrada || '—')} - ${sanitizeHTML(p.saida || '—')}</td>
        <td data-label="Horas (N+E)">${p.hnorm || 0}h + ${p.hextra || 0}h</td>
        <td data-label="Status">${statusBadge(p.presenca)}</td>
        <td data-label="Valor Total"><b>${fmt(p.total)}</b></td>
        <td data-label="Pgto">${sanitizeHTML(p.pgtoStatus || '—')}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editPresenca(${p._idx})" style="margin-right:8px">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem('presenca',${p._idx})">Excluir</button>
        </td>
      </tr>`).join(''));
  } else {
    let grouped = {};
    listForTable.forEach(p => {
      const g = groupMode === 'trab' ? (p.nome || 'Desconhecido') : (p.obra || 'Desconhecida');
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(p);
    });

    const keys = Object.keys(grouped).sort();
    let tbodyHtml = '';

    keys.forEach((k, idx) => {
      const rows = grouped[k];
      const totalGroup = rows.reduce((a, b) => a + (Number(b.total) || 0), 0);
      const cls = `grp-pres-${idx}`;
      const icn = `ico-pres-${idx}`;

      tbodyHtml += `<tr class="group-header" onclick="toggleGroup('${cls}', '${icn}')" style="cursor:pointer; background:var(--bg3); font-weight:600;">
            <td colspan="7"><span id="${icn}" style="display:inline-block; width:20px; font-size:12px; color:var(--accent);">▶</span> 
              <span style="font-size:14px; text-transform:uppercase">${sanitizeHTML(k)}</span> 
              <span class="badge badge-blue" style="margin-left:12px">${rows.length} registros</span>
            </td>
            <td colspan="2" style="color:var(--green); font-size:14px; font-weight:bold;">Total: ${fmt(totalGroup)}</td>
          </tr>`;

      rows.forEach(p => {
        tbodyHtml += `<tr class="${cls}" style="display:none; transition: all 0.3s">
                <td data-label="Data / Local" style="padding-left:16px"><span style="color:var(--text3); font-size:10px; margin-right:4px">└</span> <b>${fmtDate(p.data)}</b><br><small style="color:var(--text3)">${obName(p.obra)}${p.frente ? ' · ' + sanitizeHTML(p.frente) : ''}</small></td>
                <td data-label="Profissional"><b>${sanitizeHTML(p.nome)}</b><br><small style="color:var(--text3)">${sanitizeHTML(p.funcao)}</small></td>
                <td data-label="Horários">${sanitizeHTML(p.entrada || '—')} - ${sanitizeHTML(p.saida || '—')}</td>
                <td data-label="Horas (N+E)">${p.hnorm || 0}h + ${p.hextra || 0}h</td>
                <td data-label="Status">${statusBadge(p.presenca)}</td>
                <td data-label="Valor Total"><b>${fmt(p.total)}</b></td>
                <td data-label="Pgto">${sanitizeHTML(p.pgtoStatus || '—')}</td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="editPresenca(${p._idx})" style="margin-right:8px">✏️</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteItem('presenca',${p._idx})">Excluir</button>
                </td>
              </tr>`;
      });
    });
    safeSetInner('pres-tbody', tbodyHtml);
  }

  try {
    const summary = window.summarizePresence(validPres).slice(0, 10);
    const totalsHtml = summary.map(s => {
      return `<div class="kpi-card">
        <div class="kpi-label">${fmtDate(s.data)}</div>
        <div style="font-size:13px;margin-top:4px">Presentes: <b style="color:var(--green)">${s.presentes}</b> · Faltas: <b style="color:var(--red)">${s.faltas}</b></div>
        <div style="font-size:13px;margin-top:4px">Total: <b style="color:var(--accent)">${fmt(s.total)}</b></div>
      </div>`;
    }).join('');

    safeSetInner('pres-totais', totalsHtml || '<p style="color:var(--text3); padding: 8px;">Nenhum dado para consolidar fechamento.</p>');
  } catch (err) {
    console.error('Erro ao renderizar totalizadores de presença:', err);
    safeSetInner('pres-totais', '<p style="color:var(--red); padding: 8px;">Falha ao processar os dados do fechamento.</p>');
  }

  const pResults = window.calcWeeklyPendingPayments(validPres, DB.obras || [], today);
  const pendentesHtml = pResults.map(res => {
    return `<div class="kpi-card">
      <div class="kpi-label">${sanitizeHTML(res.obraCod)} — ${sanitizeHTML(res.obraNome)}</div>
      <div style="font-size:20px; font-weight:bold; color:var(--red); margin: 8px 0;">${fmt(res.totalPendente)}</div>
      <div style="font-size:13px; color:var(--text2)">${res.count} pendências salariais na semana</div>
    </div>`;
  }).join('');

  safeSetInner('pres-pgto-pendentes', pendentesHtml || '<p style="color:var(--green); padding: 8px; font-weight: 500;">✅ Nenhum pagamento pendente para esta semana.</p>');

  try {
    const porTrab = {};
    validPres.forEach(p => {
      if (!p.nome || !Number(p.total)) return;
      const k = p.nome;
      if (!porTrab[k]) porTrab[k] = { total: 0, dias: 0, obra: p.obra };
      porTrab[k].total += Number(p.total) || 0;
      porTrab[k].dias++;
    });

    const keys = Object.keys(porTrab).sort();
    const empreitadaHtml = keys.map(nome => {
      const d = porTrab[nome];
      return `<div class="kpi-card">
        <div class="kpi-label" style="font-weight:600">${sanitizeHTML(nome)}</div>
        <div style="font-size:13px;color:var(--text2);margin:4px 0">${obName(d.obra)} · ${d.dias} dia(s)</div>
        <div style="font-size:20px;font-weight:bold;color:var(--accent)">${fmt(d.total)}</div>
      </div>`;
    }).join('');

    safeSetInner('pres-empreitada', empreitadaHtml || '<p style="color:var(--text3); padding: 8px;">Sem registros de fechamento por trabalhador.</p>');
  } catch(e) {
    console.error('Erro ao renderizar fechamento por trabalhador:', e);
  }

  renderQuadroSemanal();
}

window.renderPresenca = renderPresenca;

function filterPresenca(query) {
  const q = (query || '').toLowerCase().trim();
  const rows = document.querySelectorAll('#pres-tbody tr');
  rows.forEach(row => {
    if (row.classList.contains('group-header')) {
      row.style.display = '';
      return;
    }
    const text = row.innerText.toLowerCase();
    row.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
}


window.filterPresenca = filterPresenca;

async function savePresenca(keepOpen = false) {
  const modoMassa = document.querySelector('input[name="pr-modo"]:checked')?.value === 'massa';
  const dataVal = document.getElementById('pr-data').value;
  const obraVal = document.getElementById('pr-obra').value;
  const editIdx = parseInt(document.getElementById('pr-edit-idx').value) || -1;
  
  if (!dataVal) { toast('Informe a data!', 'error'); return; }
  if (!obraVal) { toast('Selecione a obra!', 'error'); return; }

  let lastSavedData = null;
  let trabsParaSalvar = [];

  if (modoMassa) {
    const checks = document.querySelectorAll('.pr-massa-check:checked');
    if (checks.length === 0) { toast('Selecione ao menos um trabalhador!', 'error'); return; }
    checks.forEach(c => trabsParaSalvar.push(c.value));
  } else {
    const trabVal = document.getElementById('pr-trab').value;
    if (!trabVal) { toast('Selecione o trabalhador!', 'error'); return; }
    trabsParaSalvar.push(trabVal);
  }

  for (const tsel of trabsParaSalvar) {
    const t = DB.trabalhadores.find(x => x.cod === tsel);
    const jaExiste = DB.presenca.some((p, idx) => 
      p.data === dataVal && p.trab === tsel && (editIdx < 0 || idx !== editIdx)
    );

    if (jaExiste) {
      toast(`⚠️ Já existe registro para ${t ? t.nome : tsel} em ${fmtDate(dataVal)}!`, 'error');
      if (modoMassa) continue;
      return;
    }

    if (t && (!t.obras || !t.obras.includes(obraVal))) {
      t.obras = t.obras && t.obras.trim() !== '' ? (t.obras + ", " + obraVal) : obraVal;
    }

    const isInformal = t && t.vinculo === 'Informal';
    const data = {
      data: dataVal,
      obra: obraVal,
      trab: tsel,
      nome: t ? t.nome : tsel,
      funcao: t ? t.funcao : document.getElementById('pr-funcao').value,
      vinculo: t ? t.vinculo : '',
      equipe: t ? t.equipe : '',
      frente: document.getElementById('pr-frente').value,
      entrada: document.getElementById('pr-entrada').value,
      saida: document.getElementById('pr-saida').value,
      hnorm: parseFloat(document.getElementById('pr-hnorm').value) || 0,
      hextra: isInformal ? 0 : (parseFloat(document.getElementById('pr-hextra').value) || 0),
      presenca: document.getElementById('pr-presenca').value,
      justif: document.getElementById('pr-obs').value,
      diaria: t ? t.diaria : (parseFloat(document.getElementById('pr-diaria').value) || 0),
      total: (() => {
        const presencaVal = document.getElementById('pr-presenca').value;
        if (presencaVal === 'Falta') return 0;
        if (presencaVal === 'Meio período') {
          const diariaBase = t ? t.diaria : (parseFloat(document.getElementById('pr-diaria').value) || 0);
          return diariaBase / 2;
        }
        if (isInformal) return t ? t.diaria : 0;
        return parseFloat(document.getElementById('pr-total').value) || 0;
      })(),
      pgtoStatus: document.getElementById('pr-pgto-status').value || 'Pendente',
      valpago: parseFloat(document.getElementById('pr-valpago').value) || 0,
      lancador: document.getElementById('pr-lancador').value,
      hrLanc: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      obs: document.getElementById('pr-obs').value
    };

    if (editIdx >= 0 && !modoMassa) {
      DB.presenca[editIdx] = data;
    } else {
      DB.presenca.push(data);
    }
    lastSavedData = data;
  }

  if (keepOpen) {
    document.getElementById('pr-trab').value = '';
    document.getElementById('pr-funcao').value = '';
    document.getElementById('pr-presenca').value = 'Presente';
    document.getElementById('pr-hnorm').value = '';
    document.getElementById('pr-hextra').value = '';
    document.getElementById('pr-total').value = '';
    document.getElementById('pr-valpago').value = '';
    document.getElementById('pr-pgto-status').value = 'Pendente';
    document.getElementById('pr-obs').value = '';
    document.getElementById('pr-edit-idx').value = '-1';
    togglePresenca();
  } else {
    closeModal('modal-presenca');
  }

  try {
    await persistDB();
    let tmsg = editIdx >= 0 ? 'Presença atualizada!' : 'Presença registrada!';
    if (lastSavedData?.pgtoStatus === 'Parcial') tmsg = `Status Parcial: Falta Pagar R$ ${((lastSavedData.total || 0) - (lastSavedData.valpago || 0)).toFixed(2).replace('.', ',')}`;
    toast(tmsg);
  } catch (err) {
    toast('Presença salva localmente.', 'error');
  }

  renderPresenca();
  if (typeof renderFinanceiro === 'function') renderFinanceiro();
  if (typeof renderDashboard === 'function') renderDashboard();
}

async function editPresenca(idx) {
  await openModal('modal-presenca');
  document.getElementById('pr-edit-idx').value = idx;
  const p = DB.presenca[idx];
  document.getElementById('pr-data').value = p.data;
  document.getElementById('pr-obra').value = p.obra;

  if (typeof window.filterTrabByObra === 'function') window.filterTrabByObra();

  const trSelect = document.getElementById('pr-trab');
  if (p.trab) {
    trSelect.value = p.trab;
  } else {
    const found = Array.from(trSelect.options).find(o => o.text === p.nome);
    if (found) trSelect.value = found.value;
  }
  
  const trabData = DB.trabalhadores.find(x => x.cod === trSelect.value);
  if (trabData) {
    document.getElementById('pr-funcao').value = trabData.funcao;
    document.getElementById('pr-diaria').value = trabData.diaria;
  } else {
    document.getElementById('pr-funcao').value = p.funcao;
    document.getElementById('pr-diaria').value = p.diaria;
  }
  document.getElementById('pr-frente').value = p.frente;
  document.getElementById('pr-entrada').value = p.entrada;
  document.getElementById('pr-saida').value = p.saida;
  document.getElementById('pr-hnorm').value = p.hnorm;
  document.getElementById('pr-hextra').value = p.hextra;
  document.getElementById('pr-presenca').value = p.presenca;
  document.getElementById('pr-obs').value = p.justif || p.obs || '';
  document.getElementById('pr-total').value = p.total;
  document.getElementById('pr-pgto-status').value = p.pgtoStatus || 'Pendente';
  document.getElementById('pr-valpago').value = p.valpago || '';
  document.getElementById('pr-lancador').value = p.lancador;
  togglePresenca();
  if (typeof window.toggleParcial === 'function') window.toggleParcial('pr');
}

function calcPresenca() {
  const entrada = document.getElementById('pr-entrada')?.value || '07:00';
  const saida = document.getElementById('pr-saida')?.value || '17:00';
  const presenca = document.getElementById('pr-presenca')?.value;

  if (presenca === 'Falta') {
    document.getElementById('pr-total').value = 0;
    document.getElementById('pr-hnorm').value = 0;
    document.getElementById('pr-hextra').value = 0;
    return;
  }

  const trabCod = document.getElementById('pr-trab')?.value;
  const trabData = (window.DB && DB.trabalhadores) ? DB.trabalhadores.find(t => t.cod === trabCod) : {};
  const diaria = parseFloat(document.getElementById('pr-diaria').value) || 0;

  if (presenca === 'Meio período') {
    document.getElementById('pr-hnorm').value = 4.0.toFixed(1);
    document.getElementById('pr-hextra').value = 0.0.toFixed(1);
    document.getElementById('pr-total').value = (diaria / 2).toFixed(2);
    return;
  }

  const [eh, em] = entrada.split(':').map(Number);
  const [sh, sm] = saida.split(':').map(Number);
  const hTrabalhadas = Math.max(0, (sh * 60 + sm - eh * 60 - em) / 60);

  const hnorm = Math.min(hTrabalhadas, 8);
  document.getElementById('pr-hnorm').value = hnorm.toFixed(1);
  document.getElementById('pr-hextra').value = (0.0).toFixed(1);

  const total = hTrabalhadas > 0 ? diaria : 0;
  document.getElementById('pr-total').value = total.toFixed(2);
}

function calcTotalManual() {
  const hnorm = parseFloat(document.getElementById('pr-hnorm').value) || 0;
  let hextra = parseFloat(document.getElementById('pr-hextra').value) || 0;
  const diaria = parseFloat(document.getElementById('pr-diaria').value) || 0;
  const presenca = document.getElementById('pr-presenca')?.value;

  const trabCod = document.getElementById('pr-trab')?.value;
  const trabData = (window.DB && DB.trabalhadores) ? DB.trabalhadores.find(t => t.cod === trabCod) : {};
  const isInformal = trabData && trabData.vinculo === 'Informal';

  if (isInformal) {
    hextra = 0;
    document.getElementById('pr-hextra').value = '0.0';
  }

  let total = 0;
  if (presenca === 'Meio período') {
    total = diaria / 2;
  } else {
    const valorHora = diaria / 8;
    total = hnorm > 0 ? diaria + (hextra * valorHora * 1.5) : 0;
  }
  document.getElementById('pr-total').value = total.toFixed(2);
}

function togglePresencaModo() {
  const modo = document.querySelector('input[name="pr-modo"]:checked').value;
  const indivGrp = document.getElementById('pr-indiv-grp');
  const massaGrp = document.getElementById('pr-massa-grp');
  const hExtGrp = document.getElementById('pr-hextra-grp');
  
  if (modo === 'massa') {
    indivGrp.style.display = 'none';
    massaGrp.style.display = '';
    hExtGrp.style.display = 'none';
    if (typeof window.filterTrabByObra === 'function') window.filterTrabByObra();
  } else {
    indivGrp.style.display = '';
    massaGrp.style.display = 'none';
    if (typeof window.fillTrabInfo === 'function') window.fillTrabInfo();
  }
}

function selectAllTrabs(check) {
  const checks = document.querySelectorAll('.pr-massa-check');
  checks.forEach(c => c.checked = check);
}

function togglePresenca() {
  const v = document.getElementById('pr-presenca').value;
  const show = v !== 'Falta';
  const entGrp = document.getElementById('pr-entrada-grp');
  const saiGrp = document.getElementById('pr-saida-grp');
  if (entGrp) entGrp.style.display = show ? '' : 'none';
  if (saiGrp) saiGrp.style.display = show ? '' : 'none';
  if (!show) {
    const totalEl = document.getElementById('pr-total');
    if (totalEl) totalEl.value = 0;
  }
}

window.savePresenca = savePresenca;
window.editPresenca = editPresenca;
window.calcPresenca = calcPresenca;
window.calcTotalManual = calcTotalManual;
window.togglePresencaModo = togglePresencaModo;
window.selectAllTrabs = selectAllTrabs;
window.togglePresenca = togglePresenca;

function filterTrabByObra() {
  const tsel = document.getElementById('pr-trab');
  const osel = document.getElementById('pr-obra');
  const listaMassa = document.getElementById('pr-lista-trabs-massa');
  if (!tsel || !osel) return;

  const obraSelecionada = osel.value;
  const filtered = DB.trabalhadores.filter(t => {
    if (t.status !== 'Ativo') return false;
    if (!t.obras || t.obras.trim() === '') return true;
    return t.obras.includes(obraSelecionada);
  });

  // Sanitização XSS para dados de trabalhadores
  const safeSanitize = typeof sanitizeHTML === 'function' ? sanitizeHTML : (s) => String(s || '');

  if (filtered.length === 0) {
    safeSetInner(tsel, '<option value="">Nenhum trabalhador nesta obra</option>');
    const dEl = document.getElementById('pr-diaria');
    const fEl = document.getElementById('pr-funcao');
    if (dEl) dEl.value = '';
    if (fEl) fEl.value = '';
  } else {
    safeSetInner(tsel, filtered.map(t => `<option value="${safeSanitize(t.cod)}">${safeSanitize(t.nome)}</option>`).join(''));
  }

  if (listaMassa) {
    safeSetInner(listaMassa, filtered.length > 0 
      ? filtered.map(t => `
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; background: rgba(var(--accent-rgb), 0.03); padding: 5px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
            <input type="checkbox" class="pr-massa-check" value="${safeSanitize(t.cod)}">
            <span style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${safeSanitize(t.nome)}</span>
          </label>
        `).join('')
      : '<p style="font-size: 12px; color: var(--text3); padding: 5px;">Nenhum funcionário ativo na obra.</p>');
  }

  fillTrabInfo(); 
}

function fillTrabInfo() {
  const trabEl = document.getElementById('pr-trab');
  if (!trabEl) return;
  const sel = trabEl.value;
  const t = DB.trabalhadores.find(x => x.cod === sel);
  
  const hExtGrp = document.getElementById('pr-hextra-grp');
  const isInformal = t && t.vinculo === 'Informal';
  
  if (hExtGrp) {
    hExtGrp.style.display = isInformal ? 'none' : '';
    if (isInformal) {
      const heEl = document.getElementById('pr-hextra');
      if (heEl) heEl.value = 0;
    }
  }

  if (t) {
    const fnEl = document.getElementById('pr-funcao');
    const drEl = document.getElementById('pr-diaria');
    if (fnEl) fnEl.value = t.funcao;
    if (drEl) drEl.value = t.diaria;
    calcPresenca();
  }
}

window.filterTrabByObra = filterTrabByObra;
window.fillTrabInfo = fillTrabInfo;
