# Fluxograma — Módulo `financeiro-e-pix`

> 🟢 CONFIRMADO — `public/pages/financeiro.html`, `public/modals/modal-financeiro.html`, `public/modals/modal-pix-view.html`, `public/js/app_core.js` (2426–2484, 2485–3184, 6766–6835, 7300–7406), `public/js/utils.module.js` (116–131, 454–667), `public/js/pix_logic.js`, `public/js/pix_ui.js`, `functions/aprovacoes.js` (efeitos financeiros), `database.rules.json:120-121`, `tests/pix.test.js`, `tests/aprovacoes.test.js`, `tests/plan-features.test.js`.

## 1. Fonte única de lançamentos

```mermaid
flowchart TD
    A[summarizeFinanceCosts fin, pres, med, alm, options] --> B[buildFinanceEntries]
    B --> C[buildFinanceDateFilter options]
    C --> C1{dataInicio/dataFim?}
    C1 -- sim --> C2[intervalo explicito]
    C1 -- nao --> C3{ano + mes?}
    C3 -- sim --> C4[primeiro ao ultimo dia do mes]
    C3 -- nao --> C5{tipo?}
    C5 -- sim --> C6[getPeriodoOptions]
    C5 -- nao --> C7[sem filtro]
    B --> D[fin manual: valor = realizado > 0 ? realizado : previsto]
    D --> E{tipo contem desconto?} -- sim --> F[valor negativo, pendente = 0]
    B --> G[presenca: getPresencaCusto por diaria/horas]
    B --> H[medicao: vtotal, exceto aprovacao Rejeitada]
    B --> I[almocos: vtotal]
    G & H & I --> J[status normalizado: Pago/Parcial/Pendente/Atrasado]
    J --> K[jaPago: Pago=valor, Parcial=valpago limitado, demais=0]
    K --> L[pendente = max 0, valor - jaPago]
    L --> M[entrada normalizada com source fin/pre/med/alm + idx]
    M --> N[agregacoes: totalsByObra, totalsByPeriod,<br/>byCategory, kpis total/pago/aPagar/count]
```

🔴 Descontos são negativados no valor, mas `pendente` é forçado a `0` (`utils.module.js:509`). 🟢 Medição rejeitada não entra como custo.

## 2. Período e renderização

```mermaid
flowchart TD
    A[renderFinanceiro] --> B{selects mes/ano/view presentes?} -- nao --> Z[aborta]
    B -- sim --> C{ano sem options?}
    C -- sim --> D[popula ano atual e anteriores;<br/>mes e ano = atuais]
    C -- nao --> E[le mes, ano, view]
    D --> E
    E --> F{view = custom com ini e fim?}
    F -- sim --> G[options dataInicio/dataFim viewType semanal<br/>label ini a fim]
    F -- nao --> H[options ano/mes viewType semanal<br/>label Mes/Ano]
    G & H --> I[summarizeFinanceCosts DB.financeiro, presenca,<br/>medicao, almocos]
    I --> J[window._finSummary e _allFinRows]
    J --> K[remove selecoes que nao existem mais]
    K --> L[renderFinKpis + renderFinTabs + renderFinBulkBar + renderFinTable]
    M[toggleFinCustomDates] --> N{view custom?}
    N -- sim --> O[mostra datas, esconde mes/ano;<br/>default ultimos 30 dias ate hoje]
    N -- nao --> P[esconde datas, mostra mes/ano]
    Q[applyFinCustomPeriod] --> R{ini/fim preenchidos e ini <= fim?} -- nao --> S[toast + return]
    R -- sim --> T[renderFinanceiro]
```

🟡 `toggleFinCustomDates` e os defaults de data usam `new Date()`/ISO (UTC), não `getTodayBR()`.

## 3. KPIs, abas e tabela

```mermaid
flowchart TD
    A[renderFinKpis] --> B[card Total ou Total do periodo + Pago + A pagar]
    B --> C[um card por FIN_MAIN_CATEGORIES<br/>mao-de-obra, empreiteiro, almoco, material]
    C --> D[card Outros se houver]
    D --> E[clique alterna finState.categoria/status<br/>ou limpa filtros]
    F[renderFinTabs] --> G[Todos + categorias + Outros<br/>com contagem]
    H[renderFinTable] --> I[filtra categoria, status e busca textual]
    I --> J[ordena data desc, source, idx]
    J --> K[finBuildUnits agrupa por tipo ou obra]
    K --> L{tipo}
    L -- grupo --> M[finGroupHeaderHtml<br/>label, contagem, total e a pagar]
    L -- mao-de-obra de presenca --> N[finLaborGroupHtml<br/>agrupa benef + semana, expansivel]
    L -- linha --> O[finEntryRow com checkbox, badge, valor,<br/>status e menu de acoes]
    M & N & O --> P[paginacao finState.pageSize<br/>25/50/100/todas]
    P --> Q[rodape Total do filtrado + A pagar]
    Q --> R{nenhuma linha?} -- sim --> S[mensagem Nenhum lancamento encontrado]
```

`finStatusMatches`: `pago` → `status === 'Pago'`; `a-pagar` → não pago e `pendente > 0`; `parcial`/`atrasado` → status igual. `finBuscaMatches` varre data formatada/crua, obra (código e nome), tipo, descrição, beneficiário, etapa, NF, pagamento e observações.

## 4. Seleção e baixas

```mermaid
flowchart TD
    A[checkbox linha/grupo] --> B[finState.selected add/delete finKey source:idx]
    B --> C[renderFinBulkBar]
    C --> D{selecionados?} -- nao --> E[barra oculta]
    D -- sim --> F[total e a pagar; botoes<br/>Marcar como pago / Pagar por PIX / Limpar]
    G[finApplyPaid entry] --> H{status Pago ou pendente <= 0?} -- sim --> I[nao altera]
    H -- nao --> J{source}
    J -- fin --> K[DB.financeiro idx: status Pago,<br/>valpago = entry.valor]
    J -- pre --> L[DB.presenca idx: pgtoStatus Pago,<br/>valpago = entry.valor]
    J -- med --> M[DB.medicao idx: pgtoStatus Pago,<br/>valpago = entry.valor]
    J -- alm --> N[DB.almocos idx: pgtoStatus Pago,<br/>valpago = entry.valor]
    K & L & M & N --> O[finAfterPayment: limpa selecao,<br/>persistDB, renderFinanceiro e Dashboard]
    P[deleteFinEntry source, idx] --> Q[mapeia para financeiro/presenca/medicao/almocos<br/>e chama deleteItem]
```

🔴 Fato: `finApplyPaid` grava `valpago = entry.valor` (valor total), ignorando parciais prévios. 🟢 Decisão P12: somar ao `valpago` existente, como `confirmPixPaid`.

## 5. Lançamento manual e desvio

```mermaid
flowchart TD
    A[openModal modal-financeiro] --> B[fn-data = today; fn-status = Pendente]
    C[saveFinanceiro] --> D{elementos presentes?} -- nao --> E[toast erro + return]
    D -- sim --> F[prev, real, status; calcFinDiff]
    F --> G{status}
    G -- Pago --> H[valpago = real > 0 ? real : prev]
    G -- Pendente/Atrasado --> I[valpago = 0]
    G -- Parcial --> J[valpago informado]
    H & I & J --> K[monta registro com data/obra/etapa/tipo/<br/>desc/forn/prev/real/pgto/status/valpago/nf/obs]
    K --> L{desviarParaAprovacao disponivel?}
    L -- sim --> M{editando e status mudou?}
    M -- sim --> N[desvio financeiro_status<br/>indice, status, valpago]
    M -- nao --> O[remove forn do payload; desvio<br/>financeiro_lancamento com indice opcional]
    N & O --> P{desviado?} -- sim --> Q[closeModal + return]
    L -- nao --> R{editIdx >= 0?}
    P -- nao --> R
    R -- sim --> S[DB.financeiro editIdx = data]
    R -- nao --> T[DB.financeiro.push data]
    S & T --> U{status Parcial?} -- sim --> V[toast Falta Pagar ou Totalmente quitado]
    U -- nao --> W[toast salvo/atualizado]
    V & W --> X[closeModal + await persistDB + renderFinanceiro + Dashboard]
```

🟢 `forn` (beneficiário) é removido do payload de aprovação — dado comercial não vai para a solicitação. 🟢 Engenheiro/RH/encarregado enviam para decisão; admin/comprador gravam direto.

## 6. PIX

```mermaid
flowchart TD
    A[initiatePixPayment source, idx, opts] --> B{requireFeature pix.folha?} -- nao --> Z[aborta]
    B -- sim --> C{source}
    C -- pre --> D[chave e tipo de DB.trabalhadores;<br/>valor = custo - pago parcial]
    C -- lote --> E[item de window.lotePendentes]
    C -- med --> F[equipe, sem chave; descricao MEDICAO servico]
    C -- fin --> G[forn, chave f.pixkey ou do trabalhador;<br/>real > 0 ? real : prev]
    C -- alm --> H[empreiteiro, sem chave; descricao ALMOCO data]
    D & E & F & G & H --> I{amount > 0?} -- nao --> J[toast Informe o Valor Realizado]
    I -- sim --> K{pixKey?} -- nao --> L[prompt Digite a Chave PIX]
    K & L --> M[generatePixPayload: BRCode com<br/>GUI, chave, descricao, MCC 0000,<br/>BRL, valor, BR, nome, cidade, TXID, CRC16]
    M --> N{payload?} -- nao --> O[toast Erro ao gerar payload]
    N -- sim --> P[activePixTransaction = source, idx, amount, bulk]
    P --> Q[openModal modal-pix-view:<br/>QR remoto + Copia e Cola + destinatario]
    R[confirmPixPaid] --> S{source}
    S -- pre/med/fin/alm --> T[status Pago e valpago += amount]
    S -- lote --> U[marca todos os indices como Pago<br/>e remove item do lote]
    T & U --> V[toast + persistDB + re-render<br/>Financeiro, Dashboard, Almocos, Presenca]
    V --> W{bulk e fila?} -- sim --> X[setTimeout 250ms openNextFinPix]
    Y[cancelPixPayment] --> AA[cancela fila e fecha modal]
```

🟢 `cleanPixKey` detecta CPF/CNPJ/telefone/e-mail/aleatória e normaliza (`+55` para telefone, minúsculas para e-mail). 🟢 `crc16` usa polinômio CCITT 0x1021; `tests/pix.test.js` cobre limpeza e estrutura do BRCode. 🟡 QR Code é gerado por serviço externo (`api.qrserver.com`), com fallback textual se falhar.

## 7. Fila de PIX em lote (Fechar Folha)

```mermaid
flowchart TD
    A[prepareLotePgto periodo] --> B{requireFeature pix.folha?} -- nao --> Z[aborta]
    B -- sim --> C[abre modal-lote se nao aberto]
    C --> D{periodo custom?}
    D -- sim --> E[le datas customizadas]
    D -- nao --> F[semana/quinzenal/mes via helpers]
    E & F --> G[filtra DB.presenca nao pagas no intervalo]
    G --> H[agrupa por trab ou nome+funcao]
    H --> I[devido = total - pago parcial]
    I --> J[monta lotePendentes com chave, nome,<br/>funcao, diarias, valor, indices]
    K[bulkPagarPix] --> L{requireFeature e pendentes selecionados?} -- nao --> M[toast/aborta]
    L -- sim --> N[_finPixQueue = entradas selecionadas<br/>source, idx, amount = pendente]
    N --> O[openNextFinPix → initiatePixPayment bulk]
    O --> P[confirmPixPaid → proximo da fila]
```

🟢 Feature gate `pix.folha` protege `prepareLotePgto`, `bulkPagarPix` e `initiatePixPayment` (`tests/plan-features.test.js:84`). 🟡 Fechar Folha cobre apenas `presenca`, enquanto o PIX individual também trata medição, almoço e lançamentos manuais.

## 8. Aprovação no servidor

```mermaid
flowchart TD
    A[financeiro_lancamento] --> B[efeitosFinanceiro: valida integridade,<br/>cria ou substitui lancamento]
    A2[financeiro_status] --> C[efeitosFinanceiroStatus: indice valido,<br/>valida integridade, troca status/valpago]
    B & C --> D[updates tenants/tid/financeiro<br/>antes/depois + resumo]
```

🟢 `tests/aprovacoes.test.js:190-217`: lançamento solicitado nasce `Pendente` com `valpago = 0`; mudança de status passa por `financeiro_status` e o trigger grava `Pago` com `valpago = 500`.

## 9. Autorização nas rules

```mermaid
flowchart TD
    A[.write tenants/tid/financeiro] --> B{super_admin/e-mail mestre?} -- sim --> H[permitido]
    B -- nao --> C{mesmo tenant + billing ativo?} -- nao --> D[negado]
    C -- sim --> E{admin/emailAdmin?} -- sim --> H
    E -- nao --> F{rh com modulosPermitidos.financeiro?} -- sim --> H
    F -- nao --> D
```

🟢 Não há `.read` explícito em `financeiro`: herda a leitura do nó do tenant. 🟡 `comprador` não consta na regra de escrita financeira, embora possa escrever `estoque`.
