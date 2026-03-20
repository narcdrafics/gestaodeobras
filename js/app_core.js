// ==================== HELPERS ====================
let currentEditIdx = -1; // Global variable to identify if we are creating new (-1) or editing an existing record.

const fmt = (v) => v != null && !isNaN(v) ? 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
const fmtPct = (v) => v != null ? (v * 100).toFixed(1) + '%' : '—';
const fmtDate = (d) => { if (!d) return '—'; const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
const today = new Date().toISOString().split('T')[0];

function statusBadge(s) {
  const map = {
    'Em andamento': 'badge-blue', 'Ativo': 'badge-green', 'Presente': 'badge-green',
    'Concluída': 'badge-green', 'Concluído': 'badge-green', 'Entregue': 'badge-green', 'Pago': 'badge-green', 'Aprovada': 'badge-green',
    'Atrasada': 'badge-red', 'Falta': 'badge-red', 'Reprovada': 'badge-red', 'Atrasado': 'badge-red', 'CRÍTICO': 'badge-red',
    'Aguardando': 'badge-orange', 'Pendente': 'badge-orange', 'Planejada': 'badge-orange', 'A fazer': 'badge-orange', 'Pedido Feito': 'badge-orange',
    'Alta': 'badge-red', 'Média': 'badge-orange', 'Baixa': 'badge-blue',
    'NORMAL': 'badge-green', 'BAIXO': 'badge-orange', 'SEM ESTOQUE': 'badge-red',
    'Pausada': 'badge-gray', 'Inativo': 'badge-gray', 'Parcial': 'badge-yellow', 'Divergência': 'badge-yellow', 'Meio período': 'badge-yellow',
  };
  const cls = map[s] || 'badge-gray';
  return `<span class="badge ${cls}">${s || '—'}</span>`;
}

function calcSaldo(item) { return (item.entrada || 0) - (item.saida || 0); }
function estoqueStatus(item) {
  const saldo = calcSaldo(item);
  if (saldo <= 0) return 'SEM ESTOQUE';
  if (saldo <= item.min) return 'CRÍTICO';
  if (saldo <= item.min * 1.5) return 'BAIXO';
  return 'NORMAL';
}

function nextCod(arr, prefix) {
  const nums = arr.map(x => parseInt((x.cod || x.num || '0').replace(/\D/g, '')) || 0);
  return prefix + String(Math.max(0, ...nums) + 1).padStart(3, '0');
}

// ==================== PAGE NAVIGATION (DYNAMIC FETCH) ====================
const cachePaginas = {};

async function carregarHTML(caminho) {
  if (cachePaginas[caminho]) return cachePaginas[caminho];
  try {
    const res = await fetch(caminho);
    if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
    const html = await res.text();
    cachePaginas[caminho] = html;
    return html;
  } catch (err) {
    console.error('Falha ao buscar:', caminho, err);
    return `<div style="padding: 20px; color: var(--red)">Erro ao carregar o componente: ${caminho}</div>`;
  }
}

async function showPage(id) {
  // Atualiza o menu lateral (Estilos)
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => { if (n.getAttribute('onclick')?.includes(id)) n.classList.add('active'); });
  document.querySelector('.sidebar').classList.remove('open');

  // Adiciona um loading simples enquanto busca
  const mainEl = document.getElementById("conteudo-principal");
  mainEl.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text3)">Carregando tela...</div>';

  // Busca e injeta o HTML da pasta pages/
  const html = await carregarHTML(`pages/${id}.html`);
  mainEl.innerHTML = `<div class="page active" id="page-${id}">${html}</div>`;

  // Chama a lógica de renderização
  renderPage(id);
}

function renderPage(id) {
  const r = {
    dashboard: renderDashboard, obras: renderObras, trabalhadores: renderTrabalhadores,
    presenca: renderPresenca, tarefas: renderTarefas, estoque: renderEstoque,
    movEstoque: renderMovEstoque, compras: renderCompras, financeiro: renderFinanceiro,
    orcamento: renderOrcamento, medicao: renderMedicao, admin: renderAdmin,
    fotos: renderFotos, super_admin: renderSuperAdmin
  };
  if (r[id]) r[id]();
}

function safeSetInner(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function safeSetText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function safeSetValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function safeSetStyle(id, prop, val) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = val;
}


// ==================== DASHBOARD ====================
function renderDashboard() {
  const obrasAtivas = DB.obras.filter(o => ['Em andamento', 'Planejada'].includes(o.status)).length;
  const tarefasAtrasadas = DB.tarefas.filter(t => t.status === 'Atrasada').length;
  const estoquesBaixos = DB.estoque.filter(e => ['BAIXO', 'CRÍTICO'].includes(estoqueStatus(e))).length;
  const comprasAguardando = DB.compras.filter(c => c.status === 'Aguardando').length;
  const totalPrev = DB.financeiro.reduce((a, f) => a + (f.prev || 0), 0);

  // Unificação Rápida Financeira Global do Dashboard
  let globalFinance = [];
  DB.financeiro.forEach(f => globalFinance.push({ obra: f.obra, data: f.data, v: parseFloat(f.real) || 0 }));
  DB.presenca.forEach(p => globalFinance.push({ obra: p.obra, data: p.data, v: parseFloat(p.total) || 0 }));
  DB.medicao.forEach(m => globalFinance.push({ obra: m.obra, data: m.semana, v: parseFloat(m.vtotal) || 0 }));

  const totalRealGlobal = globalFinance.reduce((a, f) => a + f.v, 0);
  const pctCusto = totalPrev > 0 ? ((totalRealGlobal / totalPrev) * 100).toFixed(1) : 0;
  
  const hoje = DB.presenca.filter(p => p.data === today);
  const presPresente = hoje.filter(p => p.presenca === 'Presente').length;
  const presTotal = hoje.length;

  const todayDate = new Date();
  const fSemana = new Date(todayDate);
  fSemana.setDate(fSemana.getDate() - fSemana.getDay());
  const strSemana = fSemana.toISOString().split('T')[0];
  const fMes = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const strMes = fMes.toISOString().split('T')[0];

  const cDiariasSemana = DB.presenca
    .filter(p => p.data >= strSemana && p.data <= today)
    .reduce((a, p) => a + (parseFloat(p.total) || 0), 0);
    
  const cEmpreitaSemana = DB.medicao
    .filter(m => m.semana >= strSemana && m.semana <= today)
    .reduce((a, m) => a + (parseFloat(m.vtotal) || 0), 0);

  const kpiGrid = document.getElementById('kpi-grid');
  if (kpiGrid) {
    kpiGrid.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Obras Ativas</div><div class="kpi-val yellow">${obrasAtivas}</div><div class="kpi-sub">de ${DB.obras.length} cadastradas</div></div>
      <div class="kpi-card"><div class="kpi-label">Diárias (Semana)</div><div class="kpi-val blue">${fmt(cDiariasSemana)}</div><div class="kpi-sub">Custo de Folha na contabilidade</div></div>
      <div class="kpi-card"><div class="kpi-label">Empreitas (Semana)</div><div class="kpi-val blue" style="font-size:20px">${fmt(cEmpreitaSemana)}</div><div class="kpi-sub">Custo de Medições na contabilidade</div></div>
      <div class="kpi-card"><div class="kpi-label">Custo Real / Prev.</div><div class="kpi-val ${pctCusto > 100 ? 'red' : 'green'}">${pctCusto}%</div><div class="kpi-sub">${fmt(totalRealGlobal)} de ${fmt(totalPrev)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Tarefas Atrasadas</div><div class="kpi-val ${tarefasAtrasadas > 0 ? 'red' : 'green'}">${tarefasAtrasadas}</div><div class="kpi-sub">requer atenção imediata</div></div>
      <div class="kpi-card"><div class="kpi-label">Estoque Baixo/Crítico</div><div class="kpi-val ${estoquesBaixos > 0 ? 'orange' : 'green'}">${estoquesBaixos}</div><div class="kpi-sub">itens abaixo do mínimo</div></div>
    `;
  }

  const alerts = [];
  DB.estoque.forEach(e => {
    const s = estoqueStatus(e);
    if (s === 'CRÍTICO') alerts.push({ tipo: 'ESTOQUE CRÍTICO', obra: e.obra, desc: `${e.mat} — saldo ${calcSaldo(e)} ${e.unid} (mín. ${e.min})`, resp: 'Almoxarife', prior: 'alto' });
    else if (s === 'BAIXO') alerts.push({ tipo: 'ESTOQUE BAIXO', obra: e.obra, desc: `${e.mat} — saldo ${calcSaldo(e)} ${e.unid} (mín. ${e.min})`, resp: 'Almoxarife', prior: 'medio' });
  });
  DB.tarefas.filter(t => t.status === 'Atrasada').forEach(t => alerts.push({ tipo: 'TAREFA ATRASADA', obra: t.obra, desc: `${t.desc} — prazo: ${fmtDate(t.prazo)}`, resp: t.resp, prior: 'alto' }));
  DB.compras.filter(c => c.status === 'Aguardando').forEach(c => alerts.push({ tipo: 'COMPRA PENDENTE', obra: c.obra, desc: `${c.mat} — ${fmt(c.vtotal)}`, resp: 'Gestor', prior: 'medio' }));

  // Pagamentos pendentes — 1 card consolidado por tipo
  const pDiarias = DB.presenca.filter(p => p.total > 0 && ['Pendente', 'Atrasado'].includes(p.pgtoStatus || 'Pendente'));
  if (pDiarias.length > 0) {
    const totalD = pDiarias.reduce((a, p) => a + (parseFloat(p.total) || 0), 0);
    const temAtrasadoD = pDiarias.some(p => p.pgtoStatus === 'Atrasado');
    alerts.push({
      tipo: 'DIÁRIAS PENDENTES',
      obra: `${pDiarias.length} diária(s) em aberto`,
      desc: `Total a pagar: ${fmt(totalD)} — Clique para ver na aba Presença`,
      resp: 'Financeiro',
      prior: temAtrasadoD ? 'alto' : 'medio',
      action: "showPage('presenca')"
    });
  }

  const pMedicao = DB.medicao.filter(m => m.vtotal > 0 && ['Pendente', 'Parcial', 'Atrasado'].includes(m.pgtoStatus || 'Pendente'));
  if (pMedicao.length > 0) {
    const totalM = pMedicao.reduce((a, m) => a + (parseFloat(m.vtotal) || 0), 0);
    const temAtrasadoM = pMedicao.some(m => m.pgtoStatus === 'Atrasado');
    alerts.push({
      tipo: 'EMPREITAS PENDENTES',
      obra: `${pMedicao.length} medição(ões) em aberto`,
      desc: `Total a pagar: ${fmt(totalM)} — Clique para ver na aba Medição`,
      resp: 'Financeiro',
      prior: temAtrasadoM ? 'alto' : 'medio',
      action: "showPage('medicao')"
    });
  }

  const pFin = DB.financeiro.filter(f => {
    const val = f.real > 0 ? f.real : f.prev;
    return val > 0 && ['Pendente', 'Parcial', 'Atrasado'].includes(f.status || 'Pendente');
  });
  if (pFin.length > 0) {
    const totalF = pFin.reduce((a, f) => a + (f.real > 0 ? f.real : f.prev), 0);
    const temAtrasadoF = pFin.some(f => f.status === 'Atrasado');
    alerts.push({
      tipo: 'PAGAMENTOS FINANCEIRO',
      obra: `${pFin.length} lançamento(s) em aberto`,
      desc: `Total a pagar: ${fmt(totalF)} — Clique para ver no Financeiro`,
      resp: 'Financeiro',
      prior: temAtrasadoF ? 'alto' : 'medio',
      action: "showPage('financeiro')"
    });
  }

  const currentUserStr = sessionStorage.getItem('gestaoUser');
  if(currentUserStr) {
     const currentUser = JSON.parse(currentUserStr);
     if(currentUser.role === 'admin' && DB.usuarios) {
        const contasPendentes = DB.usuarios.filter(u => u.role === 'pendente');
        contasPendentes.forEach(pUser => {
           alerts.push({ tipo: 'NOVO USUÁRIO', obra: 'SISTEMA', desc: `${pUser.name} (${pUser.email}) solicitou acesso.`, resp: 'Admin', prior: 'alto' });
        });
     }
  }

  const alertIcons = { 'ESTOQUE CRÍTICO': '🔴', 'ESTOQUE BAIXO': '🟡', 'TAREFA ATRASADA': '⏰', 'COMPRA PENDENTE': '🛒', 'NOVO USUÁRIO': '👤', 'DIÁRIA PENDENTE': '💸', 'EMPREITA PENDENTE': '🔨', 'PGTO FINANCEIRO': '📄' };
  const alertsGrid = document.getElementById('alerts-grid');
  if (alertsGrid) {
    alertsGrid.innerHTML = alerts.length
      ? alerts.map(a => `<div class="alert-card ${a.prior}" ${a.action ? `onclick="${a.action}" style="cursor:pointer"` : ''}>
          <div class="alert-icon">${alertIcons[a.tipo] || '⚠️'}</div>
          <div class="alert-body">
            <h4>${a.tipo}</h4>
            <p><b>${a.obra}</b> — ${a.desc}</p>
            <p style="margin-top:4px">Resp: ${a.resp}${a.action ? ' &nbsp;<span style="color:var(--accent);font-weight:600">→ Abrir e pagar</span>' : ''}</p>
          </div>
        </div>`).join('')
      : '<div style="color:var(--text3);font-size:13px;padding:8px">✅ Nenhum alerta no momento.</div>';
  }

  const tbody = document.getElementById('dash-obras-tbody');
  tbody.innerHTML = DB.obras.map(o => {
    const tarefas = DB.tarefas.filter(t => t.obra === o.cod);
    
    // Filtro Financeiro por Obra
    const tabObj = globalFinance.filter(f => f.obra === o.cod);
    const realizado = tabObj.reduce((a, f) => a + f.v, 0);
    const cSemanal = tabObj.filter(f => f.data >= strSemana && f.data <= today).reduce((a, f) => a + f.v, 0);
    const cMensal = tabObj.filter(f => f.data >= strMes && f.data <= today).reduce((a, f) => a + f.v, 0);
    
    // Diárias por Obra (específico)
    const dSemanal = DB.presenca
      .filter(p => p.obra === o.cod && p.data >= strSemana && p.data <= today)
      .reduce((a, p) => a + (parseFloat(p.total) || 0), 0);
    
    const pct = o.orc > 0 ? (realizado / o.orc * 100).toFixed(1) : 0;
    
    return `<tr>
      <td><span class="cod">${o.cod}</span> ${o.nome}</td>
      <td>${statusBadge(o.status)}</td>
      <td>${o.mestre}</td>
      <td>${fmt(o.orc)}</td>
      <td><b style="color:var(--blue)">${fmt(dSemanal)}</b></td>
      <td><b style="color:var(--accent)">${fmt(cSemanal)}</b></td>
      <td><b style="color:var(--orange)">${fmt(cMensal)}</b></td>
      <td>${fmt(realizado)}</td>
      <td>${pct}%</td>
      <td>${tarefas.filter(t => t.status === 'Concluída').length}/${tarefas.length} concluídas</td>
    </tr>`;

  }).join('');
  const updEl = document.getElementById('dash-updated');
  if (updEl) updEl.textContent = 'Atualizado: ' + new Date().toLocaleString('pt-BR');
}

// ==================== OBRAS ====================
function renderObras() {
  safeSetInner('obras-grid', DB.obras.map(o => {
    const realizado = DB.financeiro.filter(f => f.obra === o.cod).reduce((a, f) => a + (f.real || 0), 0);
    const pct = o.orc > 0 ? (realizado / o.orc * 100).toFixed(1) : 0;
    const tarefas = DB.tarefas.filter(t => t.obra === o.cod);
    return `<div class="obra-card" onclick="showPage('financeiro')">
      <h3>${o.nome}</h3>
      <div class="obra-meta">${o.end} · ${statusBadge(o.status)}</div>
      <div class="obra-stats">
        <div class="obra-stat"><div class="obra-stat-label">Orçamento</div><div class="obra-stat-val" style="font-size:13px">${fmt(o.orc)}</div></div>
        <div class="obra-stat"><div class="obra-stat-label">% Custo</div><div class="obra-stat-val">${pct}%</div></div>
        <div class="obra-stat"><div class="obra-stat-label">Mestre</div><div class="obra-stat-val" style="font-size:12px">${o.mestre}</div></div>
        <div class="obra-stat"><div class="obra-stat-label">Tarefas</div><div class="obra-stat-val" style="font-size:13px">${tarefas.filter(t => t.status === 'Concluída').length}/${tarefas.length}</div></div>
      </div>
    </div>`;
  }).join(''));

  safeSetInner('obras-tbody', DB.obras.map((o, i) => `<tr>
    <td><span class="cod">${o.cod}</span></td><td>${o.nome}</td><td>${o.tipo}</td>
    <td>${statusBadge(o.status)}</td><td>${fmtDate(o.inicio)}</td><td>${fmtDate(o.prazo)}</td>
    <td>${fmt(o.orc)}</td><td>${o.mestre}</td><td>${o.cliente}</td>
    <td>
      <button class="btn btn-secondary btn-sm" onclick="editObra(${i})" style="margin-right:8px">✏️</button>
      <button class="btn btn-danger btn-sm" onclick="deleteItem('obras',${i})">🗑</button>
    </td>
  </tr>`).join(''));
}

// ==================== TRABALHADORES ====================
function renderTrabalhadores() {
  safeSetInner('trab-tbody', DB.trabalhadores.length
    ? DB.trabalhadores.map((t, i) => `<tr>
        <td><span class="cod">${t.cod}</span></td><td>${t.nome}</td><td>${t.cpf}</td>
        <td>${t.funcao}</td><td>${statusBadge(t.vinculo)}</td><td>${t.obras}</td>
        <td>${fmt(t.diaria)}</td><td>${t.pgto}</td><td>${statusBadge(t.status)}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editTrabalhador(${i})" style="margin-right:8px">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem('trabalhadores',${i})">🗑</button>
        </td>
      </tr>`).join('')
    : '<tr class="empty-row"><td colspan="10">Nenhum trabalhador cadastrado</td></tr>');
}

// ==================== PRESENÇA ====================
function renderPresenca() {
  console.log('Iniciando renderPresenca...');
  const allPres = DB.presenca || [];
  const validPres = allPres.filter(p => p && p.data);
  
  // KPIs de Hoje
  const hoje = validPres.filter(p => p.data === today);
  const presentes = hoje.filter(p => p.presenca === 'Presente').length;
  const faltas = hoje.filter(p => p.presenca === 'Falta').length;
  const totalPagar = hoje.reduce((a, p) => a + (Number(p.total) || 0), 0);
  
  safeSetInner('pres-kpi', `
    <div class="kpi-card"><div class="kpi-label">Presentes Hoje</div><div class="kpi-val green">${presentes}</div></div>
    <div class="kpi-card"><div class="kpi-label">Faltas Hoje</div><div class="kpi-val ${faltas > 0 ? 'red' : 'green'}">${faltas}</div></div>
    <div class="kpi-card"><div class="kpi-label">Total a Pagar Hoje</div><div class="kpi-val yellow" style="font-size:20px">${fmt(totalPagar)}</div></div>
  `);

  // Ordenação e Tabela Principal
  const sortSelect = document.getElementById('pres-sort-select');
  const sortVal = sortSelect ? sortSelect.value : 'data_desc'; // O Padrão é data decrescente

  let listForTable = allPres.map((p, i) => (p ? { ...p, _idx: i } : null)).filter(p => p !== null);
  
  // Realiza o Sort Seguro
  listForTable.sort((a, b) => {
      if (sortVal === 'data_desc') return String(b.data || '').localeCompare(String(a.data || ''));
      if (sortVal === 'data_asc') return String(a.data || '').localeCompare(String(b.data || ''));
      if (sortVal === 'nome_asc') return String(a.nome || '').localeCompare(String(b.nome || ''));
      if (sortVal === 'nome_desc') return String(b.nome || '').localeCompare(String(a.nome || ''));
      return 0;
  });

  safeSetInner('pres-tbody', listForTable.length
    ? listForTable.map(p => `<tr>
        <td>${fmtDate(p.data)}</td><td><span class="cod">${p.obra}</span></td>
        <td>${p.nome}</td><td>${p.funcao}</td><td>${p.frente}</td>
        <td>${p.entrada || '—'}</td><td>${p.saida || '—'}</td>
        <td>${p.hnorm || 0}h</td><td>${p.hextra || 0}h</td>
        <td><span class="badge ${p.almoco === 'Sim' ? 'bg-success' : 'bg-secondary'}">${p.almoco || 'Não'}</span></td>
        <td>${statusBadge(p.presenca)}</td>
        <td>${fmt(p.diaria)}</td><td><b>${fmt(p.total)}</b></td>
        <td>${p.lancador || '—'}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editPresenca(${p._idx})" style="margin-right:8px">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem('presenca',${p._idx})">🗑</button>
        </td>
      </tr>`).join('')
    : '<tr class="empty-row"><td colspan="15">Nenhum registro de presença</td></tr>');

  // Consolidação de Almoços por Obra
  const almocosHtml = (DB.obras || []).map(o => {
    const hojeAlmoco = validPres.filter(p => p.obra === o.cod && p.data === today && p.almoco === 'Sim').length;
    
    // Almoços na semana atual
    const todayObj = new Date();
    const startOfWeek = new Date(todayObj);
    startOfWeek.setDate(todayObj.getDate() - todayObj.getDay());
    const strWeek = startOfWeek.toISOString().split('T')[0];
    
    const semanaAlmoco = validPres.filter(p => p.obra === o.cod && p.data >= strWeek && p.data <= today && p.almoco === 'Sim').length;
    
    if (hojeAlmoco === 0 && semanaAlmoco === 0) return '';
    
    return `<div class="kpi-card">
      <div class="kpi-label">${o.nome}</div>
      <div style="font-size:20px; font-weight:bold; color:var(--accent); margin: 8px 0;">${hojeAlmoco} <small style="font-size:12px; font-weight:normal; color:var(--text3)">almoços hoje</small></div>
      <div style="font-size:13px; color:var(--text2)">Total na semana: <b>${semanaAlmoco}</b></div>
    </div>`;
  }).join('');
  
  safeSetInner('pres-almocos', almocosHtml || '<p style="color:var(--text3); padding: 8px;">Nenhum almoço registrado hoje ou nesta semana.</p>');
  
  // Totalizadores por Data (Últimos 10 registros de datas distintas)
  try {
    const uniqueDates = [...new Set(validPres.map(p => p.data))].sort((a,b) => String(b).localeCompare(String(a))).slice(0, 10);
    console.log('Datas para totalizadores:', uniqueDates);

    const totalsHtml = uniqueDates.map(d => {
      const rows = validPres.filter(p => p.data === d);
      const dayTotal = rows.reduce((a, r) => a + (Number(r.total) || 0), 0);
      return `<div class="kpi-card">
        <div class="kpi-label">${fmtDate(d)}</div>
        <div style="font-size:13px;margin-top:4px">Presentes: <b style="color:var(--green)">${rows.filter(r => r.presenca === 'Presente').length}</b> · Faltas: <b style="color:var(--red)">${rows.filter(r => r.presenca === 'Falta').length}</b></div>
        <div style="font-size:13px;margin-top:4px">Total: <b style="color:var(--accent)">${fmt(dayTotal)}</b></div>
      </div>`;
    }).join('');
    
    safeSetInner('pres-totais', totalsHtml || '<p style="color:var(--text3); padding: 8px;">Nenhum dado para consolidar fechamento.</p>');
  } catch (err) {
    console.error('Erro ao renderizar totalizadores de presença:', err);
    safeSetInner('pres-totais', '<p style="color:var(--red); padding: 8px;">Falha ao processar os dados do fechamento. Erro relatado no console (F12).</p>');
  }
  
  // Pagamentos Pendentes da Semana (Por Obra)
  const pendentesHtml = (DB.obras || []).map(o => {
    const todayObj2 = new Date();
    const startOfWeek2 = new Date(todayObj2);
    startOfWeek2.setDate(todayObj2.getDate() - todayObj2.getDay());
    const strWeek2 = startOfWeek2.toISOString().split('T')[0];
    
    const pPendentes = validPres.filter(p => p.obra === o.cod && p.data >= strWeek2 && p.data <= today && p.pgtoStatus === 'Pendente' && Number(p.total) > 0);
    
    if (pPendentes.length === 0) return '';
    
    const somaPendente = pPendentes.reduce((a, r) => a + (Number(r.total) || 0), 0);
    
    return `<div class="kpi-card">
      <div class="kpi-label">${o.cod} — ${o.nome}</div>
      <div style="font-size:20px; font-weight:bold; color:var(--red); margin: 8px 0;">${fmt(somaPendente)}</div>
      <div style="font-size:13px; color:var(--text2)">${pPendentes.length} pendências salariais na semana</div>
    </div>`;
  }).join('');
  
  safeSetInner('pres-pgto-pendentes', pendentesHtml || '<p style="color:var(--green); padding: 8px; font-weight: 500;">✅ Nenhum pagamento pendente para esta semana.</p>');

  console.log('renderPresenca concluído.');
}

// ==================== TAREFAS ====================
function renderTarefas() {
  const total = DB.tarefas.length;
  const conc = DB.tarefas.filter(t => t.status === 'Concluída').length;
  const atra = DB.tarefas.filter(t => t.status === 'Atrasada').length;
  safeSetInner('tar-kpi', `
    <div class="kpi-card"><div class="kpi-label">Total Tarefas</div><div class="kpi-val">${total}</div></div>
    <div class="kpi-card"><div class="kpi-label">Concluídas</div><div class="kpi-val green">${conc}</div></div>
    <div class="kpi-card"><div class="kpi-label">Atrasadas</div><div class="kpi-val ${atra > 0 ? 'red' : 'green'}">${atra}</div></div>
    <div class="kpi-card"><div class="kpi-label">Em Andamento</div><div class="kpi-val blue">${DB.tarefas.filter(t => t.status === 'Em andamento').length}</div></div>
  `);
  safeSetInner('tar-tbody', DB.tarefas.length
    ? DB.tarefas.map((t, i) => `<tr>
        <td><span class="cod">${t.cod}</span></td><td>${t.obra}</td><td>${t.etapa}</td><td>${t.frente}</td>
        <td>${t.desc}</td><td>${t.resp}</td><td>${statusBadge(t.prior)}</td>
        <td>${statusBadge(t.status)}</td><td>${fmtDate(t.criacao)}</td><td>${fmtDate(t.prazo)}</td>
        <td><div style="display:flex;align-items:center;gap:6px">
          <div class="progress-bar"><div class="progress-fill" style="width:${t.perc || 0}%;background:${t.perc >= 100 ? 'var(--green)' : t.status === 'Atrasada' ? 'var(--red)' : 'var(--accent2)'}"></div></div>
          <span style="font-size:12px">${t.perc || 0}%</span>
        </div></td>
        <td>
           <div style="display:flex; gap:8px; align-items:center">
             ${t.photoUrl ? `<span style="cursor:pointer; font-size:18px" title="Ver Evidência" onclick="openLightbox('${t.photoUrl}')">📷</span>` : ''}
             <button class="btn btn-secondary btn-sm" onclick="editTarefa(${i})">✏️</button>
             <button class="btn btn-danger btn-sm" onclick="deleteItem('tarefas',${i})">🗑</button>
           </div>
        </td>
      </tr>`).join('')
    : '<tr class="empty-row"><td colspan="12">Nenhuma tarefa cadastrada</td></tr>');
}

// ==================== ESTOQUE ====================
function renderEstoque() {
  safeSetInner('est-tbody', DB.estoque.length
    ? DB.estoque.map((e, i) => {
      const saldo = calcSaldo(e);
      const s = estoqueStatus(e);
      return `<tr>
          <td><span class="cod">${e.cod}</span></td><td>${e.mat}</td><td>${e.unid}</td>
          <td>${e.obra}</td><td>${e.min}</td><td>${e.entrada}</td><td>${e.saida}</td>
          <td><b style="color:${saldo <= e.min ? 'var(--red)' : saldo <= e.min * 1.5 ? 'var(--orange)' : 'var(--green)'}">${saldo}</b></td>
          <td>${fmt(e.custo)}</td><td>${fmt(saldo * e.custo)}</td>
          <td>${statusBadge(s)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="editEstoque(${i})" style="margin-right:8px">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteItem('estoque',${i})">🗑</button>
          </td>
        </tr>`;
    }).join('')
    : '<tr class="empty-row"><td colspan="12">Nenhum item no estoque</td></tr>');
}

// ==================== MOV. ESTOQUE ====================
function renderMovEstoque() {
  safeSetInner('movest-tbody', DB.movEstoque.length
    ? DB.movEstoque.map((m, i) => `<tr>
        <td>${fmtDate(m.data)}</td><td><span class="cod">${m.codMat}</span></td><td>${m.mat}</td>
        <td>${m.obra}</td>
        <td><span class="badge ${m.tipo === 'Entrada' ? 'badge-green' : 'badge-orange'}">${m.tipo}</span></td>
        <td>${m.qtd}</td><td>${m.frente || '—'}</td><td>${m.retirado || '—'}</td>
        <td>${m.autor || '—'}</td><td>${m.nf || '—'}</td>
        <td>${fmt(m.vunit)}</td><td>${fmt(m.vtotal)}</td><td>${m.obs || '—'}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editMovEstoque(${i})" style="margin-right:8px">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem('movEstoque',${i})">🗑</button>
        </td>
      </tr>`).join('')
    : '<tr class="empty-row"><td colspan="14">Nenhuma movimentação registrada</td></tr>');
}

// ==================== COMPRAS ====================
function renderCompras() {
  safeSetInner('compras-tbody', DB.compras.length
    ? DB.compras.map((c, i) => `<tr>
        <td><span class="cod">${c.num}</span></td><td>${fmtDate(c.data)}</td><td>${c.obra}</td>
        <td>${c.mat}</td><td>${c.qtd}</td><td>${c.unid}</td>
        <td>${statusBadge(c.status)}</td><td>${c.forn || '—'}</td>
        <td>${fmt(c.vtotal)}</td><td>${fmtDate(c.prazo)}</td>
        <td>${c.conf || '—'}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editCompra(${i})" style="margin-right:8px">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem('compras',${i})">🗑</button>
        </td>
      </tr>`).join('')
    : '<tr class="empty-row"><td colspan="12">Nenhuma compra registrada</td></tr>');
}


// ==================== FINANCEIRO ====================
function renderFinanceiro() {
  let allFin = [];
  
  // 1. Lançamentos Manuais Core
  DB.financeiro.forEach((f, i) => {
    allFin.push({
      idx: i, source: 'fin', data: f.data,
      obra: f.obra, etapa: f.etapa, tipo: f.tipo, desc: f.desc,
      forn: f.forn || '—', prev: f.prev || 0, real: f.real || 0,
      pgto: f.pgto, status: f.status, nf: f.nf || '—'
    });
  });

  // 2. Mão de Obra - Folha de Ponto (Diárias)
  DB.presenca.forEach((p, i) => {
    if ((p.total || 0) > 0) {
      const tb = DB.trabalhadores.find(t => t.cod === p.trab);
      const funcName = tb ? tb.nome : p.trab;
      allFin.push({
        idx: i, source: 'pre', data: p.data,
        obra: p.obra, etapa: 'N/A', tipo: 'Mão de obra própria',
        desc: `[Diária] ${p.nome}`,
        forn: p.nome, prev: 0, real: parseFloat(p.total),
        pgto: 'N/A', status: p.pgtoStatus || 'Pendente', nf: '—'
      });
    }
  });

  // 3. Empreita - Medições Físicas
  DB.medicao.forEach((m, i) => {
    if ((m.vtotal || 0) > 0) {
      allFin.push({
        idx: i, source: 'med', data: m.semana,
        obra: m.obra, etapa: m.etapa, tipo: 'Empreiteiro',
        desc: `[Medição] ${m.servico}`,
        forn: m.equipe || 'Equipe Terceira', prev: 0, real: parseFloat(m.vtotal),
        pgto: 'N/A', status: m.pgtoStatus || 'Pendente', nf: '—'
      });
    }
  });

  // Sort: Mais recentes primeiro
  allFin.sort((a, b) => new Date(b.data) - new Date(a.data));

  // Summary by obra
  const obras = [...new Set(allFin.map(f => f.obra))];
  let sumHtml = '';
  let totalPrev = 0, totalReal = 0;
  obras.forEach(ob => {
    const rows = allFin.filter(f => f.obra === ob);
    const p = rows.reduce((a, r) => a + (r.prev || 0), 0);
    const r = rows.reduce((a, r) => a + (r.real || 0), 0);
    totalPrev += p; totalReal += r;
    sumHtml += `<div class="fin-card"><div class="fin-card-label">${ob} — Previsto</div><div class="fin-card-val">${fmt(p)}</div></div>
    <div class="fin-card"><div class="fin-card-label">${ob} — Realizado</div><div class="fin-card-val" style="color:${r > p ? 'var(--red)' : 'var(--green)'}">${fmt(r)}</div></div>
    <div class="fin-card"><div class="fin-card-label">${ob} — Diferença</div><div class="fin-card-val" style="color:${r - p > 0 ? 'var(--red)' : 'var(--green)'}">${fmt(r - p)}</div></div>`;
  });
  
  sumHtml += `<div class="fin-card"><div class="fin-card-label">Total Geral Previsto</div><div class="fin-card-val">${fmt(totalPrev)}</div></div>
  <div class="fin-card"><div class="fin-card-label">Total Geral Realizado</div><div class="fin-card-val">${fmt(totalReal)}</div></div>
  <div class="fin-card"><div class="fin-card-label">Diferença Total</div><div class="fin-card-val" style="color:${totalReal - totalPrev > 0 ? 'var(--red)' : 'var(--green)'}">${fmt(totalReal - totalPrev)}</div></div>`;
  
  safeSetInner('fin-summary', sumHtml);

  safeSetInner('fin-tbody', allFin.length
    ? allFin.map(f => {
      const diff = f.real - f.prev;
      
      let editBtn = '';
      if(f.source === 'fin') editBtn = `<button class="btn btn-secondary btn-sm" onclick="editFinanceiro(${f.idx})" style="margin-right:8px">✏️</button>`;
      else if(f.source === 'med') editBtn = `<button class="btn btn-secondary btn-sm" onclick="editMedicao(${f.idx})" style="margin-right:8px">✏️ Med.</button>`;
      else if(f.source === 'pre') editBtn = `<button class="btn btn-secondary btn-sm" onclick="editPresenca(${f.idx})" style="margin-right:8px">✏️ Dia.</button>`;
      
      let delBtn = '';
      if(f.source === 'fin') delBtn = `<button class="btn btn-danger btn-sm" onclick="deleteItem('financeiro',${f.idx})">🗑</button>`;
      
      return `<tr>
          <td>${fmtDate(f.data)}</td><td>${f.obra}</td><td>${f.etapa}</td><td>${f.tipo}</td>
          <td>${f.desc}</td><td>${f.forn}</td>
          <td>${fmt(f.prev)}</td><td>${fmt(f.real)}</td>
          <td style="color:${diff > 0 ? 'var(--red)' : diff < 0 ? 'var(--green)' : 'var(--text)'}">${fmt(diff)}</td>
          <td>${f.pgto}</td><td>${statusBadge(f.status)}</td><td>${f.nf}</td>
          <td>${editBtn}${delBtn}</td>
        </tr>`;
    }).join('')
    : '<tr class="empty-row"><td colspan="13">Nenhum lançamento financeiro ou Custo Mapeado</td></tr>');
}


// ==================== ORÇAMENTO ====================
function renderOrcamento() {
  safeSetInner('orc-tbody', DB.orcamento.length
    ? DB.orcamento.map((o, i) => {
      const diff = (o.vtotal || 0) - (o.vreal || 0);
      const pexec = o.vtotal > 0 ? ((o.vreal || 0) / o.vtotal * 100).toFixed(1) : 0;
      return `<tr>
          <td>${o.obra}</td><td>${o.etapa}</td><td>${o.tipo}</td><td>${o.desc}</td>
          <td>${o.qtd}</td><td>${o.unid}</td>
          <td>${fmt(o.vunit)}</td><td>${fmt(o.vtotal)}</td>
          <td>${fmt(o.vreal)}</td>
          <td style="color:${diff < 0 ? 'var(--red)' : 'var(--text)'}">${fmt(diff)}</td>
          <td>${pexec}%</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="editOrcamento(${i})" style="margin-right:8px">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteItem('orcamento',${i})">🗑</button>
          </td>
        </tr>`;
    }).join('')
    : '<tr class="empty-row"><td colspan="12">Nenhum item de orçamento</td></tr>');
}


// ==================== MEDIÇÃO ====================
function renderMedicao() {
  safeSetInner('med-tbody', DB.medicao.length
    ? DB.medicao.map((m, i) => {
      const av = m.qprev > 0 ? (m.qreal / m.qprev) : 0;
      return `<tr>
          <td>${fmtDate(m.semana)}</td><td>${m.obra}</td><td>${m.etapa}</td>
          <td>${m.frente}</td><td>${m.equipe}</td><td>${m.servico}</td>
          <td>${m.unid}</td><td>${m.qprev}</td><td>${m.qreal}</td>
          <td>${fmt(m.vtotal || 0)}</td>
          <td><div style="display:flex;align-items:center;gap:6px">
            <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(av * 100, 100)}%;background:${av >= 1 ? 'var(--green)' : av >= 0.7 ? 'var(--accent2)' : 'var(--orange)'}"></div></div>
            <span style="font-size:12px">${(av * 100).toFixed(1)}%</span>
          </div></td>
          <td>${statusBadge(m.retr === 'Sim' ? 'Alta' : 'Baixa').replace('Alta', 'Sim').replace('Baixa', 'Não')}</td>
          <td>${m.obs || '—'}</td>
          <td>
             <div style="display:flex; gap:8px; align-items:center">
               ${m.photoUrl ? `<span style="cursor:pointer; font-size:18px" title="Ver Evidência" onclick="openLightbox('${m.photoUrl}')">📷</span>` : ''}
               <button class="btn btn-secondary btn-sm" onclick="editMedicao(${i})">✏️</button>
               <button class="btn btn-danger btn-sm" onclick="deleteItem('medicao',${i})">🗑</button>
             </div>
          </td>
        </tr>`;
    }).join('')
    : '<tr class="empty-row"><td colspan="13">Nenhuma medição registrada</td></tr>');
}

// Helper functions for safe DOM manipulation
function safeSetValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function safeSetStyle(id, property, value) {
  const el = document.getElementById(id);
  if (el) el.style[property] = value;
}

// ==================== ADMINISTRAÇÃO ====================
function renderAdmin() {
  if (DB.config) {
    const cfg = DB.config;
    safeSetValue('cfg-empresa', cfg.nomeEmpresa || '');
    safeSetValue('cfg-cor-prim', cfg.corPrimaria || '#f59e0b');
    safeSetValue('cfg-cor-side', cfg.corSidebar || '#161b27');
    safeSetValue('cfg-cor-text', cfg.corMenu || '#94a3b8');
    safeSetValue('cfg-tema', cfg.tema || 'dark');
    safeSetValue('cfg-slug', cfg.slug || '');
    safeSetValue('cfg-logo-url', cfg.logoUrl || '');
    
    if (cfg.logoUrl) {
        safeSetStyle('cfg-logo-preview', 'display', 'block');
        const previewImg = document.querySelector('#cfg-logo-preview img');
        if (previewImg) previewImg.src = cfg.logoUrl;
    }
  }

  safeSetInner('usuarios-tbody', (DB.usuarios && DB.usuarios.length)
    ? DB.usuarios.map((u, i) => `<tr>
        <td><b>${u.email || u.username}</b></td><td>${u.name}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-red' : u.role === 'engenheiro' ? 'badge-blue' : u.role === 'pendente' ? 'badge-orange' : 'badge-green'}">${u.role.toUpperCase()}</span></td>
        <td>
           <button class="btn btn-secondary btn-sm" onclick="editUsuario(${i})" style="margin-right:8px">✏️</button>
           <button class="btn btn-danger btn-sm" onclick="deleteUsuario(${i})">🗑</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="4">Erro ao carregar usuários.</td></tr>');

  renderBilling();
}

// ==================== FOTOS (RELATÓRIO FOTOGRÁFICO) ====================
function renderFotos() {
  const obraFilter = document.getElementById('fotos-obra-filter');
  const selectedObra = obraFilter ? obraFilter.value : '';
  
  // Preenche o filter de obras se estiver vazio (apenas uma vez)
  if (obraFilter && obraFilter.options.length === 1) {
    DB.obras.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.cod;
      opt.textContent = `${o.cod} - ${o.nome}`;
      obraFilter.appendChild(opt);
    });
  }

  let allPhotos = [];
  
  // 1. Coleta das Tarefas
  DB.tarefas.forEach(t => {
    if (t.photoUrl) {
      allPhotos.push({
        url: t.photoUrl,
        obra: t.obra,
        origem: 'Tarefa',
        desc: t.desc,
        data: t.criacao || ''
      });
    }
  });

  // 2. Coleta das Medições
  DB.medicao.forEach(m => {
    if (m.photoUrl) {
      allPhotos.push({
        url: m.photoUrl,
        obra: m.obra,
        origem: 'Medição',
        desc: m.servico,
        data: m.semana || ''
      });
    }
  });

  // Filtragem e Ordenação
  if (selectedObra) {
    allPhotos = allPhotos.filter(p => p.obra === selectedObra);
  }
  allPhotos.sort((a, b) => new Date(b.data) - new Date(a.data));

  const grid = document.getElementById('fotos-grid');
  if (!grid) return;

  grid.innerHTML = allPhotos.length
    ? allPhotos.map(p => `
      <div class="photo-card" onclick="openLightbox('${p.url}')">
        <img src="${p.url}" class="photo-card-img" alt="${p.desc}">
        <div class="photo-card-info">
          <div class="photo-card-title">${p.desc}</div>
          <div class="photo-card-meta">
            <span>${p.obra} · ${p.origem}</span>
            <span>${fmtDate(p.data)}</span>
          </div>
        </div>
      </div>
    `).join('')
    : '<div style="color:var(--text3); padding: 40px; text-align: center; grid-column: 1/-1;">📸 Nenhuma foto encontrada para esta consulta.</div>';
}

// SaaS: Render Billing Info
function renderBilling() {
  if (DB.config) {
    const limitObras = DB.config.limiteObras || 2;
    const limitTrab = DB.config.limiteTrabalhadores || 10;
    const isPro = limitObras > 5; // Lógica simples de exemplo

    safeSetText('plan-name', isPro ? 'PLANO PRO ⭐' : 'PLANO INICIAL');
    safeSetText('limit-obras', limitObras === 99 ? 'Ilimitado' : limitObras);
    safeSetText('limit-trab', limitTrab === 99 ? 'Ilimitado' : limitTrab);
    
    const btnUpgrade = document.getElementById('btn-upgrade');
    if (btnUpgrade) {
      btnUpgrade.style.display = isPro ? 'none' : 'block';
    }
  }
}


async function startStripeCheckout() {
  const user = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
  if (!user.tenantId) return toast('Erro: Tenant não identificado.', 'error');

  toast('Iniciando Checkout Stripe...', 'success');
  
  // Aqui viria a lógica de criar a session no Firebase
  // para a extensão do Stripe capturar.
  // firebase.database().ref(`tenants/${user.tenantId}/checkout_sessions`).push({ ... });
  
  setTimeout(() => {
    alert('Nesta demonstração, imagine que você foi redirecionado para o Stripe.\n\nSimulando sucesso de pagamento...');
    // Simulando o que o Webhook do Stripe faria:
    DB.config.limiteObras = 99;
    DB.config.limiteTrabalhadores = 99;
    persistDB();
    renderAdmin();
  }, 2000);
}

// ==================== SUPER ADMIN (MASTER) ====================
async function renderSuperAdmin() {
  const tbody = document.getElementById('master-tenants-tbody');
  const totalTenantsEl = document.getElementById('master-total-tenants');
  const totalUsersEl = document.getElementById('master-total-users');

  try {
    // Busca todos os Tenants, Perfis e Convites Pendentes de uma vez (Visão Global)
    const [tenantsSnap, profilesSnap, invitesSnap] = await Promise.all([
      firebase.database().ref('tenants').once('value'),
      firebase.database().ref('profiles').once('value'),
      firebase.database().ref('invites').once('value')
    ]);

    const tenants = tenantsSnap.val() || {};
    const profiles = profilesSnap.val() || {};
    const invites = invitesSnap.val() || {};
    window.globalInvitesDataCache = invites;

    const tenantIds = Object.keys(tenants);
    const profileList = Object.values(profiles);

    if (totalTenantsEl) totalTenantsEl.textContent = tenantIds.length;
    if (totalUsersEl) totalUsersEl.textContent = profileList.length;

    tbody.innerHTML = tenantIds.map(tid => {
        const t = tenants[tid];
        const config = t.config || {};
        // Busca o admin principal no nó Profilies
        const adminProfile = profileList.find(p => p.tenantId === tid && p.role === 'admin');
        let displayEmail = adminProfile ? adminProfile.email : 'N/A';
        
        // Se o cliente ainda não se cadastrou (Perfil não existe), procura no nó Invites para exibir como "Pendente"
        const invitesData = window.globalInvitesDataCache || {}; // Necessita do fetch de convites acima
        if (!adminProfile) {
            const pendingKey = Object.keys(invitesData).find(k => invitesData[k].tenantId === tid && invitesData[k].role === 'admin');
            if (pendingKey) displayEmail = pendingKey.replace(/,/g, '.') + ' <span style="font-size:10px; color:var(--orange)">(Convite)</span>';
        }
        
        return `<tr>
            <td>
                <div style="font-weight:600">${config.nomeEmpresa || 'Sem Nome'}</div>
                <div style="font-size:10px; opacity:0.6">${tid}</div>
            </td>
            <td>${displayEmail}</td>
            <td>${config.limiteObras || 2}</td>
            <td>${config.limiteTrabalhadores || 10}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="openMasterTenantModal('${tid}', ${config.limiteObras || 2}, ${config.limiteTrabalhadores || 10})">⚙️ Ajustar</button>
                <button class="btn btn-danger btn-sm" onclick="deleteTenant('${tid}')" style="margin-left: 5px;">🗑</button>
            </td>
        </tr>`;
    }).join('');

  } catch (err) {
    console.error('Erro Super Admin:', err);
    tbody.innerHTML = '<tr><td colspan="5">Erro de permissão ou conexão.</td></tr>';
  }
}

// Assuming renderPage function exists elsewhere and needs this case added
// This block is inserted as per user instruction, assuming it belongs in a switch statement within renderPage
/*
async function renderPage(pageId) {
  const container = document.getElementById('main-content');
  switch (pageId) {
    // ... other cases ...
    case 'super_admin':
      const respSuper = await fetch('pages/super_admin.html');
      container.innerHTML = await respSuper.text();
      renderSuperAdmin();
      break;
    default:
      console.warn('Página não encontrada:', pageId);
  }
}
*/

function openMasterTenantModal(tid, lobras, ltrab) {
    document.getElementById('mt-tenant-id').value = tid;
    document.getElementById('mt-limite-obras').value = lobras;
    document.getElementById('mt-limite-trab').value = ltrab;
    
    // Mostra o modal de forma simples (injetando no container de modais)
    const content = document.getElementById('modal-master-tenant').innerHTML;
    const container = document.getElementById('modal-content');
    container.innerHTML = content;
    document.getElementById('modal-container').classList.add('open');
    
    // Repopula após injetar no DOM real do modal
    document.getElementById('mt-tenant-id').value = tid;
    document.getElementById('mt-limite-obras').value = lobras;
    document.getElementById('mt-limite-trab').value = ltrab;
}

async function saveMasterTenant() {
    const modal = document.getElementById('modal-content');
    const tid = modal.querySelector('#mt-tenant-id').value;
    const lobras = parseInt(modal.querySelector('#mt-limite-obras').value);
    const ltrab = parseInt(modal.querySelector('#mt-limite-trab').value);
    
    if (isNaN(lobras) || isNaN(ltrab)) return toast('Preencha os limites com números válidos.', 'error');
    
    try {
        await firebase.database().ref(`tenants/${tid}/config`).update({
            limiteObras: lobras,
            limiteTrabalhadores: ltrab
        });
        toast('Limites do cliente atualizados com sucesso!');
        closeModal();
        renderSuperAdmin();
    } catch (err) {
        toast('Erro ao atualizar limites.', 'error');
    }
}

async function deleteTenant(tid) {
  if (!confirm(`TEM CERTEZA? Isso deletará todos os dados da empresa ${tid}, PERFIS de usuários e CONVITES permanentemente!`)) return;
  
  toast('Limpando dados da empresa...', 'success');
  
  try {
      // 1. Buscar Perfis Vinculados
      const profilesSnap = await firebase.database().ref('profiles').orderByChild('tenantId').equalTo(tid).once('value');
      const profiles = profilesSnap.val() || {};
      
      // 2. Buscar Convites Vinculados
      const invitesSnap = await firebase.database().ref('invites').orderByChild('tenantId').equalTo(tid).once('value');
      const invites = invitesSnap.val() || {};

      // 3. Preparar Delecção em Massa (Multi-Path Update)
      const updates = {};
      updates[`tenants/${tid}`] = null;
      
      Object.keys(profiles).forEach(uid => {
          updates[`profiles/${uid}`] = null;
      });
      
      Object.keys(invites).forEach(emailKey => {
          updates[`invites/${emailKey}`] = null;
      });

      // 4. Executar Limpeza
      await firebase.database().ref().update(updates);
      
      toast('Empresa e acessos removidos com sucesso!');
      toast('Lembre-se: remova os e-mails da aba "Authentication" manualmente no Firebase.', 'orange');
      renderSuperAdmin();
  } catch (err) {
      console.error('Erro ao deletar tenant:', err);
      toast('Erro ao remover empresa e dependências.', 'error');
  }
}

function salvarConfiguracoes() {
  const emp = document.getElementById('cfg-empresa').value;
  const corPrim = document.getElementById('cfg-cor-prim').value;
  const corSide = document.getElementById('cfg-cor-side').value;
  const corText = document.getElementById('cfg-cor-text').value;
  const tema = document.getElementById('cfg-tema').value;
  const slug = document.getElementById('cfg-slug').value.trim().toLowerCase();
  const logoUrl = document.getElementById('cfg-logo-url').value;

  if (!DB.config) DB.config = {};
  
  DB.config.nomeEmpresa = emp;
  DB.config.corPrimaria = corPrim;
  DB.config.corSidebar = corSide;
  DB.config.corMenu = corText;
  DB.config.tema = tema;
  DB.config.slug = slug;
  DB.config.logoUrl = logoUrl;
  
  // Aplica visualmente em tempo real
  loadTheme();
  
  persistDB();
  toast('Identidade Visual salva e aplicada com sucesso!');
}

async function editUsuario(idx) {
  await openModal('modal-usuario');
  currentEditIdx = idx;
  const u = DB.usuarios[idx];
  document.getElementById('usr-edit-idx').value = idx;
  document.getElementById('usr-email').value = u.email || u.username || '';
  document.getElementById('usr-name').value = u.name;
  document.getElementById('usr-role').value = u.role || 'pendente';
  document.getElementById('usr-email').disabled = true; // Impede alteração do e-mail de acesso
}

function deleteUsuario(idx) {
  if (DB.usuarios[idx].role === 'admin' && DB.usuarios.filter(u => u.role === 'admin').length <= 1) {
    toast('Não é possível remover o único administrador restante!', 'error');
    return;
  }
  if (confirm('Remover usuário? Isso derrubará ele instantaneamente de qualquer tela.')) {
    DB.usuarios.splice(idx, 1);
    persistDB();
    renderAdmin();
    toast('Usuário removido!');
  }
}

// ==================== MODAL UTILS (DYNAMIC FETCH) ====================
// Super Admin: banner de seleção de empresa dentro do modal
async function injectSuperAdminTenantBanner(modalContent) {
  try {
    const tenantsSnap = await firebase.database().ref('tenants').once('value');
    const tenants = tenantsSnap.val() || {};
    const options = Object.entries(tenants)
      .map(([id, t]) => {
        const nome = (t.config && t.config.nomeEmpresa) || id;
        const selected = (superAdminActiveTenant && superAdminActiveTenant.id === id) ? 'selected' : '';
        return `<option value="${id}" ${selected}>${nome}</option>`;
      }).join('');

    const banner = document.createElement('div');
    banner.id = 'sa-tenant-banner';
    banner.style.cssText = 'background:var(--yellow,#f59e0b22);border:1px solid var(--yellow,#f59e0b);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px;font-size:13px;';
    banner.innerHTML = `
      <span style="font-weight:600;white-space:nowrap">🏢 Empresa:</span>
      <select id="sa-tenant-select" style="flex:1;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);font-size:13px;">
        <option value="">— Selecione uma empresa —</option>
        ${options}
      </select>
      <button onclick="applySuperAdminTenant()" style="padding:5px 12px;border-radius:6px;background:var(--accent,#f59e0b);color:#fff;border:none;cursor:pointer;font-weight:600;white-space:nowrap">Carregar</button>
    `;
    modalContent.insertBefore(banner, modalContent.firstChild);

    // Se já tem tenant ativo, carrega automaticamente sem precisar clicar
    if (superAdminActiveTenant) {
      const badge = document.createElement('div');
      badge.style.cssText = 'font-size:11px;color:var(--green,#22c55e);margin-top:4px;';
      badge.textContent = `✅ Operando em: ${superAdminActiveTenant.nome}`;
      banner.appendChild(badge);
    }
  } catch(e) {
    console.error('Erro ao carregar tenants para Super Admin:', e);
  }
}

async function applySuperAdminTenant() {
  const sel = document.getElementById('sa-tenant-select');
  if (!sel || !sel.value) { toast('Selecione uma empresa!', 'error'); return; }
  const nome = sel.options[sel.selectedIndex].text;
  toast('Carregando dados de ' + nome + '...');
  await loadTenantAsSuperAdmin(sel.value, nome);
  // Atualiza o badge no banner
  const banner = document.getElementById('sa-tenant-banner');
  if (banner) {
    let badge = banner.querySelector('.sa-badge');
    if (!badge) { badge = document.createElement('div'); badge.className = 'sa-badge'; badge.style.cssText = 'font-size:11px;color:var(--green,#22c55e);margin-top:4px;'; banner.appendChild(badge); }
    badge.textContent = '✅ Operando em: ' + nome;
  }
  toast('Empresa ' + nome + ' carregada! Agora você pode salvar.', 'success');
}

async function openModal(id) {
  currentEditIdx = -1; // Reset to "Create New" mode by default. Edit functions will override this after opening.
  
  const modalContainer = document.getElementById('modal-container');
  const modalContent = document.getElementById('modal-content');

  modalContent.innerHTML = '<div style="padding:20px;text-align:center">Carregando modal...</div>';
  modalContainer.classList.add('open');

  const html = await carregarHTML(`modals/${id}.html`);
  modalContent.innerHTML = html;

  // Super Admin: injeta banner de seleção de empresa no topo do modal
  const sessionUser = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
  if (sessionUser.role === 'super_admin') {
    await injectSuperAdminTenantBanner(modalContent);
  }

  // Populate selects
  const m = modalContent;
  const obraSelects = m.querySelectorAll('select[id$="-obra"], select[id^="pr-obra"], select[id^="fn-obra"], select[id^="cp-obra"], select[id^="md-obra"], select[id^="tf-obra"], select[id^="es-obra"], select[id^="mv-obra"], select[id^="oc-obra"]');
  obraSelects.forEach(sel => {
    sel.innerHTML = DB.obras.map(o => `<option value="${o.cod}">${o.cod} — ${o.nome}</option>`).join('');
  });
  if (id === 'modal-presenca') {
    const tsel = document.getElementById('pr-trab');
    if (tsel) {
      tsel.innerHTML = DB.trabalhadores.filter(t => t.status === 'Ativo').map(t => `<option value="${t.cod}">${t.nome}</option>`).join('');
      // Auto-preenche apenas ao criar novo (não ao editar)
      if (currentEditIdx === -1) {
        document.getElementById('pr-data').value = today;
        fillTrabInfo();
        calcPresenca();
      }
    }
  }
  if (id === 'modal-tarefa') {
    document.getElementById('tf-cod').value = nextCod(DB.tarefas, 'TF');
    document.getElementById('tf-criacao').value = today;
  }
  if (id === 'modal-compra') {
    document.getElementById('cp-num').value = nextCod(DB.compras, 'PC');
    document.getElementById('cp-data').value = today;
  }
  if (id === 'modal-financeiro' && currentEditIdx === -1) document.getElementById('fn-data').value = today;
  if (id === 'modal-presenca' && currentEditIdx === -1) calcPresenca();
  if (id === 'modal-obra' && currentEditIdx === -1) document.getElementById('ob-cod').value = nextCod(DB.obras, 'OB');
  if (id === 'modal-trabalhador' && currentEditIdx === -1) {
    document.getElementById('tr-cod').value = nextCod(DB.trabalhadores, 'TR');
    document.getElementById('tr-admissao').value = today;
  }
  if (id === 'modal-estoque' && currentEditIdx === -1) document.getElementById('es-cod').value = nextCod(DB.estoque, 'ES');
  if (id === 'modal-movest') {
    document.getElementById('mv-data').value = today;
    const msel = document.getElementById('mv-mat');
    if (msel) {
      msel.innerHTML = DB.estoque.map(e => `<option value="${e.cod}">${e.cod} — ${e.mat} (${e.obra})</option>`).join('');
      fillMatInfo();
    }
  }
  if (id === 'modal-medicao') document.getElementById('md-semana').value = today;
  if (id === 'modal-usuario') {
    if (document.getElementById('usr-edit-idx') && document.getElementById('usr-edit-idx').value === '-1') {
      document.getElementById('usr-email').value = '';
      document.getElementById('usr-email').disabled = false;
      document.getElementById('usr-name').value = '';
      document.getElementById('usr-role').value = 'engenheiro';
    }
  }
}

function closeModal(id) {
  document.getElementById('modal-container').classList.remove('open');
  const editIdx = document.getElementById('usr-edit-idx');
  if (id === 'modal-usuario' && editIdx) editIdx.value = '-1';
}

function fillTrabInfo() {
  const sel = document.getElementById('pr-trab').value;
  const t = DB.trabalhadores.find(x => x.cod === sel);
  if (t) {
    document.getElementById('pr-funcao').value = t.funcao;
    document.getElementById('pr-diaria').value = t.diaria;
    calcPresenca();
  }
}

function fillMatInfo() {
  const sel = document.getElementById('mv-mat').value;
  const e = DB.estoque.find(x => x.cod === sel);
  if (e) {
    document.getElementById('mv-matname').value = e.mat;
    document.getElementById('mv-vunit').value = e.custo;
    calcMovTotal();
  }
}

function calcPresenca() {
  const entrada = document.getElementById('pr-entrada')?.value || '07:00';
  const saida = document.getElementById('pr-saida')?.value || '17:00';
  const presenca = document.getElementById('pr-presenca')?.value;
  if (presenca === 'Falta') { document.getElementById('pr-total').value = 0; return; }
  const [eh, em] = entrada.split(':').map(Number);
  const [sh, sm] = saida.split(':').map(Number);
  const hTrabalhadas = Math.max(0, (sh * 60 + sm - eh * 60 - em) / 60);
  const hnorm = Math.min(hTrabalhadas, 8);
  const hextra = Math.max(0, hTrabalhadas - 8);
  document.getElementById('pr-hnorm').value = Math.min(hTrabalhadas, 8).toFixed(1);
  document.getElementById('pr-hextra').value = hextra.toFixed(1);
  const diaria = parseFloat(document.getElementById('pr-diaria').value) || 0;
  const valorHora = diaria / 8;
  const total = hTrabalhadas > 0 ? diaria + (hextra * valorHora * 1.5) : 0;
  document.getElementById('pr-total').value = total.toFixed(2);
}

function calcTotalManual() {
  const hnorm = parseFloat(document.getElementById('pr-hnorm').value) || 0;
  const hextra = parseFloat(document.getElementById('pr-hextra').value) || 0;
  const diaria = parseFloat(document.getElementById('pr-diaria').value) || 0;
  const valorHora = diaria / 8;
  const total = hnorm > 0 ? diaria + (hextra * valorHora * 1.5) : 0;
  document.getElementById('pr-total').value = total.toFixed(2);
}

function togglePresenca() {
  const v = document.getElementById('pr-presenca').value;
  const show = v !== 'Falta';
  document.getElementById('pr-entrada-grp').style.display = show ? '' : 'none';
  document.getElementById('pr-saida-grp').style.display = show ? '' : 'none';
  if (!show) document.getElementById('pr-total').value = 0;
}

function calcMovTotal() {
  const q = parseFloat(document.getElementById('mv-qtd').value) || 0;
  const v = parseFloat(document.getElementById('mv-vunit').value) || 0;
  document.getElementById('mv-vtotal').value = (q * v).toFixed(2);
}
function calcCompraTotal() {
  const q = parseFloat(document.getElementById('cp-qtd').value) || 0;
  const v = parseFloat(document.getElementById('cp-vunit').value) || 0;
  document.getElementById('cp-vtotal').value = (q * v).toFixed(2);
}
function calcFinDiff() {
  const p = parseFloat(document.getElementById('fn-prev').value) || 0;
  const r = parseFloat(document.getElementById('fn-real').value) || 0;
  document.getElementById('fn-diff').value = (r - p).toFixed(2);
}
function calcOrcTotal() {
  const q = parseFloat(document.getElementById('oc-qtd').value) || 0;
  const v = parseFloat(document.getElementById('oc-vunit').value) || 0;
  document.getElementById('oc-vtotal').value = (q * v).toFixed(2);
}
function calcAvanco() {
  const p = parseFloat(document.getElementById('md-qprev').value) || 0;
  const r = parseFloat(document.getElementById('md-qreal').value) || 0;
  const v = parseFloat(document.getElementById('md-vunit').value) || 0;
  document.getElementById('md-avanco').value = p > 0 ? (r / p * 100).toFixed(1) : 0;
  document.getElementById('md-vtotal').value = (r * v).toFixed(2);
}

// ==================== SAVE FUNCTIONS ====================
async function saveObra() {

  const cod = document.getElementById('ob-cod').value.trim();
  if (!cod) { toast('Informe o código da obra', 'error'); return; }
  // Verifica unicidade do código (exceto ao editar o próprio registro)
  const duplicado = DB.obras.some((o, i) => o.cod === cod && i !== currentEditIdx);
  if (duplicado) { toast(`Código "${cod}" já existe! Use outro.`, 'error'); return; }
  const data = {
    cod, nome: document.getElementById('ob-nome').value,
    end: document.getElementById('ob-end').value,
    tipo: document.getElementById('ob-tipo').value,
    status: document.getElementById('ob-status').value,
    inicio: document.getElementById('ob-inicio').value,
    prazo: document.getElementById('ob-prazo').value,
    orc: parseFloat(document.getElementById('ob-orc').value) || 0,
    mestre: document.getElementById('ob-mestre').value,
    eng: document.getElementById('ob-eng').value,
    cliente: document.getElementById('ob-cliente').value,
    obs: document.getElementById('ob-obs').value
  };
  if (currentEditIdx >= 0) {
    DB.obras[currentEditIdx] = data;
    toast('Obra atualizada!');
  } else {
    // Validação SaaS: Limite de Obras
    const limite = DB.config.limiteObras || 2;
    if (DB.obras.length >= limite) {
      toast(`Seu plano atingiu o limite de ${limite} obras. Faça upgrade para cadastrar mais!`, 'error');
      return;
    }
    DB.obras.push(data);
    toast('Obra cadastrada!');
  }
  closeModal('modal-obra'); await persistDB(); renderObras(); renderDashboard(); 
}

async function editObra(idx) {
  await openModal('modal-obra');
  currentEditIdx = idx;
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
  document.getElementById('ob-obs').value = o.obs;
}

async function saveTrabalhador() {

  const cod = document.getElementById('tr-cod').value.trim();
  if (!cod) { toast('Informe o código', 'error'); return; }
  // Verifica unicidade do código
  const duplicado = DB.trabalhadores.some((t, i) => t.cod === cod && i !== currentEditIdx);
  if (duplicado) { toast(`Código "${cod}" já existe! Use outro.`, 'error'); return; }
  const data = {
    cod, nome: document.getElementById('tr-nome').value,
    cpf: document.getElementById('tr-cpf').value,
    funcao: document.getElementById('tr-funcao').value,
    vinculo: document.getElementById('tr-vinculo').value,
    equipe: document.getElementById('tr-equipe').value,
    obras: document.getElementById('tr-obras').value,
    diaria: parseFloat(document.getElementById('tr-diaria').value) || 0,
    pgto: document.getElementById('tr-pgto').value,
    contato: document.getElementById('tr-contato').value,
    status: document.getElementById('tr-status').value,
    admissao: document.getElementById('tr-admissao').value
  };
  if (currentEditIdx >= 0) {
    DB.trabalhadores[currentEditIdx] = data;
    toast('Trabalhador atualizado!');
  } else {
    // Validação SaaS: Limite de Trabalhadores
    const limite = DB.config.limiteTrabalhadores || 10;
    if (DB.trabalhadores.length >= limite) {
      toast(`Seu plano atingiu o limite de ${limite} trabalhadores. Faça upgrade!`, 'error');
      return;
    }
    DB.trabalhadores.push(data);
    toast('Trabalhador cadastrado!');
  }
  closeModal('modal-trabalhador'); await persistDB(); renderTrabalhadores(); 
}

async function editTrabalhador(idx) {
  await openModal('modal-trabalhador');
  currentEditIdx = idx;
  const t = DB.trabalhadores[idx];
  document.getElementById('tr-cod').value = t.cod;
  document.getElementById('tr-nome').value = t.nome;
  document.getElementById('tr-cpf').value = t.cpf;
  document.getElementById('tr-funcao').value = t.funcao;
  document.getElementById('tr-vinculo').value = t.vinculo;
  document.getElementById('tr-equipe').value = t.equipe;
  document.getElementById('tr-obras').value = t.obras;
  document.getElementById('tr-diaria').value = t.diaria;
  document.getElementById('tr-pgto').value = t.pgto;
  document.getElementById('tr-contato').value = t.contato;
  document.getElementById('tr-status').value = t.status;
  document.getElementById('tr-admissao').value = t.admissao;
}

async function savePresenca() {
  // Validação dos campos obrigatórios
  const dataVal = document.getElementById('pr-data').value;
  const obraVal = document.getElementById('pr-obra').value;
  const trabVal = document.getElementById('pr-trab').value;

  if (!dataVal) { toast('Informe a data!', 'error'); return; }
  if (!obraVal) { toast('Selecione a obra!', 'error'); return; }
  if (!trabVal) { toast('Selecione o trabalhador!', 'error'); return; }

  const tsel = trabVal;
  const t = DB.trabalhadores.find(x => x.cod === tsel);
  const data = {
    data: dataVal,
    obra: obraVal,
    trab: tsel,
    nome: t ? t.nome : tsel,
    funcao: document.getElementById('pr-funcao').value,
    vinculo: t ? t.vinculo : '',
    equipe: t ? t.equipe : '',
    frente: document.getElementById('pr-frente').value,
    entrada: document.getElementById('pr-entrada').value,
    saida: document.getElementById('pr-saida').value,
    hnorm: parseFloat(document.getElementById('pr-hnorm').value) || 0,
    hextra: parseFloat(document.getElementById('pr-hextra').value) || 0,
    presenca: document.getElementById('pr-presenca').value,
    justif: document.getElementById('pr-obs').value,
    diaria: parseFloat(document.getElementById('pr-diaria').value) || 0,
    total: parseFloat(document.getElementById('pr-total').value) || 0,
    pgtoStatus: document.getElementById('pr-pgto-status').value,
    almoco: document.getElementById('pr-almoco').value,
    lancador: document.getElementById('pr-lancador').value,
    hrLanc: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    obs: document.getElementById('pr-obs').value
  };

  if (currentEditIdx >= 0) {
    DB.presenca[currentEditIdx] = data;
  } else {
    DB.presenca.push(data);
  }

  closeModal('modal-presenca');

  try {
    await persistDB();
    toast(currentEditIdx >= 0 ? 'Presença atualizada!' : 'Presença registrada!');
  } catch (err) {
    // Mesmo que a nuvem falhe, os dados já estão no DB local em memória
    console.error('Erro ao persistir presença:', err);
    toast('Presença salva localmente, mas falhou na nuvem. Tente sincronizar.', 'error');
  }

  renderPresenca();
  renderFinanceiro();
  renderDashboard();
}

async function editPresenca(idx) {
  await openModal('modal-presenca');
  currentEditIdx = idx;
  const p = DB.presenca[idx];
  document.getElementById('pr-data').value = p.data;
  document.getElementById('pr-obra').value = p.obra;
  
  // Seleciona trabalhador pelo COD salvo
  const trSelect = document.getElementById('pr-trab');
  if (p.trab) {
    trSelect.value = p.trab;
  } else {
    // fallback para dados antigos sem o campo trab
    const found = Array.from(trSelect.options).find(o => o.text === p.nome);
    if (found) trSelect.value = found.value;
  }
  // Preenche funcao e diária do trabalhador selecionado
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
  document.getElementById('pr-almoco').value = p.almoco || 'Não';
  document.getElementById('pr-obs').value = p.justif || p.obs || '';
  document.getElementById('pr-diaria').value = p.diaria;
  document.getElementById('pr-total').value = p.total;
  document.getElementById('pr-pgto-status').value = p.pgtoStatus || 'Pendente';
  document.getElementById('pr-lancador').value = p.lancador;
  togglePresenca();
}

function togglePresenca() {
  const v = document.getElementById('pr-presenca').value;
  const show = v !== 'Falta';
  safeSetDisplay('pr-entrada-grp', show ? '' : 'none');
  safeSetDisplay('pr-saida-grp', show ? '' : 'none');
  safeSetDisplay('pr-almoco-grp', show ? '' : 'none');
  if (!show) {
      document.getElementById('pr-total').value = 0;
      document.getElementById('pr-almoco').value = 'Não';
  }
}



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
  if (currentEditIdx >= 0) {
    DB.tarefas[currentEditIdx] = data;
    toast('Tarefa atualizada!');
  } else {
    DB.tarefas.push(data);
    toast('Tarefa criada!');
  }
  closeModal('modal-tarefa'); await persistDB(); renderTarefas(); 
}

async function editTarefa(idx) {
  await openModal('modal-tarefa');
  currentEditIdx = idx;
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
  document.getElementById('tf-conclusao').value = t.conclusao;
  document.getElementById('tf-perc').value = t.perc;
  document.getElementById('tf-photo-url').value = t.photoUrl || '';
  const preview = document.getElementById('tf-photo-preview');
  if (t.photoUrl) {
      preview.style.display = 'block';
      preview.querySelector('img').src = t.photoUrl;
  } else {
      preview.style.display = 'none';
  }
  document.getElementById('tf-obs').value = t.obs || '';
}

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
  if (currentEditIdx >= 0) {
    if(DB.estoque[currentEditIdx].saida !== undefined) {
       data.saida = DB.estoque[currentEditIdx].saida; // preserve existing usage counter
    }
    DB.estoque[currentEditIdx] = data;
    toast('Item de estoque atualizado!');
  } else {
    DB.estoque.push(data);
    toast('Item de estoque cadastrado!');
  }
  closeModal('modal-estoque'); await persistDB(); renderEstoque(); 
}

async function editEstoque(idx) {
  await openModal('modal-estoque');
  currentEditIdx = idx;
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
  const e = DB.estoque.find(x => x.cod === codMat);
  const tipo = document.getElementById('mv-tipo').value;
  const qtd = parseFloat(document.getElementById('mv-qtd').value) || 0;
  if (e) {
    if (tipo === 'Entrada') e.entrada += qtd;
    else { if (qtd > calcSaldo(e)) { toast('Qtd. maior que saldo!', 'error'); return; } e.saida += qtd; }
  }
  const data = {
    data: document.getElementById('mv-data').value,
    codMat, mat: document.getElementById('mv-matname').value,
    obra: document.getElementById('mv-obra').value,
    tipo, qtd,
    frente: document.getElementById('mv-frente').value,
    retirado: document.getElementById('mv-retirado').value,
    autor: document.getElementById('mv-autor').value,
    nf: document.getElementById('mv-nf').value,
    vunit: parseFloat(document.getElementById('mv-vunit').value) || 0,
    vtotal: parseFloat(document.getElementById('mv-vtotal').value) || 0,
    obs: document.getElementById('mv-obs').value
  };
  if (currentEditIdx >= 0) {
    DB.movEstoque[currentEditIdx] = data;
    toast('Movimentação atualizada!');
  } else {
    DB.movEstoque.push(data);
    toast('Movimentação registrada!');
  }
  closeModal('modal-movest'); await persistDB(); renderMovEstoque(); 
}

async function editMovEstoque(idx) {
  await openModal('modal-movest');
  currentEditIdx = idx;
  const m = DB.movEstoque[idx];
  document.getElementById('mv-data').value = m.data;
  document.getElementById('mv-mat').value = m.codMat;
  document.getElementById('mv-matname').value = m.mat;
  document.getElementById('mv-obra').value = m.obra;
  document.getElementById('mv-tipo').value = m.tipo;
  document.getElementById('mv-qtd').value = m.qtd;
  document.getElementById('mv-frente').value = m.frente;
  document.getElementById('mv-retirado').value = m.retirado;
  document.getElementById('mv-autor').value = m.autor;
  document.getElementById('mv-nf').value = m.nf;
  document.getElementById('mv-vunit').value = m.vunit;
  document.getElementById('mv-vtotal').value = m.vtotal;
  document.getElementById('mv-obs').value = m.obs || '';
}

async function saveCompra() {

  const data = {
    num: document.getElementById('cp-num').value,
    data: document.getElementById('cp-data').value,
    obra: document.getElementById('cp-obra').value,
    mat: document.getElementById('cp-mat').value,
    qtd: parseFloat(document.getElementById('cp-qtd').value) || 0,
    unid: document.getElementById('cp-unid').value,
    status: document.getElementById('cp-status').value,
    forn: document.getElementById('cp-forn').value,
    vunit: parseFloat(document.getElementById('cp-vunit').value) || 0,
    vtotal: parseFloat(document.getElementById('cp-vtotal').value) || 0,
    vorc: parseFloat(document.getElementById('cp-vorc').value) || 0,
    prazo: document.getElementById('cp-prazo').value,
    receb: document.getElementById('cp-receb').value,
    conf: document.getElementById('cp-conf').value,
    obs: document.getElementById('cp-obs').value
  };
  if (currentEditIdx >= 0) {
    DB.compras[currentEditIdx] = data;
    toast('Compra atualizada!');
  } else {
    DB.compras.push(data);
    toast('Compra registrada!');
  }
  closeModal('modal-compra'); await persistDB(); renderCompras(); 
}

async function editCompra(idx) {
  await openModal('modal-compra');
  currentEditIdx = idx;
  const c = DB.compras[idx];
  document.getElementById('cp-num').value = c.num;
  document.getElementById('cp-data').value = c.data;
  document.getElementById('cp-obra').value = c.obra;
  document.getElementById('cp-mat').value = c.mat;
  document.getElementById('cp-qtd').value = c.qtd;
  document.getElementById('cp-unid').value = c.unid;
  document.getElementById('cp-status').value = c.status;
  document.getElementById('cp-forn').value = c.forn;
  document.getElementById('cp-vunit').value = c.vunit;
  document.getElementById('cp-vtotal').value = c.vtotal;
  document.getElementById('cp-vorc').value = c.vorc;
  document.getElementById('cp-prazo').value = c.prazo;
  document.getElementById('cp-receb').value = c.receb;
  document.getElementById('cp-conf').value = c.conf;
  document.getElementById('cp-obs').value = c.obs || '';
}

async function saveFinanceiro() {

  const prev = parseFloat(document.getElementById('fn-prev').value) || 0;
  const real = parseFloat(document.getElementById('fn-real').value) || 0;
  const data = {
    data: document.getElementById('fn-data').value,
    obra: document.getElementById('fn-obra').value,
    etapa: document.getElementById('fn-etapa').value,
    tipo: document.getElementById('fn-tipo').value,
    desc: document.getElementById('fn-desc').value,
    forn: document.getElementById('fn-forn').value,
    prev, real,
    pgto: document.getElementById('fn-pgto').value,
    status: document.getElementById('fn-status').value,
    nf: document.getElementById('fn-nf').value,
    obs: document.getElementById('fn-obs').value
  };
  if (currentEditIdx >= 0) {
    DB.financeiro[currentEditIdx] = data;
    toast('Lançamento financeiro atualizado!');
  } else {
    DB.financeiro.push(data);
    toast('Lançamento financeiro salvo!');
  }
  closeModal('modal-financeiro'); await persistDB(); renderFinanceiro(); renderDashboard(); 
}

async function editFinanceiro(idx) {
  await openModal('modal-financeiro');
  currentEditIdx = idx;
  const f = DB.financeiro[idx];
  document.getElementById('fn-data').value = f.data;
  document.getElementById('fn-obra').value = f.obra;
  document.getElementById('fn-etapa').value = f.etapa;
  document.getElementById('fn-tipo').value = f.tipo;
  document.getElementById('fn-desc').value = f.desc;
  document.getElementById('fn-forn').value = f.forn;
  document.getElementById('fn-prev').value = f.prev;
  document.getElementById('fn-real').value = f.real;
  document.getElementById('fn-pgto').value = f.pgto;
  document.getElementById('fn-status').value = f.status;
  document.getElementById('fn-nf').value = f.nf;
  document.getElementById('fn-obs').value = f.obs || '';
}

async function saveOrcamento() {

  const qtd = parseFloat(document.getElementById('oc-qtd').value) || 0;
  const vunit = parseFloat(document.getElementById('oc-vunit').value) || 0;
  const data = {
    obra: document.getElementById('oc-obra').value,
    etapa: document.getElementById('oc-etapa').value,
    tipo: document.getElementById('oc-tipo').value,
    desc: document.getElementById('oc-desc').value,
    qtd, unid: document.getElementById('oc-unid').value,
    vunit, vtotal: qtd * vunit, vreal: 0,
    obs: document.getElementById('oc-obs').value
  };
  if (currentEditIdx >= 0) {
    if(DB.orcamento[currentEditIdx].vreal !== undefined) {
      data.vreal = DB.orcamento[currentEditIdx].vreal; // preserve the current progress amount
    }
    DB.orcamento[currentEditIdx] = data;
    toast('Item de orçamento atualizado!');
  } else {
    DB.orcamento.push(data);
    toast('Item de orçamento salvo!');
  }
  closeModal('modal-orcamento'); await persistDB(); renderOrcamento(); 
}

async function editOrcamento(idx) {
  await openModal('modal-orcamento');
  currentEditIdx = idx;
  const o = DB.orcamento[idx];
  document.getElementById('oc-obra').value = o.obra;
  document.getElementById('oc-etapa').value = o.etapa;
  document.getElementById('oc-tipo').value = o.tipo;
  document.getElementById('oc-desc').value = o.desc;
  document.getElementById('oc-qtd').value = o.qtd;
  document.getElementById('oc-unid').value = o.unid;
  document.getElementById('oc-vunit').value = o.vunit;
  document.getElementById('oc-obs').value = o.obs || '';
}

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
    photoUrl: document.getElementById('md-photo-url').value || '',
    obs: document.getElementById('md-obs').value
  };
  if (currentEditIdx >= 0) {
    DB.medicao[currentEditIdx] = data;
    toast('Medição atualizada!');
  } else {
    DB.medicao.push(data);
    toast('Medição salva!');
  }
  closeModal('modal-medicao'); await persistDB(); renderMedicao && renderMedicao(); renderFinanceiro && renderFinanceiro(); renderDashboard && renderDashboard();
}

async function editMedicao(idx) {
  await openModal('modal-medicao');
  currentEditIdx = idx;
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
  document.getElementById('md-photo-url').value = m.photoUrl || '';
  const preview = document.getElementById('md-photo-preview');
  if (m.photoUrl) {
      preview.style.display = 'block';
      preview.querySelector('img').src = m.photoUrl;
  } else {
      preview.style.display = 'none';
  }
  document.getElementById('md-obs').value = m.obs || '';
}

async function saveUsuario() {
  const email = document.getElementById('usr-email').value.trim().toLowerCase();
  const name = document.getElementById('usr-name').value.trim();
  const role = document.getElementById('usr-role').value;
  const editIdx = parseInt(document.getElementById('usr-edit-idx').value);

  if (!email || !name) {
    toast('Preencha os campos obrigatórios (E-mail e Nome).', 'error');
    return;
  }

  const userSession = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
  const tenantId = userSession.tenantId;

  if (!tenantId) {
    toast('Erro: Sessão sem Identificador de Empresa (Tenant).', 'error');
    return;
  }

  const userData = { email, name, role, tenantId };

  if (editIdx >= 0) {
    DB.usuarios[editIdx] = { email, name, role };
    toast('Permissões de Usuário atualizadas!');
  } else {
    // New
    if (DB.usuarios.find(u => u.email === email)) {
      toast('Este e-mail já está cadastrado nesta empresa.', 'error');
      return;
    }
    DB.usuarios.push({ email, name, role });
    toast('Novo funcionário autorizado!');
  }

  // REGISTRO GLOBAL DE CONVITE (SaaS)
  // Substitui pontos por vírgulas para chaves compatíveis com Firebase
  const sanitizedEmail = email.replace(/\./g, ',');
  try {
    await firebase.database().ref(`invites/${sanitizedEmail}`).set(userData);
    
    closeModal('modal-usuario');
    renderAdmin();
    persistDB();
  } catch (err) {
    console.error('Erro ao gerar convite global:', err);
    toast('Erro ao sincronizar convite global.', 'error');
  }
}

// ==================== DELETE ====================
function deleteItem(table, idx) {
  if (!confirm('Remover este registro?')) return;
  DB[table].splice(idx, 1);
  const activePageEl = document.querySelector('.page.active');
  if (activePageEl) {
    renderPage(activePageEl.id.replace('page-', ''));
  }
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
function toast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${type === 'success' ? '✅' : '❌'} ${msg}`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ==================== INIT ====================
window.onclick = function (e) {
  const container = document.getElementById('modal-container');
  if (e.target === container) closeModal(); // Fecha qualquer modal que estiver aberto se clicar fora
};

document.getElementById('header-date').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

// renderDashboard(); // SaaS: Removido disparo automático. Será chamado em auth.js após controle de acesso.

// SaaS: Dispara verificação de autenticação e carregamento inicial
if (typeof checkAuth === 'function') checkAuth();

// ==================== MASTER SYSTEM LOGIC ====================
function openNewTenantModal() {
    const content = document.getElementById('modal-create-tenant').innerHTML;
    const container = document.getElementById('modal-content');
    container.innerHTML = content;
    document.getElementById('modal-container').classList.add('open');
}

async function saveNewTenant() {
    // Busca dentro do container do modal para evitar pegar o template duplicado
    const modal = document.getElementById('modal-content');
    const nome = modal.querySelector('#ct-nome').value.trim();
    let slugVal = modal.querySelector('#ct-slug').value.trim().toLowerCase();
    const emailOwner = modal.querySelector('#ct-email').value.trim().toLowerCase();
    const lobras = parseInt(modal.querySelector('#ct-limite-obras').value) || 0;
    const ltrab = parseInt(modal.querySelector('#ct-limite-trab').value) || 0;

    if (!nome) return toast('Preencha o nome da empresa.', 'error');
    if (!slugVal) return toast('Preencha o subdomínio.', 'error');
    if (!emailOwner) return toast('Preencha o e-mail do administrador.', 'error');
    
    slugVal = slugVal.replace(/[^a-z0-9]/g, '');
    if (!slugVal) return toast('O subdomínio deve conter letras e números.', 'error');

    // Validação básica de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailOwner)) return toast('Digite um e-mail válido.', 'error');

    try {
        // Verificar se subdomínio já existe
        const existingSlug = await firebase.database().ref('tenants_public').orderByChild('slug').equalTo(slugVal).once('value');
        if (existingSlug.exists()) {
            return toast(`O subdomínio "${slugVal}" já está sendo usado por outra empresa!`, 'error');
        }

        // Gerar um ID único para a nova empresa
        const res = await firebase.database().ref('tenants').push();
        const tenantId = res.key;

        // 1. Criar Configuração Inicial do Tenant
        await firebase.database().ref(`tenants/${tenantId}/config`).set({
            nomeEmpresa: nome,
            slug: slugVal,
            corPrimaria: '#f59e0b',
            limiteObras: lobras,
            limiteTrabalhadores: ltrab
        });

        // 2. Criar Convite para que o dono ao logar caia nesta empresa
        const sanitizedEmail = emailOwner.replace(/\./g, ',');
        await firebase.database().ref(`invites/${sanitizedEmail}`).set({
            tenantId: tenantId,
            role: 'admin',
            nomeEmpresa: nome
        });

        // 3. Espelhar slug no nó público (para leitura antes do login)
        await firebase.database().ref(`tenants_public/${tenantId}`).set({
            slug: slugVal,
            nomeEmpresa: nome,
            corPrimaria: '#f59e0b'
        });

        toast('Empresa criada! O dono já pode logar com seu e-mail.');
        closeModal();
        renderSuperAdmin();
    } catch (err) {
        console.error(err);
        toast('Erro ao criar empresa.', 'error');
    }
}

function changeMasterPassword() {
    const newVal = document.getElementById('master-new-password')?.value;
    if (!newVal || newVal.length < 6) {
        return toast('A nova senha deve ter no mínimo 6 caracteres.', 'error');
    }
    const user = firebase.auth().currentUser;
    if (!user) return toast('Você precisa estar logado para alterar a senha.', 'error');
    
    user.updatePassword(newVal)
        .then(() => {
            toast('Senha do Mestre alterada com sucesso! Use no próximo login.');
            document.getElementById('master-new-password').value = '';
        })
        .catch(err => {
            console.error('Erro na senha:', err);
            if (err.code === 'auth/requires-recent-login') {
                toast('Sua sessão expirou. Deslogue e logue novamente para redefinir.', 'error');
            } else {
                toast('Falha ao alterar senha. ' + err.message, 'error');
            }
        });
}

// ==================== PHOTO MANAGEMENT & LIGHTBOX ====================
async function handleFileUpload(input, previewId, urlInputId) {
    const file = input.files[0];
    if (!file) return;

    // Log para depuração inicial
    console.log('Iniciando Upload:', { name: file.name, size: file.size, type: file.type });

    if (typeof firebase.storage !== 'function') {
        console.error('Firebase Storage SDK not loaded!');
        toast('Erro: SDK de Storage não carregado.', 'error');
        return;
    }

    // Verifica se o bucket está configurado
    const bucket = firebase.app().options.storageBucket;
    if (!bucket) {
        console.error('Storage Bucket não configurado no firebaseConfig!');
        toast('Erro: Bucket de Storage não configurado.', 'error');
        return;
    }
    console.log('Usando Bucket:', bucket);

    const user = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
    const tid = user.tenantId || 'global';
    
    toast('Enviando foto...', 'success');
    
    try {
        const storage = firebase.storage();
        const storageRef = storage.ref();
        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const filePath = `tenants/${tid}/evidencias/${fileName}`;
        const fileRef = storageRef.child(filePath);
        
        console.log('Caminho do Arquivo:', filePath);

        const metadata = { contentType: file.type };
        const uploadTask = fileRef.put(file, metadata);

        // Acompanhamento de progresso opcional (para debug futuro)
        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload is ' + progress + '% done');
            }, 
            (error) => { throw error; }
        );

        await uploadTask;
        const url = await fileRef.getDownloadURL();
        console.log('Upload concluído! URL:', url);
        
        safeSetValue(urlInputId, url);
        const preview = document.getElementById(previewId);
        if (preview) {
            preview.style.display = 'block';
            const img = preview.querySelector('img');
            if (img) img.src = url;
        }
        
        toast('Foto enviada com sucesso!');
    } catch (err) {
        console.error('Upload Error Completo:', err);
        let errorMsg = 'Erro ao enviar foto.';
        
        if (err.code === 'storage/unauthorized') {
            errorMsg = 'Erro de Permissão (Confirme as Regras do Storage).';
        } else if (err.code === 'storage/quota-exceeded') {
            errorMsg = 'Limite de armazenamento atingido.';
        } else if (err.code === 'storage/retry-limit-exceeded') {
            errorMsg = 'Tempo limite excedido. Verifique sua conexão ou se o Storage está ativo.';
        } else if (err.code === 'storage/unknown') {
            errorMsg = 'Erro desconhecido no Firebase Storage.';
        }
        
        toast(`${errorMsg} (${err.code || 'Ver console'})`, 'error');
    }
}



function openLightbox(url) {
    let lb = document.getElementById('lightbox-container');
    if (!lb) {
        lb = document.createElement('div');
        lb.id = 'lightbox-container';
        lb.className = 'lightbox-overlay';
        lb.onclick = closeLightbox;
        lb.innerHTML = `<div class="lightbox-content"><img src=""><span class="lightbox-close">×</span></div>`;
        document.body.appendChild(lb);
    }
    lb.querySelector('img').src = url;
    lb.classList.add('open');
}

function closeLightbox() {
    document.getElementById('lightbox-container').classList.remove('open');
}




