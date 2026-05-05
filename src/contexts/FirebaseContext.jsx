import { createContext, useContext, useState, useEffect } from 'react';

const FirebaseContext = createContext(null);

export function FirebaseProvider({ children }) {
  const [db, setDb] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState(null);

  useEffect(() => {
    // 1. Pega o usuário logado para saber qual o tenantId (bolha)
    const userStr = sessionStorage.getItem('gestaoUser');
    let tenantIdLocal = null;

    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        setUser(u);
        setTenantId(u.tenantId);
        tenantIdLocal = u.tenantId;
      } catch (e) {
        console.error("Erro ao ler usuário da sessão:", e);
      }
    } else {
      console.warn("Nenhum usuário logado! Sem login, o Firebase bloqueará a leitura dos dados reais.");
      // Se desejar forçar o login na nova versão:
      // window.location.href = '/login.html';
    }

    const handleSync = (e) => {
      setDb(e.detail);
      setLoading(false);
      if (window.CURRENT_TENANT_ID) {
        setTenantId(window.CURRENT_TENANT_ID);
      }
    };
    
    window.addEventListener('firebaseSync', handleSync);

    const checkDB = setInterval(() => {
      // Aguarda até o data_core.js estar carregado e disponível no window
      if (window.DB && typeof window.initDB === 'function') {
        
        // Dispara o download dos dados da nuvem se tivermos um tenant
        if (tenantIdLocal && !window._dbInitialized) {
          window._dbInitialized = true; // Evita chamar initDB múltiplas vezes
          console.log("Iniciando conexão com Firebase para o tenant:", tenantIdLocal);
          window.initDB(tenantIdLocal);
        }

        setDb(window.DB);
        setLoading(false);
        if (window.CURRENT_TENANT_ID) {
          setTenantId(window.CURRENT_TENANT_ID);
        }
        clearInterval(checkDB);
      }
    }, 200);

    // Timeout para parar de esperar após 10 segundos
    setTimeout(() => {
      clearInterval(checkDB);
      setLoading(false); // Garante que sai do estado de loading
    }, 10000);

    return () => {
      window.removeEventListener('firebaseSync', handleSync);
      clearInterval(checkDB);
    };
  }, []);

  const refreshDB = () => {
    if (window.DB) setDb({ ...window.DB });
  };

  return (
    <FirebaseContext.Provider value={{ db, user, setUser, loading, tenantId, refreshDB }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within FirebaseProvider');
  }
  return context;
}

export function useDB() {
  const { db, refreshDB } = useFirebase();
  return { db: db || window.DB || {}, refreshDB };
}