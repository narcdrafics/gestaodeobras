# Job — Prazos de aprovação, Tarefas

> 🟢 CONFIRMADO.

## Tarefas

- [ ] T-01, Registrar schedule 06:00 America/Sao_Paulo — Origem: `functions/index.js:905`; Critério: config correta; 🟢
- [ ] T-02, Retomar aplicações órfãs >10 min — Origem: `functions/aprovacoes.js`; Critério: aplicação única; 🟢
- [ ] T-03, Expirar pendências — Origem: `flowcharts/aprovacoes.md` §5; Critério: status/motivo gravados; 🟢
- [ ] T-04, Alertas 7/12/15 com transação — Origem: `RN-028`; Critério: sem duplicata; 🟢
- [ ] T-05, Notificações individualizadas — Origem: `RN-034`; Critério: leitura individual pelas rules; 🟢

## Testes

- [ ] TT-01, expiração
- [ ] TT-02, alerta repetido não duplica
- [ ] TT-03, retomada de reserva órfã
- [ ] TT-04, erro isolado não aborta o job

## Lacunas

- 🟢 GAP-04 resolvido (P4): `tarefas_pendentes` removido.
