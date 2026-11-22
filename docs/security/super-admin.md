# Painel Super Admin — controle de contas e integração Kiwify

O painel Master (`public/pages/super_admin.html`) concentrava apenas a edição de
empresas e a listagem de logs. A gestão sensível passou a ser feita por um
endpoint único do Cloud Functions, com Admin SDK:

```
POST /api/admin/conta   -> ações (body: { acao, ...dados })
GET  /api/admin/conta   -> ?tipo=products|sales|account|webhooks  (leitura da Kiwify)
```

O rewrite está em `firebase.json` e a função é `adminAccountApi`
(`functions/index.js` → `functions/super_admin.js`).

## Modelo de autorização

1. O navegador envia o **Firebase ID token** no header `Authorization: Bearer <token>`.
2. `verificarSuperAdmin()` verifica o token com `auth.verifyIdToken()` — não
   confia em papel/claims vindos do cliente.
3. O papel é reconfirmado no banco: `profiles/<uid>/role === 'super_admin'` **e**
   `users/<email com '.' → ','>/role === 'super_admin'`. O e-mail legado
   `tonycampelo@gmail.com` continua autorizado.
4. Contas desabilitadas no Firebase Auth recebem `403 conta_bloqueada`.

Toda ação grava um registro em `admin_audit` (sucesso ou falha). As regras do
RTDB permitem **leitura apenas para Super Admin** e proíbem escrita pelo cliente.

## Ações disponíveis

| `acao` | Efeito |
|--------|--------|
| `reset_password` | Gera link via `auth.generatePasswordResetLink`. O link volta somente na resposta autenticada e **nunca** entra em `admin_audit`. |
| `bloquear_usuario` | `auth.updateUser({disabled})`, `revokeRefreshTokens` ao bloquear e `profiles/<uid>/status = bloqueado`. |
| `excluir_usuario` | Remove perfil, passaporte global, convite e vínculo com o tenant; chama `auth.deleteUser`. |
| `definir_limites` | Mescla limites do catálogo com ajustes manuais (`obras`, `usuarios`, `trabalhadores`). |
| `definir_plano` | Ajusta plano, validade, limites e reinicia `billingState` — 0/negativo/NaN são ignorados. |
| `bloquear_tenant` | Define `status`/`billingState` da empresa; bloqueio derruba o acesso ao tenant. |

O frontend usa `definir_plano`/`definir_limites` somente quando há mudança real.
Editar apenas nome ou slug **não altera a validade do plano**.

Perfis com `status === 'bloqueado'` são impedidos no login e têm a sessão aberta
encerrada pelo observador em `public/js/auth_core.js`. O trigger
`syncCustomClaims` também revoga tokens e não emite claims para esses perfis.

## Configurando as credenciais da API da Kiwify

> `KIWIFY_TOKEN` é o segredo do **webhook** (`/api/kiwify`). Ele **não** serve
> para a API REST e não deve ser reutilizado aqui.

### Onde encontrar as credenciais no painel da Kiwify

Entre na dashboard da Kiwify e vá em **Apps → API → Criar API Key**. Na janela
gerada aparecem três valores:

- `client_id`
- `client_secret` ← mostrado uma vez; guarde em local seguro
- `account_id` ← o mesmo valor usado no header `x-kiwify-account-id`

Não existe um "API token" fixo para copiar nessa tela. O `client_secret` é a
chave usada para gerar o `access_token` (Bearer) em `POST /v1/oauth/token`.
Por isso a **Opção A** abaixo é a correta para o painel: a própria Cloud
Function gera e renova o Bearer token em memória.

> O `token` de **Webhook** (usado em `KIWIFY_TOKEN`, em Apps → Webhooks) é a
> chave de assinatura das notificações. Ele **não** autentica a API REST.

### Configurando no Firebase

```bash
# Opção A — OAuth (recomendada; é o que o painel espera)
firebase functions:secrets:set KIWIFY_CLIENT_ID
firebase functions:secrets:set KIWIFY_CLIENT_SECRET
firebase functions:secrets:set KIWIFY_ACCOUNT_ID

# Opção B — só para teste: colar um access_token já gerado
# curl -X POST https://public-api.kiwify.com/v1/oauth/token \
#   -H 'Content-Type: application/x-www-form-urlencoded' \
#   -d 'client_id=...&client_secret=...'
# O access_token vem em "access_token" e expira em 86400s (24h).
firebase functions:secrets:set KIWIFY_API_TOKEN
firebase functions:secrets:set KIWIFY_ACCOUNT_ID

firebase deploy --only functions:adminAccountApi,database:rules,hosting
```

- `KIWIFY_ACCOUNT_ID` é obrigatório nos dois casos (header `x-kiwify-account-id`).
- `KIWIFY_API_TOKEN`, se usado, precisa ser renovado a cada 24h — prefira a Opção A.
- O token OAuth fica em cache em memória da função; segredos nunca são
  devolvidos ao navegador.
- Sem credenciais, o GET responde `200 { ok: true, configurado: false }` e o
  painel mostra o catálogo local como referência — nenhum erro é disparado.
- `GET ?tipo=sales` usa por padrão os últimos 30 dias; o servidor limita o
  intervalo a 90 dias (resolução da API).

## Catálogo único

`functions/plan_catalog.js` é a fonte server-side de limites/validade/checkout.
`public/js/plans.js` mantém o espelho usado pela landing e pelo checkout.
`functions/kiwify.js` usa `planoPorProduto()` para casar produtos da Kiwify com
os planos Start / Pro / Ilimitado (incluindo variantes anuais e `Full`).

## Verificação local

```bash
npm test              # 404 testes, incluindo tests/super-admin.test.js
npx vitest run tests/super-admin.test.js
```

Os testes usam fakes de Auth/RTDB/HTTP: não chamam a Kiwify nem o Firebase reais.

## Erros comuns após publicar o front

| Sintoma | Causa | Correção |
|---------|-------|----------|
| `404` em `/api/admin/conta` | rewrite publicado sem a função (ou deploy só de Hosting) | `firebase deploy --only functions:adminAccountApi,hosting` |
| `permission_denied at /admin_audit` | regras antigas em produção — o nó `admin_audit` ainda não existe lá | `firebase deploy --only database:rules` |
| `[Checkout] Plano desconhecido: full_anual` | versão antiga de `public/js/plans.js` em cache | publicar Hosting e invalidar cache (o alias já é tratado no checkout) |
| `configurado: false` na Kiwify | segredos ausentes na função | ver a seção de segredos acima e redeploy da função |
