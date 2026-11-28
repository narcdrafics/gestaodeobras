# Webhook Kiwify, Tarefas de Implementação

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Cada tarefa cita o arquivo legado de origem.

## Pré-requisitos

- [ ] Rewrite `/api/kiwify` presente no Hosting (`firebase.json`).
- [ ] Segredo `KIWIFY_TOKEN` provisionado no Secret Manager.
- [ ] Catálogo `plan_catalog.js` e espelho front `public/js/plan_features.js` com teste de paridade.

## Tarefas

- [ ] T-01, Reproduzir validação HMAC-SHA1 sobre corpo cru
  - Origem: `functions/kiwify.js:11-29,245-269`
  - Critério de pronto: assinatura inválida ⇒ 401 + `webhook_debug` sem payload; teste `tests/kiwify.test.js` passa
  - Confiança: 🟢
- [ ] T-02, Implementar `identifyTenant` nas 3 fontes
  - Origem: `functions/kiwify.js:40-105`
  - Critério de pronto: `external_reference`, slug público e e-mail retornam o mesmo tenant; sem match ⇒ `null`
  - Confiança: 🟢
- [ ] T-03, Reservar evento com `orderId + eventType` e lease de 2 min
  - Origem: `functions/kiwify.js:181-213,288-301`
  - Critério de pronto: reentrega concorrente processa uma vez; `tests/kiwify-idempotency.test.js` passa
  - Confiança: 🟢
- [ ] T-04, Mapear produto/frequência para plano canônico
  - Origem: `functions/kiwify.js:112-140`; `functions/plan_catalog.js`
  - Critério de pronto: produto anual produz `planoVencimento` correto e plano desconhecido cai em `free_trial`
  - Confiança: 🟢
- [ ] T-05, Aplicar efeitos pagamento/reembolso/cancelamento/atraso
  - Origem: `functions/kiwify.js:357-477`; `flowcharts/billing-e-planos.md` §5
  - Critério de pronto: cada evento altera exatamente os campos documentados; chargeback não é desfeito por cancelamento agendado
  - Confiança: 🟢
- [ ] T-06, Gravar tenant e evento em `update()` único com liberação da reserva na falha
  - Origem: `functions/kiwify.js:448-477`
  - Critério de pronto: falha simulada não deixa efeito parcial e permite retry
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, happy path de renovação paga (ver `requirements.md`, Critérios de Aceitação)
- [ ] TT-02, assinatura inválida e ausência de `order_id`
- [ ] TT-03, duplicata, conflito e `pending_tenant`
- [ ] TT-04, chargeback seguido de cancelamento agendado

## Lacunas Pendentes (🔴)

- 🟢 Decisão P13: destino dos eventos não reconhecidos é fila de revisão (implementação pendente).
