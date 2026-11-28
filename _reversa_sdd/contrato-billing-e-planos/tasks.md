# Contrato de dados — Billing e planos, Tarefas

> 🟢 CONFIRMADO · 🟡 INFERIDO. Cada tarefa cita o arquivo legado de origem.

## Pré-requisitos

- [ ] `ADR-003`, `ADR-004`, `state-machines.md` §1-2 e `permissions.md` disponíveis.
- [ ] Segredos Kiwify (`KIWIFY_TOKEN`, `CLIENT_ID`, `CLIENT_SECRET`, `ACCOUNT_ID`) configurados via Secret Manager.

## Tarefas

- [ ] T-01, Implementar `calcularBillingState` com precedência e constantes — Origem: `billing.js:39-137`; Critério: `tests/security/billing.test.js` passa; 🟢
- [ ] T-02, Implementar job diário de transições em `America/Sao_Paulo` — Origem: `billing.js:145-175`; Critério: `update` multi-path e log `Concluido 0/N`; 🟢
- [ ] T-03, Validar HMAC-SHA1 sobre `rawBody` e gravar `webhook_debug` sem PII — Origem: `kiwify.js:11-29,151-168`; Critério: 401 em assinatura inválida; 🟢
- [ ] T-04, Identificar tenant por reference/slug/e-mail — Origem: `kiwify.js:40-105`; Critério: ambiguidade rejeitada; 🟢
- [ ] T-05, Reservar evento com `orderId+eventType`, hash e lease de 2 min — Origem: `kiwify.js:181-213`; Critério: reentrega ⇒ `already_processed`, conflito ⇒ 409; 🟢
- [ ] T-06, Aplicar efeitos por evento e update atômico tenant+evento — Origem: `kiwify.js:227-493`; Critério: falha libera reserva; 🟢
- [ ] T-07, Implementar ações do painel master (plano, limites, bloqueio) — Origem: `super_admin.js:248-337`; Critério: resíduos de carência/bloqueio limpos; 🟢
- [ ] T-08, Implementar enforcement de obras/usuários/assentos/slug no Admin SDK — Origem: `index.js:541-685`; Critério: `tests/security/billing.test.js` e `tests/super-admin.test.js` passam; 🟢
- [ ] T-09, Implementar matriz de features e espelho front com teste de paridade — Origem: `plan_features.js` (back/front); Critério: `tests/plan-features.test.js` passa; 🟢
- [ ] T-10, Implementar `renderBillingEnforcement`, `billingStateRef` e gates no cliente — Origem: `data_core.js:100-268,376-455`, `app_core.js:290-346`; Critério: tenant bloqueado lê `billingState` e vê tela de bloqueio; 🟢
- [ ] T-11, Aplicar guards de billing nas rules — Origem: `database.rules.json:30-77,211-233`; Critério: `tests/security/rules.test.js` passa; 🟢

## Tarefas de Teste

- [ ] TT-01, 11 transições de `calcularBillingState` com motivos
- [ ] TT-02, Idempotência do webhook (duplicado, conflito, pending, lease expirado)
- [ ] TT-03, Efeitos de paid/refund/cancel/late e limpeza de resíduos
- [ ] TT-04, Paridade de features front/back e revogação por `bloqueado`
- [ ] TT-05, Reversão de escritas por limites e subdomínio sem feature

## Lacunas Pendentes (🟡)

- 🟡 GAP-06: documentar reconciliação entre `status` e `billingState` antes de alterar um dos campos.
- 🟡 Declarar explicitamente que limites de trabalhadores/medicao do catálogo não são aplicados.
- 🟡 Alinhar fallback client-side de trial ao servidor (`webhookCriacao + 30 dias`).
