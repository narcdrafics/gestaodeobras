# Trigger — Limite de usuários, Design Técnico

> 🟢 CONFIRMADO. Fonte: `functions/index.js:603-640,648-651`.

## Interface

| Gatilho | Origem | Entrada | Saída |
|---------|--------|---------|-------|
| onValueWritten | `tenants/{tid}/usuarios` | antes/depois | reversão transacional |
| onValueWritten | `profiles/{uid}` | perfil | status `pendente` eventual |

| Símbolo | Assinatura | Observação |
|---------|-----------|------------|
| `enforceUsuariosLimit` | `(event)` | 🟢 usa `enforceGrowthLimit` |
| `aplicarLimiteDeAssentos` | `(uid, tenantId, db)` | 🟢 chamado por `syncCustomClaims` |

## Fluxo

1. 🟢 `usuarios`: compara quantidades; acima do limite restaura `beforeVal`.
2. 🟢 `profiles`: conta ativos do tenant (`pendentes` e o próprio excluídos).
3. 🟢 `ativos >= limiteUsuarios + 1` ⇒ `status='pendente'`.
4. 🟢 `syncCustomClaims` publica `{role:'pendente', tenantId:null}`.

## Decisões

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Dono contado separadamente | `index.js:603-640` | 🟢 |
| Legado preservado | `RN-003` | 🟢 |
| Fallback fail-closed | `index.js:548-554` | 🟢 |

## Riscos

- 🟡 `syncCustomClaims` sem retry (GAP-10) pode adiar a publicação da claim `pendente`.
