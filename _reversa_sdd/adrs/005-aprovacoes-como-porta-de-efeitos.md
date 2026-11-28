# ADR 005 — Aprovação como porta única de efeitos sensíveis

- **Status:** Aceito (retroativo)
- **Data:** 2026-11-20 a 2026-11-26
- **Confiança:** 🟢 CONFIRMADO

## Contexto

Engenheiros e encarregados precisavam registrar medições, movimentações e compras, mas o negócio exige que admin autorize antes de impactar finanças e estoque. Dar escrita direta a esses papéis já tinha causado divergência entre saldo e lançamento.

## Decisão

1. `save*` do cliente chama `desviarParaAprovacao` para os papéis `encarregado`, `engenheiro` e `rh`; `admin`/`comprador` escrevem direto.
2. Nó de aprovação com 8 tipos, prazo fixo de 15 dias e alertas em 7/12/15 dias.
3. Decisão gravada por transação (concorrência ⇒ `409 ja_decidida`) e aplicação reservada separadamente, retomável após 10 min.
4. `podeAplicar` revalida autoridade **no momento de aplicar**, não apenas na decisão.
5. Um único `update()` multi-path grava efeitos, `aplicadoEm`, `antes`/`depois` e notificações; falha vira `status='erro'`.

## Alternativas consideradas

- 🟡 **Escrita direta + auditoria posterior**: rejeitado — não há como desfazer movimento de estoque e pagamento.
- 🟡 **Aprovação no cliente (flag local)**: rejeitado — burcável via DevTools/Admin SDK.
- 🟡 **Fila de mensagens externa**: não adotada; o próprio RTDB serve como inbox com reserva transacional.

## Consequências

- Positivas: rastreabilidade (`antes`/`depois`), segregação de campos comerciais em `comprasPrivadas`, retomada automática de efeitos presos.
- Negativas: mais um nó e dois passos transacionais por operação; UI pode mostrar botões que as rules negam.
- Riscos: 🟡 `setMedicaoAprovacao` é escrita direta no cliente; 🟡 exclusão/mudança de tipo não usam o contrato; 🟡 RH não decide `medicao_fechamento` mesmo com módulo.

## Evidências

`git log`: `72badf7`, `c6b7c17`, `b46bbe3`, `789d61e`, `3cdb891` (APIs, UI e efeitos de aprovação).
Código: `functions/aprovacoes.js`, `functions/aprovacoes-api.js`, `public/js/aprovacoes_ui.js`, `database.rules.json:139-145`, `tests/aprovacoes*.test.js`.
