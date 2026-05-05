import { useDB } from '../contexts/FirebaseContext';

const C = {
  bg: '#090b0d',
  panel: '#0e1114',
  border: '#1c2028',
  text: '#c8d0db',
  dim: '#4a5568',
  accent: '#f59e0b',
  green: '#34d399',
  red: '#f87171',
  blue: '#60a5fa',
  cyan: '#22d3ee',
};

const fmt = {
  brl: (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
  date: (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—',
};

function StatCard({ label, value, color = C.text, sub = '' }) {
  return (
    <div style={{
      border: `1px solid ${C.border}`,
      padding: '12px 16px',
      background: C.panel,
      minWidth: 140,
    }}>
      <div style={{ fontSize: 10, color: C.dim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function Hoje() {
  const { db } = useDB();
  if (!db || !db.obras) return <div style={{ color: C.dim }}>Carregando...</div>;

  const hoje = new Date().toISOString().split('T')[0];
  const obras = db.obras || [];
  const trabs = db.trabalhadores || [];
  const presenca = db.presenca?.filter(p => p.data === hoje) || [];
  const tareas = db.tarefas?.filter(t => t.status !== 'concluida') || [];

  const obrasAtivas = obras.filter(o => o.status === 'em_andamento');
  const presentes = presenca.filter(p => p.status === 'presente').length;
  const trabsAtivos = trabs.filter(t => t.ativo).length;

  const totalDiaria = trabsAtivos * 180;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
        Hoje <span style={{ fontWeight: 400, color: C.dim, fontSize: 14, marginLeft: 12 }}>{fmt.date(hoje)}</span>
      </h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <StatCard label="Obras Ativas" value={obrasAtivas.length} color={C.blue} />
        <StatCard label="Trabalhadores" value={trabsAtivos} color={C.green} sub="na obra" />
        <StatCard label="Presença" value={`${presentes}/${presenca.length}`} color={C.cyan} />
        <StatCard label="Diária Total" value={fmt.brl(totalDiaria)} color={C.accent} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 12, color: C.dim, letterSpacing: 2, marginBottom: 12 }}>── OBRAS EM ANDAMENTO</h2>
        {obrasAtivas.map(obra => (
          <div key={obra.id} style={{
            borderLeft: `2px solid ${C.border}`,
            padding: '8px 0 8px 12px',
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
              <span style={{ color: C.accent, fontWeight: 700 }}>{obra.id}</span>
              <span>{obra.nome}</span>
            </div>
            <div style={{ fontSize: 12, color: C.dim }}>
              {obra.responsavel} • Início: {obra.inicio}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 12, color: C.dim, letterSpacing: 2, marginBottom: 12 }}>── TAREFAS PENDENTES</h2>
        {tareas.slice(0, 5).map(t => (
          <div key={t.id} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '8px 0',
            borderBottom: `1px solid ${C.border}`,
          }}>
            <span>{t.titulo}</span>
            <span style={{ color: C.dim, fontSize: 12 }}>{t.prazo}</span>
          </div>
        ))}
      </div>

      <div>
        <h2 style={{ fontSize: 12, color: C.dim, letterSpacing: 2, marginBottom: 12 }}>── PRESENÇA DO DIA</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            {presenca.slice(0, 8).map(p => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '8px 0' }}>{p.trabalhador}</td>
                <td style={{ padding: '8px 0', color: C.dim }}>{p.obra}</td>
                <td style={{ padding: '8px 0', color: p.status === 'presente' ? C.green : C.red }}>
                  {p.entrada || '—'}
                </td>
                <td style={{ padding: '8px 0', textAlign: 'right' }}>
                  <span style={{
                    fontSize: 10, padding: '2px 6px',
                    background: p.status === 'presente' ? C.green : C.red,
                    color: '#000',
                  }}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}