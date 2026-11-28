# Contrato de dados — Infraestrutura e deploy, Tarefas

> 🟢 CONFIRMADO · 🔴 LACUNA. Cada tarefa cita o arquivo legado de origem.

## Pré-requisitos

- [ ] `ADR-001`, `ADR-007`, `ADR-010`, `ADR-014` e checklist de `hardening.md` disponíveis.
- [ ] GAP-07 reconhecido como divergência de configuração antes de alterar CORS/Wrangler/runtime.

## Tarefas

- [ ] T-01, Reproduzir 6 rewrites `/api/*` e fallback SPA — Origem: `firebase.json:11-40`; Critério: rotas e fallback respondem; 🟢
- [ ] T-02, Implementar worker de subdomínio com slug reservado e proxy — Origem: `worker.js:16,109-119`; Critério: 301 para reservados, host preservado; 🟢
- [ ] T-03, Implementar CORS por allowlist com `Vary: Origin` e preflight 204 — Origem: `worker.js:23-61`; Critério: origem não listada sem ACAO; 🟢
- [ ] T-04, Aplicar Cache-Control por extensão — Origem: `worker.js:131-136`; Critério: HTML `no-store`, assets 1 h; 🟢
- [ ] T-05, Aplicar headers CSP/COOP no Hosting — Origem: `firebase.json:46-47`; Critério: `object-src 'none'` e COOP presente; 🟢
- [ ] T-06, Implementar Express local com fallback `index.html` — Origem: `server.js:1-17`; Critério: `npm start` serve SPA; 🟢
- [ ] T-07, Configurar CI de teste e deploy somente Hosting — Origem: `test.yml`, `deploy.yml`; Critério: Node 20 nos testes, `channelId: live`; 🟢
- [ ] T-08, Documentar checklist manual de functions/rules/segredos/worker/CORS — Origem: `hardening.md:141-164`; Critério: ordem de migração `tenants_public` respeitada; 🟢
- [ ] T-09, Aplicar CORS do bucket via `cors.json` — Origem: `docs/security/cors.md:19-30`; Critério: `gcloud storage buckets update` executado; 🟡
- [ ] T-10, Declarar explicitamente divergências de configuração — Origem: `wrangler.jsonc`, `wrangler.toml`, `package.json`, `functions/package.json`; Critério: GAP-07 visível na doc; 🔴

## Tarefas de Teste

- [ ] TT-01, Rewrites e fallback SPA
- [ ] TT-02, Resolução de slug e redirecionamento de reservados
- [ ] TT-03, CORS/Vary/preflight e cache
- [ ] TT-04, Headers de segurança (CSP/COOP)
- [ ] TT-05, Pipeline de CI e deploy split

## Lacunas Pendentes (🔴/🟡)

- 🟡 GAP-07: unificar ou declarar explicitamente CORS, Wrangler e versões de Node (não bloqueante — matriz §6).
- 🔴 Documentar que `deploy.yml` não publica functions/rules — exigir checklist manual.
- 🟡 Confirmar se `.firebaserc` está versionado e se `apphosting.yaml` é usado.
- 🟡 Substituir asserções estáticas de rules por emulador funcional quando disponível.
