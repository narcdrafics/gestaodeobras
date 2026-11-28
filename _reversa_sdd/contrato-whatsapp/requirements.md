# Contrato de dados — WhatsApp

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA BLOQUEANTE. Cobre `whatsapp-bot` (matriz de impacto §4) e complementa a unit HTTP `webhook-whatsapp`. Fontes: `flowcharts/whatsapp-bot.md`, `webhook-whatsapp/questions.md`, `data-dictionary.md` §32/§97-105, `domain.md` RN-058–RN-068, `ADR-004`, `ADR-011`, `ADR-009`, `spec-impact-matrix.md` §6.

## Visão Geral

🟢 O bot recebe mensagens via Meta Cloud API, valida assinatura/origem, identifica o remetente e grava tarefas ou presença no tenant. 🟢 A autenticação vive em `whatsapp_auth.js`; a lógica de negócio é injetada por `index.js`, mantendo a camada de validação testável. 🟢 O envio de respostas e do relatório diário usa Graph API v20.0.

> 🟢 GAP-01…GAP-04 decididos em `questions.md` (P1–P4); 🔴 GAP-05 (P5) e Q-01 (P19) continuam pendentes. Este contrato preserva o que está 🟢 confirmado no código e registra as decisões humanas.

## Responsabilidades

- 🟢 Validar `GET` handshake e `POST` com HMAC-SHA256 sobre `rawBody` e origem WABA/`phone_number_id`.
- 🟢 Normalizar telefone, resolver tenant por `users` ou `config.telefonesPermitidos` e checar status/billing.
- 🟢 Dedup por `msg.id` com transação atômica e reserva `processing`.
- 🟢 Converter áudio (Whisper-1, ≤8 MB, 20 s) e detectar intenção local antes de usar GPT-4o-mini.
- 🟢 Resolver obra (exata → contém → fuzzy 0,3) e gravar tarefa `TF###` ou presença por transação.
- 🟢 Responder via Graph API e enviar relatório diário às 18h de Brasília para tenants com feature.

## Regras de Negócio

- 🟢 RN-058: `seguroEqual` hash SHA-256 antes de `timingSafeEqual`.
- 🟢 RN-059: somente `whatsapp_business_account`; ramo `page` é ignorado (anti-SSRF).
- 🟢 RN-060: matching de telefone é exato (DDD+número); empate entre tenants ⇒ rejeição.
- 🟢 RN-061: `bloqueado`/`somente_leitura` impedem escrita via bot.
- 🟢 RN-062: reentrega responde `200 DUPLICATE`; falha devolve 5xx e libera reserva para retry.
- 🟢 RN-063: intenções locais (`TAREFA`, `PONTO`, `PRESENCA`, `ENTRADA`, `SAÍDA`, `FALTA`, `OI`, `MENU`) evitam GPT.
- 🟢 RN-064: ponto usa `Presente=diária/8h`, `Meio=diária/2/4h`, `Falta=0`; horários 07:00/17:00 (12:00/00:00).
- 🟢 RN-065: presença é substituída por `data + trab` em transação.
- 🟢 RN-066: `dailyReport` roda às 21:00 UTC (18h Brasília) com `maxInstances: 1`.
- 🟢 RN-067: retenção de `whatsapp_messages` é 24 h.
- 🟢 RN-068: `telefone`, `whatsappId` e `telefonesPermitidos` exigem super_admin nas rules.
- 🟢 Decisão P20: `buscarObra` converte `cod` para string e trata códigos numéricos como válidos (implementação pendente).
- 🟢 GAP-01 resolvido (P1): responder `consultar_ponto` com resumo de presença de hoje do remetente (implementação pendente).
- 🟢 GAP-02 resolvido (P2): ativar prévia/confirmação no webhook (código hoje órfão).
- 🟢 GAP-03 resolvido (P3): `presenca` é o nó canônico do resumo diário (job ainda lê `ponto/<hoje>`).
- 🟢 GAP-04 resolvido (P4): `tarefas_pendentes` removido — gravação direta em `tarefas`.
- 🔴 GAP-05: Graph API sem retry/fila/dead-letter — confiabilidade não atendida.
- 🟡 Q-01: `dados` do GPT sem validação de schema antes de `.tarefa`/`.ponto`.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Handshake e validação criptográfica | Must | `tests/whatsapp-auth.test.js` passa; 403/401/405 conforme código |
| RF-02 | 🟢 Resolução de remetente e tenant com ambiguidade rejeitada | Must | Empate entre tenants ⇒ `numero_ambigu` |
| RF-03 | 🟢 Verificação de estado do tenant e do usuário | Must | `bloqueado`/`somente_leitura`/inativo ⇒ 403 |
| RF-04 | 🟢 Dedup transacional por `msg.id` | Must | Segunda entrega ⇒ `200 DUPLICATE` |
| RF-05 | 🟢 ACK após processar; 5xx libera reserva | Must | `whatsapp_messages.status` coerente com a resposta |
| RF-06 | 🟢 Transcrição de áudio com limites e limpeza | Must | >8 MB ⇒ `400 Invalid audio URL`; `/tmp` removido no `finally` |
| RF-07 | 🟢 Detecção local de intenção e fallback GPT | Must | Comando curto sem áudio não chama GPT |
| RF-08 | 🟢 Resolução de obra e gravação de tarefa | Must | `TF###` sequencial; `origem=WhatsApp`; códigos numéricos válidos (P20) |
| RF-09 | 🟢 Lançamento de presença por transação | Must | Não duplica `data+trab`; avisa trabalhador não encontrado |
| RF-10 | 🟢 Consulta geral com `getHojeBR()` | Must | Agrega obras/tarefas/presença em paralelo |
| RF-11 | 🟢 Responder `consultar_ponto` com resumo de presença de hoje do remetente | Must | Decisão P1; handler pendente |
| RF-12 | 🟢 Ativar prévia/confirmação sem `tarefas_pendentes` | Must | Decisões P2 e P4: fluxo ativo com gravação direta em `tarefas` |
| RF-13 | 🟢 Fazer `dailyReport` ler `presenca` | Must | Decisão P3; hoje lê `ponto/<hoje>` |
| RF-14 | 🔴 Não prometer retry/dead-letter da Graph API | Must | GAP-05 permanece bloqueante |
| RF-15 | 🟡 Validar schema mínimo de `dados` do GPT | Should | Q-01: ausência de `intencao` não gera exceção |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | HMAC-SHA256 sobre rawBody + origem exata | `whatsapp_auth.js:39-65` | 🟢 |
| Segurança | Dados de identidade protegidos por rules | `database.rules.json:74-76,261-266` | 🟢 |
| Limites | Áudio ≤8 MB / 20 s de download | `index.js:169-194` | 🟢 |
| Fuso | `getHojeBR()` e prompt com `America/Sao_Paulo` | `index.js:236-271,515-538` | 🟢 |
| Retenção | 24 h em `whatsapp_messages` | `retencao.js:11-22` | 🟢 |
| Confiabilidade | 🔴 Sem retry/fila/dead-letter na Graph API | `index.js:437-446` | 🔴 |

## Critérios de Aceitação

```gherkin
Dado um POST com `x-hub-signature-256` inválido
Quando o webhook é chamado
Então responde 401 e nenhuma reserva é criada

Dado a mesma mensagem entregue duas vezes com o mesmo `msg.id`
Quando o handler processa a segunda entrega
Então responde 200 `DUPLICATE` e não grava tarefa nem presença

Dado um comando "PONTO Presente João" com trabalhador ativo
Quando a intenção `lancar_ponto` é processada
Então `presenca` recebe diaria/8h às 07:00-17:00 com `origem=WhatsApp`

Dado um remetente que casa com `users` em dois tenants diferentes
Quando `autorizarRemetente` executa
Então a mensagem é rejeitada como `numero_ambigu`
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-10 | Must | Caminho crítico confirmado no código |
| RF-11…RF-13 | Must | Decisões P1–P3 registradas; RF-14 (P5) permanece bloqueante |
| RF-15 | Should | Robustez do fallback LLM |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `functions/whatsapp_auth.js` | `seguroEqual`, `validarAssinatura`, `normalizarTelefone`, `autorizarRemetente`, `reservarMensagem` | 🟢 |
| `functions/index.js` | `processarMensagem`, `buscarObra`, `responderWhatsApp`, `dailyReport` | 🟢 / 🔴 (GAP-05) |
| `functions/whatsapp/obra-etapas.js` | `detectarEtapas`, `ETAPAS` | 🟢 |
| `functions/whatsapp/parser-tarefas.js` | `extrairTarefas`, `confirmarTarefas` | 🟢 órfão hoje; decisão P2 de ativação |
| `functions/retencao.js` | limpeza de `whatsapp_messages` | 🟢 |
| `database.rules.json:74-76,211-222,241-267` | proteção de identidade e dedup | 🟢 |
| `tests/whatsapp-auth.test.js`, `tests/abuso.test.js` | — | 🟢 |
