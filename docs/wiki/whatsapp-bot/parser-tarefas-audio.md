---
title: Parser de Tarefas WhatsApp Áudio
topic: whatsapp-bot
updated: 2026-05-07
---

# Parser de Tarefas WhatsApp Áudio

Processador de mensagens de áudio do WhatsApp que transcreve via Whisper e detecta automaticamente as etapas de obra usando obra-etapas.js.

## Fluxo

```
Áudio WhatsApp → Baixar → Whisper API → Texto 
→ Detectar Etapas → Preview Confirmação → Salvar
```

## API Keys Necessárias

- `META_ACCESS_TOKEN` (via Meta for Developers)
- `META_PHONE_NUMBER_ID` (via Meta)
- `OPENAI_KEY` (via OpenAI Platform)

## Funções Exportadas

### handleAudioTarefas(mediaId, tenant, from)

1. Baixa o áudio via Graph API
2. Envia para Whisper (model: whisper-1, language: pt)
3. Chama `extrairTarefas()` do obra-etapas.js
4. Salva tarefas temporárias em `tarefas_pendentes/{from}`
5. Retorna preview para confirmação do usuário

### confirmarTarefas(tenant, from, prazo, responsavel)

1. Lê tarefas pendentes do Firebase
2. Para cada tarefa: cria nó em `tarefas`
3. Remove pendentes
4. Retorna confirmação

### editarTarefaPendente(texto, tenant, from)

Edita tarefa antes de confirmar.
- Formato: `EDITAR 2 nova descrição`
- Redetecta etapa automaticamente

## Estrutura Firebase

```
tenants/{tenantId}/
  tarefas_pendentes/
    {phone}/
      transcricao: "texto transcrito"
      tarefas: [{ titulo, etapa, etapaCodigo, confianca, ... }]
      timestamp: 1234567890
```

## Comandos de Confirmação

| Comando | Ação |
|---------|------|
| CONFIRMAR | Salva todas as tarefas pendentes |
| EDITAR N descrição | Altera tarefa N |
| CANCELAR | Descarta pendentes |

## Sources

[parser-tarefas.js](../raw/whatsapp-bot/2026-05-07-parser-tarefas.md); [obra-etapas.js](../raw/whatsapp-bot/2026-05-07-obra-etapas.md)

## See Also

- [Detecção Automática de Etapas](detecao-etapas-obra.md)
- [Plano de Implementação](plano-implementacao-whatsapp.md)