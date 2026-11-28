# User Stories — Administração de usuários e cargos

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `flowcharts/admin-e-super-admin.md`, `flowcharts/usuarios-e-cargos.md`, `permissions.md`, `ADR-002`, `ADR-006`.

## US-AU-01 — Criar usuário a partir de convite

**Como** administrador do tenant, **quero** criar um usuário usando um convite válido, **para** que ele receba senha temporária e entre no sistema.

```gherkin
Dado um convite com `usos: 0` para o e-mail informado
Quando envio POST `/api/admin/criar-usuario`
Então o convite é consumido em transação (`0→1`)
E a resposta traz uid, e-mail e senha temporária
```

🟢 Units: `api-admin-criar-usuario/`, `contrato-admin-e-usuarios/`. 🔴 Senha nunca gravada no RTDB.

## US-AU-02 — Definir cargo e módulos

**Como** administrador, **quero** atribuir cargo, módulos e obras permitidas, **para** controlar o que cada pessoa pode fazer.

```gherkin
Dado um usuário alvo do meu tenant
Quando envio `definir_cargo` com role `rh` e módulos
Então perfil, passaporte, convite e allowlist são atualizados
E os tokens são revogados para aplicar as novas claims
```

🟢 Units: `api-admin-cargo/`, `contrato-admin-e-usuarios/`.

## US-AU-03 — Bloquear ou excluir usuário

**Como** administrador, **quero** bloquear ou excluir um usuário, **para** revogar imediatamente o acesso dele.

```gherkin
Dado uma ação destrutiva com `requestId`
Quando a operação é reservada em `admin_ops`
Então Auth é desabilitado/excluído, perfil é atualizado e auditoria é gravada
E uma reentrega com o mesmo `requestId` retorna `200 idempotente=true`
```

🟢 Units: `api-admin-conta/`, `contrato-admin-e-usuarios/`.

## US-AU-04 — Receber resposta segura em caso de falha de auditoria

**Como** administrador, **quero** que a operação seja abortada se a auditoria obrigatória falhar, **para** não haver ação sem rastro.

```gherkin
Dado que a gravação em `admin_audit` falhou
Quando a ação foi classificada como destrutiva
Então a API responde `503 auditoria_falhou` com `requestId`
```

🟢 Unit: `api-admin-conta/`, `contrato-admin-e-usuarios/`.

## US-AU-05 — Operar no painel master

**Como** super_admin, **quero** consultar produtos, vendas e webhooks da Kiwify, **para** apoiar o time comercial sem sair do sistema.

```gherkin
Dado `recurso=kiwify` e `tipo=sales`
Quando faço GET `/api/admin/conta`
Então recebo `{ok, resultado, catalogoLocal}` com token OAuth em cache
```

🟢 Unit: `api-admin-conta/`.

## Lacunas

- 🟡 Ações destrutivas dependem de `requestId`; auditoria é fail-closed.
- 🟡 Claims são assíncronas: a UI pode refletir o papel antes do token ser atualizado.
