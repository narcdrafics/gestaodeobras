# Contrato de dados — Admin, usuários e cargos

> 🟢 CONFIRMADO · 🟡 INFERIDO. Cobre `admin-e-super-admin` e `usuarios-e-cargos` (matriz §4). Fontes: `flowcharts/admin-e-super-admin.md`, `flowcharts/usuarios-e-cargos.md`, `domain.md` RN-005–RN-012, `permissions.md`, `ADR-002`, `ADR-006`.

## Visão Geral

🟢 Ciclo de vida administrativo do usuário: convite → criação de conta → definição de cargo → propagação de claims → bloqueio/remoção, mais ações do painel Master e a leitura da Kiwify.

## Responsabilidades

- 🟢 Gravar convite no RTDB antes da chamada à API de criação.
- 🟢 Definir papéis com whitelist por chamador e recorte de módulos/obras para RH.
- 🟢 Espelhar alterações em `profiles`, `users`, `invites`, `super_admins`.
- 🟢 Executar ações do Master com reserva e auditoria fail-closed.
- 🟢 Impedir escalação de privilégio e auto-alteração.

## Regras de Negócio

- 🟢 RN-005: auto-promoção corrigida para `admin`.
- 🟢 RN-007: master por allowlist → e-mail mestre → passaporte.
- 🟢 RN-008: RH recortado por módulos e obras.
- 🟢 RN-012: IP hashed com salt `obrareal:cargo:`.
- 🟡 `EMAIL_MESTRA = tonycampelo@gmail.com` (GAP-09).

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Convite antes da criação da conta | Must | Sem convite ⇒ API 409 |
| RF-02 | 🟢 Whitelist de papéis por chamador | Must | Admin não promove a master |
| RF-03 | 🟢 Módulos/obras de RH propagados | Must | Claims refletem o perfil |
| RF-04 | 🟢 Auto-alteração bloqueada | Must | 400 |
| RF-05 | 🟢 Auditoria das ações do Master | Must | 503 se falhar |
| RF-06 | 🟢 Remoção desativa e limpa passaporte | Must | Auth disabled=true |
| RF-07 | 🟡 Alias `mestre` normalizado | Should | GAP-09 |

## Critérios de Aceitação

```gherkin
Dado um admin tentando promover a si mesmo a super_admin
Quando a API de cargo processa
Então a promoção é negada e o trigger corrige o perfil para admin

Dado um RH com modulosPermitidos {presenca:true}
Quando o cargo é salvo
Então apenas presença aparece na claim e no filtro de navegação
```

## Rastreabilidade

| Arquivo | Símbolo | Cobertura |
|---------|---------|-----------|
| `functions/cargos.js`, `usuarios.js`, `super_admin.js`, `claims.js` | APIs | 🟢 |
| `public/js/app_core.js` | painel Master | 🟢 |
| `tests/privilege-escalation.test.js`, `tests/rh-customizavel.test.js` | — | 🟢 |
