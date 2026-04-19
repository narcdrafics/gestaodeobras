/**
 * utilitários de lógica pura (sem dependência de DOM)
 * para facilitar testes unitários e modularização.
 * Atribui diretamente ao window para evitar conflitos de declaração.
 */

window.todayDate = new Date();
window.today = window.todayDate.toISOString().split('T')[0];

const fmt = (v) => v != null && !isNaN(v)
  ? 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : '—';

window.fmt = fmt;

const fmtPct = (v) => v != null ? (v * 100).toFixed(1) + '%' : '—';

window.fmtPct = fmtPct;

const fmtDate = (d) => {
  if (!d) return '—';
  let val = d;
  if (typeof d === 'string' && d.includes('[object Object]')) {
    val = parseInt(d.replace('[object Object]', '')) || d;
  }

  if (typeof val === 'number' || (!isNaN(Number(val)) && String(val).length > 8)) {
    const dt = new Date(Number(val));
    return dt.toLocaleDateString('pt-BR');
  }

  if (typeof val === 'string' && val.includes('-')) {
    const parts = val.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return val;
};

window.fmtDate = fmtDate;

// --- NOVAS FUNÇÕES DE LÓGICA DE NEGÓCIO ---

/**
 * Consolida totais de presença, faltas e valores por data.
 */
const summarizePresence = (presencaArray) => {
  const uniqueDates = [...new Set(presencaArray.map(p => p.data))].sort((a, b) => String(b).localeCompare(String(a)));
  return uniqueDates.map(d => {
    const rows = presencaArray.filter(p => p.data === d);
    return {
      data: d,
      total: rows.reduce((a, r) => a + (Number(r.total) || 0), 0),
      presentes: rows.filter(r => r.presenca === 'Presente').length,
      faltas: rows.filter(r => r.presenca === 'Falta').length,
      registros: rows.length
    };
  });
};

window.summarizePresence = summarizePresence;

/**
 * Calcula pagamentos pendentes da semana atual por obra.
 */
const calcWeeklyPendingPayments = (presencaArray, obrasArray, todayStr) => {
  const todayObj = new Date(todayStr);
  const startOfWeek = new Date(todayObj);
  const dayOfWeek = todayObj.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Domingo vira 6, segunda vira 0, etc.
  startOfWeek.setDate(todayObj.getDate() - diff);
  const strWeek = startOfWeek.toISOString().split('T')[0];

  return obrasArray.map(o => {
    const pPendentes = presencaArray.filter(p =>
      p.obra === o.cod &&
      p.data >= strWeek &&
      p.data <= todayStr &&
      p.pgtoStatus === 'Pendente' &&
      Number(p.total) > 0
    );
    return {
      obraCod: o.cod,
      obraNome: o.nome,
      totalPendente: pPendentes.reduce((a, r) => a + (Number(r.total) || 0), 0),
      count: pPendentes.length
    };
  }).filter(res => res.count > 0);
};

window.calcWeeklyPendingPayments = calcWeeklyPendingPayments;

/**
 * Consolida todo o financeiro (Manuais, Presença, Medições, Almoços).
 */
const summarizeFinance = (fin, pres, med, alm, year, month, viewType) => {
  let all = [];
  const filterDate = (d) => {
    if (!year || !month) return true;
    if (!d) return false;
    const parts = d.split('-');
    return parseInt(parts[0]) === parseInt(year) && parseInt(parts[1]) === parseInt(month);
  };

  // Lançamentos manuais
  fin.forEach((f, i) => {
    if (filterDate(f.data)) {
      all.push({
        source: 'fin', idx: i, ...f,
        real: parseFloat(f.real) || 0,
        prev: parseFloat(f.prev) || 0
      });
    }
  });

  // Presença
  pres.forEach((p, i) => {
    if ((p.total || 0) > 0 && filterDate(p.data)) {
      all.push({
        source: 'pre', idx: i,
        data: p.data, obra: p.obra,
        tipo: 'Mão de obra própria',
        desc: `[Diária] ${p.nome}`,
        forn: p.nome || '',
        real: parseFloat(p.total) || 0, prev: 0,
        status: p.pgtoStatus || 'Pendente'
      });
    }
  });

  // Medições
  med.forEach((m, i) => {
    const dMed = m.semana || m.data;
    if ((m.vtotal || 0) > 0 && filterDate(dMed)) {
      all.push({
        source: 'med', idx: i,
        data: dMed, obra: m.obra,
        tipo: 'Empreiteiro',
        desc: `[Medição] ${m.servico}`,
        forn: m.equipe || '',
        real: parseFloat(m.vtotal) || 0, prev: 0,
        status: m.pgtoStatus || 'Pendente'
      });
    }
  });

  // Almoços
  (alm || []).forEach((a, i) => {
    if ((a.vtotal || 0) > 0 && filterDate(a.data)) {
      all.push({
        source: 'alm', idx: i,
        data: a.data, obra: a.obra,
        tipo: 'Almoço Empreiteiro',
        desc: `[Almoço] ${a.empreiteiro}`,
        forn: a.empreiteiro || '',
        real: parseFloat(a.vtotal) || 0, prev: 0,
        status: 'Pendente'
      });
    }
  });

  // Agrupamento por Obra (Legado/Total) e por Período (Novo)
  const totalsByObra = {};
  const totalsByPeriod = {};

  all.forEach(f => {
    const cod = f.obra || 'Geral';
    if (!totalsByObra[cod]) totalsByObra[cod] = { prev: 0, real: 0, diff: 0 };
    totalsByObra[cod].prev += f.prev;
    totalsByObra[cod].real += f.real;
    totalsByObra[cod].diff = totalsByObra[cod].real - totalsByObra[cod].prev;

    // Lógica de Agrupamento por Período (Semanal/Quinzenal)
    if (f.data) {
      const pId = getPeriodLabel(f.data, viewType || 'semanal');
      if (!totalsByPeriod[pId]) totalsByPeriod[pId] = { real: 0, items: 0 };
      totalsByPeriod[pId].real += f.real;
      totalsByPeriod[pId].items++;
    }
  });

  return { all, totalsByObra, totalsByPeriod };
};

window.summarizeFinance = summarizeFinance;

/**
 * Define em qual período (Semana/Quinzena) uma data se encaixa dentro do mês.
 */
function getPeriodLabel(dateStr, viewType) {
  if (!dateStr || typeof dateStr !== 'string') return 'S/D';
  const parts = dateStr.split('-');
  if (parts.length < 3) return 'S/D';
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

  if (viewType === 'quinzenal') {
    return d.getDate() <= 15 ? '1ª Quinzena' : '2ª Quinzena';
  }

  // Semanal (Inicia no Domingo)
  const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  const firstSunday = new Date(firstOfMonth);
  firstSunday.setDate(1 + (7 - firstOfMonth.getDay()) % 7);

  if (d < firstSunday) return 'Semana 1';
  const diffDays = Math.floor((d.getTime() - firstSunday.getTime()) / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(diffDays / 7) + 2;
  return `Semana ${weekNum}`;
}

/**
 * Calcula o progresso do orçamento vs. gastos reais.
 */
const calcBudgetProgress = (orcamento, financeiro, compras) => {
  const realCosts = {};

  // Gastos realizados (Financeiro)
  financeiro.forEach(f => {
    if (f.status === 'Pago' || f.status === 'Parcial') {
      const key = `${f.obra}|${f.etapa}`;
      realCosts[key] = (realCosts[key] || 0) + (parseFloat(f.real) || 0);
    }
  });

  // Gastos realizados (Compras)
  compras.forEach(c => {
    if (['Entregue', 'Pago', 'Pedido Feito'].includes(c.status)) {
      const key = `${c.obra}|${c.etapa || 'Material'}`;
      realCosts[key] = (realCosts[key] || 0) + (parseFloat(c.vtotal) || 0);
    }
  });

  return orcamento.map(o => {
    const key = `${o.obra}|${o.etapa || 'Material'}`;
    const vreal = realCosts[key] || 0;
    const vtotal = parseFloat(o.vtotal) || 0;
    return {
      ...o,
      realizado: vreal,
      diferenca: vtotal - vreal,
      perc: vtotal > 0 ? ((vreal / vtotal) * 100).toFixed(1) : 0
    };
  });
};

window.calcBudgetProgress = calcBudgetProgress;

// Funções para window (evita declaração no escopo global)
const calcSaldo = function(item) {
  return (parseFloat(item.entrada) || 0) - (parseFloat(item.saida) || 0);
};

window.calcSaldo = calcSaldo;

const estoqueStatus = function(item) {
  const saldo = window.calcSaldo(item);
  if (saldo <= 0) return 'SEM ESTOQUE';
  if (saldo <= item.min) return 'CRÍTICO';
  if (saldo <= item.min * 1.5) return 'BAIXO';
  return 'NORMAL';
};

window.estoqueStatus = estoqueStatus;

// Funções utilitárias do UI
const statusBadge = function(s) {
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
};

window.statusBadge = statusBadge;

const uiEmptyState = function(message, subMessage, icon, actionText, actionFn) {
  return `<tr class="empty-row" style="background:transparent;border:none;box-shadow:none;">
   <td colspan="100%" style="text-align:center;padding:48px 20px;border:none;background:transparent;">
       <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:6px;">${message}</div>
       <div style="font-size:13px;color:var(--text3);margin-bottom:20px;max-width:300px;margin-left:auto;margin-right:auto;text-wrap:balance;">${subMessage}</div>
       ${actionText ? `<button class="btn btn-primary" onclick="${actionFn}" style="margin:0 auto;">${actionText}</button>` : ''}
   </td>
  </tr>`;
};

window.uiEmptyState = uiEmptyState;

const obName = function(cStr) {
  if (!cStr) return '—';
  return cStr.split(',').map(c => {
    const o = window.DB?.obras?.find(x => x.cod === c.trim());
    return o ? `<b>${o.nome}</b>` : c.trim();
  }).join(', ');
};

window.obName = obName;

const nextCod = function(arr, prefix) {
  const nums = arr.map(x => parseInt((x.cod || x.num || '0').replace(/\D/g, '')) || 0);
  return prefix + String(Math.max(0, ...nums) + 1).padStart(3, '0');
};

window.nextCod = nextCod;

const sanitizeHTML = function(str) {
  if (!str || typeof str !== 'string') return str;
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, function(m) { return map[m]; });
};

window.sanitizeHTML = sanitizeHTML;

// Debug logger - desativado em produção por padrão
// Para ativar: window.DEBUG = true no console
const debugLog = function(tag, ...args) {
  if (window.DEBUG) {
    console.log(`[${tag}]`, ...args);
  }
};

window.debugLog = debugLog;

const safeSetInner = function(id, html) {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = html;
    if (el.tagName === 'TBODY') {
      setTimeout(() => window.autoBindTableLabels(el), 10);
    }
  }
};

window.safeSetInner = safeSetInner;

const autoBindTableLabels = function(tbody) {
  try {
    const table = tbody.closest('table');
    if (!table) return;
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    if (!headers.length) return;
    Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
      Array.from(tr.children).forEach((td, i) => {
        if (headers[i] && !td.hasAttribute('data-label')) {
          td.setAttribute('data-label', headers[i]);
        }
      });
    });
  } catch (e) {
    console.error('AutoBind Error', e);
  }
};

window.autoBindTableLabels = autoBindTableLabels;

const safeSetText = function(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
};

window.safeSetText = safeSetText;

const safeSetValue = function(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
};

window.safeSetValue = safeSetValue;

const safeSetStyle = function(id, prop, val) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = val;
};

window.safeSetStyle = safeSetStyle;

/**
 * Gera relatório detalhado de pagamentos semanais.
 * Retorna array com dados de cada semana do mês.
 */
const generateWeeklyPaymentReport = (fin, pres, med, alm, year, month) => {
  const report = [];
  const filterDate = (d) => {
    if (!year || !month) return true;
    if (!d) return false;
    const parts = d.split('-');
    return parseInt(parts[0]) === parseInt(year) && parseInt(parts[1]) === parseInt(month);
  };

  // Coleta todos os lançamentos do mês
  let all = [];

  // Lançamentos manuais
  fin.forEach((f, i) => {
    if (filterDate(f.data) && (f.status === 'Pago' || f.status === 'Parcial')) {
      all.push({
        source: 'fin', idx: i, ...f,
        real: parseFloat(f.real) || 0,
        prev: parseFloat(f.prev) || 0
      });
    }
  });

  // Presença (apenas pagos)
  pres.forEach((p, i) => {
    if ((p.total || 0) > 0 && filterDate(p.data) && p.pgtoStatus === 'Pago') {
      all.push({
        source: 'pre', idx: i,
        data: p.data, obra: p.obra,
        tipo: 'Mão de obra própria',
        desc: `[Diária] ${p.nome}`,
        forn: p.nome || '',
        real: parseFloat(p.total) || 0, prev: 0,
        status: 'Pago'
      });
    }
  });

  // Medições (apenas pagas)
  med.forEach((m, i) => {
    const dMed = m.semana || m.data;
    if ((m.vtotal || 0) > 0 && filterDate(dMed) && m.pgtoStatus === 'Pago') {
      all.push({
        source: 'med', idx: i,
        data: dMed, obra: m.obra,
        tipo: 'Empreiteiro',
        desc: `[Medição] ${m.servico}`,
        forn: m.equipe || '',
        real: parseFloat(m.vtotal) || 0, prev: 0,
        status: 'Pago'
      });
    }
  });

  // Almoços
  (alm || []).forEach((a, i) => {
    if ((a.vtotal || 0) > 0 && filterDate(a.data)) {
      all.push({
        source: 'alm', idx: i,
        data: a.data, obra: a.obra,
        tipo: 'Almoço Empreiteiro',
        desc: `[Almoço] ${a.empreiteiro}`,
        forn: a.empreiteiro || '',
        real: parseFloat(a.vtotal) || 0, prev: 0,
        status: 'Pago'
      });
    }
  });

  // Agrupa por semana
  const weeks = {};
  all.forEach(item => {
    if (!item.data) return;
    const weekLabel = getWeekLabel(item.data);
    if (!weeks[weekLabel]) {
      weeks[weekLabel] = {
        label: weekLabel,
        startDate: getWeekStart(item.data),
        endDate: getWeekEnd(item.data),
        total: 0,
        count: 0,
        byType: {},
        byObra: {},
        items: []
      };
    }
    weeks[weekLabel].total += item.real;
    weeks[weekLabel].count++;
    weeks[weekLabel].items.push(item);

    // Agrupa por tipo
    const tipo = item.tipo || 'Outros';
    if (!weeks[weekLabel].byType[tipo]) weeks[weekLabel].byType[tipo] = 0;
    weeks[weekLabel].byType[tipo] += item.real;

    // Agrupa por obra
    const obra = item.obra || 'Geral';
    if (!weeks[weekLabel].byObra[obra]) weeks[weekLabel].byObra[obra] = 0;
    weeks[weekLabel].byObra[obra] += item.real;
  });

  // Converte para array e ordena
  return Object.values(weeks).sort((a, b) => a.startDate.localeCompare(b.startDate));
};

window.generateWeeklyPaymentReport = generateWeeklyPaymentReport;

/**
 * Retorna o rótulo da semana (ex: "Semana 1 (01/04 - 07/04)")
 */
function getWeekLabel(dateStr) {
  const start = getWeekStart(dateStr);
  const end = getWeekEnd(dateStr);
  const weekNum = getWeekNumber(dateStr);
  return `Semana ${weekNum} (${formatDateShort(start)} - ${formatDateShort(end)})`;
}

/**
 * Retorna a data de início da semana (segunda-feira)
 */
function getWeekStart(dateStr) {
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajusta para segunda-feira
  const monday = new Date(d.setDate(diff));
  return formatDateISO(monday);
}

/**
 * Retorna a data de fim da semana (domingo)
 */
function getWeekEnd(dateStr) {
  const start = getWeekStart(dateStr);
  const parts = start.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  d.setDate(d.getDate() + 6); // Domingo
  return formatDateISO(d);
}

/**
 * Retorna o número da semana do mês
 */
function getWeekNumber(dateStr) {
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  const firstMonday = new Date(firstDay);
  firstMonday.setDate(1 + (8 - firstDay.getDay()) % 7);
  
  if (d < firstMonday) return 1;
  
  const diffDays = Math.floor((d - firstMonday) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 2;
}

/**
 * Formata data para ISO (YYYY-MM-DD)
 */
function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formata data curta (DD/MM)
 */
function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return `${parts[2]}/${parts[1]}`;
}

/**
 * Gera relatório de pagamentos por funcionário e empreiteiro.
 * Retorna objeto com arrays de trabalhadores e empreiteiros, com totais pagos.
 */
const generateWorkerPaymentReport = (pres, med, trab, year, month) => {
  const filterDate = (d) => {
    if (!year || !month) return true;
    if (!d) return false;
    const parts = d.split('-');
    return parseInt(parts[0]) === parseInt(year) && parseInt(parts[1]) === parseInt(month);
  };

  // Pagamentos a trabalhadores (diárias)
  const workerPayments = {};
  pres.forEach(p => {
    if (!filterDate(p.data)) return;
    if (p.pgtoStatus !== 'Pago') return;
    if (!p.nome || !(p.total > 0)) return;

    const key = p.trab || p.nome;
    if (!workerPayments[key]) {
      const trabData = trab.find(t => t.cod === p.trab);
      workerPayments[key] = {
        cod: p.trab || '',
        nome: p.nome,
        funcao: trabData?.funcao || '',
        equipe: trabData?.equipe || '',
        total: 0,
        dias: 0,
        datas: []
      };
    }
    workerPayments[key].total += parseFloat(p.total) || 0;
    workerPayments[key].dias++;
    workerPayments[key].datas.push(p.data);
  });

  // Pagamentos a empreiteiros (medições)
  const contractorPayments = {};
  med.forEach(m => {
    const dMed = m.semana || m.data;
    if (!filterDate(dMed)) return;
    if (m.pgtoStatus !== 'Pago') return;
    if (!m.equipe || !(m.vtotal > 0)) return;

    const key = m.equipe;
    if (!contractorPayments[key]) {
      contractorPayments[key] = {
        equipe: m.equipe,
        obra: m.obra || '',
        servico: m.servico || '',
        total: 0,
        medicoes: 0,
        datas: []
      };
    }
    contractorPayments[key].total += parseFloat(m.vtotal) || 0;
    contractorPayments[key].medicoes++;
    contractorPayments[key].datas.push(dMed);
  });

  // Converte para arrays e ordena por total (maior para menor)
  const workers = Object.values(workerPayments).sort((a, b) => b.total - a.total);
  const contractors = Object.values(contractorPayments).sort((a, b) => b.total - a.total);

  // Totais
  const totalWorkers = workers.reduce((sum, w) => sum + w.total, 0);
  const totalContractors = contractors.reduce((sum, c) => sum + c.total, 0);

  return {
    workers,
    contractors,
    totalWorkers,
    totalContractors,
    grandTotal: totalWorkers + totalContractors,
    period: year && month ? `${month}/${year}` : 'Todos'
  };
};

window.generateWorkerPaymentReport = generateWorkerPaymentReport;

/**
 * Gera relatório detalhado de pagamentos por semana para cada funcionário e empreiteiro.
 * Retorna objeto com breakdown semanal para cada pessoa/equipe.
 */
const generateDetailedWeeklyPaymentReport = (pres, med, trab, year, month) => {
  const filterDate = (d) => {
    if (!year || !month) return true;
    if (!d) return false;
    const parts = d.split('-');
    return parseInt(parts[0]) === parseInt(year) && parseInt(parts[1]) === parseInt(month);
  };

  // Coleta todas as semanas do mês
  const allWeeks = new Set();
  
  // Pagamentos a trabalhadores (diárias) - agrupados por semana
  const workerPayments = {};
  pres.forEach(p => {
    if (!filterDate(p.data)) return;
    if (p.pgtoStatus !== 'Pago') return;
    if (!p.nome || !(p.total > 0)) return;

    const weekLabel = getWeekLabel(p.data);
    allWeeks.add(weekLabel);
    
    const key = p.trab || p.nome;
    if (!workerPayments[key]) {
      const trabData = trab.find(t => t.cod === p.trab);
      workerPayments[key] = {
        cod: p.trab || '',
        nome: p.nome,
        funcao: trabData?.funcao || '',
        equipe: trabData?.equipe || '',
        weekly: {},
        total: 0,
        dias: 0
      };
    }
    
    if (!workerPayments[key].weekly[weekLabel]) {
      workerPayments[key].weekly[weekLabel] = { total: 0, dias: 0 };
    }
    
    workerPayments[key].weekly[weekLabel].total += parseFloat(p.total) || 0;
    workerPayments[key].weekly[weekLabel].dias++;
    workerPayments[key].total += parseFloat(p.total) || 0;
    workerPayments[key].dias++;
  });

  // Pagamentos a empreiteiros (medições) - agrupados por semana
  const contractorPayments = {};
  med.forEach(m => {
    const dMed = m.semana || m.data;
    if (!filterDate(dMed)) return;
    if (m.pgtoStatus !== 'Pago') return;
    if (!m.equipe || !(m.vtotal > 0)) return;

    const weekLabel = getWeekLabel(dMed);
    allWeeks.add(weekLabel);
    
    const key = m.equipe;
    if (!contractorPayments[key]) {
      contractorPayments[key] = {
        equipe: m.equipe,
        obra: m.obra || '',
        servico: m.servico || '',
        weekly: {},
        total: 0,
        medicoes: 0
      };
    }
    
    if (!contractorPayments[key].weekly[weekLabel]) {
      contractorPayments[key].weekly[weekLabel] = { total: 0, medicoes: 0 };
    }
    
    contractorPayments[key].weekly[weekLabel].total += parseFloat(m.vtotal) || 0;
    contractorPayments[key].weekly[weekLabel].medicoes++;
    contractorPayments[key].total += parseFloat(m.vtotal) || 0;
    contractorPayments[key].medicoes++;
  });

  // Converte para arrays e ordena por total (maior para menor)
  const workers = Object.values(workerPayments).sort((a, b) => b.total - a.total);
  const contractors = Object.values(contractorPayments).sort((a, b) => b.total - a.total);
  
  // Ordena as semanas
  const weeks = Array.from(allWeeks).sort((a, b) => {
    const getWeekNum = (label) => {
      const match = label.match(/Semana (\d+)/);
      return match ? parseInt(match[1]) : 0;
    };
    return getWeekNum(a) - getWeekNum(b);
  });

  // Calcula totais por semana
  const weeklyTotals = {};
  weeks.forEach(w => {
    weeklyTotals[w] = { workers: 0, contractors: 0, total: 0 };
  });
  
  workers.forEach(w => {
    weeks.forEach(week => {
      if (w.weekly[week]) {
        weeklyTotals[week].workers += w.weekly[week].total;
        weeklyTotals[week].total += w.weekly[week].total;
      }
    });
  });
  
  contractors.forEach(c => {
    weeks.forEach(week => {
      if (c.weekly[week]) {
        weeklyTotals[week].contractors += c.weekly[week].total;
        weeklyTotals[week].total += c.weekly[week].total;
      }
    });
  });

  // Totais gerais
  const totalWorkers = workers.reduce((sum, w) => sum + w.total, 0);
  const totalContractors = contractors.reduce((sum, c) => sum + c.total, 0);

  return {
    workers,
    contractors,
    weeks,
    weeklyTotals,
    totalWorkers,
    totalContractors,
    grandTotal: totalWorkers + totalContractors,
    period: year && month ? `${month}/${year}` : 'Todos'
  };
};

window.generateDetailedWeeklyPaymentReport = generateDetailedWeeklyPaymentReport;

try {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      fmt, fmtPct, fmtDate, summarizePresence, calcWeeklyPendingPayments,
      summarizeFinance, getPeriodLabel, calcBudgetProgress, calcSaldo,
      estoqueStatus, statusBadge, uiEmptyState, obName, nextCod,
      sanitizeHTML, safeSetInner, autoBindTableLabels, safeSetText,
      safeSetValue, safeSetStyle, generateWeeklyPaymentReport,
      generateWorkerPaymentReport, generateDetailedWeeklyPaymentReport
    };
  }
} catch (e) {
  // Ignora erro em ambientes sem suporte a CommonJS/Modules (navegador legado)
}
