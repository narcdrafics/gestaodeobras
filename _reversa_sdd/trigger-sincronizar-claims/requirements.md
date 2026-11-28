# Trigger — Sincronizar Custom Claims

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `functions/index.js:680-817`, `functions/claims.js`, `_reversa_sdd/flowcharts/auth.md`, `domain.md` RN-003–RN-009, `ADR-002`, `ADR-006`.

## Visão Geral

🟢 Reage a escritas em `profiles/<uid>` e publica no Firebase Auth as claims usadas por Storage Rules e pelo cliente: `role`, `tenantId`, `modulosPermitidos`, `acessoObras`, `obrasPermitidas`. É a única autoridade que transforma perfil em autorização efetiva.

## Responsabilidades

- 🟢 Normalizar papel (`mestre` → `encarregado`) e conter auto-promoção a `super_admin`.
- 🟢 Resolver master por `super_admins/<uid>`, e-mail mestre legado ou passaporte.
- 🟢 Aplicar limite de assentos: perfil acima do limite vira `pendente` sem `tenantId`.
- 🟢 Propagar módulos de RH e escopo de obras (até 50) nas claims.
- 🟢 Revogar tokens em bloqueio e rebaixamento de master.

## Regras de Negócio

- 🟢 RN-004: `bloqueado` revoga tokens; `pendente` recebe `{role:'pendente', tenantId:null}`.
- 🟢 RN-005: tentativa de auto-promover é corrigida para `admin` com `cargoAtualizadoPor`.
- 🟢 RN-006: `users/<email>/role` nunca promove — só preserva master já existente.
- 🟢 RN-008: RH com `acessoObras='especificas'` recebe até 50 `obrasPermitidas`.
- 🟢 RN-009: papel efetivo nas decisões é o maior entre claim e perfil.
- 🟡 GAP-09: alias `mestre` e `EMAIL_MESTRA` replicados.
- 🔴 GAP-10: sem retry/dead-letter na publicação de claims.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Disparar em `profiles/{uid}` | Must | Escrita no perfil publica claims no Auth |
| RF-02 | 🟢 Normalizar `mestre` → `encarregado` | Must | Claim resultante nunca contém `mestre` |
| RF-03 | 🟢 Corrigir auto-promoção para `admin` | Must | Perfil gravado com `admin` e `cargoAtualizadoPor` |
| RF-04 | 🟢 Master por allowlist/e-mail/passaporte | Must | Ordem RN-007 respeitada |
| RF-05 | 🟢 Aplicar limite de assentos | Must | Acima do limite ⇒ `pendente`, claim sem `tenantId` |
| RF-06 | 🟢 Propagar módulos e obras de RH | Must | `modulosPermitidos` e até 50 `obrasPermitidas` presentes na claim |
| RF-07 | 🟢 Revogar tokens em bloqueio/rebaixamento | Must | `revokeRefreshTokens` chamado |
| RF-08 | 🟢 Perfil sem tenant de admin não é adotado | Must | `tenantId` permanece `null` |
| RF-09 | 🔴 Definir retry/alerta na falha de publicação | Should | GAP-10 registrado como bloqueante operacional |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | Server é a única autoridade de claims | `ADR-002`, `ADR-006` | 🟢 |
| Consistência | Claims espelham perfil no Auth | `index.js:762-809` | 🟢 |
| Disponibilidade | 🔴 Sem retry na publicação | `GAP-10` | 🟢 |

## Critérios de Aceitação

```gherkin
Dado um perfil com cargo auto-promovido a super_admin
Quando o trigger dispara
Então o perfil é corrigido para admin, `cargoAtualizadoPor` é gravado e tokens são revogados se era master

Dado um tenant com limiteUsuarios atingido e um novo perfil
Quando o perfil é escrito
Então status='pendente' e a claim emitida não contém tenantId

Dado um RH com acessoObras='especificas' e 60 obras no perfil
Quando as claims são publicadas
Então no máximo 50 obras aparecem na claim
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-08 | Must | Contrato de autorização para Storage e cliente |
| RF-09 | Should | Confiabilidade operacional |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `functions/index.js:680-817` | `exports.syncCustomClaims`, `aplicarLimiteDeAssentos` | 🟢 |
| `functions/claims.js` | `avaliarSuperAdmin`, `normalizarRole` | 🟢 |
| `storage.rules:4-22` | consumo das claims | 🟢 |
| `database.rules.json:79-128` | recorte RH | 🟢 |
