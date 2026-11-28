# Contrato de dados — Pessoal e presença, Tarefas

> 🟢 CONFIRMADO.

## Tarefas

- [ ] T-01, `saveTrabalhador` — Origem: `app_core.js`; Critério: vínculo/status válidos; 🟢
- [ ] T-02, `savePresenca` com transação — Origem: `app_core.js`, `functions/index.js:378-394`; Critério: sem duplicata data+trab; 🟢
- [ ] T-03, Cálculo de diária/hora extra — Origem: `utils.module.js`; Critério: RN-037; 🟢
- [ ] T-04, Recálculo retroativo — Origem: `code-analysis.md:541`; Critério: só não pagas; 🟢
- [ ] T-05, `saveAlmoco` e vale devido — Origem: `app_core.js`; Critério: RN-045; 🟢
- [ ] T-06, Saldo de folha derivado — Origem: `RN-039`; Critério: `source='pre'`; 🟢

## Testes

- [ ] TT-01, meio período com hora extra
- [ ] TT-02, recálculo retroativo
- [ ] TT-03, semana começando na segunda

## Lacunas

- 🟢 GAP-03 resolvido (P3): ajustar leitura do `dailyReport` para `presenca`.
