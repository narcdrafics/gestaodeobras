# ADR 001 — Isolamento multi-tenant por subdomínio com slug como ID

- **Status:** Aceito (retroativo)
- **Data:** 2026-03-16 a 2026-11-23
- **Confiança:** 🟢 CONFIRMADO (código + rules + commits)

## Contexto

O sistema nasceu como uma aplicação single-tenant. A evolução para SaaS exigiu responder três perguntas: como identificar a empresa, como impedir que um usuário de A veja dados de B e como dar a cada empresa um endereço próprio sem duplicar deploys. Havia sessões persistentes e um nó público de branding consultado com `orderByChild`, que listava todas as empresas.

## Decisão

1. O **slug** é o ID do tenant: `tenants/<slug>` e `tenants_public/<slug>` usam a mesma chave.
2. O **hostname é a autoridade** em produção. `detectSubdomain()` ignora `?tenant=` em `obrareal.com`/`*.obrareal.com`; o parâmetro só existe para localhost/web.app/firebaseapp.com.
3. Um **Cloudflare Worker** faz proxy transparente de `*.obrareal.com` para `controle-obras-c889d.web.app`, preservando a URL original e repassando `X-Forwarded-Host`.
4. O `tenantId` do perfil no RTDB é comparado com o tenant da rota; divergência força `signOut()`.
5. `tenants_public/<slug>` é lido por chave direta — sem `orderByChild` — para não enumerar clientes.

## Alternativas consideradas

- 🟡 **Banco de dados por tenant**: descartada pelo custo operacional e pela impossibilidade de consultas agregadas do Master.
- 🟡 **Tenant apenas por parâmetro de query**: descartada por permitir troca de contexto sem troca de origem e vazar slugs por URL.
- 🟡 **Sessão compartilhada entre origens**: impossível com cookies/sessão do Firebase; o login redireciona para o subdomínio com e-mail preenchido.

## Consequências

- Positivas: deploy único, isolamento reforçado por rules, branding antes do login sem enumeração.
- Negativas: lista de subdomínios reservados divergente (5 no worker, ~35 no app); `FIREBASE_URL` fixo no worker; mudança de origem exige novo login.
- Risco: 🔴 se um dia as rules permitirem `orderByChild` em `tenants_public`, a enumeração volta.

## Evidências

`git log`: `6145caa` multi-tenant public routing + CORS, `e639d53` worker proxy, `168e5fe` race condition no slug, `9da0301`/`c04c17f` tenant isolation, `419ae96`/`480689f` onboarding do slug, `dd0ea21` isolamento estrito.
Código: `public/js/data_core.js:269-294`, `public/js/slug.js:14-140`, `cloudflare-worker/worker.js:1-143`, `docs/security/tenants-public.md`.
