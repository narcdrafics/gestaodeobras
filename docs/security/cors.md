# CORS restrito (SaaS)

Este repositório tinha dois pontos com CORS aberto (`*`):

| Arquivo | Antes | Depois |
| --- | --- | --- |
| `cors.json` (Firebase Storage) | `origin: ["*"]`, métodos `PUT`/`DELETE` | origens de `*.obrareal.com` + `controle-obras-c889d.web.app`, sem `PUT`/`DELETE` |
| `cloudflare-worker/worker.js` | `Access-Control-Allow-Origin: *` em toda resposta | origens da allowlist, `Vary: Origin`, preflight tratado |

## Origens permitidas

- `https://obrareal.com` e `https://www.obrareal.com`
- Qualquer subdomínio: `https://<tenant>.obrareal.com`
- `https://controle-obras-c889d.web.app`
- `https://controle-obras-c889d.firebaseapp.com`

Para adicionar uma origem, atualize **os dois** arquivos: `cors.json` e a lista `ALLOWED_ORIGINS` em `cloudflare-worker/worker.js`.

## Aplicar no Firebase Storage

O Firebase CLI não aplica CORS de bucket. Use `gcloud` ou `gsutil` com credenciais do projeto:

```bash
gcloud storage buckets update gs://controle-obras-c889d.firebasestorage.app --cors-file=cors.json
# ou, com gsutil:
gsutil cors set cors.json gs://controle-obras-c889d.firebasestorage.app
```

> Se o projeto ainda usar o bucket legado, aplique também em `gs://controle-obras-c889d.appspot.com`.
> Confirme com: `gcloud storage buckets describe gs://controle-obras-c889d.firebasestorage.app --format="value(cors_config)"`

## Publicar o worker

```bash
cd cloudflare-worker
wrangler deploy
```

## Observações

- **Por que remover `PUT`/`DELETE` do Storage?** A aplicação usa apenas upload (`POST`/resumável) e leitura (`GET`) via Firebase SDK. Exclusões do SDK usam `POST`/form-data, não `DELETE`.
- **Uploads grandes (>5 MB)**: o SDK do Firebase usa upload resumável em chunks (`PUT`). Se o app passar a enviar arquivos grandes, adicione `PUT` de volta em `cors.json` — as origens continuam restritas.
- **Não use `*`**: com `Access-Control-Allow-Credentials`, `*` é inválido e, sem credenciais, permite que qualquer site leia respostas autenticadas do bucket.
- O worker **não** bloqueia a requisição de origens externas (o proxy continua sendo um proxy); ele apenas **não concede** CORS. O bloqueio efetivo é feito pelo browser.

## Testes

`tests/security/cors.test.js` cobre a lógica do worker:

```bash
npx vitest run
```
