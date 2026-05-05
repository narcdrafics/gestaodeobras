import { useDB } from '../contexts/FirebaseContext';

const C = {
  bg: '#090b0d', panel: '#0e1114', border: '#1c2028',
  text: '#c8d0db', dim: '#4a5568', accent: '#f59e0b',
  green: '#34d399', red: '#f87171', blue: '#60a5fa',
};

const fmt = { brl: (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` };

export default function Obras() {
  const { db } = useDB();
  const obras = db?.obras || [];

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Obras</h1>
      
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: C.dim, textAlign: 'left', borderBottom: `1px solid ${C.border}` }}>
            <th style={{ padding: '8px 0' }}>ID</th>
            <th>NOME</th>
            <th>STATUS</th>
            <th>RESPONSÁVEL</th>
            <th style={{ textAlign: 'right' }}>ORÇAMENTO</th>
            <th style={{ textAlign: 'right' }}>GASTO</th>
            <th style={{ textAlign: 'right' }}>%</th>
          </tr>
        </thead>
        <tbody>
          {obras.map(obra => {
            const pct = (obra.gasto / obra.orcamento * 100).toFixed(0);
            return (
              <tr key={obra.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '8px 0', color: C.accent, fontWeight: 700 }}>{obra.id}</td>
                <td style={{ padding: '8px 0' }}>{obra.nome}</td>
                <td style={{ padding: '8px 0' }}>
                  <span style={{ fontSize: 10, padding: '2px 6px', background: C.blue, color: '#000' }}>
                    {obra.status}
                  </span>
                </td>
                <td style={{ padding: '8px 0', color: C.dim }}>{obra.responsavel}</td>
                <td style={{ padding: '8px 0', textAlign: 'right' }}>{fmt.brl(obra.orcamento)}</td>
                <td style={{ padding: '8px 0', textAlign: 'right', color: pct > 85 ? C.red : C.text }}>
                  {fmt.brl(obra.gasto)}
                </td>
                <td style={{ padding: '8px 0', textAlign: 'right', color: pct > 85 ? C.red : C.accent }}>
                  {pct}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}