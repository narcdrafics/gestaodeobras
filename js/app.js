// ==================== HELPERS ====================
const fmt = (v) => v != null && !isNaN(v) ? 'R$ ' + Number(v).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) : '—';
const fmtPct = (v) => v != null ? (v*100).toFixed(1)+'%' : '—';
const fmtDate = (d) => { if(!d) return '—'; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; };
const today = new Date().toISOString().split('T')[0];

function statusBadge(s) {
  const map = {
    'Em andamento':'badge-blue','Ativo':'badge-green','Presente':'badge-green',
    'Concluída':'badge-green','Concluído':'badge-green','Entregue':'badge-green','Pago':'badge-green','Aprovada':'badge-green',
    'Atrasada':'badge-red','Falta':'badge-red','Reprovada':'badge-red','Atrasado':'badge-red','CRÍTICO':'badge-red',
    'Aguardando':'badge-orange','Pendente':'badge-orange','Planejada':'badge-orange','A fazer':'badge-orange','Pedido Feito':'badge-orange',
    'Alta':'badge-red','Média':'badge-orange','Baixa':'badge-blue',
    'NORMAL':'badge-green','BAIXO':'badge-orange','SEM ESTOQUE':'badge-red',
    'Pausada':'badge-gray','Inativo':'badge-gray','Parcial':'badge-yellow','Divergência':'badge-yellow','Meio período':'badge-yellow',
  };
  const cls = map[s] || 'badge-gray';
  return `<span class="badge ${cls}">${s||'—'}</span>`;
}

function calcSaldo(item) { return (item.entrada||0) - (item.saida||0); }
function estoqueStatus(item) {
  const saldo = calcSaldo(item);
  if(saldo <= 0) return 'SEM ESTOQUE';
  if(saldo <= item.min) return 'CRÍTICO';
  if(saldo <= item.min * 1.5) return 'BAIXO';
  return 'NORMAL';
}

function nextCod(arr, prefix) {
  const nums = arr.map(x => parseInt((x.cod||x.num||'0').replace(/\D/g,''))||0);
  return prefix + String(Math.max(0,...nums)+1).padStart(3,'0');
}

// ==================== PAGE NAVIGATION ====================
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => { if(n.getAttribute('onclick')?.includes(id)) n.classList.add('active'); });
  document.querySelector('.sidebar').classList.remove('open');
  renderPage(id);
}

function renderPage(id) {
  const r = { dashboard:renderDashboard, obras:renderObras, trabalhadores:renderTrabalhadores,
    presenca:renderPresenca, tarefas:renderTarefas, estoque:renderEstoque,
    movEstoque:renderMovEstoque, compras:renderCompras, financeiro:renderFinanceiro,
    orcamento:renderOrcamento, medicao:renderMedicao, admin:renderAdmin };
  if(r[id]) r[id]();
}

// ==================== DASHBOARD ====================
function renderDashboard() {
  const obrasAtivas = DB.obras.filter(o => o.status === 'Em andamento').length;
  const tarefasAtrasadas = DB.tarefas.filter(t => t.status === 'Atrasada').length;
  const estoquesBaixos = DB.estoque.filter(e => ['BAIXO','CRÍTICO'].includes(estoqueStatus(e))).length;
  const comprasAguardando = DB.compras.filter(c => c.status === 'Aguardando').length;
  const totalPrev = DB.financeiro.reduce((a,f) => a+(f.prev||0), 0);
  const totalReal = DB.financeiro.reduce((a,f) => a+(f.real||0), 0);
  const pctCusto = totalPrev > 0 ? ((totalReal/totalPrev)*100).toFixed(1) : 0;
  const hoje = DB.presenca.filter(p => p.data === today);
  const presPresente = hoje.filter(p => p.presenca === 'Presente').length;
  const presTotal = hoje.length;

  document.getElementById('kpi-grid').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Obras Ativas</div><div class="kpi-val yellow">${obrasAtivas}</div><div class="kpi-sub">de ${DB.obras.length} cadastradas</div></div>
    <div class="kpi-card"><div class="kpi-label">Presença Hoje</div><div class="kpi-val ${presPresente===presTotal && presTotal>0?'green':'orange'}">${presPresente}/${presTotal}</div><div class="kpi-sub">${today}</div></div>
    <div class="kpi-card"><div class="kpi-label">Custo Real / Prev.</div><div class="kpi-val ${pctCusto>100?'red':'green'}">${pctCusto}%</div><div class="kpi-sub">${fmt(totalReal)} de ${fmt(totalPrev)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Tarefas Atrasadas</div><div class="kpi-val ${tarefasAtrasadas>0?'red':'green'}">${tarefasAtrasadas}</div><div class="kpi-sub">requer atenção imediata</div></div>
    <div class="kpi-card"><div class="kpi-label">Estoque Baixo/Crítico</div><div class="kpi-val ${estoquesBaixos>0?'orange':'green'}">${estoquesBaixos}</div><div class="kpi-sub">itens abaixo do mínimo</div></div>
    <div class="kpi-card"><div class="kpi-label">Compras Aguardando</div><div class="kpi-val ${comprasAguardando>0?'orange':'green'}">${comprasAguardando}</div><div class="kpi-sub">pendentes de aprovação</div></div>
  `;

  const alerts = [];
  DB.estoque.forEach(e => {
    const s = estoqueStatus(e);
    if(s === 'CRÍTICO') alerts.push({tipo:'ESTOQUE CRÍTICO', obra:e.obra, desc:`${e.mat} — saldo ${calcSaldo(e)} ${e.unid} (mín. ${e.min})`, resp:'Almoxarife', prior:'alto'});
    else if(s === 'BAIXO') alerts.push({tipo:'ESTOQUE BAIXO', obra:e.obra, desc:`${e.mat} — saldo ${calcSaldo(e)} ${e.unid} (mín. ${e.min})`, resp:'Almoxarife', prior:'medio'});
  });
  DB.tarefas.filter(t => t.status === 'Atrasada').forEach(t => alerts.push({tipo:'TAREFA ATRASADA', obra:t.obra, desc:`${t.desc} — prazo: ${fmtDate(t.prazo)}`, resp:t.resp, prior:'alto'}));
  DB.compras.filter(c => c.status === 'Aguardando').forEach(c => alerts.push({tipo:'COMPRA PENDENTE', obra:c.obra, desc:`${c.mat} — ${fmt(c.vtotal)}`, resp:'Gestor', prior:'medio'}));

  const alertIcons = {'ESTOQUE CRÍTICO':'🔴','ESTOQUE BAIXO':'🟡','TAREFA ATRASADA':'⏰','COMPRA PENDENTE':'🛒'};
  document.getElementById('alerts-grid').innerHTML = alerts.length
    ? alerts.map(a => `<div class="alert-card ${a.prior}"><div class="alert-icon">${alertIcons[a.tipo]||'⚠️'}</div><div class="alert-body"><h4>${a.tipo}</h4><p><b>${a.obra}</b> — ${a.desc}</p><p style="margin-top:4px">Resp: ${a.resp}</p></div></div>`).join('')
    : '<div style="color:var(--text3);font-size:13px;padding:8px">✅ Nenhum alerta no momento.</div>';

  const tbody = document.getElementById('dash-obras-tbody');
  tbody.innerHTML = DB.obras.map(o => {
    const tarefas = DB.tarefas.filter(t => t.obra === o.cod);
    const realizado = DB.financeiro.filter(f => f.obra === o.cod).reduce((a,f) => a+(f.real||0), 0);
    const pct = o.orc > 0 ? (realizado/o.orc*100).toFixed(1) : 0;
    return `<tr>
      <td><span class="cod">${o.cod}</span> ${o.nome}</td>
      <td>${statusBadge(o.status)}</td>
      <td>${o.mestre}</td>
      <td>${fmt(o.orc)}</td>
      <td>${fmt(realizado)}</td>
      <td>${pct}%</td>
      <td>${tarefas.filter(t=>t.status==='Concluída').length}/${tarefas.length} concluídas</td>
    </tr>`;
  }).join('');
  document.getElementById('dash-updated').textContent = 'Atualizado: ' + new Date().toLocaleString('pt-BR');
}

// ==================== OBRAS ====================
function renderObras() {
  const grid = document.getElementById('obras-grid');
  grid.innerHTML = DB.obras.map(o => {
    const realizado = DB.financeiro.filter(f => f.obra === o.cod).reduce((a,f) => a+(f.real||0), 0);
    const pct = o.orc > 0 ? (realizado/o.orc*100).toFixed(1) : 0;
    const tarefas = DB.tarefas.filter(t => t.obra === o.cod);
    return `<div class="obra-card" onclick="showPage('financeiro')">
      <h3>${o.nome}</h3>
      <div class="obra-meta">${o.end} · ${statusBadge(o.status)}</div>
      <div class="obra-stats">
        <div class="obra-stat"><div class="obra-stat-label">Orçamento</div><div class="obra-stat-val" style="font-size:13px">${fmt(o.orc)}</div></div>
        <div class="obra-stat"><div class="obra-stat-label">% Custo</div><div class="obra-stat-val">${pct}%</div></div>
        <div class="obra-stat"><div class="obra-stat-label">Mestre</div><div class="obra-stat-val" style="font-size:12px">${o.mestre}</div></div>
        <div class="obra-stat"><div class="obra-stat-label">Tarefas</div><div class="obra-stat-val" style="font-size:13px">${tarefas.filter(t=>t.status==='Concluída').length}/${tarefas.length}</div></div>
      </div>
    </div>`;
  }).join('');

  const tbody = document.getElementById('obras-tbody');
  tbody.innerHTML = DB.obras.map((o,i) => `<tr>
    <td><span class="cod">${o.cod}</span></td><td>${o.nome}</td><td>${o.tipo}</td>
    <td>${statusBadge(o.status)}</td><td>${fmtDate(o.inicio)}</td><td>${fmtDate(o.prazo)}</td>
    <td>${fmt(o.orc)}</td><td>${o.mestre}</td><td>${o.cliente}</td>
    <td><button class="btn btn-danger btn-sm" onclick="deleteItem('obras',${i})">🗑</button></td>
  </tr>`).join('');
}

// ==================== TRABALHADORES ====================
function renderTrabalhadores() {
  const tbody = document.getElementById('trab-tbody');
  tbody.innerHTML = DB.trabalhadores.length
    ? DB.trabalhadores.map((t,i) => `<tr>
        <td><span class="cod">${t.cod}</span></td><td>${t.nome}</td><td>${t.cpf}</td>
        <td>${t.funcao}</td><td>${statusBadge(t.vinculo)}</td><td>${t.obras}</td>
        <td>${fmt(t.diaria)}</td><td>${t.pgto}</td><td>${statusBadge(t.status)}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteItem('trabalhadores',${i})">🗑</button></td>
      </tr>`).join('')
    : '<tr class="empty-row"><td colspan="10">Nenhum trabalhador cadastrado</td></tr>';
}

// ==================== PRESENÇA ====================
function renderPresenca() {
  const hoje = DB.presenca.filter(p => p.data === today);
  const presentes = hoje.filter(p => p.presenca === 'Presente').length;
  const faltas = hoje.filter(p => p.presenca === 'Falta').length;
  const totalPagar = hoje.reduce((a,p) => a+(p.total||0), 0);
  document.getElementById('pres-kpi').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Presentes Hoje</div><div class="kpi-val green">${presentes}</div></div>
    <div class="kpi-card"><div class="kpi-label">Faltas Hoje</div><div class="kpi-val ${faltas>0?'red':'green'}">${faltas}</div></div>
    <div class="kpi-card"><div class="kpi-label">Total a Pagar Hoje</div><div class="kpi-val yellow" style="font-size:20px">${fmt(totalPagar)}</div></div>
  `;
  const tbody = document.getElementById('pres-tbody');
  tbody.innerHTML = DB.presenca.length
    ? DB.presenca.map((p,i) => `<tr>
        <td>${fmtDate(p.data)}</td><td><span class="cod">${p.obra}</span></td>
        <td>${p.nome}</td><td>${p.funcao}</td><td>${p.frente}</td>
        <td>${p.entrada||'—'}</td><td>${p.saida||'—'}</td>
        <td>${p.hnorm||0}h</td><td>${p.hextra||0}h</td>
        <td>${statusBadge(p.presenca)}</td>
        <td>${fmt(p.diaria)}</td><td><b>${fmt(p.total)}</b></td>
        <td>${p.lancador}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteItem('presenca',${i})">🗑</button></td>
      </tr>`).join('')
    : '<tr class="empty-row"><td colspan="14">Nenhum registro de presença</td></tr>';

  // Totais por obra/data
  const dates = [...new Set(DB.presenca.map(p=>p.data))];
  const totalsHtml = dates.map(d => {
    const rows = DB.presenca.filter(p => p.data === d);
    return `<div class="kpi-card">
      <div class="kpi-label">${fmtDate(d)}</div>
      <div style="font-size:13px;margin-top:4px">Presentes: <b style="color:var(--green)">${rows.filter(r=>r.presenca==='Presente').length}</b> · Faltas: <b style="color:var(--red)">${rows.filter(r=>r.presenca==='Falta').length}</b></div>
      <div style="font-size:13px;margin-top:4px">Total: <b style="color:var(--accent)">${fmt(rows.reduce((a,r)=>a+(r.total||0),0))}</b></div>
    </div>`;
  }).join('');
  document.getElementById('pres-totais').innerHTML = totalsHtml || '<p style="color:var(--text3)">—</p>';
}

// ==================== TAREFAS ====================
function renderTarefas() {
  const total = DB.tarefas.length;
  const conc = DB.tarefas.filter(t=>t.status==='Concluída').length;
  const atra = DB.tarefas.filter(t=>t.status==='Atrasada').length;
  document.getElementById('tar-kpi').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total Tarefas</div><div class="kpi-val">${total}</div></div>
    <div class="kpi-card"><div class="kpi-label">Concluídas</div><div class="kpi-val green">${conc}</div></div>
    <div class="kpi-card"><div class="kpi-label">Atrasadas</div><div class="kpi-val ${atra>0?'red':'green'}">${atra}</div></div>
    <div class="kpi-card"><div class="kpi-label">Em Andamento</div><div class="kpi-val blue">${DB.tarefas.filter(t=>t.status==='Em andamento').length}</div></div>
  `;
  const tbody = document.getElementById('tar-tbody');
  tbody.innerHTML = DB.tarefas.length
    ? DB.tarefas.map((t,i) => `<tr>
        <td><span class="cod">${t.cod}</span></td><td>${t.obra}</td><td>${t.etapa}</td><td>${t.frente}</td>
        <td>${t.desc}</td><td>${t.resp}</td><td>${statusBadge(t.prior)}</td>
        <td>${statusBadge(t.status)}</td><td>${fmtDate(t.criacao)}</td><td>${fmtDate(t.prazo)}</td>
        <td><div style="display:flex;align-items:center;gap:6px">
          <div class="progress-bar"><div class="progress-fill" style="width:${t.perc||0}%;background:${t.perc>=100?'var(--green)':t.status==='Atrasada'?'var(--red)':'var(--accent2)'}"></div></div>
          <span style="font-size:12px">${t.perc||0}%</span>
        </div></td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteItem('tarefas',${i})">🗑</button></td>
      </tr>`).join('')
    : '<tr class="empty-row"><td colspan="12">Nenhuma tarefa cadastrada</td></tr>';
}

// ==================== ESTOQUE ====================
function renderEstoque() {
  const tbody = document.getElementById('est-tbody');
  tbody.innerHTML = DB.estoque.length
    ? DB.estoque.map((e,i) => {
        const saldo = calcSaldo(e);
        const s = estoqueStatus(e);
        return `<tr>
          <td><span class="cod">${e.cod}</span></td><td>${e.mat}</td><td>${e.unid}</td>
          <td>${e.obra}</td><td>${e.min}</td><td>${e.entrada}</td><td>${e.saida}</td>
          <td><b style="color:${saldo<=e.min?'var(--red)':saldo<=e.min*1.5?'var(--orange)':'var(--green)'}">${saldo}</b></td>
          <td>${fmt(e.custo)}</td><td>${fmt(saldo*e.custo)}</td>
          <td>${statusBadge(s)}</td>
          <td><button class="btn btn-danger btn-sm" onclick="deleteItem('estoque',${i})">🗑</button></td>
        </tr>`;
      }).join('')
    : '<tr class="empty-row"><td colspan="12">Nenhum item no estoque</td></tr>';
}

// ==================== MOV. ESTOQUE ====================
function renderMovEstoque() {
  const tbody = document.getElementById('movest-tbody');
  tbody.innerHTML = DB.movEstoque.length
    ? DB.movEstoque.map((m,i) => `<tr>
        <td>${fmtDate(m.data)}</td><td><span class="cod">${m.codMat}</span></td><td>${m.mat}</td>
        <td>${m.obra}</td>
        <td><span class="badge ${m.tipo==='Entrada'?'badge-green':'badge-orange'}">${m.tipo}</span></td>
        <td>${m.qtd}</td><td>${m.frente||'—'}</td><td>${m.retirado||'—'}</td>
        <td>${m.autor||'—'}</td><td>${m.nf||'—'}</td>
        <td>${fmt(m.vunit)}</td><td>${fmt(m.vtotal)}</td><td>${m.obs||'—'}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteItem('movEstoque',${i})">🗑</button></td>
      </tr>`).join('')
    : '<tr class="empty-row"><td colspan="14">Nenhuma movimentação registrada</td></tr>';
}

// ==================== COMPRAS ====================
function renderCompras() {
  const tbody = document.getElementById('compras-tbody');
  tbody.innerHTML = DB.compras.length
    ? DB.compras.map((c,i) => `<tr>
        <td><span class="cod">${c.num}</span></td><td>${fmtDate(c.data)}</td><td>${c.obra}</td>
        <td>${c.mat}</td><td>${c.qtd}</td><td>${c.unid}</td>
        <td>${statusBadge(c.status)}</td><td>${c.forn||'—'}</td>
        <td>${fmt(c.vtotal)}</td><td>${fmtDate(c.prazo)}</td>
        <td>${c.conf||'—'}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteItem('compras',${i})">🗑</button></td>
      </tr>`).join('')
    : '<tr class="empty-row"><td colspan="12">Nenhuma compra registrada</td></tr>';
}

// ==================== FINANCEIRO ====================
function renderFinanceiro() {
  // Summary by obra
  const obras = [...new Set(DB.financeiro.map(f=>f.obra))];
  let sumHtml = '';
  let totalPrev=0, totalReal=0;
  obras.forEach(ob => {
    const rows = DB.financeiro.filter(f=>f.obra===ob);
    const p = rows.reduce((a,r)=>a+(r.prev||0),0);
    const r = rows.reduce((a,r)=>a+(r.real||0),0);
    totalPrev += p; totalReal += r;
    sumHtml += `<div class="fin-card"><div class="fin-card-label">${ob} — Previsto</div><div class="fin-card-val">${fmt(p)}</div></div>
    <div class="fin-card"><div class="fin-card-label">${ob} — Realizado</div><div class="fin-card-val" style="color:${r>p?'var(--red)':'var(--green)'}">${fmt(r)}</div></div>
    <div class="fin-card"><div class="fin-card-label">${ob} — Diferença</div><div class="fin-card-val" style="color:${r-p>0?'var(--red)':'var(--green)'}">${fmt(r-p)}</div></div>`;
  });
  sumHtml += `<div class="fin-card"><div class="fin-card-label">Total Geral Previsto</div><div class="fin-card-val">${fmt(totalPrev)}</div></div>
  <div class="fin-card"><div class="fin-card-label">Total Geral Realizado</div><div class="fin-card-val">${fmt(totalReal)}</div></div>
  <div class="fin-card"><div class="fin-card-label">Diferença Total</div><div class="fin-card-val" style="color:${totalReal-totalPrev>0?'var(--red)':'var(--green)'}">${fmt(totalReal-totalPrev)}</div></div>`;
  document.getElementById('fin-summary').innerHTML = sumHtml;

  const tbody = document.getElementById('fin-tbody');
  tbody.innerHTML = DB.financeiro.length
    ? DB.financeiro.map((f,i) => {
        const diff = (f.real||0) - (f.prev||0);
        return `<tr>
          <td>${fmtDate(f.data)}</td><td>${f.obra}</td><td>${f.etapa}</td><td>${f.tipo}</td>
          <td>${f.desc}</td><td>${f.forn||'—'}</td>
          <td>${fmt(f.prev)}</td><td>${fmt(f.real)}</td>
          <td style="color:${diff>0?'var(--red)':diff<0?'var(--green)':'var(--text)'}">${fmt(diff)}</td>
          <td>${f.pgto}</td><td>${statusBadge(f.status)}</td><td>${f.nf||'—'}</td>
          <td><button class="btn btn-danger btn-sm" onclick="deleteItem('financeiro',${i})">🗑</button></td>
        </tr>`;
      }).join('')
    : '<tr class="empty-row"><td colspan="13">Nenhum lançamento financeiro</td></tr>';
}

// ==================== ORÇAMENTO ====================
function renderOrcamento() {
  const tbody = document.getElementById('orc-tbody');
  tbody.innerHTML = DB.orcamento.length
    ? DB.orcamento.map((o,i) => {
        const diff = (o.vtotal||0) - (o.vreal||0);
        const pexec = o.vtotal > 0 ? ((o.vreal||0)/o.vtotal*100).toFixed(1) : 0;
        return `<tr>
          <td>${o.obra}</td><td>${o.etapa}</td><td>${o.tipo}</td><td>${o.desc}</td>
          <td>${o.qtd}</td><td>${o.unid}</td>
          <td>${fmt(o.vunit)}</td><td>${fmt(o.vtotal)}</td>
          <td>${fmt(o.vreal)}</td>
          <td style="color:${diff<0?'var(--red)':'var(--text)'}">${fmt(diff)}</td>
          <td>${pexec}%</td>
          <td><button class="btn btn-danger btn-sm" onclick="deleteItem('orcamento',${i})">🗑</button></td>
        </tr>`;
      }).join('')
    : '<tr class="empty-row"><td colspan="12">Nenhum item de orçamento</td></tr>';
}

// ==================== MEDIÇÃO ====================
function renderMedicao() {
  const tbody = document.getElementById('med-tbody');
  tbody.innerHTML = DB.medicao.length
    ? DB.medicao.map((m,i) => {
        const av = m.qprev > 0 ? (m.qreal/m.qprev) : 0;
        return `<tr>
          <td>${fmtDate(m.semana)}</td><td>${m.obra}</td><td>${m.etapa}</td>
          <td>${m.frente}</td><td>${m.equipe}</td><td>${m.servico}</td>
          <td>${m.unid}</td><td>${m.qprev}</td><td>${m.qreal}</td>
          <td><div style="display:flex;align-items:center;gap:6px">
            <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(av*100,100)}%;background:${av>=1?'var(--green)':av>=0.7?'var(--accent2)':'var(--orange)'}"></div></div>
            <span style="font-size:12px">${(av*100).toFixed(1)}%</span>
          </div></td>
          <td>${statusBadge(m.retr==='Sim'?'Alta':'Baixa').replace('Alta','Sim').replace('Baixa','Não')}</td>
          <td>${m.obs||'—'}</td>
          <td><button class="btn btn-danger btn-sm" onclick="deleteItem('medicao',${i})">🗑</button></td>
        </tr>`;
      }).join('')
    : '<tr class="empty-row"><td colspan="13">Nenhuma medição registrada</td></tr>';
}

// ==================== ADMINISTRAÇÃO ====================
function renderAdmin() {
  if (DB.config) {
    document.getElementById('cfg-empresa').value = DB.config.nomeEmpresa || '';
    document.getElementById('cfg-cor').value = DB.config.corPrimaria || '#f59e0b';
  }
  
  const tbody = document.getElementById('usuarios-tbody');
  tbody.innerHTML = (DB.usuarios && DB.usuarios.length)
    ? DB.usuarios.map((u,i) => `<tr>
        <td><b>${u.email||u.username}</b></td><td>${u.name}</td>
        <td><span class="badge ${u.role==='admin'?'badge-red':u.role==='engenheiro'?'badge-blue':'badge-orange'}">${u.role.toUpperCase()}</span></td>
        <td>
           <button class="btn btn-secondary btn-sm" onclick="editUsuario(${i})" style="margin-right:8px">✏️</button>
           <button class="btn btn-danger btn-sm" onclick="deleteUsuario(${i})">🗑</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="4">Erro ao carregar usuários.</td></tr>';
}

function salvarConfiguracoes() {
  const emp = document.getElementById('cfg-empresa').value;
  const cor = document.getElementById('cfg-cor').value;
  if (!DB.config) DB.config = {};
  DB.config.nomeEmpresa = emp;
  DB.config.corPrimaria = cor;
  persistDB();
  loadTheme();
  toast('Configurações visuais salvas e aplicadas em tempo real!');
}

function editUsuario(idx) {
  const u = DB.usuarios[idx];
  document.getElementById('usr-edit-idx').value = idx;
  document.getElementById('usr-email').value = u.email || u.username || '';
  document.getElementById('usr-name').value = u.name;
  document.getElementById('usr-role').value = u.role;
  document.getElementById('usr-email').disabled = true; // Block email edit
  openModal('modal-usuario');
}

function deleteUsuario(idx) {
  if(DB.usuarios[idx].role === 'admin' && DB.usuarios.filter(u=>u.role==='admin').length <= 1) {
    toast('Não é possível remover o único administrador restante!', 'error');
    return;
  }
  if(confirm('Remover usuário? Isso derrubará ele instantaneamente de qualquer tela.')) {
    DB.usuarios.splice(idx, 1);
    persistDB();
    renderAdmin();
    toast('Usuário removido!');
  }
}

// ==================== MODAL UTILS ====================
function openModal(id) {
  const m = document.getElementById(id);
  m.classList.add('open');
  // Populate selects
  const obraSelects = m.querySelectorAll('select[id$="-obra"], select[id^="pr-obra"], select[id^="fn-obra"], select[id^="cp-obra"], select[id^="md-obra"], select[id^="tf-obra"], select[id^="es-obra"], select[id^="mv-obra"], select[id^="oc-obra"]');
  obraSelects.forEach(sel => {
    sel.innerHTML = DB.obras.map(o => `<option value="${o.cod}">${o.cod} — ${o.nome}</option>`).join('');
  });
  if(id === 'modal-presenca') {
    document.getElementById('pr-data').value = today;
    const tsel = document.getElementById('pr-trab');
    tsel.innerHTML = DB.trabalhadores.filter(t=>t.status==='Ativo').map(t=>`<option value="${t.cod}">${t.nome}</option>`).join('');
    fillTrabInfo();
  }
  if(id === 'modal-tarefa') {
    document.getElementById('tf-cod').value = nextCod(DB.tarefas,'TF');
    document.getElementById('tf-criacao').value = today;
  }
  if(id === 'modal-compra') {
    document.getElementById('cp-num').value = nextCod(DB.compras,'PC');
    document.getElementById('cp-data').value = today;
  }
  if(id === 'modal-financeiro') document.getElementById('fn-data').value = today;
  if(id === 'modal-presenca') calcPresenca();
  if(id === 'modal-movest') {
    document.getElementById('mv-data').value = today;
    const msel = document.getElementById('mv-mat');
    msel.innerHTML = DB.estoque.map(e => `<option value="${e.cod}">${e.cod} — ${e.mat} (${e.obra})</option>`).join('');
    fillMatInfo();
  }
  if(id === 'modal-medicao') document.getElementById('md-semana').value = today;
  if(id === 'modal-usuario') {
    if(document.getElementById('usr-edit-idx').value === '-1') {
       document.getElementById('usr-email').value = '';
       document.getElementById('usr-email').disabled = false;
       document.getElementById('usr-name').value = '';
       document.getElementById('usr-role').value = 'engenheiro';
    }
  }
}

function closeModal(id) { 
  document.getElementById(id).classList.remove('open'); 
  if(id === 'modal-usuario') document.getElementById('usr-edit-idx').value = '-1';
}

function fillTrabInfo() {
  const sel = document.getElementById('pr-trab').value;
  const t = DB.trabalhadores.find(x=>x.cod===sel);
  if(t) {
    document.getElementById('pr-funcao').value = t.funcao;
    document.getElementById('pr-diaria').value = t.diaria;
    calcPresenca();
  }
}

function fillMatInfo() {
  const sel = document.getElementById('mv-mat').value;
  const e = DB.estoque.find(x=>x.cod===sel);
  if(e) {
    document.getElementById('mv-matname').value = e.mat;
    document.getElementById('mv-vunit').value = e.custo;
    calcMovTotal();
  }
}

function calcPresenca() {
  const entrada = document.getElementById('pr-entrada')?.value || '07:00';
  const saida = document.getElementById('pr-saida')?.value || '17:00';
  const presenca = document.getElementById('pr-presenca')?.value;
  if(presenca === 'Falta') { document.getElementById('pr-total').value = 0; return; }
  const [eh,em] = entrada.split(':').map(Number);
  const [sh,sm] = saida.split(':').map(Number);
  const hTrabalhadas = Math.max(0, (sh*60+sm - eh*60-em)/60);
  const hnorm = Math.min(hTrabalhadas, 8);
  const hextra = Math.max(0, hTrabalhadas - 8);
  document.getElementById('pr-hnorm').value = hTrabalhadas.toFixed(1);
  const diaria = parseFloat(document.getElementById('pr-diaria').value)||0;
  const total = hTrabalhadas > 0 ? diaria * (hTrabalhadas/8) * (1 + hextra*0.5/8) : 0;
  document.getElementById('pr-total').value = total.toFixed(2);
}

function togglePresenca() {
  const v = document.getElementById('pr-presenca').value;
  const show = v !== 'Falta';
  document.getElementById('pr-entrada-grp').style.display = show ? '' : 'none';
  document.getElementById('pr-saida-grp').style.display = show ? '' : 'none';
  if(!show) document.getElementById('pr-total').value = 0;
}

function calcMovTotal() {
  const q = parseFloat(document.getElementById('mv-qtd').value)||0;
  const v = parseFloat(document.getElementById('mv-vunit').value)||0;
  document.getElementById('mv-vtotal').value = (q*v).toFixed(2);
}
function calcCompraTotal() {
  const q = parseFloat(document.getElementById('cp-qtd').value)||0;
  const v = parseFloat(document.getElementById('cp-vunit').value)||0;
  document.getElementById('cp-vtotal').value = (q*v).toFixed(2);
}
function calcFinDiff() {
  const p = parseFloat(document.getElementById('fn-prev').value)||0;
  const r = parseFloat(document.getElementById('fn-real').value)||0;
  document.getElementById('fn-diff').value = (r-p).toFixed(2);
}
function calcOrcTotal() {
  const q = parseFloat(document.getElementById('oc-qtd').value)||0;
  const v = parseFloat(document.getElementById('oc-vunit').value)||0;
  document.getElementById('oc-vtotal').value = (q*v).toFixed(2);
}
function calcAvanco() {
  const p = parseFloat(document.getElementById('md-qprev').value)||0;
  const r = parseFloat(document.getElementById('md-qreal').value)||0;
  document.getElementById('md-avanco').value = p > 0 ? (r/p*100).toFixed(1) : 0;
}

// ==================== SAVE FUNCTIONS ====================
function saveObra() {
  const cod = document.getElementById('ob-cod').value.trim();
  if(!cod) { toast('Informe o código da obra','error'); return; }
  DB.obras.push({
    cod, nome:document.getElementById('ob-nome').value,
    end:document.getElementById('ob-end').value,
    tipo:document.getElementById('ob-tipo').value,
    status:document.getElementById('ob-status').value,
    inicio:document.getElementById('ob-inicio').value,
    prazo:document.getElementById('ob-prazo').value,
    orc:parseFloat(document.getElementById('ob-orc').value)||0,
    mestre:document.getElementById('ob-mestre').value,
    eng:document.getElementById('ob-eng').value,
    cliente:document.getElementById('ob-cliente').value,
    obs:document.getElementById('ob-obs').value
  });
  closeModal('modal-obra'); renderObras(); persistDB(); toast('Obra cadastrada!');
}

function saveTrabalhador() {
  const cod = document.getElementById('tr-cod').value.trim();
  if(!cod) { toast('Informe o código','error'); return; }
  DB.trabalhadores.push({
    cod, nome:document.getElementById('tr-nome').value,
    cpf:document.getElementById('tr-cpf').value,
    funcao:document.getElementById('tr-funcao').value,
    vinculo:document.getElementById('tr-vinculo').value,
    equipe:document.getElementById('tr-equipe').value,
    obras:document.getElementById('tr-obras').value,
    diaria:parseFloat(document.getElementById('tr-diaria').value)||0,
    pgto:document.getElementById('tr-pgto').value,
    contato:document.getElementById('tr-contato').value,
    status:document.getElementById('tr-status').value,
    admissao:document.getElementById('tr-admissao').value
  });
  closeModal('modal-trabalhador'); renderTrabalhadores(); persistDB(); toast('Trabalhador cadastrado!');
}

function savePresenca() {
  const tsel = document.getElementById('pr-trab').value;
  const t = DB.trabalhadores.find(x=>x.cod===tsel);
  DB.presenca.push({
    data:document.getElementById('pr-data').value,
    obra:document.getElementById('pr-obra').value,
    nome:t?t.nome:tsel,
    funcao:document.getElementById('pr-funcao').value,
    vinculo:t?t.vinculo:'',
    equipe:t?t.equipe:'',
    frente:document.getElementById('pr-frente').value,
    entrada:document.getElementById('pr-entrada').value,
    saida:document.getElementById('pr-saida').value,
    hnorm:parseFloat(document.getElementById('pr-hnorm').value)||0,
    hextra:parseFloat(document.getElementById('pr-hextra').value)||0,
    presenca:document.getElementById('pr-presenca').value,
    justif:document.getElementById('pr-obs').value,
    diaria:parseFloat(document.getElementById('pr-diaria').value)||0,
    total:parseFloat(document.getElementById('pr-total').value)||0,
    lancador:document.getElementById('pr-lancador').value,
    hrLanc:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
    obs:document.getElementById('pr-obs').value
  });
  closeModal('modal-presenca'); renderPresenca(); persistDB(); toast('Presença registrada!');
}

function saveTarefa() {
  DB.tarefas.push({
    cod:document.getElementById('tf-cod').value,
    obra:document.getElementById('tf-obra').value,
    etapa:document.getElementById('tf-etapa').value,
    frente:document.getElementById('tf-frente').value,
    desc:document.getElementById('tf-desc').value,
    resp:document.getElementById('tf-resp').value,
    prior:document.getElementById('tf-prior').value,
    status:document.getElementById('tf-status').value,
    criacao:document.getElementById('tf-criacao').value,
    prazo:document.getElementById('tf-prazo').value,
    conclusao:document.getElementById('tf-conclusao').value,
    perc:parseInt(document.getElementById('tf-perc').value)||0,
    foto:document.getElementById('tf-foto').value,
    obs:document.getElementById('tf-obs').value
  });
  closeModal('modal-tarefa'); renderTarefas(); persistDB(); toast('Tarefa criada!');
}

function saveEstoque() {
  DB.estoque.push({
    cod:document.getElementById('es-cod').value,
    mat:document.getElementById('es-mat').value,
    unid:document.getElementById('es-unid').value,
    obra:document.getElementById('es-obra').value,
    min:parseFloat(document.getElementById('es-min').value)||0,
    entrada:parseFloat(document.getElementById('es-entrada').value)||0,
    saida:0,
    custo:parseFloat(document.getElementById('es-custo').value)||0,
    obs:document.getElementById('es-obs').value
  });
  closeModal('modal-estoque'); renderEstoque(); persistDB(); toast('Item de estoque cadastrado!');
}

function saveMovEstoque() {
  const codMat = document.getElementById('mv-mat').value;
  const e = DB.estoque.find(x=>x.cod===codMat);
  const tipo = document.getElementById('mv-tipo').value;
  const qtd = parseFloat(document.getElementById('mv-qtd').value)||0;
  if(e) {
    if(tipo === 'Entrada') e.entrada += qtd;
    else { if(qtd > calcSaldo(e)) { toast('Qtd. maior que saldo!','error'); return; } e.saida += qtd; }
  }
  DB.movEstoque.push({
    data:document.getElementById('mv-data').value,
    codMat, mat:document.getElementById('mv-matname').value,
    obra:document.getElementById('mv-obra').value,
    tipo, qtd,
    frente:document.getElementById('mv-frente').value,
    retirado:document.getElementById('mv-retirado').value,
    autor:document.getElementById('mv-autor').value,
    nf:document.getElementById('mv-nf').value,
    vunit:parseFloat(document.getElementById('mv-vunit').value)||0,
    vtotal:parseFloat(document.getElementById('mv-vtotal').value)||0,
    obs:document.getElementById('mv-obs').value
  });
  closeModal('modal-movest'); renderMovEstoque(); persistDB(); toast('Movimentação registrada!');
}

function saveCompra() {
  DB.compras.push({
    num:document.getElementById('cp-num').value,
    data:document.getElementById('cp-data').value,
    obra:document.getElementById('cp-obra').value,
    mat:document.getElementById('cp-mat').value,
    qtd:parseFloat(document.getElementById('cp-qtd').value)||0,
    unid:document.getElementById('cp-unid').value,
    status:document.getElementById('cp-status').value,
    forn:document.getElementById('cp-forn').value,
    vunit:parseFloat(document.getElementById('cp-vunit').value)||0,
    vtotal:parseFloat(document.getElementById('cp-vtotal').value)||0,
    vorc:parseFloat(document.getElementById('cp-vorc').value)||0,
    prazo:document.getElementById('cp-prazo').value,
    receb:document.getElementById('cp-receb').value,
    conf:document.getElementById('cp-conf').value,
    obs:document.getElementById('cp-obs').value
  });
  closeModal('modal-compra'); renderCompras(); persistDB(); toast('Compra registrada!');
}

function saveFinanceiro() {
  const prev = parseFloat(document.getElementById('fn-prev').value)||0;
  const real = parseFloat(document.getElementById('fn-real').value)||0;
  DB.financeiro.push({
    data:document.getElementById('fn-data').value,
    obra:document.getElementById('fn-obra').value,
    etapa:document.getElementById('fn-etapa').value,
    tipo:document.getElementById('fn-tipo').value,
    desc:document.getElementById('fn-desc').value,
    forn:document.getElementById('fn-forn').value,
    prev, real,
    pgto:document.getElementById('fn-pgto').value,
    status:document.getElementById('fn-status').value,
    nf:document.getElementById('fn-nf').value,
    obs:document.getElementById('fn-obs').value
  });
  closeModal('modal-financeiro'); renderFinanceiro(); persistDB(); toast('Lançamento financeiro salvo!');
}

function saveOrcamento() {
  const qtd = parseFloat(document.getElementById('oc-qtd').value)||0;
  const vunit = parseFloat(document.getElementById('oc-vunit').value)||0;
  DB.orcamento.push({
    obra:document.getElementById('oc-obra').value,
    etapa:document.getElementById('oc-etapa').value,
    tipo:document.getElementById('oc-tipo').value,
    desc:document.getElementById('oc-desc').value,
    qtd, unid:document.getElementById('oc-unid').value,
    vunit, vtotal:qtd*vunit, vreal:0,
    obs:document.getElementById('oc-obs').value
  });
  closeModal('modal-orcamento'); renderOrcamento(); persistDB(); toast('Item de orçamento salvo!');
}

function saveMedicao() {
  const qprev = parseFloat(document.getElementById('md-qprev').value)||0;
  const qreal = parseFloat(document.getElementById('md-qreal').value)||0;
  DB.medicao.push({
    semana:document.getElementById('md-semana').value,
    obra:document.getElementById('md-obra').value,
    etapa:document.getElementById('md-etapa').value,
    frente:document.getElementById('md-frente').value,
    equipe:document.getElementById('md-equipe').value,
    servico:document.getElementById('md-servico').value,
    unid:document.getElementById('md-unid').value,
    qprev, qreal,
    retr:document.getElementById('md-retr').value,
    obs:document.getElementById('md-obs').value
  });
  closeModal('modal-medicao'); renderMedicao(); persistDB(); toast('Medição salva!');
}

function saveUsuario() {
  const email = document.getElementById('usr-email').value.trim();
  const name = document.getElementById('usr-name').value.trim();
  const role = document.getElementById('usr-role').value;
  const editIdx = parseInt(document.getElementById('usr-edit-idx').value);

  if(!email || !name) {
    toast('Preencha os campos obrigatórios (E-mail e Nome).', 'error');
    return;
  }

  if(editIdx >= 0) {
    DB.usuarios[editIdx] = { email: email, name: name, role: role };
    toast('Permissões de Usuário atualizadas!');
  } else {
    // New
    if(DB.usuarios.find(u => u.email === email)) {
       toast('Este e-mail do Google já está cadastrado.', 'error');
       return;
    }
    DB.usuarios.push({ email: email, name: name, role: role });
    toast('Novo funcionário autorizado a entrar no sistema!');
  }
  
  closeModal('modal-usuario'); 
  renderAdmin(); 
  persistDB(); 
}

// ==================== DELETE ====================
function deleteItem(table, idx) {
  if(!confirm('Remover este registro?')) return;
  DB[table].splice(idx, 1);
  renderPage(document.querySelector('.page.active').id.replace('page-',''));
  persistDB();
  toast('Removido!');
}

// ==================== FILTER TABLE ====================
function filterTable(tbodyId, query, cols) {
  const q = query.toLowerCase();
  const rows = document.getElementById(tbodyId).querySelectorAll('tr:not(.empty-row)');
  rows.forEach(r => {
    const cells = r.querySelectorAll('td');
    const match = cols.some(ci => cells[ci] && cells[ci].textContent.toLowerCase().includes(q));
    r.style.display = match || !q ? '' : 'none';
  });
}

// ==================== TOAST ====================
function toast(msg, type='success') {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${type==='success'?'✅':'❌'} ${msg}`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ==================== INIT ====================
window.onclick = function(e) {
  document.querySelectorAll('.modal-overlay.open').forEach(m => {
    if(e.target === m) m.classList.remove('open');
  });
};

document.getElementById('header-date').textContent = new Date().toLocaleDateString('pt-BR', {weekday:'long', year:'numeric', month:'long', day:'numeric'});

renderDashboard();

