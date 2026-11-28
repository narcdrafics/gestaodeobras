# ADR 007 — `tenants_public` indexado por slug, sem enumeração

- **Status:** Aceito (retroativo)
- **Data:** 2026-03-16 a 2026-11-23
- **Confiança:** 🟢 CONFIRMADO

## Contexto

O branding do subdomínio (logo, nome, tema) precisa ser lido **antes do login**. A implementação original punha `.read: true` no nó pai e o cliente usava `orderByChild('slug')` — qualquer visitante podia listar todas as empresas cadastradas.

## Decisão

1. A chave do nó público é o próprio slug: `tenants_public/<slug>`.
2. Não existe `.read` no nó pai; leitura direta só em `$slug` (`orderByChild` é impossível).
3. `.validate` exige `slug === $slug` e `tenantId` não vazio.
4. `.write` exige super_admin, o próprio tenant (por `tenantId` ou chave legada) ou criação por usuário autenticado no self-signup.
5. Script de migração reconstrói o nó a partir de `tenants`, após o deploy das rules e antes de divulgar subdomínios.

## Alternativas consideradas

- 🟡 **Manter `.read: true` e filtrar no cliente**: rejeitado — o dado já teria saído do servidor.
- 🟡 **Busca via Cloud Function com autorização**: rejeitado por exigir cold start numa etapa de branding pré-login.

## Consequências

- Positivas: branding sem login e sem vazamento de lista de clientes; chave igual à do tenant simplifica a criação atômica.
- Negativas: slugs passam a ser semi-públicos por construção (quem sabe o slug lê o branding).
- Riscos: 🟡 é obrigatório manter a leitura por chave em todo o cliente — um `orderByChild` reintroduz o problema; 🟡 migração é manual e depende de service account local.

## Evidências

`git log`: `6145caa`, `ed78cc3`, `168e5fe`, `dd0ea21`.
Código: `database.rules.json:162-170`, `public/js/slug.js:108-140`, `docs/security/tenants-public.md`, `scripts/migrar-tenants-public.js`.
