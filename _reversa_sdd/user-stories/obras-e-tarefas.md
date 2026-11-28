# User Stories — Obras e tarefas

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `flowcharts/obras.md`, `flowcharts/tarefas.md`, `domain.md` RN-023–RN-032, `ADR-008`, `ADR-006`.

## US-OT-01 — Cadastrar obra

**Como** administrador, **quero** cadastrar uma obra com código estável, **para** vincular todas as entidades de campo.

```gherkin
Dado uma obra com `cod` definido
Quando salvo
Então o `cod` permanece estável nas atualizações
E todas as entidades filhas passam a referenciá-lo
```

🟢 Unit: `contrato-obras-e-tarefas/`. 🔴 Alterar `Obra.cod` tem severidade alta na matriz de impacto.

## US-OT-02 — Criar e acompanhar tarefa

**Como** encarregado, **quero** criar tarefas com etapa, frente, prioridade e prazo, **para** acompanhar a execução no dashboard.

```gherkin
Dado uma tarefa com prazo anterior a hoje
Quando o dashboard é renderizado
Então ela aparece como `atrasada` em leitura
Sem gravar status de atraso no banco
```

🟢 Units: `contrato-obras-e-tarefas/`, `contrato-relatorios-e-fotos/`.

## US-OT-03 — Concluir tarefa rapidamente pelo dashboard

**Como** encarregado, **quero** concluir tarefas direto no painel, **para** reduzir o esforço de atualização diária.

```gherkin
Dado uma tarefa aberta listada nas primeiras 5 do dashboard
Quando clico em `concluirTarefaRapida`
Então o status muda para `Concluída`
E o painel é recalculado
```

🟢 Unit: `contrato-relatorios-e-fotos/`.

## US-OT-04 — Limitar criação de obras por plano

**Como** administrador, **quero** que o limite de obras do plano seja aplicado mesmo em escrita direta, **para** evitar estouro contratual.

```gherkin
Dado uma escrita em `tenants/tid/obras` que excede `limiteObras`
Quando o trigger `onValueWritten` executa
Então a escrita é revertida ou abortada se não houver estado anterior seguro
```

🟢 Units: `trigger-limite-obras/`, `contrato-billing-e-planos/`.

## US-OT-05 — Trabalhar com RH customizável

**Como** usuário de RH, **quero** ver apenas os módulos e obras permitidos, **para** não acessar informações fora do meu escopo.

```gherkin
Dado um RH com `modulosPermitidos.compras=false`
Quando renderizo o painel
Então ações de compra ficam ocultas
```

🟢 Units: `contrato-admin-e-usuarios/`, `contrato-obras-e-tarefas/`.

## Lacunas

- 🟢 GAP-02 resolvido (P2): fluxo de prévia/confirmação será ativado; hoje `parser-tarefas.js` não é importado.
- 🟡 `cod` sequencial do bot (`TF###`) pode colidir após exclusões.
