# Fluxograma — Módulo `tarefas`

> 🟢 CONFIRMADO — `public/pages/tarefas.html`, `public/modals/modal-tarefa.html`, `public/js/app_core.js`, `public/js/data_core.js`, `public/js/utils.module.js`, `functions/whatsapp/parser-tarefas.js`, `database.rules.json`, `tests/tarefas-dashboard.test.js`, `tests/tarefas-fotos.test.js`, `tests/security/rules.test.js`, `tests/security/tenant-isolation.test.js`.

## 1. Cadastro e edição

```mermaid
flowchart TD
    A[obras/dashboard: + Nova Tarefa] --> B[openModal modal-tarefa]
    B --> C[tf-cod = nextCod DB.tarefas 'TF'<br/>campo somente leitura]
    C --> D[prepararSelectsDeObra: obras no escopo<br/>se única obra, select travado]
    D --> E[preenche: obra, etapa, frente, desc, resp,<br/>prior, status, criacao, prazo, conclusao, perc, obs]
    E --> F[saveTarefa]
    F --> G{editIdx >= 0?}
    G -- não --> H[DB.tarefas.push data]
    G -- sim --> I[DB.tarefas[editIdx] = data]
    H & I --> J[closeModal + persistDB + renderTarefas]
    J --> K[persistDB: update multi-path<br/>mergeScopedDb se usuário restrito]
    K --> L[renderDashboard se painel de tarefas visível]
```

`editTarefa(idx)` abre o mesmo modal, grava `#tf-edit-idx`, restaura os campos e repovoa `window._tarefaPhotos` com `taskPhotoList(t)`.

## 2. Renderização, filtros e KPIs

```mermaid
flowchart TD
    A[renderTarefas] --> B{modo salvo em _taskViewMode}
    B -- table --> B1[mostra tar-table-container]
    B -- kanban --> B2[mostra tar-kanban-container]
    A --> C[lê filtros: obra, status, prioridade, responsável,<br/>vencidas, minhas, ordem, busca]
    C --> D[repovoa tar-resp-filter a partir de DB.tarefas.resp<br/>preservando seleção]
    C --> E[para cada tarefa: _idx, _atrasada, _status efetivo, _venceHoje]
    E --> F[filtra por obra/prior/resp/vencidas/minhas/status/busca]
    F --> G{status = abertas?} -- sim --> G1[exclui Concluída]
    F --> H{status = atrasadas?} -- sim --> H1[só _atrasada]
    F --> I{status literal?} -- sim --> I1['A fazer' casa com 'Pendente'<br/>legado]
    G1 & H1 & I1 --> J[ordena: prazo, prioridade, status ou recentes]
    J --> K[KPIs filtrados: total, concluídas, andamento,<br/>pendentes, atrasadas]
    K --> L{modo?}
    L -- table --> M[renderTaskTable: linha, badges,<br/>ações rápidas, fotos, barra de %]
    L -- kanban --> N[renderKanban: 3 colunas<br/>Pendente / Em andamento / Concluída]
```

Busca usa `onTaskSearch()` com debounce de **220 ms**; `limparFiltrosTarefas()` zera selects, checks e busca.

### Status efetivo

```mermaid
flowchart TD
    A[tarefaStatusEfetivo t] --> B{status === Concluída?}
    B -- sim --> C[não é atrasada]
    B -- não --> D{prazo && prazo < getTodayBR?}
    D -- sim --> E[status efetivo = Atrasada<br/>mesmo gravando 'A fazer']
    D -- não --> F[status efetivo = status gravado<br/>ou 'A fazer']
```

`getTodayBR()` usa `America/Sao_Paulo` (YYYY-MM-DD). Aliases legados: `Pendente` ≡ `A fazer`; `mestre` ≡ `encarregado` na sessão.

## 3. Ações rápidas e desfazer

```mermaid
flowchart TD
    A[concluir / reabrir / iniciar / mover] --> B[snapshotTarefas:<br/>cópia profunda de DB.tarefas]
    B --> C{qual ação?}
    C -- toggleTarefaConcluida --> D{status === Concluída?}
    D -- sim --> D1[status='A fazer', conclusao='', perc=0]
    D -- não --> D2[status='Concluída', conclusao=getTodayBR(), perc=100]
    C -- iniciarTarefa --> E{status em Em andamento/Concluída/Pausada?}
    E -- não --> E1[status='Em andamento'; perc min=10]
    C -- moverTarefaStatus --> F{status efetivo já é o destino?}
    F -- sim --> F1[ignora]
    F -- não --> F2[grava status; Concluída=>perc 100<br/>senão limpa conclusao]
    F2 --> F3[se perc anterior >=100 e novo status != Concluída => 90]
    F3 --> F4[Em andamento com perc<10 => 10]
    D1 & D2 & E1 & F4 --> G[persistDB + renderTarefas<br/>renderDashboard se presente]
    G --> H[toastComDesfazer: botão 'Desfazer' por 6s]
    H --> I{desfazerAcao?}
    I -- sim --> J[DB.tarefas = snapshot + persistDB + re-render]
```

`concluirTarefaRapida` é um atalho para `toggleTarefaConcluida` quando ainda não está concluída. `opts.semSnapshot`/`opts.semToast` permitem reutilizar o movimento sem gerar novo snapshot/toast.

## 4. Kanban (drag & drop)

```mermaid
flowchart TD
    A[card draggable=true] --> B[onTaskDragStart: guarda índice<br/>dataTransfer text/plain]
    B --> C[onTaskDragOver no destino: preventDefault]
    C --> D[onTaskDrop e,status]
    D --> E{índice válido?}
    E -- não --> E1[ignora]
    E -- sim --> F[moverTarefaStatus idx,status]
    F --> G[+ Nova na coluna => abrirNovaTarefaNoStatus status]
    G --> G1[coluna Pendente cria tarefa com status 'A fazer']
```

Colunas usam o status **efetivo**: `A fazer`/`Pendente`/`Atrasada`/`Pausada` caem em `Pendente`.

## 5. Fotos/evidências

```mermaid
flowchart TD
    A[tf-file: image/* multiple] --> B[handleTarefaPhotos]
    B --> C{-vagas = 6 - fotos atuais}
    C --> D[limita seleção a vagas<br/>toast se excedeu]
    D --> E[optimizeImageFile maxDim=1280 quality=0.75]
    E --> F{uploadEvidenceFile}
    F -- Storage ok --> G[URL em tenants/tid/evidencias/arquivo]
    F -- Storage falha --> H{optimize gerou dataUrl?}
    H -- sim --> G
    H -- não --> H1[toast de erro e aborta lote]
    G --> I[window._tarefaPhotos.push url + re-render preview]
    I --> J[saveTarefa grava photos[] e photoUrl=photos[0]<br/>para leitores legados]
    J --> K[taskPhotoList normaliza photos/photoUrl/foto<br/>aceita http(s) ou data:image]
    K --> L[taskPhotoCaption: desc ou 'Tarefa'<br/>'desc · Foto n/N' se >1]
    L --> M[openTarefaFotos: galeria compartilhada<br/>com medições + setas do teclado]
```

Limite: `MAX_TAREFA_FOTOS = 6`. Na impressão de relatórios, a seção pode quebrar entre páginas, mas cada card de tarefa é mantido inteiro.

## 6. Resumo para dashboard

```mermaid
flowchart TD
    A[calcTarefasResumo db,hoje] --> B[abertas = status != Concluída]
    B --> C[itens = abertas com prazo<br/>e atrasadas ou vencemHoje]
    C --> D[atrasada: prazo < hoje<br/>venceHoje: prazo === hoje]
    D --> E[ordena por prazo e atrasadas primeiro]
    E --> F[calcDashboardResumo: tarefas + alertas]
    F --> G[TAREFA ATRASADA: 1 alerta alto agrupado]
    F --> H[TAREFA HOJE: 1 alerta médio por tarefa]
    F --> I[linhas por obra: tarefasFeitas/tarefasTotal]
    G --> J[dash-tarefas-grid: conclusão rápida<br/>verTarefasDashboard filtra abertas/prazo]
    H --> J
    I --> K[verTarefasDaObra cod filtra obra + abertas]
```

## 7. WhatsApp — rascunho de tarefas por áudio

```mermaid
flowchart TD
    A[áudio transcrito] --> B[handleAudioTarefas transcricao,tid,from]
    B --> C[extrairTarefas + detectarEtapas + detectarPrioridade]
    C --> D{tarefas encontradas?}
    D -- não --> E[resposta: não identifiquei tarefas + exemplo]
    D -- sim --> F[set tenants/tid/tarefas_pendentes/from<br/>transcricao, tarefas, timestamp]
    F --> G[preview numerado: etapa, frente, prioridade,<br/>status, confiança alta/média/baixa]
    G --> H{resposta do usuário}
    H -- CONFIRMAR --> I[confirmarTarefas]
    H -- 'EDITAR n texto' --> J[editarTarefaPendente]
    H -- CANCELAR --> K[cancelarTarefas: remove rascunho]
    I --> L[push em tenants/tid/tarefas por item:<br/>desc, etapa, etapaCodigo, frente, prioridade,<br/>status, resp padrão 'Equipe', prazo,<br/>criadoEm, criadoPor=from, createdVia]
    L --> M[remove rascunho + lista salvas]
    J --> N[reconhece etapa/prioridade do novo texto<br/>atualiza item e reenvia preview]
```

🔴 Fato: `functions/whatsapp/parser-tarefas.js` está implementado, mas não há chamador em `functions/`. 🟢 Decisão P2: ativar o fluxo de prévia/confirmação no webhook.

## 8. Autorização nas rules

```mermaid
flowchart TD
    A[.write em tenants/tid/tarefas] --> B{super_admin / e-mail mestre?} -- sim --> H[permitido]
    B -- nao --> C{mesmo tenant + billing ativo?} -- nao --> D[negado]
    C --> sim --> E{admin/emailAdmin ou encarregado/mestre ou engenheiro?} -- sim --> H
    E -- nao --> F{rh com modulosPermitidos.tarefas === true<br/>na claim ou no perfil?} -- sim --> H
    F -- nao --> D
    A2[.read/.write em tarefas_pendentes/tid] --> B2{super_admin/mestre ou mesmo tenant<br/>com billing ativo?} -- sim --> H2[permitido]
    B2 -- nao --> D2[negado]
```
