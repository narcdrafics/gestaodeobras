# Contrato de evento — subdomínio × plano

> 🟢 CONFIRMADO em `functions/index.js`, `plan_features.js`.

## Gatilhos

```js
onValueWritten("tenants/{tid}/subdominioSlug", enforceSubdomainPlan)
onValueWritten("tenants/{tid}/config/slug", enforceSubdomainPlan)
```

## Regras

| Condição | Resultado |
|----------|-----------|
| 🟢 `after` vazio ou igual a `tenantId` | permitido |
| 🟢 `hasFeature('subdominio') === true` e tenant ativo | permitido |
| 🟢 caso contrário | revertido para `before` ou `tenantId` |

## Efeito colateral

🟢 Ao reverter, remove `tenants_public/<slug>` somente se o registro pertencer ao tenant. 🟢 Leitura de `tenants_public` é por chave, nunca `orderByChild` (ADR-007).

🟡 Listas de reservados divergem entre `slug.js` (~35) e `worker.js` (5) — GAP-07.
