# Contrato de dados — Aprovações

> 🟢 CONFIRMADO · 🔴 LACUNA. Cobre `aprovacoes` (matriz §4). Fontes: `flowcharts/aprovacoes.md`, `functions/aprovacoes.js`, `aprovacoes-api.js`, `domain.md` RN-026–RN-034, `ADR-005`, `permissions.md`.

## Visão Geral

🟢 Aprovação é a porta única de efeitos sensíveis. Solicitações de `encarregado`, `engenheiro` e `rh` são desviadas para um nó pendente; decisão e aplicação são transações separadas com prazo de 15 dias.

## Responsabilidades

- 🟢 Desviar escrita sensível para `tenants/<tid>/aprovacoes/<id>`.
- 🟢 Dedup de solicitação idêntica em 60 s.
- 🟢 Decidir com hierarquia efetiva; aplicar efeitos por trigger.
- 🟢 Alertar 7/12/15 dias e expirar; redacionar payloads sensíveis.

## Regras de Negócio

- 🟢 RN-026: apenas 3 papéis têm escrita desviada; admin/comprador escrevem direto.
- 🟢 RN-027: ponto, fotos, tarefas e almoços não passam por aprovação.
- 🟢 RN-028: prazo 15 dias; alertas dedupados.
- 🟢 RN-033: dados comerciais em `comprasPrivadas`.
- 🟢 GAP-04 resolvido (P4): `tarefas_pendentes` removido — gravação direta em `tarefas`.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Desvio por papel/tipo | Must | Papéis corretos desviados; demais direto |
| RF-02 | 🟢 Dedup 60 s por solicitante/tipo/descrição/payload | Must | Reenvio reusa id |
| RF-03 | 🟢 Nó com `expiraEm = now + 15 dias` | Must | rules validam expiração exata |
| RF-04 | 🟢 Decisão hierárquica e transacional | Must | 409 em concorrência |
| RF-05 | 🟢 Aplicação idempotente com revalidação | Must | Efeito único |
| RF-06 | 🟢 Redaction para papéis restritos | Must | Campos sensíveis ocultos |
| RF-07 | 🟢 Não especificar `tarefas_pendentes` | Must | Decisão P4: nó removido |

## Critérios de Aceitação

```gherkin
Dado um encarregado salvando uma movimentação de estoque
Quando o save* detecta que requer aprovação
Então um nó pendente é criado e nenhuma alteração direta de estoque acontece

Dado um engenheiro visualizando uma compra pendente
Quando o payload é exibido
Então forn/pixkey/vunit/vtotal/vorc/prazo não aparecem
```

## Rastreabilidade

| Arquivo | Símbolo | Cobertura |
|---------|---------|-----------|
| `public/js/aprovacoes_ui.js` | `desviarParaAprovacao`, `payloadParaExibicao` | 🟢 |
| `functions/aprovacoes.js`, `aprovacoes-api.js` | efeitos/decisão | 🟢 |
| `data-dictionary.md` §21-26 | entidades | 🟢 |
