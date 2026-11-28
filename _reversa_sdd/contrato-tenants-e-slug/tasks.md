# Contrato de dados — Tenants e slug, Tarefas

> 🟢 CONFIRMADO.

## Tarefas

- [ ] T-01, Normalizar/validar slug — Origem: `public/js/slug.js:14-48`; Critério: NFD e 3–30; 🟢
- [ ] T-02, Bloquear reservados e checar por chave — Origem: `slug.js`, `ADR-007`; Critério: sem orderByChild; 🟢
- [ ] T-03, Publicar `tenants_public` — Origem: `flowcharts/tenants-e-slug.md`; Critério: branding no login; 🟢
- [ ] T-04, Implementar `extractSlug`/CORS/cache do worker — Origem: `worker.js:29-142`; Critério: headers corretos; 🟢
- [ ] T-05, Registrar rewrites `/api/*` — Origem: `firebase.json:11-40`; Critério: rotas alcançáveis; 🟢

## Testes

- [ ] TT-01, slug reservado rejeitado
- [ ] TT-02, hostname como autoridade
- [ ] TT-03, CORS e cache

## Lacunas

- 🟡 GAP-07: unificar CORS/Wrangler/listas de reservados na revisão.
