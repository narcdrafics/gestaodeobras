import { useDB } from '../contexts/FirebaseContext';

const C = {
  bg: '#090b0d', panel: '#0e1114', border: '#1c2028',
  text: '#c8d0db', dim: '#4a5568', accent: '#f59e0b',
  green: '#34d399', red: '#f87171', blue: '#60a5fa', orange: '#fb923c',
};

export default function Presenca() {
  const { db } = useDB();
  const hoje = new Date().toISOString().split('T')[0];
  const presenca = db?.presenca?.filter(p => p.data === hoje) || [];

  const presentes = presenca.filter(p => p.status === 'presente').length;
  const faltas = presenca.filter(p => p.status === 'falta').length;
  const meioDia = presenca.filter(p => p.status === 'meio_dia').length;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
        Presença / Ponto - {hoje}
      </h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <div style={{ border: `1px solid ${C.border}`, padding: 12, background: C.panel }}>
          <div style={{ fontSize: 10, color: C.dim, textTransform: 'uppercase' }}>Presentes</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>{presentes}</div>
        </div>
        <div style={{ border: `1px solid ${C.border}`, padding: 12, background: C.panel }}>
          <div style={{ fontSize: 10, color: C.dim, textTransform: 'uppercase' }}>Faltas</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.red }}>{faltas}</div>
        </div>
        <div style={{ border: `1px solid ${C.border}`, padding: 12, background: C.panel }}>
          <div style={{ fontSize: 10, color: C.dim, textTransform: 'uppercase' }}>Meio Dia</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.orange }}>{meioDia}</div>
        </div>
        <div style={{ border: `1px solid ${C.border}`, padding: 12, background: C.panel }}>
          <div style={{ fontSize: 10, color: C.dim, textTransform: 'uppercase' }}>Total</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{presenca.length}</div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: C.dim, textAlign: 'left', borderBottom: `1px solid ${C.border}` }}>
            <th>TRABALHADOR</th>
            <th>OBRA</th>
            <th>ENTRADA</th>
            <th>SAÍDA</th>
            <th>HORAS</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {presenca.map(p => (
            <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0' }}>{p.trabalhador}</td>
              <td style={{ color: C.dim }}>{p.obra}</td>
              <td style={{ color: p.status === 'falta' ? C.red : C.green }}>{p.entrada || '—'}</td>
              <td style={{ color: C.dim }}>{p.saida || '—'}</td>
              <td style={{ color: C.accent }}>{p.horas || '—'}</td>
              <td>
                <span style={{
                  fontSize: 10, padding: '2px 6px',
                  background: p.status === 'presente' ? C.green : p.status === 'falta' ? C.red : C.orange,
                  color: '#000',
                }}>
                  {p.status?.toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}