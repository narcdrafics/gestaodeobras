# Fluxograma — Módulo `compras`

> 🟢 CONFIRMADO — `public/pages/compras.html`, `public/modals/modal-compra.html`, `public/js/compras_ui.js`, `public/js/app_core.js` (render 2362–2422; modal 5899–5902; cálculo 6715–6719; save/edit 7216–7298), `public/js/data_core.js` (716–747, 449, 790), `public/js/aprovacoes_ui.js`, `functions/aprovacoes.js:339-364`, `database.rules.json:126-127,172-175`, `tests/compras-segregacao.test.js`, `tests/aprovacoes-ui.test.js`, `tests/rh-customizavel.test.js`, `tests/security/rules.test.js`.

## 1. Modelo de dois nós (segregação comercial)

```mermaid
flowchart TD
    A[campos sensíveis: forn, pixkey, vunit, vtotal, vorc, prazo] --> B[publico: tenants/tid/compras[]<br/>sem campos sensíveis]
    A --> C[privado: comprasPrivadas/tid/id<br/>so com esses campos + compraId + criadoEm]
    B --> D[engenheiro/encarregado podem ler<br/>o tenant inteiro]
    C --> E[rules proprias: so admin/super/<br/>comprador/RH com modulo compras]
    D --> F[sanitizeComprasForRole remove<br/>sensitive do DB e do cache local]
    F --> G[renderCompras so mostra colunas<br/>comerciais para quem pode ver]
```

Origem: `compras_ui.js:1-8`, `data_core.js:716-747`, `tests/compras-segregacao.test.js`.

## 2. Inicialização e escopo de acesso

```mermaid
flowchart TD
    A[DOMContentLoaded ou firebaseSync] --> B[iniciarCompras]
    A2[renderPage compras] --> B
    B --> C[tenantId: superAdminActiveTenant.id<br/>ou sessao.tenantId ou OBRA_CHECKOUT_TENANT_ID]
    C --> D{tid e firebase.database?} -- nao --> E[aborta]
    D -- sim --> F{podeVerDadosComerciais?}
    F -- nao --> G[ref.off; privadas = {};<br/>window.COMPRAS_PRIVADAS = {}; return]
    F -- sim --> H{tenantAtual === tid e ref existe?} -- sim --> I[reusa listener]
    H -- nao --> J[ref.off + ref = comprasPrivadas/tid]
    J --> K[ref.on value]
    K --> L[privadas = snap.val ou {}]
    L --> M[window.COMPRAS_PRIVADAS = privadas]
    M --> N[renderCompras]
    K --> O{erro?} -- sim --> P[console.warn code]
    Q[papel: normalizeRole do claim/perfil] --> R{admin/super/comprador?} -- sim --> S[true]
    R -- nao --> T{rh com modulosPermitidos.compras?} -- sim --> S
    T -- nao --> U[false — engenheiro, encarregado, mestre, RH sem modulo]
```

`podeVerDadosComerciais()` controla quem lê/grava os dados sensíveis; `requerAprovacao()` (`aprovacoes_ui.js:141-144`) vale para `encarregado`, `engenheiro` e `rh`.

## 3. Tabela dinâmica e evidência

```mermaid
flowchart TD
    A[renderCompras] --> B{comercial?}
    B -- sim --> C{inclui Fornecedor, Vl. Total, Prazo Entrega<br/>via dadoComercial c, campo}
    B -- nao --> D[colunas basicas: Nº Ped., Data, Obra,<br/>Material, Qtd, Unid, Status]
    C & D --> E[Recebido?, Conferido?, Evidência]
    E --> F{restrito?}
    F -- nao --> G[adiciona Ações: editar/excluir]
    F -- sim --> H[sem Ações]
    G & H --> I[head e tbody vem do MESMO array colunas<br/>para nao desalinhar]
    I --> J{DB.compras vazio?} -- sim --> K[uiEmptyState Nova Compra]
    I -- nao --> L[linhas com celula por coluna]
    M[verEvidenciaCompra idx] --> N[showPage fotos]
    N --> O[filtro fotos-obra-filter = c.obra]
    O --> P[renderFotos + toast com obra/etapa]
```

🔴 Fato: `renderCompras` não filtra por escopo de obra, ao contrário de almocos/presença/trabalhadores. 🟢 Decisão P16: aplicar `acessoObras`/filtro de obra.

## 4. Modal e preparação por papel

```mermaid
flowchart TD
    A[openModal modal-compra] --> B[cp-num = nextCod DB.compras PC]
    B --> C[cp-data = today]
    C --> D[prepareModalCompra modalContent]
    D --> E{podeVerDadosComerciais?}
    E -- nao --> F[oculta .form-group de<br/>forn/pixkey/vunit/vtotal/vorc/prazo]
    E -- sim --> G[campos comerciais visíveis]
    F & G --> H{requerAprovacao?}
    H -- sim --> I[botao primario vira Enviar para aprovação<br/>onclick chama saveCompra]
    H -- nao --> J[botao Salvar]
    K[calcCompraTotal] --> L[cp-vtotal = cp-qtd * cp-vunit<br/>readonly]
```

## 5. Salvamento

```mermaid
flowchart TD
    A[saveCompra] --> B[monta data com 17 campos<br/>pixkey via cleanPixKey]
    B --> C[cp-edit-idx => editIdx]
    C --> D{desviarParaAprovacao disponível?}
    D -- sim --> E{editIdx >= 0?}
    E -- sim --> F[toast Alteração comercial exige aprovação + return]
    E -- nao --> G[desestrutura: remove forn,pixkey,vunit,vtotal,vorc,prazo]
    G --> H[desviarParaAprovacao compra_criacao<br/>payload compra publica + id]
    H --> I{desviado?} -- sim --> J[closeModal + return]
    D -- nao --> K[id = num ou id anterior ou CP-timestamp]
    I -- nao --> K
    K --> L[compraPublica data,id<br/>remove campos sensíveis]
    L --> M{editIdx >= 0?}
    M -- sim --> N[DB.compras editIdx = publica<br/>toast Compra atualizada]
    M -- nao --> O[DB.compras.push publica<br/>toast Compra registrada]
    N & O --> P[closeModal + await persistDB]
    P --> Q[salvarDadosComerciais id, data]
    Q --> R[update comprasPrivadas/tid/id<br/>sensiveis + compraId + criadoEm]
    R --> S[renderCompras]
```

🔴 Com desvio ativo (encarregado/engenheiro/RH), **edição é bloqueada**; a criação via aprovação envia `compra_criacao` sem `compraPrivada`, e o trigger grava só metadados no nó privado.

## 6. Hidratação da edição

```mermaid
flowchart TD
    A[editCompra idx] --> B[openModal + cp-edit-idx = idx]
    B --> C[restaura campos públicos de DB.compras idx]
    C --> D[para cada campo sensível]
    D --> E[dadoComercial c, campo]
    E --> F{existe no no privado?} -- sim --> G[usa valor privado]
    F -- nao --> H[fallback legado c campo]
    G & H --> I[preenche cp-forn/vunit/vtotal/<br/>pixkey/vorc/prazo]
    I --> J[cp-num, data, obra, etapa, mat, qtd,<br/>unid, status, receb, conf, obs]
```

`dadoComercial(c, campo)` (`compras_ui.js:66-73`) só consulta `privadas[compra.id || compra.num]` para os seis campos sensíveis; qualquer outro campo é lido diretamente do registro público.

## 7. Aprovação no servidor

```mermaid
flowchart TD
    A[desviarParaAprovacao compra_criacao] --> B[aprovacoes_ui: solicitarAprovacao]
    B --> C[grava tenants/tid/aprovacoes/id<br/>status pendente, expira em 15 dias]
    C --> D[admin/comprador decide via /api/admin/aprovacao]
    D --> E[trigger aplicarAprovacao chama efeitosCompra]
    E --> F{mat preenchido e qtd > 0?} -- nao --> G[erro compra_invalida]
    F -- sim --> H[remove campos privados do publico]
    H --> I[id = c.id ou aprovacao.id ou CP-agora]
    I --> J[push em tenants/tid/compras]
    J --> K[grava comprasPrivadas/tid/id<br/>com payload.compraPrivada + aprovacaoId + criadoEm]
    K --> L[auditoria: Compra aprovada — mat qtd unid]
```

🟢 `tests/aprovacoes-ui.test.js` garante que o payload exibido a papéis restritos remove `compra`, `compraPrivada`, `lancamento` e `movimentacao` dos campos sensíveis. 🟢 `tests/rh-customizavel.test.js` garante que RH só decide `compra_criacao` com `modulosPermitidos.compras === true`.

## 8. Autorização nas rules

```mermaid
flowchart TD
    A[.write tenants/tid/compras] --> B{super_admin ou e-mail mestre?} -- sim --> H[permitido]
    B -- nao --> C{mesmo tenant + billing ativo?} -- nao --> D[negado]
    C -- sim --> E{admin/emailAdmin ou comprador?} -- sim --> H
    E -- nao --> F{rh com modulosPermitidos.compras?} -- sim --> H
    F -- nao --> D
    G[.read/.write comprasPrivadas/tid] --> I{admin/emailAdmin/comprador/<br/>RH com modulo?} -- sim --> H
    I -- nao --> D
```

🟢 Engenheiro, encarregado e mestre **não** aparecem em nenhuma das duas regras (`tests/compras-segregacao.test.js:191-201`). 🟢 `buildCloudUpdate` e `persistDB` removem `compras` do update quando o papel não pode escrever (`_nodeBloqueadoParaRole`), e o cache local é sanitizado antes de gravar (`data_core.js:790`).
