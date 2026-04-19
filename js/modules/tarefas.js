// ==================== TAREFAS MODULE ====================

window._taskViewMode = 'table';

function setTaskView(mode) {
  window._taskViewMode = mode;
  document.getElementById('btn-view-table')?.classList.toggle('active', mode === 'table');
  document.getElementById('id-view-kanban')?.classList.toggle('active', mode === 'kanban');
  const tableCont = document.getElementById('tar-table-container');
  const kanbanCont = document.getElementById('tar-kanban-container');
  if(tableCont) tableCont.style.display = mode === 'table' ? 'block' : 'none';
  if(kanbanCont) kanbanCont.style.display = mode === 'kanban' ? 'block' : 'none';
  renderTarefas();
}

window.setTaskView = setTaskView;

function renderTarefas() {
  const obraFilter = document.getElementById('tar-obra-filter')?.value || '';
  const busca = (document.getElementById('tar-busca')?.value || '').toLowerCase();
  
  const tasks = DB.tarefas.map((t, i) => ({ ...t, _idx: i }))
    .filter(t => (!obraFilter || t.obra === obraFilter) && (!busca || (t.desc||'').toLowerCase().includes(busca) || (t.resp||'').toLowerCase().includes(busca)));

  const total = tasks.length;
  const conc = tasks.filter(t => t.status === 'Concluída').length;
  const andam = tasks.filter(t => t.status === 'Em andamento').length;
  const pend = tasks.filter(t => t.status === 'Pendente' || t.status === 'A fazer' || !t.status).length;
  
  safeSetInner('tar-kpi', `
    <div class="kpi-card"><div class="kpi-label">Total Filtrado</div><div class="kpi-val">${total}</div></div>
    <div class="kpi-card"><div class="kpi-label">Concluídas</div><div class="kpi-val green">${conc}</div></div>
    <div class="kpi-card"><div class="kpi-label">Em Andamento</div><div class="kpi-val blue">${andam}</div></div>
    <div class="kpi-card"><div class="kpi-label">Pendentes</div><div class="kpi-val orange">${pend}</div></div>
  `);

  if (window._taskViewMode === 'kanban') {
    renderKanban(tasks);
  } else {
    renderTaskTable(tasks);
  }
}


window.renderTarefas = renderTarefas;

async function saveTarefa() {
  const data = {
    cod: document.getElementById('tf-cod').value,
    obra: document.getElementById('tf-obra').value,
    etapa: document.getElementById('tf-etapa').value,
    frente: document.getElementById('tf-frente').value,
    desc: document.getElementById('tf-desc').value,
    resp: document.getElementById('tf-resp').value,
    prior: document.getElementById('tf-prior').value,
    status: document.getElementById('tf-status').value,
    criacao: document.getElementById('tf-criacao').value,
    prazo: document.getElementById('tf-prazo').value,
    conclusao: document.getElementById('tf-conclusao').value,
    perc: parseInt(document.getElementById('tf-perc').value) || 0,
    photoUrl: document.getElementById('tf-photo-url').value || '',
    obs: document.getElementById('tf-obs').value
  };
  const editIdx = parseInt(document.getElementById('tf-edit-idx').value) || -1;
  if (editIdx >= 0) {
    DB.tarefas[editIdx] = data;
    toast('Tarefa atualizada!');
  } else {
    DB.tarefas.push(data);
    toast('Tarefa criada!');
  }
  closeModal('modal-tarefa'); 
  await persistDB(); 
  renderTarefas();
}

async function editTarefa(idx) {
  await openModal('modal-tarefa');
  document.getElementById('tf-edit-idx').value = idx;
  const t = DB.tarefas[idx];
  document.getElementById('tf-cod').value = t.cod;
  document.getElementById('tf-obra').value = t.obra;
  document.getElementById('tf-etapa').value = t.etapa;
  document.getElementById('tf-frente').value = t.frente;
  document.getElementById('tf-desc').value = t.desc;
  document.getElementById('tf-resp').value = t.resp;
  document.getElementById('tf-prior').value = t.prior;
  document.getElementById('tf-status').value = t.status;
  document.getElementById('tf-criacao').value = t.criacao;
  document.getElementById('tf-prazo').value = t.prazo;
  document.getElementById('tf-conclusao').value = t.conclusao || '';
  document.getElementById('tf-perc').value = t.perc || 0;
  document.getElementById('tf-photo-url').value = t.photoUrl || '';
  document.getElementById('tf-obs').value = t.obs || '';
}

window.saveTarefa = saveTarefa;
window.editTarefa = editTarefa;

function renderTaskTable(tasks) {
  safeSetInner('tar-tbody', tasks.length
    ? tasks.map(t => `<tr>
        <td data-label="Cód."><span class="cod">${sanitizeHTML(t.cod)}</span></td>
        <td data-label="Obra">${obName(t.obra)}</td>
        <td data-label="Etapa / Frente"><small>${sanitizeHTML(t.etapa)}<br>${sanitizeHTML(t.frente || '—')}</small></td>
        <td data-label="Descrição"><b>${sanitizeHTML(t.desc)}</b></td>
        <td data-label="Responsável">${sanitizeHTML(t.resp)}</td>
        <td data-label="Prior.">${statusBadge(t.prior)}</td>
        <td data-label="Status">${statusBadge(t.status)}</td>
        <td data-label="Prazo">${fmtDate(t.prazo)}</td>
        <td data-label="% Conc.">
          <div style="display:flex;align-items:center;gap:6px">
            <div class="progress-bar" style="width:60px;height:6px"><div class="progress-fill" style="width:${t.perc || 0}%;background:${t.perc >= 100 ? 'var(--green)' : t.status === 'Atrasada' ? 'var(--red)' : 'var(--accent2)'}"></div></div>
            <span style="font-size:11px">${t.perc || 0}%</span>
          </div>
        </td>
        <td>
           <div style="display:flex; gap:8px; align-items:center">
             ${t.photoUrl ? `<span style="cursor:pointer; font-size:18px" title="Ver Evidência" onclick="openLightbox('${sanitizeHTML(t.photoUrl)}')">📷</span>` : ''}
             <button class="btn btn-secondary btn-sm" onclick="editTarefa(${t._idx})">✏️</button>
             <button class="btn btn-danger btn-sm" onclick="deleteItem('tarefas',${t._idx})">Excluir</button>
           </div>
        </td>
      </tr>`).join('')
    : uiEmptyState('Nenhuma Tarefa', 'O cronograma está limpo.', '📋', 'Nova Tarefa', 'openModal(\'modal-tarefa\')'));
}

function renderKanban(tasks) {
  const colOrder = ['Pendente', 'Em andamento', 'Concluída'];
  const colTitles = { 'Pendente': '📋 Para Fazer', 'Em andamento': '🚧 Em Andamento', 'Concluída': '✅ Concluída' };
  
  let html = '';
  colOrder.forEach(cId => {
    const cItems = tasks.filter(t => (t.status || 'Pendente') === cId);
    html += `
      <div class="kanban-col">
        <div class="kanban-header">
          <h4>${sanitizeHTML(colTitles[cId])}</h4>
          <span class="badge badge-gray">${cItems.length}</span>
        </div>
        <div class="kanban-cards">
          ${cItems.length ? cItems.map(t => `
            <div class="kanban-card" onclick="editTarefa(${t._idx})">
              <div class="kanban-card-title">${sanitizeHTML(t.desc)}</div>
              <div class="kanban-card-meta">
                <span>👤 ${sanitizeHTML(t.resp)}</span>
                <span>🏗️ ${obName(t.obra)}</span>
                <span>📅 Prazo: ${fmtDate(t.prazo)}</span>
              </div>
              <div class="kanban-card-footer">
                ${statusBadge(t.prior)}
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="progress-bar" style="width:50px;height:4px"><div class="progress-fill" style="width:${t.perc || 0}%;background:var(--accent2)"></div></div>
                  <span style="font-size:10px;font-weight:600">${t.perc || 0}%</span>
                </div>
              </div>
            </div>
          `).join('') : '<div style="text-align:center; padding:30px; color:var(--text3); font-size:12px; font-style:italic">Vazio</div>'}
        </div>
      </div>`;
  });
  safeSetInner('tar-board', html);
}
