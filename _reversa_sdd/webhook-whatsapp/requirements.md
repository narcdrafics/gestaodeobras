# Webhook WhatsApp (`GET|POST /api/whatsapp`)

> Spec executável gerada pelo **Writer** (Fase 4, `doc_level = completo`). 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA.
> Fontes: `firebase.json:15-19`, `functions/index.js:128-148,155-446`, `functions/whatsapp_auth.js`, `functions/whatsapp/obra-etapas.js`, `_reversa_sdd/flowcharts/whatsapp-bot.md`, `domain.md` RN-049–RN-053, `spec-impact-matrix.md` §6 GAP-01/02/03/05.

## Visão Geral

🟢 Ponto de entry da Meta WhatsApp Cloud API. Handshake de verificação, HMAC-SHA256 sobre corpo cru, validação de origem WABA, dedup transacional por `msg.id`, autorização do remetente e processamento de intenções locais com GPT-4o-mini como fallback. Respostas usam Graph API v20.0.

## Responsabilidades

- 🟢 `GET`: responder `hub.challenge` somente com `hub.mode=subscribe` e verify token válido (403 caso contrário).
- 🟢 `POST`: validar HMAC, origem, extrair mensagem, reservar `msg.id`, autorizar remetente e estado do tenant.
- 🟢 Transcrever áudio (Whisper-1, até 8 MB, timeout 20 s) e detectar intenção.
- 🟢 Gravar tarefa (`TF###`) ou presença (`data + trabalhador`) com transação; responder via Graph API.
- 🟢 ACK 200 somente após processamento; falha libera reserva para reentrega.

## Regras de Negócio

- 🟢 RN-049: defesa em camadas — HMAC → origem → dedup → autorização → estado → allowlist de URL → ACK.
- 🟢 RN-050: telefone normalizado (só dígitos, remove 55, 10–11 dígitos); ambiguidade entre tenants ⇒ rejeição.
- 🟢 RN-051: `billingState` `bloqueado`/`somente_leitura` impede escrita via bot.
- 🟢 RN-052: busca de obra exata → contém → fuzzy 0,3, só obras ativas.
- 🟢 RN-053: intenções locais `lancar_ponto`/`criar_tarefa`/`consultar`; GPT como fallback.
- 🟢 GAP-01 resolvido: decisão humana em `questions.md` P1 — responder `consultar_ponto` com resumo de presença de hoje do remetente. 🟢 O código atual ainda não tem branch; implementação pendente.
- 🟢 GAP-02 resolvido: decisão P2 — ativar o fluxo de prévia/confirmação no webhook. 🟢 Fato confirmado: `parser-tarefas.js` hoje não é importado; implementação pendente.
- 🟢 GAP-03 resolvido: decisão P3 — `presenca` é o nó canônico. 🟢 Fato confirmado: `dailyReport` ainda lê `ponto/<hoje>`; ajuste pendente.
- 🔴 GAP-05: Graph API sem retry/fila/dead-letter.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Handshake com verify token seguro | Must | `hub.mode` inválido/token errado ⇒ 403; válido ⇒ 200 com `hub.challenge` |
| RF-02 | 🟢 HMAC-SHA256 sobre corpo cru | Must | Assinatura ausente/inválida ⇒ 401; comparação com `timingSafeEqual` |
| RF-03 | 🟢 Aceitar somente `whatsapp_business_account` | Must | RAMO `page` ⇒ 404; WABA/phone id divergentes ⇒ 403 |
| RF-04 | 🟢 Dedup transacional por `msg.id` (chave sanitizada, máx. 128) | Must | Reentrega ⇒ `200 DUPLICATE`; reserva liberada no `catch` |
| RF-05 | 🟢 Autorizar remetente por `users` → `telefonesPermitidos`, fail-closed | Must | Número ambíguo/não autorizado ⇒ 403 |
| RF-06 | 🟢 Verificar status do usuário e `billingState` do tenant | Must | `bloqueado`/`somente_leitura`/usuário inativo ⇒ 403 |
| RF-07 | 🟢 Processar áudio com allowlist de URL e limite de 8 MB | Must | URL fora de `graph.facebook.com`/`*.fbcdn.net` ⇒ 400; >8 MB ⇒ rejeição |
| RF-08 | 🟢 Intenção local para comandos curtos | Must | `TAREFA...`, `PONTO`, `OI` não chamam GPT |
| RF-09 | 🟢 Gravar tarefa com `TF` sequencial e presença com transação | Must | Duas mensagens iguais não duplicam `data+trabalhador` |
| RF-10 | 🟢 Responder via Graph API v20.0 e concluir reserva | Must | Sucesso ⇒ `status done` + 200; exceção ⇒ 500 e reserva removida |
| RF-11 | 🟢 Responder `consultar_ponto` com resumo de presença de hoje do remetente | Must | Decisão P1; handler a implementar (hoje detectada sem branch) |
| RF-12 | 🟢 Ajustar leitura do `dailyReport` para `presenca` | Must | Decisão P3; hoje lê `ponto/<hoje>` — ajuste pendente |
| RF-13 | 🔴 Definir retry/dead-letter da Graph API | Should | Bloqueante: falha de envio hoje não tem reenvio (GAP-05) |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | HMAC SHA-256 com hash prévio antes de `timingSafeEqual` | `whatsapp_auth.js:26-46` | 🟢 |
| Segurança | Matching exato de telefone, nunca substring | `whatsapp_auth.js:48-53` | 🟢 |
| Performance | Função com 512 MiB, timeout 60 s, máx. 5 instâncias | `functions/index.js:128-135` | 🟢 |
| Disponibilidade | Ack positivo só após processar; 5xx para reenvio | `whatsapp_auth.js:249-270` | 🟢 |
| Confiabilidade | 🔴 Sem retry/dead-letter na Graph API | `functions/index.js:437-446` | 🟢 |

## Critérios de Aceitação

```gherkin
Dado um POST assinado com msg.id já processado
Quando a Meta reenvia a mensagem
Então a resposta é 200 DUPLICATE e nenhuma tarefa/presença é gravada

Dado um número presente em users de dois tenants diferentes
Quando o remetente envia uma mensagem assinada
Então o bot rejeita com 403 e não escolhe um tenant arbitrário

Dado um comando "PONTO Presente João" em tenant com billingState ativo
Quando a mensagem é processada
Então uma presença com data de hoje e trabalhador resolvido é gravada por transação e o ACK é 200
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-10 | Must | Caminho crítico de ingestão e escrita |
| RF-11, RF-12 | Must | Decisões humanas P1/P3 registradas — implementação pendente |
| RF-13 | Should | Necessário para confiabilidade, mas não bloqueia o fluxo feliz |
| RF-02 do parser (prévia/confirmação) | Must | 🟢 Decisão P2: ativar no webhook (hoje código órfão) |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `functions/whatsapp_auth.js` | `seguroEqual`, `validarAssinatura`, `autorizarRemetente`, `verificarEstado`, `reservarMensagem`, `handleWhatsappWebhook` | 🟢 |
| `functions/index.js` | `processarMensagem`, `buscarObra`, `responderWhatsApp`, `processarConsultaGeral` | 🟢 |
| `functions/whatsapp/obra-etapas.js` | `detectaEtapas` | 🟢 |
| `functions/whatsapp/parser-tarefas.js` | fluxo prévia/CONFIRMAR | 🟢 órfão hoje; decisão P2 de ativação |
| `firebase.json:15-19` | rewrite `/api/whatsapp` | 🟢 |
