# Trigger — Feature de subdomínio, Tarefas

> 🟢 CONFIRMADO.

## Tarefas

- [ ] T-01, Registrar ambos os gatilhos — Origem: `functions/index.js:677-678`; Critério: disparam; 🟢
- [ ] T-02, Permitir slug inicial — Origem: `index.js:652-678`; Critério: vazio/tenantId mantidos; 🟢
- [ ] T-03, Consultar `hasFeature('subdominio')` — Origem: `plan_features.js`; Critério: bloqueado ⇒ false; 🟢
- [ ] T-04, Reverter e limpar `tenants_public` — Origem: `index.js:652-678`; Critério: sem órfão; 🟢

## Testes

- [ ] TT-01, troca sem feature revertida
- [ ] TT-02, troca com feature mantida
- [ ] TT-03, limpeza de `tenants_public`

## Lacunas

- 🟡 GAP-07: unificar listas de reservados e config do Wrangler antes de reimplementar.
