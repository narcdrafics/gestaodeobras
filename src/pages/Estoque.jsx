import { useDB } from '../contexts/FirebaseContext';

const C = {
  bg: '#090b0d', panel: '#0e1114', border: '#1c2028',
  text: '#c8d0db', dim: '#4a5568', accent: '#f59e0b',
  green: '#34d399', red: '#f87171', blue: '#60a5fa',
};

const fmt = { brl: (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` };

export default function Estoque() {
  const { db } = useDB();
  const estoque = db?.estoque || [];

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Estoque</h1>
      
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: C.dim, textAlign: 'left', borderBottom: `1px solid ${C.border}` }}>
            <th>ITEM</th>
            <th>UN</th>
            <th>QTD</th>
            <th>MÍNIMO</th>
            <th>CUSTO</th>
            <th>TOTAL</th>
            <th>OBRA</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {estoque.map(e => {
            const critico = e.quantidade <= e.minimo;
            return (
              <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ fontWeight: 600 }}>{e.item}</td>
                <td style={{ color: C.dim }}>{e.unidade}</td>
                <td style={{ color: critico ? C.red : C.green, fontWeight: critico ? 700 : 400 }}>
                  {e.quantidade}
                </td>
                <td style={{ color: C.dim }}>{e.minimo}</td>
                <td>{fmt.brl(e.custo)}</td>
                <td style={{ color: C.accent }}>{fmt.brl(e.quantidade * e.custo)}</td>
                <td style={{ color: C.dim }}>{e.obra}</td>
                <td>
                  {critico ? (
                    <span style={{ fontSize: 10, padding: '2px 6px', background: C.red, color: '#000' }}>
                      ⚠ BAIXO
                    </span>
                  ) : (
                    <span style={{ color: C.green }}>✓</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}