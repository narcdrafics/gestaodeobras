# Job — Estado de cobrança, Tarefas

> 🟢 CONFIRMADO.

## Tarefas

- [ ] T-01, Registrar schedule 04:00 America/Sao_Paulo — Origem: `functions/index.js:921`; Critério: timezone correto; 🟢
- [ ] T-02, Implementar `calcularBillingState` puro — Origem: `functions/billing.js:39-137`; Critério: todos os ramos do fluxograma §2; 🟢
- [ ] T-03, Varredura e filtro de tenants — Origem: `billing.js:145-175`; Critério: nós não-objeto ignorados; 🟢
- [ ] T-04, Gravar somente transições com `update()` único — Origem: `billing.js:159-166`; Critério: 0/N sem escrita; 🟢

## Testes

- [ ] TT-01, trial vigente/expirado/encerrado
- [ ] TT-02, carenciaAte prevalece sobre 5 dias
- [ ] TT-03, sem vencimento ⇒ ativo
- [ ] TT-04, chargeback não desbloqueado por cancelamento

## Lacunas

- 🟡 GAP-06: reconciliação `status` × `billingState` pendente.
