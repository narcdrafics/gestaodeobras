# Contrato de dados — Admin e usuários, Design

> 🟢 CONFIRMADO · 🟡 INFERIDO. Fontes: `flowcharts/admin-e-super-admin.md`, `flowcharts/usuarios-e-cargos.md`, `ADR-002`, `ADR-006`.

## Estrutura de dados

| Nó | Campos | Confiança |
|----|--------|-----------|
| `invites/<emailKey>` | `email`, `tenantId`, `role`, `usos` | 🟢 |
| `profiles/<uid>` | `role`, `tenantId`, `status`, módulos RH, obras | 🟢 |
| `users/<emailKey>` | passaporte legado | 🟢 |
| `super_admins/<uid>` | allowlist canônica | 🟢 |
| `admin_ops`, `admin_audit` | reserva e trilha | 🟢 |

## Fluxo

1. 🟢 Cliente grava convite; chama `/api/admin/criar-usuario`.
2. 🟢 API consome convite e cria conta no Auth.
3. 🟢 `/api/admin/cargo` define cargo; espelha nós e revoga tokens.
4. 🟢 `syncCustomClaims` publica claims.
5. 🟢 Painel Master usa `/api/admin/conta` com reserva/auditoria.

## Decisões

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Servidor confirma hierarquia, não cliente | `ADR-002` | 🟢 |
| `requestId` como idempotência | `ADR-004` | 🟢 |
| Revogação explícita de tokens | `ADR-006` | 🟢 |

## Riscos

- 🔴 GAP-09 (alias master), GAP-10 (sem retry de claims).
- 🟡 GAP-06 (`status` × `billingState`) afeta ações de plano do painel.
