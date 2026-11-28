# Webhook WhatsApp, Tarefas de Implementação

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA.

## Pré-requisitos

- [ ] Rewrite `/api/whatsapp` no Hosting e segredos `META_*`/`OPENAI_KEY` provisionados.
- [ ] 🔴 GAP-05 permanece sem decisão; GAP-01…GAP-04 decididos em `questions.md` (P1–P4), implementação pendente.

## Tarefas

- [ ] T-01, Handshake GET com verify token seguro
  - Origem: `functions/whatsapp_auth.js:33-36`
  - Critério de pronto: 200 com challenge apenas para token válido; inválido ⇒ 403
  - Confiança: 🟢
- [ ] T-02, Validar HMAC-SHA256 do corpo cru e origem WABA
  - Origem: `functions/whatsapp_auth.js:26-46,60-65`
  - Critério de pronto: testes `tests/whatsapp-auth.test.js` passam; ramo `page` ⇒ 404
  - Confiança: 🟢
- [ ] T-03, Dedup por `msg.id` com transação
  - Origem: `functions/whatsapp_auth.js:161-174`
  - Critério de pronto: reentrega ⇒ `200 DUPLICATE`; reserva liberada na exceção
  - Confiança: 🟢
- [ ] T-04, Autorizar remetente e verificar estado/billing
  - Origem: `functions/whatsapp_auth.js:107-154`
  - Critério de pronto: ambiguidade ⇒ rejeição; `bloqueado`/`somente_leitura` ⇒ 403
  - Confiança: 🟢
- [ ] T-05, Transcrever áudio com allowlist e limite
  - Origem: `functions/index.js:169-194`; `whatsapp_auth.js:92-100`
  - Critério de pronto: URL inválida/>8 MB rejeitada; arquivo temporário removido no `finally`
  - Confiança: 🟢
- [ ] T-06, Detectar intenção local antes do GPT
  - Origem: `functions/index.js:198-271`
  - Critério de pronto: comandos curtos não chamam OpenAI; fallback gera JSON válido
  - Confiança: 🟢
- [ ] T-07, Gravar tarefa e presença
  - Origem: `functions/index.js:276-394`
  - Critério de pronto: `TF###` sequencial; presença substitui `data+trab` sem duplicar
  - Confiança: 🟢
- [ ] T-08, Responder via Graph API e concluir reserva
  - Origem: `functions/index.js:423-446`; `whatsapp_auth.js:176-183,249-270`
  - Critério de pronto: sucesso ⇒ `done`/200; erro ⇒ 500 + reserva liberada
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, handshake, assinatura e origem
- [ ] TT-02, dedup e ambiguidade de telefone
- [ ] TT-03, criação de tarefa e lançamento de ponto
- [ ] TT-04, bloqueio por cobrança
- [ ] TT-05 (🟢), intenção `consultar_ponto` — decisão P1: resumo de presença de hoje do remetente

## Decisões registradas e lacuna pendente

- 🟢 GAP-01…GAP-04 — decisões P1–P4 em `questions.md`; implementação pendente.
- 🔴 GAP-05 — P5 sem decisão ("Não sei dizer"): retry/fila/dead-letter da Graph API permanece bloqueante.
