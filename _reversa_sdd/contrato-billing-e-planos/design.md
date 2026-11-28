# Contrato de dados — Billing e planos, Design

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `flowcharts/billing-e-planos.md`, `ADR-003`, `ADR-004`, `state-machines.md` §1-2.

## Estrutura de dados

| Nó | Campos | Confiança |
|----|--------|-----------|
| `tenants/<tid>/billingState` | `ativo`/`carencia`/`somente_leitura`/`bloqueado` | 🟢 |
| `tenants/<tid>/billingStateMotivo`, `billingStateAtualizadoEm` | motivo e carimbo da transição | 🟢 |
| `tenants/<tid>/plano`, `planoVencimento`, `trialExpiracao`, `webhookCriacao` | plano e janelas | 🟢 |
| `tenants/<tid>/carenciaAte`, `motivoBloqueio`, `dataBloqueio`, `cancelamentoAgendado` | estado de cobrança | 🟢 |
| `tenants/<tid>/config/limiteObras`, `limiteUsuarios`, `limiteTrabalhadores` | limites | 🟢 |
| `billing_events/<orderId>/<eventType>` | reserva com `tenantId`, `payloadHash`, `status`, `criadoEm`, `processadoEm` | 🟢 |
| `webhook_debug/<id>` | motivo, assinatura inválida, sem payload | 🟢 |
| `tenants_public/<slug>` | `tenantId` (leitura direta por chave) | 🟢 |

## Máquina de estados (ADR-003)

| De | Para | Gatilho | Confiança |
|----|------|---------|-----------|
| — | `ativo` | MASTER_SYSTEM, sem vencimento, plano vigente ou pagamento aprovado | 🟢 |
| `ativo` | `carencia` | `carenciaAte` ativo, vencido há ≤5 dias ou late/refused | 🟢 |
| `carencia` | `somente_leitura` | fim da carência + 7 dias (trial) ou vencimento + 12 dias (pago) | 🟢 |
| `somente_leitura` | `bloqueado` | além da janela de leitura | 🟢 |
| qualquer | `bloqueado` | `status bloqueado`, chargeback, reembolso ou bloqueio manual | 🟢 |
| `bloqueado` | `ativo` | pagamento aprovado ou liberação manual | 🟢 |

🟢 Constantes: `TRIAL_READONLY_DAYS=7`, `PAID_GRACE_DAYS=5`, `PAID_READONLY_DAYS=7`, `MS_DIA=86400000` (`billing.js:17-20`). 🟡 Um `carenciaAte` obsoleto após renovação não bloqueia (`billing.js:133-139`).

## Fluxos principais

1. 🟢 **Webhook Kiwify:** valida HMAC → identifica tenant → reserva `orderId+eventType` → aplica efeito → `update` multi-path com tenant + evento `success`.
2. 🟢 **Job 04:00:** lê todos os tenants, calcula estado puro e grava só transições com motivo e timestamp.
3. 🟢 **Painel master:** `definir_plano` redefine vencimento e limites e limpa resíduos; `definir_limites` mescla ajustes (1…9999); `bloquear_tenant` é imediato.
4. 🟢 **Enforcement:** triggers `onValueWritten` em `obras`, `usuarios`, `profiles` e slug revertem escritas fora da cota/sem feature.
5. 🟢 **Cliente:** `billingStateRef` assinado separadamente; `renderBillingEnforcement` mostra tela de bloqueio/banner e `applyFeatureGates` intercepta cliques em fase de captura.

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Fail-open sem vencimento (não tranca contas legadas) | `billing.js:101-105` | 🟢 |
| Leitura isolada de `billingState` para tela de bloqueio | `database.rules.json:50-52` | 🟢 |
| Matriz de features autoritativa no back com espelho front testado | `plan_features.js`, `tests/plan-features.test.js` | 🟢 |
| `bloqueado` revoga todas as features | `plan_features.js:104-109` | 🟢 |
| Dedup exclui `order_status` do hash | `kiwify.js:288-301` | 🟢 |

## Estado Interno

🟢 `processing` com lease de 2 min; `pending_tenant`/`failed` não terminais e retomáveis. 🟢 `cancelamentoAgendado` mantém acesso até o vencimento. 🟡 `diasRestantes` existe só no retorno da função pura, não é persistido no tenant. 🟡 Cliente calcula fallback com janelas iguais, mas sem `trialExpiracao` retorna `ativo` onde o servidor usa `webhookCriacao + 30 dias`.

## Observabilidade

🟢 Logs de transição de estado e de eventos reservados/processados. 🟢 `webhook_debug` registra rejeições sem PII. 🟡 Eventos desconhecidos viram `success` sem fila de revisão; sem alerta para janela de até 24 h até o job recalcular.

## Riscos e Lacunas

- 🟡 GAP-06: `status` (domínio) e `billingState` (acesso) divergem; reconciliação explícita pendente.
- 🟡 Limites de trabalhadores/medicao no catálogo sem trigger equivalente.
- 🟡 `enforceGrowthLimit` usa `LIMITE_FALLBACK=1` quando falta metadado.
- 🟡 Busca por e-mail é O(n) e percorre todos os tenants/profiles.
- 🟡 `EMAIL_MESTRA` codificado em várias rules escapa do fluxo de claims.
