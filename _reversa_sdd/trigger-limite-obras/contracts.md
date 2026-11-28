# Contrato de evento — limite de obras

> 🟢 CONFIRMADO em `functions/index.js`.

## Gatilho

```js
onValueWritten("tenants/{tenantId}/obras", enforceObrasLimit)
```

| Entrada | Valor |
|---------|-------|
| Limite | `tenants/<tid>/config/limiteObras` |
| Fallback | 🟢 `1` quando ausente/inválido |
| Ilimitado | 🟢 `>= 9999` |

## Resultado

| Condição | Ação |
|----------|------|
| 🟢 `depois <= antes` | nenhuma |
| 🟢 `depois > limite` | transação restaura valor anterior |
| 🟢 sem valor anterior | aborta (preserva legado) |
