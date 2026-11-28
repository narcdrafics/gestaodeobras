# Contrato de execução — retenção de segurança

> 🟢 CONFIRMADO em `functions/retencao.js`, `functions/index.js`.

## Schedule

```js
onSchedule({ schedule: "every day 03:30", timeZone: "America/Sao_Paulo" }, handler)
```

## Políticas

| Nó | Janela |
|----|--------|
| 🟢 auditoria | 90 dias |
| 🟢 dedup/reservas (`whatsapp_messages`, `billing_events`, `admin_ops`) | 24 h |
| 🟢 cotas | 2 h |
| 🟡 `webhook_debug` | janela curta configurada em código |

## Saída

🟢 Resumo por nó com contadores e erros isolados.
