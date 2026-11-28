# Contrato de dados — Obras e tarefas, Tarefas

> 🟢 CONFIRMADO · 🔴 LACUNA.

## Tarefas

- [ ] T-01, `saveObra` com status válido — Origem: `app_core.js`; Critério: campos obrigatórios; 🟢
- [ ] T-02, `saveTarefa` com `cod` sequencial — Origem: `app_core.js`; Critério: sequência correta; 🟢
- [ ] T-03, Derivar `statusEfetivo` em leitura — Origem: `utils.module.js`, `ADR-008`; Critério: nada persistido; 🟢
- [ ] T-04, Aplicar `ObraScope` — Origem: `code-analysis.md:523`; Critério: RH filtrado; 🟢
- [ ] T-05, Tarefas via bot — Origem: `functions/index.js:318`; Critério: `TF###`; 🟢

## Testes

- [ ] TT-01, atraso derivado
- [ ] TT-02, escopo de obras
- [ ] TT-03, criação via WhatsApp

## Lacunas

- 🟢 GAP-02 (P2) e GAP-04 (P4) decididos; implementação pendente.
