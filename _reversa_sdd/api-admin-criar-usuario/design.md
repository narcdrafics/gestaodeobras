# API Admin — Criar usuário, Design Técnico

> 🟢 CONFIRMADO · 🔴 LACUNA. Fonte: `functions/usuarios.js`, `functions/index.js:834`, `firebase.json:19-22`.

## Interface

| Método | Caminho | Entrada | Saída | Status codes |
|--------|---------|---------|-------|--------------|
| POST | `/api/admin/criar-usuario` | `{email, nome, tenantId}` + Bearer | `{uid, email, password, criado}` | 200, 400, 401, 403, 405, 409, 413, 429 |

| Símbolo | Assinatura | Retorno | Observação |
|---------|-----------|---------|------------|
| `criarUsuarioTenant` | `(req, res)` | `Promise<void>` | 🟢 exportado diretamente em `index.js:834` |
| `papelDoChamador` | `(req, db)` | `{role, tenantId, uid}` | 🟢 Auth + profiles + `super_admins` |
| `gerarSenhaTemporaria` | `()` | `string` | 🟢 12 caracteres |

## Fluxo Principal

1. 🟢 POST obrigatório; `validarCorpo` + cota `admin:ip` 20/min.
2. 🟢 Bearer ⇒ `verifyIdToken(token, true)`; resolve Auth, perfil e allowlist.
3. 🟢 Papel `admin`/`super_admin`; cota `admin:uid` 60/min.
4. 🟢 Valida `email`, `nome`, `tenantId`; bloqueia auto-alteração e tenant cruzado.
5. 🟢 Transação em `invites/<emailKey>` (`usos: 0 → 1`).
6. 🟢 `createUser` (ou `updateUser` + `revokeRefreshTokens` se já existe no mesmo tenant).
7. 🟢 200 com senha temporária; falha devolve a reserva.

## Fluxos Alternativos

- **Convite ausente/tenant divergente:** 🟢 409 `convite_inexistente`.
- **Convite já usado:** 🟢 409 `convite_ja_usado`.
- **E-mail vinculado a outro tenant:** 🟢 409 e reserva devolvida.
- **Falha no Auth:** 🟢 reserva devolvida, erro propagado.

## Dependências

- 🟢 Firebase Auth Admin SDK, Realtime Database (`invites`, `profiles`, `users`, `super_admins`, `tenants`), `abuso.js`.
- 🟢 `syncCustomClaims` (trigger) publica as claims resultantes.

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Convite como reserva transitive | `functions/usuarios.js` (transação `usos`) | 🟢 |
| Senha nunca persistida no RTDB | `flowcharts/usuarios-e-cargos.md` §1 | 🟢 |
| Admin comum restrito ao próprio tenant | `flowcharts/usuarios-e-cargos.md` §1 | 🟢 |

## Estado Interno

🟢 `invites/<emailKey>.usos` (0/1), `profiles/<uid>`, `users/<emailKey>`, `tenants/<tid>/usuarios`. 🟡 O limite de assentos é aplicado pelo trigger, não aqui.

## Observabilidade

🟢 Erros de autorização e convite retornam códigos estáveis. 🟡 Sem auditoria centralizada nesta API (ao contrário de `adminAccountApi`).

## Riscos e Lacunas

- 🔴 Confirmar se a auditoria de criação de usuário deve ser obrigatória (hoje não há registro em `admin_audit`).
- 🟡 Senha temporária trafega na resposta; exige HTTPS e sem logging de corpo.
