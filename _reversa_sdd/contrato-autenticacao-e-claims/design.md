# Contrato de dados — Autenticação, Design

> 🟢 CONFIRMADO · 🟡 INFERIDO. Fontes: `flowcharts/auth.md`, `flowcharts/seguranca-e-rbac.md`, `ADR-002`, `ADR-006`.

## Estrutura de dados

| Nó | Campos | Confiança |
|----|--------|-----------|
| `profiles/<uid>` | `role`, `tenantId`, `status`, `nome`, módulos RH, obras | 🟢 |
| `users/<emailKey>` | passaporte legado (`role`, `tenantId`, `uid`) | 🟢 |
| `invites/<emailKey>` | convite (`tenantId`, `role`, `usos`) | 🟢 |
| `super_admins/<uid>` | allowlist canônica de master | 🟢 |
| `tenants_public/<slug>` | branding pré-login | 🟢 |
| `admin_audit`, `admin_ops`, cotas | sistema | 🟢 |

## Fluxo principal

1. 🟢 `detectSubdomain()` → `CURRENT_TENANT_ID`.
2. 🟢 Login Firebase; lê `profiles/<uid>`.
3. 🟢 Valida tenant/status/pendência; aguarda claims (`getIdTokenResult(true)`).
4. 🟢 `syncCustomClaims` publica claims no Auth.
5. 🟢 Rules e APIs revalidam no servidor.

## Decisões

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Tenant vem do perfil, não do cliente | `RN-001` | 🟢 |
| Storage não consulta RTDB — usa claims | `storage.rules:4-6` | 🟢 |
| Fail-closed em ambiguidade/autorização | `ADR-004`, `ADR-006` | 🟢 |

## Riscos

- 🔴 GAP-09: alias `mestre`/`EMAIL_MESTRA` replicados.
- 🔴 GAP-10: `syncCustomClaims` sem retry.
- 🟡 GAP-08: emulador de rules inoperante — evidência é asserção estática.
