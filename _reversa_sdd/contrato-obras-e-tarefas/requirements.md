# Contrato de dados — Obras e tarefas

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Cobre `obras` e `tarefas` (matriz §4). Fontes: `flowcharts/obras.md`, `flowcharts/tarefas.md`, `data-dictionary.md` §27-36/§101-104, `domain.md` RN-035, `ADR-008`.

## Visão Geral

🟢 Obra é a unidade física de trabalho; tarefa é item executável com status efetivo derivado. O `Obra.cod` é o escopo que recorta quase todas as entidades do domínio.

## Responsabilidades

- 🟢 Salvar obra com `status` (`Planejada`, `Em andamento`, `Concluída`, `Pausada`).
- 🟢 Salvar tarefa com `cod` sequencial e `status` próprio.
- 🟢 Derivar `statusEfetivo = Atrasada` em leitura quando `prazo < hoje`.
- 🟢 Respeitar escopo de obras de RH e do bot.

## Regras de Negócio

- 🟢 RN-035: `Atrasada` é derivado, nunca persistido (ADR-008).
- 🟢 RN-047: escopo de trabalhadores por array/ausência/caso contrário.
- 🟢 RN-052: bot busca obra exata → contém → fuzzy.
- 🟢 GAP-02 resolvido (P2): prévia/confirmação será ativada no webhook (código hoje órfão).
- 🟢 GAP-04 resolvido (P4): `tarefas_pendentes` removido — gravação direta em `tarefas`.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 `saveObra` com campos obrigatórios | Must |status válido e `cod` estável |
| RF-02 | 🟢 `saveTarefa` com `cod` sequencial | Must | Numeração sem duplicatas no fluxo normal |
| RF-03 | 🟢 Derivar `Atrasada` na leitura | Must | Nenhuma gravação de status derivado |
| RF-04 | 🟢 Filtrar por `ObraScope` | Must | RH vê só obras permitidas |
| RF-05 | 🟢 Tarefas do WhatsApp gravadas com `origem` | Must | `TF###` e metadados presentes |
| RF-06 | 🟢 Ativar parser de prévia/confirmação | Must | Decisão P2; integração pendente |

## Critérios de Aceitação

```gherkin
Dado uma tarefa com prazo anterior a hoje e status Pendente
Quando o dashboard carrega
Então statusEfetivo='Atrasada' é exibido e o banco permanece com status='Pendente'

Dado um RH com acessoObras='especificas' e duas obras allowlisted
Quando ele consulta tarefas
Então apenas tarefas dessas duas obras são retornadas
```

## Rastreabilidade

| Arquivo | Símbolo | Cobertura |
|---------|---------|-----------|
| `public/js/app_core.js` | `saveObra`, `saveTarefa` | 🟢 |
| `public/js/utils.module.js` | normalização/derivação | 🟢 |
| `data-dictionary.md` §27-36 | campos | 🟢 |
| `tests/tarefas-dashboard.test.js` | — | 🟢 |
