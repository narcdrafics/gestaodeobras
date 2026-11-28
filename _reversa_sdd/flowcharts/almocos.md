# Fluxograma — Módulo `almocos`

> 🟢 CONFIRMADO — `public/pages/almocos.html`, `public/modals/modal-almoco.html`, `public/js/app_core.js` (bloco 1050–1465), `public/js/utils.module.js`, `database.rules.json:84-85`, `tests/almocos-usabilidade.test.js`, `tests/security/rules.test.js`.

## 1. Quadro semanal (espelho de Presença)

```mermaid
flowchart TD
    A[renderAlmocos chama renderQuadroAlmocos] --> B[currentAlmocoWeekOffset]
    B --> C[getAlmocoWeekDates: segunda da semana atual + offset*7]
    C --> D[gera 7 objetos date/name/display<br/>Seg a Dom]
    D --> E[trabsNoEscopoAtual DB.trabalhadores<br/>filtra status Ativo]
    E --> F{vazio?} -- sim --> G[mensagem Nenhum trabalhador ativo]
    E -- nao --> H[para cada trabalhador x cada dia]
    H --> I[findIndex em DB.almocos:<br/>data igual + obra no escopo + trabNaObra<br/>+ empreiteiro casa nome, cod ou equipe]
    I --> J{encontrou?}
    J -- nao --> K[more_horiz Sem registro<br/>classe none]
    J -- Pago --> L[check_circle verde<br/>Lancado e pago — qtd ref.]
    J -- pendente --> M[restaurant laranja<br/>Lancado — qtd ref. status]
    K & L & M --> N[celula onclick openAlmocoModal<br/>almocoJsString cod, data, idx]
    O[changeAlmocoWeek offset] --> P[currentAlmocoWeekOffset += offset<br/>re-render]
```

🟡 `getAlmocoWeekDates` usa `new Date()` local do navegador (`getDay`, `getMonth`, `setDate`), não `getTodayBR()` (`America/Sao_Paulo`).

## 2. Clique na célula e modal

```mermaid
flowchart TD
    A[openAlmocoModal cod, data, existingIdx] --> B{existingIdx >= 0?}
    B -- sim --> C[editAlmoco existingIdx<br/>abre modal e restaura campos]
    B -- nao --> D[openModal modal-almoco]
    D --> E[setTimeout 300ms]
    E --> F[al-data = data]
    E --> G[al-empreiteiro = nome da ficha ou cod]
    E --> H[al-obra = primeira obra do trabalhador<br/>dentro do escopo, se existir no select]
    E --> I[toggleAlmocoModo]
    J[ radios al-modo ] --> K{individual?}
    K -- sim --> L[mostra al-indiv-grp<br/>oculta al-massa-grp]
    K -- nao --> M[oculta al-indiv-grp<br/>mostra al-massa-grp]
    M --> N[al-lista-massa = trabalhadores Ativos<br/>no escopo e na obra selecionada]
    N --> O[checkbox al-massa-check value=nome<br/>data-cod=codigo]
    O --> P[selectAllAlmoco marca todos]
    Q[toggleAlmocoParcial] --> R{al-status = Parcial?}
    R -- sim --> S[mostra al-valpago]
    R -- nao --> T[oculta al-valpago]
```

🟡 O preenchimento da célula depende de `setTimeout(..., 300)`: em dispositivos lentos o modal pode aparecer antes dos valores.

## 3. Cálculo e regras de pagamento

```mermaid
flowchart TD
    A[calcAlmocoTotal] --> B[qtd = al-qtd ou 0<br/>vunit = al-vunit ou 0]
    B --> C[al-vtotal = qtd * vunit<br/>toFixed 2, readonly]
    D[saveAlmoco] --> E[vtotal = qtd * vunit<br/>recalculado no save, nao confia no campo]
    E --> F{pgtoStatus}
    F -- Pago --> G[valpago = vtotal]
    F -- Parcial --> H[valpago = al-valpago informado]
    F -- Pendente/Atrasado --> I[valpago = 0]
    J[almocoDevido a] --> K{pgtoStatus = Pago?}
    K -- sim --> L[devido = 0]
    K -- nao --> M{pago = Parcial ? valpago : 0}
    M --> N[devido = max 0, vtotal - pago]
```

## 4. Salvamento (individual e em lote)

```mermaid
flowchart TD
    A[saveAlmoco keepOpen] --> B{modo massa?}
    B -- sim --> C[checks .al-massa-check:checked<br/>exige ao menos 1]
    B -- nao --> D[al-empreiteiro<br/>exige preenchido]
    C & D --> E{data e obra preenchidas?} -- nao --> F[toast Preencha data e obra + return]
    E --> G{obra no escopo?} -- nao --> H[toast obra fora do escopo + return]
    G -- sim --> I[para cada empreiteiro]
    I --> J[busca trabalhador por nome ou cod]
    J --> K{trabalhador nao pertence a obra?}
    K -- sim --> L{modo massa?}
    L -- nao --> M[toast nao pertence a obra + return]
    L -- sim --> N[continue — pula este]
    K -- nao --> O{editIdx < 0 ou nao massa?}
    O -- sim --> P{ja existe data + empreiteiro + obra<br/>em outro indice?}
    P -- sim --> Q[toast ja tem almoco nesta data<br/>massa: continue; individual: return]
    P -- nao --> R[monta registro data/obra/empreiteiro/<br/>qtd/vunit/vtotal/obs/pgtoStatus/valpago]
    O -- nao --> R
    N & Q --> I
    R --> S{editIdx >= 0 e nao massa?}
    S -- sim --> T[DB.almocos editIdx = data]
    S -- nao --> U[DB.almocos.push data]
    T & U --> V[salvos++]
    V --> I
    I -- fim --> W[closeModal + await persistDB]
    W --> X[renderAlmocos]
    X --> Y{keepOpen?}
    Y -- sim --> Z[reabre modal apos 100ms<br/>restaura ultimo modo via radio]
    Y -- nao --> AA[modal permanece fechado]
```

🔴 Não há toast de confirmação de salvamento (ao contrário de presença/trabalhadores); a quantidade `salvos` é incrementada mas nunca exibida.

## 5. Lista, busca e fechamentos

```mermaid
flowchart TD
    A[renderAlmocos] --> B[lista = DB.almocos]
    B --> C[map com _idx original<br/>filter obra no escopo]
    C --> D[busca textual: data formatada, data crua,<br/>nome da obra, empreiteiro, obs]
    D --> E[ordena data_desc ou data_asc<br/>via localeCompare]
    E --> F{grupo}
    F -- empreiteiro --> G[group-header com contagem]
    F -- obra --> G
    F -- vazio --> H[lista plana]
    G & H --> I[linhas: data/obra, colaborador, qtd,<br/>vunit, vtotal, badge status, valpago, acoes]
    I --> J[editAlmoco _idx / deleteItem almocos _idx]
    I --> K[filterAlmoco busca<br/>esconde linhas e group-headers vazios]
    I --> L[renderQuadroAlmocos]
    I --> M[renderAlmocosKPI lista]
    I --> N[renderFechamentosAlmocos lista]
    M --> O[KPIs da semana navegada:<br/>refeicoes, custo, lancamentos, pendente]
    N --> P[resumo por obra<br/>qtd + custo]
    N --> Q[fechamento por empreiteiro<br/>qtd + custo]
    N --> R[pagamentos pendentes por obra<br/>almocoDevido > 0]
```

`renderAlmocosKPI` e `renderFechamentosAlmocos` filtram `a.data >= dias[0].date && a.data <= dias[6].date` — a **semana navegada**, não o mês corrente nem o dia de hoje.

## 6. Fechamento em lote da semana

```mermaid
flowchart TD
    A[fecharSemanaAlmocos] --> B[dias = getAlmocoWeekDates]
    B --> C[pendentes = almocos da semana<br/>no escopo com almocoDevido > 0]
    C --> D{vazio?} -- sim --> E[toast Nao ha almocos pendentes<br/>warning + return]
    D -- nao --> F[valor = soma almocoDevido]
    F --> G[confirm Marcar N lancamentos como pagos valor?]
    G -- cancela --> H[aborta — sem persistDB]
    G -- confirma --> I[para cada pendente:<br/>pgtoStatus = Pago; valpago = vtotal]
    I --> J[await persistDB]
    J --> K[renderAlmocos + toast Fechamento registrado]
```

🔴 O fechamento **não gera lançamento separado em `financeiro`** — ele apenas altera o status e o `valpago` dos registros de almoço. Ao contrário de presença, almoços não têm PIX em lote.

## 7. Autorização nas rules

```mermaid
flowchart TD
    A[.write em tenants/tid/almocos] --> B{super_admin ou e-mail mestre?} -- sim --> H[permitido]
    B -- nao --> C{mesmo tenant + billing ativo?} -- nao --> D[negado]
    C -- sim --> E{admin/emailAdmin ou encarregado/mestre ou engenheiro?} -- sim --> H
    E -- nao --> F{rh com modulosPermitidos.almocos true<br/>na claim ou perfil?} -- sim --> H
    F -- nao --> D
```

🟢 O módulo do RH aqui se chama `almocos` (diferente de `trabalhadores`, que usa `funcionarios`). O filtro por obra é aplicado apenas no cliente; as rules autorizam a escrita em todo o nó `almocos` do tenant.
