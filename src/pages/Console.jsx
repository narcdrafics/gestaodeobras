import { useState, useEffect, useRef, useCallback } from 'react';
import { useDB } from '../contexts/FirebaseContext';

const C = {
  bg: '#090b0d', panel: '#0e1114', border: '#1c2028', border2: '#252c35',
  text: '#c8d0db', dim: '#4a5568', dim2: '#2d3748', accent: '#f59e0b',
  green: '#34d399', red: '#f87171', blue: '#60a5fa', cyan: '#22d3ee',
};

const fmt = {
  brl: (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
  pct: (a, b) => b ? `${((a / b) * 100).toFixed(1)}%` : '0%',
};

const ALL_CMDS = ['dashboard', 'obras', 'trabalhadores', 'presenca', 'tarefas', 'estoque', 'financeiro', 'help', 'clear'];

function resolveCommand(cmd, db) {
  const parts = cmd.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (!db) return <div style={{ color: C.dim }}>Carregando...</div>;

  if (command === 'dashboard') {
    const obras = db.obras || [];
    const totalOrc = obras.reduce((s, o) => s + (o.orcamento || 0), 0);
    const totalGasto = obras.reduce((s, o) => s + (o.gasto || 0), 0);
    const ativos = (db.trabalhadores || []).filter(t => t.ativo).length;
    const criticas = (db.tarefas || []).filter(t => t.prioridade === 'critica' && t.status !== 'concluida').length;
    
    return (
      <div>
        <div style={{ color: C.dim, fontSize: 10, marginBottom: 10 }}>── DASHBOARD {"─".repeat(40)}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ border: `1px solid ${C.border2}`, padding: '10px 14px', background: C.panel }}>
            <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase' }}>Obras Ativas</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.blue }}>{obras.filter(o => o.status === 'em_andamento').length}</div>
          </div>
          <div style={{ border: `1px solid ${C.border2}`, padding: '10px 14px', background: C.panel }}>
            <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase' }}>Orçamento</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt.brl(totalOrc)}</div>
          </div>
          <div style={{ border: `1px solid ${C.border2}`, padding: '10px 14px', background: C.panel }}>
            <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase' }}>Trabalhadores</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.green }}>{ativos}</div>
          </div>
          <div style={{ border: `1px solid ${C.border2}`, padding: '10px 14px', background: C.panel }}>
            <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase' }}>Tarefas Críticas</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: criticas > 0 ? C.red : C.green }}>{criticas}</div>
          </div>
        </div>
      </div>
    );
  }

  if (command === 'obras') {
    const obras = db.obras || [];
    return (
      <div>
        <div style={{ color: C.dim, fontSize: 10, marginBottom: 10 }}>── OBRAS {"─".repeat(44)}</div>
        {obras.map(o => {
          const pct = (o.gasto / o.orcamento * 100).toFixed(0);
          return (
            <div key={o.id} style={{ marginBottom: 8, paddingLeft: 8, borderLeft: `2px solid ${C.border2}` }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: C.accent, fontWeight: 700 }}>{o.id}</span>
                <span>{o.nome}</span>
                <span style={{ fontSize: 10, padding: '1px 4px', background: C.blue, color: '#000' }}>{o.status}</span>
              </div>
              <div style={{ fontSize: 11, color: C.dim }}>
                {fmt.brl(o.gasto)} / {fmt.brl(o.orcamento)} ({pct}%)
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (command === 'trabalhadores') {
    const trabs = db.trabalhadores || [];
    return (
      <div>
        <div style={{ color: C.dim, fontSize: 10, marginBottom: 10 }}>── TRABALHADORES {"─".repeat(38)}</div>
        {trabs.map(t => (
          <div key={t.id} style={{ padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ color: C.accent, minWidth: 60, display: 'inline-block' }}>{t.id}</span>
            <span>{t.nome}</span>
            <span style={{ color: C.dim }}> — {t.funcao}</span>
            <span style={{ color: t.ativo ? C.green : C.red, marginLeft: 8 }}>
              {t.ativo ? '●' : '○'} {t.ativo ? 'ATIVO' : 'INATIVO'}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (command === 'help') {
    return (
      <div>
        <div style={{ color: C.dim, fontSize: 10, marginBottom: 10 }}>── AJUDA {"─".repeat(46)}</div>
        {ALL_CMDS.map(cmd => (
          <div key={cmd} style={{ padding: '2px 0', fontSize: 12 }}>
            <span style={{ color: C.accent, fontFamily: 'monospace', minWidth: 150, display: 'inline-block' }}>{cmd}</span>
          </div>
        ))}
      </div>
    );
  }

  return <span style={{ color: C.red, fontSize: 12 }}>Comando não encontrado: {cmd}. Digite "help".</span>;
}

function Cursor() {
  const [on, setOn] = useState(true);
  useEffect(() => { const t = setInterval(() => setOn(p => !p), 500); return () => clearInterval(t); }, []);
  return <span style={{ opacity: on ? 1 : 0, color: C.accent }}>█</span>;
}

export default function Console() {
  const { db } = useDB();
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [cmdHist, setCmdHist] = useState([]);
  const [cmdIdx, setCmdIdx] = useState(-1);
  const [booted, setBooted] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => setBooted(true), 600); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history]);

  const run = useCallback((cmd) => {
    if (!cmd.trim()) return;
    if (cmd.toLowerCase() === 'clear') { setHistory([]); setInput(''); return; }

    const output = resolveCommand(cmd, db);
    setCmdHist(h => [cmd, ...h.slice(0, 49)]);
    setCmdIdx(-1);
    setHistory(h => [...h, { cmd, output }]);
    setInput('');
  }, [db]);

  const handleKey = useCallback((e) => {
    if (e.key === 'Enter') { run(input); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); const idx = Math.min(cmdIdx + 1, cmdHist.length - 1); setCmdIdx(idx); setInput(cmdHist[idx] || ''); }
    if (e.key === 'ArrowDown') { e.preventDefault(); const idx = Math.max(cmdIdx - 1, -1); setCmdIdx(idx); setInput(idx >= 0 ? cmdHist[idx] : ''); }
    if (e.key === 'Tab') { e.preventDefault(); const v = input.toLowerCase(); const matches = ALL_CMDS.filter(c => c.startsWith(v) && c !== v); if (matches.length === 1) setInput(matches[0]); }
  }, [input, cmdIdx, cmdHist, run]);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'JetBrains Mono', monospace", color: C.text }} onClick={() => inputRef.current?.focus()}>
      <div style={{ padding: 20 }}>
        {booted && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: C.border2, fontSize: 10, marginBottom: 8 }}>{"─".repeat(70)}</div>
            <div style={{ color: C.accent, fontSize: 15, fontWeight: 700 }}>Gestão de Obras v1.1.0</div>
            <div style={{ color: C.dim, fontSize: 11 }}>React + Firebase • Digite "help"</div>
            <div style={{ color: C.border2, fontSize: 10, marginTop: 8 }}>{"─".repeat(70)}</div>
          </div>
        )}

        {history.map((item, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <span style={{ color: C.green, fontSize: 11 }}>obra@real</span>
              <span style={{ color: C.border2 }}>:</span>
              <span style={{ color: C.blue }}>~</span>
              <span style={{ color: C.text }}>$</span>
              <span style={{ fontWeight: 600 }}>{item.cmd}</span>
            </div>
            <div style={{ paddingLeft: 16, borderLeft: `2px solid ${C.border}` }}>{item.output}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ borderTop: `1px solid ${C.border}`, padding: '0 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12 }}>
          <span style={{ color: C.green, fontSize: 12 }}>obra@real</span>
          <span style={{ color: C.border2 }}>:</span>
          <span style={{ color: C.blue }}>~</span>
          <span style={{ color: C.text }}>$</span>
          <input ref={inputRef} autoFocus value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
            placeholder="comando..." spellCheck={false}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: C.text, fontFamily: 'inherit', fontSize: 13, caretColor: C.accent }} />
          <Cursor />
        </div>
      </div>
    </div>
  );
}