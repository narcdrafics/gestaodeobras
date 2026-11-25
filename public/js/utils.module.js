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
    return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR');
  }

  if (typeof val === 'string') {
    // Datas ISO, com ou sem hora: "2026-05-07", "2026-05-07T00:00:00Z", "2026-05-07 10:30".
    // O horário é descartado para não quebrar a coluna de data.
    const iso = val.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
    if (iso) {
      const [, ano, mes, dia] = iso;
      return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
    }
    // Já está em pt-BR (ou é outro texto): devolve sem alterar.
    return val;
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
  { key: 'mao-de-obra', label: 'Mão de obra', icon: 'engineering' },
  { key: 'empreiteiro', label: 'Empreiteiros', icon: 'handyman' },
  { key: 'almoco', label: 'Almoços', icon: 'restaurant' },
  { key: 'material', label: 'Material', icon: 'build' },
  { key: 'outros', label: 'Outros', icon: 'push_pin' }
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

/**
 * Categoria do ITEM DO ORÇAMENTO (o previsto).
 * O realizado de um serviço com empreiteiro entra pelas medições (categoria "empreiteiro"), então o previsto
 * precisa cair na mesma categoria mesmo que o Tipo tenha ficado no padrão do formulário ("Mão de obra").
 * Material e equipamento continuam no tipo escolhido.
 */
const categorizeBudgetItem = (o) => {
  const base = categorizeFinanceType(o && o.tipo);
  if (base === 'mao-de-obra' && o && normalizeText(o.empreiteiro)) return 'empreiteiro';
  return base;
};

/**
 * Índice de edição vindo do campo oculto dos formulários (-1 = registro novo).
 * `parseInt(v) || -1` tratava o índice 0 como "novo" e duplicava o primeiro item ao editar.
 */
const parseEditIdx = (v) => {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n >= 0 ? n : -1;
};

const financeCategoryLabel = (key) => {
  const found = FIN_CATEGORIES.find(c => c.key === key);
  return found ? found.label : 'Outros';
};

// ==================== MEDIÇÃO / PRODUÇÃO ====================
const normalizeAprovacao = (v) => {
  const s = normalizeText(v);
  if (s === 'aprovada' || s === 'aprovado') return 'Aprovada';
  if (s === 'rejeitada' || s === 'rejeitado') return 'Rejeitada';
  return 'Pendente';
};

// Registros antigos não tinham aprovação: continuam valendo como aprovados.
const medicaoAprovacao = (m) => (m && (m.aprovacao || m.aprovado))
  ? normalizeAprovacao(m.aprovacao || m.aprovado)
  : 'Aprovada';

/** Chave textual legada (obra + etapa + descrição), usada só como fallback/migração. */
const normalizeServiceKey = (o) => {
  if (!o) return '';
  const desc = o.desc != null ? o.desc : o.servico;
  return [o.obra, o.etapa, desc].map(normalizeText).join('|');
};

/** ID estável para novos serviços do orçamento. */
const newServiceId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'svc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
};

const sameServiceHint = (a, b) => {
  const x = normalizeText(a);
  const y = normalizeText(b);
  return Boolean(x) && x === y;
};

/**
 * Migração idempotente para vínculo por ID.
 * - garante um ID único em cada linha do orçamento;
 * - liga cada medição antiga ao serviço correspondente;
 * - em chaves ambíguas, usa frente/equipe/sub-etapa para escolher;
 * - sem correspondência, mantém a medição avulsa e marca para revisão.
 * A chave textual antiga é preservada em `orcKey` para rastreabilidade.
 */
function migrateServiceIds(db) {
  if (!db || !Array.isArray(db.orcamento) || !Array.isArray(db.medicao)) return db;

  const used = new Set();
  const byLegacy = new Map();
  const budget = db.orcamento.filter(Boolean);

  budget.forEach(o => {
    if (!o.id || used.has(String(o.id))) o.id = newServiceId();
    o.id = String(o.id);
    used.add(o.id);
    const legacy = normalizeServiceKey(o);
    if (legacy) {
      if (!byLegacy.has(legacy)) byLegacy.set(legacy, []);
      if (!byLegacy.get(legacy).includes(o.id)) byLegacy.get(legacy).push(o.id);
    }
  });

  const validIds = new Set(budget.map(o => o.id));

  db.medicao.forEach(m => {
    if (!m) return;
    const atual = m.serviceId ? String(m.serviceId) : '';
    if (atual && validIds.has(atual)) {
      if (!m.orcKey) m.orcKey = atual;
      return;
    }

    const legado = m.orcKey
      ? normalizeText(m.orcKey)
      : normalizeServiceKey({ obra: m.obra, etapa: m.etapa, desc: m.servico });
    const candidatos = (byLegacy.get(legado) || [])
      .map(id => budget.find(o => o.id === id))
      .filter(Boolean);

    let escolhido = null;
    let revisar = false;

    if (candidatos.length === 1) {
      escolhido = candidatos[0];
    } else if (candidatos.length > 1) {
      const score = (o) =>
        ((sameServiceHint(m.subEtapa, o.subEtapa) || sameServiceHint(m.subEtapa, o.subetapa)) ? 4 : 0) +
        (sameServiceHint(m.frente, o.frente) ? 3 : 0) +
        ((sameServiceHint(m.equipe, o.equipe) || sameServiceHint(m.equipe, o.empreiteiro)) ? 2 : 0);
      const ranked = candidatos.map(o => ({ o, s: score(o) })).sort((a, b) => b.s - a.s);
      escolhido = ranked[0].o;
      revisar = ranked[0].s === 0 || Boolean(ranked[1] && ranked[1].s === ranked[0].s);
    }

    if (escolhido) {
      m.serviceId = escolhido.id;
      if (!m.orcKey) m.orcKey = legado;
      if (revisar) m.serviceIdReview = true;
    } else {
      if (m.serviceId) delete m.serviceId;
      if (revisar) m.serviceIdReview = true;
    }
  });

  return db;
}

/** Chave canônica do serviço do orçamento: ID estável primeiro, texto só no legado. */
const budgetServiceKey = (o) => {
  if (!o) return '';
  if (o.id) return String(o.id);
  return normalizeServiceKey(o);
};

const medicaoServiceKey = (m) => {
  if (!m) return '';
  if (m.serviceId) return String(m.serviceId);
  if (m.orcKey) return String(m.orcKey);
  return normalizeServiceKey({ obra: m.obra, etapa: m.etapa, desc: m.servico });
};

/**
 * Consolida a produção de uma obra por serviço do orçamento.
 * - `qacum` é o histórico completo do serviço (não só o período filtrado);
 * - medições rejeitadas não contam como produção nem como custo;
 * - `fisico` é o avanço acumulado ponderado pelo valor de cada serviço.
 */
const buildMedicaoResumo = (db, obraCod, options = {}) => {
  const dataInicio = options.dataInicio || '';
  const dataFim = options.dataFim || '';
  const etapaFilter = normalizeText(options.etapa || '');
  const aprovFilter = options.aprovacao ? normalizeAprovacao(options.aprovacao) : '';
  const inPeriod = (d) => {
    if (!dataInicio && !dataFim) return true;
    if (!d) return false;
    if (dataInicio && d < dataInicio) return false;
    if (dataFim && d > dataFim) return false;
    return true;
  };

  const servicos = new Map();
  const ensureServico = (key, base) => {
    if (!servicos.has(key)) {
      servicos.set(key, {
        key, etapa: '', subEtapa: '', empreiteiro: '', frente: '',
        desc: '', unid: '', qprev: 0, vunit: 0, vtotal: 0,
        qacum: 0, valorAcum: 0, count: 0, aprovPend: 0, temOrcamento: false
      });
    }
    const s = servicos.get(key);
    if (base) {
      if (!s.etapa && base.etapa) s.etapa = base.etapa;
      if (!s.subEtapa && (base.subEtapa || base.subetapa)) s.subEtapa = base.subEtapa || base.subetapa;
      if (!s.empreiteiro && base.empreiteiro) s.empreiteiro = base.empreiteiro;
      if (!s.frente && base.frente) s.frente = base.frente;
      if (!s.desc && base.desc) s.desc = base.desc;
      if (!s.unid && base.unid) s.unid = base.unid;
    }
    return s;
  };

  (db.orcamento || []).filter(o => o && o.obra === obraCod).forEach(o => {
    const key = budgetServiceKey(o);
    const s = ensureServico(key, o);
    s.temOrcamento = true;
    s.qprev += parseMoney(o.qtd);
    s.vtotal += parseMoney(o.vtotal);
    if (!(s.vunit > 0)) s.vunit = parseMoney(o.vunit);
  });

  const todas = (db.medicao || [])
    .map((m, i) => ({ ...m, _idx: i }))
    .filter(m => m && m.obra === obraCod);

  // Acumulado = histórico completo (medições rejeitadas ficam de fora).
  todas.filter(m => medicaoAprovacao(m) !== 'Rejeitada').forEach(m => {
    const key = medicaoServiceKey(m);
    const s = ensureServico(key, {
      etapa: m.etapa, subEtapa: m.subEtapa, desc: m.servico, unid: m.unid,
      empreiteiro: m.equipe, frente: m.frente
    });
    s.qacum += parseMoney(m.qreal);
    s.valorAcum += parseMoney(m.vtotal);
    s.count++;
    if (!(s.vunit > 0)) s.vunit = parseMoney(m.vunit);
    // Compatibilidade: medições antigas/avulsas trazem a própria quantidade prevista.
    if (!s.temOrcamento) s.qprev = Math.max(s.qprev, parseMoney(m.qprev));
  });

  const lista = todas.filter(m =>
    inPeriod(m.semana || m.data) &&
    (!etapaFilter || normalizeText(m.etapa) === etapaFilter) &&
    (!aprovFilter || medicaoAprovacao(m) === aprovFilter)
  );

  lista.filter(m => medicaoAprovacao(m) === 'Pendente').forEach(m => {
    const s = ensureServico(medicaoServiceKey(m));
    s.aprovPend += parseMoney(m.vtotal);
  });

  const servicosArr = [...servicos.values()]
    .filter(s => (!etapaFilter || normalizeText(s.etapa) === etapaFilter))
    .map(s => ({
      ...s,
      saldo: s.qprev - s.qacum,
      pct: s.qprev > 0 ? (s.qacum / s.qprev) * 100 : null
    }))
    .filter(s => s.temOrcamento || s.count > 0)
    .sort((a, b) => (a.etapa || '').localeCompare(b.etapa || '') || (a.desc || '').localeCompare(b.desc || ''));

  const valorMedido = lista.reduce((a, m) => a + parseMoney(m.vtotal), 0);
  const aAprovar = lista.filter(m => medicaoAprovacao(m) === 'Pendente').reduce((a, m) => a + parseMoney(m.vtotal), 0);
  const aprovado = lista.filter(m => medicaoAprovacao(m) === 'Aprovada').reduce((a, m) => a + parseMoney(m.vtotal), 0);
  const rejeitado = lista.filter(m => medicaoAprovacao(m) === 'Rejeitada').reduce((a, m) => a + parseMoney(m.vtotal), 0);

  // Peso: valor do orçamento quando existe; senão, o valor já medido (legado).
  const comPeso = servicosArr
    .map(s => ({ s, peso: (s.temOrcamento && s.vtotal > 0) ? s.vtotal : s.valorAcum }))
    .filter(x => x.s.qprev > 0 && x.peso > 0);
  const pesoTotal = comPeso.reduce((a, x) => a + x.peso, 0);
  const fisico = pesoTotal > 0
    ? comPeso.reduce((a, x) => a + Math.min(100, Math.max(0, x.s.pct == null ? 0 : x.s.pct)) * x.peso, 0) / pesoTotal
    : null;

  return {
    servicos: servicosArr,
    medicoes: lista.slice().sort((a, b) => (b.semana || '').localeCompare(a.semana || '')),
    totais: {
      valorMedido, aAprovar, aprovado, rejeitado,
      fisico,
      retrabalho: lista.reduce((a, m) => a + parseMoney(m.retrQtd), 0),
      count: lista.length
    }
  };
};

/** Quantidade já medida de um serviço, excluindo o registro em edição. */
const medicaoQuantidadeAnterior = (db, info = {}) => {
  const key = info.serviceId || info.orcKey
    || [info.obra, info.etapa, info.servico].map(normalizeText).join('|');
  const excludeIdx = Number.isInteger(info.excludeIdx) ? info.excludeIdx : -1;
  return (db.medicao || []).reduce((acc, m, i) => {
    if (!m || i === excludeIdx || m.obra !== info.obra) return acc;
    if (medicaoAprovacao(m) === 'Rejeitada') return acc;
    return medicaoServiceKey(m) === key ? acc + parseMoney(m.qreal) : acc;
  }, 0);
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

  let diariaGravada = parseMoney(p.diaria);
  // Registros antigos podem não ter a diária gravada. Nesse caso, usa a diária
  // atual do cadastro apenas como fallback; o valor histórico continua tendo prioridade.
  if (!(diariaGravada > 0) && typeof DB !== 'undefined' && Array.isArray(DB.trabalhadores)) {
    const worker = DB.trabalhadores.find(t => t && (t.cod === p.trab || (!p.trab && t.nome === p.nome)));
    if (worker) diariaGravada = parseMoney(worker.diaria);
  }
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
  const filterObra = options.obra
    ? (value) => (value || 'Geral') === options.obra
    : () => true;

  (fin || []).forEach((f, i) => {
    if (!f || !filterDate(f.data) || !filterObra(f.obra)) return;
    const isDesconto = normalizeText(f.tipo).includes('desconto');
    const realRaw = parseMoney(f.real);
    const prevRaw = parseMoney(f.prev);
    // Usa o realizado quando informado; senão, o previsto é o valor efetivo do lançamento.
    const realEfetivo = realRaw > 0 ? realRaw : prevRaw;
    const valor = isDesconto ? -Math.abs(realEfetivo) : realEfetivo;
    const prev = isDesconto ? -Math.abs(prevRaw) : prevRaw;
    // `valorRealizado` é o que efetivamente aconteceu. Diferente de `valor`, ele
    // NÃO usa o previsto como fallback: lançamento só previsto não é custo realizado.
    const valorRealizado = isDesconto ? -Math.abs(realRaw) : realRaw;
    const valorPrevisto = isDesconto ? -Math.abs(prevRaw) : prevRaw;
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
      serviceId: f.serviceId ? String(f.serviceId) : '',
      obs: f.obs || '',
      real: valor, prev, valor, hasPrev: prevRaw !== 0,
      valorRealizado, valorPrevisto,
      status, jaPago, pendente,
      valpago: valpagoRaw,
      totalBruto: valor,
      origem: 'Lançamento manual'
    });
  });

  (pres || []).forEach((p, i) => {
    if (!p || !filterDate(p.data) || !filterObra(p.obra)) return;
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
      serviceId: p.serviceId ? String(p.serviceId) : '',
      obs: p.justif || p.obs || '',
      real: total, prev: 0, valor: total, hasPrev: false,
      valorRealizado: total, valorPrevisto: 0,
      status, jaPago, pendente,
      valpago: valpagoRaw,
      totalBruto: total,
      trab: p.trab || '', funcao: p.funcao || '',
      origem: 'Presença'
    });
  });

  (med || []).forEach((m, i) => {
    if (!m || !filterObra(m.obra)) return;
    if (medicaoAprovacao(m) === 'Rejeitada') return; // rejeitada não é custo
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
      serviceId: medicaoServiceKey(m),
      obs: m.obs || '',
      real: total, prev: 0, valor: total, hasPrev: false,
      valorRealizado: total, valorPrevisto: 0,
      status, jaPago, pendente,
      aprovacao: medicaoAprovacao(m),
      valpago: valpagoRaw,
      totalBruto: total,
      origem: 'Medição'
    });
  });

  (alm || []).forEach((a, i) => {
    if (!a || !filterDate(a.data) || !filterObra(a.obra)) return;
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
      serviceId: a.serviceId ? String(a.serviceId) : '',
      obs: a.obs || '',
      real: total, prev: 0, valor: total, hasPrev: false,
      valorRealizado: total, valorPrevisto: 0,
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

/**
 * Board do Orçamento: uma linha por serviço, agrupada por etapa/sub-etapa.
 * - previsto vem do orçamento;
 * - medido vem de buildMedicaoResumo (histórico acumulado, sem duplicar medições);
 * - pago/a pagar vem das entradas do Financeiro vinculadas por serviceId.
 * Despesas sem serviço vinculado aparecem só no subtotal da etapa, nunca
 * repetidas em cada serviço.
 */
const buildOrcamentoBoard = (db, options = {}) => {
  const safeDb = db && typeof db === 'object' ? db : {};
  const obra = options.obra || '';
  const budget = (Array.isArray(safeDb.orcamento) ? safeDb.orcamento : [])
    .map((o, i) => ({ ...o, _idx: i }))
    .filter(o => o && (!obra || o.obra === obra));

  const obras = obra
    ? [obra]
    : [...new Set(budget.map(o => o.obra).filter(Boolean))];

  const medidoPorChave = new Map();
  obras.forEach(cod => {
    const resumo = buildMedicaoResumo(safeDb, cod);
    (resumo.servicos || []).forEach(s => medidoPorChave.set(s.key, s));
  });

  const financeiro = buildFinanceEntries(
    safeDb.financeiro || [], safeDb.presenca || [],
    safeDb.medicao || [], safeDb.almocos || [], {}
  );
  const pagoPorServico = new Map();
  const aPagarPorServico = new Map();
  const outrosPorEtapa = new Map();
  (financeiro.all || []).forEach(e => {
    if (obra && (e.obra || 'Geral') !== obra) return;
    const sid = e.serviceId ? String(e.serviceId) : '';
    if (sid) {
      pagoPorServico.set(sid, (pagoPorServico.get(sid) || 0) + e.jaPago);
      aPagarPorServico.set(sid, (aPagarPorServico.get(sid) || 0) + e.pendente);
      return;
    }
    if (!e.etapa) return;
    const outro = outrosPorEtapa.get(e.etapa) || { pago: 0, aPagar: 0 };
    outro.pago += e.jaPago;
    outro.aPagar += e.pendente;
    outrosPorEtapa.set(e.etapa, outro);
  });

  const linhas = budget.map(o => {
    const key = budgetServiceKey(o);
    const medido = medidoPorChave.get(key);
    const medidoQtd = medido ? medido.qacum : 0;
    const medidoValor = medido ? medido.valorAcum : 0;
    const qtd = parseMoney(o.qtd);
    const vtotal = parseMoney(o.vtotal);
    const sid = String(o.id || key);
    return {
      ...o,
      id: sid,
      key,
      subEtapa: o.subEtapa || o.subetapa || '',
      medidoQtd,
      medidoValor,
      saldo: qtd - medidoQtd,
      pct: qtd > 0 ? (medidoQtd / qtd) * 100 : null,
      pago: pagoPorServico.get(sid) || 0,
      aPagar: aPagarPorServico.get(sid) || 0,
      diferenca: vtotal - medidoValor
    };
  });

  const gruposMap = new Map();
  linhas.forEach(o => {
    const gk = `${o.etapa || ''}|${o.subEtapa || ''}`;
    if (!gruposMap.has(gk)) {
      gruposMap.set(gk, {
        key: gk,
        etapa: o.etapa || '',
        subEtapa: o.subEtapa || '',
        servicos: [],
        semVinculo: null,
        subtotais: { qtd: 0, medidoQtd: 0, prev: 0, medido: 0, pago: 0, aPagar: 0 }
      });
    }
    const g = gruposMap.get(gk);
    g.servicos.push(o);
    g.subtotais.qtd += parseMoney(o.qtd);
    g.subtotais.medidoQtd += parseMoney(o.medidoQtd);
    g.subtotais.prev += parseMoney(o.vtotal);
    g.subtotais.medido += parseMoney(o.medidoValor);
    g.subtotais.pago += parseMoney(o.pago);
    g.subtotais.aPagar += parseMoney(o.aPagar);
  });

  const grupos = [...gruposMap.values()].sort((a, b) =>
    (a.etapa || '').localeCompare(b.etapa || '') ||
    (a.subEtapa || '').localeCompare(b.subEtapa || '')
  );

  // Um custo sem serviço vinculado pertence à etapa uma única vez.
  // Prefere o grupo raiz (sem subetapa) para não repetir o valor em cada
  // subetapa — o mesmo erro do antigo "Vl. Total Real.".
  const etapasJaContabilizadas = new Set();
  grupos.forEach(g => {
    const outro = outrosPorEtapa.get(g.etapa);
    if (!outro || (!outro.pago && !outro.aPagar) || etapasJaContabilizadas.has(g.etapa)) return;
    if (g.subEtapa && grupos.some(x => x.etapa === g.etapa && !x.subEtapa)) return;
    g.semVinculo = { ...outro };
    g.subtotais.pago += outro.pago;
    g.subtotais.aPagar += outro.aPagar;
    etapasJaContabilizadas.add(g.etapa);
  });

  const totais = grupos.reduce((acc, g) => {
    Object.keys(acc).forEach(k => { acc[k] += parseMoney(g.subtotais[k]); });
    return acc;
  }, { qtd: 0, medidoQtd: 0, prev: 0, medido: 0, pago: 0, aPagar: 0 });

  return { obra, grupos, linhas, totais };
};

window.buildOrcamentoBoard = buildOrcamentoBoard;
window.summarizeFinance = summarizeFinance;
window.summarizeFinanceCosts = summarizeFinanceCosts;
window.buildFinanceEntries = buildFinanceEntries;
window.getPresencaCusto = getPresencaCusto;
window.categorizeFinanceType = categorizeFinanceType;
window.categorizeBudgetItem = categorizeBudgetItem;
window.parseEditIdx = parseEditIdx;
window.financeCategoryLabel = financeCategoryLabel;
window.FIN_CATEGORIES = FIN_CATEGORIES;
window.normalizeAprovacao = normalizeAprovacao;
window.medicaoAprovacao = medicaoAprovacao;
window.budgetServiceKey = budgetServiceKey;
window.medicaoServiceKey = medicaoServiceKey;
window.normalizeServiceKey = normalizeServiceKey;
window.newServiceId = newServiceId;
window.migrateServiceIds = migrateServiceIds;
window.buildMedicaoResumo = buildMedicaoResumo;
window.medicaoQuantidadeAnterior = medicaoQuantidadeAnterior;

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

// ==================== DASHBOARD: CUSTO POR OBRA, RESUMO E ALERTAS ====================

/**
 * Hoje no fuso de São Paulo (YYYY-MM-DD).
 * `new Date().toISOString()` usa UTC: depois das 21h no Brasil já devolve o dia seguinte
 * e o dashboard zerava "presentes hoje".
 */
const hojeLocal = () => getPeriodoOptions({ tipo: 'hoje' }).dataInicio;

/**
 * Custo realizado de UMA obra = mão de obra (diárias) + empreitadas (medições) + lançamentos financeiros (real).
 *
 * Sem período, soma tudo desde o início: é o "Total real" do dashboard. Com { tipo, baseDate } ou
 * { dataInicio, dataFim } soma só o período. Como as três parcelas e a regra de cálculo são as mesmas
 * nos dois casos, o total desde o início nunca é menor que o custo de qualquer período.
 *
 * A mão de obra usa calcCustosDiarias (mesma regra da página Hoje); medições e financeiro são somas simples
 * (financeiro conta só o valor `real`; lançamento sem data entra no total, mas não em período).
 */
const calcCustoObra = (db, obraCod, options = {}) => {
  const periodOptions = (options.tipo && !options.dataInicio && !options.dataFim)
    ? getPeriodoOptions(options)
    : { dataInicio: options.dataInicio || '', dataFim: options.dataFim || '' };
  // Mesma fonte única usada pelo Financeiro, Hoje e pelo relatório de vistoria.
  const summary = buildFinanceEntries(
    db.financeiro, db.presenca, db.medicao, db.almocos,
    { ...periodOptions, obra: obraCod }
  );
  const entries = summary.all || [];
  const sumBy = (source) => entries
    .filter(e => e.source === source)
    .reduce((a, e) => a + e.valorRealizado, 0);
  const maoDeObra = sumBy('pre');
  const medicoes = sumBy('med');
  const financeiro = sumBy('fin');
  const almocos = sumBy('alm');

  return {
    total: entries.reduce((a, e) => a + e.valorRealizado, 0),
    maoDeObra,
    medicoes,
    financeiro,
    almocos,
    diarias: entries.filter(e => e.source === 'pre' && e.valorRealizado > 0).length
  };
};

/**
 * Tarefas que o dashboard precisa destacar: atrasadas e as que vencem hoje.
 * `atrasada` é calculada em tempo de leitura — não depende de ninguém ter
 * gravado manualmente o status "Atrasada".
 */
const calcTarefasResumo = (db, hoje) => {
  const hojeRef = hoje || hojeLocal();
  const tarefas = db.tarefas || [];
  const obras = db.obras || [];
  const nomeObra = (cod) => (obras.find(o => o.cod === cod) || {}).nome || cod || 'Geral';

  const itens = tarefas.map((t, idx) => ({ ...t, _idx: idx }))
    .filter(t => t && t.status !== 'Concluída' && t.prazo)
    .map(t => ({
      ...t,
      obraNome: nomeObra(t.obra),
      atrasada: t.prazo < hojeRef,
      venceHoje: t.prazo === hojeRef
    }))
    .filter(t => t.atrasada || t.venceHoje)
    .sort((a, b) => a.prazo.localeCompare(b.prazo) || Number(b.atrasada) - Number(a.atrasada));

  return {
    hoje: hojeRef,
    abertas: tarefas.filter(t => t && t.status !== 'Concluída').length,
    atrasadas: itens.filter(t => t.atrasada).length,
    vencemHoje: itens.filter(t => t.venceHoje).length,
    itens
  };
};
window.calcTarefasResumo = calcTarefasResumo;

const PRIORIDADE_ALERTA = { alto: 0, medio: 1, baixo: 2 };

/**
 * Alertas do dia, do mais grave para o menos grave.
 * `linhas` = saída de calcDashboardResumo (precisa de pctCusto por obra).
 * `role` (opcional): mestre não acessa compras/financeiro, então não recebe esses alertas.
 */
const calcAlertas = (db, hoje, linhas, role) => {
  const alertas = [];
  const obras = db.obras || [];
  const nomeObra = (cod) => (obras.find(o => o.cod === cod) || {}).nome || cod || 'Geral';
  const ativas = obras.filter(o => o.status === 'Em andamento');
  const add = (tipo, obra, desc, prior) => alertas.push({ tipo, obra, desc, prior });

  // Atrasadas são agrupadas num único alerta de prioridade alta: com muitas
  // tarefas, uma entrada por tarefa empurrava o alerta para fora do topo.
  const tarefasResumo = calcTarefasResumo(db, hoje);
  if (tarefasResumo.atrasadas) {
    const atrasadas = tarefasResumo.itens.filter(t => t.atrasada);
    const exemplos = atrasadas.slice(0, 2).map(t => t.desc).join(', ');
    add('TAREFA ATRASADA', 'Geral',
      `${atrasadas.length} tarefa(s) atrasada(s)${exemplos ? ': ' + exemplos : ''}`, 'alto');
  }
  tarefasResumo.itens.filter(t => t.venceHoje)
    .forEach(t => add('TAREFA HOJE', t.obraNome, t.desc, 'medio'));

  // Encarregado (e o alias legado `mestre`) não acessa custos/compras neste alerta.
  if (role !== 'mestre' && role !== 'encarregado') {
    (linhas || []).forEach(l => {
      if (l.obra.status !== 'Em andamento' || l.pctCusto === null) return;
      if (l.pctCusto > 100) add('CUSTO ACIMA DO ORÇAMENTO', l.obra.nome, `${l.pctCusto.toFixed(0)}% do orçamento já foi gasto`, 'alto');
      else if (l.pctCusto >= 80) add('CUSTO PERTO DO LIMITE', l.obra.nome, `${l.pctCusto.toFixed(0)}% do orçamento já foi gasto`, 'medio');
    });
    (db.compras || []).filter(c => c && c.status === 'Aguardando')
      .forEach(c => add('COMPRA PENDENTE', nomeObra(c.obra), c.mat, 'medio'));
  }

  // Obra em andamento sem nenhuma presença lançada hoje (domingo não conta)
  const [y, m, d] = hoje.split('-').map(Number);
  if (new Date(y, m - 1, d).getDay() !== 0) {
    ativas.forEach(o => {
      const temPresenca = (db.presenca || []).some(p => p && p.obra === o.cod && p.data === hoje);
      if (!temPresenca) add('SEM PRESENÇA HOJE', o.nome, 'Nenhuma presença lançada hoje.', 'medio');
    });
  }

  ativas.filter(o => !o.mestre).forEach(o => add('OBRA SEM MESTRE', o.nome, 'Atribua um mestre responsável.', 'baixo'));

  return alertas.sort((a, b) => PRIORIDADE_ALERTA[a.prior] - PRIORIDADE_ALERTA[b.prior]);
};

/**
 * Tudo que o Dashboard Executivo mostra, já calculado (a tela só desenha).
 * Semana = segunda-feira até hoje; mês = dia 1 até hoje (mesmos períodos da página Hoje).
 */
const calcDashboardResumo = (db, hoje, role) => {
  hoje = hoje || hojeLocal();
  const obras = db.obras || [];
  const presHoje = (db.presenca || []).filter(p => p && p.data === hoje);

  const kpis = {
    presentes: presHoje.filter(p => p.presenca === 'Presente').length,
    faltas: presHoje.filter(p => p.presenca === 'Falta').length,
    obrasAtivas: obras.filter(o => o.status === 'Em andamento').length,
    diariasHoje: calcCustosDiarias(db.presenca, { dataInicio: hoje, dataFim: hoje }).custoTotal
  };

  const linhas = obras.map(o => {
    const sem = calcCustoObra(db, o.cod, { tipo: 'semana', baseDate: hoje });
    const mes = calcCustoObra(db, o.cod, { tipo: 'mes', baseDate: hoje });
    const total = calcCustoObra(db, o.cod);
    const orc = Number(o.orc) || 0;
    const tarefas = (db.tarefas || []).filter(t => t && t.obra === o.cod);
    return {
      obra: o,
      diariasSem: sem.diarias,
      custoSem: sem.total,
      custoMes: mes.total,
      totalReal: total.total,
      pctCusto: orc > 0 ? (total.total / orc) * 100 : null, // null = sem orçamento definido
      tarefasFeitas: tarefas.filter(t => t.status === 'Concluída').length,
      tarefasTotal: tarefas.length
    };
  });

  return {
    hoje,
    kpis,
    linhas,
    tarefas: calcTarefasResumo(db, hoje),
    alertas: calcAlertas(db, hoje, linhas, role)
  };
};

/**
 * Relatório de vistoria de uma obra, calculado a partir da MESMA fonte de custos
 * do Financeiro/Hoje/Dashboard (buildFinanceEntries).
 *
 * Importante:
 * - o previsto vem do orçamento e é comparado por categoria sem diferenciar
 *   maiúsculas/acentos (ex.: "Mão de obra" = "Mão de Obra"); item com
 *   empreiteiro preenchido conta como "Empreiteiros", mesmo se o tipo estiver
 *   errado (ex.: serviço terceirizado salvo como "Mão de obra");
 * - "outros" também entra no total, então previsto e realizado fecham;
 * - compras NÃO são somadas ao realizado (evita duplicar com lançamentos de Material);
 * - lançamento apenas previsto (real = 0) não vira custo realizado.
 */
const buildObraReport = (db, obraCod, options = {}) => {
  const obra = (db.obras || []).find(o => o && o.cod === obraCod) || null;
  const dataInicio = options.dataInicio || '';
  const dataFim = options.dataFim || '';
  const temPeriodo = !!(dataInicio || dataFim);
  const inPeriod = (d) => {
    if (!temPeriodo) return true;
    if (!d) return false;
    if (dataInicio && d < dataInicio) return false;
    if (dataFim && d > dataFim) return false;
    return true;
  };

  const finance = buildFinanceEntries(
    db.financeiro, db.presenca, db.medicao, db.almocos,
    { dataInicio, dataFim, obra: obraCod }
  );

  const categorias = FIN_CATEGORIES.map(c => ({
    ...c, previsto: 0, realizado: 0, pago: 0, aPagar: 0, count: 0
  }));
  const catMap = Object.fromEntries(categorias.map(c => [c.key, c]));

  (db.orcamento || []).filter(o => o && o.obra === obraCod).forEach(o => {
    const key = categorizeBudgetItem(o);
    const cat = catMap[key] || catMap.outros;
    cat.previsto += parseMoney(o.vtotal);
  });

  const entradas = [];
  const duplicados = [];
  const etapasMedicao = new Set(
    (db.medicao || [])
      .filter(m => m && m.obra === obraCod && inPeriod(m.semana || m.data))
      .map(m => normalizeText(m.etapa))
      .filter(Boolean)
  );
  (finance.all || []).filter(e => e.valorRealizado !== 0).forEach(e => {
    // Medição já representa o custo do empreiteiro naquela etapa. Se o usuário
    // também lançou "Empreiteiro" manualmente para a mesma etapa, somar os dois
    // duplicaria o custo. O manual fica listado à parte, mas não entra no total.
    const duplicariaMedicao = e.source === 'fin'
      && e.categoria === 'empreiteiro'
      && !!e.etapa
      && etapasMedicao.has(normalizeText(e.etapa));
    if (duplicariaMedicao) {
      duplicados.push(e);
      return;
    }
    entradas.push(e);
  });
  entradas.forEach(e => {
    const cat = catMap[e.categoria] || catMap.outros;
    const pago = e.status === 'Pago'
      ? e.valorRealizado
      : (e.status === 'Parcial' ? Math.min(e.jaPago, Math.max(0, e.valorRealizado)) : 0);
    const aPagar = Math.max(0, e.valorRealizado - pago);
    cat.realizado += e.valorRealizado;
    cat.pago += pago;
    cat.aPagar += aPagar;
    cat.count++;
    e.reportPago = pago;
    e.reportAPagar = aPagar;
  });

  const totalPrevisto = categorias.reduce((a, c) => a + c.previsto, 0);
  const totalRealizado = categorias.reduce((a, c) => a + c.realizado, 0);
  const totalPago = categorias.reduce((a, c) => a + c.pago, 0);
  const totalAPagar = categorias.reduce((a, c) => a + c.aPagar, 0);
  const saldo = totalPrevisto - totalRealizado;
  const pct = totalPrevisto > 0 ? (totalRealizado / totalPrevisto) * 100 : null;

  // Gasto realizado em categorias que não têm nenhuma linha no orçamento.
  // Quando isso existe e o previsto cobre menos da metade do realizado, a razão
  // realizado/previsto mede o que falta cadastrar — não um estouro de verdade.
  // Ex.: obra com 4 serviços de revestimento no orçamento e R$ 145 mil de mão de
  // obra própria sem previsão não está "793% acima": o orçamento está incompleto.
  const COBERTURA_MINIMA_CONFIAVEL = 50;
  const realizadoSemPrevisto = categorias.reduce((a, c) => a + (c.previsto <= 0 ? c.realizado : 0), 0);
  const coberturaOrcamento = totalRealizado > 0 ? (totalPrevisto / totalRealizado) * 100 : null;
  const orcamentoParcial = totalPrevisto > 0 && realizadoSemPrevisto > 0
    && coberturaOrcamento !== null && coberturaOrcamento < COBERTURA_MINIMA_CONFIAVEL;

  let status = 'Sem orçamento definido';
  if (orcamentoParcial) {
    status = `Orçamento incompleto: ${fmt(realizadoSemPrevisto)} sem previsão`;
  } else if (pct !== null) {
    if (pct > 100.0001) status = `Acima do orçamento em ${(pct - 100).toFixed(1)}%`;
    else if (pct < 99.9999) status = `Abaixo do orçamento em ${(100 - pct).toFixed(1)}%`;
    else status = 'Dentro do orçamento';
  }

  const medicoes = (db.medicao || [])
    .filter(m => m && m.obra === obraCod && inPeriod(m.semana || m.data))
    .map(m => {
      const qprev = parseMoney(m.qprev);
      const qreal = parseMoney(m.qreal);
      const qant = parseMoney(m.qant);
      const qacum = parseMoney(m.qacum) || (qant + qreal);
      return {
        ...m,
        semana: m.semana || m.data || '',
        qprev,
        qreal,
        qant,
        qacum,
        valor: parseMoney(m.vtotal),
        aprovacao: medicaoAprovacao(m),
        photos: Array.isArray(m.photos) ? m.photos.filter(Boolean) : (m.photoUrl ? [m.photoUrl] : []),
        avanco: qprev > 0 ? Math.min(100, (qreal / qprev) * 100) : null,
        pctAcum: qprev > 0 ? Math.min(100, (qacum / qprev) * 100) : null
      };
    });

  // Avanço físico acumulado por serviço (ponderado pelo valor do orçamento).
  const medicaoResumo = buildMedicaoResumo(db, obraCod, { dataInicio, dataFim });
  const fisico = medicaoResumo.totais.fisico;
  const valorMedido = medicaoResumo.totais.valorMedido;

  const equipeMap = new Map();
  entradas.filter(e => e.source === 'pre').forEach(e => {
    const key = e.trab || e.desc || 'Trabalhador';
    if (!equipeMap.has(key)) {
      equipeMap.set(key, { nome: e.desc || key, dias: 0, total: 0, pago: 0, aPagar: 0 });
    }
    const item = equipeMap.get(key);
    item.dias++;
    item.total += e.valorRealizado;
    item.pago += e.reportPago;
    item.aPagar += e.reportAPagar;
  });
  const equipe = [...equipeMap.values()].sort((a, b) => b.total - a.total);

  const hoje = options.hoje || hojeLocal();
  const pendencias = [];
  (db.tarefas || []).filter(t => t && t.obra === obraCod && t.status !== 'Concluída').forEach(t => {
    if (temPeriodo && t.prazo && !inPeriod(t.prazo)) return;
    pendencias.push({
      tipo: t.prazo && t.prazo < hoje ? 'Tarefa atrasada' : 'Tarefa',
      desc: t.desc || 'Tarefa',
      data: t.prazo || '',
      status: t.status || 'Pendente'
    });
  });
  (db.compras || []).filter(c => c && c.obra === obraCod && c.status === 'Aguardando').forEach(c => {
    pendencias.push({
      tipo: 'Compra pendente',
      desc: c.mat || 'Material',
      data: c.data || '',
      status: c.status || 'Aguardando'
    });
  });

  // Tarefas da obra no período (organizadas com suas fotos/evidências)
  const tarefas = (db.tarefas || [])
    .filter(t => t && t.obra === obraCod)
    .filter(t => {
      if (!temPeriodo) return true;
      const d = t.conclusao || t.prazo || t.criacao;
      return inPeriod(d);
    })
    .map(t => {
      const rawPhotos = Array.isArray(t.photos) ? t.photos.filter(Boolean) : (t.photoUrl ? [t.photoUrl] : (t.foto ? [t.foto] : []));
      const photos = rawPhotos.map(auditSafeImage).filter(Boolean);
      const isExecutada = t.status === 'Concluída' || Number(t.perc) >= 100;
      return {
        ...t,
        photos,
        isExecutada
      };
    });

  const empresa = (db.config && db.config.nomeEmpresa) || 'Obra Real';
  const logoUrl = (db.config && db.config.logoUrl) || '';
  const numero = options.numero || `REL-${obraCod}-${String(hoje).replace(/-/g, '')}`;
  const periodoLabel = temPeriodo
    ? `${dataInicio ? fmtDate(dataInicio) : 'início'} a ${dataFim ? fmtDate(dataFim) : 'hoje'}`
    : 'Todo o período da obra';

  return {
    obra,
    empresa,
    logoUrl,
    numero,
    hoje,
    periodoLabel,
    periodo: { dataInicio, dataFim },
    resumo: {
      totalPrevisto, totalRealizado, totalPago, totalAPagar, saldo, pct, status, fisico, valorMedido,
      orcamentoParcial, realizadoSemPrevisto, coberturaOrcamento
    },
    categorias,
    entradas,
    duplicados,
    medicoes,
    equipe,
    pendencias,
    tarefas,
    orcamento: (db.orcamento || []).filter(o => o && o.obra === obraCod),
    responsavel: options.responsavel || ''
  };
};

/** Escapa texto digitado por usuários antes de ir para innerHTML. */
function auditSafeImage(v) {
  const s = String(v == null ? '' : v);
  return /^(https?:\/\/|data:image\/)/i.test(s) ? s : '';
}
window.auditSafeImage = auditSafeImage;

/**
 * Otimiza uma foto no cliente usando Canvas antes de upload/salvamento.
 * Reduz dimensões (máx 1280px) e comprime em JPEG 75%.
 * Reduz fotos de celulares (10-15MB) para ~80-120KB sem perda visível de qualidade.
 */
async function optimizeImageFile(file, options = {}) {
  if (!file || typeof file !== 'object') return { file, dataUrl: null };
  const type = file.type || '';
  if (!type.startsWith('image/')) return { file, dataUrl: null };

  const maxDim = options.maxDim || 1280;
  const quality = options.quality != null ? options.quality : 0.75;
  const mimeType = 'image/jpeg';

  if (typeof FileReader === 'undefined' || typeof Image === 'undefined' || typeof document === 'undefined') {
    return { file, dataUrl: null };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve({ file, dataUrl: null });
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => resolve({ file, dataUrl: null });
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve({ file, dataUrl: e.target.result });

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(mimeType, quality);
        if (typeof canvas.toBlob === 'function') {
          canvas.toBlob((blob) => {
            if (!blob) return resolve({ file, dataUrl });
            const safeName = (file.name || 'foto.jpg').replace(/\.[^.]+$/, '') + '.jpg';
            let optimizedFile;
            try {
              optimizedFile = new File([blob], safeName, { type: mimeType, lastModified: Date.now() });
            } catch (fe) {
              optimizedFile = blob;
            }
            resolve({ file: optimizedFile, dataUrl, width, height, size: blob.size });
          }, mimeType, quality);
        } else {
          resolve({ file, dataUrl, width, height });
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};
window.optimizeImageFile = optimizeImageFile;
const escHtml = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

window.escHtml = escHtml;
window.hojeLocal = hojeLocal;
window.calcCustoObra = calcCustoObra;
window.calcAlertas = calcAlertas;
window.calcDashboardResumo = calcDashboardResumo;
window.buildObraReport = buildObraReport;

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
 * Compatibilidade: progresso do orçamento usando a nova fonte única.
 * `realizado` passa a ser o valor medido; pago/a pagar vêm do Financeiro.
 * O 4º argumento (db completo) habilita medições e vínculos por ID.
 */
const calcBudgetProgress = (orcamento, financeiro, compras, db) => {
  const base = Array.isArray(orcamento) ? orcamento : [];
  const dbLike = db && typeof db === 'object'
    ? db
    : { orcamento: base, financeiro: financeiro || [], compras: compras || [] };
  const board = buildOrcamentoBoard(dbLike);
  const porIdx = new Map(board.linhas.map(l => [l._idx, l]));

  return base.map((o, i) => {
    const linha = porIdx.get(i);
    const vtotal = parseMoney(o.vtotal);
    const medido = linha ? parseMoney(linha.medidoValor) : 0;
    return {
      ...o,
      medido,
      realizado: medido,
      pago: linha ? parseMoney(linha.pago) : 0,
      aPagar: linha ? parseMoney(linha.aPagar) : 0,
      diferenca: vtotal - medido,
      perc: vtotal > 0 ? ((medido / vtotal) * 100).toFixed(1) : '0.0'
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
  const iconHtml = icon
    ? `<div class="ui-empty-icon"><span class="material-symbols-outlined" style="font-size:34px;">${icon}</span></div>`
    : '';
  return `<tr class="empty-row" style="background:transparent;border:none;box-shadow:none;">
   <td colspan="100%" style="text-align:center;padding:48px 20px;border:none;background:transparent;">
       ${iconHtml}
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

// ==================== ACESSO POR OBRA (escopo de usuário) ====================
// Usuário não-admin pode ser limitado a obras específicas (usuarios[].acessoObras
// === 'especificas' + obrasPermitidas: [cod...]). Falha fechada: lista vazia = nada.
// ATENÇÃO: isto é filtro de UX no cliente (o tenant ainda é um nó único no RTDB);
// isolamento real exige regras/estrutura por obra no servidor.
const OBRA_SCOPED_KEYS = ['presenca', 'tarefas', 'estoque', 'movEstoque', 'compras',
  'financeiro', 'orcamento', 'medicao', 'almocos'];

const _toArr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);

// null = acesso a todas as obras; array = somente esses códigos.
const getObrasPermitidas = function(usuarios, email, role) {
  if (role === 'admin' || role === 'super_admin') return null;
  const mail = String(email || '').trim().toLowerCase();
  const u = _toArr(usuarios).find(x => x && String(x.email || x.username || '').trim().toLowerCase() === mail);
  if (!u || u.acessoObras !== 'especificas') return null;
  return _toArr(u.obrasPermitidas).map(String);
};

const filterDbByObras = function(db, permitidas) {
  if (!Array.isArray(permitidas) || !db) return db;
  const set = new Set(permitidas);
  const out = { ...db };
  out.obras = _toArr(db.obras).filter(o => o && set.has(String(o.cod)));
  OBRA_SCOPED_KEYS.forEach(k => {
    if (db[k] !== undefined) out[k] = _toArr(db[k]).filter(r => r && set.has(String(r.obra)));
  });
  return out;
};

// Reconstrói os arrays completos para gravar: itens de obras fora do escopo vêm do
// snapshot completo da nuvem (intocados); itens do escopo vêm do DB filtrado.
// Retorna null se não houver snapshot completo (não grava para não apagar dados).
const mergeScopedDb = function(full, scoped, permitidas) {
  if (!Array.isArray(permitidas)) return scoped;
  if (!full) return null;
  const set = new Set(permitidas);
  const out = { ...scoped };
  const merge = (key, field) => {
    const fora = _toArr(full[key]).filter(r => r && !set.has(String(r[field])));
    const dentro = _toArr(scoped[key]).filter(r => r && set.has(String(r[field])));
    out[key] = [...fora, ...dentro];
  };
  merge('obras', 'cod');
  OBRA_SCOPED_KEYS.forEach(k => { if (full[k] !== undefined || scoped[k] !== undefined) merge(k, 'obra'); });
  return out;
};

window.OBRA_SCOPED_KEYS = OBRA_SCOPED_KEYS;
window.getObrasPermitidas = getObrasPermitidas;
window.filterDbByObras = filterDbByObras;
window.mergeScopedDb = mergeScopedDb;

// Exports for testing (vitest roda como module, navegador roda como defer)
// O try/catch evita SyntaxError quando carregado sem type="module"
