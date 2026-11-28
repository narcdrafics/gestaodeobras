# Contrato de dados — Billing e planos

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Cobre `billing-e-planos` (matriz de impacto §4). Fontes: `flowcharts/billing-e-planos.md`, `data-dictionary.md` §14/§86-96, `domain.md` RN-001–RN-012, `ADR-003`, `ADR-004`, `ADR-014`, `state-machines.md` §1-2, `permissions.md`.

## Visão Geral

🟢 Três autoridades complementares definem o estado de cobrança de um tenant: webhook da Kiwify (pagamentos), painel master (ajustes manuais) e job diário de recálculo (04:00 em `America/Sao_Paulo`). 🟢 O cliente apenas reflete o estado: `hasFeature`/`requireFeature` e `applyFeatureGates` são UX; a trava real está nas Security Rules do RTDB. 🟢 `billingState ∈ {ativo, carencia, somente_leitura, bloqueado}` é o campo canônico de acesso; `status` é campo legado de domínio (🟡 GAP-06).

## Responsabilidades

- 🟢 Calcular `calcularBillingState` com precedência: MASTER_SYSTEM → bloqueio forçado → trial → plano pago.
- 🟢 Validar HMAC-SHA1 do webhook Kiwify sobre `rawBody`, com chave de dedup `orderId + eventType`.
- 🟢 Resolver tenant por `external_reference` → `tenants_public` → e-mail/admin/invites; eventos sem tenant ficam `pending_tenant`.
- 🟢 Aplicar efeitos por evento (paid/approved/renewed, refund/chargeback, cancel, late/refused) em escrita atômica com tenant.
- 🟢 Recalcular estados diariamente, gravando apenas transições.
- 🟢 Aplicar enforcement de limites e subdomínio no Admin SDK (trigger), independente das rules.
- 🟢 Manter espelho front/back da matriz de features com teste de paridade.

## Regras de Negócio

- 🟢 RN-001: `MASTER_SYSTEM` ou `role=super_admin` ⇒ `ativo` sempre.
- 🟢 RN-002: `status bloqueado_pagamento/bloqueado` ⇒ `bloqueado` com motivo.
- 🟢 RN-003: trial dura 30 dias; expirado + 7 dias ⇒ `somente_leitura`; depois ⇒ `bloqueado`.
- 🟢 RN-004: `carenciaAte` prevalece sobre os 5 dias genéricos; renovação limpa carência obsoleta.
- 🟢 RN-005: sem vencimento confiável ⇒ `ativo` (fail-open para contas legadas).
- 🟢 RN-006: plano pago vencido + 5 dias ⇒ `carencia`; +7 ⇒ `somente_leitura`; +12 ⇒ `bloqueado`.
- 🟢 RN-007: `order_status` é volátil e fica fora do hash de idempotência.
- 🟢 RN-008: `processing` expira em 2 min e pode ser retomado; `pending_tenant`/`failed` são não terminais.
- 🟢 RN-009: vencimento usa carimbo `agora` da reserva, não o da reentrega.
- 🟢 RN-010: cancelamento agendado não reverte chargeback/reembolso anterior.
- 🟢 RN-011: `bloqueado` revoga todas as features mesmo com plano alto.
- 🟢 RN-012: slug inicial igual ao `tenantId` é livre; troca exige feature `subdominio`.
- 🟡 GAP-06: `status` e `billingState` divergentes precisam de reconciliação explícita.
- 🟡 Limite de `trabalhadores`/`medicao` do catálogo não tem trigger equivalente ao de obras/usuários.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Calcular billing state com precedência documentada | Must | `tests/security/billing.test.js` passa; 11 transições cobertas |
| RF-02 | 🟢 Job diário grava só transições com motivo/timestamp | Must | Segunda execução sem mudanças não escreve nada |
| RF-03 | 🟢 Validar assinatura do webhook antes de qualquer efeito | Must | Assinatura inválida ⇒ 401 + `webhook_debug` sem PII |
| RF-04 | 🟢 Dedup por `orderId + eventType` com lease de 2 min | Must | Reentrega ⇒ 200 `already_processed`; conflito ⇒ 409 |
| RF-05 | 🟢 Evento sem tenant ⇒ 202 `pending_tenant` reavaliável | Must | Criação posterior do tenant retoma o evento |
| RF-06 | 🟢 Aplicar efeitos por evento e marcar sucesso atomicamente | Must | Falha ⇒ nada aplicado e reserva liberada para retry |
| RF-07 | 🟢 Definir plano/limites e bloqueio manual no painel master | Must | Limpa resíduo de carência/bloqueio/cancelamento |
| RF-08 | 🟢 Aplicar limites de obras/usuários e assentos por trigger | Must | Estouro reverte escrita; perfil pendente sem claims |
| RF-09 | 🟢 Proteger subdomínio por feature no trigger | Must | Sem `subdominio`, reverte slug e remove `tenants_public` |
| RF-10 | 🟢 gates `hasFeature`/`requireFeature`/`applyFeatureGates` com paridade | Must | `tests/plan-features.test.js` passa; clique bloqueado em captura |
| RF-11 | 🟢 Rules: `.read` isolado de `billingState` e campos protegidos | Must | Tenant bloqueado ainda lê `billingState`; cliente não altera plano |
| RF-12 | 🟡 Reconciliar `status` × `billingState` | Should | GAP-06 marcado como divergência conhecida |
| RF-13 | 🟡 Aplicar limites de trabalhadores/medicao | Should | Catálogo prevê, mas trigger não implementado |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | `timingSafeEqual` na comparação de HMAC | `kiwify.js:11-25` | 🟢 |
| Segurança | `webhook_debug` sem payload/PII | `kiwify.js:151-168` | 🟢 |
| Disponibilidade | `pending_tenant`/`failed` não terminais | `kiwify.js:196-198,337-355` | 🟢 |
| Fuso | Job 04:00 em `America/Sao_Paulo` | `billing.js:145-175` | 🟢 |
| Performance | Busca por e-mail é O(n) por evento | `kiwify.js:76-102` | 🟡 |

## Critérios de Aceitação

```gherkin
Dado um tenant em trial criado há 31 dias
Quando o job diário roda
Então `billingState` vira `somente_leitura` com motivo `trial_expirado`

Dado um evento Kiwify reentregue com `order_status` diferente
Quando o webhook é chamado novamente
Então responde 200 `already_processed` e não reaplica efeitos

Dado um tenant com `billingState=bloqueado` e plano Ilimitado
Quando o cliente checa `hasFeature('pix.folha')`
Então retorna false e o clique abre o modal de upgrade

Dado uma escrita direta em `tenants/tid/obras` que estoura `limiteObras`
Quando o trigger `onValueWritten` executa
Então a transação reverte para o valor anterior ou aborta se não houver estado seguro
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-11 | Must | Núcleo de cobrança, autorização e gates |
| RF-12, RF-13 | Should | Lacunas conhecidas com impacto limitado |
| Busca O(n) por e-mail | Could | Raro (sem `external_reference`) |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `functions/billing.js` | `calcularBillingState`, `atualizarBillingStatesJob` | 🟢 |
| `functions/kiwify.js` | `validateKiwifySignature`, `identifyTenant`, `mapProductToPlan`, `reservarEvento`, `handleKiwifyWebhook` | 🟢 |
| `functions/plan_catalog.js`, `functions/plan_features.js` | catálogo e matriz de features | 🟢 |
| `functions/super_admin.js` | `acaoDefinirPlano`, `acaoDefinirLimites`, `acaoStatusTenant` | 🟢 |
| `functions/index.js` | `enforceGrowthLimit`, `aplicarLimiteDeAssentos`, slug trigger | 🟢 |
| `public/js/data_core.js` | `renderBillingEnforcement`, `calcularEstadoBillingLocal` | 🟢 |
| `database.rules.json:30-77,211-233` | guards de billing | 🟢 |
| `tests/security/billing.test.js`, `tests/plan-features.test.js`, `tests/kiwify*.test.js` | — | 🟢 |
