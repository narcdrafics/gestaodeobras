# Job — Retenção de segurança, Tarefas

> 🟢 CONFIRMADO.

## Tarefas

- [ ] T-01, Registrar schedule 03:30 America/Sao_Paulo — Origem: `functions/index.js:913`; Critério: config correta; 🟢
- [ ] T-02, Implementar 4 políticas isoladas — Origem: `functions/retencao.js:11-16,54-65`; Critério: janelas respeitadas; 🟢
- [ ] T-03, Resumo por nó com erros isolados — Origem: `retencao.js`; Critério: uma falha não aborta; 🟢

## Testes

- [ ] TT-01, auditoria 90 dias
- [ ] TT-02, dedup/reservas 24 h
- [ ] TT-03, cotas 2 h

## Lacunas

- 🔴 GAP-10: definir lease curto para `admin_ops` além da retenção.
