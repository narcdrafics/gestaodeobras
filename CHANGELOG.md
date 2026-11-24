# Histórico de Versões (Changelog) - Obra Real

Todas as mudanças notáveis para o projeto **Obra Real** serão documentadas neste arquivo seguindo o padrão [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) e [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Corrigido
- Auto-cadastro por slug voltou a funcionar depois do hardening: as rules aceitam a criação `self_signup` apenas com `emailAdmin`/UID do próprio usuário, plano gratuito fixo e limites imutáveis, casando tenant, `tenants_public` e passaporte na mesma escrita atômica.
- Login não entra mais no tenant errado quando o subdomínio ainda está sendo resolvido; falha/timeout na identificação encerra a sessão. O guard de Super Admin também cobre o login com Google e contas sem perfil não ficam autenticadas.
- CSP volta a liberar hosts usados pelo Google Auth e pelo Firebase Storage; COOP continua `same-origin-allow-popups`. Rotas do Worker/restauração da raiz e cache-busting dos scripts de login/app alinhados.

### Segurança
- **WhatsApp:** verify token, App Secret, WABA e Phone Number ID passaram a vir do Secret Manager; assinatura validada no corpo bruto, matching normalizado/exato com rejeição de ambiguidade, dedup por `msg.id`, ACK após processamento, remoção do ramo `page` e allowlist de host para áudio (`functions/whatsapp_auth.js`).
- **Kiwify:** idempotência atômica por `orderId + eventType` (sem status), reserva `processing` com lease, `payloadHash` sem status, conflito só ignorado contra `success`, efeitos e marca final na mesma escrita e `tenant_not_found` reprocessável como `pending_tenant` (`functions/kiwify.js`).
- **APIs administrativas:** `verifyIdToken(token, true)`, papel reconfirmado no perfil/allowlist, contas `disabled` barradas, validação de método/cota antes do Auth, allowlist por `hasOwnProperty`, auto-reset bloqueado, tenant obtido do perfil e parâmetros Kiwify explicitamente limitados.
- **Abuso:** payload de 16 KB, IP hashado, cotas transacionais em `rate_limits`, `cors: false` e `maxInstances` reduzido em webhooks/APIs (`functions/abuso.js`).
- **Auditoria:** `requestId`, IP hashado, User-Agent e duração em `admin_audit`; ações destrutivas idempotentes por `requestId` em `admin_ops`, com fail-closed e preservação da reserva se o efeito foi aplicado antes de falhar a auditoria (`functions/auditoria.js`).
- **Retenção:** job diário `retencaoSegurancaJob` limpa auditoria (90 dias), dedup/reservas (24h) e cotas expiradas (`functions/retencao.js`).
- **CSP/CORS:** removido `'unsafe-eval'`, `img-src` com domínios explícitos, COOP `same-origin-allow-popups` para manter o popup do Firebase Auth; CORS da Storage e do worker continua em allowlist.
- **Dependências:** `firebase-admin@14.5.1` e `firebase-functions@7.4.0` com migração para a API modular; `npm audit` sem vulnerabilidades na raiz e em `functions/`.
- **Git:** ~7 mil arquivos de `functions/node_modules` removidos do índice e mantidos ignorados; `.gitignore` passou a cobrir `.env*`; chave Web do Firebase deixou de ser fixa no script local de teste. Nenhuma chave privada/.env/service account apareceu na varredura dos 423 commits.

### Adicionado
- Documentação consolidada em `docs/security/hardening.md` e notas de deploy/segredos.
- Suítes `tests/whatsapp-auth.test.js`, `tests/kiwify-idempotency.test.js`, `tests/abuso.test.js` e `tests/auditoria.test.js`.

## [1.4.0] - 2026-11-22
### Adicionado
- Recuperação de senha funcional na tela de login: o link "Esqueceu?" abre um painel que envia o link de redefinição nativo do Firebase Auth, com mensagem genérica que não revela se o e-mail está cadastrado (`login.html`, `js/auth_core.js`).
- Ao criar um usuário no painel Admin, a Cloud Function `criarUsuarioTenant` cria a conta no Firebase Auth com uma senha temporária e o painel exibe e-mail + senha num modal, com botão para copiar (`functions/usuarios.js`, `modals/modal-credenciais-usuario.html`).
- Rota `/api/admin/criar-usuario` no Firebase Hosting e testes de contrato para os dois fluxos (`tests/auth-credentials.test.js`).

### Segurança
- A criação de credenciais exige ID token válido, cargo `admin`/`super_admin`, convite prévio do mesmo tenant e bloqueia redefinição de senha de e-mails vinculados a outra empresa. A senha temporária nunca é gravada no Realtime Database; `role`/`tenantId` continuam sendo definidos pelo perfil e propagados por `syncCustomClaims`.
- **Fase 1 — escalação de privilégios:** `profiles/$uid`, `users/$email` e `invites/$email` não aceitam mais escrita de `role`/`tenantId` pelo cliente, e nenhum cliente pode gravar `super_admin`. A fonte canônica passa a ser `super_admins/<uid>` (allowlist gravada só com Admin SDK, `.write: false` nas rules).
- Novo endpoint `POST /api/admin/cargo` (`gerenciarCargo`): toda alteração de cargo/tenant passa por verificação de ID token e papel no servidor, com auditoria, revogação de tokens e remoção da allowlist quando o cargo master é retirado. Admin de tenant não promove a master, não cruza tenant e não se altera.
- `syncCustomClaims` não promove mais com base em `users/<email>/role`: usa `avaliarSuperAdmin()`. O passaporte legado apenas migra contas que já tinham a claim `super_admin`; escalações bloqueadas têm os tokens revogados e o perfil corrigido.
- Removido o bootstrap de Super Admin pelo navegador; o primeiro master é criado via `functions/set_super_admin.js`. Documentação atualizada em `docs/security/super-admin.md` e cobertura com 22 novos testes em `tests/security/privilege-escalation.test.js`.
- **Isolamento entre empresas:** `users/<email>` e `invites/<email>` deixaram de ser legíveis por qualquer usuário autenticado; convites só podem ser criados no próprio tenant (com `email` casando a chave) e só o dono ou o admin do tenant pode removê-los. `tenants_public/<slug>` teve o `tenantId` tornado imutável e a criação de tenant exige `emailAdmin` igual ao e-mail autenticado, fechando o sequestro de slug/empresa entre empresas. `admin_audit` passou a usar a allowlist `super_admins/<uid>` em vez do passaporte legado.
- `storage.rules` agora exige claims de tenant **e** papel válido no caminho, limita tamanho/tipo de arquivo e nega qualquer caminho fora de `tenants/<tenantId>/`. O "Primeiro Acesso" do painel Master não lê mais `users/<email>` sem autenticação. Ver `docs/security/tenant-isolation.md` e `tests/security/tenant-isolation.test.js`.

---

## [1.3.0] - 2026-11-14
### Adicionado
- Cadastro com escolha do slug: ao entrar pela primeira vez, o usuário escolhe o endereço da empresa (`<slug>.obrareal.com`) numa tela com checagem de disponibilidade em tempo real (`js/slug.js`, `js/slug_onboarding.js`).
- A empresa é criada numa única escrita atômica (tenant + nó público + passaporte global), o que impede duas empresas com o mesmo slug e faz a conta aparecer no painel do Master.
- Painel do Master: mostra `slug.obrareal.com`, plano e origem (auto-cadastro) de cada empresa e avisa/atualiza quando entra uma empresa nova.
- Slugs reservados (www, app, admin, login...) não podem ser escolhidos.

### Modificado
- Auto-onboarding deixa de gerar slug aleatório (`joao123`). Em produção, após criar, o usuário é levado a `https://<slug>.obrareal.com/login.html` (e-mail preenchido); em dev/staging a URL vira `app.html?tenant=<slug>`.
- Login em subdomínio de uma empresa por conta sem vínculo não cria mais empresa nova (antes gerava um tenant órfão).

### Segurança
- Painel do Master passa a escapar nome, slug, e-mail e IDs vindos do banco (antes iam direto para `innerHTML` e `onclick`, permitindo XSS contra o Master).

---

## [1.2.0] - 2026-11-10
### Segurança
- Hosting passa a publicar apenas `public/` (antes `"public": "./"` expunha JSONs de dados, regras, código das functions e testes).
- Removidos do repositório `users.json`, `auth_users.json`, `tenant.json` e `entities.json`; adicionados ao `.gitignore` junto com `serviceAccountKey.json`.

### Modificado
- Arquivos do front (`index/app/login/admin-login/obrigado.html`, `css/`, `img/`, `js/`, `pages/`, `modals/`) movidos para `public/`.
- `server.js` serve somente `public/`; testes apontam para `public/js/`.
- `raw/` e `wiki/` movidos para `docs/`.
- `package.json` da raiz: removidas dependências sem uso (`axios`, `firebase`, `firebase-functions`, `firebase-tools`, `openai`).

### Removido
- Backups `js/app_core.js.bak`, `.tmp` e `.bak2`; pasta `scratch/`; `test_*.js` soltos na raiz; `.code-workspace` e `mempalace.yaml`.
- Bloco comentado de `renderPage` em `app_core.js`.

---

## [1.1.0] - 2026-04-01
### Adicionado
- Infraestrutura de testes unitários com **Vitest** e `jsdom`.
- Módulo isolado de utilitários em `js/utils.module.js` para garantir integridade de cálculos.
- Primeiros testes unitários para o módulo de estoque e formatação de dados.

### Modificado
- `package.json`: Adicionado script `npm test`.

---

## [1.0.0] - 2026-03-27
### Adicionado
- Versão inicial estável com gestão de obras, tarefas, estoque e financeiro.
- Sincronização em tempo real com Firebase.
- Sistema de subdomínios (multitenancy).
- Banner de trial progressivo e integração com WhatsApp.
