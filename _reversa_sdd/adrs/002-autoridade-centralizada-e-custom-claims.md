# ADR 002 — Autoridade de acesso centralizada no servidor, propagada por Custom Claims

- **Status:** Aceito (retroativo)
- **Data:** 2026-03-16 a 2026-11-26
- **Confiança:** 🟢 CONFIRMADO

## Contexto

O sistema tinha papéis gravados em `users/<email>/role`, espelhados no cliente e confiados em chamadas HTTP. Isso permitia escalação: bastava escrever `role: 'super_admin'` em um nó legado ou enviar o papel no corpo da requisição. OStorage Rules, além disso, não consegue ler o Realtime Database.

## Decisão

1. `profiles/<uid>` passou a ser a **autoridade** de `role`/`tenantId`/`status`; campos são imutáveis para o cliente nas rules.
2. A trigger `syncCustomClaims` (`onValueWritten`) normaliza papéis (`mestre` → `encarregado`), bloqueia escalação e grava `role` + `tenantId` nas Custom Claims.
3. Toda API administrativa usa `verifyIdToken(token, true)` e **reconfirma** o papel no RTDB, na allowlist `super_admins/<uid>` e no passaporte legado.
4. `users/<email>/role` só preserva uma promoção que já existia nas claims — nunca promove conta nova.
5. Mudança para `bloqueado` chama `revokeRefreshTokens`; Storage depende exclusivamente das claims.

## Alternativas consideradas

- 🟡 **Confiar no papel enviado pelo cliente**: rejeitado após os incidentes de escalação (`9107b8b`).
- 🟡 **Consultar o RTDB em todas as requisições sem token verificado**: rejeitado — tokens revogados continuariam válidos até expirar.
- 🟡 **Manter `users/<email>` como fonte canônica**: rejeitado por chavear por e-mail (mutável) e ser legível por qualquer usuário na versão antiga.

## Consequências

- Positivas: uma única fonte de verdade, revogação imediata, quatro camadas de defesa (servidor → claims → rules RTDB → rules Storage).
- Negativas: revogação depende de `revokeRefreshTokens` em **todo** caminho de mudança; `syncCustomClaims` engole erro de `getUser` e não tem retry.
- Riscos: 🟡 `mestre` e `EMAIL_MESTRA` permanecem como exceções legadas.

## Evidências

`git log`: `310e961`, `91de270`, `9107b8b` (hardening de escalação), `3cdb891` (RH), `7fb48c1` (modularização + rules).
Código: `functions/claims.js`, `functions/index.js:680-817`, `functions/super_admin.js:46-91`, `docs/security/tenant-isolation.md`, `tests/security/privilege-escalation.test.js`.
