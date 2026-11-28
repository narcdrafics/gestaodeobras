# Spec Impact Matrix — Obra Real (`gestaodeobras`)

> Gerado pelo **Arquiteto** (Fase 3, `doc_level = completo`) a partir de `architecture.md`, `c4-*.md`, `erd-complete.md`, `domain.md`, `state-machines.md`, `permissions.md`, `adrs/`, `code-analysis.md` (21 módulos), `data-dictionary.md` (117 seções), `flowcharts/` (21) e `.reversa/context/modules.json` (21).
> Objetivo: responder **"se eu mudar X, o que mais muda?"** antes de escrever specs (Fase 4) ou revisar o sistema (Fase 5).
> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA.

## 1. Como ler esta matriz

| Símbolo | Significado |
|---|---|
| **D** | dependência direta de código/chamada entre componentes |
| **E** | escrita/emissão de dados (produtor → consumidor) |
| **A** | autorização aplicada pelo componente (rules/claims/API) |
| **—** | sem dependência relevante observada |
| **Alto** | mudança mexe em contrato, segurança ou esquema; exige revisar rules + functions + cliente + testes |
| **Médio** | mudança mexe em cálculo/fluxo; exige revisar regras de negócio e testes do domínio |
| **Baixo** | mudança local de UI/config; revisar apenas o componente e seu fluxograma |

A severidade é **por mudança de contrato**, não por tamanho do diff. Exemplo: renomear um campo de `billingState` é Alto mesmo sendo uma linha.

## 2. Matriz compacta componente → componente

Linha = componente que muda. Coluna = componente impactado.

| Linha ↓ / Coluna → | auth_core | data_core | app_core | aprovacoes_ui | APIs admin | triggers | jobs | billing/features | webhooks | rules RTDB | Storage | worker |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `auth_core.js` | — | D | D | A | D | E | — | A | — | A | A | — |
| `data_core.js` | D | — | D | D | A | — | A | D | — | A | A | D |
| `app_core.js` | D | D | — | D | E | E | — | D | — | E | E | — |
| `aprovacoes_ui.js` | A | A | D | — | D | E | — | A | — | E | — | — |
| APIs admin (`super_admin`, `cargos`, `usuarios`, `aprovacoes-api`) | E | E | — | D | — | E | — | D | D | E | E | — |
| Triggers (`claims`, `aprovacoes`, `enforce*`) | E | E | E | E | D | — | — | D | — | E | E | — |
| Jobs (`billing`, `prazos`, `retencao`, `dailyReport`) | — | E | E | E | — | E | — | D | E | E | — | — |
| `billing.js` / `plan_features.js` | A | D | A | A | A | A | D | — | A | A | A | — |
| Webhooks (`kiwify`, `whatsapp`) | — | E | E | — | D | E | D | E | — | E | E | — |
| `database.rules.json` | A | A | A | A | A | — | — | A | A | — | — | — |
| `storage.rules` | A | A | E | E | E | E | — | A | — | — | — | — |
| `worker.js` / `firebase.json` | D | D | — | — | — | — | — | — | D | — | E | — |

Leitura: um impacto **A** em `billing/features` significa que aquele componente hoje recebe uma decisão de autorização/feature gate dele — mudar a matriz de planos pode alterar o comportamento da linha.

## 3. Dependências relevantes (detalhamento)

| # | Origem → Destino | Natureza | Severidade | O que muda junto | Evidência |
|---|---|---|---|---|---|
| 1 | `auth_core.js` → `data_core.js` → `app_core.js` | D | Alto | detecção de tenant, claims esperadas, navegação, signOut | `auth_core.js:306-439`; `ADR-001` |
| 2 | `auth_core.js` → `profiles` → `syncCustomClaims` → Firebase Auth | E | Alto | papel efetivo, revogação, accesso entre origens | `index.js:680-817`; `ADR-002` |
| 3 | `data_core.js` → `hasFeature`/`billingStateRef` → todas as telas | A | Alto | features visíveis, desvio para aprovação, botões | `data_core.js:53,645-659`; `ADR-003` |
| 4 | `app_core.js` → `persistDB()` → `database.rules.json` | E | Alto | arrays inteiros do tenant, escopo de obra, billing gate | `database.rules.json:30-161` |
| 5 | `save*` → `aprovacoes_ui.js` → `/api/admin/aprovacao` → `aprovacoes.js` | D/E | Alto | 8 tipos de efeito, notificações, `auditoria/<tid>` | `ADR-005` |
| 6 | `aprovacoes-api.js` → `claims` + `profiles` + `modulosPermitidos` | A | Alto | hierarquia efetiva, RH por módulo/obra, engenheiro em estoque | `aprovacoes-api.js:47,58`; `permissions.md §4` |
| 7 | `claims.js` → `syncCustomClaims` → `storage.rules` | A | Alto | revogação imediata depende de `revokeRefreshTokens` | `storage.rules:4-22`; `ADR-006` |
| 8 | `billing.js` → `dailyBillingStateJob` → rules → SPA → bot | E/A | Alto | leitura/escrita, banners, `dailyReport`, webhook Kiwify | `billing.js:39-175`; `ADR-003` |
| 9 | `kiwifyWebhook` → `billing_events` → `tenants/<tid>` → `plan_features` | E | Alto | plano, vencimento, limites, desbloqueio | `kiwify.js:227-493`; `ADR-004` |
| 10 | `whatsappWebhook` → `whatsapp_messages` → `tarefas`/`presenca` → `dailyReport` | E | Alto | dedup, ACK, contadores do relatório, parser órfão | `index.js:129-446`; 🔴 `ADR-011` |
| 11 | `slug.js` → `tenants_public` → `worker.js` → Hosting | E/D | Alto | hostname, CORS, branding pré-login, lista de reservados | `ADR-001`, `ADR-007`, `ADR-013` |
| 12 | `cors.json` ↔ `worker.js` ↔ `firebase.json` (CSP/COOP) | D | Médio | allowlist duplicada, popup de login, cache de assets | `ADR-010` |
| 13 | `utils.module.js` → `financeiro`/`orcamento`/`medicao`/`presenca` | D | Médio | `valpago`, `pago/aPagar`, `qacum`, saldo de folha | `utils.module.js:706-749,1006-1216`; `ADR-008` |
| 14 | `estoque.module.js` → `efeitosMovimentacao` → `estoque`/`movEstoque` | D | Alto | saldo, transferência par/órfa, `antes/depois` | `data-dictionary.md §57-59` |
| 15 | `aprovacoes.js` → `notificacoes/<tid>/<uid>` | E | Médio | uma cópia por destinatário; rules de leitura individual | `data-dictionary.md §23` |
| 16 | `auditoria.js` → `admin_audit` + `admin_ops` → respostas `503`/`200 idempotente` | E | Alto | fail-closed, retry seguro, `requestId` | `ADR-004` |
| 17 | `abuso.js` → cotas → todas as APIs admin e webhooks | A | Médio | `413`/`429`, hash de IP, custo de abuso | `abuso.js`; `permissions.md §5` |
| 18 | `retencao.js` → `auditoria` (90 d), dedup (24 h), cotas (2 h) | E | Médio | volume de nós de sistema e triagem de eventos presos | `retencao.js:11-16` |
| 19 | `deploy.yml` → Hosting (somente) ↔ funções/rules manuais | D | Alto | risco de front novo com back antigo | `ADR-014` |
| 20 | `firebase.json` rewrites → rotas `/api/*` em funções | D | Alto | quebra silenciosa de API se rota mudar sem rewrite | `firebase.json:11-40` |

## 4. Matriz módulo → artefatos e impacto

`CA §N` = seção do `code-analysis.md`; `DD §N` = seção do `data-dictionary.md`; `FL` = `flowcharts/<modulo>.md`.

| Módulo (21) | Componentes / arquivos | Entidades (ERD) | Artefatos de spec | Impacta diretamente | Severidade se mudar |
|---|---|---|---|---|---|
| `auth` | `auth_core.js`, `index.js` (claims), `database.rules.json` | AuthUser, Claims, Profile, UserPassport | FL `auth.md`; CA §1; DD §1-6, §95, §107 | `tenants-e-slug`, `seguranca-e-rbac`, APIs admin, Storage | 🔴 Alto |
| `tenants-e-slug` | `slug.js`, `data_core.js`, `worker.js` | Tenant, TenantPublic | FL `tenants-e-slug.md`; CA §2; DD §7-9, §115 | `auth`, `infra-e-deploy`, `billing-e-planos`, Storage | 🔴 Alto |
| `admin-e-super-admin` | `super_admin.js`, `kiwify_api.js`, `admin_audit` | Allowlist, AdminAudit, AdminOps, BillingEvent | FL `admin-e-super-admin.md`; CA §3; DD §10-15, §90, §96, §106, §108-109 | `usuarios-e-cargos`, `billing`, `seguranca`, Kiwify | 🔴 Alto |
| `usuarios-e-cargos` | `cargos.js`, `usuarios.js`, `claims.js` | Profile, Invite, Claims, UserPassport | FL `usuarios-e-cargos.md`; CA §4; DD §16-20, §106-107 | `auth`, `aprovacoes`, `seguranca-e-rbac` | 🔴 Alto |
| `aprovacoes` | `aprovacoes_ui.js`, `aprovacoes-api.js`, `aprovacoes.js` | Aprovacao, AprovacaoAudit, Notificacao | FL `aprovacoes.md`; CA §5; DD §21-26, §68, §73 | `compras`, `estoque`, `financeiro`, `orcamento`, `medicao`, `trabalhadores` | 🔴 Alto |
| `obras` | `app_core.js` (`saveObra`), `utils.module.js` | Obra | FL `obras.md`; CA §6; DD §27-30 | todas as entidades com `obra`; RH; relatórios; bot | 🔴 Alto |
| `tarefas` | `app_core.js`, `parser-tarefas.js` (órfão) | Tarefa, TarefaPendente, Foto | FL `tarefas.md`; CA §7; DD §31-36, §101-104 | `whatsapp-bot`, `relatorios-e-dashboard`, `fotos`, `presenca` | 🟡 Médio |
| `trabalhadores` | `app_core.js` (`saveTrabalhador`), `pix_logic.js` | Trabalhador | FL `trabalhadores.md`; CA §8; DD §37-41 | `presenca-e-ponto`, `almocos`, `financeiro-e-pix`, `aprovacoes` | 🔴 Alto |
| `presenca-e-ponto` | `app_core.js` (`savePresenca`), `utils.module.js`, `index.js` | Presenca, LancamentoFinanceiro | FL `presenca-e-ponto.md`; CA §9; DD §42-47, §103 | `trabalhadores`, `financeiro`, `relatorios`, `whatsapp-bot` | 🔴 Alto |
| `almocos` | `app_core.js` (`saveAlmoco`) | Almoco | FL `almocos.md`; CA §10; DD §48-51 | `trabalhadores`, `financeiro` (agregação, não fechamento), dashboard | 🟡 Médio |
| `compras` | `compras_ui.js`, `aprovacoes.js` (`efeitosCompra`) | Compra, CompraPrivada | FL `compras.md`; CA §11; DD §25, §52-55 | `aprovacoes`, `estoque`, `permissions` (redaction) | 🔴 Alto |
| `estoque` | `estoque.module.js`, `aprovacoes.js` (`efeitosMovimentacao`) | EstoqueItem, MovEstoque | FL `estoque.md`; CA §12; DD §56-59 | `aprovacoes`, `compras`, `relatorios` | 🔴 Alto |
| `financeiro-e-pix` | `app_core.js`, `pix_ui.js`, `pix_logic.js` | LancamentoFinanceiro | FL `financeiro-e-pix.md`; CA §13; DD §60-64 | `presenca`, `orcamento`, `medicao`, `billing` (feature `pix.folha`) | 🔴 Alto |
| `orcamento` | `app_core.js`, `utils.module.js` | OrcamentoServico | FL `orcamento.md`; CA §14; DD §65-69 | `medicao`, `financeiro`, `aprovacoes`, dashboard | 🔴 Alto |
| `medicao` | `app_core.js`, `utils.module.js`, `aprovacoes.js` | Medicao, Foto | FL `medicao.md`; CA §15; DD §70-74 | `orcamento`, `financeiro`, `aprovacoes`, `fotos` | 🔴 Alto |
| `relatorios-e-dashboard` | `utils.module.js`, `app_core.js` | derivados: DashboardResumo, RelatorioObra | FL `relatorios-e-dashboard.md`; CA §16; DD §75-79 | todos os módulos de domínio + `whatsapp-bot` (dailyReport) | 🟡 Médio |
| `fotos` | `app_core.js`, `storage.rules`, `auditSafeImage` | Foto | FL `fotos.md`; CA §17; DD §33, §80-85 | `tarefas`, `medicao`, `relatorios`, Storage/CSP/CORS | 🟡 Médio |
| `billing-e-planos` | `billing.js`, `kiwify.js`, `plan_features.js` (front/back), `plan_catalog.js` | Tenant, BillingEvent | FL `billing-e-planos.md`; CA §18; DD §14, §86-96 | **todos os módulos** (gate), `admin`, `whatsapp-bot`, rules | 🔴 Alto |
| `whatsapp-bot` | `index.js`, `whatsapp_auth.js`, `parser-tarefas.js` (órfão) | WhatsappMessage, TarefaPendente, Tarefa, Presenca | FL `whatsapp-bot.md`; CA §19; DD §32, §97-105 | `tarefas`, `presenca`, `relatorios`, segredos/Graph API | 🔴 Alto |
| `seguranca-e-rbac` | `claims.js`, `abuso.js`, `auditoria.js`, `retencao.js`, rules | Claims, Allowlist, AdminAudit, AdminOps, RateLimit | FL `seguranca-e-rbac.md`; CA §20; DD §1-6, §98, §106-112 | **todos os módulos** (autorização), APIs, Storage | 🔴 Alto |
| `infra-e-deploy` | `worker.js`, `firebase.json`, `wrangler*`, workflows, `server.js` | HostingConfig, WorkerRoutingConfig, CorsPolicy, CiPipeline | FL `infra-e-deploy.md`; CA §21; DD §113-117 | `auth`, `tenants-e-slug`, `billing`, `whatsapp-bot`, `seguranca` | 🔴 Alto |

## 5. Matriz de mudanças transversais (playbook)

| Mudança proposta | Componentes afetados | Entidades/artefatos afetados | Testes a revisar | Severidade | ADR |
|---|---|---|---|---|---|
| Alterar `billingState`, carência ou limites | `billing.js`, job 04:00, `hasFeature` front/back, rules RTDB, bot, dashboard | `Tenant`, `BillingEvent`, DD §86-96, `state-machines.md §1-2` | `billing*.test.js`, `plan-features.test.js`, `security/rules.test.js` | 🔴 Alto | 003 |
| Alterar papéis / claims / allowlist | `claims.js`, `syncCustomClaims`, APIs admin, `aprovacoes-api.js`, Storage Rules | `Claims`, `Profile`, `Allowlist`, DD §1-6/106-112, `permissions.md` | `privilege-escalation.test.js`, `claims*.test.js`, `rh-customizavel.test.js` | 🔴 Alto | 002, 006 |
| Alterar slug / domínio / branding | `slug.js`, `data_core.js`, `worker.js`, CORS, CSP | `Tenant`, `TenantPublic`, DD §7-9/113-117, ERD §2 | `slug*.test.js`, `tenants-public*.test.js` | 🔴 Alto | 001, 007, 013 |
| Alterar `Obra.cod` ou escopo de obras | `obras`, `tarefas`, `presenca`, `almocos`, `compras`, `estoque`, `financeiro`, `orcamento`, `medicao`, RH, bot, relatório | 9 entidades filhas + `ObraScope` (DD §28), ERD §3 | `rh-customizavel.test.js`, `relatorio*.test.js`, `dashboard*.test.js` | 🔴 Alto | 006, 008 |
| Alterar tipos/prazos/efeitos de aprovação | `aprovacoes_ui`, API, trigger, jobs 06:00, notificações, auditoria | `Aprovacao`, `AprovacaoAudit`, `Notificacao`, DD §21-26/68/73, `state-machines.md §4` | `aprovacoes*.test.js`, `aprovacoes-api.test.js` | 🔴 Alto | 005 |
| Alterar diária/hora extra/recalculo | `presenca`, `trabalhadores`, `financeiro`, PIX, dashboard, relatório | `Presenca`, `LancamentoFinanceiro`, DD §42-47/60-64, `state-machines.md §7-8` | `presenca*.test.js`, `financeiro*.test.js`, `folha*.test.js` | 🔴 Alto | 008, 009 |
| Alterar webhook WhatsApp / parser | `whatsapp_auth.js`, `index.js`, `dailyReport`, Storage de mídia | `WhatsappMessage`, `TarefaPendente`, `Tarefa`, `Presenca`, DD §32/97-105 | `whatsapp-auth.test.js`, `whatsapp*.test.js` | 🔴 Alto | 004, 011 |
| Alterar Kiwify / produtos / planos | `kiwify.js`, `kiwify_api.js`, `plan_catalog.js`, painel master, segredos | `BillingEvent`, `Tenant`, `webhook_debug`, DD §90/93/96 | `kiwify*.test.js`, `plan-features.test.js` | 🔴 Alto | 003, 004 |
| Alterar fotos / Storage / sanitização | `app_core.js`, `storage.rules`, `aprovacoes_ui.js`, CSP/CORS, impressão | `Foto`, `photos[]`, DD §33/80-85 | `fotos*.test.js`, `security/rules.test.js` | 🟡 Médio | 010, 012 |
| Alterar CI/deploy/runtimes | `deploy.yml`, `test.yml`, `wrangler*`, `gcloud` CORS, segredos | DD §113-117, `c4-containers.md §4` | `test.yml` (Node 20/24), checklist de deploy | 🔴 Alto | 014 |
| Alterar auditoria/cotas/reenvio | `auditoria.js`, `abuso.js`, `retencao.js`, todas as APIs e webhooks | `AdminAudit`, `AdminOps`, `RateLimit`, DD §10-11/108-112 | `abuso.test.js`, `auditoria*.test.js` | 🔴 Alto | 004, 006 |
| Alterar fuso/formatos de data | `getHojeBR`, semanas, jobs com `timeZone`, `dailyReport`, parser | DD §42/48/70/87, `state-machines.md` (todas) | `timezone*.test.js`, `relatorio*.test.js` | 🟡 Médio | 009 |

## 6. Lacunas de rastreabilidade (reprocessadas após respostas)

| ID | Lacuna | Componentes envolvidos | Consequência para specs | Confiança |
|---|---|---|---|---|
| GAP-01 | 🟢 Decisão P1: responder `consultar_ponto` com resumo de presença de hoje do remetente | `whatsapp_auth.js`, `index.js` | Spec da intenção passa a ter comportamento definido; handler pendente | 🟢 |
| GAP-02 | 🟢 Decisão P2: ativar fluxo de prévia/confirmação no webhook | `index.js`, `parser-tarefas.js` | Spec deixa de ser "planejada, não ativa"; integração pendente | 🟢 |
| GAP-03 | 🟢 Decisão P3: `presenca` é o nó canônico do `dailyReport` | job `dailyReport`, `whatsappWebhook` | Contrato de leitura definido; ajuste do job pendente | 🟢 |
| GAP-04 | 🟢 Decisão P4: `tarefas_pendentes` removido, gravação direta em `tarefas` | `parser-tarefas.js`, rules | Fim do caminho divergente na matriz de autorização | 🟢 |
| GAP-05 | 🔴 P5 sem decisão: Graph API sem retry/fila/dead-letter | `index.js:437-446` | Requisito de confiabilidade permanece bloqueante | 🔴 |
| GAP-06 | 🟡 `status` × `billingState` divergentes | `billing.js`, bot, painel | Duas specs de estado precisam de reconciliação explícita | 🟢 |
| GAP-07 | 🟡 Regras CORS duplicadas, Wrangler duplicado, Node 20/24 | `cors.json`, `worker.js`, `wrangler*`, `package.json` | Documento de deploy não pode presumir config única | 🟢 |
| GAP-08 | 🟡 Emulador de Security Rules inoperante | `tests/security/rules.test.js`, config | Evidência é asserção estática, não execução de rules | 🟢 |
| GAP-09 | 🟡 Alias `mestre` e `EMAIL_MESTRA` replicados | `claims.js`, rules, Storage | Matriz de papéis precisa marcar exceções legadas | 🟢 |
| GAP-10 | 🟡 `syncCustomClaims` sem retry; `admin_ops` sem lease curto | `index.js`, `auditoria.js` | claims/reservas podem ficar presas sem alerta | 🟢 |

### 6.1 Lacunas adicionais descobertas na Fase 5 (L-11…L-20)

| ID | Lacuna | Componentes envolvidos | Consequência para specs | Confiança |
|---|---|---|---|---|
| L-11 | 🟢 Decisão P11: corrigir transferência e edição | `estoque.module.js:364`, `flowcharts/estoque.md:139-141` | RF-10 de `contrato-suprimentos-e-custos/` definido; correção pendente | 🟢 |
| L-12 | 🟢 Decisão P12: `finApplyPaid` soma ao `valpago` existente | `flowcharts/financeiro-e-pix.md:98`, `data-dictionary.md:923` | RF-11 definido; correção pendente | 🟢 |
| L-13 | 🟢 Decisão P13: eventos desconhecidos vão para fila de revisão | `webhook-kiwify/design.md:61` | Destino definido; implementação pendente | 🟢 |
| L-14 | 🟢 Decisão P14: omitir categorias financeiras sem módulo | `utils.module.js:1126-1327` | RF-12 de `contrato-relatorios-e-fotos/` definido; filtro pendente | 🟢 |
| L-15 | 🟡 P15 pendente: denominador `hnorm` (utilitários) × `8` (formulários) | `utils.module.js:430-452`, `app_core.js:6159-6183` | Fato 🟢 confirmado; escolha canônica em aberto | 🟢/🟡 |
| L-16 | 🟢 Decisão P16: compras respeitam `acessoObras`/filtro de obra | `flowcharts/compras.md:62` | RF-12 de `contrato-suprimentos-e-custos/` definido | 🟢 |
| L-17 | 🟢 Decisão P17: `normEstoqueNome` é a normalização canônica | `flowcharts/estoque.md:45` | Chaves duplicadas evitadas após adoção | 🟢 |
| L-18 | 🟢 Decisão P18: reescrever histórico Git | `domain.md:169`, `permissions.md:127` | Ação de segurança fora do escopo de escrita do Reversa | 🟢 |
| L-19 | 🟡 P19 pendente: `dados` do GPT sem validação de schema (Q-01 legado) | `contrato-whatsapp/requirements.md` RF-15 | Schema mínimo e fallback não definidos | 🟢 |
| L-20 | 🟢 Decisão P20: códigos numéricos de obra são válidos | `domain.md:166` | RF-08 de `contrato-whatsapp/` define conversão para string | 🟢 |

### 6.2 Resultado consolidado da Fase 5

- **20 perguntas** geradas em [`_reversa_sdd/questions.md`](../questions.md) — **13 respondidas** (12 com decisão, P5 sem decisão) e **7 pendentes** (P6–P10, P15, P19).
- **Lacunas bloqueantes restantes:** somente GAP-05 (P5); GAP-01…GAP-04 e L-11…L-14 foram resolvidos por decisão humana e registrados nas specs. Nenhum comportamento novo foi inferido sem resposta.
- **Lacunas não bloqueantes restantes:** GAP-06…GAP-10, L-15 (P15) e L-19 (P19); L-16…L-18 e L-20 têm decisão registrada.
- **Relatório de confiança:** [`_reversa_sdd/confidence-report.md`](../confidence-report.md) — 1594 🟢 / 201 🟡 / 122 🔴 (1917 marcadores), confiança geral **88,4%**.
- **Reclassificações aplicadas na revisão e no reprocessamento:** GAP-07 🔴→🟡 (4 arquivos); divergência `hnorm`×`8` virou 🟢 fato + 🟡 decisão; RF-06 de `job-relatorio-diario` deixou de assumir `presenca` sem decisão e agora adota 🟢 P3; GAP-01…GAP-04 e L-11…L-14, L-16…L-18 e L-20 passaram a 🟢 decisão humana; chave de dedup corrigida para `<chaveDedup>`; campos de `presenca` alinhados a `index.js:367-375`; `functions/auth_core.js` marcado `n/a` no `code-spec-matrix.md`.
- **Revisão cruzada externa (Codex):** indisponível — `cross-review-result.md` não gerado.
- **Estado:** `.reversa/state.json` com `phase = "concluido"`, checkpoints `writer`, `reviewer`, `data_master` e `design_system`, `pending = []`, contagens e confiança recalculadas.

## 7. Regras para o Redator e o Revisor

1. Toda spec que alterar **autorização** (`A` na matriz) deve citar `permissions.md`, a rule correspondente e o ADR aplicável.
2. Toda spec que alterar **esquema** de entidade deve atualizar `data-dictionary.md`, `erd-complete.md` e a matriz de impacto antes de virar código.
3. Toda spec que alterar **cálculo derivado** deve declarar explicitamente que o valor não é persistido (`ADR-008`).
4. Toda spec que tocar em webhook deve declarar chave de dedup, lease e comportamento na reentrega (`ADR-004`).
5. Toda spec que tocar em plano deve passar por `plan_catalog.js` **e** espelho front, com teste de paridade (`ADR-003`).
6. Não escrever spec de comportamento para GAP-05 (P5 sem decisão) sem marcar a lacuna como bloqueante; GAP-01…GAP-04 e L-11…L-14, L-16…L-18 e L-20 têm decisão humana registrada em `questions.md`.
7. Ao gerar `code-spec-matrix.md` (Fase 4), usar a coluna "Artefatos de spec" da §4 como índice inicial de rastreabilidade.

**Artefatos entregues (Fases 4 e 5):** specs SDD por componente (26 units), OpenAPI das rotas `/api/*`, User Stories, `traceability/code-spec-matrix.md`, `questions.md`, `gaps.md` e `confidence-report.md`.
