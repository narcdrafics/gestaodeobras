# Fluxograma — Módulo `obras`

> 🟢 CONFIRMADO — `public/pages/obras.html`, `public/modals/modal-obra.html`, `public/js/app_core.js`, `public/js/data_core.js`, `public/js/utils.module.js`, `database.rules.json`, `tests/acesso-por-obra.test.js`, `tests/escopo-obras-paginas.test.js`, `tests/obra-select-modal.test.js`.

## 1. Cadastro e edição

```mermaid
flowchart TD
    A[obras.html: + Nova Obra -> modal-obra] --> B[saveObra]
    B --> C{codigo informado?} -- não --> C1[toast: informe o codigo da obra]
    C --> sim --> D{editando?}
    D -- não --> E{codigo duplicado?} -- sim --> E1[toast: codigo ja existe]
    E -- não --> F{DB.obras.length >= getPlanLimits().obras?}
    F -- sim --> F1[toast: limite do plano; faca upgrade]
    F -- nao --> G[DB.obras.push dados do modal]
    D -- sim --> H[DB.obras[editIdx] = dados]
    G & H --> I[closeModal + persistDB + renderObras + renderDashboard]
    I --> J[persistDB: update multi-path no tenant<br/>com mergeScopedDb se usuario restrito]
```

### Campos do modal

`cod`, `nome`, `end`, `tipo`, `status`, `inicio`, `prazo`, `orc`, `mestre`, `eng`, `cliente`, `cliente_contato`, `contrato_tipo`, `obs`.

`editObra(idx)` copia o registro para o modal e grava o índice em `#ob-edit-idx`; `deleteItem('obras', idx)` remove do array e persiste (validação final nas rules).

## 2. Renderização e indicadores

```mermaid
flowchart TD
    A[renderObras] --> B[para cada obra do DB (ja filtrado por escopo)]
    B --> C[fReal = soma financeiro.real da obra]
    C --> D[pctCusto = fReal / orc * 100]
    B --> E[avgFisico = media tarefas.perc da obra]
    D & E --> F[card: nome, status, endereco,<br/>barra de progresso, orcamento, % custo]
    F --> G[acoes: WhatsApp, Tarefas]
    B --> H[tabela: nome, cod, status, prazo, orcamento, mestre,<br/>Editar/Excluir com indice original]
```

Cor da barra: verde se `>70%`, âmbar se `>30%`, laranja caso contrário. `% custo` fica vermelho quando `fReal > orc`.

## 3. Escopo de obras (filtragem no cliente)

```mermaid
flowchart TD
    A[sessao gestaoUser: email + role] --> B[escopoObrasDaSessao]
    B --> C{role mestre?} -- sim --> C1[normaliza para encarregado]
    C -- nao --> D{admin/super_admin?}
    D -- sim --> D1[null = todas as obras]
    D -- nao --> E[getObrasPermitidas: procura usuario por e-mail<br/>case-insensitive em DB.usuarios]
    E --> F{acessoObras == 'especificas'?} -- nao --> D1
    F -- sim --> G[obrasPermitidas como array de codigos]
    G --> H[lista vazia = falha fechada: nenhuma obra]

    D1 & G --> I[filterDbByObras na carga]
    I --> I1[filtra obras por cod e OBRA_SCOPED_KEYS por campo 'obra']
    G --> J[mergeScopedDb na gravacao]
    J --> J1[ultimos itens fora do escopo vem do snapshot completo<br/>itens dentro vem do DB filtrado]
    J1 --> K{snapshot completo ausente?} -- sim --> K1[retorna null: nao grava para nao apagar dados]
    J --> L[impede gravar registro em obra fora do escopo]
```

`OBRA_SCOPED_KEYS = [presenca, tarefas, estoque, movEstoque, compras, financeiro, orcamento, medicao, almocos]`.

## 4. Seletores de obra e ficha do trabalhador

```mermaid
flowchart TD
    A[prepararSelectsDeObra ao abrir modal] --> B[obras visiveis = DB.obras filtradas por escopo]
    B --> C{usuario tem exatamente uma obra permitida?}
    C -- sim --> C1[adiciona codigo unico se ausente,<br/>seleciona e trava o select, dispara change]
    C -- nao --> D[dropdown com todas as visiveis]
    B --> E[preenche selects pr-/fn-/cp-/md-/tf-/es-/mv-/oc-obra<br/>e o multi-select tr-obras]
    F[parseObrasTrabalhador] --> G[texto 'OB1, OB2' ou array migrado]
    G --> H[comparacao exata: OB1 nao casa com OB10]
    H --> I[trabNaObra / trabNoEscopo / trabalhadoresNoEscopo]
```

## 5. Resumo via WhatsApp

```mermaid
flowchart TD
    A[shareObraWhatsApp cod] --> B[busca obra + tarefas + financeiro + presenca do dia]
    B --> C[avgFisico = media perc das tarefas]
    C --> D[fReal = soma real do financeiro]
    D --> E[presentes = presenca de hoje com 'Presente']
    E --> F[monta mensagem com progresso, gasto, equipe e tarefas concluidas]
    F --> G[encodeURIComponent + link wa.me]
```

## 6. Autorização nas rules

```mermaid
flowchart TD
    A[.write em tenants/tid/obras] --> B{super_admin / e-mail mestre?} -- sim --> H[permitido]
    B -- nao --> C{mesmo tenant + billing ativo?} -- nao --> D[negado]
    C --> sim --> E{admin / emailAdmin / engenheiro?} -- sim --> H
    E -- nao --> F{rh com modulosPermitidos.obras === true?} -- sim --> H
    F -- nao --> D
```
