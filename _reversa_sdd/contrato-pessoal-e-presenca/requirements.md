# Contrato de dados — Trabalhadores, presença e almoços

> 🟢 CONFIRMADO · 🟡 INFERIDO. Cobre `trabalhadores`, `presenca-e-ponto` e `almocos` (matriz §4). Fontes: `flowcharts/trabalhadores.md`, `flowcharts/presenca-e-ponto.md`, `flowcharts/almocos.md`, `data-dictionary.md` §37-51/§103, `domain.md` RN-036–RN-039/RN-045/RN-047, `ADR-008`, `ADR-009`.

## Visão Geral

🟢 Ficha de pessoal + registro diário de presença + vale-refeição. A diária é recalculada em leitura e o pagamento da folha é derivado de presença menos financeiro.

## Responsabilidades

- 🟢 Manter trabalhador com diária, vínculo, status e escopo de obras.
- 🟢 Registrar presença (`Presente`, `Falta`, `Meio período`) e hora extra.
- 🟢 Recalcular diária retroativamente quando a diária muda e o registro não foi pago.
- 🟢 Registrar almoço com o mesmo quarteto de status de pagamento do financeiro.

## Regras de Negócio

- 🟢 RN-036: semana começa na segunda-feira.
- 🟢 RN-037: `Falta → 0`; `Meio período → diária/2`; `Informal → diária`; hora extra `diária + hextra*(diária/8)*1,5`.
- 🟢 RN-038: mudança de diária ⇒ recálculo retroativo das presenças não pagas.
- 🟢 RN-039: saldo de folha = soma(presença.total) − soma(financeiro.real com `source='pre'`).
- 🟢 RN-045: vale-refeição devido = `max(0, vtotal - pago)`.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 `saveTrabalhador` com diária/vínculo/status | Must | Campos válidos |
| RF-02 | 🟢 `savePresenca` por data+trabalhador | Must | Sem duplicata no dia |
| RF-03 | 🟢 Calcular total/horas derivados | Must | Regras RN-037 aplicadas |
| RF-04 | 🟢 Recálculo retroativo | Must | Presenças não pagas atualizadas |
| RF-05 | 🟢 `saveAlmoco` com status de pagamento | Must | Vale devido calculado |
| RF-06 | 🟢 Semana brasileira | Must | Domingo não gera alerta de presença |

## Critérios de Aceitação

```gherkin
Dado um trabalhador com diária 100 e presença 'Meio período' com 2 horas extras
Quando o total é calculado
Então o resultado é 100/2 + 2*(100/8)*1,5 = 87,5

Dado uma mudança de diária de 100 para 120
Quando há presença não paga no período
Então o total dessa presença é recalculado retroativamente
```

## Rastreabilidade

| Arquivo | Símbolo | Cobertura |
|---------|---------|-----------|
| `public/js/app_core.js` | `saveTrabalhador`, `savePresenca`, `saveAlmoco` | 🟢 |
| `public/js/utils.module.js` | cálculos | 🟢 |
| `functions/index.js:340-394` | ponto via bot | 🟢 |
| `data-dictionary.md` §37-51 | campos | 🟢 |
