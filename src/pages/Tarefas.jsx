import { useState } from 'react';
import { useDB } from '../contexts/FirebaseContext';

const C = {
  bg: '#090b0d', panel: '#0e1114', border: '#1c2028',
  text: '#c8d0db', dim: '#4a5568', accent: '#f59e0b',
  green: '#34d399', red: '#f87171', blue: '#60a5fa', orange: '#fb923c',
};

const PRIO = { critica: C.red, alta: C.orange, media: C.accent, baixa: C.dim };

export default function Tarefas() {
  const { db } = useDB();
  const [filtro, setFiltro] = useState('todas');
  const tareas = db?.tarefas || [];

  let filtradas = tareas;
  if (filtro === 'pendentes') filtradas = tareas.filter(t => t.status === 'pendente');
  else if (filtro === 'andamento') filtradas = tareas.filter(t => t.status === 'em_andamento');
  else if (filtro === 'critica') filtradas = tareas.filter(t => t.prioridade === 'critica');

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Tarefas</h1>
      
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['todas', 'pendentes', 'andamento', 'critica'].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: '6px 12px', fontSize: 12,
            background: filtro === f ? C.accent : 'transparent',
            border: `1px solid ${filtro === f ? C.accent : C.border}`,
            color: filtro === f ? '#000' : C.text, cursor: 'pointer',
          }}>{f.toUpperCase()}</button>
        ))}
      </div>

      {filtradas.map(t => (
        <div key={t.id} style={{
          border: `1px solid ${C.border}`,
          padding: 12, marginBottom: 8, background: C.panel,
        }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
            <span style={{ color: PRIO[t.prioridade], fontSize: 10, fontWeight: 700 }}>
              ◆ {t.prioridade?.toUpperCase()}
            </span>
            <span style={{ fontWeight: 600 }}>{t.titulo}</span>
            <span style={{ fontSize: 10, padding: '2px 6px', background: C.blue, color: '#000' }}>
              {t.status}
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.dim, display: 'flex', gap: 16 }}>
            <span>Obra: {t.obra}</span>
            <span>Resp: {t.responsavel}</span>
            <span>Prazo: {t.prazo}</span>
          </div>
        </div>
      ))}
    </div>
  );
}