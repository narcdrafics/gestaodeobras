# Fluxograma — Módulo `usuarios-e-cargos`

> 🟢 CONFIRMADO — `functions/cargos.js`, `functions/usuarios.js`, `functions/claims.js`, `functions/index.js`, `public/js/app_core.js`, `public/modals/modal-usuario.html`, `public/modals/modal-credenciais-usuario.html`, `tests/rh-customizavel.test.js`, `tests/security/privilege-escalation.test.js`.

## 1. Criação de usuário e credencial

```mermaid
flowchart TD
    A[admin.html: + Novo Usuário -> modal-usuario] --> B[saveUsuario: email, nome, role, módulos RH, escopo de obras]
    B --> C{campos obrigatórios?}
    C -- não --> C1[toast: e-mail e nome obrigatórios]
    C -- sim --> D{role=rh sem módulos? ou obras específicas sem obra?}
    D -- sim --> D1[toast: selecione ao menos um módulo/obra]
    D -- não --> E[tenant da sessão<br/>super_admin usa superAdminActiveTenant]
    E --> F{tenant válido?}
    F -- não --> F1[toast: selecione uma empresa]
    F -- sim --> G{novo usuário?}
    G -- sim --> H{limite de acessos do plano atingido<br/>ou e-mail duplicado?}
    H -- sim --> H1[toast: upgrade / e-mail já cadastrado]
    H -- não --> I[grava invites/emailKey: email,tenantId,role,nomeEmpresa]
    I --> J[POST /api/admin/criar-usuario com Bearer token]
    G -- não --> K[edição: cargoApiRequest definir_cargo]
    J --> L{erro fatal de autorização/validação?}
    L -- sim --> L1[remove convite órfão + mensagem amigável]
    L -- não --> M[DB.usuarios.push + persistDB + renderAdmin]
    M --> N{credencial recebida?}
    N -- sim --> O[abre modal-credenciais-usuario: e-mail + senha temporária]
    N -- não --> P[aviso: usuário cria senha no primeiro acesso]
```

### API `criarUsuarioTenant` (`POST /api/admin/criar-usuario`)

```mermaid
flowchart TD
    A[POST] --> B{metodo POST?} -- não --> B1[405]
    B --> C[validarCorpo + cota IP 20/min]
    C --> D{Bearer?} -- não --> D1[401]
    D --> E[verifyIdToken checkRevoked]
    E -- inválido --> E1[401]
    E --> F[papelDoChamador: Auth + profiles/uid + super_admins/uid]
    F --> G{role em admin/super_admin?} -- não --> G1[403]
    G --> H[cota UID 60/min + valida body email,nome,tenantId]
    H --> I{auto-alteração ou tenant cruzado?} -- sim --> I1[400/403]
    I -- não --> J{invites/emailKey.tenantId == tenantId?} -- não --> J1[409 convite_inexistente]
    J --> K[transaction usos: 0=>1]
    K -- falhou --> K1[409 convite_ja_usado]
    K -- ok --> L[gerarSenhaTemporaria 12 chars]
    L --> M{conta já existe no Auth?}
    M -- sim --> N{admin não-master e tenant vinculado diferente/vazio?}
    N -- sim --> N1[409 email_vinculado_outro_tenant + devolve reserva]
    N -- não --> N2[updateUser senha/displayName + revokeRefreshTokens]
    M -- não --> O[createUser]
    O -- falha --> O1[devolve reserva]
    N2 & O --> P[200 uid,email,password,criado<br/>senha NUNCA gravada no RTDB]
```

## 2. Definição de cargo (`POST /api/admin/cargo`)

```mermaid
flowchart TD
    A[editUsuario -> cargoApiRequest definir_cargo] --> B[verificarChamador: token checkRevoked + Auth + profiles + allowlist + passaporte]
    B --> C{ehMaster ou ehAdmin?} -- não --> C1[403 sem_permissao]
    C --> D[resolverAlvo: uid ou e-mail -> profiles -> users -> Auth getUserByEmail]
    D --> E{alvo é o próprio chamador?} -- sim --> E1[400 auto_alteracao]
    E -- não --> F{role informado?} -- não --> F1[400 cargo_obrigatorio]
    F --> G[normalizarRole: mestre => encarregado]
    G --> H{role=super_admin e chamador não master?} -- sim --> H1[403 sem_permissao]
    H -- não --> I{role na whitelist do chamador?} -- não --> I1[400 cargo_invalido]
    I --> J{destino do tenant}
    J --> J1[super_admin => MASTER_SYSTEM]
    J --> J2[master => dados.tenantId ou perfil ou passaporte]
    J --> J3[admin => somente tenant próprio; perfil sem tenant não pode ser adotado]

    J1 & J2 & J3 --> K[normalizarModulosRh: só cargo rh, chaves conhecidas, boolean true]
    K --> L[escopo de obras: todas ou específicas, até 500 ids]
    L --> M[update profiles/uid: role, tenantId, status, cargoAtualizadoEm, cargoAtualizadoPor, name]
    M --> N{cargo rh?}
    N -- sim --> N1[grava modulosPermitidos, acessoObras, obrasPermitidas]
    N -- não --> N2[limpa modulosPermitidos/acessoObras/obrasPermitidas]
    N1 & N2 --> O[espelha role/tenant/RH em users/emailKey e invites/emailKey se existirem]
    O --> P[super_admins/uid = dados da promoção OU null]
    P --> Q[auth.revokeRefreshTokens: novas claims só no próximo token]
    Q --> R[syncCustomClaims -> auditoria obrigatória]
```

## 3. Remoção de usuário (`POST /api/admin/cargo`, `remover_usuario`)

```mermaid
flowchart TD
    A[deleteUsuario -> último admin?] -- sim --> A1[toast: não remove o único admin]
    A -- não --> B[cargoApiRequest remover_usuario]
    B --> C[valida chamador e alvo; proíbe auto-remoção]
    C --> D[tenant do perfil; admin não pode cruzar tenant]
    D --> E[profiles/uid: role=desativado, tenantId=null, status=bloqueado,<br/>carimbos de servidor]
    E --> F[users/emailKey: role=desativado, tenantId=null]
    F --> G[invites/emailKey e super_admins/uid = null]
    G --> H[remove da lista tenants/tid/usuarios]
    H --> I[revokeRefreshTokens + updateUser disabled=true]
    I --> J[auditoria obrigatória + DB.usuarios.splice + persistDB]
```

## 4. Cargo RH — normalização e propagação

```mermaid
flowchart TD
    A[modal: 11 checkboxes de módulos] --> B[lerModulosRhDoModal: só se role=rh]
    B --> C[servidor: normalizarModulosRh]
    C --> D{cargo é rh?}
    D -- não --> D1[retorna null: nada é gravado]
    D -- sim --> E{entrada é objeto não-array?}
    E -- não --> F[MODULOS_RH_PADRAO: funcionarios, presenca, almocos]
    E -- sim --> G[aceita apenas chaves de MODULOS_RH com valor === true]
    G --> H[grava em profile, passaporte, convite e custom claims]
    H --> I[cliente: setRestrictions filtra nav/botões pelos módulos]
    I --> J[aprovacoes: papelPodeDecidir também respeita o módulo]
```

## 5. Hierarquia de papéis

```mermaid
flowchart TD
    A[ROLES_TENANT] --> A1[admin, rh, engenheiro, encarregado, comprador, pendente]
    B[ROLES_MASTER] --> B1[ROLES_TENANT + super_admin, desativado, bloqueado]
    C[admin comum] --> C1[pode definir ROLES_TENANT no próprio tenant]
    C --> C2[não promove a super_admin: 403 antes de validar cargo]
    D[super_admin] --> D1[pode definir qualquer ROLES_MASTER e escolher tenant]
    E[mestre => encarregado alias legado] --> E1[normalizarRole no servidor e no cliente]
```
