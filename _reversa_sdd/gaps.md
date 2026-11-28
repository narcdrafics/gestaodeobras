# Lacunas restantes — obra-real (gestaodeobras)

> Atualizado pelo Revisor em 2026-11-28 após reprocessar [`questions.md`](questions.md) · `doc_level = completo` · `answer_mode = file`
> 13 perguntas respondidas (12 com decisão, P5 sem decisão), 7 pendentes (P6–P10, P15, P19).
> 🔴 bloqueante · 🟡 não bloqueante · 🟢 fato confirmado/decisão humana registrada.

---

## 1. Lacunas resolvidas por decisão humana 🟢

| ID | Decisão registrada | Evidência no código | Specs afetadas | Resposta |
|----|-------------------|---------------------|----------------|----------|
| GAP-01 | Responder `consultar_ponto` com resumo de presença de hoje do remetente | `functions/index.js:221-223` (detecta, sem branch) | `webhook-whatsapp/`, `contrato-whatsapp/` | [P1](questions.md) |
| GAP-02 | Ativar fluxo de prévia/confirmação no webhook | `functions/whatsapp/parser-tarefas.js` sem import ativo | `webhook-whatsapp/`, `contrato-whatsapp/`, `contrato-obras-e-tarefas/` | [P2](questions.md) |
| GAP-03 | `presenca` é o nó canônico do `dailyReport` | `functions/index.js:379,486` | `job-relatorio-diario/`, `contrato-whatsapp/`, `contrato-pessoal-e-presenca/` | [P3](questions.md) |
| GAP-04 | `tarefas_pendentes` removido; gravação direta em `tarefas` | `database.rules.json`, `parser-tarefas.js` | `api-admin-aprovacao/`, `contrato-aprovacoes/`, `trigger-aplicar-aprovacao/`, `job-prazos-aprovacao/` | [P4](questions.md) |
| L-11 | Corrigir transferência e edição para manter saldos consistentes | `estoque.module.js:364`, `flowcharts/estoque.md:139-141` | `contrato-suprimentos-e-custos/` | [P11](questions.md) |
| L-12 | `finApplyPaid` soma ao `valpago` existente, como `confirmPixPaid` | `flowcharts/financeiro-e-pix.md:98`, `data-dictionary.md:923` | `contrato-suprimentos-e-custos/` | [P12](questions.md) |
| L-13 | Eventos Kiwify desconhecidos vão para fila de revisão | `webhook-kiwify/design.md:61` | `webhook-kiwify/` | [P13](questions.md) |
| L-14 | Omitir categorias financeiras para papéis sem módulo | `utils.module.js:1126-1327` | `contrato-relatorios-e-fotos/` | [P14](questions.md) |
| L-16 | Compras respeitam `acessoObras`/filtro de obra | `flowcharts/compras.md:62` | `contrato-suprimentos-e-custos/` | [P16](questions.md) |
| L-17 | `normEstoqueNome` é a normalização canônica | `flowcharts/estoque.md:45` | `contrato-suprimentos-e-custos/` | [P17](questions.md) |
| L-18 | Reescrever histórico Git para remover `node_modules` e chave Web pública | `domain.md:169`, `permissions.md:127` | `permissions.md`, segurança | [P18](questions.md) |
| L-20 | `buscarObra` converte `cod` para string; códigos numéricos são válidos | `domain.md:166` | `contrato-whatsapp/` RF-08 | [P20](questions.md) |

> As decisões acima são 🟢 como decisão humana confirmada em `questions.md`. Quando o código legado ainda diverge, a spec mantém a ressalva explícita de que a implementação está pendente (ex.: `dailyReport` ainda lê `ponto/<hoje>`).

---

## 2. Lacuna bloqueante restante 🔴

| ID | Lacuna | Evidência no código | Specs afetadas | Resposta |
|----|--------|---------------------|----------------|----------|
| GAP-05 | Graph API sem retry/fila/dead-letter | `functions/index.js:406-446` | `webhook-whatsapp/`, `job-relatorio-diario/`, `contrato-whatsapp/` | [P5](questions.md) — "Não sei dizer", sem decisão |

> Regra aplicada: nenhum comportamento novo para GAP-05. A resposta P5 não autoriza inferir política de reenvio.

---

## 3. Lacunas não bloqueantes restantes 🟡

| ID | Lacuna | Evidência no código | Specs afetadas | Resposta |
|----|--------|---------------------|----------------|----------|
| GAP-06 | `status` × `billingState` divergentes | `billing.js`, `kiwify.js`, bot | `contrato-billing-e-planos/` | [P6](questions.md) — pendente |
| GAP-07 | CORS, Wrangler e Node duplicados/divergentes | `cors.json`, `worker.js`, `wrangler*`, `package.json` | `contrato-infra-e-deploy/` | [P7](questions.md) — pendente |
| GAP-08 | Emulador de Security Rules inoperante | `tests/security/rules.test.js`, `hardening.md:176-179` | `contrato-infra-e-deploy/`, matrizes | [P8](questions.md) — pendente |
| GAP-09 | Alias `mestre` e `EMAIL_MESTRA` replicados | `claims.js`, rules, Storage rules | `contrato-autenticacao-e-claims/`, `user-stories/acesso-e-tenant.md` | [P9](questions.md) — pendente |
| GAP-10 | `syncCustomClaims` sem retry; `admin_ops` sem lease curto | `functions/index.js`, `auditoria.js` | `trigger-sincronizar-claims/`, `job-retencao-seguranca/` | [P10](questions.md) — pendente |
| L-15 (Q-02) | Denominador `hnorm` (utilitários) × `8` (formulários) | `utils.module.js:430-452`, `app_core.js:6159-6183` | `data-dictionary.md` §43, `contrato-pessoal-e-presenca/` | [P15](questions.md) — pendente |
| L-19 (Q-01) | `dados` do GPT sem validação de schema | `contrato-whatsapp/requirements.md` RF-15 | `contrato-whatsapp/`, `webhook-whatsapp/` | [P19](questions.md) — pendente |

---

## 4. Correções e decisões registradas

| Item | Correção aplicada | Evidência |
|------|-------------------|-----------|
| Chave de dedup do WhatsApp | `whatsapp_messages/<msgId>` → `whatsapp_messages/<chaveDedup>` em `webhook-whatsapp/contracts.md` e `erd-complete.md`; `msgId`/`from` removidos dos campos persistidos | `whatsapp_auth.js:156-179` |
| Campos de `presenca` via bot | `horas` (inexistente) → `hnorm`, com lista completa de campos em `webhook-whatsapp/contracts.md` e `contrato-whatsapp/design.md` | `index.js:367-375` |
| GAP-07 classificado como 🔴 | Reclassificado para 🟡 em 4 arquivos, alinhado à matriz §6 | `spec-impact-matrix.md:122` |
| RF-06 de `job-relatorio-diario` | Deixou de assumir `presenca` sem decisão; P3 agora define `presenca` como nó canônico (ajuste pendente) | `questions.md` P3 |
| `functions/auth_core.js` no mapa | Marcado `n/a` — o módulo existe apenas em `public/js/auth_core.js` | `code-spec-matrix.md` §3 |
| `getPresencaCusto` | Fato da divergência reclassificado 🔴 → 🟢; escolha do denominador mantida 🟡 até P15 | `utils.module.js:430-452`, `app_core.js:6159-6183` |
| `contrato-pessoal-e-presenca/design.md` | Campos `status`/`horas` (inexistentes) → `presenca`/`hnorm` | `data-dictionary.md` §42, `index.js:367-375` |
| Matrizes de rastreabilidade | §6/§6.1/§6.2 e `code-spec-matrix.md` atualizados com as 12 decisões e a lacuna restante | `traceability/spec-impact-matrix.md`, `traceability/code-spec-matrix.md` |

---

## 5. Regras para o Revisor (próxima passada)

1. 🔴 Não escrever spec de comportamento para GAP-05 sem registrar a lacuna como bloqueante.
2. 🟢 Toda spec de autorização cita `permissions.md`, a rule correspondente e o ADR aplicável.
3. 🟢 Toda spec de cálculo derivado declara que o valor não é persistido (`ADR-008`).
4. 🟢 Toda spec de webhook declara chave de dedup, lease e reentrega (`ADR-004`).
5. 🟡 `tests/security/rules.test.js` é asserção estática — não usar como prova de execução de rules (GAP-08).
6. 🟡 P6–P10, P15 e P19 permanecem pendentes; não transformar em comportamento sem resposta.
