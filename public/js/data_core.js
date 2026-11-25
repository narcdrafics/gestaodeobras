window.APP_WHATSAPP = ["5598", "98526", "2006"].join("");
window.openWhatsApp = function(text) {
  const url = `https://wa.me/${window.APP_WHATSAPP}${text ? '?text=' + encodeURIComponent(text) : ''}`;
  window.open(url, '_blank');
};

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

// apiKey é o identificador Web público do Firebase (não é credencial de admin).
// A proteção real vem das rules do RTDB/Storage, domínios autorizados no Auth e,
// quando habilitado, App Check. Nunca coloque segredos de Admin SDK aqui.
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
// Listener separado: quando o tenant está bloqueado as regras negam a leitura do nó
// inteiro, mas o campo billingState continua legível para exibir a tela de bloqueio.
let billingStateRef = null;
let lastTenantData = null;
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

  // Migração idempotente (carga local, Firebase e persistência passam por aqui).
  // Chamada no fim para não interferir na criação dos arrays acima.
  if (typeof window !== 'undefined' && typeof window.migrateServiceIds === 'function') {
    window.migrateServiceIds(safe);
  }
  return safe;
}

// Limites efetivos do plano. Fonte: campo protegido pelas Firebase Rules.
// O fallback é sempre o plano mais restrito (nunca "ilimitado").
const PLAN_DEFAULTS = { obras: 1, usuarios: 1, trabalhadores: 9999 };

function _getBillingSessionUser() {
  try {
    return JSON.parse(sessionStorage.getItem('gestaoUser') || '{}') || {};
  } catch (e) {
    return {};
  }
}

/**
 * Espelho local (somente UX) de calcularBillingState() no servidor.
 * Nunca substitui as regras do RTDB — apenas antecipa a tela enquanto o job diário não roda.
 */
function calcularEstadoBillingLocal(data, agora = Date.now()) {
  const DIAM = 24 * 60 * 60 * 1000;
  const t = data || {};

  if (t.status === 'bloqueado_pagamento' || t.status === 'bloqueado') return 'bloqueado';

  if (t.plano === 'free_trial') {
    const expiracao = Number(t.trialExpiracao) || 0;
    if (!expiracao) return 'ativo';
    const msApos = agora - expiracao;
    if (msApos <= 0) return 'ativo';
    if (msApos <= 7 * DIAM) return 'somente_leitura';
    return 'bloqueado';
  }

  const vencimento = Number(t.planoVencimento) || 0;
  const carenciaAte = Number(t.carenciaAte) || 0;
  const carenciaValida = carenciaAte > 0 &&
    (carenciaAte > agora || (vencimento > 0 && agora >= vencimento));

  if (!carenciaValida) {
    if (!vencimento || agora < vencimento) return 'ativo';
    if (agora <= vencimento + (5 * DIAM)) return 'carencia';
  } else if (agora <= carenciaAte) {
    return 'carencia';
  }

  const inicioLeitura = carenciaValida ? carenciaAte : vencimento + (5 * DIAM);
  if (agora <= inicioLeitura + (7 * DIAM)) return 'somente_leitura';
  return 'bloqueado';
}

/**
 * Renderiza o estado de cobrança no front-end:
 *  - 'bloqueado': Exibe tela com opções de reativação imediata (sem alert/logout intrusivo).
 *  - 'somente_leitura': Exibe banner informando que novos lançamentos estão travados no servidor.
 *  - 'carencia': Exibe banner de alerta de tolerância para regularização.
 *
 * Este cálculo é apenas experiência de uso: as regras do RTDB são a autoridade.
 */
function renderBillingEnforcement(data) {
  if (!data || typeof data !== 'object') return;

  // Guardado para que a troca de página (showPage) possa reaplicar o estado ao banner.
  window.__lastBillingData = data;

  const sessionUser = _getBillingSessionUser();
  const isSuperAdmin = sessionUser.role === 'super_admin' || sessionUser.email === 'tonycampelo@gmail.com';
  const isMasterTenant = _currentTenantId === 'MASTER_SYSTEM' || CURRENT_TENANT_ID === 'MASTER_SYSTEM';

  if (isSuperAdmin || isMasterTenant) {
    window.IS_READONLY_MODE = false;
    const bs = document.getElementById('screen-blocked');
    if (bs) bs.style.display = 'none';
    const bc = document.getElementById('billing-banner-container');
    if (bc) bc.style.display = 'none';
    return;
  }

  const agora = Date.now();
  let state = data.billingState;

  // Fallback client-side para garantir experiência imediata enquanto o job não roda.
  if (!state) state = calcularEstadoBillingLocal(data, agora);

  const blockedScreen = document.getElementById('screen-blocked');
  const bannerContainer = document.getElementById('billing-banner-container');

  if (state === 'bloqueado') {
    window.IS_READONLY_MODE = true;
    if (blockedScreen) {
      blockedScreen.style.display = 'flex';
      const titleEl = document.getElementById('blocked-title');
      const descEl = document.getElementById('blocked-desc');
      if (data.plano === 'free_trial') {
        if (titleEl) titleEl.textContent = 'Período de Testes Encerrado';
        if (descEl) descEl.textContent = 'Seus 30 dias de teste grátis e a tolerância de leitura terminaram. Todos os seus dados continuam salvos com segurança. Escolha um plano abaixo para reativar seu acesso:';
      } else {
        if (titleEl) titleEl.textContent = 'Assinatura Suspensa';
        if (descEl) descEl.textContent = 'Sua assinatura expirou. Todos os seus dados, fotos e medições continuam preservados no servidor. Escolha um plano abaixo para liberar o sistema na hora:';
      }
    }
    if (bannerContainer) bannerContainer.style.display = 'none';
    return;
  }

  if (blockedScreen) blockedScreen.style.display = 'none';

  if (state === 'somente_leitura') {
    window.IS_READONLY_MODE = true;
    if (bannerContainer) {
      bannerContainer.style.display = 'block';
      bannerContainer.innerHTML = `
        <div class="billing-banner readonly-banner">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-outlined md-20" style="color:#d97706;">visibility</span>
            <div>
              <b>Modo Somente Leitura:</b> Seu plano expirou. Seus dados estão salvos, mas edições e novos lançamentos estão bloqueados no servidor.
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="showPage('admin')" style="white-space:nowrap; margin-left:auto;">
            Reativar Plano
          </button>
        </div>
      `;
    }
  } else if (state === 'carencia') {
    window.IS_READONLY_MODE = false;
    if (bannerContainer) {
      bannerContainer.style.display = 'block';
      bannerContainer.innerHTML = `
        <div class="billing-banner grace-banner">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-outlined md-20" style="color:#f59e0b;">warning</span>
            <div>
              <b>Aviso de Cobrança:</b> A renovação do seu plano está pendente. Você está no período de carência. Regularize para não perder o acesso.
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="showPage('admin')" style="white-space:nowrap; margin-left:auto; background:#f59e0b; border-color:#f59e0b;">
            Regularizar Pagamento
          </button>
        </div>
      `;
    }
  } else {
    window.IS_READONLY_MODE = false;
    if (bannerContainer) bannerContainer.style.display = 'none';
  }
}
window.renderBillingEnforcement = renderBillingEnforcement;

function getPlanLimits() {
  const cfg = (DB && DB.config) || {};
  const numero = (valor, fallback) => {
    const n = Number(valor);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    obras: numero(cfg.limiteObras, PLAN_DEFAULTS.obras),
    usuarios: numero(cfg.limiteUsuarios, PLAN_DEFAULTS.usuarios),
    trabalhadores: numero(cfg.limiteTrabalhadores, PLAN_DEFAULTS.trabalhadores),
  };
}
window.getPlanLimits = getPlanLimits;

/**
 * Capacidades do plano atual. A matriz vive em js/plan_features.js e é espelhada
 * nas Cloud Functions; aqui só adaptamos ao estado carregado em DB.
 */
function currentPlan() {
  return (DB && DB.plano) || 'free_trial';
}
window.currentPlan = currentPlan;

window.hasFeature = function hasFeature(nome) {
  if (!window.OBRA_FEATURES) return false;
  return window.OBRA_FEATURES.hasFeature(nome, currentPlan(), {
    billingState: window.__billingState
  });
};
window.featureInfo = function featureInfo(nome) {
  return window.OBRA_FEATURES ? window.OBRA_FEATURES.descrever(nome) : null;
};
/** Barreira para ações chamadas diretamente (atalhos, console, código legado). */
window.requireFeature = function requireFeature(nome) {
  if (typeof window.hasFeature === 'function' && window.hasFeature(nome)) return true;
  if (typeof window.showUpgradeModal === 'function') window.showUpgradeModal(nome);
  return false;
};

// ==================== SUBDOMAIN & SAAS CONTEXT ====================
function detectSubdomain() {
  const host = String(window.location.hostname || '').toLowerCase();
  const urlParams = new URLSearchParams(window.location.search);
  const tenantParam = urlParams.get('tenant');
  // Em produção o hostname é a autoridade: ?tenant= serve apenas para
  // dev/staging (localhost, web.app, firebaseapp.com).
  const isProducao = host === 'obrareal.com' || host.endsWith('.obrareal.com');
  if (tenantParam && !isProducao) return tenantParam;

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
    // Leitura direta por chave: não expõe a listagem de tenants_public.
    // O slug é a própria chave do nó público.
    const pubSnap = await firebase.database().ref(`tenants_public/${slug}`).once('value');
    const pub = pubSnap.val();
    if (pub) {
      let tenantId = pub.tenantId;
      // Nós públicos legados não tinham tenantId; nesse caso o ID pode ser
      // diferente do slug e precisa ser resolvido antes de validar o login.
      if (!tenantId && firebase.auth().currentUser) {
        try {
          const legado = await firebase.database().ref('tenants')
            .orderByChild('config/slug')
            .equalTo(slug)
            .once('value');
          const encontrados = legado.val();
          if (encontrados) tenantId = Object.keys(encontrados)[0];
        } catch (e) {
          console.warn('Aviso ao resolver tenant legado por slug:', e.code || e.message);
        }
      }
      return { id: tenantId || slug, data: { config: pub } };
    }

    // Fallback: tenant legado cujo ID difere do slug (nó público sob outra chave).
    // Só é possível para usuário autenticado (regras de tenants).
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

  // Remove listeners anteriores se existirem
  if (dbRef) {
    dbRef.off('value');
  }
  if (billingStateRef) {
    billingStateRef.off('value');
    billingStateRef = null;
  }
  lastTenantData = null;
  window.__billingState = null;

  _currentTenantId = tenantId;
  window.OBRA_CHECKOUT_TENANT_ID = tenantId; // checkout compartilhado (js/plans.js)
  dbRef = firebase.database().ref('tenants/' + tenantId);
  dbRef.on('value', _onFirebaseValue, (error) => {
    // Quando bloqueado, o PERMISSION_DENIED é esperado: a tela de bloqueio já explica.
    if (window.__billingState === 'bloqueado') return;
    console.error('Firebase Read Error:', error);
    if (typeof toast === 'function') toast('Erro ao ler a nuvem!', 'error');
  });

  // Status de cobrança é lido isoladamente: as rules permitem mesmo no bloqueio.
  billingStateRef = firebase.database().ref('tenants/' + tenantId + '/billingState');
  billingStateRef.on('value', _onBillingStateValue, (error) => {
    console.warn('[Billing] Não foi possível ler o estado de cobrança:', error && error.code);
  });
}

// Handler do estado de cobrança (funciona mesmo quando a leitura do tenant é negada)
function _onBillingStateValue(snapshot) {
  const state = snapshot.val();
  window.__billingState = state || null;
  const dados = {
    ...(lastTenantData || {}),
    plano: (lastTenantData && lastTenantData.plano) || DB.plano,
    status: (lastTenantData && lastTenantData.status) || DB.status,
    billingState: state || null
  };
  renderBillingEnforcement(dados);
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
    lastTenantData = data;

    // SaaS: Gestão de Ciclo de Vida e Estados de Cobrança (Ativo, Carência, Somente Leitura, Bloqueado)
    renderBillingEnforcement(data);

    if (data.billingState === 'bloqueado' || data.status === 'bloqueado_pagamento') {
      console.warn('[SaaS] Acesso bloqueado por cobrança/expiração.');
      return;
    }

    // Dados comerciais de compras não entram no DB do canteiro (nem no localStorage).
    const _uSess = _getBillingSessionUser();
    const _papelSess = _sessionRole(_uSess);
    // Acesso por obra: usuário designado a obras específicas só recebe os registros delas.
    // lastTenantData continua completo (usado para remontar os arrays na gravação).
    const _obrasPerm = typeof window.getObrasPermitidas === 'function'
      ? window.getObrasPermitidas(data.usuarios, _uSess.email, _papelSess) : null;
    DB = ensureSchema(window.filterDbByObras(sanitizeComprasForRole(data, _papelSess), _obrasPerm));

    // Calculado depois do ensureSchema: gravar em DB antes substituir o objeto perdia o valor.
    if (data.plano === 'free_trial' && data.trialExpiracao) {
      const msLeft = Number(data.trialExpiracao) - Date.now();
      DB.daysLeftTrial = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    }

    // Restaura fotos do localStorage separado (não são salvas na nuvem por serem base64)
    try {
      const fotosRaw = localStorage.getItem('gestaoObraFotos');
      if (fotosRaw) {
        const fotosMap = JSON.parse(fotosRaw);
        if (Array.isArray(DB.trabalhadores)) {
          DB.trabalhadores = DB.trabalhadores.map(t => {
            if (!t.foto && fotosMap[t.cod]) {
              return { ...t, foto: fotosMap[t.cod] };
            }
            return t;
          });
        }
        if (Array.isArray(DB.tarefas)) {
          DB.tarefas = DB.tarefas.map(t => {
            const savedFoto = fotosMap['tf_' + t.cod];
            if (savedFoto) {
              const restauradas = (Array.isArray(savedFoto) ? savedFoto : [savedFoto]).filter(Boolean);
              const atuais = Array.isArray(t.photos) ? t.photos.filter(Boolean) : [];
              const fotos = [...new Set([...atuais, ...(t.photoUrl ? [t.photoUrl] : []), ...restauradas])].filter(Boolean);
              return { ...t, photoUrl: t.photoUrl || fotos[0] || '', photos: fotos };
            }
            return t;
          });
        }
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
        container.innerHTML = `<span class="material-symbols-outlined" id="brand-icon" style="color:var(--accent);font-size:24px;vertical-align:middle;">construction</span> <span class="app-brand-name">${cfg.nomeEmpresa || 'Obra Real'}</span>`;
      }
    }
  }
}

// SaaS: Inicialização de contexto por subdomínio (antes do login)
function comLimite(promise, ms, mensagem) {
  let timer;
  const limite = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(mensagem)), ms);
  });
  return Promise.race([promise, limite]).finally(() => clearTimeout(timer));
}

const subdomainContextPromise = (async function initSubdomainContext() {
  const slug = detectSubdomain();
  if (slug) {
    let tenant = null;
    try {
      // Sem limite o offline do RTDB deixaria o login preso para sempre.
      tenant = await comLimite(loadTenantBySlug(slug), 8000, 'Tempo limite ao identificar a empresa deste endereço.');
    } catch (e) {
      console.error('Falha ao identificar o tenant do subdomínio:', e);
    }
    if (tenant && tenant.data && tenant.data.config) {
      console.log('Contexto de subdomínio detectado:', slug);
      CURRENT_TENANT_ID = tenant.id; // Vincula o ID do tenant detectado
      loadTheme(tenant.data.config);
      return tenant;
    } else {
      console.error(`ALERTA: O subdomínio "${slug}" não corresponde a nenhuma Empresa registrada! O acesso foi interrompido por segurança.`);
      if (document.body) {
        document.body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0f172a;color:#fff;font-family:sans-serif;text-align:center;padding:20px">
          <h1 style="color:#ef4444;margin-bottom:10px"><span class="material-symbols-outlined md-24" style="vertical-align:middle;margin-right:6px;color:#ef4444;">error</span>Empresa Inexistente ou URL Incorreta</h1>
          <p style="color:#cbd5e1;max-width:500px">O subdomínio <b>${slug}</b> não está vinculado a nenhuma empresa no sistema. Por favor, verifique se a URL da sua empresa está correta ou contrate um plano.</p>
          <p style="color:#94a3b8;font-size:12px;margin-top:20px">Obra Real SaaS Security</p>
        </div>`;
      }
      throw new Error('Tenant não encontrado para este subdomínio.');
    }
  }
  return null;
})();

// Exposto para que auth_core.js não dependa de um binding léxico entre scripts.
window.subdomainContextPromise = subdomainContextPromise;

let _persistenceTimer = null;
let _isSaving = false;
let _saveScheduled = false;
let _ignoreNextEcho = false; // Previne reprocessar o eco do nosso próprio salvamento

// Metadados de cobrança/plano que o cliente nunca deve reescrever.
// As Firebase Rules também bloqueiam alterações feitas fora do app (DevTools/SDK).
const PROTECTED_TENANT_FIELDS = new Set([
  'plano', 'planoVencimento', 'trialExpiracao', 'status', 'emailAdmin', 'webhookCriacao',
  // Campos de cobrança pertencem ao servidor (webhook + job diário). Reenviá-los
  // no update do cliente faz o .validate falhar e derruba TODA a gravação.
  'billingState', 'billingStateMotivo', 'billingStateAtualizadoEm',
  'carenciaAte', 'avisoCarencia', 'motivoBloqueio', 'dataBloqueio',
  'cancelamentoAgendado', 'dataCancelamento', 'origemAtivacao', 'ultimoPagamento'
]);
const PROTECTED_CONFIG_FIELDS = new Set([
  'limiteObras', 'limiteUsuarios', 'limiteTrabalhadores',
  // Autorização do webhook de WhatsApp: só o super_admin pode alterar.
  'telefonesPermitidos'
]);

// Nós gerenciados por escrita direta (Cloud Function) ou por trigger de servidor.
// Nunca entram no update em lote do persistDB(), mesmo para o admin.
const SERVER_OR_TARGETED_NODES = new Set([
  'aprovacoes', 'auditoria', 'notificacoes', 'comprasPrivadas'
]);

// Escrita em lote: allow-list explícita por papel (mais segura que block-list —
// nó novo não entra por acidente). O cliente é apenas UX: as Firebase Rules
// repetem estas regras no servidor. `mestre` é alias legado de `encarregado`.
const ROLE_WRITE_ALLOW = {
  encarregado: new Set(['presenca', 'tarefas', 'almocos']),
  engenheiro: new Set(['presenca', 'tarefas', 'almocos', 'obras', 'medicao']),
  comprador: new Set(['compras', 'estoque'])
};
ROLE_WRITE_ALLOW.mestre = ROLE_WRITE_ALLOW.encarregado;

// Dados comerciais das compras: separados em comprasPrivadas no servidor.
// Enquanto a migração não acontece, pelo menos não ficam no DB/localStorage
// dos papéis que não podem vê-los.
const COMPRAS_SENSITIVE_FIELDS = ['forn', 'pixkey', 'vunit', 'vtotal', 'vorc', 'prazo'];
const COMPRAS_RESTRICTED_ROLES = new Set(['encarregado', 'mestre', 'engenheiro']);

function _sessionRole(user) {
  const role = (user && user.role) || 'admin';
  return role === 'mestre' ? 'encarregado' : role;
}

function _nodeBloqueadoParaRole(role, key) {
  if (SERVER_OR_TARGETED_NODES.has(key)) return true;
  if (role === 'admin' || role === 'super_admin') return false;
  const permitidos = ROLE_WRITE_ALLOW[role];
  // Papel desconhecido/pendente não ganha escrita irrestrita.
  return !permitidos || !permitidos.has(key);
}

// Remove campos comerciais das compras para papéis sem acesso. Não altera o DB
// original: devolve uma cópia rasa dos objetos quando há algo a remover.
function sanitizeComprasForRole(db, role) {
  if (!COMPRAS_RESTRICTED_ROLES.has(role) || !Array.isArray(db.compras)) return db;
  return {
    ...db,
    compras: db.compras.map(c => {
      if (!c || typeof c !== 'object') return c;
      const limpa = { ...c };
      COMPRAS_SENSITIVE_FIELDS.forEach(f => { delete limpa[f]; });
      return limpa;
    })
  };
}

function buildCloudUpdate(db, role) {
  // Usa caminhos explícitos para não sobrescrever/apagar campos protegidos.
  const papel = role || _sessionRole(_getBillingSessionUser());
  const update = {};
  Object.entries(db).forEach(([key, value]) => {
    if (PROTECTED_TENANT_FIELDS.has(key)) return;
    if (_nodeBloqueadoParaRole(papel, key)) return;
    if (key === 'config' && value && typeof value === 'object') {
      Object.entries(value).forEach(([cfgKey, cfgValue]) => {
        if (PROTECTED_CONFIG_FIELDS.has(cfgKey)) return;
        update[`config/${cfgKey}`] = cfgValue;
      });
      return;
    }
    update[key] = value;
  });
  return update;
}

/**
 * Persiste o banco de dados de forma segura.
 * @param {boolean} force - Se true, ignora o debounce e tenta salvar imediatamente.
 */
function persistDB(force = false) {
  // Salvaguarda client-side de experiência de uso (as regras do servidor barram no backend)
  const sessionUser = _getBillingSessionUser();
  const isSuperAdmin = sessionUser.role === 'super_admin' || sessionUser.email === 'tonycampelo@gmail.com';
  const papel = _sessionRole(sessionUser);
  if ((window.IS_READONLY_MODE || window.__billingState === 'bloqueado') && !isSuperAdmin) {
    if (typeof toast === 'function') {
      toast('Modo Somente Leitura: Plano vencido. Não é permitido gravar alterações.', 'warning');
    }
    return Promise.resolve();
  }

  // 1. BACKUP LOCAL (Sanitizado — sem base64 para respeitar limite de 5MB do iOS Safari)
  try {
    // Papéis sem acesso comercial não guardam fornecedor/valores/PIX no dispositivo.
    const toCache = JSON.parse(JSON.stringify(sanitizeComprasForRole(DB, papel)));
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
        let rest = m;
        if (m.photoUrl && m.photoUrl.startsWith('data:')) {
          const { photoUrl, ...others } = rest;
          rest = others;
        }
        if (Array.isArray(rest.photos)) {
          rest = { ...rest, photos: rest.photos.filter(u => !String(u).startsWith('data:')) };
        }
        return rest;
      });
    }
    if (Array.isArray(toCache.tarefas)) {
      toCache.tarefas = toCache.tarefas.map(t => {
        // Fotos em base64 não vão para a nuvem; guardamos a lista completa no backup local.
        const b64 = [
          ...(t.photoUrl && String(t.photoUrl).startsWith('data:') ? [t.photoUrl] : []),
          ...((Array.isArray(t.photos) ? t.photos : []).filter(u => String(u).startsWith('data:')))
        ];
        if (b64.length) fotosMap['tf_' + t.cod] = [...new Set(b64)].slice(0, 6);
        else delete fotosMap['tf_' + t.cod];

        let rest = t;
        if (t.photoUrl && String(t.photoUrl).startsWith('data:')) {
          const { photoUrl, ...others } = rest;
          rest = others;
        }
        if (Array.isArray(rest.photos)) {
          rest = { ...rest, photos: rest.photos.filter(u => !String(u).startsWith('data:')) };
        }
        return rest;
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
          let rest = m;
          if (m.photoUrl && m.photoUrl.startsWith('data:')) {
            const { photoUrl, ...others } = rest;
            rest = others;
          }
          if (Array.isArray(rest.photos)) {
            rest = { ...rest, photos: rest.photos.filter(u => !String(u).startsWith('data:')) };
          }
          return rest;
        });
      }
      if (Array.isArray(dbForCloud.tarefas)) {
        dbForCloud.tarefas = dbForCloud.tarefas.map(t => {
          let rest = t;
          if (t.photoUrl && t.photoUrl.startsWith('data:')) {
            const { photoUrl, ...others } = rest;
            rest = others;
          }
          if (Array.isArray(rest.photos)) {
            rest = { ...rest, photos: rest.photos.filter(u => !String(u).startsWith('data:')) };
          }
          return rest;
        });
      }

      // ⚠️ MOBILE FIX: Força reconexão do WebSocket antes de escrever.
      // Em smartphones, o OS mata conexões em background (iOS/Android).
      firebase.database().goOnline();

      // Sinaliza para ignorar o eco do Firebase (sem precisar de .off())
      // Chamar .off() destruía a conexão WebSocket no mobile — nunca mais!
      _ignoreNextEcho = true;

      // Timeout de 20s (mobile pode ser mais lento que desktop)
      // .update() com caminhos explícitos: não apaga nem reescreve metadados
      // de plano/limites (que só o super_admin pode alterar) e não envia nós
      // que o papel não tem permissão de gravar (registro de obra é direto;
      // estoque/trabalhadores/financeiro/compras passam por aprovacoes).
      // Acesso por obra: devolve ao payload os itens de obras fora do escopo do usuário,
      // senão gravar o DB filtrado apagaria esses dados na nuvem.
      const _obrasPermSave = typeof window.getObrasPermitidas === 'function'
        ? window.getObrasPermitidas(dbForCloud.usuarios, sessionUser.email, papel) : null;
      let dbParaNuvem = dbForCloud;
      if (Array.isArray(_obrasPermSave)) {
        dbParaNuvem = window.mergeScopedDb(lastTenantData, dbForCloud, _obrasPermSave);
        if (!dbParaNuvem) {
          _ignoreNextEcho = false;
          if (typeof toast === 'function') toast('Aguarde a sincronização dos dados antes de salvar.', 'warning');
          if (resolve) resolve();
          return;
        }
      }
      const cloudUpdate = buildCloudUpdate(dbParaNuvem, papel);
      await Promise.race([
        targetRef.update(cloudUpdate),
        new Promise((_, rej) => setTimeout(() => rej({ code: 'TIMEOUT', message: 'Conexão lenta ou sem internet.' }), 20000))
      ]);

      console.log('[Persist] Sincronizado com a nuvem com sucesso.');
      if (Array.isArray(_obrasPermSave) && lastTenantData) {
        window.OBRA_SCOPED_KEYS.concat(['obras']).forEach(k => {
          if (dbParaNuvem[k] !== undefined) lastTenantData[k] = dbParaNuvem[k];
        });
      }
      window.dispatchEvent(new CustomEvent('syncStatus', { detail: { status: 'synced' } }));
      if (resolve) resolve();
    } catch (err) {
      _ignoreNextEcho = false; // Reseta a flag em caso de falha
      const errCode = err.code || 'UNKNOWN';
      console.error(`[Persist Error] Code: ${errCode}`, err.message || err);

      window.dispatchEvent(new CustomEvent('syncStatus', {
        detail: { status: 'error', code: errCode }
      }));

      if (errCode === 'PERMISSION_DENIED' && typeof toast === 'function') {
        toast('Alteração bloqueada pelo servidor: limite do plano ou permissão de segurança.', 'error');
      }
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
  if (typeof window.requireFeature === 'function' && !window.requireFeature('exportacao')) return;
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

window.toggleMenu = function() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('open');
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

// Retirado initDB() automático para SaaS. Será chamado em auth.js após login.
// initDB();

// ==================== BILLING / PLANOS ====================
// Catálogo e checkout centralizados em js/plans.js (usado também pela landing).

/**
 * Popula a seção de billing na aba Admin usando DB (já carregado).
 * Chamada dentro de renderAdmin() — síncrona, sem leitura extra do Firebase.
 */
function renderBillingSection() {
  const el = (id) => document.getElementById(id);

  const plano       = DB.plano || 'free_trial';
  const limites     = getPlanLimits();
  const limiteObras = limites.obras;
  const limiteUsers = limites.usuarios;
  const slugSubdom  = DB.subdominioSlug || DB.config?.slug || '';
  const vencimento  = DB.planoVencimento;

  console.log('[Billing] Plano detectado:', plano);

  const planIcon = (name) => `<span class="material-symbols-outlined md-16" style="vertical-align:middle;margin-right:4px;">${name}</span>`;
  const PLANO_LABELS = {
    free_trial: `${planIcon('event_available')}Período de Teste (30 dias)`,
    start:      `${planIcon('rocket_launch')}Start`,
    pro:        `${planIcon('star')}Pro`,
    premium:    `${planIcon('star')}Pro`,
    master:     `${planIcon('language')}Ilimitado / Master`,
    ilimitado:  `${planIcon('language')}Ilimitado`,
    full_anual: `${planIcon('workspace_premium')}Full Anual`
  };

  if (el('plan-name'))   el('plan-name').innerHTML   = PLANO_LABELS[plano] || plano;
  if (el('limit-obras')) el('limit-obras').textContent = limiteObras >= 99  ? 'Ilimitado' : limiteObras;
  if (el('limit-usr'))   el('limit-usr').textContent   = limiteUsers >= 99  ? 'Ilimitado' : limiteUsers;

  if (vencimento && el('subscription-info')) {
    const dtVenc = new Date(vencimento).toLocaleDateString('pt-BR');
    el('subscription-info').innerHTML = `<span style="font-size:11px;color:var(--text3)">Vencimento / Renovação: ${dtVenc}</span>`;
  }

  const isFree   = plano === 'free_trial';
  const isStart  = (plano === 'start' || plano === 'start_anual');
  const isPro    = (plano === 'pro' || plano === 'premium' || plano === 'pro_anual');
  // Subdomínio é Pro+ (Start não tem). O teste grátis também pode configurar.
  const podeSubdominio = typeof window.hasFeature === 'function'
    ? window.hasFeature('subdominio')
    : (plano === 'master' || plano === 'ilimitado' || plano === 'full_anual');

  // Exibe apenas o painel correspondente ao plano de expansão
  if (el('billing-free'))        el('billing-free').style.display        = isFree   ? 'block' : 'none';
  if (el('billing-start'))       el('billing-start').style.display       = isStart  ? 'block' : 'none';
  if (el('billing-pro'))         el('billing-pro').style.display         = isPro    ? 'block' : 'none';
  // O cartão permanece visível para todos: applyFeatureGates() desenha o cadeado
  // e o modal de upgrade quando o plano não tem a feature.
  if (el('billing-subdomain')) el('billing-subdomain').style.display = 'block';

  // Preenche subdomínio com o valor atual (para Pro+ é editável)
  if (el('master-subdomain-url')) {
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
 * Atualiza o subdomínio (slug) do tenant. Requer Pro ou superior.
 * Verifica duplicidade e atualiza nós privado e público.
 */
async function updateSubdomainSlug() {
  if (typeof window.hasFeature === 'function' && !window.hasFeature('subdominio')) {
    if (typeof window.showUpgradeModal === 'function') window.showUpgradeModal('subdominio');
    else alert('Subdomínio personalizado disponível a partir do plano Pro.');
    return;
  }

  const input = document.getElementById('subdomain-slug-input');
  if (!input) return;

  const newSlug = input.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!newSlug || newSlug.length < 3) {
    return alert('O subdomínio deve ter pelo menos 3 caracteres (letras e números).');
  }

  const tenantId = _currentTenantId;

  try {
    if (typeof toast === 'function') toast('Verificando disponibilidade...', 'info');

    // Slug atual do tenant (o nó público é chaveado pelo slug)
    const oldSlug = DB.subdominioSlug || DB.config?.slug || tenantId;

    // 1. Verifica se o slug já está em uso por OUTRO tenant (leitura direta pela chave)
    const checkSnap = await firebase.database().ref(`tenants_public/${newSlug}`).once('value');
    const existing = checkSnap.val();
    const belongsToOther = existing && (existing.tenantId ? existing.tenantId !== tenantId : existing.slug !== oldSlug);
    if (belongsToOther) {
      return alert('Este subdomínio já está em uso por outra empresa. Escolha outro nome.');
    }

    const updates = {};
    updates[`tenants/${tenantId}/subdominioSlug`] = newSlug;
    updates[`tenants/${tenantId}/config/slug`] = newSlug;

    // Move o nó público para a nova chave (sem listar o nó pai)
    if (oldSlug && oldSlug !== newSlug) {
      const oldSnap = await firebase.database().ref(`tenants_public/${oldSlug}`).once('value');
      const oldVal = oldSnap.val();
      // Só remove se o nó realmente pertence a este tenant (evita apagar nó de outro)
      const ownsOld = oldVal && (oldVal.tenantId ? oldVal.tenantId === tenantId : oldSlug === tenantId);
      if (ownsOld) updates[`tenants_public/${oldSlug}`] = null;
    }

    // Limpa a chave legada (ID do tenant) quando ela ainda existe sem tenantId
    if (tenantId && tenantId !== newSlug && tenantId !== oldSlug) {
      const legacySnap = await firebase.database().ref(`tenants_public/${tenantId}`).once('value');
      const legacyVal = legacySnap.val();
      if (legacyVal && !legacyVal.tenantId && legacyVal.slug === oldSlug) updates[`tenants_public/${tenantId}`] = null;
    }

    updates[`tenants_public/${newSlug}`] = {
      slug: newSlug,
      tenantId: tenantId,
      nomeEmpresa: DB.config?.nomeEmpresa || 'Obra Real',
      esquemaCores: DB.config?.esquemaCores || 'emerald',
      logoUrl: DB.config?.logoUrl || ''
    };

    await firebase.database().ref().update(updates);

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
// startKiwifyCheckout é fornecido por js/plans.js (mesmo catálogo da landing).
window.renderBillingSection = renderBillingSection;
window.updateSubdomainSlug = updateSubdomainSlug;

