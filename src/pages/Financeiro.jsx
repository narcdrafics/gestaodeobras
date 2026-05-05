import { useDB } from '../contexts/FirebaseContext';

const C = {
  bg: '#090b0d', panel: '#0e1114', border: '#1c2028',
  text: '#c8d0db', dim: '#4a5568', accent: '#f59e0b',
  green: '#34d399', red: '#f87171', blue: '#60a5fa',
};

const fmt = { brl: (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` };

export default function Financeiro() {
  const { db } = useDB();
  const finan = db?.financeiro || [];

  const entradas = finan.filter(f => f.tipo === 'entrada').reduce((s, f) => s + f.valor, 0);
  const saidas = finan.filter(f => f.tipo === 'saida').reduce((s, f) => s + f.valor, 0);
  const saldo = entradas - saidas;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Financeiro</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <div style={{ border: `1px solid ${C.border}`, padding: 12, background: C.panel }}>
          <div style={{ fontSize: 10, color: C.dim, textTransform: 'uppercase' }}>Entradas</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>{fmt.brl(entradas)}</div>
        </div>
        <div style={{ border: `1px solid ${C.border}`, padding: 12, background: C.panel }}>
          <div style={{ fontSize: 10, color: C.dim, textTransform: 'uppercase' }}>Saídas</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.red }}>{fmt.brl(saidas)}</div>
        </div>
        <div style={{ border: `1px solid ${C.border}`, padding: 12, background: C.panel }}>
          <div style={{ fontSize: 10, color: C.dim, textTransform: 'uppercase' }}>Saldo</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: saldo >= 0 ? C.green : C.red }}>
            {fmt.brl(saldo)}
          </div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: C.dim, textAlign: 'left', borderBottom: `1px solid ${C.border}` }}>
            <th>DATA</th>
            <th>DESCRIÇÃO</th>
            <th>TIPO</th>
            <th>CAT</th>
            <th>VALOR</th>
            <th>OBRA</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {finan.map(f => (
            <tr key={f.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ color: C.dim }}>{f.data}</td>
              <td>{f.descricao}</td>
              <td>
                <span style={{ 
                  fontSize: 10, padding: '2px 6px',
                  background: f.tipo === 'entrada' ? C.green : C.red, color: '#000' 
                }}>
                  {f.tipo?.toUpperCase()}
                </span>
              </td>
              <td style={{ color: C.dim }}>{f.categoria}</td>
              <td style={{ 
                color: f.tipo === 'entrada' ? C.green : C.red, 
                fontWeight: 700 
              }}>
                {f.tipo === 'saida' ? '-' : '+'}{fmt.brl(f.valor)}
              </td>
              <td style={{ color: C.dim }}>{f.obra}</td>
              <td>
                <span style={{ fontSize: 10, padding: '2px 6px', background: C.green, color: '#000' }}>
                  {f.status?.toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}