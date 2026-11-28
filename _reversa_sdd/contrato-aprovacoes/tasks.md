# Contrato de dados — Aprovações, Tarefas

> 🟢 CONFIRMADO · 🔴 LACUNA.

## Tarefas

- [ ] T-01, Implementar `requerAprovacao` nos save* — Origem: `code-analysis.md` módulo aprovacoes; Critério: 3 papéis desviados; 🟢
- [ ] T-02, Dedup de solicitação 60 s — Origem: `flowcharts/aprovacoes.md` §1; Critério: reuso de id; 🟢
- [ ] T-03, Rules de criação (tenant/plano/tipo/expiração) — Origem: `database.rules.json`; Critério: denied nos casos inválidos; 🟢
- [ ] T-04, Decisão e aplicação separadas — Origem: `ADR-005`; Critério: idempotência; 🟢
- [ ] T-05, Redaction de payload — Origem: `aprovacoes_ui.js`; Critério: campos sensíveis ocultos; 🟡

## Testes

- [ ] TT-01, desvio por papel
- [ ] TT-02, decisão concorrente
- [ ] TT-03, expiração e alertas
- [ ] TT-04 (🟢), `tarefas_pendentes` — fora do escopo por decisão P4

## Lacunas

- 🟢 GAP-04 resolvido (P4): não implementar `tarefas_pendentes`.
