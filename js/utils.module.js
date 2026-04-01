/**
 * utilitários de lógica pura (sem dependência de DOM)
 * para facilitar testes unitários e modularização.
 */

export const fmt = (v) => v != null && !isNaN(v) 
  ? 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
  : '—';

export const fmtPct = (v) => v != null ? (v * 100).toFixed(1) + '%' : '—';

export const fmtDate = (d) => {
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

export function calcSaldo(item) { 
  return (parseFloat(item.entrada) || 0) - (parseFloat(item.saida) || 0); 
}

export function estoqueStatus(item) {
  const saldo = calcSaldo(item);
  if (saldo <= 0) return 'SEM ESTOQUE';
  if (saldo <= item.min) return 'CRÍTICO';
  if (saldo <= item.min * 1.5) return 'BAIXO';
  return 'NORMAL';
}
