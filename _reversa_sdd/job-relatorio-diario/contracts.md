# Contrato de execução — relatório diário

> 🟢 CONFIRMADO em `functions/index.js`; 🔴 lacunas registradas.

## Schedule

```js
onSchedule({ schedule: "every day 21:00" }, dailyReport)
// 18:00 America/Sao_Paulo
```

## Gate

| Condição | Resultado |
|----------|-----------|
| 🟢 `hasFeature('relatorio.whatsapp.diario') === false` | sem envio |
| 🟢 `billingState` em `bloqueado`/`somente_leitura` | sem envio |
| 🟢 `adminPhone` ausente | sem envio |

## Leitura

| Nó | Estado |
|----|--------|
| 🟢 `ponto/<hoje>` | lido pelo job hoje; decisão P3 adota `presenca` |
| 🟢 `tenants/<tid>/presenca` | nó canônico por decisão P3 (ajuste pendente) |

🟢 Decisão P3 registrada: ajustar leitura para `presenca`; implementação pendente.

## Entrega

🟢 Graph API v20.0 com `META_ACCESS_TOKEN` e `META_PHONE_NUMBER_ID`. 🔴 Sem retry/dead-letter (GAP-05).
