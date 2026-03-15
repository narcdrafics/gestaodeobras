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

// CONFIGURAÇÃO SAAS MASTER
const MASTER_EMAIL = 'casaint65@gmail.com'; // Altere para seu e-mail de administrador mestre

async function handleAuthSuccess(firebaseUser, fallbackName) {
  const email = (firebaseUser.email || '').trim().toLowerCase();
  const uid = firebaseUser.uid;
  if (!email) { showLoginError('Conta sem e-mail retornado.'); return; }

  try {
    // 1. Busca o Perfil Global do Usuário
    const profileRef = firebase.database().ref(`profiles/${uid}`);
    const snapshot = await profileRef.once('value');
    let userProfile = snapshot.val();

    // 1.5 - DETECÇÃO DE SUPER ADMIN (PLATAFORMA)
    if (email === MASTER_EMAIL) {
      userProfile = {
        uid,
        email,
        name: firebaseUser.displayName || 'Super Admin',
        role: 'super_admin',
        tenantId: 'MASTER_SYSTEM' // ID especial para o sistema
      };
      await profileRef.set(userProfile);
    }

    // 2. Se o perfil não existe, é um novo Cadastro SaaS
    if (!userProfile) {
      const Name = firebaseUser.displayName || fallbackName || 'Sem Nome';
      const sanitizedEmail = email.replace(/\./g, ',');

      // BUSCA CONVITE PENDENTE (SaaS)
      const inviteSnap = await firebase.database().ref(`invites/${sanitizedEmail}`).once('value');
      const inviteData = inviteSnap.val();

      if (inviteData) {
        // Aceita Convite: Vincula à empresa que o convidou
        userProfile = {
          uid,
          email,
          name: Name,
          role: inviteData.role || 'engenheiro',
          tenantId: inviteData.tenantId
        };
        // Remove convite após uso
        await firebase.database().ref(`invites/${sanitizedEmail}`).remove();
      } else {
        // Fluxo Dono de Empresa: Cria novo Tenant
        const tenantId = uid;
        userProfile = {
          uid,
          email,
          name: Name,
          role: 'admin',
          tenantId: tenantId
        };

        // Inicializa o Tenant vazio (ou com config básica) se for novo
        const tenantRef = firebase.database().ref(`tenants/${tenantId}`);
        const tenantSnap = await tenantRef.once('value');
        await tenantRef.set({
          config: {
            nomeEmpresa: 'Minha Empresa',
            corPrimaria: '#f59e0b',
            limiteObras: 2,
            limiteTrabalhadores: 10
          },
          usuarios: [{ email, name: Name, role: 'admin' }]
        });
      }
      // Salva o perfil global vinculado ao tenantId
      await profileRef.set(userProfile);
    }

    // 3. Login com Sucesso
    if (userProfile.role === 'pendente') {
      await firebase.auth().signOut();
      showLoginError(`Sua conta (${email}) aguarda aprovação do administrador.`);
      return;
    }

    // 4. Inicializa o Banco de Dados do Tenant Específico
    sessionStorage.setItem('gestaoUser', JSON.stringify(userProfile));
    if (typeof initDB === 'function') initDB(userProfile.tenantId);

    window.location.href = 'index.html';

  } catch (error) {
    console.error('Erro SaaS Auth:', error);
    showLoginError('Erro ao processar perfil multi-empresa.');
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

  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      const userStr = sessionStorage.getItem('gestaoUser');
      if (userStr) {
        let sessionUser = JSON.parse(userStr);

        // REFORÇO SAAS MASTER: Garante papel mestre mesmo em sessões antigas
        if (sessionUser.email?.toLowerCase() === MASTER_EMAIL.toLowerCase() && sessionUser.role !== 'super_admin') {
          sessionUser.role = 'super_admin';
          sessionUser.tenantId = 'MASTER_SYSTEM';
          sessionStorage.setItem('gestaoUser', JSON.stringify(sessionUser));
        }

        // Garante que o DB seja inicializado após refresh
        if (typeof initDB === 'function' && sessionUser.tenantId) {
          initDB(sessionUser.tenantId);
        }
        if (isLoginPage || isAdminLoginPage) {
          window.location.href = 'index.html';
        } else {
          applyAccessControl(sessionUser);
        }
        return;
      }

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

// SaaS: Dispara verificação automática caso não esteja na index (onde o app.js assume)
const currPath = window.location.pathname;
const isIndex = currPath.endsWith('index.html') || /\/$/i.test(currPath) || currPath.endsWith('gestaodeobras/');

if (!isIndex) {
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
