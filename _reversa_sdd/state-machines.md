# Máquinas de Estado — Obra Real

> Gerado pelo **Detetive** (Fase 3). `doc_level = completo`.
> 🟢 CONFIRMADO no código/rules/testes · 🟡 INFERIDO de padrões e documentação · 🔴 LACUNA/contradição.
> Convenção: `*` = estado **derivado** em leitura (não persistido). `?` = estado observado em documento legado, não confirmado no fluxo ativo.

## 1. `billingState` do tenant 🟢

**Origem:** `functions/billing.js:39-175` (`calcularBillingState`, `atualizarBillingStatesJob`), `functions/kiwify.js:379-439`, `functions/super_admin.js:267-328`, `database.rules.json:50-52`, `data-dictionary.md §86-89`.

```mermaid
stateDiagram-v2
    [*] --> ativo: criação do tenant (free_trial) / assinatura ativa
    ativo --> carencia: planoVencimento passou + carência curta (3 dias mensal / 5 anual)
    carencia --> ativo: pagamento confirmado (Kiwify) ou liberação manual
    carencia --> somente_leitura: excedeu carência + 7 dias de tolerância
    ativo --> somente_leitura: trial encerrado (30 dias + 7 dias)
    somente_leitura --> ativo: pagamento / reativação manual
    somente_leitura --> bloqueado: job diário / inadimplência / chargeback / reembolso
    ativo --> bloqueado: bloqueio manual master / trial_encerrado / inadimplente
    bloqueado --> ativo: liberação manual master (somente via Admin SDK)
    bloqueado --> somente_leitura: transição manual (rara, não é o fluxo padrão)
```

| Estado | Leitura | Escrita | Gatilho típico | Origem |
|---|---|---|---|---|
| `ativo` | sim | sim | padrão | `billing.js:39-137` |
| `carencia` | sim | sim | vencimento recente | `billing.js` |
| `somente_leitura` | sim | **não** | trial encerrado / carência esgotada | `database.rules.json:50-52` |
| `bloqueado` | não (exceto o próprio `billingState`) | não | inadimplência, chargeback, reembolso, bloqueio manual | `data-dictionary.md:1355` |

🟢 A transição é calculada por **função pura**, aplicada por job diário (04:00, `America/Sao_Paulo`) e por ações manuais do Master. 🟡 `status` do tenant não é atualizado pelo job: `status='bloqueado_pagamento'` pode coexistir com `billingState='ativo'`. 🟡 Até 24 h de defasagem entre vencimento e aplicação. 🟡 `hasFeature` devolve `false` para qualquer feature quando `billingState='bloqueado'`.

## 2. `status` do tenant (campo legado de cobrança) 🟡

```mermaid
stateDiagram-v2
    [*] --> ativo: criação (free_trial, 30 dias)
    ativo --> bloqueado_pagamento: acaoStatusTenant / bloqueio manual
    bloqueado_pagamento --> ativo: reativação manual
    ativo --> inativo: desativação legada (bidirecional com bloqueio)
```

🟢 Valores observados: `ativo`, `carencia`, `bloqueado`, `bloqueado_pagamento`, `inativo` (`kiwify.js:379,399,425,437`; `super_admin.js:286,319`; `whatsapp_auth.js:144`). 🟡 O campo é usado no bot e em checagens antigas, mas o acesso efetivo é governado por `billingState`. 🔴 `cancelamentoAgendado` não desbloqueia `bloqueado_pagamento` (`code-analysis.md:1455`).

## 3. Perfil do usuário (`profiles/<uid>`) 🟢

```mermaid
stateDiagram-v2
    [*] --> pendente: convite / assento excedido / criação pelo admin
    [*] --> ativo: auto-onboarding aprovado pelo próprio usuário (status inicial)
    pendente --> ativo: admin define cargo (definir_cargo)
    ativo --> ativo: troca de cargo (admin/rh/engenheiro/encarregado/comprador)
    ativo --> pendente: nova conta acima do limite de assentos
    ativo --> bloqueado: bloquear_usuario / remover_usuario / desativado
    pendente --> bloqueado: bloqueio explícito
    bloqueado --> ativo: desbloqueio pelo Master (claims recalculadas)
    ativo --> [*]: exclusão (Auth.deleteUser; fallback: disabled + claims null)
```

| Transição | Gatilho | Efeito nas claims | Origem |
|---|---|---|---|
| novo perfil | `onValueWritten profiles/{uid}` | `role` normalizado (`mestre`→`encarregado`), `tenantId` do perfil | `index.js:699-703` |
| `pendente`/`bloqueado` | `status` no perfil | `{role: status, tenantId: null}`; bloqueado revoga tokens | `index.js:706-712` |
| assento excedido | perfil **novo** + limite do plano | vira `pendente` | `index.js:716-720` |
| escalação bloqueada | `role='super_admin'` sem autoridade | perfil reescrito para `admin` + `cargoAtualizadoPor`; revoke se era master | `index.js:741-758` |
| RH | papel + módulos | `modulosPermitidos`, `acessoObras`, até 50 `obrasPermitidas` | `index.js:788-806` |
| perfil removido | nó apagado | `Auth.deleteUser`; falha ⇒ `disabled:true` + claims `null` | `index.js:684-697` |

🟢 `role` e `tenantId` são imutáveis para o cliente nas rules; toda alteração passa por `/api/admin/cargo` (`cargos.js`) ou pela trigger. 🟡 `users/<email>` e `invites/<email>` espelham o papel, mas não são autoridade. 🟡 `mestre` segue como alias legado em rules.

## 4. Aprovação (`tenants/<tid>/aprovacoes/<id>`) 🟢

```mermaid
stateDiagram-v2
    [*] --> pendente: solicitarAprovacao (8 tipos, prazo 15 dias, dedupe 60 s)
    pendente --> aprovado: decide/API (admin, RH com módulo, engenheiro em estoque)
    pendente --> rejeitado: decisão negativa
    pendente --> expirado: job 06:00 detecta expiraEm < agora
    aprovado --> aprovado: reserva aplicada (aplicadoEm, efeitos, antes/depois)
    aprovado --> erro: falha ao aplicar efeitos (motivo, falhaEm, notifica admins)
    erro --> aprovado: retomada pelo job após 10 min (RESERVA_STALE_MS)
    rejeitado --> [*]: terminal
    expirado --> [*]: terminal
```

| Estado | Significado | Verificação |
|---|---|---|
| `pendente` | aguardando decisão; prazo 15 dias | `database.rules.json:140-142` |
| `aprovado` | decisão positiva gravada; efeitos aplicados por trigger | `aprovacoes.js:594` |
| `rejeitado` | decisão negativa; nenhum efeito | `aprovacoes-api.js` |
| `expirado` | job de prazos marcou sem decisão | `aprovacoes.js:651` |
| `erro` | efeito falhou; retomável | `code-analysis.md:293` |

🟢 Decisão concorrente ⇒ `409 ja_decidida`; aplicação é reservada transacionalmente e revalida autoridade no momento de aplicar (`podeAplicar`). 🟢 Um único `update()` multi-path grava `aplicadoEm` + efeitos + auditoria. 🟡 Alertas 7/12/15 dias são gravados em `alertas` para dedupe.

## 5. Tarefa e status efetivo 🟢

```mermaid
stateDiagram-v2
    [*] --> A_fazer: criação (UI, WhatsApp ou aprovação)
    A_fazer --> Em_andamento: início da execução
    Em_andamento --> Concluída: conclusão (moverTarefaStatus)
    A_fazer --> Concluída: conclusão direta
    Concluída --> Em_andamento: reabertura
    A_fazer --> Pausada: pausa
    Em_andamento --> Pausada: pausa
    Pausada --> Em_andamento: retomada
    A_fazer --> Atrasada*: prazo < getTodayBR()
    Em_andamento --> Atrasada*: prazo < getTodayBR()
    Atrasada* --> Concluída: conclusão
```

```mermaid
stateDiagram-v2
    [*] --> Pendente: status legado (normalizado)
    Pendente --> A_fazer: tarefaStatusEfetivo
```

🟢 `Atrasada` é **somente derivado** — `tarefaStatusEfetivo` compara com `getTodayBR()` em leitura (`data-dictionary.md §44-45`). 🟢 Dashboard agrupa atrasadas em um alerta com até 2 exemplos; `TAREFA HOJE` gera um alerta por tarefa. 🟡 `Pendente` aparece como legado; `Concluída` é o único status que reduz `abertas`. 🔴 WhatsApp grava tarefa diretamente, sem o fluxo de prévia/confirmação do parser desconectado.

## 6. Obra 🟢

```mermaid
stateDiagram-v2
    [*] --> Planejada: criação
    Planejada --> Em_andamento: início
    Em_andamento --> Pausada: pausa
    Pausada --> Em_andamento: retomada
    Em_andamento --> Concluída: encerramento
    Planejada --> Concluída: encerramento direto
    Concluída --> Em_andamento: reabertura (inferido)
```

🟢 `obrasAtivas` conta `status === 'Em andamento'`; commit `633a2df` incluiu `Planejada` na contagem do dashboard (histórico revela mudança de requisito). 🟡 Reabertura de `Concluída` não tem regra explícita nas rules revisadas.

## 7. Presença / ponto 🟢

```mermaid
stateDiagram-v2
    [*] --> Presente: registro de presença
    [*] --> Falta: registro de falta
    [*] --> Meio_periodo: meio período
    Presente --> Meio_periodo: edição
    Meio_periodo --> Presente: edição
    Presente --> Falta: edição
    Falta --> Presente: edição
    state Calculo {
        [*] --> zero: Falta
        [*] --> metade: Meio período
        [*] --> diaria: vínculo Informal / sem horas extras
        [*] --> com_hora_extra: hnorm > 0 → diária + hextra*(diária/8)*1,5
    }
```

🟢 O recálculo é **retroativo para registros não pagos** quando a diária do trabalhador muda (commit `1ab48d9`). 🟢 O saldo considera somente `financeiro.real` com `source='pre'`, `forn=nome` e `status='Pago'`. 🔴 Fato: `dailyReport` lê `tenants/<tid>/ponto/<hoje>` enquanto o bot grava em `presenca`. 🟢 Decisão P3: `presenca` é o nó canônico (ajuste pendente).

## 8. Pagamento — financeiro e almoço 🟢

```mermaid
stateDiagram-v2
    [*] --> Pendente: lançamento novo / modal
    Pendente --> Pago: pagamento total (valpago = real>0 ? real : prev)
    Pendente --> Parcial: pagamento parcial (valpago digitado, limitado ao total)
    Pendente --> Atrasado: prazo vencido
    Parcial --> Pago: quitação do restante
    Atrasado --> Pago: quitação
    Atrasado --> Parcial: pagamento parcial após atraso
    Pago --> Parcial: edição informando valor menor (reabertura)
    Parcial --> Pendente: estorno/edição (inferido)
```

| Status | `valpago` / devido | Origem |
|---|---|---|
| `Pago` | `valpago = real > 0 ? real : prev`; devido = 0 | `code-analysis.md:979`; `data-dictionary.md §49` |
| `Parcial` | valor digitado, limitado ao total; mostra "Falta Pagar" | `code-analysis.md:979` |
| `Pendente` | `valpago = 0`; devido = total | `code-analysis.md:979` |
| `Atrasado` | `valpago = 0`; devido = total (com alerta) | `code-analysis.md:976` |

🟢 `jaPago`: `Pago → total`, `Parcial → min(valpago,total)`, demais → 0. 🟢 Mudança de status com desvio ativo vai por `financeiro_status`; demais casos por `financeiro_lancamento` (`code-analysis.md:979`). 🟡 `pix.folha` só existe no plano Ilimitado (`docs/plans/features.md:23`).

## 9. Compra 🟢

```mermaid
stateDiagram-v2
    [*] --> Aguardando: criação (campos comerciais em comprasPrivadas)
    Aguardando --> Aprovada: aprovação (aprovacaoId gravado)
    Aguardando --> Reprovada: reprovação
    Aprovada --> Pedido_Feito: pedido enviado ao fornecedor
    Pedido_Feito --> Entregue: recebimento
    Pedido_Feito --> Divergencia: divergência no recebimento
    Divergencia --> Pedido_Feito: correção
    Reprovada --> Aguardando: nova tentativa (inferido)
```

🟢 `aprovacaoId` só aparece em compras aprovadas. 🟢 Engenheiro/encarregado/mestre não leem `comprasPrivadas` (rules). 🟡 `renderCompras` não filtra linhas por obra; o filtro depende do carregamento do DB.

## 10. Movimentação de estoque e status derivado 🟢

```mermaid
stateDiagram-v2
    [*] --> Preparando: canteiro/engenheiro prepara (sem escrita direta)
    Preparando --> Pendente: solicitaAprovacao (movimentacao_estoque)
    Pendente --> Aprovada: decisão (admin / RH com módulo / engenheiro com notificarAdmin)
    Aprovada --> Aplicada: saldo ajustado + movimento gravado em movEstoque
    Aplicada --> Aplicada: próxima movimentação usa proximoIndice
    state Saldo {
        [*] --> SEM_ESTOQUE: saldo <= 0
        [*] --> CRITICO: saldo <= minimo
        [*] --> BAIXO: saldo <= minimo * 1.5
        [*] --> NORMAL: demais
    }
```

🟢 Entrada/retorno somam; saída/transferência exigem saldo; transferência gera duas movimentações e cria o item no destino (`MAT-<epoch>` quando não existe). 🟢 `antes`/`depois` do material são gravados para auditoria. 🟡 `saveEstoque` usa normalizador local divergente do `normalizarNome` testado.

## 11. Evento Kiwify 🟢

```mermaid
stateDiagram-v2
    [*] --> processing: webhook valido reserva orderId+eventType (payloadHash sem status)
    processing --> success: tenant identificado e efeitos aplicados (processedAt)
    processing --> pending_tenant: sem tenant ainda (retomavel)
    processing --> failed: erro de processamento (retomavel)
    pending_tenant --> success: tenant criado / identTenant posterior
    failed --> processing: reprocessamento (lease de 2 min expirado)
    success --> success: reentrega com mesmo hash (idempotente)
```

🟢 Assinatura HMAC-SHA1 inválida ⇒ `401` + `webhook_debug` sem PII. 🟢 `order_status` fora da chave e do hash evita duplo efeito para a mesma ordem com status diferente. 🟡 Identificação do tenant usa quatro caminhos (referência/slug → `emailAdmin` → perfil → convite).

## 12. Mensagem WhatsApp (dedup) 🟢

```mermaid
stateDiagram-v2
    [*] --> processing: reserva transacional em whatsapp_messages/<msg.id>
    processing --> done: processado e respondido (recebidaEm, ACK 200)
    processing --> rejected: origem/remetente/estado/URL invalidos (403/400)
    rejected --> [*]: sem resposta ao remetente
    done --> done: reentrega da Meta não duplica tarefa nem resposta
```

🟢 ACK 200 é enviado **depois** do processamento — uma falha não é reconhecida como sucesso. 🟢 Retenção de 24 h por `recebidaEm`. 🔴 Erro da Graph API ao responder é apenas logado (sem retry/fila/dead-letter; P5 sem decisão). 🔴 Fato: `consultar_ponto` detectada sem handler; 🟢 decisão P1. 🟢 Decisão P4: `tarefas_pendentes` removido; gravação direta em `tarefas`.

## 13. Onboarding de slug (UI, não persistido) 🟢

```mermaid
stateDiagram-v2
    [*] --> idle: abrir diálogo
    idle --> checking: validateSlug (debounce 350 ms, checkSeq descarta respostas antigas)
    checking --> ok: isSlugTaken = false
    checking --> bad: isSlugTaken = true / formato inválido / reservado
    bad --> checking: novo caractere digitado
    ok --> idle: createTenantAccount + resolve Promise
```

🟢 `validateSlug` → `isSlugTaken` (leitura direta) → `createTenantAccount` → `handleAuthSuccess`. 🟢 `buildAccountUpdates` grava `tenants`, `tenants_public` e `users` num único `update()` multi-path com `trialExpiracao = now + 30 dias`.

## 14. Matriz resumida de estados persistentes

| Entidade | Nó | Estados | Terminal? | Dono da transição |
|---|---|---|---|---|
| Billing do tenant | `tenants/<tid>/billingState` | `ativo`, `carencia`, `somente_leitura`, `bloqueado` | não | job + Admin SDK |
| Perfil | `profiles/<uid>/status` | `ativo`, `pendente`, `bloqueado` | não | trigger + API admin |
| Aprovação | `tenants/<tid>/aprovacoes/<id>/status` | `pendente`, `aprovado`, `rejeitado`, `expirado`, `erro` | sim (salvo `erro`) | API + trigger + job |
| Tarefa | `tarefas[].status` | `A fazer`, `Em andamento`, `Concluída`, `Pausada` (+ `Pendente`) | não | cliente + bot |
| Obra | `obras[].status` | `Planejada`, `Em andamento`, `Concluída`, `Pausada` | não | cliente |
| Presença | `presenca` | `Presente`, `Falta`, `Meio período` | não | cliente + bot |
| Pagamento | `financeiro[].status` | `Pago`, `Parcial`, `Pendente`, `Atrasado` | não | cliente + trigger |
| Compra | `compras[].status` | `Aguardando`, `Aprovada`, `Pedido Feito`, `Entregue`, `Reprovada`, `Divergência` | não | cliente + trigger |
| Evento Kiwify | `billing_events/<id>/status` | `processing`, `success`, `pending_tenant`, `failed` | sim (`success`) | webhook + retomada |
| Mensagem WhatsApp | `whatsapp_messages/<id>/status` | `processing`, `done`, `rejected` | sim | webhook |

**Próximo artefato:** [`permissions.md`](permissions.md)
