# User Stories — Aprovações

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `flowcharts/aprovacoes.md`, `domain.md` RN-013–RN-022, `ADR-005`, `state-machines.md` §4.

## US-AP-01 — Solicitar aprovação para efeito sensível

**Como** encarregado, **quero** solicitar aprovação ao criar compra, movimentar estoque ou mediar serviço, **para** que a ação só tenha efeito após decisão autorizada.

```gherkin
Dado um tipo de aprovação habilitado no tenant
Quando salvo uma entidade que exige aprovação
Então um registro `pendente` é criado com `expiraEm = solicitadoEm + 15 dias`
E os efeitos na entidade de origem ficam retidos
```

🟢 Units: `contrato-aprovacoes/`, `contrato-suprimentos-e-custos/`.

## US-AP-02 — Decidir uma aprovação

**Como** administrador, **quero** aprovar ou rejeitar com motivo, **para** liberar ou bloquear o efeito correspondente.

```gherkin
Dado uma aprovação `pendente`
Quando envio POST `/api/admin/aprovacao` com `decisao='rejeitado'`
Então exijo `motivo` não vazio
E o estado passa a `rejeitado`
```

🟢 Unit: `api-admin-aprovacao/`. 🟢 Rejeição sem motivo ⇒ 400.

## US-AP-03 — Aplicar efeitos automaticamente após aprovação

**Como** solicitante, **quero** que os efeitos sejam aplicados pelo trigger após a decisão, **para** não precisar repetir a operação.

```gherkin
Dado uma aprovação `aprovado`
Quando o trigger processa a reserva
Então a entidade de destino é escrita e `aplicadoEm` é gravado
E uma falha permite retomada após 10 min
```

🟢 Units: `trigger-aplicar-aprovacao/`, `contrato-aprovacoes/`.

## US-AP-04 — Receber lembretes antes do vencimento

**Como** aprovador, **quero** receber alertas em 7, 12 e 15 dias, **para** não deixar a solicitação expirar sem decisão.

```gherkin
Dado uma aprovação pendente próxima do `expiraEm`
Quando o job das 06:00 executa
Então notificações são enviadas com dedupe por idade
```

🟢 Unit: `job-prazos-aprovacao/`.

## US-AP-05 — Delegar decisão com escopo restrito

**Como** administrador, **quero** permitir que RH decida apenas módulos habilitados e que engenheiro decida só movimentação de estoque, **para** manter segregação de funções.

```gherkin
Dado um aprovador com role `engenheiro`
Quando tenta decidir uma aprovação de compra
Então recebe 403
```

🟢 Unit: `api-admin-aprovacao/`. 🟡 `encarregado` solicita; decisão depende do papel efetivo.

## Lacunas

- 🟢 GAP-04 resolvido (P4): `tarefas_pendentes` removido — gravação direta em `tarefas`; não especificar comportamento novo.
- 🟡 `aprovacao` expira em 15 dias; estados `erro`/`expirado` precisam de reconciliação com o trigger.
