# ADR 014 — Deploy dividido: Hosting automático, Functions/Rules manuais e Worker na Cloudflare

- **Status:** Aceito (retroativo) — com ressalva 🔴
- **Data:** 2026-04-24 a 2026-11-23
- **Confiança:** 🟢 CONFIRMADO

## Contexto

O front é SPA estática servida pelo Firebase Hosting; as regras de negócia sensíveis moram em Cloud Functions e Security Rules; o roteamento de subdomínios vive em um Worker da Cloudflare. São duas plataformas e quatro artefatos independentes.

## Decisão

1. `deploy.yml` publica **somente Hosting** no canal `live` quando há push em `main`, com service account via secret.
2. `test.yml` roda Vitest (Node 20) em push/PR de `main`/`master`; deploy e teste são workflows separados.
3. Functions usam Node 24, Admin SDK modular e segredos via Secret Manager; `functions/package.json` mantém scripts `serve`/`deploy`/`logs`.
4. Deploy de functions, rules e segredos é feito manualmente pela CLI conforme `docs/security/hardening.md` (8 segredos + `firebase deploy --only ...`).
5. O Worker é publicado por Wrangler com rotas `obrareal.com/*` e `*.obrareal.com/*`; CORS do bucket é aplicado com `gcloud storage buckets update --cors-file=cors.json`.
6. `apphosting.yaml` existe (1 CPU / 512 MiB), mas não participa do pipeline observado.

## Alternativas consideradas

- 🟡 **Deploy único de tudo no merge**: não adotado — mudanças de rules/segredos exigem validação humana e nem sempre podem ser automáticas.
- 🟡 **App Hosting em vez de Firebase Hosting**: config presente, sem evidência de uso; 🟡 pode ser migração futura.

## Consequências

- Positivas: publicação de front rápida e reversível; segredos fora do repositório; roteamento de tenant resolvido na borda.
- Negativas: risco de front novo com back antigo; duas configs do Wrangler e `FIREBASE_URL`/`projectId` fixos dificultam staging.
- Riscos: 🔴 `deploy.yml` não roda testes antes de publicar; 🟡 sem alerta automático para `auditoria_falhou`/falha de retenção; 🟡 `.firebaserc` listado no `.gitignore` apesar de existir.

## Evidências

`git log`: `e639d53` (worker), `817c6b0` (publicar só `public/`), `9d4cfe8`/`ef36378` (ignores e notas de deploy), `86c32f4`, `ec3caf0` (reconciliação de CSP/cache-bust).
Código: `firebase.json`, `.firebaserc`, `wrangler.jsonc`, `cloudflare-worker/wrangler.toml`, `.github/workflows/*.yml`, `docs/security/hardening.md:141-179`.
