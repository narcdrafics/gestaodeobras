# Matriz Código ↔ Spec

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA / sem spec. Índice inicial: coluna "Artefatos de spec" de `traceability/spec-impact-matrix.md` §4, conforme regra 7 do Redator.

## 1. Convenção

| Coluna | Significado |
|--------|-------------|
| Arquivo do legado | Caminho real ou glob do repositório |
| Unit correspondente | Pasta em `_reversa_sdd/` que cobre o comportamento |
| Cobertura | 🟢 comportamento confirmado e especificado · 🟡 parcial/inferido · 🔴 lacuna bloqueante · n/a fora do escopo |

🟢 `node_modules/`, `package-lock.json` e artefatos gerados são **n/a** por definição.

## 2. Backend — Cloud Functions

| Arquivo do legado | Unit correspondente | Cobertura |
|---|---|---|
| `functions/index.js` (exports `onRequest`) | `webhook-kiwify/`, `webhook-whatsapp/`, `api-admin-conta/`, `api-admin-cargo/`, `api-admin-criar-usuario/`, `api-admin-aprovacao/` | 🟢 |
| `functions/index.js` (claims e triggers) | `trigger-sincronizar-claims/`, `trigger-limite-obras/`, `trigger-limite-usuarios/`, `trigger-plano-subdominio/`, `trigger-aplicar-aprovacao/` | 🟢 |
| `functions/index.js` (jobs) | `job-estado-cobranca/`, `job-prazos-aprovacao/`, `job-retencao-seguranca/`, `job-relatorio-diario/` | 🟢 / 🟢 GAP-03 (P3, ajuste pendente) / 🔴 GAP-05 |
| `functions/index.js` (lógica do bot) | `webhook-whatsapp/`, `contrato-whatsapp/` | 🟢 / 🟢 GAP-01 (P1) e GAP-02/04 (P2/P4) / 🔴 GAP-05 |
| `functions/auth_core.js` | n/a — o módulo existe apenas em `public/js/auth_core.js` (linha 3) | n/a |
| `functions/claims.js` | `contrato-autenticacao-e-claims/`, `trigger-sincronizar-claims/` | 🟢 / 🟡 (GAP-09) |
| `functions/usuarios.js` | `api-admin-criar-usuario/`, `contrato-admin-e-usuarios/` | 🟢 |
| `functions/cargos.js` | `api-admin-cargo/`, `contrato-admin-e-usuarios/` | 🟢 |
| `functions/super_admin.js` | `api-admin-conta/`, `contrato-admin-e-usuarios/`, `contrato-billing-e-planos/` | 🟢 |
| `functions/aprovacoes.js` | `trigger-aplicar-aprovacao/`, `contrato-aprovacoes/`, `contrato-suprimentos-e-custos/` | 🟢 |
| `functions/aprovacoes-api.js` | `api-admin-aprovacao/` | 🟢 |
| `functions/billing.js` | `job-estado-cobranca/`, `contrato-billing-e-planos/` | 🟢 |
| `functions/kiwify.js` | `webhook-kiwify/`, `contrato-billing-e-planos/` | 🟢 |
| `functions/kiwify_api.js` | `api-admin-conta/`, `contrato-billing-e-planos/` | 🟢 |
| `functions/plan_catalog.js` | `contrato-billing-e-planos/`, `trigger-limite-obras/`, `trigger-limite-usuarios/` | 🟢 |
| `functions/plan_features.js` | `contrato-billing-e-planos/`, `webhook-whatsapp/` | 🟢 |
| `functions/whatsapp_auth.js` | `webhook-whatsapp/`, `contrato-whatsapp/` | 🟢 |
| `functions/whatsapp/obra-etapas.js` | `webhook-whatsapp/`, `contrato-whatsapp/` | 🟢 |
| `functions/whatsapp/parser-tarefas.js` | `contrato-whatsapp/`, `contrato-obras-e-tarefas/` | 🔴 órfão hoje; 🟢 decisão P2 de ativação, P4 sem `tarefas_pendentes` |
| `functions/abuso.js` | `api-admin-criar-usuario/`, `api-admin-conta/`, `api-admin-cargo/`, `api-admin-aprovacao/`, `webhook-kiwify/`, `webhook-whatsapp/` | 🟢 |
| `functions/auditoria.js` | `api-admin-conta/`, `api-admin-cargo/`, `api-admin-criar-usuario/`, `api-admin-aprovacao/` | 🟢 / 🟡 (GAP-10) |
| `functions/retencao.js` | `job-retencao-seguranca/`, `contrato-whatsapp/` | 🟢 |
| `functions/set_super_admin.js` | `contrato-autenticacao-e-claims/` | 🟢 |
| `functions/test_tenants_public.js` | `contrato-tenants-e-slug/` | 🟡 (utilitário de teste) |
| `functions/power_sync_run.js` | n/a | n/a (script operacional sem comportamento de produto) |
| `functions/package.json` | `contrato-infra-e-deploy/` | 🟡 (Node 24 — GAP-07) |

## 3. Frontend — `public/js/`

| Arquivo do legado | Unit correspondente | Cobertura |
|---|---|---|
| `public/js/auth_core.js` | `contrato-autenticacao-e-claims/` | 🟢 |
| `public/js/data_core.js` | `contrato-tenants-e-slug/`, `contrato-billing-e-planos/`, `contrato-relatorios-e-fotos/`, `contrato-admin-e-usuarios/` | 🟢 |
| `public/js/app_core.js` (render/cadastro) | `contrato-obras-e-tarefas/`, `contrato-pessoal-e-presenca/`, `contrato-suprimentos-e-custos/`, `contrato-relatorios-e-fotos/` | 🟢 |
| `public/js/app_core.js` (gates/billing) | `contrato-billing-e-planos/` | 🟢 |
| `public/js/utils.module.js` (cálculos) | `contrato-suprimentos-e-custos/`, `contrato-relatorios-e-fotos/`, `contrato-pessoal-e-presenca/` | 🟢 |
| `public/js/compras_ui.js` | `contrato-suprimentos-e-custos/` | 🟢 |
| `public/js/estoque.module.js` | `contrato-suprimentos-e-custos/` | 🟢 / 🟢 decisão P11 (correção pendente) / 🟢 P17 (`normEstoqueNome`) |
| `public/js/pix_logic.js`, `public/js/pix_ui.js` | `contrato-suprimentos-e-custos/` | 🟢 / 🟢 decisão P12 (soma ao `valpago`; correção pendente) |
| `public/js/aprovacoes_ui.js` | `contrato-aprovacoes/`, `contrato-suprimentos-e-custos/` | 🟢 |
| `public/js/plan_features.js`, `public/js/plans.js` | `contrato-billing-e-planos/` | 🟢 |
| `public/js/slug.js`, `public/js/slug_onboarding.js` | `contrato-tenants-e-slug/` | 🟢 |
| `public/js/parser-tarefas.js` (se existir no front) | `contrato-obras-e-tarefas/` | 🔴 (espelho órfão) |

## 4. Frontend — páginas e modais

| Arquivo do legado | Unit correspondente | Cobertura |
|---|---|---|
| `public/pages/{dashboard,relatorios}.html` | `contrato-relatorios-e-fotos/` | 🟢 |
| `public/pages/fotos.html` | `contrato-relatorios-e-fotos/` | 🟢 |
| `public/pages/{obras,tarefas}.html` | `contrato-obras-e-tarefas/` | 🟢 |
| `public/pages/{trabalhadores,presenca,almocos,hoje}.html` | `contrato-pessoal-e-presenca/` | 🟢 |
| `public/pages/{compras,estoque,movEstoque,financeiro,orcamento,medicao}.html` | `contrato-suprimentos-e-custos/` | 🟢 |
| `public/pages/{admin,super_admin}.html` | `contrato-admin-e-usuarios/`, `contrato-billing-e-planos/` | 🟢 |
| `public/pages/aprovacoes.html` | `contrato-aprovacoes/` | 🟢 |
| `public/modals/*.html` | Unit do domínio do modal (`contrato-*` correspondente) | 🟢 |
| `public/index.html`, `public/app.html` | `contrato-infra-e-deploy/` (fallback SPA) | 🟢 |

## 5. Configuração, regras e infra

| Arquivo do legado | Unit correspondente | Cobertura |
|---|---|---|
| `firebase.json` (rewrites/headers) | `contrato-infra-e-deploy/`, `openapi/api.yaml` | 🟢 |
| `.firebaserc` | `contrato-infra-e-deploy/` | 🟡 |
| `database.rules.json` | `contrato-autenticacao-e-claims/`, `contrato-billing-e-planos/`, `contrato-aprovacoes/`, `contrato-suprimentos-e-custos/`, `contrato-whatsapp/` | 🟢 / 🟡 (GAP-08) |
| `storage.rules` | `contrato-relatorios-e-fotos/`, `contrato-autenticacao-e-claims/` | 🟢 |
| `cors.json`, `docs/security/cors.md` | `contrato-infra-e-deploy/` | 🟡 (GAP-07) |
| `cloudflare-worker/worker.js` | `contrato-infra-e-deploy/` | 🟢 |
| `wrangler.jsonc`, `cloudflare-worker/wrangler.toml` | `contrato-infra-e-deploy/` | 🟡 (GAP-07) |
| `server.js` | `contrato-infra-e-deploy/` | 🟢 |
| `.github/workflows/test.yml`, `deploy.yml` | `contrato-infra-e-deploy/` | 🟢 / 🔴 (deploy split) |
| `apphosting.yaml` | `contrato-infra-e-deploy/` | 🟡 |
| `vitest.config.mjs`, `package.json` | `contrato-infra-e-deploy/` | 🟢 |

## 6. Testes e documentação

| Arquivo do legado | Unit correspondente | Cobertura |
|---|---|---|
| `tests/*.test.js` (domínio) | Unit do domínio correspondente (`contrato-*` / `api-*`) | 🟢 |
| `tests/security/*.test.js` | `contrato-autenticacao-e-claims/`, `contrato-billing-e-planos/`, `contrato-relatorios-e-fotos/`, `contrato-whatsapp/` | 🟢 / 🟡 (GAP-08) |
| `tests/helpers/*`, `tests/utils_wrapper.js` | n/a | n/a (infra de teste) |
| `docs/security/*.md` | `contrato-infra-e-deploy/`, `contrato-autenticacao-e-claims/`, `contrato-billing-e-planos/` | 🟢 |
| `docs/wiki/whatsapp-bot/*.md` | `contrato-whatsapp/` | 🟢 / 🔴 (parser órfão) |
| `docs/raw/**`, `docs/plans/features.md`, `docs/TODO-*.md` | n/a | n/a (documentação histórica) |

## 7. Cobertura e lacunas

| Métrica | Valor | Confiança |
|---------|-------|-----------|
| Units de spec | 🟢 26 (6 HTTP · 5 triggers · 4 jobs · 11 contratos de dados) | 🟢 |
| Arquivos canônicos | 🟢 78 (26 × requirements/design/tasks) | 🟢 |
| Contratos externos/de evento opcionais | 🟢 15 (`contracts.md`: 6 HTTP + 5 triggers + 4 jobs) | 🟢 |
| Questions opcionais | 🟢 1 (`webhook-whatsapp/questions.md`) | 🟢 |
| Arquivos opcionais total | 🟢 16 | 🟢 |
| Globais | 🟢 `openapi/api.yaml`, 10 `user-stories/*.md`, este arquivo | 🟢 |
| Módulos cobertos | 🟢 21/21 (`context/modules.json`) | 🟢 |
| Arquivos de código mapeados a alguma unit | 🟢 ~92% (excluindo `node_modules`, locks e docs históricos) | 🟡 |
| Lacunas bloqueantes | 🔴 somente GAP-05 (P5 sem decisão; ver `questions.md`) | 🟢 |
| Lacunas não bloqueantes | 🟡 GAP-06…GAP-10, L-15 (P15) e L-19 (P19); demais Ls decididas (ver `spec-impact-matrix.md` §6) | 🟢 |

## 8. Regras para o Revisor

1. 🔴 Toda spec que toca GAP-05 deve manter o marcador bloqueante — nenhum comportamento novo pode ser inferido. GAP-01…GAP-04 e L-11…L-14, L-16…L-18 e L-20 têm decisão humana em `questions.md`.
2. 🟢 Toda spec de autorização cita `permissions.md`, a rule correspondente e o ADR aplicável (regra 1 da matriz de impacto).
3. 🟢 Toda spec de cálculo derivado declara que o valor não é persistido (`ADR-008`).
4. 🟢 Toda spec de webhook declara chave de dedup, lease e reentrega (`ADR-004`).
5. 🟡 `tests/security/rules.test.js` é asserção estática — não usar como prova de execução de rules (GAP-08).
