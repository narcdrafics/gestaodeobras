# Contrato externo — Criar usuário

> 🟢 CONFIRMADO em `functions/usuarios.js`, `firebase.json`, `flowcharts/usuarios-e-cargos.md`.

## HTTP

```http
POST /api/admin/criar-usuario
Authorization: Bearer <idToken>
Content-Type: application/json

{ "email": "usuario@empresa.com", "nome": "Nome", "tenantId": "slug" }
```

| Status | Significado |
|--------|-------------|
| 200 | `{ "uid", "email", "password", "criado" }` |
| 400 | campos obrigatórios / auto-alteração |
| 401 | sem Bearer ou token inválido/revogado |
| 403 | papel sem permissão |
| 405 | método diferente de POST |
| 409 | `convite_inexistente`, `convite_ja_usado`, `email_vinculado_outro_tenant` |
| 413 | corpo > 16 KB |
| 429 | cota IP ou UID excedida |

## Dados

| Nó | Leitura/escrita | Confiança |
|----|-----------------|-----------|
| `invites/<emailKey>` | transação `usos: 0→1` | 🟢 |
| `profiles/<uid>` | escrita pelo trigger de claims | 🟢 |
| `users/<emailKey>` | passaporte legado | 🟢 |
| `tenants/<tid>/usuarios` | lista | 🟢 |

🔴 Senha temporária nunca gravada no RTDB — apenas na resposta HTTP.
