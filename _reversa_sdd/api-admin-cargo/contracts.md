# Contrato externo — API Admin Cargo

> 🟢 CONFIRMADO em `functions/cargos.js`, `firebase.json`, `flowcharts/usuarios-e-cargos.md`.

## POST `/api/admin/cargo`

```http
Authorization: Bearer <idToken>
{
  "acao": "definir_cargo",
  "uid": "<uid>",
  "role": "rh",
  "modulosPermitidos": { "presenca": true, "compras": false },
  "acessoObras": "especificas",
  "obrasPermitidas": ["<obraId>"]
}
```

| `acao` | Efeito |
|--------|--------|
| 🟢 `definir_cargo` | atualiza perfil/passaporte/convite/allowlist + revoga tokens |
| 🟢 `remover_usuario` | desativa perfil, remove listas, `disabled=true` no Auth |

| Status | Significado |
|--------|-------------|
| 200 | `{ok:true, perfil}` |
| 400 | `auto_alteracao`, `cargo_obrigatorio`, `cargo_invalido` |
| 401/403 | token inválido / sem permissão |
| 404 | alvo não encontrado |
| 405 | método inválido |
| 413/429 | corpo grande / cota |
| 503 | `auditoria_falhou` |

## Regras de papel

| Chamador | Papéis permitidos | Tenant |
|----------|-------------------|--------|
| 🟢 admin comum | `ROLES_TENANT` | somente o próprio |
| 🟢 super_admin | `ROLES_MASTER` | escolhe (`MASTER_SYSTEM` para `super_admin`) |

🟢 `mestre` é normalizado para `encarregado`. 🟢 Campos de RH são limpos quando o papel não é `rh`. 🟡 Claims são assíncronas: dependem de `syncCustomClaims`.
