---
title: Plano de Implementação WhatsApp Bot
topic: whatsapp-bot
updated: 2026-05-07
---

# Plano de Implementação WhatsApp Bot

Guia passo a passo para implementar a integração do WhatsApp Business com detecção automática de etapas de obra.

## Visão Geral do Sistema

```
WhatsApp → Webhook → Transcription (Whisper)
  → Detecção de Etapas (obra-etapas.js)
  → Preview → Confirmação → Firebase (tarefas)
```

## Fases de Implementação

### Fase 1: Estrutura de Arquivos (Dia 1)

Criar diretórios e arquivos:
- `functions/whatsapp/webhook.js`
- `functions/whatsapp/sender.js`
- `functions/whatsapp/parser.js`
- `functions/whatsapp/obra-etapas.js` ← Detecção de etapas
- `functions/whatsapp/parser-tarefas.js` ← Áudio → tarefas
- `functions/scheduled/daily-report.js` ← Relatório 18h

### Fase 2: Configuração Firebase

1. Adicionar rota `/api/whatsapp` no firebase.json
2. Atualizar CSP (Content-Security-Policy)
3. Exportar functions em index.js
4. Configurar secrets (META_ACCESS_TOKEN, etc)
5. Atualizar database.rules.json

### Fase 3: Integração Meta

1. Criar App Business no Meta for Developers
2. Adicionar produto WhatsApp
3. Registrar webhook URL e verify token
4. Subscrever no campo `messages`
5. Criar message templates (para relatórios)

### Fase 4: Testes Locais

```bash
# Testar handshake GET
curl "localhost:5001/.../whatsappWebhook?hub.mode=subscribe&hub.verify_token=..."

# Testar detecção de etapas
node -e "const {extrairTarefas}=require('./functions/whatsapp/obra-etapas'); console.log(extrairTarefas('reboco no quarto, tubes de esgoto'))"
```

### Fase 5: Deploy

```bash
firebase deploy --only functions
firebase deploy --only hosting
```

### Fase 6: Produção

1. Enviar "OI" para número comercial
2. Testar MENU, TAREFA, PONTO
3. Testar áudio → tarefa

### Fase 7: Relatório Automático

- Configurar `adminPhone` em cada tenant
- Deploy dailyReport (cron 21:00 UTC = 18h Brasília)

## Lista de Arquivos a Criar/Modificar

| Arquivo | Ação |
|--------|------|
| functions/whatsapp/webhook.js | Criar |
| functions/whatsapp/sender.js | Criar |
| functions/whatsapp/parser.js | Criar |
| functions/whatsapp/obra-etapas.js | Criar |
| functions/whatsapp/parser-tarefas.js | Criar |
| functions/scheduled/daily-report.js | Criar |
| functions/index.js | Modificar (adicionar exports) |
| firebase.json | Modificar (rota + CSP) |
| database.rules.json | Modificar (tarefas_pendentes) |

## Secrets Necessários

```bash
firebase functions:config:set \
  meta.token="EAA..." \
  meta.phone_id="10646..." \
  meta.verify_token="obrareal_whatsapp_2026" \
  meta.app_secret="..." \
  meta.waba_id="..." \
  openai.key="sk-..."
```

## Fontes

[obra-etapas.js](../raw/whatsapp-bot/2026-05-07-obra-etapas.md); [parser-tarefas.js](../raw/whatsapp-bot/2026-05-07-parser-tarefas.md); [EXECUTAR.md](../raw/whatsapp-bot/2026-05-07-executar-plano-implementacao.md)

## See Also

- [Detecção Automática de Etapas](detecao-etapas-obra.md)
- [Parser de Tarefas WhatsApp](parser-tarefas-audio.md)