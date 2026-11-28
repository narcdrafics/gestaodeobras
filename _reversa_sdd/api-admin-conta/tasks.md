# API Admin — Conta, Tarefas

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA.

## Pré-requisitos

- [ ] Segredos `KIWIFY_CLIENT_ID/SECRET/ACCOUNT_ID/API_TOKEN` provisionados (ou fallback configurado=false).
- [ ] `admin_audit` e `admin_ops` com rules restritas ao master.

## Tarefas

- [ ] T-01, Validar método/corpo/cota IP — Origem: `functions/super_admin.js:358-377`; Critério: 405/413/429 antes do Auth; 🟢
- [ ] T-02, Autorizar master pelas 3 fontes — Origem: `functions/claims.js:35-71`; Critério: allowlist/e-mail/passaporte; 🟢
- [ ] T-03, Reservar operação destrutiva por `requestId` — Origem: `functions/auditoria.js`; Critério: reenvio ⇒ `idempotente=true`; 🟢
- [ ] T-04, Implementar 6 ações — Origem: `functions/super_admin.js`; Critério: efeitos e status conforme fluxograma §3; 🟢
- [ ] T-05, Auditoria fail-closed — Origem: `functions/super_admin.js:446-468`; Critério: falha ⇒ 503 e reserva mantida; 🟢
- [ ] T-06, GET Kiwify com validação de `tipo` e parâmetros — Origem: `functions/kiwify_api.js`; Critério: `configurado=false` sem segredos; 🟢

## Tarefas de Teste

- [ ] TT-01, idempotência de ação destrutiva
- [ ] TT-02, auditoria falha ⇒ 503
- [ ] TT-03, auto-reset/auto-bloqueio rejeitados
- [ ] TT-04, definir_plano e bloquear_tenant
- [ ] TT-05, GET Kiwify tipos válidos/inválidos

## Lacunas Pendentes (🔴)

- 🔴 GAP-10: `admin_ops` sem lease curto — definir TTL e alerta antes de produção.
- 🟡 GAP-06: reconiliar `status` e `billingState` nas ações de plano.
- 🟡 GAP-09: documentar exceção `mestre`/`EMAIL_MESTRA`.
