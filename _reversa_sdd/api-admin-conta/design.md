# API Admin — Conta, Design Técnico

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fonte: `functions/super_admin.js`, `functions/auditoria.js`, `functions/kiwify_api.js`, `flowcharts/admin-e-super-admin.md`.

## Interface

| Método | Caminho | Entrada | Saída | Status codes |
|--------|---------|---------|-------|--------------|
| POST | `/api/admin/conta` | `{acao, requestId, ...}` + Bearer | `{ok, resultado, requestId, idempotente}` | 200, 400, 401, 403, 405, 409, 413, 429, 502, 503 |
| GET | `/api/admin/conta` | `?recurso=kiwify&tipo=...` + Bearer | `{ok, resultado, catalogoLocal}` | 200, 400, 401, 403, 429 |

| Símbolo | Assinatura | Retorno | Observação |
|---------|-----------|---------|------------|
| `verificarSuperAdmin` | `(req, db)` | `{autorizado, motivo, uid, email}` | 🟢 3 fontes de autoridade |
| `ACOES` | mapa | `Promise<resultado>` | 🟢 6 ações documentadas |
| `reservarOperacao` | `(requestId, db)` | `boolean` | 🟢 transação em `admin_ops` |
| `registrar` | `(ctx, acao, alvo, sucesso)` | `Promise<void>` | 🟢 obrigatória em destrutivas |

## Fluxo Principal

1. 🟢 Método POST/GET; `validarCorpo` + cota IP.
2. 🟢 Bearer com `checkRevoked=true`; `Promise.all` de Auth, `profiles`, `users`, `super_admins`.
3. 🟢 Autorização e cota UID.
4. 🟢 POST: cota ação → validar `acao` → reserva se destrutiva → executar → auditoria → 200.
5. 🟢 GET: cota Kiwify → validar `tipo`/parâmetros → credenciais → consulta → auditoria → 200.

## Fluxos Alternativos

- **Reserva existente:** 🟢 200 `idempotente=true`.
- **Auditoria falhou:** 🟢 503; reserva mantida.
- **Erro com efeito aplicado:** 🟢 reserva **não** é liberada.
- **`getUserByEmail` sem resultado:** 🟢 404; conta `disabled` ⇒ 409.
- **`generatePasswordResetLink` falho:** 🟢 502; link nunca auditado.
- **Credenciais Kiwify ausentes:** 🟢 200 com `configurado=false`.

## Dependências

- 🟢 Firebase Auth Admin SDK, RTDB (`profiles`, `users`, `super_admins`, `admin_ops`, `admin_audit`, `tenants`, `invites`), `abuso.js`, `auditoria.js`, `claims.js`, `plan_catalog.js`, `kiwify_api.js`, Secret Manager.

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Fail-closed em auditoria obrigatória | `super_admin.js:446-468`; `ADR-004` | 🟢 |
| `requestId` como chave de idempotência | `auditoria.js` | 🟢 |
| Link de reset sensível fora da auditoria | `flowcharts/admin-e-super-admin.md` §3 | 🟢 |
| OAuth Kiwify preferido; token legado opcional | `kiwify_api.js` | 🟢 |

## Estado Interno

🟢 `admin_ops/<requestId>` (reserva com efeito aplicado ou não), `admin_audit` (trilha), `tenants/<tid>` (plano/limites/bloqueio), `profiles/<uid>` e `users/<emailKey>` (bloqueio/exclusão). 🟡 Cache de token da Kiwify em memória da função.

## Observabilidade

🟢 `admin_audit` com `requestId`, ator, ação, alvo e sucesso; painel lê `limitToLast(30)`. 🟡 Sem alerta automático para reservas órfãs de longa data.

## Riscos e Lacunas

- 🟡 `status` × `billingState` divergentes (GAP-06) exigem reconciliação explícita nas specs de plano.
- 🟡 Alias `mestre` e `EMAIL_MESTRA` replicados (GAP-09).
- 🔴 `admin_ops` sem lease curto (GAP-10) pode prender operações sem alerta.
