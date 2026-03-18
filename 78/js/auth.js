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

function doGoogleLogin() {
  hideLoginError();

  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().languageCode = 'pt';

  firebase.auth().signInWithPopup(provider).then((result) => {
    const googleUser = result.user;
    const email = (googleUser.email || '').trim().toLowerCase();

    if (!email) {
      throw new Error('Conta Google sem e-mail retornado.');
    }

    let dbUsuarios = Array.isArray(DB?.usuarios) ? DB.usuarios : [];

    const loginRedirect = (userObj) => {
      const safeUser = normalizeUserRecord(userObj);
      sessionStorage.setItem('gestaoUser', JSON.stringify(safeUser));
      window.location.href = 'index.html';
    };

    const hasGoogleUsers = dbUsuarios.some(u => u && u.email);

    if (!hasGoogleUsers) {
      DB.usuarios = [{
        email,
        name: googleUser.displayName || 'Administrador',
        role: 'admin'
      }];

      Promise.resolve(typeof persistDB === 'function' ? persistDB() : null)
        .then(() => loginRedirect(DB.usuarios[0]))
        .catch(() => showLoginError('Falha ao salvar o primeiro usuário administrador.'));
      return;
    }

    const user = dbUsuarios.find(x => (x.email || '').trim().toLowerCase() === email);
    if (user) {
      loginRedirect(user);
      return;
    }

    firebase.auth().signOut().finally(() => {
      showLoginError(`E-mail não autorizado (${email}). Contate a administração do painel.`);
    });
  }).catch((error) => {
    console.error(error);
    if (error.code !== 'auth/popup-closed-by-user') {
      showLoginError('Falha de comunicação com o Google. Verifique domínio autorizado e configuração do Firebase.');
    }
  });
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
