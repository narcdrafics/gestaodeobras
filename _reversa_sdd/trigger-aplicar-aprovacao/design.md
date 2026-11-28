# Trigger — Aplicar aprovação, Design Técnico

> 🟢 CONFIRMADO · 🔴 LACUNA. Fonte: `functions/aprovacoes.js`, `functions/index.js:892`, `ADR-005`.

## Interface

| Gatilho | Origem | Entrada | Saída |
|---------|--------|---------|-------|
| onValueWritten | `tenants/{tid}/aprovacoes/{id}` | antes/depois | `update()` multi-path |

| Símbolo | Assinatura | Observação |
|---------|-----------|------------|
| `aoEscreverAprovacao` | `(event)` | 🟢 filtra transição para `aprovado` |
| `aplicarAprovacaoPorId` | `(tid, id, db, retomar?)` | 🟢 reserva + aplicação |
| `podeAplicar` | `(aprovacao, decisor, db)` | 🟢 revalida autoridade |
| `construirEfeitos` | `(tipo, payload, estado)` | 🟢 puro, sem I/O |

## Fluxo Principal

1. 🟢 Detecta `status === 'aprovado'` e `antes !== 'aprovado'`.
2. 🟢 Transação reserva `reservadoEm` se não houver `aplicadoEm`/`expirado`/`erro`.
3. 🟢 `podeAplicar` valida status, expiração, tipo, payload e autoridade do decisor.
4. 🟢 Lê estado do tenant e admins; `construirEfeitos` retorna `{updates, antes, depois, resumo}`.
5. 🟢 `update()` aplica efeitos, `aplicadoEm`, auditoria e notificações.

## Fluxos Alternativos

- **Já processada/reservada:** 🟢 ignorado.
- **Falha em `podeAplicar` ou `update`:** 🟢 `erro` + `motivo` + notificação.
- **Reserva órfã:** 🟢 retomada pelo job diário após 10 min.
- **🟢 `tarefas_pendentes`:** fora do contrato por decisão P4 (removido).

## Dependências

- 🟢 RTDB (`aprovacoes`, `notificacoes`, `auditoria`, entidades de destino), `claims.js`, `aprovacoes.js`.

## Decisões de Design

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Cálculo puro separado da escrita | `aprovacoes.js:167-421` | 🟢 |
| Revalidação na aplicação | `RN-030` | 🟢 |
| Notificações por destinatário | `RN-034` | 🟢 |

## Estado Interno

🟢 `aprovacoes/<id>.status`, `reservadoEm`, `aplicadoEm`, `erro`. 🟡 Auditoria serializada com limite de 4000 caracteres.

## Observabilidade

🟢 `admin_audit` + notificações. 🟡 Sem métrica de tempo até aplicação.

## Riscos e Lacunas

- 🟢 GAP-04 resolvido (P4): `tarefas_pendentes` removido.
- 🟡 Notificações duplicadas se a reserva for retomada após falha parcial (avaliar na revisão).
