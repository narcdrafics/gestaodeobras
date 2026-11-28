# Contrato de dados — Suprimentos e custos, Design

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `flowcharts/*.md` dos 5 módulos, `ADR-008`, `ADR-009`, `ADR-011`.

## Estrutura de dados

| Nó | Campos | Confiança |
|----|--------|-----------|
| `tenants/<tid>/compras/<id>` | `num`, `data`, `obra`, `etapa`, `mat`, `qtd`, `unid`, `status`, `receb`, `conf`, `obs` | 🟢 |
| `comprasPrivadas/<tid>/<id>` | `forn`, `pixkey`, `vunit`, `vtotal`, `vorc`, `prazo`, `compraId`, `criadoEm` | 🟢 |
| `tenants/<tid>/estoque/<id>` | `cod`, `mat`, `unid`, `obra`, `min`, `entrada`, `saida`, `custo`, `obs` | 🟢 |
| `tenants/<tid>/movEstoque/<id>` | `tipo`, `itemCod`, `qtd`, `obra`, `motivo`, `data`, `obs` | 🟢 |
| `tenants/<tid>/orcamento/<id>` | `id`, `obra`, `etapa`, `subEtapa`, `empreiteiro`, `frente`, `equipe`, `tipo`, `desc`, `qtd`, `unid`, `vunit`, `vtotal`, `obs` | 🟢 |
| `tenants/<tid>/medicao/<id>` | `serviceId`, `orcKey`, `obra`, `etapa`, `semana`, `qant`, `qreal`, `vunit`, `vtotal`, `aprovacao`, `aprovadoPor/Em`, `pgtoStatus`, `valpago`, `photos` | 🟢 |
| `tenants/<tid>/financeiro/<id>` | `data`, `obra`, `etapa`, `tipo`, `desc`, `forn`, `prev`, `real`, `pgto`, `status`, `valpago`, `nf`, `obs`, `pixkey` | 🟢 |

## Derivações (ADR-008 — nunca persistidas)

| Valor | Fórmula / origem | Confiança |
|-------|------------------|-----------|
| `saldo` estoque | `entrada - saida` | 🟢 |
| `estoqueStatus` | `<=0` SEM ESTOQUE · `<=min` CRITICO · `<=min*1,5` BAIXO · senão NORMAL | 🟢 |
| `valor` financeiro | `real > 0 ? real : prev`; desconto ⇒ negativo e `pendente = 0` | 🟢 |
| `jaPago` | `Pago` = valor · `Parcial` = `min(valpago, valor)` · demais = 0 | 🟢 |
| `pendente` | `max(0, valor - jaPago)` | 🟢 |
| `orcamentoBoard` | `buildOrcamentoBoard` cruza orçamento + `buildMedicaoResumo` + `buildFinanceEntries` | 🟢 |
| `fisico` | `soma(min(100, max(0, pct)) * peso / pesoTotal)`; sem peso ⇒ `null` | 🟢 |

## Fluxos principais

1. 🟢 **Compra:** `saveCompra` monta 17 campos; se requer aprovação, desestrutura sensíveis e desvia `compra_criacao`. Trigger `efeitosCompra` valida `mat`/`qtd > 0`, grava registro público e `comprasPrivadas` com `aprovacaoId`.
2. 🟢 **Estoque:** `saveEstoque` dedupe por `obra + normEstoqueNome` (decisão P17: normalização canônica); entradas/movimentações atualizam `entrada`/`saida` e gravam `movEstoque`.
3. 🟢 **Orçamento:** `saveOrcamento` preserva `id`, remove `vreal` e desvia `orcamento_fechamento` quando exige aprovação; `parseEditIdx` trata `0`.
4. 🟢 **Medição:** `saveMedicao` desvia `medicao_fechamento` quando `vtotal > 0`; `buildMedicaoResumo` consolida histórico não rejeitado.
5. 🟢 **Financeiro/PIX:** `summarizeFinanceCosts` → `buildFinanceEntries` → `finApplyPaid` ou `initiatePixPayment` → `confirmPixPaid`.

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Dados comerciais em nó separado com rules próprias | `compras.md` §1/§8 | 🟢 |
| Valores derivados, nunca gravados | `orcamento.md` §1; `ADR-008` | 🟢 |
| Aprovação como porta de efeitos sensíveis | `ADR-005` | 🟢 |
| Data de negócio em `America/Sao_Paulo` | `ADR-009` | 🟢 |
| BRCode gerado no cliente, sem chave privada no servidor | `pix_logic.js` | 🟡 |

## Estado Interno

🟢 `aprovacao.status` controla efeitos de compra/estoque/orçamento/medição/financeiro. 🟢 `pgtoStatus ∈ {Pago, Parcial, Pendente, Atrasado}` é gravado nas entidades de origem; `pago`/`aPagar` são derivados. 🟡 `comprasPrivadas` usa `compra.id || compra.num` como chave — isso pode divergir em registros legados.

## Observabilidade

🟢 Testes cobrem segregação, PIX, orçamento e medição. 🟡 Sem log central de movimentações de estoque além do próprio `movEstoque`.

## Riscos e Lacunas

- 🟢 Decisão P11: corrigir crédito no destino e ajuste de saldos na edição (código hoje inconsistente).
- 🟢 Decisão P12: `finApplyPaid` soma ao `valpago` existente (hoje sobrescreve).
- 🟡 Payload de aprovação de estoque usa data UTC (`new Date().toISOString()`) enquanto registro direto usa `getTodayBR()`.
- 🟡 `importarBackup` substitui todo o `DB` sem validação referencial além de `ensureSchema`.
- 🟢 Decisão P14 (ver `contrato-relatorios-e-fotos/`): omitir categorias financeiras para papéis sem módulo.
