const staticDB = {
  config: {
    nomeEmpresa: 'Obra Real',
    esquemaCores: 'emerald',
    limiteObras: 1,
    limiteUsuarios: 1,
    limiteTrabalhadores: 9999,
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
  almocos: [],
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
  safe.almocos = Array.isArray(safe.almocos) ? safe.almocos : [];
  return safe;
}

// ==================== SUBDOMAIN & SAAS CONTEXT ====================
function detectSubdomain() {
  const urlParams = new URLSearchParams(window.location.search);
  const tenantParam = urlParams.get('tenant');
  if (tenantParam) return tenantParam;

  const host = window.location.hostname;
  // Ignora domínios técnicos do Firebase e Localhost (ambientes de dev/staging)
  if (host.includes('web.app') || host.includes('firebaseapp.com') || host.includes('localhost')) {
    return null;
  }

  const parts = host.split('.');
  // Evita detectar 'www' como subdomínio de cliente
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

    // Fallback: Busca diretamente no nó tenants (apenas se estiver autenticado para evitar Permission Denied)
    if (firebase.auth().currentUser) {
      const snapshot = await firebase.database().ref('tenants')
        .orderByChild('config/slug')
        .equalTo(slug)
        .once('value');

      const tenants = snapshot.val();
      if (tenants) {
        const tenantId = Object.keys(tenants)[0];
        return { id: tenantId, data: tenants[tenantId] };
      }
    }
  } catch (e) {
    if (e.code !== 'PERMISSION_DENIED') {
      console.warn('Aviso ao buscar tenant por slug:', e.code || e.message);
    }
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

let _currentTenantId = null;
let _isPersisting = false;
// Super Admin: tenant ativo selecionado para operações de escrita
let superAdminActiveTenant = null; // { id, nome, dbRef }

function initDB(tenantId) {
  if (!tenantId) {
    console.error('initDB chamado sem tenantId');
    return;
  }
  // Evita registrar multiplos listeners para o mesmo tenant
  if (_currentTenantId === tenantId && dbRef) {
    console.log('initDB ignorado: tenant ja inicializado:', tenantId);
    return;
  }

  // SaaS: Carregamento Híbrido (LocalStorage como Cache)
  const localCache = localStorage.getItem('gestaoObraDB');
  if (localCache) {
    try {
      const cached = JSON.parse(localCache);
      // Só usa o cache se pertencer ao tenant atual (segurança cross-tenant)
      if (cached._tenantId === tenantId) {
        console.log('DB carregado via Cache Local para tenant:', tenantId);
        DB = ensureSchema(cached);
        processCloudUpdate();
      }
    } catch(e) { console.warn('Erro ao ler cache local:', e); }
  }

  // Remove listener anterior se existir
  if (dbRef) {
    dbRef.off('value');
  }
  _currentTenantId = tenantId;
  dbRef = firebase.database().ref('tenants/' + tenantId);
  dbRef.on('value', _onFirebaseValue, (error) => {
    console.error('Firebase Read Error:', error);
    if (typeof toast === 'function') toast('Erro ao ler a nuvem!', 'error');
  });
}

// Handler centralizado do listener Firebase
function _onFirebaseValue(snapshot) {
  // Ignora o eco do nosso próprio salvamento (evita loop e conflito no mobile)
  if (_ignoreNextEcho) {
    _ignoreNextEcho = false;
    console.log('[Firebase] Eco próprio ignorado.');
    return;
  }
  const data = snapshot.val();
  if (data) {

    // SaaS: Trava de Inadimplência e Bloqueios
    if (data.status === 'bloqueado_pagamento') {
      alert('⚠️ Sua assinatura SaaS está suspensa por falta de pagamento. O sistema foi bloqueado para proteção dos dados.\n\nPor favor, entre em contato com o Suporte (WhatsApp).');
      if (typeof doLogout === 'function') doLogout();
      return;
    }

    // SaaS: Trava de Tempo do Free Trial (30 dias)
    if (data.plano === 'free_trial' && data.trialExpiracao) {
      const msLeft = data.trialExpiracao - Date.now();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      
      // Armazena no objeto global para uso na UI
      DB.daysLeftTrial = daysLeft;

      if (msLeft <= 0) {
        alert('⏰ O seu período de Teste Grátis de 30 dias chegou ao fim!\n\nEsperamos que tenha gostado do sistema. Para continuar usando o Gestão de Obras, assine um de nossos planos.');
        if (typeof doLogout === 'function') doLogout();
        return;
      }
    }

    DB = ensureSchema(data);

    // Restaura fotos do localStorage separado (não são salvas na nuvem por serem base64)
    try {
      const fotosRaw = localStorage.getItem('gestaoObraFotos');
      if (fotosRaw && Array.isArray(DB.trabalhadores)) {
        const fotosMap = JSON.parse(fotosRaw);
        DB.trabalhadores = DB.trabalhadores.map(t => {
          if (!t.foto && fotosMap[t.cod]) {
            return { ...t, foto: fotosMap[t.cod] };
          }
          return t;
        });
      }
    } catch(e) { /* Silencioso: foto é opcional */ }

    processCloudUpdate();
    return;
  }
  // Se não houver dados no Firebase para este tenant, inicializa vazio e NÃO tenta recuperar localmente (evita Ghost Data de outros tenants)
  DB = ensureSchema({});
  processCloudUpdate();
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

    // 1. Aplica cores principais via paleta pré-definida
    if (typeof setAppTheme === 'function' && cfg.esquemaCores) {
       setAppTheme(cfg.esquemaCores);
    } else {
       root.setAttribute('data-theme', cfg.esquemaCores || 'emerald');
    }

    // 2. Aplica Tema (Light/Dark)
    if (cfg.tema === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }

    // 3. Aplica Nome da Empresa
    document.querySelectorAll('.app-brand-name').forEach(el => {
      el.textContent = cfg.nomeEmpresa || 'Obra Real';
    });

    // 4. Aplica Logo ou Fallback
    const container = document.getElementById('brand-container');
    if (container) {
      if (cfg.logoUrl) {
        container.innerHTML = `
                <img src="${cfg.logoUrl}" class="header-logo" alt="${cfg.nomeEmpresa}" style="max-height: 40px; width: auto; object-fit: contain;">
                <span class="app-brand-name" style="margin-left: 8px;">${cfg.nomeEmpresa || 'Obra Real'}</span>
            `;
      } else {
        container.innerHTML = `<span id="brand-icon">🏗️</span> <span class="app-brand-name">${cfg.nomeEmpresa || 'Obra Real'}</span>`;
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
    } else {
      console.error(`ALERTA: O subdomínio "${slug}" não corresponde a nenhuma Empresa registrada! O acesso foi interrompido por segurança.`);
      document.body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0f172a;color:#fff;font-family:sans-serif;text-align:center;padding:20px">
        <h1 style="color:#ef4444;margin-bottom:10px">❌ Empresa Inexistente ou URL Incorreta</h1>
        <p style="color:#cbd5e1;max-width:500px">O subdomínio <b>${slug}</b> não está vinculado a nenhuma empresa no sistema. Por favor, verifique se a URL da sua empresa está correta ou contrate um plano.</p>
        <p style="color:#94a3b8;font-size:12px;margin-top:20px">Obra Real SaaS Security</p>
      </div>`;
      throw new Error('Tenant não encontrado para este subdomínio.');
    }
  }
  return null;
})();

let _persistenceTimer = null;
let _isSaving = false;
let _saveScheduled = false;
let _ignoreNextEcho = false; // Previne reprocessar o eco do nosso próprio salvamento

/**
 * Persiste o banco de dados de forma segura.
 * @param {boolean} force - Se true, ignora o debounce e tenta salvar imediatamente.
 */
function persistDB(force = false) {
  // 1. BACKUP LOCAL (Sanitizado — sem base64 para respeitar limite de 5MB do iOS Safari)
  try {
    const toCache = JSON.parse(JSON.stringify(DB));
    toCache._tenantId = _currentTenantId;

    // Remove base64 do backup principal (economiza espaço no localStorage do mobile)
    // As fotos são salvas separadamente em 'gestaoObraFotos'
    const fotosMap = {};
    if (Array.isArray(toCache.trabalhadores)) {
      toCache.trabalhadores = toCache.trabalhadores.map(t => {
        if (t.foto && t.foto.startsWith('data:')) {
          fotosMap[t.cod] = t.foto; // Guarda separado
          const { foto, ...rest } = t;
          return rest;
        }
        return t;
      });
    }
    if (Array.isArray(toCache.medicao)) {
      toCache.medicao = toCache.medicao.map(m => {
        if (m.photoUrl && m.photoUrl.startsWith('data:')) {
          const { photoUrl, ...rest } = m;
          return rest;
        }
        return m;
      });
    }

    localStorage.setItem('gestaoObraDB', JSON.stringify(toCache));

    // Salva fotos separadamente (se houver espaço)
    if (Object.keys(fotosMap).length > 0) {
      try {
        localStorage.setItem('gestaoObraFotos', JSON.stringify(fotosMap));
      } catch(e2) {
        console.warn('[Persist] Sem espaço para fotos no localStorage (mobile):', e2);
      }
    }
  } catch(e) { console.warn('Falha no backup local:', e); }

  // 2. DEBOUNCE (Ignorado se force=true)
  if (_persistenceTimer) clearTimeout(_persistenceTimer);

  const performSave = async (resolve, reject) => {

    // 3. GERENCIAMENTO DE FILA
    if (_isSaving) {
      console.log('[Persist] Aguardando salvamento anterior concluir...');
      _saveScheduled = true;
      if (resolve) resolve();
      return;
    }

    const sessionUser = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
    const isSuperAdmin = sessionUser.role === 'super_admin';

    // Validação de Tenant
    if (isSuperAdmin && !superAdminActiveTenant) {
       console.warn('Super Admin sem tenant ativo selecionado.');
       if (resolve) resolve();
       return;
    }
    if (!isSuperAdmin && !dbRef) {
       console.warn('Persistencia ignorada: dbRef nao inicializado.');
       if (resolve) resolve();
       return;
    }

    try {
      _isSaving = true;
      window.dispatchEvent(new CustomEvent('syncStatus', { detail: { status: 'saving' } }));

      const targetRef = isSuperAdmin
        ? firebase.database().ref('tenants/' + superAdminActiveTenant.id)
        : dbRef;

      // Garante estrutura válida antes de salvar
      DB = ensureSchema(DB);

      // ⚠️ SANITIZAÇÃO: Remove fotos base64 antes de enviar ao Firebase.
      // Firebase RTDB tem limite de 10MB por escrita. Imagens base64 de trabalhadores
      // e medições podem ultrapassar esse limite. As fotos ficam apenas no localStorage.
      const dbForCloud = JSON.parse(JSON.stringify(DB));
      if (Array.isArray(dbForCloud.trabalhadores)) {
        dbForCloud.trabalhadores = dbForCloud.trabalhadores.map(t => {
          if (t.foto && t.foto.startsWith('data:')) {
            const { foto, ...rest } = t;
            return rest;
          }
          return t;
        });
      }
      if (Array.isArray(dbForCloud.medicao)) {
        dbForCloud.medicao = dbForCloud.medicao.map(m => {
          if (m.photoUrl && m.photoUrl.startsWith('data:')) {
            const { photoUrl, ...rest } = m;
            return rest;
          }
          return m;
        });
      }

      // ⚠️ MOBILE FIX: Força reconexão do WebSocket antes de escrever.
      // Em smartphones, o OS mata conexões em background (iOS/Android).
      firebase.database().goOnline();

      // Sinaliza para ignorar o eco do Firebase (sem precisar de .off())
      // Chamar .off() destruía a conexão WebSocket no mobile — nunca mais!
      _ignoreNextEcho = true;

      // Timeout de 20s (mobile pode ser mais lento que desktop)
      await Promise.race([
        targetRef.set(dbForCloud),
        new Promise((_, rej) => setTimeout(() => rej({ code: 'TIMEOUT', message: 'Conexão lenta ou sem internet.' }), 20000))
      ]);

      console.log('[Persist] Sincronizado com a nuvem com sucesso.');
      window.dispatchEvent(new CustomEvent('syncStatus', { detail: { status: 'synced' } }));
      if (resolve) resolve();
    } catch (err) {
      _ignoreNextEcho = false; // Reseta a flag em caso de falha
      const errCode = err.code || 'UNKNOWN';
      console.error(`[Persist Error] Code: ${errCode}`, err.message || err);

      window.dispatchEvent(new CustomEvent('syncStatus', {
        detail: { status: 'error', code: errCode }
      }));
      if (reject) reject(err);
    } finally {
      _isSaving = false;
      if (_saveScheduled) {
        _saveScheduled = false;
        persistDB();
      }
    }
  };

  if (force) {
    return new Promise((resolve, reject) => performSave(resolve, reject));
  } else {
    return new Promise((resolve, reject) => {
      _persistenceTimer = setTimeout(() => performSave(resolve, reject), 800);
    });
  }
}

function _religarListener(tenantId) {
  if (!tenantId || !dbRef) return;
  dbRef.on('value', _onFirebaseValue, (error) => {
    console.error('Firebase Read Error (religar):', error);
    if (typeof toast === 'function') toast('Erro ao ler a nuvem!', 'error');
  });
}

// Carrega o DB de um tenant específico no contexto do Super Admin
async function loadTenantAsSuperAdmin(tenantId, tenantNome) {
  const snap = await firebase.database().ref('tenants/' + tenantId).once('value');
  const data = snap.val();
  DB = ensureSchema(data || {});
  superAdminActiveTenant = { id: tenantId, nome: tenantNome };
  window.dispatchEvent(new CustomEvent('firebaseSync', { detail: DB }));
  if (typeof renderPage === 'function') {
    const activePage = document.querySelector('.page.active');
    if (activePage) renderPage(activePage.id.replace('page-', ''));
  }
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

// ==================== BILLING / PLANOS ====================

const KIWIFY_LINKS = {
  start: 'https://pay.kiwify.com.br/hHQz2Zu',
  pro: 'https://pay.kiwify.com.br/d0Gfv34',
};

/**
 * Popula a seção de billing na aba Admin usando DB (já carregado).
 * Chamada dentro de renderAdmin() — síncrona, sem leitura extra do Firebase.
 */
function renderBillingSection() {
  const el = (id) => document.getElementById(id);

  const plano       = DB.plano || 'free_trial';
  const limiteObras = DB.config?.limiteObras ?? 1;
  const limiteUsers = DB.config?.limiteUsuarios ?? 2;
  const slugSubdom  = DB.subdominioSlug || DB.config?.slug || '';
  const vencimento  = DB.planoVencimento;

  console.log('[Billing] Plano detectado:', plano);

  const PLANO_LABELS = {
    free_trial: '🆓 Período de Teste (30 dias)',
    start:      '🚀 Start',
    pro:        '⭐ Pro',
    premium:    '⭐ Pro',
    master:     '🌐 Ilimitado / Master',
    ilimitado:  '🌐 Ilimitado',
    full_anual: '👑 Full Anual'
  };

  if (el('plan-name'))   el('plan-name').textContent   = PLANO_LABELS[plano] || plano;
  if (el('limit-obras')) el('limit-obras').textContent = limiteObras >= 99  ? 'Ilimitado' : limiteObras;
  if (el('limit-usr'))   el('limit-usr').textContent   = limiteUsers >= 99  ? 'Ilimitado' : limiteUsers;

  if (vencimento && el('subscription-info')) {
    const dtVenc = new Date(vencimento).toLocaleDateString('pt-BR');
    el('subscription-info').innerHTML = `<span style="font-size:11px;color:var(--text3)">Vencimento / Renovação: ${dtVenc}</span>`;
  }

  const isFree   = plano === 'free_trial';
  const isStart  = (plano === 'start');
  const isPro    = (plano === 'pro' || plano === 'premium');
  const isMaster = (plano === 'master' || plano === 'ilimitado' || plano === 'full_anual');

  // Exibe apenas o painel correspondente ao plano de expansão
  if (el('billing-free'))   el('billing-free').style.display   = isFree   ? 'block' : 'none';
  if (el('billing-start'))  el('billing-start').style.display  = isStart  ? 'block' : 'none';
  if (el('billing-pro'))    el('billing-pro').style.display    = isPro    ? 'block' : 'none';
  if (el('billing-master')) el('billing-master').style.display = isMaster ? 'block' : 'none';

  // Preenche subdomínio para Master
  if (isMaster && el('master-subdomain-url')) {
    const slugExibicao = slugSubdom || '...';
    el('master-subdomain-url').textContent = `${slugExibicao}.obrareal.com`;
    if (el('subdomain-slug-input')) {
      el('subdomain-slug-input').value = slugSubdom;
      el('preview-slug').textContent = slugExibicao;
    }
  }

  // Lógica do antigo Kiwify Snippet foi removida pois dependemos de Checkout de Prateleira (transparência/venda humana)
}


/**
 * Abre o checkout da Kiwify para o plano escolhido,
 * passando o tenantId como external_reference para o webhook identificar o cliente.
 */
function startKiwifyCheckout(plano) {
  const sessionUser = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
  const tenantId = sessionUser.tenantId || _currentTenantId || '';
  const link = KIWIFY_LINKS[plano];

  if (!link || link.includes('SEU_LINK')) {
    alert('Link de checkout ainda não configurado. Edite KIWIFY_LINKS em data_core.js.');
    return;
  }

  // Passa o tenantId como referência externa para o webhook
  const url = `${link}${tenantId ? '?external_reference=' + encodeURIComponent(tenantId) : ''}`;
  window.open(url, '_blank');
}

/**
 * Atualiza o subdomínio (slug) do tenant no plano Master.
 * Verifica duplicidade e atualiza nós privado e público.
 */
async function updateSubdomainSlug() {
  const input = document.getElementById('subdomain-slug-input');
  if (!input) return;

  const newSlug = input.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!newSlug || newSlug.length < 3) {
    return alert('O subdomínio deve ter pelo menos 3 caracteres (letras e números).');
  }

  const tenantId = _currentTenantId;
  const sessionUser = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');

  try {
    if (typeof toast === 'function') toast('Verificando disponibilidade...', 'info');

    // 1. Verifica se o slug já está em uso por OUTRO tenant
    const checkSnap = await firebase.database().ref('tenants_public')
      .orderByChild('slug')
      .equalTo(newSlug)
      .once('value');
    
    const existing = checkSnap.val();
    if (existing) {
      const otherId = Object.keys(existing)[0];
      if (otherId !== tenantId) {
        return alert('Este subdomínio já está em uso por outra empresa. Escolha outro nome.');
      }
    }

    // 2. Atualiza o nó principal do tenant
    await firebase.database().ref(`tenants/${tenantId}/subdominioSlug`).set(newSlug);

    // 3. Atualiza o nó público para o Cloudflare Worker / Auth detectar
    await firebase.database().ref(`tenants_public/${tenantId}`).update({
      slug: newSlug,
      nomeEmpresa: DB.config?.nomeEmpresa || 'Obra Real',
      esquemaCores: DB.config?.esquemaCores || 'emerald',
      logoUrl: DB.config?.logoUrl || ''
    });

    if (typeof toast === 'function') toast('Subdomínio atualizado com sucesso!', 'success');
    
    // Atualiza a UI
    if (document.getElementById('master-subdomain-url')) {
      document.getElementById('master-subdomain-url').textContent = `${newSlug}.obrareal.com`;
    }

  } catch (e) {
    console.error('Erro ao atualizar subdomínio:', e);
    alert('Erro ao salvar subdomínio. Verifique sua conexão.');
  }
}

// Expõe para chamada global no renderAdmin
window.renderBillingSection = renderBillingSection;
window.startKiwifyCheckout = startKiwifyCheckout;
window.updateSubdomainSlug = updateSubdomainSlug;

