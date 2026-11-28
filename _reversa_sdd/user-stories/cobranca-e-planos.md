# User Stories — Cobrança, planos e feature gates

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `flowcharts/billing-e-planos.md`, `ADR-003`, `ADR-004`, `state-machines.md` §1-2.

## US-CP-01 — Contratar plano pela Kiwify

**Como** administrador, **quero** ser direcionado ao checkout com meu tenant identificado, **para** que o pagamento seja creditado corretamente.

```gherkin
Dado o `tenantId` do tenant atual
Quando inicio o checkout
Então `external_reference` contém o tenantId
E o webhook identifica o tenant sem busca por e-mail
```

🟢 Unit: `contrato-billing-e-planos/`.

## US-CP-02 — Receber ativação após pagamento

**Como** administrador, **quero** que o plano seja ativado após o pagamento, **para** usar os recursos contratados.

```gherkin
Dado um evento `paid` com assinatura válida
Quando o webhook processa
Então plano, vencimento, limites e `billingState='ativo'` são gravados em escrita atômica
E `carenciaAte`/`motivoBloqueio` são limpos
```

🟢 Units: `webhook-kiwify/`, `contrato-billing-e-planos/`.

## US-CP-03 — Entender o estado da assinatura

**Como** administrador, **quero** ver aviso de carência ou tela de bloqueio, **para** saber quando regularizar o pagamento.

```gherkin
Dado `billingState='carencia'`
Quando entro no sistema
Então vejo banner `Aviso de Cobrança` com botão `Regularizar Pagamento`
Sem perder acesso aos dados
```

🟢 Units: `contrato-billing-e-planos/`, `job-estado-cobranca/`.

## US-CP-04 — Ser bloqueado por inadimplência

**Como** administrador, **quero** que o acesso seja bloqueado após a janela de leitura, **para** respeitar o contrato.

```gherkin
Dado vencimento há mais de 12 dias sem pagamento
Quando o job diário roda
Então `billingState='bloqueado'`
E todas as features são revogadas, mesmo com plano alto
```

🟢 Units: `contrato-billing-e-planos/`, `job-estado-cobranca/`.

## US-CP-05 — Ver recurso bloqueado por plano

**Como** usuário, **quero** entender por que um botão está indisponível, **para** saber qual plano contratar.

```gherkin
Dado um botão com `data-feature="pix.folha"` em plano inferior
Quando clico
Então o clique é interceptado em fase de captura
E o modal de upgrade mostra nome, descrição e plano necessário
```

🟢 Unit: `contrato-billing-e-planos/`. 🟢 Matriz front/back validada por teste de paridade.

## US-CP-06 — Ajustar plano manualmente

**Como** super_admin, **quero** definir plano e limites manualmente, **para** atender ajustes comerciais.

```gherkin
Dado a ação `definir_plano` no painel master
Quando executo com `requestId`
Então vencimento e limites são redefinidos juntos
E resíduos de carência/bloqueio/cancelamento são limpos
```

🟢 Units: `api-admin-conta/`, `contrato-billing-e-planos/`.

## Lacunas

- 🟡 GAP-06: `status` e `billingState` divergentes.
- 🟡 Job diário pode levar até 24 h para reverter `carencia` sem webhook.
