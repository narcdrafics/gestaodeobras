# Webhook Kiwify, Design Técnico

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fonte primária: `functions/kiwify.js`, `functions/index.js:820-833`, `firebase.json:11-15`.

## Interface

| Método | Caminho | Entrada | Saída | Status codes |
|--------|---------|---------|-------|--------------|
| POST | `/api/kiwify` | corpo cru + `?signature=` ou `x-kiwify-signature` | `{ok, status}` / `{motivo}` | 200 (`processed`/`already_processed`), 202 (`pending_tenant`), 400, 401, 409 |

| Símbolo | Assinatura | Retorno | Observação |
|---------|-----------|---------|------------|
| `validateKiwifySignature` | `(rawBody, assinatura, token)` | `boolean` | 🟢 HMAC-SHA1 + `timingSafeEqual` |
| `identifyTenant` | `(payload, query, db)` | `tenantId \| null` | 🟢 3 fontes em ordem |
| `mapProductToPlan` | `(produto, frequencia)` | `plano` | 🟢 `anual`/`yearly` altera o vencimento |
| `reservarEvento` | `(eventRef, payloadHash, tenantId, agora)` | `{jaProcessado, status, conflito}` | 🟢 transação com lease 2 min |
| `handleKiwifyWebhook` | `(req, res, deps)` | `Promise<void>` | 🟢 efeitos + `update()` final |

## Fluxo Principal

1. 🟢 `firebase.json` reescreve `/api/kiwify` para `kiwifyWebhook` (`functions/index.js:820`).
2. 🟢 `POST` obrigatório; valida assinatura sobre `req.rawBody` (`kiwify.js:245-269`).
3. 🟢 Exige `order_id`; resolve tenant (`kiwify.js:40-105`).
4. 🟢 Calcula `payloadHash` sem `order_status/status` e reserva `billing_events/<orderId>/<eventType>` (`kiwify.js:181-213,288-301`).
5. 🟢 Aplica efeito conforme `order_status`/evento e grava tenant + `success` em `update()` único (`kiwify.js:357-477`).

## Fluxos Alternativos

- **Assinatura inválida:** 🟢 401, grava `webhook_debug` sem payload.
- **Evento duplicado:** 🟢 `200 already_processed`; conflito de hash/tenant ⇒ `409 conflict_ignored`.
- **Sem tenant:** 🟢 `202 pending_tenant`, reavaliável na próxima entrega.
- **Falha na escrita final:** 🟢 reserva removida; Meta/Kiwify reenvia sem efeito parcial.
- **Reserva travada:** 🟢 `processing` com mais de 2 min é retomável.

## Dependências

- 🟢 `plan_catalog.js` — nível/limites do plano canônico.
- 🟢 `plan_features.js` — `hasFeature` para gates (via estado do tenant).
- 🟢 Realtime Database — `tenants/<tid>`, `billing_events`, `tenants_public`, `webhook_debug`, `profiles`, `invites`.
- 🟢 Secret Manager — `KIWIFY_TOKEN`.

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Dedup sem `order_status` (campo volátil entre entregas) | `kiwify.js:296-301` | 🟢 |
| `update()` multi-path para tenant + evento | `kiwify.js:448-477` | 🟢 |
| Cancelamento agendado não desfaz chargeback | `kiwify.js:418-422` | 🟢 |
| Plano desconhecido ⇒ `free_trial` | `plan_catalog.js` | 🟢 |

## Estado Interno

🟢 `billing_events/<orderId>/<eventType>` com `status ∈ {processing, success, pending_tenant, failed}`, `payloadHash`, `tenantId`, `reservadoEm` e carimbo `agora`. 🟢 O tenant recebe `plano`, `status`, `billingState`, `billingStateMotivo`, `planoVencimento`, `carenciaAte`, `limites`, `ultimoPagamento`. 🟡 `diasRestantes` é derivado na leitura, não persistido pelo webhook.

## Observabilidade

🟢 Logs de transição e de rejeição; `webhook_debug` registra motivo sem PII (`kiwify.js:151-168`). 🟡 Sem métrica de latência de dedup nem alerta para eventos `failed` prolongados.

## Riscos e Lacunas

- 🟢 Decisão P13: eventos desconhecidos vão para fila de revisão (hoje marcados `success`).
- 🟡 Busca por e-mail percorre todos os tenants (`O(n)`); pode exigir índice futuro.
- 🟡 Janela de até 24 h entre vencimento e o job pode defasar `billingState` (RN-025).
