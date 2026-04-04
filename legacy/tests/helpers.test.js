import { describe, it, expect } from 'vitest';
import { calcSaldo, estoqueStatus, fmt, fmtDate, summarizePresence, calcWeeklyPendingPayments, summarizeFinance, calcBudgetProgress } from '../js/utils.module.js';

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
});

describe('Progresso de Orçamento', () => {
  it('deve calcular diferença e percentual de execução', () => {
    const orc = [{ obra: 'OB01', etapa: 'Fundação', vtotal: 10000 }];
    const fin = [{ obra: 'OB01', etapa: 'Fundação', real: 4000, status: 'Pago' }];
    const com = [{ obra: 'OB01', etapa: 'Fundação', vtotal: 2000, status: 'Entregue' }];
    
    const res = calcBudgetProgress(orc, fin, com);
    expect(res[0].realizado).toBe(6000);
    expect(res[0].diferenca).toBe(4000);
    expect(res[0].perc).toBe("60.0");
  });
});
