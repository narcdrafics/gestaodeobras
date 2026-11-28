# Contrato de dados — Suprimentos e custos, Tarefas

> 🟢 CONFIRMADO · 🔴 LACUNA. Cada tarefa cita o arquivo legado de origem.

## Pré-requisitos

- [ ] `ADR-005`, `ADR-008`, `ADR-009` e `permissions.md` disponíveis.
- [ ] Features `pix.folha` e `exportacao` no catálogo com espelho front (teste de paridade).

## Tarefas

- [ ] T-01, Implementar segregação compra pública/privada e `podeVerDadosComerciais` — Origem: `compras_ui.js:1-8`, `data_core.js:716-747`; Critério: `tests/compras-segregacao.test.js` passa; 🟢
- [ ] T-02, Desviar `compra_criacao` e aplicar `efeitosCompra` — Origem: `flowcharts/compras.md` §5/§7; Critério: registro público sem sensíveis e privado com `aprovacaoId`; 🟢
- [ ] T-03, Reproduzir cadastro e movimentações de estoque com dedupe — Origem: `estoque.module.js`; Critério: saldo = entrada - saida e status correto; 🟢
- [ ] T-04, Implementar `buildFinanceEntries` e derivações de custo — Origem: `utils.module.js:454-667`; Critério: `jaPago`/`pendente` por status, desconto negativado; 🟢
- [ ] T-05, Implementar `saveOrcamento` com `parseEditIdx` e remoção de `vreal` — Origem: `app_core.js:7408-7489`; Critério: `tests/budget-fixes.test.js` passa; 🟢
- [ ] T-06, Implementar `buildMedicaoResumo` e aprovação física — Origem: `utils.module.js:298-411`; Critério: rejeitada fora do custo e do avanço; 🟢
- [ ] T-07, Gerar BRCode PIX e confirmar pagamento por origem — Origem: `pix_logic.js`, `pix_ui.js`; Critério: `tests/pix.test.js` passa e `valpago += amount`; 🟢
- [ ] T-08, Aplicar gates `pix.folha` e `requireFeature` — Origem: `plan_features.js`; Critério: sem feature abre modal de upgrade; 🟢

## Tarefas de Teste

- [ ] TT-01, segregação comercial por papel
- [ ] TT-02, estoque: entrada, saída, retorno e ajuste
- [ ] TT-03, custo consolidado com fonte mista (`fin`/`pre`/`med`/`alm`)
- [ ] TT-04, orçamento e medição derivados (sem persistência)
- [ ] TT-05, PIX individual e lote

## Lacunas Pendentes (🔴)

- 🟢 Transferência do modal unificado: decisão P11 — corrigir crédito no destino e ajuste de saldos na edição.
- 🟢 `finApplyPaid`: decisão P12 — somar ao `valpago` parcial prévio.
- 🟡 Unificar datas de payload de aprovação (`UTC` vs. `getTodayBR()`).
