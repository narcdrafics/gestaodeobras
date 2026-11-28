# ADR 013 — Self-signup com slug e teste gratuito de 30 dias

- **Status:** Aceito (retroativo)
- **Data:** 2026-03-16 a 2026-11-14
- **Confiança:** 🟢 CONFIRMADO

## Contexto

O cadastro exigia intervenção do Master para criar a empresa e escolher o endereço. Isso travava aquisição e criava uma fila de trabalho manual. Era preciso permitir que o próprio usuário escolhesse o slug sem permitir apropriação de endereços de terceiros ou nomes reservados da infraestrutura.

## Decisão

1. No login de conta nova, `promptSlugOnboarding` abre um diálogo com nome e endereço; máquina local `idle | checking | ok | bad` com debounce de 350 ms e `checkSeq` para descartar respostas antigas.
2. `validateSlug`: lowercase, NFD sem acentos, `[^a-z0-9]` removido, 3–30 caracteres; ~35 nomes reservados (infra, páginas do sistema, marca).
3. `isSlugTaken` lê `tenants_public/<slug>` diretamente por chave.
4. `buildAccountUpdates` cria `tenants/<slug>` (`free_trial`, `trialExpiracao = now + 30 dias`, `origem:'self_signup'`, limites iniciais), `tenants_public/<slug>` (branding) e `users/<email>` num único `update()` multi-path.
5. Cancelar o diálogo encerra a sessão e não cria nada; em produção o usuário é redirecionado para o subdomínio com o e-mail preenchido.

## Alternativas consideradas

- 🟡 **Slug gerado automaticamente pelo e-mail**: rejeitado por baixa legibilidade e colisões.
- 🟡 **Aprovação manual do Master para cada slug**: rejeitada — era exatamente o gargalo que se queria eliminar.
- 🟡 **Escrita sequencial dos três nós**: rejeitada — falha parcial deixaria tenant sem branding ou sem passaporte.

## Consequências

- Positivas: onboarding self-service, atomicidade da criação, trial com nível Pro para avaliar features.
- Negativas: cors de nome reservado precisa ser replicado no worker (5 nomes) e no app (~35); sessão não cruza origens.
- Riscos: 🟡 slug é semi-público por design; 🟡 limpeza de tenant exclui também perfis e convites (commit `9fa882e`); 🟡 `trialExpiracao` depende do job de billing para virar `somente_leitura`.

## Evidências

`git log`: `480689f`, `419ae96` (slug pela tela de cadastro), `168e5fe` (race condition), `91de270` (bloqueio de auto-reboarding), `9fa882e` (exclusão de tenant).
Código: `public/js/slug.js`, `public/js/auth_core.js:306-419`, `data-dictionary.md §7`, `docs/plans/features.md:37-52`.
