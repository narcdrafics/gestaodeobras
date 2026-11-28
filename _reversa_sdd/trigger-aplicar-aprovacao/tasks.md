# Trigger — Aplicar aprovação, Tarefas

> 🟢 CONFIRMADO · 🔴 LACUNA.

## Pré-requisitos

- [ ] `ADR-005` e `permissions.md` disponíveis.
- [ ] Job `aprovacoesPrazosJob` ativo para retomada.

## Tarefas

- [ ] T-01, Registrar trigger e filtrar transição — Origem: `functions/index.js:892`; Critério: só `→ aprovado`; 🟢
- [ ] T-02, Reserva transacional — Origem: `functions/aprovacoes.js`; Critério: dupla execução impossível; 🟢
- [ ] T-03, `podeAplicar` — Origem: `RN-030`; Critério: rebaixamento ⇒ `erro`; 🟢
- [ ] T-04, Implementar 8 efeitos puros — Origem: `functions/aprovacoes.js:167-421`; Critério: cada tipo gera updates esperados; 🟢
- [ ] T-05, `update()` multi-path com auditoria e notificações — Origem: `ADR-005`; Critério: atomicidade; 🟢
- [ ] T-06, Retomada de reserva >10 min — Origem: `flowcharts/aprovacoes.md` §5; Critério: aplicação única; 🟢

## Tarefas de Teste

- [ ] TT-01, concorrência de aplicação
- [ ] TT-02, decisor rebaixado ⇒ erro
- [ ] TT-03, cada um dos 8 efeitos
- [ ] TT-04, retomada de reserva órfã

## Lacunas Pendentes (🔴)

- 🟢 GAP-04 resolvido (P4): `tarefas_pendentes` removido — não implementar.
