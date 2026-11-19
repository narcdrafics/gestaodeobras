import { describe, it, expect } from 'vitest';
import { calcSaldo, estoqueStatus, fmt, fmtDate, summarizePresence, calcWeeklyPendingPayments, summarizeFinance, summarizeFinanceCosts, buildFinanceEntries, getPresencaCusto, calcBudgetProgress } from './utils_wrapper.js';

describe('Cálculos de Estoque', () => {
  it('deve calcular o saldo corretamente', () => {
    const item = { entrada: 10, saida: 4 };
    expect(calcSaldo(item)).toBe(6);
  });

  it('deve retornar saldo 0 se entrada e saida forem nulos', () => {
    const item = { entrada: null, saida: undefined };
    expect(calcSaldo(item)).toBe(0);
  });

  it('deve identificar status NORMAL quando saldo > min * 1.5', () => {
    const item = { entrada: 21, saida: 5, min: 10 }; // saldo 16
    expect(estoqueStatus(item)).toBe('NORMAL');
  });

  it('deve identificar status CRÍTICO quando saldo <= min', () => {
    const item = { entrada: 15, saida: 6, min: 10 }; // saldo 9
    expect(estoqueStatus(item)).toBe('CRÍTICO');
  });

  it('deve identificar status SEM ESTOQUE quando saldo <= 0', () => {
    const item = { entrada: 5, saida: 5, min: 10 }; // saldo 0
    expect(estoqueStatus(item)).toBe('SEM ESTOQUE');
  });

  it('deve identificar status BAIXO quando saldo está pouco acima do mínimo', () => {
    const item = { entrada: 22, saida: 10, min: 10 }; // saldo 12 (<= 15)
    expect(estoqueStatus(item)).toBe('BAIXO');
  });
});

describe('Lógica de Presença', () => {
  it('deve sumarizar presença corretamente por data', () => {
    const data = [
      { data: '2026-04-01', presenca: 'Presente', total: 100 },
      { data: '2026-04-01', presenca: 'Falta', total: 0 },
      { data: '2026-04-02', presenca: 'Presente', total: 150 }
    ];
    const res = summarizePresence(data);
    expect(res).toHaveLength(2);
    expect(res[0].data).toBe('2026-04-02'); // sorting desc
    expect(res[1].total).toBe(100);
    expect(res[1].presentes).toBe(1);
    expect(res[1].faltas).toBe(1);
  });
});

describe('Pagamentos Semanais', () => {
  it('deve calcular pagamentos pendentes da semana', () => {
    const pres = [
      { obra: 'OB01', data: '2026-04-01', pgtoStatus: 'Pendente', total: 100 },
      { obra: 'OB01', data: '2026-04-01', pgtoStatus: 'Pago', total: 100 },
      { obra: 'OB02', data: '2026-04-01', pgtoStatus: 'Pendente', total: 250 }
    ];
    const obras = [{ cod: 'OB01', nome: 'Obra 1' }, { cod: 'OB02', nome: 'Obra 2' }];
    // Assumindo que hoje é 2026-04-01 (Quarta-feira)
    const res = calcWeeklyPendingPayments(pres, obras, '2026-04-01');
    expect(res).toHaveLength(2);
    expect(res.find(r => r.obraCod === 'OB01').totalPendente).toBe(100);
    expect(res.find(r => r.obraCod === 'OB02').totalPendente).toBe(250);
  });
});

describe('Resumo Financeiro', () => {
  it('deve consolidar financeiro de múltiplas fontes', () => {
    const fin = [{ obra: 'OB01', prev: 1000, real: 1200, status: 'Pago' }];
    const pres = [{ obra: 'OB01', total: 500, pgtoStatus: 'Pendente', nome: 'João' }];
    const med = [{ obra: 'OB02', vtotal: 3000, servico: 'Reboco' }];
    const alm = [{ obra: 'OB01', vtotal: 50, empreiteiro: 'Equipe A' }];
    
    const res = summarizeFinance(fin, pres, med, alm);
    expect(res.totalsByObra['OB01'].real).toBe(1200 + 500 + 50);
    expect(res.totalsByObra['OB02'].real).toBe(3000);
    expect(res.all).toHaveLength(4);
  });

  it('deve filtrar lançamentos pelo mês selecionado', () => {
    const fin = [
      { obra: 'OB01', data: '2026-03-10', real: 100, status: 'Pago' },
      { obra: 'OB01', data: '2026-04-05', real: 200, status: 'Pago' },
      { obra: 'OB01', data: '2026-05-20', real: 400, status: 'Pago' }
    ];
    const pres = [
      { obra: 'OB01', data: '2026-04-01', total: 50, pgtoStatus: 'Pago', nome: 'João' },
      { obra: 'OB01', data: '2026-05-01', total: 70, pgtoStatus: 'Pago', nome: 'João' }
    ];

    const res = summarizeFinance(fin, pres, [], [], { ano: 2026, mes: 4 });
    expect(res.all).toHaveLength(2);
    expect(res.kpis.total).toBe(250);
    expect(res.totalsByObra['OB01'].real).toBe(250);
  });

  it('deve aceitar a assinatura antiga com ano e mês posicionais', () => {
    const fin = [
      { obra: 'OB01', data: '2026-04-05', real: 200, status: 'Pago' },
      { obra: 'OB01', data: '2026-05-20', real: 400, status: 'Pago' }
    ];

    const res = summarizeFinance(fin, [], [], [], 2026, 4);
    expect(res.all).toHaveLength(1);
    expect(res.kpis.total).toBe(200);
  });

  it('deve usar o valor histórico gravado na presença, não a diária atual', () => {
    const pres = [{ obra: 'OB01', data: '2026-04-01', total: 180, diaria: 180, pgtoStatus: 'Pendente', nome: 'João' }];
    const res = summarizeFinance([], pres, [], []);
    expect(res.all[0].valor).toBe(180);
    expect(res.all[0].pendente).toBe(180);
    expect(res.all[0].hasPrev).toBe(false);
    expect(getPresencaCusto({ total: 180 })).toBe(180);
    expect(getPresencaCusto({ presenca: 'Falta', total: 180 })).toBe(0);
    expect(getPresencaCusto({ presenca: 'Meio período', diaria: 200 })).toBe(100);
  });

  it('deve usar o previsto quando o realizado do lançamento manual está vazio', () => {
    const fin = [{ obra: 'OB01', data: '2026-04-01', tipo: 'Material', prev: 800, real: 0, status: 'Pendente' }];
    const res = summarizeFinanceCosts(fin, [], [], [], { ano: 2026, mes: 4 });
    expect(res.total).toBe(800);
    expect(res.aPagar).toBe(800);
    expect(res.all[0].valor).toBe(800);
    expect(res.all[0].hasPrev).toBe(true);
  });

  it('deve manter desconto como valor negativo', () => {
    const fin = [{ obra: 'OB01', data: '2026-04-01', tipo: 'Desconto', real: 50, status: 'Pago' }];
    const res = summarizeFinanceCosts(fin, [], [], []);
    expect(res.total).toBe(-50);
    expect(res.all[0].categoria).toBe('outros');
  });

  it('deve calcular o saldo restante de almoços e medições parciais', () => {
    const alm = [{ obra: 'OB01', data: '2026-04-01', vtotal: 100, pgtoStatus: 'Parcial', valpago: 40, empreiteiro: 'Equipe A' }];
    const med = [{ obra: 'OB01', semana: '2026-04-01', vtotal: 1000, pgtoStatus: 'Parcial', valpago: 300, equipe: 'Equipe B' }];
    const res = summarizeFinanceCosts([], [], med, alm, { ano: 2026, mes: 4 });
    expect(res.all.find(e => e.source === 'alm').pendente).toBe(60);
    expect(res.all.find(e => e.source === 'med').pendente).toBe(700);
    expect(res.aPagar).toBe(760);
  });
});

describe('Progresso de Orçamento', () => {
  it('usa o valor medido e não o gasto da etapa inteira', () => {
    const orc = [{ obra: 'OB01', etapa: 'Fundação', vtotal: 10000, id: 'svc-a' }];
    const med = [{ obra: 'OB01', etapa: 'Fundação', servico: 'A', serviceId: 'svc-a', qreal: 6, vtotal: 6000 }];
    const fin = [{ obra: 'OB01', etapa: 'Fundação', real: 4000, status: 'Pago' }];
    const db = { orcamento: orc, medicao: med, financeiro: fin, presenca: [], almocos: [] };

    const res = calcBudgetProgress(orc, fin, [], db);
    expect(res[0].realizado).toBe(6000);
    expect(res[0].diferenca).toBe(4000);
    expect(res[0].perc).toBe("60.0");
  });
});

describe('Escape HTML', () => {
  it('deve escapar caracteres HTML especiais', () => {
    expect(escapeHTML('<script>')).toBe('&lt;script&gt;');
    expect(escapeHTML('A & B')).toBe('A &amp; B');
  });

  it('deve retornar string vazia para null/undefined', () => {
    expect(escapeHTML(null)).toBe('');
    expect(escapeHTML(undefined)).toBe('');
  });

  it('deve retornar o mesmo valor para strings sem HTML', () => {
    expect(escapeHTML('teste normal')).toBe('teste normal');
  });
});
