# Bloqueio no servidor — política de cobrança

## Política definida

| Situação | Janela | Estado (`tenants/{id}/billingState`) | Leitura | Escrita |
|----------|--------|--------------------------------------|---------|---------|
| Trial vigente | 30 dias | `ativo` | ✅ | ✅ |
| Trial vencido | 7 dias | `somente_leitura` | ✅ | ❌ |
| Trial encerrado | após 7 dias | `bloqueado` | ❌ | ❌ |
| Plano pago vigente | — | `ativo` | ✅ | ✅ |
| Plano pago vencido (renovação/cancelamento) | 3 a 5 dias de carência | `carencia` | ✅ | ✅ |
| Carência esgotada | 7 dias | `somente_leitura` | ✅ | ❌ |
| Prazo final | após a leitura | `bloqueado` | ❌ | ❌ |
| Chargeback / reembolso / suspensão manual | imediato | `bloqueado` | ❌ | ❌ |

A carência de **3 dias** é aplicada pelo webhook em cancelamentos; a de **5 dias**, em falha de renovação. O campo `carenciaAte` gravado pelo webhook tem precedência sobre a janela genérica de 5 dias.

`MASTER_SYSTEM` nunca entra nesses estados.

## Onde a política é aplicada

1. **Job diário** — `exports.dailyBillingStateJob` em `functions/index.js` (04:00, `America/Sao_Paulo`) chama `atualizarBillingStatesJob()` em `functions/billing.js`, que recalcula `billingState` para todos os tenants e grava `billingStateMotivo` + `billingStateAtualizadoEm` nas transições.
2. **Webhook Kiwify** — `functions/kiwify.js` já aplica o estado imediatamente nos eventos de aprovação, reembolso, chargeback, cancelamento e atraso.
3. **Regras do RTDB** — `database.rules.json`:
   - `tenants/{id}`: nega escrita em `somente_leitura`/`bloqueado` e leitura em `bloqueado`;
   - `estoque`, `estoque/canteiro`, `tarefas_pendentes`, `tenants_public`: mesmas restrições;
   - `tenants/{id}/billingState`: **continua legível** mesmo quando o tenant está bloqueado — sem essa exceção o front não conseguiria exibir a tela de bloqueio; o campo é imutável para o cliente (somente Admin SDK/grupos `super_admin`).
4. **Front-end** (`public/js/data_core.js`) — somente **experiência de uso**:
   - tela de bloqueio com botões de pagamento/reativação (`#screen-blocked`) substitui o antigo `alert + logout`;
   - banner de somente leitura/carência (`#billing-banner-container`), preservado pelo `showPage()` em `app_core.js`;
   - `window.IS_READONLY_MODE` e `persistDB()` evitam gravações locais/nuvem, mas a autoridade é o servidor;
   - listener separado em `tenants/{id}/billingState` funciona mesmo quando a leitura do nó inteiro é negada.

## Testes

- `tests/security/billing.test.js` — regras puras de transição de estado e job com banco fictício.
- `tests/security/rules.test.js` — regras do RTDB, job agendado e integração front-end.
