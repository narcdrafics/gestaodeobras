# Contrato externo — Webhook Kiwify

> 🟢 CONFIRMADO em `firebase.json`, `functions/index.js`, `functions/kiwify.js`.

## HTTP

```http
POST /api/kiwify?signature=<hmac-sha1>
x-kiwify-signature: <hmac-sha1>
Content-Type: application/json
```

| Resposta | Quando | Corpo |
|----------|--------|-------|
| `200` | evento processado ou duplicado | `{ "ok": true, "status": "processed" \| "already_processed" }` |
| `202` | tenant ainda não identificado | `{ "status": "pending_tenant" }` |
| `400` | sem `order_id` | `{ "motivo": "Missing order_id" }` |
| `401` | método/assinatura inválidos | `{ "motivo": "token_ausente" \| "sem_assinatura" \| "hmac_invalido" }` |
| `409` | conflito de payload/tenant em evento `success` | `{ "status": "conflict_ignored" }` |

## Evento canônico (billing_events)

| Campo | Tipo | Origem | Confiança |
|-------|------|--------|-----------|
| `<orderId>/<eventType>` | chave | dedup canônica | 🟢 |
| `payloadHash` | string | SHA-256 sem `order_status`/`status` | 🟢 |
| `tenantId` | string \| null | `identifyTenant` | 🟢 |
| `status` | enum | `processing`/`success`/`pending_tenant`/`failed` | 🟢 |
| `reservadoEm` | timestamp | lease de 2 min | 🟢 |

## Efeitos no tenant

| Evento | Efeito |
|--------|--------|
| `paid` / `order_approved` / `subscription_renewed` | 🟢 `plano`, `status='ativo'`, `billingState='ativo'`, `planoVencimento`, limites; limpa `carenciaAte`/`motivoBloqueio` |
| `refunded` / `chargedback` / `order_refunded` / `chargeback` | 🟢 `status='bloqueado_pagamento'`, `billingState='bloqueado'`, `dataBloqueio` |
| `subscription_canceled` | 🟢 vencimento futuro ⇒ `cancelamentoAgendado=true`; passado ⇒ `carenciaAte=+3 dias` |
| `subscription_late` / `refused` | 🟢 `billingState='carencia'` por 5 dias + `avisoCarencia` |

## Regras de reentrega

🟢 `success` + mesmo hash/tenant ⇒ `200 already_processed`. 🟢 `success` + divergência ⇒ `409 conflict_ignored`. 🟢 `processing` com mais de 2 min, `pending_tenant` e `failed` ⇒ reprocessáveis. 🟡 Evento desconhecido ⇒ `success` sem efeito; sem fila de revisão.
