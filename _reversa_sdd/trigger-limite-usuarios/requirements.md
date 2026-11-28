# Trigger — Limite de usuários

> 🟢 CONFIRMADO · 🟡 INFERIDO. Fontes: `functions/index.js:648-651,603-640`, `flowcharts/billing-e-planos.md` §6, `domain.md` RN-003.

## Visão Geral

🟢 Aplica o limite de assentos do plano em duas frentes: reverte crescimento de `tenants/{tid}/usuarios` acima do limite e transforma perfis excedentes em `pendente`, sem claims de tenant.

## Responsabilidades

- 🟢 Observar `tenants/{tid}/usuarios` e `profiles/{uid}`.
- 🟢 Contar assentos ativos (exclui pendentes e o próprio uid).
- 🟢 Marcar perfil excedente como `pendente` com `{role:'pendente', tenantId:null}`.
- 🟢 Não punir usuários legados já presentes.

## Regras de Negócio

- 🟢 RN-003: perfil acima do limite vira `pendente`; legados não são punidos.
- 🟢 Assentos contam o dono separadamente (`limiteUsuarios + 1`).
- 🟢 Fallback `LIMITE_FALLBACK=1` quando sem metadado.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Observar `tenants/{tid}/usuarios` | Must | Crescimento acima do limite é revertido |
| RF-02 | 🟢 Observar `profiles/{uid}` para assentos | Must | Perfil excedente vira `pendente` |
| RF-03 | 🟢 Excluir pendentes e o próprio uid da contagem | Must | Contagem correta |
| RF-04 | 🟢 Claims sem `tenantId` para pendente | Must | Publicadas por `syncCustomClaims` |
| RF-05 | 🟢 Preservar legado | Must | Usuários anteriores ao limite não são rebaixados |

## Critérios de Aceitação

```gherkin
Dado um tenant com limiteUsuarios=1 e um dono ativo
Quando um segundo perfil é criado
Então ele fica status='pendente' e suas claims não contêm tenantId

Dado uma lista de usuários com 3 entradas e limite 2
Quando uma quarta é adicionada via Admin SDK
Então a transação restaura a lista anterior
```

## Rastreabilidade

| Arquivo | Função | Cobertura |
|---------|--------|-----------|
| `functions/index.js:648-651` | `enforceUsuariosLimit` | 🟢 |
| `functions/index.js:603-640` | `aplicarLimiteDeAssentos` | 🟢 |
| `domain.md` | RN-003 | 🟢 |
