# Contrato de dados — Obras e tarefas, Design

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `flowcharts/obras.md`, `flowcharts/tarefas.md`, `ADR-008`.

## Estrutura de dados

| Nó | Campos | Confiança |
|----|--------|-----------|
| `tenants/<tid>/obras/<id>` | `cod`, `nome`, `status`, endereço, etapas | 🟢 |
| `tenants/<tid>/tarefas/<id>` | `cod`, `desc`, `obra`, `etapa`, `frente`, `prioridade`, `status`, `prazo`, `resp`, `origem` | 🟢 |

## Derivações

| Valor | Regra | Persistido? |
|-------|-------|-------------|
| 🟢 `statusEfetivo` | `prazo < getTodayBR()` ⇒ `Atrasada` | Não (ADR-008) |
| 🟢 `ObraScope` | array vazio ⇒ nenhuma; ausência/não-array ⇒ legado irrestrito; senão interseção | Não |

## Fluxo

1. 🟢 Usuário salva obra/tarefa via `app_core.js`.
2. 🟢 Quando aplicável, `desviarParaAprovacao` cria pendência.
3. 🟢 Leitura aplica derivações e filtros de escopo.
4. 🟢 Bot cria tarefas com `cod=TF###` e `origem='WhatsApp'`.

## Riscos

- 🟢 GAP-02 (decisão P2: ativar parser), GAP-04 (decisão P4: remover `tarefas_pendentes`).
- 🟡 `cod` por `lista.length + 1` pode colidir após exclusões.
