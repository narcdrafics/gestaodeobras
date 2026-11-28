# Contrato de dados — Relatórios, dashboard e fotos

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Cobre `relatorios-e-dashboard` e `fotos` (matriz de impacto §4). Fontes: `flowcharts/relatorios-e-dashboard.md`, `flowcharts/fotos.md`, `data-dictionary.md` §33/§75-85, `domain.md` RN-049/RN-056–RN-057, `ADR-008`, `ADR-009`, `ADR-010`, `ADR-012`.

## Visão Geral

🟢 Dois módulos somente leitura sobre a mesma fonte de custo: dashboard (KPIs e alertas em tempo real) e relatório de vistoria (HTML auditável imprimível). A página de fotos é agregadora: reúne evidências já gravadas em tarefas e medições, sem anexar novas.

## Responsabilidades

- 🟢 Calcular `calcDashboardResumo` com presenças, obras ativas, custos e tarefas.
- 🟢 Emitir alertas priorizados com slots reservados para tarefas (não empurradas por custos).
- 🟢 Gerar `buildObraReport` com categorias, medições, equipe, pendências e duplicados.
- 🟢 Sanitizar saída HTML (`auditEsc`/`escHtml`) e URLs de imagem (`auditSafeImage`).
- 🟢 Agregar fotos de tarefas e medições com filtro por obra/origem e lightbox.
- 🟢 Otimizar imagens (1280 px, JPEG 75%) e fazer upload para `tenants/<tid>/evidencias` com fallback `dataUrl`.

## Regras de Negócio

- 🟢 RN-049: atraso é derivado em leitura (`prazo < hojeLocal()`), nunca persistido (`ADR-008`).
- 🟢 Domingo não gera alerta `SEM PRESENÇA HOJE` (`utils.module.js:1057-1063`).
- 🟢 `pctCusto === null` (sem orçamento) exibe `—`, não `0%`.
- 🟢 Compras não entram no custo realizado — aparecem só em pendências (evita duplicar com Material).
- 🟢 Lançamento manual `Empreiteiro` para etapa já medida é listado em `duplicados` e excluído do total.
- 🟢 `orcamentoParcial` exige gasto sem previsão **e** cobertura < 50%.
- 🟢 Base64 nunca vai ao RTDB (limite 10 MB por escrita); fotos locais ficam em `gestaoObraFotos`.
- 🟢 Legenda de foto é derivada da descrição da tarefa/serviço, não campo gravado.
- 🟢 GAP-03 resolvido (P3): `dailyReport` deve ler `presenca`; hoje lê `ponto/<hoje>`.
- 🟢 Decisão P14: `buildObraReport` omite categorias financeiras para papéis sem módulo.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 `calcDashboardResumo` com KPIs e resumo por obra | Must | Presentes, faltas, diárias, tarefas abertas/atrasadas e pct por obra corretos |
| RF-02 | 🟢 Alertas com prioridade e slots de tarefa | Must | TAREFA* aparece no topo mesmo com custo alto; máx. 8 + "+ N" |
| RF-03 | 🟢 Filtro de papéis e módulos RH | Must | `podeModulo` oculta ações e alertas conforme `modulosPermitidos` |
| RF-04 | 🟢 `buildObraReport` auditável | Must | Categorias, medido, pago, equipe, pendências e duplicados presentes |
| RF-05 | 🟢 Gate `relatorio.marca` e `exportacao` | Must | Sem feature, ação aborta com `showUpgradeModal` |
| RF-06 | 🟢 Escape de HTML e validação de URL de imagem | Must | `javascript:`/esquema inválido ⇒ string vazia; `<`/`&` escapados |
| RF-07 | 🟢 Agregação de fotos por obra/origem | Must | `Tarefa` e `Medição` listadas, ordenadas por data desc |
| RF-08 | 🟢 Upload com otimização e fallback | Must | 1280 px/JPEG 75%; falha de Storage usa `dataUrl` |
| RF-09 | 🟢 Persistência sem base64 no RTDB | Must | `gestaoObraDB` sem base64; `gestaoObraFotos` separado |
| RF-10 | 🟡 Preservar legenda e URL legada | Should | `photos`, `photoUrl` e `foto` normalizados sem duplicata |
| RF-11 | 🟢 Gerar resumo de presença a partir de `presenca` | Must | Decisão P3; hoje o job lê `ponto/<hoje>` |
| RF-12 | 🟢 Omitir categorias financeiras por papel | Must | Decisão P14: `podeModulo`/`acessoObras` aplicados ao relatório |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | `auditSafeImage` com regex `/^(https?:\/\/|data:image\/)/i` | `utils.module.js:1330-1334` | 🟢 |
| Segurança | CSP com `object-src 'none'`, `frame-ancestors 'none'` | `firebase.json:46-47`, `ADR-010` | 🟢 |
| Performance | `html2canvas` scale 2 com `useCORS` | `app_core.js:3203-3226` | 🟢 |
| Fuso | `hojeLocal()`/`getTodayBR()` para datas de negócio | `ADR-009` | 🟢 |

## Critérios de Aceitação

```gherkin
Dado uma tarefa com prazo anterior a hoje e uma obra com pctCusto 120
Quando o dashboard é renderizado
Então a tarefa atrasada aparece antes do alerta de custo e o pct da obra é vermelho

Dado um orçamento de 1000 e gasto realizado de 1200 sem previsão em 40% do valor
Quando o relatório é gerado
Então `orcamentoParcial=true` e o status é "Orçamento incompleto"

Dado uma tarefa com 6 fotos e uma nova seleção de 2 arquivos
Quando `handleTarefaPhotos` processa
Então apenas 0 novas fotos são aceitas e um toast de limite é exibido
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-09, RF-11, RF-12 | Must | Contrato de leitura auditável e evidências |
| RF-10 | Should | Compatibilidade legada |
| Exportação de imagem/backup | Should | Já coberta por `contrato-infra-e-deploy` (gate) |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `public/js/utils.module.js` | `calcDashboardResumo`, `calcAlertas`, `buildObraReport`, `auditSafeImage`, `optimizeImageFile` | 🟢 |
| `public/js/app_core.js` | `renderDashboard`, `generateAuditReport`, `renderFotos`, `uploadEvidenceFile`, `openLightbox` | 🟢 |
| `public/js/data_core.js` | persistência `gestaoObraDB`/`gestaoObraFotos` | 🟢 |
| `storage.rules:1-47` | autorização de evidências | 🟢 |
| `tests/dashboard.test.js`, `tests/report.test.js`, `tests/tarefas-fotos.test.js` | — | 🟢 |
