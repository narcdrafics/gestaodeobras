# ADR 008 — Status derivado em leitura e recálculo retroativo de valores

- **Status:** Aceito (retroativo)
- **Data:** 2026-04-25 a 2026-11-27
- **Confiança:** 🟢 CONFIRMADO

## Contexto

O sistema exibia "Atrasada" em tarefas e "SEM ESTOQUE"/"CRÍTICO" em materiais, mas gravava esses valores no banco. Quando a diária de um trabalhador mudava, presenças antigas pagas e não pagas ficavam com valores inconsistentes. Relatórios divergiam da tela.

## Decisão

1. `Atrasada` é calculado em leitura (`tarefaStatusEfetivo` compara `prazo < getTodayBR()`) e **nunca** persistido.
2. `estoqueStatus` é derivado de `saldo` e `min` (`SEM ESTOQUE`, `CRÍTICO`, `BAIXO`, `NORMAL`).
3. `finDerivedStatus` resume a situação financeira a partir dos lançamentos (`Pendente`, `Pago`, `Parcial`, `Atrasado`).
4. Alteração na diária dispara **recalculo retroativo** de presenças ainda não pagas (commit `1ab48d9`); diária/hora extra seguem fórmula única.
5. `valpago` é validado no cliente e revalidado no trigger de aprovação; `Parcial` é limitado ao total.
6. Compras não entram em `realizado` — aparecem apenas em `pendencias`.

## Alternativas consideradas

- 🟡 **Gravar status derivado e atualizar por job**: rejeitado — exigiria varredura noturna e ainda assim defasaria entre escrita e job.
- 🟡 **Corrigir apenas presenças futuras**: rejeitado — folha fechada com valor antigo gerava reclamação.
- 🟡 **Recalcular também lançamentos pagos**: rejeitado — pagamento é fatos consumados; só pendentes são recalculados.

## Consequências

- Positivas: uma única fonte de verdade para "atraso" e nível de estoque; folha coerente após ajuste de diária.
- Negativas: cálculos repetidos em várias telas; risco de divergência entre implementações (já existe normalizador local em `saveEstoque`).
- Riscos: 🟡 `orcamentoParcial` (cobertura ≤ 50%) precisa ser tratado separadamente para não virar falso estouro; 🟡 dashboard limita alertas a 8 e pode esconder custos.

## Evidências

`git log`: `0706401`, `f4d8424`, `dc89b37`, `239f99c`, `1ab48d9`, `d26192c`, `3e0c2c2`.
Código: `utils.module.js:1006,1082,1179-1216,1481-1489`, `public/js/app_core.js`, `functions/aprovacoes.js:301-314`, `tests/tarefas-dashboard.test.js`.
