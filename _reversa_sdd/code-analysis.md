# Análise Técnica Consolidada — obra-real (gestaodeobras)

> Gerada pelo **Arqueólogo** em 2026-11-27 · `doc_level = completo`
> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA
> Progresso: **21/21 módulos** (`auth`, `tenants-e-slug`, `admin-e-super-admin`, `usuarios-e-cargos`, `aprovacoes`, `obras`, `tarefas`, `trabalhadores`, `presenca-e-ponto`, `almocos`, `compras`, `estoque`, `financeiro-e-pix`, `orcamento`, `medicao`, `relatorios-e-dashboard`, `fotos`, `billing-e-planos`, `whatsapp-bot`, `seguranca-e-rbac`, `infra-e-deploy`) — Escavação concluída.

---

## Módulo `auth` 🟢

**Arquivos principais:** `public/js/auth_core.js` (811 linhas), `functions/claims.js`, `functions/usuarios.js`, `functions/index.js` (`syncCustomClaims`), `public/login.html`, `public/admin-login.html`.

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `doGoogleLogin` / `doEmailLogin` / `doEmailSignup` | — | `void` | Disparam `signInWithPopup`, `signInWithEmailAndPassword` e `createUserWithEmailAndPassword` |
| `handleAuthSuccess` (`:217`) | `firebaseUser`, `fallbackName?` | `Promise<void>` | Orquestra resolução de perfil, convite, onboarding, validação tenant, claims e redirect |
| `enviarLinkRecuperacao` (`:91`) | — | `Promise<void>` | `sendPasswordResetEmail` com mensagem genérica |
| `aguardarContextoTenant` (`:18`) | — | `Promise<void>` | Aguarda `subdomainContextPromise`; em falha faz signOut |
| `checkAuth` (`:518`) / `safeCheckAuth` (`:618`) | — | `void` | Listener único `onAuthStateChanged` com reidratação de sessão |
| `observarStatusPerfil` (`:497`) | `user` | `void` | `on('value')` em `profiles/<uid>/status`, derruba sessão ao bloquear |
| `setRestrictions` (`:647`) | `user` | `void` | Aplica RBAC visual (nav, botões) e escolhe página inicial |
| `avaliarSuperAdmin` (`claims.js:35`) | `uid,email,currentClaims,db` | `{autorizado,motivo}` | Decide promoção a super_admin |
| `criarUsuarioTenant` (`usuarios.js:63`) | `req,res` | `Promise<Response>` | Cria/redefine credencial no Auth mediante convite e cargo admin |
| `syncCustomClaims` (`index.js:680`) | `event` | `Promise` | Traduz `profiles/<uid>` em custom claims |

**Condicionais não-triviais:**
- Quatro caminhos mutually exclusivos em `handleAuthSuccess`: passaporte global → convite → auto-onboarding → sem perfil (falha).
- Bloqueios em cascata: `pendente`, `bloqueado`, `globalData.bloqueado`, cross-tenant, `_adminLoginGuard`.
- `papelDoChamador` usa RTDB como autoridade (claims sozinhas não bastam) e whitelist `EMAIL_MESTRA`/`super_admins`.
- `firebaseSync`: carência de 3 s antes de deslogar por cargo alterado, para não punir promoção recente.

**Loops:** polling de 6 tentativas × 1500 ms em `getIdTokenResult(true)` até `claims.tenantId` casar ou `role === 'super_admin'`.

**Tratamento de erros:** quase todo o fluxo usa `try/catch` com signOut + mensagem amigável; leituras de `users/` e `invites/` são toleradas como aviso (não bloqueiam); criação de credencial reverte a reserva do convite em falha.

### 2. Algoritmos e lógica

- 🟢 **Chave de e-mail no RTDB:** `.trim().toLowerCase().replace(/\./g, ',')` (`claims.js:17-19`, `auth_core.js:240`).
- 🟢 **Senha temporária:** 12 caracteres, pelo menos um de cada grupo (maiúsculas sem O/I, minúsculas sem l, dígitos 2-9, símbolos `@#*!`), embaralhamento Fisher-Yates com `crypto.randomInt` (`usuarios.js:18-38`).
- 🟢 **Consumo atômico do convite:** `inviteRef.child('usos').transaction(atual => usos >= 1 ? undefined : usos+1)`; em falha de criação, transação de devolução (`:125-131`, `:174-177`).
- 🟢 **Autoridade de super_admin:** allowlist `super_admins/<uid>` > e-mail mestre legado > `users/<email>/role` **somente se** as claims atuais já eram `super_admin` (migração segura).
- 🟢 **Trava de assentos:** perfil novo além do limite do plano é marcado `pendente` com claims sem tenant (`index.js:616-640`); o login bloqueia esse status (`auth_core.js:364-371`).
- 🟢 **RBAC por cargo:** `admin`/`super_admin` veem `.admin-only`; `super_admin` esconde abas de empresa; `encarregado` oculta obras/estoque/compras/financeiro/orçamento; `engenheiro` oculta trabalhadores/presença/financeiro/orçamento; `rh` filtra por `modulosPermitidos`.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `Profile`, `GlobalUserPassport`, `Invite`, `CustomClaims`, sessão `gestaoUser` (sessionStorage) e `SuperAdminAllowlist`.

- Relacionamento: `profiles/<uid>.tenantId` ↔ `tenants/<tenantId>`; `users/<emailNormalizado>` é espelho global; `invites/<emailNormalizado>` é autorização temporária de vínculo.
- SessionStorage `gestaoUser` espelha `Profile` + campos RH para decisões de UI antes da reidratação.

### 4. Metadados e configurações

- Constantes: `ROLE_ENCARREGADO = 'encarregado'`, `ROLE_MESTRE_LEGADO = 'mestre'`, `EMAIL_MESTRA = 'tonycampelo@gmail.com'`, `EMAIL_RE`, `ROLES_ADMIN = ['admin','super_admin']`.
- Segredos Firebase: `defineSecret` para OpenAI/Meta/Kiwify (não diretamente usados neste módulo, mas declarados no mesmo entry point).
- Rate limits: criação de usuário — IP 20/min, UID 60/min (`consumirCota` em `functions/abuso.js`).
- Rotas: `/api/admin/criar-usuario` → `criarUsuarioTenant` (`firebase.json`).

### 5. Lacunas / pontos de atenção 🔴

- 🔴 Os testes de credenciais são de **inspeção de fonte** (`tests/auth-credentials.test.js`), não exercitam o fluxo real contra emulador Firebase; mudanças de comportamento podem passar se os trechos de texto permanecerem.
- 🟡 `globalData.bloqueado` é verificado somente quando o passaporte global existe; perfis bloqueados sem passaporte dependem do listener `observarStatusPerfil`.
- 🟡 A promoção a `super_admin` no cliente é aceita quando as claims dizem `super_admin`, mas a autoridade permanece no servidor; não há verificação adicional no front além do token.

### 6. Dependências

`tenants-e-slug` (CURRENT_TENANT_ID/subdomínio), `usuarios-e-cargos` (cargo/tenant), `admin-e-super-admin` (allowlist), `billing-e-planos` (limite de assentos), `seguranca-e-rbac` (rules/claims).

**Fluxograma:** [`flowcharts/auth.md`](flowcharts/auth.md)

---

## Módulo `tenants-e-slug` 🟢

**Arquivos principais:** `public/js/slug.js` (198 linhas, IIFE exposta como `window.ObraSlug`), `public/js/slug_onboarding.js` (237), `public/js/data_core.js` (`detectSubdomain`, `loadTenantBySlug`, `initSubdomainContext`, `updateSubdomainSlug`), `cloudflare-worker/worker.js` (143), `database.rules.json` (`tenants_public`, `subdominioSlug`), `functions/index.js` (`enforceSubdomainPlan`, `enforceConfigSlugPlan`).

### 1. Fluxo de controle

- `promptSlugOnboarding(ctx)` abre um `dialog` com nome e endereço; mantém máquina de estados `idle | checking | ok | bad`, com `checkSeq` para descartar respostas antigas e debounce de 350 ms.
- `validateSlug` → `isSlugTaken` (leitura direta por chave) → `createTenantAccount` → resolução da Promise para o `handleAuthSuccess`.
- `initSubdomainContext()` roda antes do login e expõe `window.subdomainContextPromise`; `auth_core.js` a aguarda antes de validar cross-tenant.
- Worker: `OPTIONS` responde 204; `extractSlug` remove o domínio raiz; subdomínios reservados redirecionam 301; demais fazem proxy preservando hostname via `X-Forwarded-Host`.
- `updateSubdomainSlug()` (admin, Pro+) faz checagem de disponibilidade, monta update multi-path e move o nó público.

### 2. Algoritmos e lógica

- 🟢 `normalizeSlug`: lowercase → NFD → remove diacríticos → filtra `[^a-z0-9]` → trunca em 30. `MIN_LEN=3`, `MAX_LEN=30`, `NAME_MAX_LEN=80`, `TRIAL_MS=30 dias`.
- 🟢 Lista `RESERVED` com ~45 termos (infra, páginas do sistema, marca, `null`, `undefined`).
- 🟢 `cleanCompanyName` remove `<`, `>`, controles, colapsa espaços e limita a 80 — saída usada apenas como texto (não `innerHTML`) no onboarding.
- 🟢 `isCrossOrigin`: em produção (`obrareal.com`), slug diferente do hostname atual implica troca de origem (sessão Firebase não acompanha) → redirect para `buildWelcomeUrl`.
- 🟢 `buildAccountUpdates`: escrita atômica de `tenants/<slug>`, `tenants_public/<slug>` e `users/<emailNormalizado>`, com plano `free_trial`, limites 1 obra / 1 usuário / 9999 trabalhadores e `trialExpiracao = now + 30d`.
- 🟢 Detecção de disputa de slug: se `update()` falha com `PERMISSION_DENIED`, relê `tenants_public/<slug>`; se existe, lança `slug/taken`.
- 🟢 `loadTenantBySlug`: lê `tenants_public/<slug>`; para nós legados sem `tenantId`, faz `orderByChild('config/slug').equalTo(slug)` somente com usuário autenticado; timeout de 8 s no contexto.
- 🟢 `updateSubdomainSlug`: verifica `hasFeature('subdominio')`, remove nó antigo apenas se pertencer ao tenant e limpa chave legada `tenants_public/<tenantId>`; backend `enforceSubdomainPlan` reverte escritas indevidas e remove o nó público órfão.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `Tenant`, `TenantPublic`, `TenantConfig`, `SlugValidation`, constantes de domínio.

### 4. Metadados e configurações

- Domínios: `BASE_DOMAIN = 'obrareal.com'`, `ROOT_DOMAIN = 'obrareal.com'` (worker), Firebase `controle-obras-c889d.web.app`.
- Plano/trial: `free_trial`, 30 dias; limites iniciais 1/1/9999; `esquemaCores = 'emerald'`.
- Feature flag: `subdominio` (Pro+), com enforcement em 3 camadas (UI, rules, Cloud Function) documentado em `docs/plans/features.md`.
- Cache do worker: estáticos 1 h; HTML `no-cache, no-store, must-revalidate`.

### 5. Lacunas / pontos de atenção 🔴

- 🔴 Divergência de domínio: `slug.js` usa `obrareal.com`, mas os comentários de `extractSlug` no worker citam `gestaodeobras.com.br` (legado). 🟡 Em produção, isso pode gerar conflito na detecção de slug se ambos os domínios estiverem ativos.
- 🟡 `updateSubdomainSlug` aceita hífen (`[^a-z0-9-]`), enquanto o onboarding normalize apenas `[a-z0-9]`; duas regras diferentes para o mesmo conceito.
- 🟢 Ausência de `.env.example`: hosts/segredos são implícitos em `defineSecret()` e `wrangler.jsonc`.

### 6. Dependências

`auth` (onboarding e cross-tenant), `billing-e-planos` (feature `subdominio`, limites), `seguranca-e-rbac` (rules de `tenants_public`), `infra-e-deploy` (worker/firebase).

**Fluxograma:** [`flowcharts/tenants-e-slug.md`](flowcharts/tenants-e-slug.md)

---

## Módulo `admin-e-super-admin` 🟢

**Arquivos principais:** `functions/super_admin.js` (479 linhas), `functions/auditoria.js`, `functions/plan_catalog.js`, `functions/cargos.js` (`handleCargoRequest`), `functions/set_super_admin.js`, `functions/index.js` (`adminAccountApi`, `gerenciarCargo`), `public/js/app_core.js` (bloco 4870–5510 + `changeMasterPassword`), `public/pages/super_admin.html`, `public/pages/admin.html`, `tests/super-admin.test.js`, `tests/auditoria.test.js`, `firebase.json`, `database.rules.json`.

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `verificarSuperAdmin` (`super_admin.js:46`) | `req`, `{auth,db}` | `{uid,email,claims}` | Verifica token com `checkRevoked` e confirma papel no banco |
| `handleAdminRequest` (`:348`) | `req,res,options` | `Promise<void>` | Handler único de `/api/admin/conta` (POST ações, GET Kiwify) |
| `acaoResetSenha` (`:125`) | `{db,auth}, dados, ator` | `{email,uid,link}` | Gera link de redefinição sem gravar segredo |
| `acaoBloquearUsuario` (`:157`) | idem | `{uid,email,bloqueado}` | Desabilita no Auth, revoga tokens e marca perfil |
| `acaoExcluirUsuario` (`:189`) | idem | `{uid,email,tenantId,excluido}` | Apaga perfil/allowlist/passaporte/convite e conta Auth |
| `acaoDefinirLimites` (`:248`) | `{db}, dados` | `{tenantId,limites}` | Aplica limites do plano com ajustes manuais |
| `acaoDefinirPlano` (`:267`) | idem | `{tenantId,plano,dias,planoVencimento,limites}` | Atribui plano, limpa bloqueios/carência e grava auditoria |
| `acaoStatusTenant` (`:310`) | idem | `{tenantId,bloqueado}` | Bloqueia/libera a empresa inteira |
| `contextoRequisicao` / `registrar` / `reservarOperacao` / `liberarOperacao` (`auditoria.js`) | — | vários | requestId, IP hashado, User-Agent, idempotência e fail-closed |
| `adminApiRequest` / `adminKiwifyRequest` / `cargoApiRequest` (`app_core.js:4905-4933`) | `payload` | `Promise<dados>` | Cliente autenticado das APIs do painel |
| `handleCargoRequest` (`cargos.js:340`) | `req,res,options` | `Promise<void>` | Concede/remove cargo via Admin SDK (inclui super_admin) |

**Condicionais não-triviais:**
- Autorização em quatro vias: `super_admins/<uid>.ativo !== false`, e-mail mestre legado, ou (`perfil.role`/`claims.role === super_admin` **e** `users/<email>.role === super_admin`).
- Ações destrutivas (`excluir_usuario`, `bloquear_tenant`, `bloquear_usuario`, `definir_plano`, `definir_cargo`) exigem reserva por `requestId` + auditoria gravada; se a auditoria falha após a escrita, a resposta é 503 e a reserva é mantida.
- Auto-reset, auto-bloqueio e auto-exclusão são proibidos; bloqueio/exclusão usam o tenant do **perfil gravado no servidor**, nunca o `tenantId` do corpo.
- A aplicação de plano zera `carenciaAte`, `motivoBloqueio`, `dataBloqueio`, `cancelamentoAgendado`, `dataCancelamento` e `avisoCarencia`.

**Loops:** `reservarOperacao` usa `ref.transaction` para disputa atômica; `saveMasterTenant` varre `[oldSlug, subdominioSlug, slug, tenantId]` para localizar e mover o nó público.

**Tratamento de erros:** `try/catch` central com códigos estáveis (`token_invalido`, `sem_permissao`, `acao_invalida`, `auditoria_falhou`...), `Retry-After` quando o erro vem da Kiwify, e mensagens 5xx mascaradas no cliente.

### 2. Algoritmos e lógica

- 🟢 `verifyIdToken(token, true)` — `checkRevoked` invalida imediatamente tokens emitidos antes de bloqueio/rebaixamento, sem esperar o refresh (~1 h).
- 🟢 Chave de e-mail normalizada: `.trim().toLowerCase().replace(/\./g, ',')` para `users/<chave>`.
- 🟢 `resolverUsuario`: por UID (validação `^[A-Za-z0-9]{1,128}$`) ou por e-mail via `orderByChild('email').equalTo()`, com fallback em `users/<chave>/uid`.
- 🟢 Catálogo canônico `PLANOS` com 11 ids, aliases (`full`, `ilimitadoanual`, `startanual`, `proanual`, `mastersystem`), `limitesDoPlano` (0/negativo/NaN caem no padrão, teto 9999) e `diasDoPlano` (teto 3650).
- 🟢 Idempotência: reentrega com o mesmo `requestId` responde `200 {ok:true, idempotente:true}` sem reaplicar; reserva só é liberada se o efeito não foi aplicado.
- 🟢 Auditoria: todo registro contém `requestId`, `ipHash`, `userAgent`, `roteiro`, `duracaoMs`, ator (pode ser `null` em falha de token) — `admin_audit` é somente leitura para master pelas rules.
- 🟢 Leitura Kiwify: apenas 4 parâmetros permitidos, `page_size ≤ 100`, `page_number ≤ 1000`, token OAuth preferido a bearer legado, cache de token no processo da função.
- 🟢 Cliente nunca grava plano/limites/cargo diretamente: `masterApplyPlan`, `saveMasterTenant`, `addMasterUser` e `deleteMasterUser` passam pelas APIs.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `AdminAudit`, `AdminOpsReservation`, `SuperAdminAllowlist`, campos de billing do `Tenant`, `PlanoCatalogo` e tabela de ações.

### 4. Metadados e configurações

- Rotas: `/api/admin/conta` → `adminAccountApi`; `/api/admin/cargo` → `gerenciarCargo` (`firebase.json`).
- Função: `onRequest` com `cors:false`, `memory:256MiB`, `timeoutSeconds:60`, `maxInstances:3`; segredos `KIWIFY_CLIENT_ID`, `KIWIFY_CLIENT_SECRET`, `KIWIFY_ACCOUNT_ID`, `KIWIFY_API_TOKEN`.
- Cotas: IP 60/min, UID 120/min, ação 30/min, Kiwify 30/min (conta/cargo também limitados por IP e UID).
- Constantes: `EMAIL_MESTRA = 'tonycampelo@gmail.com'`, `MAX_LIMITE = 9999`.
- Bootstrap: `set_super_admin.js` usa `serviceAccountKey.json` local e grava `profiles`, `users` e `super_admins` da conta mestra.

### 5. Lacunas / pontos de atenção 🔴

- 🔴 O bootstrap depende de `functions/serviceAccountKey.json` (segredo local) e de execução manual; não existe API para criar o primeiro super_admin.
- 🟡 `verificarSuperAdmin` aceita `masterLegado` (e-mail fixo) como OR das demais condições: se `super_admins/<uid>.ativo === false` para esse e-mail, a revogação da allowlist não o impede.
- 🟡 `renderMasterUsers` (`app_core.js:5240`) lista mestres lendo `users` e filtrando `role === 'super_admin'`, enquanto a fonte canônica é `super_admins/<uid>`; promoções/revogações feitas somente na allowlist podem não aparecer na tela.
- 🟡 `addMasterUser` ainda cria a credencial no navegador com um app Firebase secundário (`SecAuth_<timestamp>`); o cargo em si é concedido pelo servidor, mas a etapa de Auth depende do cliente.
- 🟡 `saveMasterTenant` grava nome/slug e move `tenants_public` direto do cliente (com checagem de posse do nó); plano/limites/status passam pela API, mas essa parte não é idempotente por `requestId`.
- 🟡 A fronteira com `billing-e-planos` é difusa: `admin.html` exibe botões de checkout e o catálogo de planos, enquanto a cobrança em si pertence ao módulo de billing.

### 6. Dependências

`auth` (claims/sessão), `usuarios-e-cargos` (`/api/admin/cargo`), `seguranca-e-rbac` (rules de `admin_audit`, `super_admins`, `tenants`), `billing-e-planos` (catálogo e Kiwify), `tenants-e-slug` (movimentação de `tenants_public`).

**Fluxograma:** [`flowcharts/admin-e-super-admin.md`](flowcharts/admin-e-super-admin.md)

---

## Módulo `usuarios-e-cargos` 🟢

**Arquivos principais:** `functions/cargos.js` (415 linhas), `functions/usuarios.js` (192), `functions/claims.js`, `functions/index.js` (`syncCustomClaims`, `gerenciarCargo`, `criarUsuarioTenant`), `public/js/app_core.js` (blocos 4436, 5699–5782, 7618–7815), `public/modals/modal-usuario.html`, `public/modals/modal-credenciais-usuario.html`, `tests/rh-customizavel.test.js`, `tests/security/privilege-escalation.test.js`.

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `saveUsuario` (`app_core.js:7695`) | — | `Promise<void>` | Cria convite + credencial ou edita cargo pela API |
| `editUsuario` / `deleteUsuario` (`:5731`, `:5752`) | `idx` | `Promise<void>` | Preenche modal / chama `remover_usuario` |
| `criarCredencialAuthUsuario` (`:7637`) | `dados` | `Promise<credencial>` | POST `/api/admin/criar-usuario` |
| `verificarChamador` (`cargos.js:50`) | `req`, `{auth,db}` | `{uid,email,claims,ehMaster,ehAdmin,tenantId}` | Autoridade do chamador |
| `resolverAlvo` (`:99`) | `db, auth, dados` | `{uid,email}` | Resolve alvo por UID, e-mail ou Auth |
| `acaoDefinirCargo` (`:154`) | `{db,auth}, dados, chamador` | `{uid,email,role,tenantId,...}` | Escreve cargo/tenant/escopo RH em 4 nós |
| `acaoRemoverUsuario` (`:276`) | idem | `{uid,email,removido,tenantId}` | Desvincula sem apagar a conta Auth |
| `normalizarModulosRh` (`:23`) | `valor`, `cargo` | `object|null` | Filtra módulos RH por whitelist |
| `handleCargoRequest` (`:340`) | `req,res,options` | `Promise<void>` | Handler de `/api/admin/cargo` |
| `criarUsuarioTenant` (`usuarios.js:63`) | `req,res` | `Promise<Response>` | Gera senha temporária e cria credencial |
| `papelDoChamador` (`usuarios.js:44`) | `uid, claims` | `{role,tenantId}` | Autoridade para criação de usuário |
| `syncCustomClaims` (`index.js:680`) | `event` | `Promise` | Traduz perfil em claims (role, tenant, módulos, obras) |

**Condicionais não-triviais:**
- `role` ausente em `definir_cargo` é erro `cargo_obrigatorio` — nunca vira `admin` por padrão.
- Promoção a `super_admin` por não-master retorna 403 **antes** da validação de whitelist (evita disfarçar escalada como "cargo inválido").
- Admin comum não pode adotar conta sem tenant nem mover usuário entre tenants; master pode escolher o tenant.
- `desativado`/`bloqueado` viram `status: bloqueado`; demais cargos, `ativo`.
- Criação de usuário consome convite com `transaction` em `usos` e reverte a reserva em falha de Auth.

**Loops:** varredura dos 11 checkboxes de módulos RH e da lista de obras no modal; filtragem da lista `tenants/<tid>/usuarios` na remoção.

**Tratamento de erros:** cliente remove convite órfão em erros fatais (`CRED_ERRORES_FATAIS`): e mantém o convite em falha transitória para o usuário criar a senha no primeiro acesso; servidor registro auditoria mesmo em falhas de token.

### 2. Algoritmos e lógica

- 🟢 **Hierarquia:** `ROLES_TENANT = {admin, rh, engenheiro, encarregado, comprador, pendente}`; `ROLES_MASTER = ROLES_TENANT + {super_admin, desativado, bloqueado}`.
- 🟢 **Alias legado:** `mestre` → `encarregado` (`normalizarRole` em `claims.js`), tanto no modal quanto no servidor.
- 🟢 **Módulos RH:** whitelist `MODULOS_RH` de 11 chaves (`funcionarios`, `presenca`, `almocos`, `tarefas`, `obras`, `medicao`, `estoque`, `compras`, `financeiro`, `orcamento`, `aprovacoes`); padrão `{funcionarios:true, presenca:true, almocos:true}`; somente `=== true` é aceito, o que bloqueia `__proto__`.
- 🟢 **Escopo de obras:** `acessoObras = 'todas' | 'especificas'`; lista `obrasPermitidas` limitada a 500 ids e vazia quando `'todas'`.
- 🟢 **Espelhamento:** `profiles/<uid>` é a autoridade; `users/<emailKey>` e `invites/<emailKey>` são espelhos; allowlist `super_admins/<uid>` é gravada/só apagada pelo Admin SDK.
- 🟢 **Revogação:** `auth.revokeRefreshTokens(alvo.uid)` após troca de cargo; bloqueio de credencial em `remover_usuario` também usa `updateUser({disabled:true})`.
- 🟢 **Carimbos de servidor:** `cargoAtualizadoEm`/`cargoAtualizadoPor` nunca vêm do cliente.
- 🟢 **Senha temporária:** 12 caracteres de 4 classes, Fisher-Yates com `crypto.randomInt`, devolvida apenas na resposta da API e exibida em modal de uso único.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `Cargo` (campos de perfil), `PermissoesRH`, `Convite`, `CargoAction`, `CredencialTemporaria`.

### 4. Metadados e configurações

- Rotas: `/api/admin/cargo` → `gerenciarCargo`; `/api/admin/criar-usuario` → `criarUsuarioTenant` (`firebase.json`).
- Cotas: cargo — IP 60/min e UID 60/min; criação de usuário — IP 20/min e UID 60/min.
- Limites: e-mail ≤254, nome ≤120, tenantId ≤128, obrasPermitidas ≤500, UID `^[A-Za-z0-9_-]{1,128}$`.
- Constantes: `EMAIL_MESTRA`, `MODULOS_RH_PADRAO`, `ROLES_ADMIN = ['admin','super_admin']`.

### 5. Lacunas / pontos de atenção 🔴

- 🔴 A senha temporária é entregue ao navegador e mostrada em modal; não é gravada no RTDB, mas qualquer script comprometido na página pode capturá-la no momento da exibição.
- 🟡 `DB.usuarios`/`persistDB()` mantêm uma lista operacional local no cliente; a autoridade real é `profiles` + claims. Falha de `persistDB()` pode deixar a tela divergente do banco até recarregar.
- 🟡 Limite de assentos é checado no cliente (`getPlanLimits().usuarios`) e também no servidor (`pendente` quando excede); as duas camadas usam critérios distintos.
- 🟡 `MODULOS_RH` inclui `aprovacoes`, cuja decisão é implementada em `aprovacoes-api.js`; a consistência depende de ambos os módulos usarem a mesma chave.
- 🟡 `deleteUsuario` envia `uid: targetUser.uid || undefined` — registros legados sem UID dependem da resolução por e-mail no servidor.
- 🟡 `verificarChamador` e `papelDoChamador` têm critérios de master ligeiramente diferentes (o primeiro exige também `perfil.role === 'super_admin'` na via claims).

### 6. Dependências

`auth` (claims/sessão), `admin-e-super-admin` (allowlist e API de cargo), `seguranca-e-rbac` (rules de profiles/users/invites), `billing-e-planos` (limite de assentos), `aprovacoes` (módulo RH de decisões).

**Fluxograma:** [`flowcharts/usuarios-e-cargos.md`](flowcharts/usuarios-e-cargos.md)

---

## Módulo `aprovacoes` 🟢

**Arquivos principais:** `functions/aprovacoes.js` (723 linhas), `functions/aprovacoes-api.js` (299), `functions/index.js` (`aplicarAprovacao`, `aprovacoesPrazosJob`, `decidirAprovacaoApi`), `public/js/aprovacoes_ui.js` (545), `public/pages/aprovacoes.html`, `public/modals/modal-aprovacao.html`, `database.rules.json`, `tests/aprovacoes*.test.js` (4 suítes).

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `solicitarAprovacao` (`aprovacoes_ui.js:221`) | `tipo, payload, descricao?, alvo?` | `Promise<string\|null>` | Cria nó `pendente` com prazo de 15 dias (dedupe de 60 s) |
| `desviarParaAprovacao` (`:273`) | idem | `Promise<boolean>` | Atalho chamado pelos `save*` do app |
| `decidirAprovacao` (`:281`) | `id, decisao` | `Promise<void>` | Revalida papel e envia decisão à API |
| `handleAprovacaoRequest` (`aprovacoes-api.js:234`) | `req,res,options` | `Promise<void>` | Handler de `/api/admin/aprovacao` |
| `verificarChamador` (`:72`) | `req, {auth,db}` | `{uid,email,claims,role,claimsRole,perfilRole,ehMaster,modulos,ehAdmin}` | Autoridade em 4 fontes |
| `papelEfetivo` / `papelPodeDecidir` (`:47`, `:58`) | papeis / papel, aprovacao, modulos | `string` / `boolean` | Hierarquia e permissão por tipo |
| `decidir` (`:129`) | `{db,auth}, dados, chamador` | `Promise<{ok,id,status,decididoEm}>` | Valida e grava decisão com transação |
| `aoEscreverAprovacao` (`aprovacoes.js:594`) | `db,tenantId,id,depois,antes,agora` | `Promise<object>` | Trigger da transição para `aprovado` |
| `aplicarAprovacaoPorId` (`:523`) | `db,tenantId,id,agora?,retomar?` | `Promise<{aplicado,motivo?}>` | Reserva transacional + aplicação idempotente |
| `construirEfeitos` (`:392`) | `db,tenantId,aprovacao,estado,agora` | `{updates,antes,depois,resumo}` | Calcula os 8 tipos de efeito sem I/O |
| `processarAprovacoesJob` (`:651`) | `db, agora?` | `Promise<{tenants,alertas,expiradas,retomadas,erros}>` | Job diário de prazos |

**Condicionais não-triviais:**
- Papel efetivo é o **maior** entre claim e perfil (`HIERARQUIA`), para que claim desatualizada não rebaixe admin e perfil desatualizado não rebaixe claim vigente.
- RH decide apenas se `modulosPermitidos.aprovacoes === true` **e** o módulo do tipo (`MODULO_POR_TIPO`) também estiver habilitado; engenheiro só `movimentacao_estoque` e precisa de `notificarAdmin === true`.
- `emailAdmin` do tenant conta como admin na API (preserva a rule antiga), mas não cria `ehAdmin` no cliente.
- Decisão é gravada por transação: concorrência retorna `409 ja_decidida`; aplicação é reservada por outra transação (`reservadoEm`) e só é retomada após 10 minutos pelo job.
- `podeAplicar` revalida decisor e autoridade **no momento da aplicação**, não apenas na decisão.

**Loops:** varredura de todos os tenants no job; laço dos alertas `[7,12,15]`; percorrimento de `profiles` para achar admins do tenant.

**Tratamento de erros:** toda falha de aplicação vira `status='erro'`, `motivo` (≤500), `falhaEm` e notificação aos admins; falha de auditoria na API gera `503 auditoria_falhou`.

### 2. Algoritmos e lógica

- 🟢 Prazo fixo: `expiraEm = solicitadoEm + 15 dias` (`1296000000 ms`), validado nas rules; avisos em 7, 12 e 15 dias com dedupe por `alertas['7'|'12'|'15']`.
- 🟢 Idempotência em duas camadas: decisão transacional + reserva de aplicação; `aplicadoEm` e efeitos gravados num único `update()` multi-path.
- 🟢 Efeitos financeiros: `Pago → valpago = total`, `Pendente/Atrasado → 0`, `Parcial → clamp(0, total)`; lançamento novo sempre nasce `Pendente`.
- 🟢 Estoque: entrada/retorno somam; saída e transferência exigem saldo; transferência gera duas movimentações e cria item no destino quando não existe (`cod: MAT-<epoch>`).
- 🟢 Compras: campos comerciais (`forn`, `pixkey`, `vunit`, `vtotal`, `vorc`, `prazo`) são removidos do registro público e guardados em `comprasPrivadas/<tenantId>/<compraId>`.
- 🟢 Auditoria: `antes`/`depois` serializados com limite de 4000 caracteres; notificações replicadas por destinatário em `notificacoes/<tenantId>/<uid>/<pushId>` para as rules autorizarem a leitura individual.
- 🟢 Cliente: dedupe de reenvío por 60 s; `payloadParaExibicao` oculta campos sensíveis para encarregado/engenheiro; badge de prazo fica vermelho com ≤3 dias.
- 🟢 `requerAprovacao()` desvia apenas `encarregado`, `engenheiro` e `rh`; admin/comprador escrevem direto; ponto/fotos/tarefas/almocos não passam por aprovação.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `Aprovacao`, `AprovacaoDecision`, `AprovacaoNotification`, `AprovacaoAudit`, `CompraPrivada`, `AprovacaoAction` e a tabela de efeitos por tipo.

### 4. Metadados e configurações

- Rotas/funções: `/api/admin/aprovacao` → `decidirAprovacaoApi`; trigger `onValueWritten("tenants/{tenantId}/aprovacoes/{aprovacaoId}")` → `aplicarAprovacao`; job `onSchedule("every day 06:00", timeZone: "America/Sao_Paulo")` → `aprovacoesPrazosJob` (256 MiB, 120 s).
- Constantes: `PRAZO_APROVACAO_DIAS = 15`, `DIAS_ALERTA = [7,12,15]`, `RESERVA_STALE_MS = 600000`, `MS_DIA = 86400000`.
- Cotas da API: IP 60/min e UID 60/min; modelo de Body ≤ limite de `validarCorpo`.
- Índices RTDB: `status`, `solicitadoPor`, `tipo`, `expiraEm`.
- Enums: tipos (8), status (`pendente`, `aprovado`, `rejeitado`, `expirado`, `erro`), status de pagamento (`Pago`, `Parcial`, `Pendente`, `Atrasado`).

### 5. Lacunas / pontos de atenção 🔴

- 🟡 `papelPodeDecidir` está duplicado em `aprovacoes.js` e `aprovacoes-api.js`; hoje idênticos, mas divergência futura mudaria autoridade conforme o caminho (trigger vs API).
- 🟡 `papelEfetivo` usa a maior hierarquia; se um perfil for promovido e a claim antiga for `admin`, a claim prevalece sobre `rh` — intencional, mas depende de `syncCustomClaims` para convergir.
- 🟡 Job diário é o único mecanismo de expiração: se o agendamento falhar, solicitações vencidas continuam `pendentes` na UI até a próxima execução (a API bloqueia a decisão, mas o trigger de aplicação também revalida `expiraEm`).
- 🟡 `notificacoes/<tid>/<uid>` não é marcada como lida no banco pelo cliente; o "visto" fica em `sessionStorage` (`gestaoNotificacoesVistas`), o que não sincroniza entre dispositivos.
- 🟡 `registrarAuditoriaOperacional` grava em `localStorage` (máx. 200) e não é a trilha canônica — a auditoria real está em `auditoria/<tenantId>`.
- 🟡 A rule de criação aceita `encarregado`/`mestre` apenas para 3 tipos, enquanto a API serve 8 tipos; a lista de tipos permitidos precisa ser mantida em sincronia entre rules, cliente e servidor.

### 6. Dependências

`usuarios-e-cargos` (papéis e módulos RH), `auth` (claims/sessão), `seguranca-e-rbac` (rules de aprovacoes/notificacoes), `estoque`, `trabalhadores`, `financeiro-e-pix`, `orcamento`, `medicao`, `compras` (efeitos aplicados), `billing-e-planos` (`billingState`).

**Fluxograma:** [`flowcharts/aprovacoes.md`](flowcharts/aprovacoes.md)

---

## Módulo `obras` 🟢

**Arquivos principais:** `public/pages/obras.html` (14 linhas), `public/modals/modal-obra.html` (31), `public/js/app_core.js` (helpers 1–96; `renderObras` 912; `shareObraWhatsApp` 973; `saveObra` 6189; `editObra` 6228), `public/js/data_core.js` (carga/persistência 430–450, 935–970), `public/js/utils.module.js` (escopo 1594–1684), `database.rules.json:87-88`, `tests/acesso-por-obra.test.js`, `tests/escopo-obras-paginas.test.js`, `tests/obra-select-modal.test.js`.

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `saveObra` (`app_core.js:6189`) | — | `Promise<void>` | Valida código único e limite do plano; insere/edita em `DB.obras` e persiste |
| `editObra` (`:6228`) | `idx` | `Promise<void>` | Copia a obra para o modal e guarda o índice em `#ob-edit-idx` |
| `renderObras` (`:912`) | — | `void` | Cards com progresso/custo + tabela com ações |
| `shareObraWhatsApp` (`:973`) | `obraCod` | `void` | Gera resumo semanal (tarefas, gasto, presença) e link `wa.me` |
| `deleteItem('obras', idx)` | tabela, índice | `Promise<void>` | Remove e persiste (validação final nas rules) |
| `escopoObrasDaSessao` (`:7`) | — | `string[]\|null` | Resolve as obras permitidas da sessão |
| `obraNoEscopoAtual` / `trabNoEscopoAtual` / `trabsNoEscopoAtual` (`:17`,`:23`,`:29`) | entidade | `boolean`/`array` | Filtra vistas por escopo |
| `prepararSelectsDeObra` (`:40`) | `modalContent` | `string\|null` | Preenche/trava selects de obra; retorna código único |
| `getObrasPermitidas` (`utils.module.js:1605`) | `usuarios, email, role` | `string[]\|null` | `null` = todas; array = códigos permitidos |
| `filterDbByObras` (`:1613`) | `db, permitidas` | `object` | Filtra `obras` e `OBRA_SCOPED_KEYS` na carga |
| `mergeScopedDb` (`:1627`) | `full, scoped, permitidas` | `object\|null` | Remonta arrays completos para gravação |
| `parseObrasTrabalhador` / `trabNaObra` / `obraNoEscopo` / `trabNoEscopo` / `trabalhadoresNoEscopo` (`:1645-1675`) | — | vários | Escopo da ficha do trabalhador |

**Condicionais não-triviais:**
- Código da obra é obrigatório e único; edição ignora o próprio índice.
- Limite de obras (`getPlanLimits().obras`) é checado no cliente apenas para inclusões; o enforcement definitivo está nas rules.
- Sem `getObrasPermitidas` ou sem usuário correspondente, o escopo é `null` (acesso a todas), exceto lista vazia explícita, que é falha fechada.
- `mergeScopedDb` retorna `null` sem snapshot completo para não apagar dados fora do escopo na nuvem.

**Loops:** mapeamento de todas as obras para cards/tabela; varredura dos 9 `OBRA_SCOPED_KEYS` na filtragem e remontagem; junção dos selects `id$=-obra` e `id^=pr-/fn-/cp-/md-/tf-/es-/mv-/oc-obra`.

**Tratamento de erros:** toasts de validação; timeout de 20 s no `persistDB` com evento `syncStatus`; `console.warn` em listeners do Firebase.

### 2. Algoritmos e lógica

- 🟢 Cards calculam progresso físico como média de `tarefas[].perc` e custo como `Σ financeiro[].real / orc`; cores por faixa (≤30, 31–70, >70).
- 🟢 `getObrasPermitidas`: admin/super_admin → `null`; demais papéis buscam o usuário por e-mail case-insensitive em `DB.usuarios` e exigem `acessoObras === 'especificas'`.
- 🟢 `filterDbByObras`: filtra `obras` por `cod` e os 9 conjuntos escopados pelo campo `obra`.
- 🟢 `mergeScopedDb`: itens fora do escopo vêm do snapshot completo (`lastTenantData`), itens dentro vêm do `DB` filtrado; impede gravar obra fora do escopo.
- 🟢 `parseObrasTrabalhador` aceita array (dados migrados) ou texto separado por vírgula/ponto e vírgula; comparação exata de códigos (`OB1 ≠ OB10`).
- 🟢 `prepararSelectsDeObra`: com exatamente uma obra permitida, o select é travado e um evento `change` é disparado para sincronizar os cálculos do modal.
- 🟢 `persistDB` usa `.update()` com caminhos explícitos (`buildCloudUpdate`) para não sobrescrever metadados de plano/limites.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `Obra`, `ObraScope`, `ObraMetrics` e a matriz de acesso por papel.

### 4. Metadados e configurações

- Path RTDB: `tenants/<tenantId>/obras` (array/objeto com chaves numéricas).
- Limites: `getPlanLimits().obras` (padrão free_trial = 1); `limiteObras` configurável pelo painel master.
- Enums: `tipo` (Casa, Sobrado, Comercial, Reforma), `status` (Planejada, Em andamento, Concluída, Pausada), `contrato_tipo` (Administração, Empreitada Global, Mão de Obra, Preço Máximo Garantido).
- Regras de escrita: super_admin/e-mail mestre, admin/`emailAdmin`, engenheiro, ou RH com `modulosPermitidos.obras === true`, sempre com billing ativo.

### 5. Lacunas / pontos de atenção 🔴

- 🔴 O isolamento por obra é **apenas no cliente**: o tenant é um nó único no RTDB e as rules não filtram registros por obra — um usuário com acesso direto ao banco pode ler/escrever todas as obras do tenant.
- 🟡 `renderObras` não chama `obraNoEscopoAtual` diretamente; depende de a carga (`filterDbByObras`) já ter filtrado `DB.obras`.
- 🟡 Código da obra é a chave de relacionamento em tarefas/financeiro/presença etc.; renomear um código na edição não propaga para os registros vinculados.
- 🟡 `shareObraWhatsApp` interpola valores do DB na mensagem; a sanitização depende da confiança nos dados já escapados pela UI.
- 🟡 `saveObra` valida o limite no cliente e nas rules, mas mensagens de erro divergem (toast amigável vs `PERMISSION_DENIED`).
- 🟡 `deleteItem` é genérico e não verifica referências: excluir uma obra com tarefas/financeiro deixa registros órfãos apontando para o código removido.

### 6. Dependências

`auth`/`seguranca-e-rbac` (sessão e rules), `usuarios-e-cargos` (escopo por usuário), `billing-e-planos` (limite de obras), `tarefas`, `financeiro-e-pix`, `presenca-e-ponto`, `almocos`, `estoque`, `compras`, `orcamento`, `medicao` (métricas e escopo), `whatsapp-bot` (resumo compartilhado).

**Fluxograma:** [`flowcharts/obras.md`](flowcharts/obras.md)

---

## Módulo `tarefas` 🟢

**Arquivos principais:** `public/pages/tarefas.html` (66 linhas), `public/modals/modal-tarefa.html` (30), `public/js/app_core.js` (render/ações 1830–2264; CRUD 6961–7015; fotos 8069–8248), `public/js/utils.module.js` (`calcTarefasResumo` 987; `calcDashboardResumo` 1074), `public/js/data_core.js` (fallback base64 de fotos), `functions/whatsapp/parser-tarefas.js` (142), `database.rules.json:81-83` e `:285-289`, `tests/tarefas-dashboard.test.js`, `tests/tarefas-fotos.test.js`, `tests/security/rules.test.js`, `tests/security/tenant-isolation.test.js`.

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `renderTarefas` (`app_core.js:1854`) | — | `void` | Aplica filtros/ordenação, calcula KPIs e escolhe tabela ou kanban |
| `onTaskSearch` (`:1833`) | — | `void` | Debounce de 220 ms antes de re-renderizar |
| `limparFiltrosTarefas` (`:1839`) | — | `void` | Zera 5 selects, 2 checks e a busca |
| `tarefaTaAtrasada` (`:1965`) | `t` | `boolean` | `prazo < getTodayBR()` e status ≠ Concluída |
| `tarefaStatusEfetivo` (`:1971`) | `t` | `string` | `Atrasada` quando vencida; senão status gravado ou `A fazer` |
| `snapshotTarefas` (`:2011`) | — | `void` | Cópia profunda para `desfazerAcao()` |
| `toggleTarefaConcluida` (`:2016`) | `idx` | `Promise<void>` | Conclui/reabre com `conclusao` e `perc` |
| `concluirTarefaRapida` (`:2036`) | `idx` | `Promise<void>` | Atalho de conclusão |
| `iniciarTarefa` (`:2043`) | `idx` | `void` | Muda para `Em andamento` com `perc >= 10` |
| `moverTarefaStatus` (`:2057`) | `idx, status, opts` | `void` | Movimento do kanban/ações; ajusta `perc` e `conclusao` |
| `desfazerAcao` (`:1996`) | — | `void` | Restaura o snapshot e persiste |
| `irParaTarefas` / `verTarefasDashboard` / `verTarefasDaObra` (`:2080`,`:2094`,`:2099`) | filtros / `cod` | `Promise<void>` | Navegação com filtros aplicados na chegada |
| `abrirNovaTarefaNoStatus` (`:2104`) | `status` | `Promise<void>` | Cria tarefa já em uma coluna do kanban |
| `onTaskDragStart/Over/Leave/Drop` (`:2114`–`:2148`) | evento, `idx`/`status` | `void` | Drag & drop do kanban |
| `renderTaskTable` (`:2150`) | `tasks` | `void` | Tabela com ações rápidas, badges e fotos |
| `renderKanban` (`:2196`) | `tasks` | `void` | 3 colunas: `Pendente`, `Em andamento`, `Concluída` |
| `saveTarefa` (`:6961`) | — | `Promise<void>` | Insere/atualiza `DB.tarefas` e persiste |
| `editTarefa` (`:6993`) | `idx` | `Promise<void>` | Carrega o registro no modal e restaura fotos |
| `uploadEvidenceFile` (`:8069`) | `file` | `Promise<string>` | Upload em `tenants/<tid>/evidencias/` e retorna URL |
| `taskPhotoList` (`:8149`) / `taskPhotoCaption` (`:8157`) | `t` / `t,index,total` | `array` / `string` | Normalização legada e legenda derivada da descrição |
| `handleTarefaPhotos` (`:8182`) / `removeTarefaPhoto` (`:8219`) | `input` / `idx` | `Promise<void>` / `void` | Seleção, otimização, upload e remoção |
| `openTarefaFotos` (`:8231`) | `idx, startIndex` | `void` | Reusa a galeria de medições |
| `calcTarefasResumo` (`utils.module.js:987`) | `db, hoje` | `{hoje,abertas,atrasadas,vencemHoje,itens}` | Base dos KPIs e alertas do dashboard |
| `calcDashboardResumo` (`:1074`) | `db, hoje, role, modulos` | `object` | Agrega tarefas por obra e alertas |
| `handleAudioTarefas` (`parser-tarefas.js:4`) | `transcricao, tenantId, from` | `Promise<{response}>` | Extrai tarefas e salva rascunho |
| `confirmarTarefas` (`:56`) / `editarTarefaPendente` (`:94`) / `cancelarTarefas` (`:130`) | `tenantId, from, ...` | `Promise<{response}>` | Confirma, ajusta ou descarta o rascunho |

**Condicionais não-triviais:**
- `tarefaTaAtrasada` ignora tarefas sem prazo e concluídas; a comparação é textual (`YYYY-MM-DD`) contra `getTodayBR()` em `America/Sao_Paulo`.
- `statusFilter = 'A fazer'` casa com `A fazer` **e** `Pendente` (alias legado); `abertas` = qualquer status efetivo ≠ `Concluída`; `atrasadas` = prazo vencido.
- `iniciarTarefa` não atua se o status estiver em `Em andamento`, `Concluída` ou `Pausada`; `moverTarefaStatus` ignora o destino quando ele já é o status efetivo.
- Ao sair de `Concluída`, `perc >= 100` é reduzido para `90`; ao entrar em `Em andamento`, `perc < 10` é elevado para `10`.
- `moverTarefaStatus` aceita `opts.semSnapshot` e `opts.semToast` para composição sem duplicar estado/toast.

**Loops:** mapeamento/filtragem/ordenação de `DB.tarefas`; repovoamento de responsáveis com `Set`; 3 colunas do kanban; laço de arquivos em `handleTarefaPhotos`; laço das tarefas pendentes em `confirmarTarefas`.

**Tratamento de erros:** toast de limite de fotos; fallback para `dataUrl` quando o Storage falha; erro de upload aborta o lote; `desfazerAcao` sem snapshot exibe aviso; parser devolve mensagens orientativas quando não há tarefas, rascunho ou índice inválido.

### 2. Algoritmos e lógica

- 🟢 `getTodayBR()` converte `new Date()` para `America/Sao_Paulo` e formata `YYYY-MM-DD`; é a mesma base usada por prazos e conclusões rápidas.
- 🟢 KPIs da página são calculados sobre o conjunto **filtrado** (total, concluídas, em andamento, pendentes, atrasadas).
- 🟢 Ordenação padrão: prazo mais próximo primeiro; sem prazo vai para o fim. Alternativas: prioridade (`Alta`,`Média`,`Baixa`), status e data de criação.
- 🟢 Filtro `Minhas` compara `resp` em minúsculas com `name`/`email` da sessão (`gestaoUser`), aceitando correspondência por substring.
- 🟢 Snapshot de desfazer é um `JSON.parse(JSON.stringify(...))` global; o toast com botão `Desfazer` dura 6 segundos.
- 🟢 Kanban usa o status efetivo para bucketizar; `A fazer`/`Pendente`/`Atrasada`/`Pausada`ficam em `Pendente`.
- 🟢 Fotos: até 6 por tarefa, otimização `maxDim=1280`/`quality=0.75`, upload em `tenants/<tid>/evidencias/<timestamp>_<nome sanitizado>`, legenda `<desc> · Foto n/N`.
- 🟢 Compatibilidade: `photoUrl` espelha `photos[0]`; `taskPhotoList` aceita `photos[]`, `photoUrl` ou `foto` antigo e filtra apenas URLs `http(s)` ou `data:image`.
- 🟢 `calcTarefasResumo`: `abertas` = status ≠ `Concluída`; `itens` = abertas com prazo que venceram ou vencem hoje, com `obraNome` resolvido; alertas agrupam atrasadas em **um** alerta alto e vencem-hoje em alertas médios individuais.
- 🟢 WhatsApp: `extrairTarefas`/`detectarEtapas`/`detectarPrioridade` alimentam um rascunho por remetente; `CONFIRMAR` persiste cada item com `resp` padrão `Equipe`, `prazo` opcional e `criadoPor = from`.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `Tarefa`, `TarefaRascunhoWhatsApp`, `TarefaFoto`, `TarefaResumo`, `StatusEfetivo` e a matriz de acesso.

### 4. Metadados e configurações

- Path RTDB: `tenants/<tenantId>/tarefas`; rascunho em `tenants/<tenantId>/tarefas_pendentes/<from>` (Admin SDK); fotos em Firebase Storage `tenants/<tid>/evidencias/`.
- Enums: status (`A fazer`, `Em andamento`, `Concluída`, `Atrasada`, `Pausada`; alias `Pendente`), prioridade (`Alta`, `Média`, `Baixa`), confiança do parser (`alta`, `media`, `baixa`).
- Constantes: `MAX_TAREFA_FOTOS = 6`, debounce `220 ms`, toast de desfazer `6000 ms`, otimização `1280 px`/`0.75`.
- Índices/consultas: nenhum índice declarado para `tarefas`; leitura feita pelo nó inteiro do tenant via listener do app.
- Regras: escrita permitida a super_admin/e-mail mestre, admin/`emailAdmin`, encarregado/mestre, engenheiro, ou RH com `modulosPermitidos.tarefas === true`, com billing ativo.
- Testes: `tests/tarefas-dashboard.test.js` (filtros, KPIs, ações rápidas, kanban, alertas), `tests/tarefas-fotos.test.js` (múltiplas fotos, legendas, impressão).

### 5. Lacunas / pontos de atenção 🔴

- 🔴 As rules declaram `tarefas_pendentes` como nó **raiz** (`tarefas_pendentes/<tenantId>`), mas o parser grava/em lê `tenants/<tenantId>/tarefas_pendentes/<from>`. Como o parser usa Admin SDK, as rules não bloqueiam a operação, porém o contrato de segurança testado em `tests/security/*` pode não cobrir o caminho realmente usado.
- 🔴 `functions/whatsapp/parser-tarefas.js` exporta as quatro funções, mas não há nenhum chamador em `functions/`; o vínculo com o webhook só aparece em documentação de planejamento (`docs/raw/whatsapp-bot/2026-05-07-executar-plano-implementacao.md`).
- 🔴 Tarefas criadas pelo WhatsApp usam `prioridade`, `criadoEm` e `status='Pendente'`, enquanto a UI espera `prior`, `criacao` e usa `resp`/`conclusao`; `prioridade` e `criadoEm` são ignorados por filtros, KPIs e ordenação.
- 🟡 Um único snapshot global de desfazer: uma segunda ação rápida antes do desfazer substitui o estado recuperável; `desfazerAcao()` chama `persistDB()` sem `await`.
- 🟡 `taskPhotoList` só usa `photos[]` quando ele está não vazio; se um código legado atualizar apenas `photoUrl`, as fotos adicionais ficam invisíveis na galeria.
- 🟡 Fallback de fotos em base64 no `localStorage` (`data_core.js`) pode estourar a cota do navegador em dispositivos móveis.
- 🟡 Filtro `Minhas` por substring pode incluir tarefas de outro responsável cujo texto contenha o nome ou e-mail do usuário.
- 🟡 `moverTarefaStatus` compara com o status **efetivo**: uma tarefa vencida não pode ser movida para `Atrasada` (destino já é o efetivo), embora possa ser reaberta para `A fazer`.

### 6. Dependências

`auth`/`seguranca-e-rbac` (sessão, claims e rules), `obras` (código da obra, escopo e nome), `usuarios-e-cargos` (módulo `tarefas` para RH), `billing-e-planos` (`billingState`), `relatorios-e-dashboard` (`calcTarefasResumo`/alertas), `fotos` (Storage e galeria de medições), `whatsapp-bot` (`obra-etapas.js`), `aprovacoes` (tarefas não passam por aprovação).

**Fluxograma:** [`flowcharts/tarefas.md`](flowcharts/tarefas.md)

---

## Módulo `trabalhadores` 🟢

**Arquivos principais:** `public/pages/trabalhadores.html` (19 linhas), `public/modals/modal-trabalhador.html` (74), `public/js/app_core.js` (escopo 17–96; render 1006–1048; presença 6049–6139; CRUD 6248–6465; exclusão 7878–7883), `public/js/utils.module.js` (`parseObrasTrabalhador` 1645, `trabNaObra` 1653, `trabNoEscopo` 1666, `trabalhadoresNoEscopo` 1673), `public/js/pix_logic.js:6`, `public/js/data_core.js:16,239`, `database.rules.json:68-69,114-116`, `tests/aprovacoes-ui.test.js`, `tests/aprovacoes-api.test.js`, `tests/obra-select-modal.test.js`, `tests/rh-customizavel.test.js`, `tests/escopo-obras-paginas.test.js`, `tests/security/rules.test.js`.

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `obraNoEscopoAtual` (`app_core.js:17`) | `obra` | `boolean` | Delegado para `window.obraNoEscopo` com o escopo da sessão |
| `trabNoEscopoAtual` (`:23`) | `trabalhador` | `boolean` | Filtra um trabalhador pelas obras permitidas |
| `trabsNoEscopoAtual` (`:29`) | `lista` | `array` | Versão em lote do filtro |
| `prepararSelectsDeObra` (`:40`) | `modalContent` | `string \| null` | Popula `#tr-obras` e os demais selects de obra; trava quando há uma única obra |
| `lerObrasDoFormTrabalhador` (`:77`) | — | `string` | Lê `selectedOptions` como `'OB1, OB2'` (fallback texto legado) |
| `syncTrabObrasHint` (`:87`) | — | `void` | Atualiza `#tr-obras-hint` com a quantidade selecionada |
| `renderTrabalhadores` (`:1006`) | — | `void` | Tabela com assiduidade, faltas do mês, saldo, diária e ações |
| `filterTrabByObra` (`:6049`) | — | `void` | Popula trabalhadores ativos de uma obra no modal de presença |
| `fillTrabInfo` (`:6083`) | — | `void` | Preenche diária/função e recalcula visibilidade de horas extras |
| `saveTrabalhador` (`:6248`) | — | `Promise<void>` | Valida, desvia para aprovação ou grava com cascata |
| `editTrabalhador` (`:6417`) | `idx` | `Promise<void>` | Carrega o cadastro no modal e calcula último pagamento |
| `selectAllTrabs` (`:6620`) | `check` | `void` | Marca/desmarca os checks de presença em massa |
| `deleteItem('trabalhadores', idx)` (`:7878`) | `table, idx` | `Promise<void>` | Confirma, desvia `trabalhador_remove` quando aplicável e remove |
| `parseObrasTrabalhador` (`utils.module.js:1645`) | `trabalhador` | `string[]` | Aceita array legado ou texto separado por vírgula/ponto e vírgula |
| `trabNaObra` (`:1653`) | `trabalhador, codObra` | `boolean` | Sem obras cadastradas = irrestrito |
| `trabNoEscopo` (`:1666`) | `trabalhador, permitidas` | `boolean` | Array vazio = falha fechada; comparação exata de código |
| `trabalhadoresNoEscopo` (`:1673`) | `trabalhadores, permitidas` | `array` | Filtra em lote |
| `cleanPixKey` (`pix_logic.js:6`) | `key, type` | `string` | Detecta/normaliza chave PIX |

**Condicionais não-triviais:**
- `trabNoEscopo`: escopo não-array → irrestrito; array vazio → **nenhum** trabalhador; trabalhador sem `obras` → legado irrestrito; caso contrário, basta interseção com as obras permitidas.
- `parseObrasTrabalhador` compara códigos exatos (`OB1` não casa com `OB10`) e aceita tanto `obras: string` quanto `obras: array` de dados migrados.
- `saveTrabalhador` rejeita código duplicado (ignorando o registro em edição) e qualquer obra fora do escopo da sessão.
- Com `desviarParaAprovacao` disponível, criação vira `trabalhador_add` e **edição é recusada** com aviso; sem o desvio, a escrita é direta.
- `deleteItem` desvia apenas se `requerAprovacao()` for verdadeiro; remoções de ponto/tarefas/almocos continuam diretas.
- Cascata dispara se nome **ou** código mudou; recálculo retroativo só toca presenças com `pgtoStatus !== 'Pago'`.

**Loops:** `DB.trabalhadores` em `renderTrabalhadores`; `DB.presenca`/`DB.financeiro` para indicadores; seis coleções na cascata; `DB.presenca` no recálculo de diária; `options` do multi-select; checks `.pr-massa-check`.

**Tratamento de erros:** validações com toast e `return` em código duplicado/fora do escopo; `persistDB(true)` com `try/catch` — falha de nuvem mantém o dado local e mostra o código do erro.

### 2. Algoritmos e lógica

- 🟢 Assiduidade: `Presentes / (Presentes + Faltas) * 100`, arredondada com `toFixed(0)`; cor verde acima de 80%, laranja acima de 50%, vermelho abaixo disso.
- 🟢 Faltas do mês: presenças com `presenca === 'Falta'` e `data.startsWith(currentMonth)`.
- 🟢 Saldo acumulado: `soma(presenca.total) - soma(financeiro.real)` onde `source === 'pre'`, `forn === nome` e `status === 'Pago'`.
- 🟢 Último pagamento (modal): `financeiro` filtrado por `trab === cod` e `status`/`pgtoStatus` `Pago`, ordenado por data descrescente.
- 🟢 Cascata de identidade propaga nome/código para `presenca`, `tarefas.resp`, `financeiro.forn`, `medicao.equipe`, `almocos.empreiteiro` e `obras.mestre`.
- 🟢 Recálculo retroativo: `Falta` → `0`; `Meio período` → `diária/2`; vínculo `Informal` → `diária`; com `hnorm > 0` → `diária + hextra * (diária/8) * 1,5`; senão `0`.
- 🟢 PIX: `cleanPixKey` infere tipo por `@`, UUID/32 hex, 11/14/10/12/13 dígitos e normaliza a chave antes de persistir.
- 🟢 Limite de trabalhadores: `getPlanLimits().trabalhadores` com padrão `9999` (`data_core.js:16,239`), ajustável pelo painel master.
- 🟢 Foto: upload genérico via `handleFileUpload(this, 'tr-foto-preview', 'tr-foto-url')` com preview em `#tr-foto-preview`.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `Trabalhador`, `VinculoTrabalhador`, `ObrasDoTrabalhador`, `TrabalhadorIndicadores` e a matriz de acesso.

### 4. Metadados e configurações

- Path RTDB: `tenants/<tenantId>/trabalhadores` (array com índices numéricos).
- Enums: `vinculo` (`CLT`, `Informal`, `Empreiteiro`), `pgto` (`PIX`, `Dinheiro`, `Transferência`, `Boleto`), `pixtipo` (`cpf`, `email`, `telefone`, `aleatoria`), `status` (`Ativo`, `Inativo`, `Afastado`).
- Limite padrão: `limiteTrabalhadores = 9999`; validação `newData.isNumber()` no cliente e regra de super_admin nas rules.
- Desvios de aprovação: `trabalhador_add` (cadastro) e `trabalhador_remove` (exclusão), ambos com billing ativo.
- Testes: `tests/aprovacoes-ui.test.js:124-145` (desvios), `tests/aprovacoes-api.test.js` (admin comum aprova; admin de outro tenant e engenheiro negados), `tests/obra-select-modal.test.js:91-127` (multi-select), `tests/rh-customizavel.test.js:123-137` (módulo `funcionarios`), `tests/escopo-obras-paginas.test.js` (filtro e índice original), `tests/security/rules.test.js`.

### 5. Lacunas / pontos de atenção 🔴

- 🔴 Com o desvio de aprovação ativo, `saveTrabalhador` encerra qualquer edição com `Alteração de cadastro exige aprovação...`; a cascata de identidade e o recálculo retroativo de diária ficam **inalcançáveis no fluxo normal**, restando apenas se `desviarParaAprovacao` não estiver disponível.
- 🔴 O payload de `trabalhador_add` carrega o cadastro completo — incluindo CPF, chave PIX e endereço — para o nó de aprovações; não há redação/sanitização nesse desvio.
- 🔴 O isolamento por obra é exclusivamente no cliente: as rules autorizam a escrita em todo o nó `trabalhadores` do tenant, sem filtro por código de obra.
- 🟡 `renderTrabalhadores` usa `new Date().toISOString()` (UTC) para o mês das faltas, enquanto o restante do sistema adota `America/Sao_Paulo` via `getTodayBR()`; pode divergir no primeiro/último dia do mês.
- 🟡 Presenças são associadas por `trab === cod` **ou** `nome === nome`; nomes repetidos fazem registros alheios entrarem em assiduidade e saldo.
- 🟡 Critérios divergentes: o saldo da tabela usa `financeiro.forn === nome` e `source === 'pre'`, enquanto `tr-last-pay` usa `financeiro.trab === cod` — pagamentos podem aparecer em um e não no outro.
- 🟡 Ao excluir, a cascata não remove nem anonimiza referências em presença/tarefas/financeiro; os históricos ficam órfãos.
- 🟡 O índice exibido na tabela é o índice original do array (necessário para o escopo), mas um sync em tempo real entre o render e o clique pode torná-lo obsoleto.
- 🟡 Não há validação de formato de CPF no cliente (`tr-cpf` é texto livre com placeholder de máscara) e a foto usa upload genérico sem a otimização aplicada às fotos de tarefas.

### 6. Dependências

`auth`/`seguranca-e-rbac` (sessão, claims e rules), `obras` (códigos e escopo), `usuarios-e-cargos` (papel RH e `modulosPermitidos.funcionarios`), `aprovacoes` (`trabalhador_add`/`trabalhador_remove`), `billing-e-planos` (`billingState` e `limiteTrabalhadores`), `presenca-e-ponto` (assiduidade, saldo e filtros), `financeiro-e-pix` (pagamentos e `cleanPixKey`), `tarefas`/`almocos`/`medicao` (cascata de nome).

**Fluxograma:** [`flowcharts/trabalhadores.md`](flowcharts/trabalhadores.md)

---

## Módulo `presenca-e-ponto` 🟢

**Arquivos principais:** `public/pages/presenca.html` (131 linhas), `public/modals/modal-presenca.html` (74), `public/js/app_core.js` (quadro 1488–1595; render 1597–1816; filtros de trabalhador 6049–6106; cálculos 6118–6183; save/edit 6467–6681; lote 6766–6925), `public/js/utils.module.js` (`summarizePresence` 59, `calcWeeklyPendingPayments` 78, `getPresencaCusto` 430, `calcCustosDiarias` 826), `database.rules.json:78-79`, `tests/helpers.test.js`, `tests/dashboard.test.js`, `tests/budget-fixes.test.js`, `tests/report.test.js`, `tests/escopo-obras-paginas.test.js`, `tests/rh-customizavel.test.js`, `tests/security/rules.test.js`.

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `getCurrentWeekDates` (`:1470`) | — | `string[]` | Datas da semana corrente |
| `changeWeek` (`:1488`) | `offset` | `void` | Soma ao `currentWeekOffset` e re-renderiza |
| `renderQuadroSemanal` (`:1493`) | — | `void` | Quadro 7 dias × trabalhadores ativos |
| `openPresenceModal` (`:1580`) | `workerCod, date, existingIdx` | `void` | Abre modal em modo novo ou edição |
| `renderPresenca` (`:1597`) | — | `void` | KPIs, tabela agrupada, totalizadores, pendências e fechamento |
| `filterPresenca` (`:1804`) | `query` | `void` | Busca textual nas linhas já renderizadas |
| `filterTrabByObra` (`:6049`) | — | `void` | Popula trabalhadores ativos da obra no modal |
| `fillTrabInfo` (`:6083`) | — | `void` | Traz função/diária da ficha e esconde HE de informais |
| `calcPresenca` (`:6118`) | — | `void` | Calcula hnorm/hextra/total a partir dos horários |
| `calcTotalManual` (`:6159`) | — | `void` | Recalcula total ao editar horas manualmente |
| `savePresenca` (`:6467`) | `keepOpen` | `Promise<void>` | Grava um ou vários registros e persiste |
| `togglePresencaModo` (`:6602`) | — | `void` | Alterna individual/massa |
| `selectAllTrabs` (`:6620`) | `check` | `void` | Marca/desmarca os checks em massa |
| `editPresenca` (`:6625`) | `idx` | `Promise<void>` | Carrega registro no modal |
| `togglePresenca` (`:6670`) | — | `void` | Esconde horários e zera total quando `Falta` |
| `toggleParcial` / `calcParcial` (`:6683`,`:6693`) | `prefix` | `void` | Exibe campo de pagamento parcial e aviso de saldo |
| `prepareLotePgto` (`:6766`) | `periodo, dataIni, dataFim` | `Promise<void>` | Abre fechamento de folha com PIX |
| `renderLoteTbody` / `updateLoteTotal` (`:6862`,`:6897`) | — | `void` | Lista e totaliza pendências selecionadas |
| `summarizePresence` (`utils.module.js:59`) | `presencaArray` | `array` | Agrupa por data (decrescente) com presentes/faltas/total |
| `calcWeeklyPendingPayments` (`:78`) | `presenca, obras, todayStr` | `array` | Pendências da semana por obra |
| `getPresencaCusto` (`:430`) | `p` | `number` | Custo histórico de uma presença |
| `calcCustosDiarias` (`:826`) | `presenca, options` | `object` | Custo total, pendente e por obra |

**Condicionais não-triviais:**
- `renderQuadroSemanal` só exibe trabalhadores `Ativo` e no escopo; a célula casa por `trab === cod` ou (sem `trab`) `nome === nome`, e ainda exige `trabNaObra(w, record.obra)`.
- `togglePresencaModo` esconde hora extra no modo massa; `fillTrabInfo` esconde quando `vinculo === 'Informal'`.
- `savePresenca` valida data, obra, escopo e trabalhador; bloqueia duplicidade na mesma data por código ou nome legado. Em massa, a duplicidade pula apenas aquele trabalhador; no individual, aborta.
- Se o trabalhador não atua na obra, `savePresenca` acrescenta o código ao campo `obras` da ficha (comparação exata).
- `editIdx >= 0 && !modoMassa` atualiza o registro; qualquer outro caso faz `push`.
- `prepareLotePgto` exige a feature `pix.folha`; só entram registros com `pgtoStatus !== 'Pago'` no intervalo.
- `toggleParcial` mostra `#pr-valpago` somente quando o status é `Parcial`.

**Loops:** 7 dias × trabalhadores no quadro; presenças em `renderPresenca` (normalização, agrupamento, por trabalhador); trabalhadores no `savePresenca` em massa; presenças no `prepareLotePgto` e no `calcWeeklyPendingPayments`.

**Tratamento de erros:** validações com toast; `persistDB` em `try/catch` com aviso de gravação local; `renderPresenca` envolve totalizadores e fechamento por trabalhador em `try/catch` para não quebrar a página.

### 2. Algoritmos e lógica

- 🟢 Quadro semanal começa na segunda-feira (`getDay() === 0` → `-6`) e aplica `currentWeekOffset * 7` dias.
- 🟢 `calcPresenca`: `hnorm = min(saída - entrada, 8)`, `hextra = 0`, `total = diária` se houve horas, `0` caso contrário; `Meio período` fixa `4h` e `diária/2`; `Falta` zera tudo.
- 🟢 `calcTotalManual`: `total = diária + hextra * (diária/8) * 1,5`; para `Informal`, `hextra` é forçado a `0`.
- 🟢 `savePresenca` grava `justif` e `obs` com o mesmo texto e `hrLanc` no formato `pt-BR` HH:MM.
- 🟢 Valor final: `Falta → 0`; `Meio período → diária/2`; vínculo `Informal → diária`; demais → `pr-total` quando > 0, senão diária da ficha.
- 🟢 `summarizePresence` ordena datas de forma decrescente e conta apenas `Presente`/`Falta`; `renderPresenca` mostra as 10 primeiras.
- 🟢 `calcWeeklyPendingPayments` cobre segunda-feira até `today`, admite `Pendente`/`Parcial`/`Atrasado`, deduplica por `data_obra_trab` e desconta `valpago` apenas em `Parcial`.
- 🟢 `getPresencaCusto` prioriza `total` gravado; na ausência, usa a diária histórica gravada (ou a da ficha como fallback) e aplica `diária/2` para meio período e `hextra * (diária/hnorm) * 1,5` para horas extras.
- 🟢 `prepareLotePgto` agrupa por `trab` ou `nome-funcao`, soma `total - valpago` quando `Parcial` e ordena por valor decrescente; cada linha oferece `initiatePixPayment('lote', i)`.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `Presenca`, `PresencaStatus`, `PresencaPagamento`, `PresencaResumo`, `FechamentoLote` e a matriz de acesso.

### 4. Metadados e configurações

- Path RTDB: `tenants/<tenantId>/presenca` (array com índices numéricos).
- Enums: `presenca` (`Presente`, `Falta`, `Meio período`), `pgtoStatus` (`Pendente`, `Pago`, `Parcial`, `Atrasado`).
- Defaults do modal: entrada `07:00`, saída `17:00`, status `Presente`, pagamento `Pendente`.
- `today` é constante de módulo derivada de `getTodayBR()` (`America/Sao_Paulo`); o quadro e `calcWeeklyPendingPayments` usam `new Date()` local.
- Feature gate: `pix.folha` para o fechamento em lote.
- Testes: `tests/helpers.test.js` (sumarização, custo, pendências), `tests/dashboard.test.js` (KPIs e diárias da semana), `tests/budget-fixes.test.js` e `tests/report.test.js` (custos com presença), `tests/escopo-obras-paginas.test.js` (filtro por obra no quadro), `tests/rh-customizavel.test.js` (módulo `presenca`), `tests/security/rules.test.js` (escrita direta de ponto).

### 5. Lacunas / pontos de atenção 🔴

- 🔴 `renderPresenca` **muta** `DB.presenca` ao normalizar registros antigos (`total <= 0` com diária) sem chamar `persistDB()`; a correção existe apenas em memória até outra escrita persistir o nó.
- 🔴 `getPresencaCusto` (`utils.module.js:450`) calcula hora extra com `diária/hnorm`, enquanto os formulários usam `diária/8`; o mesmo lançamento pode gerar custos diferentes na tela e nos relatórios/dashboard.
- 🟡 `today` é calculado uma vez no carregamento do módulo; KPIs de "Hoje" ficam desatualizados se a aba permanecer aberta após a meia-noite.
- 🟡 Quadro semanal e `calcWeeklyPendingPayments` usam `new Date()` do navegador, sem o fuso `America/Sao_Paulo` adotado por `getTodayBR()`.
- 🟡 `calcPresenca` devolve a diária cheia mesmo quando o trabalhador teve menos de 8 horas; `calcTotalManual` e `getPresencaCusto` tratam o caso de forma diversa.
- 🟡 A coluna "Saldo" de cada linha subtrai `valpago` de `total` independentemente de `pgtoStatus`; um registro `Pago` sem `valpago` aparece como pendente na tabela.
- 🟡 Duplicidade em massa é detectada contra o `DB` em memória, mas cada iteração faz `push`; registros recém-inseridos no próprio loop são considerados na checagem seguinte.
- 🟡 `savePresenca` acrescenta a obra ao cadastro do trabalhador em memória como efeito colateral do lançamento, sem registrar quem fez a alteração nem quando.
- 🟡 `openPresenceModal` usa `setTimeout(..., 300)` para preencher trabalhador/data no modo novo; em dispositivos lentos o modal pode aparecer antes da injeção.
- 🟡 `renderLoteTbody` usa a variável global `lotePendentes` sem declará-la localmente e há duas definições idênticas de `window.toggleLoteAll`.

### 6. Dependências

`auth`/`seguranca-e-rbac` (sessão e rules), `obras` (código e escopo), `trabalhadores` (ficha, vínculo e diária), `usuarios-e-cargos` (RH com módulo `presenca`), `billing-e-planos` (`billingState`), `financeiro-e-pix` (`pgtoStatus`, fechamento e PIX), `relatorios-e-dashboard` (`calcCustosDiarias`, KPIs), `almocos` (dados migrados), `aprovacoes` (ponto é escrita direta, sem desvio).

**Fluxograma:** [`flowcharts/presenca-e-ponto.md`](flowcharts/presenca-e-ponto.md)

---

## Módulo `almocos` 🟢

**Arquivos principais:** `public/pages/almocos.html` (122 linhas), `public/modals/modal-almoco.html` (70), `public/js/app_core.js` (bloco 1050–1465: semanas 1053–1085; helpers 1087–1098; quadro 1100–1148; modal 1151–1169; render 1171–1226; KPIs/fechamentos 1228–1294; filtro 1297–1315; fechamento lote 1318–1333; cálculo/save/edit 1335–1465), `public/js/utils.module.js` (categoria `almoco`, custos e resumos financeiros), `database.rules.json:84-85`, `tests/almocos-usabilidade.test.js`, `tests/security/rules.test.js`.

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `getAlmocoWeekDates` (`:1055`) | — | `{date,name,display}[]` | 7 dias de Seg a Dom com `currentAlmocoWeekOffset` |
| `changeAlmocoWeek` (`:1077`) | `offset` | `void` | Soma ao offset e re-renderiza o quadro |
| `almocoJsString` (`:1087`) | `valor` | `string` | Escapa valor para uso seguro dentro de `onclick` |
| `almocoDevido` (`:1093`) | `a` | `number` | `max(0, vtotal - pago)`, com `Pago` → 0 |
| `renderQuadroAlmocos` (`:1100`) | — | `void` | Matriz trabalhadores ativos × 7 dias, com ícones de status |
| `openAlmocoModal` (`:1151`) | `cod, data, existingIdx` | `Promise<void>` | Edição existente ou modal pré-preenchido (setTimeout 300ms) |
| `renderAlmocos` (`:1171`) | — | `void` | Lista filtrada, agrupada e ordenada; dispara quadro, KPIs e fechamentos |
| `renderAlmocosKPI` (`:1228`) | `list` | `void` | 4 KPIs da semana navegada |
| `renderFechamentosAlmocos` (`:1248`) | `list` | `void` | Resumo por obra, por empreiteiro e pendências por obra |
| `filterAlmoco` (`:1297`) | `query` | `void` | Esconde linhas e cabeçalhos de grupos sem linhas visíveis |
| `fecharSemanaAlmocos` (`:1318`) | — | `Promise<void>` | Marca pendentes da semana como `Pago` e persiste |
| `calcAlmocoTotal` (`:1335`) | — | `void` | `al-vtotal = al-qtd * al-vunit` |
| `toggleAlmocoModo` (`:1342`) | — | `void` | Alterna individual/lote e popula checks da obra |
| `selectAllAlmoco` (`:1370`) | `check` | `void` | Marca/desmarca `.al-massa-check` |
| `toggleAlmocoParcial` (`:1374`) | — | `void` | Mostra `al-valpago` somente quando `Parcial` |
| `saveAlmoco` (`:1380`) | `keepOpen` | `Promise<void>` | Valida, grava um ou vários registros e persiste |
| `editAlmoco` (`:1449`) | `idx` | `Promise<void>` | Carrega o lançamento no modal |

**Condicionais não-triviais:**
- `renderQuadroAlmocos` casa um lançamento ao trabalhador por `empreiteiro === nome || cod || equipe`, exige `obraNoEscopoAtual(a.obra)` e `trabNaObra(w, a.obra)`, e mostra `check_circle` se `Pago` ou `restaurant` caso contrário.
- `openAlmocoModal` com `existingIdx >= 0` chama `editAlmoco` e **não** abre o modal de novo; no modo novo preenche `al-obra` com a primeira obra do trabalhador que esteja no escopo **e** exista no `<select>`.
- `toggleAlmocoModo` no modo lote lista apenas trabalhadores `Ativo`, no escopo e em `trabNaObra(t, al-obra.value)`; se vazio, mostra aviso.
- `saveAlmoco` recalcula `vtotal = qtd * vunit` (ignora o campo readonly) e força `valpago = vtotal` quando `Pago`, `0` quando `Pendente`/`Atrasado`.
- Duplicidade: `data + empreiteiro + obra`, ignorando o índice em edição. No individual aborta; em lote pula apenas aquele trabalhador.
- Trabalhador encontrado fora da obra bloqueia o individual e é ignorado no lote (proteção contra manipulação do DOM).
- `almocoDevido`: `Pago` → 0; `Parcial` → `vtotal - valpago`; demais → `vtotal`, sempre com `max(0, ...)`.

**Loops:** 7 dias × trabalhadores no quadro; presenças em `renderAlmocos` (map/filter/sort/agrupamento); empreiteiros no `saveAlmoco` em lote; `DB.almocos` nos KPIs, fechamentos e no fechamento em lote.

**Tratamento de erros:** validações com toast e `return` em data/obra ausentes, obra fora do escopo, sem seleção em lote, empreiteiro vazio e duplicidade; `confirm()` obrigatório antes do fechamento em lote (cancelamento não persiste); `persistDB()` é aguardado mas não envolto em `try/catch` neste módulo.

### 2. Algoritmos e lógica

- 🟢 Semana começa na segunda-feira (`getDay() === 0` → `-6`), aplica `currentAlmocoWeekOffset * 7` e gera objetos com `date` (ISO local), `name` (`Seg`…`Dom`) e `display` (`dd/mm` em pt-BR).
- 🟢 `almocoJsString` escapa `\`, `'`, `\r`, `\n` e `<` (→ `\u003c`) antes de interpolar em `onclick`.
- 🟢 `renderAlmocos` preserva o **índice original** via `map((a,i) => ({...a, _idx: i}))` antes de filtrar/ordenar, para que editar/excluir atinja o registro correto.
- 🟢 Busca considera `fmtDate(data)`, `data` crua, `obName(obra)`, `empreiteiro` e `obs`; ordenação usa `localeCompare` de `data`.
- 🟢 `filterAlmoco` esconde um `group-header` quando nenhuma linha seguinte (até o próximo cabeçalho) está visível.
- 🟢 KPIs da semana navegada: soma de `qtd`, soma de `vtotal`, contagem de lançamentos e soma de `almocoDevido`.
- 🟢 Fechamentos por obra e por empreiteiro acumulam `qtd` e `vtotal`; pendências contam apenas `almocoDevido > 0`.
- 🟢 `fecharSemanaAlmocos` filtra `almocoDevido > 0` na semana, soma o valor, pede `confirm()` e grava `pgtoStatus='Pago'` + `valpago = vtotal` para cada um.
- 🟢 `utils.module.js` classifica o custo de almoço na categoria `almoco` (`detectCategory` por texto contendo `almo`) e o inclui em `buildFinanceEntries`, `getCustos` e resumos (`almocos = sumBy('alm')`).

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `Almoco`, `AlmocoModo`, `AlmocoSemana`, `FechamentoAlmocos` e a matriz de acesso.

### 4. Metadados e configurações

- Path RTDB: `tenants/<tenantId>/almocos` (array com índices numéricos).
- Enums: `pgtoStatus` (`Pendente`, `Pago`, `Parcial`, `Atrasado`), `modo` (`individual`, `massa`), `grupo` (`empreiteiro`, `obra`, vazio), `ordem` (`data_desc`, `data_asc`).
- Defaults do modal: `qtd = 1`, `vunit = 20.00`, `vtotal` calculado readonly, `status = Pendente`, `valpago = 0`.
- Semana navegada é derivada de `new Date()` local, independente de `getTodayBR()`.
- Não há feature gate nem desvio para aprovação: almoço é escrita direta.
- Testes: `tests/almocos-usabilidade.test.js` (contrato da página, quadro 7 dias, clique na célula, ordenação/agrupamento, filtro, KPIs e fechamento em lote com `confirm()`), `tests/security/rules.test.js` (permissões de escrita).

### 5. Lacunas / pontos de atenção 🔴

- 🔴 `fecharSemanaAlmocos` marca os registros como `Pago` e ajusta `valpago`, mas **não cria lançamento financeiro** em `financeiro`; o valor pago pode divergir do fluxo de caixa e dos relatórios que cruzam as coleções.
- 🔴 Não há toast de confirmação após `saveAlmoco`: a variável `salvos` é contada e descartada, e o modal simplesmente fecha (ou reabre em `keepOpen`).
- 🔴 `saveAlmoco` não trata falha de `persistDB()` — diferente de presença/trabalhadores, não há aviso de "salvo localmente, erro na nuvem"; uma falha de gravação passa despercebida.
- 🟡 `getAlmocoWeekDates` usa o fuso local do navegador, enquanto o restante do sistema adota `America/Sao_Paulo` via `getTodayBR()`; pode haver divergência de dias em usuários fora do fuso.
- 🟡 O preenchimento do modal a partir da célula depende de `setTimeout(..., 300)`; em dispositivos lentos os campos podem chegar depois da abertura.
- 🟡 O agrupamento da lista (`chaveGrupo`) retorna `''` quando não há grupo, mas a contagem `contagens` é calculada apenas com `if (grupo)` — consistente, porém dependente de string vazia como sentinela.
- 🟡 `renderAlmocosKPI` e `renderFechamentosAlmocos` usam comparação textual de datas (`a.data >= ini && <= fim`), válida para `YYYY-MM-DD` mas sensível a registros com formato legado diferente.
- 🟡 `renderQuadroAlmocos` casa `empreiteiro` com `nome`, `cod` **ou `equipe`**; equipes com nomes repetidos podem fazer um lançamento aparecer em múltiplas linhas do quadro.
- 🟡 Em modo lote, `data`, `obra`, `qtd`, `vunit`, `vtotal` e `obs` são idênticos para todos os empreiteiros; não há edição individual dentro do lote.
- 🟡 O `datalist#list-equipes` do campo `al-empreiteiro` é preenchido em outro ponto do código (não no bloco de almoços); o teste não cobre essa população.
- 🟡 `deleteItem('almocos', idx)` usa exclusão direta, sem desvio para aprovação, ao contrário de trabalhadores.

### 6. Dependências

`auth`/`seguranca-e-rbac` (sessão, escopo e rules), `obras` (código/nome e escopo), `trabalhadores` (lista de ativos, vínculo por obra, nome/código/equipe), `usuarios-e-cargos` (RH com `modulosPermitidos.almocos`), `billing-e-planos` (`billingState`), `presenca-e-ponto` (padrão de usabilidade do quadro e do fechamento), `financeiro-e-pix` (custos agregados via `utils.module.js`), `relatorios-e-dashboard` (resumo de custos).

**Fluxograma:** [`flowcharts/almocos.md`](flowcharts/almocos.md)

---

## Módulo `compras` 🟢

**Arquivos principais:** `public/pages/compras.html` (16 linhas), `public/modals/modal-compra.html` (27), `public/js/compras_ui.js` (130), `public/js/app_core.js` (render 2362–2422; hidratação 5899–5902; cálculo 6715–6719; save/edit 7216–7298), `public/js/data_core.js` (`COMPRAS_SENSITIVE_FIELDS` 716, `COMPRAS_RESTRICTED_ROLES` 717, `sanitizeComprasForRole` 735–747, aplicação 449 e 790), `public/js/aprovacoes_ui.js`, `functions/aprovacoes.js` (`efeitosCompra` 339–364), `functions/aprovacoes-api.js`, `database.rules.json:126-127,172-175`, `tests/compras-segregacao.test.js`, `tests/aprovacoes-ui.test.js`, `tests/rh-customizavel.test.js`, `tests/security/rules.test.js`.

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `podeVerDadosComerciais` (`compras_ui.js:34`) | — | `boolean` | admin/super/comprador ou RH com módulo `compras` |
| `iniciarCompras` (`:43`) | — | `void` | Abre listener em `comprasPrivadas/<tid>` e re-renderiza |
| `dadoComercial` (`:66`) | `compra, campo` | `any` | Prioriza nó privado, com fallback legado |
| `salvarDadosComerciais` (`:76`) | `id, dados` | `Promise<void>` | `update()` só dos seis campos sensíveis + metadados |
| `compraPublica` (`:98`) | `dados` | `object` | Cópia sem os campos sensíveis (não muta o original) |
| `prepareModalCompra` (`:106`) | `root` | `void` | Esconde grupos comerciais e troca o botão para "Enviar para aprovação" |
| `renderCompras` (`app_core.js:2362`) | — | `void` | Cabeçalho e linhas gerados do mesmo array `colunas` |
| `verEvidenciaCompra` (`:2411`) | `idx` | `Promise<void>` | Vai para `fotos` com filtro da obra da compra |
| `calcCompraTotal` (`:6715`) | — | `void` | `cp-vtotal = cp-qtd * cp-vunit` |
| `saveCompra` (`:7216`) | — | `Promise<void>` | Desvia para aprovação ou grava público + privado |
| `editCompra` (`:7274`) | `idx` | `Promise<void>` | Hidrata campos públicos e comerciais |
| `sanitizeComprasForRole` (`data_core.js:735`) | `db, role, modulos` | `db` | Remove campos sensíveis do DB e do backup local |
| `efeitosCompra` (`functions/aprovacoes.js:339`) | `payload, estado, base, tenantId, aprovacao, agora` | `{updates, antes, depois, resumo}` | Aprovação aplica compra pública + nó privado |

**Condicionais não-triviais:**
- `iniciarCompras` retorna sem listener quando não há papel comercial; quando `tenantAtual === tid && ref`, reusa a inscrição; troca de tenant faz `ref.off()`.
- `renderCompras` inclui `Fornecedor`, `Vl. Total` e `Prazo Entrega` somente se `podeVerDadosComerciais()`; a coluna `Ações` só aparece se `!requerAprovacao()`.
- `prepareModalCompra` esconde os `.form-group` dos seis campos sensíveis e substitui o botão primário quando `requerAprovacao()`.
- `saveCompra`: com `desviarParaAprovacao`, **edição é recusada**; criação remove os seis campos sensíveis por desestruturação e envia `compra_criacao` com `compra: {...publicas, id}`. Sem desvio, grava o registro público via `persistDB()` e depois o privado via `salvarDadosComerciais()`.
- `dadoComercial` só consulta `privadas` para os seis campos sensíveis; `valor !== undefined` distingue "privado com zero" de "ausente" (cai no fallback).
- `efeitosCompra` valida `mat` não vazio e `qtd > 0`, remove campos privados do registro público e grava `comprasPrivadas` a partir de `payload.compraPrivada`.

**Loops:** seis campos sensíveis em `salvarDadosComerciais`, `compraPublica`, `sanitizeComprasForRole` e no desvio; mapeamento de `colunas` para `<th>` e `<td>`; `DB.compras` no render; hidratação campo a campo em `editCompra`.

**Tratamento de erros:** `iniciarCompras` registra `console.warn` com o código do erro de leitura; `salvarDadosComerciais` faz `try/catch` com toast de aviso (a compra pública já foi gravada); `efeitosCompra` lança `compra_invalida` e a aprovação não é aplicada.

### 2. Algoritmos e lógica

- 🟢 Defesa em profundidade: campos comerciais (`forn`, `pixkey`, `vunit`, `vtotal`, `vorc`, `prazo`) são removidos do registro público antes de qualquer gravação, do DB em memória, do backup local e do payload de aprovação.
- 🟢 `comprasPrivadas/<tid>/<id>` é um nó **raiz** separado, com rules próprias que nunca incluem engenheiro/encarregado/mestre.
- 🟢 `renderCompras` deriva cabeçalho e células de um único array `colunas`, eliminando desalinhamento quando o papel muda.
- 🟢 `verEvidenciaCompra` aproveita a página de fotos, aplicando `fotos-obra-filter` e exibindo `etapa` no toast.
- 🟢 `cp-num` é gerado com `nextCod(DB.compras, 'PC')` na abertura do modal; `saveCompra` usa esse número como `id` do registro e como chave do nó privado.
- 🟢 Chave PIX do fornecedor passa por `cleanPixKey` antes de ir para o nó privado.
- 🟢 `efeitosCompra` usa `c.id || aprovacao.id || CP-<timestamp>` e registra `aprovacaoId`/`criadoEm` no nó privado para rastreabilidade.
- 🟢 `buildCloudUpdate` + `_nodeBloqueadoParaRole` impedem que um papel sem acesso comercial sobrescreva o nó `compras` no RTDB, mesmo que o cliente tente.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `Compra`, `CompraPublica`, `DadosComerciaisCompra`, `CompraAprovacao` e a matriz de acesso.

### 4. Metadados e configurações

- Paths RTDB: `tenants/<tenantId>/compras` (array) e `comprasPrivadas/<tenantId>/<id>` (mapa por ID).
- Enums: `status` (`Aguardando`, `Aprovada`, `Pedido Feito`, `Entregue`, `Reprovada`, `Divergência`), `conf` (`''`, `Sim`, `Não`).
- Eventos: `firebaseSync` e `DOMContentLoaded` disparam `iniciarCompras()`; `renderPage('compras')` também chama.
- Feature de aprovação: `compra_criacao` → módulo `compras` no RH (`aprovacoes_ui.js:30`, `functions/aprovacoes.js:35`); prazo de 15 dias com alertas em 7/12/15 dias.
- Testes: `tests/compras-segregacao.test.js` (segregação, fiação, render dinâmico e rules), `tests/aprovacoes-ui.test.js` (redação do payload), `tests/rh-customizavel.test.js` (módulo do RH), `tests/security/rules.test.js` (tipos de aprovação permitidos).

### 5. Lacunas / pontos de atenção 🔴

- 🔴 `saveCompra` envia `compra_criacao` **sem `compraPrivada`**, enquanto `efeitosCompra` espera esse campo para gravar os dados comerciais; compras criadas por aprovação ficam com um nó privado contendo apenas `compraId`, `aprovacaoId` e `criadoEm` — fornecedor, valores e PIX precisam ser preenchidos depois por admin/comprador.
- 🔴 `saveCompra` grava o público (`persistDB`) **antes** de tentar gravar o privado; se `salvarDadosComerciais` falhar, a compra aparece na tabela sem fornecedor/valores e o usuário só recebe um toast de aviso.
- 🔴 `renderCompras` não aplica `obraNoEscopoAtual`: um usuário com escopo limitado a obras específicas ainda vê todos os pedidos do tenant (diferente de presença, almocos e trabalhadores).
- 🟡 `cp-num` é gerado com prefixo `PC` (`nextCod(DB.compras, 'PC')`), mas o fallback de ID em `saveCompra` usa `CP-${Date.now()}` — duas convenções diferentes para a mesma chave.
- 🟡 Com desvio ativo, `saveCompra` bloqueia qualquer edição; não há caminho para que engenheiro/encarregado ajuste quantidade/material de uma compra já solicitada sem um administrador.
- 🟡 A tabela mostra apenas `forn`, `vtotal` e `prazo`; `pixkey`, `vunit` e `vorc` ficam restritos ao modal — decisão intencional, mas o teste confirma que não há coluna para unitário/orçado.
- 🟡 `dadoComercial` usa `compra.id || compra.num` como chave; registros legados sem `id` dependem de `num`, e uma mudança de numeração quebraria o vínculo com o nó privado.
- 🟡 `iniciarCompras` mantém `tenantAtual` em Closure e só reage a `firebaseSync`/`DOMContentLoaded`; troca de tenant fora desses eventos pode deixar o listener apontando para o tid anterior.
- 🟡 `comprasPrivadas` é gravado com `firebase.database().ref(...).update()` direto, fora de `persistDB()`; não participa do debounce nem do controle de modo somente-leitura do cliente (as rules barram no servidor).
- 🟡 O campo `mat` e `qtd > 0` são validados apenas no trigger de aprovação; `saveCompra` não valida material obrigatório no cliente, apesar do `*` no rótulo do modal.

### 6. Dependências

`auth`/`seguranca-e-rbac` (sessão, papéis e rules), `aprovacoes` (`compra_criacao`, redação de payload e trigger), `obras` (código para filtro de evidência), `fotos` (galeria de evidência), `usuarios-e-cargos` (RH com módulo `compras`), `billing-e-planos` (`billingState`), `estoque` (material solicitado), `financeiro-e-pix` (`cleanPixKey` e custos), `relatorios-e-dashboard` (custos de compras).

**Fluxograma:** [`flowcharts/compras.md`](flowcharts/compras.md)

---

## Módulo `estoque` 🟢

**Arquivos principais:** `public/pages/estoque.html` (19 linhas), `public/modals/modal-estoque.html` (17), `public/modals/modal-movimentacao-estoque.html` (280), `public/modals/modal-entrada-estoque.html` (40), `public/js/estoque.module.js` (498), `public/js/app_core.js` (entrada 2267–2320; render 2323–2359; item 7017–7073; legado 7075–7214), `public/js/utils.module.js:1475-1489`, `functions/aprovacoes.js:167-248`, `database.rules.json:101-113`, `tests/estoqueajuste/estoque.test.js`, `tests/security/rules.test.js`, `tests/aprovacoes.test.js`, `tests/aprovacoes-ui.test.js`.

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `normalizarNome` (`estoque.module.js:21`) | `nome` | `string` | lowercase, sem acentos, `-_/\\` → espaço, colapsa espaços |
| `validarFormMovimentacao` (`:36`) | `dados` | `string[]` | Validações puras do modal (testadas) |
| `buscarItemPorId` (`:60`) | `itemId` | `{nome,unidade,quantidade,qtdNoCanteiro}` | Saldo do item por `cod` |
| `buscarItemNoCanteiro` (`:72`) | `itemId` | `object<{obraId,obraNome,quantidade,unidade}>` | Deriva saldo por obra do histórico `movEstoque` |
| `getItemCache` (`:103`) | `itemId` | `object \\| null` | Cache leve nome/unidade/saldo |
| `popularSelectItens` (`:111`) | `preSelected` | `void` | `<select id=mov-item>` com saldo no rótulo |
| `popularSelectObras` (`:122`) | — | `void` | Quatro selects de obra, só status ativos |
| `abrirModalMovimentacao` (`:153`) | `itemIdPreSelecionado` | `void` | Reset + popular + `display:flex` |
| `selecionarTipoMov` (`:180`) | `tipo` | `void` | Campos condicionais, rótulo do botão, `onItemChange` |
| `onItemChange` (`:211`) | — | `Promise<void>` | Atualiza saldo de estoque e canteiro |
| `validarQuantidadeInput` (`:257`) | — | `void` | Erro em tempo real quando saída excede saldo |
| `confirmarMovimentacao` (`:269`) | — | `Promise<void>` | Desvio ou aplicação direta de saída/retorno/transferência/ajuste |
| `editarMovimentacaoNovoModal` (`:384`) | `idx` | `void` | Pré-popula o modal unificado em modo edição |
| `coletarDadosModal` (`:453`) | — | `object` | Lê tipo, item, qtd, motivo e obras de origem/destino |
| `validarFormMovimentacaoUI` (`:466`) | `dados` | `string[]` | Versão UI das validações |
| `abrirModalEntrada` (`app_core.js:2267`) | — | `void` | Popula itens e abre `modal-entrada-estoque` |
| `confirmarEntrada` (`:2288`) | — | `Promise<void>` | Desvio ou entrada direta com `movEstoque` |
| `renderEstoque` (`:2323`) | — | `void` | Tabela com saldo, status e valor total |
| `renderMovEstoque` (`:2344`) | — | `void` | Histórico com badge por tipo |
| `saveEstoque` (`:7017`) | — | `Promise<void>` | Cadastro/edição de material com checagem de duplicidade |
| `editEstoque` (`:7061`) | `idx` | `Promise<void>` | Hidrata modal de item |
| `saveMovEstoque` (`:7075`) | — | `Promise<void>` | Modal legado, com transferência dupla |
| `editMovEstoque` (`:7168`) | `idx` | `Promise<void>` | Roteia edição para legado ou modal unificado |
| `calcSaldo` (`utils.module.js:1475`) | `item` | `number` | `entrada - saida` |
| `estoqueStatus` (`:1481`) | `item` | `enum` | `SEM ESTOQUE`/`CRÍTICO`/`BAIXO`/`NORMAL` |
| `efeitosMovimentacao` (`functions/aprovacoes.js:167`) | `payload, estado, base, agora` | `{updates,antes,depois,resumo}` | Aplica saldos no servidor após aprovação |

**Condicionais não-triviais:**
- `saveEstoque` bloqueia duplicata por `obra + normEstoqueNome(mat)` apenas quando `editIdx < 0`; na edição preserva `saida` do registro original.
- `estoqueStatus`: `saldo <= 0` → `SEM ESTOQUE`; `<= min` → `CRÍTICO`; `<= min*1.5` → `BAIXO`; senão `NORMAL`. A cor da tabela usa `saldo <= min` (vermelho), `<= min*1.5` (laranja), senão verde.
- `popularSelectObras` aceita apenas `ativa`, `em andamento`, `planejada` e `execucao`.
- `selecionarTipoMov` não oferece `entrada` — o botão é bloqueado e redireciona para "Nova Entrada". Somente `ajuste` exige motivo ≥ 10 caracteres.
- `confirmarMovimentacao` com desvio ativo: edição é recusada; `ajuste` mapeia para `Entrada` quando `diff > 0` e `Saída` quando `diff < 0`, enviando `qtd = |diff|`.
- Sem desvio: `retorno` limita ao saldo no canteiro (`saídas - retornos` da obra); `transferencia` limita ao saldo e exige origem ≠ destino; `ajuste` substitui o saldo (`entrada += quantidade - saldo`).
- `buscarItemNoCanteiro` ignora saldos `<= 0` e tipos que não contêm `saída`/`saida` nem são `retorno` exato.
- `editMovEstoque` mantém `Entrada` e `Transferência (Entrada)` no modal legado; os demais vão para `editarMovimentacaoNovoModal`.
- `efeitosMovimentacao` valida `codMat` e `qtd > 0`, exige material existente e, para Transferência/Saída, `qtd <= saldo`.

**Loops:** itens em `popularSelectItens`, `abrirModalEntrada`, `saveEstoque` (duplicidade); movimentos em `buscarItemNoCanteiro`, `confirmarMovimentacao` (retorno), `renderMovEstoque`; seis campos sensíveis não se aplicam aqui; `movimentos.forEach` em `efeitosMovimentacao` para gravar em `movEstoque/<índice>`.

**Tratamento de erros:** `validarFormMovimentacao`/`validarFormMovimentacaoUI` retornam listas exibidas em `#mov-erros-lista`; `confirmarMovimentacao` envolve tudo em `try/catch` com toast `Erro inesperado.`; `persistDB()` é aguardado sem `try/catch` nos fluxos legados; trigger lança `movimentacao_invalida`, `material_inexistente`, `destino_invalido`, `saldo_insuficiente` e `tipo_movimentacao_invalido`.

### 2. Algoritmos e lógica

- 🟢 `saldo = parseFloat(entrada) - parseFloat(saida)`, com `|| 0` para tolerar campos ausentes.
- 🟢 `normalizarNome` remove acentos via NFD + regex de diacríticos e transforma `-`, `_`, `/` e `\\` em espaço antes de colapsar.
- 🟢 `buscarItemNoCanteiro` reconstrói o saldo por obra a partir do histórico, mantendo a UI consistente com a validação de retorno em `confirmarMovimentacao`.
- 🟢 Transferência legada (`saveMovEstoque`) cria item destino com `cod: MAT-<timestamp><random>` quando não existe (mesmo `mat`/`unid`/obra), e grava par Saída/Entrada.
- 🟢 Trigger de aprovação usa `proximoIndice(estado.movEstoque)` para gravar cada movimento em uma chave sequencial do RTDB e grava `antes`/`depois` do material para auditoria.
- 🟢 Engenheiro decide apenas `movimentacao_estoque`, com notificação obrigatória ao admin (`aprovacoes_ui.js:133`).
- 🟢 Rules: leitura de `estoque` exige mesmo tenant com billing ≠ `bloqueado`; escrita exige billing ativo e papel admin/emailAdmin/comprador/RH com módulo `estoque`; `movEstoque` não aceita comprador.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `ItemEstoque`, `MovimentacaoEstoque`, `MovimentacaoModal`, `EntradaEstoque`, `MovimentacaoAprovada` e a matriz de acesso.

### 4. Metadados e configurações

- Paths RTDB: `tenants/<tenantId>/estoque` (array) e `tenants/<tenantId>/movEstoque` (array/mapa); aprovação em `tenants/<tid>/aprovacoes` com `tipo = movimentacao_estoque`.
- Enums: `TIPO_MOV` (`entrada`, `saida_canteiro`, `retorno`, `transferencia`, `ajuste`, `exclusao`); tipos históricos (`Entrada`, `Saída`, `Retorno`, `Transferência (Saída)`, `Transferência (Entrada)`, `Ajuste`); status (`SEM ESTOQUE`, `CRÍTICO`, `BAIXO`, `NORMAL`).
- Obra aceita no modal: `ativa`, `em andamento`, `planejada`, `execucao`.
- Módulo do RH para aprovação: `estoque` (`aprovacoes_ui.js:24`, `functions/aprovacoes.js:29`, `functions/aprovacoes-api.js:22`).
- Testes: `tests/estoqueajuste/estoque.test.js` (normalização e validações puras), `tests/security/rules.test.js:73-77,313-338,373-376`, `tests/aprovacoes.test.js:33`, `tests/aprovacoes-ui.test.js:126,132`, `tests/rh-customizavel.test.js:60,80`.

### 5. Lacunas / pontos de atenção 🔴

- 🔴 Transferência no modal unificado (`confirmarMovimentacao:360-364`) debita a origem e grava **apenas** `Transferência (Entrada)` na obra destino, sem creditar/criar o item de destino em `DB.estoque`. O modal legado e o trigger gravam o par completo — caminhos divergentes para a mesma operação.
- 🔴 Edição pelo modal unificado (`confirmarMovimentacao:324-341`) atualiza o registro sem recalcular `DB.estoque`; mudar quantidade/tipo/obra de uma movimentação já aplicada deixa saldo e histórico inconsistentes.
- 🔴 `buscarItemNoCanteiro` não reconhece `Transferência (Entrada)` nem `Transferência (Saída)`: o saldo exibido no canteiro e o limite de retorno ignoram transferências.
- 🟡 `saveEstoque` usa `normEstoqueNome` local em vez de `window.normalizarNome`; o helper testado não é reaproveitado e as regras podem divergir no futuro.
- 🟡 `confirmarEntrada` mistura datas: payload de aprovação usa UTC (`new Date().toISOString()`), registro direto usa `today` (`America/Sao_Paulo`).
- 🟡 `confirmarMovimentacao` usa `new Date().toISOString().split('T')[0]` para `data` (UTC), enquanto `confirmarEntrada` usa `today`; movimentos no mesmo dia podem receber datas diferentes perto da meia-noite.
- 🟡 `Exclusão` existe em `TIPO_MOV` mas não é oferecida nem validada em nenhum modal — valor órfão.
- 🟡 `exibirErrosModal` interpole mensagens em HTML sem escape; os textos são todos literais do código, mas mensagens derivadas de `item.unid` (em `validarQuantidadeInput`) também passam por `textContent`, enquanto o erro de estoque insuficiente usa `innerHTML`.
- 🟡 `saveMovEstoque` atualiza `e.saida += qtd` sem validar saldo quando `e` não existe (`if (e)`), registrando movimento órfão.
- 🟡 A tabela de movimentações usa `m.tipo.includes('Entrada')` sem normalizar tipo; registros legados com caixa diferente podem cair no badge roxo.
- 🟡 Rules de `movEstoque` não incluem comprador, embora comprador possa escrever em `estoque` — entrada direta de comprador gera movimento que as rules podem rejeitar.

### 6. Dependências

`auth`/`seguranca-e-rbac` (sessão, papéis e rules), `obras` (código/nome e filtro de status), `aprovacoes` (`movimentacao_estoque`, trigger e decisão do engenheiro), `compras` (material solicitado e recebimento), `usuarios-e-cargos` (RH com `modulosPermitidos.estoque`), `billing-e-planos` (`billingState`), `financeiro-e-pix` (`custo` e `vtotal`), `relatorios-e-dashboard` (valores de estoque).

**Fluxograma:** [`flowcharts/estoque.md`](flowcharts/estoque.md)

---

## Módulo `financeiro-e-pix` 🟢

**Arquivos principais:** `public/pages/financeiro.html` (155 linhas), `public/modals/modal-financeiro.html` (29), `public/modals/modal-pix-view.html` (38), `public/modals/modal-lote.html`, `public/js/app_core.js` (período/seleção/baixas 2426–3186; Fechar Folha 6766–6934; save/edit 7300–7406), `public/js/utils.module.js` (categorias 116–122; filtro 454–480; fonte única 486–667), `public/js/pix_logic.js` (115), `public/js/pix_ui.js` (178), `functions/aprovacoes.js` (efeitos financeiros), `database.rules.json:120-121`, `tests/pix.test.js`, `tests/aprovacoes.test.js`, `tests/plan-features.test.js`, `tests/aprovacoes-ui.test.js`.

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `toggleFinCustomDates` (`app_core.js:2426`) | — | `void` | Alterna campos de intervalo customizado e esconde mês/ano |
| `applyFinCustomPeriod` (`:2452`) | — | `void` | Valida `ini <= fim` e re-renderiza |
| `FIN_MAIN_CATEGORIES` (`:2467`) | — | `string[]` | `mao-de-obra`, `empreiteiro`, `almoco`, `material` |
| `finState` (`:2469`) | — | `object` | categoria, status, busca, groupBy, página, tamanho, seleção, expansão |
| `finKey` (`:2483`) | `entry` | `string` | Identificador estável `source:idx` |
| `finCategoryMeta` / `finCategoryBadgeClass` (`:2485,2489`) | `key` | `object` / `string` | Rótulo/ícone e classe do badge |
| `finObraName` / `finText` (`:2499,2504`) | `cod` / `v` | `string` | Nome da obra (ou `Geral`) e texto escapado |
| `finEntriesMap` (`:2509`) | — | `Map` | Índice das entradas de `window._finSummary.all` |
| `finDerivedStatus` / `finStatusMatches` / `finBuscaMatches` (`:2520,2528,2537`) | `entries` / `entry` | `enum` / `boolean` | Status agregado, filtro de status e busca textual |
| `finValueHtml` (`:2546`) | `entry` | `string` | Valor com subtítulo Pago/A pagar/Pago parcial |
| `renderFinKpis` / `renderFinTabs` (`:2557,2588`) | `summary` | `void` | Cards de total/pago/a pagar e abas por categoria |
| `finSelectedEntries` / `renderFinBulkBar` (`:2607,2612`) | — | `array` / `void` | Selecionados e barra de ações em lote |
| `finEntryActions` / `finDetailRow` / `finEntryRow` (`:2639,2664,2681`) | `entry` | `string` | Menu de ações, detalhe expansível e linha |
| `finLaborGroupHtml` / `finGroupHeaderHtml` / `finBuildUnits` (`:2712,2752,2768`) | `entries` | `string` / `array` | Agrupamento por tipo ou obra |
| `renderFinPagination` / `renderFinTable` (`:2835,2851`) | `summary` | `void` | Paginação e tabela filtrada/ordenada |
| `renderFinanceiro` (`:2904`) | — | `void` | Orquestra período, sumarização e renderização |
| `filterFinanceiro` (`:2983`) | — | `void` | Lê status/busca e reinicia página |
| `toggleFinSelect` / `toggleFinGroupSelection` / `clearFinSelection` (`:3028,3034,3044`) | `key, checked` | `void` | Seleção individual, por grupo e limpeza |
| `toggleFinDetail` / `toggleFinLabor` / `toggleFinGroupCollapse` (`:3050,3056,3064`) | `key\|índice` | `void` | Expansão de detalhe, mão de obra e grupos |
| `finApplyPaid` (`:3073`) | `entry` | `boolean` | Baixa direta nas quatro tabelas de origem |
| `finAfterPayment` (`:3106`) | — | `Promise<void>` | Limpa seleção, persiste e re-renderiza |
| `markFinEntryPaid` / `markFinUnitPaid` / `bulkMarcarPago` (`:3113,3120,3130`) | `key\|índice` | `Promise<void>` | Baixa individual, por grupo e em lote |
| `bulkPagarPix` / `openNextFinPix` / `cancelFinPixQueue` (`:3139,3147,3161`) | — | `void` | Fila de PIX a partir da seleção |
| `deleteFinEntry` / `clearFinDateFilter` (`:3165,3173`) | `source, idx` | `void` | Exclusão na origem e volta ao mês corrente |
| `prepareLotePgto` (`:6766`) | `periodo, ini, fim` | `Promise<void>` | Fecha folha de presença e monta `lotePendentes` |
| `renderLoteTbody` / `updateLoteTotal` / `toggleLoteAll` (`:6862,6897,6891`) | — | `void` | Tabela, total e seleção do lote |
| `changeLotePeriodoCustom` / `applyCustomLotePeriod` (`:6914,6928`) | `el` | `void` | Datas customizadas do fechamento |
| `saveFinanceiro` / `editFinanceiro` (`:7300,7386`) | `idx` | `Promise<void>` | Lançamento manual com desvio de aprovação |
| `FIN_CATEGORIES` (`utils.module.js:116`) | — | `object[]` | Cinco categorias canônicas |
| `buildFinanceDateFilter` (`:454`) | `options` | `function` | Filtro por intervalo, ano/mês, tipo ou sem filtro |
| `buildFinanceEntries` (`:486`) | `fin, pres, med, alm, options` | `object` | Fonte única: normaliza as quatro origens |
| `summarizeFinanceCosts` / `summarizeFinance` (`:659,674`) | idem | `object` | Aliases compatíveis com assinatura antiga e nova |
| `cleanPixKey` (`pix_logic.js:6`) | `key, type` | `string` | Normaliza CPF/CNPJ/telefone/e-mail/aleatória |
| `generatePixPayload` (`:56`) | `key, amount, receiver, city, description, keyType` | `string\|null` | BRCode estático com CRC16 |
| `crc16` (`:101`) | `str` | `string` | CRC16 CCITT 0x1021 em hex maiúsculo |
| `initiatePixPayment` (`pix_ui.js:8`) | `source, idx, opts` | `Promise<void>` | Resolve chave/valor e abre modal PIX |
| `confirmPixPaid` / `cancelPixPayment` (`:112,170`) | — | `Promise<void>` / `void` | Confirma ou cancela a transação ativa |

**Condicionais não-triviais:**
- `buildFinanceEntries` usa `real > 0 ? real : prev` como valor efetivo; desconto é negativado e tem `pendente = 0`; medição com aprovação `Rejeitada` é descartada.
- `jaPago`: `Pago` → valor total; `Parcial` → `valpago` limitado ao total; demais → `0`. `pendente = max(0, valor - jaPago)`, exceto desconto.
- `finStatusMatches`: `pago` exige `status === 'Pago'`; `a-pagar` exige não pago e `pendente > 0`; `parcial`/`atrasado` comparam status exato.
- `finDerivedStatus`: vazio → `Pendente`; todos pagos → `Pago`; algum `jaPago > 0` → `Parcial`; algum atrasado → `Atrasado`; senão `Pendente`.
- `renderFinanceiro` aborta se `#fin-month`, `#fin-year` ou `#fin-view-type` não existem; popula os três anos correntes apenas uma vez; `view === 'custom'` com datas válidas usa `dataInicio/dataFim`, senão `ano/mes`.
- `renderFinTable` filtra categoria, status e busca, ordena por data desc/índice e agrupa por `tipo` ou `obra`; itens de mão de obra própria ganham subgrupo expansível por beneficiário/semana.
- `saveFinanceiro`: `Pago` → `valpago = real > 0 ? real : prev`; `Pendente`/`Atrasado` → `valpago = 0`; `Parcial` mantém o valor digitado e exibe "Falta Pagar".
- `saveFinanceiro` com desvio ativo: se é edição e o status mudou, envia `financeiro_status`; caso contrário envia `financeiro_lancamento` (removendo `forn`) com `indice` opcional.
- `initiatePixPayment` exige `requireFeature('pix.folha')`; fontes `pre`, `lote` e `fin` usam chave de `DB.trabalhadores` (por `cod`/`nome` ou `f.pixkey`), enquanto `med` e `alm` não têm chave e caem no `prompt`.
- `confirmPixPaid` soma `pago + amount` para `pre`/`med`/`fin`/`alm`; para `lote` marca todos os índices como `Pago` e remove o item do fechamento.
- `prepareLotePgto` agrupa presenças pendentes por `trab` ou `nome+funcao`, calcula `devido = total - pago parcial`, ordena por valor desc e guarda em `window.lotePendentes`.

**Loops:** quatro `forEach` em `buildFinanceEntries` (fin/pre/med/alm) e dois de agregação (`entries`, `FIN_CATEGORIES`); presenças em `prepareLotePgto`; entradas selecionadas em `finSelectedEntries`, `bulkMarcarPago` e `bulkPagarPix`; unidades em `finBuildUnits`; `for` de 8 bits em `crc16`.

**Tratamento de erros:** `applyFinCustomPeriod` e `changeLotePeriodoCustom` validam datas com toast e `return`; `renderFinanceiro` usa fallback `{all:[], byCategory:{}, kpis zerados}` quando `summarizeFinanceCosts` não está disponível; `cleanPixKey` falha fechada para `''`; `generatePixPayload` retorna `null` sem chave; `initiatePixPayment` avisa quando valor ≤ 0 ou payload vazio; QR remoto tem `onerror` com fallback textual.

### 2. Algoritmos e lógica

- 🟢 Fonte única de verdade: `summarizeFinanceCosts` consolida manual, presença, medição e almoços, preservando `source`/`idx` para rastrear a origem de cada baixa.
- 🟢 `finKey = source:idx` permite selections estáveis mesmo com categorias mudando; seleções inválidas para o período são removidas em cada render.
- 🟢 BRCode segue o padrão BC: `00=01`, `26` com GUI `br.gov.bcb.pix` + chave + descrição (≤25), `52=0000`, `53=986`, `54=valor`, `58=BR`, `59=nome` (≤25), `60=cidade` (≤15), `62` com TXID `***`, `6304` + CRC16.
- 🟢 `cleanPixKey` infere tipo (e-mail, UUID/32 hex, telefone, CPF, CNPJ, aleatória) quando não informado e prefixa `+55` em telefones nacionais.
- 🟢 Fechamento de folha cobra apenas diárias de presença não pagas no intervalo e lida com folgas/feriados via `descontados`.
- 🟢 Aprovação no servidor: `financeiro_lancamento` cria/substitui com validação de integridade; `financeiro_status` troca somente status/`valpago` com índice válido — `tests/aprovacoes.test.js:190-217`.
- 🟡 `FIN_CATEGORIES` inclui `outros`, mas `FIN_MAIN_CATEGORIES` (cards) não: `outros` só aparece quando `count > 0`.
- 🟡 `renderFinTable` depende de `window._finUnits` para ações de grupo; índices de grupo são posições da última renderização.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `LancamentoFinanceiro`, `FinanceEntry`, `FinState`, `PixTransaction`, `LotePendente`, `PixPayload` e a matriz de acesso.

### 4. Metadados e configurações

- Paths RTDB: `tenants/<tenantId>/financeiro` (array), além das origens `presenca`, `medicao` e `almocos`; aprovações em `tenants/<tid>/aprovacoes` com `tipo` `financeiro_lancamento` ou `financeiro_status`.
- Enums: categorias `mao-de-obra`/`empreiteiro`/`almoco`/`material`/`outros`; status `Pago`/`Parcial`/`Pendente`/`Atrasado`; filtros `pago`/`a-pagar`/`parcial`/`atrasado`; agrupamento `tipo`/`obra`; view `mes`/`custom`; períodos `semana`/`quinzenal`/`mes`/`todas`/`custom`.
- Feature gate: `pix.folha` protege Fechar Folha, PIX em lote, PIX individual e botões PIX da tabela (`tests/plan-features.test.js:84`, `tests/aprovacoes-ui.test.js:129,147`).
- QR Code: serviço externo `api.qrserver.com` com fallback Copia e Cola; `tests/pix.test.js` cobre limpeza de chave e BRCode.

### 5. Lacunas / pontos de atenção 🔴

- 🔴 `finApplyPaid` grava `valpago = entry.valor` (total), sem somar pagamentos parciais, enquanto `confirmPixPaid` soma `pago + amount`. A mesma baixa produz valores diferentes conforme o caminho.
- 🔴 `saveFinanceiro` desvia edições que só mudam status para `financeiro_status` e qualquer outra alteração para `financeiro_lancamento` — dois contratos de aprovação para o mesmo formulário.
- 🟡 `prepareLotePgto`/Fechar Folha cobre somente `presenca`; o PIX individual cobre também `med`, `alm` e `fin`, mas não há fila unificada para esses casos.
- 🟡 `med` e `alm` não possuem chave PIX própria: `initiatePixPayment` depende de `prompt`, o que quebra a automação em lote.
- 🟡 `toggleFinCustomDates` e os defaults de 30 dias (financeiro) e 7 dias (lote) usam `new Date()`/ISO (UTC), diferente de `getTodayBR()` usado em outros módulos.
- 🟡 O QR Code depende de serviço externo; sem rede, o usuário só pode usar Copia e Cola.
- 🟡 Descontos (`pendente = 0`) nunca aparecem em `a-pagar` nem na barra de baixas, embora tenham `valor` negativo — o KPI `total` pode ficar negativo.
- 🟡 `toggleFinSelect` chama `renderFinanceiro()` a cada clique, recalculando toda a sumarização e recriando a tabela.
- 🟡 `financeiro` não tem `.read` explícito nas rules e `comprador` não consta na escrita, embora possa escrever em `estoque`.
- 🟡 `initiatePixPayment` usa `f.pixkey`, que não é gravado por `saveFinanceiro` — só funciona para registros legados/importados ou via fallback no trabalhador.

### 6. Dependências

`auth`/`seguranca-e-rbac` (sessão, papéis e feature gate), `obras` (código/nome), `presenca-e-ponto` (diárias e custo), `medicao` (serviços e aprovação), `almocos` (valores), `trabalhadores` (chave PIX), `aprovacoes` (`financeiro_lancamento` e `financeiro_status`), `billing-e-planos` (`billingState`), `relatorios-e-dashboard` (re-render após baixa), `plan-features` (`pix.folha`).

**Fluxograma:** [`flowcharts/financeiro-e-pix.md`](flowcharts/financeiro-e-pix.md)

---

## Módulo `orcamento` 🟢

**Arquivos principais:** `public/pages/orcamento.html` (32), `public/modals/modal-orcamento.html` (22), `public/js/app_core.js` (render/filtro 3229–3314; integração com medição 3832–3934; vínculo 4199–4240; save/edit 7408–7489), `public/js/utils.module.js` (categorias 143–177; ID/migração 199–296; chaves 285–296; `buildMedicaoResumo` 304+; `buildOrcamentoBoard` 689–799; compatibilidade 1448–1472), `functions/aprovacoes.js:316-337`, `database.rules.json:123-124,139-144`, `tests/budget-fixes.test.js`, `tests/security/rules.test.js`.

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `orcEsc` / `orcPct` (`app_core.js:3229,3233`) | `v` / `value` | `string` | Escape HTML e percentual com 1 casa ou `—` |
| `renderOrcamento` (`:3237`) | — | `void` | Repopula filtro de obra, monta grupos e tabela |
| `filterOrcamento` (`:3297`) | — | `void` | Busca textual escondendo linhas e grupos |
| `medicaoBudgetLines` (`:3832`) | `obra` | `array` | Serviços do orçamento com `_idx` para a medição |
| `populateMedicaoFiltroEtapas` (`:3838`) | — | `void` | Etapas vindas de orçamento + medição |
| `confirmMedicaoVinculo` (`:4199`) | `idx` | `Promise<void>` | Remove `serviceIdReview` da medição escolhida |
| `calcOrcTotal` (`:7408`) | — | `void` | `vtotal = qtd * vunit` no modal |
| `saveOrcamento` (`:7415`) | — | `Promise<void>` | Cria/edita serviço com desvio de aprovação |
| `editOrcamento` (`:7470`) | `idx` | `Promise<void>` | Hidrata modal, aceitando `subEtapa` legado |
| `categorizeFinanceType` (`utils.module.js:143`) | `tipo` | `enum` | Mapeia tipo de custo para categoria financeira |
| `categorizeBudgetItem` (`:159`) | `o` | `enum` | Previsto cai na categoria do realizado |
| `parseEditIdx` (`:169`) | `v` | `number` | `-1` para índice inválido; `0` é edição |
| `normalizeAprovacao` / `medicaoAprovacao` (`:180,188`) | `v` / `m` | `enum` | `Aprovada`/`Rejeitada`/`Pendente`; legado = `Aprovada` |
| `normalizeServiceKey` (`:193`) | `o` | `string` | Chave legada `obra|etapa|desc` normalizada |
| `newServiceId` (`:200`) | — | `string` | UUID ou `svc-<base36>-<random>` |
| `sameServiceHint` (`:207`) | `a,b` | `boolean` | Comparação textual normalizada não vazia |
| `migrateServiceIds` (`:221`) | `db` | `db` | Migração idempotente para vínculo por ID |
| `budgetServiceKey` (`:285`) | `o` | `string` | ID estável primeiro, texto só no legado |
| `medicaoServiceKey` (`:291`) | `m` | `string` | `serviceId` → `orcKey` → chave textual |
| `buildMedicaoResumo` (`:304`) | `db, obraCod, options` | `object` | Produção acumulada por serviço |
| `buildOrcamentoBoard` (`:689`) | `db, options` | `{obra,grupos,linhas,totais}` | Board previsto/medido/pago |
| `calcBudgetProgress` (`:1448`) | `orcamento, financeiro, compras, db` | `array` | Compatibilidade: progresso por item |
| `efeitosOrcamento` (`functions/aprovacoes.js:316`) | `payload, estado, base, aprovacao, agora` | `object` | Aplica criação/edição aprovada no trigger |

**Condicionais não-triviais:**
- `renderOrcamento` preserva o filtro anterior se ainda existir; caso contrário, seleciona a primeira obra quando há obras e nada estava selecionado.
- `renderOrcamento` usa `buildOrcamentoBoard(DB, {obra})` com fallback `{grupos:[], totais zerados}`; `uiEmptyState` aparece quando não há grupos.
- `filterOrcamento` esconde cabeçalho/subtotal/linha `orc-avulso` de um grupo quando nenhum serviço dele está visível.
- `saveOrcamento` preserva `id` do item anterior; usa `newServiceId()` apenas na criação; sempre apaga `vreal`.
- Aviso de unidade divergente compara `obra` exata e `etapa`/`desc` normalizadas, ignorando o próprio índice em edição; exige unidade não vazia nos dois lados.
- `parseEditIdx` devolve `-1` para `undefined`, vazio ou não numérico, mas `0` continua sendo edição.
- `categorizeBudgetItem` promove `mao-de-obra` → `empreiteiro` quando há empreiteiro preenchido; material/equipamento permanecem `material`.
- `budgetServiceKey` prioriza `o.id`; `medicaoServiceKey` prioriza `m.serviceId`, depois `m.orcKey`, depois chave textual.
- `migrateServiceIds`: candidato único vincula direto; múltiplos usam score (subetapa 4, frente 3, equipe/empreiteiro 2) e marcam `serviceIdReview` em empate/score zero; sem candidato remove `serviceId` inválido.
- `buildOrcamentoBoard` filtra orçamento e entradas financeiras por obra; `pct = medidoQtd/qtd*100` ou `null` quando `qtd <= 0`.
- Custos sem `serviceId` entram em `outrosPorEtapa` e são atribuídos uma única vez ao grupo raiz da etapa — nunca repetidos em subetapas.
- `efeitosOrcamento`: `criar === true` não exige índice válido; sempre recalcula `vtotal = qtd * vunit` e grava `aprovacao = 'Aprovado'`, `aprovadoPor` e `aprovadoEm`.

**Loops:** serviços em `renderOrcamento`, `buildOrcamentoBoard`, `buildMedicaoResumo` e `migrateServiceIds`; grupos em `buildOrcamentoBoard` (ordenação e custos sem vínculo); entradas financeiras em `buildOrcamentoBoard`; candidatos em `migrateServiceIds`.

**Tratamento de erros:** `efeitosOrcamento` lança `servico_inexistente` para índice inválido sem `criar`; `saveOrcamento` usa `try` implícito do `desviarParaAprovacao` e toast de aviso; `migrateServiceIds` falha fechada quando não há arrays de orçamento/medição; escape HTML em `orcEsc` e `escHtml` no aviso de unidade (`tests/budget-fixes.test.js:231-237`).

### 2. Algoritmos e lógica

- 🟢 Separação de responsabilidades: orçamento guarda só previsto (`qtd`, `vunit`, `vtotal`); medido vem de `buildMedicaoResumo` e pago/a pagar de `buildFinanceEntries`.
- 🟢 `categorizeBudgetItem` corrige assimetria histórica: serviço com empreiteiro é categorizado como `empreiteiro` no previsto para casar com a medição no realizado (`tests/budget-fixes.test.js:68-93`).
- 🟢 `buildOrcamentoBoard` usa `Map` por `serviceId` para ratear pago/a pagar sem duplicar custos avulsos; a chave canônica do serviço é o ID, não texto.
- 🟢 `buildMedicaoResumo` calcula `qacum` com histórico completo (fora do filtro de período) e `fisico` ponderado pelo valor; medições `Rejeitadas` não contam.
- 🟢 `migrateServiceIds` é idempotente: IDs já válidos são preservados e a chave antiga migrada para `orcKey`.
- 🟢 `calcBudgetProgress` mantém compatibilidade com chamadores antigos, delegando ao board com `db` completo.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `ServicoOrcamento`, `LinhaOrcamento`, `GrupoOrcamento`, `ResumoMedicao` (vínculo) e `DesvioOrcamento` e a matriz de acesso.

### 4. Metadados e configurações

- Paths RTDB: `tenants/<tenantId>/orcamento` (array); aprovações em `tenants/<tid>/aprovacoes` com `tipo = orcamento_fechamento`.
- Enums: `tipo` (`Mão de obra`, `Material`, `Empreiteiro`, `Equipamento`), categorias (`mao-de-obra`, `empreiteiro`, `almoco`, `material`, `outros`), aprovação (`Aprovada`, `Rejeitada`, `Pendente`).
- Marcadores de vínculo: `serviceId`, `orcKey`, `serviceIdReview` em medições.
- Testes: `tests/budget-fixes.test.js` (categorização, relatório Timbumba, orçamento parcial, migração, `parseEditIdx`, `saveOrcamento`, `confirmMedicaoVinculo`), `tests/security/rules.test.js:315,323`.

### 5. Lacunas / pontos de atenção 🔴

- 🔴 `renderOrcamento` não restringe ações por obra/papel na UI: botões Editar/Excluir aparecem para qualquer usuário que veja a página, embora as rules neguem a escrita direta.
- 🔴 `saveOrcamento` sempre desvia quando `desviarParaAprovacao` existe — inclusive para admin —, enquanto admins poderiam gravar direto em outros módulos; o comportamento depende da decisão do helper.
- 🟡 `efeitosOrcamento` aceita `payload.item` sem revalidar unicidade de ID/obra/etapa/descrição nem o aviso de unidade divergente feito no cliente.
- 🟡 `buildOrcamentoBoard` chama `buildFinanceEntries` sem filtro e só filtra por obra depois; em bases grandes isso recalcula todas as origens a cada render.
- 🟡 `pct` usa quantidade medida (`medidoQtd`) e não valor, enquanto o board mostra `medidoValor` — pode haver divergência entre % de execução e % financeiro.
- 🟡 `renderOrcamento` defaulta para a primeira obra, o que pode dar a impressão de que as demais serviços não existem.
- 🟡 `editOrcamento` aceita `subEtapa` legado em minúsculas, mas `saveOrcamento` grava sempre `subEtapa` — registros antigos podem mudar de chave de agrupamento ao serem salvos.
- 🟡 `confirmMedicaoVinculo` remove apenas o sinalizador `serviceIdReview`, sem auditar quem confirmou nem quando.
- 🟡 `newServiceId` usa `crypto.randomUUID` quando disponível e fallback com `Date.now()` + `Math.random()`; não há checagem de colisão no cliente.
- 🟡 `orcamento_fechamento` não cobre exclusão de serviço — apenas criação e edição.

### 6. Dependências

`auth`/`seguranca-e-rbac` (papéis e rules), `obras` (filtro e nomes), `medicao` (`serviceId`, `qacum`, aprovação), `financeiro-e-pix` (`buildFinanceEntries`, `serviceId`, pago/a pagar), `aprovacoes` (`orcamento_fechamento`), `trabalhadores`/`presenca-e-ponto` (custo de diárias no board), `billing-e-planos` (`billingState`), `relatorios-e-dashboard` (`buildObraReport`, `categorizeBudgetItem`).

**Fluxograma:** [`flowcharts/orcamento.md`](flowcharts/orcamento.md)

---

## Módulo `medicao` 🟢

**Arquivos principais:** `public/pages/medicao.html` (63), `public/modals/modal-medicao.html` (97), `public/js/app_core.js` (helpers/render 3814–3985; histórico, galeria e aprovação 3986–4211; formulário 4214–4433; save/edit 7491–7616), `public/js/utils.module.js` (aprovação 180–190; chaves 192–296; `buildMedicaoResumo` 298–411; `medicaoQuantidadeAnterior` 413–423), `functions/aprovacoes.js:36,49,367-386,403`, `functions/aprovacoes-api.js:16,29`, `database.rules.json:90-99,139-145`, `tests/medicao.test.js`, `tests/aprovacoes.test.js:244-291`, `tests/aprovacoes-ui.test.js:131,163`, `tests/rh-customizavel.test.js:75`.

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `medicaoEsc` (`app_core.js:3814`) | `v` | `string` | Escape HTML com fallback |
| `medicaoOptions` (`:3818`) | `select, values, current, placeholder` | `void` | Repovoa `<select>` preservando valor válido |
| `medicaoBudgetLines` (`:3832`) | `obra` | `array` | Serviços do orçamento da obra com `_idx` |
| `populateMedicaoFiltroEtapas` (`:3838`) | — | `void` | Etapas de orçamento + medições da obra |
| `setMedicaoView` (`:3848`) | `view` | `void` | Alterna `canteiro`/`financeiro` em `window._medView` |
| `medicaoFotosHtml` (`:3857`) | `lista` | `string` | Até 3 miniaturas deduplicadas + contador |
| `renderMedicao` (`:3871`) | — | `void` | Filtros, KPIs, tabela e contador |
| `openMedicaoHistorico` (`:3986`) | `key` | `void` | Histórico do serviço com ações por medição |
| `closeMedicaoHistorico` (`:4056`) | — | `void` | Esconde e limpa o painel |
| `medicaoRowClick` (`:4065`) | `event, idx` | `void` | Abre galeria, exceto em controles |
| `medicaoPhotoList` (`:4072`) | `m` | `string[]` | `photos[]` ou `photoUrl` legado |
| `medicaoPhotoCaption` (`:4078`) | `m, index, total` | `string` | Legenda derivada de `servico`/`etapa` |
| `openMedicaoFotos` (`:4084`) | `idx, startIndex` | `void` | Monta `window._medicaoGallery` |
| `renderMedicaoGallery` (`:4104`) | — | `void` | Overlay, navegação e miniaturas |
| `medicaoGalleryNav` / `medicaoGallerySelect` (`:4143,4151`) | `delta` / `i` | `void` | Navegação circular e seleção |
| `closeMedicaoGallery` / `medicaoGalleryKeydown` (`:4159,4170`) | `e` | `void` | Fechamento e setas/Escape |
| `setMedicaoAprovacao` (`:4177`) | `idx, status` | `Promise<void>` | Grava aprovação e re-renderiza |
| `confirmMedicaoVinculo` (`:4199`) | `idx` | `Promise<void>` | Remove `serviceIdReview` |
| `medicaoSessionName` (`:4214`) | — | `string` | Lê `gestaoUser` do sessionStorage |
| `medicaoLinhaOrcamento` (`:4221`) | `key` | `object\\|null` | Linha do orçamento por `budgetServiceKey` |
| `populateMedicaoServicos` (`:4228`) | — | `void` | Opções de serviço contratado + avulso |
| `populateMedicaoDatalists` (`:4244`) | — | `void` | Datalists de etapas, frentes e equipes |
| `medicaoSetInfo` (`:4270`) | `id, value` | `void` | Preenche campos informativos |
| `onMedicaoObraChange` / `onMedicaoServicoChange` (`:4275,4287`) | — | `void` | Herança do orçamento e modo avulso |
| `updateMedicaoAnterior` (`:4327`) | — | `void` | Calcula `md-qant` e sincroniza legendas |
| `recalcMedicao` (`:4342`) | — | `void` | `qacum`, saldo, `%` e `vtotal` |
| `syncMedicaoRetrabalho` (`:4358`) | — | `void` | Legado: espelha retrabalho |
| `medicaoFormDescription` (`:4365`) | — | `string` | Descrição para legenda das fotos |
| `renderMedicaoPhotoPreview` / `removeMedicaoPhoto` (`:4369,4385`) | `idx` | `void` | Prévia e remoção de fotos |
| `handleMedicaoPhotos` (`:4394`) | `input` | `Promise<void>` | Otimiza e envia até 6 fotos |
| `saveMedicao` / `editMedicao` (`:7491,7587`) | `idx` | `Promise<void>` | Cria/edita com desvio de aprovação |
| `normalizeAprovacao` (`utils.module.js:180`) | `v` | `enum` | `Aprovada`/`Rejeitada`/`Pendente` |
| `medicaoAprovacao` (`:188`) | `m` | `enum` | Registro antigo sem campo = `Aprovada` |
| `normalizeServiceKey` / `budgetServiceKey` / `medicaoServiceKey` (`:193,285,291`) | `o` / `m` | `string` | Chaves de vínculo |
| `buildMedicaoResumo` (`:304`) | `db, obraCod, options` | `object` | Produção acumulada e totais |
| `medicaoQuantidadeAnterior` (`:414`) | `db, info` | `number` | Histórico não rejeitado, excluindo a edição |
| `efeitosMedicao` (`functions/aprovacoes.js:367`) | `payload, estado, base, aprovacao, agora` | `object` | Aplicação do `medicao_fechamento` |

**Condicionais não-triviais:**
- `renderMedicao` defaulta para a primeira obra; sem obra, mostra `Selecione uma obra` e zera os KPIs.
- `buildMedicaoResumo` separa **acumulado histórico** (todas as não rejeitadas) de **lista filtrada** (período/etapa/aprovação); `valorMedido` inclui rejeitadas da lista, enquanto `aprovado`/`aAprovar`/`rejeitado` separam os totais.
- `fisico = null` quando não há `qprev > 0` e peso > 0; peso é `vtotal` do orçamento ou `valorAcum` legado.
- `pct = qacum/qprev*100` ou `null`; a barra visual é limitada a 0–100 e marca `is-over` acima de 100.
- Status agregado por serviço: `Rejeitada` > `Pendente` > `Aprovada` > `—`; pagamento: `Parcial` se pago > 0 e a pagar > 0, `Pago` se pago > 0 e a pagar ≤ 0, senão `Pendente`.
- `onMedicaoServicoChange`: com linha do orçamento, herda etapa/subetapa/equipe/frente/unidade/qtd e `vunit = line.vunit || vtotal/qtd`; sem linha, abre os campos avulsos e zera as infos.
- `medicaoQuantidadeAnterior` usa `serviceId`/`orcKey` ou chave textual `obra|etapa|servico`, ignora `excludeIdx` e rejeitadas.
- `recalcMedicao`: `qacum = qant + qreal`, `saldo = qprev - qacum`, `avanco = qacum/qprev*100` (vazio se `qprev <= 0`), `vtotal = qreal*vunit`.
- `handleMedicaoPhotos` respeita o teto de 6 fotos, otimiza com `maxDim: 1280`/`quality: 0.75` e usa `dataUrl` local quando o Storage falha.
- `saveMedicao` valida data, obra, serviço/avulso e `qreal > 0`; preserva campos de pagamento antigos e remove `serviceId` vazio ou `serviceIdReview` quando o serviço mudou.
- `saveMedicao` desvia quando `vtotal > 0 || vunit > 0` e `desviarParaAprovacao` existe, filtrando fotos `data:` do payload; envia `indice` na edição ou `criar: true`.
- `setMedicaoAprovacao` exige `confirm` somente para rejeição; grava `aprovadoEm = getTodayBR()` e re-renderiza Medição, Financeiro e Dashboard, reabrindo o histórico se visível.
- `efeitosMedicao` rejeita índice inválido sem `criar`, recalcula `vtotal = qreal*vunit` e grava `aprovacao = 'Aprovado'`, `aprovadoPor` e `aprovadoEm`.

**Loops:** medições em `buildMedicaoResumo` (acumulado, lista, pendentes, totais), `renderMedicao` (por chave), `openMedicaoHistorico`, `medicaoQuantidadeAnterior` e `medicaoFotosHtml`; orçamento em `ensureServico`; fotos em `handleMedicaoPhotos`, `renderMedicaoPhotoPreview` e galeria; opções em `populateMedicaoServicos`/`populateMedicaoDatalists`.

**Tratamento de erros:** `saveMedicao` usa toasts e `return` nas validações; `openMedicaoFotos` avisa quando não há fotos; `handleMedicaoPhotos` avisa o excedente, faz fallback para `dataUrl` e quebra o loop no primeiro erro de upload; `medicaoEsc`/`escHtml` protegem HTML; `efeitosMedicao` lança `medicao_inexistente`; parser de `sessionStorage` é envolvido em `try/catch`.

### 2. Algoritmos e lógica

- 🟢 Uma única tabela com duas visões evita duplicar regras: a view `canteiro` mostra avanço físico e aprovação; a view `financeiro` mostra medido/aprovado/pago/a pagar em somente leitura.
- 🟢 `buildMedicaoResumo` preserva o histórico completo para `qacum` mesmo sob filtro de período — os testes garantem que `qacum` continua 50 quando só novembro é exibido.
- 🟢 O vínculo com o orçamento é por ID estável (`serviceId`/`orcKey`), com fallback textual legado; o mesmo `serviceId` liga medição, orçamento e entradas financeiras.
- 🟢 `medicaoQuantidadeAnterior` permite recalcular a quantidade anterior na edição sem contar duas vezes a própria medição.
- 🟢 `medicaoAprovacao` trata registros antigos sem campo como aprovados, mantendo compatibilidade com dados históricos.
- 🟢 Fotos são otimizadas no cliente e enviadas ao Storage, com queda para `dataUrl` quando o Storage não está disponível.
- 🟢 `efeitosMedicao` mantém auditoria (`antes`/`depois`, decisor e timestamp) e recalcula `vtotal` no servidor, evitando valor divergente do cliente.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `Medicao`, `ServicoMedicaoResumo`, `TotaisMedicao`, `MedicaoFormState`, `GaleriaMedicao`, `DesvioMedicao` e a matriz de acesso.

### 4. Metadados e configurações

- Paths RTDB: `tenants/<tenantId>/medicao` (array), com subnós `photos` e `photoUrl`; aprovações em `tenants/<tid>/aprovacoes` com `tipo = medicao_fechamento`.
- Enums: aprovação `Pendente`/`Aprovada`/`Rejeitada` (normalizada; o trigger grava `Aprovado`); visão `canteiro`/`financeiro`; filtro de aprovação `''`/`Pendente`/`Aprovada`/`Rejeitada`.
- Limites: até 6 fotos por medição; otimização `maxDim: 1280`, `quality: 0.75`; expiração de aprovação `solicitadoEm + 1296000000` ms (15 dias).
- Etapas padrão do datalist: `Fundação`, `Estrutura`, `Alvenaria`, `Acabamento`, `Instalações` — complementadas por orçamento, medições, trabalhadores e almoços.
- Feature gate: não há gate explícito neste módulo; o acesso vem de papéis nas rules e do desvio de aprovação.
- Testes: `tests/medicao.test.js` (resumo, anterior, aprovação, custo e relatório), `tests/aprovacoes.test.js:244-291`, `tests/aprovacoes-ui.test.js:131,163`, `tests/rh-customizavel.test.js:75`.

### 5. Lacunas / pontos de atenção 🔴

- 🔴 `setMedicaoAprovacao` grava direto no RTDB pelo cliente: engenheiro ou RH com módulo podem aprovar/rejeitar a própria medição sem passar pelo trigger de aprovação.
- 🔴 `saveMedicao` só desvia para `medicao_fechamento` quando `vtotal > 0 || vunit > 0`; medição sem valor é gravada diretamente, fora do fluxo de aprovação.
- 🔴 `deleteItem('medicao', idx)` no histórico exclui medições sem desvio de aprovação, embora criação/edição com valor sejam desviadas.
- 🟡 `efeitosMedicao` persiste `aprovacao = 'Aprovado'` (masculino) enquanto a UI usa `Aprovada`; a normalização esconde a diferença, mas filtros textuais diretos no banco divergem.
- 🟡 `qant`/`qacum` são snapshots gravados na medição; editar ou excluir uma medição anterior deixa o snapshot desatualizado (o resumo recalcula, o registro não).
- 🟡 `valorMedido` inclui medições rejeitadas enquanto `buildFinanceEntries` as descarta como custo — KPIs de módulos diferentes podem divergir para a mesma obra.
- 🟡 `medicaoSessionName` está definido mas não é usado: `setMedicaoAprovacao` e `saveMedicao` fazem o parse de `sessionStorage` inline.
- 🟡 `recalcMedicao` escreve em `#md-qsaldo` e `#md-vtotal`, e `syncMedicaoRetrabalho` usa `#md-retr`/`#md-retr-qtd`, que não existem no `modal-medicao.html` — resíduos de versões anteriores.
- 🟡 `confirmMedicaoVinculo` remove `serviceIdReview` sem registrar decisor/timestamp, ao contrário da aprovação.
- 🟡 Legenda de foto é derivada de `servico`/`etapa` no momento da exibição: renomear o serviço altera a legenda de fotos antigas.
- 🟡 `medicaoRowClick` não é usado na tabela principal (as linhas usam botão `Histórico`); a galeria é aberta pelo histórico e pelas miniaturas.
- 🟡 Não há validação nas rules para `qreal > 0`, unicidade de vínculo ou coerência entre `qacum`, `qant` e `qreal`.

### 6. Dependências

`auth`/`seguranca-e-rbac` (sessão, papéis e rules), `obras` (filtro e nomes), `orcamento` (`medicaoBudgetLines`, `budgetServiceKey`, herança de serviço), `financeiro-e-pix` (`buildFinanceEntries`, pago/a pagar via board), `aprovacoes` (`medicao_fechamento`), `trabalhadores`/`almocos` (datalists de equipes), `fotos` (`renderFotos` e Storage de evidências), `relatorios-e-dashboard` (`buildObraReport`), `billing-e-planos` (`billingState`).

**Fluxograma:** [`flowcharts/medicao.md`](flowcharts/medicao.md)

---

## Módulo `relatorios-e-dashboard` 🟢

**Arquivos principais:** `public/pages/dashboard.html` (46), `public/pages/relatorios.html` (86), `public/js/app_core.js` (`renderDashboard` 100–218; gates 294–331; `renderPage` 430–447; `exportHoje` 694–735; `verTarefasDashboard` 2094–2097; `exportarImagemDashboard` 3203–3226; relatórios 3316–3809), `public/js/utils.module.js` (`hojeLocal` 942; `calcCustoObra` 954–980; `calcTarefasResumo` 987–1012; `calcAlertas` 1021–1068; `calcDashboardResumo` 1074–1111; `buildObraReport` 1126–1327; `auditSafeImage` 1330–1334; exports 1412–1416), `public/js/plan_features.js:25-54`, `public/js/data_core.js:1018-1047`, `tests/dashboard.test.js`, `tests/report.test.js`, `tests/tarefas-dashboard.test.js`.

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `window.renderDashboard` (`app_core.js:100`) | — | `void` | Desenha KPIs, alertas, painel de tarefas, resumo por obra e timestamp |
| `applyFeatureGates` (`:294`) | `root` | `void` | Aplica cadeado a `[data-feature]` conforme `hasFeature` |
| `showUpgradeModal` (`:328`) | `nome` | `Promise<void>` | Abre `modal-upgrade` com o recurso bloqueado |
| `populateUpgradeModal` (`:333`) | `container` | `void` | Preenche nome, descrição e plano exigido |
| `showPage` (`:399`) | `id` | `Promise<void>` | Busca/cached HTML da página, injeta e chama `renderPage` |
| `renderPage` (`:430`) | `id` | `void` | Despacha `dashboard → renderDashboard`, `relatorios → renderRelatorios` |
| `exportHoje` (`:694`) | — | `void` | Impressão do diário com marca d'água opcional |
| `verTarefasDashboard` (`:2094`) | — | `void` | Navega para a página de tarefas |
| `exportarImagemDashboard` (`:3203`) | — | `void` | Captura o dashboard com `html2canvas` e baixa PNG |
| `renderRelatorios` (`:3316`) | — | `Promise<void>` | Repovoa `#rel-obra`, defaulta responsável pela sessão, chama `checkRelObra` |
| `resetRelatorios` (`:3335`) | — | `void` | Restaura empty state e renderiza os filtros |
| `checkRelObra` (`:3346`) | — | `void` | Mostra status/mestre da obra e gera `REL-<cod>-<YYYYMMDD>` |
| `auditEsc` (`:3370`) | `v` | `string` | Escape HTML para o relatório |
| `auditSafeImage` (`:3377`) | `v` | `string` | Mantém só URLs `http(s)` ou `data:image/` |
| `auditBarWidth` (`:3382`) | `valor`, `previsto` | `number` | Largura da barra clampada em 0–100 |
| `generateAuditReport` (`:3387`) | — | `void` | Valida filtros, chama `buildObraReport` e injeta HTML auditável |
| `toggleAllRelSections` (`:3794`) | `check` | `void` | Marca/desmarca as 7 seções |
| `printAuditReport` (`:3802`) | — | `void` | Aplica `body.audit-print`, chama `window.print` e limpa |
| `exportarBackup` (`data_core.js:1025`) | — | `void` | Baixa `DB` como JSON |
| `importarBackup` (`:1036`) | `event` | `void` | Lê JSON, `ensureSchema`, substitui `DB` e persist |
| `hojeLocal` (`utils.module.js:942`) | — | `string` | Data de hoje via `getPeriodoOptions({tipo:'hoje'})` |
| `calcCustoObra` (`:954`) | `db, obraCod, options` | `object` | Custo realizado por fonte e período |
| `calcTarefasResumo` (`:987`) | `db, hoje` | `object` | Abertas, atrasadas, vencem hoje e itens |
| `calcAlertas` (`:1021`) | `db, hoje, linhas, role, modulos` | `array` | Alertas ordenados por prioridade |
| `calcDashboardResumo` (`:1074`) | `db, hoje, role, modulos` | `object` | KPIs, linhas, tarefas e alertas |
| `buildObraReport` (`:1126`) | `db, obraCod, options` | `object` | Relatório consolidado de vistoria |
| `auditSafeImage` (`:1330`) | `v` | `string` | Mesma sanitização de URL da UI |
| `getPeriodLabel` (`:1421`) | `dateStr, viewType` | `string` | Rótulo semanal/quinzenal |

**Condicionais não-triviais:**
- `renderDashboard`: alias legado `mestre → encarregado`; RH só acessa módulo quando `modulosPermitidos[modulo] === true`.
- Ações rápidas: presença escondida de `engenheiro`; compra escondida de `encarregado`/`mestre`; todas filtradas por `podeModulo`.
- Alertas: `TAREFA*` vêm primeiro e ocupam no máximo 8 slots; excedente vira `+ N alertas`.
- Obras concluídas ficam recolhidas salvo `#dash-show-done`; `pctCusto === null` exibe `—`.
- Custo: `> 100%` vermelho, `>= 80%` laranja, senão verde; sem mestre, só papéis com `obras` veem `Atribuir`.
- `calcCustoObra`: com `tipo` e sem datas usa `getPeriodoOptions`; com datas explícitas usa intervalo; soma `pre/med/fin/alm` de `buildFinanceEntries`.
- `calcTarefasResumo`: ignora concluídas e sem prazo; `atrasada = prazo < hoje`, `venceHoje = prazo === hoje`.
- `calcAlertas`: atrasadas agrupadas em **um** alerta alto; tarefas de hoje uma por alerta médio; custo/compras escondidos de encarregado/mestre e de RH sem os módulos; domingo não gera `SEM PRESENÇA HOJE`.
- `generateAuditReport`: exige `relatorio.marca`, obra selecionada e existente, `buildObraReport` disponível e `dataInicio <= dataFim`.
- Relatório: `totalPrevisto <= 0` → `Sem orçamento`; `orcamentoParcial` → mostra cobertura em vez de `% do orçamento`; `is-over` só quando comparável e `pct > 100`.
- `buildObraReport`: lance manual `fin` de `empreiteiro` com etapa já medida é deslocado para `duplicados` e não entra no custo.
- `orcamentoParcial = totalPrevisto > 0 && realizadoSemPrevisto > 0 && coberturaOrcamento < 50`.
- `equipe` agrupa entradas `pre` por `trab || desc`; `pendencias` inclui tarefas não concluídas e compras `Aguardando`.
- Filtro de tarefas no relatório: `concluidas` (padrão, `isExecutada`) ou `todas`, opcionalmente só com fotos.

**Loops:** `calcDashboardResumo` (por obra), `calcCustoObra` (por entrada), `calcTarefasResumo`/`calcAlertas` (por tarefa, obra e compra), `buildObraReport` (por categoria, orçamento, entrada, medição, pendência, tarefa), `generateAuditReport` (por seção, categoria, medição, equipe, pendência, extrato e tarefa), `applyFeatureGates` (por elemento marcado).

**Tratamento de erros:** `sessionStorage` lido em `try/catch` para papel e módulos do RH; `showPage` trata HTTP e exibe erro no container; `exportarImagemDashboard` faz `catch` com toast e restaura botões; `generateAuditReport` usa toasts para cada validação; `importarBackup` usa `try/catch` no `FileReader`; `printAuditReport` limpa a classe via `afterprint` e `setTimeout`.

### 2. Algoritmos e lógica

- 🟢 Dashboard e relatório leem a mesma base de custos (`buildFinanceEntries`), garantindo que "Total Real", "Custo Sem."/"Custo Mês" e o resumo do relatório conciliem.
- 🟢 `hojeLocal` usa fuso de São Paulo: evita que o dashboard zere os presentes depois das 21h.
- 🟢 `pctCusto = null` representa ausência de orçamento — distinto de `0%`, e a UI mostra `—`.
- 🟢 `buildObraReport` deduplica empreiteiro manual quando a etapa já tem medição, evitando contar duas vezes o mesmo serviço.
- 🟢 `orcamentoParcial` impede falsos estouros quando faltam linhas de orçamento para categorias com gasto real.
- 🟢 `pago + a pagar = realizado` por entrada (`Parcial` usa `min(jaPago, valorRealizado)`), permitindo a conferência exibida no extrato.
- 🟢 Fotos de tarefas e medições passam por sanitização de URL antes de virarem `src`/`onclick`.
- 🟢 Feature gates atuam tanto na UI (cadeado + interceptação em captura) quanto nas funções (`requireFeature`).

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `DashboardResumo`, `DashboardKPIs`, `DashboardLinhaObra`, `TarefasResumo`, `AlertaDashboard`, `RelatorioObra`, `RelatorioResumo`, `CategoriaRelatorio`, `EntradaConciliada`, `ReportState` e as matrizes de feature gate.

### 4. Metadados e configurações

- Paths: somente leitura em `DB.obras`, `DB.presenca`, `DB.tarefas`, `DB.compras`, `DB.financeiro`, `DB.medicao`, `DB.orcamento`, `DB.almocos`, `DB.config`; escrita apenas por `importarBackup`.
- Enums: prioridade de alerta `alto`/`medio`/`baixo`; filtro de tarefas `concluidas`/`todas`; visão de período `semana`/`mes`/`hoje`.
- Constantes: `MAX_ALERTAS = 8`; limite de 5 tarefas no painel; `COBERTURA_MINIMA_CONFIAVEL = 50`.
- Feature gates: `relatorio.marca` (nível 2), `exportacao` (nível 2), `relatorio.whatsapp.diario` (nível 2) em `plan_features.js:25-54`.
- Cache de HTML: `HTML_CACHE_VERSION = '20261126013'`, máximo 10 páginas (`app_core.js:260-271`).
- Testes: `tests/dashboard.test.js` (KPIs, alertas, custo, papel e renderização), `tests/report.test.js` (categorias, duplicados, equipe, pendências e fotos), `tests/tarefas-dashboard.test.js` (resumo de tarefas, alertas, slots e painel).

### 5. Lacunas / pontos de atenção 🔴

- 🔴 `buildObraReport` não filtra por papel: qualquer usuário que consiga abrir a página vê custos, pagamentos e extrato completo da obra.
- 🔴 `importarBackup` substitui todo o `DB` do tenant sem checar feature gate e sem validação referencial além de `ensureSchema` — pode sobrescrever dados legítimos com um arquivo adulterado.
- 🟡 `window.renderDashboard` é declarado com `|| function () { }` e recebe o corpo real logo em seguida; a indireção existe para testes, mas permite override em runtime.
- 🟡 `exportarImagemDashboard` nomeia o arquivo com `new Date().toISOString()` (UTC), divergente de `hojeLocal()` usado nos cálculos.
- 🟡 `printAuditReport` depende de `setTimeout(1500)` para remover `audit-print`; impressão lenta pode herdar a classe em outras telas.
- 🟡 Duas implementações de `auditSafeImage` (`app_core.js:3377` e `utils.module.js:1330`) com a mesma regex; risco de divergência futura.
- 🟡 `auditEsc` usa `window.escHtml` quando disponível, mas o fallback e a implementação da utils são equivalentes — duplicação de responsabilidade.
- 🟡 `calcAlertas` usa o alias legado `mestre` diretamente na comparação (`role !== 'mestre'`) embora `renderDashboard` já converta para `encarregado`; se a sessão tiver `mestre`, o alias é tratado certo aqui, mas a consistência depende de cada chamador.
- 🟡 Alertas de tarefas são ordenados por prioridade antes do slice, mas `TAREFA HOJE` (médio) pode ser empurrado por outros alertas médios se houver mais de 8 no total.
- 🟡 `relatorio.whatsapp.diario` está cadastrado como feature, porém o envio automático não é implementado neste módulo.
- 🟡 Relatório não persiste metadados de auditoria (quem gerou, quando, hash do documento) — apenas imprime número e responsável digitados.

### 6. Dependências

`auth`/`seguranca-e-rbac` (sessão, papéis e `modulosPermitidos`), `billing-e-planos` (`hasFeature`/`requireFeature`, planos), `obras` (nomes, status, mestres e orçamento), `financeiro-e-pix` (`buildFinanceEntries`, `FIN_CATEGORIES`, pago/a pagar), `tarefas` (`calcTarefasResumo`, conclusão rápida e fotos), `presenca-e-ponto` (`calcCustosDiarias`), `medicao` (`buildMedicaoResumo`, `medicaoAprovacao`), `almocos`, `compras`, `orcamento` (`categorizeBudgetItem`), `fotos` (`openLightbox`, `taskPhotoCaption`), `admin-e-super-admin` (`saveConfig`, logo e marca d'água), `whatsapp-bot` (`relatorio.whatsapp.diario`).

**Fluxograma:** [`flowcharts/relatorios-e-dashboard.md`](flowcharts/relatorios-e-dashboard.md)

---

## Módulo `fotos` 🟢

**Arquivos principais:** `public/pages/fotos.html` (24), `public/modals/modal-tarefa.html`, `public/modals/modal-medicao.html`, `public/js/app_core.js` (`renderFotos` 4471–4559; `uploadErrorMessage` 8054–8067; `uploadEvidenceFile` 8069–8094; `handleFileUpload` 8096–8143; fotos de medição 3857–4433; fotos de tarefa 8145–8248; `openLightbox`/`closeLightbox` 8252–8268), `public/js/utils.module.js` (`auditSafeImage` 1330–1334; `optimizeImageFile` 1341–1406), `public/js/data_core.js:458-484,790-850,888-930`, `storage.rules:1-47`, `tests/tarefas-fotos.test.js`, `tests/security/tenant-isolation.test.js:391-417`, `tests/rh-customizavel.test.js:89-122`.

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `renderFotos` (`app_core.js:4471`) | — | `void` | Agrega fotos de tarefas e medições, filtra, ordena e desenha a galeria |
| `uploadErrorMessage` (`:8054`) | `err` | `string` | Traduz erros do Storage para mensagens em pt-BR |
| `uploadEvidenceFile` (`:8069`) | `file` | `Promise<string>` | Envia para `tenants/<tid>/evidencias/` e devolve download URL |
| `handleFileUpload` (`:8096`) | `input, previewId, urlInputId` | `Promise<void>` | Upload genérico de imagem com otimização |
| `medicaoFotosHtml` (`:3857`) | `lista` | `string` | Miniaturas deduplicadas no histórico |
| `medicaoPhotoList` (`:4072`) | `m` | `string[]` | Normaliza `photos`/`photoUrl` de medição |
| `medicaoPhotoCaption` (`:4078`) | `m, index, total` | `string` | Legenda derivada de `servico`/`etapa` |
| `handleMedicaoPhotos` (`:4394`) | `input` | `Promise<void>` | Otimiza e envia até 6 fotos da medição |
| `renderMedicaoPhotoPreview` / `removeMedicaoPhoto` (`:4369,4385`) | `idx` | `void` | Prévia e remoção no modal de medição |
| `openMedicaoFotos` / `renderMedicaoGallery` (`:4084,4104`) | `idx, startIndex` | `void` | Galeria navegável de medições |
| `medicaoGalleryNav` / `medicaoGallerySelect` / `closeMedicaoGallery` / `medicaoGalleryKeydown` (`:4143,4151,4159,4170`) | `delta` / `i` / `e` | `void` | Navegação, seleção e fechamento da galeria |
| `taskPhotoList` (`:8149`) | `t` | `string[]` | Normaliza `photos`/`photoUrl`/`foto` com filtro de esquema |
| `taskPhotoCaption` (`:8157`) | `t, index, total` | `string` | Legenda derivada de `t.desc` |
| `renderTarefaPhotoPreview` / `removeTarefaPhoto` (`:8163,8219`) | `idx` | `void` | Prévia e remoção no modal de tarefa |
| `handleTarefaPhotos` (`:8182`) | `input` | `Promise<void>` | Otimiza e envia até 6 fotos da tarefa |
| `openTarefaFotos` (`:8231`) | `idx, startIndex` | `void` | Reaproveita a galeria de medições para tarefas |
| `openLightbox` / `closeLightbox` (`:8252,8266`) | `url` | `void` | Ampliação em overlay criado sob demanda |
| `auditSafeImage` (`utils.module.js:1330`) | `v` | `string` | Aceita só `http(s)` e `data:image/` |
| `optimizeImageFile` (`:1341`) | `file, options` | `Promise<object>` | Redimensiona e comprime via Canvas |

**Condicionais não-triviais:**
- `renderFotos` preenche `#fotos-obra-filter` somente quando `options.length === 1`, preservando a seleção entre renders.
- `taskPhotoList`: usa `photos` se não vazio, senão `[photoUrl, foto]`; filtra vazios e esquemas `http(s)`/`data:image/`.
- `medicaoPhotoList`: usa `photos` ou `photoUrl`, sem filtro de esquema nesta etapa.
- Legenda: `desc` ou fallback (`Tarefa`/`Medição`), com sufixo `· Foto i/n` somente quando `total > 1`.
- `handleMedicaoPhotos`/`handleTarefaPhotos`: `room = 6 - fotos atuais`, `slice(0, room)` e toast para excedentes.
- `optimizeImageFile`: só processa `image/*` e requer `FileReader`, `Image` e `document`; sem `canvas.toBlob`, devolve `dataUrl`.
- `uploadEvidenceFile`: exige `firebase.storage` e `storageBucket`; `tid = user.tenantId || 'global'`.
- Fallback: se o Storage falhar e existir `dataUrl`, a foto otimizada é usada localmente; senão o loop quebra com toast.
- Persistência: base64 é removido dos objetos enviados ao RTDB e do `gestaoObraDB`, ficando em `gestaoObraFotos`.
- Restauração: trabalhadores recebem `foto` se vazia; tarefas mesclam `photos` + `photoUrl` + restauradas com `Set`.
- `storage.rules`: fora de `tenants/<tenantId>/` é negado; escrita exige papel conhecido + `arquivoPermitido()` (≤ 10 MB, `image/*` ou PDF).

**Loops:** `renderFotos` (tarefas e medições + filtros + cards), `taskPhotoList`/`medicaoPhotoList` (normalização), `handleMedicaoPhotos`/`handleTarefaPhotos` (por arquivo), `optimizeImageFile` (redimensionamento), `renderMedicaoGallery` (miniaturas), `data_core` (por trabalhador, medição e tarefa nos dois sentidos de persistência).

**Tratamento de erros:** `uploadErrorMessage` mapeia códigos `storage/unauthorized`, `quota-exceeded`, `retry-limit-exceeded`, `unknown`; `uploadEvidenceFile` valida SDK/bucket; handlers fazem `try/catch` por arquivo e param o loop no primeiro erro; `renderFotos` usa `onerror` para esmaecer imagem quebrada; restauração local e gravação de `gestaoObraFotos` são envolvidas em `try/catch` com `console.warn`.

### 2. Algoritmos e lógica

- 🟢 Uma galeria única agrega duas origens sem duplicar lógica de legenda: reusa `taskPhotoCaption` e `medicaoPhotoCaption`.
- 🟢 Normalização aceita formatos legados (`foto`, `photoUrl`) e o formato atual (`photos[]`), com compatibilidade mantida em `saveTarefa`/`saveMedicao`.
- 🟢 Upload prioriza Storage com URL remota, caindo para `dataUrl` otimizada quando o Storage não está disponível.
- 🟢 Base64 é separado do payload da nuvem para respeitar o limite de 10 MB por escrita do RTDB.
- 🟢 Restauração local usa `Set` para não repetir fotos já vindas da nuvem.
- 🟢 Autorização no Storage usa claims do servidor em vez de consultar o RTDB nas rules.
- 🟢 Tarefas e medições compartilham o mesmo player de galeria (`_medicaoGallery`), reduzindo código duplicado.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `FotoItem`, `GaleriaFotos`, `TaskPhotoList`, `MedicaoPhotoList`, `UploadEvidenceResult`, `FotosLocalStore` e a matriz de acesso ao Storage.

### 4. Metadados e configurações

- Paths: `tenants/<tenantId>/evidencias/<timestamp>_<nome sanitizado>` no Storage; fotos referenciadas em `DB.tarefas[].photos`, `DB.tarefas[].photoUrl`, `DB.tarefas[].foto`, `DB.medicao[].photos`, `DB.medicao[].photoUrl`, `DB.trabalhadores[].foto`.
- Limites: 6 fotos por tarefa e por medição; 10 MB por arquivo; otimização `maxDim: 1280`, `quality: 0.75`, MIME `image/jpeg`.
- Chaves locais: `gestaoObraDB` (sem base64) e `gestaoObraFotos` (mapa de base64 por `cod` e `tf_<cod>`).
- Filtros da página: `fotos-obra-filter` (obra) e `fotos-origem-filter` (`Tarefa`, `Medição`).
- Testes: `tests/tarefas-fotos.test.js`, `tests/security/tenant-isolation.test.js:391-417`, `tests/rh-customizavel.test.js:89-122`.

### 5. Lacunas / pontos de atenção 🔴

- 🔴 `openLightbox` não valida a URL recebida; a sanitização depende de cada chamador montar `data-photo` com `auditEsc`/`auditSafeImage`.
- 🔴 Fallback em `data:` salva a foto apenas no `localStorage` do dispositivo — ela não sincroniza entre aparelhos nem sobrevive à limpeza de cache.
- 🟡 Fotos de medição com fallback `data:` não são restauradas no carregamento (a restauração cobre só trabalhadores e tarefas).
- 🟡 `uploadEvidenceFile` usa `tenantId || 'global'`; o caminho `tenants/global/...` é negado pelas rules, gerando erro confuso para sessões sem claim de tenant.
- 🟡 `comprador` pode ler/escrever arquivos no Storage embora não tenha acesso de escrita a várias coleções do RTDB.
- 🟡 `storage.rules` confia no `contentType` enviado pelo cliente, sem inspecionar o conteúdo real do arquivo.
- 🟡 `fotosMap['tf_' + cod]` depende de `t.cod`; tarefas sem código colidem na chave local.
- 🟡 `taskPhotoList` filtra esquemas, mas `medicaoPhotoList` não — uma URL `javascript:` gravada em medição chega ao `src` e ao `data-photo` da galeria.
- 🟡 `closeLightbox` chama `getElementById('lightbox-container').classList` sem checar existência.
- 🟡 `renderFotos` não pagina nem limita a galeria: uma obra com muitas fotos renderiza todas de uma vez.
- 🟡 Legenda é derivada no momento da leitura; renomear tarefa/serviço altera legendas de fotos antigas.

### 6. Dependências

`auth`/`seguranca-e-rbac` (claims de `tenantId` e papel), `obras` (filtro e nomes), `tarefas` (`taskPhotoList`, `taskPhotoCaption`, modal e salvamento), `medicao` (`medicaoPhotoList`, `medicaoPhotoCaption`, galeria e modal), `trabalhadores` (`foto` em base64), `relatorios-e-dashboard` (fotos no relatório), `admin-e-super-admin` (`uploadErrorMessage`, `handleFileUpload` e config de logo), `billing-e-planos` (preservação de fotos após expiração), Firebase Storage (`uploadEvidenceFile`, `storage.rules`).

**Fluxograma:** [`flowcharts/fotos.md`](flowcharts/fotos.md)

---

## Módulo `billing-e-planos` 🟢

**Arquivos principais:** `functions/billing.js` (184 linhas), `functions/kiwify.js` (500), `functions/plan_catalog.js` (161), `functions/plan_features.js` (136), `functions/kiwify_api.js` (279), `functions/super_admin.js` (`acaoDefinirPlano`/`acaoDefinirLimites`/`acaoStatusTenant`), `functions/index.js:541-685,819-859,920-929`, `public/js/data_core.js:100-129,139-268,380-455,645-659`, `public/js/plan_features.js`, `public/js/plans.js`, `public/js/app_core.js:290-346,5365-5474`, `database.rules.json:30-77,211-233`.

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `calcularBillingState` (`billing.js:39`) | `tenantData`, `agora?`, `tenantId?` | `{billingState, motivo, diasRestantes?}` | Máquina de estados pura: MASTER_SYSTEM → bloqueio forçado → trial (30+7) → pago (carência 3/5 + 7) |
| `atualizarBillingStatesJob` (`billing.js:145`) | `db`, `agora?` | `{total, alterados, updates}` | Recalcula todos os tenants e grava só transições |
| `dailyBillingStateJob` (`index.js:921`) | `event` | `Promise` | Agendado `every day 04:00` em `America/Sao_Paulo` |
| `validateKiwifySignature` (`kiwify.js:11`) | `rawBody`, `signature`, `secret` | `boolean` | HMAC-SHA1 sobre o corpo bruto, comparação com `timingSafeEqual` |
| `identifyTenant` (`kiwify.js:40`) | `body`, `query`, `db` | `Promise<string|null>` | Referência/slug → `emailAdmin` → perfil → convite |
| `mapProductToPlan` (`kiwify.js:112`) | `body`, `agora?` | `{plano, limites, planoVencimento, isYearly}` | Produto + frequência → catálogo canônico |
| `reservarEvento` (`kiwify.js:181`) | `eventRef`, metadados | `{jaProcessado?\|claimedAt}` | Reserva atômica com lease de 2 min; `pending_tenant`/`failed` retomáveis |
| `handleKiwifyWebhook` (`kiwify.js:227`) | `req`, `res`, `{secret, db}` | `Promise<Response>` | Autentica, identifica, reserva, aplica efeitos e grava auditoria |
| `enforceGrowthLimit` (`index.js:580`) | `event`, `campo`, `recursivo` | `Promise<null>` | Reverte crescimento acima de `limiteObras`/`limiteUsuarios` |
| `aplicarLimiteDeAssentos` (`index.js:616`) | `uid`, `tenantId`, `role` | `Promise<string>` | Marca novo perfil como `pendente` quando lotado (dono conta +1) |
| `enforceSubdomainPlan` (`index.js:654`) | `event` | `Promise<null>` | Exige feature `subdominio` (nível 2) para slug diferente do `tenantId` |
| `normalizarPlanoAdmin` / `limitesDoPlano` / `diasDoPlano` (`plan_catalog.js:96,126,140`) | plano, ajustes | plano/limites/dias | Normalização e mesclagem segura de ajustes manuais |
| `hasFeature` (`plan_features.js:104`) | `nome`, `plano`, `contexto` | `boolean` | `nivelDoPlano >= feature.nivel`, falso se `billingState === 'bloqueado'` |
| `renderBillingEnforcement` (`data_core.js:139`) | `data` | `void` | Banners, tela de bloqueio e `window.IS_READONLY_MODE` |
| `startKiwifyCheckoutFor` (`plans.js:88`) | `plano`, `tenantId?`, `linkKiwify?` | `void` | Abre checkout com `external_reference=<tenantId>` |

**Condicionais não-triviais:**
- `carenciaValida = carenciaAte > 0 && (carenciaAte > agora || (vencimento > 0 && agora >= vencimento))` — evita que carência antiga de conta renovada bloqueie acesso.
- Sem vencimento confiável: `ativo`/`sem_vencimento` (fail-open deliberado).
- `billingState === 'bloqueado'` revoga features mesmo em planos nível 3.
- Duplicata de webhook só é conflito quando a reserva anterior é `success` e hash/tenant divergem.
- `cancelamentoAgendado` não desbloqueia tenant com `status === 'bloqueado_pagamento'`.
- Checkout sem link (`SEU_LINK`) cai para WhatsApp em vez de abrir URL inválida.

### 2. Algoritmos e lógica

- 🟢 Máquina de estados determinística e isolada em função pura, com constantes explícitas (`TRIAL_READONLY_DAYS=7`, `PAID_GRACE_DAYS=5`, `PAID_READONLY_DAYS=7`).
- 🟢 Catálogo único compartilhado por painel master, webhook e enforcement — `plans.js` é o espelho browser validado por testes.
- 🟢 Idempotência por `orderId + eventType` com `payloadHash` que ignora campos voláteis de status.
- 🟢 Efeitos no tenant e marca `success` do evento gravados numa única atualização multi-path; falha libera a reserva para retry.
- 🟢 Limites de quantidade são aplicados por triggers com Admin SDK porque RTDB Rules não expõe `numChildren()`.
- 🟢 Reversão transacional preserva registros legados em vez de apagar dados.
- 🟢 Feature gates usam captura de clique para bloquear `onclick` legado e abrem modal de upgrade com o plano necessário.
- 🟢 Leitura isolada de `billingState` mantém a tela de bloqueio funcional quando a leitura do nó inteiro é negada.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `TenantBilling`, `BillingState`, `PlanoCatalogo`, `FeatureFlag`, `BillingEvent`, `UltimoPagamento`, `WebhookDebug`, `LimitesDoSistema`, `CheckoutKiwify` e `BillingUiState`.

### 4. Metadados e configurações

- Nós do RTDB: `tenants/<tid>/{plano, planoVencimento, trialExpiracao, status, billingState, billingStateMotivo, billingStateAtualizadoEm, carenciaAte, avisoCarencia, motivoBloqueio, dataBloqueio, cancelamentoAgendado, dataCancelamento, origemAtivacao, ultimoPagamento}` e `tenants/<tid>/config/{limiteObras, limiteUsuarios, limiteTrabalhadores}`.
- Nós de auditoria: `billing_events/<orderId>/<eventType>` e `webhook_debug` (somente super_admin lê).
- Planos: `free_trial` (30 dias, 1 obra/1 usuário), `start` (R$ 69,90; 2/2), `pro` (R$ 105,90; 5/5), `ilimitado` (R$ 299,00; 9999/9999); variantes anuais e aliases legados (`premium`, `full`, `master`, `MASTER_SYSTEM`).
- Checkouts: `hHQz2Zu` (start), `d0Gfv34` (pro), `z2hLFKq` (ilimitado).
- Job: `0 21 * * *` é o relatório diário; billing é `every day 04:00` em `America/Sao_Paulo` (`index.js:921-929`).
- Segredos: `KIWIFY_TOKEN`, `KIWIFY_CLIENT_ID`, `KIWIFY_CLIENT_SECRET`, `KIWIFY_ACCOUNT_ID`, `KIWIFY_API_TOKEN`.
- Testes: `tests/security/billing.test.js`, `tests/plan-features.test.js`, `tests/kiwify.test.js`, `tests/kiwify-idempotency.test.js`, `tests/super-admin.test.js`, `tests/persistDB-roles.test.js`.

### 5. Lacunas / pontos de atenção 🔴

- 🔴 A identificação do tenant por e-mail percorre `tenants` e `profiles` inteiros por evento sem referência; não há índice nem cache (`kiwify.js:76-102`).
- 🔴 O fallback client-side difere do servidor quando `trialExpiracao` está ausente: o cliente não usa `webhookCriacao + 30 dias` (`data_core.js:105-107`).
- 🔴 Eventos Kiwify não reconhecidos são marcados como `success` sem efeito — não há fila de exceção/revisão (`kiwify.js:448-463`).
- 🟡 Janela de até 24 h entre vencimento e o job diário: `billingState` e banners podem defasar do estado real calculado.
- 🟡 `enforceGrowthLimit` cobre obras e usuários, mas não há trigger equivalente para `limiteTrabalhadores`.
- 🟡 O e-mail `tonycampelo@gmail.com` é tratado como super_admin em várias regras — mecanismo de escape legado fora dos claims.
- 🟡 `PROTECTED_TENANT_FIELDS` depende de o cliente reconstruir o payload sem esses campos; uma escrita direta Via SDK depende só das rules.
- 🟡 `hasFeature` usa `DB.plano`/`window.__billingState` assíncronos; em troca de tenant pode haber janela curta com plano antigo.
- 🟡 `acaoDefinirLimites` permite valores até 9999 sem registro de quem aprovou o ajuste manual.
- 🟡 Slugs antigos em `tenants_public` são removidos somente quando o trigger de subdomínio reverte; mudanças de plano não limpam slugs já existentes.

### 6. Dependências

`auth`/`seguranca-e-rbac` (claims e identidade do super_admin), `tenants-e-slug` (slug, `tenants_public`, `emailAdmin`), `admin-e-super-admin` (`adminAccountApi`, `handleAdminRequest`, leitura da API da Kiwify), `usuarios-e-cargos` (limite de assentos e perfis `pendentes`), `obras` (`enforceObrasLimit`), `relatorios-e-dashboard` (`relatorio.whatsapp.diario`), `financeiro-e-pix` (`pix.folha`), Kiwify (checkout, webhook, API pública), Firebase Scheduler/Auth/RTDB.

**Fluxograma:** [`flowcharts/billing-e-planos.md`](flowcharts/billing-e-planos.md)

---

## Módulo `whatsapp-bot` 🟢

**Arquivos principais:** `functions/whatsapp_auth.js` (288 linhas), `functions/index.js:17-18,53-126,128-148,155-404,406-446,448-512,515-538`, `functions/whatsapp/obra-etapas.js` (290), `functions/whatsapp/parser-tarefas.js` (142), `functions/retencao.js:11-22`, `database.rules.json:74-76,219-222,241-267`, `tests/whatsapp-auth.test.js`, `tests/abuso.test.js:124-131`, `docs/wiki/whatsapp-bot/plano-implementacao-whatsapp.md`.

> 🟡 O plano em `docs/wiki/whatsapp-bot/` é documentação **legada** (2026-05-07): menciona `functions.config()`, token fixo e prévia de confirmação. A implementação atual usa Secret Manager e grava tarefa diretamente, sem prévia (`docs/.../plano-implementacao-whatsapp.md:7-11`).

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `whatsappWebhook` (`index.js:128`) | `req`, `res` | `Promise<Response>` | `onRequest` com `cors:false`, 512 MiB, 60 s, `maxInstances:5`, 6 segredos da Meta |
| `handleWhatsappWebhook` (`whatsapp_auth.js:189`) | `req`, `res`, `{db, secrets, processar, responder}` | `Promise<Response>` | Handshake GET, HMAC, origem, dedup, autorização, estado e ACK |
| `seguroEqual` (`:27`) | `a`, `b` | `boolean` | Hash SHA-256 antes de `timingSafeEqual`, escondendo o tamanho |
| `validarVerifyToken` (`:33`) | `recebido`, `esperado` | `boolean` | Exige `hub.mode=subscribe` e token seguro |
| `validarAssinatura` (`:39`) | `req`, `appSecret` | `boolean` | HMAC-SHA256 sobre `req.rawBody`, header `x-hub-signature-256` |
| `extrairMensagem` (`:68`) | `body` | objeto \| `null` | Só `whatsapp_business_account`; texto/button/áudio; ignora ramo `page` |
| `validarOrigem` (`:60`) | `entryId`, `value`, `{wabaId, phoneNumberId}` | `boolean` | Confere WABA e `phone_number_id` quando configurados |
| `normalizarTelefone` (`:49`) | `valor` | `string` | Remove não-dígitos, corta `55`, exige 10–11 dígitos |
| `autorizarRemetente` (`:107`) | `db`, `{from}` | `{ok, tenantId?, user?, origem?}` | `users` primeiro, allowlist `telefonesPermitidos` como fallback; empate rejeita |
| `verificarEstado` (`:142`) | `user`, `tenant` | `{ok, motivo?}` | Bloqueia `inativo`/`bloqueado`, `billingState` `bloqueado`/`somente_leitura`, usuário inativo |
| `reservarMensagem` (`:161`) | `db`, `msgId` | `{ok, ref}` | Transação atômica em `whatsapp_messages/<chave>`; `msgId` ausente não bloqueia |
| `processarMensagem` (`index.js:155`) | `From`, `textoTarefa`, `audioUrl`, `contexto` | `Promise<void>` | Áudio→Whisper, intenção local ou GPT-4o-mini, grava tarefa/ponto ou consulta |
| `detectarEtapas` (`obra-etapas.js:209`) | `texto` | `EtapaDetectada[]` | Pontua 10 etapas por sinônimos e ordena por score |
| `extrairTarefas` (`:240`) | `texto` | `TarefaDetectada[]` | Divide por `, ; \n .`, marca confiança alta/média/baixa |
| `handleAudioTarefas` (`parser-tarefas.js:4`) | `transcricao`, `tenantId`, `from` | `{response}` | Prévia e gravação em `tarefas_pendentes` — **não conectado** ao fluxo ativo |
| `responderWhatsApp` (`index.js:406`) | `para`, `msg` | `Promise<void>` | POST Graph API v20.0 com Bearer token e `phoneNumberId` |
| `dailyReport` (`index.js:448`) | `event` | `Promise<void>` | Agendado `0 21 * * *` (18h Brasília), feature `relatorio.whatsapp.diario` |
| `retencaoSegurancaJob` (`index.js:913`) | `event` | `Promise<void>` | Limpa `whatsapp_messages` com mais de 24 h |

**Condicionais não-triviais:**
- `extrairMensagem` aceita somente `object === 'whatsapp_business_account'` — o ramo `page`/Messenger é descartado.
- `validarOrigem` é tolerante quando WABA/phone number não estão configurados, mas exige conferência **exata** quando estão.
- `autorizarRemetente` usa `users` como fonte canônica; allowlist só entra se nenhum `users` casar; dois tenants = `numero_ambigu` (rejeita, nunca escolhe o primeiro).
- `verificarEstado` acopla o bot ao ciclo de cobrança: `billingState === 'somente_leitura'` já impede escrita via bot.
- ACK positivo só após `processar`; exceção remove a reserva e responde 500 para a Meta reenviar sem cair em `DUPLICATE`.
- `isTextoCurto = !audioUrl && txt.length < 200`; só então a detecção local evita o GPT.
- `txtUpper.match(/^PONTO\s/i)` captura "PONTO ..." antes da checagem exata de `consultar_ponto`; por isso `consultar_ponto` nunca é alcançado.

### 2. Algoritmos e lógica

- 🟢 Defesa em camadas: HMAC sobre corpo cru → origem WABA → dedup transacional → autorização estrita → estado → URL de mídia → processamento.
- 🟢 Comparações sensíveis usam hash+`timingSafeEqual`, evitando timing e vazamento de tamanho (`whatsapp_auth.js:26-31`).
- 🟢 Injeção de `processar`/`responder` mantém a camada de autorização independente de GPT/Graph e totalmente testável (`whatsapp_auth.js:185-188`).
- 🟢 `concluirMensagem` engole erro de escrita do status para não transformar sucesso em 5xx; a limpeza programada remove resíduos.
- 🟢 Áudio: download `arraybuffer` com `maxContentLength`/`maxBodyLength` = 8 MB e timeout 20 s, arquivo `/tmp/audio-<uuid>.ogg`, `whisper-1` em `pt`, remoção no `finally`.
- 🟢 `urlAudioPermitida` aceita só `https://graph.facebook.com` ou `*.fbcdn.net`, revalidado dentro de `processarMensagem` (defesa em profundidade).
- 🟢 Busca de obra em três níveis (exata por nome/código/`_id` → contém → fuzzy 0.3), filtrando status `ativa`, `em andamento`, `planejada`, `execucao`.
- 🟢 Lançamento de ponto usa transação em `presenca` com chave lógica `data + trab`, atualizando registro existente em vez de duplicar.
- 🟢 Detecção de etapas pontua termos por número de palavras e prioriza urgência explícita sobre a prioridade padrão da etapa.
- 🟢 Gatilho diário de billing (`somente_leitura`) é refletido no bot sem código duplicado — reusa o campo do tenant.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `MetaWebhookMessage`, `WhatsappAuthorization`, `WhatsappMessageReservation`, `WhatsappIntent`, `EtapaCatalogo`, `TarefaViaWhatsApp`, `PresencaViaWhatsApp`, `TarefaPendente`, `WhatsappSecrets` e a matriz de regras do RTDB.

### 4. Metadados e configurações

- Segredos: `OPENAI_KEY`, `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_WABA_ID` (`index.js:129`).
- Handler: `cors:false`, `memory:'512MiB'`, `timeoutSeconds:60`, `minInstances:0`, `maxInstances:5`.
- Graph API: `https://graph.facebook.com/v20.0/<phoneId>/messages` (`index.js:423`); download de mídia em `https://graph.facebook.com/<audioId>`.
- Whisper: modelo `whisper-1`, idioma `pt`, limite `LIMITE_AUDIO = 8 * 1024 * 1024` (`whatsapp_auth.js:24`).
- GPT: `gpt-4o-mini`, `response_format: {type:'json_object'}`, data de hoje em `America/Sao_Paulo` injetada no prompt (`index.js:236-268`).
- Relatório diário: `0 21 * * *` em `America/Sao_Paulo` — 18h de Brasília, `maxInstances:1` (`index.js:448-455`).
- Retenção: `whatsapp_messages` por 24 h, campo `recebidaEm` (`retencao.js:14,21`).
- Códigos de tarefa: `TF` + sequência `lista.length + 1` com `padStart(3,'0')` (`index.js:318`).
- Horários padrão de ponto: entrada `07:00`, saída `17:00`; meio período `12:00`; falta `00:00/00:00` (`index.js:367-375`).
- Testes: `tests/whatsapp-auth.test.js` (verify token, assinatura, origem, normalização, autorização, estado, dedup, handler), `tests/abuso.test.js:124-131`, `tests/plan-features.test.js:34-39,134`.

### 5. Lacunas / pontos de atenção 🔴

- 🔴 `consultar_ponto` é detectada em `index.js:221-223`, mas **não há branch** em `processarMensagem` — a mensagem simplesmente não recebe resposta.
- 🔴 O fluxo ativo grava tarefa diretamente: `parser-tarefas.js` (prévia → `CONFIRMAR`/`EDITAR`/`CANCELAR`) não é importado por `index.js`.
- 🔴 `norm(o.cod)` chama `.normalize()` diretamente em `index.js:92-95`; códigos numéricos de obra lançam exceção e derrubam o processamento.
- 🔴 Erros da Graph API em `responderWhatsApp` são apenas logados — sem retry, fila ou dead-letter (`index.js:437-446`).
- 🟡 `tarefas_pendentes/<from>` usa o telefone sem normalização — o parser desconectado agruparia o mesmo remetente em chaves diferentes.
- 🟡 `criadoEm` em `confirmarTarefas` usa `toISOString().split('T')[0]` (UTC), divergente do `getHojeBR()` do fluxo ativo.
- 🟡 `dailyReport` lê `tenants/<tid>/ponto/<hoje>`, enquanto o bot grava em `tenants/<tid>/presenca` — contadores do relatório podem ficar zerados para lançamentos via WhatsApp.
- 🟡 `dailyReport` não verifica `billingState`, apenas `status === 'inativo'`.
- 🟡 Remetente não autorizado recebe uma mensagem antes do 403, permitindo uso pontual do bot como canal de envio para qualquer número que passe HMAC/origem.
- 🟡 `dados` retornados pelo GPT não são validados por schema; `.tarefa.titulo` e `.ponto.trabalhadores` são acessados diretamente.
- 🟡 `cod` de tarefa derivado de `lista.length + 1` pode colidir após exclusões.
- 🟡 `autorizarRemetente` lê `users` e `tenants` inteiros por mensagem — custo O(n) sem índice para o matching.
- 🟡 Reserva `processing` presa só é removida pelo job de 24 h, sem lease curto como o webhook da Kiwify.
- 🟡 O nome da empresa na consulta geral é fixo como `'Empresa'` (`index.js:529`).
- 🟡 Documentação legada em `docs/wiki/whatsapp-bot/` descreve um fluxo que não existe mais na implementação atual.

### 6. Dependências

`auth`/`usuarios-e-cargos` (`users`, perfis e nomes para `criadoPor`), `tenants-e-slug` (`config.telefonesPermitidos`, `adminPhone`, `status`), `billing-e-planos` (`billingState`, feature `relatorio.whatsapp.diario`), `obras` (busca por nome/código), `tarefas` (gravação em `tenants/<tid>/tarefas`), `trabalhadores` (matching e diária), `presenca-e-ponto` (gravação em `presenca`), `relatorios-e-dashboard` (resumo diário), `seguranca-e-rbac` (rules de `whatsapp_messages`, `telefone`, `whatsappId`), OpenAI Whisper/GPT, Meta WhatsApp Cloud API v20.0, Firebase Scheduler/RTDB/Secret Manager.

**Fluxograma:** [`flowcharts/whatsapp-bot.md`](flowcharts/whatsapp-bot.md)

---

## Módulo `seguranca-e-rbac` 🟢

**Arquivos principais:** `functions/claims.js` (80 linhas), `functions/abuso.js` (79), `functions/auditoria.js` (114), `functions/retencao.js` (68), `functions/super_admin.js` (475), `functions/cargos.js` (411), `functions/usuarios.js`, `functions/aprovacoes-api.js`, `functions/index.js:680-817,840-918`, `functions/set_super_admin.js` (56), `database.rules.json` (292), `storage.rules` (47), `docs/security/hardening.md`, `docs/security/super-admin.md`, `docs/security/tenant-isolation.md`, `docs/security/cors.md`, `tests/security/*.js`, `tests/abuso.test.js`, `tests/auditoria.test.js`.

> 🟢 Quatro camadas complementares: (1) autoridade no servidor via `verifyIdToken(token, true)` + consulta ao banco, (2) sincronização de Custom Claims pela trigger `syncCustomClaims`, (3) Security Rules do RTDB, (4) Security Rules do Storage (que não lê o RTDB e depende só das claims).

### 1. Fluxo de controle

| Função | Parâmetros | Retorno | Papel |
|---|---|---|---|
| `avaliarSuperAdmin` (`claims.js:35`) | `{uid, email, currentClaims, db}` | `{autorizado, motivo}` | Allowlist → e-mail mestre → migração legada |
| `syncCustomClaims` (`index.js:680`) | `event` (onValueWritten `profiles/{uid}`) | `null` \\| `{success:true}` | Normaliza role, bloqueia escalação, aplica assentos e claims de RH |
| `aplicarLimiteDeAssentos` (`index.js`) | `uid`, `tenantId`, `role` | `role` | Perfis novos acima do limite viram `pendente` |
| `verificarSuperAdmin` (`super_admin.js:46`) | `req`, `{auth, db}` | `{uid, email, claims}` | Token com checagem de revogação + perfil/allowlist/passaporte |
| `verificarChamador` (`cargos.js:50`) | `req`, `{auth, db}` | `{uid, email, claims, ehMaster, ehAdmin, tenantId}` | Autoriza `admin` ou `super_admin` |
| `papelDoChamador` (`usuarios.js:44`) | `uid`, `claims` | `{role, tenantId}` | Perfil no RTDB é autoridade para criar usuário |
| `validarCorpo` (`abuso.js:15`) | `req`, `limite` | `body` | Rejeita corpo > 16 KB antes de Auth/DB |
| `hashIp` (`abuso.js:33`) | `req` | `string` (32 hex) | SHA-256 de `obrareal:cargo:<ip>` — sem PII |
| `consumirCota` (`abuso.js:48`) | `db`, `chave`, `limite`, `janelaMs` | `void` | Transação em `rate_limits/<chave>/<bucket>/n`, `429` quando excede |
| `contextoRequisicao` (`auditoria.js:20`) | `req`, `inicio`, `roteiro` | objeto | `requestId`, `ipHash`, `userAgent`, `duracaoMs` |
| `registrar` (`auditoria.js:37`) | `db`, registro | `boolean` | `push` em `admin_audit`; `503` se obrigatória e falhar |
| `reservarOperacao` (`auditoria.js:74`) | `db`, `requestId`, dados | `{committed, idempotente}` | Transação em `admin_ops/<requestId>` |
| `liberarOperacao` (`auditoria.js:96`) | `db`, `requestId` | `void` | Remove reserva quando o efeito não foi aplicado |
| `handleAdminRequest` (`super_admin.js:348`) | `req`, `res`, `options` | `Promise<Response>` | `/api/admin/conta`: ações e leitura da Kiwify |
| `handleCargoRequest` (`cargos.js:340`) | `req`, `res`, `options` | `Promise<Response>` | `/api/admin/cargo`: `definir_cargo`/`remover_usuario` |
| `handleAprovacaoRequest` (`aprovacoes-api.js`) | `req`, `res`, `options` | `Promise<Response>` | `/api/admin/aprovacao`: decisão via Admin SDK |
| `executarLimpeza` (`retencao.js:54`) | `db`, `agora` | `resumo` | Remove dados expirados de 4 nós |
| `retencaoSegurancaJob` (`index.js:913`) | `event` | `Promise<void>` | `every day 03:30`, `America/Sao_Paulo` |

**Condicionais não-triviais:**
- `avaliarSuperAdmin` só aceita o passaporte `users/<email>/role` se `currentClaims.role === 'super_admin'` — gravar no nó legado não promove ninguém (`claims.js:52-68`).
- `syncCustomClaims` converte `mestre` → `encarregado`; `pendente`/`bloqueado` recebem claims `{role: status, tenantId: null}` e bloqueado também chama `revokeRefreshTokens` (`index.js:699-714`).
- Se `role='super_admin'` sem autoridade, a trigger reescreve o próprio perfil para `admin` e marca `cargoAtualizadoPor: 'syncCustomClaims'` (`index.js:741-753`).
- Para não-RH, `setCustomUserClaims` grava só `{role, tenantId}`; as chaves `modulosPermitidos`/`acessoObras`/`obrasPermitidas` ficam ausentes (equivalem a `null` nas rules) (`index.js:807-809`).
- Tentativa de autoalteração é bloqueada em `reset_password`, `bloquear_usuario`, `excluir_usuario` e `definir_cargo`.
- A reserva `admin_ops` só é liberada se o efeito **não** foi aplicado; após escrita com falha de auditoria, a reentrega responde `200 {idempotente:true}` (`super_admin.js:446-450`).
- `req.query` nunca é repassado à Kiwify; apenas 4 parâmetros explícitos, com `page_size ≤ 100` e `page_number ≤ 1000` (`super_admin.js:407-418`).

### 2. Algoritmos e lógica

- 🟢 Fail-closed em duas frentes: claims de acesso negadas para `pendente`/`bloqueado`, e operações destrutivas abortadas com `503 auditoria_falhou` quando a trilha não grava.
- 🟢 Idempotência por `requestId` com origem externa (`x-request-id` ou `body.requestId`) sanitizada para `[A-Za-z0-9_-]` e limitada a 128 caracteres (`auditoria.js:20-31`).
- 🟢 Cotas por IP hashado, UID, ação e recurso Kiwify; todas antes de chamadas caras ao Auth/RTDB (`super_admin.js:359-377,405`).
- 🟢 Allowlist de ações e recursos usa `Object.prototype.hasOwnProperty.call`, evitando herança de `Object.prototype` (`super_admin.js:374,400`).
- 🟢 `verifyIdToken(token, true)` invalida imediatamente tokens emitidos antes de bloqueio/rebaixamento (`super_admin.js:53-55`, `cargos.js:57`, `usuarios.js:85`).
- 🟢 Convite de criação de usuário é consumido por transação atômica no campo `usos`; falha na criação devolve a reserva (`usuarios.js:123-131`).
- 🟢 Perfil de super_admin é gravado com `tenantId: 'MASTER_SYSTEM'` e `status:'ativo'`; ao perder o papel, tokens são revogados (`index.js:731-758`).
- 🟢 RH recebe claims com escopo de módulos e obras; máximo de 50 obras e normalização para `especificas`/`todas` (`index.js:772-805`).
- 🟢 Retenção isolada por nó: falha em um não impede os outros; resultado `-1` sinaliza erro (`retencao.js:54-65`).
- 🟢 CORS restrito em duas listas (`cors.json` e `ALLOWED_ORIGINS` do worker), com `Vary: Origin`; COOP `same-origin-allow-popups` preserva o popup do Firebase Auth.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `SuperAdminAllowlist`, `ClaimSnapshot`, `AuditEntry`, `AdminOperationReservation`, `RateLimitBucket`, `AbuseContext`, `PermissionMatrix`, `RetentionPolicy` e a matriz de campos protegidos/cabeçalhos de segurança.

### 4. Metadados e configurações

- `EMAIL_MESTRA = 'tonycampelo@gmail.com'`; `MAX_LIMITE = 9999` (`super_admin.js:17-18`).
- `LIMITE_PADRAO_BODY = 16 * 1024` (`abuso.js:5`); cotas típicas: `admin:ip` 60/min, `admin:uid` 120/min, `admin:acao` 30/min, `admin:kiwify` 30/min, `criar:ip` 20/min, `criar:uid` 60/min.
- `ACOES_DESTRUTIVAS`: `excluir_usuario`, `bloquear_tenant`, `bloquear_usuario`, `remover_usuario`, `definir_plano`, `definir_cargo` (`auditoria.js:15-18`).
- APIs administrativas: `cors:false`, `memory:'256MiB'`, `timeoutSeconds:60`, `maxInstances:3` (`index.js:840-884`); webhook WhatsApp usa `maxInstances:5`.
- Jobs: `retencaoSegurancaJob` `03:30`, `aprovacoesPrazosJob` `06:00`, `dailyBillingStateJob` `04:00` — todos em `America/Sao_Paulo` (`index.js:905-924`).
- Constantes de retenção: `admin_audit` 90 dias; `admin_ops` 24 h; `whatsapp_messages` 24 h; `rate_limits` 2 h (`retencao.js:11-16`).
- Storage: tamanho de 1 byte a 10 MB, `contentType` `image/*` ou `application/pdf`, caminho `tenants/<tenantId>/...` (`storage.rules:24-40`).
- Bootstrap: `functions/set_super_admin.js` com service account local (gitignorado) e `databaseURL` fixa; não há bootstrap pelo navegador.
- Testes: `tests/security/rules.test.js`, `privilege-escalation.test.js`, `tenant-isolation.test.js`, `cors.test.js`, `billing.test.js`, `landing.test.js`, `auth-slug-regressions.test.js`, `tests/abuso.test.js`, `tests/auditoria.test.js`, `tests/super-admin.test.js`.

### 5. Lacunas / pontos de atenção 🔴

- 🔴 Histórico Git antigo ainda contém `node_modules` e a chave Web pública do Firebase; reescrita dos 423 commits não foi feita (`hardening.md:136-139`).
- 🟡 `'unsafe-inline'` permanece na CSP por causa de handlers inline no frontend (`hardening.md:105-106`).
- 🟡 Validação das rules com emulador falha por configuração de projeto (`demo-gestaodeobras`); as asserções estáticas em `tests/security/rules.test.js` são substituto temporário (`hardening.md:176-179`).
- 🟡 Alias legado `mestre` ainda é aceito em Storage Rules e em várias expressões do RTDB, aumentando a superfície de papéis a considerar (`storage.rules:14`; `database.rules.json:79-82`).
- 🟡 `EMAIL_MESTRA` é exceção histórica espelhada em todas as rules; remover exige coordinated deploy de rules + functions.
- 🟡 `syncCustomClaims` engole erro de `getUser` e retorna `null` sem retry, podendo deixar claims defasadas até nova escrita no perfil (`index.js:813-816`).
- 🟡 Diferente do webhook da Kiwify (lease de 2 min), `admin_ops` depende do job de 24 h para limpar reservas presas.
- 🟡 Storage Rules não consultam o RTDB: revogação imediata de token depende de `revokeRefreshTokens` em todos os caminhos de mudança de cargo/tenant.

### 6. Dependências

`auth`/`admin-e-super-admin` (ID token, allowlist, API master), `usuarios-e-cargos` (`profiles`, `users`, `invites`, `modulosPermitidos`), `billing-e-planos` (`billingState` nas rules), `whatsapp-bot` (`whatsapp_messages`, `telefone`, `whatsappId`), `aprovacoes` (`aprovacoes-api.js`), Firebase Auth/Admin SDK v14, Realtime Database, Cloud Storage, Secret Manager, Firebase Scheduler, Cloudflare Worker, Kiwify REST API, `cors.json`/`firebase.json`.

**Fluxograma:** [`flowcharts/seguranca-e-rbac.md`](flowcharts/seguranca-e-rbac.md)

---

## Módulo `infra-e-deploy` 🟢

**Arquivos principais:** `firebase.json` (66 linhas), `.firebaserc` (5), `functions/index.js` (exports), `server.js` (17), `package.json` (22), `functions/package.json` (22), `vitest.config.mjs` (8), `apphosting.yaml` (5), `wrangler.jsonc` (9), `cloudflare-worker/wrangler.toml` (8), `cloudflare-worker/worker.js` (143), `cors.json` (14), `.github/workflows/deploy.yml` (18), `.github/workflows/test.yml` (22), `.gitignore` (75), `docs/security/hardening.md:141-179`, `docs/security/cors.md`, `docs/security/tenants-public.md:39-58`, `public/js/data_core.js:269-294`, `public/js/slug.js:14-99`.

### 1. Fluxo de controle

| Artefato | Parâmetros / gatilho | Retorno / efeito | Papel |
|---|---|---|---|
| `fetch` (`worker.js:53`) | `request`, `env`, `ctx` | `Response` | Preflight CORS, slug, redirecionamento de reservados, proxy |
| `extractSlug` (`worker.js:88`) | `hostname` | `string | null` | Remove `.obrareal.com`; raiz e `www` → `null` |
| `applyCors` (`worker.js:38`) | `headers`, `request` | `Headers` | Allowlist + `Vary: Origin` |
| `isAllowedOrigin` (`worker.js:29`) | `origin` | `boolean` | Regex de `*.obrareal.com`, `web.app`, `firebaseapp.com` |
| `proxyToFirebase` (`worker.js:105`) | `request`, `url`, `firebaseUrl` | `Response` | Repassa path/query, `X-Forwarded-Host`, remove `host`, aplica cache |
| `detectSubdomain` (`data_core.js:270`) | `window.location`, `?tenant` | `string | null` | Hostname é autoridade em produção; parâmetro só em dev/staging |
| `loadTenantBySlug` (`data_core.js:292`) | `slug` | tenant | Leitura direta de `tenants_public/<slug>` |
| `isProductionHost` (`slug.js:67`) | `hostname` | `boolean` | `obrareal.com` ou `*.obrareal.com` |
| `buildTenantUrl` (`slug.js:83`) | `slug`, `loc`, `path`, `params` | `string` | Produção: `https://<slug>.obrareal.com/<path>`; dev: `?tenant=` |
| `buildAccountUpdates` (`slug.js:108`) | `p` | `updates` | Escrita multi-path: `tenants`, `tenants_public`, `users` |
| `server.js` (`server.js:1`) | `PORT` | servidor Express | `express.static('public')` + fallback `index.html` |
| `deploy.yml` | `push main` | Hosting live | `FirebaseExtended/action-hosting-deploy@v0` |
| `test.yml` | `push/PR main,master` | Vitest | Node 20 + `npm install` + `npm test -- --run` |

**Condicionais não-triviais:**
- Worker responde `OPTIONS` localmente com `204`; não encaminha preflight ao Firebase (`worker.js:57-61`).
- Subdomínio reservado no worker (`www`, `admin`, `api`, `mail`, `ftp`) gera `301` para o domínio raiz (`worker.js:71-74`).
- `extractSlug` compara `hostname.replace('.obrareal.com','')`; se não removeu nada, não há subdomínio (`worker.js:88-99`).
- `detectSubdomain` prefere `?tenant=` **somente** quando o host não é de produção; ignora `web.app`, `firebaseapp.com` e `localhost` (`data_core.js:276-282`).
- Cache do worker distingue assets (`js|css|png|jpg|svg|ico|woff?`) de HTML (`worker.js:132-136`).
- A resposta do Firebase tem eventual `Access-Control-Allow-Origin` removida antes de reaplicar a allowlist (`worker.js:126-129`).
- `firebase.json` usa `** → /index.html` como último rewrite, depois das 6 rotas de API (`firebase.json:11-40`).

### 2. Algoritmos e lógica

- 🟢 Proxy transparente: o navegador mantém `slug.obrareal.com`, enquanto o worker consulta `controle-obras-c889d.web.app` com o mesmo path/query (`worker.js:105-142`).
- 🟢 Isolamento de tenant no cliente é reforçado no login: perfil com `tenantId` diferente de `CURRENT_TENANT_ID` provoca `signOut` (`auth_core.js:396-402`).
- 🟢 Novo tenant em produção redireciona para `https://<slug>.obrareal.com/login.html` com e-mail preenchido, porque a sessão não atravessa origens (`auth_core.js:411-419`, `slug.js:97-99`).
- 🟢 Slug é normalizado (NFD, sem acentos, `a-z0-9`, 3–30 caracteres) e validado contra ~35 nomes reservados (`slug.js:21-48`).
- 🟢 `buildAccountUpdates` usa um único `update()` multi-path para `tenants`, `tenants_public` e `users`, garantindo criação atômica do tenant (`slug.js:102-140`).
- 🟢 Cabeçalhos de segurança são aplicados no Hosting para todo path (`firebase.json:41-55`).
- 🟢 Testes rodam em `jsdom` com globals do Vitest; workflows separam qualidade e publicação.

### 3. Estruturas de dados

Ver [`data-dictionary.md`](data-dictionary.md): `HostingConfig`, `RewriteMap`, `WorkerRoutingConfig`, `CorsPolicy`, `SecurityHeaders`, `CiPipeline`, `RuntimeConfig` e a matriz de ambientes/segredos.

### 4. Metadados e configurações

- Projeto Firebase: `controle-obras-c889d` (`.firebaserc:3`).
- Hosting: `public/`, `ignore` para `**/.*`, `node_modules`, `.bak*`, rewrite SPA e cabeçalhos CSP/COOP (`firebase.json:2-56`).
- Functions: `source: "functions"`; Node 24, `firebase-admin ^14.5.1`, `firebase-functions ^7.4.0`, `axios ^1.15.2`, `openai ^4.104.0` (`functions/package.json`).
- Raiz: Node 20, `express ^4.18.2`, `firebase ^13.4.0`, `vitest ^4.1.2`, `jsdom ^29.0.1`; scripts `build`, `start`, `test` (`package.json`).
- Worker: `gestaodeobras-worker`, `main: cloudflare-worker/worker.js` (ou `worker.js` no TOML), `compatibility_date: 2024-01-01`, rotas `obrareal.com/*` e `*.obrareal.com/*`.
- App Hosting: `cpu: 1`, `memoryMiB: 512` (`apphosting.yaml`).
- CORS Storage: origens `https://obrareal.com`, `https://www.obrareal.com`, `https://*.obrareal.com`, `https://controle-obras-c889d.web.app`, `https://controle-obras-c889d.firebaseapp.com`; métodos `GET, HEAD, POST`; header `x-goog-resumable`; `maxAgeSeconds: 3600`.
- CI: `deploy.yml` (Node 24 via `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`, `channelId: live`); `test.yml` (Node 20, cache npm).
- Segredos de deploy: 8 valores via Secret Manager listados em `hardening.md:144-152`; `FIREBASE_SERVICE_ACCOUNT_CONTROLE_OBRAS_C889D` no GitHub Actions; `functions/serviceAccountKey.json` local para bootstrap/migração.
- Documentação operacional: `docs/security/hardening.md`, `docs/security/cors.md`, `docs/security/super-admin.md`, `docs/security/tenant-isolation.md`, `docs/security/tenants-public.md`.

### 5. Lacunas / pontos de atenção 🔴

- 🔴 `deploy.yml` publica só Hosting: functions, database rules e storage rules dependem de comando manual; um merge pode criar inconsistência front/back.
- 🟡 Node 20 na raiz e Node 24 em `functions/` — engines divergentes sem documentação de motivo.
- 🟡 `wrangler.jsonc` e `cloudflare-worker/wrangler.toml` duplicam a configuração do mesmo worker.
- 🟡 `FIREBASE_URL` fixo no worker e `projectId` fixo no workflow dificultam staging/promotion.
- 🟡 `apphosting.yaml` não é usado pelo pipeline observado.
- 🟡 Listas de subdomínios reservados divergem: 5 no worker, ~35 em `slug.js`.
- 🟡 `.firebaserc` consta no `.gitignore` (`.gitignore:11`) apesar de existir — conferir rastreamento antes de editar.
- 🟡 O job de deploy não executa testes; estes rodam em workflow separado disparado por push/PR.
- 🟡 Sem alerta automático para `auditoria_falhou` ou falha de `retencaoSegurancaJob`.

### 6. Dependências

Firebase Hosting/CLI, Firebase Functions v2, Realtime Database, Cloud Storage, Cloudflare Workers, GitHub Actions, Secret Manager, gcloud/gsutil (CORS do bucket), Node 20/24, Express, Vitest/jsdom, Kiwify REST API, Meta Graph API, OpenAI API, scripts Admin SDK locais (`set_super_admin.js`, `scripts/migrar-tenants-public.js`).

**Fluxograma:** [`flowcharts/infra-e-deploy.md`](flowcharts/infra-e-deploy.md)
