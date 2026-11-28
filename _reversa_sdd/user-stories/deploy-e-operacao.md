# User Stories — Deploy e operação

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `flowcharts/infra-e-deploy.md`, `ADR-014`, `docs/security/hardening.md`.

## US-DO-01 — Publicar o front automaticamente

**Como** desenvolvedor, **quero** que um push em `main` publique o Hosting, **para** entregar rapidamente a interface.

```gherkin
Dado um push em `main`
Quando `deploy.yml` executa
Então o channel `live` do Firebase Hosting é publicado
E functions, rules e segredos **não** são publicados
```

🟢 Unit: `contrato-infra-e-deploy/`.

## US-DO-02 — Rodar testes antes de publicar

**Como** desenvolvedor, **quero** que push e PR rodem a suíte de testes, **para** evitar regressões.

```gherkin
Dado um push ou PR em `main`/`master`
Quando `test.yml` executa
Então `npm install` e `npm test -- --run` rodam com Node 20
```

🟢 Unit: `contrato-infra-e-deploy/`.

## US-DO-03 — Acessar a API pelo rewrite correto

**Como** usuário, **quero** que `/api/*` chegue às funções, **para** usar webhooks e APIs administrativas sem conhecer URLs do Cloud Functions.

```gherkin
Dado a rota `/api/admin/aprovacao`
Quando o Hosting recebe a requisição
Então o rewrite encaminha para `decidirAprovacaoApi`
```

🟢 Units: `contrato-infra-e-deploy/`, `api-admin-aprovacao/`.

## US-DO-04 — Navegar por subdomínio com segurança

**Como** cliente, **quero** abrir minha instância pelo subdomínio, **para** não precisar escolher tenant.

```gherkin
Dado o hostname `minhaempresa.obrareal.com`
Quando o worker processa
Então faz proxy preservando `X-Forwarded-Host`
E aplica CORS por allowlist com `Vary: Origin`
```

🟢 Units: `contrato-infra-e-deploy/`, `contrato-tenants-e-slug/`.

## US-DO-05 — Aplicar checklist de deploy manual

**Como** operador, **quero** seguir um checklist para functions, rules, segredos, worker e CORS, **para** não deixar front novo com back antigo.

```gherkin
Dado uma mudança em functions ou rules
Quando o merge é publicado
Então executo `firebase deploy --only functions:...,database:rules,hosting`
E verifico logs de `auditoria_falhou` e do job de retenção
```

🟢 Unit: `contrato-infra-e-deploy/`. 🔴 `deploy.yml` não cobre esses artefatos.

## US-DO-06 — Evitar enumeração de tenants

**Como** cliente, **quero** que meu slug não permita listar outros clientes, **para** preservar confidencialidade.

```gherkin
Dado uma leitura de `tenants_public/<slug>`
Quando a chave não existe
Então a leitura falha sem `orderByChild`
```

🟢 Unit: `contrato-tenants-e-slug/`.

## Lacunas

- 🟡 GAP-07: CORS, Wrangler e versões de Node duplicados/divergentes (reclassificado na revisão).
- 🟡 Emulador de rules inoperante; evidência é asserção estática.
- 🟡 `FIREBASE_URL` e `projectId` fixos dificultam promoção entre projetos.
