# Contrato de dados — Relatórios, dashboard e fotos, Design

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `flowcharts/relatorios-e-dashboard.md`, `flowcharts/fotos.md`, `ADR-008`, `ADR-009`, `ADR-010`, `ADR-012`.

## Estrutura de dados

| Estrutura | Campos / origem | Persistida? | Confiança |
|-----------|-----------------|-------------|-----------|
| `DashboardResumo` | `{kpis, linhas, tarefas, alertas, hoje}` de `calcDashboardResumo` | 🟢 Não (derivada em leitura) | 🟢 |
| `LinhaObra` | `pctCusto` (`null` sem orçamento), `tarefasFeitas`, `tarefasTotal`, `custo`, `diarias` | 🟢 Não | 🟢 |
| `Alerta` | `{tipo, prioridade alto>medio>baixo, mensagem}` | 🟢 Não | 🟢 |
| `RelatorioObra` | `resumo`, `categorias`, `medicoes`, `equipe`, `pendencias`, `tarefas`, `entradas`, `duplicados` | 🟢 Não | 🟢 |
| `Foto` | `url`, `legenda` (derivada), `obra`, `origem ∈ {Tarefa, Medição}`, `cod`, `desc`, `etapa`, `frente`, `status`, `data` | 🟢 URL em `tarefas.photos`/`medicao.photos` | 🟢 |
| `gestaoObraFotos` | mapa `fotosMap[cod]` com base64 separado de `gestaoObraDB` | 🟢 `localStorage` | 🟢 |

## Derivações (ADR-008 — nunca persistidas)

| Valor | Regra | Confiança |
|-------|-------|-----------|
| `atrasada` | `prazo < hojeLocal()` | 🟢 |
| `venceHoje` | `prazo === hojeLocal()` | 🟢 |
| `pctCusto` | `total / orcamento * 100`; `null` quando `orcamento <= 0` | 🟢 |
| `alertas` | TAREFA ATRASADA agrupada (alto) → TAREFA HOJE (médio) → custo → compras → SEM PRESENÇA → OBRA SEM MESTRE (baixo) | 🟢 |
| `orcamentoParcial` | `realizadoSemPrevisto > 0 && previsto/realizado < 0,5` | 🟢 |
| `duplicados` | lançamento manual `Empreiteiro` em etapa já medida | 🟢 |
| `isExecutada` | `status === 'Concluída' || perc >= 100` | 🟢 |
| `legenda` | `desc + ' · Foto i+1/total'` quando `total > 1` | 🟢 |

## Fluxos principais

1. 🟢 **Dashboard:** `renderDashboard` lê papel/`modulosPermitidos`, chama `calcDashboardResumo`, aplica `podeModulo` nas ações e limita alertas a 8 (`+ N alertas`).
2. 🟢 **Relatório:** `generateAuditReport` valida feature `relatorio.marca`, obra, ordem das datas e monta HTML com `auditEsc`/`auditSafeImage`; impressão usa `body.audit-print` com cleanup.
3. 🟢 **Fotos:** `renderFotos` agrega `taskPhotoList` + `medicaoPhotoList`, filtra por obra/origem, ordena por data desc e abre `openLightbox`.
4. 🟢 **Upload:** `handleTarefaPhotos`/`handleMedicaoPhotos` limitam a 6 arquivos, otimizam a 1280 px/JPEG 75% e enviam para `tenants/<tid>/evidencias`, com fallback `dataUrl`.

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Cálculos derivados no cliente, sem gravação | `ADR-008`, `utils.module.js:954-1327` | 🟢 |
| Dashboard e relatório compartilham `buildFinanceEntries` | `relatorios-e-dashboard.md` §1/§6 | 🟢 |
| Base64 separado do DB principal | `data_core.js:790-850,888-930`, `ADR-012` | 🟢 |
| Sanitização de HTML e URL antes de `innerHTML` | `utils.module.js:1330-1334`, `ADR-010` | 🟢 |
| Legenda derivada da descrição da entidade de origem | `fotos.md` §4 | 🟢 |

## Estado Interno

🟢 `IS_READONLY_MODE` e `__lastBillingData` são controlados por `contrato-billing-e-planos`; o módulo só reage. 🟢 `mestre` é normalizado para `encarregado` na leitura de papel. 🟡 `window.renderDashboard` permite override em testes, tornando a função real dependente de ordem de carregamento.

## Observabilidade

🟢 Testes: `dashboard.test.js`, `report.test.js`, `tarefas-dashboard.test.js`, `tarefas-fotos.test.js`. 🟡 Progresso de upload e erros da Graph API/Storage são apenas `console.log`/`console.error`.

## Riscos e Lacunas

- 🟢 GAP-03 resolvido (P3): `dailyReport` deve ler `presenca`; hoje lê `ponto/<hoje>`.
- 🟢 Decisão P14: omitir categorias financeiras para papéis sem módulo no `buildObraReport`.
- 🟡 Duas implementações de `auditSafeImage` (`app_core.js` e `utils.module.js`) podem divergir.
- 🟡 `printAuditReport` usa `setTimeout(1500)` para limpar classe de impressão.
- 🟡 `closeLightbox` e `openLightbox` não sanitizam a URL recebida diretamente.
- 🟡 Base64 de medição com fallback local não é restaurado após recarregar.
- 🟡 Caminho `tenants/global/evidencias` falha nas Storage Rules.
