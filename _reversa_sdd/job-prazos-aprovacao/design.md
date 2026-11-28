# Job — Prazos de aprovação, Design Técnico

> 🟢 CONFIRMADO. Fonte: `functions/aprovacoes.js`, `functions/index.js:905`.

## Interface

| Gatilho | Config | Saída |
|---------|--------|-------|
| onSchedule | `every day 06:00`, `America/Sao_Paulo` | escritas em `aprovacoes`/`notificacoes` |

| Símbolo | Assinatura | Observação |
|---------|-----------|------------|
| `processarAprovacoesJob` | `(db)` | 🟢 varredura de tenants |
| `retomarAplicacao` | `(tid, id, db)` | 🟢 com `retomar=true` |
| `alertasDevidos` | `(aprovacao, agora)` | 🟢 7/12/15 dias |

## Fluxo

1. 🟢 Varre todos os tenants.
2. 🟢 `aprovado` com `reservadoEm` e sem `aplicadoEm` ⇒ retomar se >10 min.
3. 🟢 `pendente` com `expiraEm <= agora` ⇒ `expirado`.
4. 🟢 Calcula alertas devidos; transação grava `alertas[dia]` e notifica uma vez.
5. 🟢 Retorna contadores agregados.

## Decisões

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Dedupe de alertas por chave de dia | `RN-028` | 🟢 |
| Retomada explícita (não automática no trigger) | `RN-029` | 🟢 |

## Riscos

- 🟢 GAP-04 resolvido (P4): `tarefas_pendentes` removido.
- 🟡 Notificações podem duplicar se transação de alertas e gravação de notificação não forem atômicas.
