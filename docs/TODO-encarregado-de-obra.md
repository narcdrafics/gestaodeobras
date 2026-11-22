# TODO — Perfis de Acesso: Encarregado de Obra e Engenheiro (com aprovação do administrador)

**Status:** planejado — não implementado
**Atualizado em:** 2026-11-22

## Objetivo

Criar dois perfis com atuação no canteiro, sem poder alterar dados sensíveis por conta própria:

**Encarregado de Obra**
- **Atuação principal (escrita direta, com auditoria, sem aprovação):** registro de obra = ponto dos funcionários, fotos e tarefas do dia.
- **Mediante solicitação:** recebimento/transferência de materiais e ferramentas (pode ser aceita pelo Engenheiro, que informa o admin).
- **Somente o admin decide:** inclusão/remoção de trabalhadores.
- **Bloqueado:** finanças, orçamento, compras, plano/faturamento, configurações da empresa, usuários e permissões, exclusão de histórico.

**Engenheiro**
- **Atuação principal (escrita direta, com auditoria):** projetos/obras, medições (rascunho), tarefas, fotos, acompanhamento de presença e relatórios técnicos.
- **Atribuição própria, mediante aprovação do admin:** financeiro/orçamento de empreitadas e aditivos (domínio separado de compras), incluindo criar/alterar lançamentos e mudar status de pagamento; gerar compra.
- **Pode solicitar e aceitar materiais/ferramentas**, informando o admin da decisão.
- **Bloqueado:** plano/faturamento, usuários e permissões, configuração da empresa, exclusão de histórico, dados bancários/PIX completos.

> **Regra de ouro:** nada que muda pessoal, dinheiro ou configuração acontece sem o administrador aprovar. Para estoque de materiais/ferramentas, o Engenheiro também pode decidir, desde que informe o admin. O solicitante **propõe**, quem tem autoridade **decide**, o servidor **aplica**.

---

## 1. Decisões

### 1.1 Confirmadas (2026-11-22)

- [x] **"Registro de obra" = ponto, fotos e tarefas.** São escrita direta, **sem aprovação**, apenas com auditoria (quem, o quê, quando) para o admin conferir depois. Medição (`DB.medicao`, que tem valor financeiro) **não** entra nessa definição e continua sujeita a aprovação quando fechada.
- [x] **Ponto/fotos/tarefas não exigem aprovação** — ver item acima.
- [x] **Engenheiro pode avançar no financeiro?** Sim, mediante aprovação do admin. O Engenheiro prepara o lançamento (valores, obra, etapa, descrição) e o envia como solicitação; o status só muda para `Pago`/`Parcial`/`Atrasado` depois que o admin aprova. Ele nunca grava em `DB.financeiro` diretamente e nunca confirma pagamento (ver §2.2 e §3).
- [x] **Financeiro/orçamento de empreitadas e aditivos ≠ compras.** Empreitadas (`orcamento` com `oc-tipo = Empreiteiro`/`oc-empreiteiro` e lançamentos `financeiro` com `tipo = Empreiteiro`) e aditivos/descontos/adiantamentos/ajustes (`financeiro`, `tipo = Aditivo|Desconto|Adiantamento|Ajuste`) são **atribuição do Engenheiro**, em fluxo separado de `compras`. Não misturar os dois domínios na UI nem nas regras: compras continua com solicitação do Engenheiro e aprovação do admin (`compra_criacao`).
- [x] **Solicitação de materiais e ferramentas (`movimentacao_estoque`)** pode ser feita **tanto pelo Encarregado quanto pelo Engenheiro**.
- [x] **Essa solicitação pode ser aceita pelo Engenheiro**, que deve **informar o admin** da decisão (in-app, badge/toast + registro em `auditoria`, pois não há serviço de e-mail). O admin também pode aprovar/rejeitar qualquer solicitação.
- [x] **Alias: `mestre` → `encarregado`.** O nome canônico do papel passa a ser `encarregado` (label "Encarregado de Obra"). `mestre` fica **apenas como alias legado por um release**, para não quebrar sessões/claims antigos; depois é removido. Migrar `public/modals/modal-usuario.html`, `setRestrictions()` (`auth_core.js`), `syncCustomClaims` e a lista de sentinelas de usuário. Nenhum usuário novo deve ser criado como `mestre`.
- [x] **Solicitações expiram em 15 dias, com alertas.** Prazo contado a partir de `solicitadoEm`. Alertas in-app em **7 dias** e **12 dias** e alerta final na **expiração (15 dias)**, enviados ao solicitante e ao admin (e ao Engenheiro quando ele é decisor de `movimentacao_estoque`). Ao expirar: `status = 'expirado'`, nenhuma operação aplicada e a solicitação pode ser recriada. Definição de alerta ajustável, mas a expiração é aos 15 dias.
- [x] **Compras — segregação de dados.** Engenheiro e Encarregado **não** veem valores dos insumos (`vunit`, `vtotal`, `vorc`), prazo/data de entrega (`prazo`), forma de pagamento (`pixkey`) nem fornecedor (`forn`). Enxergam somente: nome do material/serviço (`mat`), quantidade/unidade (`qtd`, `unid`), data de recebimento (`receb`), se foi conferido (`conf`), status e evidência. Os dados sensíveis ficam com o setor de compras (papel futuro `comprador`/`almoxarife`) e com o admin.
- [x] **Aprovação de compras permanece com o admin** (`compra_criacao`). O aceite delegado ao Engenheiro vale **somente** para `movimentacao_estoque` — não se estende a compras.
- [x] **Corrigir a falha do formulário/tabela de compras** mantendo o **cabeçalho padrão dos formulários** (`div.modal-header > span.modal-title` com ícone + título + botão de fechar), sem cabeçalho customizado.
- [x] **Ligação com evidências (recomendado):** associar a compra a uma evidência (foto) e disponibilizar botão "Ver evidência", reaproveitando `public/pages/fotos.html` (Relatório Fotográfico / Evidências de Obra) e o Storage `tenants/{tenantId}/evidencias/`. Página dedicada de evidências pode ser criada depois.

### 1.2 Pendências

- [ ] **Nome do papel do setor de compras:** `comprador` ou `almoxarife`? Recomendação: `comprador` para o setor de compras e, se necessário depois, `almoxarife` para conferência/recebimento no almoxarifado.

---

## 2. Matriz de permissões (alvo)

### 2.1 Encarregado de Obra

> **Registro de obra = ponto + fotos + tarefas**: escrita direta, **sem aprovação**, com auditoria. Não inclui medição com valor.

| Área / ação | Encarregado | Admin | Como é aplicado |
|---|---|---|---|
| Ponto/presença (`presenca`) — registro de obra | ✅ Escrever | ✅ | Escrita direta + auditoria |
| Fotos da obra (Storage + `medicao.photos`) — registro de obra | ✅ Enviar | ✅ | Escrita direta + auditoria |
| Tarefas do dia (`tarefas`) — registro de obra | ✅ Criar/concluir | ✅ | Escrita direta + auditoria |
| Receber/transferir material e ferramenta (`estoque`, `estoque/canteiro`, `movEstoque`) | 🟡 Solicitar | ✅ Aprovar/rejeitar (**Engenheiro também pode aceitar**, informando o admin) | Cloud Function aplica após decisão; `movimentacao_estoque` |
| Adicionar/remover trabalhador (`trabalhadores`) | 🟡 Solicitar | ✅ Aprovar/rejeitar | Cloud Function aplica após aprovação |
| Usuários do sistema e papéis (`usuarios`, `profiles`, `invites`) | ❌ | ✅ | Rules + Cloud Function |
| Medição com valor, orçamento, financeiro, compras | ❌ | ✅ | Rules |
| Plano, faturamento, subdomínio, white-label, backup/exportação, exclusão de obra/registro | ❌ | ✅ | Rules + Functions |
| Aprovar/rejeitar solicitações | ❌ | ✅ | Rules (`auth.token.role`); exceção: `movimentacao_estoque` pode ser aceita pelo Engenheiro (§2.2) |

**Bloqueios adicionais (Encarregado):** importar arquivos, editar dados de obra já fechada, alterar `billingState`, alterar `role`/`tenantId`, e qualquer escrita em lote (`persistDB()` completo).

### 2.2 Engenheiro

Hoje `setRestrictions()` (`public/js/auth_core.js`) já esconde `trabalhadores`, `presenca`, `financeiro` e `orcamento` do Engenheiro. O plano abaixo **amplia** a atuação dele, mas mantém o financeiro atrás de aprovação.

| Área / ação | Engenheiro | Admin | Como é aplicado |
|---|---|---|---|
| Obras e planejamento (`obras`, `tarefas`) | ✅ Escrever | ✅ | Escrita direta + auditoria |
| Medições (`medicao`) | ✅ Registrar rascunho | ✅ | Rascunho direto; **fechar/aprovar medição** exige aprovação (impacta financeiro) |
| Fotos e relatórios técnicos (`fotos`, `relatorios`) | ✅ | ✅ | Escrita direta + auditoria |
| Presença/trabalhadores | 👁️ Somente leitura | ✅ | Rules de leitura permitidas, escrita negada |
| **Lançamentos financeiros** (`financeiro`: data, obra, etapa, tipo, descrição, `prev`, `real`, `pgto`, `nf`) — **atribuição do Engenheiro** | 🟡 Preparar e enviar | 🟡 Aprovar/rejeitar | Vira `financeiro_lancamento`; nada entra em `DB.financeiro` antes da aprovação |
| **Empreitadas** (`orcamento` com `oc-tipo = Empreiteiro` / `oc-empreiteiro` e `financeiro.tipo = Empreiteiro`) — **atribuição do Engenheiro** | 🟡 Preparar e enviar; fechar só com aprovação | 🟡 Aprovar/rejeitar | `orcamento_fechamento` + `financeiro_lancamento`; domínio separado de compras |
| **Aditivos, descontos, adiantamentos e ajustes** (`financeiro.tipo in Aditivo, Desconto, Adiantamento, Ajuste`) — **atribuição do Engenheiro** | 🟡 Preparar e enviar | 🟡 Aprovar/rejeitar | Mesmo fluxo `financeiro_lancamento`; não confundir com pedido de compra |
| **Status de pagamento** (`Pendente → Pago/Parcial/Atrasado`, `valpago`) | 🟡 Solicitar | 🟡 Aprovar/rejeitar | Vira `financeiro_status`; transição aplicada pela Cloud Function |
| **Solicitação de materiais e ferramentas** (`movimentacao_estoque`: `estoque`, `estoque/canteiro`, `movEstoque`) | 🟡 Solicitar **e ✅ aceitar** | ✅ Aprovar/rejeitar | Engenheiro pode aceitar solicitação do Encarregado ou sua própria; **informa o admin** via badge/toast + `auditoria`. Admin também pode decidir |
| Compras (`compras`) — domínio **separado** de empreitadas/aditivos | 🟡 Solicitar | ✅ Aprovar/rejeitar | `compra_criacao`; não misturar com orçamento de empreitadas na UI nem nas rules |
| Usuários, papéis, convites, plano, faturamento, domínio, backup, exclusão de histórico | ❌ | ✅ | Rules + Functions |
| Dados bancários/PIX completos | ❌ | ✅ | Não expor no front do Engenheiro |

> **Separação de domínios:** empreitadas/aditivos vivem em `orcamento` + `financeiro` (atribuição do Engenheiro, com aprovação do admin para efetivar). Compras vivem em `compras` (solicitação do Engenheiro, aprovação do admin). Materiais e ferramentas são solicitados por **ambos** os papéis e podem ser aceitos pelo Engenheiro, com aviso ao admin.

**Regra específica do financeiro:** o Engenheiro pode **preparar e acompanhar**, mas não **efetivar**. O fluxo é:

1. Engenheiro preenche o lançamento em `modal-financeiro.html`; o formulário força `status = 'Pendente'` e `valpago = 0` para esse perfil.
2. A ação grava uma solicitação `financeiro_lancamento` (ou `financeiro_status` para mudança de status) com o payload — **nenhuma** escrita em `tenants/{tenantId}/financeiro`.
3. Admin revisa valor, obra, comprovante (`nf`) e aprova/rejeita.
4. Cloud Function aplica a operação em `financeiro`, grava `aplicadoEm` e lança auditoria com antes/depois.
5. Engenheiro vê o status da solicitação ("Aguardando admin", "Aprovado", "Rejeitado: motivo").

> **Decisão confirmada:** sim — o Engenheiro *avance* no financeiro, desde que "avançar" signifique **preparar/solicitar**, nunca confirmar pagamento nem alterar valor sem o admin. Isso mantém a segregação de funções e ainda dá ao Engenheiro visibilidade do que foi aprovado.

### 2.3 Compras — campos por papel

| Campo (`modal-compra.html` / `DB.compras`) | Encarregado | Engenheiro | Comprador/Almoxarife (papel futuro) | Admin |
|---|---|---|---|---|
| Obra, etapa, Nº pedido, data da solicitação (`obra`, `etapa`, `num`, `data`) | 👁️ (somente leitura) | ✅ Solicitar | ✅ | ✅ |
| Nome do material/serviço, quantidade e unidade (`mat`, `qtd`, `unid`) | 👁️ | ✅ Solicitar | ✅ | ✅ |
| Data de recebimento e "conferido?" (`receb`, `conf`) | 👁️ | 👁️ | ✅ Preencher | ✅ |
| Status e evidência (`status`, `evidenciaId`/`fotoIds`) | 👁️ | 👁️ | ✅ | ✅ |
| Valor unitário, total e orçado (`vunit`, `vtotal`, `vorc`) | ❌ | ❌ | ✅ | ✅ |
| Prazo/data de entrega (`prazo`) | ❌ | ❌ | ✅ | ✅ |
| Forma de pagamento / chave PIX (`pixkey`) | ❌ | ❌ | ✅ | ✅ |
| Fornecedor (`forn`) | ❌ | ❌ | ✅ | ✅ |
| Aprovar/rejeitar (`compra_criacao`) | ❌ | ❌ | ❌ | ✅ |

> Encarregado não solicita compra — apenas acompanha o recebimento. Engenheiro solicita e acompanha, sem ver dados comerciais. O papel de compras preenche fornecedor/valores/pagamento; o admin aprova.

---

## 3. Fluxo de aprovação (design)

### 3.1 Dados — novo nó no Realtime Database

```
tenants/{tenantId}/aprovacoes/{id}
  tipo: "movimentacao_estoque" | "trabalhador_add" | "trabalhador_remove"
      | "financeiro_lancamento" | "financeiro_status"
      | "orcamento_fechamento" | "compra_criacao" | "medicao_fechamento"
  status: "pendente" | "aprovado" | "rejeitado" | "expirado" | "erro"
  payload: { ... }              // cópia exata da operação desejada
  solicitadoPor: uid
  solicitadoEm: timestamp
  expiraEm: timestamp           // solicitadoEm + 15 dias
  expiradoEm: timestamp | null
  alertas: { "7d": timestamp | null, "12d": timestamp | null, "expiracao": timestamp | null }
  decididoPor: uid | null
  decididoPorPapel: "admin" | "engenheiro" | null
  decididoEm: timestamp | null
  motivo: string | null
  notificarAdmin: boolean       // true quando decidido por engenheiro
  notificadoAdminEm: timestamp | null
  aplicadoEm: timestamp | null  // idempotência da Cloud Function
```

> Para `compra_criacao`, o `payload` criado pelo Engenheiro contém **somente** campos não sensíveis (`obra`, `etapa`, `mat`, `qtd`, `unid`, `status: 'Aguardando'`). Campos sensíveis são preenchidos depois pelo setor de compras/admin.

```
tenants/{tenantId}/compras/{id}          // dados "públicos" — leitura liberada
  num, data, obra, etapa, mat, qtd, unid, status, receb, conf, evidenciaId/fotoIds

tenants/{tenantId}/comprasPrivadas/{id}  // dados comerciais — leitura só comprador/admin
  forn, pixkey, vunit, vtotal, vorc, prazo
  //RTDB não oculta campos individualmente: é obrigatório separar em nós por papel
  //(ou o cliente comum recebe o objeto inteiro via persistDB() e vaza tudo)
```

```
tenants/{tenantId}/notificacoes/{id}   // avisos in-app (admin, solicitante, engenheiro decisor)
  tipo: "aprovacao_por_engenheiro" | "aprovacao_proxima_expiracao" | "aprovacao_expirada"
  aprovacaoId, decididoPor, decididoEm, criadoEm, lidoPorAdmin: false
  destinatarios: [uid]          // solicitante + admin (+ engenheiro decisor, se aplicável)
```

```
tenants/{tenantId}/auditoria/{id}
  acao, ator, alvo, antes, depois, origemAprovacao, criadoEm
  // append-only: clientes nunca escrevem direto
```

### 3.2 Regras de segurança (`database.rules.json`)

- [ ] Encarregado e Engenheiro podem **criar** `aprovacoes/{id}` somente com `status === 'pendente'`, `solicitadoPor === auth.uid`, `expiraEm` coerente com `solicitadoEm + 15 dias` e `payload` imutável depois da criação (cada papel limitado aos seus `tipo`s).
- [ ] Nenhum cliente pode escrever `status === 'expirado'`, `expiradoEm` ou `alertas`; transição para `expirado` somente via Admin SDK (job diário).
- [ ] `admin`/`super_admin` pode mudar `status` para `aprovado`/`rejeitado` em **qualquer** `tipo`, preenchendo `decididoPor`, `decididoPorPapel: 'admin'`, `decididoEm` e `motivo`.
- [ ] `engenheiro` pode mudar `status` para `aprovado`/`rejeitado` **somente** em `tipo === 'movimentacao_estoque'`, obrigatoriamente com `decididoPorPapel === 'engenheiro'` e `notificarAdmin === true`. Demais `tipo`s: escrita negada.
- [ ] Negar escrita direta de `encarregado`/`engenheiro` em `estoque`, `movEstoque`, `trabalhadores`, `usuarios`, `medicao`, `financeiro`, `orcamento`, `compras` e `config` — cada papel com sua matrix acima (hoje as rules só checam `tenantId` + `billingState`, **não checam role** — este é o ponto crítico).
- [ ] `comprasPrivadas/{id}` com leitura/escrita **negada** para `encarregado` e `engenheiro` (somente `comprador`/`almoxarife` e `admin`/`super_admin`). `compras/{id}` com leitura permitida a esses papéis, mas escrita negada a `encarregado`/`engenheiro`.
- [ ] `auditoria` e `notificacoes` com `.write: false` para clientes; escrita apenas via Admin SDK. Leitura de `notificacoes` somente para `admin`/`super_admin` e para os uids em `destinatarios`.

### 3.3 Aplicação da aprovação (Cloud Function)

- [ ] Novo `functions/aprovacoes.js`: trigger `onValueWritten('tenants/{tenantId}/aprovacoes/{id}')`, exportado em `functions/index.js`.
- [ ] Job diário no mesmo arquivo (`onSchedule('every 24 hours')`): para `status === 'pendente'`, envia alertas in-app em 7 e 12 dias e expira aos 15 dias (`status: 'expirado'`, `expiradoEm`, `motivo: 'Solicitação expirada após 15 dias'`). Idempotente pelos campos `alertas.*`; cada alerta com destaque para o solicitante/admin (e engenheiro decisor, se aplicável).
- [ ] Alertas e expiração **nunca** aplicam o `payload`. Se aprovação e expiração competirem, transação compara `status`/`expiraEm`; solicitação expirada não pode ser aplicada e a tentativa é registrada como `erro`/ignorada.
- [ ] Aplica operação somente quando `status` transiciona para `aprovado` **e** `aplicadoEm` não existe (idempotente). Transição para `rejeitado` não aplica nada, mas também dispara o registro de auditoria e a notificação ao admin quando a decisão foi do Engenheiro.
- [ ] Aplica o `payload` no nó real com Admin SDK (`estoque`/`movEstoque`/`trabalhadores`/`financeiro`/`orcamento`/`compras`/`medicao`) dentro de uma transação/atômica quando possível.
- [ ] Para `financeiro_status`: revalida as regras de integridade do `saveFinanceiro()` (`Pago` → `valpago = total`; `Pendente`/`Atrasado` → `valpago = 0`; `Parcial` → valor informado) e nunca aceita status diferente de `Pendente` vindo direto do Encarregado/Engenheiro.
- [ ] Grava `aplicadoEm`, `aplicadoPor` e entrada em `auditoria` com antes/depois (incluindo `decididoPorPapel`).
- [ ] Quando `decididoPorPapel === 'engenheiro'` (aprovação **ou** rejeição de `movimentacao_estoque`), cria notificação in-app em `notificacoes/{id}` para o admin e preenche `notificadoAdminEm`. Não enviar e-mail — não existe serviço de e-mail no projeto.
- [ ] Em caso de falha: `status: 'erro'` + `motivo` com o motivo técnico (sem expor detalhes sensíveis ao cliente).
- [ ] Rejeição não aplica nada; apenas registra auditoria, notifica o solicitante e, se decidida pelo Engenheiro, notifica o admin.

### 3.4 UX

- [ ] `public/js/app_core.js`: nos fluxos de material/ferramenta (**Encarregado e Engenheiro**), trabalhador (`encarregado`) e empreitadas/aditivos/financeiro/compras/medição (`engenheiro`), montar a solicitação em vez de chamar `persistDB()`/escrever direto.
- [ ] Registro de obra (ponto, fotos, tarefas): manter escrita direta dos dois papéis, **sem** botão de aprovação — apenas auditoria.
- [ ] Toast de confirmação: "Solicitação enviada para aprovação." e bloquear reenvio duplicado.
- [ ] Badge de aprovações pendentes no cabeçalho (`setRestrictions()` em `auth_core.js`): admin vê todas; Encarregado e Engenheiro veem o status das próprias solicitações; **Engenheiro também vê solicitações de material/ferramenta aguardando decisão**. Mostrar "Expira em X dias", destaque nos últimos 3 dias e "Expirada — recriar" quando `status === 'expirado'`.
- [ ] `public/pages/admin.html`: painel "Aprovações pendentes" com resumo, solicitante, data e botões Aprovar/Rejeitar; aviso destacado quando a decisão foi do Engenheiro ("Aprovado/Rejeitado por Engenheiro — admin informado").
- [ ] `public/modals/modal-aprovacao.html`: detalhes da operação (o que muda, antes/depois), data de expiração e campo de motivo para rejeição; para `engenheiro`, habilitar Aprovar/Rejeitar somente em `movimentacao_estoque`; expirada: botões desabilitados e opção de recriar.
- [ ] `public/modals/modal-financeiro.html` e `saveFinanceiro()` (`app_core.js`): para `engenheiro`, travar `fn-status` em `Pendente`, `fn-valpago = 0`, desabilitar edição de `fn-real`/`fn-pgto` após envio e transformar "Salvar" em "Enviar para aprovação".
- [ ] `public/pages/financeiro.html`: para `engenheiro`, mostrar coluna "Aprovação" (Aguardando/Aprovado/Rejeitado), esconder dados de PIX/banco e desabilitar ações de editar/excluir lançamentos já aprovados.
- [ ] `setRestrictions()` (`auth_core.js`): liberar `financeiro`, `orcamento` (empreitadas), `medicao`, `relatorios`, `estoque`/`movEstoque` e `compras` para `engenheiro` no modo de leitura/solicitação/aceite de materiais, mantendo `usuarios` e Administração ocultos. Separar visualmente "Empreitadas/Aditivos" de "Compras" na navegação.
- [ ] `public/modals/modal-compra.html`: para `engenheiro`/`encarregado`, **remover/ocultar** os campos `cp-forn`, `cp-pixkey`, `cp-vunit`, `cp-vtotal`, `cp-vorc`, `cp-prazo`; manter `cp-mat`, `cp-qtd`, `cp-unid`, `cp-receb`, `cp-conf`, `cp-status`, obs. Para o papel de compras/admin, exibir todos. **Manter o cabeçalho padrão** (`div.modal-header > span.modal-title` com `material-symbols-outlined`, título e botão `closeModal('modal-compra')`) — não criar cabeçalho próprio.
- [ ] `public/js/app_core.js` (`saveCompra`, `editCompra`, `renderCompras`): não gravar nem ler campos sensíveis do cliente quando o papel não tem acesso; ajustar `renderCompras()` para não exibir `forn`/`vtotal`/`prazo` a `engenheiro`/`encarregado` e para mostrar `receb` + `conf` na coluna "Recebido?".
- [ ] **Corrigir falha da tabela:** `public/pages/compras.html` tem 12 `<th>` e `renderCompras()` gera 11 `<td>` (`Qtd.`/`Unid.` mesclados e "Recebido?" mostrando `conf`). Alinhar colunas entre cabeçalho e linhas.
- [ ] Evidência: gravar `evidenciaId`/`fotoIds` na compra e adicionar ação "Ver evidência" que abre `fotos.html` filtrada por obra/etapa (ou página de evidências dedicada, se criada). O upload de foto continua permitido ao Encarregado/Engenheiro no registro de obra.
- [ ] `public/pages/fotos.html`, `presenca.html`, `tarefas.html`, `hoje.html`: manter utilizáveis pelo Encarregado; esconder ações de exclusão em massa.
- [ ] `setRestrictions()` (`auth_core.js`): esconder nav itens bloqueados para `encarregado` (financeiro, orçamento, compras, Administração, Relatórios, etc.) e mostrar apenas: Hoje/Registro, Presença, Fotos, Tarefas, Obras (somente leitura).
- [ ] Sentinel de usuários em `auth_core.js`: incluir `encarregado` na lista de papéis que podem existir fora do `DB.usuarios` local, se aplicável.

### 3.5 Almoços — mesma usabilidade de Presença

**Situação atual:** `public/pages/almocos.html` já tem KPIs, busca simples (`almoco-busca` → `renderAlmocos()` com `JSON.stringify(a).includes(q)`), tabela plana e "Resumo Semanal por Obra". Falta o que `presenca.html` já oferece: quadro semanal navegável, lançamento por clique na célula, agrupamento/ordenação e fechamentos por trabalhador/pagamento pendente.

- [ ] **Quadro semanal de almoços:** novo `almoco-quadro-semanal` com botões "Semana Anterior"/"Próxima Semana" (`changeAlmocoWeek`, análogo a `changeWeek`), colunas Seg–Dom e primeira coluna fixa (sticky) com trabalhador/equipe.
- [ ] Célula clicável com ícone de status (sem registro / lançado / pago) abrindo `modal-almoco` já com data + empreiteiro preenchidos (`openAlmocoModal(cod, data, idx)`, análogo a `openPresenceModal`).
- [ ] **Filtros da lista:** `filterAlmoco()` (como `filterPresenca()`), selects `almoco-group-select` (Por Empreiteiro / Por Obra / Lista Plana) e `almoco-sort-select` (Mais Recentes / Mais Antigas), substituindo a busca por `JSON.stringify` — mesma toolbar de `presenca.html`.
- [ ] **Fechamentos:** manter "Resumo Semanal por Obra" e adicionar "Fechamento — Por Empreiteiro/Trabalhador (qtd + custo)" e "Pagamentos Pendentes (semana por obra)", espelhando `pres-totais`, `pres-empreitada` e `pres-pgto-pendentes`.
- [ ] **Fechamento Semana:** se fizer sentido, ação em lote análoga a `prepareLotePgto('semana')` usando `al-status`/`al-valpago` dos almoços.
- [ ] **Modal/fluxo:** preservar modos Individual/Em Lote, "Marcar Todos", "Salvar e Próximo" e o **cabeçalho padrão** do modal; o clique no quadro abre em modo individual e a validação de duplicidade (data + empreiteiro + obra) continua em `saveAlmoco()`.
- [ ] **Responsividade:** reaproveitar o CSS de `presenca.html` (`.presence-board`, coluna sticky, media queries 767px/480px) com classes `almoco-*` ou compartilhadas; KPIs do dia/semana devem acompanhar a semana navegada.
- [ ] Permissões: quadro e lançamento disponíveis para `encarregado` e `engenheiro` (registro de obra/ponto), sem alterar as regras de papel já definidas para valores/pagamento.

### 3.6 Tarefas — eficiência e presença no Dashboard

**Diagnóstico (código atual):**

- `public/pages/tarefas.html` / `renderTarefas()` (`app_core.js`): só filtra por obra e busca textual; **não** filtra por status, prioridade, responsável nem "vencidas"; concluídas/atrasadas ficam misturadas; a ordenação é só por prazo e não destaca atraso automaticamente.
- Kanban: o cartão só abre o modal de edição — não arrasta entre colunas e não tem "+ Nova" por coluna.
- Não há ação rápida na linha para concluir/iniciar/avançar `%` — tudo exige abrir o modal.
- Dashboard: tarefas aparecem apenas como `feitas/total` na coluna "Tarefas" do resumo por obra e nos alertas (`calcAlertas` em `utils.module.js`: `TAREFA ATRASADA` / `TAREFA HOJE`), limitados a 8 e competindo com custo/compra/presença — na prática "não aparecem". Não há KPI de tarefas nem link da coluna para a página filtrada. `Hoje` mostra só tarefas com `prazo === hoje`.

**Alvo:**

- [ ] Filtros na toolbar: obra, **status**, prioridade, responsável, "Só vencidas", "Minhas tarefas" e botão "Limpar filtros"; manter filtros ao alternar Tabela/Quadro.
- [ ] Ordenação por prazo/prioridade/status e agrupamento opcional por obra ou responsável.
- [ ] Ações rápidas: checkbox "Concluir" e botão "Iniciar" na linha; no kanban, **drag-and-drop** entre colunas e "+ Nova" por coluna; toast com desfazer. Evitar re-render completo a cada tecla (debounce na busca).
- [ ] Destaque visual: vermelho para `prazo < hoje && status !== 'Concluída'` e laranja para "vence hoje". Calcular `Atrasada` em tempo de leitura, sem depender de gravação manual do status.
- [ ] **Dashboard:** adicionar KPI "Tarefas pendentes/atrasadas" e painel "Tarefas do dia e atrasadas" (até 5 itens: descrição, obra, responsável, prazo, botão "Concluir" e link "Ver todas" → `showPage('tarefas')` com filtro aplicado).
- [ ] Coluna "Tarefas" do resumo por obra passa a ser clicável e abre `tarefas.html` já filtrada por aquela obra.
- [ ] Alertas de tarefa no `calcAlertas()`: prioridade alta, agrupados ("N tarefas atrasadas") e com reserva de slots para não serem engolidos pelo limite de 8 alertas.
- [ ] `renderHoje()`: incluir também tarefas **atrasadas**, não só as de hoje.
- [ ] Garantir que tarefas sem `obra` ou sem `prazo` apareçam no painel como "Geral"/"Sem prazo" (ou serem exigidas no `saveTarefa()`), para não desaparecerem do dashboard.
- [ ] Permissões: `encarregado` vê/conclui tarefas do dia (registro de obra, sem aprovação); `engenheiro` cria/edita. Atualizar os checks de role em `calcAlertas()`/`renderDashboard()` que hoje usam apenas `mestre`/`engenheiro`.

---

## 4. Arquivos a alterar (checklist)

### Frontend
- [ ] `public/modals/modal-usuario.html` — opções `Encarregado de Obra` e `Engenheiro` no `usr-role`; depois, opção do papel de compras (`Comprador`/`Almoxarife`) quando o nome for definido.
- [ ] `public/js/auth_core.js` — `setRestrictions()` com os dois papéis; `renderAdmin`/nav; badge de aprovações.
- [ ] `public/js/app_core.js` — `saveUsuario()`, `deleteUsuario()`, `saveMovimentacao*()`, `saveTrabalhador()`, `deleteTrabalhador()` e `saveFinanceiro()` com o desvio para solicitação; funções `carregarAprovacoes()`, `aprovarSolicitacao()`, `rejeitarSolicitacao()`, `registrarAuditoriaOperacional()`; aceite de `movimentacao_estoque` pelo Engenheiro com gravação de `decididoPorPapel`/`notificarAdmin`.
- [ ] `public/modals/modal-financeiro.html` — modo "Enviar para aprovação" para `engenheiro`.
- [ ] `public/pages/financeiro.html` — status de aprovação e ocultação de dados sensíveis.
- [ ] `public/pages/admin.html` — tabela de aprovações pendentes + badge de notificações de decisões tomadas pelo Engenheiro.
- [ ] `public/modals/modal-aprovacao.html` (novo) — revisão da solicitação, com restrição de `tipo` para `engenheiro`.
- [ ] `public/pages/orcamento.html`, `public/pages/financeiro.html` e `public/pages/compras.html` — separar claramente Empreitadas/Aditivos de Compras (títulos, filtros e na navegação).
- [ ] `public/modals/modal-compra.html` — esconder campos sensíveis por papel, manter cabeçalho padrão e botão "Ver evidência".
- [ ] `public/js/app_core.js` — `saveCompra()`/`editCompra()`/`renderCompras()` role-aware; corrigir total de colunas e vincular `evidenciaId`/`fotoIds`.
- [ ] `public/pages/compras.html` — alinhar `<th>` com `<td>`, coluna "Recebido?" (`receb` + `conf`), sem valores/fornecedor/prazo para `engenheiro`/`encarregado`.
- [ ] `public/pages/fotos.html` — filtro/parâmetro por obra/etapa para abrir a evidência vinculada à compra (ou `public/pages/evidencias.html` novo, se criado).
- [ ] `public/pages/almocos.html` — quadro semanal navegável, toolbar com busca/grupo/ordenação iguais a `presenca.html`, fechamentos por empreiteiro e pagamentos pendentes, CSS responsivo.
- [ ] `public/js/app_core.js` — `changeAlmocoWeek()`, `renderQuadroAlmocos()`, `openAlmocoModal()`, `filterAlmoco()` e KPIs por semana; `renderAlmocos()` passa a respeitar grupo/ordenação.
- [ ] `public/pages/tarefas.html` — toolbar com filtros (status, prioridade, responsável, vencidas, minhas), botão limpar e opções de ordenação/agrupamento; ações rápidas e "+ Nova" por coluna no kanban.
- [ ] `public/js/app_core.js` — `renderTarefas()` com filtros/ordenação/agrupamento e ações rápidas; `renderDashboard()` com KPI e painel de tarefas, coluna clicável; `renderHoje()` inclui atrasadas; `setTaskView()` preserva filtros.
- [ ] `public/js/utils.module.js` — `calcAlertas()`: tarefas atrasadas agrupadas, prioridade alta e slots reservados; expor dados para o painel do dashboard.
- [ ] `public/css/app.css` — estilos do badge e da tabela de aprovações, do painel de tarefas do dashboard, dos destaques de atraso/vence hoje e do drag-and-drop do kanban.
- [ ] `public/app.html` — bump de cache-busting dos JS/CSS alterados.

### Backend
- [ ] `database.rules.json` — nós `aprovacoes`, `auditoria`, `notificacoes`, `comprasPrivadas` e checagem de `role` nos nós bloqueados (incluir `financeiro`, `orcamento`, `compras`, `medicao` para `engenheiro`; permitir `engenheiro` decidir apenas `movimentacao_estoque`; negar leitura de campos comerciais a `engenheiro`/`encarregado`).
- [ ] `functions/aprovacoes.js` (novo) — aplicação das aprovações (todos os `tipo` listados), auditoria e notificação in-app ao admin quando o Engenheiro decide.
- [ ] `functions/index.js` — export da function de aplicação e do job diário de alertas/expiração.
- [ ] `functions/index.js` (`syncCustomClaims`) — papel canônico `encarregado`, `mestre` como alias legado por um release, `engenheiro` e (quando criado) `comprador`/`almoxarife`; impedir escalada para admin.
- [ ] `firebase.json` — rewrite somente se a decisão for via HTTPS chamável (com trigger não é necessário).

### Testes e documentação
- [ ] `tests/security/rules.test.js` — negar escrita direta de `encarregado` em estoque/trabalhadores e de `engenheiro` em financeiro/orçamento/compras; permitir ambos criarem `aprovacoes` pendentes; admin decide qualquer `tipo`; `engenheiro` decide apenas `movimentacao_estoque` e é obrigado a sinalizar `notificarAdmin`.
- [ ] `tests/aprovacoes.test.js` (novo) — transição de status, idempotência, aplicação e auditoria para todos os tipos, inclusive `financeiro_status` e aceite de `movimentacao_estoque` pelo Engenheiro com notificação ao admin.
- [ ] `tests/aprovacoes-expiracao.test.js` (novo) — alertas em 7/12 dias, expiração em 15 dias, idempotência dos alertas, bloqueio de aplicação após expiração e não escalada de cargo via `mestre`/`encarregado`.
- [ ] `tests/dominios-separados.test.js` (novo) — empreitadas/aditivos (`orcamento` + `financeiro`) não aparecem como compras e vice-versa; solicitação de material/ferramenta aceita pelos dois papéis e decidida pelo Engenheiro.
- [ ] `tests/financeiro-aprovacao.test.js` (novo) — Engenheiro não grava em `financeiro`; status enviado é sempre `Pendente`; `valpago` só muda após aprovação; revalidação das regras de integridade na Function.
- [ ] `tests/compras-segregacao.test.js` (novo) — formulário/tabela sem campos sensíveis para `engenheiro`/`encarregado`; `saveCompra()` não persiste valores/fornecedor/PIX/prazo vindos desses papéis; `comprasPrivadas` ilegível para eles; colunas alinhadas; link de evidência presente.
- [ ] `tests/almocos-usabilidade.test.js` (novo) — quadro semanal com navegação, clique pré-preenchido, filtros/grupo/ordenação, fechamentos e responsividade equivalentes a `presenca.html`.
- [ ] `tests/tarefas-dashboard.test.js` (novo) — filtros/ordenação/agrupamento, ações rápidas, drag-and-drop, KPI e painel de tarefas no dashboard, coluna clicável por obra, alertas agrupados e `renderHoje()` com atrasadas.
- [ ] `tests/auth-credentials.test.js` ou novo teste de papel — opções `encarregado` e `engenheiro` no modal e nav correta para cada um.
- [ ] `CHANGELOG.md` — entrada na próxima versão.

---

## 5. Critérios de aceitação

1. [ ] Login como Encarregado mostra apenas Hoje/Registro, Presença, Fotos, Tarefas e Obras (somente leitura); tentar acessar Financeiro/Administração por URL é bloqueado no cliente **e** no backend.
2. [ ] Encarregado registra ponto, foto e tarefa normalmente (registro de obra): **sem aprovação**; cada escrita gera entrada em `auditoria`.
3. [ ] Encarregado tenta movimentar material: ação vira solicitação pendente; **nenhuma** mudança aparece em `estoque`/`movEstoque`.
4. [ ] Encarregado tenta adicionar/remover trabalhador: mesma coisa; `DB.trabalhadores` não muda.
5. [ ] Admin aprova: Cloud Function aplica a operação exatamente uma vez, grava `aplicadoEm` e o antes/depois na auditoria.
6. [ ] Admin rejeita: nada é aplicado; solicitante vê o motivo.
7. [ ] Encarregado não consegue aprovar a própria solicitação, alterar `status` via console, nem escalar para `admin`.
8. [ ] Login como Engenheiro mostra obras, medições, tarefas, fotos, relatórios, empreitadas/aditivos, compras (modo solicitação) e estoque (solicitar/aceitar); `financeiro` aparece apenas em modo solicitação.
9. [ ] Engenheiro preenche um lançamento: `DB.financeiro` **não** muda, nasce uma solicitação `financeiro_lancamento` com `status = 'Pendente'` e `valpago = 0`.
10. [ ] Engenheiro tenta marcar "Pago" diretamente: bloqueado no front e nas rules; somente a aprovação do admin altera o status e o `valpago` com as regras de integridade preservadas.
11. [ ] Dados bancários/PIX completos não aparecem para o Engenheiro em nenhuma tela.
12. [ ] Empreitadas/aditivos (`orcamento` + `financeiro`) aparecem separados de compras (`compras`) na navegação, nos filtros e nas rules; um lançamento de empreitada nunca vira pedido de compra e vice-versa.
13. [ ] Engenheiro solicita material/ferramenta: nasce `movimentacao_estoque` pendente, sem escrita em `estoque`/`movEstoque` até a decisão.
14. [ ] Engenheiro aceita solicitação de material/ferramenta (própria ou do Encarregado): operação aplicada uma vez, `decididoPorPapel = 'engenheiro'`, `notificarAdmin = true`, entrada em `auditoria` e notificação in-app visível ao admin.
15. [ ] Engenheiro tenta decidir solicitação de trabalhador, financeira, orçamento, compra ou medição: bloqueado no front e nas rules; apenas o admin decide esses `tipo`s.
16. [ ] Admin continua podendo aprovar/rejeitar qualquer solicitação, inclusive as criadas pelo Engenheiro.
17. [ ] Papel canônico `encarregado`: usuários novos são criados como `encarregado`; `mestre` funciona apenas como alias legado por um release e não escala para admin.
18. [ ] Solicitação pendente recebe alerta in-app aos 7 e 12 dias e expira automaticamente aos 15 dias, com `status = 'expirado'`, `expiradoEm` e aviso final ao solicitante e ao admin.
19. [ ] Solicitação expirada não é aplicada pela Cloud Function, não pode ser aprovada via console/rules e pode ser recriada pelo solicitante.
20. [ ] Compras: `engenheiro` e `encarregado` não veem valores (`vunit`/`vtotal`/`vorc`), prazo de entrega, chave PIX/forma de pagamento nem fornecedor — nem no formulário, nem na tabela, nem via Rules/console. Veem apenas nome, quantidade/unidade, data de recebimento, "conferido?", status e evidência.
21. [ ] Aprovação de compra continua exclusiva do admin; Engenheiro não aprova compra e Encarregado não cria pedido de compra.
22. [ ] Formulário de compras corrigido: colunas do `<thead>` batem com as células renderizadas, "Recebido?" mostra `receb` + `conf`, e o cabeçalho padrão `modal-header`/`modal-title` foi mantido.
23. [ ] Compra possui evidência vinculada (`evidenciaId`/`fotoIds`) e ação "Ver evidência" abre o registro em `fotos.html` filtrado por obra/etapa.
24. [ ] Almoços têm quadro semanal com navegação entre semanas; clicar numa célula abre `modal-almoco` com data e empreiteiro pré-preenchidos.
25. [ ] Lista de almoços tem busca por nome/obra/data, agrupamento (Por Empreiteiro / Por Obra / Lista Plana) e ordenação, equivalentes aos de Presença.
26. [ ] Almoços exibem fechamento por empreiteiro/trabalhador e pagamentos pendentes da semana, com KPIs acompanhando a semana selecionada.
27. [ ] Modal de almoço mantém modos Individual/Em Lote, "Marcar Todos", "Salvar e Próximo", cabeçalho padrão e layout responsivo igual ao de Presença.
28. [ ] Tarefas: filtros por status/prioridade/responsável/vencidas, ordenação, ações rápidas e drag-and-drop no kanban; atrasadas ficam destacadas em vermelho e "vence hoje" em laranja.
29. [ ] Dashboard mostra KPI de tarefas pendentes/atrasadas e painel "Tarefas do dia e atrasadas" com conclusão rápida e link "Ver todas"; a coluna "Tarefas" por obra abre a lista filtrada.
30. [ ] `renderHoje()` inclui tarefas atrasadas e os alertas de tarefa são agrupados/prioritários, sem serem engolidos pelo limite de 8 alertas.
31. [ ] `npm test -- --run` passa, incluindo os novos testes de regras, aprovação, expiração, compras, almoços, tarefas/dashboard, domínios separados e financeiro.

---

## 6. Riscos / notas

- **Escrita em lote:** `persistDB()` salva o `DB` inteiro no nó do tenant. Se o Encarregado tiver acesso a essa função, ele pode alterar qualquer array. É obrigatório bloquear `persistDB()` para o papel no cliente **e** reforçar nas rules (o cliente nunca é autoridade).
- **Concorrência:** duas aprovações para o mesmo item (ex.: mesmo trabalhador) podem conflitar. Usar transação e validar estado atual no trigger.
- **Auditoria × aprovação:** para **registro de obra** (ponto/fotos/tarefas) a auditoria é suficiente — não há aprovação, por decisão confirmada. Para estoque, trabalhadores, financeiro, orçamento e compras, auditoria não substitui a decisão de quem pode aprovar.
- **Finanças:** o Engenheiro enxerga valores previstos/realizados para trabalhar, mas a confirmação de pagamento é ato do admin. O trigger precisa revalidar integridade (`Pago` = total, `Pendente`/`Atrasado` = 0, `Parcial` = valor informado) porque a solicitação vem de um cliente, mesmo que as rules bloqueiem a escrita direta.
- **Concorrência financeira:** duas solicitações para o mesmo lançamento podem aprovar valores diferentes. Usar transação e validar o estado atual antes de aplicar; se divergir, marcar `status: 'erro'`.
- **Aceite pelo Engenheiro:** decisão do Engenheiro em `movimentacao_estoque` é final e aplicada pela Cloud Function; o admin **não** precisa contra-aprovar, apenas ser informado. As rules devem impedir que ele use esse poder para outros `tipo`s.
- **Notificações:** não existe serviço de e-mail no projeto; avisos de aprovação/rejeição, alertas de prazo e o aviso ao admin sobre decisão do Engenheiro devem ser in-app (badge/toast + nó `notificacoes`), como já feito para billing.
- **Alias `mestre`:** nunca criar usuário novo com `mestre`. O alias existe só para preservar sessões/claims antigos e deve ser removido no release seguinte; `syncCustomClaims` deve normalizar tudo para `encarregado`.
- **Expiração:** o job diário roda no backend, então o alerta chega mesmo com o app fechado (badge ao abrir). Expirar não apaga histórico: manter `aprovacoes/{id}` com `status: 'expirado'` para auditoria e permitir recriação.
- **Compras — vazamento por campo:** esconder um `<input>` no front **não** impede que o objeto venha do RTDB. `persistDB()` grava `DB.compras` inteiro; enquanto isso continuar, `engenheiro` pode ler `forn`/valores/PIX pelo console. Separar em `compras` + `comprasPrivadas` (com rules por papel) e parar de expor o objeto inteiro é obrigatório — não basta CSS/`hidden`.
- **Novo papel de compras:** criar `comprador`/`almoxarife` com claims próprios, sem herdar permissão de aprovar. Enquanto o papel não existir, apenas admin preenche os dados comerciais e aprova.
- **Evidências:** o Storage `tenants/{tenantId}/evidencias/` precisa de rules que deixem `encarregado`/`engenheiro` enviarem fotos da obra, mas não apagarem evidências de compras já conferidas.
