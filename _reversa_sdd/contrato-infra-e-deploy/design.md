# Contrato de dados — Infraestrutura e deploy, Design

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `flowcharts/infra-e-deploy.md`, `ADR-014`, `c4-containers.md` §4.

## Estrutura de configuração

| Artefato | Conteúdo | Confiança |
|----------|----------|-----------|
| `firebase.json` | 6 rewrites `/api/*`, fallback SPA, headers CSP/COOP | 🟢 |
| `.firebaserc` | projeto fixo `controle-obras-c889d` | 🟢 (presença no `.gitignore` é 🟡) |
| `cloudflare-worker/wrangler.toml` + `wrangler.jsonc` | `name`, `main`, `compatibility_date`, rotas `obrareal.com/*` e `*.obrareal.com/*` | 🟡 duplicado |
| `cloudflare-worker/worker.js` | `extractSlug`, `proxyToFirebase`, `applyCors`, allowlist, cache | 🟢 |
| `cors.json` | origens `*.obrareal.com`, `web.app`, `firebaseapp.com`; GET/HEAD/POST; 3600 s | 🟢 |
| `server.js` | Express local: `public/` + fallback `index.html` | 🟢 |
| `.github/workflows/test.yml` | Node 20, `npm install`, `npm test -- --run` | 🟢 |
| `.github/workflows/deploy.yml` | push em `main`, service account, `channelId: live` — somente Hosting | 🟢 |
| `apphosting.yaml` | 1 CPU / 512 MiB — não usado no fluxo ativo | 🟡 |

## Rotas `/api/*` (rewrites)

| Caminho | Função | Confiança |
|---------|--------|-----------|
| `/api/kiwify` | `kiwifyWebhook` | 🟢 |
| `/api/whatsapp` | `whatsappWebhook` | 🟢 |
| `/api/admin/criar-usuario` | `criarUsuarioTenant` | 🟢 |
| `/api/admin/conta` | `adminAccountApi` | 🟢 |
| `/api/admin/cargo` | `gerenciarCargo` | 🟢 |
| `/api/admin/aprovacao` | `decidirAprovacaoApi` | 🟢 |

## Fluxos principais

1. 🟢 **Produção:** navegador → Firebase Hosting → rewrites → Functions; fallback SPA para demais paths.
2. 🟢 **Subdomínio:** Cloudflare Worker → `extractSlug` → slug reservado (301) ou proxy com `X-Forwarded-Host` → Hosting.
3. 🟢 **CORS:** `OPTIONS` respondido 204 localmente; demais respostas removem ACAO do Firebase e reaplicam allowlist com `Vary: Origin`.
4. 🟢 **Deploy:** segredos via `firebase functions:secrets:set`; `firebase deploy --only functions:...,database:rules,hosting`; `wrangler deploy`; `gcloud storage buckets update --cors-file=cors.json`; migração de `tenants_public`.
5. 🟢 **CI:** `test.yml` em push/PR; `deploy.yml` somente em `main`.

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Deploy split (Hosting automático, back manual) | `ADR-014`, `deploy.yml` | 🟢 |
| Slug resolvido por hostname em produção | `worker.js`, `data_core.js:269-294` | 🟢 |
| `tenants_public` sem enumeração | `ADR-007` | 🟢 |
| CSP/COOP no Hosting | `ADR-010`, `firebase.json:46-47` | 🟢 |
| CORS do worker e do bucket atualizados em conjunto | `docs/security/cors.md` | 🟡 |

## Estado Interno

🟢 Cache-Control por extensão: `js|css|png|jpg|svg|ico|woff` ⇒ 1 h; demais ⇒ `no-cache, no-store, must-revalidate`. 🟢 Slugs reservados no worker: `www`, `admin`, `api`, `mail`, `ftp`. 🟡 Lista reservada do app (`slug.js:21-29`) é maior (~35) — divergência documentada.

## Observabilidade

🟢 `firebase functions:log`, verificação de token da Meta e do job de retenção/auditoria. 🟡 Sem alerta automatizado no CI para falhas de auditoria/rules; emulador de rules inoperante.

## Riscos e Lacunas

- 🟡 GAP-07: CORS duplicado (`cors.json` × `ALLOWED_ORIGINS`), Wrangler duplicado, Node 20 (raiz) × 24 (functions) — sem fonte única. Reclassificado de 🔴 para 🟡 na revisão (matriz §6).
- 🔴 `deploy.yml` publica somente Hosting: risco de front novo com back antigo.
- 🟡 `FIREBASE_URL` fixo no worker e `projectId` fixo no workflow.
- 🟡 `.firebaserc` no `.gitignore` pode impedir CLI local.
- 🟡 `apphosting.yaml` sem uso confirmado.
- 🟡 Emulador de rules inoperante; testes são asserções estáticas.
