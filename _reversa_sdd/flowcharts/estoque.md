# Fluxograma — Módulo `estoque`

> 🟢 CONFIRMADO — `public/pages/estoque.html`, `public/modals/modal-estoque.html`, `public/modals/modal-movimentacao-estoque.html`, `public/modals/modal-entrada-estoque.html`, `public/js/estoque.module.js` (498 linhas), `public/js/app_core.js` (entrada 2267–2320; render 2323–2359; item 7017–7073; legado 7075–7214), `public/js/utils.module.js:1475-1489`, `functions/aprovacoes.js:167-248`, `database.rules.json:101-113`, `tests/estoqueajuste/estoque.test.js`, `tests/security/rules.test.js`.

## 1. Visão geral — três caminhos de escrita

```mermaid
flowchart TD
    A[estoque.html] --> B[+ Novo Item: modal-estoque<br/>saveEstoque/editEstoque]
    A --> C[Nova Entrada: modal-entrada-estoque<br/>abrirModalEntrada/confirmarEntrada]
    A --> D[movEstoque legado: modal-movest<br/>saveMovEstoque/editMovEstoque]
    E[estoque.module.js] --> F[modal unificado<br/>abrirModalMovimentacao/confirmarMovimentacao]
    B --> G[DB.estoque]
    C --> G
    C --> H[DB.movEstoque]
    D --> G
    D --> H
    F --> G
    F --> H
    I[desviarParaAprovacao] --> J[movimentacao_estoque]
    C -. desvio .-> I
    F -. desvio .-> I
    J --> K[efeitosMovimentacao no trigger<br/>aplica saldo no servidor]
```

🟢 O estado canônico é `DB.estoque` + `DB.movEstoque`, persistido por `persistDB()`. 🟡 `+ Novo Item` e `Nova Entrada` são fluxos distintos: o primeiro cadastra o material, o segundo repõe saldo.

## 2. Cadastro de item (`saveEstoque`)

```mermaid
flowchart TD
    A[saveEstoque] --> B[mat = es-mat trim; obra = es-obra; editIdx]
    B --> C{mat vazio?} -- sim --> D[toast Informe o nome + return]
    C -- nao --> E{editIdx < 0?}
    E -- sim --> F[normEstoqueNome local: lowercase, sem acentos,<br/>nao alnum -> espaco, colapsa espacos]
    F --> G{ja existe mesma obra + nome normalizado?} -- sim --> H[toast ja existe nesta obra<br/>use movimentacao para ajustar + return]
    E -- nao --> I[monta registro cod/mat/unid/obra/min/<br/>entrada/saida=0/custo/obs]
    G -- nao --> I
    I --> J{editIdx >= 0?}
    J -- sim --> K[preserva saida existente<br/>DB.estoque editIdx = data]
    J -- nao --> L[DB.estoque.push data]
    K & L --> M[closeModal + await persistDB + renderEstoque]
```

🔴 Fato: `saveEstoque` usa uma **cópia local** `normEstoqueNome` em vez de `window.normalizarNome` (testado em `estoque.test.js`). 🟢 Decisão P17: `normEstoqueNome` é canônica.

## 3. Renderização e status

```mermaid
flowchart TD
    A[renderEstoque] --> B[para cada DB.estoque]
    B --> C[saldo = calcSaldo = entrada - saida]
    C --> D[estoqueStatus]
    D --> E{saldo <= 0?} -- sim --> F[SEM ESTOQUE]
    D -- nao --> G{saldo <= min?} -- sim --> H[CRITICO]
    G -- nao --> I{saldo <= min*1.5?} -- sim --> J[BAIXO]
    I -- nao --> K[NORMAL]
    F & H & J & K --> L[cor: vermelho se saldo <= min,<br/>laranja se <= min*1.5, verde se nao]
    L --> M[colunas: cod, mat, unid, obra, min,<br/>entrada, saida, saldo, custo,<br/>saldo*custo, status, acoes]
    M --> N[editEstoque i / deleteItem estoque i]
    O[renderMovEstoque] --> P[badge por tipo:<br/>Entrada verde, Saida laranja, Retorno azul,<br/>contem Entrada azul, demais roxo]
    P --> Q[editMovEstoque i / deleteItem movEstoque i]
```

## 4. Nova Entrada (`confirmarEntrada`)

```mermaid
flowchart TD
    A[abrirModalEntrada] --> B[popula ent-item com cod, mat, unid, saldo]
    B --> C[ent-quantidade=1, ent-vunit=0,<br/>motivo e obs limpos; display flex]
    D[confirmarEntrada] --> E{item, qtd > 0, motivo preenchido?} -- nao --> F[toast + return]
    E -- sim --> G[busca item por cod]
    G --> H{desviarParaAprovacao disponivel?}
    H -- sim --> I[desvio movimentacao_estoque<br/>tipo Entrada, qtd, obs = motivo + observacoes]
    I --> J{desviado?} -- sim --> K[closeModalEntrada + return]
    H -- nao --> L[e.entrada += qtd]
    J -- nao --> L
    L --> M[push movEstoque tipo Entrada<br/>data = today getTodayBR, motivo, obs]
    M --> N[closeModalEntrada + await persistDB]
    N --> O[toast Entrada registrada + renderEstoque + renderMovEstoque]
```

🟡 O payload de aprovação usa `new Date().toISOString().slice(0,10)` (UTC), enquanto o registro direto usa `today` (`America/Sao_Paulo`).

## 5. Modal unificado de movimentação

```mermaid
flowchart TD
    A[abrirModalMovimentacao preSelect] --> B[resetarModalMovimentacao]
    B --> C[popularSelectItens: DB.estoque com saldo no rotulo]
    C --> D[popularSelectObras: status ativa/em andamento/<br/>planejada/execucao]
    D --> E[display flex]
    F[selecionarTipoMov tipo] --> G[marca btn ativo + oculta campos]
    G --> H{tipo}
    H -- saida_canteiro --> I[mostra campo-obra-destino]
    H -- retorno --> J[mostra campo-obra-origem-retorno]
    H -- transferencia --> K[mostra campo-transferencia<br/>origem + destino]
    H -- ajuste --> L[sem campo extra; motivo obrigatorio<br/>min 10 chars]
    H -- entrada --> M[bloqueado: botao alertarEntradaBloqueada<br/>usa Nova Entrada]
    I & J & K & L --> N[rotulo do botao por tipo + habilita confirmar]
    O[onItemChange] --> P[buscarItemPorId: nome, unidade,<br/>saldo = entrada - saida]
    P --> Q[buscarItemNoCanteiro: deriva de movEstoque<br/>saidas - retornos por obra]
    Q --> R[atualiza info de estoque e canteiro]
    S[validarQuantidadeInput] --> T{saida_canteiro e qtd > saldo?} -- sim --> U[erro Excede o estoque]
    T -- nao --> V[esconde erro]
```

`buscarItemNoCanteiro` (`estoque.module.js:72-101`) considera movimentos com `tipo` contendo `saída`/`saida` como acréscimo e `retorno` exato como decréscimo, por obra, ignorando saldos `<= 0`.

## 6. Confirmação da movimentação

```mermaid
flowchart TD
    A[confirmarMovimentacao] --> B[coletarDadosModal + validarFormMovimentacaoUI]
    B --> C{erros?} -- sim --> D[exibirErrosModal + return]
    C -- nao --> E[item por cod; saldo = entrada - saida]
    E --> F{editIdx >= 0 e desvio ativo?} -- sim --> G[toast Edicao exige aprovacao + return]
    F -- nao --> H[desviarParaAprovacao disponivel?]
    H -- sim --> I[mapeia tipo: saida_canteiro->Saida,<br/>retorno->Retorno, transferencia->Transferencia,<br/>ajuste->Entrada se diff>0 senao Saida]
    I --> J[qtd enviada = abs quantidade-saldo no ajuste]
    J --> K[desvio movimentacao_estoque]
    K --> L{desviado?} -- sim --> M[fecha modal + return]
    H -- nao --> N{editIdx >= 0?}
    L -- nao --> N
    N -- sim --> O[atualiza registro sem mexer saldos<br/>persistDB + toast Movimentacao atualizada]
    N -- nao --> P{tipo}
    P -- saida_canteiro --> Q{qtd > saldo?} -- sim --> R[erro Estoque insuficiente]
    Q -- nao --> S[item.saida += qtd; push tipo Saida]
    P -- retorno --> T[qtdCanteiro = saidas - retornos da obra]
    T --> U{qtd > qtdCanteiro?} -- sim --> V[erro Disponivel para retorno]
    U -- nao --> W[item.entrada += qtd; push tipo Retorno]
    P -- transferencia --> X{qtd > saldo ou origem = destino?} -- sim --> Y[erro]
    X -- nao --> Z[item.saida += qtd; push APENAS<br/>Transferencia Entrada na obra destino]
    P -- ajuste --> AA{motivo < 10?} -- sim --> AB[erro]
    AA -- nao --> AC[diff = quantidade - saldo;<br/>item.entrada += diff; push Ajuste abs diff]
    S & W & Z & AC --> AD[fecha modal + await persistDB<br/>toast Movimentacao registrada + recarregarEstoque]
```

🔴 Fato: transferência no modal unificado **não credita o item de destino** — grava só `Transferência (Entrada)` na obra destino e debita a origem. O modal legado e o trigger gravam o par Saída/Entrada. 🟢 Decisão P11: corrigir transferência e edição.

🔴 Fato: no modo edição do modal unificado, os saldos não são ajustados. 🟢 Decisão P11: corrigir o ajuste de saldos antes da reimplementação.

## 7. Edição e legado

```mermaid
flowchart TD
    A[editMovEstoque idx] --> B{tipo legado entrada ou<br/>Transferencia Entrada?}
    B -- sim --> C[abre modal-movest e popula campos]
    B -- nao --> D[editarMovimentacaoNovoModal idx]
    D --> E[abrirModalMovimentacao codMat + setTimeout 50ms]
    E --> F[mov-edit-idx = idx; titulo Editar;<br/>oculta aviso de entrada]
    F --> G[mapeia tipo legado -> novo]
    G --> H[preenche item, qtd, motivo, obra conforme tipo;<br/>botao Salvar Alteracoes]
    I[saveMovEstoque] --> J{tipo Transferencia?}
    J -- sim --> K[valida destino diferente da origem]
    K --> L[origem.saida += qtd]
    L --> M[localiza/cria item destino<br/>cod MAT-timestamp-random]
    M --> N[destino.entrada += qtd]
    N --> O[push Transferencia Saida na origem<br/>push Transferencia Entrada no destino]
    J -- nao --> P[Entrada/Retorno: entrada += qtd<br/>demais: valida saldo e saida += qtd]
    O & P --> Q[push ou substitui movEstoque por editIdx]
    Q --> R[closeModal + await persistDB + render]
```

## 8. Aprovação (`movimentacao_estoque`)

```mermaid
flowchart TD
    A[desvio movimentacao_estoque] --> B[efeitosMovimentacao]
    B --> C{codMat e qtd > 0?} -- nao --> D[erro movimentacao_invalida]
    C -- sim --> E{item existe?} -- nao --> F[erro material_inexistente]
    E -- sim --> G[saldo = entrada - saida]
    G --> H{tipo}
    H -- Transferencia --> I{destino valido e diferente?<br/>qtd <= saldo?}
    I -- nao --> J[erro destino_invalido/saldo_insuficiente]
    I -- sim --> K[origem.saida += qtd; cria/credita destino;<br/>push par Saida + Entrada]
    H -- Entrada ou Retorno --> L[entrada += qtd; push mov]
    H -- Saida --> M{qtd <= saldo?} -- nao --> N[erro saldo_insuficiente]
    M -- sim --> O[saida += qtd; push mov]
    H -- outro --> P[erro tipo_movimentacao_invalido]
    K & L & O --> Q[updates estoque + movEstoque/<br/>proximoIndice; resumo tipo de qtd unid — mat]
```

🟢 Engenheiro pode **decidir** apenas `movimentacao_estoque` e é obrigado a notificar o admin (`aprovacoes_ui.js:133`, `tests/aprovacoes.test.js:33`). 🟢 `encarregado`, `mestre` e `engenheiro` não escrevem diretamente em `estoque`/`movEstoque` (`tests/security/rules.test.js:313-338`).

## 9. Autorização nas rules

```mermaid
flowchart TD
    A[.read tenants/tid/estoque] --> B{super_admin?} -- sim --> H[permitido]
    B -- nao --> C{mesmo tenant e billing nao bloqueado?} -- sim --> H
    C -- nao --> D[negado]
    E[.write estoque] --> F{super_admin/e-mail mestre?} -- sim --> H
    F -- nao --> G{mesmo tenant, billing ativo,<br/>admin/emailAdmin ou comprador ou RH com<br/>modulosPermitidos.estoque?} -- sim --> H
    G -- nao --> D
    I[.write movEstoque] --> J{super_admin/e-mail mestre?} -- sim --> H
    J -- nao --> K{mesmo tenant, billing ativo,<br/>admin/emailAdmin ou RH com<br/>modulosPermitidos.estoque?} -- sim --> H
    K -- nao --> D
```

🟢 `estoque` aceita **comprador** na escrita; `movEstoque` **não** aceita comprador (apenas admin, mestre e-mail e RH com módulo) — `database.rules.json:101-113`. 🟡 Leitura exige apenas mesmo tenant com billing ≠ `bloqueado`, enquanto a escrita também bloqueia `somente_leitura`.
