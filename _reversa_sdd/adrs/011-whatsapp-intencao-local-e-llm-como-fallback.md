# ADR 011 — WhatsApp com intenção local primeiro e LLM como fallback

- **Status:** Aceito (retroativo; parcialmente divergente do plano documentado)
- **Data:** 2026-05-07 a 2026-11-25
- **Confiança:** 🟢 para o fluxo ativo · 🟡 para o plano legado

## Contexto

O bot precisava transformar texto e áudio em tarefas e pontos sem exigir que o usuário aprendesse comandos rígidos. Ao mesmo tempo, custo e latência de chamadas ao GPT precisavam ser controlados, e mensagens duplicadas da Meta não podiam gerar duas tarefas.

## Decisão

1. Verificação em camadas: token de verificação, HMAC-SHA256 do corpo cru, allowlist de WABA/origem e hosts de mídia.
2. Dedup transacional em `whatsapp_messages/<msg.id>`; ACK 200 **após** processar.
3. Áudio (até 8 MB) transcrito com Whisper; intenções explícitas (`lancar_ponto`, `criar_tarefa`, `consultar`) resolvidas localmente; GPT-4o-mini como fallback.
4. Busca de obra em três níveis: exata (nome/código/`_id`) → contém → fuzzy 0,3, filtrando status ativo/em andamento/planejada/execução.
5. Telefone casado com `users` ou `telefonesPermitidos`; ambiguidade entre tenants ⇒ fail-closed.
6. Bloqueio por cobrança reusa `billingState`, sem regra paralela.

## Alternativas consideradas

- 🟡 **Somente LLM**: rejeitado por custo, latência e não determinismo em comandos simples.
- 🟡 **Somente regex/comandos fixos**: rejeitado pela usabilidade em áudio e linguagem informal.
- 🟡 **Fila externa para respostas**: desejável, ainda não implementada.

## Consequências

- Positivas: comandos comuns determinísticos, resiliência a reentrega, isolamento por telefone e tenant.
- Negativas: dois fluxos convivem no código — o ativo grava direto e o parser de prévia/confirmação está desconectado.
- Riscos: 🔴 fatos no código — `consultar_ponto` sem branch, `norm(o.cod)` pode lançar, Graph API sem retry/dead-letter, `dailyReport` lê `ponto/<hoje>`; 🟢 decisões: P1 (resumo de presença de hoje), P3 (`presenca` canônico), P20 (códigos numéricos válidos); 🔴 P5 sem decisão.

## Evidências

`git log`: `b24e03b`, `9bfd08b`, `868d907`, `57541f4`, `86c32f4`, `cb54b01`.
Código: `functions/index.js:129-446`, `functions/whatsapp_auth.js`, `functions/whatsapp/parser-tarefas.js` (não importado), `docs/wiki/whatsapp-bot/` (legado), `tests/whatsapp-auth.test.js`.
