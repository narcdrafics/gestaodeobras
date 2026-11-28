# Obra Real

SaaS multi-tenant para gestão profissional de obras. Versão atual: **1.4.0**.

## Funcionalidades

- Autenticação Firebase (e-mail/senha, Google e recuperação de senha), com perfis e permissões por empresa.
- Onboarding com slug próprio (`<slug>.obrareal.com`), checagem de disponibilidade e painel do Super Admin.
- Gestão de obras, tarefas, pessoal, presença, almoços, estoque, compras, medições e orçamento.
- Evidências fotográficas, relatórios e dashboard.
- Cobrança via webhook Kiwify, com planos, limites e feature flags.
- Automação via WhatsApp Business (webhook com validação de assinatura, deduplicação e allowlist de remetentes).

## Arquitetura

| Camada | Tecnologia | Local |
| --- | --- | --- |
| Frontend (SPA) | HTML/CSS/JS estático | `public/` |
| Servidor local | Node.js 20 + Express (serve apenas `public/`) | `server.js` |
| Backend | Firebase Functions (Node.js 24) com Admin SDK | `functions/` |
| Dados | Firebase Auth, Realtime Database e Storage | `database.rules.json`, `storage.rules` |
| Proxy de subdomínios | Cloudflare Worker | `cloudflare-worker/` |
| Testes | Vitest + jsdom | `tests/` |

Projeto Firebase padrão: `controle-obras-c889d` (ver `.firebaserc`).

## Como executar

Pré-requisitos: Node.js 20 na raiz e Node.js 24 em `functions/`. Para deploy, Firebase CLI e Wrangler.

```bash
npm install
npm start          # servidor local em http://localhost:8080
npm test           # suíte Vitest
```

Para executar as Cloud Functions localmente:

```bash
cd functions
npm install
npm run serve      # emulador do Firebase
```

## Deploy

```bash
firebase deploy                          # Hosting + Functions + rules
firebase deploy --only functions
cd cloudflare-worker && wrangler deploy  # proxy dos subdomínios
```

Segredos (Meta, Kiwify etc.) são gerenciados via Secret Manager e nunca devem ser
commitados. Consulte `docs/security/hardening.md` antes de alterar webhooks,
regras de segurança ou CSP.

## Documentação

- `CHANGELOG.md` — histórico de versões.
- `docs/security/` — isolamento entre tenants, Super Admin, hardening, billing e CORS.
- `docs/wiki/` — base de conhecimento, incluindo o bot de WhatsApp.
- `_reversa_sdd/` — arquitetura, ADRs, specs, fluxogramas e rastreabilidade.
- `cloudflare-worker/README.md` — configuração do proxy de subdomínios.
