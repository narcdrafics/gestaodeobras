# API Admin — Decisão de aprovação, Tarefas

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA.

## Pré-requisitos

- [ ] `permissions.md` e ADR-005 disponíveis.
- [ ] Trigger `aplicarAprovacao` ativo e job de prazos configurado.

## Tarefas

- [ ] T-01, Verificar token/conta/cotas — Origem: `functions/aprovacoes-api.js`; Critério: 401/403/429; 🟢
- [ ] T-02, Calcular papel efetivo (maior entre claim e perfil) — Origem: `aprovacoes-api.js:47,58`; Critério: RN-009; 🟢
- [ ] T-03, Validar corpo e estado da aprovação — Origem: `flowcharts/aprovacoes.md` §2; Critério: 400/404/409; 🟢
- [ ] T-04, Implementar `papelPodeDecidir` por tipo/módulo — Origem: `aprovacoes-api.js`; Critério: RN-032; 🟢
- [ ] T-05, Decisão por transação — Origem: `ADR-005`; Critério: concorrência ⇒ 409; 🟢
- [ ] T-06, Auditoria e resposta — Origem: `functions/auditoria.js`; Critério: `admin_audit` com decisão/papel; 🟢
- [ ] T-07, Trigger de aplicação com `construirEfeitos` puro e reserva — Origem: `functions/aprovacoes.js:167-421,523-650`; Critério: falha ⇒ `erro` + notificação; 🟢
- [ ] T-08, Redaction de payload para papéis restritos — Origem: `public/js/aprovacoes_ui.js`; Critério: campos sensíveis ocultos; 🟡

## Tarefas de Teste

- [ ] TT-01, decisão concorrente (409)
- [ ] TT-02, RH sem módulo da aprovação (403)
- [ ] TT-03, engenheiro em estoque com aviso ao admin
- [ ] TT-04, falha de aplicação e retomada pelo job

## Lacunas Pendentes (🔴)

- 🟢 GAP-04 resolvido (P4): `tarefas_pendentes` removido — não implementar.
- 🔴 Não gerar spec de comportamento novo para os 8 efeitos além do legado confirmado.
