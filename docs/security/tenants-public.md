# `tenants_public` sem enumeração de clientes

O nó `tenants_public` existe para resolver o branding do subdomínio **antes do login**
(logo, nome e tema). Antes, ele tinha `.read: true` no nó pai e era consultado com
`orderByChild('slug')`, o que permitia listar todos os slugs/nomes de empresas sem
autenticação.

## Modelo atual

A chave do nó público é o próprio **slug**:

```json
"tenants_public": {
  "construtoraabc": {
    "slug": "construtoraabc",
    "tenantId": "construtoraabc",
    "nomeEmpresa": "Construtora ABC",
    "esquemaCores": "emerald",
    "logoUrl": ""
  }
}
```

Regras (`database.rules.json`):

- Não existe `.read` no nó pai → **não é possível listar** `tenants_public`.
- `.read: true` apenas em `$slug` → leitura direta `tenants_public/{slug}`.
- `.validate` exige `slug === $slug` e `tenantId` string não vazia.
- `.write` exige `super_admin`, o próprio tenant (pelo `tenantId` ou pela chave legada)
  ou criação de um novo nó por usuário autenticado (self-signup).

O cliente nunca usa `orderByChild`/`equalTo` em `tenants_public`; sempre lê/escreve a
chave direta:

```js
firebase.database().ref(`tenants_public/${slug}`).once('value');
```

## Migração de dados legados

Bancos antigos podem ter o nó público chaveado pelo **ID do tenant** (que pode diferir
do slug). Como a leitura anônima por slug precisa da chave correta, rode a migração uma
vez:

```bash
node scripts/migrar-tenants-public.js
```

O script reconstrói `tenants_public/{slug}` a partir de `tenants` (fonte da verdade),
usando o slug mais recente do nó público legado/`subdominioSlug`/`config.slug`, remove a
chave legada `tenants_public/{tenantId}` e apaga chaves órfãs. Ele também normaliza
`config/slug` e `subdominioSlug` para o mesmo valor. Usa o Admin SDK
(`functions/serviceAccountKey.json` ou credenciais padrão do ambiente), portanto ignora
as Security Rules.

> Rode a migração **após** o deploy das regras e **antes** de divulgar os subdomínios.
> Sem ela, um tenant cujo slug difere do ID pode não resolver o branding antes do login.

## O que continua público

Apenas os campos de branding daquele slug específico (`nomeEmpresa`, `esquemaCores`,
`logoUrl`, `slug`, `tenantId`). Não há dados financeiros, usuários, obras ou limites de
plano nesse nó.

## Testes

`tests/security/rules.test.js` cobre:

- ausência de `.read`/`.indexOn` no nó pai;
- leitura apenas em `$slug`;
- validação `slug === $slug` + `tenantId`;
- ausência de consultas `orderByChild` no cliente;
- movimentação do nó público ao renomear o slug.
