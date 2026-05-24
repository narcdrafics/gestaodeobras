// tests/estoque.test.js
// Testes unitários do motor de estoque
// Rodar: npm test

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizarNome,
  validarFormMovimentacao,
  TIPO_MOV,
} from '../js/estoque.module.js';

// ─── normalizarNome ───────────────────────────────────────────
describe('normalizarNome — deduplicação por nome', () => {
  it('normaliza para lowercase', () => {
    expect(normalizarNome('CIMENTO')).toBe('cimento');
  });

  it('remove acentos', () => {
    expect(normalizarNome('Areia Grôssa')).toBe('areia grossa');
  });

  it('remove hífens e underscores', () => {
    expect(normalizarNome('CP-II')).toBe('cp ii');
    expect(normalizarNome('CP_II')).toBe('cp ii');
  });

  it('colapsa espaços múltiplos', () => {
    expect(normalizarNome('Cimento   CP   II')).toBe('cimento cp ii');
  });

  it('detecta duplicata com variações de escrita', () => {
    const a = normalizarNome('Cimento CP-II');
    const b = normalizarNome('cimento cpii');
    const c = normalizarNome('CIMENTO CP II');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('não confunde itens diferentes', () => {
    expect(normalizarNome('Areia fina')).not.toBe(normalizarNome('Areia grossa'));
    expect(normalizarNome('Cimento CP-II')).not.toBe(normalizarNome('Cimento CP-V'));
  });
});

// ─── validarFormMovimentacao ──────────────────────────────────
describe('validarFormMovimentacao — regras do modal', () => {

  it('retorna erro se tipo for entrada', () => {
    const erros = validarFormMovimentacao({
      tipo: TIPO_MOV.ENTRADA,
      itemId: 'abc',
      quantidade: 10,
    });
    expect(erros.some(e => e.includes('Entrada'))).toBe(true);
  });

  it('retorna erro se itemId ausente', () => {
    const erros = validarFormMovimentacao({
      tipo: TIPO_MOV.SAIDA_CANTEIRO,
      itemId: '',
      quantidade: 5,
      obraDestinoId: 'obra1',
    });
    expect(erros.some(e => e.includes('item'))).toBe(true);
  });

  it('retorna erro se quantidade <= 0', () => {
    const erros = validarFormMovimentacao({
      tipo: TIPO_MOV.SAIDA_CANTEIRO,
      itemId: 'abc',
      quantidade: 0,
      obraDestinoId: 'obra1',
    });
    expect(erros.length).toBeGreaterThan(0);
  });

  it('retorna erro de obra destino ausente em saída', () => {
    const erros = validarFormMovimentacao({
      tipo: TIPO_MOV.SAIDA_CANTEIRO,
      itemId: 'abc',
      quantidade: 5,
      obraDestinoId: '',
    });
    expect(erros.some(e => e.includes('destino'))).toBe(true);
  });

  it('retorna erro de obra origem ausente em retorno', () => {
    const erros = validarFormMovimentacao({
      tipo: TIPO_MOV.RETORNO,
      itemId: 'abc',
      quantidade: 3,
      obraOrigemId: '',
    });
    expect(erros.some(e => e.includes('origem'))).toBe(true);
  });

  it('retorna erro quando origem === destino em transferência', () => {
    const erros = validarFormMovimentacao({
      tipo: TIPO_MOV.TRANSFERENCIA,
      itemId: 'abc',
      quantidade: 2,
      obraOrigemId:  'obra1',
      obraDestinoId: 'obra1',
    });
    expect(erros.some(e => e.includes('iguais') || e.includes('mesma'))).toBe(true);
  });

  it('retorna erro de motivo curto em ajuste', () => {
    const erros = validarFormMovimentacao({
      tipo: TIPO_MOV.AJUSTE,
      itemId: 'abc',
      quantidade: 10,
      motivo: 'ok',
    });
    expect(erros.some(e => e.includes('motivo') || e.includes('caracteres'))).toBe(true);
  });

  it('aceita ajuste com motivo suficiente', () => {
    const erros = validarFormMovimentacao({
      tipo: TIPO_MOV.AJUSTE,
      itemId: 'abc',
      quantidade: 10,
      motivo: 'Correção após inventário físico',
    });
    expect(erros.length).toBe(0);
  });

  it('aceita saída válida sem erros', () => {
    const erros = validarFormMovimentacao({
      tipo: TIPO_MOV.SAIDA_CANTEIRO,
      itemId: 'abc',
      quantidade: 5,
      obraDestinoId: 'obra1',
    });
    expect(erros.length).toBe(0);
  });

  it('aceita retorno válido sem erros', () => {
    const erros = validarFormMovimentacao({
      tipo: TIPO_MOV.RETORNO,
      itemId: 'abc',
      quantidade: 3,
      obraOrigemId: 'obra1',
    });
    expect(erros.length).toBe(0);
  });

  it('aceita transferência válida sem erros', () => {
    const erros = validarFormMovimentacao({
      tipo: TIPO_MOV.TRANSFERENCIA,
      itemId: 'abc',
      quantidade: 2,
      obraOrigemId:  'obra1',
      obraDestinoId: 'obra2',
    });
    expect(erros.length).toBe(0);
  });
});
