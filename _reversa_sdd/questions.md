# Perguntas para Validação — obra-real (gestaodeobras)

> Gerado pelo Revisor em 2026-11-28 · `doc_level = completo` · `answer_mode = file`
> Responda cada pergunta preenchendo o campo **Resposta** e avise quando terminar (digite `reversa`).
> 🔴 = bloqueante (impede escrever comportamento novo) · 🟡 = não bloqueante (afina a spec).
> Processado pelo Revisor em 2026-11-28: 13 respostas recebidas (12 com decisão, 1 sem decisão), 7 pendentes.

---

## Pergunta 1 — 🔴 GAP-01: intenção `consultar_ponto` sem handler

**Contexto:** `functions/index.js:221-223` detecta a intenção `consultar_ponto`, mas `processarMensagem` não tem branch para ela. A detecção está confirmada no código; a resposta não existe.
**Spec afetada:** [`_reversa_sdd/webhook-whatsapp/requirements.md`](webhook-whatsapp/requirements.md) (RF-11), [`_reversa_sdd/contrato-whatsapp/requirements.md`](contrato-whatsapp/requirements.md) (RF-11).
**Pergunta:** Qual deve ser a resposta do bot para `consultar_ponto` — resumo de presença de hoje do remetente, resumo por trabalhador, resumo por período ou mensagem de "intenção não suportada"?
**Impacto:** Define se RF-11 pode virar fluxo completo e quais nós são lidos. Sem decisão, a spec mantém apenas a detecção e o marcador 🔴.


✅ Respondida

**Resposta:** resumo de presença de hoje do remetente

---

## Pergunta 2 — 🔴 GAP-02: `parser-tarefas.js` órfão

**Contexto:** `functions/whatsapp/parser-tarefas.js` implementa prévia → `CONFIRMAR`/`EDITAR`/`CANCELAR`, mas nenhum módulo em `functions/` o importa. O fluxo ativo grava tarefas diretamente (`index.js:312-365`).
**Spec afetada:** [`_reversa_sdd/contrato-whatsapp/design.md`](contrato-whatsapp/design.md), [`_reversa_sdd/webhook-whatsapp/requirements.md`](webhook-whatsapp/requirements.md) (RF-02 do parser marcado `Won't`).
**Pergunta:** O fluxo de prévia/confirmação deve ser ativado no webhook ou declarado permanentemente como "planejado, não ativo" (código órfão)?
**Impacto:** Se ativado, é preciso especificar rascunho, expiração e efeitos; se órfão, a spec não deve gerar código para `CONFIRMAR`/`EDITAR`/`CANCELAR`.


✅ Respondida

**Resposta:** O fluxo de prévia/confirmação deve ser ativado no webhook

---

## Pergunta 3 — 🔴 GAP-03: nó canônico de presença para o relatório diário

**Contexto:** `dailyReport` (`functions/index.js:486`) lê `tenants/<tid>/ponto/<hoje>`, enquanto o bot grava em `tenants/<tid>/presenca` (`index.js:379`). Nenhum dos dois é assumido como canônico pela spec — `presenca` é apenas candidato.
**Spec afetada:** [`_reversa_sdd/job-relatorio-diario/requirements.md`](job-relatorio-diario/requirements.md) (RF-06), [`_reversa_sdd/job-relatorio-diario/tasks.md`](job-relatorio-diario/tasks.md) (T-04), [`_reversa_sdd/contrato-whatsapp/design.md`](contrato-whatsapp/design.md).
**Pergunta:** Qual nó é a fonte canônica de presença para o resumo diário: `presenca`, `ponto/<hoje>` ou outro? O job deve ser ajustado para lê-lo, ou o bot deve passar a gravar nesse nó?
**Impacto:** Define o contrato de leitura do job e destrava US-WB-05. A spec não escolheu unilateralmente `presenca`; permanece bloqueada até a resposta.


✅ Respondida

**Resposta:** presenca

---

## Pergunta 4 — 🔴 GAP-04: `tarefas_pendentes` fora do contrato de rules

**Contexto:** `database.rules.json` declara contrato para o nó raiz `tarefas_pendentes`, mas `parser-tarefas.js` grava em `tenants/<tid>/tarefas_pendentes`. O caminho testado não cobre o caminho real (`domain.md:168`, `permissions.md:126`).
**Spec afetada:** [`_reversa_sdd/trigger-aplicar-aprovacao/requirements.md`](trigger-aplicar-aprovacao/requirements.md) (RF-08), [`_reversa_sdd/api-admin-aprovacao/contracts.md`](api-admin-aprovacao/contracts.md).
**Pergunta:** O nó `tenants/<tid>/tarefas_pendentes` deve passar a existir formalmente com rules próprias, ou deve ser removido em favor da gravação direta em `tarefas`?
**Impacto:** Define a matriz RBAC e se o trigger de aprovação pode aplicar efeitos a rascunhos.


✅ Respondida

**Resposta:** gravação direta em `tarefas`

---

## Pergunta 5 — 🔴 GAP-05: entrega da Graph API sem retry/fila/dead-letter

**Contexto:** `functions/index.js:406-446` envia mensagens e o relatório diário via Graph API v20.0; erros são apenas logados, sem reenvio, fila ou dead-letter (`domain.md:167`).
**Spec afetada:** [`_reversa_sdd/webhook-whatsapp/requirements.md`](webhook-whatsapp/requirements.md) (RF-13), [`_reversa_sdd/job-relatorio-diario/requirements.md`](job-relatorio-diario/requirements.md) (RF-07), [`_reversa_sdd/job-relatorio-diario/design.md`](job-relatorio-diario/design.md).
**Pergunta:** Qual política de confiabilidade adotar: retry com backoff exponencial, fila persistida com reprocessamento, dead-letter apenas para diagnóstico ou combinação dos três? Quantas tentativas e em qual janela?
**Impacto:** Define requisitos não funcionais de entrega e o comportamento do job em falha. A spec não promete retry sem essa decisão.
✅ Respondida — sem decisão (🔴 mantido)

retry com backoff exponencial

## Pergunta 6 — 🟡 GAP-06: `status` × `billingState` divergentes

**Contexto:** `billing.js`, o bot e o painel master escrevem/leem `status` e `billingState` com significados sobrepostos; `hasFeature` usa `billingState`.
⏳ Pendente

**Spec afetada:** [`_reversa_sdd/contrato-billing-e-planos/requirements.md`](contrato-billing-e-planos/requirements.md) (RF-12).
**Pergunta:** `billingState` é a única autoridade para acesso, com `status` mantido apenas como legado de domínio, ou ambos devem ser reconciliados por uma regra de precedência explícita?
**Impacto:** Define RF-12 e a regra de reconciliação do job diário.

**Resposta:** <!-- preencha aqui -->

---

## Pergunta 7 — 🟡 GAP-07: configuração duplicada de CORS/Wrangler/runtime

**Contexto:** `cors.json` e `ALLOWED_ORIGINS` em `worker.js` divergem; existem `wrangler.jsonc` e `cloudflare-worker/wrangler.toml`; `package.json` usa Node 20 e `functions/package.json` usa Node 24.
⏳ Pendente

**Spec afetada:** [`_reversa_sdd/contrato-infra-e-deploy/requirements.md`](contrato-infra-e-deploy/requirements.md) (RF-10), [`_reversa_sdd/contrato-infra-e-deploy/design.md`](contrato-infra-e-deploy/design.md).
**Pergunta:** Qual é a fonte única de verdade para allowlist CORS, configuração do Wrangler e versão do Node? Os arquivos duplicados são intencionais?
**Impacto:** Define RF-10 e o checklist de deploy. Reclassificado de 🔴 para 🟡 na revisão porque a matriz §6 o marca como não bloqueante.

**Resposta:** <!-- preencha aqui -->

---

## Pergunta 8 — 🟡 GAP-08: emulador de Security Rules inoperante

**Contexto:** `tests/security/rules.test.js` são asserções estáticas; o emulador de rules não executa (`docs/security/hardening.md:176-179`).
⏳ Pendente

**Spec afetada:** [`_reversa_sdd/contrato-infra-e-deploy/design.md`](contrato-infra-e-deploy/design.md), [`_reversa_sdd/traceability/code-spec-matrix.md`](traceability/code-spec-matrix.md) §8.
**Pergunta:** Asserções estáticas devem continuar sendo a evidência aceita de autorização, ou o emulador precisa ser reativado antes de considerar as rules testadas?
**Impacto:** Define se a cobertura de rules é 🟢 ou 🟡 nas specs de autorização.

**Resposta:** <!-- preencha aqui -->

---

## Pergunta 9 — 🟡 GAP-09: alias `mestre` e `EMAIL_MESTRA`

**Contexto:** `claims.js`, `database.rules.json` e `storage.rules` replicam o alias `mestre` e o e-mail `tonycampelo@gmail.com`; a fonte canônica declarada é `super_admins/<uid>`.
⏳ Pendente

**Spec afetada:** [`_reversa_sdd/contrato-autenticacao-e-claims/design.md`](contrato-autenticacao-e-claims/design.md), [`_reversa_sdd/user-stories/acesso-e-tenant.md`](user-stories/acesso-e-tenant.md) (US-AT-04).
**Pergunta:** Manter `EMAIL_MESTRA` como exceção legada documentada ou migrar todas as verificações para `super_admins/<uid>` e remover o alias?
**Impacto:** Define a matriz de papéis e a regra de normalização `mestre` → `encarregado`.

**Resposta:** <!-- preencha aqui -->

---

## Pergunta 10 — 🟡 GAP-10: publicação de claims e reservas sem lease curto

**Contexto:** `syncCustomClaims` não tem retry/dead-letter; `admin_ops` depende de retenção de 24 h, sem lease curto para operações presas.
**Spec afetada:** [`_reversa_sdd/trigger-sincronizar-claims/requirements.md`](trigger-sincronizar-claims/requirements.md) (RF-09), [`_reversa_sdd/job-retencao-seguranca/tasks.md`](job-retencao-seguranca/tasks.md).
**Pergunta:** Qual janela de retry/alerta para falha de `setCustomUserClaims` e qual duração de lease para `admin_ops` antes da retomada automática?
**Impacto:** Define disponibilidade da matriz de permissões e a política de reservas operacionais.
⏳ Pendente

**Resposta:** <!-- preencha aqui -->

---

## Pergunta 11 — 🔴 Estoque: transferência e edição não ajustam saldos

**Contexto:** `estoque.module.js:364` grava somente `Transferência (Entrada)` na obra destino e debita a origem, sem creditar `DB.estoque` do destino; a edição no modal unificado não recalcula saldos (`flowcharts/estoque.md:139-141`, `data-dictionary.md:850`).
**Spec afetada:** [`_reversa_sdd/contrato-suprimentos-e-custos/requirements.md`](contrato-suprimentos-e-custos/requirements.md) (RF-10), [`_reversa_sdd/contrato-suprimentos-e-custos/tasks.md`](contrato-suprimentos-e-custos/tasks.md).
**Pergunta:** Corrigir transferência e edição para manter saldo consistente antes da reimplementação, ou registrar como comportamento legado preservationado (bug conhecido)?
**Impacto:** Define se RF-10 vira requisito implementável ou permanece como lacuna bloqueante de estoque.


✅ Respondida

**Resposta:** Corrigir transferência e edição

---

## Pergunta 12 — 🔴 `finApplyPaid` sobrescreve pagamento parcial

**Contexto:** `finApplyPaid` grava `valpago = entry.valor` (total), enquanto `confirmPixPaid` soma `pago + amount` (`flowcharts/financeiro-e-pix.md:98`, `data-dictionary.md:923`).
**Spec afetada:** [`_reversa_sdd/contrato-suprimentos-e-custos/requirements.md`](contrato-suprimentos-e-custos/requirements.md) (RF-11).
**Pergunta:** `finApplyPaid` deve somar ao `valpago` existente, como `confirmPixPaid`, ou a sobrescrita é intencional (pagamento único por lançamento)?
**Impacto:** Define o cálculo de `aPagar` e evita perda de parciais na reimplementação.


✅ Respondida

**Resposta:** `finApplyPaid` deve somar ao `valpago` existente, como `confirmPixPaid`

---

## Pergunta 13 — 🔴 Eventos Kiwify desconhecidos marcados como `success`

**Contexto:** Eventos não reconhecidos pelo webhook recebem `status='success'` sem efeito e sem fila de revisão (`webhook-kiwify/design.md:61`).
**Spec afetada:** [`_reversa_sdd/webhook-kiwify/design.md`](webhook-kiwify/design.md), [`_reversa_sdd/webhook-kiwify/tasks.md`](webhook-kiwify/tasks.md).
**Pergunta:** Eventos desconhecidos devem ir para uma fila de revisão, ser rejeitados com 4xx ou continuar como `success` silencioso?
**Impacto:** Define o destino de eventos não mapeados e a observabilidade do webhook.

✅ Respondida

**Resposta:** Eventos desconhecidos devem ir para uma fila de revisão

---

## Pergunta 14 — 🔴 Relatório de obra sem filtro de papel

**Contexto:** `buildObraReport` (`utils.module.js:1126-1327`) não filtra por papel efetivo, podendo expor dados financeiros a papéis restritos (`user-stories/relatorios-e-evidencias.md:84`).
**Spec afetada:** [`_reversa_sdd/contrato-relatorios-e-fotos/design.md`](contrato-relatorios-e-fotos/design.md), [`_reversa_sdd/user-stories/relatorios-e-evidencias.md`](user-stories/relatorios-e-evidencias.md) (US-RE-02).
**Pergunta:** O relatório deve aplicar `podeModulo`/`acessoObras` e omitir categorias financeiras para papéis sem módulo, ou o relatório é considerado documento irrestrito dentro do tenant?
**Impacto:** Define requisito de segregação e evita vazamento entre papéis.


✅ Respondida

**Resposta:** omitir categorias financeiras para papéis sem módulo

---

## Pergunta 15 — 🟡 Denominador canônico do cálculo de hora extra

**Contexto:** `getPresencaCusto` (`utils.module.js:430-452`) usa `hnorm` como denominador; `calcTotalManual` (`app_core.js:6159-6183`) usa `8`. A divergência está 🟢 confirmada no código; falta decidir qual prevalece.
**Spec afetada:** [`_reversa_sdd/data-dictionary.md`](data-dictionary.md) §43, [`_reversa_sdd/contrato-pessoal-e-presenca/design.md`](contrato-pessoal-e-presenca/design.md).
**Pergunta:** Qual denominador é canônico para `hextra * (diaria / denominador) * 1,5`: `hnorm` gravado ou constante `8`?
**Impacto:** Permite unificar utilitários e formulários sem alterar valores históricos.
⏳ Pendente

**Resposta:** <!-- preencha aqui -->

---

## Pergunta 16 — 🟡 `renderCompras` sem filtro de escopo de obra

**Contexto:** Diferente de almoços, presença e trabalhadores, `renderCompras` não filtra por obra (`flowcharts/compras.md:62`).
**Spec afetada:** [`_reversa_sdd/contrato-suprimentos-e-custos/requirements.md`](contrato-suprimentos-e-custos/requirements.md).
**Pergunta:** Compras devem respeitar `acessoObras`/filtro de obra como as demais entidades, ou a listagem é global ao tenant por decisão comercial?
**Impacto:** Define coerência do RH customizável entre módulos.


✅ Respondida

**Resposta:** Compras devem respeitar `acessoObras`/filtro de obra como as demais entidades

---

## Pergunta 17 — 🟡 Duas normalizações de nome de estoque

**Contexto:** `saveEstoque` usa `normEstoqueNome` local, enquanto `estoque.test.js` cobre `window.normalizarNome`; as implementações são parecidas, mas divergem (`flowcharts/estoque.md:45`).
**Spec afetada:** [`_reversa_sdd/contrato-suprimentos-e-custos/design.md`](contrato-suprimentos-e-custos/design.md).
**Pergunta:** Qual normalização é canônica e a local deve ser removida?
**Impacto:** Evita chaves duplicadas de itens de estoque.


✅ Respondida

**Resposta:** normEstoqueNome

---

## Pergunta 18 — 🟡 Histórico Git com dependências e chave Web pública

**Contexto:** Commits antigos contêm `node_modules` e a chave Web pública do Firebase; `hardening.md:128-131` afirma que não há chave privada versionada (`domain.md:169`, `permissions.md:127`).
**Spec afetada:** [`_reversa_sdd/permissions.md`](permissions.md), `docs/security/hardening.md` (fora de `_reversa_sdd`).
**Pergunta:** O histórico deve ser reescrito para remover esses artefatos ou a exposição é considerada aceitável (chave pública + dependências)?
**Impacto:** Define recomendação de segurança; não altera comportamento de produto.


✅ Respondida

**Resposta:** O histórico deve ser reescrito para remover esses artefatos

---

## Pergunta 19 — 🟡 `dados` do GPT sem validação de schema (Q-01 legado)

**Contexto:** O retorno do GPT-4o-mini é usado diretamente como `.tarefa`/`.ponto` sem validação mínima (`contrato-whatsapp/requirements.md`, `webhook-whatsapp/questions.md` Q-01).
**Spec afetada:** [`_reversa_sdd/contrato-whatsapp/requirements.md`](contrato-whatsapp/requirements.md) (RF-15).
**Pergunta:** Qual schema mínimo obrigatório (`intencao`, `obra`, `tarefa`, `ponto`, `trabalhadores`) e qual resposta quando ele não é satisfeito?
**Impacto:** Define comportamento robusto do fallback LLM sem alterar o fluxo 🟢 confirmado.
⏳ Pendente

**Resposta:** <!-- preencha aqui -->

---

## Pergunta 20 — 🟡 `norm(o.cod)` em `buscarObra` com código numérico

**Contexto:** `buscarObra` chama `.normalize()` sobre `o.cod`; códigos numéricos fazem a chamada falhar e podem derrubar o processamento da mensagem (`domain.md:166`).
**Spec afetada:** [`_reversa_sdd/contrato-whatsapp/requirements.md`](contrato-whatsapp/requirements.md) (RF-08).
**Pergunta:** `buscarObra` deve converter `cod` para string antes de normalizar e tratar códigos numéricos como válidos, ou obras com código numérico são inválidas por regra de negócio?
**Impacto:** Define robustez da resolução de obra no bot.


✅ Respondida

**Resposta:** tratar códigos numéricos como válidos

---

## Regra para o Revisor

✅ Lacunas com decisão registrada (P1–P4, P11–P14, P16–P18, P20) foram reclassificadas para 🟢 nas specs correspondentes.
⏳ P5 (sem decisão) e P6–P10, P15, P19 permanecem 🔴/🟡 pendentes em `gaps.md` e no `confidence-report.md`.
