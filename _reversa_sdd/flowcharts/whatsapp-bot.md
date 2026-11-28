# Fluxograma — Módulo `whatsapp-bot`

> 🟢 CONFIRMADO — `functions/whatsapp_auth.js` (`seguroEqual` 27–31; `validarVerifyToken` 33–36; `validarAssinatura` 39–46; `normalizarTelefone` 49–53; `validarOrigem` 60–65; `extrairMensagem` 68–89; `urlAudioPermitida` 92–100; `autorizarRemetente` 107–139; `verificarEstado` 142–154; `reservarMensagem` 161–174; `handleWhatsappWebhook` 189–271), `functions/index.js:30-35,53-126,128-148,155-404,406-446,448-512,515-538`, `functions/whatsapp/obra-etapas.js:1-290`, `functions/whatsapp/parser-tarefas.js:1-142`, `functions/retencao.js:1-60`, `database.rules.json:74-76,211-222,241-267`, `tests/whatsapp-auth.test.js`, `tests/abuso.test.js:124-131`, `tests/plan-features.test.js:34-39,134`, `docs/wiki/whatsapp-bot/plano-implementacao-whatsapp.md`.

## 1. Visão geral

```mermaid
flowchart TD
    A[Meta WhatsApp Cloud API] -->|GET verify / POST messages| B[whatsappWebhook]
    B --> C[whatsapp_auth: verify token / HMAC-SHA256 / origem WABA]
    C --> D[extrairMensagem + dedup por msg.id]
    D --> E[autorizarRemetente: users -> telefonesPermitidos]
    E --> F[verificarEstado: status do usuario e billing do tenant]
    F --> G[processarMensagem injetado por index.js]
    G --> H{audio?}
    H -- sim --> I[Whisper transcribe]
    H -- nao --> J[intencao local ou GPT-4o-mini]
    I & J --> K{intencao}
    K -- criar_tarefa --> L[buscarObra -> tenants/tid/tarefas]
    K -- lancar_ponto --> M[buscarObra -> melhorMatch trabalhadores -> presenca]
    K -- consultar --> N[processarConsultaGeral]
    L & M & N --> O[responderWhatsApp via Graph API]
    P[dailyReport 21:00 UTC = 18h Brasilia] --> Q{hasFeature relatorio.whatsapp.diario?}
    Q -- sim --> R[monta resumo e envia para tenant.adminPhone]
    O & R --> A
```

🟢 A porta de entrada é validada por HMAC-SHA256 da Meta e por origem WABA/`phone_number_id`, mas **a autorização do tenant** é feita depois, com Admin SDK, em `whatsapp_auth.js` (`whatsapp_auth.js:6-17`). 🟢 A lógica de negócio é injetada em `index.js` (`processar` e `responder`), mantendo a camada de autenticação testável (`whatsapp_auth.js:185-188`). 🟢 O envio de respostas e do relatório usa a Graph API v20.0 (`index.js:423-438`). 🟡 O módulo `parser-tarefas.js` (prévia → CONFIRMAR/EDITAR/CANCELAR) existe, mas não está conectado ao `processarMensagem` atual.

## 2. Handshake e validação criptográfica

```mermaid
flowchart TD
    A[req GET] --> B{hub.mode = subscribe<br/>e hub.verify_token seguroEqual?}
    B -- nao --> C[403 Token invalido]
    B -- sim --> D[200 hub.challenge]
    E[req method != GET e != POST] --> F[405 Method not allowed]
    G[req POST] --> H{rawBody Buffer e<br/>x-hub-signature-256 presente?}
    H -- nao --> I[401 Invalid signature]
    H -- sim --> J[HMAC-SHA256 sha256=... com appSecret]
    J --> K{seguroEqual?}
    K -- nao --> I
    K -- sim --> L[extrairMensagem]
    L --> M{object = whatsapp_business_account<br/>e entry/changes/messages[0].from?}
    M -- nao --> N[404 Not Found: ignora ramo page]
    M -- sim --> O[entry.id, metadata.phone_number_id,<br/>msg.id, texto/button, audio.id]
    O --> P{wabaId/phoneNumberId configurados?<br/>devem conferir exatamente}
    P -- nao --> Q[origem aceita: compatibilidade legada]
    P -- divergente --> R[403 Origin not allowed]
    P -- conferem --> S[origem aceita]
```

🟢 `seguroEqual` faz hash SHA-256 antes de `timingSafeEqual`, escondendo o tamanho das strings (`whatsapp_auth.js:26-31`). 🟢 O HMAC é calculado sobre o corpo **cru** (`req.rawBody`), não sobre o objeto parseado (`whatsapp_auth.js:38-46`). 🟢 Apenas `whatsapp_business_account` é aceito — o ramo `page` do Messenger é ignorado, fechando um vetor de SSRF (`whatsapp_auth.js:67-89`; `tests/whatsapp-auth.test.js:135-140`). 🟢 WABA/phone_number_id não configurados são tolerados, mas quando configurados a conferência é exata (`whatsapp_auth.js:55-65`).

## 3. Identidade do remetente e deduplicação

```mermaid
flowchart TD
    A[mensagem.from] --> B[normalizarTelefone: so digitos,<br/>remove 55, exige 10-11 digitos]
    B -- invalido --> C[telefone_invalido]
    B --> D[varredura users: whatsappId e telefone normalizados]
    D --> E{casos em users?}
    E -- multiplos tenants --> F[numero_ambigu -> rejeita]
    E -- um tenant --> G[tenantId encontrado via users]
    E -- nenhum --> H[varredura tenants.config.telefonesPermitidos]
    H --> I{casos?}
    I -- 0 --> J[numero_nao_autorizado]
    I -- >1 --> F
    I -- 1 --> K[tenantId via allowlist; user vazio]
    G & K --> L[db.ref tenants/tid.once value]
    L --> M{tenant status inativo/bloqueado<br/>ou billing bloqueado/somente_leitura?}
    M -- sim --> N[tenant_inativo / tenant_bloqueado]
    M -- nao --> O{user status inativo/bloqueado/desativado?}
    O -- sim --> P[usuario_inativo]
    O -- nao --> Q[autorizado]
    R[msg.id] --> S[chaveDedup: filtra nao alfanumericos, max 128]
    S --> T[reservarMensagem transaction em whatsapp_messages/chave]
    T --> U{ja existe?}
    U -- sim --> V[200 DUPLICATE: nao reprocessa]
    U -- nao --> W[recebidaEm + status processing]
```

🟢 Matching é exato por DDD+número, nunca por substring (`whatsapp_auth.js:48-53`; `tests/whatsapp-auth.test.js:180-183`). 🟢 Empate entre tenants é ambiguidade e resulta em rejeição — nunca "primeiro que casou" (`whatsapp_auth.js:120-124,137`). 🟢 A allowlist `config.telefonesPermitidos` é só fallback quando `users` não casou (`whatsapp_auth.js:126-138`). 🟢 `verificarEstado` acopla o bot ao billing: `bloqueado` e `somente_leitura` impedem escrita via bot (`whatsapp_auth.js:141-154`). 🟢 A reserva por `msg.id` usa transação atômica; segunda entrega responde `200 DUPLICATE` (`whatsapp_auth.js:160-174`; `tests/whatsapp-auth.test.js:300-312`). 🟢 Sem `msgId`, a reserva é ignorada para compatibilidade com legados (`whatsapp_auth.js:163`).

## 4. Handler HTTP — ACK e tratamento de falhas

```mermaid
flowchart TD
    A[reserva obtida] --> B[autorizarRemetente]
    B -- falha --> C[responder Numero nao autorizado;<br/>status rejected; 403 Forbidden]
    B -- ok --> D[verificarEstado]
    D -- falha --> E[status rejected; 403 Forbidden]
    D -- ok --> F{audioUrl e urlAudioPermitida?}
    F -- nao --> G[status rejected; 400 Invalid audio URL]
    F -- sim/ausente --> H[processar ctx: from, texto, audioUrl, tenantId, user]
    H -- sucesso --> I[status done; 200 OK]
    H -- excecao --> J[remove reserva; responder Erro no servidor; 500]
    J --> K[Meta reenvia; sem DUPLICATE porque reserva foi liberada]
    C & E & G --> L[concluirMensagem: status + concluidaEm]
```

🟢 ACK positivo só acontece depois de processar; falha devolve 5xx para a Meta reenviar e a reserva é removida no `catch` (`whatsapp_auth.js:249-270`; `tests/whatsapp-auth.test.js:314-327`). 🟢 `concluirMensagem` engole erro de gravação para não falhar a resposta — a limpeza programada remove a reserva presa (`whatsapp_auth.js:176-183`). 🟢 Remetente não autorizado recebe mensagem explicativa antes do 403 (`whatsapp_auth.js:222-232`). 🟡 A resposta "número não autorizado" é enviada para qualquer número que passe assinatura/origem, permitindo uso do bot como canal de mensagem única.

## 5. Processamento — áudio e detecção de intenção

```mermaid
flowchart TD
    A[processarMensagem ctx] --> B{tenantId presente?}
    B -- nao --> C[log aviso e return]
    B -- sim --> D{audioUrl?}
    D -- sim --> E[valida urlAudioPermitida novamente]
    E --> F[axios.get arraybuffer; max 8MB; timeout 20s]
    F --> G[escreve /tmp/audio-UUID.ogg]
    G --> H[OpenAI Whisper-1, idioma pt -> texto]
    H --> I[remove arquivo temporario no finally]
    I --> J[textoTarefa = transcricao]
    D -- nao --> K[texto recebido]
    J & K --> L{texto curto < 200 chars<br/>e sem audio?}
    L -- sim --> M{TAREFA sem LISTA?}
    M -- sim --> N[criar_tarefa; tituido apos prefixo;<br/>detectaEtapas; usarGPT=false]
    M -- nao --> O{PONTO/PRESENCA/ENTRADA/SAIDA/FALTA?}
    O -- sim --> P[lancar_ponto; presenca por palavra-chave]
    O -- nao --> Q{OI/OLA/BOM DIA?}
    Q -- sim --> R[consultar]
    Q -- nao --> S{PONTO/PRESENCA exatos?}
    S -- sim --> T[consultar_ponto]
    S -- nao --> U{TAREFA/LISTA/MENU?}
    U -- sim --> R
    U -- nao --> V{detectarEtapas retorna algo?}
    V -- sim --> N
    V -- nao --> W[GPT]
    L -- nao --> W
    W --> X[chat.completions gpt-4o-mini<br/>response_format json_object]
    X --> Y[JSON.parse -> dados.intencao]
```

🟢 Intenções locais evitam chamada ao GPT para comandos curtos (`index.js:198-234`). 🟢 Áudio é limitado a 8 MB (`LIMITE_AUDIO`) e 20 s de download, transcrito com `whisper-1` em português (`index.js:169-194`). 🟢 `urlAudioPermitida` só aceita `https://graph.facebook.com` ou `*.fbcdn.net`, defesa em profundidade além da checagem no handler (`whatsapp_auth.js:91-100`; `index.js:169-174`). 🟢 O prompt do GPT fixa data atual em `America/Sao_Paulo` e formato JSON rígido (`index.js:236-271`). 🟡 A intenção `consultar_ponto` é detectada mas não tem branch de tratamento em `processarMensagem` (`index.js:221-223`). 🟡 `dados` do GPT não é validado contra schema antes de acessar `.tarefa`/`.ponto`.

## 6. Resolução de obra e gravação de tarefa/ponto

```mermaid
flowchart TD
    A[buscarObra nomeOuId] --> B{nome ausente ou nao_informada?}
    B -- sim --> C[null]
    B -- nao --> D[le tenants/tid/obras; aceita array ou objeto]
    D --> E[filtra status ativa/em andamento/planejada/execucao]
    E --> F[busca exata: nome, cod ou _id normalizados]
    F -- achou --> G[obra]
    F -- nao --> H[contem nome normalizado]
    H -- achou --> G
    H -- nao --> I[melhorMatch fuzzy threshold 0.3]
    I --> G
    G --> J{intencao}
    J -- criar_tarefa --> K[le tarefas; cod = TF + length+1 com pad 3]
    K --> L[grava desc, obra, etapa/codigo/frente/prioridade,<br/>resp Equipe, status Pendente,<br/>criadoPor, criadoEm ServerValue.TIMESTAMP, origem WhatsApp]
    L --> M[responde Tarefa Registrada com etapa/frente/prioridade]
    J -- lancar_ponto --> N[le trabalhadores; filtra status ativo]
    N --> O[para cada nome: melhorMatch threshold 0.5]
    O -- sem match --> P[avisa nome nao achado]
    O -- com match --> Q[calcula total/horas por presenca:<br/>Presente=diaria/8h; Meio=diaria/2/4h; Falta=0]
    Q --> R[monta registro com entrada/saida, hnorm, diaria,<br/>lancador, hrLanc America/Sao_Paulo, origem,<br/>telefoneAutor, _s temporario]
    R --> S[presenca.transaction: substitui por data+trab<br/>ou adiciona; remove _s antes de gravar]
    S --> T[responde resumo Por data]
    C --> U[responde Obra nao encontrada/nao identificada]
```

🟢 Busca de obra tem três níveis (exata → contém → fuzzy 0.3) e considera só obras ativas (`index.js:276-310`). 🟢 Código da tarefa é sequencial `TF001`, derivado do tamanho da lista (`index.js:318`). 🟢 Lançamento de ponto usa transação para não duplicar `data + trab`, atualizando registros existentes (`index.js:378-394`). 🟢 Horários padrão: entrada 07:00, saída 17:00 (12:00 no meio período, 00:00 em falta) (`index.js:367-375`). 🟡 `norm(o.cod)` em `buscarObra` chama `.normalize()` diretamente; códigos numéricos podem lançar erro (`index.js:92-95,296`). 🟡 `cod` sequencial por `lista.length + 1` pode colidir após exclusões. 🟡 A resposta de ponto é enviada mesmo quando nenhum trabalhador foi encontrado (`resultados` com avisos).

## 7. Consulta geral e envio de mensagens

```mermaid
flowchart TD
    A[processarConsultaGeral para, tenantId, user] --> B[Promise.all: obras, tarefas, presenca]
    B --> C[obras ativas; presenca de hoje; tarefas nao Concluidas]
    C --> D[monta mensagem: data, primeira obra,<br/>presentes, faltas, tarefas abertas]
    D --> E[instrucoes TAREFA / PONTO / MENU]
    E --> F[responderWhatsApp]
    G[responderWhatsApp para, msg] --> H{token e phoneNumberId configurados?}
    H -- nao --> I[log erro e return]
    H -- sim --> J{msg vazia?} -- sim --> K[aviso e return]
    J -- nao --> L[POST graph.facebook.com/v20.0/phoneId/messages]
    L --> M[Authorization Bearer; messaging_product whatsapp; type text]
    M -- sucesso --> N[log enviado]
    M -- erro --> O[log erro + payload]
```

🟢 Consulta agrega três coleções em paralelo e usa `getHojeBR()` (`index.js:515-538`). 🟢 `responderWhatsApp` usa `META_ACCESS_TOKEN` e `META_PHONE_NUMBER_ID` como secrets e não envia mensagem vazia (`index.js:406-446`). 🟡 O nome da empresa é fixo como `'Empresa'` na consulta geral (`index.js:529`). 🟡 Erros da Graph API são apenas logados — o fluxo não tem retry nem dead-letter.

## 8. Relatório diário (feature gate)

```mermaid
flowchart TD
    A[dailyReport: 0 21 * * *<br/>America/Sao_Paulo] --> B[le todos os tenants]
    B --> C{hasFeature relatorio.whatsapp.diario<br/>para tenant.plano?}
    C -- nao --> D[log pulado e continua]
    C -- sim --> E{tenant.adminPhone e status != inativo?}
    E -- nao --> D
    E -- sim --> F[le tenants/tid/ponto/hoje e tarefas]
    F --> G[presentes, faltas, total,<br/>concluidas hoje, abertas, atrasadas]
    G --> H[monta relatorio com header do tenant.nome]
    H --> I[responderWhatsApp tenant.adminPhone]
    I --> J[log final / catch global]
```

🟢 O agendamento `0 21 * * *` em UTC corresponde a 18h em Brasília (`index.js:448-455`). 🟢 A matriz de features é a mesma do front: somente Pro+ recebe o relatório (`index.js:466-472`; `tests/plan-features.test.js:34-39,134`). 🟢 `maxInstances: 1` evita envio duplicado do relatório (`index.js:454`). 🟡 O relatório lê `tenants/<tid>/ponto/<hoje>`, enquanto `processarMensagem` grava em `tenants/<tid>/presenca` — as fontes divergem e os contadores podem ficar zerados para LANÇAMENTOS via bot. 🟡 `billingState` não é checado no relatório, apenas `status === 'inativo'`.

## 9. Parser de tarefas (prévia/confirmação) — código presente, não conectado

```mermaid
flowchart TD
    A[handleAudioTarefas transcricao, tid, from] --> B[extrairTarefas: split por , ; newline .]
    B --> C{sentenca com etapa detectada?}
    C -- sim --> D[prioridade = urgencia ou etapa;<br/>confianca alta/media por score >= 3]
    C -- nao --> E[prioridade = urgencia ou Media; confianca baixa]
    D & E --> F[grava tenants/tid/tarefas_pendentes/from<br/>transcricao, tarefas, timestamp]
    F --> G[preview com icones por confianca]
    G --> H{CONFIRMAR / EDITAR n texto / CANCELAR}
    H -- CONFIRMAR --> I[confirmarTarefas: push em tarefas<br/>e remove pendente]
    H -- EDITAR --> J[editarTarefaPendente: reexecuta deteccao<br/>e reenvia preview]
    H -- CANCELAR --> K[cancelarTarefas: remove pendente]
```

🟢 `ETAPAS` tem 10 categorias com sinônimos e prioridade padrão; `detectarEtapas` pontua por número de palavras batidas e ordena decrescente (`obra-etapas.js:1-238`). 🟢 `PALAVRAS_URGENCIA` força prioridade Alta (`obra-etapas.js:187-207`). 🟡 `handleAudioTarefas`, `confirmarTarefas`, `editarTarefaPendente` e `cancelarTarefas` não são importados por `index.js` — o fluxo ativo grava tarefa diretamente, sem prévia nem confirmação. 🟡 `tarefas_pendentes/<from>` usa o telefone como chave, sem normalização — o mesmo remetente com formatos diferentes gera pendências distintas. 🟡 `criadoEm` em `confirmarTarefas` usa `toISOString().split('T')[0]` (UTC), divergente do `getHojeBR()` usado no fluxo ativo.

## 10. Retenção e regras de proteção

```mermaid
flowchart TD
    A[retencaoSegurancaJob: 03:30] --> B[limparNo whatsapp_messages]
    B --> C[recebidaEm mais antigo que 24h?]
    C -- sim --> D[remove chave]
    C -- nao --> E[preserva]
    F[database.rules.json] --> G[whatsapp_messages: .write false,<br/>.read só super_admin]
    H[users/email] --> I[telefone e whatsappId só super_admin<br/>ou super_admins ativo]
    J[tenants/tid/config] --> K[telefonesPermitidos só super_admin<br/>ou super_admins ativo]
```

🟢 `whatsapp_messages` tem retenção de 24h, coerente com o uso apenas como dedup (`retencao.js:11-22`; `index.js:913-918`). 🟢 Rules impedem que o cliente altere identidade do bot: `telefone`, `whatsappId` e `telefonesPermitidos` exigem super_admin (`database.rules.json:74-76,261-266`; `tests/abuso.test.js:124-131`). 🟢 `whatsapp_messages` é somente leitura para super_admin e fechado para escrita pelo cliente (`database.rules.json:219-222`). 🟡 A limpeza usa `recebidaEm`; uma reserva `processing` presa é removida após 24h, não por lease curto como no webhook da Kiwify.
