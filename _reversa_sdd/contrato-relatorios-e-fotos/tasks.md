# Contrato de dados — Relatórios, dashboard e fotos, Tarefas

> 🟢 CONFIRMADO · 🔴 LACUNA. Cada tarefa cita o arquivo legado de origem.

## Pré-requisitos

- [ ] `ADR-008`, `ADR-009`, `ADR-010`, `ADR-012` e `permissions.md` disponíveis.
- [ ] Features `relatorio.marca`, `exportacao` e `relatorio.whatsapp.diario` presentes no catálogo com espelho front (teste de paridade).

## Tarefas

- [ ] T-01, Implementar `calcDashboardResumo` com KPIs, linhas, tarefas e alertas — Origem: `utils.module.js:1074-1111`; Critério: `tests/dashboard.test.js` passa e `pctCusto=null` exibe `—`; 🟢
- [ ] T-02, Implementar `calcAlertas` com slots reservados para TAREFA e limite de 8 — Origem: `utils.module.js:1021-1068`, `app_core.js:143-152`; Critério: domingo não gera SEM PRESENÇA HOJE; 🟢
- [ ] T-03, Implementar `renderDashboard` com `podeModulo` e ações filtradas por papel — Origem: `app_core.js:100-218`; Critério: papéis RH sem módulo não veem ações; 🟢
- [ ] T-04, Implementar `buildObraReport` com categorias, duplicados e `orcamentoParcial` — Origem: `utils.module.js:1126-1327`; Critério: `tests/report.test.js` passa; compras não entram em realizado; 🟢
- [ ] T-05, Implementar `generateAuditReport` com validação de obra/período e gates — Origem: `app_core.js:3316-3809`; Critério: sem `relatorio.marca` aborta com modal de upgrade; 🟢
- [ ] T-06, Aplicar `auditEsc` e `auditSafeImage` em toda saída HTML — Origem: `utils.module.js:1330-1334`, `app_core.js:3377-3380`; Critério: `javascript:` retorna string vazia; 🟢
- [ ] T-07, Implementar `renderFotos` agregando tarefas e medições com filtros — Origem: `app_core.js:4471-4559`; Critério: origens `Tarefa`/`Medição` listadas em ordem desc; 🟢
- [ ] T-08, Implementar upload com `optimizeImageFile` e `uploadEvidenceFile` — Origem: `app_core.js:8054-8094`, `utils.module.js:1341-1406`; Critério: 1280 px/JPEG 75%, limite 6 e fallback dataUrl; 🟢
- [ ] T-09, Separar base64 em `gestaoObraFotos` e restaurar ao carregar tenant — Origem: `data_core.js:458-484,790-850,888-930`; Critério: `gestaoObraDB` sem base64; 🟢
- [ ] T-10, Implementar `exportarImagemDashboard`, `exportarBackup` e `importarBackup` com gate `exportacao` — Origem: `app_core.js:3203-3226,694-735`, `data_core.js:1018-1047`; Critério: `ensureSchema` aplicado no import; 🟢

## Tarefas de Teste

- [ ] TT-01, KPIs e alertas priorizados (tarefa atrasada à frente de custo)
- [ ] TT-02, Relatório com duplicados, orçamento parcial e sem orçamento
- [ ] TT-03, Escape de HTML e bloqueio de esquema de URL inválido
- [ ] TT-04, Galeria com filtro de obra/origem e legenda derivada
- [ ] TT-05, Upload com limite de 6 e fallback local

## Lacunas Pendentes (🔴)

- 🟢 GAP-03 resolvido (P3): ajustar `dailyReport` para ler `presenca` antes de integrar o resumo.
- 🟢 Decisão P14: aplicar filtro de papel em `buildObraReport` (omitir categorias financeiras sem módulo).
- 🟡 Unificar as duas implementações de `auditSafeImage`.
- 🟡 Restaurar base64 de medição no carregamento e validar presença de `tenantId` no upload.
