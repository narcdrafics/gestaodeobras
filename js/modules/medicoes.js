// ==================== MEDIÇÃO MODULE ====================

function renderMedicao() {
  safeSetInner('med-tbody', DB.medicao.length
    ? DB.medicao.map((m, i) => {
      const av = m.qprev > 0 ? (m.qreal / m.qprev) : 0;
      return `<tr>
          <td>${fmtDate(m.semana)}</td>
          <td>${obName(m.obra)}</td>
          <td>${sanitizeHTML(m.etapa)}</td>
          <td>${sanitizeHTML(m.frente || '—')}</td>
          <td>${sanitizeHTML(m.equipe || '—')}</td>
          <td>${sanitizeHTML(m.servico)}</td>
          <td>${sanitizeHTML(m.unid)}</td>
          <td>${m.qprev}</td>
          <td>${m.qreal}</td>
          <td>${fmt(m.vtotal || 0)}</td>
          <td><div style="display:flex;align-items:center;gap:6px">
            <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(av * 100, 100)}%;background:${av >= 1 ? 'var(--green)' : av >= 0.7 ? 'var(--accent2)' : 'var(--orange)'}"></div></div>
            <span style="font-size:12px">${(av * 100).toFixed(1)}%</span>
          </div></td>
          <td>${statusBadge(m.retr === 'Sim' ? 'Alta' : 'Baixa').replace('Alta', 'Sim').replace('Baixa', 'Não')}</td>
          <td>${sanitizeHTML(m.obs || '—')}</td>
          <td>
             <div style="display:flex; gap:8px; align-items:center">
               ${m.photoUrl ? `<span style="cursor:pointer; font-size:18px" title="Ver Evidência" onclick="openLightbox('${sanitizeHTML(m.photoUrl)}')">📷</span>` : ''}
               <button class="btn btn-secondary btn-sm" onclick="editMedicao(${i})">✏️</button>
               <button class="btn btn-danger btn-sm" onclick="deleteItem('medicao',${i})">Excluir</button>
             </div>
          </td>
        </tr>`;
    }).join('')
    : uiEmptyState('Sem Medições', 'Acompanhe o avanço das empreiteiras e os laudos dos terceirizados.', '📏', 'Lançar Medição', 'openModal(\'modal-medicao\')'));
}


window.renderMedicao = renderMedicao;

async function saveMedicao() {
  const qprev = parseFloat(document.getElementById('md-qprev').value) || 0;
  const qreal = parseFloat(document.getElementById('md-qreal').value) || 0;
  const vunit = parseFloat(document.getElementById('md-vunit').value) || 0;
  const data = {
    semana: document.getElementById('md-semana').value,
    obra: document.getElementById('md-obra').value,
    etapa: document.getElementById('md-etapa').value,
    frente: document.getElementById('md-frente').value,
    equipe: document.getElementById('md-equipe').value,
    servico: document.getElementById('md-servico').value,
    unid: document.getElementById('md-unid').value,
    qprev, qreal,
    vunit, vtotal: qreal * vunit,
    retr: document.getElementById('md-retr').value,
    pgtoStatus: document.getElementById('md-pgto-status').value,
    valpago: parseFloat(document.getElementById('md-valpago').value) || 0,
    photoUrl: document.getElementById('md-photo-url').value || '',
    obs: document.getElementById('md-obs').value
  };
  const editIdx = parseInt(document.getElementById('md-edit-idx').value) || -1;
  if (editIdx >= 0) {
    DB.medicao[editIdx] = data;
    toast('Medição atualizada!');
  } else {
    DB.medicao.push(data);
    toast('Medição salva!');
  }
  closeModal('modal-medicao'); 
  await persistDB(); 
  renderMedicao(); 
  if (typeof renderFinanceiro === 'function') renderFinanceiro(); 
  if (typeof renderDashboard === 'function') renderDashboard();
}

async function editMedicao(idx) {
  await openModal('modal-medicao');
  document.getElementById('md-edit-idx').value = idx;
  const m = DB.medicao[idx];
  document.getElementById('md-semana').value = m.semana;
  document.getElementById('md-obra').value = m.obra;
  document.getElementById('md-etapa').value = m.etapa;
  document.getElementById('md-frente').value = m.frente;
  document.getElementById('md-equipe').value = m.equipe;
  document.getElementById('md-servico').value = m.servico;
  document.getElementById('md-unid').value = m.unid;
  document.getElementById('md-qprev').value = m.qprev;
  document.getElementById('md-qreal').value = m.qreal;
  document.getElementById('md-vunit').value = m.vunit || 0;
  document.getElementById('md-vtotal').value = m.vtotal || 0;
  document.getElementById('md-retr').value = m.retr;
  document.getElementById('md-pgto-status').value = m.pgtoStatus || 'Pendente';
  document.getElementById('md-valpago').value = m.valpago || '';
  document.getElementById('md-photo-url').value = m.photoUrl || '';
  if (typeof window.toggleParcial === 'function') window.toggleParcial('md');
  const preview = document.getElementById('md-photo-preview');
  if (preview) {
    if (m.photoUrl) {
      preview.style.display = 'block';
      preview.querySelector('img').src = m.photoUrl;
    } else {
      preview.style.display = 'none';
    }
  }
}

function calcAvanco() {
  const p = parseFloat(document.getElementById('md-qprev').value) || 0;
  const r = parseFloat(document.getElementById('md-qreal').value) || 0;
  const v = parseFloat(document.getElementById('md-vunit').value) || 0;
  const avEl = document.getElementById('md-avanco');
  const vtEl = document.getElementById('md-vtotal');
  if (avEl) avEl.value = p > 0 ? (r / p * 100).toFixed(1) : 0;
  if (vtEl) vtEl.value = (r * v).toFixed(2);
}

window.saveMedicao = saveMedicao;
window.editMedicao = editMedicao;
window.calcAvanco = calcAvanco;
