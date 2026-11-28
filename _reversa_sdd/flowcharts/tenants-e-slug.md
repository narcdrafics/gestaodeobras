# Fluxograma — Módulo `tenants-e-slug`

> 🟢 CONFIRMADO — `public/js/slug.js`, `public/js/slug_onboarding.js`, `public/js/data_core.js`, `cloudflare-worker/worker.js`, `database.rules.json`, `functions/index.js`.

## 1. Onboarding: escolha do endereço (`promptSlugOnboarding`)

```mermaid
flowchart TD
    A[auth_core: usuário autenticado sem perfil] --> B[promptSlugOnboarding ctx uid,email,name]
    B --> C[injectStyle + buildOverlay: dialog aria-modal]
    C --> D[preenche nome: Nome + ' Engenharia' ou 'Minha Empresa']
    D --> E[suggestSlug: normalize nome; se curto usa local do e-mail; se curto acrescenta 'obras']
    E --> F[check: validateSlug]
    F -- inválido --> G[state=bad; mensagem; botão desabilitado]
    F -- válido --> H[state=checking; isSlugTaken db.ref tenants_public/slug]
    H --> I{seq descartada?}
    I -- sim --> Z[ignora resposta]
    I -- não --> J{taken?}
    J -- sim --> K[state=bad: endereço em uso]
    J -- não --> L[state=ok: disponível]
    L --> M[submit: createTenantAccount]
    M --> N{slug/invalid ou slug/taken?}
    N -- sim --> O[mostra erro específico; mantém overlay]
    N -- não --> P[resolve created: slug,nomeEmpresa]
    G & K --> Q[usuário edita: input normaliza; debounce 350ms -> check]
    Q --> F
    C --> R[cancelar ou Escape: close null -> auth_core faz signOut]
```

## 2. Criação atômica da conta (`ObraSlug.createTenantAccount`)

```mermaid
flowchart TD
    A[createTenantAccount db,params] --> B[validateSlug]
    B -- inválido --> C[throw slug/invalid]
    B -- ok --> D[buildAccountUpdates]
    D --> D1[tenants/slug: nomeEmpresa, slug, subdominioSlug, emailAdmin, status ativo,<br/>plano free_trial, trialExpiracao now+30d, origem self_signup, criadoPorUid,<br/>config: esquemaCores emerald, limiteObras 1, limiteUsuarios 1, limiteTrabalhadores 9999]
    D --> D2[tenants_public/slug: slug, tenantId=slug, nomeEmpresa, esquemaCores]
    D --> D3[users/email com .=>,: uid,email,tenantId=slug,role admin,nome,origem self_signup]
    D1 & D2 & D3 --> E[db.ref().update updates — único update multi-path]
    E -- sucesso --> F[retorna slug e nomeEmpresa]
    E -- PERMISSION_DENIED --> G[isSlugTaken: leitura direta tenants_public/slug]
    G -- existe --> H[throw slug/taken: perdeu corrida]
    G -- não existe --> I[repassa erro original]
```

## 3. Resolução do tenant pelo subdomínio

```mermaid
flowchart TD
    A[initSubdomainContext] --> B[detectSubdomain: hostname divido por '.';<br/>descarta www e domínio raiz]
    B -- sem slug --> C[contexto null]
    B -- com slug --> D[loadTenantBySlug com timeout 8s]
    D --> E[leitura direta tenants_public/slug]
    E -- encontrado --> F{tem tenantId?}
    F -- não e usuário autenticado --> F1[query tenants orderByChild config/slug equalTo slug]
    F1 --> G[retorna id=tenantId ou slug + config do nó público]
    F -- sim --> G
    E -- não encontrado e autenticado --> H[query tenants por config/slug]
    H -- encontrado --> G
    H -- não --> I[null]
    G --> J[CURRENT_TENANT_ID = tenant.id + loadTheme]
    J --> K[subdomainContextPromise resolvida: auth_core pode validar login]
    I --> L[página de erro 'Empresa Inexistente ou URL Incorreta' + throw]
```

```mermaid
flowchart TD
    A[requisição em *.obrareal.com] --> B[Cloudflare Worker fetch]
    B --> C{OPTIONS?}
    C -- sim --> C1[204 + CORS da allowlist]
    C -- não --> D[extractSlug hostname]
    D -- sem slug --> E[proxy direto para Firebase Hosting]
    D -- reservado www/admin/api/mail/ftp --> F[301 para obrareal.com]
    D -- slug válido --> E
    E --> G[proxyToFirebase: X-Forwarded-Host, remove host, fetch manual]
    G --> H[remove ACAO do Firebase; aplica CORS por allowlist + Vary Origin]
    H --> I{extensão estática?}
    I -- sim --> I1[Cache-Control public max-age=3600]
    I -- não --> I2[no-cache, no-store, must-revalidate]
```

## 4. Troca de subdomínio (`updateSubdomainSlug`, Pro+)

```mermaid
flowchart TD
    A[updateSubdomainSlug] --> B{hasFeature subdominio?}
    B -- não --> C[modal de upgrade / alerta Pro+]
    B -- sim --> D[newSlug = minúsculas, a-z0-9-, >=3]
    D --> E[oldSlug = DB.subdominioSlug || DB.config.slug || tenantId]
    E --> F[leitura tenants_public/newSlug]
    F --> G{pertence a outro tenant?}
    G -- sim --> H[alerta: em uso]
    G -- não --> I[updates: tenants/id/subdominioSlug e config/slug]
    I --> J{nó antigo pertence a este tenant?}
    J -- sim --> J1[updates tenants_public/oldSlug = null]
    J -- não --> K[checa chave legada tenants_public/tenantId sem tenantId e remove]
    J1 & K --> L[updates tenants_public/newSlug com slug,tenantId,nomeEmpresa,esquemaCores,logoUrl]
    L --> M[db.ref().update multi-path]
    M --> N[toast sucesso]
    M --> O[backend enforceSubdomainPlan reverte se plano não permite]
```
