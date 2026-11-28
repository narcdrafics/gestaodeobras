# Contrato de evento — profiles → Custom Claims

> 🟢 CONFIRMADO em `functions/index.js`, `functions/claims.js`, `storage.rules`.

## Gatilho

```js
onValueWritten("profiles/{uid}", handler)
```

| Entrada | Origem |
|---------|--------|
| `before` / `after` de `profiles/<uid>` | Realtime Database |
| Auth user, `users/<email>`, `super_admins/<uid>`, `tenants/<tid>/config` | Admin SDK / RTDB |

## Claims publicadas

| Claim | Tipo | Regra |
|-------|------|-------|
| `role` | string | 🟢 normalizado (`mestre` ⇒ `encarregado`) |
| `tenantId` | string \| null | 🟢 `null` para pendente/bloqueado/master sem tenant |
| `modulosPermitidos` | object | 🟢 somente para `rh`, chaves booleanas |
| `acessoObras` | `'todas'` \| `'especificas'` | 🟢 RH |
| `obrasPermitidas` | string[] | 🟢 até 50 |

## Consumidores

| Consumidor | Uso |
|------------|-----|
| 🟢 `storage.rules` | autoriza leitura/escrita de arquivos por `role`/`tenantId` |
| 🟢 `auth_core.js` | espera claimed role antes de liberar app |
| 🟢 `aprovacoes-api.js` | papel efetivo (maior entre claim e perfil) |
| 🟢 `plan_features.js` | gate por tenant/plano |

🔴 Sem retry/dead-letter na publicação (GAP-10).
