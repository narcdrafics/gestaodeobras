# API Admin — Cargo, Tarefas

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA.

## Pré-requisitos

- [ ] `permissions.md` e ADR-002/006 disponíveis para conferir hierarquia.
- [ ] Trigger `syncCustomClaims` ativo.

## Tarefas

- [ ] T-01, Validar método/corpo/cota e autoridade — Origem: `functions/cargos.js:50-97`; Critério: 401/403/413/429; 🟢
- [ ] T-02, Resolver alvo e proibir auto-alteração — Origem: `flowcharts/usuarios-e-cargos.md` §2; Critério: 400/404; 🟢
- [ ] T-03, Normalizar papel e whitelist do chamador — Origem: `functions/cargos.js`; Critério: `mestre`⇒`encarregado`, `super_admin` só master; 🟢
- [ ] T-04, Normalizar módulos RH e escopo de obras — Origem: `functions/cargos.js`; Critério: só `role='rh'` grava; 🟢
- [ ] T-05, Espelhar profile/passaporte/convite/allowlist e revogar tokens — Origem: `flowcharts/usuarios-e-cargos.md` §2; Critério: próximo token traz claims novas; 🟢
- [ ] T-06, Implementar `remover_usuario` — Origem: `flowcharts/usuarios-e-cargos.md` §3; Critério: desativado + listas removidas + Auth disabled; 🟢
- [ ] T-07, Auditoria obrigatória — Origem: `functions/auditoria.js`; Critério: falha ⇒ 503; 🟢

## Tarefas de Teste

- [ ] TT-01, escalação de privilégio (admin ⇒ super_admin) negada
- [ ] TT-02, RH com módulos e obras específicas
- [ ] TT-03, auto-alteração e remoção do último admin
- [ ] TT-04, auditoria falha ⇒ 503

## Lacunas Pendentes (🔴)

- 🔴 GAP-10: definir retry/alerta para `syncCustomClaims`.
- 🟡 Conferir limite de obras (50 claims vs. 500 no pedido).
