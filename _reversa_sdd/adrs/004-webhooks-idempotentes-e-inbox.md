# ADR 004 — Webhooks com inbox transacional, chave canônica e lease curto

- **Status:** Aceito (retroativo)
- **Data:** 2026-04-24 a 2026-11-23
- **Confiança:** 🟢 CONFIRMADO

## Contexto

Reentregas da Meta e da Kiwify geravam duplicação: mesma mensagem virava duas tarefas, mesmo pedido com `order_status` diferente mudava o plano duas vezes. Respostas 200 antes do processamento faziam o provedor considerar sucesso mesmo após falha interna.

## Decisão

1. Reservar `whatsapp_messages/<msg.id>` por transação **antes** de processar; ACK 200 somente depois do efeito.
2. No Kiwify, usar `orderId + eventType` como chave canônica — **sem** `order_status` — e `payloadHash` que ignora campos de status.
3. Gravar evento em `processing` com lease de 2 minutos; reentrega após expiração é reprocessável; `success` é terminal.
4. Ações administrativas destrutivas usam `admin_ops/<requestId>` com o mesmo padrão, mas dependem de limpeza diária de 24 h.
5. Auditoria obrigatória é fail-closed: falha ⇒ `503 auditoria_falhou`; se o efeito já foi aplicado, reentrega com mesmo `requestId` devolve `200 {idempotente:true}`.

## Alternativas consideradas

- 🟡 **Dedup em memória**: rejeitado — functions escalam horizontalmente e reinício perderia o estado.
- 🟡 **Incluir `order_status` na chave**: rejeitado — o mesmo pedido muda de status ao longo do ciclo e geraria múltiplos efeitos.
- 🟡 **Ack imediato + fila**: rejeitado nesta fase; a fila com dead-letter ainda não existe (🔴 para Graph API).

## Consequências

- Positivas: reentrega é segura, falhas não são reconhecidas como sucesso, triagem de eventos presos é possível pelo status.
- Negativas: reservas e dedup crescem sem limpeza; o job `retencaoSegurancaJob` (03:30) remove 24 h de dedup/reservas e 2 h de cotas.
- Riscos: 🟡 `admin_ops` não tem lease curto; 🔴 Graph API sem retry/dead-letter (P5 sem decisão); 🟢 decisão P4 remove `tarefas_pendentes` (gravação direta em `tarefas`).

## Evidências

`git log`: `86c32f4` harden webhooks/admin APIs/idempotency, `180acb7` dedup de presença, `d53d735` Kiwify, `ef36378` notas de deploy.
Código: `functions/kiwify.js:181-213,227-493`, `functions/whatsapp_auth.js:158-171`, `functions/auditoria.js`, `functions/retencao.js`, `docs/security/hardening.md:22-45`.
