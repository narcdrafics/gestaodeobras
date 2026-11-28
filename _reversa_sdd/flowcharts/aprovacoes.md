# Fluxograma — Módulo `aprovacoes`

> 🟢 CONFIRMADO — `functions/aprovacoes.js`, `functions/aprovacoes-api.js`, `functions/index.js`, `public/js/aprovacoes_ui.js`, `public/pages/aprovacoes.html`, `public/modals/modal-aprovacao.html`, `database.rules.json`, `tests/aprovacoes*.test.js`.

## 1. Solicitação (cliente)

```mermaid
flowchart TD
    A[save* do app: estoque/trabalhador/financeiro/compra/orçamento/medição] --> B{requerAprovacao?<br/>papel encarregado/engenheiro/rh}
    B -- não --> C[escrita direta pelo admin/comprador]
    B -- sim --> D[desviarParaAprovacao tipo,payload,descrição,alvo]
    D --> E{solicitação idêntica pendente nos últimos 60s<br/>mesmo solicitante/tipo/descrição/payload?}
    E -- sim --> E1[toast: já enviada; reusa id]
    E -- não --> F[push em tenants/tenantId/aprovacoes]
    F --> G[status=pendente, solicitadoPor, solicitadoEm=now,<br/>expiraEm=now+15 dias, payload, descricao, alvo]
    G --> H{rules: mesmo tenant, billing ativo,<br/>papel permite o tipo, expiraEm exato, sem alertas/aplicadoEm?}
    H -- não --> H1[PERMISSION_DENIED]
    H -- sim --> I[listener on('value') atualiza cache, DB.aprovacoes,<br/>tabela e badge]
```

## 2. Decisão (`POST /api/admin/aprovacao`)

```mermaid
flowchart TD
    A[abrirAprovacao: relê nó, atualiza claim/perfil,<br/>mostra payload sem campos sensíveis] --> B[decidirAprovacao id, aprovado|rejeitado]
    B --> C{podeDecidir no cliente?} -- não --> C1[toast: cargo não permite]
    C -- sim --> D{rejeição sem motivo?} -- sim --> D1[toast: informe o motivo]
    D -- não --> E[POST com Bearer token]
    E --> F{POST + Bearer + token válido checkRevoked?} -- não --> F1[401]
    F --> G[verificarChamador: Auth + profiles + super_admins + users/<email>]
    G --> H{conta ativa?} -- não --> H1[403 conta_bloqueada]
    H --> I[papelEfetivo = maior entre claim e perfil na hierarquia]
    I --> J{cotas IP/UID 60/min ok?} -- não --> J1[429]
    J --> K{dados válidos, decisão aprovado/rejeitado,<br/>motivo se rejeitado?} -- não --> K1[400]
    K --> L{apovação pendente, não expirada/aplicada,<br/>tipo e payload válidos?} -- não --> L1[404/409/400]
    L --> M{billingState ativo?} -- não --> M1[403 plano_bloqueado]
    M --> N{tenant do perfil casa<br/>(master pode operar outro tenant)?} -- não --> N1[403 tenant_invalido]
    N --> O{papelPodeDecidir: admin/super_admin/emailAdmin<br/>OU rh com módulos aprovacoes+tipo<br/>OU engenheiro em movimentacao_estoque com notificarAdmin}
    O -- não --> O1[403 sem_permissao + diagnóstico papel/claim/perfil]
    O -- sim --> P[transação no nó: só o primeiro decide pendente]
    P --> Q{committed?} -- não --> Q1[409 ja_decidida]
    Q -- sim --> R[status, decididoPor, decididoEm, decididoPorPapel,<br/>motivo se rejeitado, notificarAdmin se engenheiro,<br/>decididoPorModulos se rh]
    R --> S[auditoria decidir_aprovacao + 200 ok]
```

## 3. Aplicação da operação (trigger + idempotência)

```mermaid
flowchart TD
    A[onValueWritten tenants/tenantId/aprovacoes/aprovacaoId] --> B{status aprovado e antes não era aprovado?}
    B -- não --> B1[ignorado]
    B -- sim --> C[aplicarAprovacaoPorId]
    C --> D[transação: reserva reservadoEm=now<br/>somente se não aplicado/expirado/erro]
    D --> E{committed?} -- não --> E1[ja_processada_ou_reservada]
    E -- sim --> F{podeAplicar: status aprovado, não expirado,<br/>tipo conhecido, payload, decisor, decisor com autoridade}
    F -- não --> G[marcarFalha: status=erro, motivo, falhaEm,<br/>reservadoEm=null + notifica admins]
    F -- sim --> H[ler estado do tenant + admins do tenant]
    H --> I[construirEfeitos por tipo: Calculo puro, sem I/O]
    I --> J[update multi-path: efeitos + aplicadoEm + auditoria<br/>+ notificações + aviso extra se engenheiro]
    J -- falha --> G
    J -- ok --> K[aplicado: true]
    K --> L[reserva órfã com >10 min é retomada<br/>pelo job diário com retomar=true]
```

## 4. Efeitos aplicados por tipo

```mermaid
flowchart TD
    A{aprovacao.tipo} --> B[movimentacao_estoque:<br/>entrada/saída/retorno/transferência<br/>atualiza estoque + movEstoque]
    A --> C[trabalhador_add / trabalhador_remove:<br/>insere/remove da lista]
    A --> D[financeiro_lancamento:<br/>nasce Pendente com valpago=0]
    A --> E[financeiro_status:<br/>Pago=total, Pendente/Atrasado=0, Parcial=valor informado]
    A --> F[orcamento_fechamento / medicao_fechamento:<br/>recalcula vtotal, marca aprovadoPor/aprovadoEm]
    A --> G[compra_criacao:<br/>registro público sem dados comerciais<br/>+ comprasPrivadas/tenant/compraId]
```

## 5. Job diário de prazos (`06:00 America/Sao_Paulo`)

```mermaid
flowchart TD
    A[processarAprovacoesJob] --> B[varre todos os tenants]
    B --> C{aprovado com reservadoEm e sem aplicadoEm?} -- sim --> C1[retoma aplicação se reserva com >10 min]
    B --> D{status pendente?} -- não --> D1[ignora]
    D --> E{expiraEm <= agora?} -- sim --> E1[status=expirado + expiradoEm<br/>+ notifica solicitante e admins]
    D --> F[alertasDevidos: 7, 12 e 15 dias]
    F --> G[transação grava alertas[dia]=now<br/>e envia notificação uma única vez]
    C1 & E1 & G --> H[resultado: tenants, alertas, expiradas, retomadas, erros]
```

## 6. UI e privacidade

```mermaid
flowchart TD
    A[aprovacoes.html: filtros status/tipo] --> B[renderAprovacoes: badge de prazo, status, botão Decidir/Ver]
    B --> C[abrirAprovacao: relê nó + papel vigente]
    C --> D{papel restrito? encarregado/engenheiro} -- sim --> D1[payloadParaExibicao remove forn,pixkey,vunit,vtotal,vorc,prazo e compraPrivada]
    C --> E{engenheiro pode decidir?} -- sim --> E1[checkbox Confirmar aviso ao administrador]
    C --> F{pode decidir?} -- não --> F1[somente leitura]
    A --> G[badges: aprovacoes-badge para admin/engenheiro<br/>notificacoes-badge com sessionStorage de vistas]
    A --> H[registrarAuditoriaOperacional: histórico local<br/>em localStorage, máx. 200 entradas]
```
