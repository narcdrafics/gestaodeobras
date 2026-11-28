# Trigger — Aplicar aprovação

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `functions/index.js:892-904`, `functions/aprovacoes.js`, `flowcharts/aprovacoes.md` §3-4, `ADR-005`, `RN-029`–`RN-034`.

## Visão Geral

🟢 Reage à transição para `aprovado` e aplica os 8 efeitos de domínio em uma única escrita multi-path, com reserva própria, revalidação de autoridade e notificações replicadas por destinatário.

## Responsabilidades

- 🟢 Detectar transição `→ aprovado` (ignorar atualizações subsequentes).
- 🟢 Reservar aplicação por transação (`reservadoEm`), evitando dupla execução.
- 🟢 Revalidar decisor/autoridade no momento da aplicação (`podeAplicar`).
- 🟢 Calcular efeitos de forma pura e aplicá-los com `update()` multi-path.
- 🟢 Marcar falha como `status='erro'` e notificar admins.

## Regras de Negócio

- 🟢 RN-029: reserva própria, retomada após 10 min pelo job.
- 🟢 RN-030: `podeAplicar` revalida autoridade na aplicação.
- 🟢 RN-031: falha ⇒ `erro`, `motivo` (≤500), `falhaEm`.
- 🟢 RN-034: `antes`/`depois` limitados a 4000 caracteres; notificação por destinatário.
- 🟢 GAP-04 resolvido (P4): `tarefas_pendentes` removido — sem efeitos nesse nó.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Só aplicar quando status muda para `aprovado` | Must | Reescrita de registro já aprovado não reaplica |
| RF-02 | 🟢 Reserva transacional | Must | Concorrência ⇒ `ja_processada_ou_reservada` |
| RF-03 | 🟢 `podeAplicar` revalida tudo | Must | Decisor sem autoridade ⇒ `erro` + notificação |
| RF-04 | 🟢 8 efeitos puros por tipo | Must | `movimentacao_estoque`, `trabalhador_add/remove`, `financeiro_lancamento/status`, `orcamento_fechamento`, `medicao_fechamento`, `compra_criacao` |
| RF-05 | 🟢 `update()` multi-path atômico | Must | Efeitos + `aplicadoEm` + auditoria + notificações juntos |
| RF-06 | 🟢 Falha ⇒ `erro` e notifica admins | Must | `motivo` ≤500 caracteres |
| RF-07 | 🟢 Retomada de reserva órfã >10 min | Must | Job retoma com `retomar=true` |
| RF-08 | 🟢 Não implementar efeitos para `tarefas_pendentes` | Must | Decisão P4: nó removido |

## Requisitos Não Funcionais

| Tipo | Evidência | Confiança |
|------|-----------|-----------|
| Integridade | `update()` multi-path (`ADR-005`) | 🟢 |
| Idempotência | reserva própria (`RN-029`) | 🟢 |
| Privacidade | `comprasPrivadas` separado (RN-033) | 🟢 |

## Critérios de Aceitação

```gherkin
Dado uma aprovação aprovada cuja reserva está órfã há 12 minutos
Quando o job de prazos roda
Então os efeitos são aplicados uma única vez e `aplicadoEm` é gravado

Dado um decisor cujo papel foi rebaixado após a decisão
Quando o trigger avalia `podeAplicar`
Então a aprovação vira `erro`, a reserva é liberada e admins são notificados
```

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `functions/aprovacoes.js` | `aoEscreverAprovacao`, `aplicarAprovacaoPorId`, `construirEfeitos` | 🟢 |
| `functions/index.js:892` | export do trigger | 🟢 |
| `data-dictionary.md` §21-26, §68, §73 | entidades | 🟢 |
