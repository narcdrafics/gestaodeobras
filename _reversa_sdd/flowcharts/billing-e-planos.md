# Fluxograma — Módulo `billing-e-planos`

> 🟢 CONFIRMADO — `functions/billing.js` (`calcularBillingState` 39–137; `atualizarBillingStatesJob` 145–175), `functions/kiwify.js` (`validateKiwifySignature` 11–29; `identifyTenant` 40–105; `mapProductToPlan` 112–140; `reservarEvento` 181–213; `handleKiwifyWebhook` 227–493), `functions/plan_catalog.js:30-161`, `functions/plan_features.js:16-136`, `functions/super_admin.js:248-337`, `functions/kiwify_api.js:1-279`, `functions/index.js:541-685,819-859,920-929`, `public/js/data_core.js:100-268,376-455,645-659`, `public/js/plan_features.js`, `public/js/plans.js:13-115`, `public/js/app_core.js:290-346,4436-4543,4603-4729,5365-5474`, `database.rules.json:30-77,211-233`, `tests/security/billing.test.js`, `tests/plan-features.test.js`, `tests/kiwify.test.js`, `tests/kiwify-idempotency.test.js`, `tests/super-admin.test.js`.

## 1. Visão geral

```mermaid
flowchart TD
    A[Checkout Kiwify] -->|external_reference=tenantId| B[kiwifyWebhook]
    B --> C[valida HMAC-SHA1 do rawBody]
    C -- invalido --> C1[401 + webhook_debug sem PII]
    C -- valido --> D[identifica tenant: reference/slug/email]
    D --> E[reserva billing_events/orderId/eventType]
    E -- duplicado/conflito --> E1[200 already_processed ou 409 conflict]
    E -- sem tenant --> E2[202 pending_tenant]
    E -- reservado --> F[efeitos por evento]
    F --> G[update atomico tenant + marca success]
    H[adminAccountApi / painel master] --> I[definir_plano / definir_limites / bloquear_tenant]
    J[dailyBillingStateJob 04:00 America/Sao_Paulo] --> K[calcularBillingState por tenant]
    K --> L{billingState mudou?}
    L -- sim --> M[grava billingState + motivo + timestamp]
    G & I & M --> N[tenants/<id>/billingState]
    N --> O[database.rules.json: leitura/escrita condicionadas]
    N --> P[renderBillingEnforcement no cliente]
    P --> Q[applyFeatureGates + hasFeature/requireFeature]
    Q --> R[showUpgradeModal -> startKiwifyCheckoutFor]
    R --> A
```

🟢 Existem **três autoridades** distintas e complementares: o webhook da Kiwify (eventos de pagamento), o painel master (ajustes manuais) e o job diário (recalculo de estado). 🟢 A interface apenas reflete o estado — `renderBillingEnforcement` e `applyFeatureGates` são experiência de uso; as rules do RTDB são quem bloqueia escrita/leitura (`data_core.js:136-137`, `tests/security/billing.test.js:1-3`). 🟢 O checkout reenvia o `tenantId` como `external_reference` para fechar o ciclo (`plans.js:88-109`).

## 2. `calcularBillingState` — máquina de estados

```mermaid
flowchart TD
    A[calcularBillingState tenantData, agora, tenantId] --> B{tenantId = MASTER_SYSTEM<br/>ou role = super_admin?}
    B -- sim --> Z1[ativo / master_system]
    B -- nao --> C{status = bloqueado_pagamento<br/>ou bloqueado?}
    C -- sim --> Z2[bloqueado / motivoBloqueio<br/>ou billingStateMotivo ou bloqueio_manual]
    C -- nao --> D{plano = free_trial?}
    D -- sim --> E[trialExpiracao ou webhookCriacao + 30 dias]
    E --> F{agora < expiracao?}
    F -- sim --> Z3[ativo / trial_vigente + diasRestantes]
    F -- nao --> G{agora - expiracao <= 7 dias?}
    G -- sim --> Z4[somente_leitura / trial_expirado]
    G -- nao --> Z5[bloqueado / trial_encerrado]
    D -- nao --> H[vencimento = planoVencimento; carenciaAte]
    H --> I{carenciaAte > 0 e<br/>futuro ou vencimento passou?}
    I -- sim --> J{agora <= carenciaAte?}
    J -- sim --> Z6[carencia / carencia_webhook]
    J -- nao --> K[inicioLeitura = carenciaAte]
    I -- nao --> L{vencimento <= 0?}
    L -- sim --> Z7[ativo / sem_vencimento]
    L -- nao --> M{agora < vencimento?}
    M -- sim --> Z8[ativo / plano_vigente]
    M -- nao --> N{agora <= vencimento + 5 dias?}
    N -- sim --> Z9[carencia / vencido_em_carencia]
    N -- nao --> K2[inicioLeitura = vencimento + 5 dias]
    K & K2 --> O{agora <= inicioLeitura + 7 dias?}
    O -- sim --> Z10[somente_leitura / carencia_expirada]
    O -- nao --> Z11[bloqueado / inadimplente]
```

🟢 Precedência documentada em `billing.js:26-32`: MASTER_SYSTEM → bloqueio forçado → trial → plano pago. 🟢 `carenciaAte` tem precedência sobre os 5 dias genéricos porque o webhook grava 3 dias em cancelamento (`billing.js:88-91`; `tests/security/billing.test.js:112-121`). 🟢 Um `carenciaAte` obsoleto após renovação **não** bloqueia (`billing.js:133-139`). 🟢 Sem vencimento confiável o sistema fail-open para `ativo` (`billing.js:101-105`) — decisão de segurança para não trancar contas legadas. 🟢 Constantes: `TRIAL_READONLY_DAYS=7`, `PAID_GRACE_DAYS=5`, `PAID_READONLY_DAYS=7`, `MS_DIA=86400000` (`billing.js:17-20`). 🟡 O estado `carencia` não é recalculado para `ativo` se o pagamento chegar sem webhook até o job diário (janelas de até 24h).

## 3. Job diário de recálculo

```mermaid
flowchart TD
    A[dailyBillingStateJob: every day 04:00<br/>America/Sao_Paulo] --> B[atualizarBillingStatesJob getDatabase]
    B --> C[db.ref tenants.once value]
    C --> D[para cada tid/tData]
    D --> E[tData nao e objeto?] -- sim --> D
    E -- nao --> F[calcularBillingState tData, agora, tid]
    F --> G[estadoAtual = tData.billingState || ativo]
    G --> H{estadoAtual != calculo.billingState?}
    H -- nao --> D
    H -- sim --> I[updates tenants/tid/billingState<br/>+ Motivo + AtualizadoEm]
    I --> J[log transicao estadoAtual -> novo]
    D --> K[existem updates?]
    K -- sim --> L[db.ref().update multi-path unico]
    K -- nao --> M[log Concluido 0/N]
    L --> M
```

🟢 O job grava **apenas transições**, preservando `motivo` e timestamp de quando mudou (`billing.js:159-166`). 🟢 `tenantId` da chave do RTDB é a fonte confiável para isentar `MASTER_SYSTEM` (`billing.js:155-156`). 🟡 O job não importa `diasRestantes` para o nó do tenant — ele existe só no retorno da função pura, usado em testes/UI client-side.

## 4. Webhook da Kiwify — autenticação e idempotência

```mermaid
flowchart TD
    A[POST /kiwifyWebhook] --> B{metodo POST?}
    B -- nao --> B1[401 + debug sem payload]
    B -- sim --> C{rawBody Buffer e assinatura em<br/>?signature= ou x-kiwify-signature?}
    C -- nao --> C1[401 motivo: token ausente / sem assinatura / HMAC invalido]
    C -- sim --> D[HMAC-SHA1 timingSafeEqual]
    D --> E{order_id presente?}
    E -- nao --> E1[400 Missing order_id]
    E -- sim --> F[identifyTenant]
    F --> F1[external_reference / tracking src,sck,utm_source / query]
    F1 --> F2{existe em tenants?}
    F2 -- sim --> G[tenantId]
    F2 -- nao --> F3[existe tenants_public/slug/tenantId?]
    F3 -- sim --> G
    F3 -- nao --> F4[emailAdmin -> profile -> invites por email]
    F4 --> F5{encontrou?}
    F5 -- sim --> G
    F5 -- nao --> H[tenantId null]
    G --> I[eventRef = billing_events/orderId/eventType]
    H --> I
    I --> J[payloadHash SHA256 sem order_status/status]
    J --> K[reservarEvento transaction]
    K --> L{jaProcessado?}
    L -- sim --> M{status success e<br/>hash/tenant divergentes?}
    M -- sim --> M1[409 conflict_ignored]
    M -- nao --> M2[200 already_processed]
    L -- nao --> N{tenantId encontrado?}
    N -- nao --> N1[202 pending_tenant; reavaliavel]
    N -- sim --> O[processa evento]
```

🟢 Assinatura é validada sobre **rawBody íntegro** e aceita query ou header (`kiwify.js:245-269`); `crypto.timingSafeEqual` evita comparação temporal (`kiwify.js:11-25`). 🟢 Rejeições gravam em `webhook_debug` com `incluirPayload: false`, sem PII arbitrária (`kiwify.js:151-168`). 🟢 A chave de idempotência é `orderId + eventType`; `order_status` é volátil entre entregas e por isso removido do hash (`kiwify.js:288-301`). 🟢 `pending_tenant` e `failed` são **não terminais**: podem ser retomados quando o comprador cria a conta (`kiwify.js:196-198`, `kiwify.js:337-355`). 🟢 Lease `processing` expira em 2 minutos e pode ser retomado (`kiwify.js:199-200`). 🟡 A busca por e-mail percorre todos os tenants e profiles — custo O(n) por evento sem `tenantId` (`kiwify.js:76-102`).

## 5. Webhook — efeitos por evento

```mermaid
flowchart TD
    A[evento reservado com tenantId] --> B{order_status paid<br/>ou order_approved<br/>ou subscription_renewed?}
    B -- sim --> C[mapProductToPlan: produto + anual -> plano do catalogo]
    C --> D[atualiza plano, status ativo, billingState ativo,<br/>billingStateMotivo pagamento_aprovado,<br/>planoVencimento = ago + dias do catalogo,<br/>origemAtivacao kiwify, limites, ultimoPagamento]
    D --> E[limpa carenciaAte e motivoBloqueio]
    B -- nao --> F{refunded / chargedback<br/>order_refunded / chargeback?}
    F -- sim --> G[status bloqueado_pagamento, billingState bloqueado,<br/>motivo chargeback ou reembolso, dataBloqueio, ultimoPagamento]
    F -- nao --> H{subscription_canceled?}
    H -- sim --> I{vencimentoAtual > agora?}
    I -- sim --> J[cancelamentoAgendado=true; mantem ativo<br/>se nao havia bloqueio anterior]
    I -- nao --> K[billingState carencia por 3 dias<br/>via carenciaAte]
    H -- nao --> L{subscription_late ou refused?}
    L -- sim --> M[billingState carencia por 5 dias<br/>avisoCarencia; ultimoPagamento]
    L -- nao --> N[evento sem efeito de plano]
    D & E & G & J & K & M & N --> O[update atomico:<br/>tenant + billing_events status success]
    O -- falha --> P[remove reserva para retry]
    O -- sucesso --> Q[webhook_debug + 200 processed]
```

🟢 Produto e frequência (`anual` no nome, `frequency=yearly`) mapeiam para o catálogo canônico; vencimento usa o carimbo `agora` persistido na reserva, então retries não presentam dias extras (`kiwify.js:357-393`). 🟢 Um cancelamento agendado **não desbloqueia** chargeback/reembolso anterior (evento fora de ordem) (`kiwify.js:418-422`). 🟢 Efeitos no tenant e marca final `success` acontecem na mesma escrita multi-path: se falha, nada é aplicado e a reserva é liberada (`kiwify.js:448-477`). 🟡 Eventos desconhecidos são marcados `success` sem alterar o tenant — não há fila de "não reconhecido" para revisão. 🟡 `chargeAmount` usa `Commissions.charge_amount / 100` com fallback `order_value` (`kiwify.js:360`).

## 6. Enforcement de quantidade e subdomínio (server-side)

```mermaid
flowchart TD
    A[onValueWritten tenants/tid/obras] --> B[enforceGrowthLimit campo limiteObras]
    C[onValueWritten tenants/tid/usuarios] --> D[enforceGrowthLimit campo limiteUsuarios]
    B & D --> E{quantidadeDepois <= quantidadeAntes?}
    E -- sim --> F[permitido: remocao/edicao]
    E -- nao --> G{tenant tem config?}
    G -- nao --> F
    G -- sim --> H[limite = config/campo normalizado]
    H --> I{limite >= 9999?}
    I -- sim --> F
    I -- nao --> J{quantidadeDepois > limite?}
    J -- sim --> K[transaction: volta ao beforeVal<br/>ou aborta se antes vazio]
    J -- nao --> F
    L[profiles/uid escrito] --> M[aplicarLimiteDeAssentos]
    M --> N[ativos = profiles do tenant<br/>excluindo pendentes e o proprio uid]
    N --> O{ativos >= limiteUsuarios + 1?}
    O -- sim --> P[status pendente + claims role pendente, tenantId null]
    O -- nao --> Q[role preservado]
    R[onValueWritten subdominioSlug / config/slug] --> S{depois vazio ou igual ao tenantId?}
    S -- sim --> T[permitido: slug inicial]
    S -- nao --> U{hasFeature subdominio no plano?}
    U -- sim --> T
    U -- nao --> V[reverte para antes ou tenantId]
    V --> W[remove tenants_public/slug se pertence ao tenant]
```

🟢 O enforcement roda no Admin SDK, então vale também para escritas diretas via SDK/DevTools que ignoram as rules (`index.js:541-545`). 🟢 Ausência de metadado cai em `LIMITE_FALLBACK=1`, nunca 0 nem ilimitado (`index.js:548-554`). 🟢 Reversão preserva registros legados: desfaz só a escrita que estourou a cota e aborta se não há estado anterior seguro (`index.js:568-578`). 🟢 Assentos contam o dono separadamente (`limiteUsuarios + 1`) e perfis pendentes não recebem claims (`index.js:603-640`). 🟢 Slug inicial igual ao `tenantId` é permitido a todos; troca posterior exige feature `subdominio` (nível 2) (`index.js:652-678`). 🟡 `enforceGrowthLimit` cobre `obras` e `usuarios`, mas não `trabalhadores`/`medicao` — o limite de trabalhadores do catálogo não é aplicado por trigger equivalente.

## 7. Matriz de features e gates no cliente

```mermaid
flowchart TD
    A[window.OBRA_FEATURES.hasFeature nome, plano, contexto] --> B{nome existe na matriz?}
    B -- nao --> C[false]
    B -- sim --> D{contexto.billingState = bloqueado?}
    D -- sim --> C
    D -- nao --> E[nivelDoPlano plano >= feature.nivel]
    E -- sim --> F[true]
    E -- nao --> C
    G[applyFeatureGates root] --> H[querySelectorAll data-feature]
    H --> I{hasFeature?}
    I -- sim --> J[remove feature-locked / aria-disabled / title]
    I -- nao --> K[feature-locked + aria-disabled + title<br/>rotulo — disponivel no plano X]
    L[click em data-feature-locked=1<br/>fase de captura] --> M[preventDefault + stopPropagation]
    M --> N[showUpgradeModal nome]
    O[requireFeature nome] --> P{hasFeature?}
    P -- sim --> Q[true]
    P -- nao --> N
    N --> R[populateUpgradeModal: nome, descricao, plano necessario]
    R --> S[startKiwifyCheckoutFor]
```

🟢 A matriz autoritativa está em `functions/plan_features.js`; o espelho browser em `public/js/plan_features.js` é validado por `tests/plan-features.test.js`. 🟢 Níveis: 0 = sem acesso, 1 = Start, 2 = Pro/`free_trial` (prévia), 3 = Ilimitado (`plan_features.js:8-12`). 🟢 Features: `empreiteiro.subetapa` e `perfis.usuario` nível 1; `relatorio.marca`, `exportacao`, `relatorio.whatsapp.diario`, `subdominio` nível 2; `pix.folha` nível 3 (`plan_features.js:37-73`). 🟢 `billingState === 'bloqueado'` revoga todas as features mesmo com plano alto (`plan_features.js:104-109`). 🟢 O clique é interceptado em **fase de captura** para impedir `onclick` legado (`app_core.js:319-326`). 🟡 `hasFeature` no cliente usa `currentPlan()` vindo de `DB.plano`; se o tenant estiver bloqueado mas o `billingState` isolado ainda não tiver chegado, a checagem depende do fallback local.

## 8. Painel master — plano, limites e bloqueio manual

```mermaid
flowchart TD
    A[adminAccountApi POST /api/admin/conta] --> B[handleAdminRequest: verifica Firebase ID token]
    B --> C{acao}
    C -- definir_plano --> D[normalizarPlanoAdmin + diasDoPlano + limitesDoPlano]
    D --> E[update atomico: plano, planoVencimento, status ativo,<br/>billingState ativo, motivo ajuste_manual_master,<br/>origemAtivacao painel_master, limites]
    E --> F[limpa carenciaAte, motivoBloqueio,<br/>dataBloqueio, cancelamentoAgendado,<br/>dataCancelamento, avisoCarencia]
    F --> G{plano free_trial?}
    G -- sim --> H[trialExpiracao = vencimento]
    C -- definir_limites --> I[limitesDoPlano plano + ajustes]
    I --> J[config/limiteObras, limiteUsuarios, limiteTrabalhadores]
    C -- bloquear_tenant --> K{bloqueado = true?}
    K -- sim --> L[status bloqueado_pagamento; billingState bloqueado;<br/>motivo bloqueio_manual_master; dataBloqueio]
    K -- nao --> M[status ativo; billingState ativo;<br/>motivo liberacao_manual_master]
    C -- leitura Kiwify --> N[kiwify_api: account/products/sales/webhooks<br/>token OAuth em cache]
```

🟢 `acaoDefinirPlano` é a única via manual que redefine vencimento **e** limites juntos, limpando todo resíduo de carência/bloqueio (`super_admin.js:267-308`). 🟢 `acaoDefinirLimites` mescla ajustes com os limites do plano e nunca aceita 0/negativo/NaN (`plan_catalog.js:116-137`). 🟢 `acaoStatusTenant` aplica bloqueio imediato, sem depender do job (`super_admin.js:310-328`). 🟢 O cliente não grava campos protegidos: `PROTECTED_TENANT_FIELDS` e `PROTECTED_CONFIG_FIELDS` os removem do update (`data_core.js:645-659`). 🟡 A edição manual de limites pode ultrapassar o catálogo até 9999; isso é intencional (ajuste comercial), mas não gera trilha de approval além do log da ação.

## 9. Regras do RTDB — autoridade de acesso

```mermaid
flowchart TD
    A[cliente lê tenants/tid] --> B{super_admin ou<br/>emailAdmin/profile do tenant?}
    B -- nao --> C[negado]
    B -- sim --> D{billingState != bloqueado?}
    D -- nao --> C1[leitura completa negada no no tenant]
    D -- sim --> E[leitura permitida]
    F[cliente lê tenants/tid/billingState] --> G{super_admin ou<br/>emailAdmin/profile do tenant?}
    G -- sim --> H[leitura isolada permitida mesmo bloqueado]
    G -- nao --> C
    I[cliente escreve no tenant/colecoes] --> J{super_admin?}
    J -- sim --> K[permitido]
    J -- nao --> L{billingState em<br/>somente_leitura ou bloqueado?}
    L -- sim --> M[negado]
    L -- nao --> N[permitido conforme role/modulosPermitidos]
    O[cliente altera plano / planoVencimento / limites / billingState] --> P{super_admin?}
    P -- nao --> Q[.validate nega: so mesmo valor ou free_trial na criacao]
    P -- sim --> K
    R[billing_events / webhook_debug] --> S{super_admin?}
    S -- nao --> T[.write false / leitura restrita]
    S -- sim --> U[leitura de auditoria]
```

🟢 `billingState` tem `.read` próprio e isolado justamente para a tela de bloqueio funcionar (`database.rules.json:50-52`). 🟢 `.validate` congela `plano`, `planoVencimento`, `trialExpiracao`, `status`, `billingState` e limites para o cliente; somente super_admin (via Admin SDK/painel) altera (`database.rules.json:38-72`). 🟢 Quase todas as coleções filhas repetem a guarda `billingState !== 'somente_leitura' && !== 'bloqueado'` — a trava é transversal (`database.rules.json:79-130`). 🟢 `webhook_debug` e `billing_events` são somente leitura para super_admin (`.write: false`) — o webhook escreve com Admin SDK (`database.rules.json:211-233`). 🟡 O e-mail `tonycampelo@gmail.com` está codificado como super_admin em várias rules; é um mecanismo de escape legado fora do fluxo de claims.

## 10. Experiência do usuário — banners e tela de bloqueio

```mermaid
flowchart TD
    A[_onFirebaseValue / billingStateRef.on value] --> B[renderBillingEnforcement data]
    B --> C[guarda window.__lastBillingData]
    C --> D{super_admin ou MASTER_SYSTEM?}
    D -- sim --> E[IS_READONLY_MODE=false; esconde tela e banner]
    D -- nao --> F[state = data.billingState<br/>ou calcularEstadoBillingLocal]
    F --> G{state = bloqueado?}
    G -- sim --> H[IS_READONLY_MODE=true; mostra screen-blocked]
    H --> I{plano free_trial?}
    I -- sim --> J[Periodo de Testes Encerrado]
    I -- nao --> K[Assinatura Suspensa]
    G -- nao --> L{state = somente_leitura?}
    L -- sim --> M[IS_READONLY_MODE=true; banner Somente Leitura<br/>botao Reativar Plano]
    L -- nao --> N{state = carencia?}
    N -- sim --> O[IS_READONLY_MODE=false; banner Aviso de Cobrança<br/>botao Regularizar Pagamento]
    N -- nao --> P[IS_READONLY_MODE=false; sem banner]
    J & K --> Q[escolhe plano -> checkout Kiwify]
    M & O --> Q
```

🟢 O cliente calcula um fallback com as mesmas janelas (30+7 / 5+7) para resposta imediata enquanto o job não roda (`data_core.js:100-129`). 🟢 A tela de bloqueio preserva os dados e oferece reativação, sem logout intrusivo (`data_core.js:131-137`). 🟢 `tenants/<tid>/billingState` é assinado separadamente (`billingStateRef`) porque a leitura completa do tenant falha quando bloqueado (`data_core.js:380-404`). 🟢 Troca de página reaplica o estado via `window.__lastBillingData` (`data_core.js:142-143`). 🟡 O fallback client-side difere do servidor em caso sem `trialExpiracao`: retorna `ativo` no cliente, enquanto o servidor usa `webhookCriacao + 30 dias` (`data_core.js:105-107`; `billing.js:60-62`).
