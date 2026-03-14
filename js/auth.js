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
  if(!email || !pass) { showLoginError('Preencha E-mail e Senha.'); return; }
  
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
  if(!name || !email || !pass) { showLoginError('Preencha Nome, E-mail e Senha.'); return; }
  if(pass.length < 6) { showLoginError('A senha deve ter pelo menos 6 caracteres.'); return; }

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
  if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
    showLoginError('Credenciais inválidas. Tente novamente.');
  } else if (error.code === 'auth/email-already-in-use') {
    showLoginError('Este e-mail já está cadastrado. Alterne para a aba "Entrar" e faça login.');
  } else {
    showLoginError(error.message || 'Falha de comunicação com o servidor de autenticação.');
  }
}

function handleAuthSuccess(firebaseUser, fallbackName) {
  const email = (firebaseUser.email || '').trim().toLowerCase();
  if (!email) { showLoginError('Conta sem e-mail retornado.'); return; }

  let dbUsuarios = Array.isArray(DB?.usuarios) ? DB.usuarios : [];
  const Name = firebaseUser.displayName || fallbackName || 'Sem Nome';

  const loginRedirect = (userObj) => {
    if(userObj.role === 'pendente') {
      firebase.auth().signOut().finally(() => {
        showLoginError(`Sua conta (${email}) foi criada e está AGUARDANDO APROVAÇÃO do administrador.`);
      });
      return;
    }
    const safeUser = normalizeUserRecord(userObj);
    sessionStorage.setItem('gestaoUser', JSON.stringify(safeUser));
    window.location.href = 'index.html';
  };

  const hasUsers = dbUsuarios.some(u => u && u.email);

  if (!hasUsers) {
    DB.usuarios = [{ email, name: Name, role: 'admin' }];
    Promise.resolve(typeof persistDB === 'function' ? persistDB() : null)
      .then(() => loginRedirect(DB.usuarios[0]))
      .catch(() => showLoginError('Falha ao salvar administrador.'));
    return;
  }

  const user = dbUsuarios.find(x => (x.email || '').trim().toLowerCase() === email);
  if (user) {
    loginRedirect(user);
  } else {
    // Inject the new unapproved user
    const newUserObj = { email, name: Name, role: 'pendente' };
    DB.usuarios.push(newUserObj);
    Promise.resolve(typeof persistDB === 'function' ? persistDB() : null)
      .then(() => loginRedirect(newUserObj))
      .catch(() => showLoginError('Falha ao registrar seu usuário na base de aprovação.'));
  }
}

function doLogout() {
  firebase.auth().signOut().finally(() => {
    sessionStorage.removeItem('gestaoUser');
    window.location.href = 'login.html';
  });
}

function checkAuth() {
  const isLoginPage = window.location.pathname.endsWith('login.html') || /\/login(?:\.html)?$/i.test(window.location.pathname);

  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      const userStr = sessionStorage.getItem('gestaoUser');
      if (userStr) {
        const sessionUser = JSON.parse(userStr);
        if (isLoginPage) {
          window.location.href = 'index.html';
        } else {
          applyAccessControl(sessionUser);
        }
        return;
      }

      if (!isLoginPage) {
        window.location.href = 'login.html';
      }
      return;
    }

    sessionStorage.removeItem('gestaoUser');
    if (!isLoginPage) {
      window.location.href = 'login.html';
    }
  });
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
  }

  const role = user.role || 'admin';
  if (role === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
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

  const activePageStr = document.querySelector('.page.active')?.id.replace('page-', '') || 'dashboard';
  if (hidePages.includes(activePageStr)) {
    if (!hidePages.includes('dashboard') && typeof showPage === 'function') showPage('dashboard');
    else if (!hidePages.includes('obras') && typeof showPage === 'function') showPage('obras');
  }
}

window.addEventListener('firebaseSync', (e) => {
  const db = e.detail;
  if (window.location.pathname.endsWith('login.html')) return;

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
