# Contrato externo — Decisão de aprovação

> 🟢 CONFIRMADO em `functions/aprovacoes-api.js`, `firebase.json`, `flowcharts/aprovacoes.md`.

## POST `/api/admin/aprovacao`

```http
Authorization: Bearer <idToken>
{ "id": "<aprovacaoId>", "decisao": "aprovado", "motivo": "opcional", "notificarAdmin": true }
```

| Status | Significado |
|--------|-------------|
| 200 | `{ok:true, status:'aprovado'\|'rejeitado'}` |
| 400 | corpo inválido / rejeição sem motivo |
| 401/403 | token inválido, conta bloqueada, `plano_bloqueado`, `tenant_invalido`, `sem_permissao` |
| 404 | aprovação inexistente |
| 409 | `ja_decidida` |
| 405 | método inválido |
| 413/429 | corpo grande / cota |

## Autoridade

| Papel | Regra |
|-------|-------|
| 🟢 `admin` / `super_admin` / e-mail do admin | decide qualquer tipo do tenant (master pode operar outro tenant) |
| 🟢 `rh` | exige `modulosPermitidos.aprovacoes === true` **e** módulo do tipo habilitado |
| 🟢 `engenheiro` | somente `movimentacao_estoque`, com `notificarAdmin=true` |
| 🟡 `encarregado` | solicita; decisão conforme papel efetivo |

## Estado da aprovação

| Campo | Valor |
|-------|-------|
| `status` | 🟢 `pendente` → `aprovado`/`rejeitado`/`expirado`/`erro` |
| `expiraEm` | 🟢 `solicitadoEm + 15 dias` |
| `alertas` | 🟢 dedupe em 7, 12 e 15 dias |
| `aplicadoEm` | 🟢 gravado pelo trigger após efeitos |
| `reservadoEm` | 🟢 reserva de aplicação, retomada após 10 min |

🟢 GAP-04 resolvido (P4): `tarefas_pendentes` removido — fora do contrato por decisão humana.
