# Job — Relatório diário, Design Técnico

> 🟢 CONFIRMADO · 🔴 LACUNA. Fontes: `functions/index.js:448-512`, `ADR-009`, `ADR-011`.

## Interface

| Gatilho | Config | Saída |
|---------|--------|-------|
| onSchedule | `21:00 UTC` (18 h America/Sao_Paulo) | mensagem Graph API |

| Símbolo | Assinatura | Observação |
|---------|-----------|------------|
| `dailyReport` | `(req)` | 🟢 job |
| `hasFeature` | `(nome, plano, tenant)` | 🟢 gate |
| `getHojeBR` | `()` | 🟢 data em `America/Sao_Paulo` |

## Fluxo

1. 🟢 Job dispara às 21:00 UTC.
2. 🟢 Para cada tenant, verifica `hasFeature('relatorio.whatsapp.diario')`.
3. 🟢 Calcula `getHojeBR()` e lê dados do dia.
4. 🟢 Monta resumo (obras/presenças/tarefas abertas conforme fluxograma).
5. 🟢 Envia via Graph API para `adminPhone`.

## Fluxos Alternativos

- **Sem feature/tenant bloqueado:** 🟢 sem envio.
- **Sem `adminPhone`:** 🟢 sem envio (configuração ausente).
- **Falha de envio:** 🔴 sem retry/fila/dead-letter (GAP-05).

## Decisões

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Gate por feature do plano | `plan_features.js` | 🟢 |
| Data em fuso brasileiro | `ADR-009` | 🟢 |
| Envio pela mesma Graph API do bot | `index.js:423-446` | 🟢 |

## Estado Interno

🟢 Nenhum estado persistido pelo job. 🟢 Leitura atual de `ponto/<hoje>` diverge da gravação do bot; decisão P3 define `presenca` como canônico (ajuste pendente).

## Observabilidade

🟢 Logs de execução e erro de envio. 🔴 Sem dead-letter.

## Riscos e Lacunas

- 🟢 GAP-03 — decisão P3: `presenca` canônico; job ainda lê `ponto/<hoje>`.
- 🔴 GAP-05 — ausência de retry/fila/dead-letter na Graph API.
- 🟡 GAP-06 — `status` × `billingState` divergentes podem alterar o gate.
