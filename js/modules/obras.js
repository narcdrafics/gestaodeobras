// ==================== OBRAS MODULE ====================

function renderObras() {
  safeSetInner('obras-grid', DB.obras.map(o => {
    const fReal = DB.financeiro.filter(f => f.obra === o.cod).reduce((a, f) => a + (Number(f.real) || 0), 0);
    const pctCusto = o.orc > 0 ? (fReal / o.orc * 100).toFixed(1) : 0;
    
    const tasks = DB.tarefas.filter(t => t.obra === o.cod);
    const avgFisico = tasks.length > 0 
      ? (tasks.reduce((acc, t) => acc + (Number(t.perc) || 0), 0) / tasks.length).toFixed(0)
      : 0;

    return `
      <div class="obra-card">
        <div onclick="showPage('financeiro')">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
            <h3 style="margin:0">${sanitizeHTML(o.nome)}</h3>
            ${statusBadge(o.status)}
          </div>
          <div class="obra-meta">${sanitizeHTML(o.end)}</div>
          
          <div style="margin:16px 0">
            <div class="kpi-label" style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span>Progresso Físico</span> <b>${avgFisico}%</b>
            </div>
            <div class="progress-bar" style="width:100%;height:10px;background:var(--bg3)">
              <div class="progress-fill" style="width:${avgFisico}%;background:${avgFisico > 70 ? 'var(--green)' : avgFisico > 30 ? 'var(--accent)' : 'var(--orange)'}"></div>
            </div>
          </div>
          
          <div class="obra-stats" style="margin-bottom:16px">
            <div class="obra-stat">
              <div class="obra-stat-label">Orçamento</div>
              <div class="obra-stat-val" style="font-size:13px">${fmt(o.orc)}</div>
            </div>
            <div class="obra-stat">
              <div class="obra-stat-label">% Custo</div>
              <div class="obra-stat-val" style="color:${fReal > o.orc ? 'var(--red)' : 'var(--text)'}">${pctCusto}%</div>
            </div>
          </div>
        </div>
        
        <div style="display:flex;gap:8px;margin-top:auto">
          <button class="btn btn-secondary btn-sm" style="flex:1" onclick="shareObraWhatsApp('${sanitizeHTML(o.cod)}')">📱 WhatsApp</button>
          <button class="btn btn-primary btn-sm" onclick="showPage('tarefas')">📋 Tarefas</button>
        </div>
      </div>`;
  }).join(''));

  safeSetInner('obras-tbody', DB.obras.map((o, i) => `<tr>
    <td data-label="Nome"><b>${sanitizeHTML(o.nome)}</b></td>
    <td data-label="Cód."><span class="cod">${sanitizeHTML(o.cod)}</span></td>
    <td data-label="Status">${statusBadge(o.status)}</td>
    <td data-label="Prazo">${fmtDate(o.prazo)}</td>
    <td data-label="Orçamento">${fmt(o.orc)}</td>
    <td data-label="Mestre">${sanitizeHTML(o.mestre)}</td>
    <td>
      <button class="btn btn-secondary btn-sm" onclick="editObra(${i})" style="margin-right:8px">✏️</button>
      <button class="btn btn-danger btn-sm" onclick="deleteItem('obras',${i})">Excluir</button>
    </td>
  </tr>`).join(''));
}

window.renderObras = renderObras;

function shareObraWhatsApp(obraCod) {
  const o = DB.obras.find(x => x.cod === obraCod);
  if (!o) return;

  const tasks = DB.tarefas.filter(t => t.obra === obraCod);
  const avgFisico = tasks.length > 0 
    ? (tasks.reduce((acc, t) => acc + (Number(t.perc) || 0), 0) / tasks.length).toFixed(0)
    : 0;

  const fReal = DB.financeiro.filter(f => f.obra === obraCod).reduce((a, f) => a + (Number(f.real) || 0), 0);
  
  const tDay = new Date().toISOString().split('T')[0];
  const pres = (DB.presenca || []).filter(p => p.obra === obraCod && p.data === tDay);
  const presentCount = pres.filter(p => p.presenca === 'Presente').length;

  const msg = `🏗️ *Resumo Semanal - ${o.nome}*
📅 Data: ${new Date().toLocaleDateString('pt-BR')}

📊 *Progresso Físico:* ${avgFisico}%
💰 *Gasto Acumulado:* ${fmt(fReal)}

👷 *Equipe Hoje:* ${presentCount} presentes
✅ *Tarefas:* ${tasks.filter(t => t.status === 'Concluída').length}/${tasks.length} concluídas

🚀 _Enviado via sistema Obra Real._`.trim();

  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}


window.shareObraWhatsApp = shareObraWhatsApp;

async function saveObra() {
  const cod = document.getElementById('ob-cod').value.trim();
  if (!cod) { toast('Informe o código da obra', 'error'); return; }
  const editIdx = parseInt(document.getElementById('ob-edit-idx').value) || -1;
  
  const duplicado = DB.obras.some((o, i) => o.cod === cod && i !== editIdx);
  if (duplicado) { toast(`Código "${cod}" já existe! Use outro.`, 'error'); return; }
  
  const data = {
    cod, 
    nome: document.getElementById('ob-nome').value,
    end: document.getElementById('ob-end').value,
    tipo: document.getElementById('ob-tipo').value,
    status: document.getElementById('ob-status').value,
    inicio: document.getElementById('ob-inicio').value,
    prazo: document.getElementById('ob-prazo').value,
    orc: parseFloat(document.getElementById('ob-orc').value) || 0,
    mestre: document.getElementById('ob-mestre').value,
    eng: document.getElementById('ob-eng').value,
    cliente: document.getElementById('ob-cliente').value,
    cliente_contato: document.getElementById('ob-cliente-contato').value,
    contrato_tipo: document.getElementById('ob-contrato-tipo').value,
    obs: document.getElementById('ob-obs').value
  };

  if (editIdx >= 0) {
    DB.obras[editIdx] = data;
    toast('Obra atualizada!');
  } else {
    const limite = (DB.config && DB.config.limiteObras) || 2;
    if (DB.obras.length >= limite) {
      toast(`Seu plano atingiu o limite de ${limite} obras. Faça upgrade para cadastrar mais!`, 'error');
      return;
    }
    DB.obras.push(data);
    toast('Obra cadastrada!');
  }

  closeModal('modal-obra'); 
  await persistDB(); 
  renderObras(); 
  if (typeof renderDashboard === 'function') renderDashboard();
}

async function editObra(idx) {
  await openModal('modal-obra');
  document.getElementById('ob-edit-idx').value = idx;
  const o = DB.obras[idx];
  document.getElementById('ob-cod').value = o.cod;
  document.getElementById('ob-nome').value = o.nome;
  document.getElementById('ob-end').value = o.end;
  document.getElementById('ob-tipo').value = o.tipo;
  document.getElementById('ob-status').value = o.status;
  document.getElementById('ob-inicio').value = o.inicio;
  document.getElementById('ob-prazo').value = o.prazo;
  document.getElementById('ob-orc').value = o.orc;
  document.getElementById('ob-mestre').value = o.mestre;
  document.getElementById('ob-eng').value = o.eng;
  document.getElementById('ob-cliente').value = o.cliente;
  document.getElementById('ob-cliente-contato').value = o.cliente_contato || '';
  document.getElementById('ob-contrato-tipo').value = o.contrato_tipo || 'Administração';
  document.getElementById('ob-obs').value = o.obs;
}

window.saveObra = saveObra;
window.editObra = editObra;
