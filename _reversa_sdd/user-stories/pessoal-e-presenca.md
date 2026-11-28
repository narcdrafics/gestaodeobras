# User Stories — Pessoal, presença e alimentação

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `flowcharts/trabalhadores.md`, `flowcharts/presenca-e-ponto.md`, `flowcharts/almocos.md`, `domain.md` RN-033–RN-039, `ADR-009`.

## US-PP-01 — Cadastrar trabalhador

**Como** encarregado, **quero** cadastrar trabalhadores com diária e função, **para** calcular folha e custo da obra.

```gherkin
Dado um trabalhador com status `ativo`
Quando lanço presença para ele
Então a diária é usada no cálculo de custo
```

🟢 Unit: `contrato-pessoal-e-presenca/`.

## US-PP-02 — Lançar presença do dia

**Como** encarregado, **quero** registrar presença, meio período ou falta com data de negócio, **para** refletir a folha do dia correto.

```gherkin
Dado a data atual em `America/Sao_Paulo`
Quando salvo presença
Então a data gravada usa `getTodayBR()`
E horas: Presente=8, Meio=4, Falta=0
```

🟢 Unit: `contrato-pessoal-e-presenca/`.

## US-PP-03 — Ver custo de diárias no dashboard

**Como** gestor, **quero** ver `Diárias Hoje` no dashboard, **para** acompanhar o custo diário sem planilha.

```gherkin
Dado presenças lançadas hoje
Quando renderizo o dashboard
Então `diariasHoje` vem de `calcCustosDiarias` no fuso local
E não de `new Date().toISOString()`
```

🟢 Units: `contrato-pessoal-e-presenca/`, `contrato-relatorios-e-fotos/`.

## US-PP-04 — Registrar almoço

**Como** encarregado, **quero** registrar almoços da equipe, **para** incluí-los na agregação de custos sem fechar a folha.

```gherkin
Dado um almoço registrado em uma obra
Quando o financeiro consolida entradas
Então aparece como entrada `source='alm'`
Sem alterar presença nem pagamento
```

🟢 Units: `contrato-pessoal-e-presenca/`, `contrato-suprimentos-e-custos/`.

## US-PP-05 — Limitar assentos de usuários

**Como** administrador, **quero** que novos perfis acima do limite fiquem pendentes, **para** respeitar o plano contratado.

```gherkin
Dado `ativos >= limiteUsuarios + 1`
Quando um perfil novo é escrito
Então `status='pendente'`, `role='pendente'` e `tenantId=null`
Sem emitir claims de acesso
```

🟢 Units: `trigger-limite-usuarios/`, `contrato-billing-e-planos/`.

## Lacunas

- 🟢 GAP-03 resolvido (P3): `dailyReport` deve ler `presenca`; hoje lê `ponto/<hoje>` (ajuste pendente).
- 🟡 `norm(o.cod)` em `buscarObra` pode falhar com códigos numéricos.
