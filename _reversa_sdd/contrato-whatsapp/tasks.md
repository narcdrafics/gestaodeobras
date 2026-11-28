# Contrato de dados — WhatsApp, Tarefas

> 🟢 CONFIRMADO · 🔴 LACUNA BLOQUEANTE. Cada tarefa cita o arquivo legado de origem.

## Pré-requisitos

- [ ] `ADR-004`, `ADR-009`, `ADR-011` e `webhook-whatsapp/questions.md` disponíveis.
- [ ] 🟢 GAP-01…GAP-04 revisados e decididos (P1–P4); 🔴 GAP-05 aguarda decisão.

## Tarefas

- [ ] T-01, Implementar handshake e validação de assinatura/origem — Origem: `whatsapp_auth.js:27-100`; Critério: `tests/whatsapp-auth.test.js` passa; 🟢
- [ ] T-02, Implementar normalização de telefone e resolução de tenant — Origem: `whatsapp_auth.js:107-139`; Critério: empate entre tenants rejeitado; 🟢
- [ ] T-03, Implementar verificação de estado (tenant + usuário + billing) — Origem: `whatsapp_auth.js:142-154`; Critério: `bloqueado`/`somente_leitura` ⇒ 403; 🟢
- [ ] T-04, Implementar reserva de mensagem por transação com chave sanitizada — Origem: `whatsapp_auth.js:161-174`; Critério: reentrega ⇒ `DUPLICATE`; 🟢
- [ ] T-05, Implementar handler com ACK pós-processamento e liberação da reserva no erro — Origem: `whatsapp_auth.js:189-271`; Critério: 5xx quando processamento falha; 🟢
- [ ] T-06, Implementar transcrição de áudio com limites e limpeza — Origem: `index.js:169-194`; Critério: `/tmp` removido no `finally`; 🟢
- [ ] T-07, Implementar detecção local de intenção e fallback GPT — Origem: `index.js:198-271`; Critério: comando curto não chama GPT; 🟢
- [ ] T-08, Implementar `buscarObra` em três níveis — Origem: `index.js:276-310`; Critério: fuzzy 0,3; obra inativa ignorada; `cod` numérico válido (P20); 🟢
- [ ] T-09, Implementar gravação de tarefa `TF###` — Origem: `index.js:312-365`; Critério: `origem=WhatsApp`, `criadoEm=ServerValue.TIMESTAMP`; 🟢
- [ ] T-10, Implementar lançamento de presença por transação — Origem: `index.js:367-404`; Critério: sem duplicata `data+trab`; 🟢
- [ ] T-11, Implementar consulta geral e envio via Graph API — Origem: `index.js:406-446,515-538`; Critério: data em `getHojeBR()`; 🟢
- [ ] T-12, Implementar retenção de 24 h de `whatsapp_messages` — Origem: `retencao.js:11-22`; Critério: chaves antigas removidas; 🟢

## Tarefas de Teste

- [ ] TT-01, Assinatura HMAC e origem WABA
- [ ] TT-02, Identidade do remetente, ambiguidade e bloqueio por billing
- [ ] TT-03, Dedup e comportamento na reentrega
- [ ] TT-04, Intenção local vs. GPT e áudio com limites
- [ ] TT-05, Gravação de tarefa e presença (transação e horários)

## Decisões registradas e lacuna bloqueante

- 🟢 GAP-01 (P1): responder `consultar_ponto` com resumo de presença de hoje do remetente.
- 🟢 GAP-02/P4 (P2/P4): ativar prévia/confirmação e remover `tarefas_pendentes` (gravação direta em `tarefas`).
- 🟢 GAP-03 (P3): `presenca` é o nó canônico do `dailyReport`.
- 🔴 GAP-05 (P5): definir política de retry/fila/dead-letter para a Graph API.
- 🟡 Q-01: validar schema mínimo de `dados` do GPT.
