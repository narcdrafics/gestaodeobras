# Job — Relatório diário via WhatsApp (`dailyReport`)

> 🟢 CONFIRMADO · 🔴 LACUNA. Fontes: `functions/index.js:448-512`, `functions/plan_features.js`, `flowcharts/whatsapp-bot.md`, `flowcharts/relatorios-e-dashboard.md`, `spec-impact-matrix.md` §6 GAP-03.

## Visão Geral

🟢 Job agendado que consolida resumo do dia e envia via WhatsApp para o administrador do tenant, condicionado à feature `relatorio.whatsapp.diario`.

## Responsabilidades

- 🟢 Executar em `21:00 UTC` (18 h de Brasília).
- 🟢 Verificar feature `relatorio.whatsapp.diario` antes de montar/enviar.
- 🟢 Ler dados do dia e enviar resumo para `tenants/<tid>/adminPhone`.
- 🟢 Usar Graph API v20.0 para entrega.

## Regras de Negócio

- 🟢 Gate por `hasFeature`: Tenant bloqueado ou sem feature ⇒ não envia.
- 🟢 Fuso `America/Sao_Paulo` para datas de negócio (RN-009/ADR-009).
- 🟢 **GAP-03 resolvido (P3):** `presenca` é a origem canônica. 🟢 Fato confirmado: o job ainda lê `ponto/<hoje>`; ajuste pendente.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Agendar às 21:00 UTC | Must | Config correta |
| RF-02 | 🟢 Checar `hasFeature('relatorio.whatsapp.diario')` | Must | Sem feature ⇒ nenhum envio |
| RF-03 | 🟢 Respeitar `billingState` | Must | Bloqueado/somente_leitura ⇒ sem envio |
| RF-04 | 🟢 Montar resumo com dados do dia | Must | Conteúdo conforme fluxograma de relatórios |
| RF-05 | 🟢 Enviar para `adminPhone` via Graph API | Must | Mensagem entregue ao número configurado |
| RF-06 | 🟢 Ler presenças de `tenants/<tid>/presenca` | Must | Decisão P3; hoje o job lê `ponto/<hoje>` — ajuste pendente |
| RF-07 | 🔴 Definir retry do envio | Should | GAP-05: sem retry/dead-letter hoje |

## Requisitos Não Funcionais

| Tipo | Evidência | Confiança |
|------|-----------|-----------|
| Fuso horário | `ADR-009` | 🟢 |
| Gate de plano | `plan_features.js` | 🟢 |
| Confiabilidade | 🔴 Graph API sem retry (GAP-05) | 🟢 |

## Critérios de Aceitação

```gherkin
Dado um tenant sem a feature relatorio.whatsapp.diario
Quando o job executa
Então nenhuma mensagem é enviada

Dado um tenant com feature ativa e presenças gravadas pelo bot em `presenca`
Quando o job executa
Então o resumo inclui as presenças do dia gravadas em `presenca` (decisão P3)
```

## Rastreabilidade

| Arquivo | Função | Cobertura |
|---------|--------|-----------|
| `functions/index.js:448-512` | `exports.dailyReport` | 🟢 |
| `functions/plan_features.js` | `hasFeature` | 🟢 |
| `flowcharts/whatsapp-bot.md` §7 | — | 🟢 |
| `spec-impact-matrix.md` §6 | GAP-03 (P3), GAP-05 (P5) | 🟢 / 🔴 |
