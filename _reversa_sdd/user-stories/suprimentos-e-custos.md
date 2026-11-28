# User Stories — Suprimentos, estoque e custos

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `flowcharts/compras.md`, `flowcharts/estoque.md`, `flowcharts/financeiro-e-pix.md`, `flowcharts/orcamento.md`, `flowcharts/medicao.md`, `ADR-008`, `ADR-011`.

## US-SC-01 — Comprar sem expor dados comerciais

**Como** encarregado, **quero** registrar compras sem ver fornecedor, chave PIX ou valores, **para** manter a segregação comercial do tenant.

```gherkin
Dado um encarregado visualizando compras
Quando a tabela é renderizada
Então `forn`, `pixkey`, `vunit`, `vtotal` e `vorc` não aparecem
E `comprasPrivadas` fica vazia para esse papel
```

🟢 Units: `contrato-suprimentos-e-custos/`, `contrato-aprovacoes/`.

## US-SC-02 — Controlar estoque por saldo derivado

**Como** almoxarife, **quero** registrar entradas e saídas, **para** saber saldo e nível de criticidade por item.

```gherkin
Dado entrada 10, saída 3 e `min=5`
Quando o estoque é renderizado
Então saldo=7 com status `BAIXO`
```

🟢 Unit: `contrato-suprimentos-e-custos/`. 🔴 Transferência do modal unificado não credita o destino.

## US-SC-03 — Acompanhar orçamento sem valores gravados

**Como** gestor, **quero** ver previsto, medido, pago e a pagar por serviço, **para** avaliar o andamento financeiro da obra.

```gherkin
Dado uma medição `Aprovada` com valor
Quando o board é montado
Então `medido` e `pago` são derivados em leitura
E nenhum desses valores é gravado em `orcamento` ou `medicao`
```

🟢 Unit: `contrato-suprimentos-e-custos/`. 🟢 `vreal` é removido no save (`ADR-008`).

## US-SC-04 — Gerar PIX para pagamento

**Como** financeiro, **quero** gerar um BRCode PIX, **para** pagar fornecedores e equipe com chave validada.

```gherkin
Dado o feature `pix.folha` habilitado
Quando gero o BRCode
Então contém GUI, chave, MCC 0000, BRL, TXID e CRC16 CCITT 0x1021
E `confirmPixPaid` soma `valpago`
```

🟢 Unit: `contrato-suprimentos-e-custos/`. 🔴 Fato: `finApplyPaid` sobrescreve parcial prévio. 🟢 Decisão P12: somar ao `valpago` existente.

## US-SC-05 — Rejeitar medição física

**Como** gestor, **quero** rejeitar uma medição, **para** que ela não conte como custo nem avanço físico.

```gherkin
Dado uma medição com status `Rejeitada`
Quando o relatório é consolidado
Então ela não entra em `realizado` nem em avanço
```

🟢 Unit: `contrato-suprimentos-e-custos/`.

## Lacunas

- 🟢 Decisões P11/P12/P16/P17 registradas: corrigir transferência/edição, somar pagamento parcial, filtrar compras por obra e usar `normEstoqueNome` como normalização canônica.
- 🟡 QR externo (`api.qrserver.com`) depende de rede com fallback textual.
