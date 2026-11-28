# Trigger — Limite de obras, Tarefas

> 🟢 CONFIRMADO.

## Tarefas

- [ ] T-01, Registrar `onValueWritten("tenants/{tid}/obras")` — Origem: `functions/index.js:644`; Critério: dispara; 🟢
- [ ] T-02, Comparar quantidades antes/depois — Origem: `index.js:541-578`; Critério: edição permitida; 🟢
- [ ] T-03, Normalizar limite com fallback 1 e trava 9999 — Origem: `index.js:548-554`; Critério: valores corretos; 🟢
- [ ] T-04, Reverter por transação preservando legado — Origem: `index.js:568-578`; Critério: sem obra órfã; 🟢

## Testes

- [ ] TT-01, terceira obra com limite 2 ⇒ reversão
- [ ] TT-02, edição e remoção permitidas
- [ ] TT-03, sem config ⇒ limite 1

## Lacunas

- 🟡 Avaliar trigger equivalente para `trabalhadores` (limite do catálogo hoje não aplicado).
