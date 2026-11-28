# Trigger — Feature de subdomínio

> 🟢 CONFIRMADO · 🟡 INFERIDO. Fontes: `functions/index.js:677-678,652-678`, `functions/plan_features.js`, `flowcharts/billing-e-planos.md` §6, RN-021/RN-055.

## Visão Geral

🟢 Garante que alteração/personalização de subdomínio respeite a feature de plano. O slug inicial (igual ao `tenantId`) é permitido a todos; trocas posteriores exigem a feature `subdominio`.

## Responsabilidades

- 🟢 Observar `tenants/{tid}/subdominioSlug` e `tenants/{tid}/config/slug`.
- 🟢 Permitir valor vazio ou igual ao `tenantId`.
- 🟢 Consultar `hasFeature('subdominio', tenant)` para valores divergentes.
- 🟢 Reverter escrita negada e limpar `tenants_public/<slug>` se pertencer ao tenant.

## Regras de Negócio

- 🟢 RN-021: slug é criado para todos os planos; a feature vale apenas para alteração/personalização.
- 🟢 RN-055: worker bloqueia 5 reservados; app bloqueia ~35 nomes (listas divergentes).
- 🟢 `hasFeature` retorna `false` para tenant bloqueado.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Observar ambos os caminhos de slug | Must | Escrita em qualquer um dispara |
| RF-02 | 🟢 Permitir slug inicial | Must | Vazio ou igual ao tenantId não é revertido |
| RF-03 | 🟢 Exigir feature `subdominio` para troca | Must | Sem feature ⇒ reversão para valor anterior/tenantId |
| RF-04 | 🟢 Limpar `tenants_public/<slug>` órfão | Must | Entrada pertencente ao tenant é removida na reversão |
| RF-05 | 🟡 Listas de reservados divergentes | Should | GAP-07 registrado; não presumir config única |

## Critérios de Aceitação

```gherkin
Dado um tenant free com subdominioSlug igual ao tenantId
Quando o valor é alterado para outro slug
Então a escrita é revertida e tenants_public não fica com entrada órfã

Dado um tenant com feature subdominio habilitada e billingState ativo
Quando o slug é alterado
Então a alteração é mantida e tenants_public reflete o novo slug
```

## Rastreabilidade

| Arquivo | Função | Cobertura |
|---------|--------|-----------|
| `functions/index.js:677-678` | `enforceSubdomainPlan`, `enforceConfigSlugPlan` | 🟢 |
| `functions/plan_features.js` | `hasFeature` | 🟢 |
| `public/js/slug.js` | lista de reservados (~35) | 🟡 |
| `cloudflare-worker/worker.js` | lista de reservados (5) | 🟡 |
