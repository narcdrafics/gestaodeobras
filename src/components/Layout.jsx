import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFirebase } from '../contexts/FirebaseContext';

const colors = {
  bg: '#090b0d',
  panel: '#0e1114',
  border: '#1c2028',
  border2: '#252c35',
  text: '#c8d0db',
  dim: '#4a5568',
  accent: '#f59e0b',
  green: '#34d399',
  red: '#f87171',
  blue: '#60a5fa',
};

const navItems = [
  { path: '/hoje', icon: '📅', label: 'Hoje', group: 'principal' },
  { path: '/dashboard', icon: '📊', label: 'Dashboard', group: 'principal' },
  
  { path: '/obras', icon: '🏢', label: 'Obras', group: 'operacao' },
  { path: '/tarefas', icon: '📋', label: 'Tarefas', group: 'operacao' },
  { path: '/trabalhadores', icon: '👷', label: 'Trabalhadores', group: 'operacao' },
  { path: '/almocos', icon: '🍱', label: 'Almoços', group: 'operacao' },
  
  { path: '/presenca', icon: '✅', label: 'Presença (Ponto)', group: 'producao' },
  { path: '/medicao', icon: '📐', label: 'Medições', group: 'producao' },
  { path: '/rdo', icon: '📋', label: 'RDO', group: 'producao' },
  { path: '/fotos', icon: '📸', label: 'Galeria de Fotos', group: 'producao' },
  
  { path: '/estoque', icon: '🏪', label: 'Estoque', group: 'suprimentos' },
  { path: '/movEstoque', icon: '🔄', label: 'Movimentações', group: 'suprimentos' },
  
  { path: '/orcamento', icon: '💰', label: 'Orçamento', group: 'financeiro' },
  { path: '/compras', icon: '🛒', label: 'Compras', group: 'financeiro' },
  { path: '/financeiro', icon: '⚖️', label: 'Financeiro', group: 'financeiro' },
  { path: '/relatorios', icon: '📄', label: 'Relatórios', group: 'financeiro' },
  
  { path: '/admin', icon: '⚙️', label: 'Administração', group: 'admin' },
  
  { path: '/super_admin', icon: '👑', label: 'Painel Master', group: 'super_admin' },
  
  { path: '/logout', icon: '🚪', label: 'Sair do Sistema', group: 'acesso', action: 'logout' }
];

const groups = {
  principal: 'Principal',
  operacao: 'Operação',
  producao: 'Produção (Canteiro)',
  suprimentos: 'Suprimentos',
  financeiro: 'Financeiro',
  admin: 'Sistema',
  super_admin: 'SaaS Master',
  acesso: 'Acesso',
};

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [expanded, setExpanded] = useState(() => {
    const currentItem = navItems.find(item => location.pathname === item.path || (location.pathname === '/' && item.path === '/hoje'));
    return currentItem ? { [currentItem.group]: true } : { principal: true };
  });

  const [menuOpen, setMenuOpen] = useState(true);
  const { db } = useFirebase();

  useEffect(() => {
    const currentItem = navItems.find(item => location.pathname === item.path || (location.pathname === '/' && item.path === '/hoje'));
    if (currentItem && !expanded[currentItem.group]) {
      setExpanded(prev => ({ ...prev, [currentItem.group]: true }));
    }
  }, [location.pathname]);

  const now = new Date().toLocaleString('pt-BR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'short' 
  });

  const toggleGroup = (group) => {
    setExpanded(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const handleNav = (item) => {
    if (item.action === 'logout') {
      sessionStorage.removeItem('gestaoUser');
      if (typeof window.doLogout === 'function') {
        window.doLogout();
      } else {
        window.location.href = '/login.html';
      }
      return;
    }
    navigate(item.path);
  };

  const obrasAtivas = db?.obras?.filter(o => o.status === 'em_andamento').length || 0;
  const trabsAtivos = db?.trabalhadores?.filter(t => t.ativo).length || 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: colors.bg, color: colors.text }}>
      {/* Sidebar */}
      <aside style={{
        width: menuOpen ? 220 : 60,
        background: colors.panel,
        borderRight: `1px solid ${colors.border}`,
        transition: 'width 0.2s',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '12px', borderBottom: `1px solid ${colors.border}` }}>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            background: 'none', border: 'none', color: colors.text, 
            fontSize: 18, cursor: 'pointer',
          }}>☰</button>
        </div>
        
        {Object.entries(groups).map(([groupKey, groupLabel]) => (
          <div key={groupKey}>
            <div onClick={() => toggleGroup(groupKey)} style={{
              padding: '10px 12px',
              cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between',
              color: colors.dim, fontSize: 11, letterSpacing: 1,
              borderBottom: `1px solid ${colors.border}`,
            }}>
              {menuOpen && <span>{groupLabel}</span>}
              <span>{expanded[groupKey] ? '▼' : '▶'}</span>
            </div>
            {expanded[groupKey] && menuOpen && (
              <div>
                {navItems.filter(item => item.group === groupKey).map(item => (
                  <div key={item.path} onClick={() => handleNav(item)} style={{
                    padding: '10px 12px 10px 24px',
                    cursor: 'pointer',
                    display: 'flex', gap: 10,
                    background: location.pathname === item.path ? colors.border : 'transparent',
                    color: location.pathname === item.path ? colors.accent : colors.text,
                  }}>
                    <span>{item.icon}</span>
                    {menuOpen && <span style={{ fontSize: 13 }}>{item.label}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header style={{
          padding: '8px 20px',
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: colors.panel,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ color: colors.accent, fontSize: 14, letterSpacing: 2, fontWeight: 700 }}>
              GESTÃO DE OBRAS
            </span>
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 12, color: colors.dim }}>
            <span>OBRAS <span style={{ color: colors.blue }}>{obrasAtivas}</span></span>
            <span>TRABALHADORES <span style={{ color: colors.green }}>{trabsAtivos}</span></span>
            <span style={{ color: colors.border2 }}>|</span>
            <span>{now}</span>
          </div>
        </header>

        {/* Page content */}
        <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}