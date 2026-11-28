# Contrato de dados — Aprovações, Design

> 🟢 CONFIRMADO · 🔴 LACUNA. Fontes: `flowcharts/aprovacoes.md`, `ADR-005`.

## Estrutura de dados

| Nó | Campos | Confiança |
|----|--------|-----------|
| `tenants/<tid>/aprovacoes/<id>` | `tipo`, `payload`, `status`, `solicitadoPor`, `expiraEm`, `alertas`, `aplicadoEm` | 🟢 |
| `tenants/<tid>/aprovacoes/<id>/auditoria` | `antes`, `depois`, `resumo` (≤4000) | 🟢 |
| `notificacoes/<tid>/<uid>` | cópia por destinatário | 🟢 |
| `comprasPrivadas/<tid>/<id>` | dados comerciais | 🟢 |

## Máquina de estados

🟢 `pendente → aprovado | rejeitado | expirado | erro`, com `aplicadoEm` após efeitos. Reserva `reservadoEm` com retomada após 10 min.

## Fluxo

1. 🟢 `save*` chama `desviarParaAprovacao` quando o papel exige.
2. 🟢 Cliente grava nó pendente; rules validam tenant/plano/tipo/expiração.
3. 🟢 API decide com hierarquia efetiva (transação).
4. 🟢 Trigger aplica 8 efeitos em `update()` único.
5. 🟢 Job expira/alerta/retoma.

## Decisões

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Decisão ≠ aplicação | `ADR-005` | 🟢 |
| Cálculo puro dos efeitos | `aprovacoes.js:167-421` | 🟢 |
| Redaction por papel | `flowcharts/aprovacoes.md` §6 | 🟡 |

## Riscos

- 🟢 GAP-04 resolvido (P4): `tarefas_pendentes` fora do escopo por decisão humana.
- 🟡 UI pode exibir botões que as rules negam.
