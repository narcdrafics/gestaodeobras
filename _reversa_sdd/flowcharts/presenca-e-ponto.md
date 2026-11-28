# Fluxograma — Módulo `presenca-e-ponto`

> 🟢 CONFIRMADO — `public/pages/presenca.html`, `public/modals/modal-presenca.html`, `public/js/app_core.js`, `public/js/utils.module.js`, `database.rules.json`, `tests/helpers.test.js`, `tests/dashboard.test.js`, `tests/budget-fixes.test.js`, `tests/report.test.js`, `tests/escopo-obras-paginas.test.js`, `tests/rh-customizavel.test.js`, `tests/security/rules.test.js`.

## 1. Quadro semanal

```mermaid
flowchart TD
    A[renderPresenca chama renderQuadroSemanal] --> B[currentWeekOffset]
    B --> C[segunda da semana atual + offset*7]
    C --> D[gera 7 datas YYYY-MM-DD<br/>Seg a Dom]
    D --> E[workers = trabsNoEscopoAtual<br/>filtra status Ativo]
    E --> F{vazio?} -- sim --> G[mensagem Nenhum trabalhador ativo]
    E --> nao --> H[para cada worker x cada dia]
    H --> I[findIndex em DB.presenca:<br/>data igual + obra no escopo + trabNaObra<br/>+ trab=cod ou nome legado]
    I --> J{encontrou?}
    J -- nao --> K[ícone more_horiz Sem registro]
    J -- Presente --> L[check_circle verde]
    J -- Falta --> M[cancel vermelho]
    J -- Meio período --> N[contrast laranja]
    K & L & M & N --> O[célula clicável<br/>openPresenceModal cod,data,idx]
    O --> P{idx >= 0?} -- sim --> Q[editPresenca idx]
    P -- nao --> R[openModal + preenche trabalhador/data<br/>via setTimeout 300ms + fillTrabInfo]
    S[changeWeek offset] --> T[currentWeekOffset += offset<br/>re-render do quadro]
```

## 2. Modal: individual × massa

```mermaid
flowchart TD
    A[openModal modal-presenca] --> B[pr-edit-idx = -1]
    B --> C{togglePresencaModo}
    C -- individual --> D[mostra pr-indiv-grp<br/>oculta pr-massa-grp<br/>fillTrabInfo]
    C -- massa --> E[oculta pr-indiv-grp e pr-hextra-grp<br/>mostra pr-massa-grp<br/>filterTrabByObra]
    E --> F[checks de trabalhadores Ativos<br/>no escopo e na obra]
    F --> G[selectAllTrabs marca todos]
    D --> H[fillTrabInfo: funcao + diaria da ficha<br/>esconde HE se vinculo Informal]
    H --> I[calcPresenca recalcula horas e total]
    A --> J[togglePresenca: Falta esconde<br/>entrada/saída e zera total]
    A --> K[toggleParcial pr: mostra valpago<br/>se status Parcial]
    K --> L[calcParcial: aviso Falta Pagar / excede / quitado]
```

`filterTrabByObra` usa `trabsNoEscopoAtual` + `trabNaObra(t, obraSelecionada)` e limpa `pr-diaria`/`pr-funcao` quando não há trabalhadores na obra.

## 3. Cálculo de horas e valor

```mermaid
flowchart TD
    A[calcPresenca] --> B{presenca = Falta?} -- sim --> C[total = 0; hnorm = 0; hextra = 0]
    B -- nao --> D{Meio período?} -- sim --> E[hnorm = 4.0; hextra = 0; total = diaria/2]
    D -- nao --> F[hTrabalhadas = saida - entrada em minutos / 60]
    F --> G[hnorm = min hTrabalhadas, 8<br/>hextra = 0 explícito]
    G --> H[total = diaria se hTrabalhadas > 0, senão 0]
    I[calcTotalManual ao alterar hnorm/hextra] --> J{Informal?} -- sim --> J1[hextra = 0 e trava campo]
    J -- nao --> K{Meio período?} -- sim --> K1[total = diaria/2]
    K -- nao --> L[valorHora = diaria/8<br/>total = hnorm>0 ? diaria + hextra*valorHora*1.5 : 0]
```

🟡 `calcPresenca` ignora a diária proporcional a menos de 8h (usa a diária cheia); `calcTotalManual` usa `diária/8` para hora extra, enquanto `getPresencaCusto` em `utils.module.js` usa `diária/hnorm` — critérios diferentes.

## 4. Salvamento (individual e em massa)

```mermaid
flowchart TD
    A[savePresenca keepOpen] --> B{modo massa?}
    B -- sim --> C[checks .pr-massa-check:checked<br/>exige ao menos 1]
    B -- nao --> D[pr-trab<br/>exige trabalhador]
    C & D --> E{data e obra preenchidas?} -- nao --> F[toast erro]
    E --> G{obra no escopo?} -- nao --> F
    G --> sim --> H[para cada trabalhador]
    H --> I{já existe registro na data?<br/>trab=cod ou nome legado}
    I -- sim --> J[toast Já existe registro<br/>massa: continua; individual: return]
    I -- nao --> K{trabalhador não atua na obra?}
    K -- sim --> L[anexa código ao campo obras<br/>comparação exata]
    K -- nao --> M[monta registro]
    L --> M
    M --> N[valor: Falta=0; Meio=diaria/2;<br/>Informal=diaria; senão pr-total<br/>ou diária do cadastro]
    N --> O{editIdx >= 0 e não massa?} -- sim --> P[DB.presenca[editIdx] = data]
    O -- nao --> Q[DB.presenca.push data]
    P & Q --> R{keepOpen?}
    R -- sim --> S[limpa campos, pr-edit-idx=-1,<br/>togglePresenca mantém modal]
    R -- nao --> T[closeModal]
    S & T --> U[await persistDB]
    U --> V{erro?} -- sim --> W[toast Salvo localmente, falhou na nuvem]
    U -- nao --> X[toast Presença registrada/atualizada<br/>ou Falta Pagar se Parcial]
    W & X --> Y[renderPresenca + renderFinanceiro + renderDashboard]
```

## 5. Listagem, KPIs e fechamentos

```mermaid
flowchart TD
    A[renderPresenca] --> B[filtra presenças com data<br/>e obra no escopo]
    B --> C[normaliza total de registros antigos<br/>com diária > 0 e total <= 0]
    C --> D[KPIs de hoje: presentes, faltas, total a pagar]
    D --> E[listForTable com _idx original<br/>ordena data asc/desc]
    E --> F{agrupar por?}
    F -- trab/obra --> G[group-header recolhível<br/>com total do grupo]
    F -- lista plana --> H[linhas com horários, horas,<br/>status, valor, pgto, saldo]
    G --> I[filterPresenca por texto<br/>nome/obra/data]
    H --> I
    B --> J[summarizePresence: últimas 10 datas<br/>presentes/faltas/total]
    B --> K[calcWeeklyPendingPayments:<br/>segunda até hoje,<br/>Pendente/Parcial/Atrasado]
    B --> L[fechamento por trabalhador:<br/>dias trabalhados, faltas,<br/>total e pendente]
    J --> M[pres-totais]
    K --> N[pres-pgto-pendentes]
    L --> O[pres-empreitada]
    A --> P[renderQuadroSemanal]
```

`groupMode` vem de `#pres-group-select` (`trab`, `obra` ou vazio); `sortVal` de `#pres-sort-select` (`data_desc`/`data_asc`).

## 6. Fechamento em lote e PIX

```mermaid
flowchart TD
    A[prepareLotePgto periodo] --> B{feature pix.folha?} -- nao --> C[aborta]
    B -- sim --> D[modal-lote]
    D --> E{periodo = custom?}
    E -- sim --> F[dataIni/dataFim dos inputs<br/>ou parâmetros]
    E -- nao --> G[semana / quinzenal / mes<br/>via getSemanaRange etc.]
    F & G --> H[filtra DB.presenca:<br/>pgtoStatus != Pago e data no range]
    H --> I[agrupa por trab ou nome-funcao]
    I --> J[devido = total - valpago se Parcial]
    J --> K{devido > 0?}
    K -- sim --> L[acrescenta diarias e valor<br/>registra datas]
    K -- nao --> M[registra em descontados]
    L & M --> N[window.lotePendentes ordenado por valor desc]
    N --> O[renderLoteTbody: checkbox,<br/>datas, diarias, valor]
    O --> P[updateLoteTotal soma selecionados]
    O --> Q[initiatePixPayment lote, i]
```

## 7. Autorização nas rules

```mermaid
flowchart TD
    A[.write em tenants/tid/presenca] --> B{super_admin ou e-mail mestre?} -- sim --> H[permitido]
    B -- nao --> C{mesmo tenant + billing ativo?} -- nao --> D[negado]
    C --> sim --> E{admin/emailAdmin ou encarregado/mestre ou engenheiro?} -- sim --> H
    E -- nao --> F{rh com modulosPermitidos.presenca true<br/>na claim ou perfil?} -- sim --> H
    F -- nao --> D
```

Registro de ponto é escrita direita permitida a admin, encarregado/mestre e engenheiro (`tests/security/rules.test.js`); ao contrário de trabalhadores, **não** passa por aprovação.
