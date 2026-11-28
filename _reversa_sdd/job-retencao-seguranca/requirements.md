# Job — Retenção de segurança (03:30)

> 🟢 CONFIRMADO · 🟡 INFERIDO. Fontes: `functions/index.js:913-919`, `functions/retencao.js`, `flowcharts/seguranca-e-rbac.md`, `RN-058`, `ADR-004`.

## Visão Geral

🟢 Limpa dados de sistema com políticas isoladas por nó, reduzindo volume sem apagar registros de negócio.

## Responsabilidades

- 🟢 Executar às 03:30 de `America/Sao_Paulo`.
- 🟢 Aplicar 4 políticas: auditoria (90 dias), dedup/reservas (24 h), cotas (2 h), logs de webhook.
- 🟢 Retornar resumo por nó.

## Regras de Negócio

- 🟢 RN-058: auditoria 90 dias; dedup/reservas 24 h; cotas 2 h.
- 🟢 Limpeza isolada por nó — falha em um não bloqueia os outros.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Schedule 03:30 America/Sao_Paulo | Must | Config correta |
| RF-02 | 🟢 `executarLimpeza(db, agora)` com políticas separadas | Must | Cada nó respeita sua janela |
| RF-03 | 🟢 Resumo por nó | Must | Retorno contém contadores por política |
| RF-04 | 🟢 Isolamento de falhas | Must | Erro em um nó não aborta os demais |

## Critérios de Aceitação

```gherkin
Dado registros de auditoria com 91 dias e reservas com 25 horas
Quando o job roda
Então apenas os registros fora da janela são removidos e o resumo informa ambos

Dado uma política que falha
Quando o job roda
Então as outras políticas ainda são executadas e o erro é reportado no resumo
```

## Rastreabilidade

| Arquivo | Função | Cobertura |
|---------|--------|-----------|
| `functions/retencao.js:11-16,54-65` | `executarLimpeza` | 🟢 |
| `functions/index.js:913` | `exports.retencaoSegurancaJob` | 🟢 |
| `RN-058` | — | 🟢 |
