const staticDB = {
  config: {
    nomeEmpresa: 'Obra Real',
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

// Handler centralizado do listener Firebase — usado tanto no initDB quanto no _religarListener
function _onFirebaseValue(snapshot) {
  const data = snapshot.val();
  if (data) {

    // SaaS: Trava de Inadimplência e Bloqueios
    if (data.status === 'bloqueado_pagamento') {
      alert('⚠️ Sua assinatura SaaS está suspensa por falta de pagamento. O sistema foi bloqueado para proteção dos dados.\n\nPor favor, entre em contato com o Suporte (WhatsApp).');
      if (typeof doLogout === 'function') doLogout();
      return;
    }

    // SaaS: Trava de Tempo do Free Trial (30 dias)
    if (data.plano === 'free_trial' && data.trialExpiracao && Date.now() > data.trialExpiracao) {
      alert('⏰ O seu período de Teste Grátis de 30 dias chegou ao fim!\n\nEsperamos que tenha gostado do sistema. Para continuar usando o Gestão de Obras, assine um de nossos planos.');
      if (typeof doLogout === 'function') doLogout();
      return;
    }

    DB = ensureSchema(data);
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

let _isSaving = false;

function persistDB() {
  if (_isSaving) return Promise.resolve();
  const sessionUser = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');

  // Super Admin com tenant ativo selecionado: salva no tenant escolhido
  if (sessionUser.role === 'super_admin') {
    if (!superAdminActiveTenant) {
      console.warn('Super Admin sem tenant ativo selecionado. Use selectSuperAdminTenant() primeiro.');
      return Promise.resolve();
    }
    _isSaving = true;
    const ref = firebase.database().ref('tenants/' + superAdminActiveTenant.id);
    return ref.set(DB)
      .finally(() => { _isSaving = false; })
      .catch(err => {
        console.error('Falha ao salvar (Super Admin):', err);
        if (typeof toast === 'function') toast('Erro ao sincronizar nuvem!', 'error');
        throw err;
      });
  }

  if (!dbRef) {
    console.warn('Persistencia ignorada: dbRef nao inicializado.');
    return Promise.resolve();
  }

  _isSaving = true;
  DB = ensureSchema(DB);

  // Desliga o listener antes de salvar para evitar que o echo do Firebase
  // sobrescreva o DB local com a versão antiga antes da confirmação
  dbRef.off('value');

  return dbRef.set(DB)
    .then(() => {
      // Religa o listener após confirmação real da escrita
      _religarListener(_currentTenantId);
    })
    .catch(err => {
      // Religa mesmo em caso de erro
      _religarListener(_currentTenantId);
      console.error('Falha ao salvar na nuvem:', err);
      if (typeof toast === 'function') toast('Erro ao sincronizar nuvem!', 'error');
      throw err;
    })
    .finally(() => {
      _isSaving = false;
    });
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

// Links de checkout da Kiwify para cada plano
// Substitua pelos links reais dos seus produtos na Kiwify
const KIWIFY_LINKS = {
  pro: 'https://pay.kiwify.com.br/UeoKVpn',
  master: 'https://pay.kiwify.com.br/d2qkT1E',
};

/**
 * Popula a seção de billing na aba Admin usando DB (já carregado).
 * Chamada dentro de renderAdmin() — síncrona, sem leitura extra do Firebase.
 */
function renderBillingSection() {
  const el = (id) => document.getElementById(id);

  const plano       = DB.plano || 'free_trial';
  const limiteObras = DB.config?.limiteObras ?? 1;
  const limiteTrab  = DB.config?.limiteTrabalhadores ?? 10;
  const slugSubdom  = DB.subdominioSlug || DB.config?.slug || '';
  const vencimento  = DB.planoVencimento;

  console.log('[Billing] Plano detectado:', plano);

  const PLANO_LABELS = {
    free_trial: '🆓 Free Trial (30 dias)',
    pro:        '⭐ Pro',
    premium:    '⭐ Pro',
    master:     '🌐 Master',
  };

  if (el('plan-name'))   el('plan-name').textContent   = PLANO_LABELS[plano] || plano;
  if (el('limit-obras')) el('limit-obras').textContent = limiteObras >= 99  ? 'Ilimitado' : limiteObras;
  if (el('limit-trab'))  el('limit-trab').textContent  = limiteTrab  >= 999 ? 'Ilimitado' : limiteTrab;

  if (vencimento && el('subscription-info')) {
    const dtVenc = new Date(vencimento).toLocaleDateString('pt-BR');
    el('subscription-info').innerHTML = `<span style="font-size:11px;color:var(--text3)">Validade: ${dtVenc}</span>`;
  }

  const isFree   = plano === 'free_trial';
  const isPro    = plano === 'pro' || plano === 'premium';
  const isMaster = plano === 'master';

  // Exibe apenas o painel correspondente ao plano
  if (el('billing-free'))   el('billing-free').style.display   = isFree   ? 'block' : 'none';
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

  // --- NOVO: Configura o Link de Upsell Dinâmico ---
  if (isPro && el('kiwify-upsell-d2qkT1E')) {
    const tenantId = _currentTenantId || '';
    const container = el('kiwify-upsell-d2qkT1E');
    let baseUrl = container.getAttribute('data-upsell-url') || 'https://pay.kiwify.com.br/d2qkT1E';
    
    // Garante que o external_reference esteja na URL principal
    if (!baseUrl.includes('external_reference=')) {
      const urlObj = new URL(baseUrl);
      urlObj.searchParams.set('external_reference', tenantId);
      // Opcional: Adicionar redirect_url para voltar ao app após a compra
      urlObj.searchParams.set('redirect_url', window.location.href);
      
      const finalUrl = urlObj.toString();
      container.setAttribute('data-upsell-url', finalUrl);
      
      // Fallback: Se o script da Kiwify não funcionar como widget, 
      // garante que o botão ao menos abra o link correto
      const btn = el('kiwify-upsell-trigger-d2qkT1E');
      if (btn) {
        btn.onclick = (e) => {
           // Se o script da Kiwify não interceptou (não mudou window.location), forçamos
           setTimeout(() => {
             if (!window.location.href.includes('pay.kiwify')) {
               window.open(finalUrl, '_blank');
             }
           }, 100);
        };
      }
      console.log('[Billing] Upsell URL robusta configurada:', finalUrl);
    }
  }
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
      corPrimaria: DB.config?.corPrimaria || '#f59e0b',
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

