# Inventário do Projeto — obra-real (gestaodeobras)

> Gerado pelo **Scout** em 2026-11-27 — nível de documentação: `completo`
> Legenda: 🟢 CONFIRMADO (lido diretamente do código/config) · 🟡 INFERIDO (deduzido de nomes e padrões)

---

## 1. Escopo da varredura

Foram contabilizados **169 arquivos**. Excluídos da varredura: `node_modules/` (raiz e `functions/`), `.git/`, `.reversa/`, `.agents/` (metadados do framework Reversa), `dist/`, `build/`, `coverage/`, `__pycache__/`, `.cache/`.

🟢 **Nome declarado:** `obra-real` v1.4.0 — "Obra Real - Gestão Profissional de Obras" (`package.json`).
🟢 **Projeto Firebase:** `controle-obras-c889d` (`.firebaserc`).

## 2. Árvore de diretórios

```
gestaodeobras/
├── .firebase/                   1 arquivo (cache de hosting)
├── .github/workflows/           2 arquivos (deploy.yml, test.yml)
├── cloudflare-worker/           3 arquivos (worker.js, wrangler.toml, README.md)
├── docs/                       16 arquivos
│   ├── plans/                    1 (features.md)
│   ├── raw/whatsapp-bot/         3
│   ├── security/                 6 (billing, cors, hardening, super-admin, tenant-isolation, tenants-public)
│   └── wiki/                     6 (index.md, log.md, whatsapp-bot/3)
├── functions/                  23 arquivos
│   ├── whatsapp/                 2 (obra-etapas.js, parser-tarefas.js)
│   └── (raiz)                   21 (index.js, auth, billing, aprovacoes, cargos, kiwify, etc.)
├── public/                     66 arquivos
│   ├── css/                      2 (app.css, style.css)
│   ├── img/                      8 (inclui img/ads/2)
│   ├── js/                      13 (app_core.js, auth_core.js, data_core.js, etc.)
│   ├── modals/                  19 (modal-obra, modal-medicao, modal-pix-view, etc.)
│   ├── pages/                   18 (dashboard, obras, tarefas, estoque, financeiro, etc.)
│   └── (raiz HTML)               6 (index, app, login, admin-login, legal, obrigado)
├── scripts/                     2 (migrar-itens-estoque.js, migrar-tenants-public.js)
├── tests/                      42 arquivos
│   ├── security/                 7
│   ├── helpers/                  2 (fake-db.js + helpers.test.js na raiz)
│   ├── estoqueajuste/            1
│   └── (raiz)                   32 (*.test.js)
└── (raiz)                      14 arquivos (server.js, firebase.json, wrangler.jsonc,
                                 vitest.config.mjs, database.rules.json, storage.rules, ...)
```

## 3. Linguagens e contagem por extensão 🟢

| Linguagem / tipo | Extensões | Arquivos |
|---|---|---:|
| JavaScript | `.js` | 80 |
| HTML | `.html` | 43 |
| Markdown | `.md` | 19 |
| Imagens | `.png` | 8 |
| JSON | `.json` | 7 |
| YAML | `.yml`, `.yaml` | 3 |
| CSS | `.css` | 2 |
| Configuração various | `.mjs`, `.jsonc`, `.toml`, `.rules`, `.firebaserc`, `.gitignore`, `.cache` | 7 |

**Linguagem principal: JavaScript** (sem TypeScript, sem build transpilador — `npm run build` apenas ecoa "Static assets ready.").

Arquivos JavaScript mais extensos (linhas, 🟢):

| Arquivo | Linhas |
|---|---:|
| `public/js/app_core.js` | 7.479 |
| `public/js/utils.module.js` | 1.509 |
| `public/js/data_core.js` | 1.092 |
| `functions/index.js` | 816 |
| `public/js/auth_core.js` | 721 |
| `functions/aprovacoes.js` | 654 |
| `public/js/aprovacoes_ui.js` | 504 |
| `public/js/estoque.module.js` | 458 |
| `functions/kiwify.js` | 450 |

## 4. Frameworks, runtime e integrações 🟢

- **Front-end:** HTML + JS vanilla, Firebase Client SDK 13.4.0, SPA com fallback para `index.html`. Sem framework de UI.
- **Servidor local:** Express 4.22.3 (somente serving estático de `public/`).
- **Backend:** Firebase Cloud Functions v2 (`firebase-functions` 7.4.0, `firebase-admin` 14.5.1), Node 24 no pacote `functions/`.
- **Banco:** Firebase Realtime Database (RTDB), protegido por `database.rules.json`; Storage com `storage.rules`.
- **Edge:** Cloudflare Worker (`gestaodeobras-worker`) faz proxy wildcard `*.obrareal.com` → Firebase Hosting e aplica CORS com allowlist.
- **Integrações externas:** Meta WhatsApp Cloud API (webhook + envio), OpenAI (`gpt-4o-mini` e `whisper-1`), Kiwify (webhook + REST), Firebase Auth, Google Analytics/Tag Manager (via CSP).
- **Gerenciadores de pacote:** npm (dois `package-lock.json`: raiz e `functions/`).

Detalhes de versões em [`dependencies.md`](dependencies.md).

## 5. Pontos de entrada 🟢

| Caminho | Tipo | Observação |
|---|---|---|
| `server.js` | `server_entry` | Express: `express.static(public/)` + `app.get('*')` → `index.html`; porta `PORT \|\| 8080` |
| `public/index.html` | `web_entry` | Shell da SPA / landing |
| `public/app.html` | `app_shell` | Shell da aplicação autenticada |
| `functions/index.js` | `functions_entry` | Define webhooks, agendas (cron), triggers RTDB e exports centrais |
| `cloudflare-worker/worker.js` | `edge_worker_entry` | Router de subdomínios/CORS |
| `public/js/app_core.js` | `frontend_core` | Núcleo de páginas/ações (~7,5k linhas) |
| `public/js/auth_core.js` | `auth_core` | Autenticação/sessão |
| `public/js/data_core.js` | `data_core` | Acesso a dados + `window.hasFeature()` |

**Scripts npm (raiz):** `build` = eco estático · `start` = `node server.js` · `test` = `vitest`.
**Scripts npm (functions):** `serve`, `shell`, `deploy` (`firebase deploy --only functions`), `logs`.

## 6. Configuração e CI/CD 🟢

- `firebase.json`: Hosting (`public/`) com 7 rewrites de `/api/*` para funções + fallback SPA; CSP rígida e `Cross-Origin-Opener-Policy`; aponta rules de database/storage e `functions/`.
- `.firebaserc`: projeto `controle-obras-c889d`.
- `wrangler.jsonc` e `cloudflare-worker/wrangler.toml`: rotas `obrareal.com/*` e `*.obrareal.com/*`.
- `vitest.config.mjs`: ambiente `jsdom`, `globals: true`.
- `apphosting.yaml`: App Hosting (1 CPU / 512 MiB).
- `cors.json`, `database.rules.json`, `storage.rules`: políticas de acesso.
- `.github/workflows/deploy.yml`: deploy no Firebase Hosting no push em `main` (canal `live`).
- `.github/workflows/test.yml`: `npm install` + `npm test -- --run` em push/PR (`main`, `master`), Node 20.
- **Docker:** 🟢 ausente (nenhum `Dockerfile`/`docker-compose.yml` encontrado).

## 7. Banco de dados (varredura superficial) 🟢

Não há DDL, migrations, schemas ORM ou `prisma/` — o "schema" é implícito nos caminhos do RTDB e nas Security Rules.

| Arquivo | Tipo |
|---|---|
| `database.rules.json` | Regras do Realtime Database (profiles, tenants, tenants_public, aprovacoes, etc.) |
| `storage.rules` | Regras do Cloud Storage (`tenants/{tenantId}/**`, validate de tipo/tamanho) |
| `functions/*.js` | Paths RTDB usados (`tenants/{tenantId}/obras`, `/tarefas`, `/presenca`, `profiles/{uid}`, `super_admins/{uid}`, ...) |

🟡 Entidades prováveis inferidas dos paths e regras: `tenants`, `profiles`, `users`, `invites`, `super_admins`, `obras`, `tarefas`, `trabalhadores`, `presenca`, `almocos`, `estoque`, `compras`, `financeiro`, `medicao`, `orcamento`, `aprovacoes`, `auditoria`, `planos/billing`, `tenants_public`. A análise detalhada cabe ao **Data Master**.

## 8. Cobertura de testes 🟢

| Item | Valor |
|---|---|
| Framework | Vitest 4.1.12 (resolvido) / ^4.1.2 (declarado) |
| Ambiente | jsdom 29.0.1 |
| Arquivos `*.test.js` / `*.spec.*` | **40** |
| Helpers de teste | `tests/helpers/fake-db.js`, `tests/utils_wrapper.js` |
| Suítes notáveis | segurança (tenant-isolation, privilege-escalation, rules, cors, billing, auth-slug), aprovacoes, kiwify, whatsapp-auth, estoque, pix, plan-features, super-admin |

🟡 Cobertura percentual não pode ser estimada sem executar `vitest --coverage` (nenhum provider de cobertura configurado).

## 9. Módulos identificados 🟡

Agrupamento feito por domínio a partir de `public/pages/`, `public/js/`, `functions/` e `tests/`:

1. `auth` — `auth_core.js`, `auth-credentials.test.js`, Firebase Auth
2. `tenants-e-slug` — `slug.js`, `slug_onboarding.js`, `tenants_public`, worker de subdomínio
3. `admin-e-super-admin` — `pages/admin.html`, `pages/super_admin.html`, `functions/super_admin.js`, `set_super_admin.js`
4. `usuarios-e-cargos` — `functions/usuarios.js`, `cargos.js`, `claims.js`, modais de usuário
5. `aprovacoes` — `functions/aprovacoes.js`, `aprovacoes-api.js`, `pages/aprovacoes.html`
6. `obras` — `pages/obras.html`, `modal-obra.html`
7. `tarefas` — `pages/tarefas.html`, `modal-tarefa.html`, integração WhatsApp
8. `trabalhadores` — `pages/trabalhadores.html`, `modal-trabalhador.html`
9. `presenca-e-ponto` — `pages/presenca.html`, `modal-presenca.html`, `lancar_ponto`
10. `almocos` — `pages/almocos.html`, `modal-almoco.html`
11. `compras` — `compras_ui.js`, `pages/compras.html`, `modal-compra.html`
12. `estoque` — `estoque.module.js`, `pages/estoque.html`, `pages/movEstoque.html`
13. `financeiro-e-pix` — `pix_logic.js`, `pix_ui.js`, `pages/financeiro.html`, `modal-pix-view.html`
14. `orcamento` — `pages/orcamento.html`, `modal-orcamento.html`, `modal-lote.html`
15. `medicao` — `pages/medicao.html`, `modal-medicao.html`
16. `relatorios-e-dashboard` — `pages/relatorios.html`, `pages/dashboard.html`, `pages/hoje.html`
17. `fotos` — `pages/fotos.html`, Storage rules
18. `billing-e-planos` — `billing.js`, `plan_features.js` (back/front), `plans.js`, Kiwify
19. `whatsapp-bot` — `functions/whatsapp/*`, `whatsapp_auth.js`, `dailyReport`
20. `seguranca-e-rbac` — `database.rules.json`, `storage.rules`, `claims.js`, `auditoria.js`, `tests/security/`
21. `infra-e-deploy` — `firebase.json`, `.github/workflows/`, `cloudflare-worker/`, `server.js`, `apphosting.yaml`

## 10. Sugestão de organização das specs 🟡

**Granularidade sugerida: `endpoint`.**

**Razão:** existe roteamento centralizado explícito — `firebase.json` mapeia 7 rotas `/api/*` para Cloud Functions, `functions/index.js` concentra os exports (`onRequest`, `onSchedule`, `onValueWritten`) e `server.js` define o fallback SPA.

**Sinais:** `centralized_routing` → [`firebase.json`, `functions/index.js`, `server.js`]; sinais secundários de domínio em [`public/pages/`, `public/js/`, `functions/`].

> A decisão final pertence ao usuário (menu de organização das specs, entre Scout e Arqueólogo).
