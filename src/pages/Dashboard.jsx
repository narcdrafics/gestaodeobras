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
  orange: '#fb923c',
};

const fmt = {
  brl: (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
  pct: (a, b) => b ? `${((a / b) * 100).toFixed(1)}%` : '0%',
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

function ProgressBar({ value, max, color }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ background: C.dim, height: 4, borderRadius: 2, flex: 1, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
    </div>
  );
}

export default function Dashboard() {
  const { db } = useDB();
  if (!db || !db.obras) return <div style={{ color: C.dim }}>Carregando...</div>;

  const obras = db.obras || [];
  const trabs = db.trabalhadores || [];
  const tareas = db.tarefas || [];
  const finan = db.financeiro || [];
  const estq = db.estoque || [];

  const totalOrc = obras.reduce((s, o) => s + (o.orcamento || 0), 0);
  const totalGasto = obras.reduce((s, o) => s + (o.gasto || 0), 0);
  const trabsAtivos = trabs.filter(t => t.ativo).length;
  const criticas = tareas.filter(t => t.prioridade === 'critica' && t.status !== 'concluida').length;
  const baixoEstoque = estq.filter(e => e.quantidade <= e.minimo).length;
  const pendentes = finan.filter(f => f.status === 'pendente').length;
  const obrasAtivas = obras.filter(o => o.status === 'em_andamento');

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
        Dashboard Executivo
      </h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <StatCard label="Obras Ativas" value={obrasAtivas.length} color={C.blue} />
        <StatCard label="Orçamento" value={fmt.brl(totalOrc)} sub={`Gasto: ${fmt.pct(totalGasto, totalOrc)}`} />
        <StatCard label="Trabalhadores" value={trabsAtivos} color={C.green} />
        <StatCard label="Tarefas Críticas" value={criticas} color={criticas > 0 ? C.red : C.green} />
        <StatCard label="Estoque Crítico" value={baixoEstoque} color={baixoEstoque > 0 ? C.orange : C.green} />
      </div>

      {criticas > 0 && (
        <div style={{ 
          background: `${C.red}20`, border: `1px solid ${C.red}`, 
          padding: 12, marginBottom: 16, borderRadius: 4 
        }}>
          <strong style={{ color: C.red }}>⚠️ {criticas} tarefa(s) crítica(s) em aberto</strong>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 12, color: C.dim, letterSpacing: 2, marginBottom: 12 }}>── RESUMO POR OBRA</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: C.dim, textAlign: 'left', borderBottom: `1px solid ${C.border}` }}>
              <th style={{ padding: '8px 0' }}>OBRA</th>
              <th>STATUS</th>
              <th style={{ textAlign: 'right' }}>ORÇAMENTO</th>
              <th style={{ textAlign: 'right' }}>GASTO</th>
              <th style={{ textAlign: 'right' }}>%</th>
              <th style={{ textAlign: 'right' }}>TAREFAS</th>
            </tr>
          </thead>
          <tbody>
            {obras.map(obra => {
              const pct = (obra.gasto / obra.orcamento * 100).toFixed(0);
              const tarefasObra = tareas.filter(t => t.obra === obra.id && t.status !== 'concluida').length;
              return (
                <tr key={obra.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 0' }}>
                    <div style={{ fontWeight: 700, color: C.accent }}>{obra.id}</div>
                    <div style={{ fontSize: 12, color: C.dim }}>{obra.nome}</div>
                  </td>
                  <td style={{ padding: '8px 0' }}>
                    <span style={{ 
                      fontSize: 10, padding: '2px 6px', 
                      background: obra.status === 'em_andamento' ? C.blue : C.dim,
                      color: '#000', 
                    }}>
                      {obra.status}
                    </span>
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>{fmt.brl(obra.orcamento)}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: pct > 85 ? C.red : C.text }}>
                    {fmt.brl(obra.gasto)}
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ProgressBar value={obra.gasto} max={obra.orcamento} color={pct > 85 ? C.red : C.blue} />
                      <span style={{ minWidth: 40, textAlign: 'right', color: pct > 85 ? C.red : C.accent }}>{pct}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: tarefasObra > 0 ? C.orange : C.dim }}>
                    {tarefasObra}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}