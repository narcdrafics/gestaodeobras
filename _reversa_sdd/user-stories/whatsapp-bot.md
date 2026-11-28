# User Stories — Bot de WhatsApp

> 🟢 CONFIRMADO · 🔴 LACUNA BLOQUEANTE. Fontes: `flowcharts/whatsapp-bot.md`, `webhook-whatsapp/questions.md`, `ADR-004`, `ADR-011`.

## US-WB-01 — Verificar canal com a Meta

**Como** administrador, **quero** que o webhook responda ao handshake da Meta, **para** manter o canal ativo.

```gherkin
Dado `hub.mode=subscribe` e token válido
Quando a Meta faz GET `/api/whatsapp`
Então devolvemos `hub.challenge` com 200
```

🟢 Units: `webhook-whatsapp/`, `contrato-whatsapp/`.

## US-WB-02 — Registrar tarefa por mensagem

**Como** encarregado, **quero** enviar "TAREFA ..." pelo WhatsApp, **para** criar tarefa sem abrir o sistema.

```gherkin
Dado um remetente autorizado e obra identificada
Quando envio "TAREFA Rebocar britador no pátio"
Então uma tarefa `TF###` é gravada com `status='Pendente'` e `origem='WhatsApp'`
```

🟢 Units: `webhook-whatsapp/`, `contrato-whatsapp/`, `contrato-obras-e-tarefas/`.

## US-WB-03 — Lançar ponto por mensagem

**Como** encarregado, **quero** enviar presença pelo WhatsApp, **para** registrar o dia da equipe em campo.

```gherkin
Dado trabalhadores ativos com nomes reconhecidos
Quando envio "PONTO Presente João"
Então `presenca` recebe diária/8h das 07:00 às 17:00
Com `hrLanc` em `America/Sao_Paulo`
```

🟢 Unit: `contrato-whatsapp/`.

## US-WB-04 — Não processar mensagem repetida

**Como** operador, **quero** que a reentrega da Meta não duplique ações, **para** manter os dados consistentes.

```gherkin
Dado uma mensagem já processada com o mesmo `msg.id`
Quando a Meta reenvia
Então respondemos `200 DUPLICATE` sem nova gravação
```

🟢 Units: `webhook-whatsapp/`, `contrato-whatsapp/`.

## US-WB-05 — Receber resumo diário

**Como** administrador, **quero** receber um resumo diário às 18h, **para** acompanhar a operação sem abrir o painel.

```gherkin
Dado um tenant com feature `relatorio.whatsapp.diario` e `adminPhone`
Quando o job das 21:00 UTC executa
Então um resumo com presenças, faltas e tarefas é enviado ao administrador
```

🟢 Unit: `job-relatorio-diario/`. 🔴 Fato: leitura usa `ponto/<hoje>`; 🟢 decisão P3: ler `presenca` (ajuste pendente).

## US-WB-06 — Entender mensagem de áudio

**Como** encarregado, **quero** enviar áudio, **para** registrar tarefas sem digitar.

```gherkin
Dado um áudio de até 8 MB hospedado em domínio permitido
Quando o webhook recebe
Então é transcrito com Whisper-1 em português e processado como texto
```

🟢 Unit: `contrato-whatsapp/`.

## Lacunas bloqueantes (não implementar sem decisão)

| ID | Lacuna | Impacto |
|----|--------|---------|
| 🟢 GAP-01 (P1) | responder com resumo de presença de hoje do remetente | US de consulta de ponto tem comportamento definido |
| 🟢 GAP-02 (P2) | ativar prévia/confirmação no webhook | Fluxo passa a ser ativo após integração |
| 🟢 GAP-03 (P3) | `presenca` canônico | US-WB-05 completa após ajuste do job |
| 🟢 GAP-04 (P4) | `tarefas_pendentes` removido | Sem caminho divergente; gravação direta em `tarefas` |
| 🔴 GAP-05 | Graph API sem retry/fila/dead-letter | Entrega de resposta não garantida |
