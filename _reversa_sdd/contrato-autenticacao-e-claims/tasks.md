# Contrato de dados — Autenticação, Tarefas

> 🟢 CONFIRMADO · 🔴 LACUNA.

## Tarefas

- [ ] T-01, Implementar `detectSubdomain` e checagem de tenant — Origem: `auth_core.js:396-439`; Critério: cross-tenant => signOut; 🟢
- [ ] T-02, Aguardar claims com 6 tentativas — Origem: `auth_core.js:411-419`; Critério: app liberada só com claims; 🟢
- [ ] T-03, Reproduzir rules de tenant/billing — Origem: `database.rules.json:30-161`; Critério: testes de security; 🟢
- [ ] T-04, Reproduzir `storage.rules` baseado em claims — Origem: `storage.rules:4-22`; Critério: leitura/escrita por papel; 🟢
- [ ] T-05, Proteger APIs com `abuso.js` + `auditoria.js` — Origem: `functions/abuso.js`, `auditoria.js`; Critério: 413/429/503; 🟢

## Testes

- [ ] TT-01, isolamento cross-tenant
- [ ] TT-02, escalação de privilégio
- [ ] TT-03, billingState bloqueado/somente_leitura

## Lacunas

- 🔴 GAP-08, GAP-09, GAP-10 — registrar antes da revisão final.
