# Trigger — Limite de obras

> 🟢 CONFIRMADO · 🟡 INFERIDO. Fontes: `functions/index.js:644-647,541-578`, `flowcharts/billing-e-planos.md` §6, `ADR-003`.

## Visão Geral

🟢 Impede que um tenant ultrapasse o limite de obras do plano mesmo em escritas diretas via Admin SDK/DevTools (as rules do cliente não bastam).

## Responsabilidades

- 🟢 Observar `tenants/{tenantId}/obras`.
- 🟢 Comparar quantidade antes/depois.
- 🟢 Reverter escrita que estoura `config/limiteObras`.
- 🟢 Preservar registros legados quando não há estado anterior seguro.

## Regras de Negócio

- 🟢 Remoção/edição (quantidade não cresce) sempre permitida.
- 🟢 Ausência de metadado ⇒ `LIMITE_FALLBACK=1` (nunca 0 nem ilimitado).
- 🟢 Limite ≥ 9999 ⇒ sem enforcement.
- 🟢 Reversão aborta se `beforeVal` é vazio.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Disparar em `tenants/{tid}/obras` | Must | Escrita dispara validação |
| RF-02 | 🟢 Permitir quando quantidade não aumenta | Must | Edição/remoção nunca revertida |
| RF-03 | 🟢 Limite normalizado de `config/limiteObras` | Must | Fallback 1; ≥9999 sem trava |
| RF-04 | 🟢 Reverter por transação quando excede | Must | Quantidade final ≤ limite |
| RF-05 | 🟢 Abortar reversão sem estado anterior seguro | Must | Legado preservado |

## Critérios de Aceitação

```gherkin
Dado um tenant com limiteObras=2 e 2 obras
Quando uma terceira obra é adicionada via Admin SDK
Então a transação reverte a escrita e a quantidade permanece 2

Dado um tenant sem config de limite
Quando uma obra é adicionada
Então o limite considerado é 1 e a escrita é revertida
```

## Rastreabilidade

| Arquivo | Função | Cobertura |
|---------|--------|-----------|
| `functions/index.js:644-647` | `enforceObrasLimit` | 🟢 |
| `functions/index.js:541-578` | `enforceGrowthLimit` | 🟢 |
| `flowcharts/billing-e-planos.md` §6 | — | 🟢 |
