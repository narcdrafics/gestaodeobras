# Webhook Kiwify (`POST /api/kiwify`)

> Spec executável gerada pelo **Writer** (Fase 4, `doc_level = completo`). 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA.
> Fontes: `firebase.json:11-15`, `functions/index.js:820-833`, `functions/kiwify.js`, `_reversa_sdd/flowcharts/billing-e-planos.md`, `_reversa_sdd/domain.md` RN-016/RN-020/RN-022–RN-025, `_reversa_sdd/traceability/spec-impact-matrix.md` §3 #9.

## Visão Geral

🟢 Ingestão server-to-server de eventos de cobrança da Kiwify. Valida assinatura sobre o corpo cru, resolve o tenant, reserva o evento por chave canônica e aplica efeitos de plano em uma única escrita multi-path. É a origem autoritativa de plano, vencimento e limites do tenant.

## Responsabilidades

- 🟢 Validar HMAC-SHA1 da Meta/Kiwify sobre `req.rawBody` (query `?signature=` ou header `x-kiwify-signature`).
- 🟢 Identificar o tenant por `external_reference` → `tenants_public/<slug>` → e-mail do admin/profile/convite.
- 🟢 Reservar `billing_events/<orderId>/<eventType>` com `payloadHash` sem `order_status` e lease de 2 min.
- 🟢 Mapear produto/frequência para plano canônico e-gravar tenant + evento em transação.
- 🟢 Registrar rejeições em `webhook_debug` sem PII do payload.

## Regras de Negócio

- 🟢 RN-022: dedup é `orderId + eventType`; `order_status` é volátil e não entra no hash.
- 🟢 RN-023: `pending_tenant`/`failed` são não terminais; lease `processing` expira em 2 min.
- 🟢 RN-024: `cancelamentoAgendado` não desbloqueia tenant com `status='bloqueado_pagamento'`.
- 🟢 RN-020: plano desconhecido cai em `free_trial` (fail-safe).
- 🟢 O vencimento usa o carimbo `agora` da reserva, não a hora da reentrega.
- 🟡 Eventos desconhecidos são marcados `success` sem efeito — sem fila de revisão.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Aceitar somente `POST` com assinatura válida | Must | Sem assinatura/HMAC inválido ⇒ 401 com motivo em `webhook_debug`, sem payload |
| RF-02 | 🟢 Extrair `order_id`; ausência ⇒ 400 `Missing order_id` | Must | Corpo sem `order_id` recebe 400 e não grava evento |
| RF-03 | 🟢 Resolver tenant nas 3 fontes documentadas | Must | Teste com `external_reference`, com slug público e com e-mail de convite retorna o mesmo `tenantId` |
| RF-04 | 🟢 Reservar evento atomicamente | Must | Duas entregas concorrentes geram um único processamento; segunda recebe `200 already_processed` |
| RF-05 | 🟢 Detectar conflito de hash/tenant em evento `success` | Must | Reentrega com payload divergente ⇒ `409 conflict_ignored`, sem reescrita |
| RF-06 | 🟢 Aplicar efeitos por tipo de evento | Must | `paid`, `refunded`, `subscription_canceled`, `subscription_late` atualizam plano/`billingState`/carencia conforme fluxograma §5 |
| RF-07 | 🟢 Escrever tenant e `status='success'` no mesmo `update()` | Must | Falha na escrita libera a reserva para retry; nenhum efeito parcial permanece |
| RF-08 | 🟢 Manter `202 pending_tenant` reavaliável | Should | Evento sem tenant é retomado quando o comprador cria a conta |
| RF-09 | 🟡 Limpar `carenciaAte` obsoleto após renovação | Should | Renovação com `carenciaAte` antigo não gera `carencia` indevida |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | HMAC com `timingSafeEqual` sobre corpo cru | `functions/kiwify.js:11-29,245-269` | 🟢 |
| Segurança | Debug sem PII arbitrária (`incluirPayload: false`) | `functions/kiwify.js:151-168` | 🟢 |
| Disponibilidade | Lease de 2 min e retry sem duplicação | `functions/kiwify.js:181-213` | 🟢 |
| Performance | Busca por e-mail é O(n) em tenants/profiles | `functions/kiwify.js:76-102` | 🟡 |

> Inferido a partir do código. Validar com equipe de operações.

## Critérios de Aceitação

```gherkin
Dado um POST /api/kiwify com assinatura HMAC válida e order_id
Quando o evento é uma renovação paga já processada
Então a resposta é 200 already_processed e nenhum campo do tenant é alterado

Dado um evento sem tenant identificável
Quando o webhook é processado
Então a reserva fica pending_tenant, a resposta é 202 e o evento pode ser retomado depois

Dado um pagamento aprovado com produto mapeado no catálogo
Quando a escrita multi-path é concluída
Então plano, planoVencimento, billingState='ativo' e status='success' mudam juntos
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-07 | Must | Caminho crítico de cobrança; sem ele o tenant não é ativado |
| RF-08, RF-09 | Should | Importante, mas há retomada pelo job/próximo evento |
| Eventos desconhecidos com revisão | Could | 🟡 Hoje marcados `success` sem fila |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `functions/kiwify.js` | `validateKiwifySignature`, `identifyTenant`, `mapProductToPlan`, `reservarEvento`, `handleKiwifyWebhook` | 🟢 |
| `functions/plan_catalog.js` | catálogo canônico de planos | 🟢 |
| `functions/index.js:820` | `exports.kiwifyWebhook` | 🟢 |
| `firebase.json:11-15` | rewrite `/api/kiwify` | 🟢 |
