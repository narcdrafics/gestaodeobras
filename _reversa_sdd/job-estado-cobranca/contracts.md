# Contrato de execução — recálculo de cobrança

> 🟢 CONFIRMADO em `functions/billing.js`, `functions/index.js`.

## Schedule

```js
onSchedule({ schedule: "every day 04:00", timeZone: "America/Sao_Paulo" }, handler)
```

## Entrada

| Campo do tenant | Uso |
|-----------------|-----|
| `plano`, `status` | 🟢 precedência de bloqueio |
| `trialExpiracao`, `webhookCriacao` | 🟢 trial 30 dias |
| `planoVencimento`, `carenciaAte` | 🟢 plano pago |
| `billingState` | 🟢 comparação com estado calculado |

## Saída (somente transições)

| Campo | Valor |
|-------|-------|
| `billingState` | 🟢 `ativo`/`carencia`/`somente_leitura`/`bloqueado` |
| `billingStateMotivo` | 🟢 motivo canônico |
| `billingStateAtualizadoEm` | 🟢 timestamp da transição |

🟡 `status` não é alterado pelo job. 🟡 `diasRestantes` não é persistido.
