# Job — Estado de cobrança, Design Técnico

> 🟢 CONFIRMADO · 🟡 INFERIDO. Fonte: `functions/billing.js`, `functions/index.js:921`, `ADR-003`.

## Interface

| Gatilho | Config | Saída |
|---------|--------|-------|
| onSchedule | `every day 04:00`, `America/Sao_Paulo` | `update()` multi-path em `tenants` |

| Símbolo | Assinatura | Observação |
|---------|-----------|------------|
| `calcularBillingState` | `(tenantData, agora, tenantId)` | 🟢 função pura |
| `atualizarBillingStatesJob` | `(db)` | 🟢 varredura + escrita única |

## Máquina de estados

| Estado | Motivo | Condição |
|--------|--------|----------|
| 🟢 `ativo` | `master_system` / `trial_vigente` / `plano_vigente` / `sem_vencimento` | precedência documentada |
| 🟢 `carencia` | `carencia_webhook` / `vencido_em_carencia` | 3 ou 5 dias |
| 🟢 `somente_leitura` | `trial_expirado` / `carencia_expirada` | +7 dias |
| 🟢 `bloqueado` | `trial_encerrado` / `inadimplente` / `bloqueio_manual` | após janela |

## Fluxo

1. 🟢 `tenants.once('value')`.
2. 🟢 Para cada tenant objeto: calcula estado com `agora`.
3. 🟢 Compara com `billingState || 'ativo'`.
4. 🟢 Diferente ⇒ acumula updates; igual ⇒ ignora.
5. 🟢 `db.ref().update(updates)` único + log.

## Decisões

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Função pura, sem efeitos | `billing.js:39-137` | 🟢 |
| Somente transições gravadas | `billing.js:159-166` | 🟢 |
| Fail-open sem vencimento | `billing.js:101-105` | 🟢 |

## Riscos

- 🟡 GAP-06: `status` e `billingState` divergentes.
- 🟡 Janela de até 24 h (RN-025) — aceitar como comportamento legado documentado.
