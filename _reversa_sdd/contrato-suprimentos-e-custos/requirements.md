# Contrato de dados — Suprimentos e custos

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Cobre `compras`, `estoque`, `financeiro-e-pix`, `orcamento` e `medicao` (matriz de impacto §4). Fontes: `flowcharts/compras.md`, `flowcharts/estoque.md`, `flowcharts/financeiro-e-pix.md`, `flowcharts/orcamento.md`, `flowcharts/medicao.md`, `data-dictionary.md` §25/§52-74, `domain.md` RN-040–RN-048, `ADR-008`, `ADR-009`, `ADR-011`.

## Visão Geral

🟢 Cadeia completa de custo da obra: compra (com segregação comercial) → estoque (saldo derivado de entradas/saídas) → orçamento (previsto) → medição (realizado físico) → financeiro (pagamentos e PIX). Nenhum valor de "medido", "pago" ou "a pagar" é gravado nessas entidades: tudo é derivado em leitura de `buildFinanceEntries` e `buildOrcamentoBoard`.

## Responsabilidades

- 🟢 Separar dados comerciais sensíveis em `comprasPrivadas/<tid>/<id>` e manter `compras[]` público sem esses campos.
- 🟢 Calcular saldo de estoque por `entrada - saida` e status (`SEM ESTOQUE`, `CRITICO`, `BAIXO`, `NORMAL`).
- 🟢 Converter medição física em custo financeiro, exceto quando rejeitada.
- 🟢 Consolidar `financeiro`, `presenca`, `medicao` e `almocos` em uma única fonte de lançamentos com `source`.
- 🟢 Gerar BRCode PIX com feature gate `pix.folha` e atualizar `valpago` por tipo de origem.
- 🟢 Manter orçamento com `id` estável para vincular medições.

## Regras de Negócio

- 🟢 RN-040: dados comerciais (`forn`, `pixkey`, `vunit`, `vtotal`, `vorc`, `prazo`) ficam só em `comprasPrivadas`; engenheiro/encarregado/mestre não leem nem escrevem.
- 🟢 RN-041: saldo = `entrada - saida`; status por `min` (`<=0` sem estoque, `<=min` crítico, `<=1,5*min` baixo).
- 🟢 RN-042: medição rejeitada não conta como custo nem como avanço físico.
- 🟢 RN-043: desconto é valor negativo com `pendente = 0` (`utils.module.js:509`).
- 🟢 RN-044: `orcamento.vreal` é removido no save; previsto, medido e pago são derivados (`ADR-008`).
- 🟢 RN-045: `pix.folha` protege PIX individual e lote; BRCode contém GUI, chave, MCC 0000, BRL, TXID e CRC16 CCITT 0x1021.
- 🟢 RN-046: `parseEditIdx` trata `0` como edição válida (bug histórico corrigido).
- 🟢 Decisão P11: corrigir transferência e edição para manter saldos consistentes antes da reimplementação. 🟢 Fato confirmado: hoje o destino não é creditado.
- 🟢 Decisão P12: `finApplyPaid` deve somar ao `valpago` existente, como `confirmPixPaid`. 🟢 Fato confirmado: hoje sobrescreve.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Segregar compra pública/privada | Must | Papel restrito não recebe `forn`/`pixkey`/`vunit`/`vtotal`/`vorc`/`prazo` |
| RF-02 | 🟢 Desviar criação de compra por papel | Must | `encarregado`/`engenheiro`/`rh` geram `compra_criacao`; edição comercial bloqueada |
| RF-03 | 🟢 Cadastrar item de estoque com dedupe por obra+nome normalizado | Must | Mesmo nome na mesma obra é rejeitado; uso de movimentação para ajustar |
| RF-04 | 🟢 Aplicar movimentação de estoque (entrada, saída, retorno, transferência, ajuste) | Must | Saldo e `movEstoque` coerentes; validação de quantidade e motivo |
| RF-05 | 🟢 Consolidar custos com `source ∈ {fin, pre, med, alm}` | Must | `buildFinanceEntries` produz `valor`, `jaPago` e `pendente` por regra |
| RF-06 | 🟢 Derivar orçamento e avanço físico em leitura | Must | Nenhuma gravação de `medido`/`pago`/`pct` no `orcamento`/`medicao` |
| RF-07 | 🟢 Aprovar medição fisicamente (`Aprovada`/`Rejeitada`/`Pendente`) | Must | Rejeitada some do custo e do avanço; pagamento não altera avanço |
| RF-08 | 🟢 Gerar BRCode e marcar pagamento por origem | Must | CRC16 válido; `valpago += amount` em `pre`/`med`/`fin`/`alm` |
| RF-09 | 🟢 Proteger PIX e exportação com `requireFeature` | Must | Sem `pix.folha`/`exportacao`, ação aborta com modal de upgrade |
| RF-10 | 🟢 Corrigir transferência/edição e manter saldo consistente | Must | Decisão P11; hoje a transferência não credita o destino |
| RF-11 | 🟢 Somar pagamento parcial em `finApplyPaid` | Should | Decisão P12: `valpago += amount`, como em `confirmPixPaid` |
| RF-12 | 🟢 Aplicar `acessoObras`/filtro de obra em compras | Must | Decisão P16: listagem restrita ao escopo, como as demais entidades |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | Redaction de dados comerciais no DB, cache e UI | `compras_ui.js:1-8`, `data_core.js:716-747,790` | 🟢 |
| Segurança | Rules separadas para `compras` e `comprasPrivadas` | `database.rules.json:126-127,172-175` | 🟢 |
| Fuso | `getTodayBR()` para data de registro direto | `estoque.module.js`, `ADR-009` | 🟢 |
| Confiabilidade | QR externo (`api.qrserver.com`) com fallback textual | `pix_ui.js` | 🟡 |

## Critérios de Aceitação

```gherkin
Dado um encarregado visualizando compras do tenant
Quando a tabela é renderizada
Então colunas comerciais não aparecem e `window.COMPRAS_PRIVADAS` está vazio

Dado um item com entrada 10 e saída 3 e min 5
Quando o estoque é renderizado
Então saldo=7, status=BAIXO e cor laranja

Dado uma medição Rejeitada com vtotal 1000
Quando o financeiro é consolidado
Então ela não entra em `realizado` nem em avanço físico

Dado um lançamento Parcial com valpago 200 e pagamento adicional de 300 via PIX
Quando `confirmPixPaid` é executado
Então valpago passa a 500
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-09 | Must | Caminho crítico de custo e segregação comercial |
| RF-10…RF-12 | Must | Decisões P11/P12/P16 registradas; implementação pendente |
| Exportação de imagem/backup | Should | Gateado por feature, não bloqueia o núcleo |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `public/js/compras_ui.js` | `podeVerDadosComerciais`, `saveCompra`, `dadoComercial`, `sanitizeComprasForRole` | 🟢 |
| `public/js/estoque.module.js` | `confirmarEntrada`, `confirmarMovimentacao`, `buscarItemNoCanteiro` | 🟢 |
| `public/js/utils.module.js` | `buildFinanceEntries`, `calcSaldo`, `buildOrcamentoBoard`, `buildMedicaoResumo` | 🟢 |
| `public/js/pix_logic.js`, `pix_ui.js` | `generatePixPayload`, `crc16`, `cleanPixKey`, `confirmPixPaid` | 🟢 |
| `functions/aprovacoes.js` | `efeitosCompra`, `efeitosMovimentacao`, `efeitosFinanceiro`, `efeitosOrcamento`, `efeitosMedicao` | 🟢 |
| `database.rules.json:101-127,172-175` | rules de estoque/compras | 🟢 |
| `tests/compras-segregacao.test.js`, `tests/pix.test.js`, `tests/budget-fixes.test.js`, `tests/medicao.test.js` | — | 🟢 |
