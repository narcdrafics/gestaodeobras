# Domínio — Obra Real (`gestaodeobras`)

> Gerado pelo **Detetive** na Fase 3 (Interpretação), a partir de `_reversa_sdd/code-analysis.md` (21 módulos), `_reversa_sdd/data-dictionary.md` (117 seções), 21 fluxogramas, `.reversa/context/*.json`, `docs/` e histórico Git.
> `doc_level = completo` · `chat_language = pt-br` · `doc_language = Português`.
> Escala: 🟢 CONFIRMADO (código/rules/teste) · 🟡 INFERIDO (padrão ou documento) · 🔴 LACUNA (contradição ou ausência).

## 1. Glossário

| Termo | Significado no sistema | Origem |
|---|---|---|
| **Tenant / empresa** | Unidade de assinatura e isolamento. ID = slug (`tenants/<slug>`). Dados de cobrança, limites e branding vivem no mesmo nó. | `database.rules.json:30-77`; `data-dictionary.md §1, §86` |
| **Slug** | Endereço público da empresa: `<slug>.obrareal.com`. 3–30 caracteres, `a-z0-9` após normalização NFD, ~35 nomes reservados. Também é a chave de `tenants_public/<slug>`. | `public/js/slug.js:14-48`; `data-dictionary.md §7` |
| **Subdomínio** | Hostname usado como autoridade para detectar o tenant. A feature de plano `subdominio` controla a **personalização**, não a criação do slug. | `docs/plans/features.md:37-52`; `data_core.js:270-289` |
| **Usuário / perfil** | `profiles/<uid>` é a autoridade de papel/tenant; `users/<email>` é passaporte legado; `invites/<email>` é convite. Custom Claims são o espelho usado por Storage Rules e pelo cliente. | `claims.js`; `index.js:680-817`; `docs/security/tenant-isolation.md` |
| **Super Admin (Master)** | Papel global com `tenantId='MASTER_SYSTEM'`. Fonte canônica: `super_admins/<uid>`; exceção histórica: e-mail `tonycampelo@gmail.com`. | `claims.js:26-72`; `docs/security/super-admin.md` |
| **RH com módulos** | Papel cujas permissões são recortadas por `modulosPermitidos` e, opcionalmente, por `acessoObras='especificas'` + até 50 `obrasPermitidas`, propagados via claims. | `cargos.js:16-21`; `index.js:788-806` |
| **Obra** | Unidade física de trabalho, com `status` (`Planejada`, `Em andamento`, `Concluída`, `Pausada`) e escopo de trabalhadores. | `data-dictionary.md §38`; `utils.module.js:1082` |
| **Etapa / frente** | Classificação de tarefas e orçamento; empreiteiro/subetapa é feature de plano. | `docs/plans/features.md:17`; `code-analysis.md` módulo `orcamento` |
| **Tarefa** | Item de trabalho com `status` próprio e `statusEfetivo` derivado (prazo vencido ⇒ `Atrasada`). Pode nascer do WhatsApp, de aprovação ou da UI. | `data-dictionary.md §42-44` |
| **Trabalhador** | Ficha de pessoal com diária, vínculo (`Informal`/...), status (`Ativo`/`Inativo`/`Afastado`) e escopo de obras. | `data-dictionary.md §34` |
| **Presença / ponto** | Registro diário com `Presente`, `Falta` ou `Meio período` e campos de hora extra; base do cálculo de folha. | `functions/index.js:340-394`; `data-dictionary.md §43-44` |
| **Almoço** | Lançamento de vale-refeição com o mesmo quarteto de status de pagamento do financeiro. | `data-dictionary.md §49-52` |
| **Compra** | Pedido com status (`Aguardando`, `Aprovada`, `Pedido Feito`, `Entregue`, `Reprovada`, `Divergência`); dados comerciais ficam em `comprasPrivadas`. | `data-dictionary.md §53-56` |
| **Movimentação de estoque** | Entrada/saída/retorno/transferência aprovada; `saldo` derivado gera `_status` (`SEM ESTOQUE`, `CRÍTICO`, `BAIXO`, `NORMAL`). | `data-dictionary.md §57-59`; `functions/aprovacoes.js` |
| **Orçamento / medição** | Previsão e execução financeira da obra. Fechamentos passam por aprovação; `orcamentoParcial` evita tratar previsão incompleta como estouro. | `utils.module.js:1179-1216`; `data-dictionary.md §64-72` |
| **Financeiro / PIX** | Lançamentos com `Pago`, `Parcial`, `Pendente`, `Atrasado`; `valpago` é validado pelo cliente e revalidado no trigger. PIX/folha é feature do plano Ilimitado. | `docs/plans/features.md:23`; `functions/pix.js` |
| **Aprovação** | Nó `tenants/<tid>/aprovacoes/<id>` com `pendente → aprovado/rejeitado/expirado/erro`; 8 tipos; prazo de 15 dias; efeitos aplicados por trigger transacional. | `functions/aprovacoes.js`; `code-analysis.md` módulo `aprovacoes` |
| **BillingState** | Estado de acesso do tenant: `ativo`, `carencia`, `somente_leitura`, `bloqueado`. Calculado por função pura e aplicado por job diário. | `functions/billing.js:39-175`; `data-dictionary.md §86-89` |
| **Plano / feature** | `free_trial`, `start`, `pro`, `ilimitado` (aliases normalizados). `hasFeature` cruza nível do plano, tenant e `billingState`. | `functions/plan_catalog.js`; `functions/plan_features.js`; `docs/plans/features.md` |
| **Kiwify evento** | Webhook de cobrança com dedup por `orderId + eventType`, `payloadHash` sem status e reserva com lease de 2 min. | `functions/kiwify.js:181-213,227-493` |
| **WhatsApp dedup** | `whatsapp_messages/<msg.id>` reservado por transação antes do processamento; ACK 200 só depois de processar. | `functions/whatsapp_auth.js:158-171`; `docs/security/hardening.md:22-25` |
| **Foto / evidência** | Anexo de tarefa/medição armazenado no Storage sob `tenants/<tid>/`; URL sanitizada antes de virar `src`/`onclick`. | `data-dictionary.md §80`; `code-analysis.md` módulo `fotos` |
| **Claim** | Objeto gravado no Firebase Auth por `syncCustomClaims`; `Storage Rules` só consegue lê-lo (não consulta o RTDB). | `storage.rules:4-6`; `index.js:762-809` |

## 2. Regras de negócio implícitas

### 2.1 Identidade, tenant e acesso

| ID | Regra | Confiança / origem |
|---|---|---|
| RN-001 | O tenant de um usuário é decidido pelo perfil no RTDB, nunca por valor enviado pelo navegador. | 🟢 `docs/security/tenant-isolation.md:1-6`; `database.rules.json:33` |
| RN-002 | Um tenant com `billingState='bloqueado'` perde leitura e escrita; `somente_leitura` permite ler, mas não escrever. | 🟢 `database.rules.json:50-52`; `data-dictionary.md §89` |
| RN-003 | Perfil recém-criado acima do limite de assentos vira `pendente` e recebe claims sem `tenantId`; usuários legados não são punidos pela trava. | 🟢 `index.js:716-720` |
| RN-004 | `bloqueado` revoga tokens imediatamente; `pendente` recebe claims `{role:'pendente', tenantId:null}`. | 🟢 `index.js:706-712` |
| RN-005 | Tentativa de auto-promover a `super_admin` é corrigida no próprio perfil para `admin`, com `cargoAtualizadoPor`, e revoga tokens se antes era master. | 🟢 `index.js:741-758` |
| RN-006 | `users/<email>/role` nunca promove: só preserva uma conta que **já** tinha a claim `super_admin`. | 🟢 `claims.js:52-68` |
| RN-007 | Ordem de confiança para master: allowlist `super_admins/<uid>` → e-mail mestre → migração legada. | 🟢 `claims.js:35-71` |
| RN-008 | RH só acessa um módulo se `modulosPermitidos.<modulo> === true`; com `acessoObras='especificas'`, apenas as até 50 obras listadas. | 🟢 `index.js:788-806`; `database.rules.json:79-128` |
| RN-009 | Papel efetivo nas decisões é o **maior** entre claim e perfil, para que nenhum dos dois desatualizados rebaixe o usuário indevidamente. | 🟢 `aprovacoes-api.js:47,58`; `code-analysis.md:285` |
| RN-010 | APIs administrativas checam método, corpo (16 KB) e cota **antes** de tocar em Auth/RTDB. | 🟢 `abuso.js`; `super_admin.js:358-377` |
| RN-011 | Ações destrutivas exigem reserva em `admin_ops/<requestId>` e auditoria; falha obrigatória de auditoria gera `503 auditoria_falhou`. | 🟢 `auditoria.js`; `super_admin.js:446-468` |
| RN-012 | IP nunca é gravado em claro: `hashIp` usa SHA-256 com salt `obrareal:cargo:`. | 🟢 `abuso.js:33-41` |
| RN-013 | Login em subdomínio encerra sessão quando `perfil.tenantId !== CURRENT_TENANT_ID` e o usuário não é super_admin. | 🟢 `auth_core.js:396-402` |
| RN-014 | A sessão do Firebase não atravessa origens: novo tenant em produção é redirecionado para `<slug>.obrareal.com/login.html` com e-mail preenchido. | 🟢 `auth_core.js:411-419`; `slug.js:96-99` |
| RN-015 | `tenants_public/<slug>` é lido por chave, nunca com `orderByChild`, para impedir enumeração de clientes. | 🟢 `docs/security/tenants-public.md:24-37` |

### 2.2 Cobrança e plano

| ID | Regra | Confiança / origem |
|---|---|---|
| RN-016 | `billingState` é calculado por função pura: `MASTER_SYSTEM` → trial (30 dias + 7 de somente_leitura) → pago (carência 3/5 + 7 de somente_leitura) → bloqueio. | 🟢 `billing.js:39-137`; `code-analysis.md:1434,1460` |
| RN-017 | O job diário grava `billingState`, motivo e timestamp, mas **não** atualiza `status` — os dois campos podem divergir. | 🟢 `data-dictionary.md:1346` |
| RN-018 | `hasFeature` retorna `false` para feature desconhecida ou tenant bloqueado; caso contrário compara nível do plano. | 🟢 `plan_features.js:104-109` |
| RN-019 | `free_trial` tem nível Pro, mas PIX/folha continua exclusivo do Ilimitado. | 🟢 `docs/plans/features.md:27-29` |
| RN-020 | Planos desconhecidos caem em `free_trial` — comportamento seguro. | 🟢 `docs/plans/features.md:33-35` |
| RN-021 | Slug é criado para **todos** os planos; a feature `subdominio` vale apenas para alteração/personalização. | 🟢 `docs/plans/features.md:37-52` |
| RN-022 | Kiwify: chave canônica de dedup é `orderId + eventType`, sem `order_status`; `payloadHash` ignora status. | 🟢 `kiwify.js:296-301`; `docs/security/hardening.md:36-40` |
| RN-023 | Evento travado tem lease de 2 min e é reprocessável; status terminal é `success`, `pending_tenant`/`failed` são retomáveis. | 🟢 `kiwify.js:181-213,451-463` |
| RN-024 | `cancelamentoAgendado` não desbloqueia tenant com `status='bloqueado_pagamento'`. | 🟢 `code-analysis.md:1455` |
| RN-025 | Janela de até 24 h entre vencimento e o job pode defasar `billingState` e banners do estado calculado. | 🟢 `code-analysis.md:1488` |

### 2.3 Aprovação e efeitos

| ID | Regra | Confiança / origem |
|---|---|---|
| RN-026 | Apenas `encarregado`, `engenheiro` e `rh` têm escrita desviada para aprovação; `admin`/`comprador` escrevem direto. | 🟢 `code-analysis.md:304` |
| RN-027 | Ponto, fotos, tarefas e almoços **não** passam por aprovação. | 🟢 `code-analysis.md:304` |
| RN-028 | Prazo é 15 dias; alertas em 7, 12 e 15 dias com dedupe por `alertas`. | 🟢 `functions/aprovacoes.js`; `code-analysis.md:297` |
| RN-029 | Decisão é gravada por transação (concorrência ⇒ `409 ja_decidida`); aplicação tem reserva própria, retomada após 10 min pelo job. | 🟢 `code-analysis.md:288` |
| RN-030 | `podeAplicar` revalida decisor e autoridade **no momento da aplicação**, não apenas na decisão. | 🟢 `code-analysis.md:289` |
| RN-031 | Falha de aplicação vira `status='erro'`, `motivo` (≤500), `falhaEm` e notifica admins. | 🟢 `code-analysis.md:293` |
| RN-032 | RH decide apenas se `modulosPermitidos.aprovacoes === true` **e** o módulo do tipo estiver habilitado; engenheiro só `movimentacao_estoque` e exige `notificarAdmin`. | 🟢 `code-analysis.md:286` |
| RN-033 | Compras aprovadas separam campos comerciais em `comprasPrivadas`; engenheiro/encarregado/mestre não constam nas regras desse nó. | 🟢 `code-analysis.md:301`; `data-dictionary.md §53` |
| RN-034 | Auditoria de aprovação serializa `antes`/`depois` com limite de 4000 caracteres; notificações são replicadas por destinatário para as rules autorizarem leitura individual. | 🟢 `code-analysis.md:302` |

### 2.4 Cálculos de obra e folha

| ID | Regra | Confiança / origem |
|---|---|---|
| RN-035 | Status de tarefa `Atrasada` é **derivado** em leitura quando `prazo < getTodayBR()`; nunca é gravado no banco. | 🟢 `data-dictionary.md §44-45`; `tests/tarefas-dashboard.test.js` |
| RN-036 | Semana de presença e almoço começa na segunda-feira (`getDay()===0` ⇒ `-6`). | 🟢 `code-analysis.md:624,709`; commits `f4d8424` |
| RN-037 | Diária recalculada: `Falta → 0`; `Meio período → diária/2`; vínculo `Informal → diária`; com horas extras `diária + hextra*(diária/8)*1,5`. | 🟢 `code-analysis.md:541,628` |
| RN-038 | Mudança na diária do trabalhador dispara **recalculo retroativo** de presenças ainda não pagas. | 🟢 commit `1ab48d9`; `code-analysis.md:541` |
| RN-039 | Saldo de folha = `soma(presenca.total) - soma(financeiro.real)` com `source='pre'`, `forn=nome`, `status='Pago'`. | 🟢 `code-analysis.md:538` |
| RN-040 | `valpago`: `Pago → real>0 ? real : prev`; `Parcial` mantém o digitado (limitado ao total) e mostra "Falta Pagar"; `Pendente`/`Atrasado → 0`. | 🟢 `code-analysis.md:974,979` |
| RN-041 | `finDerivedStatus`: vazio → `Pendente`; todos pagos → `Pago`; algum pagamento parcial → `Parcial`; algum atrasado → `Atrasado`. | 🟢 `code-analysis.md:976` |
| RN-042 | Em orçamento, `pago = valorRealizado` se `Pago`, `min(jaPago, valorRealizado)` se `Parcial`, `0` nos demais; `aPagar = max(0, valorRealizado - pago)`. | 🟢 `data-dictionary.md:1230` |
| RN-043 | Compras nunca entram em `realizado`; aparecem apenas em `pendencias`. | 🟢 `data-dictionary.md:1230` |
| RN-044 | `orcamentoParcial` (cobertura ≤ 50%) mostra cobertura em vez de "% do orçamento" e não dispara `is-over`. | 🟢 `code-analysis.md:1281`; `utils.module.js:1198-1207` |
| RN-045 | Vale-refeição devido = `max(0, vtotal - pago)`, com `Pago → 0`. | 🟢 `data-dictionary.md §49` |
| RN-046 | `estoqueStatus` é derivado: `saldo<=0 → SEM ESTOQUE`; `<=min → CRÍTICO`; `<=min*1,5 → BAIXO`; senão `NORMAL`. | 🟢 `code-analysis.md:869` |
| RN-047 | Escopo de trabalhadores: array vazio ⇒ nenhum; ausência de `obras` ⇒ legado irrestrito; não-array ⇒ irrestrito; caso contrário, interseção com as obras permitidas. | 🟢 `code-analysis.md:523` |
| RN-048 | Dashboard prioriza alertas `TAREFA*` (máx. 8 slots) e não gera `SEM PRESENÇA HOJE` aos domingos. | 🟢 `code-analysis.md:1274`; `data-dictionary.md:1184` |

### 2.5 WhatsApp, fotos e infraestrutura

| ID | Regra | Confiança / origem |
|---|---|---|
| RN-049 | Defesa em camadas do webhook: HMAC do corpo cru → origem WABA → dedup transacional → autorização → estado → allowlist de URL de mídia → ACK 200 após processar. | 🟢 `code-analysis.md:1544` |
| RN-050 | Telefone do remetente precisa casar com `users` ou `telefonesPermitidos`; correspondência ambígua entre tenants é rejeitada (fail-closed). | 🟢 `docs/security/hardening.md:20-21` |
| RN-051 | O bloqueio por cobrança do bot reusa `billingState` (`bloqueado`/`somente_leitura`), sem regra paralela. | 🟢 `data-dictionary.md:1568` |
| RN-052 | Busca de obra no bot: exata (nome/código/`_id`) → contém → fuzzy 0,3, filtrando status ativo/em andamento/planejada/execução. | 🟢 `code-analysis.md:1550` |
| RN-053 | Áudios são transcritos por Whisper; intenções locais `lancar_ponto`/`criar_tarefa`/`consultar`, com GPT-4o-mini como fallback. | 🟢 `data-dictionary.md:1612`; `functions/index.js` |
| RN-054 | Em produção o hostname é autoridade; `?tenant=` só funciona em localhost/web.app/firebaseapp.com. | 🟢 `data_core.js:270-289` |
| RN-055 | Worker bloqueia 5 subdomínios reservados e redireciona para `obrareal.com`; o app bloqueia ~35 nomes na escolha de slug. | 🟢 `worker.js:16`; `slug.js:21-29` |
| RN-056 | Assets do worker são cacheados 1 h; HTML nunca é cacheado. | 🟢 `worker.js:131-136` |
| RN-057 | `deploy.yml` publica somente Hosting; functions/rules/segredos exigem deploy manual pela CLI. | 🟢 `docs/security/hardening.md:141-156` |
| RN-058 | Retenção: auditoria 90 dias, dedup/reservas 24 h, cotas 2 h. | 🟢 `retencao.js:11-16` |
| RN-059 | CORS do Storage e `ALLOWED_ORIGINS` do worker devem ser atualizados em conjunto. | 🟢 `docs/security/cors.md:17` |
| RN-060 | COOP `same-origin-allow-popups` é obrigatório para o popup do Firebase Auth. | 🟢 `docs/security/cors.md:47-49` |

## 3. Constantes e enums de negócio

| Constante | Valor | Significado |
|---|---|---|
| `TRIAL_MS` / `TRIAL_READONLY_DAYS` | 30 / 7 dias | Teste gratuito e janela de somente_leitura |
| `PAID_GRACE_DAYS` / `PAID_READONLY_DAYS` | 5 / 7 dias | Carência e janela de somente_leitura após vencimento |
| `PRAZO_APROVACAO_DIAS` / `DIAS_ALERTA` | 15 / `[7,12,15]` | SLA de aprovação e avisos |
| `RESERVA_STALE_MS` | 600.000 ms (10 min) | Retomada da aplicação presa |
| `LIMITE_AUDIO` | 8 MB | Tamanho máximo de áudio do WhatsApp |
| `LIMITE_BODY` | 16 KB | Corpo máximo das APIs administrativas |
| `MAX_OBRAS_RH` | 50 | Teto de `obrasPermitidas` nas claims de RH |
| `PRECO_*` | Start 69,90 / Pro 105,90 / Ilimitado 299,00 | Preços exibidos em `public/js/plans.js` 🟢 |
| `EMAIL_MESTRA` | `tonycampelo@gmail.com` | Exceção histórica de super_admin 🟡 |
| Fuso | `America/Sao_Paulo` | Jobs e cálculos de data 🟢 |

**Enums de estado mais relevantes** (detalhes e transições em [`state-machines.md`](state-machines.md)):

- `billingState`: `ativo` · `carencia` · `somente_leitura` · `bloqueado`.
- `profiles.status`: `ativo` · `pendente` · `bloqueado`; `role`: `admin`, `rh`, `engenheiro`, `encarregado`, `comprador`, `super_admin`, `pendente`, `bloqueado` (+ alias legado `mestre`).
- Aprovação: `pendente` · `aprovado` · `rejeitado` · `expirado` · `erro`.
- Tarefa: `A fazer` · `Em andamento` · `Concluída` · `Atrasada` (derivado) · `Pausada` (+ `Pendente` legado).
- Pagamento (financeiro/almoco): `Pago` · `Parcial` · `Pendente` · `Atrasado`.
- Compra: `Aguardando` · `Aprovada` · `Pedido Feito` · `Entregue` · `Reprovada` · `Divergência`.
- Presença: `Presente` · `Falta` · `Meio período`.
- Obra: `Planejada` · `Em andamento` · `Concluída` · `Pausada`.
- Kiwify evento: `processing` · `success` · `pending_tenant` · `failed`.
- WhatsApp dedup: `processing` · `done` · `rejected`.

## 4. Invariantes de integridade

1. **Nenhuma decisão de acesso vem do cliente** — papel e tenant são reconfirmados no RTDB/allowlist e propagados por claims assinadas (🟢).
2. **Campos protegidos são imutáveis para não-master**: `profiles.uid/email/role/tenantId/status`, `users.uid/role/tenantId`, `invites.tenantId`, `tenants.plano/planoVencimento/status/billingState` (🟢 `database.rules.json`).
3. **Toda escrita sensível é transacional ou auditada**: convite (`usos`), voto de aprovação, reserva de evento, reserva de webhook, reserva destrutiva (🟢).
4. **Nós de sistema não são graváveis pelo cliente**: `admin_audit`, `admin_ops`, `rate_limits`, `billing_events`, `webhook_debug`, `whatsapp_messages`, `super_admins` (🟢).
5. **Todo objeto sob `tenants/<tid>/` exige `profiles/<uid>/tenantId === $tenantId`** (com exceções documentadas de leitura de `billingState`) (🟢).
6. **Storage só confia em claims** — revogação imediata depende de `revokeRefreshTokens` em todos os caminhos de mudança (🟢).
7. **Nenhum segredo chega ao navegador** — `defineSecret`/Secret Manager (🟢).
8. **Efeitos financeiros e de estoque só existem após aprovação** quando o papel do autor exige desvio (🟢).

## 5. Lacunas e contradições

- 🔴 Fato: `consultar_ponto` é detectada no bot (`index.js:221-223`) mas não tem branch em `processarMensagem`. 🟢 Decisão P1: responder com resumo de presença de hoje do remetente.
- 🔴 Fato: `parser-tarefas.js` (prévia → `CONFIRMAR`/`EDITAR`/`CANCELAR`) não é importado pelo fluxo ativo. 🟢 Decisão P2: ativar no webhook; gravação direta em `tarefas` (P4).
- 🔴 Fato: `dailyReport` lê `tenants/<tid>/ponto/<hoje>` enquanto o bot grava em `presenca`. 🟢 Decisão P3: `presenca` é o nó canônico (ajuste pendente).
- 🔴 `norm(o.cod)` chama `.normalize()` em código numérico de obra e pode derrubar o processamento.
- 🔴 Erros da Graph API são apenas logados: sem retry, fila ou dead-letter.
- 🔴 Fato: `tarefas_pendentes` tem contrato de rules na raiz, mas o parser grava em `tenants/<tid>/tarefas_pendentes`. 🟢 Decisão P4: nó removido, gravação direta em `tarefas`.
- 🔴 Histórico Git antigo contém `node_modules` e chave Web pública sem reescrita.
- 🟡 `status` e `billingState` divergem após transições automáticas de cobrança.
- 🟡 `mestre` segue aceito como alias em Storage/RTDB embora a claim canônica seja `encarregado`.
- 🟡 `EMAIL_MESTRA` é exceção espelhada em várias rules; removê-la exige deploy coordenado.
- 🟡 `deploy.yml` não roda testes e não publica functions/rules.
- 🟡 Node 20 na raiz × Node 24 em `functions/`, duas configs Wrangler e `FIREBASE_URL` fixo.
- 🟡 Emulador de rules falha (`demo-gestaodeobras`); as asserções estáticas são substituto temporário.
- 🟡 `syncCustomClaims` engole erro de `getUser` e não tem retry.
- 🟡 `admin_ops` só é limpo pelo job de 24 h, sem lease curto como o da Kiwify.

**Próximo artefato:** [`state-machines.md`](state-machines.md) · [`permissions.md`](permissions.md) · [`adrs/`](adrs/)
