// ==================== HELPERS ====================
let currentEditIdx = -1; // Global variable to identify if we are creating new (-1) or editing an existing record.


// ==================== SYSTEM GLOBALS (ANTI-REFERENCE ERROR) ====================
// Cria 'stubs' para evitar que saves de uma página "crachem" tentando dar reload em UI de outra página
window.renderDashboard = window.renderDashboard || function () {
  // Os números vêm prontos de calcDashboardResumo (utils.module.js); aqui só desenhamos.
  let role = 'admin';
  try { role = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}').role || 'admin'; } catch (e) { }
  // Sessões antigas podem ainda carregar o alias `mestre`.
  if (role === 'mestre') role = 'encarregado';

  const { kpis, linhas, alertas, tarefas: resumoTarefas } = window.calcDashboardResumo(DB, null, role);
  const esc = window.escHtml;

  // Ações rápidas, respeitando o que cada papel acessa (encarregado não vê compras; engenheiro não vê presença)
  const actionsEl = document.getElementById('dash-actions');
  if (actionsEl) {
    const acoes = [];
    if (role !== 'engenheiro') acoes.push(['modal-presenca', '+ Lançar Presença']);
    acoes.push(['modal-tarefa', '+ Nova Tarefa']);
    if (role !== 'encarregado' && role !== 'mestre') acoes.push(['modal-compra', '+ Nova Compra']);
    actionsEl.innerHTML = acoes
      .map(([modal, label]) => `<button class="btn btn-primary btn-sm" onclick="openModal('${modal}')">${label}</button>`)
      .join('');
  }

  // KPIs
  const kpiGrid = document.getElementById('kpi-grid');
  if (kpiGrid) {
    kpiGrid.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Presentes</div><div class="kpi-val green">${kpis.presentes}</div></div>
      <div class="kpi-card"><div class="kpi-label">Faltas</div><div class="kpi-val ${kpis.faltas > 0 ? 'red' : 'green'}">${kpis.faltas}</div></div>
      <div class="kpi-card"><div class="kpi-label">Obras Ativas</div><div class="kpi-val yellow">${kpis.obrasAtivas}</div></div>
      <div class="kpi-card"><div class="kpi-label">Diárias Hoje</div><div class="kpi-val blue">${fmt(kpis.diariasHoje)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Tarefas Abertas</div><div class="kpi-val blue">${resumoTarefas.abertas}</div></div>
      <div class="kpi-card"><div class="kpi-label">Tarefas Atrasadas</div><div class="kpi-val ${resumoTarefas.atrasadas > 0 ? 'red' : 'green'}">${resumoTarefas.atrasadas}</div></div>
    `;
  }

  // Alertas (do mais grave ao menos grave; os demais viram "+ N alertas").
  // Tarefas têm slots reservados: custo/compra não podem empurrá-las para fora.
  const MAX_ALERTAS = 8;
  const alertsGrid = document.getElementById('alerts-grid');
  if (alertsGrid) {
    const alertasTarefa = alertas.filter(a => a.tipo.startsWith('TAREFA'));
    const demais = alertas.filter(a => !a.tipo.startsWith('TAREFA'));
    const visiveis = [...alertasTarefa, ...demais].slice(0, MAX_ALERTAS);
    alertsGrid.innerHTML = visiveis.length
      ? visiveis.map(a => `<div class="alert-card ${a.prior}"><div class="alert-body"><h4>${a.tipo}</h4><p><b>${esc(a.obra)}</b> — ${esc(a.desc)}</p></div></div>`).join('')
      + (alertas.length > visiveis.length ? `<div style="color:var(--text3);font-size:12px;padding:8px">+ ${alertas.length - visiveis.length} alertas</div>` : '')
      : '<div style="color:var(--text3);font-size:13px;padding:8px">Nenhuma pendência hoje.</div>';
  }

  // Painel de tarefas do dia/atrasadas — antes só existiam os alertas, que
  // competiam por espaço e faziam as tarefas "desaparecerem" do dashboard.
  const tarefasPanel = document.getElementById('dash-tarefas-grid');
  if (tarefasPanel) {
    const itens = resumoTarefas.itens.slice(0, 5);
    tarefasPanel.innerHTML = itens.length
      ? itens.map(t => `
        <div class="dash-tarefa-item ${t.atrasada ? 'atrasada' : 'hoje'}">
          <div class="dash-tarefa-info">
            <b>${esc(t.desc)}</b>
            <small>${esc(t.obraNome)} · ${esc(t.resp || 'Sem responsável')} · ${fmtDate(t.prazo)}${t.atrasada ? ' · Atrasada' : ' · Vence hoje'}</small>
          </div>
          <button class="btn btn-primary btn-sm" onclick="concluirTarefaRapida(${t._idx})" title="Concluir tarefa">Concluir</button>
        </div>`).join('')
        + (resumoTarefas.itens.length > 5 ? `<div style="color:var(--text3);font-size:12px;padding:8px">+ ${resumoTarefas.itens.length - 5} tarefa(s)</div>` : '')
      : '<div style="color:var(--text3);font-size:13px;padding:8px">Nenhuma tarefa atrasada ou com prazo para hoje.</div>';
  }

  // Resumo por Obra (concluídas ficam recolhidas, a menos que o usuário peça)
  const mostrarConcluidas = !!(document.getElementById('dash-show-done') || {}).checked;
  const concluidas = linhas.filter(l => l.obra.status === 'Concluída').length;
  const doneCount = document.getElementById('dash-done-count');
  if (doneCount) doneCount.textContent = concluidas ? `(${concluidas})` : '';

  const dashObrasTbody = document.getElementById('dash-obras-tbody');
  if (dashObrasTbody) {
    const visiveis = linhas.filter(l => mostrarConcluidas || l.obra.status !== 'Concluída');
    dashObrasTbody.innerHTML = visiveis.map(l => {
      const o = l.obra;
      const idx = (DB.obras || []).indexOf(o);
      const pct = l.pctCusto;
      const pctCell = pct === null
        ? '<span style="color:var(--text3)" title="Defina o orçamento da obra para acompanhar este indicador">—</span>'
        : `<span style="color:${pct > 100 ? 'var(--red)' : pct >= 80 ? 'var(--orange)' : 'var(--green)'}">${pct.toFixed(1)}%</span>`;
      const mestreCell = o.mestre
        ? esc(o.mestre)
        : (role !== 'encarregado' && role !== 'mestre' && idx >= 0 ? `<button class="btn btn-secondary btn-sm" onclick="editObra(${idx})">Atribuir</button>` : '-');
      const pctTarefas = l.tarefasTotal ? Math.round((l.tarefasFeitas / l.tarefasTotal) * 100) : 0;
      const codSeguro = String(o.cod || '').replace(/'/g, "\\'");
      const tarefasCell = l.tarefasTotal
        ? `<button type="button" class="link-btn" onclick="verTarefasDaObra('${codSeguro}')" title="Ver tarefas desta obra">${l.tarefasFeitas}/${l.tarefasTotal} <div class="progress-bar" style="width:60px;margin-left:6px"><div class="progress-fill" style="width:${pctTarefas}%"></div></div></button>`
        : '<span style="color:var(--text3)">—</span>';

      return `<tr>
        <td data-label="Obra"><b>${esc(o.nome)}</b></td>
        <td data-label="Status">${statusBadge(o.status)}</td>
        <td data-label="Mestre">${mestreCell}</td>
        <td data-label="Orç. Prev.">${Number(o.orc) > 0 ? fmt(o.orc) : '<span style="color:var(--text3)" title="Orçamento não definido">—</span>'}</td>
        <td data-label="Diárias (Sem.)" style="color:var(--blue)">${l.diariasSem}</td>
        <td data-label="Custo Sem.">${fmt(l.custoSem)}</td>
        <td data-label="Custo Mês">${fmt(l.custoMes)}</td>
        <td data-label="Total Real."><b>${fmt(l.totalReal)}</b></td>
        <td data-label="% Custo">${pctCell}</td>
        <td data-label="Tarefas">${tarefasCell}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--text3)">Nenhuma obra em andamento</td></tr>';
  }

  // Update timestamp
  const dashUpdated = document.getElementById('dash-updated');
  if (dashUpdated) {
    dashUpdated.textContent = 'Atualizado: ' + new Date().toLocaleTimeString('pt-BR');
  }
};
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

// Data atual no fuso horário brasileiro (America/Sao_Paulo)
function getTodayBR() {
  const now = new Date();
  const tz = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return tz.getFullYear() + '-' + String(tz.getMonth() + 1).padStart(2, '0') + '-' + String(tz.getDate()).padStart(2, '0');
}

const today = getTodayBR();





// (Removido do topo para evitar conflito de redeclare)



// ==================== PAGE NAVIGATION (DYNAMIC FETCH) ====================
const cachePaginas = {};
const MAX_CACHE_SIZE = 10;

// Use a mesma versão dos scripts base para renovar o cache do HTML
const HTML_CACHE_VERSION = '20261122006';

function clearPageCache() {
  const keys = Object.keys(cachePaginas);
  if (keys.length > MAX_CACHE_SIZE) {
    keys.slice(0, keys.length - MAX_CACHE_SIZE).forEach(k => delete cachePaginas[k]);
  }
}

async function carregarHTML(caminho) {
  clearPageCache();
  const cacheKey = `${caminho}?v=${HTML_CACHE_VERSION}`;
  if (cachePaginas[cacheKey]) return cachePaginas[cacheKey];
  try {
    const urlComVersionamento = `${caminho}?v=${HTML_CACHE_VERSION}`;
    const res = await fetch(urlComVersionamento);
    if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
    const html = await res.text();
    cachePaginas[cacheKey] = html;
    return html;
  } catch (err) {
    console.error('Falha ao buscar:', caminho, err);
    return `<div style="padding: 20px; color: var(--red)">Erro ao carregar o componente: ${caminho}</div>`;
  }
}

// ==================== FEATURE GATES (CADEADO + UPGRADE) ====================
// Qualquer elemento com data-feature="nome" passa a exibir cadeado quando o
// plano atual não tem a capacidade. O clique é interceptado em fase de captura para
// que onclick legados não executem a ação bloqueada (fase de captura).
function applyFeatureGates(root) {
  const escopo = root || document;
  if (!escopo || typeof escopo.querySelectorAll !== 'function') return;

  escopo.querySelectorAll('[data-feature]').forEach(el => {
    const nome = el.getAttribute('data-feature');
    const liberado = typeof window.hasFeature === 'function' && window.hasFeature(nome);

    el.classList.toggle('feature-locked', !liberado);
    if (liberado) {
      el.removeAttribute('data-feature-locked');
      el.removeAttribute('aria-disabled');
      return;
    }

    const info = typeof window.featureInfo === 'function' ? window.featureInfo(nome) : null;
    const rotulo = (info && info.nome) || nome;
    const plano = (info && info.plano) || 'superior';
    el.setAttribute('data-feature-locked', '1');
    el.setAttribute('aria-disabled', 'true');
    el.setAttribute('title', `${rotulo} — disponível no plano ${plano}.`);
  });
}
window.applyFeatureGates = applyFeatureGates;

document.addEventListener('click', (e) => {
  const alvo = e.target && e.target.closest ? e.target.closest('[data-feature-locked="1"]') : null;
  if (!alvo) return;
  e.preventDefault();
  e.stopPropagation();
  const nome = alvo.getAttribute('data-feature');
  if (typeof window.showUpgradeModal === 'function') window.showUpgradeModal(nome);
}, true);

window.showUpgradeModal = async function showUpgradeModal(nome) {
  window._upgradeFeature = nome;
  await openModal('modal-upgrade');
};

function populateUpgradeModal(container) {
  const nome = window._upgradeFeature;
  const info = typeof window.featureInfo === 'function' ? window.featureInfo(nome) : null;
  const rotulo = (info && info.nome) || nome || 'Este recurso';
  const plano = (info && info.plano) || 'superior';
  const descricao = (info && info.descricao) || 'Faça upgrade para liberar este módulo.';

  const titulo = container.querySelector('#upgrade-feature-name');
  if (titulo) titulo.textContent = rotulo;
  const desc = container.querySelector('#upgrade-feature-description');
  if (desc) desc.textContent = descricao;
  const req = container.querySelector('#upgrade-required-plan');
  if (req) req.textContent = plano;
}

const NAV_GROUPS = { 'grp-op': 'ic-op', 'grp-prod': 'ic-prod', 'grp-sup': 'ic-sup', 'grp-fin': 'ic-fin' };
const NAV_GROUP_STORAGE_KEY = 'obra_real_nav_groups';

function readNavGroupState() {
  try { return JSON.parse(localStorage.getItem(NAV_GROUP_STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function setNavGroupState(cls, open, persist) {
  document.querySelectorAll('.' + cls).forEach(item => {
    if (item.dataset.hiddenByRole === '1') return;
    item.style.display = open ? 'block' : 'none';
  });
  const icon = document.getElementById(NAV_GROUPS[cls]);
  if (icon) icon.textContent = open ? 'expand_more' : 'chevron_right';
  if (persist) {
    const state = readNavGroupState();
    state[cls] = !!open;
    try { localStorage.setItem(NAV_GROUP_STORAGE_KEY, JSON.stringify(state)); } catch (e) { }
  }
}

window.toggleGroup = function (cls, icn) {
  const items = document.querySelectorAll('.' + cls);
  const sample = Array.from(items).find(item => item.dataset.hiddenByRole !== '1');
  const isOpen = sample ? sample.style.display !== 'none' : false;
  const nextOpen = !isOpen;

  if (NAV_GROUPS[cls]) {
    setNavGroupState(cls, nextOpen, true);
    return;
  }

  items.forEach(item => { item.style.display = nextOpen ? 'block' : 'none'; });
  const icon = document.getElementById(icn);
  if (icon) icon.textContent = nextOpen ? 'expand_more' : 'chevron_right';
};

document.addEventListener('DOMContentLoaded', () => {
  applyFeatureGates(document);
  const state = readNavGroupState();
  Object.keys(NAV_GROUPS).forEach(cls => {
    const icon = document.getElementById(NAV_GROUPS[cls]);
    if (state[cls]) {
      setNavGroupState(cls, true, false);
    } else if (icon) {
      icon.textContent = 'chevron_right';
    }
  });
});

window.showPage = async function (id) {
  // Atualiza o menu lateral (Estilos)
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => { if (n.getAttribute('onclick')?.includes(id)) n.classList.add('active'); });
  document.querySelector('.sidebar').classList.remove('open');

  // Adiciona um loading simples enquanto busca
  const mainEl = document.getElementById("conteudo-principal");
  if (!mainEl) return;

  // O banner de cobrança vive dentro de #conteudo-principal. Preserve-o entre
  // navegações, senão a primeira troca de página apaga o aviso de bloqueio/leitura.
  const bannerNode = mainEl.querySelector('#billing-banner-container');
  const bannerHtml = bannerNode ? bannerNode.outerHTML : '';

  mainEl.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text3)">Carregando tela...</div>';

  // Busca e injeta o HTML da pasta pages/
  const html = await carregarHTML(`pages/${id}.html`);
  mainEl.innerHTML = `${bannerHtml}<div class="page active" id="page-${id}">${html}</div>`;

  // Reaplica o estado atual ao banner recém-restaurado.
  if (typeof renderBillingEnforcement === 'function' && window.__lastBillingData) {
    renderBillingEnforcement(window.__lastBillingData);
  }

  // Chama a lógica de renderização e reaplica cadeados no HTML recém-injetado
  renderPage(id);
  applyFeatureGates(document);
}

function renderPage(id) {
  const r = {
    dashboard: renderDashboard, hoje: renderHoje, obras: renderObras, trabalhadores: renderTrabalhadores,
    presenca: renderPresenca, tarefas: renderTarefas, estoque: renderEstoque,
    movEstoque: renderMovEstoque,
    compras: () => {
      if (typeof window.iniciarCompras === 'function') window.iniciarCompras();
      renderCompras();
    },
    financeiro: renderFinanceiro,
    orcamento: renderOrcamento, medicao: renderMedicao, admin: renderAdmin,
    fotos: renderFotos, super_admin: renderSuperAdmin, relatorios: renderRelatorios,
    almocos: renderAlmocos,
    aprovacoes: (...args) => {
      if (typeof window.iniciarAprovacoes === 'function') window.iniciarAprovacoes();
      if (typeof window.renderAprovacoes === 'function') window.renderAprovacoes(...args);
    }
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
    <button class="btn-pay" onclick="openWhatsApp('Olá, quero assinar o plano Pro do Obra Real!')">Assinar Pro <span class="material-symbols-outlined md-16" style="vertical-align:middle;margin-right:4px;">arrow_forward</span></button>
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
    applyFeatureGates(document);
  }
});


// ==================== HOJE ====================
function renderHoje(targetDate) {
  const picker = document.getElementById('hoje-date-picker');
  const hoje = targetDate || (picker ? picker.value : '') || getTodayBR();

  // Atualiza o input de data para manter sincronia
  if (picker) {
    picker.value = hoje;
    picker.max = getTodayBR(); // Não permite datas futuras
  }

  const dataEl = document.getElementById('hoje-data');
  if (dataEl) dataEl.textContent = ` — ${fmtDate(hoje)}`;

  const custosDiariasHoje = window.calcCustosDiarias(DB.presenca, { dataInicio: hoje, dataFim: hoje });
  // Fonte única de custos/pendências da semana (diárias + medições + manuais + almoços)
  const resumoSemana = window.summarizeFinanceCosts
    ? window.summarizeFinanceCosts(DB.financeiro, DB.presenca, DB.medicao, DB.almocos, { tipo: 'semana', baseDate: hoje })
    : { all: [] };
  const pendentesSemana = (resumoSemana.all || []).filter(e => e.status !== 'Pago' && e.pendente > 0);

  // Busca TODOS os registros de presença do dia, independente de ter valor diária configurado
  const allPresencaHoje = (DB.presenca || []).filter(p => p.data === hoje);
  const presencaHoje = custosDiariasHoje.porObra ? Object.values(custosDiariasHoje.porObra).flat() : [];
  const obras = DB.obras || [];

  // Conta presentes e faltas de TODOS os registros (incluindo sem valor diária)
  const presentes = allPresencaHoje.filter(p => p.presenca === 'Presente').length;
  const faltas = allPresencaHoje.filter(p => p.presenca === 'Falta').length;

  const tarefasPendentes = (DB.tarefas || []).filter(t => t && t.status !== 'Concluída');
  const tarefasAtrasadas = tarefasPendentes.filter(t => t.prazo && t.prazo < getTodayBR());
  const tarefasHoje = tarefasPendentes.filter(t => t.prazo === hoje);

  const kpiGrid = document.getElementById('kpi-grid');
  if (kpiGrid) {
    kpiGrid.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Presentes</div><div class="kpi-val green">${presentes}</div></div>
      <div class="kpi-card"><div class="kpi-label">Faltas</div><div class="kpi-val ${faltas > 0 ? 'red' : 'green'}">${faltas}</div></div>
      <div class="kpi-card"><div class="kpi-label">Obras Ativas</div><div class="kpi-val yellow">${obras.filter(o => o.status === 'Em andamento').length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Diárias Hoje</div><div class="kpi-val blue">${fmt(custosDiariasHoje.custoTotal)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Tarefas Hoje</div><div class="kpi-val blue">${tarefasHoje.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Tarefas Atrasadas</div><div class="kpi-val ${tarefasAtrasadas.length > 0 ? 'red' : 'green'}">${tarefasAtrasadas.length}</div></div>
    `;
  }

  const alerts = [];
  if (tarefasAtrasadas.length) {
    const exemplos = tarefasAtrasadas.slice(0, 2).map(t => t.desc).join(', ');
    alerts.push({
      tipo: 'TAREFA ATRASADA',
      obra: 'Geral',
      desc: `${tarefasAtrasadas.length} tarefa(s) atrasada(s)${exemplos ? ': ' + exemplos : ''}`,
      prior: 'alto'
    });
  }
  tarefasHoje.forEach(t => {
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
    // Mostra TODOS os trabalhadores presentes no dia, independente de ter pagamento pendente
    let rows = '';
    obras.forEach(o => {
      // Busca TODOS os registros de presença do dia para esta obra
      const pObra = allPresencaHoje.filter(p => p.obra === o.cod);
      const pres = pObra.filter(p => p.presenca === 'Presente').length;
      const fal = pObra.filter(p => p.presenca === 'Falta').length;

      rows += `<tr>
        <td data-label="Obra"><b>${o.nome}</b></td>
        <td data-label="Presentes" style="color:var(--green)">${pres}</td>
        <td data-label="Faltas" style="color:${fal > 0 ? 'var(--red)' : 'var(--text3)'}">${fal}</td>
        <td data-label="Total">${pres + fal}</td>
      </tr>`;
    });
    obrasTbody.innerHTML = rows;
  }

  // Medições Pendentes - busca TODAS as medições pendentes (sem filtro de data)
  const medicoesTbody = document.getElementById('hoje-medicoes-tbody');
  if (medicoesTbody) {
    const todasMedicoes = (DB.medicao || []).filter(m => m.pgtoStatus !== 'Pago' && m.pgtoStatus !== 'Quitado');
    const medicoes = [];
    todasMedicoes.forEach(m => {
      const total = parseFloat(m.vtotal) || 0;
      const pago = m.pgtoStatus === 'Parcial' ? (parseFloat(m.valpago) || 0) : 0;
      medicoes.push({ tipo: 'Medição', desc: m.servico, obra: m.obra, valor: Math.max(0, total - pago), status: m.pgtoStatus || 'Pendente' });
    });
    medicoesTbody.innerHTML = medicoes.length
      ? medicoes.map(m => `<tr>
          <td data-label="Tipo">${m.tipo}</td>
          <td data-label="Descrição">${m.desc}</td>
          <td data-label="Obra">${window.obName(m.obra)}</td>
          <td data-label="Valor"><b>${fmt(m.valor)}</b></td>
          <td data-label="Status">${m.status}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3)">Nenhuma medição pendente</td></tr>';
  }

  const pendentesTbody = document.getElementById('hoje-pendentes-tbody');

  // Nova tabela: Presença por Funcionário (TODOS os registros do dia)
  const funcionariosTbody = document.getElementById('hoje-funcionarios-tbody');
  if (funcionariosTbody) {
    // Mostra TODOS os trabalhadores com registro de presença hoje
    let rows = '';
    allPresencaHoje.forEach(p => {
      const worker = (DB.trabalhadores || []).find(t => t.cod === p.trab);
      const funcao = worker ? (worker.funcao || '-') : (p.funcao || '-');
      const obra = (DB.obras || []).find(o => o.cod === p.obra);
      const obraNome = obra ? obra.nome : (p.obra || '-');
      const statusClass = p.presenca === 'Presente' ? 'var(--green)' :
        p.presenca === 'Falta' ? 'var(--red)' : 'var(--text3)';
      const horas = (parseFloat(p.hnorm) || 0) + (parseFloat(p.hextra) || 0);

      rows += `<tr>
        <td data-label="Funcionário"><b>${p.nome}</b></td>
        <td data-label="Função">${funcao}</td>
        <td data-label="Obra">${obraNome}</td>
        <td data-label="Status" style="color:${statusClass}">${p.presenca}</td>
        <td data-label="Horas">${horas.toFixed(1)}h</td>
      </tr>`;
    });
    funcionariosTbody.innerHTML = rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">Nenhum registro de presença hoje.</td></tr>';
  }

  if (pendentesTbody) {
    const pendentes = pendentesSemana.map(e => ({
      tipo: e.tipo || 'Lançamento',
      desc: e.desc || '—',
      obra: e.obra,
      valor: e.pendente,
      status: e.status
    }));

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

  // Nova tabela: Aditivos e Descontos
  const aditivosTbody = document.getElementById('hoje-aditivos-tbody');
  if (aditivosTbody) {
    const items = (DB.financeiro || []).filter(f =>
      ['Aditivo', 'Desconto', 'Adiantamento', 'Ajuste'].includes(f.tipo) &&
      f.status !== 'Pago' && f.status !== 'Quitado'
    );

    aditivosTbody.innerHTML = items.length
      ? items.map(f => {
        const isDesconto = (f.tipo || '').toLowerCase().includes('desconto');
        const valor = parseFloat(isDesconto ? -Math.abs(f.real || f.prev) : (f.real || f.prev)) || 0;
        return `<tr>
            <td data-label="Tipo">${f.tipo}</td>
            <td data-label="Descrição">${f.desc}</td>
            <td data-label="Beneficiário">${f.forn || '-'}</td>
            <td data-label="Valor" style="color:${valor < 0 ? 'var(--red)' : 'var(--green)'}"><b>${fmt(valor)}</b></td>
            <td data-label="Status">${statusBadge(f.status)}</td>
          </tr>`;
      }).join('')
      : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3)">Nenhum aditivo ou desconto pendente</td></tr>';
  }
}

// ==================== HOJE DATE HELPERS ====================
function changeHojeDate(offset) {
  const picker = document.getElementById('hoje-date-picker');
  if (!picker) return;
  const current = picker.value ? new Date(picker.value + 'T00:00:00') : new Date();
  current.setDate(current.getDate() + offset);
  const y = current.getFullYear();
  const m = String(current.getMonth() + 1).padStart(2, '0');
  const d = String(current.getDate()).padStart(2, '0');
  const newDate = y + '-' + m + '-' + d;
  picker.value = newDate;
  renderHoje(newDate);
}

function setHojeToday() {
  const picker = document.getElementById('hoje-date-picker');
  if (!picker) return;
  const today = getTodayBR();
  picker.value = today;
  renderHoje(today);
}

window.exportHoje = function exportHoje() {
  if (typeof window.requireFeature === 'function' && !window.requireFeature('exportacao')) return;
  // Create a print-friendly version with ONLY data (no selectors/buttons)
  const hojeData = document.getElementById('hoje-data')?.textContent || '';
  const kpiGrid = document.getElementById('kpi-grid')?.innerHTML || '';
  const alertsGrid = document.getElementById('alerts-grid')?.innerHTML || '';

  // Custos do dia com valores históricos gravados
  const hoje = getTodayBR();
  const custosDiariasHoje = window.calcCustosDiarias(DB.presenca, { dataInicio: hoje, dataFim: hoje });
  const resumoGeral = window.buildFinanceEntries
    ? window.buildFinanceEntries(DB.financeiro, DB.presenca, DB.medicao, DB.almocos, {})
    : { all: [] };

  // Build "Presença por Obra" table with ALL present workers (even without daily rate)
  const allPresencaHoje = (DB.presenca || []).filter(p => p.data === hoje);
  const obras = DB.obras || [];
  let obrasTbody = '';
  obras.forEach(o => {
    const pObra = allPresencaHoje.filter(p => p.obra === o.cod);
    const pres = pObra.filter(p => p.presenca === 'Presente').length;
    const fal = pObra.filter(p => p.presenca === 'Falta').length;

    obrasTbody += `<tr>
       <td><b>${o.nome}</b></td>
       <td style="color:#22c55e">${pres}</td>
       <td style="color:${fal > 0 ? '#ef4444' : '#666'}">${fal}</td>
       <td>${pres + fal}</td>
     </tr>`;
  });

  // Build "Presença por Funcionário" table
  let funcionariosTbody = '';
  allPresencaHoje.forEach(p => {
    const worker = (DB.trabalhadores || []).find(t => t.cod === p.trab);
    const funcao = worker ? (worker.funcao || '-') : (p.funcao || '-');
    const obra = (DB.obras || []).find(o => o.cod === p.obra);
    const obraNome = obra ? obra.nome : (p.obra || '-');
    const statusClass = p.presenca === 'Presente' ? '#22c55e' :
      p.presenca === 'Falta' ? '#ef4444' : '#666';
    const horas = (parseFloat(p.hnorm) || 0) + (parseFloat(p.hextra) || 0);
    const valor = parseFloat(p.total) || 0;
    funcionariosTbody += `<tr>
       <td><b>${p.nome}</b></td>
       <td>${funcao}</td>
       <td>${obraNome}</td>
       <td style="color:${statusClass}">${p.presenca}</td>
       <td>${horas.toFixed(1)}h</td>
     </tr>`;
  });

  // Build pending measurements table for print - ALL PENDING, not just the week
  let medicoesPendentesTbody = '';
  const allMedicoesPendentes = (DB.medicao || []).filter(m => m.pgtoStatus !== 'Pago' && (parseFloat(m.vtotal) || 0) > 0);

  const medicoesPendentesList = allMedicoesPendentes.map(m => {
    const total = parseFloat(m.vtotal) || 0;
    const pago = m.pgtoStatus === 'Parcial' ? (parseFloat(m.valpago) || 0) : 0;
    return {
      tipo: 'Medição',
      desc: m.servico,
      obra: m.obra,
      valor: Math.max(0, total - pago),
      status: m.pgtoStatus
    };
  });

  medicoesPendentesTbody = medicoesPendentesList.length
    ? medicoesPendentesList.map(m => `<tr>
          <td data-label="Tipo">${m.tipo}</td>
          <td data-label="Descrição">${m.desc}</td>
          <td data-label="Obra">${window.obName(m.obra)}</td>
          <td data-label="Valor"><b>${fmt(m.valor)}</b></td>
          <td data-label="Status">${m.status}</td>
        </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3)">Nenhuma medição pendente</td></tr>';

  // Build pending payments table for print - ALL PENDING, todas as origens
  const pendentesGeral = (resumoGeral.all || []).filter(e => e.status !== 'Pago' && e.pendente > 0);
  let pendentesPrintTbody = pendentesGeral.length
    ? pendentesGeral.map(e => `<tr>
          <td data-label="Tipo">${e.tipo || 'Lançamento'}</td>
          <td data-label="Descrição">${e.desc || '—'}</td>
          <td data-label="Obra">${window.obName(e.obra)}</td>
          <td data-label="Valor"><b>${fmt(e.pendente)}</b></td>
          <td data-label="Status">${e.status}</td>
        </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3)">Nenhum pagamento pendente</td></tr>';

  // Nova seção no relatório: Aditivos, Descontos e Adiantamentos
  const aditivosPendentes = (DB.financeiro || []).filter(f =>
    ['Aditivo', 'Desconto', 'Adiantamento', 'Ajuste'].includes(f.tipo) &&
    f.status !== 'Pago' && f.status !== 'Quitado'
  );
  let aditivosPrintTbody = aditivosPendentes.length
    ? aditivosPendentes.map(f => {
      const isDesconto = (f.tipo || '').toLowerCase().includes('desconto');
      const valor = parseFloat(isDesconto ? -Math.abs(f.real || f.prev) : (f.real || f.prev)) || 0;
      return `<tr>
            <td data-label="Tipo">${f.tipo}</td>
            <td data-label="Descrição">${f.desc}</td>
            <td data-label="Beneficiário">${f.forn || '-'}</td>
            <td data-label="Valor"><b>${fmt(valor)}</b></td>
            <td data-label="Status">${f.status}</td>
          </tr>`;
    }).join('')
    : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3)">Nenhum aditivo ou desconto pendente</td></tr>';

  const printContent = '<html>' +
    '<head>' +
    '<title>Relatório do Dia - Obra Real</title>' +
    '<meta charset="utf-8">' +
    '<style>' +
    'body { font-family: Arial, sans-serif; margin: 10px; color: #333; font-size: 13px; }' +
    '.page-header { margin-bottom: 10px; border-bottom: 2px solid #333; padding-bottom: 8px; }' +
    '.page-title { font-size: 20px; font-weight: bold; margin: 0; }' +
    '.page-header div:last-child { font-size: 12px; color: #666; margin-top: 3px; }' +
    '.kpi-grid { display: flex; gap: 10px; margin: 10px 0; flex-wrap: wrap; }' +
    '.kpi-card { border: 1px solid #ddd; padding: 10px; min-width: 120px; flex: 1; }' +
    '.kpi-card:hover { background: var(--bg3) !important; }' +
    '.kpi-card-ativa { border: 2px solid var(--accent) !important; background: var(--accent) !important; color: #fff; }' +
    '.kpi-card-ativa .kpi-label, .kpi-card-ativa .kpi-val { color: #fff !important; }' +
    '.kpi-label { font-size: 11px; color: #666; text-transform: uppercase; }' +
    '.kpi-val { font-size: 20px; font-weight: bold; margin-top: 3px; }' +
    '.kpi-val.green { color: #22c55e; }' +
    '.kpi-val.red { color: #ef4444; }' +
    '.kpi-val.yellow { color: #eab308; }' +
    '.kpi-val.blue { color: #3b82f6; }' +
    '.section-title { margin-top: 10px; font-size: 16px; font-weight: bold; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px; }' +
    '.alerts-grid { margin: 10px 0; }' +
    '.alert-card { border: 1px solid #ddd; padding: 8px; margin-bottom: 5px; border-left: 3px solid #f59e0b; }' +
    '.alert-card.alto { border-left-color: #ef4444; }' +
    '.alert-card.medio { border-left-color: #f59e0b; }' +
    '.alert-body h4 { margin: 0 0 3px 0; font-size: 13px; }' +
    '.alert-body p { margin: 0; font-size: 12px; color: #666; }' +
    '.table-wrap { margin: 10px 0; }' +
    'table { width: 100%; border-collapse: collapse; }' +
    'th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }' +
    'th { background-color: #f5f5f5; font-weight: bold; font-size: 12px; }' +
    'td { font-size: 12px; }' +
    '@media print {' +
    'body { margin: 10px; }' +
    '.kpi-grid { page-break-inside: avoid; }' +
    'table { page-break-inside: avoid; }' +
    '* { margin: 0; padding: 0; }' +
    '}' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div class="page-header">' +
    '<div class="page-title">Relatório do Dia - Obra Real</div>' +
    '<div>' + hojeData + '</div>' +
    '</div>' +
    '<div class="kpi-grid">' + kpiGrid + '</div>' +
    '<div class="section-title"><span class="material-symbols-outlined md-18" style="vertical-align:middle;margin-right:4px;">warning</span> Pendências do Dia</div>' +
    '<div class="alerts-grid">' + alertsGrid + '</div>' +
    '<div class="section-title" style="margin-top:10px"><span class="material-symbols-outlined md-18" style="vertical-align:middle;margin-right:4px;">engineering</span> Presença por Obra</div>' +
    '<div class="table-wrap" style="margin-top:5px"><table>' +
    '<thead><tr><th>Obra</th><th>Presentes</th><th>Faltas</th><th>Total</th></tr></thead>' +
    '<tbody>' + obrasTbody + '</tbody>' +
    '</table></div>' +
    '<div class="section-title" style="margin-top:10px"><span class="material-symbols-outlined md-18" style="vertical-align:middle;margin-right:4px;">engineering</span> Presença por Funcionário</div>' +
    '<div class="table-wrap" style="margin-top:5px"><table>' +
    '<thead><tr><th>Funcionário</th><th>Função</th><th>Obra</th><th>Status</th><th>Horas</th></tr></thead>' +
    '<tbody>' + funcionariosTbody + '</tbody>' +
    '</table></div>' +
    '<div class="section-title" style="margin-top:10px"><span class="material-symbols-outlined md-18" style="vertical-align:middle;margin-right:4px;">straighten</span> Medições Pendentes</div>' +
    '<div class="table-wrap"><table>' +
    '<thead><tr><th>Tipo</th><th>Descrição</th><th>Obra</th><th>Valor Pendente</th><th>Status</th></tr></thead>' +
    '<tbody>' + medicoesPendentesTbody + '</tbody>' +
    '</table></div>' +
    '<div class="section-title" style="margin-top:10px"><span class="material-symbols-outlined md-18" style="vertical-align:middle;margin-right:4px;">balance</span> Aditivos, Descontos e Adiantamentos</div>' +
    '<div class="table-wrap"><table>' +
    '<thead><tr><th>Tipo</th><th>Descrição</th><th>Beneficiário</th><th>Valor</th><th>Status</th></tr></thead>' +
    '<tbody>' + aditivosPrintTbody + '</tbody>' +
    '</table></div>' +
    '<div class="section-title" style="margin-top:10px"><span class="material-symbols-outlined md-18" style="vertical-align:middle;margin-right:4px;">payments</span> Pagamentos Pendentes</div>' +
    '<div class="table-wrap"><table>' +
    '<thead><tr><th>Tipo</th><th>Descrição</th><th>Obra</th><th>Valor</th><th>Status</th></tr></thead>' +
    '<tbody>' + pendentesPrintTbody + '</tbody>' +
    '</table></div>' +
    '</body>' +
    '</html>';

  // Open print window
  const printWindow = window.open('', '_blank');
  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.focus();

  // Wait for content to load then print
  printWindow.onload = function () {
    printWindow.print();

    // Also offer to save as PDF
    setTimeout(() => {
      if (confirm('Deseja salvar como PDF para enviar pelo WhatsApp?')) {
        printWindow.print();
      }
    }, 1000);
  };
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
        
        <div style="display:flex;gap:4px;margin-top:auto;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" style="flex:1;min-width:110px" onclick="shareObraWhatsApp('${o.cod}')"><span class="material-symbols-outlined md-16">chat</span> WhatsApp</button>
          <button class="btn btn-primary btn-sm" style="flex:1;min-width:80px" onclick="showPage('tarefas')"><span class="material-symbols-outlined md-16">checklist</span> Tarefas</button>
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
      <button class="btn btn-secondary btn-sm" onclick="editObra(${i})" title="Editar obra" aria-label="Editar obra" style="margin-right:8px"><span class="material-symbols-outlined md-16">edit</span> Editar</button>
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
      const totalAtend = pres.filter(p => (p.presenca === 'Presente' || p.presenca === 'Falta')).length;
      const presentCnt = pres.filter(p => p.presenca === 'Presente').length;
      const assid = totalAtend > 0 ? ((presentCnt / totalAtend) * 100).toFixed(0) : 0;
      const faltasMes = pres.filter(p => p.presenca === 'Falta' && (p.data || '').startsWith(currentMonth)).length;

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
            <button class="btn btn-secondary btn-sm" onclick="editTrabalhador(${i})" title="Editar trabalhador" aria-label="Editar trabalhador" style="margin-right:8px"><span class="material-symbols-outlined md-16">edit</span> Editar</button>
            <button class="btn btn-danger btn-sm" onclick="deleteItem('trabalhadores',${i})">Excluir</button>
          </td>
        </tr>`;
    }).join('')
    : uiEmptyState('Sem Trabalhadores', 'Cadastre o primeiro pedreiro, mestre ou servente para começar.', 'engineering', 'Adicionar Trabalhador', 'openModal(\'modal-trabalhador\')'));
}

// ==================== ALMOÇOS ====================
// Espelha a usabilidade de Presença: quadro semanal navegável, clique na célula,
// busca/agrupamento/ordenação e fechamentos por empreiteiro/pagamento.
let currentAlmocoWeekOffset = 0;

function getAlmocoWeekDates() {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const dia = base.getDay();
  const diff = dia === 0 ? 6 : dia - 1; // segunda = 0
  const inicio = new Date(base);
  inicio.setDate(base.getDate() - diff + (currentAlmocoWeekOffset * 7));
  const nomes = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const dias = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    dias.push({
      date: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
      name: nomes[i],
      display: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    });
  }
  return dias;
}
window.getAlmocoWeekDates = getAlmocoWeekDates;

function changeAlmocoWeek(offset) {
  currentAlmocoWeekOffset += offset;
  renderQuadroAlmocos();
  const lista = DB.almocos || [];
  renderAlmocosKPI(lista);
  renderFechamentosAlmocos(lista);
}
window.changeAlmocoWeek = changeAlmocoWeek;

/** String literal JS segura para dentro de um atributo onclick entre aspas duplas. */
function almocoJsString(valor) {
  return "'" + String(valor == null ? '' : valor)
    .replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    .replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/</g, '\\u003c') + "'";
}

function almocoDevido(a) {
  const total = Number(a.vtotal) || 0;
  if (a.pgtoStatus === 'Pago') return 0;
  const pago = a.pgtoStatus === 'Parcial' ? (Number(a.valpago) || 0) : 0;
  return Math.max(0, total - pago);
}

function renderQuadroAlmocos() {
  const container = document.getElementById('almoco-quadro-semanal');
  if (!container) return;

  const dias = getAlmocoWeekDates();
  const trabalhadores = (DB.trabalhadores || []).filter(t => t.status === 'Ativo');
  if (!trabalhadores.length) {
    container.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text3)">Nenhum trabalhador ativo para exibir no quadro.</p>';
    return;
  }

  let html = `<table class="almoco-board">
    <thead><tr><th class="worker-info">Empreiteiro / Trabalhador</th>
      ${dias.map(d => `<th><div class="day-header"><span class="day-name">${d.name}</span><span class="day-date">${d.display}</span></div></th>`).join('')}
    </tr></thead><tbody>`;

  trabalhadores.forEach(w => {
    html += `<tr><td class="worker-info"><b>${escHtml(w.nome)}</b><br><small style="color:var(--text3)">${escHtml(w.equipe || w.funcao || '—')}</small></td>`;
    dias.forEach(d => {
      const idx = (DB.almocos || []).findIndex(a => a && a.data === d.date && (
        a.empreiteiro === w.nome || a.empreiteiro === w.cod || (w.equipe && a.empreiteiro === w.equipe)
      ));
      const a = idx >= 0 ? DB.almocos[idx] : null;
      let icone = '<span class="material-symbols-outlined md-16">more_horiz</span>';
      let titulo = 'Sem registro';
      let classe = 'none';
      if (a) {
        if (a.pgtoStatus === 'Pago') {
          icone = '<span class="material-symbols-outlined md-16" style="color:var(--green)">check_circle</span>';
          titulo = `Lançado e pago — ${a.qtd} ref.`;
          classe = 'pago';
        } else {
          icone = '<span class="material-symbols-outlined md-16" style="color:var(--orange)">restaurant</span>';
          titulo = `Lançado — ${a.qtd} ref. (${a.pgtoStatus || 'Pendente'})`;
          classe = 'lancado';
        }
      }
      html += `<td><div class="almoco-cell" title="${titulo}" onclick="openAlmocoModal(${almocoJsString(w.cod)}, '${d.date}', ${idx})">
        <div class="almoco-icon ${classe}">${icone}</div>
        ${a ? `<small>${escHtml(a.qtd)} ref.</small>` : ''}
      </div></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}
window.renderQuadroAlmocos = renderQuadroAlmocos;

/** Clique na célula: edita o lançamento do dia ou abre o modal pré-preenchido. */
async function openAlmocoModal(cod, data, existingIdx = -1) {
  if (existingIdx >= 0) { editAlmoco(existingIdx); return; }
  await openModal('modal-almoco');
  setTimeout(() => {
    const t = (DB.trabalhadores || []).find(x => x.cod === cod);
    const dataEl = document.getElementById('al-data');
    if (dataEl) dataEl.value = data;
    const empEl = document.getElementById('al-empreiteiro');
    if (empEl) empEl.value = t ? t.nome : cod;
    const obraEl = document.getElementById('al-obra');
    if (obraEl && t && t.obras) {
      const primeira = String(t.obras).split(/[,;]/).map(s => s.trim()).find(Boolean);
      if (primeira && [...obraEl.options].some(o => o.value === primeira)) obraEl.value = primeira;
    }
    if (typeof toggleAlmocoModo === 'function') toggleAlmocoModo();
  }, 300);
}
window.openAlmocoModal = openAlmocoModal;

function renderAlmocos() {
  const tbody = document.getElementById('almocos-tbody');
  if (!tbody) return;

  const lista = DB.almocos || [];
  const qStr = (document.getElementById('almoco-busca')?.value || '').toLowerCase().trim();
  const grupo = document.getElementById('almoco-group-select')?.value || '';
  const ordem = document.getElementById('almoco-sort-select')?.value || 'data_desc';

  let itens = lista.map((a, i) => ({ ...a, _idx: i }));
  if (qStr) {
    itens = itens.filter(a => [fmtDate(a.data), a.data, obName(a.obra), a.empreiteiro, a.obs]
      .join(' ').toLowerCase().includes(qStr));
  }
  itens.sort((a, b) => ordem === 'data_asc'
    ? String(a.data).localeCompare(String(b.data))
    : String(b.data).localeCompare(String(a.data)));

  const chaveGrupo = (a) => grupo === 'empreiteiro'
    ? (a.empreiteiro || '—')
    : (grupo === 'obra' ? obName(a.obra) : '');
  const contagens = {};
  if (grupo) itens.forEach(a => { const k = chaveGrupo(a); contagens[k] = (contagens[k] || 0) + 1; });

  let ultimoGrupo = null;
  const html = itens.map(a => {
    const chave = chaveGrupo(a);
    let cabecalho = '';
    if (chave && chave !== ultimoGrupo) {
      cabecalho = `<tr class="group-header"><td colspan="8">${escHtml(chave)} <small style="font-weight:normal;color:var(--text3)">(${contagens[chave]})</small></td></tr>`;
      ultimoGrupo = chave;
    }
    return `${cabecalho}<tr>
      <td data-label="Data / Obra">${fmtDate(a.data)}<br><small style="color:var(--text3)">${obName(a.obra)}</small></td>
      <td data-label="Colaborador"><b>${escHtml(a.empreiteiro)}</b></td>
      <td data-label="Quantidade">${escHtml(a.qtd)}</td>
      <td data-label="Valor Unit.">${fmt(a.vunit)}</td>
      <td data-label="Total"><b style="color:var(--accent)">${fmt(a.vtotal)}</b></td>
      <td data-label="Status Pgto">${statusBadge(a.pgtoStatus)}</td>
      <td data-label="Pago">${fmt(a.valpago)}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editAlmoco(${a._idx})" title="Editar almoço" aria-label="Editar almoço" style="margin-right:8px"><span class="material-symbols-outlined md-16">edit</span> Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteItem('almocos',${a._idx})">Excluir</button>
      </td>
    </tr>`;
  }).join('');

  tbody.innerHTML = html || '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text3)">Nenhum almoço registrado.</td></tr>';
  filterAlmoco(document.getElementById('almoco-busca')?.value || '');
  renderQuadroAlmocos();
  renderAlmocosKPI(lista);
  renderFechamentosAlmocos(lista);
}
window.renderAlmocos = renderAlmocos;

function renderAlmocosKPI(list) {
  const container = document.getElementById('almocos-kpi');
  if (!container) return;
  const dias = getAlmocoWeekDates();
  const ini = dias[0].date;
  const fim = dias[6].date;
  const semana = list.filter(a => a.data >= ini && a.data <= fim);
  const qtdSemana = semana.reduce((s, a) => s + (parseFloat(a.qtd) || 0), 0);
  const custoSemana = semana.reduce((s, a) => s + (parseFloat(a.vtotal) || 0), 0);
  const pendente = semana.reduce((s, a) => s + almocoDevido(a), 0);
  const periodo = `${dias[0].display} – ${dias[6].display}`;

  container.innerHTML = `
    <div class="kpi-card"><div><div class="kpi-label">Refeições Semana <small style="font-weight:normal">${periodo}</small></div><div class="kpi-value">${qtdSemana} un</div></div></div>
    <div class="kpi-card"><div><div class="kpi-label">Custo Semana <small style="font-weight:normal">${periodo}</small></div><div class="kpi-value">${fmt(custoSemana)}</div></div></div>
    <div class="kpi-card"><div><div class="kpi-label">Lançamentos na Semana</div><div class="kpi-value">${semana.length}</div></div></div>
    <div class="kpi-card"><div><div class="kpi-label">Pagamentos Pendentes</div><div class="kpi-value" style="color:var(--orange)">${fmt(pendente)}</div></div></div>
  `;
}

function renderFechamentosAlmocos(list) {
  const dias = getAlmocoWeekDates();
  const semana = (list || []).filter(a => a.data >= dias[0].date && a.data <= dias[6].date);

  const porObra = {};
  const porEmpreiteiro = {};
  const pendentes = {};
  semana.forEach(a => {
    const obra = a.obra || '';
    const emp = a.empreiteiro || '—';
    if (!porObra[obra]) porObra[obra] = { qtd: 0, total: 0 };
    if (!porEmpreiteiro[emp]) porEmpreiteiro[emp] = { qtd: 0, total: 0 };
    if (!pendentes[obra]) pendentes[obra] = { lancamentos: 0, valor: 0 };
    const qtd = parseFloat(a.qtd) || 0;
    const total = parseFloat(a.vtotal) || 0;
    porObra[obra].qtd += qtd; porObra[obra].total += total;
    porEmpreiteiro[emp].qtd += qtd; porEmpreiteiro[emp].total += total;
    const devido = almocoDevido(a);
    if (devido > 0) { pendentes[obra].lancamentos++; pendentes[obra].valor += devido; }
  });

  const card = (titulo, qtd, total, extra) => `
    <div class="kpi-card" style="padding:16px;">
      <div style="font-size:12px;color:var(--text3)">${escHtml(titulo)}</div>
      <div style="font-weight:600;margin-top:6px">${qtd} <small style="font-size:10px;font-weight:normal">${extra || 'ref. somadas'}</small></div>
      <div style="font-size:14px;color:var(--red);margin-top:4px">${fmt(total)}</div>
    </div>`;

  const resumo = document.getElementById('almocos-resumo');
  if (resumo) {
    resumo.innerHTML = Object.keys(porObra).map(obra => card(obName(obra), porObra[obra].qtd, porObra[obra].total)).join('')
      || '<div style="color:var(--text3);">Sem consolidação na semana selecionada.</div>';
  }
  const porEmpEl = document.getElementById('almocos-empreiteiro');
  if (porEmpEl) {
    porEmpEl.innerHTML = Object.keys(porEmpreiteiro).map(emp => card(emp, porEmpreiteiro[emp].qtd, porEmpreiteiro[emp].total)).join('')
      || '<div style="color:var(--text3);">Sem lançamentos na semana selecionada.</div>';
  }
  const pendEl = document.getElementById('almocos-pgto-pendentes');
  if (pendEl) {
    pendEl.innerHTML = Object.keys(pendentes)
      .filter(obra => pendentes[obra].valor > 0)
      .map(obra => card(obName(obra), pendentes[obra].lancamentos, pendentes[obra].valor, 'lançamentos pendentes')).join('')
      || '<div style="color:var(--text3);">Nenhum pagamento pendente na semana.</div>';
  }
}
window.renderFechamentosAlmocos = renderFechamentosAlmocos;

/** Busca da lista, preservando os cabeçalhos de grupo (como filterPresenca). */
function filterAlmoco(query) {
  const q = (query || '').toLowerCase().trim();
  const tbody = document.getElementById('almocos-tbody');
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(row => {
    if (row.classList.contains('group-header')) { row.style.display = ''; return; }
    row.style.display = (!q || (row.innerText || '').toLowerCase().includes(q)) ? '' : 'none';
  });
  tbody.querySelectorAll('tr.group-header').forEach(header => {
    let row = header.nextElementSibling;
    let visivel = false;
    while (row && !row.classList.contains('group-header')) {
      if (row.style.display !== 'none') visivel = true;
      row = row.nextElementSibling;
    }
    header.style.display = visivel ? '' : 'none';
  });
}
window.filterAlmoco = filterAlmoco;

/** Fechamento em lote da semana navegada (análogo a prepareLotePgto). */
async function fecharSemanaAlmocos() {
  const dias = getAlmocoWeekDates();
  const pendentes = (DB.almocos || []).filter(a =>
    a.data >= dias[0].date && a.data <= dias[6].date && almocoDevido(a) > 0);
  if (!pendentes.length) {
    toast('Não há almoços pendentes nesta semana.', 'warning');
    return;
  }
  const valor = pendentes.reduce((s, a) => s + almocoDevido(a), 0);
  if (!confirm(`Marcar ${pendentes.length} lançamento(s) como pago(s) (${fmt(valor)})?`)) return;
  pendentes.forEach(a => { a.pgtoStatus = 'Pago'; a.valpago = Number(a.vtotal) || 0; });
  await persistDB();
  renderAlmocos();
  toast('Fechamento da semana registrado!');
}
window.fecharSemanaAlmocos = fecharSemanaAlmocos;

function calcAlmocoTotal() {
  const q = parseFloat(document.getElementById('al-qtd').value) || 0;
  const u = parseFloat(document.getElementById('al-vunit').value) || 0;
  const target = document.getElementById('al-vtotal');
  if (target) target.value = (q * u).toFixed(2);
}

function toggleAlmocoModo() {
  const modo = document.querySelector('input[name="al-modo"]:checked')?.value;
  const indiv = document.getElementById('al-indiv-grp');
  const massa = document.getElementById('al-massa-grp');
  const lista = document.getElementById('al-lista-massa');
  if (!indiv || !massa) return;
  if (modo === 'massa') {
    indiv.style.display = 'none';
    massa.style.display = '';
    const obra = document.getElementById('al-obra')?.value;
    const trabList = DB.trabalhadores.filter(t => {
      if (t.status !== 'Ativo') return false;
      if (!t.obras || t.obras.trim() === '') return true;
      return t.obras.includes(obra);
    });
    if (lista) {
      lista.innerHTML = trabList.length > 0
        ? trabList.map(t => `
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;background:rgba(var(--accent-rgb),0.03);padding:4px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.05)">
              <input type="checkbox" class="al-massa-check" value="${t.nome}" data-cod="${t.cod}">
              <span style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.nome}${t.equipe ? ' (' + t.equipe + ')' : ''}</span>
            </label>
          `).join('')
        : '<p style="font-size:12px;color:var(--text3);padding:5px">Nenhum funcionário ativo na obra.</p>';
    }
  } else {
    indiv.style.display = '';
    massa.style.display = 'none';
  }
}

function selectAllAlmoco(check) {
  document.querySelectorAll('.al-massa-check').forEach(c => c.checked = check);
}

window.toggleAlmocoParcial = function () {
  const statusEl = document.getElementById('al-status');
  const grp = document.getElementById('al-parcial-grp');
  if (grp) grp.style.display = statusEl && statusEl.value === 'Parcial' ? '' : 'none';
};

async function saveAlmoco(keepOpen = false) {
  const modoMassa = document.querySelector('input[name="al-modo"]:checked')?.value === 'massa';
  const dataVal = document.getElementById('al-data').value;
  const obraVal = document.getElementById('al-obra').value;
  const editIdx = parseEditIdx(document.getElementById('al-edit-idx').value);
  const qtd = parseFloat(document.getElementById('al-qtd').value) || 0;
  const vunit = parseFloat(document.getElementById('al-vunit').value) || 0;
  const vtotal = qtd * vunit;
  const obs = document.getElementById('al-obs').value;
  const statusEl = document.getElementById('al-status');
  const valpagoEl = document.getElementById('al-valpago');
  const pgtoStatus = statusEl ? statusEl.value : 'Pendente';
  let valpago = parseFloat(valpagoEl?.value) || 0;
  if (pgtoStatus === 'Pago') valpago = vtotal;
  else if (pgtoStatus !== 'Parcial') valpago = 0;

  if (!dataVal || !obraVal) { toast('Preencha data e obra!', 'error'); return; }

  let empreiteiros = [];
  if (modoMassa) {
    const checks = document.querySelectorAll('.al-massa-check:checked');
    if (checks.length === 0) { toast('Selecione ao menos um funcionário!', 'error'); return; }
    empreiteiros = [...checks].map(c => c.value);
  } else {
    const emp = document.getElementById('al-empreiteiro').value.trim();
    if (!emp) { toast('Informe o empreiteiro/trabalhador!', 'error'); return; }
    empreiteiros = [emp];
  }

  let salvos = 0;
  for (const emp of empreiteiros) {
    if (editIdx < 0 || !modoMassa) {
      const jaExiste = DB.almocos.some((a, i) => editIdx >= 0 && i === editIdx ? false : a.data === dataVal && a.empreiteiro === emp && a.obra === obraVal);
      if (jaExiste) {
        toast(`${emp} já tem almoço lançado nesta data!`, 'error');
        if (!modoMassa) return;
        continue;
      }
    }
    const data = { data: dataVal, obra: obraVal, empreiteiro: emp, qtd, vunit, vtotal, obs, pgtoStatus, valpago };
    if (editIdx >= 0 && !modoMassa) {
      DB.almocos[editIdx] = data;
    } else {
      DB.almocos.push(data);
    }
    salvos++;
  }

  closeModal('modal-almoco');
  await persistDB();
  if (typeof renderAlmocos === 'function') renderAlmocos();
  if (keepOpen) {
    const lastMode = modoMassa ? 'massa' : 'individual';
    setTimeout(() => {
      openModal('modal-almoco');
      const radio = document.querySelector(`input[name="al-modo"][value="${lastMode}"]`);
      if (radio) { radio.checked = true; toggleAlmocoModo(); }
    }, 100);
  }
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
  const statusEl = document.getElementById('al-status');
  if (statusEl) statusEl.value = a.pgtoStatus || 'Pendente';
  const valpagoEl = document.getElementById('al-valpago');
  if (valpagoEl) valpagoEl.value = a.valpago || '';
  toggleAlmocoParcial();
}

// ==================== PRESENÇA ====================
let currentWeekOffset = 0;

function getCurrentWeekDates() {
  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(todayObj);
  const dayOfWeek = todayObj.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(todayObj.getDate() - diff + (currentWeekOffset * 7));

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    days.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
  }
  return days;
}
window.getCurrentWeekDates = getCurrentWeekDates;

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
      let icon = '<span class="material-symbols-outlined md-16" style="vertical-align:middle;">more_horiz</span>';
      let title = 'Sem registro';

      if (p) {
        if (p.presenca === 'Presente') { iconClass = 'presente'; icon = '<span class="material-symbols-outlined md-16" style="vertical-align:middle;color:var(--green);">check_circle</span>'; title = 'Presente'; }
        else if (p.presenca === 'Falta') { iconClass = 'falta'; icon = '<span class="material-symbols-outlined md-16" style="vertical-align:middle;color:var(--red);">cancel</span>'; title = 'Falta'; }
        else if (p.presenca === 'Meio período') { iconClass = 'meio'; icon = '<span class="material-symbols-outlined md-16" style="vertical-align:middle;color:var(--orange);">contrast</span>'; title = 'Meio Período'; }
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

  // Normaliza total para registros com diária setada mas total ausente/zero
  allPres.forEach(p => {
    if (!p || !p.data) return;
    const diaria = Number(p.diaria) || 0;
    const total = Number(p.total) || 0;
    if (diaria > 0 && total <= 0 && p.presenca && p.presenca !== 'Falta') {
      if (p.presenca === 'Meio período') {
        p.total = diaria / 2;
      } else if (p.vinculo === 'Informal') {
        p.total = diaria;
      } else {
        const hnorm = Number(p.hnorm) || 0;
        if (hnorm > 0) {
          const hextra = Number(p.hextra) || 0;
          p.total = diaria + (hextra * (diaria / 8) * 1.5);
        }
      }
    }
  });

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
    safeSetInner('pres-tbody', uiEmptyState('Folha em Branco', 'Ninguém bateu ponto hoje. Inicie o lançamento diário da obra.', 'check_circle', 'Lançar Presença', 'openModal(\'modal-presenca\')'));
  } else if (!groupMode) {
    safeSetInner('pres-tbody', listForTable.map(p => {
      const saldo = (Number(p.total) || 0) - (Number(p.valpago) || 0);
      return `<tr>
        <td data-label="Data / Local"><b>${fmtDate(p.data)}</b><br><small style="color:var(--text3)">${obName(p.obra)}${p.frente ? ' · ' + p.frente : ''}</small></td>
        <td data-label="Profissional"><b>${p.nome}</b><br><small style="color:var(--text3)">${p.funcao}</small></td>
        <td data-label="Horários">${p.entrada || '—'} - ${p.saida || '—'}</td>
        <td data-label="Horas (N+E)">${p.hnorm || 0}h + ${p.hextra || 0}h</td>
        <td data-label="Status">${statusBadge(p.presenca)}</td>
        <td data-label="Valor Total"><b>${fmt(p.total)}</b></td>
        <td data-label="Pgto">${p.pgtoStatus || '—'}</td>
        <td data-label="Saldo" style="color:${saldo > 0 ? 'var(--red)' : 'var(--text3)'};font-weight:${saldo > 0 ? 'bold' : 'normal'}">${saldo > 0 ? fmt(saldo) : '—'}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editPresenca(${p._idx})" style="margin-right:8px" title="Editar presença" aria-label="Editar presença"><span class="material-symbols-outlined md-16">edit</span> Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem('presenca',${p._idx})">Excluir</button>
        </td>
      </tr>`;
    }).join(''));
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
            <td colspan="8"><span id="${icn}" class="material-symbols-outlined md-18" style="vertical-align:middle; margin-right:4px; color:var(--accent);">chevron_right</span> 
              <span style="font-size:14px; text-transform:uppercase">${k}</span> 
              <span class="badge badge-blue" style="margin-left:12px">${rows.length} registros</span>
            </td>
            <td colspan="2" style="color:var(--green); font-size:14px; font-weight:bold;">Total: ${fmt(totalGroup)}</td>
          </tr>`;

      rows.forEach(p => {
        const saldo = (Number(p.total) || 0) - (Number(p.valpago) || 0);
        tbodyHtml += `<tr class="${cls}" style="display:none; transition: all 0.3s">
                <td data-label="Data / Local" style="padding-left:16px"><span style="color:var(--text3); font-size:10px; margin-right:4px">└</span> <b>${fmtDate(p.data)}</b><br><small style="color:var(--text3)">${obName(p.obra)}${p.frente ? ' · ' + p.frente : ''}</small></td>
                <td data-label="Profissional"><b>${p.nome}</b><br><small style="color:var(--text3)">${p.funcao}</small></td>
                <td data-label="Horários">${p.entrada || '—'} - ${p.saida || '—'}</td>
                <td data-label="Horas (N+E)">${p.hnorm || 0}h + ${p.hextra || 0}h</td>
                <td data-label="Status">${statusBadge(p.presenca)}</td>
                <td data-label="Valor Total"><b>${fmt(p.total)}</b></td>
                <td data-label="Pgto">${p.pgtoStatus || '—'}</td>
                <td data-label="Saldo" style="color:${saldo > 0 ? 'var(--red)' : 'var(--text3)'};font-weight:${saldo > 0 ? 'bold' : 'normal'}">${saldo > 0 ? fmt(saldo) : '—'}</td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="editPresenca(${p._idx})" style="margin-right:8px" title="Editar presença" aria-label="Editar presença"><span class="material-symbols-outlined md-16">edit</span> Editar</button>
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

  safeSetInner('pres-pgto-pendentes', pendentesHtml || '<p style="color:var(--green); padding: 8px; font-weight: 500;"><span class="material-symbols-outlined md-18" style="vertical-align:middle;margin-right:4px;color:var(--green);">check_circle</span>Nenhum pagamento pendente para esta semana.</p>');

  // ➕ FECHAMENTO POR TRABALHADOR (EMPREITADA)
  try {
    const porTrab = {};
    const seenKeys = new Set(); // Para evitar duplicatas no cálculo

    validPres.forEach(p => {
      if (!p.nome || !p.presenca) return;

      // Chave única: data + trabalhador
      const trabKey = p.trab || p.nome;
      const uniqueKey = `${p.data}_${trabKey}`;
      if (seenKeys.has(uniqueKey)) return; // Pula duplicata
      seenKeys.add(uniqueKey);

      const k = p.nome;
      if (!porTrab[k]) porTrab[k] = { total: 0, pendente: 0, diasTrabalhados: 0, diasFalta: 0, obra: p.obra };

      const total = Number(p.total) || 0;
      const pago = p.pgtoStatus === 'Parcial' ? (Number(p.valpago) || 0) : 0;
      porTrab[k].total += total;
      if (p.pgtoStatus !== 'Pago') {
        porTrab[k].pendente += Math.max(0, total - pago);
      }

      if (p.presenca === 'Presente' || p.presenca === 'Meio período') {
        porTrab[k].diasTrabalhados++;
      } else if (p.presenca === 'Falta') {
        porTrab[k].diasFalta++;
      }
    });

    const keys = Object.keys(porTrab).sort();
    const empreitadaHtml = keys.map(nome => {
      const d = porTrab[nome];
      return `<div class="kpi-card">
        <div class="kpi-label" style="font-weight:600">${nome}</div>
        <div style="font-size:13px;color:var(--text2);margin:4px 0">${obName(d.obra)} · ${d.diasTrabalhados} trab. · ${d.diasFalta} falta(s)</div>
        <div style="font-size:16px;font-weight:bold;color:var(--accent)">Total: ${fmt(d.total)}</div>
        <div style="font-size:14px;color:var(--red)">Pendente: ${fmt(d.pendente)}</div>
      </div>`;
    }).join('');

    safeSetInner('pres-empreitada', empreitadaHtml || '<p style="color:var(--text3); padding: 8px;">Sem registros de fechamento por trabalhador.</p>');
  } catch (e) {
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
  if (tableCont) tableCont.style.display = mode === 'table' ? 'block' : 'none';
  if (kanbanCont) kanbanCont.style.display = mode === 'kanban' ? 'block' : 'none';
  renderTarefas();
}
window.setTaskView = setTaskView;

// Busca com debounce: evita re-renderizar a tabela a cada tecla digitada.
function onTaskSearch() {
  clearTimeout(window._taskSearchTimer);
  window._taskSearchTimer = setTimeout(renderTarefas, 220);
}
window.onTaskSearch = onTaskSearch;

function limparFiltrosTarefas() {
  ['tar-obra-filter', 'tar-status-filter', 'tar-prio-filter', 'tar-resp-filter', 'tar-ordem'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.selectedIndex = 0;
  });
  ['tar-vencidas', 'tar-minhas'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  const busca = document.getElementById('tar-busca');
  if (busca) busca.value = '';
  renderTarefas();
}
window.limparFiltrosTarefas = limparFiltrosTarefas;

function renderTarefas() {
  // A página é reinjetada a cada navegação; reaplica o modo Tabela/Quadro escolhido.
  const tableCont = document.getElementById('tar-table-container');
  const kanbanCont = document.getElementById('tar-kanban-container');
  if (tableCont && kanbanCont) {
    const modo = window._taskViewMode === 'kanban' ? 'kanban' : 'table';
    tableCont.style.display = modo === 'table' ? 'block' : 'none';
    kanbanCont.style.display = modo === 'kanban' ? 'block' : 'none';
    document.getElementById('btn-view-table')?.classList.toggle('active', modo === 'table');
    document.getElementById('id-view-kanban')?.classList.toggle('active', modo === 'kanban');
  }

  const obraFilter = document.getElementById('tar-obra-filter')?.value || '';
  const statusFilter = document.getElementById('tar-status-filter')?.value || '';
  const prioFilter = document.getElementById('tar-prio-filter')?.value || '';
  const respFilter = document.getElementById('tar-resp-filter')?.value || '';
  const soVencidas = !!document.getElementById('tar-vencidas')?.checked;
  const soMinhas = !!document.getElementById('tar-minhas')?.checked;
  const ordem = document.getElementById('tar-ordem')?.value || 'prazo';
  const busca = (document.getElementById('tar-busca')?.value || '').toLowerCase().trim();

  // Repovoa os responsáveis a partir dos dados, preservando a seleção atual.
  const respSel = document.getElementById('tar-resp-filter');
  if (respSel) {
    const atual = respSel.value;
    const responsaveis = [...new Set((DB.tarefas || []).map(t => t && t.resp).filter(Boolean))].sort();
    respSel.innerHTML = '<option value="">Todos responsáveis</option>'
      + responsaveis.map(r => `<option value="${String(r).replace(/"/g, '&quot;')}">${r}</option>`).join('');
    if (responsaveis.includes(atual)) respSel.value = atual;
  }

  let meuNome = '', meuEmail = '';
  try {
    const sessao = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
    meuNome = String(sessao.name || '').toLowerCase();
    meuEmail = String(sessao.email || '').toLowerCase();
  } catch (e) { }

  const tasks = (DB.tarefas || []).map((t, i) => ({ ...t, _idx: i }))
    .map(t => ({
      ...t,
      _atrasada: tarefaTaAtrasada(t),
      _status: tarefaStatusEfetivo(t),
      _venceHoje: !tarefaTaAtrasada(t) && t.prazo === getTodayBR()
    }))
    .filter(t => {
      if (obraFilter && t.obra !== obraFilter) return false;
      if (prioFilter && t.prior !== prioFilter) return false;
      if (respFilter && t.resp !== respFilter) return false;
      if (soVencidas && !t._atrasada) return false;
      if (soMinhas) {
        const r = String(t.resp || '').toLowerCase();
        if (!r || (!meuNome && !meuEmail) || (!r.includes(meuNome) && (!meuEmail || !r.includes(meuEmail)))) return false;
      }
      if (statusFilter === 'abertas' && t._status === 'Concluída') return false;
      if (statusFilter === 'atrasadas' && !t._atrasada) return false;
      if (statusFilter && !['abertas', 'atrasadas'].includes(statusFilter)) {
        // "Pendente" (legado) e "A fazer" são o mesmo balde; "Atrasada" também
        // aparece quando o prazo venceu mesmo sem status gravado.
        const alvo = statusFilter === 'A fazer' ? ['A fazer', 'Pendente'] : [statusFilter];
        if (!alvo.includes(t._status)) return false;
      }
      if (busca && !((t.desc || '').toLowerCase().includes(busca)
        || (t.resp || '').toLowerCase().includes(busca)
        || (t.cod || '').toLowerCase().includes(busca))) return false;
      return true;
    });

  const prioridade = { Alta: 0, Média: 1, Baixa: 2 };
  tasks.sort((a, b) => {
    if (ordem === 'prioridade') {
      return (prioridade[a.prior] ?? 9) - (prioridade[b.prior] ?? 9)
        || (a.prazo || '9999').localeCompare(b.prazo || '9999');
    }
    if (ordem === 'status') {
      return String(a.status || '').localeCompare(String(b.status || ''))
        || (a.prazo || '9999').localeCompare(b.prazo || '9999');
    }
    if (ordem === 'recentes') return String(b.criacao || '').localeCompare(String(a.criacao || ''));
    // Padrão: prazo mais próximo primeiro; sem prazo vai para o fim.
    if (!a.prazo && !b.prazo) return 0;
    if (!a.prazo) return 1;
    if (!b.prazo) return -1;
    return a.prazo.localeCompare(b.prazo);
  });

  // KPIs dinâmicos filtrados
  const total = tasks.length;
  const conc = tasks.filter(t => t._status === 'Concluída').length;
  const andam = tasks.filter(t => t._status === 'Em andamento').length;
  const pend = tasks.filter(t => ['Pendente', 'A fazer', 'Atrasada', 'Pausada'].includes(t._status)).length;
  const atrasadas = tasks.filter(t => t._atrasada).length;

  safeSetInner('tar-kpi', `
    <div class="kpi-card"><div class="kpi-label">Total Filtrado</div><div class="kpi-val">${total}</div></div>
    <div class="kpi-card"><div class="kpi-label">Concluídas</div><div class="kpi-val green">${conc}</div></div>
    <div class="kpi-card"><div class="kpi-label">Em Andamento</div><div class="kpi-val blue">${andam}</div></div>
    <div class="kpi-card"><div class="kpi-label">Pendentes</div><div class="kpi-val orange">${pend}</div></div>
    <div class="kpi-card"><div class="kpi-label">Atrasadas</div><div class="kpi-val ${atrasadas > 0 ? 'red' : 'green'}">${atrasadas}</div></div>
  `);

  if (window._taskViewMode === 'kanban') {
    renderKanban(tasks);
  } else {
    renderTaskTable(tasks);
  }
}

// ==================== TAREFAS — AÇÕES RÁPIDAS ====================

// Prazo vencido é atrasado mesmo que o status gravado ainda diga "A fazer".
function tarefaTaAtrasada(t) {
  if (!t || t.status === 'Concluída' || !t.prazo) return false;
  return t.prazo < getTodayBR();
}
window.tarefaTaAtrasada = tarefaTaAtrasada;

function tarefaStatusEfetivo(t) {
  return tarefaTaAtrasada(t) ? 'Atrasada' : (t.status || 'A fazer');
}
window.tarefaStatusEfetivo = tarefaStatusEfetivo;

// Snapshot para desfazer a última ação rápida (concluir/iniciar/mover).
let _undoSnapshotTarefas = null;

function toastComDesfazer(msg) {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  const el = document.createElement('div');
  el.className = 'toast success toast-undo';
  el.innerHTML = `<span class="material-symbols-outlined md-18">check_circle</span> ${msg}`
    + '<button type="button" class="toast-undo-btn" onclick="desfazerAcao()">Desfazer</button>';
  c.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}
window.toastComDesfazer = toastComDesfazer;

function desfazerAcao() {
  if (!_undoSnapshotTarefas) {
    toast('Nada para desfazer.', 'warning');
    return;
  }
  const snap = _undoSnapshotTarefas;
  _undoSnapshotTarefas = null;
  DB.tarefas = snap;
  persistDB();
  renderTarefas();
  if (document.getElementById('dash-tarefas-grid')) renderDashboard();
  toast('Ação desfeita.');
}
window.desfazerAcao = desfazerAcao;

function snapshotTarefas() {
  _undoSnapshotTarefas = JSON.parse(JSON.stringify(DB.tarefas || []));
}

// Conclui ou reabre uma tarefa a partir de qualquer tela (tabela, kanban, dashboard).
async function toggleTarefaConcluida(idx) {
  const t = DB.tarefas[idx];
  if (!t) return;
  snapshotTarefas();
  if (t.status === 'Concluída') {
    t.status = 'A fazer';
    t.conclusao = '';
    t.perc = 0;
  } else {
    t.status = 'Concluída';
    t.conclusao = getTodayBR();
    t.perc = 100;
  }
  await persistDB();
  renderTarefas();
  if (document.getElementById('dash-tarefas-grid')) renderDashboard();
  toastComDesfazer(t.status === 'Concluída' ? 'Tarefa concluída.' : 'Tarefa reaberta.');
}
window.toggleTarefaConcluida = toggleTarefaConcluida;

function concluirTarefaRapida(idx) {
  const t = DB.tarefas[idx];
  if (!t || t.status === 'Concluída') return;
  return toggleTarefaConcluida(idx);
}
window.concluirTarefaRapida = concluirTarefaRapida;

function iniciarTarefa(idx) {
  const t = DB.tarefas[idx];
  if (!t || ['Em andamento', 'Concluída', 'Pausada'].includes(t.status)) return;
  snapshotTarefas();
  t.status = 'Em andamento';
  if (!t.perc || t.perc < 10) t.perc = 10;
  persistDB();
  renderTarefas();
  if (document.getElementById('dash-tarefas-grid')) renderDashboard();
  toastComDesfazer('Tarefa iniciada.');
}
window.iniciarTarefa = iniciarTarefa;

// Move a tarefa para outro status (arrastar no kanban ou ações rápidas).
function moverTarefaStatus(idx, status, opts = {}) {
  const t = DB.tarefas[idx];
  if (!t || !status) return;
  if (tarefaStatusEfetivo(t) === status) return;
  if (!opts.semSnapshot) snapshotTarefas();
  const percAnterior = Number(t.perc) || 0;
  t.status = status;
  if (status === 'Concluída') {
    t.conclusao = getTodayBR();
    t.perc = 100;
  } else {
    t.conclusao = '';
    if (percAnterior >= 100) t.perc = 90;
    if (status === 'Em andamento' && (!t.perc || t.perc < 10)) t.perc = 10;
  }
  persistDB();
  renderTarefas();
  if (document.getElementById('dash-tarefas-grid')) renderDashboard();
  if (!opts.semToast) toastComDesfazer(`Tarefa movida para "${status}".`);
}
window.moverTarefaStatus = moverTarefaStatus;

// Navegação a partir do dashboard: aplica filtros já na chegada à página de tarefas.
function irParaTarefas(filtros = {}) {
  if (typeof showPage !== 'function') return;
  showPage('tarefas').then(() => {
    Object.entries(filtros).forEach(([id, valor]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!valor;
      else el.value = valor;
    });
    renderTarefas();
  });
}
window.irParaTarefas = irParaTarefas;

function verTarefasDashboard() {
  irParaTarefas({ 'tar-status-filter': 'abertas', 'tar-ordem': 'prazo' });
}
window.verTarefasDashboard = verTarefasDashboard;

function verTarefasDaObra(cod) {
  irParaTarefas({ 'tar-obra-filter': cod, 'tar-status-filter': 'abertas' });
}
window.verTarefasDaObra = verTarefasDaObra;

function abrirNovaTarefaNoStatus(status) {
  if (typeof openModal !== 'function') return;
  openModal('modal-tarefa').then(() => {
    const sel = document.getElementById('tf-status');
    if (sel) sel.value = status;
  });
}
window.abrirNovaTarefaNoStatus = abrirNovaTarefaNoStatus;

// Kanban: arrastar cartões entre colunas altera o status da tarefa.
function onTaskDragStart(e, idx) {
  window._tarefaArrastada = Number(idx);
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }
  e.currentTarget?.classList.add('dragging');
}
window.onTaskDragStart = onTaskDragStart;

function onTaskDragOver(e) {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  e.currentTarget?.classList.add('drag-over');
}
window.onTaskDragOver = onTaskDragOver;

function onTaskDragLeave(e) {
  e.currentTarget?.classList.remove('drag-over');
}
window.onTaskDragLeave = onTaskDragLeave;

function onTaskDrop(e, status) {
  e.preventDefault();
  e.currentTarget?.classList.remove('drag-over');
  let idx = window._tarefaArrastada;
  if (idx === undefined || idx === null || Number.isNaN(idx)) {
    idx = parseInt(e.dataTransfer?.getData('text/plain'));
  }
  window._tarefaArrastada = null;
  document.querySelectorAll('.kanban-card.dragging').forEach(c => c.classList.remove('dragging'));
  if (!Number.isInteger(idx) || idx < 0) return;
  moverTarefaStatus(idx, status);
}
window.onTaskDrop = onTaskDrop;

function renderTaskTable(tasks) {
  safeSetInner('tar-tbody', tasks.length
    ? tasks.map(t => {
        const atrasada = t._atrasada || tarefaTaAtrasada(t);
        const venceHoje = !atrasada && t.prazo === getTodayBR();
        const linhaCls = atrasada ? 'tarefa-atrasada' : (venceHoje ? 'tarefa-hoje' : '');
        const acaoConcluir = t.status === 'Concluída'
          ? `<button class="btn btn-secondary btn-sm" onclick="toggleTarefaConcluida(${t._idx})" title="Reabrir tarefa"><span class="material-symbols-outlined md-16">restart_alt</span> Reabrir</button>`
          : `<button class="btn btn-primary btn-sm" onclick="concluirTarefaRapida(${t._idx})" title="Concluir tarefa"><span class="material-symbols-outlined md-16">check</span> Concluir</button>`;
        const acaoIniciar = (!t.status || t.status === 'A fazer' || t.status === 'Pendente')
          ? `<button class="btn btn-secondary btn-sm" onclick="iniciarTarefa(${t._idx})" title="Iniciar tarefa"><span class="material-symbols-outlined md-16">play_arrow</span> Iniciar</button>`
          : '';
        return `<tr class="${linhaCls}">
          <td data-label="Cód."><span class="cod">${t.cod}</span></td>
          <td data-label="Obra">${obName(t.obra)}</td>
          <td data-label="Etapa / Frente"><small>${t.etapa || '—'}<br>${t.frente || '—'}</small></td>
          <td data-label="Descrição"><b>${t.desc}</b></td>
          <td data-label="Responsável">${t.resp || '—'}</td>
          <td data-label="Prior.">${statusBadge(t.prior)}</td>
          <td data-label="Status">${statusBadge(tarefaStatusEfetivo(t))}</td>
          <td data-label="Prazo">${fmtDate(t.prazo)}${atrasada ? ' <span class="tarefa-atrasada-tag">Atrasada</span>' : ''}</td>
          <td data-label="% Conc.">
            <div style="display:flex;align-items:center;gap:6px">
              <div class="progress-bar" style="width:60px;height:6px"><div class="progress-fill" style="width:${t.perc || 0}%;background:${t.perc >= 100 ? 'var(--green)' : atrasada ? 'var(--red)' : 'var(--accent2)'}"></div></div>
              <span style="font-size:11px">${t.perc || 0}%</span>
            </div>
          </td>
          <td>
            <div class="tarefa-acoes">
              ${acaoIniciar}
              ${acaoConcluir}
              ${t.photoUrl ? `<button type="button" class="btn btn-secondary btn-sm" onclick="openLightbox('${t.photoUrl}')" title="Ver evidência" aria-label="Ver evidência"><span class="material-symbols-outlined md-16">photo_camera</span> Foto</button>` : ''}
              <button class="btn btn-secondary btn-sm" onclick="editTarefa(${t._idx})" title="Editar tarefa" aria-label="Editar tarefa"><span class="material-symbols-outlined md-16">edit</span> Editar</button>
              <button class="btn btn-danger btn-sm" onclick="deleteItem('tarefas',${t._idx})">Excluir</button>
            </div>
          </td>
       </tr>`;
      }).join('')
    : uiEmptyState('Nenhuma Tarefa', 'Ajuste os filtros ou crie uma nova tarefa.', 'checklist', 'Nova Tarefa', 'openModal(\'modal-tarefa\')'));
}

function renderKanban(tasks) {
  const colOrder = ['Pendente', 'Em andamento', 'Concluída'];
  const colTitles = {
    'Pendente': '<span class="material-symbols-outlined md-18" style="vertical-align:middle;">checklist</span> Para Fazer',
    'Em andamento': '<span class="material-symbols-outlined md-18" style="vertical-align:middle;">construction</span> Em Andamento',
    'Concluída': '<span class="material-symbols-outlined md-18" style="vertical-align:middle;">check_circle</span> Concluída'
  };

  // "A fazer" (modal) e "Pendente" (legado) compartilham a primeira coluna.
  const bucket = (t) => {
    if (t.status === 'Concluída') return 'Concluída';
    if (t.status === 'Em andamento') return 'Em andamento';
    return 'Pendente';
  };

  let html = '';
  colOrder.forEach(cId => {
    const cItems = tasks.filter(t => bucket(t) === cId);
    html += `
      <div class="kanban-col">
        <div class="kanban-header">
          <h4>${colTitles[cId]}</h4>
          <div style="display:flex;align-items:center;gap:8px">
            <button class="btn btn-secondary btn-sm" onclick="abrirNovaTarefaNoStatus('${cId === 'Pendente' ? 'A fazer' : cId}')" title="Nova tarefa nesta coluna">+ Nova</button>
            <span class="badge badge-gray">${cItems.length}</span>
          </div>
        </div>
        <div class="kanban-cards" ondragover="onTaskDragOver(event)" ondragleave="onTaskDragLeave(event)" ondrop="onTaskDrop(event, '${cId}')">
          ${cItems.length ? cItems.map(t => {
            const atrasada = t._atrasada || tarefaTaAtrasada(t);
            return `
            <div class="kanban-card ${atrasada ? 'tarefa-atrasada' : (t.prazo === getTodayBR() ? 'tarefa-hoje' : '')}"
                 draggable="true" ondragstart="onTaskDragStart(event, ${t._idx})" ondragend="this.classList.remove('dragging')"
                 onclick="editTarefa(${t._idx})" title="Arraste para mudar o status">
              <div class="kanban-card-title">${t.desc}</div>
              <div class="kanban-card-meta">
                <span><span class="material-symbols-outlined md-16" style="vertical-align:middle;">person</span> ${t.resp || 'Sem responsável'}</span>
                <span><span class="material-symbols-outlined md-16" style="vertical-align:middle;">construction</span> ${obName(t.obra)}</span>
                <span><span class="material-symbols-outlined md-16" style="vertical-align:middle;">calendar_today</span> Prazo: ${fmtDate(t.prazo)}${atrasada ? ' · Atrasada' : ''}</span>
              </div>
              <div class="kanban-card-footer">
                ${statusBadge(t.prior)}
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="progress-bar" style="width:50px;height:4px"><div class="progress-fill" style="width:${t.perc || 0}%;background:${atrasada ? 'var(--red)' : 'var(--accent2)'}"></div></div>
                  <span style="font-size:10px;font-weight:600">${t.perc || 0}%</span>
                </div>
              </div>
              <div class="kanban-card-actions" onclick="event.stopPropagation()">
                ${t.status === 'Concluída'
                  ? `<button class="btn btn-secondary btn-sm" onclick="toggleTarefaConcluida(${t._idx})">Reabrir</button>`
                  : `<button class="btn btn-primary btn-sm" onclick="concluirTarefaRapida(${t._idx})">Concluir</button>`}
              </div>
            </div>`;
          }).join('') : '<div style="text-align:center; padding:30px; color:var(--text3); font-size:12px; font-style:italic">Vazio — arraste uma tarefa para cá</div>'}
        </div>
      </div>`;
  });
  safeSetInner('tar-board', html);
}

// ==================== MODAL ENTRADA ====================
function abrirModalEntrada() {
  const sel = document.getElementById('ent-item');
  if (sel) {
    sel.innerHTML = '<option value="">Selecione o item...</option>';
    (DB.estoque || []).forEach(e => {
      const saldo = (parseFloat(e.entrada) || 0) - (parseFloat(e.saida) || 0);
      sel.innerHTML += `<option value="${e.cod}">${e.mat} (${e.unid}) — saldo: ${saldo}</option>`;
    });
  }
  ['ent-quantidade', 'ent-vunit'].forEach(id => { const el = document.getElementById(id); if (el) el.value = id === 'ent-quantidade' ? '1' : '0'; });
  const motivo = document.getElementById('ent-motivo'); if (motivo) motivo.value = '';
  const obs = document.getElementById('ent-obs'); if (obs) obs.value = '';
  const el = document.getElementById('modal-entrada-estoque');
  if (el) el.style.display = 'flex';
}

function closeModalEntrada() {
  const el = document.getElementById('modal-entrada-estoque');
  if (el) el.style.display = 'none';
}

async function confirmarEntrada() {
  const codMat = document.getElementById('ent-item').value;
  const qtd = parseFloat(document.getElementById('ent-quantidade').value);
  const motivo = document.getElementById('ent-motivo').value.trim();
  if (!codMat) { toast('Selecione um item.', 'error'); return; }
  if (!qtd || qtd <= 0) { toast('Quantidade inválida.', 'error'); return; }
  if (!motivo) { toast('Informe o motivo/NF.', 'error'); return; }
  const e = DB.estoque.find(x => x.cod === codMat);

  // Canteiro não mexe no saldo diretamente: prepara a entrada e pede decisão.
  if (typeof window.desviarParaAprovacao === 'function') {
    const obs = document.getElementById('ent-obs')?.value || '';
    const desviado = await window.desviarParaAprovacao('movimentacao_estoque', {
      movimentacao: {
        data: new Date().toISOString().slice(0, 10), codMat,
        mat: e?.mat || codMat, obra: e?.obra || '', tipo: 'Entrada', qtd,
        obs: obs ? `${motivo} — ${obs}` : motivo
      }
    }, `Entrada de ${qtd} — ${e?.mat || codMat}`);
    if (desviado) { closeModalEntrada(); return; }
  }

  if (e) e.entrada = (parseFloat(e.entrada) || 0) + qtd;
  DB.movEstoque.push({
    data: today, codMat, mat: e?.mat || codMat, obra: e?.obra || '',
    tipo: 'Entrada', qtd, motivo, obs: document.getElementById('ent-obs')?.value || ''
  });
  closeModalEntrada();
  await persistDB();
  toast('Entrada registrada!');
  renderEstoque();
  renderMovEstoque();
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
            <button class="btn btn-secondary btn-sm" onclick="editEstoque(${i})" title="Editar material" aria-label="Editar material" style="margin-right:8px"><span class="material-symbols-outlined md-16">edit</span> Editar</button>
            <button class="btn btn-danger btn-sm" onclick="deleteItem('estoque',${i})">Excluir</button>
          </td>
        </tr>`;
    }).join('')
    : uiEmptyState('Estoque Zerado', 'Cadastre cimento, areia ou ferramentas no almoxarifado virtual.', 'inventory_2', 'Cadastrar Material', 'openModal(\'modal-estoque\')'));
}

// ==================== MOV. ESTOQUE ====================
function renderMovEstoque() {
  safeSetInner('movest-tbody', DB.movEstoque.length
    ? DB.movEstoque.map((m, i) => `<tr>
        <td>${fmtDate(m.data)}</td><td><span class="cod">${m.codMat}</span></td><td>${m.mat}</td>
        <td>${obName(m.obra)}</td>
        <td><span class="badge ${m.tipo === 'Entrada' ? 'badge-green' : m.tipo === 'Saída' ? 'badge-orange' : m.tipo === 'Retorno' ? 'badge-blue' : m.tipo.includes('Entrada') ? 'badge-blue' : 'badge-purple'}">${m.tipo}</span></td>
        <td>${m.qtd}</td><td>${m.frente || '—'}</td><td>${m.retirado || '—'}</td>
        <td>${m.autor || '—'}</td><td>${m.nf || '—'}</td>
        <td>${fmt(m.vunit)}</td><td>${fmt(m.vtotal)}</td><td>${m.obs || '—'}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editMovEstoque(${i})" title="Editar movimentação" aria-label="Editar movimentação" style="margin-right:8px"><span class="material-symbols-outlined md-16">edit</span> Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem('movEstoque',${i})">Excluir</button>
        </td>
      </tr>`).join('')
    : uiEmptyState('Sem Movimentações', 'O depósito não teve entradas ou saídas de materiais ainda.', 'sync', 'Registrar Movimento', 'openModal(\'modal-movest\')'));
}

// ==================== COMPRAS ====================
function renderCompras() {
  const tbody = document.getElementById('compras-tbody');
  if (!tbody) return;

  const comercial = typeof window.podeVerDadosComerciais === 'function'
    && window.podeVerDadosComerciais();
  const restrito = typeof window.requerAprovacao === 'function'
    && window.requerAprovacao();

  // Cabeçalho e linhas saem da mesma lista: acaba o desalinhamento de colunas.
  const colunas = [
    { titulo: 'Nº Ped.', celula: (c) => `<b>${escHtml(c.num || '')}</b>` },
    { titulo: 'Data Solic.', celula: (c) => fmtDate(c.data) },
    { titulo: 'Obra', celula: (c) => obName(c.obra) },
    { titulo: 'Material/Serviço', celula: (c) => `<span class="cod">${escHtml(c.mat || '')}</span>` },
    { titulo: 'Qtd.', celula: (c) => escHtml(c.qtd) },
    { titulo: 'Unid.', celula: (c) => escHtml(c.unid || '') },
    { titulo: 'Status', celula: (c) => statusBadge(c.status) }
  ];
  if (comercial) {
    colunas.push(
      { titulo: 'Fornecedor', celula: (c) => escHtml(window.dadoComercial(c, 'forn') || '—') },
      { titulo: 'Vl. Total', celula: (c) => fmt(window.dadoComercial(c, 'vtotal') || 0) },
      { titulo: 'Prazo Entrega', celula: (c) => fmtDate(window.dadoComercial(c, 'prazo')) }
    );
  }
  colunas.push(
    { titulo: 'Recebido?', celula: (c) => escHtml(c.receb ? fmtDate(c.receb) : '—') },
    { titulo: 'Conferido?', celula: (c) => escHtml(c.conf || '—') },
    { titulo: 'Evidência', celula: (c, i) => `<button class="btn btn-secondary btn-sm" onclick="verEvidenciaCompra(${i})" title="Ver fotos da obra"><span class="material-symbols-outlined md-16">photo_camera</span> Ver</button>` }
  );
  if (!restrito) {
    colunas.push({
      titulo: 'Ações',
      celula: (c, i) => `
        <button class="btn btn-secondary btn-sm" onclick="editCompra(${i})" title="Editar compra" aria-label="Editar compra" style="margin-right:8px"><span class="material-symbols-outlined md-16">edit</span> Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteItem('compras',${i})">Excluir</button>`
    });
  }

  const head = document.getElementById('compras-head');
  if (head) head.innerHTML = colunas.map(col => `<th>${col.titulo}</th>`).join('');

  tbody.innerHTML = DB.compras.length
    ? DB.compras.map((c, i) => `<tr>${colunas.map(col => `<td>${col.celula(c, i)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${colunas.length}">${uiEmptyState('Nenhuma Compra', 'Crie um pedido de material novo para acompanhar as entregas.', 'shopping_cart', 'Nova Compra', "openModal('modal-compra')")}</td></tr>`;
}

/** Abre a galeria já filtrada pela obra da compra (evidência de recebimento). */
async function verEvidenciaCompra(idx) {
  const c = DB.compras[idx];
  if (!c) return;
  await showPage('fotos');
  const filtro = document.getElementById('fotos-obra-filter');
  if (filtro && c.obra) {
    filtro.value = c.obra;
    renderFotos();
  }
  toast(`Evidência: obra ${obName(c.obra)}${c.etapa ? ' · ' + c.etapa : ''}.`, 'success');
}
window.verEvidenciaCompra = verEvidenciaCompra;


// ==================== FINANCEIRO ====================
window.toggleFinCustomDates = function () {
  const sel = document.getElementById('fin-view-type');
  const customDiv = document.getElementById('fin-custom-dates');
  const standardDivs = document.querySelectorAll('.fin-standard-dates');
  if (!sel || !customDiv) return;

  if (sel.value === 'custom') {
    customDiv.style.display = 'flex';
    standardDivs.forEach(d => d.style.display = 'none');
    // Popula datas padrão se vazias
    const iniEl = document.getElementById('fin-data-ini');
    const fimEl = document.getElementById('fin-data-fim');
    if (iniEl && !iniEl.value) {
      const hoje = new Date();
      const ini = new Date(hoje); ini.setDate(hoje.getDate() - 30);
      iniEl.value = ini.toISOString().split('T')[0];
    }
    if (fimEl && !fimEl.value) {
      fimEl.value = new Date().toISOString().split('T')[0];
    }
  } else {
    customDiv.style.display = 'none';
    standardDivs.forEach(d => d.style.display = '');
  }
};

window.applyFinCustomPeriod = function () {
  const iniEl = document.getElementById('fin-data-ini');
  const fimEl = document.getElementById('fin-data-fim');
  if (!iniEl?.value || !fimEl?.value) {
    toast('Selecione as datas inicial e final.', 'error');
    return;
  }
  if (iniEl.value > fimEl.value) {
    toast('A data inicial deve ser anterior à final.', 'error');
    return;
  }
  renderFinanceiro();
};

// ==================== FINANCEIRO (fonte única) ====================
const FIN_MAIN_CATEGORIES = ['mao-de-obra', 'empreiteiro', 'almoco', 'material'];

const finState = {
  categoria: 'todos',
  status: '',
  busca: '',
  groupBy: 'tipo',
  page: 1,
  pageSize: 25,
  periodLabel: '',
  selected: new Set(),
  expanded: new Set(),
  collapsedGroups: new Set()
};
window.finState = finState;

const finKey = (e) => `${e.source}:${e.idx}`;

function finCategoryMeta(key) {
  return (window.FIN_CATEGORIES || []).find(c => c.key === key) || { key: key || 'outros', label: 'Outros', icon: 'push_pin' };
}

function finCategoryBadgeClass(key) {
  return {
    'mao-de-obra': 'badge-blue',
    'empreiteiro': 'badge-orange',
    'almoco': 'badge-yellow',
    'material': 'badge-gray',
    'outros': 'badge-gray'
  }[key] || 'badge-gray';
}

function finObraName(cod) {
  const o = (DB.obras || []).find(x => x.cod === cod);
  return o ? o.nome : (cod || 'Geral');
}

function finText(v) {
  const t = (!v || v === 'undefined' || v === 'indefinido') ? '—' : v;
  return (typeof escapeHTML === 'function') ? escapeHTML(String(t)) : String(t);
}

function finEntriesMap() {
  const map = new Map();
  ((window._finSummary && window._finSummary.all) || []).forEach(e => map.set(finKey(e), e));
  return map;
}

function finWeekLabel(dateStr) {
  if (window.getPeriodLabel) return window.getPeriodLabel(dateStr, 'semanal');
  return 'Semana';
}

function finDerivedStatus(entries) {
  if (!entries.length) return 'Pendente';
  if (entries.every(e => e.status === 'Pago')) return 'Pago';
  if (entries.some(e => e.jaPago > 0)) return 'Parcial';
  if (entries.some(e => e.status === 'Atrasado')) return 'Atrasado';
  return 'Pendente';
}

function finStatusMatches(entry, status) {
  if (!status) return true;
  if (status === 'pago') return entry.status === 'Pago';
  if (status === 'a-pagar') return entry.status !== 'Pago' && entry.pendente > 0;
  if (status === 'parcial') return entry.status === 'Parcial';
  if (status === 'atrasado') return entry.status === 'Atrasado';
  return true;
}

function finBuscaMatches(entry) {
  if (!finState.busca) return true;
  const hay = [
    entry.data, fmtDate(entry.data), entry.obra, finObraName(entry.obra),
    entry.tipo, entry.desc, entry.benef, entry.etapa, entry.nf, entry.pgto, entry.obs
  ].join(' ').toLowerCase();
  return hay.includes(finState.busca.toLowerCase());
}

function finValueHtml(entry) {
  const color = entry.valor < 0 ? 'var(--red)' : 'var(--text)';
  let sub = '<span style="color:var(--orange)">A pagar</span>';
  if (entry.status === 'Pago') {
    sub = '<span style="color:var(--green)">Pago</span>';
  } else if (entry.jaPago > 0) {
    sub = `<span style="color:var(--orange)">Pago ${fmt(entry.jaPago)} · falta ${fmt(entry.pendente)}</span>`;
  }
  return `<b style="color:${color}">${fmt(entry.valor)}</b><br><small>${sub}</small>`;
}

function renderFinKpis(summary) {
  const el = document.getElementById('fin-kpis');
  if (!el) return;

  const card = (label, value, extraClass, active, onclick, sub) => `
    <div class="kpi-card fin-kpi ${extraClass || ''} ${active ? 'active' : ''}" onclick="${onclick}" role="button" tabindex="0">
      <div class="kpi-label">${label}</div>
      <div class="kpi-val">${value}</div>
      <div class="kpi-sub">${sub || ''}</div>
    </div>`;

  const isCustom = document.getElementById('fin-view-type')?.value === 'custom';
  const totalLabel = isCustom ? 'Total do período' : 'Total do mês';
  let html = card(totalLabel, fmt(summary.kpis.total), '', finState.categoria === 'todos' && !finState.status, 'clearFinFilters()', `${finState.periodLabel} · ${summary.kpis.count} lançamentos`);
  html += card('Pago', fmt(summary.kpis.pago), 'fin-kpi-success', finState.status === 'pago', "setFinStatus('pago')", 'Baixas confirmadas');
  html += card('A pagar', fmt(summary.kpis.aPagar), 'fin-kpi-danger', finState.status === 'a-pagar', "setFinStatus('a-pagar')", 'Saldo em aberto');

  FIN_MAIN_CATEGORIES.forEach(key => {
    const cat = summary.byCategory[key];
    if (!cat) return;
    html += card(`<span class="material-symbols-outlined md-18" style="vertical-align:middle;">${cat.icon}</span>${cat.label}`, fmt(cat.total), '', finState.categoria === key, `setFinCategory('${key}')`, `${cat.count} lançamentos · ${fmt(cat.aPagar)} a pagar`);
  });

  const outros = summary.byCategory.outros;
  if (outros && outros.count > 0) {
    html += card(`<span class="material-symbols-outlined md-18" style="vertical-align:middle;">${outros.icon}</span>${outros.label}`, fmt(outros.total), '', finState.categoria === 'outros', "setFinCategory('outros')", `${outros.count} lançamentos · ${fmt(outros.aPagar)} a pagar`);
  }

  el.innerHTML = html;
}

function renderFinTabs(summary) {
  const el = document.getElementById('fin-tabs');
  if (!el) return;

  const tabs = [{ key: 'todos', label: 'Todos', icon: 'list_alt', count: summary.all.length }];
  FIN_MAIN_CATEGORIES.forEach(key => {
    const cat = summary.byCategory[key];
    if (cat) tabs.push({ key, label: cat.label, icon: cat.icon, count: cat.count });
  });
  if (summary.byCategory.outros && summary.byCategory.outros.count > 0) {
    tabs.push({ key: 'outros', label: summary.byCategory.outros.label, icon: summary.byCategory.outros.icon, count: summary.byCategory.outros.count });
  }

  el.innerHTML = tabs.map(t => `
    <button type="button" class="fin-tab ${finState.categoria === t.key ? 'active' : ''}" onclick="setFinCategory('${t.key}')">
      <span class="material-symbols-outlined md-18" style="vertical-align:middle;">${t.icon}</span>${t.label}<span class="count">${t.count}</span>
    </button>`).join('');
}

function finSelectedEntries() {
  const map = finEntriesMap();
  return [...finState.selected].map(k => map.get(k)).filter(Boolean);
}

function renderFinBulkBar() {
  const bar = document.getElementById('fin-bulk-bar');
  if (!bar) return;

  const entries = finSelectedEntries();
  if (!entries.length) {
    bar.style.display = 'none';
    bar.innerHTML = '';
    return;
  }

  const pendentes = entries.filter(e => e.status !== 'Pago' && e.pendente > 0);
  const total = entries.reduce((a, e) => a + (Number(e.valor) || 0), 0);
  const totalPendente = pendentes.reduce((a, e) => a + (Number(e.pendente) || 0), 0);

  bar.style.display = 'flex';
  bar.innerHTML = `
    <b>${entries.length} selecionado(s)</b>
    <span>Total: ${fmt(total)}</span>
    <span class="fin-bulk-total">A pagar: ${fmt(totalPendente)}</span>
    <div style="flex:1"></div>
    <button class="btn btn-secondary btn-sm" onclick="bulkMarcarPago()" ${pendentes.length ? '' : 'disabled'}><span class="material-symbols-outlined md-16">check_circle</span> Marcar como pago</button>
    <button class="btn btn-primary btn-sm" data-feature="pix.folha" onclick="bulkPagarPix()" ${pendentes.length ? '' : 'disabled'}><span class="material-symbols-outlined md-16">payments</span> Pagar por PIX (${pendentes.length})</button>
    <button class="btn btn-secondary btn-sm" onclick="clearFinSelection()">Limpar</button>
  `;
}

function finEntryActions(entry) {
  const source = entry.source;
  const idx = entry.idx;
  const key = finKey(entry);
  let items = '';
  const editMap = {
    fin: `editFinanceiro(${idx})`,
    pre: `editPresenca(${idx})`,
    med: `editMedicao(${idx})`,
    alm: `editAlmoco(${idx})`
  };
  if (editMap[source]) items += `<button onclick="${editMap[source]}"><span class="material-symbols-outlined md-16" style="vertical-align:middle;margin-right:4px;">edit</span>Editar</button>`;

  if (entry.status !== 'Pago' && entry.pendente > 0) {
    items += `<button data-feature="pix.folha" onclick="initiatePixPayment('${source}', ${idx})"><span class="material-symbols-outlined md-16" style="vertical-align:middle;margin-right:4px;">payments</span>Pagar via PIX</button>`;
    items += `<button onclick="markFinEntryPaid('${key}')"><span class="material-symbols-outlined md-16" style="vertical-align:middle;margin-right:4px;">check_circle</span>Marcar como pago</button>`;
  }
  items += `<button class="danger" onclick="deleteFinEntry('${source}', ${idx})"><span class="material-symbols-outlined md-16" style="vertical-align:middle;">delete</span> Excluir</button>`;

  return `<details class="fin-actions" onclick="event.stopPropagation()">
    <summary title="Ações" aria-label="Ações">⋯</summary>
    <div class="fin-actions-menu">${items || '<button disabled>Sem ações</button>'}</div>
  </details>`;
}

function finDetailRow(entry) {
  const diff = entry.valor - entry.prev;
  const diffColor = diff > 0 ? 'var(--red)' : diff < 0 ? 'var(--green)' : 'var(--text)';
  return `<tr class="fin-detail-row">
    <td colspan="7">
      <div class="fin-detail-grid">
        <div>Etapa<b>${finText(entry.etapa)}</b></div>
        <div>Valor previsto<b>${fmt(entry.prev)}</b></div>
        <div>Forma pgto<b>${finText(entry.pgto)}</b></div>
        <div>NF / Comprovante<b>${finText(entry.nf)}</b></div>
        <div>Observações<b>${finText(entry.obs)}</b></div>
        ${entry.hasPrev ? `<div>Diferença<b style="color:${diffColor}">${fmt(diff)}</b></div>` : ''}
      </div>
    </td>
  </tr>`;
}

function finEntryRow(entry, options = {}) {
  const key = finKey(entry);
  const checked = finState.selected.has(key) ? 'checked' : '';
  const expanded = finState.expanded.has(key);
  const detailToggle = entry.manual
    ? `<button class="fin-group-toggle" onclick="toggleFinDetail('${key}')" title="Ver detalhes">${expanded ? '<span class="material-symbols-outlined md-16" style="vertical-align:middle;">expand_more</span>' : '<span class="material-symbols-outlined md-16" style="vertical-align:middle;">chevron_right</span>'}</button>`
    : '';
  const childClass = options.child ? 'fin-child-row' : 'fin-row';
  const catBadge = finCategoryBadgeClass(entry.categoria);
  const autoTag = entry.auto ? '<span class="badge badge-gray fin-tag">Automático</span>' : '';

  let html = `<tr class="${childClass}">
    <td data-label="Data">
      <input type="checkbox" class="fin-check" ${checked} onchange="toggleFinSelect('${key}', this.checked)">
      ${detailToggle}${fmtDate(entry.data)}
    </td>
    <td data-label="Obra">${finText(finObraName(entry.obra))}</td>
    <td data-label="Descrição">
      <span class="badge ${catBadge} fin-tag">${finText(entry.tipo)}</span>
      <b>${finText(entry.desc)}</b>${autoTag}
    </td>
    <td data-label="Beneficiário">${finText(entry.benef)}</td>
    <td data-label="Valor" style="text-align:right">${finValueHtml(entry)}</td>
    <td data-label="Status">${statusBadge(entry.status)}</td>
    <td data-label="Ações" style="text-align:center">${finEntryActions(entry)}</td>
  </tr>`;

  if (entry.manual && expanded) html += finDetailRow(entry);
  return html;
}

function finLaborGroupHtml(unit, unitIndex) {
  const expanded = finState.expanded.has(unit.key);
  const allSelected = unit.entries.every(e => finState.selected.has(finKey(e)));
  const obras = [...new Set(unit.entries.map(e => finObraName(e.obra)))].join(', ');
  const pseudoEntry = {
    valor: unit.valor, jaPago: unit.jaPago, pendente: unit.pendente, status: finDerivedStatus(unit.entries)
  };

  let html = `<tr class="fin-row fin-labor-row">
    <td data-label="Data">
      <input type="checkbox" class="fin-check" ${allSelected ? 'checked' : ''} onchange="toggleFinGroupSelection(${unitIndex}, this.checked)">
      <button class="fin-group-toggle" onclick="toggleFinLabor(${unitIndex})" title="Expandir diárias">${expanded ? '<span class="material-symbols-outlined md-16" style="vertical-align:middle;">expand_more</span>' : '<span class="material-symbols-outlined md-16" style="vertical-align:middle;">chevron_right</span>'}</button>
      ${fmtDate(unit.entries[0]?.data)}
    </td>
    <td data-label="Obra">${finText(obras)}</td>
    <td data-label="Descrição">
      <span class="badge badge-blue fin-tag">Diária</span>
      <b>${finText(unit.benef)}</b>
      <small style="color:var(--text3)"> · ${unit.week} · ${unit.entries.length} diária(s)</small>
    </td>
    <td data-label="Beneficiário">${finText(unit.benef)}</td>
    <td data-label="Valor" style="text-align:right">${finValueHtml(pseudoEntry)}</td>
    <td data-label="Status">${statusBadge(pseudoEntry.status)}</td>
    <td data-label="Ações" style="text-align:center">
      <details class="fin-actions" onclick="event.stopPropagation()">
        <summary title="Ações" aria-label="Ações">⋯</summary>
        <div class="fin-actions-menu">
          <button onclick="toggleFinLabor(${unitIndex})">${expanded ? '<span class="material-symbols-outlined md-16" style="vertical-align:middle;">expand_less</span> Recolher' : '<span class="material-symbols-outlined md-16" style="vertical-align:middle;">expand_more</span> Ver'} diárias</button>
          ${unit.pendente > 0 ? `<button onclick="markFinUnitPaid(${unitIndex})"><span class="material-symbols-outlined md-16" style="vertical-align:middle;">check_circle</span> Marcar grupo como pago</button>` : ''}
        </div>
      </details>
    </td>
  </tr>`;

  if (expanded) {
    html += unit.entries.map(e => finEntryRow(e, { child: true })).join('');
  }
  return html;
}

function finGroupHeaderHtml(unit, unitIndex) {
  const collapsed = finState.collapsedGroups.has(unit.groupKey);
  const allSelected = unit.entries.every(e => finState.selected.has(finKey(e)));
  return `<tr class="fin-group-row">
    <td colspan="7">
      <div class="fin-group-label">
        <input type="checkbox" class="fin-check" ${allSelected ? 'checked' : ''} onchange="toggleFinGroupSelection(${unitIndex}, this.checked)">
        <button class="fin-group-toggle" onclick="toggleFinGroupCollapse(${unitIndex})" title="Recolher/expandir grupo">${collapsed ? '<span class="material-symbols-outlined md-16" style="vertical-align:middle;">chevron_right</span>' : '<span class="material-symbols-outlined md-16" style="vertical-align:middle;">expand_more</span>'}</button>
        <span>${unit.label}</span>
        <span class="badge badge-gray">${unit.entries.length}</span>
        <span class="fin-group-total">Total ${fmt(unit.total)} · A pagar ${fmt(unit.aPagar)}</span>
      </div>
    </td>
  </tr>`;
}

function finBuildUnits(entries) {
  const groups = new Map();
  entries.forEach(e => {
    const rawKey = finState.groupBy === 'obra' ? (e.obra || 'Geral') : e.categoria;
    if (!groups.has(rawKey)) groups.set(rawKey, []);
    groups.get(rawKey).push(e);
  });

  let keys = [...groups.keys()];
  if (finState.groupBy === 'tipo') {
    keys.sort((a, b) => {
      const order = [...FIN_MAIN_CATEGORIES, 'outros'];
      return order.indexOf(a) - order.indexOf(b);
    });
  } else {
    keys.sort((a, b) => finObraName(a).localeCompare(finObraName(b)));
  }

  const units = [];
  keys.forEach(rawKey => {
    const groupEntries = groups.get(rawKey);
    const groupKey = `${finState.groupBy}:${rawKey}`;
    units.push({
      kind: 'group',
      groupKey,
      label: finState.groupBy === 'obra'
        ? `<span class="material-symbols-outlined md-16" style="vertical-align:middle;">construction</span> ${finText(finObraName(rawKey))}`
        : `${finCategoryMeta(rawKey).icon} ${finCategoryMeta(rawKey).label}`,
      entries: groupEntries,
      total: groupEntries.reduce((a, e) => a + (Number(e.valor) || 0), 0),
      aPagar: groupEntries.reduce((a, e) => a + (Number(e.pendente) || 0), 0)
    });

    if (finState.collapsedGroups.has(groupKey)) return;

    const laborGroups = new Map();
    groupEntries.forEach(e => {
      if (e.categoria === 'mao-de-obra' && e.source === 'pre') {
        const wk = finWeekLabel(e.data);
        const k = `${e.benef}|${wk}`;
        if (!laborGroups.has(k)) {
          const unit = {
            kind: 'labor',
            key: `labor:${k}`,
            benef: e.benef || 'Trabalhador',
            week: wk,
            entries: [],
            valor: 0,
            jaPago: 0,
            pendente: 0
          };
          laborGroups.set(k, unit);
          units.push(unit);
        }
        const unit = laborGroups.get(k);
        unit.entries.push(e);
        unit.valor += Number(e.valor) || 0;
        unit.jaPago += Number(e.jaPago) || 0;
        unit.pendente += Number(e.pendente) || 0;
      } else {
        units.push({ kind: 'row', key: finKey(e), entry: e });
      }
    });
  });
  return units;
}

function renderFinPagination(totalUnits, page, totalPages, start, end) {
  const el = document.getElementById('fin-pagination');
  if (!el) return;
  if (!totalUnits) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `
    <span>Exibindo ${start + 1}–${end} de ${totalUnits} linha(s)</span>
    <div class="fin-page-buttons">
      <button class="btn btn-secondary btn-sm" onclick="setFinPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}><span class="material-symbols-outlined md-16" style="vertical-align:middle;">arrow_back_ios</span> Anterior</button>
      <span>Página ${page} de ${totalPages}</span>
      <button class="btn btn-secondary btn-sm" onclick="setFinPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Próxima <span class="material-symbols-outlined md-16" style="vertical-align:middle;">arrow_forward_ios</span></button>
    </div>`;
}

function renderFinTable(summary) {
  const tbody = document.getElementById('fin-tbody');
  if (!tbody) return;
  const tfoot = document.getElementById('fin-tfoot');

  const filtered = (summary.all || []).filter(e => {
    if (finState.categoria !== 'todos' && e.categoria !== finState.categoria) return false;
    if (!finStatusMatches(e, finState.status)) return false;
    if (!finBuscaMatches(e)) return false;
    return true;
  });

  filtered.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || String(a.source).localeCompare(String(b.source)) || a.idx - b.idx);

  const units = finBuildUnits(filtered);
  window._finUnits = units;

  const total = filtered.reduce((a, e) => a + (Number(e.valor) || 0), 0);
  const totalAPagar = filtered.reduce((a, e) => a + (Number(e.pendente) || 0), 0);

  if (tfoot) {
    tfoot.innerHTML = filtered.length
      ? `<tr style="font-weight:700;background:var(--bg1);border-top:2px solid var(--accent)">
          <td colspan="4" style="text-align:right">Total do filtro (${filtered.length})</td>
          <td style="text-align:right">${fmt(total)}<br><small style="color:var(--orange)">A pagar ${fmt(totalAPagar)}</small></td>
          <td colspan="2"></td>
        </tr>`
      : '';
  }

  if (!units.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7" style="text-align:center;padding:36px;color:var(--text3)">Nenhum lançamento encontrado para os filtros atuais.</td></tr>';
    renderFinPagination(0, 1, 1, 0, 0);
    return;
  }

  const pageSize = finState.pageSize > 0 ? finState.pageSize : units.length;
  const totalPages = Math.max(1, Math.ceil(units.length / pageSize));
  if (finState.page > totalPages) finState.page = totalPages;
  if (finState.page < 1) finState.page = 1;
  const start = (finState.page - 1) * pageSize;
  const end = Math.min(units.length, start + pageSize);

  const indexed = units.map((u, i) => ({ u, i })).slice(start, end);
  tbody.innerHTML = indexed.map(({ u, i }) => {
    if (u.kind === 'group') return finGroupHeaderHtml(u, i);
    if (u.kind === 'labor') return finLaborGroupHtml(u, i);
    return finEntryRow(u.entry);
  }).join('');

  renderFinPagination(units.length, finState.page, totalPages, start, end);
}

function renderFinanceiro() {
  const selMonth = document.getElementById('fin-month');
  const selYear = document.getElementById('fin-year');
  const selView = document.getElementById('fin-view-type');
  if (!selMonth || !selYear || !selView) return;

  if (selYear.options.length === 0) {
    const curY = new Date().getFullYear();
    [curY, curY - 1, curY - 2].forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      selYear.appendChild(opt);
    });
    selMonth.value = new Date().getMonth() + 1;
    selYear.value = curY;
  }

  const mm = selMonth.value;
  const yy = selYear.value;
  const view = selView.value;
  window.finViewType = view;

  const subtitles = { mes: 'Fluxo Mensal', custom: 'Período Personalizado' };
  const subtitle = document.getElementById('fin-period-subtitle');
  if (subtitle) subtitle.textContent = subtitles[view] || 'Fluxo de Caixa';

  const customIni = document.getElementById('fin-data-ini')?.value;
  const customFim = document.getElementById('fin-data-fim')?.value;

  let options;
  let periodLabel;
  if (view === 'custom' && customIni && customFim) {
    options = { dataInicio: customIni, dataFim: customFim, viewType: 'semanal' };
    periodLabel = `${fmtDate(customIni)} a ${fmtDate(customFim)}`;
  } else {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    options = { ano: yy, mes: mm, viewType: 'semanal' };
    periodLabel = `${monthNames[Number(mm) - 1]}/${yy}`;
  }
  finState.periodLabel = periodLabel;

  const summary = window.summarizeFinanceCosts
    ? window.summarizeFinanceCosts(DB.financeiro, DB.presenca, DB.medicao, DB.almocos, options)
    : { all: [], byCategory: {}, kpis: { total: 0, pago: 0, aPagar: 0, count: 0 } };
  window._finSummary = summary;
  window._allFinRows = summary.all || [];

  // Remove seleções que não existem mais no período
  const validKeys = new Set((summary.all || []).map(finKey));
  [...finState.selected].forEach(k => { if (!validKeys.has(k)) finState.selected.delete(k); });

  if (finState.categoria !== 'todos' && !summary.byCategory[finState.categoria]) {
    finState.categoria = 'todos';
  }

  renderFinKpis(summary);
  renderFinTabs(summary);
  renderFinBulkBar();
  renderFinTable(summary);
  updateFinGroupButtons();

  const statusEl = document.getElementById('fin-status-filter');
  if (statusEl && statusEl.value !== finState.status) statusEl.value = finState.status;
  const buscaEl = document.getElementById('fin-busca');
  if (buscaEl && buscaEl.value !== finState.busca) buscaEl.value = finState.busca;
  const sizeEl = document.getElementById('fin-page-size');
  if (sizeEl) sizeEl.value = String(finState.pageSize);
}
window.renderFinanceiro = renderFinanceiro;

function updateFinGroupButtons() {
  const tipo = document.getElementById('fin-group-tipo');
  const obra = document.getElementById('fin-group-obra');
  if (tipo) tipo.classList.toggle('active', finState.groupBy === 'tipo');
  if (obra) obra.classList.toggle('active', finState.groupBy === 'obra');
}

// Filtros
function filterFinanceiro() {
  finState.status = document.getElementById('fin-status-filter')?.value || '';
  finState.busca = document.getElementById('fin-busca')?.value || '';
  finState.page = 1;
  renderFinanceiro();
}
window.filterFinanceiro = filterFinanceiro;

window.setFinCategory = function (key) {
  finState.categoria = finState.categoria === key ? 'todos' : key;
  finState.page = 1;
  renderFinanceiro();
};

window.setFinStatus = function (status) {
  finState.status = finState.status === status ? '' : status;
  finState.page = 1;
  renderFinanceiro();
};

window.clearFinFilters = function () {
  finState.categoria = 'todos';
  finState.status = '';
  finState.page = 1;
  renderFinanceiro();
};

window.setFinGroup = function (groupBy) {
  finState.groupBy = groupBy === 'obra' ? 'obra' : 'tipo';
  finState.page = 1;
  renderFinanceiro();
};

window.setFinPageSize = function (value) {
  finState.pageSize = parseInt(value, 10) || 0;
  finState.page = 1;
  renderFinanceiro();
};

window.setFinPage = function (page) {
  finState.page = Math.max(1, parseInt(page, 10) || 1);
  renderFinanceiro();
};

// Seleção
window.toggleFinSelect = function (key, checked) {
  if (checked) finState.selected.add(key);
  else finState.selected.delete(key);
  renderFinanceiro();
};

window.toggleFinGroupSelection = function (unitIndex, checked) {
  const unit = (window._finUnits || [])[unitIndex];
  if (!unit || !unit.entries) return;
  unit.entries.forEach(e => {
    if (checked) finState.selected.add(finKey(e));
    else finState.selected.delete(finKey(e));
  });
  renderFinanceiro();
};

window.clearFinSelection = function () {
  finState.selected.clear();
  renderFinanceiro();
};

// Expansão
window.toggleFinDetail = function (key) {
  if (finState.expanded.has(key)) finState.expanded.delete(key);
  else finState.expanded.add(key);
  renderFinanceiro();
};

window.toggleFinLabor = function (unitIndex) {
  const unit = (window._finUnits || [])[unitIndex];
  if (!unit) return;
  if (finState.expanded.has(unit.key)) finState.expanded.delete(unit.key);
  else finState.expanded.add(unit.key);
  renderFinanceiro();
};

window.toggleFinGroupCollapse = function (unitIndex) {
  const unit = (window._finUnits || [])[unitIndex];
  if (!unit || !unit.groupKey) return;
  if (finState.collapsedGroups.has(unit.groupKey)) finState.collapsedGroups.delete(unit.groupKey);
  else finState.collapsedGroups.add(unit.groupKey);
  renderFinanceiro();
};

// Baixas
function finApplyPaid(entry) {
  if (!entry || entry.status === 'Pago' || !(entry.pendente > 0)) return false;
  if (entry.source === 'fin') {
    const f = DB.financeiro[entry.idx];
    if (!f) return false;
    f.status = 'Pago';
    f.valpago = entry.valor;
    return true;
  }
  if (entry.source === 'pre') {
    const p = DB.presenca[entry.idx];
    if (!p) return false;
    p.pgtoStatus = 'Pago';
    p.valpago = entry.valor;
    return true;
  }
  if (entry.source === 'med') {
    const m = DB.medicao[entry.idx];
    if (!m) return false;
    m.pgtoStatus = 'Pago';
    m.valpago = entry.valor;
    return true;
  }
  if (entry.source === 'alm') {
    const a = DB.almocos[entry.idx];
    if (!a) return false;
    a.pgtoStatus = 'Pago';
    a.valpago = entry.valor;
    return true;
  }
  return false;
}

async function finAfterPayment() {
  finState.selected.clear();
  await persistDB();
  renderFinanceiro();
  if (typeof renderDashboard === 'function') renderDashboard();
}

window.markFinEntryPaid = async function (key) {
  const entry = finEntriesMap().get(key);
  if (!finApplyPaid(entry)) { toast('Este lançamento não está pendente.', 'info'); return; }
  await finAfterPayment();
  toast('Lançamento marcado como pago.');
};

window.markFinUnitPaid = async function (unitIndex) {
  const unit = (window._finUnits || [])[unitIndex];
  if (!unit || !unit.entries) return;
  let changed = 0;
  unit.entries.forEach(e => { if (finApplyPaid(e)) changed++; });
  if (!changed) { toast('Nenhum lançamento pendente neste grupo.', 'info'); return; }
  await finAfterPayment();
  toast(`${changed} lançamento(s) marcado(s) como pago.`);
};

window.bulkMarcarPago = async function () {
  const entries = finSelectedEntries().filter(e => e.status !== 'Pago' && e.pendente > 0);
  if (!entries.length) { toast('Nenhum lançamento pendente selecionado.', 'info'); return; }
  let changed = 0;
  entries.forEach(e => { if (finApplyPaid(e)) changed++; });
  await finAfterPayment();
  toast(`${changed} lançamento(s) marcado(s) como pago.`);
};

window.bulkPagarPix = function () {
  if (typeof window.requireFeature === 'function' && !window.requireFeature('pix.folha')) return;
  const entries = finSelectedEntries().filter(e => e.status !== 'Pago' && e.pendente > 0);
  if (!entries.length) { toast('Nenhum lançamento pendente selecionado.', 'info'); return; }
  window._finPixQueue = entries.map(e => ({ source: e.source, idx: e.idx, amount: e.pendente }));
  openNextFinPix();
};

window.openNextFinPix = function () {
  const queue = window._finPixQueue;
  if (!queue || !queue.length) {
    window._finPixQueue = null;
    finState.selected.clear();
    renderFinanceiro();
    return;
  }
  const item = queue.shift();
  if (typeof initiatePixPayment === 'function') {
    initiatePixPayment(item.source, item.idx, { amount: item.amount, bulk: true });
  }
};

window.cancelFinPixQueue = function () {
  window._finPixQueue = null;
};

window.deleteFinEntry = function (source, idx) {
  const tableMap = { fin: 'financeiro', pre: 'presenca', med: 'medicao', alm: 'almocos' };
  const table = tableMap[source];
  if (!table || typeof deleteItem !== 'function') return;
  deleteItem(table, idx);
};

// Limpar filtro de período (volta para o mês)
function clearFinDateFilter() {
  const ini = document.getElementById('fin-data-ini');
  const fim = document.getElementById('fin-data-fim');
  const view = document.getElementById('fin-view-type');
  if (ini) ini.value = '';
  if (fim) fim.value = '';
  if (view) view.value = 'mes';
  if (typeof toggleFinCustomDates === 'function') toggleFinCustomDates();
  renderFinanceiro();
}
window.clearFinDateFilter = clearFinDateFilter;

// Helper para determinar semana/período de uma data
window.getSemanaPeriodo = function (dataStr, year, month, viewType) {
  if (!dataStr) return null;
  const d = Number(dataStr.split('-')[2]);
  if (viewType === 'quinzenal') {
    return d <= 15 ? '1ª Quinzena' : '2ª Quinzena';
  }
  return `Semana ${Math.ceil(d / 7)}`;
};

// Mantido por compatibilidade com chamadas antigas
window.filtrarSemanaFinanceiro = function (semana) {
  window._finSemanaSelecionada = semana || null;
  renderFinanceiro();
  toast(semana ? `Filtrando: ${semana}` : 'Filtro limpo', 'info');
};

// ==================== EXPORT FUNCTIONS ====================
function exportarImagemDashboard() {
  if (typeof window.requireFeature === 'function' && !window.requireFeature('exportacao')) return;
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
function orcEsc(v) {
  return window.escHtml ? window.escHtml(v) : String(v == null ? '' : v);
}

function orcPct(value) {
  return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`;
}

function renderOrcamento() {
  const sel = document.getElementById('orc-filtro-obra');
  if (sel) {
    const anterior = sel.value;
    sel.innerHTML = '<option value="">Todas as obras</option>' +
      (DB.obras || []).map(o => `<option value="${orcEsc(o.cod)}">${orcEsc(o.nome || o.cod)}</option>`).join('');
    if (anterior && [...sel.options].some(o => o.value === anterior)) sel.value = anterior;
    else if ((DB.obras || []).length && !anterior) sel.value = DB.obras[0].cod;
  }
  const obra = sel?.value || '';
  const board = window.buildOrcamentoBoard
    ? window.buildOrcamentoBoard(DB, { obra })
    : { grupos: [], totais: { qtd: 0, medidoQtd: 0, prev: 0, medido: 0, pago: 0, aPagar: 0 } };

  const html = board.grupos.length
    ? board.grupos.map(g => {
      const gk = orcEsc(g.key);
      const head = `<tr class="orc-group" data-orc-group="${gk}">
        <td colspan="12"><b>${orcEsc(g.etapa || 'Sem etapa')}</b>${g.subEtapa ? ` <span class="orc-subetapa">${orcEsc(g.subEtapa)}</span>` : ''}</td>
      </tr>`;
      const linhas = g.servicos.map(o => {
        const busca = [o.etapa, o.subEtapa, o.desc, o.empreiteiro, o.tipo, o.unid, obName(o.obra)]
          .filter(Boolean).join(' ').toLowerCase();
        return `<tr class="orc-service" data-orc-group="${gk}" data-orc-search="${orcEsc(busca)}">
          <td>${obra ? orcEsc(g.subEtapa || '—') : `${orcEsc(obName(o.obra))}<br><span class="med-muted">${orcEsc(g.subEtapa || '—')}</span>`}</td>
          <td><b>${orcEsc(o.desc || 'Serviço')}</b></td>
          <td>${orcEsc(o.empreiteiro || '—')}</td>
          <td>${orcEsc(o.unid || '—')}</td>
          <td class="num">${o.qtd || 0}</td>
          <td class="num">${fmt(o.vunit)}</td>
          <td class="num">${fmt(o.vtotal)}</td>
          <td class="num">${fmt(o.medidoValor)}<small class="orc-med-qtd">${o.medidoQtd || 0} ${orcEsc(o.unid || '')}</small></td>
          <td class="num">${fmt(o.pago)}</td>
          <td class="num">${fmt(o.aPagar)}</td>
          <td>${orcPct(o.pct)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="editOrcamento(${o._idx})" title="Editar serviço">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="deleteItem('orcamento',${o._idx})">Excluir</button>
          </td>
        </tr>`;
      }).join('');
      const st = g.subtotais;
      const semVinculo = g.semVinculo
        ? `<tr class="orc-avulso" data-orc-group="${gk}"><td colspan="8">Custos da etapa sem serviço vinculado</td><td class="num">${fmt(g.semVinculo.pago)}</td><td class="num">${fmt(g.semVinculo.aPagar)}</td><td colspan="2"></td></tr>`
        : '';
      const subtotal = `<tr class="orc-subtotal" data-orc-group="${gk}">
        <td colspan="4">Subtotal ${orcEsc(g.etapa || 'Sem etapa')}${g.subEtapa ? ` · ${orcEsc(g.subEtapa)}` : ''}</td>
        <td class="num">${st.qtd}</td><td></td><td class="num">${fmt(st.prev)}</td>
        <td class="num">${fmt(st.medido)}</td><td class="num">${fmt(st.pago)}</td><td class="num">${fmt(st.aPagar)}</td>
        <td colspan="2"></td>
      </tr>`;
      return head + linhas + semVinculo + subtotal;
    }).join('')
    : uiEmptyState('Sem Orçamento', 'Cadastre os serviços contratados para comparar previsto, medido e pago.', 'square_foot', 'Novo Serviço', 'openModal(\'modal-orcamento\')');

  safeSetInner('orc-tbody', html);
  filterOrcamento();
}
window.renderOrcamento = renderOrcamento;

function filterOrcamento() {
  const tbody = document.getElementById('orc-tbody');
  if (!tbody) return;
  const termo = (document.getElementById('orc-busca')?.value || '').toLowerCase().trim();
  const servicos = [...tbody.querySelectorAll('tr.orc-service')];
  servicos.forEach(linha => {
    linha.style.display = (!termo || (linha.dataset.orcSearch || '').includes(termo)) ? '' : 'none';
  });
  [...tbody.querySelectorAll('tr.orc-group')].forEach(head => {
    const key = head.dataset.orcGroup;
    const visivel = servicos.some(l => l.dataset.orcGroup === key && l.style.display !== 'none');
    head.style.display = visivel ? '' : 'none';
    [...tbody.querySelectorAll(`tr.orc-subtotal, tr.orc-avulso`)].forEach(extra => {
      if (extra.dataset.orcGroup === key) extra.style.display = visivel ? '' : 'none';
    });
  });
}
window.filterOrcamento = filterOrcamento;

async function renderRelatorios() {
  const sel = document.getElementById('rel-obra');
  const esc = window.escHtml || ((v) => String(v == null ? '' : v));
  if (sel) {
    const current = sel.value;
    sel.innerHTML = '<option value="">-- Escolha uma Obra --</option>' +
      (DB.obras || []).map(o => `<option value="${esc(o.cod)}">${esc(o.nome)}</option>`).join('');
    if (current) sel.value = current;
  }
  const resp = document.getElementById('rel-responsavel');
  if (resp && !resp.value) {
    try {
      const u = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
      resp.value = u.name || '';
    } catch (e) { }
  }
  checkRelObra();
}

function resetRelatorios() {
  safeSetInner('rel-preview-area', `
    <div class="ui-empty-state">
      <div class="ui-empty-icon"><span class="material-symbols-outlined" style="font-size:34px;">folder_open</span></div>
      <div class="ui-empty-title">Pronto para auditar</div>
      <div class="ui-empty-text">Selecione uma obra e um período para compilar custos, medições, equipe e pendências em um relatório conciliado.</div>
    </div>
  `);
  renderRelatorios();
}

function checkRelObra() {
  const cod = document.getElementById('rel-obra')?.value || '';
  const obra = (DB.obras || []).find(o => o && o.cod === cod);
  const info = document.getElementById('rel-obra-info');
  if (info) {
    info.textContent = obra
      ? `${obra.status || '—'}${obra.mestre ? ' · Mestre: ' + obra.mestre : ' · Sem mestre definido'}`
      : '';
    info.title = info.textContent;
  }
  const num = document.getElementById('rel-numero');
  if (num && !num.value && obra) {
    num.value = `REL-${obra.cod}-${getTodayBR().replace(/-/g, '')}`;
  }
  const resp = document.getElementById('rel-responsavel');
  if (resp && !resp.value) {
    try {
      const u = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
      resp.value = u.name || '';
    } catch (e) { }
  }
}
window.checkRelObra = checkRelObra;

function auditEsc(v) {
  if (window.escHtml) return window.escHtml(v);
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function auditSafeImage(v) {
  const s = String(v == null ? '' : v);
  return /^(https?:\/\/|data:image\/)/i.test(s) ? s : '';
}

function auditBarWidth(valor, previsto) {
  if (!(previsto > 0)) return 0;
  return Math.max(0, Math.min(100, (valor / previsto) * 100));
}

function generateAuditReport() {
  if (typeof window.requireFeature === 'function' && !window.requireFeature('relatorio.marca')) return;
  const obraCod = document.getElementById('rel-obra')?.value;
  if (!obraCod) { toast('Selecione uma obra primeiro!', 'error'); return; }
  if (typeof window.buildObraReport !== 'function') {
    toast('Recarregue a página para atualizar o gerador de relatórios.', 'error');
    return;
  }

  const obra = (DB.obras || []).find(o => o.cod === obraCod);
  if (!obra) { toast('Obra não encontrada.', 'error'); return; }

  const dataInicio = document.getElementById('rel-data-ini')?.value || '';
  const dataFim = document.getElementById('rel-data-fim')?.value || '';
  if (dataInicio && dataFim && dataInicio > dataFim) {
    toast('A data inicial não pode ser maior que a final.', 'error');
    return;
  }

  const responsavel = document.getElementById('rel-responsavel')?.value || '';
  const numero = document.getElementById('rel-numero')?.value ||
    `REL-${obra.cod}-${getTodayBR().replace(/-/g, '')}`;
  document.getElementById('rel-numero').value = numero;

  const report = window.buildObraReport(DB, obraCod, { dataInicio, dataFim, responsavel, numero });
  const esc = auditEsc;
  const r = report.resumo;
  const logo = auditSafeImage(report.logoUrl);
  const semOrcamento = r.totalPrevisto <= 0;
  const orcamentoParcial = Boolean(r.orcamentoParcial);
  const comparavel = !semOrcamento && !orcamentoParcial;
  const pctTexto = semOrcamento ? 'Sem orçamento'
    : orcamentoParcial ? `${r.coberturaOrcamento.toFixed(1)}% de cobertura`
      : `${r.pct.toFixed(1)}% do orçamento`;
  const pctBarra = semOrcamento ? 0 : Math.min(100, Math.max(0, orcamentoParcial ? r.coberturaOrcamento : r.pct));
  const pctOver = comparavel && r.pct > 100 ? ' is-over' : '';
  const fisicoTexto = r.fisico == null ? '—' : `${r.fisico.toFixed(1)}%`;
  const fisicoBarra = r.fisico == null ? 0 : Math.min(100, Math.max(0, r.fisico));
  const saldoClasse = r.saldo < 0 ? ' audit-value-negative' : ' audit-value-positive';
  const dupTotal = (report.duplicados || []).reduce((a, e) => a + (Number(e.valorRealizado) || 0), 0);
  const dupEtapas = [...new Set((report.duplicados || []).map(e => e.etapa).filter(Boolean))];

  const categoriasHtml = report.categorias.map(c => {
    const temPrevisto = c.previsto > 0;
    const barra = auditBarWidth(c.realizado, c.previsto);
    return `<tr>
      <td><span class="material-symbols-outlined audit-cat-icon">${esc(c.icon)}</span> <b>${esc(c.label)}</b></td>
      <td class="num">${temPrevisto ? fmt(c.previsto) : '<span class="audit-muted">sem orçamento</span>'}</td>
      <td class="num">${fmt(c.realizado)}</td>
      <td class="num">${fmt(c.pago)}</td>
      <td class="num">${fmt(c.aPagar)}</td>
      <td class="num">${temPrevisto ? `${((c.realizado / c.previsto) * 100).toFixed(1)}%` : '—'}</td>
      <td><div class="audit-bar${temPrevisto && c.realizado > c.previsto ? ' is-over' : ''}"><i style="width:${barra}%"></i></div></td>
    </tr>`;
  }).join('');

  const medicoesHtml = report.medicoes.length
    ? report.medicoes.map(m => {
      const photos = (Array.isArray(m.photos) ? m.photos : (m.photoUrl ? [m.photoUrl] : []))
        .map(auditSafeImage).filter(Boolean);
      const aprov = m.aprovacao || 'Aprovada';
      const aprovCls = aprov === 'Rejeitada' ? 'audit-value-negative' : (aprov === 'Pendente' ? '' : 'audit-value-positive');
      const thumbs = photos.slice(0, 3).map(u =>
        `<img class="audit-thumb" src="${esc(u)}" alt="Evidência" data-photo="${esc(u)}" onclick="openLightbox(this.dataset.photo)">`
      ).join('');
      const extra = photos.length > 3 ? `<span class="audit-muted">+${photos.length - 3}</span>` : '';
      return `<tr>
        <td class="audit-date">${m.semana ? esc(fmtDate(m.semana)) : '—'}</td>
        <td><b>${esc(m.etapa || m.frente || 'Etapa')}</b><br><span class="audit-muted">${esc(m.servico || '—')}</span></td>
        <td>${esc(m.equipe || '—')}</td>
        <td class="num">${m.qprev || 0}</td>
        <td class="num">${m.qreal || 0}</td>
        <td class="num">${m.qacum == null ? (m.qreal || 0) : m.qacum}</td>
        <td class="num">${m.pctAcum == null ? '—' : `${m.pctAcum.toFixed(1)}%`}</td>
        <td class="num">${fmt(m.valor)}</td>
        <td class="${aprovCls}">${esc(aprov)}</td>
        <td>${esc(m.pgtoStatus || 'Pendente')}</td>
        <td>${thumbs || '<span class="audit-muted">—</span>'}${extra}</td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="11" class="audit-empty">Nenhuma medição no período selecionado.</td></tr>';

  const equipeHtml = report.equipe.length
    ? report.equipe.map(e => `<tr>
        <td><b>${esc(e.nome)}</b></td>
        <td class="num">${e.dias}</td>
        <td class="num">${fmt(e.total)}</td>
        <td class="num">${fmt(e.pago)}</td>
        <td class="num">${fmt(e.aPagar)}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="audit-empty">Nenhuma presença no período.</td></tr>';

  const pendenciasHtml = report.pendencias.length
    ? report.pendencias.map(p => `<tr>
        <td>${esc(p.tipo)}</td>
        <td>${esc(p.desc)}</td>
        <td class="audit-date">${p.data ? esc(fmtDate(p.data)) : '—'}</td>
        <td>${esc(p.status)}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="audit-empty">Nenhuma pendência encontrada.</td></tr>';

  const extratoHtml = report.entradas.length
    ? report.entradas.map(e => {
      const cat = window.financeCategoryLabel ? window.financeCategoryLabel(e.categoria) : (e.categoria || 'Outros');
      return `<tr>
        <td class="audit-date">${e.data ? esc(fmtDate(e.data)) : '—'}</td>
        <td>${esc(e.origem || '—')}</td>
        <td>${esc(e.desc || '—')}</td>
        <td>${esc(cat)}</td>
        <td>${esc(e.status || '—')}</td>
        <td class="num">${fmt(e.valorRealizado)}</td>
        <td class="num">${fmt(e.reportPago)}</td>
        <td class="num">${fmt(e.reportAPagar)}</td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="8" class="audit-empty">Nenhum lançamento realizado no período.</td></tr>';

  const html = `
    <div id="print-area" class="audit-report">
      <div class="audit-actions audit-no-print">
        <button class="btn btn-primary" onclick="printAuditReport()"><span class="material-symbols-outlined md-16" style="vertical-align:middle;margin-right:4px;">print</span> Imprimir / Salvar PDF</button>
        <button class="btn btn-secondary" onclick="resetRelatorios()"><span class="material-symbols-outlined md-16" style="vertical-align:middle;margin-right:4px;">arrow_back</span> Voltar</button>
      </div>

      <header class="audit-header">
        <div class="audit-brand">
          ${logo ? `<img src="${esc(logo)}" alt="${esc(report.empresa)}">` : '<div class="audit-brand-mark"><span class="material-symbols-outlined" style="font-size:26px;">construction</span></div>'}
          <div>
            <strong>${esc(report.empresa)}</strong>
            <span>Gestão de obras</span>
          </div>
        </div>
        <div class="audit-title">
          <h1>RELATÓRIO DE VISTORIA E ACOMPANHAMENTO</h1>
          <p>${esc(obra.nome)} (${esc(obra.cod)})</p>
          <p>Nº ${esc(report.numero)} · Emitido em ${esc(fmtDate(report.hoje))}</p>
        </div>
      </header>

      <div class="audit-meta">
        <div><span>Obra</span><b>${esc(obra.nome)} (${esc(obra.cod)})</b></div>
        <div><span>Status da obra</span><b>${esc(obra.status || '—')}</b></div>
        <div><span>Mestre responsável</span><b>${esc(obra.mestre || 'Não definido')}</b></div>
        <div><span>Período</span><b class="audit-date">${esc(report.periodoLabel)}</b></div>
        <div><span>Responsável pelo relatório</span><b>${esc(responsavel || 'Não informado')}</b></div>
        <div><span>${orcamentoParcial ? 'Orçamento cadastrado' : 'Orçamento total'}</span><b>${semOrcamento ? 'Não definido' : fmt(r.totalPrevisto)}</b></div>
      </div>

      <section class="audit-block">
        <h2>Resumo financeiro</h2>
        <div class="audit-summary">
          <div class="audit-card"><span>Previsto</span><b>${semOrcamento ? '—' : fmt(r.totalPrevisto)}</b></div>
          <div class="audit-card"><span>Realizado</span><b>${fmt(r.totalRealizado)}</b></div>
          <div class="audit-card"><span>Pago</span><b>${fmt(r.totalPago)}</b></div>
          <div class="audit-card"><span>A pagar</span><b>${fmt(r.totalAPagar)}</b></div>
          <div class="audit-card"><span>Saldo do orçamento</span><b class="${saldoClasse}">${comparavel ? fmt(r.saldo) : '—'}</b></div>
          <div class="audit-card"><span>Situação</span><b class="audit-status">${esc(r.status)}</b></div>
        </div>

        <div class="audit-progress">
          <div>
            <div class="audit-progress-head"><span>Avanço físico (medições)</span><b>${fisicoTexto}</b></div>
            <div class="audit-bar"><i style="width:${fisicoBarra}%"></i></div>
          </div>
          <div>
            <div class="audit-progress-head"><span>Avanço financeiro</span><b>${pctTexto}</b></div>
            <div class="audit-bar${pctOver}"><i style="width:${pctBarra}%"></i></div>
          </div>
        </div>
        <p class="audit-note">
          ${esc(r.status)}. ${semOrcamento
      ? 'Defina linhas no orçamento da obra para comparar previsto e realizado.'
      : orcamentoParcial
        ? `Há ${fmt(r.realizadoSemPrevisto)} de custo no período em categorias sem orçamento. O previsto cadastrado (${fmt(r.totalPrevisto)}) equivale a ${r.coberturaOrcamento.toFixed(1)}% do realizado (${fmt(r.totalRealizado)}); a comparação de estouro só é válida quando as etapas faltantes estiverem cadastradas.`
        : 'O percentual financeiro é calculado sobre o orçamento total da obra; saldo negativo indica gasto acima do previsto e o avanço físico é ponderado pelo valor das medições.'}
        </p>
      </section>

      <section class="audit-block">
        <h2>Custos por categoria</h2>
        <div class="audit-table-wrap">
        <table class="audit-table">
          <thead>
            <tr>
              <th>Categoria</th>
              <th class="num">Previsto</th>
              <th class="num">Realizado</th>
              <th class="num">Pago</th>
              <th class="num">A pagar</th>
              <th class="num">%</th>
              <th>Execução</th>
            </tr>
          </thead>
          <tbody>${categoriasHtml}</tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td class="num">${semOrcamento ? '—' : fmt(r.totalPrevisto)}</td>
              <td class="num">${fmt(r.totalRealizado)}</td>
              <td class="num">${fmt(r.totalPago)}</td>
              <td class="num">${fmt(r.totalAPagar)}</td>
              <td class="num">${pctTexto}</td>
              <td><div class="audit-bar${pctOver}"><i style="width:${pctBarra}%"></i></div></td>
            </tr>
          </tfoot>
        </table>
        </div>
        <p class="audit-note">Compras não são somadas ao custo realizado para evitar duplicidade com lançamentos de Material. O custo vem da mesma fonte do Financeiro: lançamentos manuais, presença, medições e almoços.</p>
        ${dupEtapas.length ? `<p class="audit-note audit-warn"><span class="material-symbols-outlined md-16" style="vertical-align:middle;margin-right:2px;">warning</span>${report.duplicados.length} lançamento(s) de Empreiteiro (${fmt(dupTotal)}) não foram somados ao realizado porque a etapa já possui medição: ${esc(dupEtapas.join(', '))}.</p>` : ''}
      </section>

      <section class="audit-block">
        <h2>Avanço por etapa (medições)</h2>
        <div class="audit-table-wrap">
        <table class="audit-table">
          <thead>
            <tr>
              <th class="audit-date">Data</th>
              <th>Etapa / serviço</th>
              <th>Equipe</th>
              <th class="num">Qtd. prev.</th>
              <th class="num">Qtd. atual</th>
              <th class="num">Acum.</th>
              <th class="num">% acum.</th>
              <th class="num">Valor</th>
              <th>Aprovação</th>
              <th>Pagamento</th>
              <th>Evidências</th>
            </tr>
          </thead>
          <tbody>${medicoesHtml}</tbody>
        </table>
        </div>
      </section>

      <section class="audit-block audit-grid-2">
        <div>
          <h2>Equipe no período</h2>
          <div class="audit-table-wrap">
          <table class="audit-table">
            <thead><tr><th>Profissional</th><th class="num">Dias</th><th class="num">Custo</th><th class="num">Pago</th><th class="num">A pagar</th></tr></thead>
            <tbody>${equipeHtml}</tbody>
          </table>
          </div>
        </div>
        <div>
          <h2>Pendências</h2>
          <div class="audit-table-wrap">
          <table class="audit-table">
            <thead><tr><th>Tipo</th><th>Descrição</th><th class="audit-date">Data</th><th>Status</th></tr></thead>
            <tbody>${pendenciasHtml}</tbody>
          </table>
          </div>
        </div>
      </section>

      <section class="audit-block">
        <h2>Extrato conciliado</h2>
        <div class="audit-table-wrap">
        <table class="audit-table">
          <thead>
            <tr>
              <th class="audit-date">Data</th>
              <th>Origem</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Status</th>
              <th class="num">Realizado</th>
              <th class="num">Pago</th>
              <th class="num">A pagar</th>
            </tr>
          </thead>
          <tbody>${extratoHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="5">Total conciliado</td>
              <td class="num">${fmt(r.totalRealizado)}</td>
              <td class="num">${fmt(r.totalPago)}</td>
              <td class="num">${fmt(r.totalAPagar)}</td>
            </tr>
          </tfoot>
        </table>
        </div>
        <p class="audit-note">Conferência: pago + a pagar = ${fmt(r.totalPago + r.totalAPagar)} · realizado = ${fmt(r.totalRealizado)}.</p>
      </section>

      <section class="audit-signatures">
        <div>
          ${esc(responsavel || 'Responsável pelo acompanhamento')}
          <small>Responsável pelo acompanhamento</small>
        </div>
        <div>
          ${esc(report.empresa)}
          <small>Contratante / empresa</small>
        </div>
      </section>

      <footer class="audit-footer">
        Documento gerado por ${esc(report.empresa)} em ${esc(fmtDate(report.hoje))}.<br>
        Relatório para fins de vistoria e acompanhamento técnico interno.
      </footer>

      <div class="audit-actions audit-no-print">
        <button class="btn btn-primary" onclick="printAuditReport()"><span class="material-symbols-outlined md-16" style="vertical-align:middle;margin-right:4px;">print</span> Imprimir / Salvar PDF</button>
        <button class="btn btn-secondary" onclick="resetRelatorios()"><span class="material-symbols-outlined md-16" style="vertical-align:middle;margin-right:4px;">arrow_back</span> Voltar</button>
      </div>
    </div>
  `;

  safeSetInner('rel-preview-area', html);
}

function printAuditReport() {
  document.body.classList.add('audit-print');
  const cleanup = () => document.body.classList.remove('audit-print');
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  setTimeout(cleanup, 1500);
}
window.printAuditReport = printAuditReport;



// ==================== MEDIÇÃO / PRODUÇÃO ====================
function medicaoEsc(v) {
  return window.escHtml ? window.escHtml(v) : String(v == null ? '' : v);
}

function medicaoOptions(select, values, current, placeholder) {
  if (!select) return;
  const keep = current != null ? current : select.value;
  const opts = [];
  if (placeholder) opts.push(`<option value="">${medicaoEsc(placeholder)}</option>`);
  values.forEach(v => {
    const value = typeof v === 'object' ? v.value : v;
    const label = typeof v === 'object' ? v.label : v;
    opts.push(`<option value="${medicaoEsc(value)}">${medicaoEsc(label)}</option>`);
  });
  select.innerHTML = opts.join('');
  if (keep && [...select.options].some(o => o.value === keep)) select.value = keep;
}

function medicaoBudgetLines(obra) {
  return (DB.orcamento || [])
    .map((o, i) => ({ ...o, _idx: i }))
    .filter(o => o && o.obra === obra);
}

function populateMedicaoFiltroEtapas() {
  const obra = document.getElementById('med-filter-obra')?.value || '';
  const sel = document.getElementById('med-filter-etapa');
  if (!sel) return;
  const etapas = new Set();
  medicaoBudgetLines(obra).forEach(o => { if (o.etapa) etapas.add(o.etapa); });
  (DB.medicao || []).filter(m => m && m.obra === obra).forEach(m => { if (m.etapa) etapas.add(m.etapa); });
  medicaoOptions(sel, [...etapas].sort((a, b) => a.localeCompare(b)), sel.value, 'Todas as etapas');
}

function setMedicaoView(view) {
  window._medView = view === 'financeiro' ? 'financeiro' : 'canteiro';
  document.querySelectorAll('#med-view-toggle .view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.medView === window._medView);
  });
  renderMedicao();
}
window.setMedicaoView = setMedicaoView;

function medicaoFotosHtml(lista) {
  const fotos = [];
  (lista || []).forEach(m => {
    const encontradas = Array.isArray(m.photos)
      ? m.photos.filter(Boolean)
      : (m.photoUrl ? [m.photoUrl] : []);
    encontradas.forEach(u => { if (!fotos.includes(u)) fotos.push(u); });
  });
  if (!fotos.length) return '<span class="med-muted">—</span>';
  return `<div class="med-row-photos">${fotos.slice(0, 3).map(u =>
    `<img class="med-thumb" src="${medicaoEsc(u)}" alt="Evidência" loading="lazy">`
  ).join('')}${fotos.length > 3 ? `<span class="med-photo-more">+${fotos.length - 3}</span>` : ''}</div>`;
}

function renderMedicao() {
  const obraSel = document.getElementById('med-filter-obra');
  if (obraSel) {
    medicaoOptions(
      obraSel,
      (DB.obras || []).map(o => ({ value: o.cod, label: `${o.cod} — ${o.nome}` })),
      obraSel.value,
      'Todas as obras'
    );
    if (!obraSel.value && (DB.obras || []).length) obraSel.value = DB.obras[0].cod;
  }
  populateMedicaoFiltroEtapas();

  const obra = obraSel?.value || '';
  const dataInicio = document.getElementById('med-filter-ini')?.value || '';
  const dataFim = document.getElementById('med-filter-fim')?.value || '';
  const etapa = document.getElementById('med-filter-etapa')?.value || '';
  const aprovacao = document.getElementById('med-filter-aprovacao')?.value || '';
  const view = window._medView === 'financeiro' ? 'financeiro' : 'canteiro';

  const head = view === 'financeiro'
    ? '<tr><th>Serviço</th><th class="num">Valor medido</th><th class="num">Aprovado</th><th class="num">Pago</th><th class="num">A pagar</th><th>Pagamento</th><th>Fotos</th><th>Ações</th></tr>'
    : '<tr><th>Serviço</th><th>Subetapa / Equipe</th><th>Unid.</th><th class="num">Previsto</th><th class="num">Acumulado</th><th>% executado</th><th>Aprovação</th><th>Ações</th></tr>';
  safeSetInner('med-head', head);
  const titulo = document.getElementById('med-titulo');
  if (titulo) titulo.textContent = view === 'financeiro' ? 'Valor medido e pagamento' : 'Avanço por serviço';
  const descricao = document.getElementById('med-descricao');
  if (descricao) descricao.textContent = view === 'financeiro'
    ? 'Pagamento vem do Financeiro e aparece aqui somente em leitura.'
    : 'Quantidades acumuladas consideram todo o histórico; a medição herda os dados do orçamento.';

  if (!obra) {
    safeSetInner('med-kpis', '');
    safeSetInner('med-tbody', `<tr><td colspan="8" class="med-empty">Selecione uma obra.</td></tr>`);
    const countEl = document.getElementById('med-count');
    if (countEl) countEl.textContent = '';
    return;
  }

  const resumo = window.buildMedicaoResumo
    ? window.buildMedicaoResumo(DB, obra, { dataInicio, dataFim, etapa, aprovacao })
    : { servicos: [], medicoes: [], totais: { valorMedido: 0, aAprovar: 0, aprovado: 0, rejeitado: 0, fisico: null, retrabalho: 0, count: 0 } };
  const t = resumo.totais;
  const board = window.buildOrcamentoBoard ? window.buildOrcamentoBoard(DB, { obra }) : { linhas: [] };
  const financeiroPorChave = new Map(board.linhas.map(l => [l.key, l]));

  const porChave = new Map();
  (resumo.medicoes || []).forEach(m => {
    const key = window.medicaoServiceKey ? window.medicaoServiceKey(m) : '';
    if (!porChave.has(key)) porChave.set(key, []);
    porChave.get(key).push(m);
  });

  const fisicoTxt = t.fisico == null ? '—' : `${t.fisico.toFixed(1)}%`;
  safeSetInner('med-kpis', `
    <div class="med-kpi"><span>Avanço físico acumulado</span><b>${fisicoTxt}</b><small>ponderado pelo orçamento</small></div>
    <div class="med-kpi"><span>Medido no período</span><b>${fmt(t.valorMedido)}</b><small>${t.count} medição(ões)</small></div>
    <div class="med-kpi med-kpi-warn"><span>A aprovar</span><b>${fmt(t.aAprovar)}</b><small>aguardando aprovação física</small></div>
  `);

  const servicos = resumo.servicos || [];
  safeSetInner('med-tbody', servicos.length
    ? servicos.map(s => {
      const medicoes = porChave.get(s.key) || [];
      const financeiro = financeiroPorChave.get(s.key) || {};
      const aprovado = medicoes
        .filter(m => (window.medicaoAprovacao ? window.medicaoAprovacao(m) : 'Aprovada') === 'Aprovada')
        .reduce((a, m) => a + (parseFloat(m.vtotal) || 0), 0);
      const pago = parseFloat(financeiro.pago) || 0;
      const aPagar = parseFloat(financeiro.aPagar) || 0;
      const pgtoTxt = pago > 0 && aPagar > 0 ? 'Parcial' : aPagar <= 0 && pago > 0 ? 'Pago' : 'Pendente';
      const aprovLista = medicoes.map(m => window.medicaoAprovacao ? window.medicaoAprovacao(m) : 'Aprovada');
      const aprov = aprovLista.includes('Rejeitada') ? 'Rejeitada'
        : aprovLista.includes('Pendente') ? 'Pendente'
          : medicoes.length ? 'Aprovada' : '—';
      const aprovClass = aprov === 'Aprovada' ? 'badge-green' : aprov === 'Rejeitada' ? 'badge-red' : 'badge-orange';
      const pct = s.pct == null ? null : s.pct;
      const fill = pct == null ? 0 : Math.max(0, Math.min(100, pct));
      const over = pct != null && pct > 100;
      const acoes = `<button class="btn btn-secondary btn-sm" data-key="${medicaoEsc(s.key)}" onclick="openMedicaoHistorico(this.dataset.key)">Histórico</button>`;
      const tagRevisar = medicoes.some(m => m.serviceIdReview)
        ? ' <span class="med-tag" title="Há medições ligadas a este serviço por aproximação (mesmo nome em mais de uma frente). Abra o Histórico para confirmar.">vínculo a revisar</span>'
        : '';

      if (view === 'financeiro') {
        return `<tr class="med-row">
          <td><b>${medicaoEsc(s.desc || '—')}</b>${tagRevisar}<br><span class="med-muted">${medicaoEsc(s.etapa || '—')}${s.subEtapa ? ` · ${medicaoEsc(s.subEtapa)}` : ''}</span></td>
          <td class="num">${fmt(s.valorAcum)}</td>
          <td class="num">${fmt(aprovado)}</td>
          <td class="num">${fmt(pago)}</td>
          <td class="num">${fmt(aPagar)}</td>
          <td><span class="med-tag">${pgtoTxt}</span> <span class="med-muted">(somente leitura)</span></td>
          <td>${medicaoFotosHtml(medicoes)}</td>
          <td>${acoes}</td>
        </tr>`;
      }
      return `<tr class="med-row">
        <td><b>${medicaoEsc(s.desc || '—')}</b>${s.temOrcamento ? '' : ' <span class="med-tag">sem orçamento</span>'}${tagRevisar}<br><span class="med-muted">${medicaoEsc(s.etapa || '—')}${s.subEtapa ? ` · ${medicaoEsc(s.subEtapa)}` : ''}</span></td>
        <td>${medicaoEsc(s.frente || '—')}<br><span class="med-muted">${medicaoEsc(s.empreiteiro || '—')}</span></td>
        <td>${medicaoEsc(s.unid || '—')}</td>
        <td class="num">${s.qprev || 0}</td>
        <td class="num ${s.saldo < 0 ? 'med-negative' : ''}">${s.qacum || 0}</td>
        <td><div class="med-progress"><div class="med-progress-bar${over ? ' is-over' : ''}"><i style="width:${fill}%"></i></div><span>${pct == null ? 'sem orçamento' : `${pct.toFixed(1)}%`}</span></div></td>
        <td>${aprov === '—' ? '—' : `<span class="badge ${aprovClass}">${aprov}</span>`}</td>
        <td>${acoes}</td>
      </tr>`;
    }).join('')
    : `<tr><td colspan="8" class="med-empty">Nenhum serviço medido nesta obra.</td></tr>`);

  const countEl = document.getElementById('med-count');
  const nRevisar = (DB.medicao || []).filter(m => m && m.obra === obra && m.serviceIdReview).length;
  if (countEl) countEl.textContent = `${servicos.length} serviço(s) · ${t.count} medição(ões) no período${nRevisar ? ` · ${nRevisar} com vínculo a revisar` : ''}`;
}
window.renderMedicao = renderMedicao;

function openMedicaoHistorico(key) {
  const panel = document.getElementById('med-historico');
  if (!panel) return;
  const obra = document.getElementById('med-filter-obra')?.value || '';
  const resumo = window.buildMedicaoResumo
    ? window.buildMedicaoResumo(DB, obra)
    : { servicos: [] };
  const servico = (resumo.servicos || []).find(s => s.key === key);
  const lista = (DB.medicao || [])
    .map((m, i) => ({ ...m, _idx: i }))
    .filter(m => m && m.obra === obra && window.medicaoServiceKey && window.medicaoServiceKey(m) === key)
    .sort((a, b) => (b.semana || '').localeCompare(a.semana || ''));
  const pct = servico && servico.pct != null ? `${servico.pct.toFixed(1)}%` : 'sem orçamento';

  panel.style.display = '';
  panel.innerHTML = `
    <div class="med-history-head">
      <div>
        <b>Histórico do serviço</b>
        <span>${medicaoEsc(servico?.etapa || '—')} · ${medicaoEsc(servico?.desc || 'Serviço')}</span>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="closeMedicaoHistorico()">Fechar</button>
    </div>
    <div class="med-history-summary">
      <div><span>Previsto</span><b>${servico ? servico.qprev : 0} ${medicaoEsc(servico?.unid || '')}</b></div>
      <div><span>Acumulado</span><b>${servico ? servico.qacum : 0}</b></div>
      <div><span>Saldo</span><b>${servico ? servico.saldo : 0}</b></div>
      <div><span>Executado</span><b>${pct}</b></div>
      <div><span>Valor medido</span><b>${fmt(servico ? servico.valorAcum : 0)}</b></div>
    </div>
    <div class="table-responsive">
      <table class="med-history-table">
        <thead><tr><th>Data</th><th>Qtd. atual</th><th>Acum.</th><th>Valor</th><th>Equipe</th><th>Aprovação</th><th>Pagamento</th><th>Evidências</th><th>Obs.</th><th>Ações</th></tr></thead>
        <tbody>${lista.length ? lista.map(m => {
    const photos = Array.isArray(m.photos) ? m.photos.filter(Boolean) : (m.photoUrl ? [m.photoUrl] : []);
    const aprovMed = window.medicaoAprovacao ? window.medicaoAprovacao(m) : 'Aprovada';
    return `<tr>
            <td>${medicaoEsc(fmtDate(m.semana || m.data))}${m.serviceIdReview ? '<br><span class="med-tag" title="Ligada a este serviço por aproximação">vínculo a revisar</span>' : ''}</td>
            <td class="num">${m.qreal || 0}</td>
            <td class="num">${m.qacum || ((parseFloat(m.qant) || 0) + (parseFloat(m.qreal) || 0))}</td>
            <td class="num">${fmt(m.vtotal || 0)}</td>
            <td>${medicaoEsc(m.equipe || '—')}</td>
            <td>${medicaoEsc(window.medicaoAprovacao ? window.medicaoAprovacao(m) : 'Aprovada')}</td>
            <td>${medicaoEsc(m.pgtoStatus || 'Pendente')}</td>
            <td>${photos.length
        ? photos.slice(0, 3).map((u, i) => `<img class="med-history-thumb" src="${medicaoEsc(u)}" alt="Evidência" onclick="openMedicaoFotos(${m._idx}, ${i})">`).join('') + (photos.length > 3 ? ` <span class="med-muted">+${photos.length - 3}</span>` : '')
        : '—'}</td>
            <td>${medicaoEsc(m.obs || '—')}</td>
            <td><div class="med-actions">
              ${aprovMed !== 'Aprovada' ? `<button class="btn btn-secondary btn-sm" onclick="setMedicaoAprovacao(${m._idx},'Aprovada')">Aprovar</button>` : ''}
              ${aprovMed !== 'Rejeitada' ? `<button class="btn btn-secondary btn-sm" onclick="setMedicaoAprovacao(${m._idx},'Rejeitada')">Rejeitar</button>` : ''}
              ${m.serviceIdReview ? `<button class="btn btn-secondary btn-sm" onclick="confirmMedicaoVinculo(${m._idx})">Confirmar vínculo</button>` : ''}
              <button class="btn btn-secondary btn-sm" onclick="editMedicao(${m._idx})">Editar</button>
              <button class="btn btn-danger btn-sm" onclick="deleteItem('medicao',${m._idx})">Excluir</button>
            </div></td>
          </tr>`;
  }).join('') : '<tr><td colspan="10" class="med-empty">Nenhuma medição registrada para este serviço.</td></tr>'}</tbody>
      </table>
    </div>
  `;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.openMedicaoHistorico = openMedicaoHistorico;

function closeMedicaoHistorico() {
  const panel = document.getElementById('med-historico');
  if (panel) {
    panel.style.display = 'none';
    panel.innerHTML = '';
  }
}
window.closeMedicaoHistorico = closeMedicaoHistorico;

function medicaoRowClick(event, idx) {
  // Cliques em botões, links ou campos da linha não abrem a galeria.
  if (event && event.target && event.target.closest('button, a, input, select, textarea, label')) return;
  openMedicaoFotos(idx);
}
window.medicaoRowClick = medicaoRowClick;

function medicaoPhotoList(m) {
  if (!m) return [];
  return Array.isArray(m.photos) ? m.photos.filter(Boolean) : (m.photoUrl ? [m.photoUrl] : []);
}

function openMedicaoFotos(idx, startIndex = 0) {
  const m = DB.medicao[idx];
  if (!m) return;
  const photos = medicaoPhotoList(m);
  if (!photos.length) { toast('Nenhuma foto registrada nesta medição.', 'error'); return; }
  const index = Math.max(0, Math.min(Number(startIndex) || 0, photos.length - 1));
  window._medicaoGallery = {
    photos,
    index,
    title: `${m.etapa || 'Medição'} · ${m.servico || 'Serviço'}`,
    meta: [fmtDate(m.semana || m.data), m.equipe].filter(Boolean).join(' · ')
  };
  renderMedicaoGallery();
  document.addEventListener('keydown', medicaoGalleryKeydown);
}
window.openMedicaoFotos = openMedicaoFotos;

function renderMedicaoGallery() {
  const g = window._medicaoGallery;
  if (!g) return;
  let overlay = document.getElementById('med-photo-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'med-photo-modal';
    overlay.className = 'med-gallery-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeMedicaoGallery(); };
    document.body.appendChild(overlay);
  }
  const total = g.photos.length;
  const current = g.photos[g.index] || '';
  overlay.innerHTML = `
    <div class="med-gallery-box" role="dialog" aria-modal="true" aria-label="Fotos da medição">
      <div class="med-gallery-head">
        <div>
          <b>Evidências da medição</b>
          <span>${medicaoEsc(g.title)}${g.meta ? ` — ${medicaoEsc(g.meta)}` : ''}</span>
        </div>
        <button type="button" class="med-gallery-close" onclick="closeMedicaoGallery()" title="Fechar"><span class="material-symbols-outlined md-18">close</span></button>
      </div>
      <div class="med-gallery-stage">
        ${total > 1 ? '<button type="button" class="med-gallery-nav prev" onclick="medicaoGalleryNav(-1)" title="Foto anterior">‹</button>' : ''}
        <img src="${medicaoEsc(current)}" alt="Evidência ${g.index + 1} de ${total}" data-photo="${medicaoEsc(current)}" onclick="openLightbox(this.dataset.photo)">
        ${total > 1 ? '<button type="button" class="med-gallery-nav next" onclick="medicaoGalleryNav(1)" title="Próxima foto">›</button>' : ''}
      </div>
      <div class="med-gallery-count">Foto ${g.index + 1} de ${total}</div>
      ${total > 1 ? `<div class="med-gallery-thumbs">${g.photos.map((u, i) =>
    `<img src="${medicaoEsc(u)}" alt="Miniatura ${i + 1}" class="${i === g.index ? 'active' : ''}" onclick="medicaoGallerySelect(${i})">`
  ).join('')}</div>` : ''}
    </div>
  `;
  overlay.classList.add('open');
}
window.renderMedicaoGallery = renderMedicaoGallery;

function medicaoGalleryNav(delta) {
  const g = window._medicaoGallery;
  if (!g || g.photos.length < 2) return;
  g.index = (g.index + delta + g.photos.length) % g.photos.length;
  renderMedicaoGallery();
}
window.medicaoGalleryNav = medicaoGalleryNav;

function medicaoGallerySelect(i) {
  const g = window._medicaoGallery;
  if (!g || !g.photos[i]) return;
  g.index = i;
  renderMedicaoGallery();
}
window.medicaoGallerySelect = medicaoGallerySelect;

function closeMedicaoGallery() {
  const overlay = document.getElementById('med-photo-modal');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.innerHTML = '';
  }
  window._medicaoGallery = null;
  document.removeEventListener('keydown', medicaoGalleryKeydown);
}
window.closeMedicaoGallery = closeMedicaoGallery;

function medicaoGalleryKeydown(e) {
  if (!window._medicaoGallery) return;
  if (e.key === 'Escape') closeMedicaoGallery();
  else if (e.key === 'ArrowLeft') medicaoGalleryNav(-1);
  else if (e.key === 'ArrowRight') medicaoGalleryNav(1);
}

async function setMedicaoAprovacao(idx, status) {
  const m = DB.medicao[idx];
  if (!m) return;
  const historico = document.getElementById('med-historico');
  const atualizarHistorico = Boolean(historico && historico.style.display !== 'none');
  const chave = window.medicaoServiceKey ? window.medicaoServiceKey(m) : '';
  if (status === 'Rejeitada' && !confirm('Rejeitar esta medição? Ela deixa de contar como custo e como avanço físico.')) return;
  let user = {};
  try { user = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}'); } catch (e) { }
  m.aprovacao = status;
  m.aprovadoPor = user.name || m.aprovadoPor || '';
  m.aprovadoEm = getTodayBR();
  await persistDB();
  renderMedicao();
  if (atualizarHistorico && chave) openMedicaoHistorico(chave);
  if (typeof renderFinanceiro === 'function') renderFinanceiro();
  if (typeof renderDashboard === 'function') renderDashboard();
  toast(`Medição ${status.toLowerCase()}!`);
}
window.setMedicaoAprovacao = setMedicaoAprovacao;

// Confirma que o serviço ligado a esta medição está certo (some o aviso "vínculo a revisar").
async function confirmMedicaoVinculo(idx) {
  const m = DB.medicao[idx];
  if (!m) return;
  const historico = document.getElementById('med-historico');
  const atualizarHistorico = Boolean(historico && historico.style.display !== 'none');
  const chave = window.medicaoServiceKey ? window.medicaoServiceKey(m) : '';
  delete m.serviceIdReview;
  await persistDB();
  renderMedicao();
  if (atualizarHistorico && chave) openMedicaoHistorico(chave);
  toast('Vínculo confirmado!');
}
window.confirmMedicaoVinculo = confirmMedicaoVinculo;

// ---------- Modal de medição ----------
function medicaoSessionName() {
  try {
    const u = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
    return u.name || '';
  } catch (e) { return ''; }
}

function medicaoLinhaOrcamento(key) {
  if (!key) return null;
  const obra = document.getElementById('md-obra')?.value || '';
  const linhas = medicaoBudgetLines(obra);
  return linhas.find(o => (window.budgetServiceKey ? window.budgetServiceKey(o) : '') === key) || null;
}

function populateMedicaoServicos() {
  const sel = document.getElementById('md-orc-servico');
  if (!sel) return;
  const obra = document.getElementById('md-obra')?.value || '';
  const actual = sel.value;
  const linhas = medicaoBudgetLines(obra);
  sel.innerHTML = '<option value="">— Serviço avulso (sem vínculo) —</option>' + linhas.map(o => {
    const key = window.budgetServiceKey ? window.budgetServiceKey(o) : '';
    const sub = o.subEtapa || o.subetapa ? ` · ${o.subEtapa || o.subetapa}` : '';
    const equipe = o.empreiteiro || o.equipe ? ` · ${o.empreiteiro || o.equipe}` : '';
    const label = `${o.etapa || 'Sem etapa'}${sub} — ${o.desc || 'Serviço'}${equipe}`;
    return `<option value="${medicaoEsc(key)}">${medicaoEsc(label)}</option>`;
  }).join('');
  if (actual && [...sel.options].some(o => o.value === actual)) sel.value = actual;
}

function populateMedicaoDatalists() {
  const obra = document.getElementById('md-obra')?.value || '';
  const etapas = new Set(['Fundação', 'Estrutura', 'Alvenaria', 'Acabamento', 'Instalações']);
  medicaoBudgetLines(obra).forEach(o => { if (o.etapa) etapas.add(o.etapa); });
  (DB.medicao || []).filter(m => m && m.obra === obra).forEach(m => { if (m.etapa) etapas.add(m.etapa); });

  const frentes = new Set();
  (DB.medicao || []).filter(m => m && m.obra === obra).forEach(m => { if (m.frente) frentes.add(m.frente); });

  const equipes = new Set();
  (DB.trabalhadores || []).forEach(t => {
    if (t.equipe && t.equipe !== 'Própria') equipes.add(t.equipe);
    if (t.nome) equipes.add(t.nome);
  });
  (DB.medicao || []).filter(m => m && m.obra === obra).forEach(m => { if (m.equipe) equipes.add(m.equipe); });
  (DB.almocos || []).forEach(a => { if (a.empreiteiro) equipes.add(a.empreiteiro); });

  const fill = (id, values) => {
    const dl = document.getElementById(id);
    if (dl) dl.innerHTML = [...values].sort((a, b) => a.localeCompare(b)).map(v => `<option value="${medicaoEsc(v)}">`).join('');
  };
  fill('md-etapas-list', etapas);
  fill('md-frentes-list', frentes);
  fill('md-equipes-list', equipes);
}

function medicaoSetInfo(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '—';
}

function onMedicaoObraChange() {
  populateMedicaoServicos();
  populateMedicaoDatalists();
  const sel = document.getElementById('md-orc-servico');
  if (sel) sel.value = '';
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
  set('md-orc-key', '');
  set('md-servico', '');
  onMedicaoServicoChange();
}
window.onMedicaoObraChange = onMedicaoObraChange;

function onMedicaoServicoChange() {
  const key = document.getElementById('md-orc-servico')?.value || '';
  const line = medicaoLinhaOrcamento(key);
  const avulsoGrp = document.getElementById('md-servico-avulso-grp');
  const avulsoDados = document.getElementById('md-avulso-dados');
  const hint = document.getElementById('md-orc-hint');
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };
  set('md-orc-key', line ? key : '');

  if (line) {
    if (avulsoGrp) avulsoGrp.style.display = 'none';
    if (avulsoDados) avulsoDados.style.display = 'none';
    set('md-servico', line.desc || '');
    set('md-unid', line.unid || '');
    set('md-qprev', line.qtd || '');
    const vunit = Number(line.vunit) > 0
      ? line.vunit
      : (Number(line.qtd) > 0 && Number(line.vtotal) > 0 ? Number(line.vtotal) / Number(line.qtd) : 0);
    set('md-vunit', vunit);
    medicaoSetInfo('md-info-etapa', line.etapa);
    medicaoSetInfo('md-info-subetapa', line.subEtapa || line.subetapa);
    medicaoSetInfo('md-info-equipe', line.empreiteiro || line.equipe);
    medicaoSetInfo('md-info-unid', line.unid);
    if (hint) hint.textContent = `Herança do orçamento: ${line.etapa || 'Sem etapa'}${line.subEtapa ? ` · ${line.subEtapa}` : ''}. Etapa, equipe, unidade e valores não são digitados aqui.`;
  } else {
    if (avulsoGrp) avulsoGrp.style.display = '';
    if (avulsoDados) avulsoDados.style.display = '';
    set('md-unid', '');
    set('md-qprev', '');
    set('md-vunit', '');
    medicaoSetInfo('md-info-etapa', '—');
    medicaoSetInfo('md-info-subetapa', '—');
    medicaoSetInfo('md-info-equipe', '—');
    medicaoSetInfo('md-info-unid', '—');
    if (hint) hint.textContent = 'Serviço avulso: informe unidade e valor unitário apenas neste caso.';
  }
  updateMedicaoAnterior();
}
window.onMedicaoServicoChange = onMedicaoServicoChange;

function updateMedicaoAnterior() {
  const idx = parseEditIdx(document.getElementById('md-edit-idx')?.value);
  const obra = document.getElementById('md-obra')?.value || '';
  const serviceId = document.getElementById('md-orc-key')?.value || '';
  const servico = document.getElementById('md-servico')?.value || '';
  const qant = window.medicaoQuantidadeAnterior
    ? window.medicaoQuantidadeAnterior(DB, { obra, serviceId, servico, excludeIdx: idx })
    : 0;
  const el = document.getElementById('md-qant');
  if (el) el.value = qant;
  recalcMedicao();
}
window.updateMedicaoAnterior = updateMedicaoAnterior;

function recalcMedicao() {
  const num = (id) => parseFloat(document.getElementById(id)?.value) || 0;
  const qprev = num('md-qprev');
  const qant = num('md-qant');
  const qreal = num('md-qreal');
  const vunit = num('md-vunit');
  const qacum = qant + qreal;
  const saldo = qprev - qacum;
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
  set('md-qacum', qacum);
  set('md-qsaldo', saldo);
  set('md-avanco', qprev > 0 ? (qacum / qprev * 100).toFixed(1) : '');
  set('md-vtotal', (qreal * vunit).toFixed(2));
}
window.recalcMedicao = recalcMedicao;

function syncMedicaoRetrabalho() {
  const qtd = parseFloat(document.getElementById('md-retr-qtd')?.value) || 0;
  const sel = document.getElementById('md-retr');
  if (sel) sel.value = qtd > 0 ? 'Sim' : 'Não';
}
window.syncMedicaoRetrabalho = syncMedicaoRetrabalho;

function renderMedicaoPhotoPreview() {
  const box = document.getElementById('md-photo-preview');
  if (!box) return;
  const photos = window._medicaoPhotos || [];
  box.style.display = photos.length ? 'grid' : 'none';
  box.innerHTML = photos.map((u, i) => `
    <div class="md-photo-item">
      <img src="${medicaoEsc(u)}" alt="Evidência" data-photo="${medicaoEsc(u)}" onclick="openLightbox(this.dataset.photo)">
      <button type="button" class="md-photo-remove" onclick="removeMedicaoPhoto(${i})" title="Remover foto"><span class="material-symbols-outlined md-16">close</span></button>
    </div>
  `).join('');
}
window.renderMedicaoPhotoPreview = renderMedicaoPhotoPreview;

function removeMedicaoPhoto(idx) {
  if (!Array.isArray(window._medicaoPhotos)) return;
  window._medicaoPhotos.splice(idx, 1);
  renderMedicaoPhotoPreview();
}
window.removeMedicaoPhoto = removeMedicaoPhoto;

async function handleMedicaoPhotos(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  if (!Array.isArray(window._medicaoPhotos)) window._medicaoPhotos = [];
  const room = Math.max(0, 6 - window._medicaoPhotos.length);
  const selected = files.slice(0, room);
  if (files.length > room) toast(`Limite de 6 fotos por medição. ${files.length - room} arquivo(s) ignorado(s).`, 'error');

  for (const file of selected) {
    toast('Enviando foto...', 'success');
    try {
      const url = await uploadEvidenceFile(file);
      window._medicaoPhotos.push(url);
      renderMedicaoPhotoPreview();
    } catch (err) {
      console.error('Upload Error:', err);
      toast(`${uploadErrorMessage(err)} (${err.code || 'Ver console'})`, 'error');
      break;
    }
  }
  input.value = '';
}
window.handleMedicaoPhotos = handleMedicaoPhotos;

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
           <button class="btn btn-secondary btn-sm" onclick="editUsuario(${i})" title="Editar usuário" aria-label="Editar usuário" style="margin-right:8px"><span class="material-symbols-outlined md-16">edit</span> Editar</button>
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

  // 2. Coleta das Medições (suporta múltiplas fotos e o formato antigo)
  DB.medicao.forEach(m => {
    const photos = Array.isArray(m.photos) ? m.photos.filter(Boolean) : (m.photoUrl ? [m.photoUrl] : []);
    photos.forEach(url => {
      allPhotos.push({
        url,
        obra: m.obra,
        origem: 'Medição',
        desc: m.servico,
        data: m.semana || m.data || ''
      });
    });
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
    : '<div style="color:var(--text3); padding: 40px; text-align: center; grid-column: 1/-1;"><span class="material-symbols-outlined md-18" style="vertical-align:middle;">photo_camera</span> Nenhuma foto encontrada para esta consulta.</div>';
}

// SaaS: renderBilling é fornecida por renderBillingSection() em data_core.js
// Mantém alias para compatibilidade de chamadas legadas
function renderBilling() {
  if (typeof renderBillingSection === 'function') renderBillingSection();
}

// startKiwifyCheckout é fornecida por js/plans.js (window.startKiwifyCheckout)
// Removida duplicata local para evitar sobrescrita

// ==================== SUPER ADMIN (MASTER) ====================
// Tudo que vem do banco (nome da empresa, slug, e-mail, IDs) é digitado por usuários de fora:
// aqui nunca entra em innerHTML/onclick sem escape, senão vira XSS contra o Master.
function _escMaster(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// Argumento de string para onclick="fn(...)": literal JS seguro, depois escapado para atributo HTML.
function _jsArgMaster(v) {
  return _escMaster(JSON.stringify(String(v == null ? '' : v)));
}

// Avisa o Master e atualiza as tabelas quando uma empresa nova é criada (ex.: auto-cadastro com slug).
function watchNewTenants() {
  if (window._masterTenantsWatching) return;
  window._masterTenantsWatching = true;
  firebase.database().ref('tenants').on('child_added', (snap) => {
    const known = window.globalTenantsDataCache || {};
    if (known[snap.key]) return; // já estava na tela
    const t = snap.val() || {};
    known[snap.key] = t;
    window.globalTenantsDataCache = known;
    if (t.origem === 'self_signup') {
      toast(`Nova empresa cadastrada: ${_escMaster(t.nomeEmpresa || snap.key)}`);
    }
    renderSuperAdmin();
  }, (err) => {
    console.warn('Observador de novas empresas indisponível:', err);
    window._masterTenantsWatching = false;
  });
}

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
    const profileList = Object.entries(profiles).map(([uidKey, p]) => ({
      uid: uidKey,
      ...(p || {})
    }));

    if (totalTenantsEl) totalTenantsEl.textContent = tenantIds.length;
    if (totalUsersEl) totalUsersEl.textContent = profileList.length;

    tbody.innerHTML = tenantIds.map(tid => {
      const t = tenants[tid];
      const config = t.config || {};
      // Busca o admin principal no nó Profilies
      const adminProfile = profileList.find(p => p.tenantId === tid && p.role === 'admin');
      let displayEmail = adminProfile ? _escMaster(adminProfile.email) : 'N/A';

      // Se o cliente ainda não se cadastrou (Perfil não existe), procura no nó Invites para exibir como "Pendente"
      const invitesData = window.globalInvitesDataCache || {}; // Necessita do fetch de convites acima
      if (!adminProfile) {
        const pendingKey = Object.keys(invitesData).find(k => invitesData[k].tenantId === tid && invitesData[k].role === 'admin');
        if (pendingKey) displayEmail = _escMaster(pendingKey.replace(/,/g, '.')) + ' <span style="font-size:10px; color:var(--orange)">(Convite)</span>';
      }

      // Origem e ativação
      const origem = t.origemAtivacao || t.origem || 'manual';
      let origemBadge = `<span class="badge badge-gray" style="font-size:10px;">${_escMaster(origem.toUpperCase())}</span>`;
      if (origem === 'kiwify') {
        origemBadge = `<span class="badge" style="background:#10b981;color:#fff;font-size:10px;font-weight:600;">KIWIFY</span>`;
      } else if (origem === 'self_signup') {
        origemBadge = `<span class="badge" style="background:#3b82f6;color:#fff;font-size:10px;">AUTO-CADASTRO</span>`;
      }

      // Último pagamento
      const ultimoPgto = t.ultimoPagamento;
      let pgtoInfo = '<span style="opacity:0.5;font-size:11px;">Nenhum</span>';
      if (ultimoPgto) {
        const dtPgto = ultimoPgto.data ? new Date(ultimoPgto.data).toLocaleDateString('pt-BR') : '';
        const vlPgto = ultimoPgto.valor ? `R$ ${Number(ultimoPgto.valor).toFixed(2).replace('.', ',')}` : '';
        const statusPgto = ultimoPgto.status || ultimoPgto.eventType || '';
        pgtoInfo = `<div><b style="font-size:11px;color:var(--text);">${vlPgto}</b> <span style="font-size:10px;opacity:0.7;">(${dtPgto})</span></div>
                    <div style="font-size:10px;opacity:0.75;">${_escMaster(statusPgto)}</div>`;
      }

      // Status / Vencimento
      let statusBadge = '';
      if (t.status === 'bloqueado_pagamento') {
        statusBadge = '<span class="badge" style="background:#ef4444;color:#fff;font-size:9px;">BLOQUEADO</span>';
      } else if (t.status === 'carencia') {
        statusBadge = '<span class="badge" style="background:#f59e0b;color:#fff;font-size:9px;">EM CARÊNCIA</span>';
      } else {
        statusBadge = '<span class="badge" style="background:#10b981;color:#fff;font-size:9px;">ATIVO</span>';
      }

      let vencTxt = '';
      if (t.planoVencimento) {
        vencTxt = `<div style="font-size:10px;opacity:0.7;">Vence: ${new Date(t.planoVencimento).toLocaleDateString('pt-BR')}</div>`;
      }

      return `<tr>
            <td>
                <div style="font-weight:600">${_escMaster(config.nomeEmpresa || 'Sem Nome')}</div>
                <div style="font-size:10px; opacity:0.6">${_escMaster(config.slug || t.slug || tid)}.obrareal.com · <b>${_escMaster(t.plano || 'free_trial')}</b></div>
                ${vencTxt}
            </td>
            <td>${displayEmail}</td>
            <td>
                <div>${origemBadge}</div>
                <div style="margin-top:3px;">${statusBadge}</div>
            </td>
            <td>${pgtoInfo}</td>
            <td>
                <div style="font-size:11px;"><b>Obras:</b> ${_escMaster(config.limiteObras || 2)}</div>
                <div style="font-size:11px;"><b>Usuários:</b> ${_escMaster(config.limiteUsuarios || 2)}</div>
            </td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="openMasterTenantModal(${_jsArgMaster(tid)})"><span class="material-symbols-outlined md-16" style="vertical-align:middle;margin-right:4px;">settings</span> Ajustar</button>
                <button class="btn btn-danger btn-sm" onclick="deleteTenant(${_jsArgMaster(tid)})" style="margin-left: 5px;">Excluir</button>
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
          nomeEmp = _escMaster(config.nomeEmpresa || 'Empresa Excluída/Não Encontrada');
          const slugTxt = config.slug ? `(<b>${_escMaster(config.slug)}</b>)` : '';
          extraInfo = `<div style="font-size:10px; opacity:0.6">ID: ${_escMaster(p.tenantId)} ${slugTxt}</div>`;
        }

        return `<tr>
                <td><div style="font-weight:600">${_escMaster(p.name || 'Sem Nome')}</div></td>
                <td>${_escMaster(p.email || 'N/A')}</td>
                <td><span class="badge badge-gray">${_escMaster((p.role || '').toUpperCase())}</span></td>
                <td>
                    <div style="font-weight:600">${nomeEmp}</div>
                    ${extraInfo}
                </td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteGlobalUser(${_jsArgMaster(p.uid)}, ${_jsArgMaster(p.email || '')}, ${_jsArgMaster(p.tenantId || '')})"><span class="material-symbols-outlined md-16">delete</span> Excluir</button>
                </td>
            </tr>`;
      }).join('');
    }

    // Observa empresas novas (auto-cadastro) para aparecerem aqui sem recarregar
    watchNewTenants();

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
    const [debugSnap, billingSnap] = await Promise.all([
      firebase.database().ref('webhook_debug').limitToLast(25).once('value').catch(() => null),
      firebase.database().ref('billing_events').limitToLast(25).once('value').catch(() => null)
    ]);

    const debugLogs = (debugSnap && debugSnap.val()) || {};
    const billingLogs = (billingSnap && billingSnap.val()) || {};

    const items = [];

    // Adiciona logs do webhook_debug
    for (const [k, log] of Object.entries(debugLogs)) {
      if (!log) continue;
      items.push({
        id: k,
        timestamp: log.timestamp || Date.now(),
        payload: log.payload || {},
        status: log.status || (log.payload && (log.payload.order_status || log.payload.status)) || 'N/A',
        email: log.email || (log.payload && (log.payload.email || (log.payload.Customer && log.payload.Customer.email))) || 'N/A',
        tenantId: log.tenantId || (log.payload && (log.payload.external_reference || log.payload.external_id)) || 'N/A',
        result: log.result || 'Recebido',
        signatureValid: log.signatureValid
      });
    }

    // Adiciona eventos de billing_events (se não já presentes)
    for (const [orderId, events] of Object.entries(billingLogs)) {
      if (!events || typeof events !== 'object') continue;
      for (const [evKey, ev] of Object.entries(events)) {
        if (!ev || typeof ev !== 'object') continue;
        const jaExiste = items.some(it => it.payload && it.payload.order_id === orderId);
        if (!jaExiste) {
          items.push({
            id: `${orderId}_${evKey}`,
            timestamp: ev.processedAt || ev.receivedAt || Date.now(),
            payload: ev.payload || { order_id: orderId },
            status: ev.orderStatus || ev.status || 'PROCESSED',
            email: ev.customerEmail || 'N/A',
            tenantId: ev.tenantId || 'N/A',
            result: ev.status === 'success' ? `Success: Ativado (R$ ${ev.chargeAmount || 0})` : (ev.status || 'Processado'),
            signatureValid: true
          });
        }
      }
    }

    items.sort((a, b) => b.timestamp - a.timestamp);

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; opacity:0.6;">Nenhum evento registrado ainda. Quando a Kiwify enviar um teste ou venda, ele aparecerá aqui automaticamente.</td></tr>';
      return;
    }

    tbody.innerHTML = items.slice(0, 25).map(log => {
      const p = log.payload || {};
      const statusRaw = String(log.status || p.order_status || p.status || 'N/A').toUpperCase();
      const email = _escMaster(log.email);
      const tenantId = _escMaster(log.tenantId);
      const result = _escMaster(log.result || 'Pendente/Processado');
      const dateStr = new Date(log.timestamp).toLocaleString('pt-BR');

      let badgeClass = 'badge-gray';
      let badgeStyle = '';
      if (statusRaw.includes('APPROVED') || statusRaw.includes('PAID') || statusRaw.includes('SUCCESS')) {
        badgeStyle = 'background:#10b981;color:#fff;';
      } else if (statusRaw.includes('TEST') || statusRaw.includes('TESTE')) {
        badgeStyle = 'background:#3b82f6;color:#fff;';
      } else if (statusRaw.includes('WAITING') || statusRaw.includes('PENDING') || statusRaw.includes('LATE') || statusRaw.includes('CARENCIA')) {
        badgeStyle = 'background:#f59e0b;color:#fff;';
      } else if (statusRaw.includes('REFUND') || statusRaw.includes('CHARGE') || statusRaw.includes('REJECT') || statusRaw.includes('401')) {
        badgeStyle = 'background:#ef4444;color:#fff;';
      }

      let resColor = 'var(--text)';
      if (result.includes('Success')) resColor = 'var(--green)';
      else if (result.includes('Rejeitado') || result.includes('Falha') || result.includes('401')) resColor = 'var(--red, #ef4444)';
      else if (result.includes('Aviso')) resColor = 'var(--orange, #f59e0b)';

      return `<tr style="font-size:12px;">
        <td style="white-space:nowrap;">${dateStr}</td>
        <td><span class="badge ${badgeClass}" style="${badgeStyle}">${statusRaw}</span></td>
        <td><b>${email}</b></td>
        <td><code>${tenantId}</code></td>
        <td style="color:${resColor}; font-weight:500;">${result}</td>
      </tr>`;
    }).join('');

  } catch (e) {
    console.error('Erro ao listar logs:', e);
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--red);padding:16px;">Falha ao carregar logs: ' + _escMaster(e.message || e) + '</td></tr>';
  }
}
window.renderWebhookLogs = renderWebhookLogs;

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
         <button class="btn btn-secondary btn-sm" onclick="sendMasterPasswordReset('${m.email}')" title="Enviar link de criação/redefinição de senha por e-mail"><span class="material-symbols-outlined md-16">key</span> Senha</button>
         <button class="btn btn-danger btn-sm" onclick="deleteMasterUser('${m.email}')" style="margin-left:4px;" title="Remover acesso master" aria-label="Remover acesso master"><span class="material-symbols-outlined md-16">delete</span> Excluir</button>
      </td>
    </tr>
  `).join('');

  } catch (e) {
    console.error('Erro ao renderizar mestres:', e);
    tbody.innerHTML = '<tr><td colspan="3">Sem permissão para listar mestres.</td></tr>';
  }
}

async function sendMasterPasswordReset(email) {
  if (!email) return;
  if (!confirm(`Enviar e-mail para criar ou redefinir a senha de ${email}?`)) return;

  try {
    await firebase.auth().sendPasswordResetEmail(email);
    toast(`Link para definir/redefinir senha enviado para ${email}!`);
  } catch (err) {
    console.error('Erro ao enviar reset:', err);
    if (err.code === 'auth/user-not-found') {
      toast(`O e-mail ${email} ainda não tem conta no Firebase Auth. O usuário pode criar a senha pelo "Primeiro Acesso" na tela de login.`, 'warning');
    } else {
      toast('Erro ao enviar e-mail de senha: ' + (err.message || err), 'error');
    }
  }
}
window.sendMasterPasswordReset = sendMasterPasswordReset;

async function addMasterUser() {
  const emailInput = document.getElementById('new-master-email');
  const passInput = document.getElementById('new-master-pass');
  const email = emailInput?.value.trim().toLowerCase();
  const pass = passInput?.value.trim();

  if (!email) return toast('Informe o e-mail do novo Super Admin.', 'error');
  if (pass && pass.length < 6) return toast('A senha deve ter pelo menos 6 caracteres.', 'error');

  if (!confirm(`Deseja realmente dar acesso TOTAL e GLOBAL para ${email}?`)) return;

  try {
    const sanitized = email.replace(/\./g, ',');
    await firebase.database().ref(`users/${sanitized}`).update({
      email: email,
      role: 'super_admin',
      tenantId: 'MASTER_SYSTEM',
      nome: 'Administrador Mestre',
      origem: 'painel_master'
    });

    // Se informou senha, cria a conta no Firebase Auth com a senha via app secundário isolado
    if (pass) {
      try {
        const secAppName = 'SecAuth_' + Date.now();
        const secApp = firebase.initializeApp(firebase.app().options, secAppName);
        const cred = await secApp.auth().createUserWithEmailAndPassword(email, pass);
        const newUid = cred.user.uid;
        await secApp.auth().signOut();
        await secApp.delete();

        // Como o admin logado é Super Admin, já cria o perfil completo no banco de dados
        await firebase.database().ref(`profiles/${newUid}`).set({
          uid: newUid,
          email: email,
          name: 'Administrador Mestre',
          role: 'super_admin',
          tenantId: 'MASTER_SYSTEM',
          status: 'ativo',
          criadoEm: Date.now()
        });

        toast(`Conta criada com sucesso com a senha inicial para ${email}!`);
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          // Já existe no Auth: envia e-mail para definir a nova senha
          await firebase.auth().sendPasswordResetEmail(email).catch(() => { });
          toast(`Conta já existia no Auth. Um link para definir a senha foi enviado para ${email}.`, 'warning');
        } else {
          console.warn('Aviso ao criar usuário no Auth:', authErr);
          toast(`Autorizado! Mas ao criar credencial: ${authErr.message || authErr}`, 'warning');
        }
      }
    } else {
      // Sem senha digitada: tenta enviar link para o e-mail criar sua senha
      await firebase.auth().sendPasswordResetEmail(email).catch(() => { });
    }

    // Se o usuário já tiver perfil criado no banco, sincroniza imediatamente
    try {
      const pSnap = await firebase.database().ref('profiles').orderByChild('email').equalTo(email).once('value');
      const foundProfiles = pSnap.val();
      if (foundProfiles) {
        const updates = {};
        Object.keys(foundProfiles).forEach(uid => {
          updates[`profiles/${uid}/role`] = 'super_admin';
          updates[`profiles/${uid}/tenantId`] = 'MASTER_SYSTEM';
          updates[`profiles/${uid}/status`] = 'ativo';
        });
        await firebase.database().ref().update(updates);
      }
    } catch (errP) {
      console.warn('Aviso ao sincronizar perfil do novo mestre:', errP);
    }

    toast(`Sucesso! ${email} agora é Super Admin.`);
    emailInput.value = '';
    if (passInput) passInput.value = '';
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
  if (container.querySelector('#mt-plano')) container.querySelector('#mt-plano').value = tData.plano || 'free_trial';
  if (container.querySelector('#mt-status')) container.querySelector('#mt-status').value = tData.status || 'ativo';

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
      // Leitura direta por chave (o slug é a chave). Nunca listar o nó pai.
      const existingSlug = await firebase.database().ref(`tenants_public/${slugVal}`).once('value');
      const existing = existingSlug.val();
      const belongsToOther = existing && (existing.tenantId ? existing.tenantId !== tid : existing.slug !== oldSlug);
      if (belongsToOther) {
        return toast(`O subdomínio "${slugVal}" já está em uso!`, 'error');
      }
    }

    const updates = {};
    updates[`tenants/${tid}/config/nomeEmpresa`] = nome;
    updates[`tenants/${tid}/config/slug`] = slugVal;
    updates[`tenants/${tid}/subdominioSlug`] = slugVal;
    updates[`tenants/${tid}/config/limiteObras`] = lobras;
    updates[`tenants/${tid}/config/limiteUsuarios`] = lusr;
    updates[`tenants/${tid}/plano`] = plano;
    updates[`tenants/${tid}/status`] = status;

    // Se mudou para Premium agora, garante validade de 30 dias se não tiver
    if (plano === 'premium') {
      updates[`tenants/${tid}/planoVencimento`] = Date.now() + (31 * 24 * 60 * 60 * 1000);
    }

    // Move o nó público para a chave do novo slug (modelo atual: chave = slug).
    // Também remove a chave legada (ID do tenant) quando ela difere do slug.
    const tData = (window.globalTenantsDataCache && window.globalTenantsDataCache[tid]) || {};
    const tConfig = tData.config || {};
    const publicRef = firebase.database().ref('tenants_public');
    let publicData = null;
    for (const key of [oldSlug, tData.subdominioSlug, tData.slug, tid]) {
      if (!key) continue;
      const snap = await publicRef.child(key).once('value');
      const val = snap.val();
      if (!val) continue;
      const belongsToThisTenant = val.tenantId ? val.tenantId === tid : (key === tid && (!val.slug || val.slug === oldSlug));
      if (!belongsToThisTenant) continue;
      publicData = publicData || val;
      if (key !== slugVal) updates[`tenants_public/${key}`] = null;
    }

    updates[`tenants_public/${slugVal}`] = {
      ...(publicData || {}),
      slug: slugVal,
      tenantId: tid,
      nomeEmpresa: nome,
      esquemaCores: (publicData && publicData.esquemaCores) || tConfig.esquemaCores || 'emerald',
      logoUrl: (publicData && publicData.logoUrl) || tConfig.logoUrl || ''
    };

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

    // Libera o subdomínio/slug público para reutilização.
    // A chave do nó público é o slug, que pode diferir do ID do tenant.
    const tData = (window.globalTenantsDataCache && window.globalTenantsDataCache[tid]) || {};
    const publicSlug = tData.subdominioSlug || (tData.config && tData.config.slug) || tData.slug || tid;
    for (const key of new Set([publicSlug, tid])) {
      if (!key) continue;
      const snap = await firebase.database().ref(`tenants_public/${key}`).once('value');
      const val = snap.val();
      if (!val) continue;
      const belongsToThisTenant = val.tenantId ? val.tenantId === tid : (key === tid && (!val.slug || val.slug === publicSlug));
      if (belongsToThisTenant) updates[`tenants_public/${key}`] = null;
    }

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
  let targetUid = (uid && uid !== 'undefined') ? uid : '';
  let targetEmail = (email && email !== 'undefined') ? email.trim().toLowerCase() : '';
  let targetTid = (tid && tid !== 'undefined') ? tid : '';

  const sessionUser = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
  if (targetEmail && targetEmail === (sessionUser.email || '').toLowerCase()) {
    return toast('Você não pode excluir sua própria conta enquanto estiver logado!', 'error');
  }

  if (!confirm(`Deseja realmente EXCLUIR TOTALMENTE o acesso de ${targetEmail || targetUid}?\n(Isso removerá o Perfil e as Credenciais permanentemente)`)) return;

  try {
    // 1. Localiza UID faltante se só temos o e-mail
    if (!targetUid && targetEmail) {
      try {
        const snap = await firebase.database().ref('profiles').orderByChild('email').equalTo(targetEmail).once('value');
        const profiles = snap.val();
        if (profiles) targetUid = Object.keys(profiles)[0];
      } catch (_) { }

      if (!targetUid) {
        const sanitized = targetEmail.replace(/\./g, ',');
        try {
          const uSnap = await firebase.database().ref(`users/${sanitized}`).once('value');
          const uVal = uSnap.val();
          if (uVal && uVal.uid) targetUid = uVal.uid;
          if (uVal && uVal.tenantId && !targetTid) targetTid = uVal.tenantId;
        } catch (_) { }
      }
    }

    // 2. Localiza e-mail faltante se só temos UID
    if (!targetEmail && targetUid) {
      try {
        const pSnap = await firebase.database().ref(`profiles/${targetUid}`).once('value');
        const pVal = pSnap.val();
        if (pVal) {
          if (pVal.email) targetEmail = pVal.email.trim().toLowerCase();
          if (pVal.tenantId && !targetTid) targetTid = pVal.tenantId;
        }
      } catch (_) { }
    }

    const updates = {};

    // 3. Deleta o perfil (o gatilho na Cloud Function deleta a conta no Firebase Auth)
    if (targetUid) {
      updates[`profiles/${targetUid}`] = null;
    }

    // 4. Deleta credenciais do banco master e convites
    if (targetEmail) {
      const sanitized = targetEmail.replace(/\./g, ',');
      updates[`users/${sanitized}`] = null;
      updates[`invites/${sanitized}`] = null;
    }

    // 5. Se vinculado a um tenant, remove da lista de usuários da empresa
    if (targetTid && targetTid !== 'MASTER_SYSTEM') {
      try {
        const uSnap = await firebase.database().ref(`tenants/${targetTid}/usuarios`).once('value');
        const usuarios = uSnap.val();
        if (Array.isArray(usuarios)) {
          const filtered = usuarios.filter(u => {
            const uEmail = (u.email || u.username || '').trim().toLowerCase();
            return uEmail !== targetEmail && (!targetUid || u.uid !== targetUid);
          });
          if (filtered.length !== usuarios.length) {
            updates[`tenants/${targetTid}/usuarios`] = filtered;
          }
        }
      } catch (errT) {
        console.warn('Aviso ao sincronizar usuarios do tenant:', errT);
      }
    }

    if (Object.keys(updates).length === 0) {
      return toast('Nenhum dado encontrado para excluir.', 'error');
    }

    await firebase.database().ref().update(updates);

    toast('Usuário e Credenciais removidos com sucesso!');
    renderSuperAdmin();
  } catch (e) {
    toast('Erro ao remover usuário completo: ' + (e.message || e), 'error');
    console.error(e);
  }
}

function saveConfig() {
  if (typeof window.requireFeature === 'function' && !window.requireFeature('relatorio.marca')) return;
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
  // Usuários legados podem estar gravados como `mestre`; o select usa o papel canônico.
  document.getElementById('usr-role').value = u.role === 'mestre' ? 'encarregado' : (u.role || 'pendente');
  document.getElementById('usr-email').disabled = true; // Impede alteração do e-mail de acesso
}

async function deleteUsuario(idx) {
  const targetUser = DB.usuarios[idx];
  if (!targetUser) return;

  if (targetUser.role === 'admin' && DB.usuarios.filter(u => u.role === 'admin').length <= 1) {
    toast('Não é possível remover o único administrador restante!', 'error');
    return;
  }
  if (confirm(`Remover usuário "${targetUser.name || targetUser.email}" desta empresa?`)) {
    const email = (targetUser.email || targetUser.username || '').trim().toLowerCase();
    const sanitizedEmail = email.replace(/\./g, ',');

    // 1. Remove convite pendente se houver
    if (sanitizedEmail) {
      await firebase.database().ref(`invites/${sanitizedEmail}`).remove().catch(e => console.warn('Aviso ao remover convite:', e));
    }

    // 2. Desvincula o tenant do perfil caso já possua conta
    if (targetUser.uid) {
      await firebase.database().ref(`profiles/${targetUser.uid}`).update({
        tenantId: null,
        role: 'desativado'
      }).catch(e => console.warn('Aviso ao revogar perfil:', e));
    } else if (email) {
      try {
        const pSnap = await firebase.database().ref('profiles').orderByChild('email').equalTo(email).once('value');
        const profiles = pSnap.val();
        if (profiles) {
          const uid = Object.keys(profiles)[0];
          await firebase.database().ref(`profiles/${uid}`).update({
            tenantId: null,
            role: 'desativado'
          });
        }
      } catch (e) {
        console.warn('Aviso ao revogar perfil por email:', e);
      }
    }

    DB.usuarios.splice(idx, 1);
    await persistDB();
    renderAdmin();
    toast('Usuário removido da empresa com sucesso!');
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
    <span style="font-weight:600;white-space:nowrap"><span class="material-symbols-outlined md-16" style="vertical-align:middle;">domain</span> Empresa:</span>
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
      badge.innerHTML = `<span class="material-symbols-outlined md-16" style="vertical-align:middle;margin-right:4px;color:var(--green);">check_circle</span> Operando em: ${superAdminActiveTenant.nome}`;
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
    badge.innerHTML = '<span class="material-symbols-outlined md-16" style="vertical-align:middle;margin-right:4px;color:var(--green);">check_circle</span> Operando em: ' + nome;
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

  if (id === 'modal-compra' && typeof window.prepareModalCompra === 'function') {
    window.prepareModalCompra(modalContent);
  }

  if (id === 'modal-upgrade') populateUpgradeModal(modalContent);

  // Super Admin: injeta banner de seleção de empresa no topo do modal
  const sessionUser = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
  if (id !== 'modal-upgrade' && sessionUser.role === 'super_admin') {
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
      const fUrl = document.getElementById('tr-foto-url');
      if (fUrl) fUrl.value = '';
      const fPreview = document.getElementById('tr-foto-preview');
      if (fPreview) fPreview.style.display = 'none';
    }
    const fInput = document.getElementById('tr-foto');
    if (fInput) {
      fInput.onchange = () => handleFileUpload(fInput, 'tr-foto-preview', 'tr-foto-url');
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
  if (id === 'modal-orcamento') {
    const dl = m.querySelector('#oc-etapas-list');
    if (dl) {
      const etapas = [...new Set((DB.orcamento || []).map(o => o && o.etapa).filter(Boolean))];
      dl.innerHTML = etapas.map(e => `<option value="${medicaoEsc(e)}">`).join('');
    }
    const ocEditIdx = parseEditIdx(document.getElementById('oc-edit-idx')?.value);
    const filtroObra = document.getElementById('orc-filtro-obra')?.value;
    const selObra = m.querySelector('#oc-obra');
    if (ocEditIdx === -1 && filtroObra && selObra && [...selObra.options].some(o => o.value === filtroObra)) {
      selObra.value = filtroObra;
    }
  }
  if (id === 'modal-medicao') {
    const mdEditIdx = document.getElementById('md-edit-idx') ? parseInt(document.getElementById('md-edit-idx').value) : -1;
    if (mdEditIdx === -1) {
      document.getElementById('md-semana').value = today;
      window._medicaoPhotos = [];
      const aprov = document.getElementById('md-aprovacao');
      if (aprov) aprov.value = 'Pendente';
      const pgto = document.getElementById('md-pgto-status');
      if (pgto) pgto.value = 'Pendente';
      populateMedicaoServicos();
      populateMedicaoDatalists();
      onMedicaoServicoChange();
      recalcMedicao();
      renderMedicaoPhotoPreview();
    }
  }
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
    const alStatus = document.getElementById('al-status');
    if (alStatus) alStatus.value = 'Pendente';
    const alValpago = document.getElementById('al-valpago');
    if (alValpago) alValpago.value = '';
    if (typeof toggleAlmocoParcial === 'function') toggleAlmocoParcial();
    const radioIndiv = m.querySelector('input[name="al-modo"][value="individual"]');
    if (radioIndiv) { radioIndiv.checked = true; }
    const indivGrp = document.getElementById('al-indiv-grp');
    const massaGrp = document.getElementById('al-massa-grp');
    if (indivGrp) indivGrp.style.display = '';
    if (massaGrp) massaGrp.style.display = 'none';
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
  if (id === 'modal-almoco' && alEditIdx) {
    alEditIdx.value = '-1';
    const radioIndiv = document.querySelector('input[name="al-modo"][value="individual"]');
    if (radioIndiv) radioIndiv.checked = true;
    const indivGrp = document.getElementById('al-indiv-grp');
    const massaGrp = document.getElementById('al-massa-grp');
    if (indivGrp) indivGrp.style.display = '';
    if (massaGrp) massaGrp.style.display = 'none';
  }
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
  if (id === 'modal-medicao' && mdEditIdx) {
    mdEditIdx.value = '-1';
    window._medicaoPhotos = [];
  }
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
  const editIdx = parseEditIdx(document.getElementById('ob-edit-idx').value);
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
    // Validação SaaS: Limite de Obras (enforcement definitivo nas Firebase Rules)
    const limite = getPlanLimits().obras;
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
    pixkey: window.cleanPixKey ? window.cleanPixKey(document.getElementById('tr-pixkey').value, document.getElementById('tr-pixtipo').value) : document.getElementById('tr-pixkey').value,
    contato: document.getElementById('tr-contato').value,
    status: document.getElementById('tr-status').value,
    admissao: document.getElementById('tr-admissao').value,
    endereco: document.getElementById('tr-endereco').value,
    cidade: document.getElementById('tr-cidade').value,
    foto: document.getElementById('tr-foto-url')?.value || (editIdx >= 0 ? DB.trabalhadores[editIdx].foto : null)
  };

  // Cadastro de pessoas é sensível: canteiro solicita, admin decide e aplica.
  if (typeof window.desviarParaAprovacao === 'function') {
    if (editIdx >= 0) {
      toast('Alteração de cadastro exige aprovação. Solicite ao administrador.', 'warning');
      return;
    }
    const desviado = await window.desviarParaAprovacao('trabalhador_add', { trabalhador: data },
      `Incluir trabalhador ${data.nome || cod} (${cod})`);
    if (desviado) { closeModal('modal-trabalhador'); return; }
  }

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

    // Retroactive: se a diária mudou, recalcula presenças não pagas
    const oldDiaria = oldWorker.diaria || 0;
    const newDiaria = data.diaria || 0;
    if (newDiaria !== oldDiaria && DB.presenca) {
      DB.presenca.forEach(p => {
        if (p.trab !== oldCod && p.nome !== oldName) return;
        if (p.pgtoStatus === 'Pago') return;
        p.diaria = newDiaria;
        if (p.presenca === 'Falta') {
          p.total = 0;
        } else if (p.presenca === 'Meio período') {
          p.total = newDiaria / 2;
        } else if (p.vinculo === 'Informal') {
          p.total = newDiaria;
        } else {
          const hnorm = p.hnorm || 0;
          if (hnorm > 0) {
            const hextra = p.hextra || 0;
            const valorHora = newDiaria / 8;
            p.total = newDiaria + (hextra * valorHora * 1.5);
          } else {
            p.total = 0;
          }
        }
      });
      console.log(`[Retroactive] Presenças não pagas de "${oldName}" recalculadas com diária R$ ${newDiaria}`);
    }

    toast('Cadastro e históricos atualizados!');
  } else {
    DB.trabalhadores.push(data);
    toast('Novo trabalhador cadastrado!');
  }

  closeModal('modal-trabalhador');

  // Atualizações Globais na UI (antes do sync para UX mais rápida)
  if (typeof renderTrabalhadores === 'function') renderTrabalhadores();
  if (typeof renderPresenca === 'function') renderPresenca();
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
  const fUrl = document.getElementById('tr-foto-url');
  if (fUrl) fUrl.value = t.foto || '';
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
  const editIdx = parseEditIdx(document.getElementById('pr-edit-idx').value);

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

    // Bloqueia duplicidade de data para o mesmo trabalhador (checando por código ou nome)
    const jaExiste = DB.presenca.some((p, idx) => {
      if (editIdx >= 0 && idx === editIdx) return false;
      if (p.data !== dataVal) return false;
      // Compara por código do trabalhador ou por nome (legado)
      if (p.trab === tsel) return true;
      if (!p.trab && p.nome === (t ? t.nome : tsel)) return true;
      return false;
    });

    if (jaExiste) {
      const nomeTrab = t ? t.nome : tsel;
      toast(`Já existe registro para ${nomeTrab} em ${fmtDate(dataVal)}!`, 'error');
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
        const totalForm = parseFloat(document.getElementById('pr-total').value);
        if (totalForm > 0) return totalForm;
        const diariaBase = t ? t.diaria : (parseFloat(document.getElementById('pr-diaria').value) || 0);
        return diariaBase > 0 ? diariaBase : 0;
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
  // Mantido por compatibilidade: o cálculo agora é acumulado.
  if (typeof recalcMedicao === 'function') recalcMedicao();
}

window.toggleDestinoMov = function () {
  const t = document.getElementById('mv-tipo').value;
  const grp = document.getElementById('grp-mv-destino');
  if (grp) grp.style.display = t === 'Transferência' ? 'block' : 'none';
};

// ==================== LOTE DE PAGAMENTO (FOLHA) ====================
window.lotePendentes = [];

window.getSemanaRange = function () {
  const days = getCurrentWeekDates();
  return { ini: days[0], fim: days[6] };
};

window.getQuinzenaRange = function () {
  const hoje = new Date();
  const dia = hoje.getDate();
  const ini = new Date(hoje);
  const fim = new Date(hoje);
  if (dia <= 15) {
    ini.setDate(1);
    fim.setDate(15);
  } else {
    ini.setDate(16);
    fim.setDate(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate());
  }
  return { ini: ini.toISOString().split('T')[0], fim: fim.toISOString().split('T')[0] };
};

window.getMesRange = function () {
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
  return { ini, fim };
};

window.prepareLotePgto = async function (periodo, dataIniCustom, dataFimCustom) {
  if (typeof window.requireFeature === 'function' && !window.requireFeature('pix.folha')) return;
  // Evita reabrir e recriar o modal se ele já estiver aberto na tela
  const modalContainer = document.getElementById('modal-container');
  const isAlreadyOpen = modalContainer && modalContainer.classList.contains('open') && document.getElementById('lote-periodo') !== null;

  if (!isAlreadyOpen) {
    await openModal('modal-lote');
  }

  // Se veio de onchange do select, pegue o valor
  const sel = document.getElementById('lote-periodo');
  const periodoSel = periodo || (sel ? sel.value : 'semana');

  // Sincroniza o select visual com o período atual selecionado
  if (sel) {
    sel.value = periodoSel;
  }

  // Toggle campos de data customizada
  const customDiv = document.getElementById('lote-custom-dates');
  if (customDiv) {
    customDiv.style.display = periodoSel === 'custom' ? 'flex' : 'none';
  }

  // Determinar range de datas
  let dataIni, dataFim;
  if (periodoSel === 'custom') {
    dataIni = dataIniCustom || document.getElementById('lote-data-ini')?.value;
    dataFim = dataFimCustom || document.getElementById('lote-data-fim')?.value;
    if (!dataIni || !dataFim) {
      toast('Selecione as datas inicial e final.', 'error');
      return;
    }

    // Atualiza os inputs de data para manter os valores selecionados visíveis
    const iniEl = document.getElementById('lote-data-ini');
    const fimEl = document.getElementById('lote-data-fim');
    if (iniEl) iniEl.value = dataIni;
    if (fimEl) fimEl.value = dataFim;
  } else {
    const ranges = {
      'semana': window.getSemanaRange(),
      'quinzenal': window.getQuinzenaRange(),
      'mes': window.getMesRange()
    };
    const range = ranges[periodoSel] || ranges.semana;
    dataIni = range.ini;
    dataFim = range.fim;
  }

  // Filtrar presenças pelo período - a tabela de presença é quem manda
  let pendentesRaw = DB.presenca.filter(p => {
    if (p.pgtoStatus === 'Pago') return false;
    if (!p.data) return false;
    if (periodoSel === 'todas') return true;
    return p.data >= dataIni && p.data <= dataFim;
  });

  const saldos = {};
  pendentesRaw.forEach(p => {
    const key = p.trab || (p.nome + '-' + p.funcao);

    let devido = (parseFloat(p.total) || 0) - (p.pgtoStatus === 'Parcial' ? (parseFloat(p.valpago) || 0) : 0);
    if (devido > 0) {
      if (!saldos[key]) {
        saldos[key] = { chave: key, nome: p.nome, funcao: p.funcao, diarias: 0, valor: 0, indices: [], datas: [], descontados: [] };
      }
      saldos[key].diarias += 1;
      saldos[key].valor += devido;
      saldos[key].indices.push(p);
      saldos[key].datas.push(p.data);
    } else {
      // Register as descontado
      if (!saldos[key]) {
        saldos[key] = { chave: key, nome: p.nome, funcao: p.funcao, diarias: 0, valor: 0, indices: [], datas: [], descontados: [] };
      }
      saldos[key].descontados.push(p.data);
    }
  });


  window.lotePendentes = Object.values(saldos)
    .filter(s => s.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  // Atualiza título do modal com período
  const titulo = document.querySelector('#modal-lote .modal-title');
  if (titulo) {
    const labels = { semana: 'Esta Semana', quinzenal: 'Esta Quinzena', mes: 'Este Mês', custom: 'Período Customizado', todas: 'Todas as Pendências' };
    titulo.innerHTML = `<span class="material-symbols-outlined md-18" style="vertical-align:middle;margin-right:6px;">payments</span> Fechamento de Folha - ${labels[periodoSel] || periodoSel}`;
  }

  renderLoteTbody();
};

window.renderLoteTbody = function () {
  const tbody = document.getElementById('lote-tbody');
  if (!tbody) return;

  if (lotePendentes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;"><span class="material-symbols-outlined md-18" style="vertical-align:middle;margin-right:4px;">celebration</span> Nenhuma diária pendente! Toda a folha já está quitada.</td></tr>';
    document.getElementById('lote-total-sel').textContent = 'R$ 0,00';
    return;
  }

  tbody.innerHTML = lotePendentes.map((item, i) => {
    const datasUnicas = [...new Set(item.datas)].slice(0, 3).join(', ');
    const maisDias = item.datas.length > 3 ? ` +${item.datas.length - 3}` : '';
    const descontados = item.descontados?.length ? `<br><small style="color:var(--orange)"><span class="material-symbols-outlined md-16" style="vertical-align:middle;">pause_circle</span> Folgas/feriados: ${item.descontados.join(', ')}</small>` : '';
    return `<tr>
    <td style="text-align:center"><input type="checkbox" class="ck-lote-item" value="${i}" onchange="updateLoteTotal()" style="transform:scale(1.2)"></td>
    <td><b>${item.nome}</b> <small style="color:var(--text3)">(${item.funcao})</small><br><small style="color:var(--text2)">${datasUnicas}${maisDias}${descontados}</small></td>
    <td style="text-align:center"><span class="badge badge-gray">${item.diarias}</span><br><small style="color:var(--text3)">dias</small></td>
    <td style="text-align:right">Dinheiro/Pix</td>
    <td style="text-align:right; font-weight:bold; color:var(--red)">${fmt(item.valor)}</td>
    <td style="text-align:center">
      <button class="btn btn-success btn-sm" data-feature="pix.folha" onclick="initiatePixPayment('lote', ${i})" title="Pagar via PIX" aria-label="Pagar via PIX" style="background:var(--green); border-color:var(--green);"><span class="material-symbols-outlined md-16">payments</span> Pagar</button>
    </td>
  </tr>`;
  }).join('');

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
    const idx = parseInt(ck.value);
    const item = lotePendentes[idx];
    if (item) total += item.valor;
  });
  document.getElementById('lote-total-sel').textContent = fmt(total);
};

window.toggleLoteAll = function (el) {
  const cks = document.querySelectorAll('.ck-lote-item');
  cks.forEach(ck => ck.checked = el.checked);
  updateLoteTotal();
};

window.changeLotePeriodoCustom = function (el) {
  if (el.value === 'custom') {
    document.getElementById('lote-custom-dates').style.display = 'flex';
    const hoje = new Date();
    const ini = new Date(hoje);
    ini.setDate(hoje.getDate() - 7);
    document.getElementById('lote-data-ini').value = ini.toISOString().split('T')[0];
    document.getElementById('lote-data-fim').value = hoje.toISOString().split('T')[0];
  } else {
    document.getElementById('lote-custom-dates').style.display = 'none';
    prepareLotePgto(el.value);
  }
};

window.applyCustomLotePeriod = function () {
  const iniEl = document.getElementById('lote-data-ini');
  const fimEl = document.getElementById('lote-data-fim');
  if (iniEl?.value && fimEl?.value) {
    prepareLotePgto('custom', iniEl.value, fimEl.value);
  }
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
  const editIdx = parseEditIdx(document.getElementById('tf-edit-idx').value);
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
  const mat = document.getElementById('es-mat').value.trim();
  const obra = document.getElementById('es-obra').value;
  const editIdx = parseEditIdx(document.getElementById('es-edit-idx').value);

  if (!mat) { toast('Informe o nome do material!', 'error'); return; }

  function normEstoqueNome(n) {
    return n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  if (editIdx < 0) {
    const matNorm = normEstoqueNome(mat);
    const dup = DB.estoque.find(e => e.obra === obra && normEstoqueNome(e.mat) === matNorm);
    if (dup) {
      toast(`"${mat}" já existe em "${obra}". Edite o item existente ou use movimentação para ajustar quantidade.`, 'error');
      return;
    }
  }

  const data = {
    cod: document.getElementById('es-cod').value,
    mat,
    unid: document.getElementById('es-unid').value,
    obra,
    min: parseFloat(document.getElementById('es-min').value) || 0,
    entrada: parseFloat(document.getElementById('es-entrada').value) || 0,
    saida: 0,
    custo: parseFloat(document.getElementById('es-custo').value) || 0,
    obs: document.getElementById('es-obs').value
  };
  if (editIdx >= 0) {
    if (DB.estoque[editIdx].saida !== undefined) {
      data.saida = DB.estoque[editIdx].saida;
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
    // Normal Entrada/Saida/Retorno Logic
    if (e) {
      if (tipo === 'Entrada' || tipo === 'Retorno') e.entrada += qtd;
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
    const editIdx = parseEditIdx(document.getElementById('mv-edit-idx').value);
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
  const m = DB.movEstoque[idx];
  if (!m) return;
  const tipoLower = (m.tipo || '').toLowerCase();

  // "Entrada" e "Transferência (Entrada)" continuam no modal legado (não suportado no novo)
  if (tipoLower === 'entrada' || tipoLower === 'transferência (entrada)' || tipoLower === 'transferencia (entrada)') {
    await openModal('modal-movest');
    document.getElementById('mv-edit-idx').value = idx;
    document.getElementById('mv-data').value = m.data;
    document.getElementById('mv-mat').value = m.codMat;
    document.getElementById('mv-matname').value = m.mat;
    document.getElementById('mv-obra').value = m.obra;
    if (m.tipo.includes('Transferência')) {
      document.getElementById('mv-tipo').value = 'Transferência';
      window.toggleDestinoMov && window.toggleDestinoMov();
    } else {
      document.getElementById('mv-tipo').value = m.tipo;
      window.toggleDestinoMov && window.toggleDestinoMov();
    }
    document.getElementById('mv-qtd').value = m.qtd;
    document.getElementById('mv-frente').value = m.frente || '';
    document.getElementById('mv-retirado').value = m.retirado || '';
    document.getElementById('mv-autor').value = m.autor || '';
    document.getElementById('mv-nf').value = m.nf || '';
    document.getElementById('mv-vunit').value = m.vunit || '';
    document.getElementById('mv-vtotal').value = m.vtotal || '';
    document.getElementById('mv-obs').value = m.obs || '';
    return;
  }

  // Todos os demais tipos → novo modal unificado
  if (typeof window.editarMovimentacaoNovoModal === 'function') {
    window.editarMovimentacaoNovoModal(idx);
  } else {
    // Fallback ao legado se módulo ainda não carregou
    await openModal('modal-movest');
    document.getElementById('mv-edit-idx').value = idx;
    document.getElementById('mv-data').value = m.data;
    document.getElementById('mv-mat').value = m.codMat;
    document.getElementById('mv-matname').value = m.mat;
    document.getElementById('mv-obra').value = m.obra;
    document.getElementById('mv-tipo').value = m.tipo;
    document.getElementById('mv-qtd').value = m.qtd;
    document.getElementById('mv-obs').value = m.obs || '';
  }
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
    pixkey: window.cleanPixKey ? window.cleanPixKey(document.getElementById('cp-pixkey').value) : document.getElementById('cp-pixkey').value,
    vorc: parseFloat(document.getElementById('cp-vorc').value) || 0,
    prazo: document.getElementById('cp-prazo').value,
    receb: document.getElementById('cp-receb').value,
    conf: document.getElementById('cp-conf').value,
    obs: document.getElementById('cp-obs').value
  };
  const editIdx = parseEditIdx(document.getElementById('cp-edit-idx').value);

  // Engenheiro/encarregado preparam a compra; dados comerciais não entram na
  // solicitação porque qualquer membro do tenant pode ler `aprovacoes`.
  if (typeof window.desviarParaAprovacao === 'function') {
    if (editIdx >= 0) {
      toast('Alteração comercial exige aprovação. Solicite ao administrador ou comprador.', 'warning');
      return;
    }
    const { forn, pixkey, vunit, vtotal, vorc, prazo, ...publicas } = data;
    const desviado = await window.desviarParaAprovacao('compra_criacao', {
      compra: { ...publicas, id: data.num || undefined }
    }, `Compra ${data.mat} (${data.qtd} ${data.unid || ''})`);
    if (desviado) { closeModal('modal-compra'); return; }
  }

  // Admin/comprador: registro público sem dados comerciais; os campos
  // sensíveis ficam no nó separado `comprasPrivadas`.
  const id = data.num || (editIdx >= 0 && DB.compras[editIdx] && DB.compras[editIdx].id) || `CP-${Date.now()}`;
  const publica = typeof window.compraPublica === 'function'
    ? window.compraPublica({ ...data, id })
    : data;
  if (editIdx >= 0) {
    DB.compras[editIdx] = publica;
    toast('Compra atualizada!');
  } else {
    DB.compras.push(publica);
    toast('Compra registrada!');
  }
  closeModal('modal-compra');
  await persistDB();
  if (typeof window.salvarDadosComerciais === 'function') {
    await window.salvarDadosComerciais(id, data);
  }
  renderCompras();
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
  const comercial = (campo, fallback) => typeof window.dadoComercial === 'function'
    ? (window.dadoComercial(c, campo) ?? fallback)
    : (c[campo] ?? fallback);
  document.getElementById('cp-forn').value = comercial('forn', '') || '';
  document.getElementById('cp-vunit').value = comercial('vunit', 0) || 0;
  document.getElementById('cp-vtotal').value = comercial('vtotal', 0) || 0;
  document.getElementById('cp-pixkey').value = comercial('pixkey', '') || '';
  document.getElementById('cp-vorc').value = comercial('vorc', 0) || 0;
  document.getElementById('cp-prazo').value = comercial('prazo', '') || '';
  document.getElementById('cp-receb').value = c.receb;
  document.getElementById('cp-conf').value = c.conf;
  document.getElementById('cp-obs').value = c.obs || '';
}

async function saveFinanceiro() {
  const prevEl = document.getElementById('fn-prev');
  const realEl = document.getElementById('fn-real');
  const statusEl = document.getElementById('fn-status');
  const valpagoEl = document.getElementById('fn-valpago');

  if (!prevEl || !realEl || !statusEl || !valpagoEl) {
    toast('Erro: Elementos do formulário não encontrados!', 'error');
    return;
  }

  const prev = parseFloat(prevEl.value) || 0;
  const real = parseFloat(realEl.value) || 0;
  const status = statusEl.value;
  let valpago = parseFloat(valpagoEl.value) || 0;

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

  const editIdx = parseEditIdx(document.getElementById('fn-edit-idx').value);

  // Engenheiro só prepara: o servidor aplica a alteração após decisão do admin.
  if (typeof window.desviarParaAprovacao === 'function') {
    const anterior = editIdx >= 0 ? DB.financeiro[editIdx] : null;
    let desviado;
    if (anterior && anterior.status !== status) {
      desviado = await window.desviarParaAprovacao('financeiro_status', {
        indice: editIdx, status, valpago
      }, `${anterior.desc || 'Lançamento'}: ${anterior.status} → ${status}`);
    } else {
      const lancamento = { ...data };
      delete lancamento.forn; // dado comercial não vai para a solicitação
      desviado = await window.desviarParaAprovacao('financeiro_lancamento', {
        lancamento,
        ...(editIdx >= 0 ? { indice: editIdx } : {})
      }, `${data.desc || 'Lançamento'} — ${data.obra}`);
    }
    if (desviado) { closeModal('modal-financeiro'); return; }
  }

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
  const val = (id) => (document.getElementById(id)?.value || '').trim();
  const qtd = parseFloat(val('oc-qtd')) || 0;
  const vunit = parseFloat(val('oc-vunit')) || 0;
  const editIdx = parseEditIdx(val('oc-edit-idx'));
  const anterior = editIdx >= 0 ? (DB.orcamento[editIdx] || {}) : {};

  // `id` é preservado na edição: as medições antigas continuam vinculadas
  // mesmo que a descrição ou a etapa sejam corrigidas.
  const data = {
    ...anterior,
    id: anterior.id || (window.newServiceId ? window.newServiceId() : undefined),
    obra: val('oc-obra'),
    etapa: val('oc-etapa'),
    subEtapa: val('oc-subetapa'),
    empreiteiro: val('oc-empreiteiro'),
    frente: val('oc-frente'),
    equipe: val('oc-equipe'),
    tipo: val('oc-tipo'),
    desc: val('oc-desc'),
    qtd, unid: val('oc-unid'),
    vunit, vtotal: qtd * vunit,
    obs: val('oc-obs')
  };
  delete data.vreal; // realizado é calculado, nunca gravado no orçamento

  // Mesmo serviço (obra + etapa + descrição) com unidade diferente em outro item costuma ser erro de digitação
  // (ex.: "Banheiros" em m² numa casa e em un na outra). Avisa, mas não bloqueia.
  const nrm = (v) => String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const outraUnidade = (DB.orcamento || []).find((o, i) => o && i !== editIdx
    && o.obra === data.obra && nrm(o.etapa) === nrm(data.etapa) && nrm(o.desc) === nrm(data.desc)
    && nrm(o.unid) && nrm(data.unid) && nrm(o.unid) !== nrm(data.unid));
  if (outraUnidade) {
    toast(`Atenção: "${escHtml(data.desc)}" já existe em outro item com a unidade "${escHtml(outraUnidade.unid)}" (aqui: "${escHtml(data.unid)}"). Confira.`, 'warning');
  }

  // Empreitadas/aditivos: o engenheiro prepara, o administrador aprova.
  if (typeof window.desviarParaAprovacao === 'function') {
    const desviado = await window.desviarParaAprovacao('orcamento_fechamento', {
      ...(editIdx >= 0 ? { indice: editIdx } : { criar: true }),
      item: data
    }, `Orçamento — ${data.desc || data.id || ''} (${data.obra})`);
    if (desviado) { closeModal('modal-orcamento'); return; }
  }

  if (editIdx >= 0) {
    DB.orcamento[editIdx] = data;
    toast('Serviço de orçamento atualizado!');
  } else {
    DB.orcamento.push(data);
    toast('Serviço de orçamento salvo!');
  }
  closeModal('modal-orcamento'); await persistDB(); renderOrcamento();
}

async function editOrcamento(idx) {
  await openModal('modal-orcamento');
  document.getElementById('oc-edit-idx').value = idx;
  const o = DB.orcamento[idx];
  if (!o) return;
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };
  set('oc-obra', o.obra);
  set('oc-etapa', o.etapa);
  set('oc-subetapa', o.subEtapa || o.subetapa || '');
  set('oc-empreiteiro', o.empreiteiro || '');
  set('oc-frente', o.frente || '');
  set('oc-equipe', o.equipe || '');
  set('oc-tipo', o.tipo);
  set('oc-desc', o.desc);
  set('oc-qtd', o.qtd);
  set('oc-unid', o.unid);
  set('oc-vunit', o.vunit);
  set('oc-vtotal', o.vtotal);
  set('oc-obs', o.obs || '');
}

async function saveMedicao() {
  const num = (id) => parseFloat(document.getElementById(id)?.value) || 0;
  const val = (id) => (document.getElementById(id)?.value || '').trim();
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };

  const semana = val('md-semana');
  const obra = val('md-obra');
  const serviceId = val('md-orc-key');
  const avulso = val('md-servico');

  if (!semana) { toast('Informe a data da medição.', 'error'); return; }
  if (!obra) { toast('Selecione a obra.', 'error'); return; }
  if (!serviceId && !avulso) { toast('Selecione o serviço medido.', 'error'); return; }

  const qreal = num('md-qreal');
  if (!(qreal > 0)) { toast('Informe a quantidade do dia.', 'error'); return; }

  const editIdx = parseEditIdx(val('md-edit-idx'));
  const anterior = DB.medicao[editIdx] || {};
  const linha = medicaoLinhaOrcamento(serviceId);
  const servico = linha ? (linha.desc || avulso) : avulso;
  const etapa = linha ? (linha.etapa || '') : (anterior.etapa || '');
  const qprev = num('md-qprev');
  const vunit = num('md-vunit');
  const qant = window.medicaoQuantidadeAnterior
    ? window.medicaoQuantidadeAnterior(DB, { obra, serviceId, servico, excludeIdx: editIdx })
    : 0;
  const aprovacao = window.normalizeAprovacao
    ? window.normalizeAprovacao(anterior.aprovacao || 'Pendente')
    : (anterior.aprovacao || 'Pendente');
  const photos = Array.isArray(window._medicaoPhotos) ? window._medicaoPhotos.filter(Boolean) : [];

  // Campos de pagamento não são mais digitados na medição. Os valores antigos
  // são preservados apenas para compatibilidade com o Financeiro/histórico.
  const data = {
    ...anterior,
    semana, obra, etapa,
    subEtapa: linha ? (linha.subEtapa || linha.subetapa || '') : (anterior.subEtapa || ''),
    frente: linha ? (linha.frente || '') : (anterior.frente || ''),
    equipe: linha ? (linha.empreiteiro || linha.equipe || '') : (anterior.equipe || ''),
    servico,
    // Snapshot automático dos dados do orçamento (não redigitados no formulário).
    orcKey: serviceId || anterior.orcKey || '',
    serviceId: serviceId || '',
    unid: linha ? (linha.unid || '') : val('md-unid'),
    qprev, qant, qreal,
    qacum: qant + qreal,
    vunit, vtotal: qreal * vunit,
    aprovacao,
    aprovadoPor: anterior.aprovadoPor || '',
    aprovadoEm: anterior.aprovadoEm || '',
    photos,
    photoUrl: photos[0] || '',
    obs: val('md-obs')
  };
  if (!data.serviceId) delete data.serviceId;
  // O usuário decidiu o vínculo neste formulário (trocou o serviço ou deixou avulso): sai da lista de revisão.
  if (!data.serviceId || data.serviceId !== anterior.serviceId) delete data.serviceIdReview;

  // Medição com valor só entra no DB após aprovação. Fotos base64 ficam de fora
  // da solicitação (o envio para o Storage é feito pelo fluxo normal da página).
  if (typeof window.desviarParaAprovacao === 'function' && (Number(data.vtotal) > 0 || Number(data.vunit) > 0)) {
    const fotos = (data.photos || []).filter(u => !String(u).startsWith('data:'));
    const item = {
      ...data,
      photos: fotos,
      photoUrl: fotos[0] || (String(data.photoUrl || '').startsWith('data:') ? '' : data.photoUrl || '')
    };
    const desviado = await window.desviarParaAprovacao('medicao_fechamento', {
      ...(editIdx >= 0 ? { indice: editIdx } : { criar: true }),
      item
    }, `Medição — ${data.servico || data.obra} (${data.semana})`);
    if (desviado) {
      closeModal('modal-medicao');
      window._medicaoPhotos = [];
      return;
    }
  }

  if (editIdx >= 0) {
    DB.medicao[editIdx] = data;
    toast('Medição atualizada!');
  } else {
    DB.medicao.push(data);
    toast('Medição registrada!');
  }

  closeModal('modal-medicao');
  window._medicaoPhotos = [];
  await persistDB();
  if (typeof renderMedicao === 'function') renderMedicao();
  if (typeof renderFinanceiro === 'function') renderFinanceiro();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderFotos === 'function') renderFotos();
}

async function editMedicao(idx) {
  const m = DB.medicao[idx];
  if (!m) return;
  await openModal('modal-medicao');
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };
  set('md-edit-idx', idx);
  set('md-semana', m.semana || m.data || '');
  set('md-obra', m.obra || '');
  populateMedicaoServicos();
  populateMedicaoDatalists();

  const serviceId = m.serviceId || m.orcKey || '';
  const sel = document.getElementById('md-orc-servico');
  if (sel) {
    sel.value = [...sel.options].some(o => o.value === serviceId) ? serviceId : '';
  }
  onMedicaoServicoChange();
  set('md-servico', cleanInput(m.servico));
  set('md-qreal', m.qreal || 0);
  set('md-obs', cleanInput(m.obs));
  if (!sel?.value) {
    set('md-unid', m.unid || '');
    set('md-qprev', m.qprev || 0);
    set('md-vunit', m.vunit || 0);
  }
  updateMedicaoAnterior();

  window._medicaoPhotos = Array.isArray(m.photos) ? m.photos.filter(Boolean) : (m.photoUrl ? [m.photoUrl] : []);
  renderMedicaoPhotoPreview();
}

// ==================== CREDENCIAL DE ACESSO AO NOVO USUÁRIO ====================
// Erros em que o convite não deve ficar órfão no banco.
const CRED_ERRORES_FATAIS = [
  'metodo_nao_permitido', 'dados_invalidos', 'nao_autenticado', 'token_invalido',
  'sem_permissao', 'tenant_invalido', 'convite_inexistente',
  'email_vinculado_outro_tenant', 'email_ja_existe'
];

const MSG_ERRO_CRED = {
  nao_autenticado: 'Sua sessão expirou. Entre novamente para criar usuários.',
  token_invalido: 'Sua sessão expirou. Entre novamente para criar usuários.',
  sem_permissao: 'Sem permissão para criar usuários nesta empresa.',
  tenant_invalido: 'Este e-mail não pertence à empresa ativa.',
  convite_inexistente: 'O convite deste e-mail não foi encontrado. Tente novamente.',
  email_vinculado_outro_tenant: 'Este e-mail já está vinculado a outra empresa.',
  email_ja_existe: 'Este e-mail já possui conta. Use "Esqueceu?" na tela de login.',
  dados_invalidos: 'Dados inválidos. Confira e-mail, nome e empresa.'
};

async function criarCredencialAuthUsuario(dados) {
  const token = await firebase.auth().currentUser.getIdToken();
  const resp = await fetch('/api/admin/criar-usuario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(dados)
  });
  let data = {};
  try { data = await resp.json(); } catch (e) { /* resposta sem corpo */ }
  if (!resp.ok) {
    const erro = new Error(MSG_ERRO_CRED[data.error] || 'Não foi possível gerar a credencial automaticamente.');
    erro.code = data.error || ('http_' + resp.status);
    erro.status = resp.status;
    throw erro;
  }
  return data;
}

function abrirModalCredenciaisUsuario(credencial, nome) {
  window._credenciaisUsuarioAtuais = credencial;
  openModal('modal-credenciais-usuario').then(() => {
    const set = (id, valor) => {
      const el = document.getElementById(id);
      if (el) el.textContent = valor;
    };
    set('cred-usuario-nome', nome || '');
    set('cred-usuario-email', credencial.email || '');
    set('cred-usuario-senha', credencial.password || '');
  }).catch(err => {
    console.error('Erro ao abrir modal de credenciais:', err);
  });
}

async function copiarCredenciaisUsuario() {
  const cred = window._credenciaisUsuarioAtuais;
  if (!cred) return;
  const texto = `E-mail: ${cred.email}\nSenha temporária: ${cred.password}`;
  try {
    await navigator.clipboard.writeText(texto);
    toast('Credenciais copiadas!', 'success');
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      toast('Credenciais copiadas!', 'success');
    } catch (err) {
      toast('Não foi possível copiar. Selecione os campos manualmente.', 'error');
    } finally {
      ta.remove();
    }
  }
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
  // Super Admin opera dentro de um tenant selecionado; a sessão dele continua
  // com MASTER_SYSTEM, então o destino real é o tenant ativo.
  const tenantId = (userSession.role === 'super_admin' &&
    typeof superAdminActiveTenant !== 'undefined' && superAdminActiveTenant)
    ? superAdminActiveTenant.id
    : userSession.tenantId;

  if (!tenantId || tenantId === 'MASTER_SYSTEM') {
    toast('Erro: selecione uma empresa antes de criar usuários.', 'error');
    return;
  }

  if (editIdx < 0) {
    const limiteAcessos = getPlanLimits().usuarios; // Plano Free = 1 (apenas o dono)
    if (DB.usuarios && DB.usuarios.length >= limiteAcessos && limiteAcessos < 99) {
      toast(`Seu plano atingiu o limite de ${limiteAcessos} acessos. Faça downgrade ou o Upgrade Ilimitado!`, 'error');
      return;
    }
    if (DB.usuarios.find(u => u.email === email)) {
      toast('Este e-mail já está cadastrado nesta empresa.', 'error');
      return;
    }
  }

  const userData = { email, name, role, tenantId };

  // REGISTRO GLOBAL DE CONVITE (SaaS)
  // Substitui pontos por vírgulas para chaves compatíveis com Firebase
  const sanitizedEmail = email.replace(/\./g, ',');
  const inviteRef = firebase.database().ref(`invites/${sanitizedEmail}`);
  const btnSalvar = document.querySelector('#modal-content .modal-footer .btn-primary');
  const textoBotao = btnSalvar ? btnSalvar.textContent : null;
  if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.textContent = 'Salvando...'; }

  try {
    await inviteRef.set(userData);
  } catch (err) {
    console.error('Erro ao gerar convite global:', err);
    toast('Erro ao sincronizar convite global.', 'error');
    if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.textContent = textoBotao; }
    return;
  }

  // Edição: apenas permissões. Credencial nova só para usuários recém-criados.
  if (editIdx >= 0) {
    DB.usuarios[editIdx] = { email, name, role };
    toast('Permissões de Usuário atualizadas!');
    closeModal('modal-usuario');
    renderAdmin();
    persistDB();
    return;
  }

  let credencial = null;
  let erroCredencial = null;
  try {
    credencial = await criarCredencialAuthUsuario(userData);
  } catch (err) {
    erroCredencial = err;
    console.error('Erro ao criar credencial de acesso:', err);
  }
  if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.textContent = textoBotao; }

  // Falha de autorização/validação: desfaz o convite para não deixar acesso órfão.
  if (erroCredencial && CRED_ERRORES_FATAIS.includes(erroCredencial.code)) {
    await inviteRef.remove().catch(() => {});
    toast(erroCredencial.message, 'error');
    return;
  }

  DB.usuarios.push({ email, name, role });
  persistDB();
  renderAdmin();

  const editIdxEl = document.getElementById('usr-edit-idx');
  if (editIdxEl) editIdxEl.value = '-1';

  if (credencial) {
    toast('Usuário criado! Confira as credenciais na tela.', 'success');
    abrirModalCredenciaisUsuario(credencial, name);
  } else {
    closeModal('modal-usuario');
    toast('Convite salvo. Não foi possível gerar a senha automática; o usuário poderá criar a senha no primeiro acesso.', 'warning');
  }
}

// ==================== DELETE ====================
async function deleteItem(table, idx) {
  if (idx < 0 || idx >= DB[table].length) {
    toast('Erro: Índice inválido. Recarregue a página.', 'error');
    return;
  }

  // Proteção para estoque: não excluir se tem saldo ou está no canteiro
  if (table === 'estoque') {
    const item = DB.estoque[idx];
    const saldo = (parseFloat(item.entrada) || 0) - (parseFloat(item.saida) || 0);
    if (saldo > 0) {
      toast(`"${item.mat}" tem saldo de ${saldo} ${item.unid || 'un'}. Zere o estoque antes de excluir.`, 'error');
      return;
    }
    const noCanteiro = DB.movEstoque.some(m =>
      m.codMat === item.cod &&
      ((m.tipo || '').toLowerCase().includes('saída') || (m.tipo || '').toLowerCase().includes('saida'))
      && !DB.movEstoque.some(r =>
        r !== m && r.codMat === item.cod && r.obra === m.obra &&
        ((r.tipo || '').toLowerCase() === 'retorno')
      )
    );
    if (noCanteiro) {
      if (!confirm(`"${item.mat}" ainda pode estar no canteiro sem retorno registrado. Excluir mesmo assim?`)) return;
    }
  }

  // Proteção para movEstoque
  if (table === 'movEstoque') {
    const mov = DB.movEstoque[idx];
    const tipo = (mov.tipo || '').toLowerCase();

    const isSaida = tipo.includes('saída') || tipo.includes('saida');
    const isEntrada = tipo.includes('entrada');

    if (isSaida && !isEntrada) {
      const temRetorno = DB.movEstoque.some(m =>
        m !== mov &&
        ((m.tipo || '').toLowerCase() === 'retorno') &&
        m.codMat === mov.codMat &&
        m.obra === mov.obra
      );
      if (!temRetorno) {
        if (!confirm(`"${mov.mat}" (${mov.tipo}) ainda não tem Retorno registrado. Deletar mesmo assim?`)) return;
      } else {
        if (!confirm(`Remover "${mov.tipo}" de "${mov.mat}"? O saldo no estoque não será ajustado.`)) return;
      }
    } else if (tipo === 'entrada' || tipo === 'retorno') {
      if (!confirm(`Remover "${mov.tipo}" de "${mov.mat}"? O estoque perderá esta quantidade.`)) return;
    } else if (tipo.includes('transferência') || tipo.includes('transferencia')) {
      if (!confirm(`Remover "${mov.tipo}" de "${mov.mat}"? Os saldos não serão ajustados.`)) return;
    } else {
      if (!confirm('Remover este registro?')) return;
    }
  } else {
    if (!confirm('Remover este registro?')) return;
  }

  // Remoções sensíveis também passam por aprovação (ponto/tarefas/almocos
  // continuam com exclusão direta, como registro de obra).
  if (typeof window.requerAprovacao === 'function' && window.requerAprovacao()) {
    if (table === 'trabalhadores') {
      const registro = DB.trabalhadores[idx] || {};
      const desviado = await window.desviarParaAprovacao('trabalhador_remove',
        { cod: registro.cod }, `Remover trabalhador ${registro.nome || registro.cod || ''} (${registro.cod || ''})`);
      if (desviado) return;
    } else if (['estoque', 'movEstoque', 'financeiro', 'orcamento', 'compras', 'medicao', 'usuarios'].includes(table)) {
      toast('Remoção exige aprovação do administrador.', 'warning');
      return;
    }
  }

  DB[table].splice(idx, 1);
  persistDB();
  const activePageEl = document.querySelector('.page.active');
  if (activePageEl) {
    const pageId = activePageEl.id.replace('page-', '');
    renderPage(pageId);
  } else {
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
  el.innerHTML = `${type === 'success' ? '<span class="material-symbols-outlined md-18">check_circle</span>' : '<span class="material-symbols-outlined md-18">error</span>'} ${msg}`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ==================== INIT ====================
window.onclick = function (e) {
  const container = document.getElementById('modal-container');
  if (e.target === container) {
    // Fechar o PIX pelo overlay também cancela a transação/fila em andamento
    const pixAtivo = (typeof activePixTransaction !== 'undefined' && activePixTransaction) || window._finPixQueue;
    if (pixAtivo && typeof cancelPixPayment === 'function') {
      cancelPixPayment();
      return;
    }
    closeModal(); // Fecha qualquer modal que estiver aberto se clicar fora
  }
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
    // Verificar se subdomínio já existe (leitura direta pela chave = slug)
    const existingSlug = await firebase.database().ref(`tenants_public/${slugVal}`).once('value');
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
    // A chave é o próprio slug; tenantId permite mover o nó em renomeações.
    await firebase.database().ref(`tenants_public/${slugVal}`).set({
      slug: slugVal,
      tenantId: slugVal,
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
function uploadErrorMessage(err) {
  const code = err && err.code;
  if (code === 'storage/unauthorized') return 'Erro de permissão (confirme as regras do Storage).';
  if (code === 'storage/quota-exceeded') return 'Limite de armazenamento atingido.';
  if (code === 'storage/retry-limit-exceeded') return 'Tempo limite excedido. Verifique sua conexão ou se o Storage está ativo.';
  if (code === 'storage/unknown') return 'Erro desconhecido no Firebase Storage.';
  if (err && /storage/i.test(err.message || '')) return err.message;
  return 'Erro ao enviar foto.';
}
window.uploadErrorMessage = uploadErrorMessage;

async function uploadEvidenceFile(file) {
  if (!file) throw new Error('Arquivo inválido.');
  if (typeof firebase.storage !== 'function') throw new Error('SDK de Storage não carregado.');
  const bucket = firebase.app().options.storageBucket;
  if (!bucket) throw new Error('Bucket de Storage não configurado.');

  const user = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
  const tid = user.tenantId || 'global';
  const storage = firebase.storage();
  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const filePath = `tenants/${tid}/evidencias/${fileName}`;
  const fileRef = storage.ref().child(filePath);

  const uploadTask = fileRef.put(file, { contentType: file.type });
  uploadTask.on('state_changed',
    (snapshot) => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      console.log('Upload is ' + progress.toFixed(0) + '% done');
    },
    (error) => { console.error('Upload task error:', error); }
  );

  await uploadTask;
  return fileRef.getDownloadURL();
}
window.uploadEvidenceFile = uploadEvidenceFile;

async function handleFileUpload(input, previewId, urlInputId) {
  const file = input.files[0];
  if (!file) return;
  toast('Enviando foto...', 'success');
  try {
    const url = await uploadEvidenceFile(file);
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
    toast(`${uploadErrorMessage(err)} (${err.code || 'Ver console'})`, 'error');
  }
}



function openLightbox(url) {
  let lb = document.getElementById('lightbox-container');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'lightbox-container';
    lb.className = 'lightbox-overlay';
    lb.onclick = closeLightbox;
    lb.innerHTML = `<div class="lightbox-content"><img src=""><span class="lightbox-close"><span class="material-symbols-outlined md-18">close</span></span></div>`;
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
                         <button class="sync-retry-btn" onclick="persistDB(true); event.stopPropagation();"><span class="material-symbols-outlined md-16">sync</span> Tentar Agora</button>`;
    indicator.className = 'sync-indicator error';
    indicator.title = `Código do Erro: ${code}`;
    indicator.style.cursor = 'pointer';
    indicator.onclick = () => persistDB(true);
  }
});







