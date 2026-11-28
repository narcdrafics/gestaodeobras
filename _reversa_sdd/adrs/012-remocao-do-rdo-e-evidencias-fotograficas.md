# ADR 012 — Remoção do RDO e foco em evidências fotográficas

- **Status:** Aceito (retroativo)
- **Data:** 2026-04-29 a 2026-11-25
- **Confiança:** 🟢 CONFIRMADO (remoção) · 🟡 INFERIDO (motivação)

## Contexto

Existia um módulo de RDO (relatório diário de obra) com modal e nó próprio no banco. Ele sobrepunha funcionalidades já cobertas por presença, tarefas e fotos, e exigia manutenção de impressão/PDF própria.

## Decisão

1. Remover o módulo RDO e seus modais, além do nó de rules correspondente.
2. Concentrar evidência em fotos anexadas a tarefas e medições, com galeria, filtros de impressão e otimização de imagem.
3. Sanitizar URLs antes de usá-las em `src`/`onclick`; Storage só aceita `image/*` ou PDF de até 10 MB sob `tenants/<tid>/`.

## Alternativas consideradas

- 🟡 **Manter RDO e integrá-lo ao relatório**: rejeitado — duplicidade de fontes de verdade para a mesma informação.
- 🟡 **Fotos sem sanitização**: rejeitado por risco de XSS em atributos HTML gerados dinamicamente.

## Consequências

- Positivas: menos código morto, uma única trilha de evidência, impressão unificada no relatório.
- Negativas: histórico de RDO antigo pode ficar órfão no banco.
- Riscos: 🔴 redeclaração global de `auditSafeImage` já causou `SyntaxError` e foi corrigida (`2ccc965`); 🟡 o parser de fotos e o fluxo ativo podem divergir na normalização de URL.

## Evidências

`git log`: `312a47a` (RDO implementado), `2c46ea1` + `7772bf8` (remoção), `7f0ad54` (galeria/filtros/otimização), `fa249c0`, `2ccc965`.
Código: `data-dictionary.md §80`, `public/js/app_core.js` (`renderFotos`), `storage.rules:24-40`, `code-analysis.md` módulo `fotos`.
