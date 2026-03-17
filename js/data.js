const staticDB = {
  config: {
    nomeEmpresa: 'GestãoObra',
    corPrimaria: '#f59e0b'
  },
  usuarios: [],
  obras: [],
  trabalhadores: [],
  presenca: [],
  tarefas: [],
  estoque: [],
  movEstoque: [],
  compras: [],
  financeiro: [],
  orcamento: [],
  medicao: [],
};

const firebaseConfig = {
  apiKey: "AIzaSyD9i1vMwmJwiUfwUKetxrzIO6Bm5K-5oro",
  authDomain: "controle-obras-c889d.firebaseapp.com",
  databaseURL: "https://controle-obras-c889d-default-rtdb.firebaseio.com",
  projectId: "controle-obras-c889d",
  storageBucket: "controle-obras-c889d.firebasestorage.app",
  messagingSenderId: "570296468947",
  appId: "1:570296468947:web:fff3403f8fbb72225d1b26",
  measurementId: "G-KVPEMVBXTY"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

let dbRef = null;
let DB = JSON.parse(JSON.stringify(staticDB));
let isFirstLoad = true;
let CURRENT_TENANT_ID = null; // SaaS: Armazena o ID do tenant detectado por subdomínio

function ensureSchema(db) {
  const safe = db && typeof db === 'object' ? db : {};
  safe.config = safe.config || JSON.parse(JSON.stringify(staticDB.config));
  safe.usuarios = Array.isArray(safe.usuarios) ? safe.usuarios : [];
  safe.obras = Array.isArray(safe.obras) ? safe.obras : [];
  safe.trabalhadores = Array.isArray(safe.trabalhadores) ? safe.trabalhadores : [];
  safe.presenca = Array.isArray(safe.presenca) ? safe.presenca : [];
  safe.tarefas = Array.isArray(safe.tarefas) ? safe.tarefas : [];
  safe.estoque = Array.isArray(safe.estoque) ? safe.estoque : [];
  safe.movEstoque = Array.isArray(safe.movEstoque) ? safe.movEstoque : [];
  safe.compras = Array.isArray(safe.compras) ? safe.compras : [];
  safe.financeiro = Array.isArray(safe.financeiro) ? safe.financeiro : [];
  safe.orcamento = Array.isArray(safe.orcamento) ? safe.orcamento : [];
  safe.medicao = Array.isArray(safe.medicao) ? safe.medicao : [];
  return safe;
}

// ==================== SUBDOMAIN & SAAS CONTEXT ====================
function detectSubdomain() {
  const host = window.location.hostname;
  const parts = host.split('.');
  
  // Evita detectar 'www' ou 'localhost' como subdomínio de cliente
  if (parts.length > 2 && parts[0] !== 'www') {
    return parts[0];
  }
  return null;
}

async function loadTenantBySlug(slug) {
  if (!slug) return null;
  try {
    // Tenta primeiro leitura pública (nó tenants_public)
    const pubSnap = await firebase.database().ref('tenants_public')
      .orderByChild('slug')
      .equalTo(slug)
      .once('value');
    
    const pubTenants = pubSnap.val();
    if (pubTenants) {
      const tenantId = Object.keys(pubTenants)[0];
      const pub = pubTenants[tenantId];
      return { id: tenantId, data: { config: pub } };
    }

    // Fallback: Busca diretamente no nó tenants (requer autenticação)
    const snapshot = await firebase.database().ref('tenants')
      .orderByChild('config/slug')
      .equalTo(slug)
      .once('value');
    
    const tenants = snapshot.val();
    if (tenants) {
      const tenantId = Object.keys(tenants)[0];
      return { id: tenantId, data: tenants[tenantId] };
    }
  } catch (e) {
    console.warn('Aviso ao buscar tenant por slug (pode ser normal antes do login):', e.code || e.message);
  }
  return null;
}

function loadLegacyLocalIfAny() {
  try {
    const oldLocal = localStorage.getItem('gestaoObraDB');
    if (!oldLocal) return JSON.parse(JSON.stringify(staticDB));
    return ensureSchema(JSON.parse(oldLocal));
  } catch (e) {
    return JSON.parse(JSON.stringify(staticDB));
  }
}

function initDB(tenantId) {
  if (!tenantId) {
    console.error('initDB chamado sem tenantId');
    return;
  }
  dbRef = firebase.database().ref('tenants/' + tenantId);
  
  dbRef.on('value', (snapshot) => {
    const data = snapshot.val();

    if (data) {
      DB = ensureSchema(data);

      const hasGoogleUsers = DB.usuarios.some(u => u && u.email);
      if (!hasGoogleUsers) {
        const recovered = loadLegacyLocalIfAny();
        const recoveredHasData =
          recovered.obras.length ||
          recovered.trabalhadores.length ||
          recovered.presenca.length ||
          recovered.tarefas.length ||
          recovered.estoque.length ||
          recovered.compras.length ||
          (recovered.config && recovered.config.nomeEmpresa !== 'GestãoObra');

        if (recoveredHasData) {
          DB = ensureSchema(recovered);
        }
      }

      processCloudUpdate();
      return;
    }

    DB = loadLegacyLocalIfAny();
    processCloudUpdate();
  }, (error) => {
    console.error('Firebase Read Error:', error);
    if (typeof toast === 'function') toast('Erro ao ler a nuvem!', 'error');
  });
}

function processCloudUpdate() {
  loadTheme();
  window.dispatchEvent(new CustomEvent('firebaseSync', { detail: DB }));

  if (isFirstLoad) {
    isFirstLoad = false;
    if (typeof checkAuth === 'function') {
      checkAuth();
    } else {
      window.addEventListener('load', () => {
        if (typeof checkAuth === 'function') checkAuth();
      }, { once: true });
    }
    return;
  }

  const activePage = document.querySelector('.page.active');
  if (activePage && typeof renderPage === 'function' && !document.querySelector('.modal-overlay.open')) {
    renderPage(activePage.id.replace('page-', ''));
  }
}

function loadTheme(externalCfg) {
  const cfg = externalCfg || (DB && DB.config);
  if (cfg) {
    const root = document.documentElement;
    
    // 1. Aplica cores principais
    root.style.setProperty('--accent', cfg.corPrimaria || '#f59e0b');
    if (cfg.corSidebar) root.style.setProperty('--sb-bg', cfg.corSidebar);
    if (cfg.corMenu) root.style.setProperty('--sb-text', cfg.corMenu);
    if (cfg.corSidebar) root.style.setProperty('--sb-active-bg', 'rgba(255,255,255,0.05)');

    // 2. Aplica Tema (Light/Dark)
    if (cfg.tema === 'light') {
        document.body.classList.add('light-mode');
    } else {
        document.body.classList.remove('light-mode');
    }

    // 3. Aplica Nome da Empresa
    document.querySelectorAll('.app-brand-name').forEach(el => {
      el.textContent = cfg.nomeEmpresa || 'GestãoObra';
    });

    // 4. Aplica Logo ou Fallback
    const container = document.getElementById('brand-container');
    if (container) {
        if (cfg.logoUrl) {
            container.innerHTML = `
                <img src="${cfg.logoUrl}" class="header-logo" alt="${cfg.nomeEmpresa}" style="max-height: 40px; width: auto; object-fit: contain;">
                <span class="app-brand-name" style="margin-left: 8px;">${cfg.nomeEmpresa || 'GestãoObra'}</span>
            `;
        } else {
            container.innerHTML = `<span id="brand-icon">🏗️</span> <span class="app-brand-name">${cfg.nomeEmpresa || 'GestãoObra'}</span>`;
        }
    }
  }
}

// SaaS: Inicialização de contexto por subdomínio (antes do login)
const subdomainContextPromise = (async function initSubdomainContext() {
  const slug = detectSubdomain();
  if (slug) {
    const tenant = await loadTenantBySlug(slug);
    if (tenant && tenant.data && tenant.data.config) {
      console.log('Contexto de subdomínio detectado:', slug);
      CURRENT_TENANT_ID = tenant.id; // Vincula o ID do tenant detectado
      loadTheme(tenant.data.config);
      return tenant;
    }
  }
  return null;
})();

function persistDB() {
  const sessionUser = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
  if (!dbRef || sessionUser.role === 'super_admin') {
     console.warn('Persistência ignorada: dbRef não inicializado ou Super Admin.');
     return Promise.resolve();
  }
  DB = ensureSchema(DB);
  return dbRef.set(DB).catch(err => {
    console.error('Falha ao salvar na nuvem:', err);
    if (typeof toast === 'function') toast('Erro ao sincronizar nuvem!', 'error');
    throw err;
  });
}

function exportarBackup() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(DB, null, 2));
  const a = document.createElement('a');
  a.href = dataStr;
  const isoDate = new Date().toISOString().split('T')[0];
  a.download = `gestao_obra_backup_${isoDate}.json`;
  a.click();
  if (typeof toast === 'function') toast('Backup exportado com sucesso!');
}

function importarBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = ensureSchema(JSON.parse(e.target.result));
      DB = data;
      persistDB().then(() => {
        if (typeof renderPage === 'function') {
          const activePage = document.querySelector('.page.active');
          if (activePage) renderPage(activePage.id.replace('page-', ''));
        }
        if (typeof toast === 'function') toast('Backup em nuvem importado com sucesso!');
      });
    } catch (err) {
      if (typeof toast === 'function') toast('Erro ao ler arquivo!', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function toggleMenu() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

// Retirado initDB() automático para SaaS. Será chamado em auth.js após login.
// initDB();
