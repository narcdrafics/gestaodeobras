# Contrato de evento — limite de usuários

> 🟢 CONFIRMADO em `functions/index.js`, `domain.md`.

## Gatilhos

```js
onValueWritten("tenants/{tenantId}/usuarios", enforceUsuariosLimit)
onValueWritten("profiles/{uid}", syncCustomClaims) // aplicaLimiteDeAssentos
```

| Entrada | Valor |
|---------|-------|
| Limite | `tenants/<tid>/config/limiteUsuarios` |
| Fallback | 🟢 `1` |
| Contagem | 🟢 ativos, exceto pendentes e o próprio uid |

## Resultado

| Condição | Ação |
|----------|------|
| 🟢 lista cresceu acima do limite | reversão transacional |
| 🟢 `ativos >= limite + 1` | perfil `status='pendente'` |
| 🟢 perfil pendente | claim `{role:'pendente', tenantId:null}` |

🔴 Publicação de claims sem retry (GAP-10).
