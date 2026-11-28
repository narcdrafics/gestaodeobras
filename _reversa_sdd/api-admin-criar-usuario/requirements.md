# API Admin — Criar usuário (`POST /api/admin/criar-usuario`)

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `firebase.json:19-22`, `functions/usuarios.js`, `_reversa_sdd/flowcharts/usuarios-e-cargos.md`, `domain.md` RN-010/RN-011/RN-003.

## Visão Geral

🟢 Cria usuário no Firebase Auth a partir de um convite pré-gravado no RTDB, com senha temporária devolvida apenas uma vez na resposta. Autoridade decidida no servidor; quotas e validação antes de tocar no Auth.

## Responsabilidades

- 🟢 Validar método, corpo (16 KB) e cota IP (20/min) antes do Auth.
- 🟢 Verificar token com `checkRevoked=true` e papel do chamador (`admin`/`super_admin`).
- 🟢 Consumir convite por transação (`usos: 0 → 1`) e impedir reuso.
- 🟢 Criar/atualizar conta com senha temporária de 12 caracteres e revogar tokens.
- 🟢 Nunca gravar senha no Realtime Database.

## Regras de Negócio

- 🟢 RN-010: método/corpo/cota antes de Auth/RTDB.
- 🟢 RN-003: perfil acima do limite de assentos vira `pendente` (efeito do trigger, não desta API).
- 🟢 `invites/<emailKey>.tenantId` precisa casar com o `tenantId` informado.
- 🟢 Admin não-master não pode vincular e-mail a outro tenant.
- 🟢 Falha na criação devolve a reserva do convite.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Somente POST | Must | Outro método ⇒ 405 |
| RF-02 | 🟢 Corpo ≤16 KB e cota IP 20/min | Must | Excede ⇒ 413/429 antes de qualquer chamada ao Auth |
| RF-03 | 🟢 Bearer com `verifyIdToken(token, true)` | Must | Sem token/revogado ⇒ 401 |
| RF-04 | 🟢 Papel do chamador em `admin`/`super_admin` | Must | Caso contrário ⇒ 403 |
| RF-05 | 🟢 Cota UID 60/min e campos `email`, `nome`, `tenantId` | Must | Inválido ⇒ 400 |
| RF-06 | 🟢 Anti-auto-alteração e anti-tenant-cruzado | Must | Violação ⇒ 400/403 |
| RF-07 | 🟢 Convite com `tenantId` compatível e `usos: 0→1` transacional | Must | Convite ausente ⇒ 409 `convite_inexistente`; já usado ⇒ 409 `convite_ja_usado` |
| RF-08 | 🟢 Senha temporária de 12 caracteres na resposta | Must | Senha nunca aparece em RTDB/auditoria |
| RF-09 | 🟢 Conta existente no mesmo tenant ⇒ `updateUser` + `revokeRefreshTokens` | Must | Outro tenant ⇒ 409 e reserva devolvida |
| RF-10 | 🟢 Falha no Auth devolve a reserva | Must | `createUser` falho não deixa convite consumido |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | Token com checagem de revogação | `functions/usuarios.js` | 🟢 |
| Segurança | Senha temporária apenas na resposta HTTP | `flowcharts/usuarios-e-cargos.md` §1 | 🟢 |
| Disponibilidade | Reserva do convite reverte em falha | `functions/usuarios.js` | 🟢 |
| Escalabilidade | Cotas IP/UID separadas | `functions/abuso.js` | 🟢 |

## Critérios de Aceitação

```gherkin
Dado um convite válido com usos=0 e tenantId igual ao da sessão
Quando um admin envia POST com e-mail e nome
Então a resposta é 200 com uid, e-mail, senha temporária e a reserva do convite fica consumida

Dado um convite já usado
Quando a mesma requisição é repetida
Então a resposta é 409 convite_ja_usado e nenhuma conta é alterada

Dado um e-mail já vinculado a outro tenant
Quando um admin não-master tenta criá-lo
Então a resposta é 409 email_vinculado_outro_tenant e a reserva é devolvida
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-10 | Must | Criação de usuário é caminho crítico de onboarding |
| Auditoria da operação | Should | Importante, mas a API foca no convite |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `functions/usuarios.js` | `criarUsuarioTenant`, `papelDoChamador`, `gerarSenhaTemporaria` | 🟢 |
| `functions/abuso.js` | `validarCorpo`, `consumirCota` | 🟢 |
| `functions/index.js:834` | export direto `criarUsuarioTenant` | 🟢 |
| `firebase.json:19-22` | rewrite | 🟢 |
