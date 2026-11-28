# Contrato de execução — prazos de aprovação

> 🟢 CONFIRMADO em `functions/aprovacoes.js`, `functions/index.js`.

## Schedule

```js
onSchedule({ schedule: "every day 06:00", timeZone: "America/Sao_Paulo" }, handler)
```

## Regras

| Dias desde a solicitação | Ação |
|--------------------------|------|
| 🟢 7 | alerta `alertas[7]` + notificação única |
| 🟢 12 | alerta `alertas[12]` + notificação única |
| 🟢 15 | alerta `alertas[15]` + expiração (`expiraEm`) |

| Estado | Ação do job |
|--------|-------------|
| 🟢 `aprovado` com reserva >10 min | retomar aplicação |
| 🟢 `pendente` vencida | `expirado` + `expiradoEm` |

## Saída agregada

🟢 `{tenants, alertas, expiradas, retomadas, erros}`.

🟢 `tarefas_pendentes` fora do contrato por decisão P4 (nó removido).
