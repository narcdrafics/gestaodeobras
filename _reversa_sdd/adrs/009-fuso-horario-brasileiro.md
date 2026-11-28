# ADR 009 — Fuso `America/Sao_Paulo` como referência de negócio

- **Status:** Aceito (retroativo)
- **Data:** 2026-04-25
- **Confiança:** 🟢 CONFIRMADO

## Contexto

Datas eram calculadas com `new Date()`/UTC do navegador e do servidor. No Brasil, isso deslocava o "dia de hoje" entre 21h e 00h, bagunçando presença, semanas de segunda-feira, prazos de aprovação e jobs agendados.

## Decisão

1. `getHojeBR()` é a função canônica para o dia corrente no cliente.
2. Semanas de presença e almoço começam na segunda-feira (`getDay() === 0` ⇒ `-6`).
3. Todos os jobs usam `timeZone: 'America/Sao_Paulo'` (`aprovacoesPrazosJob` 06:00, `retencaoSegurancaJob` 03:30, `dailyBillingStateJob` 04:00, `dailyReport`).
4. Datas de exportação/relatório usam `dd/mm` em pt-BR.

## Alternativas consideradas

- 🟡 **UTC em todas as camadas**: rejeitado — o dia de trabalho do usuário não é UTC.
- 🟡 **Fuso do navegador do usuário**: rejeitado — usuários podem viajar ou estar em fusos diferentes do canteiro.

## Consequências

- Positivas: presença e folha batem com o dia do canteiro; prazos e jobs ficam previsíveis.
- Negativas: duas implementações de data convivem (cliente e funções), com risco de divergência.
- Riscos: 🟡 `confirmarTarefas` do parser desconectado usa `toISOString().split('T')[0]` (UTC), divergente de `getHojeBR()`; 🟡 `dailyReport` e bot podem usar bases de data diferentes.

## Evidências

`git log`: `0706401` (timezone consistente), `f4d8424` (semana começa na segunda), `32b9093`, `3e0c2c2`.
Código: `functions/index.js` (`onSchedule` com `timeZone`), `utils.module.js`, `data-dictionary.md §47, §52`, `code-analysis.md:624,709`.
