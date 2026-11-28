# ADR 010 — Cabeçalhos de segurança e CORS restrito por allowlist

- **Status:** Aceito (retroativo)
- **Data:** 2026-04-24 a 2026-11-23
- **Confiança:** 🟢 CONFIRMADO

## Contexto

O projeto tinha CORS aberto (`*`) no bucket do Storage e no worker, e nenhum cabeçalho de segurança. Qualquer site poderia ler respostas autenticadas do SaaS. Popups do Firebase Auth quebravam quando se aplicava COOP estrito.

## Decisão

1. `cors.json` allowlist: `obrareal.com`, `www`, `*.obrareal.com`, `web.app`, `firebaseapp.com`; métodos `GET/HEAD/POST`; sem `PUT/DELETE`; `maxAgeSeconds: 3600`.
2. Worker com regex equivalente em `ALLOWED_ORIGINS`, `Vary: Origin`, `Allow-Credentials: true`, preflight `OPTIONS` respondido localmente com `204`.
3. CSP em `firebase.json`: `default-src 'self'`, CDNs explícitos, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `worker-src 'self' blob:`.
4. COOP `same-origin-allow-popups` — valor mínimo que preserva `signInWithPopup`.
5. APIs administrativas e webhooks com `cors:false`.

## Alternativas consideradas

- 🟡 **CORS `*` com credenciais**: impossível por especificação e inseguro.
- 🟡 **COOP `same-origin`**: rejeitado — quebra o login por popup.
- 🟡 **CSP sem `unsafe-inline`**: desejado, mas bloqueado por handlers inline ainda existentes no front.

## Consequências

- Positivas: leitura cross-origin restrita, `npm audit` sem vulnerabilidades, trilha documentada de aplicação manual do CORS do bucket.
- Negativas: duas listas precisam ser atualizadas juntas; uploads resumáveis grandes exigem readicionar `PUT`.
- Riscos: 🟡 `'unsafe-inline'` segue na CSP; 🔴 histórico Git antigo contém chave Web pública; 🟡 `cors.json` e worker podem divergir.

## Evidências

`git log`: `c45b343` (CSP), `19569ae`, `d7092ae`, `fc2a231`, `a9ebfe2`, `a5b5315`, `6145caa`, `86c32f4`.
Código: `firebase.json:41-55`, `cors.json`, `cloudflare-worker/worker.js:21-61`, `docs/security/cors.md`, `docs/security/hardening.md:99-121`.
