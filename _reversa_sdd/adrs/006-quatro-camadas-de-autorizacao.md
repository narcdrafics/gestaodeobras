# ADR 006 — Defesa em profundidade: servidor, claims, rules do RTDB e rules do Storage

- **Status:** Aceito (retroativo)
- **Data:** 2026-03-16 a 2026-11-23
- **Confiança:** 🟢 CONFIRMADO

## Contexto

O sistema expõe três superfícies de escrita: SDK do cliente direto no Realtime Database, Cloud Functions com Admin SDK e uploads no Cloud Storage. Cada superfície tem um modelo de autorização diferente, e nenhuma pode confiar nas outras integralmente.

## Decisão

1. **Servidor:** `verifyIdToken(token, true)` + consulta a `profiles`, `super_admins` e `users` antes de qualquer efeito administrativo.
2. **Claims:** `syncCustomClaims` grava `role` + `tenantId` (e módulos/obras para RH) no token; é a única autoridade que o Storage possui.
3. **RTDB Rules:** combination de `auth.token`, `root.child('profiles/...')`, allowlist e e-mail mestre, com `tenantId` igual ao nó e `billingState` compatível.
4. **Storage Rules:** só `request.auth.token` — caminho restrito a `tenants/<tid>/`, 1 byte–10 MB, `image/*` ou PDF.
5. Nós de sistema (`admin_audit`, `admin_ops`, `rate_limits`, `billing_events`, `webhook_debug`, `whatsapp_messages`, `super_admins`) têm `.write:false`.

## Alternativas consideradas

- 🟡 **Só rules do banco**: insuficiente para operações que precisam chamar a Graph API, a Kiwify ou o Auth.
- 🟡 **Só Admin SDK nas funções**: deixaria leituras/escritas diretas do cliente sem proteção.
- 🟡 **Rules do Storage lendo o RTDB**: tecnicamente impossível no Firebase.

## Consequências

- Positivas: uma vulnerabilidade em uma camada não derruba as outras; revogação imediata possível; auditoria centralizada.
- Negativas: duplicação de regras em quatro lugares; risco de divergência (ex.: `mestre` aceito em umas e não em outras).
- Riscos: 🟡 emulador de rules falha por configuração de projeto e hoje se usa asserção estática; 🔴 histórico Git ainda contém a chave Web pública.

## Evidências

`git log`: `5abece9`, `868d907`, `e505672`, `310e961`, `9107b8b`, `dd0ea21`, `86c32f4`.
Código: `database.rules.json`, `storage.rules`, `docs/security/hardening.md`, `docs/security/tenant-isolation.md`, `tests/security/*.test.js`.
