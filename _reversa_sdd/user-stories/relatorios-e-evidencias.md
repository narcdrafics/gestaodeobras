# User Stories — Relatórios, dashboard e evidências

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `flowcharts/relatorios-e-dashboard.md`, `flowcharts/fotos.md`, `ADR-008`, `ADR-010`, `ADR-012`.

## US-RE-01 — Ver panorama da obra no dashboard

**Como** gestor, **quero** ver KPIs, alertas e resumo por obra, **para** priorizar ações do dia.

```gherkin
Dado uma tarefa atrasada e uma obra com `pctCusto=120`
Quando o dashboard é renderizado
Então a tarefa aparece antes do alerta de custo
E a obra aparece em vermelho
```

🟢 Unit: `contrato-relatorios-e-fotos/`. 🟢 `pctCusto=null` exibe `—`, não `0%`.

## US-RE-02 — Gerar relatório de vistoria auditável

**Como** gestor, **quero** gerar um relatório HTML imprimível da obra, **para** apresentar a cliente e auditores.

```gherkin
Dado feature `relatorio.marca` habilitada e obra selecionada
Quando gero o relatório
Então categorias, medições, equipe, pendências e duplicados são exibidos
E todo texto passa por `auditEsc`
```

🟢 Unit: `contrato-relatorios-e-fotos/`. 🟡 `buildObraReport` não filtra por papel.

## US-RE-03 — Detectar orçamento incompleto

**Como** gestor, **quero** ser avisado quando há gasto sem previsão e cobertura baixa, **para** corrigir o planejamento.

```gherkin
Dado gasto sem previsão e cobertura menor que 50%
Quando o relatório é montado
Então `orcamentoParcial=true` com status `Orçamento incompleto`
```

🟢 Unit: `contrato-relatorios-e-fotos/`.

## US-RE-04 — Ver fotos de tarefas e medições

**Como** encarregado, **quero** ver todas as evidências em uma galeria, **para** conferir o que foi executado.

```gherkin
Dado fotos em tarefas e medições de uma obra
Quando abro a página de fotos
Então são listadas por origem e obra, ordenadas por data desc
E o lightbox amplia a imagem
```

🟢 Unit: `contrato-relatorios-e-fotos/`. 🟡 URL do lightbox não é sanitizada na origem direta.

## US-RE-05 — Enviar evidências pelo celular

**Como** encarregado, **quero** anexar até 6 fotos por tarefa ou medição, **para** documentar a execução.

```gherkin
Dado a seleção de 8 arquivos
Quando processo o upload
Então apenas 6 são aceitos e um toast de limite é exibido
E cada imagem é otimizada para 1280 px / JPEG 75%
```

🟢 Unit: `contrato-relatorios-e-fotos/`. 🟡 Caminho `tenants/global/evidencias` falha nas Storage Rules.

## US-RE-06 — Exportar imagem e backup

**Como** gestor, **quero** exportar imagem do dashboard e backup do banco, **para** compartilhar e preservar os dados.

```gherkin
Dado feature `exportacao` habilitada
Quando clico em `Exportar Banco`
Então um JSON com `gestao_obra_backup_YYYY-MM-DD.json` é baixado
```

🟢 Units: `contrato-relatorios-e-fotos/`, `contrato-infra-e-deploy/`. 🟡 `importarBackup` não checa feature gate.

## Lacunas

- 🟢 GAP-03 resolvido (P3): `dailyReport` deve ler `presenca`; hoje lê nó divergente.
- 🔴 Relatório sem filtro de papel pode expor dados financeiros.
- 🟡 Duas implementações de `auditSafeImage` podem divergir.
