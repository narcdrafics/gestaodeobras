# Procedures e funções — obra-real

> 🟡 **INFERIDO**. O banco é Firebase Realtime Database: **não há stored procedures, funções SQL, triggers de banco, views nem check constraints SQL**. Toda lógica equivalente vive em Cloud Functions e no cliente.
> 🔴 Nenhuma conexão direta ao banco foi feita para confirmar a ausência de extensões.

## Equivalentes em Cloud Functions 🟡

| "Procedure" | Tipo | Gatilho | Efeito no banco | Confiança |
|---|---|---|---|---|
| `syncCustomClaims` | Auth trigger | criação/edição de `profiles/<uid>` | substitui custom claims; normaliza `mestre` → `encarregado` | 🟢 |
| `enforceObrasLimit` | Auth/DB trigger | criação de obra | valida `config.limiteObras` | 🟢 |
| `enforceUsuariosLimit` | Auth trigger | convite/criação de usuário | valida `config.limiteUsuarios` | 🟢 |
| `aplicarAprovacao` | DB trigger | `tenants/<tid>/aprovacoes/<id>.status` | aplica efeitos, grava `auditoria/` e `notificacoes/` | 🟢 |
| `prazosAprovacao` | scheduled job | diário | expira aprovações | 🟢 |
| `estadoCobranca` | scheduled job | diário | transições `billingState` | 🟢 |
| `retencaoSeguranca` | scheduled job | diário | remove `admin_audit`, `admin_ops`, `rate_limits`, `whatsapp_messages` expirados | 🟢 |
| `dailyReport` | scheduled job | 21:00 UTC | lê `ponto/<hoje>` e envia resumo via Graph API | 🟢 (🔴 GAP-03) |
| `whatsappWebhook` | HTTP | `POST /api/whatsapp` | reserva `whatsapp_messages/<chaveDedup>`, grava `tarefas`/`presenca` | 🟢 |
| `kiwifyWebhook` | HTTP | `POST /api/billing/webhook` | dedup + lease em `billing_events/<orderId>/<eventType>` | 🟢 |
| APIs admin (`criarUsuarioTenant`, `decisaoAprovacao`, `adminOps`) | HTTP | `/api/admin/*` | mutações com Admin SDK e auditoria | 🟢 |

## Regras de negócio "no banco" 🟢

As `.validate` de `database.rules.json` são o único mecanismo declarativo equivalente a check constraints. Catálogo completo em [`business-rules.md`](business-rules.md) §2.

## Lacunas 🔴

- 🔴 `syncCustomClaims` sem retry/dead-letter (GAP-10).
- 🔴 `dailyReport` lê nó divergente do bot (GAP-03).
- 🔴 Graph API sem retry/fila/dead-letter (GAP-05).
- 🔴 Eventos Kiwify desconhecidos marcados `success` sem fila (L-13).
- 🟡 `parser-tarefas.js` implementa prévia/confirmação mas não é importado — "procedure" planejado, não ativo (GAP-02).
