# Plano de Exploração — gestaodeobras

> Criado pelo Reversa em 2026-11-27
> Marque cada tarefa com ✅ quando concluída.
> Você pode editar este plano antes de iniciar: adicione, remova ou reordene tarefas conforme necessário.

---

## Fase 1: Reconhecimento 🔍

- [✅] **Scout** — Mapeamento de estrutura de pastas e tecnologias
- [✅] **Scout** — Análise de dependências e gerenciadores de pacotes
- [✅] **Scout** — Identificação de entry points, CI/CD e configurações

## Decisão de organização das specs 🗂️

> Entre o Scout e o Arqueólogo, o Reversa pergunta como você quer organizar as specs (por módulo, caso de uso, endpoint, híbrida, por features ou customizada). A escolha fica persistida em `.reversa/config.toml` na seção `[specs]` e não será reperguntada em execuções futuras. Para reapresentar o menu, remova manualmente a seção.

## Fase 2: Escavação 🏗️

> Preenchido pelo Scout a partir de `.reversa/context/surface.json` (21 módulos).

- [✅] **Arqueólogo** — Análise do módulo `auth`
- [✅] **Arqueólogo** — Análise do módulo `tenants-e-slug`
- [✅] **Arqueólogo** — Análise do módulo `admin-e-super-admin`
- [✅] **Arqueólogo** — Análise do módulo `usuarios-e-cargos`
- [✅] **Arqueólogo** — Análise do módulo `aprovacoes`
- [✅] **Arqueólogo** — Análise do módulo `obras`
- [✅] **Arqueólogo** — Análise do módulo `tarefas`
- [✅] **Arqueólogo** — Análise do módulo `trabalhadores`
- [✅] **Arqueólogo** — Análise do módulo `presenca-e-ponto`
- [✅] **Arqueólogo** — Análise do módulo `almocos`
- [✅] **Arqueólogo** — Análise do módulo `compras`
- [✅] **Arqueólogo** — Análise do módulo `estoque`
- [✅] **Arqueólogo** — Análise do módulo `financeiro-e-pix`
- [✅] **Arqueólogo** — Análise do módulo `orcamento`
- [✅] **Arqueólogo** — Análise do módulo `medicao`
- [✅] **Arqueólogo** — Análise do módulo `relatorios-e-dashboard`
- [✅] **Arqueólogo** — Análise do módulo `fotos`
- [✅] **Arqueólogo** — Análise do módulo `billing-e-planos`
- [✅] **Arqueólogo** — Análise do módulo `whatsapp-bot`
- [✅] **Arqueólogo** — Análise do módulo `seguranca-e-rbac`
- [✅] **Arqueólogo** — Análise do módulo `infra-e-deploy`

## Fase 3: Interpretação ✅

- [✅] **Detetive** — Arqueologia Git e ADRs retroativos
- [✅] **Detetive** — Regras de negócio implícitas e máquinas de estado
- [✅] **Detetive** — Matriz de permissões (RBAC/ACL)
- [✅] **Arquiteto** — Diagramas C4 (Contexto, Containers, Componentes)
- [✅] **Arquiteto** — ERD completo e integrações externas
- [✅] **Arquiteto** — Spec Impact Matrix

## Fase 4: Geração 📝

- [✅] **Redator** — Specs SDD por componente (26 units × 3 arquivos canônicos)
- [✅] **Redator** — OpenAPI (se aplicável) — `openapi/api.yaml`
- [✅] **Redator** — User Stories (se aplicável) — 10 fluxos
- [✅] **Redator** — Code/Spec Matrix — `traceability/code-spec-matrix.md`

## Fase 5: Revisão ✅

- [✅] **Revisor** — Revisão cruzada de specs (26 units, 94 arquivos)
- [✅] **Revisor** — Coleta de lacunas em `questions.md` (20 perguntas — `answer_mode=file`)
- [✅] **Revisor** — Relatório de confiança inicial — `confidence-report.md` (83,3%)
- [✅] **Revisor** — Reprocessamento das respostas de `questions.md` (13 respondidas; 12 com decisão, P5 sem decisão)
- [✅] **Revisor** — Aplicação das decisões P1–P4, P11–P14, P16–P18 e P20 nas specs e matrizes
- [✅] **Revisor** — Recálculo de confiança: 1594 🟢 / 201 🟡 / 122 🔴 (1917 marcadores) = 88,4%

> 🔴 Resta apenas GAP-05 (P5 sem decisão) como lacuna bloqueante. P6–P10, P15 e P19 continuam pendentes e não foram transformados em comportamento novo. As decisões aplicadas mantêm ressalva explícita quando o código legado ainda diverge.

---

## Agentes Independentes

> Execute estes agentes quando os recursos estiverem disponíveis — podem rodar em qualquer fase.

- [ ] **Visor** — Análise de interface via screenshots — bloqueado: modelo sem suporte a imagem (6 screenshots disponíveis em `public/img/`)
- [✅] **Data Master** — Análise completa do banco de dados (`database/` com 5 artefatos)
- [✅] **Design System** — Extração de tokens de design (`design-system/` com 5 artefatos)
- [✅] **Tracer** — Análise dinâmica via emulador Firebase demo, 2 rodadas: `auth` (5 hipóteses: 3 🟢 / 2 🟡 / 0 🔴) e `usuarios-e-cargos` (6 hipóteses: 6 🟢 / 0 🟡 / 0 🔴); total 9 🟢 / 2 🟡 / 0 🔴; artefatos em `_reversa_sdd/dynamic-analysis/`; skill executada manualmente do staged (instalação em `.agents/skills/` ainda pendente de liberação em `reversa-config.json`)

---

## Próximo passo

Após o Time de Descoberta concluir e o `_reversa_sdd/` estar populado, você pode disparar um dos fluxos seguintes:

- `/reversa-migrate`: orquestrador do **Time de Migração** (Paradigm Advisor → Curator → Strategist → Designer → Screen Translator → Inspector). Gera as specs do sistema novo. Saída em `_reversa_sdd/migration/` e `_reversa_sdd/screens/`.
- `/reversa-reconstructor`: gera plano bottom-up para reimplementar o software a partir das specs do legado (uma tarefa por sessão).
