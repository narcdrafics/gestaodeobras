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

// O tenant da URL é carregado de forma assíncrona em data_core.js. Sem esperar,
// a validação cross-tenant rodava com CURRENT_TENANT_ID ainda nulo e deixava
// entrar o perfil de outra empresa. Em caso de falha, encerra a sessão.
async function aguardarContextoTenant() {
  const promessa = window.subdomainContextPromise || (typeof subdomainContextPromise !== 'undefined' ? subdomainContextPromise : null);
  if (!promessa) return;
  try {
    await promessa;
  } catch (err) {
    await firebase.auth().signOut().catch(() => { });
    sessionStorage.removeItem('gestaoUser');
    throw err;
  }
}

// Encerra a sessão quando o Super Admin bloqueou a conta (perfil 'bloqueado'
// ou passaporte global marcado). Usado no login e em sessões já abertas.
async function encerrarSessaoBloqueada(mensagem) {
  await firebase.auth().signOut().catch(() => { });
  sessionStorage.removeItem('gestaoUser');
  if (typeof showLoginError === 'function') showLoginError(mensagem);
  else console.warn('[Auth] Sessão bloqueada:', mensagem);
}
window.encerrarSessaoBloqueada = encerrarSessaoBloqueada;

// ================== RECUPERAÇÃO DE SENHA (LOGIN) ==================
function abrirRecuperacaoSenha() {
  hideLoginError();
  const form = document.getElementById('login-form');
  const panel = document.getElementById('recovery-panel');
  if (!form || !panel) return;

  const emailAtual = document.getElementById('auth-email');
  const input = document.getElementById('recovery-email');
  if (input && emailAtual) input.value = emailAtual.value.trim();

  const msg = document.getElementById('recovery-msg');
  if (msg) {
    msg.textContent = '';
    msg.className = 'auth-msg';
    msg.style.display = 'none';
  }

  form.style.display = 'none';
  panel.style.display = 'block';

  const extras = document.getElementById('login-extras');
  if (extras) extras.style.display = 'none';
  const subtitle = document.getElementById('form-subtitle');
  if (subtitle) subtitle.textContent = 'Redefina o acesso à sua conta.';
  if (input) input.focus();
}

function fecharRecuperacaoSenha() {
  const form = document.getElementById('login-form');
  const panel = document.getElementById('recovery-panel');
  if (panel) panel.style.display = 'none';
  if (form) form.style.display = '';
  const extras = document.getElementById('login-extras');
  if (extras) extras.style.display = '';
  const subtitle = document.getElementById('form-subtitle');
  if (subtitle && typeof currentMode !== 'undefined') {
    subtitle.textContent = currentMode === 'signup'
      ? 'Crie sua conta e comece a gerenciar suas obras.'
      : 'Bem-vindo de volta! Faça login para continuar.';
  }
}

function mostrarMensagemRecuperacao(texto, tipo) {
  const msg = document.getElementById('recovery-msg');
  if (!msg) return;
  msg.textContent = texto;
  msg.className = 'auth-msg' + (tipo ? ' ' + tipo : '');
  msg.style.display = 'block';
}

async function enviarLinkRecuperacao() {
  const input = document.getElementById('recovery-email');
  const email = ((input && input.value) || '').trim();
  if (!email) {
    mostrarMensagemRecuperacao('Informe seu e-mail para continuar.', 'error');
    return;
  }

  const btn = document.getElementById('btn-recovery');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  try {
    await firebase.auth().sendPasswordResetEmail(email);
    // Mensagem genérica de propósito: não revela se o e-mail está cadastrado.
    mostrarMensagemRecuperacao(
      'Se o e-mail estiver cadastrado, você receberá em instantes um link para definir uma nova senha.',
      'success'
    );
  } catch (error) {
    console.error('[Auth] Falha ao enviar link de recuperação:', error);
    if (error && error.code === 'auth/invalid-email') {
      mostrarMensagemRecuperacao('E-mail inválido. Confira o endereço digitado.', 'error');
    } else {
      mostrarMensagemRecuperacao('Não foi possível enviar o link agora. Tente novamente em alguns instantes.', 'error');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar link de recuperação'; }
  }
}

// Papel canônico do canteiro. `mestre` fica apenas como alias legado por um
// release, para não quebrar sessões/claims antigos; registros novos usam
// sempre `encarregado`.
const ROLE_ENCARREGADO = 'encarregado';
const ROLE_MESTRE_LEGADO = 'mestre';

function normalizeRole(role) {
  return role === ROLE_MESTRE_LEGADO ? ROLE_ENCARREGADO : (role || 'admin');
}
window.normalizeRole = normalizeRole;

/** Campos exclusivos do RH que precisam acompanhar a sessão. */
function camposRhSessao(dados, role) {
  if (role !== 'rh') return {};
  return {
    modulosPermitidos: (dados && dados.modulosPermitidos) || null,
    acessoObras: (dados && dados.acessoObras) || 'todas',
    obrasPermitidas: (dados && dados.obrasPermitidas) || []
  };
}
window.camposRhSessao = camposRhSessao;

function normalizeUserRecord(user) {
  const registro = {
    uid: user.uid,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name || user.email,
    role: normalizeRole(user.role)
  };
  // RH carrega as permissões definidas pelo admin na própria sessão.
  return { ...registro, ...camposRhSessao(user, registro.role) };
}

// ================== GOOGLE LOGIN ==================
function doGoogleLogin() {
  hideLoginError();
  // No painel Master o Google também precisa da verificação final de super_admin.
  if (typeof isAdminLoginPage !== 'undefined' && isAdminLoginPage) window._adminLoginGuard = true;
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().languageCode = 'pt';

  firebase.auth().signInWithPopup(provider).then((result) => {
    handleAuthSuccess(result.user);
  }).catch((err) => {
    window._adminLoginGuard = false;
    handleAuthError(err);
  });
}

// ================== EMAIL LOGIN ==================
function doEmailLogin() {
  hideLoginError();
  const email = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  if (!email || !pass) { showLoginError('Preencha E-mail e Senha.'); return; }

  firebase.auth().signInWithEmailAndPassword(email, pass).then((userCredential) => {
    handleAuthSuccess(userCredential.user);
  }).catch((err) => {
    window._adminLoginGuard = false;
    handleAuthError(err);
  });
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
// O SDK 8 antigo devolve `auth/internal-error` com o JSON cru do Identity Toolkit
// quando o backend responde INVALID_LOGIN_CREDENTIALS. Não mostrar esse payload
// ao usuário (vaza detalhe do backend e parece "servidor quebrado").
function isInvalidCredentialsError(error) {
  const code = String((error && error.code) || '');
  if (['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential',
    'auth/invalid-login-credentials'].includes(code)) return true;
  if (code !== 'auth/internal-error') return false;
  const detalhes = [
    error && error.message,
    error && error.customData && error.customData.message,
    error && error._baseMessage
  ].filter(Boolean).join(' ');
  return /INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND/i.test(detalhes);
}

function handleAuthError(error) {
  console.error(error);
  if (error.code === 'auth/popup-closed-by-user') return;
  if (isInvalidCredentialsError(error)) {
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
    // Aguarda a identificação do tenant antes de validar o acesso.
    try {
      await aguardarContextoTenant();
    } catch (err) {
      console.warn('[Auth] Contexto do tenant indisponível no login:', err);
      showLoginError('Não foi possível identificar a empresa deste endereço. Confira a URL e tente novamente.');
      return;
    }

    console.log('[AuthTrace] 1. Buscando perfil:', uid);
    const profileRef = firebase.database().ref(`profiles/${uid}`);
    const snapshot = await profileRef.once('value');
    console.log('[AuthTrace] Perfil retornado:', snapshot.val());
    let userProfile = snapshot.val();
    let newTenantSlug = null; // preenchido quando este login acabou de criar uma empresa

    const sanitizedEmail = email.replace(/\./g, ',');
    
    // BUSCA USUÁRIO GLOBAL MASTER (Compradores provindos do Webhook Onboarding)
    console.log('[AuthTrace] 2. Buscando Master User para:', sanitizedEmail);
    let globalData = null;
    try {
      const globalSnap = await firebase.database().ref(`users/${sanitizedEmail}`).once('value');
      globalData = globalSnap.val();
    } catch (eGlobal) {
      console.warn('[AuthTrace] Aviso ao buscar nó users (prosseguindo com perfil local):', eGlobal);
    }

    console.log('[AuthTrace] 3. Buscando convite para:', sanitizedEmail);
    // BUSCA CONVITE PENDENTE (SaaS Operários/Engenheiros)
    let inviteData = null;
    try {
      const inviteSnap = await firebase.database().ref(`invites/${sanitizedEmail}`).once('value');
      inviteData = inviteSnap.val();
      console.log('[AuthTrace] Convite retornado:', inviteData);
    } catch (eInvite) {
      console.warn('[AuthTrace] Aviso ao buscar nó invites:', eInvite);
    }

    const Name = firebaseUser.displayName || fallbackName || 'Sem Nome';

    if (globalData) {
      // PERFIL RESTAURADO: Se o usuário existe no Master DB, garantimos que o perfil exista (Self-Healing)
      const isSuper = globalData.role === 'super_admin';
      userProfile = {
        uid,
        email,
        name: userProfile?.name || globalData.nome || Name,
        // Para novos perfis criados pelo cliente, usamos 'admin' para respeitar a regra do banco (que proíbe cliente de auto-conceder super_admin).
        // A Cloud Function syncCustomClaims promove imediatamente para 'super_admin' e concede as Custom Claims.
        role: (snapshot.exists() && isSuper) ? 'super_admin' : (isSuper ? 'admin' : (globalData.role || 'admin')),
        tenantId: isSuper ? 'MASTER_SYSTEM' : (globalData.tenantId || userProfile?.tenantId),
        ...camposRhSessao({ ...globalData, ...(snapshot.val() || {}) },
          normalizeRole(globalData.role || userProfile?.role))
      };
      if (!snapshot.exists()) {
        await profileRef.set({ ...userProfile, status: 'ativo' });
      } else {
        // Apenas campos pessoais: cargo/tenant/status são gravados pelo servidor.
        // O syncCustomClaims promove perfis autorizados via super_admins/<uid>.
        await profileRef.update({ name: userProfile.name })
          .catch((err) => console.warn('Aviso ao atualizar perfil:', err));
      }
      console.log('[AuthTrace] Perfil restaurado via Master DB. Tenant:', userProfile.tenantId);
      
    } else if (inviteData) {
      // Aceita Convite Simples: Vincula à empresa que o convidou
      userProfile = {
        uid,
        email,
        // O nome vem do convite quando a conta já existia no Auth (mantemos a
        // senha atual, então o displayName antigo não pode sobrescrevê-lo).
        name: userProfile?.name || inviteData.name || Name,
        role: inviteData.role || userProfile?.role || 'engenheiro',
        tenantId: inviteData.tenantId,
        ...camposRhSessao(inviteData, normalizeRole(inviteData.role || userProfile?.role))
      };
      // Update não-destrutivo: role/status só vêm do servidor. Na criação do
      // perfil o cargo do convite é aceito; depois, alterações passam pela API.
      await profileRef.update(snapshot.exists() ? { name: userProfile.name } : { ...userProfile, status: 'ativo' });
      // Remove convite após uso
      await firebase.database().ref(`invites/${sanitizedEmail}`).remove();
      console.log('[AuthTrace] Perfil processado via Convite. Tenant:', userProfile.tenantId);
    } else if (!userProfile && !window._adminLoginGuard && (typeof window.isSignupProcess !== 'undefined' || isLoginPage)) {
      // AUTO-ONBOARDING / FREE TRIAL (Self Serve): o próprio usuário escolhe o slug da empresa.
      // A criação (tenant + nó público + passaporte global) é uma única escrita atômica feita por
      // ObraSlug.createTenantAccount; é ela que faz a empresa aparecer no painel do Master.
      if (CURRENT_TENANT_ID) {
        // Já estamos no endereço de uma empresa: não cria outra empresa a partir daqui.
        await firebase.auth().signOut();
        sessionStorage.removeItem('gestaoUser');
        showLoginError('Esta conta não pertence a esta empresa. Para criar a sua própria empresa, acesse obrareal.com.');
        return;
      }
      if (typeof window.promptSlugOnboarding !== 'function' || !window.ObraSlug) {
        await firebase.auth().signOut();
        sessionStorage.removeItem('gestaoUser');
        showLoginError('Não foi possível iniciar o cadastro da empresa. Recarregue a página e tente de novo.');
        return;
      }

      console.log('[AuthTrace] Novo usuário detectado no fluxo de cadastro. Solicitando o slug da empresa.');
      const onboarding = await window.promptSlugOnboarding({ uid, email, name: Name });
      if (!onboarding) {
        // Usuário cancelou a escolha do slug: encerra a sessão, nada foi criado.
        await firebase.auth().signOut();
        sessionStorage.removeItem('gestaoUser');
        return;
      }

      // Conecta o usuário à empresa recém-criada
      userProfile = {
        uid,
        email,
        name: Name,
        role: 'admin',
        tenantId: onboarding.slug
      };
      try {
        await profileRef.set({ ...userProfile, status: 'ativo' });
      } catch (err) {
        // A empresa já existe e o passaporte global (users/<email>) também: no próximo login
        // o ramo "perfil restaurado" refaz o perfil sozinho.
        console.error('[AuthTrace] Empresa criada, mas o perfil não foi gravado:', err);
        await firebase.auth().signOut();
        sessionStorage.removeItem('gestaoUser');
        showLoginError('Sua empresa foi criada, mas não foi possível concluir o acesso. Entre novamente para finalizar.');
        return;
      }
      newTenantSlug = onboarding.slug;
      console.log('[AuthTrace] Empresa criada. Slug:', newTenantSlug);
    }

    // Força uma atualização no perfil para disparar a Cloud Function 'syncCustomClaims'
    // Isso garante que usuários antigos recebam suas Custom Claims corretamente.
    // Importante: apenas `lastLogin` é escrito. Reescrever role/tenantId aqui desfaria
    // a trava de assentos aplicada pelo servidor (perfil 'pendente').
    if (userProfile && uid) {
      userProfile.lastLogin = Date.now();
      await profileRef.update({ lastLogin: userProfile.lastLogin }).catch(e => console.warn('Falha no touch do perfil:', e));
    }

    // 2.5 Bloqueio de assento: perfil criado além do limite do plano
    const perfilAtual = (await profileRef.once('value')).val() || {};
    if (perfilAtual.status === 'pendente') {
      await firebase.auth().signOut();
      sessionStorage.removeItem('gestaoUser');
      showLoginError('Limite de usuários do plano atingido. Peça ao administrador da empresa para liberar uma vaga ou fazer upgrade.');
      return;
    }

    // 2.6 Bloqueio determinado pelo Super Admin (também vale para o passaporte
    // global quando a conta ainda não tem UID no Auth).
    if (globalData && globalData.bloqueado) {
      await encerrarSessaoBloqueada('Esta conta foi bloqueada pelo administrador da plataforma.');
      return;
    }
    if (perfilAtual.status === 'bloqueado') {
      await encerrarSessaoBloqueada('Esta conta foi bloqueada pelo administrador da plataforma.');
      return;
    }

    // Conta autenticada sem perfil/convite/passaporte não tem acesso cadastrado.
    // Sem este guard o código abaixo lançava TypeError e deixava a sessão aberta.
    if (!userProfile) {
      window._adminLoginGuard = false;
      await firebase.auth().signOut();
      sessionStorage.removeItem('gestaoUser');
      showLoginError(window.location.pathname.includes('admin-login')
        ? 'Este e-mail não possui autorização de Super Admin. Solicite acesso ao proprietário do sistema.'
        : 'Esta conta não possui acesso cadastrado. Solicite um convite ao administrador da empresa.');
      return;
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

    // 4.1 Empresa recém-criada em produção: o slug passa a ser o endereço (slug.obrareal.com).
    // Subdomínio é outra origem e a sessão do Firebase não acompanha, então o acesso continua
    // lá, no login do novo endereço, com o e-mail já preenchido.
    if (newTenantSlug && window.ObraSlug.isCrossOrigin(newTenantSlug, window.location)) {
      await firebase.auth().signOut();
      sessionStorage.removeItem('gestaoUser');
      window.location.href = window.ObraSlug.buildWelcomeUrl(newTenantSlug, email, window.location);
      return;
    }

    // 5. Inicializa o Banco de Dados do Tenant Específico
    sessionStorage.setItem('gestaoUser', JSON.stringify(userProfile));
    if (typeof initDB === 'function') initDB(userProfile.tenantId);

    // 6. Garante que as Custom Claims foram propagadas pelo backend antes de liberar o app (Evita Permission Denied no Storage)
    console.log('[AuthTrace] Aguardando propagação das Custom Claims...');
    let claimsProntas = false;
    for (let i = 0; i < 6; i++) {
      const tokenResult = await firebase.auth().currentUser.getIdTokenResult(true);
      if (tokenResult.claims && (tokenResult.claims.tenantId === userProfile.tenantId || tokenResult.claims.role === 'super_admin')) {
        claimsProntas = true;
        if (tokenResult.claims.role === 'super_admin') {
          userProfile.role = 'super_admin';
          userProfile.tenantId = 'MASTER_SYSTEM';
          sessionStorage.setItem('gestaoUser', JSON.stringify(userProfile));
        }
        console.log('[AuthTrace] Custom Claims confirmadas!');
        break;
      }
      console.log(`[AuthTrace] Aguardando claims... tentativa ${i + 1}/6`);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    if (!claimsProntas) {
      console.warn('[AuthTrace] Timeout aguardando claims. A primeira escrita no Storage pode falhar.');
    }

    // O "Primeiro Acesso" do painel Master não pode consultar users/<email>
    // sem autenticação. A decisão final é pelas claims já sincronizadas.
    if (window._adminLoginGuard) {
      window._adminLoginGuard = false;
      if (userProfile.role !== 'super_admin') {
        await firebase.auth().signOut();
        sessionStorage.removeItem('gestaoUser');
        const msg = 'Este e-mail não possui autorização de Super Admin. Solicite acesso ao proprietário do sistema.';
        if (typeof showLoginError === 'function') showLoginError(msg);
        else console.warn(msg);
        return;
      }
    }

    window.location.href = newTenantSlug
      ? window.ObraSlug.buildTenantUrl(newTenantSlug, window.location, 'app.html')
      : 'app.html';

  } catch (error) {
    window._adminLoginGuard = false;
    console.error('Erro SaaS Auth:', error);
    showLoginError('Erro Crítico: ' + (error.message || error) + ' | Tente novamente.');
  }
}

function doLogout() {
  console.log('[Auth] doLogout disparado. Verificando estado da sessão...');
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

let _isAuthListenerActive = false;
let _profileStatusWatchUid = null;
let _profileStatusRef = null;

// Observa o status do perfil enquanto a sessão está aberta: um bloqueio feito
// pelo Super Admin derruba a sessão imediatamente, sem depender de recarregar.
function observarStatusPerfil(user) {
  if (_profileStatusRef && (!user || _profileStatusWatchUid !== user.uid)) {
    _profileStatusRef.off('value');
    _profileStatusRef = null;
    _profileStatusWatchUid = null;
  }
  if (!user || _profileStatusWatchUid === user.uid) return;

  _profileStatusWatchUid = user.uid;
  _profileStatusRef = firebase.database().ref(`profiles/${user.uid}/status`);
  _profileStatusRef.on('value', (snap) => {
    if (snap.val() !== 'bloqueado') return;
    firebase.auth().signOut().catch(() => { });
    sessionStorage.removeItem('gestaoUser');
    if (!isLoginPage && !isAdminLoginPage) {
      alert('Sua conta foi bloqueada pelo administrador da plataforma.');
      window.location.href = 'login.html';
    }
  }, (err) => console.warn('[Auth] Não foi possível observar status do perfil:', err));
}

function checkAuth() {
  if (_isAuthListenerActive) return;
  _isAuthListenerActive = true;
  console.log('[Auth] Inicializando listener único.');

  firebase.auth().onAuthStateChanged(async (user) => {
    // SaaS: Aguarda o contexto de subdomínio ser carregado (se houver) para evitar race conditions
    try {
      await aguardarContextoTenant();
    } catch (err) {
      console.warn('[Auth] Sessão encerrada: contexto do tenant indisponível.', err);
      return;
    }

    observarStatusPerfil(user);

    if (user) {
      const userStr = sessionStorage.getItem('gestaoUser');
      if (userStr && userStr !== 'undefined') {
        let sessionUser = JSON.parse(userStr);

        if (sessionUser.status === 'bloqueado') {
          await encerrarSessaoBloqueada('Esta conta foi bloqueada pelo administrador da plataforma.');
          return;
        }

        if (CURRENT_TENANT_ID && sessionUser.tenantId !== CURRENT_TENANT_ID && sessionUser.role !== 'super_admin') {
          const msg = `[Auth] Sessão inválida. Empresa da Sessão (${sessionUser.tenantId}) diferente da Empresa da URL (${CURRENT_TENANT_ID}).`;
          alert(msg);
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
          if (userProfile.status === 'bloqueado') {
            await encerrarSessaoBloqueada('Esta conta foi bloqueada pelo administrador da plataforma.');
            return;
          }
          if (CURRENT_TENANT_ID && userProfile.tenantId !== CURRENT_TENANT_ID && userProfile.role !== 'super_admin') {
            alert(`[Auth] Reidratação falhou: Empresa incompatível.\nPerfil: ${userProfile.tenantId}\nDetectado URL: ${CURRENT_TENANT_ID}`);
            await firebase.auth().signOut();
            doLogout();
            return;
          }
          sessionStorage.setItem('gestaoUser', JSON.stringify(userProfile));
          if (isLoginPage || isAdminLoginPage) {
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
        alert('[Auth] Falha crítica na reidratação da sessão. O sistema não encontrou seu perfil ou tenant vinculado.');
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
const isLoginPage = currPath.endsWith('login.html') || /\/login(?:\.html)?$/i.test(currPath);
const isAdminLoginPage = currPath.endsWith('admin-login.html') || /\/admin-login(?:\.html)?$/i.test(currPath);

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
  const headerRight = document.querySelector('.header-right');
  const headerDate = document.querySelector('.header-date');

  if (headerRight && !document.getElementById('btn-logout')) {
    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'btn-logout';
    logoutBtn.className = 'btn btn-secondary btn-sm header-logout-btn';
    logoutBtn.innerHTML = '<span class="material-symbols-outlined logout-icon md-18">logout</span><span class="logout-text" style="margin-left:4px;">Sair</span>';
    logoutBtn.title = 'Sair do Sistema';
    logoutBtn.onclick = doLogout;

    const userNameSpan = document.createElement('span');
    userNameSpan.id = 'active-user-badge';
    userNameSpan.className = 'active-user-badge';
    userNameSpan.style.fontSize = '12px';
    userNameSpan.style.color = 'var(--text2)';
    userNameSpan.style.fontWeight = '500';
    userNameSpan.innerHTML = `<span class="material-symbols-outlined md-16" style="vertical-align:middle;margin-right:4px;">account_circle</span>${user.name} <span style="opacity:0.6;font-size:10px">(${(user.role || 'admin').toUpperCase()})</span>`;

    // Adiciona o nome antes da data, e o botão sair por último
    if (headerDate) {
      headerRight.insertBefore(userNameSpan, headerDate);
    } else {
      headerRight.prepend(userNameSpan);
    }
    headerRight.appendChild(logoutBtn);
  }

  const role = normalizeRole(user.role);

  // Aprovações: admin decide tudo; engenheiro decide movimentações; RH só
  // quando o admin habilitou explicitamente o módulo de aprovações.
  const modulosRh = (role === 'rh' && user.modulosPermitidos) ? user.modulosPermitidos : {};
  const navAprovacoes = document.getElementById('nav-aprovacoes');
  if (navAprovacoes) {
    navAprovacoes.style.display =
      (role === 'admin' || role === 'super_admin' || role === 'engenheiro' || modulosRh.aprovacoes === true)
        ? '' : 'none';
  }

  if (role === 'admin' || role === 'super_admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  }
  if (role === 'super_admin') {
    document.querySelectorAll('.super-admin-only').forEach(el => el.style.display = '');
    
    // ISOLAR SUPER ADMIN (Oculta abas de empresas: Obras, Dashboard, Financeiro, etc.)
    document.querySelectorAll('.nav-item').forEach(el => {
      if (!el.classList.contains('super-admin-only') && !el.getAttribute('onclick')?.includes('doLogout')) {
        el.dataset.hiddenByRole = '1';
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
  if (role === ROLE_ENCARREGADO) {
    hidePages = ['obras', 'estoque', 'compras', 'financeiro', 'orcamento'];
    const impBtn = document.getElementById('import-file');
    if (impBtn?.parentElement) impBtn.parentElement.style.display = 'none';
  } else if (role === 'engenheiro') {
    hidePages = ['trabalhadores', 'presenca', 'financeiro', 'orcamento'];
  } else if (role === 'rh') {
    // RH enxerga apenas os módulos marcados pelo admin no cadastro do usuário.
    const paginaModulo = {
      trabalhadores: 'funcionarios', presenca: 'presenca', almocos: 'almocos',
      tarefas: 'tarefas', obras: 'obras', medicao: 'medicao', estoque: 'estoque',
      compras: 'compras', financeiro: 'financeiro', orcamento: 'orcamento'
    };
    hidePages = Object.entries(paginaModulo)
      .filter(([, modulo]) => modulosRh[modulo] !== true)
      .map(([pagina]) => pagina);
  }

  hidePages.forEach(p => {
    const nav = document.querySelector(`.nav-item[onclick="showPage('${p}')"]`);
    if (nav) {
      nav.dataset.hiddenByRole = '1';
      nav.style.display = 'none';
    }
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
    } else if (normalizeRole(activeUser.role) === ROLE_ENCARREGADO) {
      showPage('hoje');
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
  
  // EXCEÇÃO: Super Admins e Admins do Tenant podem não estar na lista local (ex: adicionados via painel master)
  if (activeUser.role === 'super_admin' || activeUser.role === 'admin') return;

  const stillExists = db.usuarios.find(u => (u.email || '').trim().toLowerCase() === (activeUser.email || '').trim().toLowerCase());

  if (!stillExists) {
    const dbHasGoogleUsers = db.usuarios.some(u => u && u.email);
    if (!dbHasGoogleUsers) {
      db.usuarios = [activeUser];
      if (typeof DB !== 'undefined') DB.usuarios = db.usuarios;
    } else {
      // Período de carência: espera 3 segundos para garantir que o checkAuth terminou de atualizar o cargo
      setTimeout(() => {
        const freshUserStr = sessionStorage.getItem('gestaoUser');
        if (freshUserStr) {
          const freshUser = JSON.parse(freshUserStr);
          if (freshUser.role === 'admin' || freshUser.role === 'super_admin') {
            console.log('[Sentinel] Acesso mantido via cargo Administrativo detectado após carência.');
            return;
          }
        }
        alert(`[Sentinel] O usuário ${activeUser.email} (Cargo: ${activeUser.role}) não foi encontrado na lista de usuários autorizados desta empresa. Se você é o dono da conta, adicione este e-mail na aba Administração.`);
        doLogout();
      }, 3000);
    }
    return;
  }

  if (normalizeRole(stillExists.role) !== normalizeRole(activeUser.role)) {
    alert(`[Sentinel] Alteração de cargo detectada no banco de dados.\nLocal: ${activeUser.role} -> DB: ${stillExists.role}.\nEfetuando logout para atualizar permissões.`);
    doLogout();
    return;
  }

  if (stillExists.name !== activeUser.name) {
    sessionStorage.setItem('gestaoUser', JSON.stringify(normalizeUserRecord(stillExists)));
  }
});

// SaaS: Define uma forma segura de inicializar, impedindo duplicidade de listeners
window.safeCheckAuth = checkAuth;

// checkAuth();

// Bootstrap pelo navegador foi REMOVIDO: gravar users/<email> era uma
// escalada de privilégio. O primeiro Super Admin é provisionado com
// functions/set_super_admin.js (Admin SDK); os demais, pela API
// POST /api/admin/cargo executada por um Super Admin autenticado.
