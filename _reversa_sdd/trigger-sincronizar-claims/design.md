# Trigger — Sincronizar Claims, Design Técnico

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `functions/index.js:680-817`, `functions/claims.js`, `ADR-002`.

## Interface

| Gatilho | Origem | Entrada | Saída |
|---------|--------|---------|-------|
| onValueWritten | `profiles/{uid}` | snapshot antes/depois | `setCustomUserClaims` + eventual `revokeRefreshTokens` |

| Símbolo | Assinatura | Retorno | Observação |
|---------|-----------|---------|------------|
| `avaliarSuperAdmin` | `{uid, email, currentClaims, db}` | `{autorizado, motivo}` | 🟢 `claims.js:35-71` |
| `normalizarRole` | `(role)` | `string` | 🟢 `mestre` ⇒ `encarregado` |
| `aplicarLimiteDeAssentos` | `(uid, tenantId, db)` | `boolean` | 🟢 index.js:603-640 |

## Fluxo Principal

1. 🟢 Escrita em `profiles/<uid>` dispara o trigger.
2. 🟢 Lê Auth, perfil, `users/<email>`, `super_admins/<uid>`, `tenants/<tid>/config`.
3. 🟢 Normaliza papel e corrige auto-promoção.
4. 🟢 Conta assentos ativos (exclui pendentes e o próprio uid); acima do limite ⇒ `pendente`.
5. 🟢 Monta claims com `role`, `tenantId`, módulos RH e obras permitidas.
6. 🟢 `setCustomUserClaims`; revoga tokens quando necessário.

## Fluxos Alternativos

- **Perfil excluído:** 🟢 claims limpas / usuário sem tenant.
- **Master despromovido:** 🟢 revogação imediata.
- **Plano bloqueado:** 🟢 claims de `bloqueado`/`pendente`.
- **Falha na publicação:** 🔴 sem retry — GAP-10.

## Dependências

- 🟢 Firebase Auth Admin SDK, RTDB (`profiles`, `users`, `super_admins`, `tenants`, `invites`), `claims.js`, `plan_features.js`.

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Centralizar autoridade no trigger, não no cliente | `ADR-002` | 🟢 |
| Claims como contrato para Storage (que não consulta RTDB) | `storage.rules:4-22` | 🟢 |
| Limite de assentos não pun usuários legados | `RN-003` | 🟢 |

## Estado Interno

🟢 Claims no Firebase Auth; perfis no RTDB. 🟡 Revogação é assíncrona — o próximo token reflete a mudança.

## Observabilidade

🟢 Logs de correção de cargo e de revogação. 🔴 Sem alerta para falha de `setCustomUserClaims`.

## Riscos e Lacunas

- 🔴 GAP-10: `syncCustomClaims` sem retry/dead-letter.
- 🟡 GAP-09: alias `mestre`/`EMAIL_MESTRA` replicados entre claims, rules e Storage.
- 🟡 Divergência claim × perfil é resolvida por "maior papel" apenas nas decisões de aprovação, não universalmente.
