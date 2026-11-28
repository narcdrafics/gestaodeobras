# API Admin — Decisão de aprovação, Design Técnico

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `functions/aprovacoes-api.js`, `functions/aprovacoes.js`, `flowcharts/aprovacoes.md`, `ADR-005`.

## Interface

| Método | Caminho | Entrada | Saída | Status codes |
|--------|---------|---------|-------|--------------|
| POST | `/api/admin/aprovacao` | `{id, decisao, motivo?, notificarAdmin?}` + Bearer | `{ok, status}` | 200, 400, 401, 403, 404, 405, 409, 413, 429 |

| Símbolo | Assinatura | Retorno | Observação |
|---------|-----------|---------|------------|
| `verificarChamador` | `(req, db)` | `{uid, role, tenantId, modulos}` | 🟢 Auth + perfis + allowlist + passaporte |
| `papelEfetivo` | `(claim, perfil)` | `role` | 🟢 maior na hierarquia (RN-009) |
| `papelPodeDecidir` | `(ctx, aprovacao)` | `boolean` | 🟢 admin/master, RH por módulo, engenheiro em estoque |
| `aplicarAprovacaoPorId` | `(tid, id, db)` | `Promise<boolean>` | 🟢 trigger, com reserva |

## Fluxo Principal

1. 🟢 POST + Bearer com `checkRevoked`; `verificarChamador` e conta ativa.
2. 🟢 Calcula papel efetivo e aplica cotas.
3. 🟢 Valida corpo e lê aprovação; checa pendente/expiração/`billingState`/tenant.
4. 🟢 `papelPodeDecidir` — admin/super_admin/emailAdmin; RH com `aprovacoes` + módulo do tipo; engenheiro em `movimentacao_estoque` com `notificarAdmin`.
5. 🟢 Transação no nó: somente o primeiro decide `pendente`.
6. 🟢 Grava `status`, `decididoPor`, `decididoEm`, `decididoPorPapel`, `motivo`, `decididoPorModulos`.
7. 🟢 Auditoria `decidir_aprovacao` + 200.
8. 🟢 Trigger aplica efeitos em transação separada (`construirEfeitos` puro + `update()` multi-path).

## Fluxos Alternativos

- **Concorrência:** 🟢 409 `ja_decidida`.
- **Rejeição sem motivo:** 🟢 400.
- **Plano bloqueado:** 🟢 403 `plano_bloqueado`.
- **Falha na aplicação:** 🟢 `status='erro'`, `motivo`, `falhaEm`, notifica admins; reserva retomada após 10 min pelo job.
- **Redaction:** 🟡 papéis restritos recebem payload sem campos comerciais.
- **🟢 `tarefas_pendentes`:** decisão P4 — nó removido; gravação direta em `tarefas`.

## Dependências

- 🟢 `claims.js`, `abuso.js`, `auditoria.js`, `aprovacoes.js`, `plan_features.js`, RTDB (`aprovacoes`, `auditoria`, `notificacoes`, `tenants`), `aprovacoes_ui.js`.

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Decisão e aplicação são transações separadas | `ADR-005`; `flowcharts/aprovacoes.md` §3 | 🟢 |
| `podeAplicar` revalida autoridade na aplicação | `RN-030` | 🟢 |
| 8 efeitos puros, sem I/O em `construirEfeitos` | `functions/aprovacoes.js:167-421` | 🟢 |
| Notificações replicadas por destinatário | `RN-034` | 🟢 |

## Estado Interno

🟢 `tenants/<tid>/aprovacoes/<id>` com `status ∈ {pendente, aprovado, rejeitado, expirado, erro}`, `expiraEm` (15 dias), `alertas`, `reservadoEm`, `aplicadoEm`. 🟡 `conclusao` é gravada pelo trigger (RN-034).

## Observabilidade

🟢 Auditoria `decidir_aprovacao` e `aplicar_aprovacao`; falha gera notificação para admins. 🟡 Sem métrica de SLA de aplicação além dos alertas de 7/12/15 dias.

## Riscos e Lacunas

- 🟢 GAP-04 resolvido (P4): `tarefas_pendentes` removido; sem contrato de rules necessário.
- 🟡 GAP-06: `status` × `billingState` precisam de reconciliação explícita.
- 🟡 UI pode mostrar botões que as rules negam (desvio de escrita vs. autorização efetiva).
