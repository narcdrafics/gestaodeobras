# Contrato de dados — Pessoal e presença, Design

> 🟢 CONFIRMADO · 🟡 INFERIDO. Fontes: `flowcharts/presenca-e-ponto.md`, `ADR-008`, `ADR-009`.

## Estrutura de dados

| Nó | Campos | Confiança |
|----|--------|-----------|
| `trabalhadores/<id>` | `nome`, `diaria`, `vinculo`, `status`, `obras` | 🟢 |
| `presenca/<id>` | `data`, `obra`, `trab`, `nome`, `funcao`, `vinculo`, `equipe`, `frente`, `entrada`, `saida`, `hnorm`, `hextra`, `presenca`, `justif`, `obs`, `diaria`, `total`, `pgtoStatus`, `valpago`, `lancador`, `hrLanc`, `origem`, `telefoneAutor` (`data-dictionary.md` §42; bot via `index.js:367-375`) | 🟢 |
| `almocos/<id>` | `data`, `trab`, `vtotal`, `pago`, `status` | 🟢 |
| `financeiro` (derivado) | `source='pre'` para folha | 🟢 |

## Derivações (não persistidas)

| Valor | Regra |
|-------|-------|
| 🟢 total presença | RN-037 |
| 🟢 saldo de folha | RN-039 |
| 🟢 vale devido | RN-045 |
| 🟢 semana | segunda-feira (RN-036) |

## Fluxo

1. 🟢 Salva trabalhador/presença/almoço no tenant.
2. 🟢 Bot também grava presença por transação (`data+trab`).
3. 🟢 Leitura recalcula derivações; escrita financeira gera `source='pre'`.
4. 🟢 Mudança de diária dispara recálculo das presenças não pagas.

## Riscos

- 🟢 GAP-03 resolvido (P3): `dailyReport` deve ler `presenca`; hoje lê `ponto/<hoje>`.
- 🟡 GAP-06: `status` × `billingState` não afeta este contrato diretamente.
