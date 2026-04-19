// ==================== DASHBOARD MODULE ====================

function renderDashboard() {
  if (typeof DB === 'undefined' || !DB) {
    console.warn('[Dashboard] DB global não encontrado.');
    return;
  }
  try {
    const kpiGrid = document.getElementById('kpi-grid');

    const obrasAtivas = (DB.obras || []).filter(o => o && ['Em andamento', 'Planejada'].includes(o.status)).length;
    const tarefasAtrasadas = (DB.tarefas || []).filter(t => t && t.status === 'Atrasada').length;
    const estoquesBaixos = (DB.estoque || []).filter(e => e && ['BAIXO', 'CRÍTICO'].includes(window.estoqueStatus(e))).length;
    const comprasAguardando = (DB.compras || []).filter(c => c && c.status === 'Aguardando').length;
    const totalPrev = (DB.financeiro || []).reduce((a, f) => a + (f?.prev || 0), 0);

    // Unificação Rápida Financeira Global do Dashboard (Apenas Pendentes subtraindo Parcial)
    let globalFinance = [];
    (DB.financeiro || []).forEach(f => {
      if (f && f.status !== 'Pago') {
        globalFinance.push({
          obra: f.obra,
          data: f.data,
          v: Math.max(0, (parseFloat(f.real) || parseFloat(f.prev) || 0) - (f.status === 'Parcial' ? (parseFloat(f.valpago) || 0) : 0))
        });
      }
    });
    (DB.presenca || []).forEach(p => {
      if (p && p.pgtoStatus !== 'Pago') {
        globalFinance.push({
          obra: p.obra,
          data: p.data,
          v: Math.max(0, (parseFloat(p.total) || 0) - (p.pgtoStatus === 'Parcial' ? (parseFloat(p.valpago) || 0) : 0))
        });
      }
    });
    (DB.medicao || []).forEach(m => {
      if (m && m.pgtoStatus !== 'Pago') {
        globalFinance.push({
          obra: m.obra,
          data: m.semana,
          v: Math.max(0, (parseFloat(m.vtotal) || 0) - (m.pgtoStatus === 'Parcial' ? (parseFloat(m.valpago) || 0) : 0))
        });
      }
    });

    const totalRealGlobal = globalFinance.reduce((a, f) => a + (f?.v || 0), 0);
    const pctCusto = totalPrev > 0 ? ((totalRealGlobal / totalPrev) * 100).toFixed(1) : 0;

    const hoje = DB.presenca.filter(p => p.data === today);
    const presPresente = hoje.filter(p => p.presenca === 'Presente').length;
    const presTotal = hoje.length;

    const todayDate = new Date();
    const fSemana = new Date(todayDate);
    const dayOfWeek = todayDate.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    fSemana.setDate(todayDate.getDate() - diff);
    const strSemana = fSemana.toISOString().split('T')[0];
    const fMes = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    const strMes = fMes.toISOString().split('T')[0];

    const cDiariasSemana = DB.presenca
      .filter(p => p.data >= strSemana && p.data <= today && p.pgtoStatus !== 'Pago')
      .reduce((a, p) => a + Math.max(0, (parseFloat(p.total) || 0) - (p.pgtoStatus === 'Parcial' ? (parseFloat(p.valpago) || 0) : 0)), 0);

    const cEmpreitaSemana = DB.medicao
      .filter(m => m.semana >= strSemana && m.semana <= today && m.pgtoStatus !== 'Pago')
      .reduce((a, m) => a + Math.max(0, (parseFloat(m.vtotal) || 0) - (m.pgtoStatus === 'Parcial' ? (parseFloat(m.valpago) || 0) : 0)), 0);

    if (kpiGrid) {
      safeSetInner(kpiGrid, `
        <div class="kpi-card"><div class="kpi-label">Obras Ativas</div><div class="kpi-val yellow">${obrasAtivas}</div><div class="kpi-sub">de ${(DB.obras || []).length} cadastradas</div></div>
        <div class="kpi-card"><div class="kpi-label">Diárias (Semana)</div><div class="kpi-val blue">${fmt(cDiariasSemana)}</div><div class="kpi-sub">Custo de Folha na contabilidade</div></div>
        <div class="kpi-card"><div class="kpi-label">Empreitas (Semana)</div><div class="kpi-val blue" style="font-size:20px">${fmt(cEmpreitaSemana)}</div><div class="kpi-sub">Custo de Medições na contabilidade</div></div>
        <div class="kpi-card"><div class="kpi-label">Custo Real / Prev.</div><div class="kpi-val ${pctCusto > 100 ? 'red' : 'green'}">${pctCusto}%</div><div class="kpi-sub">${fmt(totalRealGlobal)} de ${fmt(totalPrev)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Tarefas Atrasadas</div><div class="kpi-val ${tarefasAtrasadas > 0 ? 'red' : 'green'}">${tarefasAtrasadas}</div><div class="kpi-sub">requer atenção imediata</div></div>
        <div class="kpi-card"><div class="kpi-label">Estoque Baixo/Crítico</div><div class="kpi-val ${estoquesBaixos > 0 ? 'orange' : 'green'}">${estoquesBaixos}</div><div class="kpi-sub">itens abaixo do mínimo</div></div>
      `);
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

    const pDiarias = DB.presenca.filter(p => p.total > 0 && ['Pendente', 'Parcial', 'Atrasado'].includes(p.pgtoStatus || 'Pendente'));
    if (pDiarias.length > 0) {
      const totalD = pDiarias.reduce((a, p) => a + Math.max(0, (parseFloat(p.total) || 0) - (p.pgtoStatus === 'Parcial' ? (parseFloat(p.valpago) || 0) : 0)), 0);
      const temAtrasadoD = pDiarias.some(p => p.pgtoStatus === 'Atrasado');
      alerts.push({
        tipo: 'DIÁRIAS PENDENTES',
        obra: `${pDiarias.length} diária(s) em aberto`,
        desc: `Falta pagar: ${fmt(totalD)} — Clique para abrir o caixa`,
        resp: 'Financeiro',
        prior: temAtrasadoD ? 'alto' : 'medio',
        action: "showPage('financeiro')"
      });
    }

    const pMedicao = DB.medicao.filter(m => m.vtotal > 0 && ['Pendente', 'Parcial', 'Atrasado'].includes(m.pgtoStatus || 'Pendente'));
    if (pMedicao.length > 0) {
      const medPorEquipe = {};
      pMedicao.forEach(m => {
        const eq = m.equipe || 'Equipe Terceira';
        if (!medPorEquipe[eq]) medPorEquipe[eq] = { count: 0, total: 0, atrasado: false };
        medPorEquipe[eq].count++;
        medPorEquipe[eq].total += Math.max(0, (parseFloat(m.vtotal) || 0) - (m.pgtoStatus === 'Parcial' ? (parseFloat(m.valpago) || 0) : 0));
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

    const pFin = DB.financeiro.filter(f => {
      const val = f.real > 0 ? f.real : f.prev;
      return val > 0 && ['Pendente', 'Parcial', 'Atrasado'].includes(f.status || 'Pendente');
    });
    if (pFin.length > 0) {
      const totalF = pFin.reduce((a, f) => a + Math.max(0, (f.real > 0 ? f.real : f.prev) - (f.status === 'Parcial' ? (parseFloat(f.valpago) || 0) : 0)), 0);
      const temAtrasadoF = pFin.some(f => f.status === 'Atrasado');
      alerts.push({
        tipo: 'PAGAMENTOS FINANCEIRO',
        obra: `${pFin.length} lançamento(s) pendente(s)`,
        desc: `Falta pagar: ${fmt(totalF)} — Clique para gerir`,
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

    const alertsGrid = document.getElementById('alerts-grid');
    if (alertsGrid) {
      alertsGrid.innerHTML = alerts.length
        ? alerts.map(a => `<div class="alert-card ${a.prior}" ${a.action ? `onclick="${sanitizeHTML(a.action)}" style="cursor:pointer"` : ''}>
            <div class="alert-body">
              <h4>${sanitizeHTML(a.tipo)}</h4>
              <p><b>${sanitizeHTML(a.obra)}</b> — ${sanitizeHTML(a.desc)}</p>
              <p style="margin-top:4px">Resp: ${sanitizeHTML(a.resp)}${a.action ? ' &nbsp;<span style="color:var(--accent);font-weight:600">→ Abrir e pagar</span>' : ''}</p>
            </div>
          </div>`).join('')
        : '<div style="color:var(--text3);font-size:13px;padding:8px">Nenhum alerta no momento.</div>';
    }

    safeSetInner('dash-obras-tbody', DB.obras.map(o => {
      const tarefas = DB.tarefas.filter(t => t.obra === o.cod);
      const tabObj = globalFinance.filter(f => f.obra === o.cod);
      const realizado = tabObj.reduce((a, f) => a + f.v, 0);
      const cSemanal = tabObj.filter(f => f.data >= strSemana && f.data <= today).reduce((a, f) => a + f.v, 0);
      const cMensal = tabObj.filter(f => f.data >= strMes && f.data <= today).reduce((a, f) => a + f.v, 0);

      const dSemanal = DB.presenca
        .filter(p => p.obra === o.cod && p.data >= strSemana && p.data <= today && p.pgtoStatus !== 'Pago')
        .reduce((a, p) => a + Math.max(0, (parseFloat(p.total) || 0) - (p.pgtoStatus === 'Parcial' ? (parseFloat(p.valpago) || 0) : 0)), 0);

      const pct = o.orc > 0 ? (realizado / o.orc * 100).toFixed(1) : 0;

      return `<tr>
        <td><span class="cod">${sanitizeHTML(o.cod)}</span> ${sanitizeHTML(o.nome)}</td>
        <td>${statusBadge(o.status)}</td>
        <td>${sanitizeHTML(o.mestre)}</td>
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
  }
}

window.renderDashboard = renderDashboard;

window.toggleGroup = function (cls, iconId) {
  const isHidden = document.querySelector('.' + cls)?.style.display === 'none';
  document.querySelectorAll('.' + cls).forEach(el => {
    el.style.display = isHidden ? '' : 'none';
  });
  const icon = document.getElementById(iconId);
  if (icon) icon.textContent = isHidden ? '▼' : '▶';
};
