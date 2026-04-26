/**
 * utilitários de lógica pura (sem dependência de DOM)
 * para facilitar testes unitários e modularização.
 * Atribui diretamente ao window para evitar conflitos de declaração.
 */

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

const escapeHTML = (str) => {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
};

window.escapeHTML = escapeHTML;

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
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(todayObj.getDate() - diff);
  const strWeek = startOfWeek.getFullYear() + '-' + String(startOfWeek.getMonth() + 1).padStart(2, '0') + '-' + String(startOfWeek.getDate()).padStart(2, '0');

  const seen = new Set();
  const filteredAll = presencaArray.filter(p => {
    if (!['Pendente', 'Parcial', 'Atrasado'].includes(p.pgtoStatus || 'Pendente')) return false;
    if (!(Number(p.total) > 0)) return false;
    if (p.data < strWeek || p.data > todayStr) return false;
    const trabKey = p.trab || p.nome;
    const uniqueKey = `${p.data}_${trabKey}`;
    if (seen.has(uniqueKey)) return false;
    seen.add(uniqueKey);
    return true;
  });

  return obrasArray.map(o => {
    const pPendentes = filteredAll.filter(p => p.obra === o.cod);
    const totalPendente = pPendentes.reduce((a, r) => {
      const total = Number(r.total) || 0;
      const pago = r.pgtoStatus === 'Parcial' ? (Number(r.valpago) || 0) : 0;
      return a + Math.max(0, total - pago);
    }, 0);
    return {
      obraCod: o.cod,
      obraNome: o.nome,
      totalPendente,
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

  // Presença - SEM deduplicação para mostrar todos registros no financeiro
  pres.forEach((p, i) => {
    if ((p.total || 0) > 0 && filterDate(p.data)) {
      const total = parseFloat(p.total) || 0;
      const pago = p.pgtoStatus === 'Parcial' ? (parseFloat(p.valpago) || 0) : 0;
      const pendente = p.pgtoStatus !== 'Pago' ? Math.max(0, total - pago) : 0;
      all.push({
        source: 'pre', idx: i,
        data: p.data, obra: p.obra,
        tipo: 'Mão de obra própria',
        desc: `[Diária] ${p.nome}`,
        forn: p.nome || '',
        real: pendente, prev: 0,
        status: p.pgtoStatus || 'Pendente',
        totalBruto: total,
        jaPago: pago
      });
    }
  });

  // Medições - SEM deduplicação
  med.forEach((m, i) => {
    const dMed = m.semana || m.data;
    if ((m.vtotal || 0) > 0 && filterDate(dMed)) {
      const total = parseFloat(m.vtotal) || 0;
      const pago = m.pgtoStatus === 'Parcial' ? (parseFloat(m.valpago) || 0) : 0;
      const pendente = m.pgtoStatus !== 'Pago' ? Math.max(0, total - pago) : 0;
      all.push({
        source: 'med', idx: i,
        data: dMed, obra: m.obra,
        tipo: 'Empreiteiro',
        desc: `[Medição] ${m.servico}`,
        forn: m.equipe || '',
        real: pendente, prev: 0,
        status: m.pgtoStatus || 'Pendente',
        totalBruto: total,
        jaPago: pago
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
        real: parseFloat(a.vtotal), prev: 0,
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
 * Calcula custos de diárias por período
 * options pode ter: tipo ('semana', 'mes', 'hoje') OU dataInicio/dataFim
 */
const calcCustosDiarias = (presenca, options = {}) => {
  let dataInicio, dataFim;
  
  if (options.dataInicio && options.dataFim) {
    dataInicio = options.dataInicio;
    dataFim = options.dataFim;
  } else {
    const periodo = getPeriodoOptions(options);
    dataInicio = periodo.dataInicio;
    dataFim = periodo.dataFim;
  }
  
  const seen = new Set();
  const diarias = (presenca || []).filter(p => {
    if (!p || !p.data || p.data < dataInicio || p.data > dataFim || !(parseFloat(p.total) || 0) > 0) return false;
    const trabKey = p.trab || p.nome;
    const uniqueKey = `${p.data}_${trabKey}`;
    if (seen.has(uniqueKey)) return false;
    seen.add(uniqueKey);
    return true;
  });
  
  const custoTotal = diarias.reduce((a, p) => a + (parseFloat(p.total) || 0), 0);
  const pendente = diarias.filter(p => p.pgtoStatus !== 'Pago');
  const pendenteTotal = pendente.reduce((a, p) => {
    const total = parseFloat(p.total) || 0;
    const pago = p.pgtoStatus === 'Parcial' ? (parseFloat(p.valpago) || 0) : 0;
    return a + Math.max(0, total - pago);
  }, 0);
  
  return {
    registros: diarias.length,
    custoTotal,
    pendente,
    pendenteTotal,
    porObra: groupedByObra(diarias)
  };
};

/**
 * Calcula custos de medições (empreitas) por período
 */
const calcCustosMedicoes = (medicao, options = {}) => {
  const { dataInicio, dataFim } = getPeriodoOptions(options);
  
  const seen = new Set();
  const medicoes = (medicao || []).filter(m => {
    const d = m.semana || m.data;
    if (!d || d < dataInicio || d > dataFim || !(parseFloat(m.vtotal) || 0) > 0) return false;
    const uniqueKey = `${d}_${m.equipe || m.servico}`;
    if (seen.has(uniqueKey)) return false;
    seen.add(uniqueKey);
    return true;
  });
  
  const custoTotal = medicoes.reduce((a, m) => a + (parseFloat(m.vtotal) || 0), 0);
  const pendente = medicoes.filter(m => m.pgtoStatus !== 'Pago');
  const pendenteTotal = pendente.reduce((a, m) => {
    const total = parseFloat(m.vtotal) || 0;
    const pago = m.pgtoStatus === 'Parcial' ? (parseFloat(m.valpago) || 0) : 0;
    return a + Math.max(0, total - pago);
  }, 0);
  
  return {
    registros: medicoes.length,
    custoTotal,
    pendente,
    pendenteTotal,
    porObra: groupedByObra(medicoes)
  };
};

/**
 * Calcula custos financeiros por período
 */
const calcCustosFinanceiro = (financeiro, options = {}) => {
  const { dataInicio, dataFim } = getPeriodoOptions(options);
  
  const seen = new Set();
  const lancamentos = (financeiro || []).filter(f => {
    if (!f || !f.data || f.data < dataInicio || f.data > dataFim) return false;
    const uniqueKey = `${f.data}_${f.desc || f.forn}`;
    if (seen.has(uniqueKey)) return false;
    seen.add(uniqueKey);
    return true;
  });
  
  const custoTotal = lancamentos.reduce((a, f) => {
    const val = Number(f.real) || Number(f.prev) || 0;
    return a + val;
  }, 0);
  
  const pendente = lancamentos.filter(f => f.status !== 'Pago');
  const pendenteTotal = pendente.reduce((a, f) => {
    const total = Number(f.real) || Number(f.prev) || 0;
    const pago = f.status === 'Parcial' ? (parseFloat(f.valpago) || 0) : 0;
    return a + Math.max(0, total - pago);
  }, 0);
  
  return {
    registros: lancamentos.length,
    custoTotal,
    pendente,
    pendenteTotal,
    porObra: groupedByObra(lancamentos)
  };
};

/**
 * Retorna opções de período (semana atual, mês atual, etc) no fuso brasileiro
 */
function getPeriodoOptions(options = {}) {
  const now = new Date();
  const hoje = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const { tipo = 'semana' } = options;
  
  if (tipo === 'hoje') {
    const todayStr = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');
    return { dataInicio: todayStr, dataFim: todayStr };
  }
  
  if (tipo === 'semana') {
    const startOfWeek = new Date(hoje);
    const day = startOfWeek.getDay();
    const diff = day === 0 ? 6 : day - 1;
    startOfWeek.setDate(hoje.getDate() - diff);
    const dataInicio = startOfWeek.getFullYear() + '-' + String(startOfWeek.getMonth() + 1).padStart(2, '0') + '-' + String(startOfWeek.getDate()).padStart(2, '0');
    const dataFim = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');
    return { dataInicio, dataFim };
  }
  
  if (tipo === 'mes') {
    const startOfMonth = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const dataInicio = startOfMonth.getFullYear() + '-' + String(startOfMonth.getMonth() + 1).padStart(2, '0') + '-' + String(startOfMonth.getDate()).padStart(2, '0');
    const dataFim = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');
    return { dataInicio, dataFim };
  }
  
  // Default: semana
  const startOfWeek = new Date(hoje);
  const day = startOfWeek.getDay();
  const diff = day === 0 ? 6 : day - 1;
  startOfWeek.setDate(hoje.getDate() - diff);
  return {
    dataInicio: startOfWeek.toISOString().split('T')[0],
    dataFim: hoje.toISOString().split('T')[0]
  };
}

/**
 * Agrupa array por obra
 */
function groupedByObra(arr) {
  const grouped = {};
  arr.forEach(item => {
    const obra = item.obra || 'Geral';
    if (!grouped[obra]) grouped[obra] = [];
    grouped[obra].push(item);
  });
  return grouped;
}

window.calcCustosDiarias = calcCustosDiarias;
window.calcCustosMedicoes = calcCustosMedicoes;
window.calcCustosFinanceiro = calcCustosFinanceiro;
window.getPeriodoOptions = getPeriodoOptions;

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

// Exports for testing (vitest roda como module, navegador roda como defer)
// O try/catch evita SyntaxError quando carregado sem type="module"
