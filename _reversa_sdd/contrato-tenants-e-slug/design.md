# Contrato de dados — Tenants e slug, Design

> 🟢 CONFIRMADO · 🟡 INFERIDO. Fontes: `flowcharts/tenants-e-slug.md`, `worker.js`, `slug.js`, `ADR-001`, `ADR-007`, `ADR-013`.

## Estrutura de dados

| Nó | Campos | Confiança |
|----|--------|-----------|
| `tenants/<slug>` | plano, limites, billing, config, branding | 🟢 |
| `tenants_public/<slug>` | nome, logo, cores (pré-login) | 🟢 |
| `config/slug` e `subdominioSlug` | endereço do tenant | 🟢 |

## Fluxo

1. 🟢 Usuário escolhe slug; app normaliza e checa reservados/disponibilidade.
2. 🟢 Cria `tenants/<slug>` e `tenants_public/<slug>`.
3. 🟢 Worker extrai slug do hostname e aplica CORS.
4. 🟢 `proxyToFirebase` repassa path/query/headers com cache seletivo.
5. 🟢 Trigger de feature de subdomínio controla alterações posteriores.

## Decisões

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Slug = tenantId | `ADR-001` | 🟢 |
| Sem enumeração de tenants | `ADR-007` | 🟢 |
| Trial de 30 dias no onboarding | `ADR-013` | 🟢 |

## Riscos

- 🟡 GAP-07: CORS duplicado (`cors.json` + `worker.js`), Wrangler duplicado, Node 20/24.
- 🟡 Listas de reservados divergentes (app ~35 vs. worker 5).
