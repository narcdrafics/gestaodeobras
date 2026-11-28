# Contrato de evento — aprovação → efeitos

> 🟢 CONFIRMADO em `functions/aprovacoes.js`, `index.js:892`, `ADR-005`.

## Gatilho

```js
onValueWritten("tenants/{tenantId}/aprovacoes/{aprovacaoId}", handler)
```

## Evento consumido

| Campo | Tipo | Regra |
|-------|------|-------|
| `status` | enum | 🟢 somente transição para `aprovado` |
| `tipo` | string | 🟢 um dos 8 tipos |
| `payload` | object | 🟢 validado antes de aplicar |
| `decididoPor` / `decididoPorPapel` | string | 🟢 revalidado por `podeAplicar` |
| `reservadoEm` / `aplicadoEm` | timestamp | 🟢 controle de idempotência |

## Efeitos (8 tipos)

| Tipo | Efeito |
|------|--------|
| 🟢 `movimentacao_estoque` | entrada/saída/retorno/transferência ⇒ `estoque` + `movEstoque` |
| 🟢 `trabalhador_add` / `trabalhador_remove` | insere/remove da lista |
| 🟢 `financeiro_lancamento` | novo lançamento `Pendente`, `valpago=0` |
| 🟢 `financeiro_status` | `Pago=total`, `Pendente/Atrasado=0`, `Parcial=valor` |
| 🟢 `orcamento_fechamento` / `medicao_fechamento` | recalcula `vtotal`, marca `aprovadoPor/Em` |
| 🟢 `compra_criacao` | registro público + `comprasPrivadas/<tenant>/<id>` |

## Erros

🟢 `status='erro'`, `motivo` ≤500, `falhaEm`, reserva liberada, notificação aos admins. 🟡 Auditoria `antes/depois` limitada a 4000 caracteres.

🟢 `tarefas_pendentes` fora do contrato por decisão P4 (nó removido).
