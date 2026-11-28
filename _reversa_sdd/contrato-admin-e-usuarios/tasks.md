# Contrato de dados — Admin e usuários, Tarefas

> 🟢 CONFIRMADO.

## Tarefas

- [ ] T-01, Gravar convite antes da criação — Origem: `flowcharts/usuarios-e-cargos.md` §1; Critério: 409 sem convite; 🟢
- [ ] T-02, Implementar criação com senha temporária — Origem: `functions/usuarios.js`; Critério: senha fora do RTDB; 🟢
- [ ] T-03, Definir cargo com whitelist e RH — Origem: `functions/cargos.js`; Critério: escalação negada; 🟢
- [ ] T-04, Espelhar nós e revogar tokens — Origem: `flowcharts/usuarios-e-cargos.md` §2; Critério: claims atualizadas; 🟢
- [ ] T-05, Ações do Master com reserva/auditoria — Origem: `functions/super_admin.js`; Critério: 503 se auditoria falha; 🟢
- [ ] T-06, Remoção de usuário — Origem: `flowcharts/usuarios-e-cargos.md` §3; Critério: Auth disabled; 🟢

## Testes

- [ ] TT-01, escalação de privilégio
- [ ] TT-02, RH customizável
- [ ] TT-03, idempotência de ação destrutiva

## Lacunas

- 🔴 GAP-09, GAP-10.
