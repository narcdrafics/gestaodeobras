# Job — Retenção de segurança, Design Técnico

> 🟢 CONFIRMADO. Fonte: `functions/retencao.js`, `functions/index.js:913`.

## Interface

| Gatilho | Config | Saída |
|---------|--------|-------|
| onSchedule | `every day 03:30`, `America/Sao_Paulo` | resumo por nó |

| Símbolo | Assinatura | Observação |
|---------|-----------|------------|
| `executarLimpeza` | `(db, agora)` | 🟢 aplica as 4 políticas |

## Políticas

| Nó | Janela | Confiança |
|----|--------|-----------|
| 🟢 `admin_audit` / `auditoria` | 90 dias | 🟢 |
| 🟢 `whatsapp_messages`, `billing_events`, `admin_ops` | 24 h | 🟢 |
| 🟢 cotas IP/UID | 2 h | 🟢 |
| 🟢 `webhook_debug` | janela curta configurada | 🟡 |

## Fluxo

1. 🟢 Para cada política, varre o nó com recorte por timestamp.
2. 🟢 Remove somente registros fora da janela.
3. 🟢 Acumula contador e eventuais erros.
4. 🟢 Retorna resumo.

## Riscos

- 🟡 Reservas presas de `admin_ops` sem lease curto (GAP-10) — a retenção é o único mecanismo de limpeza.
