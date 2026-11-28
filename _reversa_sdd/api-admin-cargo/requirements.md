# API Admin — Cargo (`POST /api/admin/cargo`)

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `firebase.json:27-30`, `functions/cargos.js`, `functions/claims.js`, `_reversa_sdd/flowcharts/usuarios-e-cargos.md`, `domain.md` RN-005/RN-008/RN-009.

## Visão Geral

🟢 Define ou remove cargo de um usuário sem confiar no cliente: papel efetivo vem de token, perfil, allowlist e passaporte. Normaliza papéis legados, propaga módulos/escopo de RH e revoga tokens para que novas claims sejam emitidas pelo trigger.

## Responsabilidades

- 🟢 Autorizar chamador (`master`/`admin`) e impedir auto-alteração.
- 🟢 Resolver alvo por `uid` ou e-mail em `profiles`/`users`/Auth.
- 🟢 Normalizar `mestre` → `encarregado` e validar papel contra whitelist do chamador.
- 🟢 Normalizar `modulosPermitidos` e `obrasPermitidas` (até 500 ids) somente para `rh`.
- 🟢 Espelhar alteração em `profiles`, `users`, `invites`, `super_admins` e revogar tokens.
- 🟢 Impedir promoção a `super_admin` por admin comum (correção também no trigger).

## Regras de Negócio

- 🟢 RN-005: auto-promover a `super_admin` é corrigido para `admin` no próprio perfil.
- 🟢 RN-008: RH só acessa módulos com `modulosPermitidos.<modulo> === true`; `acessoObras='especificas'` limita a até 50 obras nas claims.
- 🟢 RN-009: papel efetivo é o maior entre claim e perfil na hierarquia.
- 🟢 Admin comum não pode cruzar tenant nem adotar perfil sem tenant.
- 🟡 `syncCustomClaims` normaliza `mestre`→`encarregado` — exceção legada (GAP-09).

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Somente POST | Must | Outro método ⇒ 405 |
| RF-02 | 🟢 Token com `checkRevoked` e autoridade de master/admin | Must | Falha ⇒ 401/403 |
| RF-03 | 🟢 Resolver alvo por uid/e-mail | Must | Sem alvo ⇒ 404 |
| RF-04 | 🟢 Proibir auto-alteração | Must | Alvo == chamador ⇒ 400 |
| RF-05 | 🟢 `acao` em `definir_cargo`/`remover_usuario` e `role` obrigatório | Must | Inválido ⇒ 400 |
| RF-06 | 🟢 `normalizarRole`: `mestre` ⇒ `encarregado` | Must | Perfil gravado com `encarregado` |
| RF-07 | 🟢 `super_admin` somente por master | Must | Admin comum ⇒ 403 |
| RF-08 | 🟢 Destino dotenant por papel | Must | `super_admin` ⇒ `MASTER_SYSTEM`; admin ⇒ tenant próprio |
| RF-09 | 🟢 Módulos RH apenas quando `role='rh'` | Must | Outros papéis têm campos limpos |
| RF-10 | 🟢 Escopo de obras (todas/específicas, até 500 no pedido) | Must | Valores fora da lista são descartados |
| RF-11 | 🟢 Espelhar em `users`/`invites`/`super_admins` e revogar tokens | Must | Novo token traz claims atualizadas via trigger |
| RF-12 | 🟢 `remover_usuario` desativa, remove listas e audita | Must | Perfil `desativado`, `status='bloqueado'`, Auth `disabled=true` |
| RF-13 | 🟢 Auditoria obrigatória | Must | Falha ⇒ 503 `auditoria_falhou` |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | Token revogado rejeitado | `functions/cargos.js:50-97` | 🟢 |
| Segurança | Reconfirmação de autoridade no RTDB | `flowcharts/usuarios-e-cargos.md` §2 | 🟢 |
| Disponibilidade | `revokeRefreshTokens` antes da emissão de claims | `flowcharts/usuarios-e-cargos.md` §2 | 🟢 |

## Critérios de Aceitação

```gherkin
Dado um admin comum tentando promover outro usuário a super_admin
Quando a API processa a ação
Então a resposta é 403 e nenhum perfil é alterado

Dado um perfil com role='rh' e modulosPermitidos {presenca:true, compras:false}
Quando o cargo é definido
Então apenas módulos com valor true são gravados e propagados às claims

Dado um pedido de remoção de usuário com cargo alterado pelo próprio chamador
Quando a API valida o alvo
Então a resposta é 400 auto_alteracao
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-13 | Must | Caminho crítico de RBAC; falha abre escalação de privilégio |
| Auditoria de leitura do painel | Should | Já coberta por `adminAccountApi` |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `functions/cargos.js` | `handleCargoRequest`, `normalizarRole`, `normalizarModulosRh` | 🟢 |
| `functions/claims.js` | `avaliarSuperAdmin` | 🟢 |
| `functions/auditoria.js` | `registrar` | 🟢 |
| `functions/index.js:864` | `exports.gerenciarCargo` | 🟢 |
| `tests/privilege-escalation.test.js`, `tests/rh-customizavel.test.js` | — | 🟢 |
