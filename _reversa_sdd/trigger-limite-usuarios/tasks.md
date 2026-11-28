# Trigger — Limite de usuários, Tarefas

> 🟢 CONFIRMADO.

## Tarefas

- [ ] T-01, Registrar triggers de `usuarios` e `profiles` — Origem: `functions/index.js:648-651,680`; Critério: ambos disparam; 🟢
- [ ] T-02, Reverter crescimento acima do limite — Origem: `index.js:541-578`; Critério: quantidade final válida; 🟢
- [ ] T-03, Contar assentos ativos (exclui pendente/próprio) — Origem: `index.js:603-640`; Critério: RN-003; 🟢
- [ ] T-04, Marcar perfil pendente e publicar claim — Origem: `index.js:706-720`; Critério: claim sem tenantId; 🟢

## Testes

- [ ] TT-01, segundo usuário com limite 1 ⇒ pendente
- [ ] TT-02, lista acima do limite revertida
- [ ] TT-03, usuário legado não rebaixado

## Lacunas

- 🔴 GAP-10: retry de `syncCustomClaims`.
