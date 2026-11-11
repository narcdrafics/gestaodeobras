---
title: Detecção Automática de Etapas de Obra
topic: whatsapp-bot
updated: 2026-05-07
---

# Detecção Automática de Etapas de Obra

Sistema de mapeamento semântico que transforma linguagem natural (transcrita de áudio ou digitada via WhatsApp) em etapas padronizadas de obra,自动 filling the `etapa` field in task records.

## Como Funciona

1. **Texto entrada** → normalização (remove acentos, minúsculas)
2. **Busca por termos** → matching contra lista mestra
3. **Cálculo de score** → termos compostos valem mais
4. **Retorno da melhor etapa** → com confiança

## Etapas Suportadas

| Código | Etapa | Exemplos de Termos |
|--------|------|---------------------|
| FUND | Terraplanagem e Fundação | terraplanagem, fundação, sapata, estaca, radier |
| ESTR | Estrutura | concreto armado, laje, viga, pilar, forma, ferragem |
| ALVE | Alvenaria | tijolo, bloco, reboco, chapisco, gesso, contrapiso |
| COBE | Cobertura | telhado, telha, madeiramento, calha, impermeabilização |
| HIDR | Hidrossanitário | encanamento, tubo, registro, vaso,pia, chuveiro |
| ELET | Elétrica | fiação, disjuntor, tomadas, quadro, aterramento |
| ESQU | Esquadrias | porta, janela, vidro, grade, basculante |
| ACAB | Revestimento e Acabamento | pintura, piso, rodapé, gesso, textura |
| ESPE | Instalações Especiais | gás, painel solar, automação, interfone |
| URBA | Urbanização e Paisagismo | jardim, calçada, piscina, deck |

## API

```javascript
const { detectarEtapas, extrairTarefas } = require('./obra-etapas');

const etapas = detectarEtapes("fazer reboco no quarto");
// [{ etapa: "Alvenaria", codigo: "ALVE", score: 3, termos: ["reboco"] }]

const tarefas = extrairTarefas("colocar tubos de esgoto, instalar tomadas");
// [{ titulo: "Colocar tubos de esgoto", etapa: "Hidrossanitário", etapaCodigo: "HIDR", confianca: "media", ... }]
```

## Confiança

- **Alta** (score ≥ 3): termo composto detectado
- **Média** (score 1-2): termo simples detectado
- **Baixa**: nenhuma etapa detectada —标记 para revisão

## Extensibilidade

Para adicionar novos termos, editar o array `ETAPAS` em `obra-etapas.js`:
```javascript
{
  etapa: 'Nova Etapa',
  codigo: 'NOVO',
  palavras: ['termo1', 'termo2', 'outro termo']
}
```

## Sources

[obra-etapas.js](../raw/whatsapp-bot/2026-05-07-obra-etapas.md); [parser-tarefas.js](../raw/whatsapp-bot/2026-05-07-parser-tarefas.md)

## See Also

- [Parser de Tarefas WhatsApp](parser-tarefas-audio.md)
- [Plano de Implementação](plano-implementacao-whatsapp.md)