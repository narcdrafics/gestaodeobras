# Contrato externo — Webhook WhatsApp

> 🟢 CONFIRMADO em `firebase.json`, `functions/index.js`, `functions/whatsapp_auth.js`. 🔴 lacunas indicadas.

## HTTP

| Método | Caminho | Entrada | Resposta | Status |
|--------|---------|---------|----------|--------|
| GET | `/api/whatsapp` | `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge` | `hub.challenge` | 200 / 403 |
| POST | `/api/whatsapp` | corpo cru + `x-hub-signature-256: sha256=...` | texto enviado ao remetente | 200 / 400 / 403 / 404 / 500 |

## Erros

| Situação | Status | Observação |
|----------|--------|------------|
| Verify token inválido | 🟢 403 | `seguroEqual` com hash prévio |
| Assinatura ausente/inválida | 🟢 401 | HMAC sobre corpo cru |
| `wabaId`/`phoneNumberId` divergentes | 🟢 403 | Quando configurados |
| Objeto diferente de `whatsapp_business_account` | 🟢 404 | Ignora ramo `page` |
| URL de áudio fora da allowlist | 🟢 400 | `graph.facebook.com` ou `*.fbcdn.net` |
| Número não autorizado/ambíguo | 🟢 403 | Fail-closed |
| Tenante/usuário inativo ou bloqueado | 🟢 403 | `billingState` incluído |
| Exceção no processamento | 🟢 500 | Reserva removida para reenvio |

## Contrato de dados

| Nó | Formato | Finalidade | Confiança |
|----|---------|------------|-----------|
| `whatsapp_messages/<chaveDedup>` | `{recebidaEm, status ∈ {processing, done, rejected}, concluidaEm}` | dedup transacional; chave = `msg.id` sanitizado (`whatsapp_auth.js:156-164`) | 🟢 |
| `tenants/<tid>/tarefas/<id>` | `{desc, obra, status:'Pendente', cod:'TF###', origem:'WhatsApp', criadoEm}` | tarefa via bot | 🟢 |
| `tenants/<tid>/presenca/<id>` | `{data, obra, trab, nome, funcao, vinculo, equipe, entrada, saida, hnorm, hextra, presenca, diaria, total, pgtoStatus, valpago, lancador, hrLanc, origem:'WhatsApp', telefoneAutor}` | ponto via bot (`index.js:367-375`) | 🟢 |
| `ponto/<hoje>` | — | 🟢 lido por `dailyReport` hoje; decisão P3: `presenca` é canônico | 🟢 |

## Intenções

| Intenção | Origem | Estado |
|----------|--------|--------|
| `criar_tarefa` | 🟢 local ou GPT | Ativa |
| `lancar_ponto` | 🟢 local ou GPT | Ativa |
| `consultar` | 🟢 local ou GPT | Ativa |
| `consultar_ponto` | 🟢 detectada | 🟢 decisão P1: resumo de presença de hoje do remetente (branch pendente) |
| Prévia `CONFIRMAR/EDITAR/CANCELAR` | 🟢 `parser-tarefas.js` | 🟢 decisão P2: ativar no webhook (hoje órfão) |

## Envio de resposta

🟢 Graph API v20.0 com `META_ACCESS_TOKEN` e `META_PHONE_NUMBER_ID`. 🔴 Sem retry/fila/dead-letter (GAP-05).
