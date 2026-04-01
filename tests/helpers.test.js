import { describe, it, expect } from 'vitest';
import { calcSaldo, estoqueStatus, fmt, fmtDate } from '../js/utils.module.js';

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
