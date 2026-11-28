# Relatório de Confiança — obra-real (gestaodeobras)

> Atualizado pelo Revisor em 2026-11-28 · `doc_level = completo` · 26 units revisadas · 94 arquivos de unit lidos (78 canônicos + 16 opcionais)
> `answer_mode = file`: 13 respostas em [`questions.md`](questions.md) (12 com decisão, P5 sem decisão), 7 pendentes (P6–P10, P15, P19). Lacunas consolidadas em [`gaps.md`](gaps.md).

---

## Resumo Geral

| Nível | Quantidade | Percentual |
|-------|-----------:|-----------:|
| 🟢 CONFIRMADO | 1594 | 83,2% |
| 🟡 INFERIDO | 201 | 10,5% |
| 🔴 LACUNA | 122 | 6,4% |
| **Total** | **1917** | 100% |

**Confiança geral:** 88,4% (`(1594 + 201 × 0,5) / 1917 = 88,4%`). Antes do reprocessamento: 83,3% (1482 🟢 / 203 🟡 / 216 🔴 = 1901).

A contagem considera os marcadores nas 26 pastas de unit (`requirements.md`, `design.md`, `tasks.md` e opcionais). Marcadores em artefatos globais (flowcharts, dictionary, matrizes, user stories) não entram no total para evitar dupla contagem das mesmas afirmações. O total passou de 1901 para 1917 porque cada decisão humana foi registrada explicitamente nas specs afetadas, com ressalva quando o código ainda diverge.

---

## Por Spec

| Spec | 🟢 | 🟡 | 🔴 | Confiança |
|------|---:|---:|---:|---:|
| `api-admin-aprovacao/` | 77 | 13 | 5 | 87,9% |
| `api-admin-cargo/` | 72 | 10 | 6 | 87,5% |
| `api-admin-conta/` | 77 | 12 | 6 | 87,4% |
| `api-admin-criar-usuario/` | 63 | 4 | 7 | 87,8% |
| `contrato-admin-e-usuarios/` | 41 | 5 | 2 | 90,6% |
| `contrato-aprovacoes/` | 42 | 3 | 3 | 90,6% |
| `contrato-autenticacao-e-claims/` | 43 | 4 | 5 | 86,5% |
| `contrato-billing-e-planos/` | 88 | 22 | 2 | 88,4% |
| `contrato-infra-e-deploy/` | 69 | 27 | 10 | 77,8% |
| `contrato-obras-e-tarefas/` | 38 | 3 | 3 | 89,8% |
| `contrato-pessoal-e-presenca/` | 43 | 3 | 0 | 96,7% |
| `contrato-relatorios-e-fotos/` | 86 | 12 | 4 | 90,2% |
| `contrato-suprimentos-e-custos/` | 82 | 9 | 4 | 91,1% |
| `contrato-tenants-e-slug/` | 40 | 6 | 0 | 93,5% |
| `contrato-whatsapp/` | 103 | 7 | 14 | 85,9% |
| `job-estado-cobranca/` | 48 | 9 | 0 | 92,1% |
| `job-prazos-aprovacao/` | 46 | 2 | 0 | 97,9% |
| `job-relatorio-diario/` | 59 | 1 | 14 | 80,4% |
| `job-retencao-seguranca/` | 36 | 4 | 1 | 92,7% |
| `trigger-aplicar-aprovacao/` | 69 | 5 | 4 | 91,7% |
| `trigger-limite-obras/` | 39 | 3 | 0 | 96,4% |
| `trigger-limite-usuarios/` | 38 | 2 | 2 | 92,9% |
| `trigger-plano-subdominio/` | 36 | 8 | 0 | 90,9% |
| `trigger-sincronizar-claims/` | 63 | 7 | 12 | 81,1% |
| `webhook-kiwify/` | 76 | 12 | 4 | 89,1% |
| `webhook-whatsapp/` | 120 | 8 | 14 | 87,3% |

**Menor confiança:** `contrato-infra-e-deploy` (77,8%), `job-relatorio-diario` (80,4%), `trigger-sincronizar-claims` (81,1%) e `contrato-whatsapp`/`webhook-whatsapp` (≈86%). Os dois primeiros concentram, respectivamente, débito técnico de configuração (GAP-07) e a lacuna bloqueante restante (GAP-05, P5 sem decisão); as units do WhatsApp ainda registram ressalvas de implementação pendente para decisões já tomadas.

---

## Lacunas resolvidas por decisão humana 🟢

| Resposta | Decisão | Efeito nas specs |
|----------|---------|------------------|
| P1 | `consultar_ponto` responde com resumo de presença de hoje do remetente | RF-11 de `webhook-whatsapp/` e `contrato-whatsapp/` definido; handler pendente |
| P2 | Ativar prévia/confirmação no webhook | Fluxo deixa de ser "planejado, não ativo" em `contrato-whatsapp/`, `webhook-whatsapp/` e `contrato-obras-e-tarefas/` |
| P3 | `presenca` é o nó canônico do `dailyReport` | RF-06/T-04 de `job-relatorio-diario/` definidos; job ainda lê `ponto/<hoje>` |
| P4 | `tarefas_pendentes` removido; gravação direta em `tarefas` | Fim do caminho divergente nas units de aprovação, obras/tarefas e jobs |
| P11 | Corrigir transferência e edição de estoque | RF-10 de `contrato-suprimentos-e-custos/` definido; correção pendente |
| P12 | `finApplyPaid` soma ao `valpago` existente | RF-11 de `contrato-suprimentos-e-custos/` definido; correção pendente |
| P13 | Eventos Kiwify desconhecidos vão para fila de revisão | `webhook-kiwify/design.md` e `tasks.md` definidos; implementação pendente |
| P14 | Omitir categorias financeiras para papéis sem módulo | RF-12 de `contrato-relatorios-e-fotos/`; risco de exposição mitigado por decisão |
| P16 | Compras respeitam `acessoObras`/filtro de obra | RF-12 de `contrato-suprimentos-e-custos/` |
| P17 | `normEstoqueNome` é canônica | `contrato-suprimentos-e-custos/design.md` |
| P18 | Reescrever histórico Git para remover artefatos | `permissions.md`; ação fora do escopo de escrita do Reversa |
| P20 | Códigos numéricos de obra são válidos | RF-08 de `contrato-whatsapp/` define conversão de `cod` para string |

---

## Lacunas pendentes 🔴/🟡

### Bloqueante 🔴

- **GAP-05 — Graph API sem retry/fila/dead-letter** (`index.js:406-446`). P5 respondeu "Não sei dizer": não há decisão; nenhuma política de reenvio foi inferida. Afeta `webhook-whatsapp/`, `job-relatorio-diario/` e `contrato-whatsapp/`.

### Não bloqueantes 🟡

- **GAP-06 a GAP-10** (P6–P10): `status` × `billingState`, config duplicada, emulador de rules, alias `mestre`/`EMAIL_MESTRA`, claims/reservas sem lease. Permanecem documentadas sem comportamento novo.
- **L-15 (P15)**: divergência `hnorm` × `8` é 🟢 como fato, mas o denominador canônico segue sem decisão em `data-dictionary.md` §43 e `contrato-pessoal-e-presenca/`.
- **L-19 (P19)**: schema mínimo do retorno GPT (`dados`) e resposta de fallback indefinidos em `contrato-whatsapp/` RF-15.

---

## Recomendações

- [ ] **P5 (GAP-05)** é a única lacuna bloqueante restante: definir retry, fila ou dead-letter para a Graph API antes de productionizar o bot e o job diário.
- [ ] **Implementar as decisões P1–P4 e P11–P14/P16/P17/P20**: as specs já contêm o comportamento, mas o código legado ainda diverge (`consultar_ponto` sem handler, `dailyReport` lendo `ponto/<hoje>`, parser órfão, transferência de estoque e `finApplyPaid`).
- [ ] **P18** depende de reescrita de histórico Git (fora do escopo do Reversa): executar com coordenação de time e avisar usuários do repositório.
- [ ] **P6–P10, P15 e P19** continuam em aberto; não transformar em comportamento novo sem resposta.
- [ ] **GAP-07** segue como débito técnico (config duplicada); alinhar fonte única de CORS/Wrangler/Node quando P7 for respondida.
- [ ] **Não usar `tests/security/rules.test.js`** como evidência de execução de rules enquanto GAP-08 persistir (P8).
- [ ] **Revisão cruzada externa (Codex)** indisponível: `cross-review-result.md` não foi gerado.

---

## Histórico de Reclassificações

| De | Para | Afirmação | Evidência |
|----|------|-----------|-----------|
| 🔴 | 🟡 | GAP-07 — CORS/Wrangler/Node duplicados (4 arquivos) | `spec-impact-matrix.md` §6 |
| 🔴 | 🟢 | Divergência do denominador de hora extra (`hnorm` × `8`) é fato confirmado no código | `utils.module.js:430-452`; `app_core.js:6159-6183` |
| 🔴 | 🟡 | Escolha do denominador canônico permanece em aberto (P15) | `data-dictionary.md` §43; `questions.md` P15 |
| 🟡 | 🔴 → 🟢 | RF-06 de `job-relatorio-diario`: de decisão pendente para `presenca` canônico (P3) | `job-relatorio-diario/requirements.md`; `questions.md` P3 |
| 🔴 | 🟢 | GAP-01…GAP-04 e L-11…L-14, L-16…L-18 e L-20 — decisão humana confirmada | `questions.md` P1–P4, P11–P14, P16–P18, P20; `gaps.md` §1 |
| 🔴 | 🔴 (mantido) | GAP-05 — P5 sem decisão ("Não sei dizer") | `questions.md` P5; `gaps.md` §2 |
| 🟡 | 🟡 (mantido) | GAP-06…GAP-10, L-15 e L-19 — sem resposta | `questions.md` P6–P10, P15, P19; `gaps.md` §3 |

### Correções de rastreabilidade (sem mudança de marcador)

| Arquivo | Correção | Evidência |
|---------|----------|-----------|
| `webhook-whatsapp/contracts.md`, `erd-complete.md` | Chave de dedup `msgId` → `chaveDedup`; `msgId`/`from` removidos dos campos gravados | `whatsapp_auth.js:156-179` |
| `webhook-whatsapp/contracts.md`, `contrato-whatsapp/design.md` | Campo `horas` (inexistente) → `hnorm` + lista completa de campos de `presenca` | `index.js:367-375` |
| `traceability/code-spec-matrix.md` | `functions/auth_core.js` marcado `n/a` (existe só em `public/js/`) | `public/js/auth_core.js` |
| `traceability/code-spec-matrix.md` | 6 `contracts.md` HTTP → 15 contratos externos/de evento; total de opcionais 16 | contagem de arquivos em `_reversa_sdd/` |
| `contrato-pessoal-e-presenca/design.md` | Campos `status`/`horas` (inexistentes) → `presenca`/`hnorm` + lista canônica de `presenca/<id>` | `data-dictionary.md` §42; `index.js:367-375` |
| `traceability/spec-impact-matrix.md` | §6/§6.1/§6.2 com decisões e lacunas restantes; `code-spec-matrix.md` atualizado | reprocessamento das respostas |
