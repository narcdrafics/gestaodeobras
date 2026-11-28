# Fluxograma — Módulo `medicao`

> 🟢 CONFIRMADO — `public/pages/medicao.html`, `public/modals/modal-medicao.html`, `public/js/app_core.js` (helpers/render 3814–3985; histórico/galeria/aprovação 3986–4211; formulário 4214–4433; save/edit 7491–7616), `public/js/utils.module.js` (aprovação 180–190; chaves 192–296; `buildMedicaoResumo` 298–411; `medicaoQuantidadeAnterior` 413–423), `functions/aprovacoes.js:36,49,367-386,403`, `functions/aprovacoes-api.js:16,29`, `database.rules.json:90-99,139-145`, `tests/medicao.test.js`, `tests/aprovacoes.test.js:244-291`, `tests/aprovacoes-ui.test.js:131,163`, `tests/rh-customizavel.test.js:75`.

## 1. Visão geral

```mermaid
flowchart TD
    A[medicao.html] --> B[Nova Medição -> modal-medicao]
    A --> C[renderMedicao]
    A --> D[Imprimir window.print]
    B --> E[saveMedicao / editMedicao]
    E --> F{valor > 0 e desvio disponivel?}
    F -- sim --> G[medicao_fechamento]
    G --> H[efeitosMedicao no trigger]
    H --> I[DB.medicao]
    F -- nao --> I
    C --> J[buildMedicaoResumo DB, obra, filtros]
    C --> K[buildOrcamentoBoard DB, obra -> pago/a pagar]
    J & K --> L[tabela unica com duas visoes]
    L --> M[canteiro: quantidades e aprovacao]
    L --> N[financeiro: valores, pago e a pagar]
    I -. re-render .-> C
    I -. re-render .-> O[Financeiro / Dashboard / Fotos]
```

🟢 Aprovação é **física**; pagamento é **financeiro** e aparece somente em leitura nesta página (`medicao.html:45`, `app_core.js:3899`). 🟢 Medições rejeitadas deixam de contar como custo (`utils.module.js:561`) e como avanço físico (`utils.module.js:352`).

## 2. Renderização e filtros

```mermaid
flowchart TD
    A[renderMedicao] --> B[repovoa #med-filter-obra com DB.obras]
    B --> C{sem selecao e ha obras?} -- sim --> D[seleciona primeira obra]
    C -- nao --> E[preserva selecao]
    D & E --> F[populateMedicaoFiltroEtapas<br/>orcamento + medicoes da obra]
    F --> G[le etapa, aprovacao, De, Até]
    G --> H{view = window._medView}
    H -- financeiro --> I[colunas: medido, aprovado, pago, a pagar, pagamento, fotos]
    H -- canteiro --> J[colunas: previsto, acumulado, %, aprovacao]
    G --> K{obra vazia?} -- sim --> L[Selecione uma obra + KPIs vazios]
    K -- nao --> M[buildMedicaoResumo DB, obra, filtros]
    M --> N[KPIs: avanco fisico, medido no periodo, a aprovar]
    M --> O[buildOrcamentoBoard -> financeiroPorChave]
    M --> P[porChave = medicoes agrupadas por medicaoServiceKey]
    O & P --> Q[para cada servico do resumo]
    Q --> R[aprovado = soma vtotal das Aprovadas]
    Q --> S[pago/aPagar da linha do board]
    S --> T[pgtoTxt = Parcial / Pago / Pendente]
    Q --> U[aprov = Rejeitada > Pendente > Aprovada > —]
    Q --> V{tem serviceIdReview?} -- sim --> W[tag vinculo a revisar]
    Q --> X{sem orcamento?} -- sim --> Y[tag sem orçamento / pct sem orçamento]
    R & T & U & W & Y --> Z[safeSetInner med-tbody + contador]
```

🟢 `fisico` é `null` quando não há peso válido: a KPI mostra `—` em vez de `0%` (`app_core.js:3924`). 🟢 `pct` é limitado visualmente a 0–100 e ganha classe `is-over` quando ultrapassa 100 (`app_core.js:3948-3949,3973`). 🟡 Filtro de obra defaulta para a primeira obra, como em `orcamento`.

## 3. `buildMedicaoResumo` — consolidação

```mermaid
flowchart TD
    A[orcamento da obra] --> B[ensureServico por budgetServiceKey<br/>temOrcamento=true, qprev/vtotal/vunit]
    C[medicao da obra com _idx] --> D{aprovacao != Rejeitada?}
    D -- sim --> E[acumula qacum + valorAcum + count<br/>qprev legado = max anterior]
    D -- nao --> F[fora do acumulado]
    C --> G[lista = filtro periodo + etapa + aprovacao]
    G --> H[valorMedido = soma vtotal da lista<br/>inclui Rejeitada]
    G --> I[aAprovar / aprovado / rejeitado<br/>por normalizeAprovacao]
    G --> J[retrabalho = soma retrQtd]
    B & E --> K[servicosArr: saldo=qprev-qacum<br/>pct=qacum/qprev*100 ou null]
    K --> L{filtra por etapa e<br/>temOrcamento ou count>0}
    L --> M[ordena por etapa, desc]
    K --> N[peso = vtotal do orcamento ou valorAcum legado]
    N --> O{pesoTotal > 0?} -- sim --> P[fisico = soma min100 max0 pct * peso / pesoTotal]
    O -- nao --> Q[fisico = null]
    M & H & I & J & P & Q --> R[servicos, medicoes ordenadas por semana desc, totais]
```

🟢 `qacum` usa **todo o histórico**, mesmo quando o período filtra a lista exibida — coberto por `tests/medicao.test.js:81-90`. 🟢 Registros antigos sem `aprovacao`/`aprovado` são considerados `Aprovada` (`utils.module.js:188-190`, teste `:139-146`). 🟢 `pagamento` não altera avanço físico (teste `:168-175`).

## 4. Quantidade anterior e formulário

```mermaid
flowchart TD
    A[onMedicaoObraChange] --> B[populateMedicaoServicos + Datalists]
    B --> C[opcoes: servicos do orcamento por budgetServiceKey<br/>+ Serviço avulso value vazio]
    C --> D[onMedicaoServicoChange]
    D --> E{linha do orcamento encontrada?}
    E -- sim --> F[herda desc, etapa, subEtapa, equipe, frente,<br/>unid, qtd e vunit; esconde campos avulsos]
    F --> G[vunit = line.vunit ou vtotal/qtd]
    E -- nao --> H[mostra descricao/unid/qprev/vunit avulsos<br/>info = —]
    G & H --> I[updateMedicaoAnterior]
    I --> J[medicaoQuantidadeAnterior DB,<br/>obra + serviceId/servico + excludeIdx]
    J --> K{soma historico nao rejeitado<br/>com mesma medicaoServiceKey}
    K --> L[md-qant]
    L --> M[recalcMedicao: qacum=qant+qreal<br/>saldo=qprev-qacum; avanco%; vtotal=qreal*vunit]
    M --> N[renderMedicaoPhotoPreview<br/>legendas sincronizadas com a descricao]
```

🟢 `medicaoQuantidadeAnterior` ignora a própria medição em edição (`excludeIdx`) e medições rejeitadas (`utils.module.js:414-423`, testes `:115-137`). 🟢 Na edição, `editMedicao` aceita `m.semana || m.data` e `m.serviceId || m.orcKey`, mantendo compatibilidade com registros legados (`app_core.js:7593,7598`).

## 5. Fotos e galeria

```mermaid
flowchart TD
    A[handleMedicaoPhotos] --> B[files = input.files]
    B --> C[room = 6 - fotos atuais]
    C --> D{files > room?} -- sim --> E[toast limite + descarta excedente]
    C --> F[para cada arquivo]
    F --> G[optimizeImageFile maxDim 1280 quality 0.75]
    G --> H[uploadEvidenceFile]
    H --> I{storage falhou?} -- sim --> J{ha dataUrl?}
    J -- sim --> K[usa dataUrl otimizada]
    J -- nao --> L[erro + break]
    H -- nao --> M[url remota]
    K & M --> N[_medicaoPhotos.push url + preview]
    N --> O[medicaoPhotoCaption = descricao do servico<br/>+ Foto i/n se multipla]
    P[openMedicaoFotos idx] --> Q{ha fotos?} -- nao --> R[toast Nenhuma foto]
    Q -- sim --> S[_medicaoGallery<br/>photos/index/title/meta/captionFn]
    S --> T[renderMedicaoGallery: overlay, navegacao, thumbs]
    T --> U[keydown: Escape fecha / setas navegam]
```

🟢 Fotos base64 são removidas do payload de aprovação; apenas URLs enviadas ao Storage seguem no desvio (`app_core.js:7553-7558`). 🟢 `medicaoFotosHtml` deduplica URLs e mostra no máximo 3 miniaturas + contador (`app_core.js:3857-3868`). 🟡 Legenda é derivada de `servico`/`etapa` no momento da exibição: renomear o serviço muda a legenda de fotos antigas.

## 6. Aprovação física e confirmação de vínculo

```mermaid
flowchart TD
    A[openMedicaoHistorico key] --> B[filtra medicoes da obra por medicaoServiceKey]
    B --> C[tabela: data, qtd, acum, valor, equipe, aprovacao, pagamento, fotos, obs]
    C --> D{aprovacao != Aprovada?} -- sim --> E[Aprovar]
    C --> F{aprovacao != Rejeitada?} -- sim --> G[Rejeitar]
    F --> H{serviceIdReview?} -- sim --> I[Confirmar vínculo]
    C --> J[Editar / Excluir]
    G --> K{confirm Rejeitar?} -- nao --> L[aborta]
    K -- sim --> M[setMedicaoAprovacao idx, Rejeitada]
    E --> N[setMedicaoAprovacao idx, Aprovada]
    M & N --> O[le gestaoUser do sessionStorage]
    O --> P[aprovacao / aprovadoPor / aprovadoEm=getTodayBR]
    P --> Q[persistDB + renderMedicao]
    Q --> R{historico visivel?} -- sim --> S[reabre historico da chave]
    Q --> T[renderFinanceiro + renderDashboard]
    I --> U[confirmMedicaoVinculo: delete serviceIdReview]
    U --> V[persistDB + renderMedicao + reabre historico]
```

🟢 Rejeitar exige `confirm` explícito avisando que a medição deixa de contar como custo e avanço (`app_core.js:4183`). 🟢 `getTodayBR()` é usado para `aprovadoEm`, consistente com o fuso `America/Sao_Paulo`. 🟡 `setMedicaoAprovacao` grava direto no RTDB pelo cliente (não passa por aprovação no servidor), então qualquer papel com `.write` em `medicao` pode aprovar/rejeitar a própria medição. 🟡 `confirmMedicaoVinculo` não registra quem confirmou nem quando.

## 7. Salvamento (`saveMedicao`)

```mermaid
flowchart TD
    A[saveMedicao] --> B[valida data, obra, servico/avulso e qreal > 0]
    B --> C[editIdx = parseEditIdx md-edit-idx; anterior = DB.medicao editIdx]
    C --> D[linha = medicaoLinhaOrcamento serviceId]
    D --> E[servico/etapa/subEtapa/frente/equipe/unid<br/>herdados ou do avulso]
    E --> F[qant = medicaoQuantidadeAnterior excluindo editIdx]
    F --> G[aprovacao = normalizeAprovacao anterior ou Pendente]
    G --> H[data = ...anterior + snapshot<br/>orcKey, serviceId, qprev, qant, qreal,<br/>qacum, vunit, vtotal, aprovacao, fotos, obs]
    H --> I{serviceId vazio?} -- sim --> J[delete serviceId]
    I --> K{servico trocado ou avulso?} -- sim --> L[delete serviceIdReview]
    J & L --> M{vtotal > 0 ou vunit > 0<br/>e desviarParaAprovacao existe?}
    M -- sim --> N[filtra fotos data: do payload]
    N --> O[desvio medicao_fechamento<br/>indice na edicao / criar:true]
    O --> P{desviado?} -- sim --> Q[closeModal + limpa _medicaoPhotos + return]
    M -- nao --> R{editIdx >= 0?}
    R -- sim --> S[DB.medicao editIdx = data]
    R -- nao --> T[DB.medicao.push data]
    S & T --> U[closeModal + persistDB]
    U --> V[renderMedicao + Financeiro + Dashboard + Fotos]
```

🟢 Campos de pagamento não são mais digitados na medição: valores antigos são preservados só para compatibilidade (`app_core.js:7523-7524`). 🟡 Medição com `vunit = 0` e `vtotal = 0` **não desvia** para aprovação e é gravada diretamente por qualquer papel com permissão de escrita — possível buraco no fechamento. 🟡 `qant`/`qacum` são snapshots no registro; se uma medição anterior for editada ou excluída, o campo gravado fica desatualizado, mas `buildMedicaoResumo` recalcula o acumulado correto a partir do histórico.

## 8. Aprovação no servidor (`medicao_fechamento`)

```mermaid
flowchart TD
    A[desvio medicao_fechamento] --> B[efeitosMedicao]
    B --> C[criando = payload.criar === true]
    C --> D{nao criando e indice invalido?} -- sim --> E[erro medicao_inexistente]
    D -- nao --> F[antes = criando ? null : copia da medição]
    F --> G[item = ...antes + payload.item]
    G --> H[qreal = Number ou 0; vunit = Number ou 0]
    H --> I[vtotal = qreal * vunit]
    I --> J[aprovacao = Aprovado<br/>aprovadoPor = decididoPor; aprovadoEm = agora]
    J --> K{criando?} -- sim --> L[medicao.push item]
    K -- nao --> M[medicao indice = item]
    L & M --> N[updates tenants/tid/medicao<br/>antes/depois/resumo Fechamento de medição]
```

🟢 O trigger grava `aprovacao = 'Aprovado'` (masculino), enquanto a UI usa `Aprovada`; `normalizeAprovacao` aceita ambos (`utils.module.js:180-185`), então o comportamento converge — mas o valor bruto persistido difere do esperado pelo filtro textual direto. 🟢 `tests/aprovacoes.test.js:244-291` cobre edição e criação com recálculo de `vtotal` e auditoria do decisor. 🟢 `engenheiro` pode criar `medicao_fechamento`; `encarregado`/`mestre` só podem criar `movimentacao_estoque`, `trabalhador_add` e `trabalhador_remove` (`database.rules.json:139`, `aprovacoes_ui.js:20,31`, `aprovacoes-api.js:16,29`). 🟢 RH com `modulosPermitidos` não decide este tipo (`tests/rh-customizavel.test.js:75`).

## 9. Autorização nas rules

```mermaid
flowchart TD
    A[.write tenants/tid/medicao] --> B{super_admin / e-mail mestre?} -- sim --> H[permitido]
    B -- nao --> C{mesmo tenant + billing ativo?} -- nao --> D[negado]
    C -- sim --> E{admin / emailAdmin / engenheiro?} -- sim --> H
    E -- nao --> F{rh com modulosPermitidos.medicao?} -- sim --> H
    F -- nao --> D
    G[.write medicao/itemId/photos ou photoUrl] --> I{admin/engenheiro/<br/>encarregado/mestre/rh com modulo?} -- sim --> H
    I -- nao --> D
```

🟢 `encarregado` e `mestre` **não** escrevem a medição em si, mas podem escrever somente `photos`/`photoUrl` de um item existente (`database.rules.json:92-98`). 🟢 Não há `.read` explícito: leitura herdada do nó do tenant. 🟡 Não há validação de `qreal > 0` nem de unicidade de `serviceId` nas rules — integridade depende do cliente e do trigger.
