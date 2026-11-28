# Contrato de dados — Infraestrutura e deploy

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Cobre `infra-e-deploy` (matriz de impacto §4). Fontes: `flowcharts/infra-e-deploy.md`, `data-dictionary.md` §113-117, `domain.md` RN-069–RN-074, `ADR-001`, `ADR-007`, `ADR-010`, `ADR-014`, `firebase.json`, `firebase.json:11-40`, `c4-containers.md` §4.

## Visão Geral

🟢 Três superfícies de entrega coexistem: Firebase Hosting + Cloud Functions (produção), Cloudflare Worker (subdomínios wildcard) e Express local (`npm start`). 🟢 O GitHub Actions publica **somente Hosting**; functions, rules, segredos e worker exigem deploy manual (`ADR-014`). 🟢 O roteamento `/api/*` depende de 6 rewrites em `firebase.json`; uma mudança de rota sem rewrite quebra a API silenciosamente.

## Responsabilidades

- 🟢 Preservar as 6 rewrites `/api/*` e o fallback SPA `/** → /index.html`.
- 🟢 Fazer proxy reverso no Cloudflare Worker com `X-Forwarded-Host` e slug por hostname.
- 🟢 Aplicar CORS por allowlist com `Vary: Origin`; preflight `OPTIONS` respondido localmente (204).
- 🟢 Aplicar CSP/COOP em `firebase.json` e CORS do bucket via `cors.json`.
- 🟢 Manter segredos no Secret Manager e deploy manual das Functions/Rules.
- 🟢 Rodar testes no CI (`test.yml`) em push/PR; `deploy.yml` publica canal `live` em push em `main`.

## Regras de Negócio

- 🟢 RN-069: em produção o hostname é autoridade — `?tenant=` é ignorado em `obrareal.com`/`*.obrareal.com`.
- 🟢 RN-070: subdomínios reservados no worker: `www`, `admin`, `api`, `mail`, `ftp` ⇒ 301 para `https://obrareal.com`.
- 🟢 RN-071: `tenants_public/<slug>` é lido por chave direta, nunca por `orderByChild` (anti-enumeração).
- 🟢 RN-072: HTML nunca é cacheado; assets estáticos são cacheados por 1 h.
- 🟢 RN-073: COOP `same-origin-allow-popups` é necessário para `signInWithPopup`.
- 🟢 RN-074: `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'` na CSP.
- 🟡 GAP-07: regras CORS duplicadas, Wrangler duplicado e Node 20/24 — sem fonte única de configuração. Reclassificado de 🔴 para 🟡 na revisão: a matriz canônica `spec-impact-matrix.md` §6 o classifica como não bloqueante.
- 🟡 `apphosting.yaml` existe, mas o fluxo ativo usa Firebase Hosting.
- 🟡 `.firebaserc` aparece no `.gitignore`, embora necessário para a CLI local.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Manter 6 rewrites `/api/*` e fallback SPA | Must | Rotas de webhook/admin respondem; demais caminhos servem `index.html` |
| RF-02 | 🟢 Resolver tenant por subdomínio no worker | Must | Slug reservado redireciona 301; demais fazem proxy com host preservado |
| RF-03 | 🟢 CORS por allowlist com `Vary: Origin` | Must | Origem não listada não recebe `Access-Control-Allow-Origin` |
| RF-04 | 🟢 Preflight local 204 | Must | `OPTIONS` não é proxyado para o Firebase |
| RF-05 | 🟢 Cache diferenciado (assets 1 h, HTML no-store) | Must | Verificar `Cache-Control` por extensão |
| RF-06 | 🟢 CSP/COOP nos headers do Hosting | Must | `object-src 'none'`; COOP `same-origin-allow-popups` |
| RF-07 | 🟢 Deploy manual de functions/rules/segredos/worker/CORS | Must | Checklist de `hardening.md:141-164` executado |
| RF-08 | 🟢 CI de teste em push/PR e deploy somente Hosting | Must | `npm test -- --run` com Node 20; `deploy.yml` channel `live` |
| RF-09 | 🟢 Migração de `tenants_public` após rules e antes de subdomínios | Must | Ordem documentada respeitada |
| RF-10 | 🔴 Não presumir configuração única de CORS/Wrangler/runtime | Must | GAP-07 marcado; doc declara divergência |
| RF-11 | 🟡 Explicitar que `FIREBASE_URL` e `projectId` são fixos | Should | Troca de projeto exige editar código + configs |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | Leitura direta de `tenants_public` por chave | `tenants-public.md:24-37` | 🟢 |
| Segurança | CORS restrito + Vary Origin | `worker.js:23-50` | 🟢 |
| Segurança | CSP rígida com CDNs explícitos | `firebase.json:46-47` | 🟢 |
| Disponibilidade | Deploy split exige verificação manual de logs | `ADR-014`, `hardening.md:158-164` | 🟢 |
| Qualidade | Emulador de rules inoperante; asserções estáticas | `hardening.md:176-179` | 🟡 |

## Critérios de Aceitação

```gherkin
Dado uma requisição para `/api/admin/conta`
Quando o Firebase Hosting recebe
Então o rewrite encaminha para a função `adminAccountApi`

Dado uma requisição com hostname `www.obrareal.com`
Quando o Cloudflare Worker a processa
Então responde 301 para `https://obrareal.com`

Dado uma origem não incluída na allowlist
Quando o worker responde
Então não há cabeçalho `Access-Control-Allow-Origin` e `Vary: Origin` está presente

Dado um merge em `main` que altera apenas funções
Quando `deploy.yml` executa
Então somente Hosting é publicado; o checklist manual de functions/rules é obrigatório
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-09 | Must | Caminho de entrega e segurança |
| RF-10 | Must | Lacuna bloqueante de configuração |
| RF-11 | Should | Portabilidade entre projetos |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `firebase.json:1-66` | rewrites, headers, hosting | 🟢 |
| `cloudflare-worker/worker.js` | `extractSlug`, `proxyToFirebase`, `applyCors` | 🟢 |
| `wrangler.jsonc`, `cloudflare-worker/wrangler.toml` | rotas do worker | 🟡 duplicado (GAP-07) |
| `server.js`, `package.json` | Express local, Node 20 | 🟢 |
| `.github/workflows/test.yml`, `deploy.yml` | CI e deploy | 🟢 |
| `cors.json`, `docs/security/cors.md` | CORS do bucket | 🟡 |
| `docs/security/hardening.md:141-179` | checklist de deploy e segredos | 🟢 |
