/**
 * utilitários de lógica pura (sem dependência de DOM)
 * para facilitar testes unitários e modularização.
 * Atribui diretamente ao window para evitar conflitos de declaração.
 */

window.fmt = (v) => v != null && !isNaN(v)
  ? 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : '—';

window.fmtPct = (v) => v != null ? (v * 100).toFixed(1) + '%' : '—';

window.fmtDate = (d) => {
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

/**
 * Calcula pagamentos pendentes da semana atual por obra.
 */
const calcWeeklyPendingPayments = (presencaArray, obrasArray, todayStr) => {
  const todayObj = new Date(todayStr);
  const startOfWeek = new Date(todayObj);
  startOfWeek.setDate(todayObj.getDate() - todayObj.getDay());
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
        real: parseFloat(p.total), prev: 0,
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
        real: parseFloat(m.vtotal), prev: 0,
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
    const key = `${o.obra}|${o.etapa}`;
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

// Funções para window (evita declaração no escopo global)
window.calcSaldo = function(item) {
  return (parseFloat(item.entrada) || 0) - (parseFloat(item.saida) || 0);
};

window.estoqueStatus = function(item) {
  const saldo = window.calcSaldo(item);
  if (saldo <= 0) return 'SEM ESTOQUE';
  if (saldo <= item.min) return 'CRÍTICO';
  if (saldo <= item.min * 1.5) return 'BAIXO';
  return 'NORMAL';
};
