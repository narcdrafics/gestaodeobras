# Regras de negócio no banco — RTDB (obra-real)

> 🟢 CONFIRMADO em `database.rules.json` (35 `.validate`, 35 `.write`, 24 `.read`, 9 `.indexOn`). 🟡 INFERIDO de `functions/`. 🔴 Lacunas indicadas.
> Fonte canônica de autorização: [`../permissions.md`](../permissions.md). Matriz de papéis: `ADR-001`, `ADR-006`.

## 1. Autorização 🟢

| Regra | Expressão resumida | Evidência |
|---|---|---|
| Master | `profiles/<uid>.role === 'super_admin'` **ou** `auth.token.role === 'super_admin'` **ou** `auth.token.email === 'tonycampelo@gmail.com'` **ou** `super_admins/<uid>.ativo !== false` | `rules:4-5,31-34` |
| Leitura de tenant | mesmo tenant **e** `billingState !== 'bloqueado'` | `rules:33` |
| Escrita de tenant | mesmo tenant, `billingState ∉ {somente_leitura, bloqueado}`, papel `admin`/`emailAdmin`/`self_signup` | `rules:34` |
| RH com módulo | papel `rh` **e** `auth.token.modulosPermitidos.<modulo> === true` **ou** `profiles/<uid>/modulosPermitidos/<modulo> === true` | `rules:79-88`, `:103`, `:115` |
| Encarregado/engenheiro/comprador | papéis explícitos por entidade: `presenca`/`tarefas`/`almocos` aceitam `encarregado` e `engenheiro`; `obras`/`medicao` aceitam `engenheiro`; `estoque`/`movEstoque` aceitam `comprador` | `rules:79-112` |
| `usuarios` | somente master, admin ou `emailAdmin` — RH não escreve | `rules:118` |

> 🟡 Alias `mestre` aparece em `auth.token.role` e `profiles.role` nas rules; a fonte canônica declarada é `super_admins/<uid>` e `syncCustomClaims` normaliza `mestre` → `encarregado` (GAP-09, Pergunta 9).

## 2. Imutabilidade e validação de esquema 🟢

| Campo | Regra | Evidência |
|---|---|---|
| `profiles.uid`, `.email`, `.role`, `.tenantId`, `.status` | imutáveis para o cliente; criação exige `uid === auth.uid`, `email === auth.token.email`, `status === 'ativo'` | `rules:14-27` |
| `tenants.plano` | só `free_trial` na criação; imutável depois | `rules:39` |
| `tenants.billingState` | só `ativo` na criação; estados subsequentes via Admin SDK | `rules:50-53` |
| `tenants.config.limiteObras` / `limiteUsuarios` / `limiteTrabalhadores` | `1`, `1`, `9999` na criação | `rules:62-70` |
| `tenants.trialExpiracao` | `number ≤ now + 2764800000` | `rules:45` |
| `tenants.subdominioSlug` | null, igual ao slug, ou plano habilitado | `rules:58` |
| `role` enum | `admin`, `rh`, `engenheiro`, `encarregado`, `comprador`, `pendente`, `desativado` | `rules:20` |

## 3. Isolamento e sistemas especiais 🟢

- 🟢 `tenants_public/<slug>` é leitura pública; escrita restrita.
- 🟢 `comprasPrivadas/<tid>/<id>` fica fora de `tenants/` porque rule de pai não pode revogar `.read` de filho.
- 🟢 `admin_audit`, `admin_ops`, `rate_limits`, `billing_events`, `webhook_debug`, `whatsapp_messages`, `super_admins` são `.write:false` — somente Admin SDK.
- 🟢 `notificacoes/<tid>/<uid>/<pushId>` replica uma cópia por destinatário para que as rules autorizem a leitura individual.
- 🟡 Retenção declarada nas specs: `whatsapp_messages` e `admin_ops` 24 h, `rate_limits` 2 h, `admin_audit` 90 dias — 🔴 não verificada em produção.

## 4. Regras implementadas no código (não nas rules) 🟡

| Regra | Onde | Confiança |
|---|---|---|
| `billingState`: `ativo`/`carencia`/`somente_leitura`/`bloqueado`; `hasFeature` retorna `false` para bloqueado | `plan_features.js`, `billing.js` | 🟢 |
| Duplicidade de presença: um registro por trabalhador por data (`trab === cod` ou `nome === nome`) | `app_core.js:savePresenca:6470-6555` | 🟢 |
| Mudança de diária recalcula presenças não pagas | `app_core.js` | 🟢 |
| `efeitosMovimentacao` valida saldo e grava `antes/depois` | `estoque.module.js` | 🟢 |
| `buildFinanceEntries` agrupa em `pago`/`aPagar` e não persiste o derivado | `utils.module.js` | 🟢 (ADR-008) |
| Dedup de WhatsApp por transação com `chaveDedup` + lease | `whatsapp_auth.js:156-258` | 🟢 (ADR-004) |
| Lease de 2 min em `billing_events` com `payloadHash` sem `status` | `kiwify.js` | 🟢 |
| `syncCustomClaims` substitui claims inteiras; sem retry/dead-letter | `functions/index.js` | 🟡 (GAP-10) |

## 5. Lacunas 🔴

- 🔴 GAP-04: `tarefas_pendentes` gravado sob `tenants/<tid>/` mas contratado na raiz — matriz testada não cobre o caminho real.
- 🔴 GAP-08: `tests/security/rules.test.js` são asserções estáticas; emulador de rules inoperante — não provam execução.
- 🔴 GAP-09: `EMAIL_MESTRA` replicado em `claims.js`, rules e Storage rules; canônico é `super_admins/<uid>`.
- 🔴 GAP-06: `status` e `billingState` com significados sobrepostos entre `billing.js`, bot e painel.
- 🟡 L-11/L-12: transferência de estoque e `finApplyPaid` violam consistência financeira no código (não nas rules).
