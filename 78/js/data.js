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
  storageBucket: "controle-obras-c889d.appspot.com",
  messagingSenderId: "570296468947",
  appId: "1:570296468947:web:fff3403f8fbb72225d1b26",
  measurementId: "G-KVPEMVBXTY"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const dbRef = firebase.database().ref('gestaoObrasDBv2');
let DB = JSON.parse(JSON.stringify(staticDB));
let isFirstLoad = true;

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

function loadLegacyLocalIfAny() {
  try {
    const oldLocal = localStorage.getItem('gestaoObraDB');
    if (!oldLocal) return JSON.parse(JSON.stringify(staticDB));
    return ensureSchema(JSON.parse(oldLocal));
  } catch (e) {
    return JSON.parse(JSON.stringify(staticDB));
  }
}

function initDB() {
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

function loadTheme() {
  if (DB && DB.config) {
    document.documentElement.style.setProperty('--accent', DB.config.corPrimaria || '#f59e0b');
    document.querySelectorAll('.app-brand-name').forEach(el => {
      el.textContent = DB.config.nomeEmpresa || 'GestãoObra';
    });
  }
}

function persistDB() {
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

initDB();
