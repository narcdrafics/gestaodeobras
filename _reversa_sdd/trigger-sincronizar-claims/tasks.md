# Trigger — Sincronizar Claims, Tarefas

> 🟢 CONFIRMADO · 🔴 LACUNA.

## Pré-requisitos

- [ ] `permissions.md`, `ADR-002`, `ADR-006` e ADR-003 (billing) disponíveis.
- [ ] `admin_ops` com lease para operações dependentes (GAP-10).

## Tarefas

- [ ] T-01, Registrar `onValueWritten("profiles/{uid}")` — Origem: `functions/index.js:680`; Critério: escrita dispara sincronização; 🟢
- [ ] T-02, Avaliar master pelas 3 fontes — Origem: `functions/claims.js:35-71`; Critério: RN-007; 🟢
- [ ] T-03, Normalizar role e conter escalação — Origem: `functions/index.js:741-758`; Critério: RN-005; 🟢
- [ ] T-04, Aplicar limite de assentos — Origem: `functions/index.js:603-640`; Critério: RN-003; 🟢
- [ ] T-05, Propagar módulos RH e 50 obras — Origem: `functions/index.js:788-806`; Critério: RN-008; 🟢
- [ ] T-06, Publicar claims e revogar tokens — Origem: `functions/index.js:762-809`; Critério: Storage Rules aceita as claims; 🟢

## Tarefas de Teste

- [ ] TT-01, auto-promoção corrigida
- [ ] TT-02, assento excedido ⇒ pendente sem tenant
- [ ] TT-03, RH com módulos e obras específicas
- [ ] TT-04, revogação em bloqueio

## Lacunas Pendentes (🔴)

- 🔴 GAP-10: definir retry/alerta para falha de publicação.
- 🟡 GAP-09: documentar exceções legadas de master.
