# Dependências — obra-real (gestaodeobras)

> Gerado pelo **Scout** em 2026-11-27 · 🟢 CONFIRMADO a partir de `package.json`, `functions/package.json` e respectivos `package-lock.json`.

## 1. Pacote raiz (`package.json` — obra-real v1.4.0)

| Dependência | Declarada | Resolvida no lock | Tipo | Uso provável 🟡 |
|---|---|---|---|---|
| `express` | `^4.18.2` | `4.22.3` | runtime | Servidor estático `server.js` |
| `firebase` | `^13.4.0` | `13.4.0` | runtime | SDK do navegador (Auth, RTDB, Storage) |
| `vitest` | `^4.1.2` | `4.1.12` | dev | Suíte de 40 testes |
| `jsdom` | `^29.0.1` | `29.0.1` | dev | Ambiente DOM nos testes |

**Runtime declarado:** Node `20` (`engines`). **Privado:** `true`.
**Scripts:** `build` (`echo 'Static assets ready.'`), `start` (`node server.js`), `test` (`vitest`).

## 2. Pacote de Cloud Functions (`functions/package.json` — obra-real-webhook v1.0.0)

| Dependência | Declarada | Resolvida no lock | Tipo | Uso confirmado 🟢/🟡 |
|---|---|---|---|---|
| `firebase-functions` | `^7.4.0` | `7.4.0` | runtime | `onRequest`, `onSchedule`, `onValueWritten` (`functions/index.js`) 🟢 |
| `firebase-admin` | `^14.5.1` | `14.5.1` | runtime | Auth Admin SDK + RTDB Admin (`getAuth`, `getDatabase`) 🟢 |
| `axios` | `^1.15.2` | `1.21.1` | runtime | Chamadas à Meta API, Kiwify e download de áudio 🟢 |
| `openai` | `^4.104.0` | `4.104.0` | runtime | `gpt-4o-mini` (extração JSON) e `whisper-1` (transcrição) 🟢 |

**Runtime declarado:** Node `24` (`engines`). **Privado:** `true`.
**Scripts:** `serve` (emulador), `shell`, `deploy` (`firebase deploy --only functions`), `logs`.

> 🟡 Atenção: há divergência de versão de Node entre raiz (20) e `functions/` (24). O workflow de testes usa Node 20; o deploy de functions usa o runtime configurado no Firebase.

## 3. Serviços e plataformas (fora do npm) 🟢

| Serviço | Evidência | Papel |
|---|---|---|
| Firebase Hosting | `firebase.json`, `.firebaserc` | Sites estáticos + rewrites `/api/*` |
| Firebase Realtime Database | `database.rules.json`, `getDatabase()` | Persistência multi-tenant |
| Firebase Auth | `auth_core.js`, `getAuth()` | Identidade e custom claims |
| Firebase Cloud Storage | `storage.rules` | Imagens/PDFs por tenant |
| Firebase Cloud Functions | `functions/`, `firebase.json` | Webhooks, jobs agendados, triggers |
| Cloudflare Workers | `wrangler.jsonc`, `cloudflare-worker/worker.js` | Proxy wildcard e CORS por subdomínio |
| GitHub Actions | `.github/workflows/{test,deploy}.yml` | CI e deploy |
| Firebase App Hosting | `apphosting.yaml` | Config de runtime (1 CPU / 512 MiB) |

## 4. Integrações externas e segredos 🟢

| Integração | Segredos / configuração | Onde |
|---|---|---|
| Meta WhatsApp Cloud API | `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_WABA_ID` | `functions/index.js`, `whatsapp_auth.js` |
| OpenAI | `OPENAI_KEY` | `functions/index.js` (Whisper + GPT) |
| Kiwify (cobrança) | `KIWIFY_TOKEN`, `KIWIFY_CLIENT_ID`, `KIWIFY_CLIENT_SECRET`, `KIWIFY_ACCOUNT_ID`, `KIWIFY_API_TOKEN` | `functions/kiwify.js`, `kiwify_api.js`, `billing.js` |
| CSP / domínios | `firebase.json` (headers), `cors.json`, `cloudflare-worker/worker.js` (allowlist) | Hosting + Worker |

🟢 Segredos declarados via `defineSecret()` em `functions/index.js` (não há `.env.example` no repositório).

## 5. Gerenciadores e instalação 🟢

- **npm**, com `package-lock.json` na raiz e em `functions/` (dois projetos independentes).
- `npm install` (raiz) e `npm install --prefix functions` para o backend.
- Sem Yarn/pnpm, sem workspaces, sem monorepo tool.
