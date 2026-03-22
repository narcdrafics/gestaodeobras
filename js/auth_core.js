function showLoginError(message) {
  const errorEl = document.getElementById('login-error');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function hideLoginError() {
  const errorEl = document.getElementById('login-error');
  if (!errorEl) return;
  errorEl.textContent = '';
  errorEl.style.display = 'none';
}

function normalizeUserRecord(user) {
  return {
    uid: user.uid,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name || user.email,
    role: user.role || 'admin'
  };
}

// ================== GOOGLE LOGIN ==================
function doGoogleLogin() {
  hideLoginError();
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().languageCode = 'pt';

  firebase.auth().signInWithPopup(provider).then((result) => {
    handleAuthSuccess(result.user);
  }).catch(handleAuthError);
}

// ================== EMAIL LOGIN ==================
function doEmailLogin() {
  hideLoginError();
  const email = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  if (!email || !pass) { showLoginError('Preencha E-mail e Senha.'); return; }

  firebase.auth().signInWithEmailAndPassword(email, pass).then((userCredential) => {
    handleAuthSuccess(userCredential.user);
  }).catch(handleAuthError);
}

// ================== EMAIL SIGNUP ==================
function doEmailSignup() {
  hideLoginError();
  const name = document.getElementById('auth-name').value.trim();
  const email = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  if (!name || !email || !pass) { showLoginError('Preencha Nome, E-mail e Senha.'); return; }
  if (pass.length < 6) { showLoginError('A senha deve ter pelo menos 6 caracteres.'); return; }

  firebase.auth().createUserWithEmailAndPassword(email, pass).then((userCredential) => {
    // Optionally set display name if needed using Profile Update
    userCredential.user.updateProfile({ displayName: name }).finally(() => {
      handleAuthSuccess(userCredential.user, name);
    });
  }).catch(handleAuthError);
}

// ================== CENTRAL AUTH HANDLER ==================
function handleAuthError(error) {
  console.error(error);
  if (error.code === 'auth/popup-closed-by-user') return;
  if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' ||
    error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-login-credentials') {
    showLoginError('Credenciais inválidas. Tente novamente.');
  } else if (error.code === 'auth/email-already-in-use') {
    showLoginError('Este e-mail já está cadastrado. Alterne para a aba "Entrar" e faça login.');
  } else {
    showLoginError(error.message || 'Falha de comunicação com o servidor de autenticação.');
  }
}

async function handleAuthSuccess(firebaseUser, fallbackName) {
  const extractedEmail = firebaseUser.email || (firebaseUser.providerData && firebaseUser.providerData[0] && firebaseUser.providerData[0].email);
  const email = (extractedEmail || '').trim().toLowerCase();
  const uid = firebaseUser.uid;
  if (!email) { showLoginError('Google falhou em fornecer seu E-mail. Tente fazer login usando "E-mail e Senha" normais ou troque de conta Google.'); return; }

  try {
    console.log('[AuthTrace] 1. Buscando perfil:', uid);
    const profileRef = firebase.database().ref(`profiles/${uid}`);
    const snapshot = await profileRef.once('value');
    console.log('[AuthTrace] Perfil retornado:', snapshot.val());
    let userProfile = snapshot.val();

    const sanitizedEmail = email.replace(/\./g, ',');
    
    // BUSCA USUÁRIO GLOBAL MASTER (Compradores provindos do Webhook Onboarding)
    console.log('[AuthTrace] 2. Buscando Master User para:', sanitizedEmail);
    const globalSnap = await firebase.database().ref(`users/${sanitizedEmail}`).once('value');
    const globalData = globalSnap.val();

    console.log('[AuthTrace] 3. Buscando convite para:', sanitizedEmail);
    // BUSCA CONVITE PENDENTE (SaaS Operários/Engenheiros)
    const inviteSnap = await firebase.database().ref(`invites/${sanitizedEmail}`).once('value');
    const inviteData = inviteSnap.val();
    console.log('[AuthTrace] Convite retornado:', inviteData);

    const Name = firebaseUser.displayName || fallbackName || 'Sem Nome';

    if (globalData) {
      // Aceita Dono de Obra (Webhook Automação Database)
      userProfile = {
        uid,
        email,
        name: userProfile?.name || globalData.nome || Name,
        role: globalData.role || userProfile?.role || 'admin',
        tenantId: globalData.tenantId
      };
      await profileRef.set(userProfile);
      console.log('[AuthTrace] Novo Perfil Criado via Global DB. Tenant:', userProfile.tenantId);
      
    } else if (inviteData) {
      // Aceita Convite Simples: Vincula à empresa que o convidou
      userProfile = {
        uid,
        email,
        name: userProfile?.name || Name,
        role: inviteData.role || userProfile?.role || 'engenheiro',
        tenantId: inviteData.tenantId
      };
      // Salva o perfil atualizado vinculado ao novo tenantId
      await profileRef.set(userProfile);
      // Remove convite após uso
      await firebase.database().ref(`invites/${sanitizedEmail}`).remove();
      console.log('[AuthTrace] Perfil processado via Convite. Tenant:', userProfile.tenantId);
    } else if (!userProfile) {
      // AUTO-ONBOARDING / FREE TRIAL (Self Serve)
      console.log('[AuthTrace] Usuário novo detectado. Auto-Onboarding iniciado.');
      
      const slugBase = email.split('@')[0].replace(/[^a-z0-9]/g, '');
      const numAuto = Math.floor(Math.random() * 900) + 100;
      const tenantId = slugBase + numAuto; // Cria "joao123" pra garantir unicidade
      
      const dataCriacao = Date.now();
      const trigintaDiasMs = 30 * 24 * 60 * 60 * 1000;
      
      const newTenant = {
          nomeEmpresa: Name !== 'Sem Nome' ? Name + " Engenharia" : "Minha Empresa",
          slug: tenantId,
          emailAdmin: email,
          status: 'ativo',
          plano: 'free_trial', 
          webhookCriacao: dataCriacao,
          trialExpiracao: dataCriacao + trigintaDiasMs, // <--- Validade 30 dias inserida
          corPrimaria: '#3b82f6',
          limiteObras: 1, // Plano gratuito básico
          limiteTrabalhadores: 5
      };
      
      try {
          // Salva Estrutura da Construtora no Banco
          await firebase.database().ref(`tenants/${tenantId}`).set(newTenant);
          await firebase.database().ref(`tenants_public/${tenantId}`).set({
              slug: tenantId,
              nomeEmpresa: newTenant.nomeEmpresa,
              corPrimaria: newTenant.corPrimaria
          });
          
          // Salva no Painel Global Master
          await firebase.database().ref(`users/${sanitizedEmail}`).set({
              tenantId: tenantId,
              role: 'admin',
              nome: Name,
              origem: 'self_signup'
          });

          // Conecta o Usuário Fisicamente à Nova Bolha
          userProfile = {
              uid,
              email,
              name: Name,
              role: 'admin',
              tenantId: tenantId
          };
          await profileRef.set(userProfile);
          console.log('[AuthTrace] Bolha Criada. Tenant Free Trial:', tenantId);
      } catch (err) {
          console.error('[AuthTrace] Erro de BD no Auto-Onboarding:', err);
          await firebase.auth().signOut();
          sessionStorage.removeItem('gestaoUser');
          showLoginError('Erro de segurança ao criar Trial. O Servidor da Google recusou a criação. Deploy do Firebase Rules foi feito?');
          return;
      }
    }

    // 3. Validação Cross-Tenant (Segurança SaaS)
    if (CURRENT_TENANT_ID && userProfile.tenantId !== CURRENT_TENANT_ID && userProfile.role !== 'super_admin') {
      await firebase.auth().signOut();
      sessionStorage.removeItem('gestaoUser');
      showLoginError('Esta conta não tem acesso a esta empresa/subdomínio.');
      return;
    }

    // 4. Login com Sucesso
    if (userProfile.role === 'pendente') {
      await firebase.auth().signOut();
      showLoginError(`Sua conta (${email}) aguarda aprovação do administrador.`);
      return;
    }

    // 5. Inicializa o Banco de Dados do Tenant Específico
    sessionStorage.setItem('gestaoUser', JSON.stringify(userProfile));
    if (typeof initDB === 'function') initDB(userProfile.tenantId);

    window.location.href = 'app.html';

  } catch (error) {
    console.error('Erro SaaS Auth:', error);
    showLoginError('Erro Crítico: ' + (error.message || error) + ' | Tente novamente.');
  }
}

function doLogout() {
  const userStr = sessionStorage.getItem('gestaoUser');
  let redirectUrl = 'login.html';

  if (userStr) {
    const user = JSON.parse(userStr);
    if (user.role === 'super_admin') {
      redirectUrl = 'admin-login.html';
    }
  }

  firebase.auth().signOut().finally(() => {
    sessionStorage.removeItem('gestaoUser');
    window.location.href = redirectUrl;
  });
}

function checkAuth() {
  const isLoginPage = window.location.pathname.endsWith('login.html') || /\/login(?:\.html)?$/i.test(window.location.pathname);
  const isAdminLoginPage = window.location.pathname.endsWith('admin-login.html') || /\/admin-login(?:\.html)?$/i.test(window.location.pathname);

  firebase.auth().onAuthStateChanged(async (user) => {
    // SaaS: Aguarda o contexto de subdomínio ser carregado (se houver) para evitar race conditions
    if (typeof subdomainContextPromise !== 'undefined') {
      await subdomainContextPromise;
    }

    if (user) {
      const userStr = sessionStorage.getItem('gestaoUser');
      if (userStr && userStr !== 'undefined') {
        let sessionUser = JSON.parse(userStr);

        if (CURRENT_TENANT_ID && sessionUser.tenantId !== CURRENT_TENANT_ID && sessionUser.role !== 'super_admin') {
          console.warn('Sessão inválida para este subdomínio. Deslogando...');
          doLogout();
          return;
        }

        if (typeof initDB === 'function' && sessionUser.tenantId) {
          initDB(sessionUser.tenantId);
        }
        if (isLoginPage || isAdminLoginPage) {
          window.location.href = 'app.html';
        } else {
          applyAccessControl(sessionUser);
        }
        return;
      }

      // NO sessionStorage BUT VALID FIREBASE AUTO-SSO TOKEN EXISTS
      // We must reconstruct the session from RTDB:
      try {
        const profileSnap = await firebase.database().ref(`profiles/${user.uid}`).once('value');
        const userProfile = profileSnap.val();
        if (userProfile) {
          if (CURRENT_TENANT_ID && userProfile.tenantId !== CURRENT_TENANT_ID && userProfile.role !== 'super_admin') {
            await firebase.auth().signOut();
            doLogout();
            return;
          }
          sessionStorage.setItem('gestaoUser', JSON.stringify(userProfile));
          if (isLoginPage) {
            window.location.href = 'app.html';
          } else {
            if (typeof initDB === 'function' && userProfile.tenantId) { initDB(userProfile.tenantId); }
            applyAccessControl(userProfile);
          }
          return;
        }
      } catch (e) {
        console.error('Falha ao reidratar a sessão:', e);
      }

      // Se falhar tudo:
      if (!isLoginPage && !isAdminLoginPage) {
        window.location.href = 'login.html';
      }
      return;
    }

    const prevUser = sessionStorage.getItem('gestaoUser');
    sessionStorage.removeItem('gestaoUser');

    if (!isLoginPage && !isAdminLoginPage) {
      let redirectUrl = 'login.html';
      if (prevUser) {
        try {
          const u = JSON.parse(prevUser);
          if (u.role === 'super_admin') redirectUrl = 'admin-login.html';
        } catch (e) { }
      }
      window.location.href = redirectUrl;
    }
  });
}

// SaaS: Variável para impedir múltiplas inicializações
let checkAuthInitialized = false;

function safeCheckAuth() {
  if (checkAuthInitialized) return;
  checkAuthInitialized = true;
  checkAuth();
}

// SaaS: Dispara verificação automática caso esteja no app.html (proteção de rota)
const currPath = window.location.pathname;
const isApp = currPath.endsWith('app.html');
const isIndex = currPath.endsWith('index.html') || /\/$/i.test(currPath);

if (isApp) {
  if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
    safeCheckAuth();
  } else {
    window.addEventListener('load', () => safeCheckAuth());
  }
}

function applyAccessControl(user) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setRestrictions(user), { once: true });
  } else {
    setRestrictions(user);
  }
}

function setRestrictions(user) {
  const headerBrand = document.querySelector('.header-brand');
  const headerDate = document.querySelector('.header-date');

  if (headerBrand && !document.getElementById('btn-logout')) {
    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'btn-logout';
    logoutBtn.className = 'btn btn-secondary btn-sm';
    logoutBtn.style.marginLeft = '12px';
    logoutBtn.innerHTML = '🚪 Sair';
    logoutBtn.onclick = doLogout;
    headerBrand.appendChild(logoutBtn);

    const userNameSpan = document.createElement('span');
    userNameSpan.id = 'active-user-badge';
    userNameSpan.style.fontSize = '12px';
    userNameSpan.style.color = 'var(--text2)';
    userNameSpan.style.marginLeft = '12px';
    userNameSpan.style.fontWeight = '500';
    userNameSpan.innerHTML = `👤 ${user.name} <span style="opacity:0.6;font-size:10px">(${(user.role || 'admin').toUpperCase()})</span>`;

    if (headerDate?.parentNode) {
      headerDate.parentNode.insertBefore(userNameSpan, headerDate);
      userNameSpan.style.marginRight = '16px';
    } else {
      document.querySelector('.header')?.appendChild(userNameSpan);
    }

    // SaaS: Adiciona botão de logout no final se não existir
    if (!document.getElementById('btn-logout')) {
      // Já existe lógica acima, mas garantindo aqui.
    }
  }

  const role = user.role || 'admin';
  if (role === 'admin' || role === 'super_admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  }
  if (role === 'super_admin') {
    document.querySelectorAll('.super-admin-only').forEach(el => el.style.display = '');
    
    // ISOLAR SUPER ADMIN (Oculta abas de empresas: Obras, Dashboard, Financeiro, etc.)
    document.querySelectorAll('.nav-item').forEach(el => {
      if (!el.classList.contains('super-admin-only') && !el.getAttribute('onclick')?.includes('doLogout')) {
        el.style.display = 'none';
      }
    });
    document.querySelectorAll('.nav-section').forEach(el => {
      if (!el.classList.contains('super-admin-only') && el.innerText !== 'Acesso') {
        el.style.display = 'none';
      }
    });
  }

  let hidePages = [];
  if (role === 'mestre') {
    hidePages = ['obras', 'estoque', 'compras', 'financeiro', 'orcamento'];
    const impBtn = document.getElementById('import-file');
    if (impBtn?.parentElement) impBtn.parentElement.style.display = 'none';
  } else if (role === 'engenheiro') {
    hidePages = ['trabalhadores', 'presenca', 'financeiro', 'orcamento'];
  }

  hidePages.forEach(p => {
    const nav = document.querySelector(`.nav-item[onclick="showPage('${p}')"]`);
    if (nav) nav.style.display = 'none';
  });

  // SaaS: Carrega página inicial automaticamente após aplicar restrições
  const mainEl = document.getElementById("conteudo-principal");
  // Verifica se não há uma página ativa injetada
  const hasPage = mainEl.querySelector('.page');

  if (mainEl && !hasPage && typeof showPage === 'function') {
    const userStr = sessionStorage.getItem('gestaoUser');
    const activeUser = userStr ? JSON.parse(userStr) : {};

    if (activeUser.role === 'super_admin') {
      showPage('super_admin');
    } else {
      showPage('dashboard');
    }
  }
}

window.addEventListener('firebaseSync', (e) => {
  const db = e.detail;
  const cp = window.location.pathname;
  if (cp.endsWith('login.html') || cp.endsWith('admin-login.html')) return;

  const userStr = sessionStorage.getItem('gestaoUser');
  if (!userStr || !db || !Array.isArray(db.usuarios)) return;

  const activeUser = JSON.parse(userStr);
  const stillExists = db.usuarios.find(u => (u.email || '').trim().toLowerCase() === (activeUser.email || '').trim().toLowerCase());

  if (!stillExists) {
    const dbHasGoogleUsers = db.usuarios.some(u => u && u.email);
    if (!dbHasGoogleUsers) {
      db.usuarios = [activeUser];
      if (typeof DB !== 'undefined') DB.usuarios = db.usuarios;
      if (typeof persistDB === 'function') persistDB();
    } else {
      doLogout();
    }
    return;
  }

  if ((stillExists.role || 'admin') !== (activeUser.role || 'admin')) {
    doLogout();
    return;
  }

  if (stillExists.name !== activeUser.name) {
    sessionStorage.setItem('gestaoUser', JSON.stringify(normalizeUserRecord(stillExists)));
  }
});

// SaaS: Removido disparo automático daqui. Será chamado no final do app.js
// para garantir que showPage e renderPage já existam.
// checkAuth();
