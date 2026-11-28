# Contrato de dados — Tenants, slug e domínio

> 🟢 CONFIRMADO · 🟡 INFERIDO. Cobre `tenants-e-slug` (matriz §4). Fontes: `flowcharts/tenants-e-slug.md`, `public/js/slug.js`, `cloudflare-worker/worker.js`, `data-dictionary.md` §7-9/§115, `ADR-001`, `ADR-007`, `ADR-013`.

## Visão Geral

🟢 Onboarding de empresa com escolha de slug, publicação em `tenants_public` e roteamento por subdomínio na borda (Cloudflare Worker). O slug é a chave de isolamento do tenant.

## Responsabilidades

- 🟢 Normalizar slug (NFD, 3–30 caracteres, `a-z0-9`).
- 🟢 Bloquear nomes reservados (app ~35, worker 5) e verificar disponibilidade por chave.
- 🟢 Publicar branding pré-login em `tenants_public/<slug>`.
- 🟢 Fazer proxy wildcard com CORS e cache por tipo de arquivo.

## Regras de Negócio

- 🟢 RN-015: leitura de `tenants_public` por chave, sem enumeração.
- 🟢 RN-054: hostname é autoridade em produção; `?tenant=` só em localhost/domínios Firebase.
- 🟢 RN-055: listas de reservados divergentes.
- 🟢 RN-056: assets cacheados 1 h; HTML nunca cacheado.
- 🟢 RN-021: slug criado para todos os planos.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Normalizar e validar slug | Must | Caracteres inválidos/fora do tamanho rejeitados |
| RF-02 | 🟢 Reservados bloqueados | Must | Nomes das listas não aceitos |
| RF-03 | 🟢 Disponibilidade por chave | Must | Sem `orderByChild` |
| RF-04 | 🟢 `tenants_public` publicado | Must | Branding visível no login do slug |
| RF-05 | 🟢 `extractSlug` do hostname | Must | Subdomínio correto em produção |
| RF-06 | 🟢 CORS allowlist + `Vary: Origin` | Must | Origens não permitidas rejeitadas |
| RF-07 | 🟢 Cache 1 h para assets, none para HTML | Must | Headers corretos |
| RF-08 | 🟡 Unificar listas/config | Should | GAP-07 registrado |

## Critérios de Aceitação

```gherkin
Dado um slug reservado na lista do worker
Quando o usuário tenta escolhê-lo
Então a escolha é rejeitada antes da gravação

Dado uma requisição para slug.obrareal.com/index.html
Quando o worker responde
Então o header de cache é ausente para HTML e presente para assets
```

## Rastreabilidade

| Arquivo | Símbolo | Cobertura |
|---------|---------|-----------|
| `public/js/slug.js:14-48` | normalização/reservados | 🟢 |
| `cloudflare-worker/worker.js:29-142` | `extractSlug`, `applyCors`, `proxyToFirebase` | 🟢 |
| `firebase.json:11-40` | rewrites | 🟢 |
| `database.rules.json` | `tenants_public` | 🟢 |
