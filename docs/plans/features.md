# Recursos por plano

Matriz única de capacidades. Implementação:

- autoridade no backend: `functions/plan_features.js`;
- espelho no navegador: `public/js/plan_features.js`;
- paridade verificada por `tests/plan-features.test.js`.

O frontend usa `window.hasFeature(nome)` (definido em `public/js/data_core.js`) e as
Cloud Functions usam `hasFeature(nome, plano, tenant)` do módulo back. Um tenant com
`billingState === 'bloqueado'` perde todas as features, independente do plano.

## Matriz

| Recurso (`nome`) | Start | Pro | Ilimitado | Onde aparece |
| --- | :---: | :---: | :---: | --- |
| `empreiteiro.subetapa` — Controle por empreiteiro e subetapa | ✅ | ✅ | ✅ | Orçamento, medições e tarefas |
| `perfis.usuario` — Perfis de usuário | ✅ | ✅ | ✅ | Administração → usuários |
| `relatorio.marca` — Relatório com marca (white-label) | — | ✅ | ✅ | Administração → identidade visual; Relatórios |
| `exportacao` — Exportação de imagem/backup | — | ✅ | ✅ | Compartilhar (topo), Hoje, Dashboard |
| `relatorio.whatsapp.diario` — Relatório diário no WhatsApp | — | ✅ | ✅ | Cloud Function `dailyReport` |
| `subdominio` — Subdomínio personalizado | — | ✅ | ✅ | Administração → subdomínio |
| `pix.folha` — PIX e folha de pagamento | — | — | ✅ | Financeiro → Fechar Folha / Pagar via PIX |

Preços: Start **R$ 69,90/mês**, Pro **R$ 105,90/mês**, Ilimitado **R$ 299,00/mês**
(`public/js/plans.js`). Links de checkout: Start `hHQz2Zu`, Pro `d0Gfv34` e
Ilimitado `z2hLFKq` na Kiwify. O período de teste (`free_trial`) tem nível Pro para que o
usuário possa avaliar os módulos antes de assinar; PIX/folha continua exclusivo do
Ilimitado.

## Aliases de plano

`normalizarPlano()` converte `start_anual`, `pro_anual`, `premium`, `full`,
`full_anual`, `ilimitado_anual`, `master`, `MASTER_SYSTEM` etc. para um dos níveis
acima. Planos desconhecidos caem em `free_trial` (comportamento seguro).

## Subdomínio: distinção importante

- O **slug de cadastro** (`tenants/<slug>` + `tenants_public/<slug>` criados em
  `public/js/slug.js`) continua existindo para **todos** os planos: ele é o ID do
  tenant e o endereço de acesso inicial. Bloqueá-lo impediria o cadastro.
- A feature `subdominio` controla a **personalização/alteração** desse endereço
  (`updateSubdomainSlug()`), permitida somente a partir do Pro.

Enforcement em três camadas:

1. UI: `data-feature="subdominio"` + cadeado e modal de upgrade.
2. Firebase Rules: `.validate` em `tenants/$id/subdominioSlug` e
   `tenants/$id/config/slug` aceita apenas o slug original (igual ao tenantId) ou
   planos Pro+.
3. Cloud Functions: `enforceSubdomainPlan` reverte escritas indevidas feitas via
   Admin SDK/DevTools e remove o nó público criado sem permissão.

## Pontos de checagem no backend

- `dailyReport` (`functions/index.js`): só envia para tenants com
  `hasFeature('relatorio.whatsapp.diario', plano, tenant)`.
- `enforceSubdomainPlan` (`functions/index.js`): aplica `hasFeature('subdominio', ...)`.
- Limites numéricos de obras/usuários continuam em `enforceObrasLimit` /
  `enforceUsuariosLimit` e são complementares, não substituídos por flags.
