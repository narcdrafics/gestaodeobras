# Fluxograma — Módulo `admin-e-super-admin`

> 🟢 CONFIRMADO — `functions/super_admin.js`, `functions/auditoria.js`, `functions/plan_catalog.js`, `functions/cargos.js`, `functions/set_super_admin.js`, `functions/index.js`, `public/js/app_core.js`, `database.rules.json`, `firebase.json`.

## 1. Autorização da API (`verificarSuperAdmin`)

```mermaid
flowchart TD
    A[POST/GET /api/admin/conta] --> B{metodo POST ou GET?}
    B -- não --> B1[405 metodo_nao_permitido]
    B -- sim --> C[validarCorpo + cota admin:ip 60/min]
    C --> D{header Bearer?}
    D -- não --> D1[401 nao_autenticado]
    D -- sim --> E[verifyIdToken token, checkRevoked=true]
    E -- inválido/revogado --> E1[401 token_invalido]
    E -- ok --> F{uid e e-mail no token?}
    F -- não --> F1[401 token_invalido]
    F -- sim --> G[Promise.all: Auth.getUser + profiles/uid + users/emailKey + super_admins/uid]
    G --> H{conta ativa no Auth?}
    H -- não --> H1[403 conta_bloqueada]
    H -- sim --> I{autorizado?}
    I -- sim --> J[cota admin:uid 120/min]
    I -- não --> I1[403 sem_permissao]
    I1 --> I2[condições: super_admins/uid.ativo != false<br/>OU e-mail mestre legado<br/>OU role super_admin em perfil/claims E passaporte users/email.role=super_admin]
```

## 2. Dispatch POST — idempotência e auditoria fail-closed

```mermaid
flowchart TD
    A[POST autorizado] --> B[cota admin:acao 30/min]
    B --> C[acao em ACOES?]
    C -- não --> C1[400 acao_invalida]
    C -- sim --> D{acao em ACOES_DESTRUTIVAS?}
    D -- sim --> E[reservarOperacao admin_ops/requestId via transaction]
    E --> F{reserva committed?}
    F -- não, mesmo requestId --> F1[200 ok idempotente=true<br/>não reaplica]
    F -- sim --> G[executa ACOES[acao]]
    D -- não --> G
    G --> H[marca efeitoAplicado]
    G -- erro --> I[libera reserva somente se efeito NÃO aplicado]
    I --> I1[registra auditoria sucesso=false<br/>ator pode ser null]
    I1 --> I2{auditoria obrigatória falhou?}
    I2 -- sim --> I3[503 auditoria_falhou]
    I2 -- não --> I4[status do erro + requestId + idempotente]
    H --> J[registrar auditoria sucesso=true<br/>obrigatoria= true se destrutiva]
    J -- falha --> J1[503 auditoria_falhou; reserva mantida]
    J -- ok --> K[200 ok + resultado + requestId]
```

## 3. Ações disponíveis (`ACOES`)

```mermaid
flowchart TD
    A{acao} --> B[reset_password]
    A --> C[bloquear_usuario]
    A --> D[excluir_usuario]
    A --> E[definir_limites]
    A --> F[definir_plano]
    A --> G[bloquear_tenant]

    B --> B1[e-mail obrigatório; proibido auto-reset]
    B1 --> B2[getUserByEmail: 404 se ausente; 409 se disabled]
    B2 --> B3[generatePasswordResetLink: 502 se falhar]
    B3 --> B4[link sensível só na resposta; NÃO entra na auditoria]

    C --> C1[resolverUsuario: por uid ou e-mail<br/>fallback users/email/uid]
    C1 --> C2{propria conta?} -- sim --> C3[400 auto_bloqueio]
    C2 -- não --> C4[updateUser disabled + revokeRefreshTokens<br/>profiles/status, bloqueadoEm, bloqueadoPor]
    C4 --> C5{sem UID?} -- sim --> C6[users/emailKey/bloqueado = true]

    D --> D1{propria conta?} -- sim --> D2[400 auto_exclusão]
    D1 -- não --> D3[tenant lido do perfil gravado no servidor]
    D3 --> D4[update multi-path: profiles/uid, super_admins/uid,<br/>users/emailKey, invites/emailKey = null<br/>+ remove da lista tenants/tid/usuarios]
    D4 --> D5[auth.deleteUser; se falhar: disabled=true]

    E --> E1[tenant obrigatório e existente]
    E1 --> E2[normalizarPlanoAdmin + limitesDoPlano<br/>com ajustes manuais]
    E2 --> E3[grava config/limiteObras, limiteUsuarios, limiteTrabalhadores]

    F --> F1[normalizarPlanoAdmin + diasDoPlano + limitesDoPlano]
    F1 --> F2[update: plano, planoVencimento, status ativo,<br/>billingState ativo, motivo ajuste_manual_master,<br/>limites; limpa carência/bloqueio/cancelamento]
    F2 --> F3{plano free_trial?} -- sim --> F4[trialExpiracao = vencimento]

    G --> G1[bloqueado?]
    G1 -- sim --> G2[status=bloqueado_pagamento, billingState=bloqueado,<br/>motivo/data de bloqueio]
    G1 -- não --> G3[status=ativo, billingState=ativo,<br/>motivo liberacao_manual_master]
```

## 4. Leitura da Kiwify (`GET`)

```mermaid
flowchart TD
    A[GET /api/admin/conta?recurso=kiwify&tipo=...] --> B[cota admin:kiwify 30/min]
    B --> C{tipo em RECURSOS? products|sales|account|webhooks}
    C -- não --> C1[400 tipo_invalido]
    C -- sim --> D[params explícitos: page_size<=100,<br/>page_number<=1000, status, product_id]
    D --> E[credenciaisKiwify: OAuth preferido, token legado opcional]
    E --> F[consultarKiwify com cache de token + http do Admin SDK]
    F --> G[registra auditoria kiwify_tipo]
    G --> H[200 ok + resultado + catalogoLocal de PLANOS]
    F -- credenciais ausentes --> I[resposta configurado=false + mensagem]
```

## 5. Cliente do painel (`public/js/app_core.js`)

```mermaid
flowchart TD
    A[super_admin.html / admin.html] --> B[adminApiRequest: POST /api/admin/conta<br/>Bearer token do usuário]
    A --> C[adminKiwifyRequest: GET /api/admin/conta]
    A --> D[cargoApiRequest: POST /api/admin/cargo]

    B --> B1[masterApplyPlan -> definir_plano]
    B --> B2[saveMasterTenant -> definir_plano / definir_limites / bloquear_tenant<br/>e grava nome/slug/tenants_public via RTDB]
    B --> B3[masterToggleUserBlock -> bloquear_usuario]
    B --> B4[masterDeleteUserApi -> excluir_usuario]
    B --> B5[masterToggleTenantBlock -> bloquear_tenant]
    B --> B6[masterResetUserPassword -> reset_password<br/>link exibido em modal, nunca gravado]

    C --> C1[loadKiwifyData: products/sales/account/webhooks<br/>renderiza tabelas com escape HTML]

    D --> D1[addMasterUser -> define cargo super_admin/MASTER_SYSTEM<br/>credencial criada em app Firebase secundário]
    D --> D2[deleteMasterUser -> define cargo admin]

    A --> E[loadAdminAudit: admin_audit limitToLast 30<br/>leitura permitida só ao master pelas rules]
    A --> F[changeMasterPassword: updatePassword no cliente<br/>auth/requires-recent-login => reautenticar]
```

## 6. Bootstrap one-time (`functions/set_super_admin.js`)

```mermaid
flowchart TD
    A[execução local com serviceAccountKey.json] --> B[getUserByEmail tonycampelo@gmail.com]
    B --> C[profiles/uid.update role=super_admin, tenantId=MASTER_SYSTEM]
    C --> D[users/emailKey.update role, tenantId, nome, origem=bootstrap_manual]
    D --> E[super_admins/uid.set uid,email,role,origem]
    E --> F[syncCustomClaims passa a emitir claims de super_admin]
```
