# ADR 003 — Estado de cobrança separado do status e enforcement por feature flags

- **Status:** Aceito (retroativo)
- **Data:** 2026-11-21 a 2026-11-25
- **Confiança:** 🟢 CONFIRMADO

## Contexto

O plano do tenant era lido diretamente do campo `plano`, e cada módulo fazia sua própria checagem. Bloquear por inadimplência exigia mexer no `status`, que era usado por código legado do bot e do painel. Vencimento, carência e trial eram tratados de formas diferentes.

## Decisão

1. Criar `billingState` (`ativo`, `carencia`, `somente_leitura`, `bloqueado`) calculado por **função pura** `calcularBillingState`.
2. Aplicar o estado por job diário às 04:00 (`America/Sao_Paulo`) e por ações manuais do Master; gravar `billingStateMotivo` e timestamp.
3. Centralizar capacidades em uma matriz única (`plan_catalog.js` + `plan_features.js`), com espelho no cliente e paridade verificada por teste.
4. `hasFeature(nome, plano, contexto)` retorna `false` para feature desconhecida ou tenant bloqueado.
5. Regras do RTDB usam `billingState` diretamente: bloqueado proíbe leitura/escrita; somente_leitura permite ler.

## Alternativas consideradas

- 🟡 **Reutilizar `status` para bloqueio**: rejeitado — o campo já tinha semântica de ciclo de vida da conta e aliases legados.
- 🟡 **Feature flags apenas no front**: rejeitado por ser burcável; a matriz foi espelhada no backend e nas rules.
- 🟡 **Calcular estado a cada requisição**: rejeitado — leitura do tenant em todo request e risco de divergência entre call sites; escolheu-se job + função pura para previsibilidade.

## Consequências

- Positivas: uma única matriz de recursos, enforcement consistente em UI/rules/functions, trial com nível Pro para avaliação.
- Negativas: `status` e `billingState` podem divergir porque o job não atualiza `status`; até 24 h de defasagem após o vencimento.
- Riscos: 🟡 banners e `window.__billingState` dependem de listener isolado e podem defasar; 🔴 `dailyReport` não verifica `billingState`, só `status === 'inativo'`.

## Evidências

`git log`: `a2499e1` billing enforcement, `a189570` plan features, `d53d735` webhook Kiwify, `cbaa6ea` API master.
Código: `functions/billing.js:39-175`, `functions/plan_catalog.js`, `functions/plan_features.js`, `docs/plans/features.md`, `tests/plan-features.test.js`.
