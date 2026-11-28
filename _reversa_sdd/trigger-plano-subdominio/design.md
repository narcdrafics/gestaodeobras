# Trigger — Feature de subdomínio, Design Técnico

> 🟢 CONFIRMADO · 🟡 INFERIDO. Fonte: `functions/index.js:652-678`, `plan_features.js`, `ADR-001`, `ADR-013`.

## Interface

| Gatilho | Origem | Entrada | Saída |
|---------|--------|---------|-------|
| onValueWritten | `tenants/{tid}/subdominioSlug` | antes/depois | reversão opcional |
| onValueWritten | `tenants/{tid}/config/slug` | antes/depois | reversão opcional |

| Símbolo | Assinatura | Observação |
|---------|-----------|------------|
| `enforceSubdomainPlan` | `(event)` | 🟢 compartilhado pelos dois caminhos |
| `hasFeature` | `(nome, plano, tenant)` | 🟢 retorna false se bloqueado |

## Fluxo

1. 🟢 Se `after` vazio ou igual ao `tenantId`, permite.
2. 🟢 Consulta `hasFeature('subdominio')` no contexto do tenant.
3. 🟢 Sem feature ⇒ restaura `before` ou `tenantId`.
4. 🟢 Remove `tenants_public/<slug>` se pertencer ao tenant.

## Decisões

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Slug criado para todos os planos | RN-021 | 🟢 |
| Enforcement no servidor (Admin SDK) | `index.js:652-678` | 🟢 |
| tenants_public por chave, sem enumeração | `ADR-007` | 🟢 |

## Riscos

- 🟡 GAP-07: listas de reservados divergentes (worker 5 vs. app ~35) e Wrangler duplicado.
