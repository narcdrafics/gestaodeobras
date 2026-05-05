import { useState } from 'react';
import { useDB } from '../contexts/FirebaseContext';

const C = {
  bg: '#090b0d', panel: '#0e1114', border: '#1c2028',
  text: '#c8d0db', dim: '#4a5568', accent: '#f59e0b',
  green: '#34d399', red: '#f87171', blue: '#60a5fa',
};

const fmt = { brl: (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` };

export default function Trabalhadores() {
  const { db } = useDB();
  const [filtro, setFiltro] = useState('todos');
  const trabs = db?.trabalhadores || [];

  const filtrados = filtro === 'todos' 
    ? trabs 
    : filtro === 'ativos' 
      ? trabs.filter(t => t.ativo)
      : trabs.filter(t => !t.ativo);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Trabalhadores</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {['todos', 'ativos', 'inativos'].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              padding: '6px 12px', fontSize: 12,
              background: filtro === f ? C.accent : 'transparent',
              border: `1px solid ${filtro === f ? C.accent : C.border}`,
              color: filtro === f ? '#000' : C.text,
              cursor: 'pointer',
            }}>{f.toUpperCase()}</button>
          ))}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: C.dim, textAlign: 'left', borderBottom: `1px solid ${C.border}` }}>
            <th>ID</th>
            <th>NOME</th>
            <th>FUNÇÃO</th>
            <th>OBRA</th>
            <th>DIÁRIA</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {filtrados.map(t => (
            <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ color: C.accent, fontWeight: 700 }}>{t.id}</td>
              <td>{t.nome}</td>
              <td style={{ color: C.dim }}>{t.funcao}</td>
              <td style={{ color: C.dim }}>{t.obra}</td>
              <td style={{ color: C.accent }}>{fmt.brl(t.diaria)}</td>
              <td>
                <span style={{ 
                  fontSize: 10, padding: '2px 6px',
                  background: t.ativo ? C.green : C.red, color: '#000' 
                }}>
                  {t.ativo ? 'ATIVO' : 'INATIVO'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}