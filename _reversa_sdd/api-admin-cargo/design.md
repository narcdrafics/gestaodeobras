# API Admin — Cargo, Design Técnico

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `functions/cargos.js`, `functions/index.js:864`, `flowcharts/usuarios-e-cargos.md`.

## Interface

| Método | Caminho | Entrada | Saída | Status codes |
|--------|---------|---------|-------|--------------|
| POST | `/api/admin/cargo` | `{acao, role, uid\|email, modulosPermitidos, acessoObras, obrasPermitidas}` + Bearer | `{ok, perfil}` | 200, 400, 401, 403, 404, 405, 413, 429, 503 |

| Símbolo | Assinatura | Retorno | Observação |
|---------|-----------|---------|------------|
| `verificarChamador` | `(req, db)` | `{ehMaster, ehAdmin, uid}` | 🟢 token + Auth + perfis + allowlist + passaporte |
| `resolverAlvo` | `(dados, db)` | `{uid, perfil, passaporte}` | 🟢 uid ou e-mail |
| `normalizarRole` | `(role)` | `string` | 🟢 `mestre` ⇒ `encarregado` |
| `normalizarModulosRh` | `(entrada, role)` | `object \| null` | 🟢 padrão `{funcionarios, presenca, almocos}` |
| `handleCargoRequest` | `(req, res)` | `Promise<void>` | 🟢 dispatcher |

## Fluxo Principal

1. 🟢 POST + validação de corpo/cota e Bearer com `checkRevoked`.
2. 🟢 `verificarChamador` ⇒ master ou admin; não autorizado ⇒ 403.
3. 🟢 `resolverAlvo`; auto-alteração ⇒ 400.
4. 🟢 `role` obrigatório; `normalizarRole`; `super_admin` exige master.
5. 🟢 Whitelist de papéis do chamador; destino do tenant conforme papel.
6. 🟢 `normalizarModulosRh` e escopo de obras.
7. 🟢 `update()` em `profiles` (+ módulos RH quando aplicável); espelha `users`/`invites`/`super_admins`.
8. 🟢 `revokeRefreshTokens` + auditoria obrigatória + trigger `syncCustomClaims`.

## Fluxos Alternativos

- **Admin sem tenant no perfil alvo:** 🟢 não pode adotar; 400.
- **`remover_usuario`:** 🟢 perfil `desativado`/`bloqueado`, passaporte limpo, remoção da lista do tenant, Auth desativado.
- **Último admin:** 🟢 bloqueado no cliente; servidor ainda valida auto-alteração.
- **Auditoria falha:** 🟢 503 e efeito já aplicado permanece (reserva não é usada nesta API).

## Dependências

- 🟢 `claims.js`, `auditoria.js`, `abuso.js`, RTDB (`profiles`, `users`, `invites`, `super_admins`, `tenants`), Firebase Auth, `syncCustomClaims`.

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Papel efetivo = maior entre claim e perfil | `aprovacoes-api.js:47,58`; `RN-009` | 🟢 |
| `mestre` normalizado no servidor e no cliente | `cargos.js`; `index.js` | 🟢 |
| Revogação explícita antes de novas claims | `flowcharts/usuarios-e-cargos.md` §2 | 🟢 |

## Estado Interno

🟢 `profiles/<uid>` (`role`, `tenantId`, `status`, `cargoAtualizadoPor/Em`, `modulosPermitidos`, `acessoObras`, `obrasPermitidas`), `users/<emailKey>`, `invites/<emailKey>`, `super_admins/<uid>`, `tenants/<tid>/usuarios`. 🟡 Claims no Auth são assíncronas — o trigger publica.

## Observabilidade

🟢 Auditoria obrigatória com ator, alvo e papel. 🟡 Sem log de tentativa de escalação negada além da resposta 403.

## Riscos e Lacunas

- 🟡 GAP-09: alias `mestre` e `EMAIL_MESTRA` replicados entre `claims.js`, rules e Storage.
- 🔴 GAP-10: `syncCustomClaims` sem retry — falha pode deixar claims desatualizadas sem alerta.
- 🟡 Limite de 50 obras nas claims vs. 500 no pedido — conferir intenção antes de reimplementar.
