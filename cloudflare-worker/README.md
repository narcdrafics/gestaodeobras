# Cloudflare Worker — Wildcard Subdomain

Faz proxy transparente de `*.gestaodeobras.com.br` para o Firebase Hosting, sem expor o domínio do Firebase ao usuário.

---

## Pré-requisitos

- Node.js instalado
- Domínio `obrareal.com` gerenciado pelo **Cloudflare** (nameservers apontando para a Cloudflare)
- Conta Cloudflare (plano Free é suficiente para até 100k req/dia)

---

## Passo 1 — Instalar o Wrangler CLI

```bash
npm install -g wrangler
```

## Passo 2 — Autenticar

```bash
wrangler login
```
Abrirá o navegador para autenticar com sua conta Cloudflare.

## Passo 3 — Configurar `wrangler.toml`

Abra o `wrangler.toml` e confirme que o `zone_name` está correto:

```toml
routes = [
  { pattern = "obrareal.com/*", zone_name = "obrareal.com" },
  { pattern = "*.obrareal.com/*", zone_name = "obrareal.com" }
]
```

## Passo 4 — Fazer Deploy

Dentro da pasta `cloudflare-worker/`:

```bash
wrangler deploy
```

## Passo 5 — Testar localmente (opcional)

```bash
wrangler dev
```
Abrirá um servidor local para testar sem fazer deploy.

---

## Como funciona o roteamento

```
construtoraabc.gestaodeobras.com.br
        ↓  (Cloudflare intercepta)
    Worker extrai slug = "construtoraabc"
        ↓  (proxy transparente)
    controle-obras-c889d.web.app
        ↓  (app JS lê window.location.hostname)
    carrega tenant "construtoraabc"
```

O usuário sempre vê `construtoraabc.obrareal.com` na barra de endereços.

---

## Subdomínios reservados

Os seguintes subdomínios são redirecionados ao domínio raiz:

- `www` → `obrareal.com`
- `admin` → `obrareal.com`
- `api` → `obrareal.com`
- `mail`, `ftp` → `obrareal.com`

Para adicionar mais, edite `RESERVED_SUBDOMAINS` em `worker.js`.

---

## Verificar se está funcionando

Após o deploy, acesse qualquer subdomínio:

```
https://teste.obrareal.com
```

Se o app carregar (mesmo que mostre tenant não encontrado), o Worker está funcionando.

---

## Atualizar o Worker

```bash
# Na pasta cloudflare-worker/
wrangler deploy
```
