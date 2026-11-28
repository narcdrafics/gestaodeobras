# Trigger — Limite de obras, Design Técnico

> 🟢 CONFIRMADO. Fonte: `functions/index.js:541-578,644-647`.

## Interface

| Gatilho | Origem | Entrada | Saída |
|---------|--------|---------|-------|
| onValueWritten | `tenants/{tid}/obras` | antes/depois | transação de reversão opcional |

| Símbolo | Assinatura | Observação |
|---------|-----------|------------|
| `enforceGrowthLimit` | `(event, campo, db)` | 🟢 lógica compartilhada |
| `enforceObrasLimit` | `(event)` | 🟢 wrapper para `obras` |

## Fluxo

1. 🟢 Lê quantidade `after` e `before`; se `after <= before`, permite.
2. 🟢 Lê `tenants/<tid>/config/<campo>`; ausente ⇒ `LIMITE_FALLBACK=1`.
3. 🟢 Limite ≥ 9999 ⇒ permite.
4. 🟢 `after > limite` ⇒ transação restaura `beforeVal` ou aborta se ausente.

## Decisões

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Enforcement no Admin SDK, não nas rules | `index.js:541-545` | 🟢 |
| Fallback 1 (fail-closed) | `index.js:548-554` | 🟢 |
| Preservação de legado | `index.js:568-578` | 🟢 |

## Riscos

- 🟡 Limite de `trabalhadores` do catálogo não tem trigger equivalente (documentado na matriz §3 #6 e fluxograma §6).
