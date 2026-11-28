# Fluxograma — Módulo `auth`

> 🟢 CONFIRMADO — extraído de `public/js/auth_core.js`, `functions/claims.js`, `functions/usuarios.js` e `functions/index.js`.

## 1. Login / cadastro (`handleAuthSuccess`)

```mermaid
flowchart TD
    A[doEmailLogin / doGoogleLogin / doEmailSignup] --> B[handleAuthSuccess firebaseUser]
    B --> C[extrai email minúsculo e uid]
    C --> D{email presente?}
    D -- não --> E[Erro: Google não forneceu e-mail] --> Z[Fim]
    D -- sim --> F[aguardarContextoTenant: window.subdomainContextPromise]
    F -- falha --> F1[signOut + remove gestaoUser + erro de URL] --> Z
    F -- ok --> G[_leitura profiles/uid_]
    G --> H[users/email com pontos trocados por vírgula]
    H --> I[invites/email]
    I --> J{globalData?}
    J -- sim --> K[Self-healing: role/tenant do passaporte global<br/>super_admin=>MASTER_SYSTEM senão admin]
    K --> K1{snapshot do perfil existe?}
    K1 -- não --> K2[profileRef.set ... status ativo]
    K1 -- sim --> K3[profileRef.update somente name]
    J -- não --> L{inviteData?}
    L -- sim --> M[role do convite ou engenheiro; tenantId do convite<br/>update não-destrutivo; remove convite]
    L -- não --> N{sem perfil, sem guard admin, página de login?}
    N -- sim --> N1{CURRENT_TENANT_ID?}
    N1 -- sim --> N2[signOut: conta não pertence à empresa]
    N1 -- não --> N3[promptSlugOnboarding => cria tenant + perfil admin]
    N3 -- cancelado --> N4[signOut, nada criado]
    N -- não --> O[userProfile vazio]
    K2 & K3 & M & N3 --> P[touch lastLogin no perfil<br/>dispara syncCustomClaims]
    P --> Q{perfil.status == pendente?}
    Q -- sim --> Q1[signOut: limite de usuários do plano]
    Q -- não --> R{globalData.bloqueado ou status bloqueado?}
    R -- sim --> R1[encerrarSessaoBloqueada]
    R -- não --> S{userProfile nulo?}
    S -- sim --> S1[signOut: sem acesso cadastrado]
    S -- não --> T{CURRENT_TENANT_ID e tenant diferente e não super_admin?}
    T -- sim --> T1[signOut: acesso negado ao subdomínio]
    T -- não --> U{role == pendente?}
    U -- sim --> U1[signOut: aguarda aprovação]
    U -- não --> V{novo tenant em origem cruzada?}
    V -- sim --> V1[signOut + redirect welcome no subdomínio]
    V -- não --> W[sessionStorage.gestaoUser = userProfile<br/>initDB tenantId]
    W --> X[loop 6x getIdTokenResult(true)<br/>espera claims.tenantId ou role super_admin]
    X -- timeout --> X1[avança com aviso: Storage pode falhar]
    X -- ok & super_admin --> X2[promove role/tenant na sessão]
    X1 & X2 --> Y{_adminLoginGuard e não super_admin?}
    Y -- sim --> Y1[signOut: sem autorização de Super Admin]
    Y -- não --> Y2[redirect app.html ou URL do tenant]
```

## 2. Sessão persistida (`checkAuth` / `onAuthStateChanged`)

```mermaid
flowchart TD
    A[onAuthStateChanged] --> B[aguardarContextoTenant]
    B --> C[observarStatusPerfil: listener em profiles/uid/status]
    C --> D{user autenticado?}
    D -- não --> E[remove gestaoUser; redirect login.html ou admin-login.html]
    D -- sim --> F{sessionStorage.gestaoUser?}
    F -- sim --> G{status bloqueado ou tenant diferente da URL?}
    G -- sim --> G1[logout / alerta]
    G -- não --> H[initDB + redirect app.html ou applyAccessControl]
    F -- não --> I[reidrata perfil via profiles/uid]
    I --> J{perfil existe?}
    J -- sim --> K{bloqueado / tenant incompatível?}
    K -- sim --> K1[signOut + alerta]
    K -- não --> K2[grava sessão + initDB + applyAccessControl]
    J -- não --> L[alerta falha crítica + redirect login.html]
```

```mermaid
flowchart TD
    A[firebaseSync event] --> B{sessionStorage e db.usuarios?}
    B -- não --> Z[Fim]
    B -- sim --> C{role super_admin ou admin?}
    C -- sim --> Z
    C -- não --> D{e-mail na lista local?}
    D -- não --> E{lista local vazia?}
    E -- sim --> E1[adiciona próprio usuário à lista]
    E -- não --> E2[carência 3s; se cargo virou admin mantém; senão logout]
    D -- sim --> F{cargo mudou?}
    F -- sim --> F1[logout para atualizar permissões]
    F -- não --> G{nome mudou?}
    G -- sim --> G1[normalizeUserRecord e atualiza sessão]
```

## 3. Criação de credencial (`POST /api/admin/criar-usuario`)

```mermaid
flowchart TD
    A[POST /api/admin/criar-usuario] --> B{metodo POST?}
    B -- não --> B1[405 metodo_nao_permitido]
    B -- sim --> C[validarCorpo + cota por IP: 20/min]
    C --> D{header Bearer?}
    D -- não --> D1[401 nao_autenticado]
    D -- sim --> E[verifyIdToken token, true]
    E -- inválido --> E1[401 token_invalido]
    E -- ok --> F[papelDoChamador: Auth + profiles/uid + super_admins/uid]
    F --> G{role em admin/super_admin?}
    G -- não --> G1[403 sem_permissao]
    G -- sim --> H[cota por uid: 60/min + valida body]
    H --> I{convite invites/email pertence ao tenant?}
    I -- não --> I1[409 convite_inexistente]
    I -- sim --> J[transaction usos: 0=>1 atômico]
    J -- falhou --> J1[409 convite_ja_usado]
    J -- ok --> K[gerarSenhaTemporaria 12 chars, 4 grupos obrigatórios, Fisher-Yates]
    K --> L{conta já existe no Auth?}
    L -- sim --> M{chamador não master e tenant vinculado diferente?}
    M -- sim --> M1[409 email_vinculado_outro_tenant + devolve reserva]
    M -- não --> M2[updateUser senha/displayName + revokeRefreshTokens]
    L -- não --> N[createUser]
    N -- falha --> N1[devolve reserva]
    M2 & N --> O[resposta 200: uid,email,password,criado<br/>senha NUNCA vai para o RTDB]
```

## 4. Autorização de super_admin (`avaliarSuperAdmin`)

```mermaid
flowchart TD
    A[avaliarSuperAdmin uid,email,claims,db] --> B{uid e e-mail?}
    B -- não --> C[nao_autorizado: sem_identidade]
    B -- sim --> D[super_admins/uid]
    D --> E{ativo != false e e-mail confere?}
    E -- sim --> F[autorizado: allowlist]
    E -- não --> G{e-mail == EMAIL_MESTRA?}
    G -- sim --> H[autorizado: email_mestre]
    G -- não --> I{claims atuais == super_admin?}
    I -- não --> J[nao_autorizado]
    I -- sim --> K[users/email/role == super_admin?]
    K -- sim --> K1[grava super_admins/uid migradoEm + autorizado: legado_migrado]
    K -- não --> J
```
