# Contrato externo — API Admin Conta

> 🟢 CONFIRMADO em `functions/super_admin.js`, `functions/kiwify_api.js`, `firebase.json`.

## POST `/api/admin/conta`

```http
Authorization: Bearer <idToken>
{ "acao": "definir_plano", "requestId": "<uuid>", "tenantId": "slug", "plano": "pro" }
```

| Ação | Parâmetros | Efeito |
|------|------------|--------|
| 🟢 `reset_password` | `email` | link só na resposta; proibido auto-reset |
| 🟢 `bloquear_usuario` | `uid` ou `email` | `disabled`, `revokeRefreshTokens`, perfil bloqueado |
| 🟢 `excluir_usuario` | `uid` ou `email` | update multi-path + `auth.deleteUser` |
| 🟢 `definir_limites` | `tenantId`, limites | `config/limiteObras`, `limiteUsuarios`, `limiteTrabalhadores` |
| 🟢 `definir_plano` | `tenantId`, `plano` | plano, vencimento, `billingState='ativo'`, limites |
| 🟢 `bloquear_tenant` | `tenantId`, `bloquear` | alterna `bloqueado_pagamento`/`ativo` + `billingState` |

Status: 200 (ok), 400, 401, 403, 404, 405, 409, 413, 429, 502, 503 (`auditoria_falhou`).

Idempotência: 🟢 `requestId` em `admin_ops/<requestId>`; reenvio ⇒ `200 idempotente=true`.

## GET `/api/admin/conta`

| Parâmetro | Valores |
|-----------|---------|
| `recurso` | 🟢 `kiwify` |
| `tipo` | 🟢 `products`, `sales`, `account`, `webhooks` |
| `page_size` | 🟢 ≤ 100 |
| `page_number` | 🟢 ≤ 1000 |
| `status`, `product_id` | 🟢 opcionais |

Resposta: `{ok, resultado, catalogoLocal}` ou `{configurado:false, mensagem}`.

## Autoridade do master

🟢 `super_admins/<uid>.ativo != false` → e-mail `tonycampelo@gmail.com` → `role='super_admin'` em perfil **e** passaporte. 🟡 Alias `mestre` normalizado para `encarregado`.
