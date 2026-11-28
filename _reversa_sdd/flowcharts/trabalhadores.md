# Fluxograma — Módulo `trabalhadores`

> 🟢 CONFIRMADO — `public/pages/trabalhadores.html`, `public/modals/modal-trabalhador.html`, `public/js/app_core.js`, `public/js/utils.module.js`, `public/js/pix_logic.js`, `public/js/data_core.js`, `database.rules.json`, `tests/aprovacoes-ui.test.js`, `tests/aprovacoes-api.test.js`, `tests/obra-select-modal.test.js`, `tests/rh-customizavel.test.js`, `tests/escopo-obras-paginas.test.js`, `tests/security/rules.test.js`.

## 1. Listagem e indicadores

```mermaid
flowchart TD
    A[abrir página trabalhadores] --> B[renderTrabalhadores]
    B --> C[currentMonth = new Date.toISOString substring 0,7<br/>UTC YYYY-MM]
    C --> D[DB.trabalhadores.map com índice original<br/>filter trabNoEscopoAtual]
    D --> E[para cada visível: buscar presenca<br/>por cod OR nome]
    E --> F[assiduidade = Presentes / Presentes+Faltas]
    F --> G[faltasMes = Falta com data no mês atual]
    G --> H[saldo = soma presenca.total<br/>menos financeiro source=pre e forn=nome e status=Pago]
    H --> I[render tabela: cod, nome/função, assiduidade,<br/>faltas, saldo, diária, status badge]
    I --> J[botão Editar usa índice original<br/>botão Excluir chama deleteItem trabalhadores]
    I --> K{sem visíveis?} -- sim --> L[uiEmptyState Sem Trabalhadores]
    A --> M[busca filterTable trab-tbody colunas 1,2,3]
```

🟡 O mês é calculado em UTC (`toISOString()`), não em `America/Sao_Paulo` como `getTodayBR()`.

## 2. Escopo por obra

```mermaid
flowchart TD
    A[trabNoEscopoAtual t] --> B[escopoObrasDaSessao]
    B --> C{window.trabNoEscopo existe?} -- nao --> D[true — sem restrição]
    C -- sim --> E{permitidas é array?} -- nao --> D
    E -- sim --> F{permitidas vazio?} -- sim --> G[false — falha fechada]
    F -- nao --> H[parseObrasTrabalhador t]
    H --> I{obras vazias?} -- sim --> J[true — legado sem restrição]
    H -- nao --> K[alguma obra em permitidas?] -- sim --> L[true]
    K -- nao --> M[false]
    N[parseObrasTrabalhador] --> O{raw é array?} -- sim --> P[map String + trim + remove vazios]
    O -- nao --> Q[split /[,;]/ + trim + remove vazios]
    Q --> R[comparação exata: OB1 não casa com OB10]
```

`trabsNoEscopoAtual(lista)` é a versão em lote; `trabNaObra(t, cod)` é usada no formulário de presença e considera trabalhador sem obra como irrestrito.

## 3. Modal e vínculo com obras

```mermaid
flowchart TD
    A[openModal modal-trabalhador] --> B[tr-idx = -1 via reset de modal]
    A --> C[prepararSelectsDeObra]
    C --> D[obras visíveis = DB.obras filtradas por obraNoEscopoAtual]
    D --> E[preenche select multiple tr-obras<br/>com cod — nome]
    E --> F{escopo tem 1 código?} -- sim --> G[seleciona e desabilita tr-obras]
    F -- nao --> H[seleção múltipla Ctrl/Cmd+clique]
    G & H --> I[syncTrabObrasHint: N obra(s) selecionada(s)]
    A --> J[campos: cod, nome, cpf, função, vínculo,<br/>equipe, diária, pgto, PIX, contato,<br/>status, admissão, endereço, cidade, foto]
    J --> K[tr-last-pay somente leitura<br/>preenchido em editTrabalhador]
```

`lerObrasDoFormTrabalhador()` lê `selectedOptions` e devolve `'OB1, OB2'`; se o elemento não for `multiple`, usa `el.value` (compatibilidade com campo de texto legado).

## 4. Cadastro e desvio para aprovação

```mermaid
flowchart TD
    A[saveTrabalhador] --> B[tr-idx => editIdx]
    B --> C{cod preenchido?} -- nao --> C1[toast Informe o código + return]
    C -- sim --> D{cod já existe em outro registro?} -- sim --> D1[toast Código já existe + return]
    D -- nao --> E[lerObrasDoFormTrabalhador + parseObrasTrabalhador]
    E --> F{alguma obra fora do escopo?} -- sim --> F1[toast só pode vincular às obras do acesso + return]
    F -- nao --> G[monta data: 19 campos<br/>pixkey normalizada por cleanPixKey<br/>foto do hidden ou anterior]
    G --> H{desviarParaAprovacao disponível?}
    H -- sim --> I{editIdx >= 0?}
    I -- sim --> I1[toast Alteração de cadastro exige aprovação + return]
    I -- nao --> J[desviarParaAprovacao trabalhador_add<br/>payload trabalhador: data]
    J --> K{desviado?} -- sim --> K1[closeModal + return]
    K -- nao --> L[escrita direta]
    H -- nao --> L
    L --> M{editIdx >= 0?}
    M -- sim --> N[DB.trabalhadores[editIdx] = data + cascata]
    M -- nao --> O[DB.trabalhadores.push data<br/>toast Novo trabalhador cadastrado]
    N & O --> P[renderTrabalhadores + renderPresenca<br/>renderDashboard + renderFinanceiro]
    P --> Q[await persistDB true]
    Q --> R{erro?} -- sim --> R1[toast Salvo localmente. Erro na nuvem: code]
```

🔴 Com o desvio ativo, **toda edição é bloqueada**; a cascata e o recálculo retroativo de diária ficam inalcançáveis no fluxo normal.

## 5. Edição com cascata e recálculo retroativo

```mermaid
flowchart TD
    A[editTrabalhador idx] --> B[openModal + tr-idx = idx]
    B --> C[restaura campos, multi-select obras,<br/>preview da foto, tr-last-pay]
    C --> D{alterou nome ou código?} -- sim --> E[propaga para:]
    E --> E1[presenca.nome / presenca.trab]
    E --> E2[tarefas.resp]
    E --> E3[financeiro.forn]
    E --> E4[medicao.equipe]
    E --> E5[almocos.empreiteiro]
    E --> E6[obras.mestre]
    D -- nao --> F{diária mudou?}
    E1 & E2 & E3 & E4 & E5 & E6 --> F
    F -- sim --> G[para cada presença do trabalhador<br/>com pgtoStatus diferente de Pago]
    G --> H{presenca?}
    H -- Falta --> H1[total = 0]
    H -- Meio período --> H2[total = nova diária / 2]
    H -- vínculo Informal --> H3[total = nova diária]
    H -- hnorm > 0 --> H4[total = diária + hextra * diária/8 * 1.5]
    H -- senão --> H5[total = 0]
    H1 & H2 & H3 & H4 & H5 --> I[toast Cadastro e históricos atualizados]
    F -- nao --> I
```

`tr-last-pay` consulta `financeiro` por `f.trab === t.cod` com `status === 'Pago'` ou `pgtoStatus === 'Pago'`, ordenado por data decrescente.

## 6. Exclusão

```mermaid
flowchart TD
    A[deleteItem trabalhadores idx] --> B{confirm contextual?}
    B -- cancela --> C[aborta]
    B -- confirma --> D{requerAprovacao?}
    D -- sim --> E[desviarParaAprovacao trabalhador_remove<br/>payload cod]
    E --> F{desviado?} -- sim --> C
    D -- nao --> G[DB.trabalhadores.splice idx,1]
    F -- nao --> G
    G --> H[persistDB + re-render da página ativa]
```

Nota: o payload do desvio de remoção contém apenas `cod`; o de criação contém o cadastro completo (CPF, chave PIX e endereço inclusos).

## 7. Uso em presença e PIX

```mermaid
flowchart TD
    A[filterTrabByObra] --> B[pr-obra.value]
    B --> C[trabsNoEscopoAtual filtra status Ativo]
    C --> D[trabNaObra t, obraSelecionada]
    D --> E{populou?} -- nao --> E1[option Nenhum trabalhador nesta obra<br/>limpa pr-diaria e pr-funcao]
    D -- sim --> F[preenche pr-trab + pr-lista-trabs-massa]
    F --> G[fillTrabInfo recalcula visibilidade de HE]
    H[selectAllTrabs check] --> I[marca/desmarca .pr-massa-check]
    J[cleanPixKey key,type] --> K{detecta tipo quando ausente}
    K --> L[cpf/cnpj: só dígitos<br/>email: lowercase<br/>telefone/aleatória: normaliza]
    L --> M[pixkey persistida no cadastro]
```

## 8. Autorização nas rules

```mermaid
flowchart TD
    A[.write em tenants/tid/trabalhadores] --> B{super_admin ou e-mail mestre?} -- sim --> H[permitido]
    B -- nao --> C{mesmo tenant + billing ativo?} -- nao --> D[negado]
    C -- sim --> E{admin / emailAdmin?} -- sim --> H
    E -- nao --> F{rh com modulosPermitidos.funcionarios true<br/>na claim ou perfil?} -- sim --> H
    F -- nao --> D
    G[limiteTrabalhadores padrão 9999<br/>editável pelo painel master] --> C
```

Diferente de `tarefas`/`presenca`, **encarregado, mestre e engenheiro não têm escrita direta** em `trabalhadores`: no canteiro a criação passa por `trabalhador_add`.
