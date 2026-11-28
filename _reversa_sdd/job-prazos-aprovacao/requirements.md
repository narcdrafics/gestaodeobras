# Job — Prazos de aprovação (06:00)

> 🟢 CONFIRMADO · 🟡 INFERIDO. Fontes: `functions/index.js:905-912`, `functions/aprovacoes.js`, `flowcharts/aprovacoes.md` §5, `RN-028`/`RN-029`.

## Visão Geral

🟢 Varre aprovações diariamente para retomar aplicações travadas, expirar pendências e disparar alertas de prazo com dedupe.

## Responsabilidades

- 🟢 Executar às 06:00 de `America/Sao_Paulo`.
- 🟢 Retomar aplicação com reserva órfã >10 min.
- 🟢 Expirar pendências com `expiraEm <= agora`.
- 🟢 Alertar em 7, 12 e 15 dias uma única vez por `alertas[dia]`.
- 🟢 Notificar solicitante e admins.

## Regras de Negócio

- 🟢 RN-028: prazo 15 dias; alertas 7/12/15 com dedupe.
- 🟢 RN-029: retomada de aplicação após 10 min.
- 🟢 Resultado agregado: tenants, alertas, expiradas, retomadas, erros.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Schedule 06:00 em America/Sao_Paulo | Must | Config correta |
| RF-02 | 🟢 Retomar reservas >10 min | Must | Efeito aplicado uma vez |
| RF-03 | 🟢 Expirar pendências vencidas | Must | `status='expirado'` + `expiradoEm` |
| RF-04 | 🟢 Alertas 7/12/15 com dedupe por transação | Must | Reexecução não duplica notificação |
| RF-05 | 🟢 Notificar solicitante e admins | Must | Cópias individuais por destinatário |
| RF-06 | 🟢 Agregar resultado sem abortar por erro isolado | Should | Erro em um tenant não impede os demais |

## Critérios de Aceitação

```gherkin
Dado uma aprovação pendente com expiraEm no passado
Quando o job roda
Então status='expirado', expiradoEm é gravado e solicitante/admins são notificados

Dado uma aprovação aprovada com reserva órfã há 12 minutos
Quando o job roda
Então os efeitos são aplicados e aplicadoEm é gravado uma única vez
```

## Rastreabilidade

| Arquivo | Função | Cobertura |
|---------|--------|-----------|
| `functions/index.js:905` | `exports.aprovacoesPrazosJob` | 🟢 |
| `functions/aprovacoes.js` | `processarAprovacoesJob` | 🟢 |
| `flowcharts/aprovacoes.md` §5 | — | 🟢 |
