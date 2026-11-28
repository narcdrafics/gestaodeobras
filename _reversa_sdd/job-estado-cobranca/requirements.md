# Job — Recálculo do estado de cobrança (04:00)

> 🟢 CONFIRMADO · 🟡 INFERIDO. Fontes: `functions/index.js:921-929`, `functions/billing.js`, `flowcharts/billing-e-planos.md` §2-3, `ADR-003`, `RN-016`/`RN-017`/`RN-025`.

## Visão Geral

🟢 Recalcula diariamente o `billingState` de cada tenant com função pura e grava somente transições. É a autoridade que transforma vencimento/trial em acesso (`ativo`, `carencia`, `somente_leitura`, `bloqueado`).

## Responsabilidades

- 🟢 Executar às 04:00 de `America/Sao_Paulo`.
- 🟢 Calcular estado por tenant com `calcularBillingState`.
- 🟢 Gravar apenas quando o estado muda: `billingState`, `billingStateMotivo`, `billingStateAtualizadoEm`.
- 🟢 Isentar `MASTER_SYSTEM` pela chave do RTDB.

## Regras de Negócio

- 🟢 RN-016: precedência MASTER_SYSTEM → bloqueio forçado → trial (30+7) → pago (3/5+7).
- 🟢 RN-017: job não atualiza `status`; campos podem divergir.
- 🟢 `carenciaAte` tem precedência sobre os 5 dias genéricos.
- 🟢 Sem vencimento confiável ⇒ `ativo` (fail-open para contas legadas).
- 🟡 RN-025: janela de até 24 h entre vencimento e job pode defasar banners.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Agendar 04:00 em `America/Sao_Paulo` | Must | Configuração do scheduler correta |
| RF-02 | 🟢 Ler todos os tenants e ignorar nós não-objeto | Must | Job não falha com dado inválido |
| RF-03 | 🟢 Calcular com `calcularBillingState` | Must | Estados conforme §2 do fluxograma |
| RF-04 | 🟢 Gravar somente transições | Must | Estado igual ⇒ nenhuma escrita |
| RF-05 | 🟢 `update()` multi-path único | Must | Todas as transições em uma escrita |
| RF-06 | 🟢 Isentar `MASTER_SYSTEM` pela chave | Must | Master sempre `ativo` |
| RF-07 | 🟡 Não persistir `diasRestantes` | Should | Campo existe só no retorno da função pura |

## Critérios de Aceitação

```gherkin
Dado um tenant em trial expirado há 3 dias
Quando o job roda às 04:00
Então billingState='somente_leitura' e motivo='trial_expirado' são gravados

Dado um tenant já com billingState='ativo' e nenhuma mudança calculada
Quando o job roda
Então nenhuma escrita é feita e o log registra 0/N transições
```

## Rastreabilidade

| Arquivo | Função | Cobertura |
|---------|--------|-----------|
| `functions/billing.js:39-137` | `calcularBillingState` | 🟢 |
| `functions/billing.js:145-175` | `atualizarBillingStatesJob` | 🟢 |
| `functions/index.js:921` | `exports.dailyBillingStateJob` | 🟢 |
| `tests/security/billing.test.js` | — | 🟢 |
