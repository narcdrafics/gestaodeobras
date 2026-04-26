// ==================== HELPERS ====================
let currentEditIdx = -1; // Global variable to identify if we are creating new (-1) or editing an existing record.


// ==================== SYSTEM GLOBALS (ANTI-REFERENCE ERROR) ====================
// Cria 'stubs' para evitar que saves de uma página "crachem" tentando dar reload em UI de outra página
window.renderDashboard = window.renderDashboard || function () { };
window.renderObras = window.renderObras || function () { };
window.renderTrabalhadores = window.renderTrabalhadores || function () { };


window.renderPresenca = window.renderPresenca || function () { };
window.renderTarefas = window.renderTarefas || function () { };
window.renderEstoque = window.renderEstoque || function () { };
window.renderMovEstoque = window.renderMovEstoque || function () { };
window.renderCompras = window.renderCompras || function () { };
window.renderFinanceiro = window.renderFinanceiro || function () { };
window.renderOrcamento = window.renderOrcamento || function () { };
window.renderMedicao = window.renderMedicao || function () { };
window.renderAdmin = window.renderAdmin || function () { };
window.renderFotos = window.renderFotos || function () { };
window.renderSuperAdmin = window.renderSuperAdmin || function () { };
window.renderAlmocos = window.renderAlmocos || function () { };
window.renderRelatorios = window.renderRelatorios || function () { };

// Funções de formatação - fornecidas pelo utils.module.js via window
// NOTA: fmt, fmtPct, fmtDate são declarados em utils.module.js e atribuídos ao window
const cleanText = (v) => (!v || v === 'undefined' || v === 'indefinido') ? '—' : v;
const cleanInput = (v) => (!v || v === 'undefined' || v === 'indefinido') ? '' : v;
const today = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');





// (Removido do topo para evitar conflito de redeclare)



// ==================== PAGE NAVIGATION (DYNAMIC FETCH) ====================
const cachePaginas = {};
const MAX_CACHE_SIZE = 10;

// Use a mesma versão dos scripts base para renovar o cache do HTML
const HTML_CACHE_VERSION = '202603260845';

function clearPageCache() {
  const keys = Object.keys(cachePaginas);
  if (keys.length > MAX_CACHE_SIZE) {
    keys.slice(0, keys.length - MAX_CACHE_SIZE).forEach(k => delete cachePaginas[k]);
  }
}

async function carregarHTML(caminho) {
  clearPageCache();
  if (cachePaginas[caminho]) return cachePaginas[caminho];
  try {
    const urlComVersionamento = `${caminho}?v=${HTML_CACHE_VERSION}`;
    const res = await fetch(urlComVersionamento);
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
    dashboard: renderDashboard, hoje: renderHoje, obras: renderObras, trabalhadores: renderTrabalhadores,
    presenca: renderPresenca, tarefas: renderTarefas, estoque: renderEstoque,
    movEstoque: renderMovEstoque, compras: renderCompras, financeiro: renderFinanceiro,
    orcamento: renderOrcamento, medicao: renderMedicao, admin: renderAdmin,
    fotos: renderFotos, super_admin: renderSuperAdmin, relatorios: renderRelatorios,
    almocos: renderAlmocos
  };
  if (r[id]) r[id]();
}
// Renderiza o banner de trial progressivo
function renderTrialBanner(daysLeft) {
  let banner = document.getElementById('trial-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'trial-banner';
    banner.className = 'trial-banner';
    document.body.prepend(banner);
  }
  const msg = daysLeft <= 1 ? 'últimas 24 horas' : `${daysLeft} dias restantes`;
  banner.innerHTML = `
    <span>⏳ <b>${msg}</b> no seu teste grátis. Assine agora e nunca perca seus dados.</span>
    <button class="btn-pay" onclick="openWhatsApp('Olá, quero assinar o plano Pro do Obra Real!')">Assinar Pro →</button>
  `;
}

// Escuta atualizações do Firebase para gerenciar o banner de Trial e Atualizar a UI Autonamente
window.addEventListener('firebaseSync', e => {
  const data = e.detail;
  
  // 1. Atualiza Banner de Trial
  if (data.plano === 'free_trial' && data.daysLeftTrial !== undefined && data.daysLeftTrial <= 14 && data.daysLeftTrial > 0) {
    renderTrialBanner(data.daysLeftTrial);
  } else {
    const existing = document.getElementById('trial-banner');
    if (existing) existing.remove();
  }

  // 2. ATUALIZAÇÃO AUTOMÁTICA DE INTERFACE (Fix Dashboard/Financeiro vazio no load)
  // Identifica qual página está ativa e força o re-render
  const activePage = document.querySelector('.page.active');
  if (activePage) {
    const id = activePage.id.replace('page-', '');
    console.log(`[Sync] Atualizando interface da página: ${id}`);
    renderPage(id);
  }
});


// ==================== HOJE ====================
function renderHoje() {
  const hoje = new Date().toISOString().split('T')[0];
  const dataEl = document.getElementById('hoje-data');
  if (dataEl) dataEl.textContent = ` — ${fmtDate(hoje)}`;

  const custosDiariasHoje = window.calcCustosDiarias(DB.presenca, { tipo: 'hoje' });
  const custosMedicoes = window.calcCustosMedicoes(DB.medicao, { tipo: 'semana' });
  const custosFinanceiro = window.calcCustosFinanceiro(DB.financeiro, { tipo: 'semana' });

  const presencaHoje = custosDiariasHoje.porObra ? Object.values(custosDiariasHoje.porObra).flat() : [];
  const obras = DB.obras || [];
  
  const presentes = presencaHoje.filter(p => p.presenca === 'Presente').length;
  const faltas = presencaHoje.filter(p => p.presenca === 'Falta').length;

  const kpiGrid = document.getElementById('kpi-grid');
  if (kpiGrid) {
    kpiGrid.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Presentes</div><div class="kpi-val green">${presentes}</div></div>
      <div class="kpi-card"><div class="kpi-label">Faltas</div><div class="kpi-val ${faltas > 0 ? 'red' : 'green'}">${faltas}</div></div>
      <div class="kpi-card"><div class="kpi-label">Obras Ativas</div><div class="kpi-val yellow">${obras.filter(o => o.status === 'Em andamento').length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Diárias Hoje</div><div class="kpi-val blue">${fmt(custosDiariasHoje.custoTotal)}</div></div>
    `;
  }

  const alerts = [];
  (DB.tarefas || []).filter(t => t.prazo === hoje && t.status !== 'Concluída').forEach(t => {
    alerts.push({ tipo: 'TAREFA HOJE', obra: window.obName(t.obra), desc: t.desc, prior: 'alto' });
  });
  (DB.compras || []).filter(c => c.status === 'Aguardando').forEach(c => {
    alerts.push({ tipo: 'COMPRA PENDENTE', obra: window.obName(c.obra), desc: c.mat, prior: 'medio' });
  });

  const alertsGrid = document.getElementById('alerts-grid');
  if (alertsGrid) {
    alertsGrid.innerHTML = alerts.length
      ? alerts.map(a => `<div class="alert-card ${a.prior}"><div class="alert-body"><h4>${a.tipo}</h4><p><b>${a.obra}</b> — ${a.desc}</p></div></div>`).join('')
      : '<div style="color:var(--text3);font-size:13px;padding:8px">Nenhuma pendência hoje.</div>';
  }

  const obrasTbody = document.getElementById('hoje-obras-tbody');
  if (obrasTbody) {
    obrasTbody.innerHTML = obras.map(o => {
      const pObra = presencaHoje.filter(p => p.obra === o.cod);
      const pres = pObra.filter(p => p.presenca === 'Presente').length;
      const fal = pObra.filter(p => p.presenca === 'Falta').length;
      const val = pObra.reduce((a, p) => a + (parseFloat(p.total) || 0), 0);
      return `<tr>
        <td data-label="Obra"><b>${o.nome}</b></td>
        <td data-label="Presentes" style="color:var(--green)">${pres}</td>
        <td data-label="Faltas" style="color:${fal > 0 ? 'var(--red)' : 'var(--text3)'}">${fal}</td>
        <td data-label="Total">${pres + fal}</td>
        <td data-label="Valor">${fmt(val)}</td>
      </tr>`;
    }).join('');
  }

  const pendentesTbody = document.getElementById('hoje-pendentes-tbody');
  if (pendentesTbody) {
    const pendentes = [];
    
    custosDiariasHoje.pendente.forEach(p => {
      const total = parseFloat(p.total) || 0;
      const pago = p.pgtoStatus === 'Parcial' ? (parseFloat(p.valpago) || 0) : 0;
      pendentes.push({ tipo: 'Diária', desc: p.nome, obra: p.obra, valor: Math.max(0, total - pago), status: p.pgtoStatus });
    });
    
    custosMedicoes.pendente.forEach(m => {
      const total = parseFloat(m.vtotal) || 0;
      const pago = m.pgtoStatus === 'Parcial' ? (parseFloat(m.valpago) || 0) : 0;
      pendentes.push({ tipo: 'Medição', desc: m.servico, obra: m.obra, valor: Math.max(0, total - pago), status: m.pgtoStatus });
    });
    
    custosFinanceiro.pendente.forEach(f => {
      const total = Number(f.real) || Number(f.prev) || 0;
      const pago = f.status === 'Parcial' ? (parseFloat(f.valpago) || 0) : 0;
      pendentes.push({ tipo: 'Financeiro', desc: f.desc, obra: f.obra, valor: Math.max(0, total - pago), status: f.status });
    });

    pendentesTbody.innerHTML = pendentes.length
      ? pendentes.map(p => `<tr>
        <td data-label="Tipo">${p.tipo}</td>
        <td data-label="Descrição">${p.desc}</td>
        <td data-label="Obra">${window.obName(p.obra)}</td>
        <td data-label="Valor"><b>${fmt(p.valor)}</b></td>
        <td data-label="Status">${p.status}</td>
      </tr>`).join('')
      : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3)">Nenhum pagamento pendente</td></tr>';
  }
}


// ==================== DASHBOARD ====================
function renderDashboard() {
  try {
    const kpiGrid = document.getElementById('kpi-grid');

    const obrasAtivas = (DB.obras || []).filter(o => o && ['Em andamento', 'Planejada'].includes(o.status)).length;
    const tarefasAtrasadas = (DB.tarefas || []).filter(t => t && t.status === 'Atrasada').length;
    const estoquesBaixos = (DB.estoque || []).filter(e => e && ['BAIXO', 'CRÍTICO'].includes(window.estoqueStatus(e))).length;
    const comprasAguardando = (DB.compras || []).filter(c => c && c.status === 'Aguardando').length;
    const totalPrev = (DB.financeiro || []).reduce((a, f) => a + (f?.prev || 0), 0);

    // Unificação Rápida Financeira Global do Dashboard (Apenas Pendentes subtraindo Parcial)
    let globalFinance = [];
    (DB.financeiro || []).forEach(f => { if (f && f.status !== 'Pago') globalFinance.push({ obra: f.obra, data: f.data, v: Math.max(0, (parseFloat(f.real) || parseFloat(f.prev) || 0) - (f.status === 'Parcial' ? (parseFloat(f.valpago) || 0) : 0)) }) });
    (DB.presenca || []).forEach(p => { if (p && p.pgtoStatus !== 'Pago') globalFinance.push({ obra: p.obra, data: p.data, v: Math.max(0, (parseFloat(p.total) || 0) - (p.pgtoStatus === 'Parcial' ? (parseFloat(p.valpago) || 0) : 0)) }) });
    (DB.medicao || []).forEach(m => { if (m && m.pgtoStatus !== 'Pago') globalFinance.push({ obra: m.obra, data: m.semana, v: Math.max(0, (parseFloat(m.vtotal) || 0) - (m.pgtoStatus === 'Parcial' ? (parseFloat(m.valpago) || 0) : 0)) }) });

    const totalRealGlobal = globalFinance.reduce((a, f) => a + (f?.v || 0), 0);
    const pctCusto = totalPrev > 0 ? ((totalRealGlobal / totalPrev) * 100).toFixed(1) : 0;

  const hoje = DB.presenca.filter(p => p.data === today);
  const presPresente = hoje.filter(p => p.presenca === 'Presente').length;
  const presTotal = hoje.length;

  const todayDate = new Date();
  const fSemana = new Date(todayDate);
  const dayOfWeek = todayDate.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Domingo vira 6, segunda vira 0, etc.
  fSemana.setDate(todayDate.getDate() - diff);
  const strSemana = fSemana.toISOString().split('T')[0];
  const fMes = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const strMes = fMes.toISOString().split('T')[0];

  const custosDiarias = window.calcCustosDiarias(DB.presenca, { tipo: 'semana' });
  const custosMedicoes = window.calcCustosMedicoes(DB.medicao, { tipo: 'semana' });

  const cDiariasSemana = custosDiarias.pendenteTotal;
  const cEmpreitaSemana = custosMedicoes.pendenteTotal;

    if (kpiGrid) {
      kpiGrid.innerHTML = `
        <div class="kpi-card"><div class="kpi-label">Obras Ativas</div><div class="kpi-val yellow">${obrasAtivas}</div><div class="kpi-sub">de ${(DB.obras || []).length} cadastradas</div></div>
        <div class="kpi-card"><div class="kpi-label">Diárias (Semana)</div><div class="kpi-val blue">${fmt(cDiariasSemana)}</div><div class="kpi-sub">Custo de Folha na contabilidade</div></div>
        <div class="kpi-card"><div class="kpi-label">Empreitas (Semana)</div><div class="kpi-val blue" style="font-size:20px">${fmt(cEmpreitaSemana)}</div><div class="kpi-sub">Custo de Medições na contabilidade</div></div>
        <div class="kpi-card"><div class="kpi-label">Custo Real / Prev.</div><div class="kpi-val ${pctCusto > 100 ? 'red' : 'green'}">${pctCusto}%</div><div class="kpi-sub">${fmt(totalRealGlobal)} de ${fmt(totalPrev)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Tarefas Atrasadas</div><div class="kpi-val ${tarefasAtrasadas > 0 ? 'red' : 'green'}">${tarefasAtrasadas}</div><div class="kpi-sub">requer atenção imediata</div></div>
        <div class="kpi-card"><div class="kpi-label">Estoque Baixo/Crítico</div><div class="kpi-val ${estoquesBaixos > 0 ? 'orange' : 'green'}">${estoquesBaixos}</div><div class="kpi-sub">itens abaixo do mínimo</div></div>
      `;
      console.log('[Dash] KPIs renderizados, innerHTML length:', kpiGrid.innerHTML.length);
    } else {
      console.log('[Dash] kpiGrid NÃO encontrado!');
    }

  const alerts = [];
  const uObra = (c) => { const o = DB.obras.find(x => x.cod === c); return o ? o.nome : (c || 'Geral'); };

  DB.estoque.forEach(e => {
    const s = window.estoqueStatus(e);
    if (s === 'CRÍTICO') alerts.push({ tipo: 'ESTOQUE CRÍTICO', obra: uObra(e.obra), desc: `${e.mat} — saldo ${window.calcSaldo(e)} ${e.unid} (mín. ${e.min})`, resp: 'Almoxarife', prior: 'alto' });
    else if (s === 'BAIXO') alerts.push({ tipo: 'ESTOQUE BAIXO', obra: uObra(e.obra), desc: `${e.mat} — saldo ${window.calcSaldo(e)} ${e.unid} (mín. ${e.min})`, resp: 'Almoxarife', prior: 'medio' });
  });
  DB.tarefas.filter(t => t.status === 'Atrasada').forEach(t => alerts.push({ tipo: 'TAREFA ATRASADA', obra: uObra(t.obra), desc: `${t.desc} — prazo: ${fmtDate(t.prazo)}`, resp: t.resp, prior: 'alto' }));
  DB.compras.filter(c => c.status === 'Aguardando').forEach(c => alerts.push({ tipo: 'COMPRA PENDENTE', obra: uObra(c.obra), desc: `${c.mat} — ${fmt(c.vtotal)}`, resp: 'Gestor', prior: 'medio' }));

  if (custosDiarias.pendente.length > 0) {
    const temAtrasadoD = custosDiarias.pendente.some(p => p.pgtoStatus === 'Atrasado');
    alerts.push({
      tipo: 'DIÁRIAS PENDENTES',
      obra: `${custosDiarias.pendente.length} diária(s) em aberto`,
      desc: `Falta pagar: ${fmt(custosDiarias.pendenteTotal)} — Clique para abrir o caixa`,
      resp: 'Financeiro',
      prior: temAtrasadoD ? 'alto' : 'medio',
      action: "showPage('financeiro')"
    });
  }

  if (custosMedicoes.pendente.length > 0) {
    const medPorEquipe = {};
    custosMedicoes.pendente.forEach(m => {
      const eq = m.equipe || 'Equipe Terceira';
      if (!medPorEquipe[eq]) medPorEquipe[eq] = { count: 0, total: 0, atrasado: false };
      medPorEquipe[eq].count++;
      const total = parseFloat(m.vtotal) || 0;
      const pago = m.pgtoStatus === 'Parcial' ? (parseFloat(m.valpago) || 0) : 0;
      medPorEquipe[eq].total += Math.max(0, total - pago);
      if (m.pgtoStatus === 'Atrasado') medPorEquipe[eq].atrasado = true;
    });

    Object.keys(medPorEquipe).forEach(eq => {
      alerts.push({
        tipo: 'EMPREITAS PENDENTES',
        obra: `${eq} — ${medPorEquipe[eq].count} registro(s)`,
        desc: `Falta pagar: ${fmt(medPorEquipe[eq].total)} — Clique para abrir o caixa`,
        resp: 'Financeiro',
        prior: medPorEquipe[eq].atrasado ? 'alto' : 'medio',
        action: "showPage('financeiro')"
      });
    });
  }

  const custosFinanceiro = window.calcCustosFinanceiro(DB.financeiro, { tipo: 'semana' });
  if (custosFinanceiro.pendente.length > 0) {
    const temAtrasadoF = custosFinanceiro.pendente.some(f => f.status === 'Atrasado');
    alerts.push({
      tipo: 'PAGAMENTOS FINANCEIRO',
      obra: `${custosFinanceiro.pendente.length} lançamento(s) pendente(s)`,
      desc: `Falta pagar: ${fmt(custosFinanceiro.pendenteTotal)} — Clique para gerir`,
      resp: 'Financeiro',
      prior: temAtrasadoF ? 'alto' : 'medio',
      action: "showPage('financeiro')"
    });
  }

  const currentUserStr = sessionStorage.getItem('gestaoUser');
  if (currentUserStr) {
    const currentUser = JSON.parse(currentUserStr);
    if (currentUser.role === 'admin' && DB.usuarios) {
      const contasPendentes = DB.usuarios.filter(u => u.role === 'pendente');
      contasPendentes.forEach(pUser => {
        alerts.push({ tipo: 'NOVO USUÁRIO', obra: 'SISTEMA', desc: `${pUser.name} (${pUser.email}) solicitou acesso.`, resp: 'Admin', prior: 'alto' });
      });
    }
  }

  const alertIcons = {};
  const alertsGrid = document.getElementById('alerts-grid');
  if (alertsGrid) {
    alertsGrid.innerHTML = alerts.length
      ? alerts.map(a => `<div class="alert-card ${a.prior}" ${a.action ? `onclick="${a.action}" style="cursor:pointer"` : ''}>
          <div class="alert-body">
            <h4>${a.tipo}</h4>
            <p><b>${a.obra}</b> — ${a.desc}</p>
            <p style="margin-top:4px">Resp: ${a.resp}${a.action ? ' &nbsp;<span style="color:var(--accent);font-weight:600">→ Abrir e pagar</span>' : ''}</p>
          </div>
        </div>`).join('')
      : '<div style="color:var(--text3);font-size:13px;padding:8px">Nenhum alerta no momento.</div>';
  }

  safeSetInner('dash-obras-tbody', DB.obras.map(o => {
    const tarefas = DB.tarefas.filter(t => t.obra === o.cod);

    // Filtro Financeiro por Obra
    const tabObj = globalFinance.filter(f => f.obra === o.cod);
    const realizado = tabObj.reduce((a, f) => a + f.v, 0);
    const cSemanal = tabObj.filter(f => f.data >= strSemana && f.data <= today).reduce((a, f) => a + f.v, 0);
    const cMensal = tabObj.filter(f => f.data >= strMes && f.data <= today).reduce((a, f) => a + f.v, 0);

    // Diárias por Obra (específico, não pagos)
    const dSemanal = DB.presenca
      .filter(p => p.obra === o.cod && p.data >= strSemana && p.data <= today && p.pgtoStatus !== 'Pago')
      .reduce((a, p) => a + Math.max(0, (parseFloat(p.total) || 0) - (p.pgtoStatus === 'Parcial' ? (parseFloat(p.valpago) || 0) : 0)), 0);

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
  }).join(''));

  const updEl = document.getElementById('dash-updated');
  if (updEl) updEl.textContent = 'Atualizado: ' + new Date().toLocaleString('pt-BR');

  } catch (error) {
    console.error('[Dashboard Error]:', error);
    const kpiGrid = document.getElementById('kpi-grid');
    if (kpiGrid) kpiGrid.innerHTML = `<div style="grid-column: 1/-1; padding: 20px; color: var(--red); background: rgba(239, 68, 68, 0.1); border-radius: 8px;">Erro ao processar dados do Dashboard. Por favor, recarregue a página (F5).</div>`;
  }
}

window.toggleGroup = function (cls, iconId) {
  const isHidden = document.querySelector('.' + cls)?.style.display === 'none';
  document.querySelectorAll('.' + cls).forEach(el => {
    el.style.display = isHidden ? '' : 'none';
  });
  const icon = document.getElementById(iconId);
  if (icon) icon.textContent = isHidden ? '▼' : '▶';
};

// ==================== OBRAS ====================
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
            <h3 style="margin:0">${o.nome}</h3>
            ${statusBadge(o.status)}
          </div>
          <div class="obra-meta">${o.end}</div>
          
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
          <button class="btn btn-secondary btn-sm" style="flex:1" onclick="shareObraWhatsApp('${o.cod}')">📱 WhatsApp</button>
          <button class="btn btn-primary btn-sm" onclick="showPage('tarefas')">📋 Tarefas</button>
        </div>
      </div>`;
  }).join(''));

  safeSetInner('obras-tbody', DB.obras.map((o, i) => `<tr>
    <td data-label="Nome"><b>${o.nome}</b></td>
    <td data-label="Cód."><span class="cod">${o.cod}</span></td>
    <td data-label="Status">${statusBadge(o.status)}</td>
    <td data-label="Prazo">${fmtDate(o.prazo)}</td>
    <td data-label="Orçamento">${fmt(o.orc)}</td>
    <td data-label="Mestre">${o.mestre}</td>
    <td>
      <button class="btn btn-secondary btn-sm" onclick="editObra(${i})" style="margin-right:8px"></button>
      <button class="btn btn-danger btn-sm" onclick="deleteItem('obras',${i})">Excluir</button>
    </td>
  </tr>`).join(''));
}

function shareObraWhatsApp(obraCod) {
  const o = DB.obras.find(x => x.cod === obraCod);
  if (!o) return;

  const tasks = DB.tarefas.filter(t => t.obra === obraCod);
  const avgFisico = tasks.length > 0 
    ? (tasks.reduce((acc, t) => acc + (Number(t.perc) || 0), 0) / tasks.length).toFixed(0)
    : 0;

  const fReal = DB.financeiro.filter(f => f.obra === obraCod).reduce((a, f) => a + (Number(f.real) || 0), 0);
  
  // Busca presenças do dia de hoje para esta obra
  const tDay = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
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

// ==================== TRABALHADORES ====================
function renderTrabalhadores() {
  const currentMonth = new Date().toISOString().substring(0, 7); // ISO YYYY-MM

  safeSetInner('trab-tbody', DB.trabalhadores.length
    ? DB.trabalhadores.map((t, i) => {
        const pres = (DB.presenca || []).filter(p => (p.trab === t.cod || p.nome === t.nome));
        const totalAtend = pres.filter(p => (p.presenca==='Presente'||p.presenca==='Falta')).length;
        const presentCnt = pres.filter(p => p.presenca === 'Presente').length;
        const assid = totalAtend > 0 ? ((presentCnt / totalAtend) * 100).toFixed(0) : 0;
        const faltasMes = pres.filter(p => p.presenca === 'Falta' && (p.data||'').startsWith(currentMonth)).length;

        // Cálculo de Saldo Acumulado (Simplificado: Total Gerado - Saldo Pago no Financeiro)
        const earned = pres.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
        const paid = (DB.financeiro || []).filter(f => f.source === 'pre' && f.forn === t.nome && f.status === 'Pago')
                      .reduce((acc, f) => acc + (Number(f.real) || 0), 0);
        const saldo = earned - paid;

        return `<tr>
          <td data-label="Cód."><span class="cod">${t.cod}</span></td>
          <td data-label="Nome / Função"><b>${t.nome}</b><br><small style="color:var(--text3)">${t.funcao || '—'}</small></td>
          <td data-label="Assiduidade (%)">
            <div style="display:flex;align-items:center;gap:8px">
              <div class="progress-bar" style="width:50px;height:6px"><div class="progress-fill" style="width:${assid}%; background:${assid > 80 ? 'var(--green)' : assid > 50 ? 'var(--orange)' : 'var(--red)'}"></div></div>
              <span style="font-weight:600;font-size:12px">${assid}%</span>
            </div>
          </td>
          <td data-label="Faltas (Mês)" style="font-weight:600;color:${faltasMes > 0 ? 'var(--red)' : 'var(--text3)'}">${faltasMes}</td>
          <td data-label="Saldo Acum."><b style="color:${saldo > 0 ? 'var(--orange)' : 'var(--text3)'}">${fmt(saldo)}</b></td>
          <td data-label="Diária/Salário">${fmt(t.diaria)}</td>
          <td data-label="Status">${statusBadge(t.status)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="editTrabalhador(${i})" style="margin-right:8px"></button>
            <button class="btn btn-danger btn-sm" onclick="deleteItem('trabalhadores',${i})">Excluir</button>
          </td>
        </tr>`;
      }).join('')
    : uiEmptyState('Sem Trabalhadores', 'Cadastre o primeiro pedreiro, mestre ou servente para começar.', '👷‍♂️', 'Adicionar Trabalhador', 'openModal(\'modal-trabalhador\')'));
}

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
        <td><b>${a.empreiteiro}</b></td>
        <td>${a.qtd}</td>
        <td>${fmt(a.vunit)}</td>
        <td><b style="color:var(--accent)">${fmt(a.vtotal)}</b></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editAlmoco(${a._idx})" style="margin-right:8px"></button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem('almocos',${a._idx})">Excluir</button>
        </td>
      </tr>
    `).join('');
    safeSetInner('almocos-tbody', html);
  }

  renderAlmocosKPI(list);
}

function renderAlmocosKPI(list) {
  const container = document.getElementById('almocos-kpi');
  if(!container) return;
  const hoje = today;
  const almoHoje = list.filter(a => a.data === hoje).reduce((acc, a) => acc + (parseFloat(a.qtd)||0), 0);
  const custoHoje = list.filter(a => a.data === hoje).reduce((acc, a) => acc + (parseFloat(a.vtotal)||0), 0);
  
  const todayDate = new Date();
  const fSemana = new Date(todayDate);
  const dayOfWeek = todayDate.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Domingo vira 6, segunda vira 0, etc.
  fSemana.setDate(todayDate.getDate() - diff);
  const strSemana = fSemana.toISOString().split('T')[0];
  const qtdSemana = list.filter(a => a.data >= strSemana && a.data <= hoje).reduce((acc, a) => acc + (parseFloat(a.qtd)||0), 0);
  const custoSemana = list.filter(a => a.data >= strSemana && a.data <= hoje).reduce((acc, a) => acc + (parseFloat(a.vtotal)||0), 0);

  container.innerHTML = `
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
  `;

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
    
    resumoContainer.innerHTML = Object.keys(agrupadoSemanal).map(obra => `
      <div class="kpi-card" style="padding:16px;">
        <div style="font-size:12px;color:var(--text3)">${obName(obra)}</div>
        <div style="font-weight:600;margin-top:6px">${agrupadoSemanal[obra].qtd} <small style="font-size:10px;font-weight:normal">ref. somadas</small></div>
        <div style="font-size:14px;color:var(--red);margin-top:4px">${fmt(agrupadoSemanal[obra].total)}</div>
      </div>
    `).join('') || '<div style="color:var(--text3);">Sem consolidação semanal.</div>';
  }
}

function calcAlmocoTotal() {
  const q = parseFloat(document.getElementById('al-qtd').value) || 0;
  const u = parseFloat(document.getElementById('al-vunit').value) || 0;
  const target = document.getElementById('al-vtotal');
  if (target) target.value = (q * u).toFixed(2);
}

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

// ==================== PRESENÇA ====================
let currentWeekOffset = 0;

function changeWeek(offset) {
  currentWeekOffset += offset;
  renderQuadroSemanal();
}

function renderQuadroSemanal() {
  const container = document.getElementById('pres-quadro-semanal');
  if (!container) return;

  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(todayObj);
  const dayOfWeek = todayObj.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Domingo vira 6, segunda vira 0, etc.
  startOfWeek.setDate(todayObj.getDate() - diff + (currentWeekOffset * 7));
  
  const days = [];
  const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    days.push({
      date: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
      name: dayNames[i],
      display: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    });
  }

  const workers = DB.trabalhadores.filter(t => t.status === 'Ativo');
  if (workers.length === 0) {
    container.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text3)">Nenhum trabalhador ativo para exibir no quadro.</p>';
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
        <b>${w.nome}</b><br>
        <small style="color:var(--text3)">${w.funcao || '—'}</small>
      </td>`;
    
    days.forEach(d => {
      const pIdx = (DB.presenca || []).findIndex(record => 
        record && record.data === d.date && (
          record.trab === w.cod || 
          (record.trab == null || record.trab === '') && record.nome === w.nome
        )
      );
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
        <div class="presence-cell" title="${title}" onclick="openPresenceModal('${w.cod}', '${d.date}', ${pIdx})">
          <div class="pres-icon ${iconClass}">${icon}</div>
        </div>
      </td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// Helper para abrir o modal de presença já com dados
function openPresenceModal(workerCod, date, existingIdx = -1) {
  if (existingIdx !== -1) {
    // Modo Edição
    editPresenca(existingIdx);
  } else {
    // Modo Novo
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
    return 0;
  });

  const groupSelect = document.getElementById('pres-group-select');
  const groupMode = groupSelect ? groupSelect.value : 'trab';

  if (listForTable.length === 0) {
    safeSetInner('pres-tbody', uiEmptyState('Folha em Branco', 'Ninguém bateu ponto hoje. Inicie o lançamento diário da obra.', '✅', 'Lançar Presença', 'openModal(\'modal-presenca\')'));
  } else if (!groupMode) {
    safeSetInner('pres-tbody', listForTable.map(p => `<tr>
        <td data-label="Data / Local"><b>${fmtDate(p.data)}</b><br><small style="color:var(--text3)">${obName(p.obra)}${p.frente ? ' · ' + p.frente : ''}</small></td>
        <td data-label="Profissional"><b>${p.nome}</b><br><small style="color:var(--text3)">${p.funcao}</small></td>
        <td data-label="Horários">${p.entrada || '—'} - ${p.saida || '—'}</td>
        <td data-label="Horas (N+E)">${p.hnorm || 0}h + ${p.hextra || 0}h</td>
        <td data-label="Status">${statusBadge(p.presenca)}</td>
        <td data-label="Valor Total"><b>${fmt(p.total)}</b></td>
        <td data-label="Pgto">${p.pgtoStatus || '—'}</td>
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
              <span style="font-size:14px; text-transform:uppercase">${k}</span> 
              <span class="badge badge-blue" style="margin-left:12px">${rows.length} registros</span>
            </td>
            <td colspan="2" style="color:var(--green); font-size:14px; font-weight:bold;">Total: ${fmt(totalGroup)}</td>
          </tr>`;

      rows.forEach(p => {
        tbodyHtml += `<tr class="${cls}" style="display:none; transition: all 0.3s">
                <td data-label="Data / Local" style="padding-left:16px"><span style="color:var(--text3); font-size:10px; margin-right:4px">└</span> <b>${fmtDate(p.data)}</b><br><small style="color:var(--text3)">${obName(p.obra)}${p.frente ? ' · ' + p.frente : ''}</small></td>
                <td data-label="Profissional"><b>${p.nome}</b><br><small style="color:var(--text3)">${p.funcao}</small></td>
                <td data-label="Horários">${p.entrada || '—'} - ${p.saida || '—'}</td>
                <td data-label="Horas (N+E)">${p.hnorm || 0}h + ${p.hextra || 0}h</td>
                <td data-label="Status">${statusBadge(p.presenca)}</td>
                <td data-label="Valor Total"><b>${fmt(p.total)}</b></td>
                <td data-label="Pgto">${p.pgtoStatus || '—'}</td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="editPresenca(${p._idx})" style="margin-right:8px">✏️</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteItem('presenca',${p._idx})">Excluir</button>
                </td>
              </tr>`;
      });
    });
    safeSetInner('pres-tbody', tbodyHtml);
  }

  // Almoços foram extraídos para a nova aba de Gestão de Almoços.

  // Totalizadores por Data (Últimos 10 registros de datas distintas)
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
    safeSetInner('pres-totais', '<p style="color:var(--red); padding: 8px;">Falha ao processar os dados do fechamento. Erro relatado no console (F12).</p>');
  }

  // Pagamentos Pendentes da Semana (Por Obra)
  const pResults = window.calcWeeklyPendingPayments(validPres, DB.obras || [], today);
  const pendentesHtml = pResults.map(res => {
    return `<div class="kpi-card">
      <div class="kpi-label">${res.obraCod} — ${res.obraNome}</div>
      <div style="font-size:20px; font-weight:bold; color:var(--red); margin: 8px 0;">${fmt(res.totalPendente)}</div>
      <div style="font-size:13px; color:var(--text2)">${res.count} pendências salariais na semana</div>
    </div>`;
  }).join('');

  safeSetInner('pres-pgto-pendentes', pendentesHtml || '<p style="color:var(--green); padding: 8px; font-weight: 500;">✅ Nenhum pagamento pendente para esta semana.</p>');

  // ➕ FECHAMENTO POR TRABALHADOR (EMPREITADA)
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
        <div class="kpi-label" style="font-weight:600">${nome}</div>
        <div style="font-size:13px;color:var(--text2);margin:4px 0">${obName(d.obra)} · ${d.dias} dia(s)</div>
        <div style="font-size:20px;font-weight:bold;color:var(--accent)">${fmt(d.total)}</div>
      </div>`;
    }).join('');

    safeSetInner('pres-empreitada', empreitadaHtml || '<p style="color:var(--text3); padding: 8px;">Sem registros de fechamento por trabalhador.</p>');
  } catch(e) {
    console.error('Erro ao renderizar fechamento por trabalhador:', e);
  }

  console.log('renderPresenca concluído.');
  // Almoços movidos para nova tela.
  renderQuadroSemanal();
}

// Filtro de busca na tabela de presença (busca por nome, obra e data)
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

// ==================== TAREFAS ====================
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

  // KPIs dinâmicos filtrados
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

function renderTaskTable(tasks) {
  safeSetInner('tar-tbody', tasks.length
    ? tasks.map(t => `<tr>
        <td data-label="Cód."><span class="cod">${t.cod}</span></td>
        <td data-label="Obra">${obName(t.obra)}</td>
        <td data-label="Etapa / Frente"><small>${t.etapa}<br>${t.frente || '—'}</small></td>
        <td data-label="Descrição"><b>${t.desc}</b></td>
        <td data-label="Responsável">${t.resp}</td>
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
             ${t.photoUrl ? `<span style="cursor:pointer; font-size:18px" title="Ver Evidência" onclick="openLightbox('${t.photoUrl}')">📷</span>` : ''}
             <button class="btn btn-secondary btn-sm" onclick="editTarefa(${t._idx})"></button>
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
          <h4>${colTitles[cId]}</h4>
          <span class="badge badge-gray">${cItems.length}</span>
        </div>
        <div class="kanban-cards">
          ${cItems.length ? cItems.map(t => `
            <div class="kanban-card" onclick="editTarefa(${t._idx})">
              <div class="kanban-card-title">${t.desc}</div>
              <div class="kanban-card-meta">
                <span>👤 ${t.resp}</span>
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

// ==================== ESTOQUE ====================
function renderEstoque() {
  safeSetInner('est-tbody', DB.estoque.length
    ? DB.estoque.map((e, i) => {
      const saldo = window.calcSaldo(e);
      const s = window.estoqueStatus(e);
      return `<tr>
          <td><span class="cod">${e.cod}</span></td><td>${e.mat}</td><td>${e.unid}</td>
          <td>${obName(e.obra)}</td><td>${e.min}</td><td>${e.entrada}</td><td>${e.saida}</td>
          <td><b style="color:${saldo <= e.min ? 'var(--red)' : saldo <= e.min * 1.5 ? 'var(--orange)' : 'var(--green)'}">${saldo}</b></td>
          <td>${fmt(e.custo)}</td><td>${fmt(saldo * e.custo)}</td>
          <td>${statusBadge(s)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="editEstoque(${i})" style="margin-right:8px"></button>
            <button class="btn btn-danger btn-sm" onclick="deleteItem('estoque',${i})">Excluir</button>
          </td>
        </tr>`;
    }).join('')
    : uiEmptyState('Estoque Zerado', 'Cadastre cimento, areia ou ferramentas no almoxarifado virtual.', '📦', 'Cadastrar Material', 'openModal(\'modal-estoque\')'));
}

// ==================== MOV. ESTOQUE ====================
function renderMovEstoque() {
  safeSetInner('movest-tbody', DB.movEstoque.length
    ? DB.movEstoque.map((m, i) => `<tr>
        <td>${fmtDate(m.data)}</td><td><span class="cod">${m.codMat}</span></td><td>${m.mat}</td>
        <td>${obName(m.obra)}</td>
        <td><span class="badge ${m.tipo === 'Entrada' ? 'badge-green' : m.tipo === 'Saída' ? 'badge-orange' : m.tipo.includes('Entrada') ? 'badge-blue' : 'badge-purple'}">${m.tipo}</span></td>
        <td>${m.qtd}</td><td>${m.frente || '—'}</td><td>${m.retirado || '—'}</td>
        <td>${m.autor || '—'}</td><td>${m.nf || '—'}</td>
        <td>${fmt(m.vunit)}</td><td>${fmt(m.vtotal)}</td><td>${m.obs || '—'}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editMovEstoque(${i})" style="margin-right:8px"></button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem('movEstoque',${i})">Excluir</button>
        </td>
      </tr>`).join('')
    : uiEmptyState('Sem Movimentações', 'O depósito não teve entradas ou saídas de materiais ainda.', '🔄', 'Registrar Movimento', 'openModal(\'modal-movest\')'));
}

// ==================== COMPRAS ====================
function renderCompras() {
  safeSetInner('compras-tbody', DB.compras.length
    ? DB.compras.map((c, i) => `<tr>
        <td><b>${c.num}</b></td><td>${fmtDate(c.data)}</td>
        <td>${obName(c.obra)}</td><td><span class="cod">${c.mat}</span></td><td>${c.qtd} ${c.unid}</td>
        <td>${statusBadge(c.status)}</td><td>${c.forn}</td>
        <td>${fmt(c.vtotal)}</td><td>${fmtDate(c.prazo)}</td>
        <td>${c.conf || '—'}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editCompra(${i})" style="margin-right:8px"></button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem('compras',${i})">Excluir</button>
        </td>
      </tr>`).join('')
    : uiEmptyState('Nenhuma Compra', 'Crie um pedido de material novo para acompanhar as entregas dos fornecedores.', '🛒', 'Novo Pedido', 'openModal(\'modal-compra\')'));
}


// ==================== FINANCEIRO ====================
function renderFinanceiro() {
  const selMonth = document.getElementById('fin-month');
  const selYear = document.getElementById('fin-year');
  const selView = document.getElementById('fin-view-type');

  if (!selMonth || !selYear || !selView) return;

  // Inicialização de filtros se vazios
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
  window.finViewType = view; // Para uso no helper do modulo

  const getNome = (c) => { const o = DB.obras.find(x => x.cod === c); return o ? o.nome : (c || 'Geral'); };
  
  // Consolidação Filtrada por Período
  const summary = window.summarizeFinance(DB.financeiro, DB.presenca, DB.medicao, DB.almocos, yy, mm, view) || {};
  let allFin = summary.all || [];
  const perTotals = summary.totalsByPeriod || {};

  // Renderização de Cards de Fluxo de Caixa (Semanal/Quinzenal)
  let sumHtml = '';
  const periods = view === 'quinzenal' ? ['1ª Quinzena', '2ª Quinzena'] : ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'];
  
  periods.forEach(p => {
    const data = perTotals[p] || { real: 0, items: 0 };
    if (data.items === 0 && p === 'Semana 5') return; // Oculta 5ª semana se vazia

    sumHtml += `<div class="kpi-card" style="border-left:4px solid var(--accent); background: var(--bg2);">
      <div class="kpi-label" style="opacity:0.8">${p}</div>
      <div class="kpi-val" style="font-size:20px; font-weight:800; margin: 4px 0;">${fmt(data.real)}</div>
      <div style="font-size:11px; color:var(--text3)">${data.items} registros</div>
    </div>`;
  });

  safeSetInner('fin-summary', sumHtml);

  // Agrupamento por Tipo para evitar lista infinita
  const grouped = {};
  allFin.forEach(f => {
    const type = f.tipo || 'Outros';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(f);
  });

  // Ordem sugerida: Mão de obra, Materiais, Equipamentos, etc.
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

    // Header do Grupo
    tbodyHtml += `<tr class="group-header-fin" data-group="${type.toLowerCase()}" style="background:var(--bg3); font-weight:700;">
      <td colspan="6" style="text-transform:uppercase; font-size:11px; color:var(--accent); letter-spacing:1px">📂 ${type} <small style="color:var(--text3); font-weight:400">(${rows.length})</small></td>
      <td style="font-family: ui-monospace, monospace; font-size:12px">${fmt(subPrev)}</td>
      <td style="font-family: ui-monospace, monospace; font-size:12px">${fmt(subReal)}</td>
      <td colspan="5" style="color:${subReal > subPrev ? 'var(--red)' : 'var(--green)'}; font-size:12px; font-weight:bold">Subtotal: ${fmt(subReal - subPrev)}</td>
    </tr>`;

    rows.forEach(f => {
      const diff = f.real - f.prev;
      let editBtn = '';
      if (f.source === 'fin') editBtn = `<button class="btn btn-secondary btn-sm" onclick="editFinanceiro(${f.idx})" style="margin-right:8px"></button>`;
      else if (f.source === 'med') editBtn = `<button class="btn btn-secondary btn-sm" onclick="editMedicao(${f.idx})" style="margin-right:8px"> Med.</button>`;
      else if (f.source === 'pre') editBtn = `<button class="btn btn-secondary btn-sm" onclick="editPresenca(${f.idx})" style="margin-right:8px"> Dia.</button>`;
      else if (f.source === 'alm') editBtn = `<button class="btn btn-secondary btn-sm" onclick="editAlmoco(${f.idx})" style="margin-right:8px"> Alm.</button>`;

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

      tbodyHtml += `<tr class="fin-row" data-group-ref="${type.toLowerCase()}" data-tipo="${(f.tipo||'').toLowerCase()}" data-status="${(f.status||'').toLowerCase()}" data-busca="${getNome(f.obra).toLowerCase()} ${(f.desc||'').toLowerCase()} ${(f.forn||'').toLowerCase()}">
          <td data-label="Data">${fmtDate(f.data)}</td>
          <td data-label="Obra">${getNome(f.obra)}</td>
          <td data-label="Etapa"><small>${f.etapa}</small></td>
          <td data-label="Tipo" style="white-space:nowrap">${src.icon} ${f.tipo}${srcBadge}</td>
          <td data-label="Descrição"><b>${f.desc}</b></td>
          <td data-label="Fornec./Benef."><small>${f.forn}</small></td>
          <td data-label="Vl. Prev.">${fmt(f.prev)}</td>
          <td data-label="Vl. Real." style="color:${valColor};font-weight:${isIncome?'600':'400'}">${fmt(f.real)}</td>
          <td data-label="Diferença" style="color:${diff > 0 ? 'var(--red)' : diff < 0 ? 'var(--green)' : 'var(--text)'}">${fmt(diff)}</td>
          <td data-label="Pgto"><small>${f.pgto}</small></td>
          <td data-label="Status">${statusBadge(f.status)}</td>
          <td data-label="NF"><small>${f.nf}</small></td>
          <td>${payBtn}${editBtn}${delBtn}</td>
        </tr>`;
    });
  });

  safeSetInner('fin-tbody', tbodyHtml || uiEmptyState('Financeiro Limpo', 'Suas contas a pagar, recebimentos e extratos aparecerão agrupados aqui.', '💰', 'Lançar Custo ou Receita', "openModal('modal-financeiro')"));

  window._allFinRows = allFin;
  
  // Aplica o filtro atual após a renderização para manter a consistência
  if (typeof filterFinanceiro === 'function') filterFinanceiro();
}
window.renderFinanceiro = renderFinanceiro;

// Filtro combinado (tipo + status + busca) do financeiro — usa data-attributes
function filterFinanceiro() {
  console.log('🎬 Executando filtro financeiro...');
  const tipo   = (document.getElementById('fin-tipo-filter')?.value   || '').toLowerCase().trim();
  const status = (document.getElementById('fin-status-filter')?.value || '').toLowerCase().trim();
  const busca  = (document.getElementById('fin-busca')?.value         || '').toLowerCase().trim();
  
  // Mapeia headers para controle de visibilidade
  const headers = {};
  document.querySelectorAll('#fin-tbody .group-header-fin').forEach(h => {
    headers[h.dataset.group] = h;
    h.style.display = 'none'; // Oculta inicialmente
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


// ==================== EXPORT FUNCTIONS ====================
function exportarImagemDashboard() {
  toast('Gerando imagem... Aguarde', 'info');
  const btnDiv = document.querySelector('.page-header div[style*="align-items: center"]');
  if (btnDiv) btnDiv.style.display = 'none'; // Esconde barra de botões

  html2canvas(document.getElementById('conteudo-principal'), {
    scale: 2, // Maior qualidade (High DPI)
    useCORS: true,
    backgroundColor: '#1E1E1E'
  }).then(canvas => {
    const imgData = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = imgData;
    a.download = `Relatorio_Obras_${new Date().toISOString().split('T')[0]}.png`;
    a.click();
    if (btnDiv) btnDiv.style.display = 'flex';
    toast('Imagem gerada! Pronta para WhatsApp.', 'success');
  }).catch(err => {
    console.error(err);
    toast('Falha ao gerar a imagem.', 'error');
    if (btnDiv) btnDiv.style.display = 'flex';
  });
}

// ==================== ORÇAMENTO ====================
function renderOrcamento() {
  const budgetResults = window.calcBudgetProgress(DB.orcamento, DB.financeiro, DB.compras);

  safeSetInner('orc-tbody', budgetResults.length
    ? budgetResults.map((o, i) => {
      const diff = o.diferenca;
      return `<tr>
          <td>${obName(o.obra)}</td><td>${o.etapa}</td><td>${o.tipo}</td><td>${o.desc}</td>
          <td>${o.unid || '—'}</td><td>${o.qtd}</td><td>${fmt(o.vunit)}</td><td>${fmt(o.vtotal)}</td>
          <td>${fmt(o.realizado)}</td>
          <td style="color:${diff < 0 ? 'var(--red)' : diff > 0 ? 'var(--green)' : 'var(--text)'}">${fmt(diff)}</td>
          <td>${o.perc}%</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="editOrcamento(${i})" style="margin-right:8px"></button>
            <button class="btn btn-danger btn-sm" onclick="deleteItem('orcamento',${i})">Excluir</button>
          </td>
        </tr>`;
    }).join('')
    : uiEmptyState('Sem Orçamento', 'Crie as linhas de custo planejado para comparar com o real na tela do Painel.', '📐', 'Criar Linha Orçamentária', 'openModal(\'modal-orcamento\')'));
}

async function renderRelatorios() {
  const sel = document.getElementById('rel-obra');
  if (sel && DB.obras.length > 0) {
    sel.innerHTML = '<option value="">-- Escolha uma Obra --</option>' +
      DB.obras.map(o => `<option value="${o.cod}">${o.nome}</option>`).join('');
  }
}

function generateAuditReport() {
  const obraCod = document.getElementById('rel-obra').value;
  if (!obraCod) { toast('Selecione uma obra primeiro!', 'error'); return; }

  const obra = DB.obras.find(o => o.cod === obraCod);
  if (!obra) return;

  const orc = DB.orcamento.filter(o => o.obra === obraCod);
  const fin = DB.financeiro.filter(f => f.obra === obraCod);
  const med = DB.medicao.filter(m => m.obra === obraCod);
  const com = DB.compras.filter(c => c.obra === obraCod && (c.status === 'Entregue' || c.status === 'Pago'));

  // Categorization Logic
  const isMat = (t) => ['Material', 'Custo Direto (Material)', 'Insumos', 'Equipamento'].includes(t);
  const isMao = (t) => ['Mão de Obra', 'Mão de obra própria', 'Empreiteiro', 'Serviços', 'Adiantamento'].includes(t);

  let prevMat = orc.filter(o => isMat(o.tipo)).reduce((a, b) => a + (b.vtotal || 0), 0);
  let prevMao = orc.filter(o => isMao(o.tipo)).reduce((a, b) => a + (b.vtotal || 0), 0);
  let prevOut = orc.filter(o => !isMat(o.tipo) && !isMao(o.tipo)).reduce((a, b) => a + (b.vtotal || 0), 0);

  let realMat = fin.filter(f => isMat(f.tipo)).reduce((a, b) => a + (b.real || 0), 0);
  realMat += com.reduce((a, b) => a + (b.vtotal || 0), 0); // Compras are always material

  let realMao = fin.filter(f => isMao(f.tipo)).reduce((a, b) => a + (b.real || 0), 0);
  realMao += med.reduce((a, b) => a + (parseFloat(b.vtotal) || 0), 0); // Medicao is always labor/service

  let totalPrev = prevMat + prevMao + prevOut;
  let totalReal = realMat + realMao;

  let html = `
    <div id="print-area" style="padding: 40px; background: white; color: #1e293b; font-family: system-ui, sans-serif; border-radius: 8px; border: 1px solid #cbd5e1;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px;">
        <div>
          <h1 style="margin:0; font-size:28px; color:var(--accent)">LAUDO DE VISTORIA E AUDITORIA</h1>
          <p style="margin:5px 0; color:#64748b; font-weight:500;">Obra: ${obra.nome} (${obra.cod})</p>
        </div>
        <div style="text-align:right">
          <p style="margin:0; font-size:14px; font-weight:600">Obra Real — Gestão Pro</p>
          <p style="margin:0; font-size:12px; color:#64748b">${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      <!-- Resumo Geral -->
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
        <div style="padding:15px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0">
          <label style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700">Investimento Total</label>
          <div style="font-size:20px; font-weight:700; color:#0f172a">${fmt(totalReal)}</div>
          <small style="color:#64748b">de ${fmt(totalPrev)} planejado</small>
        </div>
        <div style="padding:15px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0">
          <label style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700">Economia / Excesso</label>
          <div style="font-size:20px; font-weight:700; color:${totalReal > totalPrev ? '#ef4444' : '#10b981'}">${fmt(totalPrev - totalReal)}</div>
        </div>
        <div style="padding:15px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0">
          <label style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700">Status Financeiro</label>
          <div style="font-size:20px; font-weight:700; color:#0f172a">${((totalReal / totalPrev) * 100).toFixed(1)}%</div>
        </div>
      </div>

      <!-- Divisão por Categoria -->
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; background: #fff; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div>
          <h4 style="margin:0 0 15px 0; color:#475569; display:flex; align-items:center; gap:8px"><span style="font-size:20px">📦</span> MATERIAIS E INSUMOS</h4>
          <div style="display:flex; justify-content:space-between; margin-bottom:8px">
            <span style="font-size:13px; color:#64748b">Gasto Realizado</span>
            <span style="font-size:14px; font-weight:700">${fmt(realMat)}</span>
          </div>
          <div style="height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden; margin-bottom:8px">
            <div style="width:${Math.min(100, (realMat / prevMat) * 100)}%; height:100%; background:#6366f1"></div>
          </div>
          <p style="margin:0; font-size:11px; color:#94a3b8">Previsto em orçamento: ${fmt(prevMat)}</p>
        </div>
        <div>
          <h4 style="margin:0 0 15px 0; color:#475569; display:flex; align-items:center; gap:8px"><span style="font-size:20px">👷</span> MÃO DE OBRA E SERVIÇOS</h4>
          <div style="display:flex; justify-content:space-between; margin-bottom:8px">
            <span style="font-size:13px; color:#64748b">Gasto Realizado</span>
            <span style="font-size:14px; font-weight:700">${fmt(realMao)}</span>
          </div>
          <div style="height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden; margin-bottom:8px">
            <div style="width:${Math.min(100, (realMao / prevMao) * 100)}%; height:100%; background:#10b981"></div>
          </div>
          <p style="margin:0; font-size:11px; color:#94a3b8">Previsto em orçamento: ${fmt(prevMao)}</p>
        </div>
      </div>

      <h3 style="border-left: 4px solid var(--accent); padding-left: 10px; margin-bottom: 15px; font-size:18px">Evidências de Campo (Medições)</h3>
      <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 30px;">
        ${med.map(m => `
          <div style="border: 1px solid #e2e8f0; border-radius:8px; overflow:hidden">
            ${m.photoUrl ? `<img src="${m.photoUrl}" style="width:100%; height:150px; object-fit:cover; display:block">` : '<div style="height:150px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; color:#94a3b8">Sem foto</div>'}
            <div style="padding:10px; font-size:12px">
              <b>${m.servico}</b><br>
              <span style="color:#64748b">Fase: ${m.etapa} | Data: ${fmtDate(m.semana)}</span>
            </div>
          </div>
        `).join('')}
      </div>

      <h3 style="border-left: 4px solid var(--accent); padding-left: 10px; margin-bottom: 15px; font-size:18px">Extrato de Pagamentos Auditos</h3>
      <table style="width:100%; border-collapse: collapse; font-size:12px">
        <thead>
          <tr style="background:#f1f5f9; text-align:left">
            <th style="padding:10px; border-bottom:2px solid #e2e8f0">Data</th>
            <th style="padding:10px; border-bottom:2px solid #e2e8f0">Descrição</th>
            <th style="padding:10px; border-bottom:2px solid #e2e8f0">Tipo</th>
            <th style="padding:10px; border-bottom:2px solid #e2e8f0; text-align:right">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${fin.filter(f => f.status === 'Pago').map(f => `
            <tr>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9">${fmtDate(f.data)}</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9">${f.desc}</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9"><span style="color:#64748b; font-size:10px; text-transform:uppercase">${f.tipo}</span></td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:right"><b>${fmt(f.real)}</b></td>
            </tr>
          `).join('')}
          ${com.map(c => `
            <tr>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9">${fmtDate(c.data)}</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9">${c.mat} (Ref: ${c.num})</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9"><span style="color:#64748b; font-size:10px; text-transform:uppercase">MATERIAL</span></td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:right"><b>${fmt(c.vtotal)}</b></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top:50px; text-align:center; border-top: 1px dashed #cbd5e1; padding-top: 30px; font-size:12px; color:#94a3b8">
        Documento gerado eletronicamente em conformidade com os registros de canteiro do Obra Real.<br>
        Relatório para fins de vistoria e acompanhamento técnico interno.
      </div>
    </div>
    <div style="margin-top:20px; text-align:center">
      <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimir Laudo / Salvar PDF</button>
      <button class="btn btn-secondary" onclick="renderRelatorios()" style="margin-left:10px">🔙 Voltar</button>
    </div>
  `;

  safeSetInner('rel-preview-area', html);
}


// ==================== MEDIÇÃO ====================
function renderMedicao() {
  safeSetInner('med-tbody', DB.medicao.length
    ? DB.medicao.map((m, i) => {
      const av = m.qprev > 0 ? (m.qreal / m.qprev) : 0;
      return `<tr>
          <td>${fmtDate(m.semana)}</td><td>${obName(m.obra)}</td><td>${m.etapa}</td>
          <td>${cleanText(m.frente)}</td><td>${cleanText(m.equipe)}</td><td>${m.servico}</td>
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
               <button class="btn btn-secondary btn-sm" onclick="editMedicao(${i})"></button>
               <button class="btn btn-danger btn-sm" onclick="deleteItem('medicao',${i})">Excluir</button>
             </div>
          </td>
        </tr>`;
    }).join('')
    : uiEmptyState('Sem Medições', 'Acompanhe o avanço das empreiteiras e os laudos dos terceirizados.', '📏', 'Lançar Medição', 'openModal(\'modal-medicao\')'));
}

// ==================== ADMINISTRAÇÃO ====================
function renderAdmin() {
  if (DB.config) {
    const cfg = DB.config;
    safeSetValue('cfg-empresa', cfg.nomeEmpresa || '');
    safeSetValue('cfg-esquema', cfg.esquemaCores || 'emerald');
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
           <button class="btn btn-secondary btn-sm" onclick="editUsuario(${i})" style="margin-right:8px"></button>
           <button class="btn btn-danger btn-sm" onclick="deleteUsuario(${i})">Excluir</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="4">Erro ao carregar usuários.</td></tr>');

  if (typeof renderBillingSection === 'function') renderBillingSection();
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

// SaaS: renderBilling é fornecida por renderBillingSection() em data_core.js
// Mantém alias para compatibilidade de chamadas legadas
function renderBilling() {
  if (typeof renderBillingSection === 'function') renderBillingSection();
}

// startKiwifyCheckout é fornecida por data_core.js (window.startKiwifyCheckout)
// Removida duplicata local para evitar sobrescrita

// ==================== SUPER ADMIN (MASTER) ====================
async function renderSuperAdmin() {
  const tbody = document.getElementById('master-tenants-tbody');
  const tbodyUsers = document.getElementById('master-users-tbody');
  const totalTenantsEl = document.getElementById('master-total-tenants');
  const totalUsersEl = document.getElementById('master-total-users');

  try {
    // Busca todos os Tenants, Perfis e Convites de uma vez (Visão Global)
    const [tenantsSnap, profilesSnap, invitesSnap] = await Promise.all([
      firebase.database().ref('tenants').once('value'),
      firebase.database().ref('profiles').once('value'),
      firebase.database().ref('invites').once('value')
    ]);

    const tenants = tenantsSnap.val() || {};
    const profiles = profilesSnap.val() || {};
    const invites = invitesSnap.val() || {};
    window.globalInvitesDataCache = invites;
    window.globalTenantsDataCache = tenants;

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
                <button class="btn btn-primary btn-sm" onclick="openMasterTenantModal('${tid}')">⚙️ Ajustar</button>
                <button class="btn btn-danger btn-sm" onclick="deleteTenant('${tid}')" style="margin-left: 5px;">Excluir</button>
            </td>
        </tr>`;
    }).join('');

    if (tbodyUsers) {
      // Ordena usuários pelo nome ou e-mail
      profileList.sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));

      tbodyUsers.innerHTML = profileList.map(p => {
        let nomeEmp = 'Sem Vínculo / Mestre';
        let extraInfo = '';

        if (p.tenantId !== 'MASTER_SYSTEM') {
          const t = tenants[p.tenantId] || {};
          const config = t.config || {};
          nomeEmp = config.nomeEmpresa || 'Empresa Excluída/Não Encontrada';
          const slugTxt = config.slug ? `(<b>${config.slug}</b>)` : '';
          extraInfo = `<div style="font-size:10px; opacity:0.6">ID: ${p.tenantId} ${slugTxt}</div>`;
        }

        return `<tr>
                <td><div style="font-weight:600">${p.name || 'Sem Nome'}</div></td>
                <td>${p.email || 'N/A'}</td>
                <td><span class="badge badge-gray">${(p.role || '').toUpperCase()}</span></td>
                <td>
                    <div style="font-weight:600">${nomeEmp}</div>
                    ${extraInfo}
                </td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteGlobalUser('${p.uid}', '${p.email}', '${p.tenantId}')">Excluir️ Excluir</button>
                </td>
            </tr>`;
      }).join('');
    }

    // Chama a auditoria de Webhooks
    renderWebhookLogs();
    
    // Chama a gestão de Super Admins
    renderMasterUsers();

  } catch (err) {
    console.error('Erro Super Admin:', err);
    tbody.innerHTML = '<tr><td colspan="5">Erro de permissão ou conexão.</td></tr>';
  }
}

async function renderWebhookLogs() {
  const tbody = document.getElementById('webhook-logs-tbody');
  if (!tbody) return;

  try {
    const snap = await firebase.database().ref('webhook_debug').limitToLast(15).once('value');
    const logs = snap.val() || {};
    const items = Object.values(logs).sort((a,b) => b.timestamp - a.timestamp);

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; opacity:0.6;">Nenhum evento registrado ainda.</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(log => {
      const p = log.payload || {};
      const status = (p.order_status || p.status || 'N/A').toUpperCase();
      const email = p.email || (p.Customer && p.Customer.email) || 'N/A';
      const tenantId = p.external_id || p.external_reference || 'N/A';
      const result = log.result || 'Pendente/Processado';
      const dateStr = new Date(log.timestamp).toLocaleString('pt-BR');

      return `<tr style="font-size:12px;">
        <td>${dateStr}</td>
        <td><span class="badge ${status === 'APPROVED' || status === 'PAID' ? 'badge-green' : 'badge-gray'}">${status}</span></td>
        <td>${email}</td>
        <td><code>${tenantId}</code></td>
        <td style="color:${result.includes('Success') ? 'var(--green)' : 'var(--text3)'}">${result}</td>
      </tr>`;
    }).join('');

  } catch (e) {
    console.error('Erro ao listar logs:', e);
    tbody.innerHTML = '<tr><td colspan="5">Falha ao carregar logs.</td></tr>';
  }
}

async function renderMasterUsers() {
  const tbody = document.getElementById('master-admins-tbody');
  if (!tbody) return;

  try {
    const snap = await firebase.database().ref('users').once('value');
    const allUsers = snap.val() || {};
    const masters = Object.entries(allUsers)
      .filter(([email, data]) => data.role === 'super_admin')
      .map(([email, data]) => ({ email: email.replace(/,/g, '.'), ...data }));

    tbody.innerHTML = masters.map(m => `
      <tr>
        <td>
           <b>${m.nome || 'Sem Nome'}</b><br>
           <small style="opacity:0.6">${m.email}</small>
        </td>
        <td><span class="badge badge-gray">${m.origem || 'N/A'}</span></td>
        <td>
           <button class="btn btn-danger btn-sm" onclick="deleteMasterUser('${m.email}')">Excluir️</button>
        </td>
      </tr>
    `).join('');

  } catch (e) {
    console.error('Erro ao renderizar mestres:', e);
    tbody.innerHTML = '<tr><td colspan="3">Sem permissão para listar mestres.</td></tr>';
  }
}

async function addMasterUser() {
  const emailInput = document.getElementById('new-master-email');
  const email = emailInput?.value.trim().toLowerCase();
  if (!email) return toast('Informe o e-mail do novo Super Admin.', 'error');
  
  if (!confirm(`Deseja realmente dar acesso TOTAL e GLOBAL para ${email}?`)) return;

  try {
    const sanitized = email.replace(/\./g, ',');
    await firebase.database().ref(`users/${sanitized}`).update({
      role: 'super_admin',
      tenantId: 'MASTER_SYSTEM',
      nome: 'Administrador Mestre',
      origem: 'painel_master'
    });
    toast(`Sucesso! ${email} agora é Super Admin.`);
    emailInput.value = '';
    renderMasterUsers();
  } catch (e) {
    console.error('Erro ao adicionar mestre:', e);
    toast('Erro ao autorizar novo mestre.', 'error');
  }
}

async function deleteMasterUser(email) {
  const sessionUser = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
  if (email === sessionUser.email) return toast('Você não pode remover seu próprio acesso master!', 'error');

  if (!confirm(`Deseja REMOVER o acesso global de ${email}?`)) return;

  try {
    const sanitized = email.replace(/\./g, ',');
    await firebase.database().ref(`users/${sanitized}/role`).set('admin');
    toast(`Acesso master removido de ${email}.`);
    renderMasterUsers();
  } catch (e) {
    console.error('Erro ao remover mestre:', e);
    toast('Erro ao remover acesso master.', 'error');
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

function openMasterTenantModal(tid) {
  // Injeta a estrutura limpa no modal principal
  const contentOrig = document.getElementById('modal-master-tenant').innerHTML;
  const container = document.getElementById('modal-content');
  container.innerHTML = contentOrig;

  const tData = (window.globalTenantsDataCache && window.globalTenantsDataCache[tid]) || {};
  const config = tData.config || {};

  container.querySelector('#mt-tenant-id').value = tid || '';
  container.querySelector('#mt-old-slug').value = config.slug || '';
  container.querySelector('#mt-nome').value = config.nomeEmpresa || '';
  container.querySelector('#mt-slug').value = config.slug || '';
  container.querySelector('#mt-email').value = '';
  container.querySelector('#mt-limite-obras').value = config.limiteObras || 0;
  container.querySelector('#mt-limite-usr').value = config.limiteUsuarios || 0;
  
  // Novos campos de controle de Plano
  if(container.querySelector('#mt-plano')) container.querySelector('#mt-plano').value = tData.plano || 'free_trial';
  if(container.querySelector('#mt-status')) container.querySelector('#mt-status').value = tData.status || 'ativo';

  document.getElementById('modal-container').classList.add('open');
}

async function saveMasterTenant() {
  const modal = document.getElementById('modal-content');
  const tid = modal.querySelector('#mt-tenant-id').value;
  const oldSlug = modal.querySelector('#mt-old-slug').value;
  const nome = modal.querySelector('#mt-nome').value.trim();
  let slugVal = modal.querySelector('#mt-slug').value.trim().toLowerCase();
  const emailOwner = modal.querySelector('#mt-email').value.trim().toLowerCase();
  const lobras = parseInt(modal.querySelector('#mt-limite-obras').value);
  const lusr = parseInt(modal.querySelector('#mt-limite-usr').value);
  const plano = modal.querySelector('#mt-plano')?.value || 'free_trial';
  const status = modal.querySelector('#mt-status')?.value || 'ativo';

  if (isNaN(lobras) || isNaN(lusr)) return toast('Preencha os limites com números válidos.', 'error');
  if (!nome) return toast('Preencha o nome da empresa.', 'error');
  if (!slugVal) return toast('Preencha o subdomínio (slug).', 'error');

  slugVal = slugVal.replace(/[^a-z0-9]/g, '');
  if (!slugVal) return toast('Subdomínio inválido.', 'error');

  try {
    if (slugVal !== oldSlug) {
      const existingSlug = await firebase.database().ref('tenants_public').orderByChild('slug').equalTo(slugVal).once('value');
      if (existingSlug.exists()) {
        return toast(`O subdomínio "${slugVal}" já está em uso!`, 'error');
      }
    }

    const updates = {};
    updates[`tenants/${tid}/config/nomeEmpresa`] = nome;
    updates[`tenants/${tid}/config/slug`] = slugVal;
    updates[`tenants/${tid}/config/limiteObras`] = lobras;
    updates[`tenants/${tid}/config/limiteUsuarios`] = lusr;
    updates[`tenants/${tid}/plano`] = plano;
    updates[`tenants/${tid}/status`] = status;
    
    // Se mudou para Premium agora, garante validade de 30 dias se não tiver
    if (plano === 'premium') {
      updates[`tenants/${tid}/planoVencimento`] = Date.now() + (31 * 24 * 60 * 60 * 1000);
    }

    updates[`tenants_public/${tid}/nomeEmpresa`] = nome;
    updates[`tenants_public/${tid}/slug`] = slugVal;

    if (emailOwner) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailOwner)) return toast('E-mail inválido.', 'error');
      const sanitizedEmail = emailOwner.replace(/\./g, ',');
      updates[`invites/${sanitizedEmail}`] = {
        email: emailOwner, // <--- Adicionado para regras de segurança
        tenantId: tid,
        role: 'admin',
        nomeEmpresa: nome
      };
    }

    await firebase.database().ref().update(updates);
    toast('Empresa salva com sucesso!');
    closeModal();
    renderSuperAdmin();
  } catch (err) {
    console.error(err);
    toast('Erro ao atualizar empresa.', 'error');
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

    // Libera o subdomínio/slug público para reutilização
    updates[`tenants_public/${tid}`] = null;

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

async function deleteGlobalUser(uid, email, tid) {
  if (!confirm(`Deseja realmente EXCLUIR TOTALMENTE o acesso de ${email || uid}?\n(Isso removerá o Perfil e as Credenciais Master)`)) return;
  
  try {
    const updates = {};
    if (uid) updates[`profiles/${uid}`] = null;
    if (email) {
      const sanitized = email.trim().toLowerCase().replace(/\./g, ',');
      updates[`users/${sanitized}`] = null;
    }
    
    await firebase.database().ref().update(updates);
    
    toast('Usuário e Credenciais removidos com sucesso!');
    renderSuperAdmin();
  } catch (e) {
    toast('Erro ao remover usuário completo.', 'error');
    console.error(e);
  }
}

function saveConfig() {
  const emp = document.getElementById('cfg-empresa').value;
  const esquemaCores = document.getElementById('cfg-esquema').value;
  const tema = document.getElementById('cfg-tema').value;
  const slug = document.getElementById('cfg-slug').value.trim().toLowerCase();
  const logoUrl = document.getElementById('cfg-logo-url').value;

  if (!DB.config) DB.config = {};

  DB.config.nomeEmpresa = emp;
  DB.config.esquemaCores = esquemaCores;
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
  } catch (e) {
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
      // Pré-carga total antes do filtro
      tsel.innerHTML = DB.trabalhadores.filter(t => t.status === 'Ativo').map(t => `<option value="${t.cod}">${t.nome}</option>`).join('');
      // Auto-preenche apenas ao criar novo (não ao editar)
      const prEditIdx = document.getElementById('pr-edit-idx') ? parseInt(document.getElementById('pr-edit-idx').value) : -1;
      if (prEditIdx === -1) {
        document.getElementById('pr-data').value = today;
        filterTrabByObra(); // Dispara o filtro inteligente de obras imediatamente ao abrir limpo
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
  if (id === 'modal-financeiro') {
    const fnEditIdx = document.getElementById('fn-edit-idx') ? parseInt(document.getElementById('fn-edit-idx').value) : -1;
    if (fnEditIdx === -1) document.getElementById('fn-data').value = today;
  }
  if (id === 'modal-presenca') {
    const prEditIdx = document.getElementById('pr-edit-idx') ? parseInt(document.getElementById('pr-edit-idx').value) : -1;
    if (prEditIdx === -1) calcPresenca();
  }
  if (id === 'modal-obra') {
    const obEditIdx = document.getElementById('ob-edit-idx') ? parseInt(document.getElementById('ob-edit-idx').value) : -1;
    if (obEditIdx === -1) document.getElementById('ob-cod').value = nextCod(DB.obras, 'OB');
  }
  if (id === 'modal-trabalhador') {
    window._currentTrFoto = null;
    const trEditIdx = document.getElementById('tr-idx') ? parseInt(document.getElementById('tr-idx').value) : -1;
    if (trEditIdx === -1) {
      document.getElementById('tr-cod').value = nextCod(DB.trabalhadores, 'TR');
      document.getElementById('tr-admissao').value = today;
    }
    const fInput = document.getElementById('tr-foto');
    const fPreview = document.getElementById('tr-foto-preview');
    if (fInput && fPreview) {
      fInput.onchange = e => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = re => {
            fPreview.style.display = 'block';
            fPreview.querySelector('img').src = re.target.result;
            window._currentTrFoto = re.target.result;
          };
          reader.readAsDataURL(file);
        }
      };
    }
  }
  if (id === 'modal-estoque') {
    const esEditIdx = document.getElementById('es-edit-idx') ? parseInt(document.getElementById('es-edit-idx').value) : -1;
    if (esEditIdx === -1) document.getElementById('es-cod').value = nextCod(DB.estoque, 'ES');
  }
  if (id === 'modal-movest') {
    document.getElementById('mv-data').value = today;
    const msel = document.getElementById('mv-mat');
    if (msel) {
      msel.innerHTML = DB.estoque.map(e => `<option value="${e.cod}">${e.cod} — ${e.mat} (${e.obra})</option>`).join('');
      fillMatInfo();
    }
  }
  if (id === 'modal-medicao') document.getElementById('md-semana').value = today;
  if (id === 'modal-almoco') {
    const osel = m.querySelector('#al-obra');
    if (osel) osel.innerHTML = DB.obras.map(o => `<option value="${o.cod}">${o.cod} — ${o.nome}</option>`).join('');
    const dlist = m.querySelector('#list-equipes');
    if (dlist) {
      const equipes = [...new Set(DB.trabalhadores.map(t => t.equipe).filter(e => e && e !== 'Própria'))];
      const nomes = DB.trabalhadores.map(t => t.nome);
      const opcoes = [...new Set([...equipes, ...nomes])];
      dlist.innerHTML = opcoes.map(e => `<option value="${e}">`).join('');
    }
    m.querySelector('#al-data').value = today;
    calcAlmocoTotal();
  }
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
  const alEditIdx = document.getElementById('al-edit-idx');
  if (id === 'modal-almoco' && alEditIdx) alEditIdx.value = '-1';
  const tfEditIdx = document.getElementById('tf-edit-idx');
  if (id === 'modal-tarefa' && tfEditIdx) tfEditIdx.value = '-1';
  const obEditIdx = document.getElementById('ob-edit-idx');
  if (id === 'modal-obra' && obEditIdx) obEditIdx.value = '-1';
  const prEditIdx = document.getElementById('pr-edit-idx');
  if (id === 'modal-presenca' && prEditIdx) prEditIdx.value = '-1';
  const esEditIdx = document.getElementById('es-edit-idx');
  if (id === 'modal-estoque' && esEditIdx) esEditIdx.value = '-1';
  const mvEditIdx = document.getElementById('mv-edit-idx');
  if (id === 'modal-movest' && mvEditIdx) mvEditIdx.value = '-1';
  const cpEditIdx = document.getElementById('cp-edit-idx');
  if (id === 'modal-compra' && cpEditIdx) cpEditIdx.value = '-1';
  const fnEditIdx = document.getElementById('fn-edit-idx');
  if (id === 'modal-financeiro' && fnEditIdx) fnEditIdx.value = '-1';
  const ocEditIdx = document.getElementById('oc-edit-idx');
  if (id === 'modal-orcamento' && ocEditIdx) ocEditIdx.value = '-1';
  const mdEditIdx = document.getElementById('md-edit-idx');
  if (id === 'modal-medicao' && mdEditIdx) mdEditIdx.value = '-1';
  const trEditIdx = document.getElementById('tr-idx');
  if (id === 'modal-trabalhador' && trEditIdx) trEditIdx.value = '-1';
}

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

  // 1. Popula Select Individual
  if (filtered.length === 0) {
    tsel.innerHTML = '<option value="">Nenhum trabalhador nesta obra</option>';
    document.getElementById('pr-diaria').value = '';
    document.getElementById('pr-funcao').value = '';
  } else {
    tsel.innerHTML = filtered.map(t => `<option value="${t.cod}">${t.nome}</option>`).join('');
  }

  // 2. Popula Lista de Checkboxes para Modo Massa
  if (listaMassa) {
    listaMassa.innerHTML = filtered.length > 0 
      ? filtered.map(t => `
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; background: rgba(var(--accent-rgb), 0.03); padding: 5px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
            <input type="checkbox" class="pr-massa-check" value="${t.cod}">
            <span style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.nome}</span>
          </label>
        `).join('')
      : '<p style="font-size: 12px; color: var(--text3); padding: 5px;">Nenhum funcionário ativo na obra.</p>';
  }

  fillTrabInfo(); 
}

function fillTrabInfo() {
  const trabEl = document.getElementById('pr-trab');
  if (!trabEl) return;
  const sel = trabEl.value;
  const t = DB.trabalhadores.find(x => x.cod === sel);
  
  // Regra SaaS: Informal não tem Hora Extra
  const hExtGrp = document.getElementById('pr-hextra-grp');
  const isInformal = t && t.vinculo === 'Informal';
  
  if (hExtGrp) {
    // Esconde o grupo de hora extra se for informal
    hExtGrp.style.display = isInformal ? 'none' : '';
    if (isInformal) {
      document.getElementById('pr-hextra').value = 0;
    }
  }

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

  if (presenca === 'Falta') {
    document.getElementById('pr-total').value = 0;
    document.getElementById('pr-hnorm').value = 0;
    document.getElementById('pr-hextra').value = 0;
    return;
  }

  const trabCod = document.getElementById('pr-trab')?.value;
  const trabData = (window.DB && DB.trabalhadores) ? DB.trabalhadores.find(t => t.cod === trabCod) : {};
  const isInformal = trabData && trabData.vinculo === 'Informal';

  const diaria = parseFloat(document.getElementById('pr-diaria').value) || 0;
  const valorHora = diaria / 8;

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
  const hextra = 0; // Hora extra agora deve ser informada explicitamente conforme pedido do usuário

  document.getElementById('pr-hnorm').value = hnorm.toFixed(1);
  document.getElementById('pr-hextra').value = hextra.toFixed(1);

  // O total automático agora considera apenas a diária básica (8h ou proporcional se < 8h)
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
    hextra = 0; // Tranca horas extras de Informais quando ditam manualmente
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

// calcAvanco, calcMovTotal, calcCompraTotal, calcFinDiff, calcOrcTotal
// declarados abaixo junto ao restante das funções de cálculo de formulário

// ==================== SAVE FUNCTIONS ====================
async function saveObra() {

  const cod = document.getElementById('ob-cod').value.trim();
  if (!cod) { toast('Informe o código da obra', 'error'); return; }
  const editIdx = parseInt(document.getElementById('ob-edit-idx').value) || -1;
  // Verifica unicidade do código (exceto ao editar o próprio registro)
  const duplicado = DB.obras.some((o, i) => o.cod === cod && i !== editIdx);
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
    cliente_contato: document.getElementById('ob-cliente-contato').value,
    contrato_tipo: document.getElementById('ob-contrato-tipo').value,
    obs: document.getElementById('ob-obs').value
  };
  if (editIdx >= 0) {
    DB.obras[editIdx] = data;
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

async function saveTrabalhador() {

  // Obtém o índice do campo oculto (mais seguro que variável global)
  const hiddenIdxVal = document.getElementById('tr-idx') ? document.getElementById('tr-idx').value : '-1';
  const editIdx = parseInt(hiddenIdxVal) >= 0 ? parseInt(hiddenIdxVal) : -1;

  const cod = document.getElementById('tr-cod').value.trim();
  if (!cod) { toast('Informe o código', 'error'); return; }
  
  // Verifica unicidade do código (desconsiderando o registro em edição)
  const duplicado = DB.trabalhadores.some((t, i) => t.cod === cod && i !== editIdx);
  if (duplicado) { toast(`Código "${cod}" já existe! Use outro.`, 'error'); return; }
  const data = {
    cod, nome: document.getElementById('tr-nome').value.trim(),
    cpf: document.getElementById('tr-cpf').value,
    funcao: document.getElementById('tr-funcao').value,
    vinculo: document.getElementById('tr-vinculo').value,
    equipe: document.getElementById('tr-equipe').value,
    obras: document.getElementById('tr-obras').value,
    diaria: parseFloat(document.getElementById('tr-diaria').value) || 0,
    pgto: document.getElementById('tr-pgto').value,
    pixtipo: document.getElementById('tr-pixtipo').value,
    pixkey: document.getElementById('tr-pixkey').value,
    contato: document.getElementById('tr-contato').value,
    status: document.getElementById('tr-status').value,
    admissao: document.getElementById('tr-admissao').value,
    endereco: document.getElementById('tr-endereco').value,
    cidade: document.getElementById('tr-cidade').value,
    foto: window._currentTrFoto || (editIdx >= 0 ? DB.trabalhadores[editIdx].foto : null)
  };
  if (editIdx >= 0 && DB.trabalhadores[editIdx]) {
    // 1. Captura Segura dos Dados Antigos ANTES de atualizar
    const oldWorker = { ...DB.trabalhadores[editIdx] };
    const oldName = (oldWorker.nome || '').trim();
    const oldCod = (oldWorker.cod || '').trim();
    
    const newName = (data.nome || '').trim();
    const newCod = (data.cod || '').trim();

    DB.trabalhadores[editIdx] = data; // Atualiza o cadastro principal
    
    // 2. Propagação em Cascata (Se Nome OU Código mudaram)
    if ((oldName !== newName && newName) || (oldCod !== newCod && newCod)) {
      console.log(`[Sync] Propagando alteração de "${oldName}" (${oldCod}) para "${newName}" (${newCod})...`);

      // 1. Presença (Folha de Ponto) — Vínculo primário por Código (trab) ou Nome
      if (DB.presenca) {
        DB.presenca.forEach(p => {
          if (p.trab === oldCod || p.nome === oldName) {
            p.nome = newName;
            p.trab = newCod;
          }
        });
      }

      // 2. Tarefas (Responsável)
      if (DB.tarefas) {
        DB.tarefas.forEach(t => {
          if (t.resp === oldName) t.resp = newName;
        });
      }

      // 3. Financeiro (Fornecedor/Beneficiário)
      if (DB.financeiro) {
        DB.financeiro.forEach(f => {
          if (f.forn === oldName) f.forn = newName;
          // Se for pagamento de diária gerado automaticamente, o vínculo de código pode estar em outro lugar,
          // mas o campo 'forn' é o principal para busca na tela.
        });
      }

      // 4. Medições (Equipe Terceira)
      if (DB.medicao) {
        DB.medicao.forEach(m => {
          if (m.equipe === oldName) m.equipe = newName;
        });
      }

      // 5. Almoços (Empreiteiro/Responsável)
      if (DB.almocos) {
        DB.almocos.forEach(a => {
          if (a.empreiteiro === oldName) a.empreiteiro = newName;
        });
      }

      // 6. Cadastro de Obras (Mestre Responsável)
      if (DB.obras) {
        DB.obras.forEach(o => {
          if (o.mestre === oldName) o.mestre = newName;
        });
      }
    }
    toast('Cadastro e históricos atualizados!');
  } else {
    DB.trabalhadores.push(data);
    toast('Novo trabalhador cadastrado!');
  }

  closeModal('modal-trabalhador');

  // Atualizações Globais na UI (antes do sync para UX mais rápida)
  if (typeof renderTrabalhadores === 'function') renderTrabalhadores();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderFinanceiro === 'function') renderFinanceiro();

  // Força sincronização imediata com diagnóstico de erro
  try {
    await persistDB(true);
  } catch (err) {
    const code = err?.code || 'UNKNOWN';
    console.error('[saveTrabalhador] Falha ao sincronizar com a nuvem:', code, err?.message || err);
    toast(`Salvo localmente. Erro na nuvem: ${code}`, 'error');
  }
}

async function editTrabalhador(idx) {
  await openModal('modal-trabalhador');
  if (document.getElementById('tr-idx')) {
     document.getElementById('tr-idx').value = idx;
  }
  const t = DB.trabalhadores[idx];
  document.getElementById('tr-cod').value = t.cod;
  document.getElementById('tr-nome').value = t.nome;
  document.getElementById('tr-cpf').value = t.cpf;
  document.getElementById('tr-funcao').value = t.funcao;
  document.getElementById('tr-vinculo').value = t.vinculo;
  document.getElementById('tr-equipe').value = t.equipe;
  document.getElementById('tr-obras').value = t.obras;
  document.getElementById('tr-diaria').value = t.diaria;
  document.getElementById('tr-pgto').value = t.pgto || 'PIX';
  document.getElementById('tr-pixtipo').value = t.pixtipo || 'cpf';
  document.getElementById('tr-pixkey').value = t.pixkey || '';
  document.getElementById('tr-contato').value = t.contato || '';
  document.getElementById('tr-status').value = t.status;
  document.getElementById('tr-admissao').value = t.admissao;
  document.getElementById('tr-endereco').value = t.endereco || '';
  document.getElementById('tr-cidade').value = t.cidade || '';
  
  // Foto Preview
  const fPreview = document.getElementById('tr-foto-preview');
  if (fPreview && t.foto) {
    fPreview.style.display = 'block';
    fPreview.querySelector('img').src = t.foto;
  } else if (fPreview) {
    fPreview.style.display = 'none';
  }

  // Cálculo Último Pagamento
  const ultPgto = DB.financeiro
    .filter(f => f.trab === t.cod && (f.status === 'Pago' || f.pgtoStatus === 'Pago'))
    .sort((a, b) => new Date(b.data) - new Date(a.data))[0];
  document.getElementById('tr-last-pay').value = ultPgto ? fmtDate(ultPgto.data) : 'Nenhum pagamento registrado';
}

async function savePresenca(keepOpen = false) {
  // Validação dos campos obrigatórios
  const modoMassa = document.querySelector('input[name="pr-modo"]:checked')?.value === 'massa';
  const dataVal = document.getElementById('pr-data').value;
  const obraVal = document.getElementById('pr-obra').value;
  const editIdx = parseInt(document.getElementById('pr-edit-idx').value) || -1;
  
  if (!dataVal) { toast('Informe a data!', 'error'); return; }
  if (!obraVal) { toast('Selecione a obra!', 'error'); return; }

  let lastSavedData = null; // Captura último registro salvo para o toast fora do loop
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
    
    // Bloqueia duplicidade de data para o mesmo trabalhador
    const jaExiste = DB.presenca.some((p, idx) => 
      p.data === dataVal && 
      p.trab === tsel && 
      (editIdx < 0 || idx !== editIdx)
    );

    if (jaExiste) {
      const nomeTrab = t ? t.nome : tsel;
      toast(`⚠️ Já existe registro para ${nomeTrab} em ${fmtDate(dataVal)}!`, 'error');
      if (modoMassa) continue;
      return;
    }

  // Vínculo Automático: Se o peão não estiver engajado na Obra em sua ficha local, anexa a tag!
  if (t && (!t.obras || !t.obras.includes(obraVal))) {
    t.obras = t.obras && t.obras.trim() !== '' ? (t.obras + ", " + obraVal) : obraVal;
  }

    const isInformal = t && t.vinculo === 'Informal';

    const data = {
      data: dataVal,
      obra: obraVal,
      trab: tsel,
      nome: t ? t.nome : tsel,
      funcao: t ? t.funcao : document.getElementById('pr-funcao').value, // No modo massa pega da ficha
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
      // Almoco agora é captado na tela de Gestão de Almoços
      lancador: document.getElementById('pr-lancador').value,
      hrLanc: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      obs: document.getElementById('pr-obs').value
    };

    if (editIdx >= 0 && !modoMassa) {
      DB.presenca[editIdx] = data;
    } else {
      DB.presenca.push(data);
    }
    lastSavedData = data; // Captura para uso no toast após o loop
  }

  if (keepOpen) {
    document.getElementById('pr-trab').value = '';
    document.getElementById('pr-funcao').value = '';
    document.getElementById('pr-presenca').value = 'Presente';
    document.getElementById('pr-hnorm').value = '';
    document.getElementById('pr-hextra').value = '';
    document.getElementById('pr-diaria').value = '';
    document.getElementById('pr-total').value = '';
    document.getElementById('pr-valpago').value = '';
    document.getElementById('pr-pgto-status').value = 'Pendente';
    document.getElementById('pr-obs').value = '';
    if (document.getElementById('pr-parcial-grp')) document.getElementById('pr-parcial-grp').style.display = 'none';
    if (document.getElementById('pr-parcial-msg')) document.getElementById('pr-parcial-msg').style.display = 'none';
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
    // Mesmo que a nuvem falhe, os dados já estão no DB local em memória
    console.error('Erro ao persistir presença:', err);
    toast('Presença salva localmente, mas falhou na nuvem. Tente sincronizar.', 'error');
  }

  renderPresenca();
  renderFinanceiro();
  renderDashboard();
}

// Helpers para Presença em Massa e Regras SaaS
function togglePresencaModo() {
  const modo = document.querySelector('input[name="pr-modo"]:checked').value;
  const indivGrp = document.getElementById('pr-indiv-grp');
  const massaGrp = document.getElementById('pr-massa-grp');
  const hExtGrp = document.getElementById('pr-hextra-grp');
  
  if (modo === 'massa') {
    indivGrp.style.display = 'none';
    massaGrp.style.display = '';
    hExtGrp.style.display = 'none'; // No modo massa esconde HE por padrão pra agilizar
    filterTrabByObra();
  } else {
    indivGrp.style.display = '';
    massaGrp.style.display = 'none';
    fillTrabInfo(); // Recalcula visibilidade do HE
  }
}

function selectAllTrabs(check) {
  const checks = document.querySelectorAll('.pr-massa-check');
  checks.forEach(c => c.checked = check);
}

async function editPresenca(idx) {
  await openModal('modal-presenca');
  document.getElementById('pr-edit-idx').value = idx;
  const p = DB.presenca[idx];
  document.getElementById('pr-data').value = p.data;
  document.getElementById('pr-obra').value = p.obra;

  // Dispara o filtro inteligente programaticamente antes de resgatar o valor do trabalhador
  filterTrabByObra();

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
  // pr-almoco removido
  document.getElementById('pr-obs').value = p.justif || p.obs || '';
  document.getElementById('pr-diaria').value = p.diaria;
  document.getElementById('pr-total').value = p.total;
  document.getElementById('pr-pgto-status').value = p.pgtoStatus || 'Pendente';
  document.getElementById('pr-valpago').value = p.valpago || '';
  document.getElementById('pr-lancador').value = p.lancador;
  togglePresenca();
  toggleParcial('pr');
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

window.toggleParcial = function (prefix) {
  let statusSel = document.getElementById(prefix === 'fn' ? 'fn-status' : prefix + '-pgto-status');
  const isParcial = statusSel && statusSel.value === 'Parcial';
  const grp = document.getElementById(prefix + '-parcial-grp');
  const msg = document.getElementById(prefix + '-parcial-msg');
  if (grp) grp.style.display = isParcial ? '' : 'none';
  if (msg) msg.style.display = isParcial ? '' : 'none';
  if (isParcial) window.calcParcial(prefix);
};

window.calcParcial = function (prefix) {
  let total = 0;
  let valPago = parseFloat(document.getElementById(prefix + '-valpago').value) || 0;
  if (prefix === 'fn') total = parseFloat(document.getElementById('fn-real').value) || parseFloat(document.getElementById('fn-prev').value) || 0;
  if (prefix === 'md') total = parseFloat(document.getElementById('md-vtotal').value) || 0;
  if (prefix === 'pr') total = parseFloat(document.getElementById('pr-total').value) || 0;

  let faltante = total - valPago;
  const msg = document.getElementById(prefix + '-parcial-msg');
  if (msg) {
    if (faltante > 0) msg.textContent = `Aviso: Falta Pagar R$ ${faltante.toFixed(2).replace('.', ',')}`;
    else if (faltante < 0) msg.textContent = `Aviso: Cuidado, excede o total (R$ ${Math.abs(faltante).toFixed(2).replace('.', ',')})`;
    else msg.textContent = 'Aviso: Totalmente quitado.';
  }
};

// ==================== CÁLCULOS DE FORMULÁRIO ====================
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
function calcAvanco() {
  const p = parseFloat(document.getElementById('md-qprev').value) || 0;
  const r = parseFloat(document.getElementById('md-qreal').value) || 0;
  const v = parseFloat(document.getElementById('md-vunit').value) || 0;
  document.getElementById('md-avanco').value = p > 0 ? (r / p * 100).toFixed(1) : 0;
  document.getElementById('md-vtotal').value = (r * v).toFixed(2);
}

window.toggleDestinoMov = function () {
  const t = document.getElementById('mv-tipo').value;
  const grp = document.getElementById('grp-mv-destino');
  if (grp) grp.style.display = t === 'Transferência' ? 'block' : 'none';
};

// ==================== LOTE DE PAGAMENTO (FOLHA) ====================
window.lotePendentes = [];

window.prepareLotePgto = async function () {
  await openModal('modal-lote');
  const saldos = {};
  DB.presenca.filter(p => p.pgtoStatus !== 'Pago').forEach(p => {
    // Identificador único (idealmente código do trab, senão foca no nome base)
    const key = p.trab || (p.nome + '-' + p.funcao);

    let devido = (parseFloat(p.total) || 0) - (p.pgtoStatus === 'Parcial' ? (parseFloat(p.valpago) || 0) : 0);
    if (devido > 0) {
      if (!saldos[key]) {
        saldos[key] = {
          chave: key, nome: p.nome, funcao: p.funcao,
          diarias: 0, valor: 0, indices: []
        };
      }
      saldos[key].diarias += 1;
      saldos[key].valor += devido;
      saldos[key].indices.push(p);
    }
  });

  window.lotePendentes = Object.values(saldos).sort((a, b) => b.valor - a.valor);
  renderLoteTbody();
};

window.renderLoteTbody = function () {
  const tbody = document.getElementById('lote-tbody');
  if (!tbody) return;
  if (lotePendentes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;">🎉 Nenhuma diária pendente! Toda a folha já está quitada.</td></tr>';
    document.getElementById('lote-total-sel').textContent = 'R$ 0,00';
    return;
  }

  tbody.innerHTML = lotePendentes.map((item, i) => `<tr>
    <td style="text-align:center"><input type="checkbox" class="ck-lote-item" value="${i}" onchange="updateLoteTotal()" style="transform:scale(1.2)"></td>
    <td><b>${item.nome}</b> <small style="color:var(--text3)">(${item.funcao})</small></td>
    <td style="text-align:center"><span class="badge badge-gray">${item.diarias}</span></td>
    <td style="text-align:right">Dinheiro/Pix</td>
    <td style="text-align:right; font-weight:bold; color:var(--red)">${fmt(item.valor)}</td>
    <td style="text-align:center">
      <button class="btn btn-success btn-sm" onclick="initiatePixPayment('lote', ${i})" title="Pagar via PIX" style="background:var(--green); border-color:var(--green);">💸</button>
    </td>
  </tr>`).join('');

  updateLoteTotal();
};

window.toggleLoteAll = function (el) {
  const cks = document.querySelectorAll('.ck-lote-item');
  cks.forEach(ck => ck.checked = el.checked);
  updateLoteTotal();
};

window.updateLoteTotal = function () {
  const cks = document.querySelectorAll('.ck-lote-item:checked');
  let total = 0;
  cks.forEach(ck => {
    const item = lotePendentes[parseInt(ck.value)];
    if (item) total += item.valor;
  });
  const el = document.getElementById('lote-total-sel');
  if (el) el.textContent = fmt(total);
};

window.processLotePgto = async function () {
  const cks = document.querySelectorAll('.ck-lote-item:checked');
  if (cks.length === 0) { toast('Nenhum trabalhador selecionado!', 'error'); return; }

  cks.forEach(ck => {
    const item = lotePendentes[parseInt(ck.value)];
    if (item) {
      item.indices.forEach(p => {
        p.pgtoStatus = 'Pago';
        p.valpago = p.total;
      });
    }
  });

  toast(`${cks.length} pagamentos realizados com sucesso!`);
  closeModal('modal-lote');
  await persistDB();

  renderPresenca();
  renderFinanceiro();
  renderDashboard();
};



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
  closeModal('modal-tarefa'); await persistDB(); renderTarefas();
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
  const editIdx = parseInt(document.getElementById('es-edit-idx').value) || -1;
  if (editIdx >= 0) {
    if (DB.estoque[editIdx].saida !== undefined) {
      data.saida = DB.estoque[editIdx].saida; // preserve existing usage counter
    }
    DB.estoque[editIdx] = data;
    toast('Item de estoque atualizado!');
  } else {
    DB.estoque.push(data);
    toast('Item de estoque cadastrado!');
  }
  closeModal('modal-estoque'); await persistDB(); renderEstoque();
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

    // 1. Dar baixa na Origem
    if (e) {
      if (qtd > window.calcSaldo(e)) { toast('Qtd. maior que saldo na Origem!', 'error'); return; }
      e.saida += qtd;
    }

    // 2. Localizar/Criar no Destino
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

    // 3. Registrar Movimento de SAÍDA (Origem)
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

    // 4. Registrar Movimento de ENTRADA (Destino)
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
    // Normal Entrada/Saida Logic
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

  closeModal('modal-movest'); await persistDB(); renderMovEstoque(); renderEstoque();
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
    window.toggleDestinoMov();
  } else {
    document.getElementById('mv-tipo').value = m.tipo;
    window.toggleDestinoMov();
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
  closeModal('modal-compra'); await persistDB(); renderCompras();
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

async function saveFinanceiro() {

  const prev = parseFloat(document.getElementById('fn-prev').value) || 0;
  const real = parseFloat(document.getElementById('fn-real').value) || 0;
  const status = document.getElementById('fn-status').value;
  let valpago = parseFloat(document.getElementById('fn-valpago').value) || 0;

  // Regras de integridade para valpago:
  // - Status "Pago": valpago deve ser o valor total (real > 0 ? real : prev)
  // - Status "Pendente" ou "Atrasado": valpago deve ser zero
  // - Status "Parcial": valpago é o que o usuário digitou
  if (status === 'Pago') {
    valpago = Number(real) > 0 ? real : prev;
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
    let tmsg = 'Lançamento financeiro atualizado!';
    if (status === 'Parcial') {
      const falta = (Number(real) > 0 ? real : prev) - valpago;
      tmsg = falta > 0
        ? `Status Parcial: Falta Pagar R$ ${falta.toFixed(2).replace('.', ',')}`
        : 'Status Parcial: Totalmente quitado.';
    }
    toast(tmsg);
  } else {
    DB.financeiro.push(data);
    let tmsg = 'Lançamento financeiro salvo!';
    if (status === 'Parcial') {
      const falta = (Number(real) > 0 ? real : prev) - valpago;
      tmsg = falta > 0
        ? `Status Parcial: Falta Pagar R$ ${falta.toFixed(2).replace('.', ',')}`
        : 'Status Parcial: Totalmente quitado.';
    }
    toast(tmsg);
  }
  closeModal('modal-financeiro'); await persistDB(); renderFinanceiro(); renderDashboard();
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
  calcFinDiff(); // Atualiza o campo Diferença ao abrir
  toggleParcial('fn'); // Mostra/oculta campo de valpago
  if (f.status === 'Parcial') window.calcParcial('fn'); // Exibe "Falta Pagar" imediatamente
}

function calcOrcTotal() {
  const q = parseFloat(document.getElementById('oc-qtd').value) || 0;
  const u = parseFloat(document.getElementById('oc-vunit').value) || 0;
  const target = document.getElementById('oc-vtotal');
  if (target) target.value = (q * u).toFixed(2);
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
  const editIdx = parseInt(document.getElementById('oc-edit-idx').value) || -1;
  if (editIdx >= 0) {
    if (DB.orcamento[editIdx].vreal !== undefined) {
      data.vreal = DB.orcamento[editIdx].vreal; // preserve the current progress amount
    }
    DB.orcamento[editIdx] = data;
    toast('Item de orçamento atualizado!');
  } else {
    DB.orcamento.push(data);
    toast('Item de orçamento salvo!');
  }
  closeModal('modal-orcamento'); await persistDB(); renderOrcamento();
}

async function editOrcamento(idx) {
  await openModal('modal-orcamento');
  document.getElementById('oc-edit-idx').value = idx;
  const o = DB.orcamento[idx];
  document.getElementById('oc-obra').value = o.obra;
  document.getElementById('oc-etapa').value = o.etapa;
  document.getElementById('oc-tipo').value = o.tipo;
  document.getElementById('oc-desc').value = o.desc;
  document.getElementById('oc-qtd').value = o.qtd;
  document.getElementById('oc-unid').value = o.unid;
  document.getElementById('oc-vunit').value = o.vunit;
  document.getElementById('oc-vtotal').value = o.vtotal;
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
    valpago: parseFloat(document.getElementById('md-valpago').value) || 0,
    photoUrl: document.getElementById('md-photo-url').value || '',
    obs: document.getElementById('md-obs').value
  };
  const editIdx = parseInt(document.getElementById('md-edit-idx').value) || -1;
  if (editIdx >= 0) {
    DB.medicao[editIdx] = data;
    let tmsg = 'Medição atualizada!';
    if (data.pgtoStatus === 'Parcial') tmsg = `Status Parcial: Falta Pagar R$ ${(data.vtotal - data.valpago).toFixed(2).replace('.', ',')}`;
    toast(tmsg);
  } else {
    DB.medicao.push(data);
    let tmsg = 'Medição salva!';
    if (data.pgtoStatus === 'Parcial') tmsg = `Status Parcial: Falta Pagar R$ ${(data.vtotal - data.valpago).toFixed(2).replace('.', ',')}`;
    toast(tmsg);
  }
  closeModal('modal-medicao'); await persistDB(); renderMedicao && renderMedicao(); renderFinanceiro && renderFinanceiro(); renderDashboard && renderDashboard();
}

async function editMedicao(idx) {
  await openModal('modal-medicao');
  document.getElementById('md-edit-idx').value = idx;
  const m = DB.medicao[idx];
  document.getElementById('md-semana').value = m.semana;
  document.getElementById('md-obra').value = m.obra;
  document.getElementById('md-etapa').value = cleanInput(m.etapa);
  document.getElementById('md-frente').value = cleanInput(m.frente);
  document.getElementById('md-equipe').value = cleanInput(m.equipe);
  document.getElementById('md-servico').value = cleanInput(m.servico);
  document.getElementById('md-unid').value = cleanInput(m.unid);
  document.getElementById('md-qprev').value = m.qprev;
  document.getElementById('md-qreal').value = m.qreal;
  document.getElementById('md-vunit').value = m.vunit || 0;
  document.getElementById('md-vtotal').value = m.vtotal || 0;
  document.getElementById('md-retr').value = m.retr;
  document.getElementById('md-pgto-status').value = m.pgtoStatus || 'Pendente';
  document.getElementById('md-valpago').value = m.valpago || '';
  document.getElementById('md-photo-url').value = m.photoUrl || '';
  toggleParcial('md');
  const preview = document.getElementById('md-photo-preview');
  if (m.photoUrl) {
    preview.style.display = 'block';
    preview.querySelector('img').src = m.photoUrl;
  } else {
    preview.style.display = 'none';
  }
  document.getElementById('md-obs').value = cleanInput(m.obs);
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
    const limiteAcessos = DB.config.limiteUsuarios || 2; // Plano Start e Free é 2
    if (DB.usuarios && DB.usuarios.length >= limiteAcessos && limiteAcessos < 99) {
      toast(`Seu plano atingiu o limite de ${limiteAcessos} acessos. Faça downgrade ou o Upgrade Ilimitado!`, 'error');
      return;
    }

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
  if (idx < 0 || idx >= DB[table].length) {
    toast('Erro: Índice inválido. Recarregue a página.', 'error');
    return;
  }
  DB[table].splice(idx, 1);
  persistDB();
  const activePageEl = document.querySelector('.page.active');
  if (activePageEl) {
    const pageId = activePageEl.id.replace('page-', '');
    renderPage(pageId);
  } else {
    // Fallback refresh for critical tabs
    if (table === 'orcamento') renderOrcamento();
    if (table === 'financeiro') renderFinanceiro();
  }
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
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
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

// SaaS: Disparo de checkAuth removido daqui (movido para o final do arquivo para evitar duplicidade)

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
  const lusr = parseInt(modal.querySelector('#ct-limite-usr').value) || 0;

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

    // 1. Criar Estrutura do Tenant (Padrão SaaS Unificado)
    // Nota: o ID do tenant é o próprio slug para facilitar lookup direto
    await firebase.database().ref(`tenants/${slugVal}`).set({
      nomeEmpresa: nome,
      slug: slugVal,
      emailAdmin: emailOwner,
      status: 'ativo',
      plano: 'premium', // Começa como Premium por ser manual do Admin
      planoVencimento: Date.now() + (31 * 24 * 60 * 60 * 1000),
      webhookCriacao: Date.now(),
      config: {
        nomeEmpresa: nome,
        slug: slugVal,
        esquemaCores: 'emerald',
        limiteObras: lobras,
        limiteUsuarios: lusr,
        limiteTrabalhadores: 9999
      }
    });

    const sanitizedEmail = emailOwner.replace(/\./g, ',');

    // 2. Inserir no Novo Título Global (Painel Mestre e Passaporte)
    await firebase.database().ref(`users/${sanitizedEmail}`).set({
      email: emailOwner, // <--- Adicionado para regras de segurança
      tenantId: slugVal,
      role: 'admin',
      nome: nome,
      origem: 'super_admin_manual'
    });

    // 3. Espelhar slug no nó público (para leitura da logo antes do login)
    await firebase.database().ref(`tenants_public/${slugVal}`).set({
      slug: slugVal,
      nomeEmpresa: nome,
      esquemaCores: 'emerald'
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

// SaaS: Inicialização ÚNICA e SEGURA após carregamento de todos os componentes
if (typeof window.safeCheckAuth === 'function') {
  window.safeCheckAuth();
}

// FECHAR SIDEBAR AO CLICAR FORA (Mobile / Dashboard Overlay)
document.addEventListener('click', (event) => {
  const sidebar = document.querySelector('.sidebar');
  const menuToggle = document.querySelector('.menu-toggle');
  
  if (sidebar && sidebar.classList.contains('open')) {
    // Se o clique não foi dentro da sidebar E não foi no botão de abrir o menu...
    if (!sidebar.contains(event.target) && !menuToggle.contains(event.target)) {
      sidebar.classList.remove('open');
    }
  }
});

// ==================== SYNC STATUS FEEDBACK ====================
window.addEventListener('syncStatus', (e) => {
  const { status, code } = e.detail;
  let indicator = document.getElementById('sync-indicator');
  
  if (!indicator) {
    const container = document.querySelector('.header-right');
    if (!container) return;
    indicator = document.createElement('div');
    indicator.id = 'sync-indicator';
    indicator.className = 'sync-indicator';
    container.prepend(indicator);
  }

  indicator.style.opacity = '1';
  indicator.onclick = null; // Reseta clique
  indicator.style.cursor = 'default';

  if (status === 'saving') {
    indicator.innerHTML = '<div class="sync-dot"></div><span>Salvando...</span>';
    indicator.className = 'sync-indicator saving';
  } else if (status === 'synced') {
    indicator.innerHTML = '<div class="sync-dot"></div><span>Sincronizado</span>';
    indicator.className = 'sync-indicator synced';
    setTimeout(() => { 
      if (indicator.classList.contains('synced')) indicator.style.opacity = '0.3'; 
    }, 3000);
  } else if (status === 'error') {
    const msg = code === 'PERMISSION_DENIED' ? 'Acesso Negado (Firebase)' : 
                code === 'DISCONNECTED' ? 'Sem Conexão' : 'Erro na Nuvem';
    
    indicator.innerHTML = `<div class="sync-dot"></div><span>${msg}</span> 
                           <button class="sync-retry-btn" onclick="persistDB(true); event.stopPropagation();">🔄 Tentar Agora</button>`;
    indicator.className = 'sync-indicator error';
    indicator.title = `Código do Erro: ${code}`;
    indicator.style.cursor = 'pointer';
    indicator.onclick = () => persistDB(true);
  }
});







