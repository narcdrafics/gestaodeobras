# User Stories — Acesso, tenant e subdomínio

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `flowcharts/auth.md`, `flowcharts/tenants-e-slug.md`, `flowcharts/seguranca-e-rbac.md`, `domain.md`, `permissions.md`.

## US-AT-01 — Entrar no sistema pela conta do tenant

**Como** encarregado de obra, **quero** entrar com minha conta vinculada ao tenant, **para** acessar somente os dados da minha empresa.

```gherkin
Dado que possuo um perfil ativo com role e tenantId
Quando faço login e carrego o app
Então recebo Custom Claims com role e tenantId
E todas as leituras são escopadas ao meu tenant
```

🟢 Units: `contrato-autenticacao-e-claims/`, `api-admin-criar-usuario/`.

## US-AT-02 — Acessar pelo subdomínio da empresa

**Como** administrador, **quero** que minha equipe abra `slug.obrareal.com`, **para** não precisar escolher tenant manualmente.

```gherkin
Dado o hostname slug.obrareal.com
Quando a página carrega
Então `tenants_public/<slug>` é lida por chave direta
E o tenantId é resolvido sem enumerar clientes
```

🟢 Units: `contrato-tenants-e-slug/`, `contrato-infra-e-deploy/`.

## US-AT-03 — Preservar slug reservado

**Como** operador do sistema, **quero** que slugs reservados redirecionem para o domínio raiz, **para** evitar conflito com rotas administrativas.

```gherkin
Dado o subdomínio `www`, `admin`, `api`, `mail` ou `ftp`
Quando a requisição chega ao worker
Então responde 301 para `https://obrareal.com`
```

🟢 Unit: `contrato-infra-e-deploy/`. 🟡 Lista reservada do app é maior que a do worker.

## US-AT-04 — Ser promovido a administrador com segurança

**Como** usuário com permissão, **quero** que a promoção a `super_admin` seja validada no servidor, **para** que nenhum cliente possa escalar privilégio alterando o perfil.

```gherkin
Dado uma escrita em `profiles/<uid>/role='super_admin'`
Quando `syncCustomClaims` executa
Então a fonte canônica `super_admins/<uid>` é consultada
E, sem autorização, o papel é corrigido para `admin` e os tokens são revogados
```

🟢 Units: `contrato-autenticacao-e-claims/`, `api-admin-conta/`. 🟡 `EMAIL_MESTRA` é exceção legada.

## US-AT-05 — Receber papel de RH com escopo limitado

**Como** administrador, **quero** definir módulos e obras permitidas para o RH, **para** limitar o acesso conforme a função.

```gherkin
Dado um perfil com role `rh` e `acessoObras='especificas'`
Quando as claims são sincronizadas
Então `modulosPermitidos`, `acessoObras` e até 50 `obrasPermitidas` são emitidas
```

🟢 Units: `api-admin-cargo/`, `contrato-admin-e-usuarios/`.

## Lacunas

- 🟡 GAP-09: alias `mestre` e `EMAIL_MESTRA` replicados em claims, rules e Storage.
- 🟡 GAP-10: `syncCustomClaims` sem retry explícito.
