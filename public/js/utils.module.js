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
    const uniqueKey = `${p.data}_${p.obra}_${trabKey}`;
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

const FIN_CATEGORIES = [
  { key: 'mao-de-obra', label: 'Mão de obra', icon: '👷' },
  { key: 'empreiteiro', label: 'Empreiteiros', icon: '🔨' },
  { key: 'almoco', label: 'Almoços', icon: '🍱' },
  { key: 'material', label: 'Material', icon: '🧱' },
  { key: 'outros', label: 'Outros', icon: '📌' }
];

const normalizeText = (v) => String(v == null ? '' : v)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const parseMoney = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null || v === '') return 0;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const normalizePgtoStatus = (status) => {
  const s = normalizeText(status);
  if (s === 'pago' || s === 'quitado') return 'Pago';
  if (s === 'parcial') return 'Parcial';
  if (s === 'atrasado') return 'Atrasado';
  if (s === 'pago parcial') return 'Parcial';
  return 'Pendente';
};

const categorizeFinanceType = (tipo) => {
  const t = normalizeText(tipo);
  if (!t) return 'outros';
  if (t.includes('almo')) return 'almoco';
  if (t.includes('empreit') || t.includes('medi')) return 'empreiteiro';
  if (t.includes('material') || t.includes('insumo') || t.includes('equipamento')) return 'material';
  if (t.includes('mao de obra') || t.includes('diaria') || t.includes('salario')) return 'mao-de-obra';
  return 'outros';
};

const financeCategoryLabel = (key) => {
  const found = FIN_CATEGORIES.find(c => c.key === key);
  return found ? found.label : 'Outros';
};

/**
 * Valor realmente gravado no lançamento de presença.
 * Regra do app: usa o valor histórico da diária (não o valor atual do cadastro),
 * para que reajustes futuros não alterem o passado.
 */
const getPresencaCusto = (p) => {
  if (!p) return 0;
  const presenca = normalizeText(p.presenca);
  if (presenca === 'falta') return 0;

  const totalGravado = parseMoney(p.total);
  if (totalGravado > 0) return totalGravado;

  const diariaGravada = parseMoney(p.diaria);
  if (!(diariaGravada > 0)) return 0;
  if (presenca === 'meio periodo' || presenca === 'meio-periodo') return diariaGravada / 2;

  const hnorm = parseMoney(p.hnorm);
  const hextra = parseMoney(p.hextra);
  const valorHora = hnorm > 0 ? diariaGravada / hnorm : 0;
  return hnorm > 0 ? diariaGravada + (hextra * valorHora * 1.5) : diariaGravada;
};

function buildFinanceDateFilter(options = {}) {
  let dataInicio = options.dataInicio || '';
  let dataFim = options.dataFim || '';
  const year = options.ano != null ? options.ano : options.year;
  const month = options.mes != null ? options.mes : options.month;

  if (!dataInicio && !dataFim && year != null && month != null) {
    const y = parseInt(year);
    const m = parseInt(month);
    dataInicio = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    dataFim = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  } else if (!dataInicio && !dataFim && options.tipo) {
    const periodo = getPeriodoOptions(options);
    dataInicio = periodo.dataInicio;
    dataFim = periodo.dataFim;
  }

  return (date) => {
    if (!dataInicio && !dataFim) return true;
    if (!date) return false;
    if (dataInicio && date < dataInicio) return false;
    if (dataFim && date > dataFim) return false;
    return true;
  };
}

/**
 * Fonte única de lançamentos financeiros do app.
 * Manuais + presença + medições + almoços, todos normalizados e com o valor
 * histórico efetivamente gravado em cada origem.
 */
function buildFinanceEntries(fin, pres, med, alm, options = {}) {
  const entries = [];
  const filterDate = buildFinanceDateFilter(options);

  (fin || []).forEach((f, i) => {
    if (!f || !filterDate(f.data)) return;
    const isDesconto = normalizeText(f.tipo).includes('desconto');
    const realRaw = parseMoney(f.real);
    const prevRaw = parseMoney(f.prev);
    // Usa o realizado quando informado; senão, o previsto é o valor efetivo do lançamento.
    const realEfetivo = realRaw > 0 ? realRaw : prevRaw;
    const valor = isDesconto ? -Math.abs(realEfetivo) : realEfetivo;
    const prev = isDesconto ? -Math.abs(prevRaw) : prevRaw;
    const status = normalizePgtoStatus(f.status || f.pgtoStatus);
    const valpagoRaw = parseMoney(f.valpago);
    const jaPago = status === 'Pago' ? valor : (status === 'Parcial' ? valpagoRaw : 0);
    const pendente = isDesconto ? 0 : (status === 'Pago' ? 0 : Math.max(0, valor - jaPago));

    entries.push({
      source: 'fin', idx: i, manual: true, auto: false,
      data: f.data || '', obra: f.obra || 'Geral',
      tipo: f.tipo || 'Geral',
      categoria: categorizeFinanceType(f.tipo),
      desc: f.desc || 'Lançamento manual',
      forn: f.forn || '', benef: f.forn || '',
      etapa: f.etapa || '', nf: f.nf || '', pgto: f.pgto || '',
      obs: f.obs || '',
      real: valor, prev, valor, hasPrev: prevRaw !== 0,
      status, jaPago, pendente,
      valpago: valpagoRaw,
      totalBruto: valor,
      origem: 'Lançamento manual'
    });
  });

  (pres || []).forEach((p, i) => {
    if (!p || !filterDate(p.data)) return;
    const total = getPresencaCusto(p);
    if (!(total > 0)) return;
    const status = normalizePgtoStatus(p.pgtoStatus);
    const valpagoRaw = parseMoney(p.valpago);
    const jaPago = status === 'Pago' ? total : (status === 'Parcial' ? Math.min(valpagoRaw, total) : 0);
    const pendente = status === 'Pago' ? 0 : Math.max(0, total - jaPago);
    const nome = p.nome || p.trab || 'Trabalhador';

    entries.push({
      source: 'pre', idx: i, manual: false, auto: true,
      data: p.data || '', obra: p.obra || 'Geral',
      tipo: 'Diária', tipoOrigem: 'Mão de obra própria',
      categoria: 'mao-de-obra',
      desc: nome, forn: nome, benef: nome,
      etapa: '', nf: '', pgto: p.pgto || '',
      obs: p.justif || p.obs || '',
      real: total, prev: 0, valor: total, hasPrev: false,
      status, jaPago, pendente,
      valpago: valpagoRaw,
      totalBruto: total,
      trab: p.trab || '', funcao: p.funcao || '',
      origem: 'Presença'
    });
  });

  (med || []).forEach((m, i) => {
    if (!m) return;
    const data = m.semana || m.data || '';
    if (!filterDate(data)) return;
    const total = parseMoney(m.vtotal);
    if (!(total > 0)) return;
    const status = normalizePgtoStatus(m.pgtoStatus);
    const valpagoRaw = parseMoney(m.valpago);
    const jaPago = status === 'Pago' ? total : (status === 'Parcial' ? Math.min(valpagoRaw, total) : 0);
    const pendente = status === 'Pago' ? 0 : Math.max(0, total - jaPago);
    const equipe = m.equipe || 'Equipe';

    entries.push({
      source: 'med', idx: i, manual: false, auto: true,
      data, obra: m.obra || 'Geral',
      tipo: 'Empreiteiro', tipoOrigem: 'Medição',
      categoria: 'empreiteiro',
      desc: m.servico || 'Medição', forn: equipe, benef: equipe,
      etapa: m.etapa || '', nf: m.nf || '', pgto: m.pgto || '',
      obs: m.obs || '',
      real: total, prev: 0, valor: total, hasPrev: false,
      status, jaPago, pendente,
      valpago: valpagoRaw,
      totalBruto: total,
      origem: 'Medição'
    });
  });

  (alm || []).forEach((a, i) => {
    if (!a || !filterDate(a.data)) return;
    const total = parseMoney(a.vtotal);
    if (!(total > 0)) return;
    const status = normalizePgtoStatus(a.pgtoStatus || a.status);
    const valpagoRaw = parseMoney(a.valpago);
    const jaPago = status === 'Pago' ? total : (status === 'Parcial' ? Math.min(valpagoRaw, total) : 0);
    const pendente = status === 'Pago' ? 0 : Math.max(0, total - jaPago);
    const nome = a.empreiteiro || 'Equipe';

    entries.push({
      source: 'alm', idx: i, manual: false, auto: true,
      data: a.data || '', obra: a.obra || 'Geral',
      tipo: 'Almoço', tipoOrigem: 'Almoço',
      categoria: 'almoco',
      desc: nome, forn: nome, benef: nome,
      etapa: '', nf: '', pgto: '',
      obs: a.obs || '',
      real: total, prev: 0, valor: total, hasPrev: false,
      status, jaPago, pendente,
      valpago: valpagoRaw,
      totalBruto: total,
      qtd: parseMoney(a.qtd),
      origem: 'Almoço'
    });
  });

  const totalsByObra = {};
  const totalsByPeriod = {};
  const byCategory = {};
  FIN_CATEGORIES.forEach(c => {
    byCategory[c.key] = { key: c.key, label: c.label, icon: c.icon, total: 0, pago: 0, aPagar: 0, count: 0 };
  });
  let total = 0;
  let pago = 0;
  let aPagar = 0;

  entries.forEach(f => {
    const cod = f.obra || 'Geral';
    if (!totalsByObra[cod]) totalsByObra[cod] = { prev: 0, real: 0, diff: 0 };
    totalsByObra[cod].prev += f.prev;
    totalsByObra[cod].real += f.valor;
    totalsByObra[cod].diff = totalsByObra[cod].real - totalsByObra[cod].prev;

    const cat = byCategory[f.categoria] || byCategory.outros;
    cat.total += f.valor;
    cat.pago += f.jaPago;
    cat.aPagar += f.pendente;
    cat.count++;

    total += f.valor;
    pago += f.jaPago;
    aPagar += f.pendente;

    if (f.data) {
      const pId = getPeriodLabel(f.data, options.viewType || 'semanal');
      if (!totalsByPeriod[pId]) totalsByPeriod[pId] = { real: 0, items: 0 };
      totalsByPeriod[pId].real += f.valor;
      totalsByPeriod[pId].items++;
    }
  });

  const kpis = { total, pago, aPagar, count: entries.length };
  return { all: entries, entries, totalsByObra, totalsByPeriod, byCategory, kpis };
}

function summarizeFinanceCosts(fin, pres, med, alm, options = {}) {
  const summary = buildFinanceEntries(fin, pres, med, alm, options);
  return {
    ...summary,
    total: summary.kpis.total,
    pago: summary.kpis.pago,
    aPagar: summary.kpis.aPagar
  };
}

/**
 * Consolida todo o financeiro (Manuais, Presença, Medições, Almoços).
 * Aceita a assinatura antiga (..., year, month, viewType) e a nova
 * (..., { ano, mes, viewType }) ou (..., { dataInicio, dataFim }).
 */
const summarizeFinance = (fin, pres, med, alm, yearOrOptions, month, viewType) => {
  const options = (yearOrOptions && typeof yearOrOptions === 'object')
    ? { ...yearOrOptions }
    : { ano: yearOrOptions, mes: month, viewType };
  return buildFinanceEntries(fin, pres, med, alm, options);
};

window.summarizeFinance = summarizeFinance;
window.summarizeFinanceCosts = summarizeFinanceCosts;
window.buildFinanceEntries = buildFinanceEntries;
window.getPresencaCusto = getPresencaCusto;
window.categorizeFinanceType = categorizeFinanceType;
window.financeCategoryLabel = financeCategoryLabel;
window.FIN_CATEGORIES = FIN_CATEGORIES;

/**
 * Calcula custos de diárias por período.
 * Usa SEMPRE o valor gravado na presença (nunca a diária atual do cadastro).
 * options pode ter: tipo ('semana', 'mes', 'hoje'), dataInicio/dataFim ou ano/mes.
 */
const calcCustosDiarias = (presenca, options = {}) => {
  const { all } = buildFinanceEntries([], presenca, [], [], options);
  const pendente = all.filter(p => p.status !== 'Pago' && p.pendente > 0);
  return {
    registros: all.length,
    custoTotal: all.reduce((a, p) => a + p.valor, 0),
    pendente,
    pendenteTotal: all.reduce((a, p) => a + p.pendente, 0),
    porObra: groupedByObra(all)
  };
};

/**
 * Calcula custos de medições (empreitas) por período
 */
const calcCustosMedicoes = (medicao, options = {}) => {
  const { all } = buildFinanceEntries([], [], medicao, [], options);
  const pendente = all.filter(m => m.status !== 'Pago' && m.pendente > 0);
  return {
    registros: all.length,
    custoTotal: all.reduce((a, m) => a + m.valor, 0),
    pendente,
    pendenteTotal: all.reduce((a, m) => a + m.pendente, 0),
    porObra: groupedByObra(all)
  };
};

/**
 * Calcula custos financeiros (lançamentos manuais) por período
 */
const calcCustosFinanceiro = (financeiro, options = {}) => {
  const { all } = buildFinanceEntries(financeiro, [], [], [], options);
  const pendente = all.filter(f => f.status !== 'Pago' && f.pendente > 0);
  return {
    registros: all.length,
    custoTotal: all.reduce((a, f) => a + f.valor, 0),
    pendente,
    pendenteTotal: all.reduce((a, f) => a + f.pendente, 0),
    porObra: groupedByObra(all)
  };
};

/**
 * Retorna opções de período (semana atual, mês atual, etc)
 * Se baseDate for fornecida (YYYY-MM-DD), calcula o período em relação a ela.
 */
function getPeriodoOptions(options = {}) {
  const { tipo = 'semana', baseDate } = options;
  let reference;
  
  if (baseDate) {
    const parts = baseDate.split('-');
    reference = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  } else {
    const now = new Date();
    reference = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  }
  
  if (tipo === 'hoje') {
    const dStr = reference.getFullYear() + '-' + String(reference.getMonth() + 1).padStart(2, '0') + '-' + String(reference.getDate()).padStart(2, '0');
    return { dataInicio: dStr, dataFim: dStr };
  }
  
  if (tipo === 'semana') {
    const startOfWeek = new Date(reference);
    const day = startOfWeek.getDay();
    const diff = day === 0 ? 6 : day - 1; // Segunda-feira como início
    startOfWeek.setDate(reference.getDate() - diff);
    const dataInicio = startOfWeek.getFullYear() + '-' + String(startOfWeek.getMonth() + 1).padStart(2, '0') + '-' + String(startOfWeek.getDate()).padStart(2, '0');
    const dataFim = reference.getFullYear() + '-' + String(reference.getMonth() + 1).padStart(2, '0') + '-' + String(reference.getDate()).padStart(2, '0');
    return { dataInicio, dataFim };
  }
  
  if (tipo === 'mes') {
    const dataInicio = reference.getFullYear() + '-' + String(reference.getMonth() + 1).padStart(2, '0') + '-01';
    const dataFim = reference.getFullYear() + '-' + String(reference.getMonth() + 1).padStart(2, '0') + '-' + String(reference.getDate()).padStart(2, '0');
    return { dataInicio, dataFim };
  }
  
  // Default: semana
  const startOfWeek = new Date(reference);
  const day = startOfWeek.getDay();
  const diff = day === 0 ? 6 : day - 1;
  startOfWeek.setDate(reference.getDate() - diff);
  return {
    dataInicio: startOfWeek.toISOString().split('T')[0],
    dataFim: reference.toISOString().split('T')[0]
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
window.getPeriodLabel = getPeriodLabel;

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

  // Semanal (Inicia no Domingo) - retorna rótulo compatível com o dashboard (1-5)
  const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  const firstSunday = new Date(firstOfMonth);
  firstSunday.setDate(1 + (7 - firstOfMonth.getDay()) % 7);

  if (d < firstSunday) return 'Semana 1';
  const diffDays = Math.floor((d.getTime() - firstSunday.getTime()) / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(diffDays / 7) + 2;
  // Limita a 5 semanas no mês (última semana pode ser parcial)
  return weekNum <= 5 ? `Semana ${weekNum}` : 'Semana 5';
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
