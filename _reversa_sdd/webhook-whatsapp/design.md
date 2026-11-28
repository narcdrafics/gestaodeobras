# Webhook WhatsApp, Design Técnico

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `functions/whatsapp_auth.js`, `functions/index.js`, `flowcharts/whatsapp-bot.md`.

## Interface

| Método | Caminho | Entrada | Saída | Status codes |
|--------|---------|---------|-------|--------------|
| GET | `/api/whatsapp` | `hub.mode`, `hub.verify_token`, `hub.challenge` | `hub.challenge` | 200, 403 |
| POST | `/api/whatsapp` | corpo cru + `x-hub-signature-256` | mensagem Graph API | 200, 400, 403, 404, 500 |

| Símbolo | Assinatura | Retorno | Observação |
|---------|-----------|---------|------------|
| `validarVerifyToken` | `(req)` | `boolean` | 🟢 `seguroEqual` antes de comparar |
| `validarAssinatura` | `(rawBody, header, appSecret)` | `boolean` | 🟢 HMAC-SHA256, corpo cru |
| `extrairMensagem` | `(body)` | `{from, texto, audioId, msgId}` | 🟢 ignora ramo `page` |
| `autorizarRemetente` | `(from, db)` | `{tenantId, user}` | 🟢 fail-closed na ambiguidade |
| `verificarEstado` | `(tenantId, user, db)` | `boolean` | 🟢 acoplado ao `billingState` |
| `reservarMensagem` | `(msgId, db)` | `boolean` | 🟢 transação atômica |
| `processarMensagem` | `(from, texto, audioUrl, contexto)` | `Promise<void>` | 🟢 lógica de domínio injetada |

## Fluxo Principal

1. 🟢 Meta chama `GET` para verificação ou `POST` para mensagem (`whatsapp_auth.js:189-271`).
2. 🟢 HMAC sobre `req.rawBody`; origem conferida com `wabaId`/`phoneNumberId`.
3. 🟢 `extrairMensagem` aceita somente `whatsapp_business_account`; dedup em `whatsapp_messages/<chave>`.
4. 🟢 Telefone casado em `users`/`telefonesPermitidos`; estado do tenant e do usuário validados.
5. 🟢 Áudio baixado de URL allowlisted (≤8 MB, 20 s) e transcrito por `whisper-1`.
6. 🟢 Intenção local ou GPT-4o-mini (`response_format: json_object`).
7. 🟢 `criar_tarefa` grava em `tarefas` com `TF###`; `lancar_ponto` usa transação em `presenca`.
8. 🟢 `responderWhatsApp` envia via Graph API v20.0; reserva marcada `done`.

## Fluxos Alternativos

- **Verify token inválido:** 🟢 403.
- **Assinatura/origem inválidos:** 🟢 401/403, sem processamento.
- **Ramo `page`:** 🟢 404.
- **Número ambíguo/não autorizado:** 🟢 403 + mensagem explicativa.
- **Tenant bloqueado/`somente_leitura`:** 🟢 403; nenhuma escrita.
- **Exceção no processamento:** 🟢 reserva removida, 500 para a Meta reenviar.
- **🟢 `consultar_ponto`:** detectada em `index.js:221-223`, sem branch hoje; decisão P1 — responder com resumo de presença de hoje do remetente (implementação pendente).
- **🟢 Prévia/confirmação de tarefas:** existe em `parser-tarefas.js`, não importada hoje; decisão P2 de ativação no webhook (implementação pendente).

## Dependências

- 🟢 Meta Graph API v20.0, OpenAI Whisper-1 e GPT-4o-mini.
- 🟢 Realtime Database: `users`, `telefonesPermitidos`, `tenants/<tid>/{obras,tarefas,presenca,trabalhadores}`, `whatsapp_messages`, `config`.
- 🟢 Secrets: `META_*`, `OPENAI_KEY`.
- 🟢 `dailyReport` (job separado) lê `ponto/<hoje>` hoje; decisão P3: `presenca` é canônico (ajuste pendente).

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Auth separada da lógica por injeção de `processar`/`responder` | `whatsapp_auth.js:185-188` | 🟢 |
| ACK após processar; reserva liberada no erro | `whatsapp_auth.js:249-270` | 🟢 |
| Transação em `presenca` para substituir `data+trab` | `index.js:378-394` | 🟢 |
| Busca de obra em 3 níveis, threshold fuzzy 0,3 | `index.js:276-310` | 🟢 |
| Intenções locais antes do GPT | `index.js:198-234` | 🟢 |

## Estado Interno

🟢 `whatsapp_messages/<msg.id sanitizado>` com `recebidaEm`, `status ∈ {processing, done, rejected}`, `concluidaEm`. 🟢 Reserva de presença com `_s` temporário removido antes da gravação. 🟡 `concluirMensagem` engole erro de gravação; limpeza programada resolve reservas presas.

## Observabilidade

🟢 Logs de mensagem recebida e de erro de envio Graph. 🟡 Sem retry, fila ou dead-letter para falha de resposta — GAP-05.

## Riscos e Lacunas

- 🟢 GAP-01 — decisão P1 registrada: responder com resumo de presença de hoje do remetente; handler pendente.
- 🟢 GAP-02 — decisão P2 registrada: ativar prévia/confirmação; código hoje órfão.
- 🟢 GAP-03 — decisão P3 registrada: `presenca` canônico; job ainda lê `ponto/<hoje>`.
- 🔴 GAP-05 — Graph API sem retry/dead-letter.
- 🟡 `cod` de tarefa por `lista.length + 1` pode colidir após exclusões.
- 🟡 `norm(o.cod)` chama `.normalize()` diretamente; códigos numéricos podem lançar erro.
