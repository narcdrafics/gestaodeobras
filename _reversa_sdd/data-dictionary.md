# Dicionário de Dados — obra-real (gestaodeobras)

> Gerado pelo **Arqueólogo** em 2026-11-27 · `doc_level = completo`
> 🟢 CONFIRMADO (código/rules) · 🟡 INFERIDO · 🔴 LACUNA
> Cobertura atual: `auth`, `tenants-e-slug`, `admin-e-super-admin`, `usuarios-e-cargos`, `aprovacoes`, `obras`, `tarefas`, `trabalhadores`, `presenca-e-ponto`, `almocos`, `compras`, `estoque`, `financeiro-e-pix`, `orcamento`, `medicao`, `relatorios-e-dashboard`, `fotos`, `billing-e-planos`, `whatsapp-bot`, `seguranca-e-rbac`, `infra-e-deploy` (21/21).

## 1. `Profile` — `profiles/<uid>` (Realtime Database) 🟢

| Campo | Tipo | Obrigatório | Default / regra | Origem |
|---|---|---|---|---|
| `uid` | string | sim | igual ao UID do Auth | `database.rules.json:13-15`; `auth_core.js:145` |
| `email` | string | sim | igual a `auth.token.email` na criação | `database.rules.json:16-18` |
| `name` | string | não | `email` ou `displayName` | `auth_core.js:148,271,294` |
| `role` | enum: `admin`, `rh`, `engenheiro`, `encarregado`, `comprador`, `pendente`, `desativado`, `bloqueado`, `super_admin` | sim | `admin` (cliente) | `database.rules.json:19-21`; `claims.js:21-24` |
| `tenantId` | string | não | — (cliente só pode gravar tenant próprio/convite) | `database.rules.json:22-24` |
| `status` | enum: `ativo`, `pendente`, `bloqueado` | não | `ativo` | `auth_core.js:280,301,341`; `index.js:629` |
| `modulosPermitidos` | objeto `{ [modulo]: boolean }` | não | `null` | `auth_core.js:133-140`; `index.js:792-805` |
| `acessoObras` | enum: `todas`, `especificas` | não | `todas` | `index.js:801` |
| `obrasPermitidas` | string[] (até 50) | não | `[]` | `index.js:802-805` |
| `lastLogin` | number (epoch ms) | não | `Date.now()` no login | `auth_core.js:359-361` |
| `cargoAtualizadoPor` | string | não | `syncCustomClaims` em correções | `index.js:750` |

**Regras de integridade:** `role` e `tenantId` são imutáveis para o cliente (`newData.val() === data.val()`), `status` só muda para `ativo` na criação pelo próprio usuário; promoções passam pelo servidor.

## 2. `users/<emailNormalizado>` — passaporte global 🟢

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| chave | string | sim | e-mail em minúsculas com `.` → `,` |
| `role` | string | não | usado apenas para **preservar** `super_admin` já existente nas claims |
| `tenantId` | string | não | tenant inicial na restauração de perfil |
| `nome` | string | não | fallback de `name` no self-healing |
| `bloqueado` | boolean | não | encerra sessão no login |

🟡 Espelho legado: não é fonte de autoridade para promoção (`claims.js:1-9`).

## 3. `invites/<emailNormalizado>` — convite 🟢

| Campo | Tipo | Obrigatório | Default / regra |
|---|---|---|---|
| `tenantId` | string | sim | precisa casar com `body.tenantId` na API |
| `role` | string | não | `engenheiro` (`auth_core.js:295`) |
| `usos` | number | não | `0`; transação atômica limita a 1 uso |

O convite é removido após consumo no primeiro login (`auth_core.js:303`).

## 4. `CustomClaims` (Firebase Auth) 🟢

| Claim | Tipo | Quando presente |
|---|---|---|
| `role` | string | sempre (`pendente`/`bloqueado` também são roles de bloqueio) |
| `tenantId` | string ou `null` | sempre; `null` para perfis pendentes/bloqueados e `MASTER_SYSTEM` para super_admin |
| `modulosPermitidos` | objeto | somente cargo `rh` |
| `acessoObras` | string | somente cargo `rh` |
| `obrasPermitidas` | string[] | somente cargo `rh` |

`setCustomUserClaims` substitui o objeto inteiro; as chaves de RH não existem para outros cargos (`index.js:807-809`).

## 5. `super_admins/<uid>` — allowlist 🟢

| Campo | Tipo | Observação |
|---|---|---|
| `uid` | string | — |
| `email` | string | precisa casar com o e-mail atual |
| `role` | string | `super_admin` |
| `ativo` | boolean | `false` revoga a autorização |
| `migradoEm` | number | preenchido na migração segura do legado |

## 6. Sessão local `sessionStorage.gestaoUser` 🟢

Espelho de `Profile` + `camposRhSessao` usado por `checkAuth`, `setRestrictions` e pelo sentinel `firebaseSync`. Removida em signOut, bloqueio ou falha de tenant.

## 7. `Tenant` — `tenants/<slug>` (privado) 🟢

| Campo | Tipo | Obrigatório | Default na criação |
|---|---|---|---|
| `nomeEmpresa` | string (≤80 após `cleanCompanyName`) | sim | "Minha Empresa" |
| `slug` | string `[a-z0-9]{3,30}` | sim | escolhido no onboarding |
| `subdominioSlug` | string | sim | igual ao slug |
| `emailAdmin` | string (e-mail) | sim | e-mail do criador |
| `status` | enum(`ativo`) | sim | `ativo` |
| `plano` | enum(`free_trial`, ...) | sim | `free_trial` |
| `webhookCriacao` | number (epoch ms) | sim | `now` |
| `trialExpiracao` | number (epoch ms) | sim | `now + 2.592.000.000` (30 dias) |
| `origem` | string | sim | `self_signup` |
| `criadoPorUid` | string | sim | UID do Auth |
| `config.nomeEmpresa` | string | sim | — |
| `config.slug` | string | sim | — |
| `config.esquemaCores` | string | sim | `emerald` |
| `config.limiteObras` | number | sim | `1` (imutável para o cliente) |
| `config.limiteUsuarios` | number | sim | `1` (imutável para o cliente) |
| `config.limiteTrabalhadores` | number | sim | `9999` |

Outros campos presentes no tenant em produção (inferidos das rules e do código): `billingState`, `adminPhone`, `planoVencimento`, `logoUrl`, `plano`.

## 8. `TenantPublic` — `tenants_public/<slug>` (leitura pública) 🟢

| Campo | Tipo | Regra |
|---|---|---|
| chave `$slug` | string | igual a `slug` |
| `slug` | string | obrigatório, igual à chave (`.validate`) |
| `tenantId` | string | obrigatório e não vazio; na criação self-signup deve ser igual ao slug |
| `nomeEmpresa` | string | usado no tema pré-login |
| `esquemaCores` | string | `emerald` por padrão |
| `logoUrl` | string | opcional, preenchido na troca de subdomínio |

`.read: true`; `.write` exige super_admin/allowlist ou membro do mesmo tenant com billing não bloqueado. Nós antigos sem `tenantId` são tratados como legado e resolvidos por `orderByChild('config/slug')`.

## 9. Constantes de slug 🟢

| Constante | Valor | Uso |
|---|---|---|
| `BASE_DOMAIN` / `ROOT_DOMAIN` | `obrareal.com` | URL do tenant e detecção de subdomínio |
| `MIN_LEN` / `MAX_LEN` | `3` / `30` | validação do endereço |
| `NAME_MAX_LEN` | `80` | nome da empresa |
| `TRIAL_MS` | `2.592.000.000` ms | 30 dias de free trial |
| `RESERVED` | ~45 slugs | bloqueia endereços de infraestrutura/marca |
| `ALLOWED_ORIGINS` (worker) | regex de `obrareal.com`, `.web.app`, `.firebaseapp.com` | CORS restrito |

## 10. `admin_audit/<pushId>` — trilha de auditoria 🟢

| Campo | Tipo | Observação |
|---|---|---|
| `timestamp` | number (epoch ms) | `Date.now()` no registro |
| `requestId` | string | externo (`x-request-id` ou `body.requestId`) ou `crypto.randomUUID()` |
| `roteiro` | string | `admin:conta`, `admin:cargo`, ... |
| `ipHash` | string | IP hashado (não armazena IP bruto) |
| `userAgent` | string | limitado a 200 caracteres |
| `duracaoMs` | number | duração da requisição |
| `atorUid` / `atorEmail` | string / null | `null` em tentativas sem token válido |
| `acao` | string | até 64 caracteres; `desconhecida` por padrão |
| `alvo` | string | até 300 caracteres (tenantId/e-mail/UID) |
| `sucesso` | boolean | `false` também em falhas de autenticação |
| `detalhes` | string | até 300 caracteres; **nunca contém o link de senha** |

`.read` restrito a super_admin/allowlist/e-mail mestre; `.write` negado ao cliente (somente Admin SDK).

## 11. `admin_ops/<requestId>` — reserva de operação destrutiva 🟢

| Campo | Tipo | Observação |
|---|---|---|
| chave | string | `requestId` sanitizado `[A-Za-z0-9_-]` |
| `acao` | string | ação reservada |
| `alvo` | string | tenant/e-mail/UID |
| `atorUid` | string | UID do mestre |
| `reservadoEm` | number (epoch ms) | usada pelo job de retenção |

Escrita via `transaction`: segunda entrega com o mesmo `requestId` retorna `committed:false`. A reserva é removida somente se a ação falhou antes do efeito.

## 12. `super_admins/<uid>` — allowlist canônica (detalhamento) 🟢

| Campo | Tipo | Observação |
|---|---|---|
| `uid` | string | UID do Firebase Auth |
| `email` | string | precisa casar com o e-mail atual |
| `role` | string | `super_admin` |
| `origem` | string | `bootstrap_manual`, `legado_migrado`, ... |
| `ativo` | boolean | `false` revoga a autorização |
| `migradoEm` | number | preenchido na migração segura do legado |

As rules permitem leitura/escrita ao próprio master, à allowlist ativa e ao e-mail mestre; validações impedem que o cliente altere `role`/`tenantId` de terceiros.

## 13. `tenants/<id>` — campos de billing/status escritos pelo painel 🟢

| Campo | Tipo | Valor ao aplicar plano | Valor ao bloquear empresa |
|---|---|---|---|
| `plano` | string | plano normalizado | (inalterado) |
| `planoVencimento` | number | `now + dias * 86400000` | (inalterado) |
| `trialExpiracao` | number | preenchido se `free_trial` | (inalterado) |
| `status` | string | `ativo` | `bloqueado_pagamento` / `ativo` |
| `billingState` | string | `ativo` | `bloqueado` / `ativo` |
| `billingStateMotivo` | string | `ajuste_manual_master` | `bloqueio_manual_master` / `liberacao_manual_master` |
| `billingStateAtualizadoEm` | number | `now` | `now` |
| `origemAtivacao` | string | `painel_master` | (inalterado) |
| `carenciaAte` / `motivoBloqueio` / `dataBloqueio` / `cancelamentoAgendado` / `dataCancelamento` / `avisoCarencia` | various | `null` | `motivoBloqueio`/`dataBloqueio` preenchidos no bloqueio |
| `config.limiteObras` / `config.limiteUsuarios` / `config.limiteTrabalhadores` | number | limites mesclados do plano | (inalterado) |

## 14. `PlanoCatalogo` — catálogo canônico em código (`plan_catalog.js`) 🟢

| Id | Família | Limites (obras/usuários/trabalhadores) | Dias padrão |
|---|---|---|---|
| `free_trial` | trial | 1 / 1 / 9999 | 30 |
| `start`, `start_anual` | start | 2 / 2 / 9999 | 31 / 365 |
| `pro`, `pro_anual`, `premium` | pro | 5 / 5 / 9999 | 31 / 365 / 31 |
| `ilimitado`, `ilimitado_anual`, `full_anual` | ilimitado | 9999 / 9999 / 9999 | 31 / 365 / 365 |
| `master`, `MASTER_SYSTEM` | ilimitado/sistema | 9999 / 9999 / 9999 | 3650 |

Aliases aceitos: `full`, `ilimitadoanual`, `startanual`, `proanual`, `mastersystem`. Checkouts em `pay.kiwify.com.br` para start/pro/ilimitado.

## 15. Ações da API `/api/admin/conta` 🟢

| Ação (POST) | Efeito principal | Destrutiva (auditoria obrigatória + reserva) |
|---|---|---|
| `reset_password` | gera link no Auth, sem gravá-lo | não |
| `bloquear_usuario` | `disabled` no Auth + revoga tokens + status no perfil | sim |
| `excluir_usuario` | apaga perfil, passaporte, convite, allowlist e conta Auth | sim |
| `definir_limites` | grava os 3 limites em `config` | não |
| `definir_plano` | plano, validade, limites e limpeza de bloqueios | sim |
| `bloquear_tenant` | status/billing da empresa | sim |

Recursos GET (`?tipo=`): `products`, `sales`, `account`, `webhooks` (`kiwify_api.js`).

---

## 16. `Cargo` — campos de cargo em `profiles/<uid>` (detalhamento) 🟢

| Campo | Tipo | Obrigatório | Default / regra | Origem |
|---|---|---|---|---|
| `role` | enum | sim | `pendente` quando criado pelo servidor sem cargo | `cargos.js:11-12` |
| `tenantId` | string \| null | não | tenant do chamador (master escolhe) | `cargos.js:154-274` |
| `status` | enum: `ativo`, `bloqueado` | não | `ativo` (`desativado`/`bloqueado` ⇒ `bloqueado`) | `cargos.js:207` |
| `name` | string (≤120) | não | preservado se ausente | `cargos.js:209` |
| `cargoAtualizadoEm` | number (epoch ms) | não | `Date.now()` no servidor | `cargos.js:212` |
| `cargoAtualizadoPor` | string | não | UID/e-mail do chamador, nunca do corpo | `cargos.js:213` |
| `modulosPermitidos` | objeto \| null | não | `null` fora do cargo `rh` | `cargos.js:23-38` |
| `acessoObras` | enum: `todas`, `especificas` \| null | não | `null` fora do cargo `rh` | `cargos.js:222` |
| `obrasPermitidas` | string[] (≤500) \| null | não | `[]` quando `acessoObras = 'todas'` | `cargos.js:223` |

Hierarquia: `ROLES_TENANT = {admin, rh, engenheiro, encarregado, comprador, pendente}`; `ROLES_MASTER = ROLES_TENANT + {super_admin, desativado, bloqueado}`. Alias legado `mestre` é normalizado para `encarregado` (`claims.js`). `profiles/<uid>` é a **autoridade**; `users/<emailKey>` e `invites/<emailKey>` são espelhos gravados na mesma operação.

## 17. `PermissoesRH` — `modulosPermitidos` + escopo de obras 🟢

| Chave | Tipo | Observação |
|---|---|---|
| `funcionarios`, `presenca`, `almocos`, `tarefas`, `obras`, `medicao`, `estoque`, `compras`, `financeiro`, `orcamento`, `aprovacoes` | boolean | whitelist `MODULOS_RH` (11 chaves, `cargos.js:16-21`) |

- `MODULOS_RH_PADRAO = {funcionarios:true, presenca:true, almocos:true}` quando a entrada é nula/inválida para o cargo `rh`.
- `normalizarModulosRh(valor, cargo)`: retorna `null` se `cargo !== 'rh'` (nada é gravado); ignora arrays, chaves fora da whitelist e qualquer valor que não seja estritamente `true` — o que bloqueia `__proto__` e `constructor`.
- Escopo de obras: `acessoObras = 'todas'` (sem filtro) ou `'especificas'` com até 500 ids em `obrasPermitidas`.
- Propagação: perfil → passaporte `users/<email>` → convite `invites/<email>` → `syncCustomClaims` → cliente (`setRestrictions`) e decisões de aprovação (`aprovacoes-api.js`), todos com a mesma chave de módulo.

## 18. `Convite` — `invites/<emailNormalizado>` (detalhamento) 🟢

| Campo | Tipo | Observação |
|---|---|---|
| `email` | string | e-mail convidado (normalizado na chave: minúsculas, `.` → `,`) |
| `tenantId` | string | precisa casar com `body.tenantId` na criação da credencial |
| `role` | string | cargo pretendido; espelhado quando o cargo é alterado no servidor |
| `nomeEmpresa` | string | exibido no convite |
| `usos` | number | `0` na criação; transação atômica `0 → 1` impede reuso |
| `modulosPermitidos` / `acessoObras` / `obrasPermitidas` | object / string / string[] | espelhos das permissões RH definidas no servidor |

Convites órfãos são removidos pelo cliente em erros fatais de criação de credencial; em falha transitória o convite permanece para o usuário definir a senha no primeiro acesso.

## 19. `CargoAction` — contrato da API `/api/admin/cargo` 🟢

| Ação | Corpo | Efeitos |
|---|---|---|
| `definir_cargo` | `{acao, uid?\|email?, role, tenantId?, modulosPermitidos?, acessoObras?, obrasPermitidas?}` | escreve `profiles`, espelha `users`/`invites`, ajusta `super_admins/<uid>` e revoga tokens |
| `remover_usuario` | `{acao, uid?\|email?}` | desvincula do tenant (`role=desativado`, `tenantId=null`, `status=bloqueado`), limpa espelhos, remove da lista `tenants/<tid>/usuarios`, desabilita a conta Auth |

**Validações do servidor:** token com `checkRevoked`; papel do chamador reconfirmado em Auth + perfil + allowlist; alvo nunca é o próprio chamador; `role` obrigatório (sem default para `admin`); não-master não pode promover a `super_admin` (403 antes da whitelist) nem cruzar tenant; e-mail ≤254, nome ≤120, tenantId ≤128, UID `^[A-Za-z0-9_-]{1,128}$`; cotas IP/UID de 60/min.

**Códigos de erro:** `nao_autenticado`, `token_invalido`, `sem_permissao`, `auto_alteracao`, `cargo_obrigatorio`, `cargo_invalido`, `alvo_inexistente`, `tenant_invalido`, `metodo_nao_permitido`, `auditoria_falhou`.

## 20. `CredencialTemporaria` — resposta de `/api/admin/criar-usuario` 🟢

| Campo | Tipo | Observação |
|---|---|---|
| `uid` | string | UID criado ou reaproveitado no Firebase Auth |
| `email` | string | e-mail da conta |
| `password` | string | 12 caracteres de 4 classes, Fisher-Yates com `crypto.randomInt` |
| `criado` | boolean | `true` se a conta foi criada; `false` se apenas reativada |

O corpo da requisição exige `email`, `nome`, `tenantId` e um convite válido para o mesmo tenant. A senha **nunca** é gravada no Realtime Database — é devolvida apenas na resposta autenticada e exibida no `modal-credenciais-usuario.html` com aviso de troca no primeiro acesso. Em caso de falha de Auth, a reserva do convite (`usos: 0 → 1`) é revertida.

---

## 21. `Aprovacao` — `tenants/<tenantId>/aprovacoes/<pushId>` 🟢

| Campo | Tipo | Obrigatório | Default / regra | Origem |
|---|---|---|---|---|
| `id` | string | sim | igual à chave do nó | `aprovacoes_ui.js:248-259` |
| `tipo` | enum (8 tipos) | sim | — | `aprovacoes.js:41-50` |
| `status` | enum: `pendente`, `aprovado`, `rejeitado`, `expirado`, `erro` | sim | `pendente` | `database.rules.json:140-142` |
| `solicitadoPor` | string (UID) | sim | — | cliente |
| `solicitadoEm` | number (epoch ms) | sim | `Date.now()` | cliente |
| `expiraEm` | number (epoch ms) | sim | `solicitadoEm + 1296000000` (15 dias) | cliente, validado nas rules |
| `descricao` | string | não | rótulo do tipo | cliente |
| `payload` | objeto | sim | — | cliente (efeito preparado) |
| `alvo` | string | não | `''` | cliente |
| `decididoPor` / `decididoEm` / `decididoPorPapel` | string / number / string | não | gravados pela API | `aprovacoes-api.js:199-204` |
| `decididoPorModulos` | objeto | não | somente se decisor `rh` | `aprovacoes-api.js:207-209` |
| `motivo` | string (≤500) | não | obrigatório na rejeição | API / `marcarFalha` |
| `notificarAdmin` | boolean | não | `true` quando o engenheiro decide | API |
| `alertas` | objeto `{7,12,15: epoch ms}` | não | `{}` | job diário |
| `reservadoEm` / `aplicadoEm` / `expiradoEm` / `falhaEm` | number \| null | não | — | trigger/job |

`.write` negado no nó raiz; as rules só permitem a **criação** (`!data.exists()`) por membro do tenant com papel compatível e `expiraEm` exato. Decisão e aplicação são feitas somente com Admin SDK.

## 22. `AprovacaoDecision` — contrato da decisão 🟢

| Regra | Detalhe |
|---|---|
| Corpo | `{tenantId, aprovacaoId, decisao: 'aprovado'|'rejeitado', motivo?}` |
| Decisão inválida | `400 decisao_invalida`; rejeição sem motivo ⇒ `400 motivo_obrigatorio` |
| Estado da solicitação | inexistente ⇒ `404`; já decidida/expirada/aplicada ⇒ `409` |
| Billing | `billingState = somente_leitura|bloqueado` ⇒ `403 plano_bloqueado` |
| Tenant | perfil com `tenantId` diferente ⇒ `403 tenant_invalido` (master é exceção) |
| Autoridade | admin/super_admin/`emailAdmin`; RH com `aprovacoes` + módulo do tipo; engenheiro em `movimentacao_estoque` com `notificarAdmin` |
| Concorrência | transação no nó; perdedor ⇒ `409 ja_decidida` |

Mapeamento tipo → módulo RH: `movimentacao_estoque→estoque`, `trabalhador_*→funcionarios`, `financeiro_*→financeiro`, `orcamento_fechamento→orcamento`, `compra_criacao→compras`, `medicao_fechamento→medicao`.

## 23. `AprovacaoNotification` — `notificacoes/<tenantId>/<uid>/<pushId>` 🟢

| Campo | Tipo | Observação |
|---|---|---|
| `id` | string | chave do push |
| `tipo` | enum | `aprovacao_decidida`, `decisao_engenheiro`, `aprovacao_prazo`, `aprovacao_expirando`, `aprovacao_expirada`, `aprovacao_erro` |
| `titulo` / `mensagem` | string | texto exibido no badge/painel |
| `aprovacaoId` | string \| null | solicitação relacionada |
| `paraAdmin` | boolean | marca aviso destinado aos administradores |
| `lido` | boolean | gravado como `false`; o cliente usa `sessionStorage` para "visto" |
| `uid` | string | destinatário (faz parte do caminho para a rules) |
| `criadoEm` | number (epoch ms) | usado no filtro de não lidas |

Uma cópia por destinatário;admins são descobertos varrendo `profiles` por `tenantId` e `role`.

## 24. `AprovacaoAudit` — `auditoria/<tenantId>/<pushId>` 🟢

| Campo | Tipo | Observação |
|---|---|---|
| `acao` | string | tipo da solicitação |
| `aprovacaoId` | string \| null | ID da solicitação |
| `ator` / `atorRole` | string / string \| null | decisor e papel efetivo normalizado |
| `solicitadoPor` | string \| null | autor da solicitação |
| `alvo` | string | alvo da operação ou resumo dos efeitos |
| `antes` / `depois` | objeto serializado (≤4000 chars) | estado anterior/posterior |
| `criadoEm` | number (epoch ms) | quando a aplicação foi gravada |

Somente Admin SDK escreve; a decisão em si também gera entrada em `admin_audit` (`acao = decidir_aprovacao`).

## 25. `CompraPrivada` — `comprasPrivadas/<tenantId>/<compraId>` 🟢

| Campo | Tipo | Observação |
|---|---|---|
| `forn` | string | fornecedor |
| `pixkey` | string | chave Pix |
| `vunit` / `vtotal` / `vorc` | number | valores unitário/total/orçado |
| `prazo` | string | prazo de entrega |
| `compraId` | string | ID da compra pública |
| `aprovacaoId` | string | aprovação que criou a compra |
| `criadoEm` | number (epoch ms) | timestamp da aplicação |

Fica fora de `tenants/<id>` porque uma rule de pai não pode revogar o `.read` de um filho; o registro público em `compras` nunca contém esses campos.

## 26. Efeitos aplicados por tipo 🟢

| Tipo | Efeito principal | Validação de integridade |
|---|---|---|
| `movimentacao_estoque` | estoque + `movEstoque` (entrada/saída/retorno/transferência) | saldo suficiente para saída/transferência; destino diferente da origem |
| `trabalhador_add` | insere trabalhador | `cod`+`nome` obrigatórios, código duplicado bloqueado |
| `trabalhador_remove` | remove da lista | código existente |
| `financeiro_lancamento` | insere/edita lançamento | obra+descrição, valor > 0, nasce `Pendente` com `valpago=0` |
| `financeiro_status` | altera status e valor pago | status em `{Pago,Parcial,Pendente,Atrasado}`; `Parcial` limitado ao total |
| `orcamento_fechamento` | insere/edita item | `vtotal = qtd * vunit`, marca `aprovadoPor`/`aprovadoEm` |
| `compra_criacao` | compra pública + `comprasPrivadas` | material+qtd > 0; campos sensíveis removidos do público |
| `medicao_fechamento` | insere/edita medição | `vtotal = qreal * vunit`, marca aprovação |

---

## 27. `Obra` — `tenants/<tenantId>/obras[]` 🟢

| Campo | Tipo | Obrigatório | Default / regra | Origem |
|---|---|---|---|---|
| `cod` | string | sim | — (único dentro do tenant) | `modal-obra.html:4`; `saveObra:6191-6196` |
| `nome` | string | não | `''` | modal |
| `end` | string | não | `''` | modal |
| `tipo` | enum: `Casa`, `Sobrado`, `Comercial`, `Reforma` | não | `Casa` | modal |
| `status` | enum: `Planejada`, `Em andamento`, `Concluída`, `Pausada` | não | `Planejada` | modal |
| `inicio` / `prazo` | string `YYYY-MM-DD` | não | `''` | modal |
| `orc` | number | não | `0` | modal |
| `mestre` / `eng` | string | não | `''` | modal |
| `cliente` / `cliente_contato` | string | não | `''` | modal |
| `contrato_tipo` | enum (4 opções) | não | `Administração` | modal |
| `obs` | string | não | `''` | modal |

O `cod` é a chave de relacionamento usada por tarefas,financeiro,presença,almocos,estoque,compras,orcamento,medicao. Limite de registros por plano: `getPlanLimits().obras` (free_trial = 1).

## 28. `ObraScope` — acesso por obra no cliente 🟢

| Campo | Tipo | Observação |
|---|---|---|
| `acessoObras` | enum: `todas`, `especificas` | gravado em `usuarios[]`/`profiles` pelo módulo de usuários |
| `obrasPermitidas` | string[] | códigos de obra; lista vazia = falha fechada |
| `OBRA_SCOPED_KEYS` | string[] | `presenca, tarefas, estoque, movEstoque, compras, financeiro, orcamento, medicao, almocos` |

`null` (admin/super_admin ou usuário sem restrição) = todas as obras. `filterDbByObras` filtra na carga; `mergeScopedDb` remonta os arrays na gravação a partir de `lastTenantData`, retornando `null` se o snapshot completo não existir. A ficha do trabalhador usa `obras` em texto livre (`OB1, OB2`) ou array migrado, com comparação exata de códigos.

## 29. `ObraMetrics` — indicadores derivados (sem persistência) 🟢

| Métrica | Cálculo | Uso |
|---|---|---|
| `progressoFisico` | média de `tarefas[].perc` da obra | barra do card (verde >70%, âmbar >30%, laranja ≤30%) |
| `fReal` | soma de `financeiro[].real` da obra | custo acumulado |
| `pctCusto` | `fReal / orc * 100` (0 se `orc <= 0`) | destaque em vermelho se `fReal > orc` |
| `presentesHoje` | contagem de `presenca` com `data = hoje` e `presenca = 'Presente'` | resumo WhatsApp |
| `tarefasConcluidas` | contagem de `tarefas[].status === 'Concluída'` | resumo WhatsApp |

## 30. Matriz de acesso à escrita em `obras` 🟢

| Papel | Condição | Resultado |
|---|---|---|
| super_admin / e-mail mestre | — | permite |
| admin / `emailAdmin` do tenant | mesmo tenant + billing ativo | permite |
| engenheiro | mesmo tenant + billing ativo | permite |
| rh | mesmo tenant + billing ativo + `modulosPermitidos.obras === true` (claim ou perfil) | permite |
| demais | — | `PERMISSION_DENIED` |

🔴 O filtro por obra é de UX no cliente; as rules autorizam a escrita em todo o nó `obras` do tenant, não por código de obra.

---

## 31. `Tarefa` — `tenants/<tenantId>/tarefas[]` 🟢

| Campo | Tipo | Obrigatório | Default / regra | Origem |
|---|---|---|---|---|
| `cod` | string | sim | `nextCod(DB.tarefas, 'TF')`, somente leitura no modal | `app_core.js:5881`; `modal-tarefa.html:4` |
| `obra` | string (código) | sim | primeira obra do escopo, quando há apenas uma | `modal-tarefa.html:5`; `app_core.js:40-73` |
| `etapa` / `frente` | string | não | `''` | modal `:6-7` |
| `desc` | string | não (`*` no modal) | `''` — usada como legenda das fotos | modal `:8` |
| `resp` | string | não | `''`; WhatsApp usa `Equipe` | modal `:9`; `parser-tarefas.js:77` |
| `prior` | enum: `Alta`, `Média`, `Baixa` | não | `Alta` (primeira opção) | modal `:10-11`; `saveTarefa:6972` |
| `status` | enum: `A fazer`, `Em andamento`, `Concluída`, `Atrasada`, `Pausada` (+ `Pendente` legado) | não | `A fazer` | modal `:12-13`; `tarefaStatusEfetivo:1971` |
| `criacao` | string `YYYY-MM-DD` | não | `''` | modal `:14` |
| `prazo` | string `YYYY-MM-DD` \\| null | não | `''` | modal `:15`; WhatsApp `null` |
| `conclusao` | string `YYYY-MM-DD` | não | `''` | modal `:16`; ações rápidas |
| `perc` | number 0–100 | não | `0` | modal `:17`; `saveTarefa:6977` |
| `obs` | string | não | `''` | modal `:18` |
| `photos` | string[] (URLs) | não | `[]` | `handleTarefaPhotos:8182`; `saveTarefa:6979` |
| `photoUrl` | string | não | `photos[0] \\| ''` (compatibilidade legada) | `saveTarefa:6978` |
| `foto` | string | não | campo legado; lido por `taskPhotoList` | `app_core.js:8151` |
| `etapaCodigo` / `prioridade` / `criadoEm` / `criadoPor` / `createdVia` | vários | não | gravados apenas pelo fluxo WhatsApp | `parser-tarefas.js:70-82` |
| `atrasada` / `venceHoje` / `obraNome` / `_idx` | boolean / string / number | não | derivados, **não persistidos** | `calcTarefasResumo:993-1002`; `renderTarefas:1892` |

O array é gravado no nó inteiro do tenant via `persistDB()` (`.update()` com caminhos explícitos e `mergeScopedDb` para usuários com escopo restrito).

## 32. `TarefaRascunhoWhatsApp` — `tenants/<tenantId>/tarefas_pendentes/<from>` 🟢

| Campo | Tipo | Observação |
|---|---|---|
| `<from>` | string (remetente) | chave do rascunho; uma pendência por remetente |
| `transcricao` | string | texto original do áudio/transcrição |
| `tarefas` | array | itens com `titulo`, `etapa`, `etapaCodigo`, `frente`, `prioridade`, `status`, `confianca`, `createdVia` |
| `timestamp` | number (epoch ms) | quando o rascunho foi criado |

Ciclo: `handleAudioTarefas` cria → `buildConfirmacaoPreview` mostra opções → `CONFIRMAR` persiste em `tarefas` e remove o rascunho; `EDITAR n texto` recalcula etapa/prioridade; `CANCELAR` remove. 🔴 Fato: as rules declaram `tarefas_pendentes` como nó raiz, mas o parser usa `tenants/<tid>` (Admin SDK). 🟢 Decisões P2/P4: ativar prévia/confirmação com gravação direta em `tarefas`, sem `tarefas_pendentes`.

## 33. `TarefaFoto` — evidências da tarefa 🟢

| Campo / caminho | Tipo | Observação |
|---|---|---|
| `tenants/<tid>/evidencias/<timestamp>_<nome>` | Firebase Storage | alvo de `uploadEvidenceFile`; nome sanitizado `[^a-zA-Z0-9.]` → `_` |
| URL retornada | string `https://...` | gravada em `tarefas[].photos[]` |
| `data:image/...` | string | fallback local quando o Storage falha (também em `localStorage`) |
| legenda | string | `desc` quando há 1 foto; `desc · Foto n/N` quando há várias |

`MAX_TAREFA_FOTOS = 6`; otimização `maxDim = 1280`, `quality = 0.75`. A leitura aceita `photos[]`, `photoUrl` ou `foto` e filtra apenas URLs `http(s)`/`data:image`. Na impressão, `.audit-task-photo-card` evita quebra interna; `#sec-fotos-tarefas` pode quebrar entre páginas.

## 34. `TarefaResumo` — derivado para dashboard (sem persistência) 🟢

| Métrica | Cálculo | Origem |
|---|---|---|
| `hoje` | `hoje \|\| hojeLocal()` | `utils.module.js:988` |
| `abertas` | `tarefas.filter(status !== 'Concluída').length` | `:1006` |
| `atrasadas` | itens com `prazo < hoje` | `:998`,`:1007` |
| `vencemHoje` | itens com `prazo === hoje` | `:999`,`:1008` |
| `itens` | abertas com prazo, ordenadas por prazo e atrasadas primeiro, com `obraNome` | `:993-1002` |
| alertas | `TAREFA ATRASADA` (1 alerta alto agrupado) e `TAREFA HOJE` (1 alerta médio por tarefa) | `calcDashboardResumo:1108-1109` |
| por obra | `tarefasFeitas` / `tarefasTotal` | `calcDashboardResumo:1091-1100` |

🟢 Tarefas concluídas nunca entram em `itens`, mesmo com prazo vencido.

## 35. `StatusEfetivo` — normalização de status 🟢

| Entrada | Resultado efetivo | Regra |
|---|---|---|
| `Concluída` | `Concluída` | nunca é considerada atrasada |
| qualquer status + `prazo < getTodayBR()` | `Atrasada` | inferido, sem gravar no banco |
| `Pendente` (legado) | `Pendente` | tratado como `A fazer` nos filtros da UI |
| `''` / ausente | `A fazer` | default de exibição |
| `Em andamento`, `Pausada`, `Atrasada` gravadas | o próprio valor | quando o prazo não a antecipa |

`getTodayBR()` usa `America/Sao_Paulo` e formato `YYYY-MM-DD` (`app_core.js:243-247`).

## 36. Matriz de acesso a `tarefas` 🟢

| Papel | Condição | Resultado |
|---|---|---|
| super_admin / e-mail mestre | — | permite escrita |
| admin / `emailAdmin` do tenant | mesmo tenant + billing ≠ `somente_leitura`/`bloqueado` | permite |
| encarregado / `mestre` | idem | permite |
| engenheiro | idem | permite |
| rh | idem + `modulosPermitidos.tarefas === true` (claim ou perfil) | permite |
| demais | — | `PERMISSION_DENIED` |

Rascunhos `tarefas_pendentes/<tid>`: leitura exige mesmo tenant com billing ≠ `bloqueado`; escrita exige billing ≠ `somente_leitura` e ≠ `bloqueado`, além de super_admin/e-mail mestre. 🔴 O caminho usado pelo parser está sob `tenants/<tid>` e é gravado com Admin SDK, fora da validação dessas rules.

---

## 37. `Trabalhador` — `tenants/<tenantId>/trabalhadores[]` 🟢

| Campo | Tipo | Obrigatório | Default / regra | Origem |
|---|---|---|---|---|
| `cod` | string | sim | digitado; **único** no tenant (ignora o registro em edição) | `modal-trabalhador.html:5-6`; `saveTrabalhador:6254-6259` |
| `nome` | string | sim (\* no modal) | `''` | modal `:7`; `saveTrabalhador:6273` |
| `cpf` | string | não | `''`; texto livre com placeholder `***.456.789-**` | modal `:9-10` |
| `funcao` | string | não | `''` (ex.: `Pedreiro`) | modal `:11-12` |
| `vinculo` | enum: `CLT`, `Informal`, `Empreiteiro` | não | `CLT` (primeira opção) | modal `:13-19` |
| `equipe` | string | não | `''` (ex.: `Própria`) | modal `:20-21` |
| `obras` | string (CSV) ou `string[]` legado | não | `''`; ver §38 | modal `:22-25`; `saveTrabalhador:6262-6278` |
| `diaria` | number | não | `0` (`parseFloat \|\| 0`) | modal `:26-27`; `saveTrabalhador:6279` |
| `pgto` | enum: `PIX`, `Dinheiro`, `Transferência`, `Boleto` | não | `PIX` | modal `:28-35` |
| `pixtipo` | enum: `cpf`, `email`, `telefone`, `aleatoria` | não | `cpf` | modal `:36-43` |
| `pixkey` | string | não | normalizada por `cleanPixKey(chave, tipo)` | modal `:44-45`; `pix_logic.js:6` |
| `contato` | string | não | `''` | modal `:46` |
| `status` | enum: `Ativo`, `Inativo`, `Afastado` | não | `Ativo` | modal `:47-53` |
| `admissao` | string `YYYY-MM-DD` | não | `''` | modal `:54-55` |
| `foto` | string (URL ou `data:image/...`) | não | hidden `#tr-foto-url`; em edição preserva o valor anterior se vazio | modal `:56-63`; `saveTrabalhador:6288` |
| `endereco` | string | não | `''` | modal `:64-65` |
| `cidade` | string | não | `''` (ex.: `São Luís / MA`) | modal `:66-67` |
| `lastPay` | derivado, **não persistido** | — | calculado em `editTrabalhador:6461-6464` | modal `:68-69` (somente leitura) |

🟢 Limite: `getPlanLimits().trabalhadores`, padrão `9999` (`data_core.js:16,239`); o painel master pode alterar `limiteTrabalhadores`.

## 38. `ObrasDoTrabalhador` — vínculo e escopo 🟢

| Conceito | Tipo | Regra |
|---|---|---|
| `obras` persistido | string CSV (`'OB1, OB2'`) | `lerObrasDoFormTrabalhador()` junta `selectedOptions` com `, ` |
| Formato aceito na leitura | `string` ou `array` | `parseObrasTrabalhador` faz `split(/[,;]/)` + `trim` + remove vazios, ou normaliza o array |
| Comparação | exata | `OB1` não casa com `OB10` |
| `trabNaObra(t, cod)` | `boolean` | sem obras cadastradas = `true` (registro legado irrestrito) |
| `trabNoEscopo(t, permitidas)` | `boolean` | escopo não-array → `true`; array vazio → `false` (falha fechada); senão, interseção |
| `trabsNoEscopo(lista, permitidas)` | `array` | filtro em lote |
| Validação ao salvar | — | qualquer obra fora de `escopoObrasDaSessao()` bloqueia o salvamento |

🟡 O filtro de escopo é aplicado no cliente (`app_core.js:23-34`, `utils.module.js:1666-1675`); as rules não filtram por obra.

## 39. `TrabalhadorIndicadores` — derivados na tabela (sem persistência) 🟢

| Métrica | Cálculo | Origem |
|---|---|---|
| `pres` | presenças com `p.trab === cod` **ou** `p.nome === nome` | `renderTrabalhadores:1016` |
| `totalAtend` | presenças com `Presente` ou `Falta` | `:1017` |
| `assid` | `Presentes / totalAtend * 100` (`toFixed(0)`; `0` se sem atendimentos) | `:1018-1019` |
| `faltasMes` | `Falta` com `data.startsWith(YYYY-MM UTC)` | `:1020`; `:1007` |
| `earned` | soma de `p.total` | `:1023` |
| `paid` | soma de `f.real` com `source='pre'`, `forn=nome`, `status='Pago'` | `:1024-1025` |
| `saldo` | `earned - paid` | `:1026` |
| `ultimoPagamento` | `financeiro` com `trab=cod` e `status`/`pgtoStatus` `Pago`, ordenado por data desc | `editTrabalhador:6461-6464` |

🟡 `currentMonth` vem de `new Date().toISOString()` (UTC), diferente de `getTodayBR()` (`America/Sao_Paulo`).

## 40. Desvios de aprovação do cadastro 🟢

| Desvio | Gatilho | Payload | Descrição |
|---|---|---|---|
| `trabalhador_add` | criação com `desviarParaAprovacao` disponível | `{ trabalhador: <cadastro completo> }` | `Incluir trabalhador <nome> (cod)` |
| `trabalhador_remove` | `deleteItem('trabalhadores', idx)` com `requerAprovacao()` | `{ cod }` | `Remover trabalhador <nome> (cod)` |

- Com desvio ativo, a **edição** não gera aprovação: exibe aviso e retorna (`saveTrabalhador:6292-6296`).
- Após aprovação, a API aplica o payload (contrato em `tests/aprovacoes-api.test.js`): admin comum do mesmo tenant aprova; admin de outro tenant e engenheiro são negados.
- 🔴 O payload de criação inclui CPF, `pixkey`, `endereco` e `cidade` sem redação.

## 41. Matriz de acesso à escrita em `trabalhadores` 🟢

| Papel | Condição | Resultado |
|---|---|---|
| super_admin / e-mail mestre | — | permite |
| admin / `emailAdmin` do tenant | mesmo tenant + billing ≠ `somente_leitura`/`bloqueado` | permite |
| rh | idem + `modulosPermitidos.funcionarios === true` (claim ou perfil) | permite |
| encarregado / mestre / engenheiro | — | **negado** (devem pedir aprovação no canteiro) |
| demais | — | `PERMISSION_DENIED` |

Origem: `database.rules.json:114-116`. 🟡 O módulo do RH se chama `funcionarios` nas rules, enquanto a UI usa `modulosRh[...]` (`tests/rh-customizavel.test.js`).

---

## 42. `Presenca` — `tenants/<tenantId>/presenca[]` 🟢

| Campo | Tipo | Obrigatório | Default / regra | Origem |
|---|---|---|---|---|
| `data` | string `YYYY-MM-DD` | sim | `''` — validado no save | modal `:13`; `savePresenca:6470-6474` |
| `obra` | string (código) | sim | `''` — validado e checado contra o escopo | modal `:15`; `savePresenca:6475-6476` |
| `trab` | string (código do trabalhador) | sim no modal | vazio em registros legados (usa `nome`) | modal `:17-19`; `savePresenca:6523` |
| `nome` | string | não | nome da ficha ou o próprio código se não encontrado | `savePresenca:6524` |
| `funcao` | string | não | da ficha (modo massa) ou do campo readonly | `savePresenca:6525` |
| `vinculo` | string | não | da ficha; `Informal` zera `hextra` | `savePresenca:6526,6532` |
| `equipe` | string | não | da ficha | `savePresenca:6527` |
| `frente` | string | não | `''` (ex.: `Alvenaria`) | modal `:32-33`; `savePresenca:6528` |
| `entrada` / `saida` | string `HH:MM` | não | `07:00` / `17:00` | modal `:41-44` |
| `hnorm` | number | não | `0` | `calcPresenca:6148`; `savePresenca:6531` |
| `hextra` | number | não | `0`; forçado a `0` para `Informal` | `savePresenca:6532` |
| `presenca` | enum: `Presente`, `Falta`, `Meio período` | não | `Presente` | modal `:34-40` |
| `justif` | string | não | mesmo valor de `pr-obs` | `savePresenca:6534,6555` |
| `obs` | string | não | mesmo valor de `pr-obs` | modal `:54-55`; `savePresenca:6555` |
| `diaria` | number | não | da ficha ou do campo; valor **histórico** | `savePresenca:6535` |
| `total` | number | não | ver §43 | `savePresenca:6536-6548` |
| `pgtoStatus` | enum: `Pendente`, `Pago`, `Parcial`, `Atrasado` | não | `Pendente` | modal `:56-63`; `savePresenca:6550` |
| `valpago` | number | não | `0`; usado quando `Parcial` | modal `:64`; `savePresenca:6551` |
| `lancador` | string | não | `''` (ex.: `Mestre João`) | modal `:66-67`; `savePresenca:6553` |
| `hrLanc` | string `HH:MM` | não | `new Date().toLocaleTimeString('pt-BR')` | `savePresenca:6554` |
| `_idx` | number | não | derivado, **não persistido** — índice original para editar/excluir | `renderPresenca:1641` |

🟢 Duplicidade: um registro por trabalhador por data, comparando `trab === cod` ou, em registros sem `trab`, `nome === nome`. Em massa, duplicatas são ignoradas uma a uma; no individual, o save aborta.

## 43. `PresencaValor` — regras de cálculo 🟢

| Situação | `hnorm` | `hextra` | `total` gravado | Origem |
|---|---|---|---|---|
| `Falta` | `0` | `0` | `0` | `calcPresenca:6123-6128`; `savePresenca:6538` |
| `Meio período` | `4.0` | `0` | `diaria / 2` | `calcPresenca:6137-6142`; `savePresenca:6539-6542` |
| vínculo `Informal` | conforme horário | `0` | `diaria` | `savePresenca:6543` |
| demais | `min(saída-entrada, 8)` | informado manualmente | `pr-total` se > 0, senão `diaria` | `calcPresenca:6144-6156`; `savePresenca:6544-6547` |

`calcTotalManual` (`app_core.js:6159-6183`): `total = hnorm > 0 ? diaria + hextra * (diaria/8) * 1,5 : 0`.

`getPresencaCusto` (`utils.module.js:430-452`): prioriza `total` gravado; sem ele, usa `diaria` gravada (ou da ficha) e calcula `diaria/2` para meio período e `diaria + hextra * (diaria/hnorm) * 1,5` quando `hnorm > 0`. 🟢 Divergência confirmada no código: o denominador é `hnorm` nos utilitários (`utils.module.js:430-452`) e `8` nos formulários (`app_core.js:6159-6183`). 🟡 Definir denominador canônico antes de unificar os cálculos (reclassificado de 🔴 para 🟢/🟡 na revisão).

🟡 `renderPresenca:1602-1619` normaliza em memória registros antigos com `diaria > 0` e `total <= 0` aplicando as mesmas regras, sem persistir a correção.

## 44. `PresencaPagamento` — status e pendências 🟢

| Status | Significado | Efeito no cálculo |
|---|---|---|
| `Pendente` | devido integral | `devido = total` |
| `Parcial` | parte paga | `devido = total - valpago` |
| `Pago` | quitado | excluído do fechamento em lote |
| `Atrasado` | devido em atraso | `devido = total`; entra em `calcWeeklyPendingPayments` |

- Aviso no modal: `Falta Pagar R$ <faltante>` quando `total > valpago`; `Cuidado, excede o total` quando negativo; `Totalmente quitado` quando zero (`calcParcial`, `app_core.js:6693-6707`).
- Coluna "Saldo" da tabela: `total - valpago` **independente do status** (`renderPresenca:1658,1700`).
- `calcWeeklyPendingPayments` (`utils.module.js:78-112`): segunda-feira até `today`, `total > 0`, dedupe por `data_obra_trab`, soma por obra.

## 45. `PresencaResumo` — derivado (sem persistência) 🟢

| Estrutura | Campos | Origem |
|---|---|---|
| resumo por data | `data`, `total`, `presentes`, `faltas`, `registros` | `summarizePresence` (`utils.module.js:59-71`) |
| KPIs do dia | `presentes`, `faltas`, `totalPagar` | `renderPresenca:1624-1633` |
| fechamento por trabalhador | `total`, `pendente`, `diasTrabalhados`, `diasFalta`, `obra` | `renderPresenca:1751-1796` |
| pendências por obra | `obraCod`, `obraNome`, `totalPendente`, `count` | `calcWeeklyPendingPayments:98-111` |
| custo de diárias | `registros`, `custoTotal`, `pendente`, `pendenteTotal`, `porObra` | `calcCustosDiarias:826-836` |

`diasTrabalhados` conta `Presente` e `Meio período`; `pendente` usa `max(0, total - valpago)` somente quando `pgtoStatus !== 'Pago'`; duplicatas `data + (trab ou nome)` são ignoradas.

## 46. `FechamentoLote` — folha de pagamento 🟢

| Campo | Tipo | Observação |
|---|---|---|
| `periodo` | enum: `semana`, `quinzenal`, `mes`, `custom`, `todas` | `prepareLotePgto:6777-6815` |
| `dataIni` / `dataFim` | string `YYYY-MM-DD` |`custom` usa os inputs `#lote-data-ini`/`#lote-data-fim` |
| `chave` | string | `trab` ou `nome + '-' + funcao` |
| `diarias` | number | quantidade de registros com `devido > 0` |
| `valor` | number | soma de `total - valpago` (quando `Parcial`) |
| `datas` / `descontados` | string[] | datas devidas e datas com `devido <= 0` |
| `indices` | array | registros de origem |
| `lotePendentes` | array global | ordenado por `valor` decrescente |

Requer feature `pix.folha`; a ação por linha chama `initiatePixPayment('lote', i)` (`renderLoteTbody:6883`).

## 47. Matriz de acesso à escrita em `presenca` 🟢

| Papel | Condição | Resultado |
|---|---|---|
| super_admin / e-mail mestre | — | permite |
| admin / `emailAdmin` do tenant | mesmo tenant + billing ≠ `somente_leitura`/`bloqueado` | permite |
| encarregado / `mestre` | idem | permite |
| engenheiro | idem | permite |
| rh | idem + `modulosPermitidos.presenca === true` (claim ou perfil) | permite |
| demais | — | `PERMISSION_DENIED` |

Origem: `database.rules.json:78-79`. 🟢 Diferente de `trabalhadores`, o ponto é registrado diretamente no canteiro, sem desvio para aprovação (`tests/security/rules.test.js:301-302`).

---

## 48. `Almoco` — `tenants/<tenantId>/almocos[]` 🟢

| Campo | Tipo | Obrigatório | Default / regra | Origem |
|---|---|---|---|---|
| `data` | string `YYYY-MM-DD` | sim | `''` — validado no save | modal `:16-17`; `saveAlmoco:1382,1396` |
| `obra` | string (código) | sim | `''` — validado e checado contra o escopo | modal `:20-22`; `saveAlmoco:1383,1396-1397` |
| `empreiteiro` | string | sim | `''` no individual; no lote vem do `value` do checkbox (nome do trabalhador) | modal `:25-28`; `saveAlmoco:1400-1408`, `toggleAlmocoModo:1358` |
| `qtd` | number | sim | `1` no modal; `parseFloat(...) \|\| 0` no save | modal `:39-40`; `saveAlmoco:1385` |
| `vunit` | number | não | `20.00` | modal `:43-44`; `saveAlmoco:1386` |
| `vtotal` | number | não | **sempre recalculado** como `qtd * vunit` no save; campo readonly na UI | modal `:47-48`; `saveAlmoco:1387`; `calcAlmocoTotal:1335-1340` |
| `obs` | string | não | `''` | modal `:60-63`; `saveAlmoco:1388` |
| `pgtoStatus` | enum: `Pendente`, `Pago`, `Parcial`, `Atrasado` | não | `Pendente` | modal `:51-55`; `saveAlmoco:1391` |
| `valpago` | number | não | `0`; `Pago` → `vtotal`; `Parcial` → valor informado; `Pendente`/`Atrasado` → `0` | modal `:56-59`; `saveAlmoco:1392-1394` |
| `_idx` | number | não | derivado, **não persistido** — índice original para editar/excluir | `renderAlmocos:1181` |

🟢 Unicidade: no máximo um lançamento por `data + empreiteiro + obra`, ignorando o índice em edição (`saveAlmoco:1420`). No individual a duplicidade aborta; em lote apenas o registro duplicado é ignorado.

🟢 Vinculação: um trabalhador localizado por `nome` **ou** `cod` fora da obra selecionada bloqueia o individual e é pulado no lote (`saveAlmoco:1413-1418`).

## 49. `AlmocoModo` — modal e listas 🟢

| Conceito | Tipo | Regra | Origem |
|---|---|---|---|
| `modo` | enum: `individual`, `massa` | default `individual` | modal `:6-13` |
| `al-indiv-grp` | bloco | visível no individual, oculto no lote | `toggleAlmocoModo:1344-1367` |
| `al-massa-grp` | bloco | visível no lote; lista `.al-massa-check` | `toggleAlmocoModo:1348-1363` |
| `al-massa-check` | checkbox | `value = nome`, `data-cod = codigo`; só trabalhadores `Ativo`, no escopo e em `trabNaObra(t, obra)` | `toggleAlmocoModo:1352-1361` |
| `al-parcial-grp` | bloco | visível somente quando `al-status = Parcial` | `toggleAlmocoParcial:1374-1378` |
| `keepOpen` | boolean | `true` em "Salvar e Próximo": reabre o modal após 100ms mantendo o último modo | `saveAlmoco:1439-1446` |
| `al-empreiteiro` | input com `datalist#list-equipes` | texto livre; aceita nome, código ou equipe | modal `:25-28` |

## 50. `AlmocoSemana` e `FechamentoAlmocos` — derivados (sem persistência) 🟢

| Estrutura | Campos | Regra | Origem |
|---|---|---|---|
| dia da semana | `date` (ISO local), `name` (`Seg`…`Dom`), `display` (`dd/mm`) | 7 dias a partir da segunda, com `currentAlmocoWeekOffset * 7` | `getAlmocoWeekDates:1055-1074` |
| KPIs | `qtdSemana`, `custoSemana`, `lancamentos`, `pendente`, `periodo` | somas sobre a semana navegada no escopo; `pendente` usa `almocoDevido` | `renderAlmocosKPI:1228-1246` |
| resumo por obra | `qtd`, `total` | acumula `parseFloat(qtd)` e `parseFloat(vtotal)` | `renderFechamentosAlmocos:1252-1264,1277-1280` |
| resumo por empreiteiro | `qtd`, `total` | mesmos acumuladores agrupados por `empreiteiro \|\| '—'` | `renderFechamentosAlmocos:1253-1264,1281-1285` |
| pendências por obra | `lancamentos`, `valor` | contabiliza apenas `almocoDevido > 0` | `renderFechamentosAlmocos:1260,1265-1266,1286-1292` |
| fechamento em lote | `pendentes`, `valor`, `confirmado` |pendentes da semana com `almocoDevido > 0`; exige `confirm()`; grava `Pago` + `valpago = vtotal` e chama `persistDB()` | `fecharSemanaAlmocos:1318-1332` |

`almocoDevido(a)` (`app_core.js:1093-1098`): `Pago → 0`; caso contrário `pago = (Parcial ? valpago : 0)` e `devido = max(0, vtotal - pago)`.

🟡 KPIs e fechamentos usam a semana **navegada**, mudando junto com `changeAlmocoWeek`; a listagem principal, por sua vez, mostra todos os registros do tenant (filtrados apenas por escopo/busca/ordem).

🟡 `utils.module.js` agrega almoços como categoria `almoco` (`detectCategory` por `almo`), incluindo-os em `buildFinanceEntries` e nos resumos de custo (`almocos = sumBy('alm')`). 🔴 O fechamento em lote, porém, não gera lançamento em `financeiro`.

## 51. Matriz de acesso à escrita em `almocos` 🟢

| Papel | Condição | Resultado |
|---|---|---|
| super_admin / e-mail mestre | — | permite |
| admin / `emailAdmin` do tenant | mesmo tenant + billing ≠ `somente_leitura`/`bloqueado` | permite |
| encarregado / `mestre` | idem | permite |
| engenheiro | idem | permite |
| rh | idem + `modulosPermitidos.almocos === true` (claim ou perfil) | permite |
| demais | — | `PERMISSION_DENIED` |

Origem: `database.rules.json:84-85`. 🟢 O nome do módulo do RH é `almocos` (diferente de `funcionarios`, usado em `trabalhadores`). 🟡 O filtro por obra é exclusivamente no cliente; as rules não filtram por código de obra. 🟢 Não há desvio para aprovação: exclusão é direta via `deleteItem('almocos', idx)`.

---

## 52. `Compra` — `tenants/<tenantId>/compras[]` 🟢

Registro **público**: os seis campos comerciais são removidos antes da gravação (`compraPublica`, `compras_ui.js:98-103`).

| Campo | Tipo | Obrigatório | Default / regra | Origem |
|---|---|---|---|---|
| `id` | string | não | `num` da compra, ou `id` anterior em edição, ou `CP-<Date.now()>` | `saveCompra:7255` |
| `num` | string | não | `nextCod(DB.compras, 'PC')` preenchido na abertura do modal | `app_core.js:5900`; modal `:4` |
| `data` | string `YYYY-MM-DD` | não | `today` (`getTodayBR`) | `app_core.js:5901`; modal `:5` |
| `obra` | string (código) | não | `''` | modal `:6`; `saveCompra:7221` |
| `etapa` | string | não | `''` (ex.: `Fundação / Geral`) | modal `:7`; `saveCompra:7222` |
| `mat` | string | sim no trigger | `''`; `efeitosCompra` exige não vazio | modal `:8`; `functions/aprovacoes.js:341-343` |
| `qtd` | number | sim no trigger | `1` no modal; `parseFloat \|\| 0`; trigger exige `> 0` | modal `:9`; `saveCompra:7224` |
| `unid` | string | não | `''` (ex.: `Saco`) | modal `:10` |
| `status` | enum: `Aguardando`, `Aprovada`, `Pedido Feito`, `Entregue`, `Reprovada`, `Divergência` | não | `Aguardando` | modal `:11-12`; `saveCompra:7226` |
| `receb` | string `YYYY-MM-DD` | não | `''` | modal `:19`; `saveCompra:7233` |
| `conf` | enum: `''`, `Sim`, `Não` | não | `''` | modal `:20-21`; `saveCompra:7234` |
| `obs` | string | não | `''` | modal `:22`; `saveCompra:7235` |

🟢 `renderCompras` usa o índice do array para `editCompra(i)`, `deleteItem('compras', i)` e `verEvidenciaCompra(i)`; não há filtro por escopo de obra nessa listagem.

## 53. `DadosComerciaisCompra` — `comprasPrivadas/<tenantId>/<id>` 🟢

| Campo | Tipo | Obrigatório | Regra | Origem |
|---|---|---|---|---|
| `forn` | string | não | fornecedor | modal `:13`; `salvarDadosComerciais:76-94` |
| `pixkey` | string | não | normalizada por `cleanPixKey` | modal `:14`; `saveCompra:7230` |
| `vunit` | number | não | `parseFloat \|\| 0` | modal `:15`; `saveCompra:7228` |
| `vtotal` | number | não | `vunit * qtd` no save; readonly na UI | modal `:16`; `calcCompraTotal:6715-6719` |
| `vorc` | number | não | valor orçado | modal `:17`; `saveCompra:7231` |
| `prazo` | string `YYYY-MM-DD` | não | prazo de entrega | modal `:18`; `saveCompra:7232` |
| `compraId` | string | sim | mesmo `id` da compra pública | `salvarDadosComerciais:87` |
| `criadoEm` | number | sim | `Date.now()` na escrita direta | `salvarDadosComerciais:88` |
| `aprovacaoId` | string | não | presente apenas em compras aprovadas | `functions/aprovacoes.js:358` |

🟢 `SENSITIVE = COMPRAS_SENSITIVE_FIELDS = ['forn', 'pixkey', 'vunit', 'vtotal', 'vorc', 'prazo']` (`compras_ui.js:8`, `data_core.js:716`). 🟢 `dadoComercial(c, campo)` prioriza `privadas[c.id || c.num][campo]`; `valor !== undefined` preserva zero como valor válido, e a ausência cai no fallback legado `c[campo]`.

🔴 `saveCompra` não envia `compraPrivada` no desvio `compra_criacao`; o trigger gravará apenas `compraId`, `aprovacaoId` e `criadoEm` nesse nó (`efeitosCompra:351-360`).

## 54. `CompraAprovacao` — desvio `compra_criacao` 🟢

| Campo | Tipo | Regra |
|---|---|---|
| `tipo` | string | `compra_criacao` |
| `payload.compra` | `Compra` (sem campos sensíveis) | `{ ...publicas, id: data.num \|\| undefined }` |
| `payload.compraPrivada` | `DadosComerciaisCompra` | esperado pelo trigger, **não enviado pelo cliente** |
| `descricao` | string | `Compra <mat> (<qtd> <unid>)` |
| `status` | enum: `pendente`, `aprovado`, `rejeitado`, `expirado` | prazo de 15 dias; alertas em 7/12/15 |
| `moduloRH` | string | `compras` (`aprovacoes_ui.js:30`) |

- Aprovação: `efeitosCompra` valida `mat`/`qtd`, remove campos privados, faz `push` em `compras` e grava `comprasPrivadas` com `aprovacaoId`.
- 🔴 Com desvio ativo, `saveCompra` recusa edição (`Alteração comercial exige aprovação...`).
- 🟢 A UI de aprovação redactiona `compra`, `compraPrivada`, `lancamento` e `movimentacao` para encarregado/engenheiro (`aprovacoes_ui.js:333-348`).

## 55. Matriz de acesso — compras 🟢

| Papel | Ver colunas comerciais | Escrever `compras` | Ler/gravar `comprasPrivadas` | Ações na tabela |
|---|---|---|---|---|
| super_admin / e-mail mestre | sim | sim | sim | sim (sem desvio) |
| admin / `emailAdmin` | sim | sim | sim | sim (sem desvio) |
| comprador | sim | sim | sim | sim (sem desvio) |
| rh com `modulosPermitidos.compras === true` | sim | sim | sim | **não** (`requerAprovacao()` → desvio) |
| rh sem o módulo | não | não | não | desvio (sem dados comerciais) |
| engenheiro / encarregado / mestre | não | não | não | desvio `compra_criacao` (edição bloqueada) |

Origem: `database.rules.json:126-127,172-175`, `compras_ui.js:34-40`, `aprovacoes_ui.js:141-145`, `data_core.js:716-747`, `tests/compras-segregacao.test.js`. 🟢 Engenheiro/encarregado/mestre não constam em nenhuma das regras de `comprasPrivadas`. 🟡 `renderCompras` não restringe linhas por obra, embora `filterDbByObras` atue no carregamento do DB.

---

## 56. `ItemEstoque` — `tenants/<tenantId>/estoque[]` 🟢

| Campo | Tipo | Obrigatório | Default / regra | Origem |
|---|---|---|---|---|
| `cod` | string | não | livre no modal; legado gera `MAT-<Date.now()><random>` na transferência | modal `:4`; `saveEstoque:7038`; `saveMovEstoque:7101` |
| `mat` | string | sim | validado com `trim()` no save | modal `:5`; `saveEstoque:7018,7022` |
| `unid` | string | não | `''` (ex.: `Saco 50kg`) | modal `:6`; `saveEstoque:7040` |
| `obra` | string (código) | não | `''` | modal `:7`; `saveEstoque:7041` |
| `min` | number | não | `0`; `parseFloat \\|\\| 0` | modal `:8`; `saveEstoque:7042` |
| `entrada` | number | não | `0`; incrementado por Entrada/Retorno/Ajuste/Transferência recebida | modal `:9`; `saveEstoque:7043`; `confirmarEntrada:2310` |
| `saida` | number | não | `0` no cadastro; **`readonly`** no modal; preservado na edição | modal `:10`; `saveEstoque:7044,7049-7050` |
| `custo` | number | não | `0`; `parseFloat \\|\\| 0` | modal `:11`; `saveEstoque:7045` |
| `obs` | string | não | `''` | modal `:12`; `saveEstoque:7046` |
| `_saldo` | number | não | derivado: `calcSaldo = entrada - saida`, **não persistido** | `utils.module.js:1475-1479` |
| `_status` | enum | não | derivado: `SEM ESTOQUE`/`CRÍTICO`/`BAIXO`/`NORMAL`, **não persistido** | `utils.module.js:1481-1489` |

🟢 Unicidade no cadastro: não pode existir outro item com a mesma `obra` e `mat` normalizado por `normEstoqueNome` (`saveEstoque:7028-7035`). Bloqueio apenas na criação; na edição a duplicidade não é revalidada.

🟢 Status: `saldo <= 0` → `SEM ESTOQUE`; `saldo <= min` → `CRÍTICO`; `saldo <= min * 1.5` → `BAIXO`; senão `NORMAL` (`utils.module.js:1481-1487`). A cor da coluna `Saldo` usa os mesmos limiares (`app_core.js:2331`).

## 57. `MovimentacaoEstoque` — `tenants/<tenantId>/movEstoque[]` 🟢

| Campo | Tipo | Obrigatório | Regra | Origem |
|---|---|---|---|---|
| `data` | string `YYYY-MM-DD` | não | modal unificado/UTC: `new Date().toISOString().slice(0,10)`; entrada direta: `today` (`getTodayBR`); legado: `#mv-data` | `estoque.module.js:277`; `app_core.js:2302,2312,7111` |
| `codMat` | string | sim | `cod` do item | `confirmarMovimentacao:303`; `efeitosMovimentacao:169` |
| `mat` | string | não | nome do material ou `codMat` como fallback | `confirmarMovimentacao:303`; `efeitosMovimentacao:183` |
| `obra` | string (código) | não | destino em saída/transferência, origem em retorno, obra do item em ajuste/entrada | `confirmarMovimentacao:304-306`; `efeitosMovimentacao:184` |
| `obraDestino` | string | não | exclusivo do desvio de transferência | `estoque.module.js:312` |
| `tipo` | enum | sim | `Entrada`, `Saída`, `Retorno`, `Ajuste`, `Transferência (Saída)`, `Transferência (Entrada)` | `app_core.js:2349`; `efeitosMovimentacao:178` |
| `qtd` | number | sim | `> 0`; no ajuste, `|quantidade informada - saldo|` no desvio | `estoque.module.js:308,347-369`; `efeitosMovimentacao:170-171` |
| `frente` / `retirado` / `autor` | string | não | preenchidos apenas no modal legado | `app_core.js:7115-7117,7148-7150` |
| `nf` | string | não | nota fiscal, modal legado | `app_core.js:7118,7151` |
| `vunit` / `vtotal` | number | não | `parseFloat \\|\\| 0`, modal legado | `app_core.js:7119-7120,7151-7152` |
| `obs` | string | não | motivo do ajuste, `Destino: ...`/`Origem: ...` na transferência legada, texto livre | `estoque.module.js:309,364,369` |
| `motivo` | string | não | Somente em `confirmarEntrada` direto (NF/origem) | `app_core.js:2313` |

🟢 Badge na tabela (`renderMovEstoque:2349`): `Entrada` → verde; `Saída` → laranja; `Retorno` → azul; tipo contendo `Entrada` → azul; demais → roxo.

🔴 Transferência pelo modal unificado grava somente `Transferência (Entrada)` (`estoque.module.js:364`); modal legado (`saveMovEstoque:7110-7133`) e trigger (`efeitosMovimentacao:222-229`) gravam o **par** Saída/Entrada.

## 58. Estruturas do modal unificado — derivadas (sem persistência) 🟢

| Estrutura | Campos | Regra | Origem |
|---|---|---|---|
| `TIPO_MOV` | `entrada`, `saida_canteiro`, `retorno`, `transferencia`, `ajuste`, `exclusao` | `entrada` bloqueado na UI; `exclusao` órfão | `estoque.module.js:9-16`; modal `:62-64` |
| `MovimentacaoModal` | `tipo`, `itemId`, `quantidade`, `motivo`, `obraDestinoId/Nome`, `obraOrigemId/Nome` | coletada do DOM; validada duas vezes (`validarFormMovimentacao` e `...UI`) | `estoque.module.js:453-482` |
| saldo do item | `nome`, `unidade`, `quantidade` | `entrada - saida`; `qtdNoCanteiro` fixo em `0` em `buscarItemPorId` | `estoque.module.js:60-69,103-109` |
| saldo no canteiro | `obraId`, `obraNome`, `quantidade`, `unidade` | soma de movimentos com `saída`/`saida` menos `retorno`, por obra; omite `<= 0` | `estoque.module.js:72-101` |
| `EntradaEstoque` | `codMat`, `qtd`, `vunit`, `motivo`, `obs` | modal separado; `qtd > 0` e `motivo` obrigatórios | modal `modal-entrada-estoque.html:8-35`; `confirmarEntrada:2289-2294` |
| `MovimentacaoAprovada` | `movimentacao`, `tipo`, `descricao` | desvio `movimentacao_estoque`; `ajuste` vira Entrada/Saída por `diff` | `estoque.module.js:295-316`; `efeitosMovimentacao:167-248` |

🟢 `normalizarNome` (`estoque.module.js:21-30`): minúsculas → NFD sem diacríticos → `-_/\\` viram espaço → caracteres não `[a-z0-9\s]` removidos → espaços colapsados → `trim()`. Coberta por `tests/estoqueajuste/estoque.test.js:18-48`. 🟡 `saveEstoque` não a reutiliza.

## 59. Matriz de acesso — estoque 🟢

| Papel | Ler `estoque` | Escrever `estoque` | Escrever `movEstoque` | Decidir `movimentacao_estoque` |
|---|---|---|---|---|
| super_admin / e-mail mestre | sim | sim | sim | sim |
| admin / `emailAdmin` | sim (billing ≠ `bloqueado`) | sim (billing ativo) | sim (billing ativo) | sim |
| comprador | sim (billing ≠ `bloqueado`) | sim (billing ativo) | **não** | sim |
| rh com `modulosPermitidos.estoque === true` | sim (billing ≠ `bloqueado`) | sim (billing ativo) | sim (billing ativo) | sim |
| rh sem o módulo | sim (billing ≠ `bloqueado`) | não | não | não |
| engenheiro | sim (billing ≠ `bloqueado`) | não | não | **sim**, com aviso ao admin |
| encarregado / mestre | sim (billing ≠ `bloqueado`) | não | não | não |
| billing `bloqueado` / `somente_leitura` | leitura bloqueada se `bloqueado` | não | não | — |

Origem: `database.rules.json:101-113`, `aprovacoes_ui.js:24,133`, `functions/aprovacoes.js:29,42,92`, `tests/security/rules.test.js:73-77,313-338,373-376`, `tests/aprovacoes.test.js:33`, `tests/rh-customizavel.test.js:60,80`. 🟢 `movEstoque` não inclui comprador, ao contrário de `estoque`. 🟢 Canteiro não escreve diretamente: prepara a movimentação e envia para decisão.

---

## 60. `LancamentoFinanceiro` — `tenants/<tenantId>/financeiro[]` 🟢

| Campo | Tipo | Obrigatório | Default / regra | Origem |
|---|---|---|---|---|
| `data` | string `YYYY-MM-DD` | sim (UI) | lido de `#fn-data` | modal `:4`; `saveFinanceiro:7327` |
| `obra` | string (código) | sim (UI) | `''` se não selecionada | modal `:5`; `saveFinanceiro:7328` |
| `etapa` | string | não | `''` | modal `:6`; `saveFinanceiro:7329` |
| `tipo` | string | não | uma das opções do `<select>` (Mão de obra própria, Empreiteiro, Material, Adiantamento, Desconto, Ajuste, Equipamento...) | modal `:7-8`; `saveFinanceiro:7330` |
| `desc` | string | não | `''` | modal `:9`; `saveFinanceiro:7331` |
| `forn` | string | não | `''`; **removido do payload de aprovação** | modal `:10`; `saveFinanceiro:7332,7353` |
| `prev` | number | não | `parseFloat \|\| 0` | modal `:11`; `saveFinanceiro:7311,7333` |
| `real` | number | não | `parseFloat \|\| 0`; valor efetivo = `real > 0 ? real : prev` | modal `:12`; `saveFinanceiro:7312,7321,7333` |
| `pgto` | string | não | `''` na criação; `PIX` como fallback na edição | modal `:13`; `saveFinanceiro:7334`; `editFinanceiro:7398` |
| `status` | enum | sim | `Pendente` no modal; `Pago`/`Parcial`/`Pendente`/`Atrasado` | modal `:14`; `saveFinanceiro:7313,7335` |
| `valpago` | number | sim | `Pago` → total; `Pendente`/`Atrasado` → `0`; `Parcial` → digitado | `saveFinanceiro:7314-7324,7336` |
| `nf` | string | não | `''` | modal `:15`; `saveFinanceiro:7337` |
| `obs` | string | não | `''` | modal `:16`; `saveFinanceiro:7338` |
| `pixkey` | string | não | não gravado por `saveFinanceiro`; usado apenas se presente em registros legados | `pix_ui.js:58` |
| `trab` / `serviceId` | string | não | herdados de registros legados/importados; `trab` resolve chave PIX | `utils.module.js:519`; `pix_ui.js:59` |

🟢 Integridade de `valpago` aplicada no cliente (`saveFinanceiro:7316-7324`) e revalidada no trigger de aprovação (`functions/aprovacoes.js:301-314`, `tests/aprovacoes.test.js:61`). 🟢 Mudança de status em edição com desvio ativo vai por `financeiro_status`; demais casos por `financeiro_lancamento` (`saveFinanceiro:7344-7358`).

## 61. `FinanceEntry` — normalizado, sem persistência 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| `source` / `idx` | `fin\|pre\|med\|alm` / number | `finKey = source:idx`, chave da seleção e das baixas | `utils.module.js:512,540,573,602`; `app_core.js:2483` |
| `manual` / `auto` | boolean | `fin` = manual; `pre`/`med`/`alm` = automáticos | `utils.module.js:512,541,573,602` |
| `data` / `obra` | string | obra ausente vira `Geral`; filtro por `options.obra` | `utils.module.js:488-491,513,542` |
| `tipo` / `tipoOrigem` / `categoria` | string | `fin` categorizado por `categorizeFinanceType`; `pre` → `mao-de-obra`, `med` → `empreiteiro`, `alm` → `almoco` | `utils.module.js:515,543-545,575-576,604-605` |
| `desc` / `benef` / `forn` | string | manual usa `forn`; presença usa nome/trab; medição usa `equipe`; almoço usa `empreiteiro` | `utils.module.js:516-517,538,570,599` |
| `valor` / `real` | number | manual: `real > 0 ? real : prev`, negativado se desconto; demais: total da origem | `utils.module.js:499-500,521,549,581,610` |
| `prev` / `valorPrevisto` / `valorRealizado` | number | `valorRealizado` **não** usa `prev` como fallback | `utils.module.js:501-505,521-522` |
| `status` | enum | normalizado por `normalizePgtoStatus` | `utils.module.js:506,534,566,595` |
| `jaPago` | number | `Pago` → valor; `Parcial` → `valpago` limitado ao total; senão `0` | `utils.module.js:508,536,568,597` |
| `pendente` | number | `max(0, valor - jaPago)`; desconto sempre `0` | `utils.module.js:509,537,569,598` |
| `valpago` / `totalBruto` | number | `valpago` bruto da origem; `totalBruto = valor` | `utils.module.js:524-525` |
| `hasPrev` / `valorRealizado` | boolean / number | `hasPrev = prevRaw !== 0` apenas no manual | `utils.module.js:521` |
| `aprovacao` | string | somente medição (`medicaoAprovacao`); `Rejeitada` é descartada | `utils.module.js:561,584` |
| `qtd` / `funcao` / `trab` | number / string | metadados de almoço e presença | `utils.module.js:554-555,615` |

🔴 Fato: desconto tem `valor` negativo e `pendente = 0`: entra em `total`/`byCategory`, mas nunca em `aPagar`. 🔴 Fato: `finApplyPaid` grava `valpago = entry.valor` (total); 🟢 decisão P12: somar ao `valpago` existente como `confirmPixPaid`.

Agregados retornados por `buildFinanceEntries`: `totalsByObra` (`prev`, `real`, `diff`), `totalsByPeriod` (`real`, `items`, por `getPeriodLabel`), `byCategory` (`total`, `pago`, `aPagar`, `count`) e `kpis` (`total`, `pago`, `aPagar`, `count`) — `utils.module.js:620-656`.

## 62. Estruturas de UI e PIX — derivadas (sem persistência) 🟢

| Estrutura | Campos | Regra | Origem |
|---|---|---|---|
| `finState` | `categoria`, `status`, `busca`, `groupBy`, `page`, `pageSize`, `periodLabel`, `selected`, `expanded`, `collapsedGroups` | `pageSize` padrão `25`; seleção é `Set` de `finKey` | `app_core.js:2469-2481` |
| `FinanceUnit` | `kind`, `groupKey`, `label`, `entries`, `key` | `kind` = `group`, `labor` ou `row`; índice usado por ações de grupo | `app_core.js:2790-2833` |
| `LotePendente` | `chave`, `nome`, `funcao`, `diarias`, `valor`, `indices`, `datas`, `descontados` | presenças pendentes agrupadas, `valor > 0`, ordenado por valor desc | `app_core.js:6820-6850` |
| `PixTransaction` | `source`, `idx`, `amount`, `receiver`, `bulk` | variável local `activePixTransaction`; `bulk` vem de `opts.bulk` | `pix_ui.js:6,95` |
| `_finPixQueue` | `{source, idx, amount}`[] | fila global; `amount` é `entry.pendente`; esvaziada ao cancelar | `app_core.js:3143,3149,3161` |
| `FinanceiroPeriodOptions` | `dataInicio`/`dataFim` ou `ano`/`mes`, `viewType` | `custom` com datas válidas prevalece sobre ano/mês | `app_core.js:2934-2943`; `utils.module.js:454-479` |

🟢 `FIN_CATEGORIES` (`utils.module.js:116-122`): `mao-de-obra` (engineering), `empreiteiro` (handyman), `almoco` (restaurant), `material` (build), `outros` (push_pin). 🟢 Badges: `mao-de-obra` azul, `empreiteiro` laranja, `almoco` amarelo, demais cinza (`app_core.js:2489-2497`).

## 63. `PixPayload` (BRCode estático) — derivado 🟢

| Campo TLV | Conteúdo | Regra | Origem |
|---|---|---|---|
| `00` | `01` | Payload Format Indicator | `pix_logic.js:74` |
| `26` | `00`=`br.gov.bcb.pix`, `01`=chave limpa, `02`=descrição | descrição truncada em 25 caracteres | `pix_logic.js:76-80` |
| `52` | `0000` | Merchant Category Code | `pix_logic.js:82` |
| `53` | `986` | BRL | `pix_logic.js:83` |
| `54` | valor | `Number(amount).toFixed(2)` | `pix_logic.js:64,84` |
| `58` | `BR` | país | `pix_logic.js:85` |
| `59` / `60` | receptor / cidade | sem acentos, maiúsculas, limites 25 / 15 | `pix_logic.js:86-87` |
| `62` | `05`=`***` | TXID não rastreável (PIX estático) | `pix_logic.js:90-91` |
| `63` | `04` + CRC16 | CRC16 CCITT 0x1021, 4 hex maiúsculos | `pix_logic.js:94-95,101-115` |

🟢 `cleanPixKey`: CPF/CNPJ → só dígitos; telefone 10/11 dígitos → `+55`, 12/13 com prefixo `55` → `+55...`; e-mail → minúsculas; aleatória → mantém `[\\w-]`; detecção automática por `@`, UUID/32 hex, 11/14/10/12/13 dígitos (`pix_logic.js:6-54`, `tests/pix.test.js:11-72`). 🟡 QR Code gerado por `api.qrserver.com` com fallback textual.

## 64. Matriz de acesso — financeiro e PIX 🟢

| Papel | Escrever `financeiro` | Lançamento manual | Baixa direta | PIX (`pix.folha`) |
|---|---|---|---|---|
| super_admin / e-mail mestre | sim | sim | sim | sim se feature ativa |
| admin / `emailAdmin` | sim (billing ativo) | sim | sim | sim se feature ativa |
| rh com `modulosPermitidos.financeiro === true` | sim (billing ativo) | sim | sim | sim se feature ativa |
| rh sem o módulo | não | prepara via aprovação | não | bloqueado |
| engenheiro / encarregado / mestre | não | prepara via aprovação | não | bloqueado |
| comprador | não | prepara via aprovação | não | bloqueado |
| billing `somente_leitura` / `bloqueado` | não | — | não | não |

Origem: `database.rules.json:120-121`, `data_core.js:263`, `saveFinanceiro:7343-7359`, `tests/security/rules.test.js`, `tests/plan-features.test.js:84`, `tests/aprovacoes-ui.test.js:129,147`, `tests/aprovacoes.test.js:190-217`. 🟢 Não há `.read` explícito em `financeiro`: a leitura é herdada do nó do tenant. 🟡 `comprador` não consta na regra de escrita financeira, embora tenha acesso a `estoque`.

---

## 65. `ServicoOrcamento` — `tenants/<tenantId>/orcamento[]` 🟢

| Campo | Tipo | Obrigatório | Default / regra | Origem |
|---|---|---|---|---|
| `id` | string | não (gerado) | `crypto.randomUUID()` ou `svc-<base36>-<random>`; preservado na edição | modal `:1`; `saveOrcamento:7426`; `utils.module.js:200-205` |
| `obra` | string (código) | sim (UI) | `''` se não selecionada | modal `:4`; `saveOrcamento:7427` |
| `etapa` | string | sim (UI) | `''`; com `<datalist>` de etapas existentes | modal `:5`; `saveOrcamento:7428` |
| `subEtapa` | string | não | `''`; na edição aceita legado `subetapa` | modal `:6`; `saveOrcamento:7429`; `editOrcamento:7478` |
| `empreiteiro` | string | não | `''`; sua presença promove `mao-de-obra` → `empreiteiro` | modal `:7`; `saveOrcamento:7430`; `utils.module.js:159-163` |
| `frente` | string | não | `''`; usada como desempate na migração de vínculos | modal `:8`; `saveOrcamento:7431` |
| `equipe` | string | não | `''`; usada como desempate na migração | modal `:9`; `saveOrcamento:7432` |
| `tipo` | string | não | `Mão de obra` (padrão do `<select>`) | modal `:10-11`; `saveOrcamento:7433` |
| `desc` | string | sim (UI) | `''` | modal `:12`; `saveOrcamento:7434` |
| `unid` | string | não | `''` (ex.: `m²`); divergência entre itens gera aviso não bloqueante | modal `:13`; `saveOrcamento:7435,7441-7449` |
| `qtd` | number | não | `parseFloat \|\| 0`, default `1` no modal | modal `:14`; `saveOrcamento:7417,7435` |
| `vunit` | number | não | `parseFloat \|\| 0`; recalcula `vtotal` no `oninput` | modal `:15`; `calcOrcTotal:7408-7413` |
| `vtotal` | number | não | `qtd * vunit`, `readonly` no modal; recalculado no trigger | modal `:16`; `saveOrcamento:7436`; `efeitosOrcamento:327` |
| `obs` | string | não | `''` | modal `:17`; `saveOrcamento:7437` |
| `vreal` | — | não | **sempre removido** — realizado é calculado | `saveOrcamento:7439` |
| `aprovacao` | enum | não | `Aprovado` quando aplicado pelo trigger | `functions/aprovacoes.js:328` |
| `aprovadoPor` / `aprovadoEm` | string / timestamp | não | gravados pelo trigger | `functions/aprovacoes.js:329-330` |

🟢 Unicidade: `parseEditIdx` garante que índice `0` seja edição, evitando duplicação do primeiro item (`tests/budget-fixes.test.js:160-170,200-206`). 🟢 Aviso de unidade divergente compara obra exata e `etapa`/`desc` normalizadas, ignorando a si mesmo, e usa `escHtml` na mensagem (`tests/budget-fixes.test.js:214-237`).

## 66. Estruturas derivadas do board — sem persistência 🟢

| Estrutura | Campos | Regra | Origem |
|---|---|---|---|
| `LinhaOrcamento` | `...ServicoOrcamento`, `_idx`, `key`, `medidoQtd`, `medidoValor`, `saldo`, `pct`, `pago`, `aPagar`, `diferenca` | `saldo = qtd - medidoQtd`; `pct = medidoQtd/qtd*100` ou `null`; `diferenca = vtotal - medidoValor` | `utils.module.js:728-749` |
| `GrupoOrcamento` | `key = etapa\|subEtapa`, `etapa`, `subEtapa`, `servicos[]`, `semVinculo`, `subtotais` | `subtotais` soma `qtd`, `medidoQtd`, `prev`, `medido`, `pago`, `aPagar` | `utils.module.js:751-777` |
| `semVinculo` | `pago`, `aPagar` | custos sem `serviceId`, atribuídos uma vez ao grupo raiz da etapa | `utils.module.js:779-791` |
| `totais` | `qtd`, `medidoQtd`, `prev`, `medido`, `pago`, `aPagar` | soma dos subtotais dos grupos | `utils.module.js:793-797` |
| `CalcBudgetProgressItem` | `...ServicoOrcamento`, `medido`, `realizado`, `pago`, `aPagar`, `diferenca`, `perc` | compatibilidade; `realizado = medido`, `perc` com 1 casa | `utils.module.js:1448-1470` |

🟢 `pago`/`aPagar` vêm de `buildFinanceEntries(...).all` por `serviceId`; entradas sem serviço e com `etapa` viram `semVinculo` da etapa (`utils.module.js:706-726`). 🟢 Categorias: `categorizeBudgetItem` (`utils.module.js:159-163`).

## 67. Vínculo de serviço ↔ medição 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| `budgetServiceKey(o)` | string | `String(o.id)` se houver; senão `normalizeServiceKey(o)` | `utils.module.js:285-289` |
| `medicaoServiceKey(m)` | string | `m.serviceId` → `m.orcKey` → `normalizeServiceKey({obra,etapa,desc:m.servico})` | `utils.module.js:291-296` |
| `normalizeServiceKey(o)` | string | `[obra, etapa, desc \|\| servico].map(normalizeText).join('\|')` | `utils.module.js:193-197` |
| `orcKey` | string | chave textual antiga preservada na migração para rastreabilidade | `utils.module.js:219,273` |
| `serviceIdReview` | boolean | sinalizador de vínculo ambíguo (score zero ou empate) | `utils.module.js:268,274,277`; `app_core.js:4199` |
| `score` | number | subetapa 4, frente 3, equipe/empreiteiro 2 | `utils.module.js:262-268` |

🟢 `migrateServiceIds` é idempotente e falha fechada sem arrays de orçamento/medição (`utils.module.js:221-222`). 🟢 Cenários cobertos: candidato único liga direto; múltiplos usam a equipe para desempate entre casas diferentes; sem equipe liga ao primeiro e marca revisão (`tests/budget-fixes.test.js:139-158`). 🟢 `confirmMedicaoVinculo` remove o sinalizador apenas da medição escolhida e persiste (`tests/budget-fixes.test.js:240-255`).

## 68. `DesvioOrcamento` — `tipo = orcamento_fechamento` 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| `tipo` | string | `orcamento_fechamento` | `aprovacoes_ui.js:18`; `aprovacoes-api.js:15,27` |
| `indice` | number | presente na edição; ausente quando `criar: true` | `saveOrcamento:7452-7456`; `efeitosOrcamento:317-320` |
| `criar` | boolean | `true` indica item novo — dispensa índice válido | `efeitosOrcamento:319` |
| `item` | `ServicoOrcamento` | payload do formulário, sem `vreal` | `saveOrcamento:7455`; `efeitosOrcamento:323` |
| `descricao` | string | `Orçamento — <desc ou id> (<obra>)` | `saveOrcamento:7456` |
| `status` | enum | `pendente` → `aprovado`/`rejeitado`/`expirado` | `database.rules.json:139-144` |
| `expiraEm` | number | `solicitadoEm + 1296000000` (15 dias) | `database.rules.json:139` |

🟢 `efeitosOrcamento` grava `updates['<base>/orcamento']` com `antes`/`depois` e resumo `Fechamento de orçamento — <desc>` (`functions/aprovacoes.js:333-336`). 🟢 Engenheiro prepara itens; admin decide. 🟡 Não há contrato de exclusão de serviço por aprovação.

## 69. Matriz de acesso — orçamento 🟢

| Papel | Escrever `orcamento` | Cadastrar/editar serviço | Decidir `orcamento_fechamento` |
|---|---|---|---|
| super_admin / e-mail mestre | sim | sim | sim |
| admin / `emailAdmin` | sim (billing ativo) | sim (via desvio quando helper ativo) | sim |
| rh com `modulosPermitidos.orcamento === true` | sim (billing ativo) | sim (via desvio) | sim |
| rh sem o módulo | não | prepara via aprovação | não |
| engenheiro | não | prepara via aprovação | não informado — decisão fica com admin |
| encarregado / mestre | não | não | não |
| comprador | não | não | não |
| billing `somente_leitura` / `bloqueado` | não | — | não |

Origem: `database.rules.json:123-124,139-144`, `aprovacoes_ui.js:18,29`, `aprovacoes-api.js:15,27`, `functions/aprovacoes.js:316-337`, `tests/security/rules.test.js:313-323`. 🟢 `encarregado`, `mestre` e `engenheiro` não escrevem diretamente em `orcamento`. 🟡 A UI não esconde botões Editar/Excluir por papel; a segurança depende das rules.

---

## 70. `Medicao` — `tenants/<tenantId>/medicao[]` 🟢

| Campo | Tipo | Obrigatório | Default / regra | Origem |
|---|---|---|---|---|
| `semana` | string `YYYY-MM-DD` | sim (UI) | `#md-semana`; legado pode usar `data` | modal `:15`; `saveMedicao:7496,7527`; `editMedicao:7593` |
| `obra` | string (código) | sim (UI) | `''` se não selecionada | modal `:19`; `saveMedicao:7497` |
| `etapa` | string | não | herdada do orçamento; em avulso preserva a anterior | `saveMedicao:7512,7527`; `onMedicaoServicoChange:4306` |
| `subEtapa` | string | não | herdada (`subEtapa` ou legado `subetapa`) | `saveMedicao:7528` |
| `frente` | string | não | herdada do orçamento | `saveMedicao:7529` |
| `equipe` | string | não | herdada (`empreiteiro` ou `equipe` do orçamento) | `saveMedicao:7530` |
| `servico` | string | sim (UI) | `linha.desc` ou descrição avulsa | `saveMedicao:7511,7531` |
| `orcKey` | string | não | `serviceId` ou chave legada preservada | `saveMedicao:7533`; `utils.module.js:219` |
| `serviceId` | string | não | ID do serviço do orçamento; removido quando vazio | `saveMedicao:7534,7546` |
| `serviceIdReview` | boolean | não | vínculo por aproximação; removido na edição ou confirmação | `utils.module.js:268,274,277`; `saveMedicao:7548`; `confirmMedicaoVinculo:4205` |
| `unid` | string | não | herdada do orçamento ou digitada no avulso | `saveMedicao:7535` |
| `qprev` | number | não | `parseFloat \|\| 0`; herdada do orçamento | `saveMedicao:7513,7536` |
| `qant` | number | sim (derivado) | `medicaoQuantidadeAnterior(...)` excluindo a edição | `saveMedicao:7515-7517,7536` |
| `qreal` | number | sim (UI) | `> 0` obrigatório; quantidade do dia | modal `:60`; `saveMedicao:7505-7506,7536` |
| `qacum` | number | sim (derivado) | `qant + qreal`; snapshot — pode ficar obsoleto | `saveMedicao:7537` |
| `vunit` | number | não | herdada ou digitada no avulso | `saveMedicao:7514,7538` |
| `vtotal` | number | sim (derivado) | `qreal * vunit`, recalculado no trigger | `saveMedicao:7538`; `efeitosMedicao:376` |
| `aprovacao` | enum | sim | `Pendente` na criação; `Aprovado` no trigger; `Aprovada`/`Rejeitada` na UI | `saveMedicao:7518-7520,7539`; `setMedicaoAprovacao:4186` |
| `aprovadoPor` | string | não | nome do usuário da sessão ou `decididoPor` do trigger | `setMedicaoAprovacao:4185-4187`; `efeitosMedicao:378` |
| `aprovadoEm` | data/timestamp | não | `getTodayBR()` na UI; `agora` no trigger | `setMedicaoAprovacao:4188`; `efeitosMedicao:379` |
| `photos` | string[] (URLs) | não | até 6; `data:` removidas no desvio | `handleMedicaoPhotos:4394-4432`; `saveMedicao:7521,7553` |
| `photoUrl` | string | não | `photos[0]`, mantido para compatibilidade | `saveMedicao:7543` |
| `obs` | string | não | `''` | modal `:88`; `saveMedicao:7544` |
| `retrQtd` | number | não | legado de retrabalho; somado em `totais.retrabalho` | `utils.module.js:407` |
| `pgtoStatus` / `valpago` | string / number | não | legado preservado; pagamento gerenciado pelo Financeiro | `saveMedicao:7523-7524`; `pix_ui.js` |

🟢 Registros antigos sem `aprovacao`/`aprovado` são lidos como `Aprovada` (`utils.module.js:188-190`). 🟢 `efeitosMedicao` grava `Aprovado` (masculino); `normalizeAprovacao` aceita as duas formas. 🟡 `qacum` gravado é um snapshot; a fonte de verdade para o avanço é `buildMedicaoResumo`.

## 71. Estruturas derivadas do resumo — sem persistência 🟢

| Estrutura | Campos | Regra | Origem |
|---|---|---|---|
| `ServicoMedicaoResumo` | `key`, `etapa`, `subEtapa`, `empreiteiro`, `frente`, `desc`, `unid`, `qprev`, `vunit`, `vtotal`, `qacum`, `valorAcum`, `count`, `aprovPend`, `temOrcamento`, `saldo`, `pct` | `saldo = qprev - qacum`; `pct = qacum/qprev*100` ou `null`; ordenado por etapa/desc | `utils.module.js:317-385` |
| `TotaisMedicao` | `valorMedido`, `aAprovar`, `aprovado`, `rejeitado`, `fisico`, `retrabalho`, `count` | `valorMedido` inclui rejeitadas do período; `fisico` ponderado e limitado a 0–100 | `utils.module.js:387-409` |
| `MedicaoResumo` | `servicos[]`, `medicoes[]`, `totais` | `medicoes` ordenadas por `semana` desc; filtros de período/etapa/aprovação | `utils.module.js:401-410` |
| `FinanceiroPorChave` | `Map<key, LinhaOrcamento>` | vem de `buildOrcamentoBoard(DB, {obra}).linhas`; fornece `pago`/`aPagar` | `app_core.js:3914-3915` |
| `ServicoNaTabela` | `aprovado`, `pago`, `aPagar`, `pgtoTxt`, `aprov`, `aprovClass`, `tagRevisar` | `pgtoTxt` = Parcial/Pago/Pendente; `aprov` = Rejeitada > Pendente > Aprovada > — | `app_core.js:3934-3953` |

🟢 `fisico = null` quando `pesoTotal <= 0` (`utils.module.js:396-399`); a KPI exibe `—`. 🟢 `valorMedido` e `rejeitado` usam a **lista filtrada**, enquanto `qacum`/`valorAcum` usam o histórico completo (`utils.module.js:352-364,387-390`).

## 72. Estado do formulário e da galeria — derivados 🟢

| Estrutura | Campos | Regra | Origem |
|---|---|---|---|
| `MedicaoFormState` | `md-edit-idx`, `md-orc-key`, `md-semana`, `md-obra`, `md-orc-servico`, `md-servico`, `md-unid`, `md-qprev`, `md-vunit`, `md-qreal`, `md-qant`, `md-qacum`, `md-avanco`, `md-obs` | `parseEditIdx` trata `0` como edição; `md-qacum`/`md-avanco` readonly | modal `:1-2,15-88`; `app_core.js:4327-4355` |
| `_medicaoPhotos` | `string[]` | até 6 URLs; limpo após salvar; legado `photoUrl` vira item único | `app_core.js:4397-4431,7521,7579,7614` |
| `_medicaoGallery` | `photos`, `index`, `title`, `meta`, `heading`, `label`, `captionFn` | criada por `openMedicaoFotos`; navegação circular; `Escape`/setas | `app_core.js:4090-4098,4143-4175` |
| `MedicaoPhotoCaption` | `desc` + `Foto i/n` | `desc = servico \|\| etapa \|\| 'Medição'`; sufixo só quando `total > 1` | `app_core.js:4077-4081` |
| `_medView` | `canteiro` \\| `financeiro` | persistido na sessão da página; default `canteiro` | `app_core.js:3848-3854,3889` |

🟢 `md-qant` e `md-qacum` são readonly e recalculados; `md-vtotal`/`md-qsaldo` são alvos de escrita sem campo correspondente no modal atual — 🟡 resíduo de versão anterior. 🟢 `handleMedicaoPhotos` usa `optimizeImageFile` com `maxDim: 1280` e `quality: 0.75`, com fallback `dataUrl` se o Storage falhar.

## 73. `DesvioMedicao` — `tipo = medicao_fechamento` 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| `tipo` | string | `medicao_fechamento` | `aprovacoes_ui.js:20,31`; `aprovacoes-api.js:16,29` |
| `indice` | number | presente na edição; ausente quando `criar: true` | `saveMedicao:7559-7562`; `efeitosMedicao:368-370` |
| `criar` | boolean | `true` indica medição nova — dispensa índice válido | `efeitosMedicao:369` |
| `item` | `Medicao` | payload com fotos `data:` removidas | `saveMedicao:7553-7561` |
| `descricao` | string | `Medição — <servico ou obra> (<semana>)` | `saveMedicao:7562` |
| `status` | enum | `pendente` → `aprovado`/`rejeitado`/`expirado`/`erro` | `database.rules.json:141` |
| `expiraEm` | number | `solicitadoEm + 1296000000` (15 dias) | `database.rules.json:139` |

🟢 `efeitosMedicao` grava `updates['<base>/medicao']` com `antes`/`depois` e resumo `Fechamento de medição — <servico>` (`functions/aprovacoes.js:382-385`). 🟢 Engenheiro pode criar este tipo; encarregado/mestre não (`database.rules.json:139`). 🟢 RH com `modulosPermitidos` não decide `medicao_fechamento` (`tests/rh-customizavel.test.js:75`). 🟡 Exclusão e mudança de aprovação não usam este contrato.

## 74. Matriz de acesso — medição 🟢

| Papel | Escrever `medicao` | `photos`/`photoUrl` | Criar `medicao_fechamento` | Decidir `medicao_fechamento` |
|---|---|---|---|---|
| super_admin / e-mail mestre | sim | sim | sim | sim |
| admin / `emailAdmin` | sim (billing ativo) | sim | sim | sim |
| engenheiro | sim (billing ativo) | sim | sim | não informado — decisão fica com admin |
| rh com `modulosPermitidos.medicao === true` | sim (billing ativo) | sim | não | não |
| encarregado / mestre | não | sim (item existente) | não | não |
| rh sem o módulo | não | não | não | não |
| comprador | não | não | não | não |
| billing `somente_leitura` / `bloqueado` | não | não | não | não |

Origem: `database.rules.json:90-99,139-145`, `aprovacoes_ui.js:20,31`, `aprovacoes-api.js:16,29`, `functions/aprovacoes.js:367-386,403`, `tests/security/rules.test.js:363`, `tests/rh-customizavel.test.js:75`. 🟢 `encarregado`/`mestre` podem anexar fotos a medição existente, mas não criar/editar a medição. 🟡 `setMedicaoAprovacao` é uma escrita direta no cliente: o controle real de aprovação depende das rules, não do desvio.

---

## 75. `DashboardResumo` — derivado, sem persistência 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| `hoje` | string `YYYY-MM-DD` | `options.hoje` ou `hojeLocal()` (fuso `America/Sao_Paulo`) | `utils.module.js:1073-1075`; `tests/dashboard.test.js:12` |
| `kpis` | `DashboardKPIs` | presentes/faltas do dia, obras ativas, diárias do dia | `utils.module.js:1077-1084` |
| `linhas` | `DashboardLinhaObra[]` | uma por obra, na ordem de `DB.obras` | `utils.module.js:1086-1102` |
| `tarefas` | `TarefasResumo` | abertas, atrasadas, vencem hoje e itens | `utils.module.js:1108`; `calcTarefasResumo:987-1011` |
| `alertas` | `AlertaDashboard[]` | ordenados por prioridade (`alto` → `baixo`) | `utils.module.js:1109`; `calcAlertas:1021-1068` |

🟢 `calcDashboardResumo` é a única fonte de números do dashboard; `renderDashboard` apenas desenha (`app_core.js:101,112-113`). 🟢 `role`/`modulos` alteram somente alertas e ações rápidas, nunca os KPIs.

## 76. `DashboardLinhaObra` e `DashboardKPIs` — derivados 🟢

| Estrutura | Campo | Tipo | Regra | Origem |
|---|---|---|---|---|
| `DashboardKPIs` | `presentes` | number | presenças do dia com `presenca === 'Presente'` | `utils.module.js:1080` |
| | `faltas` | number | presenças do dia com `presenca === 'Falta'` | `utils.module.js:1081` |
| | `obrasAtivas` | number | `status === 'Em andamento'` | `utils.module.js:1082` |
| | `diariasHoje` | number | `calcCustosDiarias` com `dataInicio = dataFim = hoje` | `utils.module.js:1083` |
| `DashboardLinhaObra` | `obra` | `Obra` | referência ao objeto original de `DB.obras` | `utils.module.js:1093` |
| | `diariasSem` | number | `calcCustoObra({tipo:'semana', baseDate:hoje}).diarias` | `utils.module.js:1087,1094` |
| | `custoSem` | number | total da semana (segunda até hoje) | `utils.module.js:1087,1095` |
| | `custoMes` | number | total do mês (dia 1 até hoje) | `utils.module.js:1088,1096` |
| | `totalReal` | number | total sem filtro de período | `utils.module.js:1089,1097` |
| | `pctCusto` | number \\| null | `totalReal / orc * 100`; **`null` se `orc <= 0`** | `utils.module.js:1090,1098` |
| | `tarefasFeitas` | number | tarefas da obra com `status === 'Concluída'` | `utils.module.js:1099` |
| | `tarefasTotal` | number | total de tarefas da obra | `utils.module.js:1100` |

🟢 `pctCusto = null` é exibido como `—` com tooltip (`app_core.js:186-188`), distinto de `0%`. 🟢 `custoSem`/`custoMes`/`totalReal` usam `buildFinanceEntries`, a mesma fonte do Financeiro e do relatório (`tests/dashboard.test.js:14-50`). 🟡 `custoSem` e `custoMes` não são exibidos na tabela quando a obra é concluída e `#dash-show-done` está desmarcado.

## 77. `TarefasResumo` e `AlertaDashboard` — derivados 🟢

| Estrutura | Campo | Tipo | Regra | Origem |
|---|---|---|---|---|
| `TarefasResumo` | `hoje` | string | data de referência | `utils.module.js:1005` |
| | `abertas` | number | tarefas com `status !== 'Concluída'` (inclusive sem prazo) | `utils.module.js:1006` |
| | `atrasadas` | number | itens com `prazo < hoje` | `utils.module.js:1007` |
| | `vencemHoje` | number | itens com `prazo === hoje` | `utils.module.js:1008` |
| | `itens` | array | `...t`, `_idx`, `obraNome`, `atrasada`, `venceHoje`; ordenado por prazo | `utils.module.js:993-1009` |
| `AlertaDashboard` | `tipo` | string | `TAREFA ATRASADA`, `TAREFA HOJE`, `CUSTO ACIMA DO ORÇAMENTO`, `CUSTO PERTO DO LIMITE`, `COMPRA PENDENTE`, `SEM PRESENÇA HOJE`, `OBRA SEM MESTRE` | `utils.module.js:1026-1065` |
| | `obra` | string | nome da obra ou `Geral` | `utils.module.js:1024` |
| | `desc` | string | descrição legível do alerta | `utils.module.js:1026` |
| | `prior` | enum | `alto` (0), `medio` (1), `baixo` (2) | `utils.module.js:1014,1067` |

🟢 `atrasada` é calculada em tempo de leitura — não depende de status gravado (`tests/tarefas-dashboard.test.js:41-67`). 🟢 Atrasadas são agrupadas em **um** alerta alto com até dois exemplos; `TAREFA HOJE` gera um alerta médio por tarefa (`utils.module.js:1030-1038`). 🟢 `SEM PRESENÇA HOJE` não é gerado aos domingos (`utils.module.js:1057-1063`). 🟡 A UI limita a 8 alertas e prioriza `TAREFA*`, podendo esconder alertas de custo (`app_core.js:143-152`).

## 78. `RelatorioObra` — saída de `buildObraReport`, sem persistência 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| `obra` | `Obra` \\| null | encontrada por `cod` em `DB.obras` | `utils.module.js:1127` |
| `empresa` | string | `DB.config.nomeEmpresa` ou `Obra Real` | `utils.module.js:1298` |
| `logoUrl` | string | `DB.config.logoUrl` ou `''`; sanitizado na UI | `utils.module.js:1299`; `app_core.js:3414` |
| `numero` | string | `options.numero` ou `REL-<cod>-<YYYYMMDD>` | `utils.module.js:1300` |
| `hoje` | string | `options.hoje` ou `hojeLocal()` | `utils.module.js:1259` |
| `periodoLabel` | string | `<ini> a <fim>` com `fmtDate`, ou `Todo o período da obra` | `utils.module.js:1301-1303` |
| `periodo` | `{dataInicio, dataFim}` | filtro repassado a `buildFinanceEntries` | `utils.module.js:1128-1130,1312` |
| `resumo` | `RelatorioResumo` | totais, saldo, percentual, status e avanço físico | `utils.module.js:1313-1316` |
| `categorias` | `CategoriaRelatorio[]` | uma por `FIN_CATEGORIES`, incluindo `outros` | `utils.module.js:1144-1153` |
| `entradas` | `EntradaConciliada[]` | entradas com `valorRealizado !== 0`, exceto duplicados | `utils.module.js:1155-1176` |
| `duplicados` | `EntradaConciliada[]` | empreiteiro manual com etapa já medida | `utils.module.js:1167-1174` |
| `medicoes` | array | medições do período com `qacum`, `aprovacao`, `photos`, `pctAcum` | `utils.module.js:1218-1238` |
| `equipe` | array | agrupada por `trab \\|\\| desc`, ordenada por `total` desc | `utils.module.js:1245-1257` |
| `pendencias` | array | tarefas não concluídas + compras `Aguardando` | `utils.module.js:1260-1277` |
| `tarefas` | array | tarefas do período com `photos` sanitizadas e `isExecutada` | `utils.module.js:1280-1296` |
| `orcamento` | `ServicoOrcamento[]` | linhas da obra (sem filtro de período) | `utils.module.js:1324` |
| `responsavel` | string | `options.responsavel` ou `''` | `utils.module.js:1325` |

🟢 `buildObraReport` é calculado a partir da mesma fonte de `calcCustoObra` (`buildFinanceEntries`), com `tests/report.test.js` cobrindo categorias, duplicados, equipe, pendências e fotos de tarefas. 🟢 Contas não são gravadas: o relatório existe apenas no `#rel-preview-area`. 🟡 Nenhum metadado de auditoria (gerador, hash, timestamp de emissão persistido) acompanha o documento.

## 79. `RelatorioResumo` e `CategoriaRelatorio` — derivados 🟢

| Estrutura | Campo | Tipo | Regra | Origem |
|---|---|---|---|---|
| `RelatorioResumo` | `totalPrevisto` | number | soma de `categorias[].previsto` | `utils.module.js:1191` |
| | `totalRealizado` | number | soma de `categorias[].realizado` | `utils.module.js:1192` |
| | `totalPago` | number | soma de `categorias[].pago` | `utils.module.js:1193` |
| | `totalAPagar` | number | soma de `categorias[].aPagar` | `utils.module.js:1194` |
| | `saldo` | number | `totalPrevisto - totalRealizado` | `utils.module.js:1195` |
| | `pct` | number \\| null | `totalRealizado / totalPrevisto * 100`, ou `null` sem previsto | `utils.module.js:1196` |
| | `fisico` | number \\| null | `buildMedicaoResumo(...).totais.fisico` | `utils.module.js:1241-1242` |
| | `valorMedido` | number | `buildMedicaoResumo(...).totais.valorMedido` | `utils.module.js:1243` |
| | `orcamentoParcial` | boolean | previsto > 0, gasto sem previsto > 0 e cobertura < 50% | `utils.module.js:1203-1207` |
| | `realizadoSemPrevisto` | number | soma do realizado em categorias com `previsto <= 0` | `utils.module.js:1204` |
| | `coberturaOrcamento` | number \\| null | `totalPrevisto / totalRealizado * 100` | `utils.module.js:1205` |
| | `status` | string | `Sem orçamento definido`, `Orçamento incompleto: <valor> sem previsão`, `Acima do orçamento em X%`, `Abaixo do orçamento em X%`, `Dentro do orçamento` | `utils.module.js:1209-1216` |
| `CategoriaRelatorio` | `key`/`label`/`icon` | string | de `FIN_CATEGORIES` | `utils.module.js:1144-1147` |
| | `previsto` | number | soma de `orcamento` da obra categorizado (case/acento-insensível) | `utils.module.js:1149-1153` |
| | `realizado`/`pago`/`aPagar`/`count` | number | soma por `EntradaConciliada` da categoria | `utils.module.js:1177-1189` |

🟢 `pago = valorRealizado` quando `status === 'Pago'`; `min(jaPago, valorRealizado)` quando `Parcial`; `0` nos demais. `aPagar = max(0, valorRealizado - pago)` (`utils.module.js:1179-1188`). 🟢 `orcamentoParcial` evita interpretar orçamento incompleto como estouro — o limite é 50% de cobertura (`utils.module.js:1198-1207`). 🟢 Compras nunca entram em `realizado`; surgem apenas em `pendencias`.

## 80. Estado da UI e matriz de features — derivados 🟢

| Estrutura | Campo / elemento | Regra | Origem |
|---|---|---|---|
| `ReportState` | `rel-obra`, `rel-data-ini`, `rel-data-fim`, `rel-responsavel`, `rel-numero` | filtros do formulário; número default `REL-<cod>-<YYYYMMDD>` | `relatorios.html:5-30`; `checkRelObra:3346-3367` |
| | `rel-sec-resumo`, `rel-sec-categorias`, `rel-sec-medicoes`, `rel-sec-equipe`, `rel-sec-pendencias`, `rel-sec-extrato`, `rel-sec-fotos-tarefas` | 7 checkboxes, todas `checked` por default | `relatorios.html:44-66`; `toggleAllRelSections:3794-3800` |
| | `rel-tarefas-status` | `concluidas` (padrão) ou `todas` | `relatorios.html:70-73`; `app_core.js:3511-3517` |
| | `rel-tarefas-com-fotos-only` | boolean; exige `photos.length > 0` | `relatorios.html:74-76`; `app_core.js:3516` |
| | `rel-preview-area` | HTML gerado; substituído por empty state em `resetRelatorios` | `relatorios.html:80-86`; `app_core.js:3335-3344,3791` |
| `DashboardUIState` | `dash-actions`, `kpi-grid`, `alerts-grid`, `dash-tarefas-grid`, `dash-obras-tbody`, `dash-updated`, `dash-show-done`, `dash-done-count` | destinos de renderização | `dashboard.html:4-45`; `app_core.js:117-217` |
| `FeatureGate` | `relatorio.marca` | nível 2 — logo, marca d'água e geração do relatório | `plan_features.js:36-40`; `app_core.js:3388,5655` |
| | `exportacao` | nível 2 — imagem do dashboard, `exportHoje` e backup | `plan_features.js:41-45`; `app_core.js:3204,695`; `data_core.js:1026` |
| | `relatorio.whatsapp.diario` | nível 2 — cadastro do recurso; envio automático fora deste módulo | `plan_features.js:46-50` |

Origem: `public/js/plan_features.js:25-54`, `public/js/app_core.js:294-331,3388-3512,3794-3809`, `public/js/data_core.js:1025-1047`, `tests/tarefas-dashboard.test.js:117-138`, `tests/report.test.js`. 🟢 `applyFeatureGates` aplica `feature-locked`, `aria-disabled` e `title`, e intercepta o clique em fase de captura abrindo `modal-upgrade` (`app_core.js:294-331`). 🟡 `importarBackup` não exige `exportacao` e não é bloqueado pelo gate, embora substitua todo o `DB`.

---

## 81. Campos de foto nas entidades 🟢

| Entidade | Campo | Tipo | Regra | Origem |
|---|---|---|---|---|
| `Tarefa` | `photos` | string[] (URLs/`data:`) | até 6; legenda derivada de `desc` | `app_core.js:8146-8215`; `tests/tarefas-fotos.test.js:24-40` |
| `Tarefa` | `photoUrl` | string | primeira foto, mantida para leitores legados | `app_core.js:8177-8178`; `tests/tarefas-fotos.test.js:25-27` |
| `Tarefa` | `foto` | string (`data:`) | formato antigo de uma única foto | `app_core.js:8151`; `data_core.js:463-469` |
| `Medicao` | `photos` | string[] | até 6; `data:` removidas no desvio de aprovação | `app_core.js:4394-4432`; `saveMedicao:7521,7553` |
| `Medicao` | `photoUrl` | string | primeira foto, compatibilidade | `app_core.js:4074`; `saveMedicao:7543` |
| `Trabalhador` | `foto` | string (`data:`) | foto individual, separada do backup da nuvem | `data_core.js:796-804,896-903` |

🟢 `saveTarefa` grava `photos` e `photoUrl: photos[0] || ''`; `saveMedicao` faz o equivalente. 🟢 Base64 é removido antes de enviar ao RTDB (`data_core.js:892-930`). 🟡 Fotos em `data:` de medição não são restauradas do `gestaoObraFotos` no carregamento.

## 82. `FotoItem` — derivado em `renderFotos` 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| `url` | string | URL normalized da origem | `renderFotos:4490-4522` |
| `legenda` | string | `taskPhotoCaption` ou `medicaoPhotoCaption` | `renderFotos:4494,4513` |
| `obra` | string | código da obra da origem | `renderFotos:4495,4517` |
| `origem` | enum | `Tarefa` ou `Medição` | `fotos.html:14-15`; `renderFotos:4496,4518` |
| `cod` | string | `t.cod` ou `m.cod`; fallback `TF`/`MED` | `renderFotos:4497,4519` |
| `desc` | string | `t.desc` ou `m.servico`/`m.etapa` | `renderFotos:4498,4520` |
| `etapa` / `frente` | string | herdados da origem | `renderFotos:4499-4500,4520-4521` |
| `status` | string | `t.status` ou `m.aprovacao` | `renderFotos:4501,4521` |
| `data` | string | `conclusao`/`prazo`/`criacao` ou `semana`/`data` | `renderFotos:4502,4522` |

🟢 Ordenação por `data` descendente com `localeCompare` (`renderFotos:4534-4539`). 🟢 Filtros por `obra` e `origem` são aplicados antes da ordenação (`renderFotos:4526-4532`). 🟡 `data` vazia ordena por último; tarefas sem prazo e medições sem data aparecem no fim.

## 83. Estruturas de normalização e legenda — derivadas 🟢

| Estrutura | Campos / regra | Origem |
|---|---|---|
| `TaskPhotoList` | `photos` se não vazio, senão `[photoUrl, foto]`; `filter(Boolean)` + regex `/^(https?:\/\/|data:image\/)/i` | `app_core.js:8149-8153` |
| `TaskPhotoCaption` | `desc = t.desc || 'Tarefa'`; `total > 1 ? desc + ' · Foto ' + (i+1) + '/' + total : desc` | `app_core.js:8157-8160` |
| `MedicaoPhotoList` | `photos.filter(Boolean)` ou `[photoUrl]` — **sem filtro de esquema** | `app_core.js:4072-4075` |
| `MedicaoPhotoCaption` | `desc = servico || etapa || 'Medição'`; sufixo `Foto i/n` se `total > 1` | `app_core.js:4077-4081` |
| `MedicaoFotosHtml` | deduplica URLs, máximo de 3 miniaturas + contador | `app_core.js:3857-3868` |

🟢 `tests/tarefas-fotos.test.js:31-35,59-75` cobre os formatos legados, o limite de 6 e as legendas. 🟡 Assimetria: `taskPhotoList` filtra esquemas perigosos, `medicaoPhotoList` não.

## 84. `GaleriaFotos` e `UploadEvidenceResult` — derivados 🟢

| Estrutura | Campo | Tipo | Regra | Origem |
|---|---|---|---|---|
| `_medicaoGallery` | `photos` | string[] | lista normalizada da origem | `app_core.js:4090-4098,8236-8244` |
| | `index` | number | clamp entre 0 e `photos.length - 1` | `app_core.js:8238` |
| | `title` / `meta` / `heading` / `label` | string | descrição, códigos, rótulos da galeria | `app_core.js:4092-4096,8239-8242` |
| | `captionFn` | function | `taskPhotoCaption` ou `medicaoPhotoCaption` | `app_core.js:4097,8243` |
| `#lightbox-container` | `img.src` | string | URL recebida por `openLightbox` | `app_core.js:8252-8264` |
| `UploadEvidenceResult` | URL remota | string | `fileRef.getDownloadURL()` | `app_core.js:8091-8092` |
| | fallback | string (`data:`) | `dataUrl` otimizada quando o Storage falha | `app_core.js:4414-4419,8200-8205` |
| | `fileName` | string | `Date.now() + '_' + nome.replace(/[^a-zA-Z0-9.]/g,'_')` | `app_core.js:8078` |
| | `filePath` | string | `tenants/<tid>/evidencias/<fileName>` | `app_core.js:8079` |

🟢 `optimizeImageFile` devolve `{ file, dataUrl, width?, height?, size? }` com `maxDim: 1280` e `quality: 0.75`, MIME `image/jpeg` (`utils.module.js:1341-1406`). 🟡 O lightbox não aplica `auditSafeImage`; a URL já vem sanitizada dos cards.

## 85. `FotosLocalStore` e matriz de acesso ao Storage 🟢

| Chave / papel | Regra | Origem |
|---|---|---|
| `gestaoObraDB` | backup local sem base64 — fotos `data:` removidas | `data_core.js:793-841` |
| `gestaoObraFotos` | mapa `cod → foto` (trabalhadores) e `tf_<cod> → string[]` (tarefas), limitado a 6 | `data_core.js:795-849` |
| restauração | workers com `foto` vazia; tarefas com `Set([...atuais, ...photoUrl, ...restauradas])` | `data_core.js:458-484` |
| nuvem | `dbForCloud` sem nenhum `data:` de trabalhador, medição ou tarefa | `data_core.js:892-930` |
| `super_admin` (claim `MASTER_SYSTEM`) | get/list/create/update/delete em `tenants/<id>/**` | `storage.rules:18-22,35-40` |
| `admin`/`rh`/`engenheiro`/`encarregado`/`mestre`/`comprador` | membro do tenant com `token.tenantId == tenantId`: get/list/delete; create/update se `arquivoPermitido()` | `storage.rules:7-16,24-40` |
| fora de `tenants/<tenantId>/` | `allow read, write: if false` | `storage.rules:42-45` |
| `arquivoPermitido` | `0 < size <= 10MB` e `contentType` `image/*` ou `application/pdf` | `storage.rules:24-31` |

Origem: `storage.rules:1-47`, `tests/security/tenant-isolation.test.js:391-417`, `tests/rh-customizavel.test.js:89-122`, `tests/tarefas-fotos.test.js:37-40`. 🟢 A autoridade é a Custom Claim emitida pelo servidor — Storage Rules não consulta o RTDB (`storage.rules:4-6`). 🟡 Sessões sem `tenantId` caem em `tenants/global/`, que não satisfaz nenhuma regra de acesso. 🟡 `contentType` é declarado pelo cliente, sem verificação do conteúdo real.

## 86. `TenantBilling` — `tenants/<tenantId>` (Realtime Database) 🟢

| Campo | Tipo | Obrigatório | Default / regra | Origem |
|---|---|---|---|---|
| `plano` | enum do catálogo (`free_trial`, `start`, `start_anual`, `pro`, `pro_anual`, `premium`, `ilimitado`, `ilimitado_anual`, `full_anual`, `master`, `MASTER_SYSTEM`) | não | `free_trial` na criação | `plan_catalog.js:30-105`; `database.rules.json:38-40` |
| `planoVencimento` | number (epoch ms) | não | `agora + diasDoPlano` | `super_admin.js:278-285`; `kiwify.js:376-382` |
| `trialExpiracao` | number (epoch ms) | não | `webhookCriacao + 30 dias` | `billing.js:60-62`; `super_admin.js:302-304` |
| `status` | enum(`ativo`\|`carencia`\|`bloqueado`\|`bloqueado_pagamento`) | não | — | `kiwify.js:379,399,425,437`; `super_admin.js:286,319` |
| `billingState` | enum(`ativo`\|`carencia`\|`somente_leitura`\|`bloqueado`) | não | `ativo` (implícito) | `billing.js:39-137`; `database.rules.json:50-52` |
| `billingStateMotivo` | string | não | ver §87 | `billing.js:160-162`; `kiwify.js:381,401,427,439` |
| `billingStateAtualizadoEm` | number (epoch ms) | não | `agora` do job/ação manual | `billing.js:162`; `super_admin.js:289,322` |
| `carenciaAte` | number (epoch ms) \| null | não | `agora + 3 dias` (cancelamento) ou `+5 dias` (atraso) | `kiwify.js:428,440`; `billing.js:85-91` |
| `avisoCarencia` | string \| null | não | texto padrão de renovação pendente | `kiwify.js:441` |
| `motivoBloqueio` | string \| null | não | `chargeback`, `reembolso`, `bloqueio_manual_master` | `kiwify.js:398-403`; `super_admin.js:323` |
| `dataBloqueio` | number (epoch ms) \| null | não | `agora` | `kiwify.js:403`; `super_admin.js:324` |
| `cancelamentoAgendado` | boolean \| null | não | `true` em `subscription_canceled` com vencimento futuro | `kiwify.js:416-417` |
| `dataCancelamento` | number (epoch ms) \| null | não | `agora` | `kiwify.js:417` |
| `origemAtivacao` | enum(`kiwify`\|`painel_master`) \| null | não | — | `kiwify.js:383`; `super_admin.js:290` |
| `ultimoPagamento` | objeto (ver §91) | não | — | `kiwify.js:364-372` |
| `webhookCriacao` | number (epoch ms) | não | usado como fallback do início do trial | `billing.js:60-61`; `database.rules.json:54-55` |
| `config/limiteObras` | number | não | `1` na criação; depois ditado pelo plano | `plan_catalog.js:126-137`; `database.rules.json:62-64` |
| `config/limiteUsuarios` | number | não | `1` na criação | `database.rules.json:65-67` |
| `config/limiteTrabalhadores` | number | não | `9999` na criação | `database.rules.json:68-70` |

🟢 O cliente nunca reenvia estes campos: `PROTECTED_TENANT_FIELDS` e `PROTECTED_CONFIG_FIELDS` os removem do update (`data_core.js:645-659`). 🟢 As rules congelam os valores para não-super_admin via `.validate` (`database.rules.json:38-72`). 🟡 O job grava `billingState`/`motivo`/timestamp, mas não atualiza `status` — os dois campos podem divergir após uma transição automática para `somente_leitura` ou `bloqueado`.

## 87. `BillingState` — enum, motivos e transições 🟢

| Estado | Significado | Escrita no RTDB | Motivos possíveis |
|---|---|---|---|
| `ativo` | Acesso total | permitida | `master_system`, `trial_vigente`, `plano_vigente`, `sem_vencimento`, `pagamento_aprovado`, `ajuste_manual_master`, `liberacao_manual_master` |
| `carencia` | Tolerância com escrita liberada e alerta | permitida | `carencia_webhook`, `vencido_em_carencia`, `cancelamento_em_carencia`, `atraso_em_carencia` |
| `somente_leitura` | Leitura permitida; escrita bloqueada no servidor | negada | `trial_expirado`, `carencia_expirada` |
| `bloqueado` | Leitura e escrita negadas, exceto o próprio `billingState` | negada | `trial_encerrado`, `inadimplente`, `chargeback`, `reembolso`, `bloqueio_manual`, `bloqueio_manual_master` |

| Transição | Gatilho | Origem |
|---|---|---|
| `ativo → ativo` (renovação) | `paid` / `order_approved` / `subscription_renewed` | `kiwify.js:374-395` |
| `qualquer → bloqueado` (imediato) | `refunded`, `chargedback`, `order_refunded`, `chargeback`, bloqueio manual | `kiwify.js:396-408`; `super_admin.js:310-328` |
| `ativo → carencia` | assinatura cancelada com ciclo vencido (3 dias) ou atraso (5 dias) | `kiwify.js:410-446` |
| `ativo → ativo` (agendado) | cancelamento com vencimento futuro | `kiwify.js:415-423` |
| `ativo/carencia → somente_leitura` | job diário após carência esgotada | `billing.js:122-134` |
| `somente_leitura → bloqueado` | job diário após 7 dias | `billing.js:135-136` |
| `bloqueado → ativo` | pagamento aprovado ou ajuste manual do master | `kiwify.js:378-382`; `super_admin.js:283-299` |

🟢 Instâncias `MASTER_SYSTEM` e perfis `super_admin` retornam sempre `ativo`/`master_system` (`billing.js:44-46`). 🟢 O job registra transições no log `[BillingJob] Tenant <tid>: <antes> -> <depois> (<motivo>)` (`billing.js:165`). 🟡 `diasRestantes` existe no retorno de `calcularBillingState`, mas não é persistido no tenant.

## 88. `PlanoCatalogo` — catálogo canônico 🟢

| ID | Família | Dias | Obras | Usuários | Trabalhadores | Preço | Checkout |
|---|---|---:|---:|---:|---:|---|---|
| `free_trial` | trial | 30 | 1 | 1 | 9999 | Grátis | — |
| `start` / `start_anual` | start | 31 / 365 | 2 | 2 | 9999 | R$ 69,90 / Anual | `hHQz2Zu` |
| `pro` / `pro_anual` / `premium` | pro | 31 / 365 / 31 | 5 | 5 | 9999 | R$ 105,90 / Anual | `d0Gfv34` |
| `ilimitado` / `ilimitado_anual` / `full_anual` | ilimitado | 31 / 365 / 365 | 9999 | 9999 | 9999 | R$ 299,00 / Anual | `z2hLFKq` |
| `master` | ilimitado | 3650 | 9999 | 9999 | 9999 | Sob consulta | `z2hLFKq` |
| `MASTER_SYSTEM` | sistema | 3650 | 9999 | 9999 | 9999 | Interno | — |

| Função | Regra | Origem |
|---|---|---|
| `normalizarPlanoAdmin` | aceita ID exato, aliases (`full`, `ilimitadoanual`, `mastersystem`, `startanual`, `proanual`) e normalização por minúsculas sem espaços/`_`/`-` | `plan_catalog.js:88-105` |
| `planoPorProduto` | nome contém `start` → start; `ilimitado`/`full`/`master` → ilimitado; resto → pro; `anual` ou `frequency=yearly` escolhe variante anual | `plan_catalog.js:107-114` |
| `limitesDoPlano` | mescla limites base com ajustes; rejeita ≤0/NaN e limita a 9999 | `plan_catalog.js:116-137` |
| `diasDoPlano` | padrão do plano, limitado a 3650 dias | `plan_catalog.js:140-143` |
| `checkoutDoPlano` | devolve URL do checkout ou `null` | `plan_catalog.js:145-148` |

🟢 `public/js/plans.js` espelha apenas os três planos vendáveis e os aliases de checkout (`plans.js:13-58`). 🟢 `tests/super-admin.test.js` valida limites e links entre catálogo, API e front (`super-admin.test.js:1-15`). 🟡 `master` e `MASTER_SYSTEM` apontam para o checkout `ilimitado`, embora não sejam vendidos.

## 89. `FeatureFlag` — matriz de capacidades 🟢

| Feature | Nível | Plano mínimo | Nome exibido |
|---|---:|---|---|
| `empreiteiro.subetapa` | 1 | Start | Controle por empreiteiro e subetapa |
| `perfis.usuario` | 1 | Start | Perfis de usuário |
| `relatorio.marca` | 2 | Pro | Relatório com marca |
| `exportacao` | 2 | Pro | Exportação |
| `relatorio.whatsapp.diario` | 2 | Pro | Relatório diário no WhatsApp |
| `subdominio` | 2 | Pro | Subdomínio personalizado |
| `pix.folha` | 3 | Ilimitado | PIX e folha de pagamento |

| Função | Regra | Origem |
|---|---|---|
| `nivelDoPlano` | `free_trial:2`, `start*:1`, `pro*`/`premium`:2, `ilimitado*`/`full*`/`master`/`MASTER_SYSTEM`:3 | `plan_features.js:16-28,94-96` |
| `hasFeature(nome, plano, contexto)` | `false` se feature desconhecida ou `contexto.billingState === 'bloqueado'`; senão `nivelDoPlano >= feature.nivel` | `plan_features.js:104-109` |
| `featuresDoPlano` | filtra todas as features por `hasFeature` | `plan_features.js:111-113` |
| `planoProMais` | `nivelDoPlano >= 2` | `plan_features.js:115-117` |
| `descrever` | clona a feature e acrescenta `plano` (`Start`/`Pro`/`Ilimitado`) | `plan_features.js:119-123` |

🟢 `public/js/plan_features.js` é gerado como espelho e `tests/plan-features.test.js:20-24` exige `JSON.stringify` idêntico entre front e backend. 🟢 `free_trial` recebe nível 2 como prévia do Pro durante os 30 dias (`plan_features.js:11`). 🟡 `pro_anual`/`start_anual` não aparecem na matriz browser de planos vendáveis, mas existem nos níveis.

## 90. `BillingEvent` — `billing_events/<orderId>/<eventType>` 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| `status` | enum(`processing`\|`success`\|`pending_tenant`\|`failed`) | `processing` ao reservar; terminal `success`; `pending_tenant`/`failed` retomáveis | `kiwify.js:181-213,451-463` |
| `claimedAt` | number (epoch ms) | carimbo da reserva; lease expira após 2 min | `kiwify.js:186,199` |
| `payloadHash` | string (sha256 hex) | JSON canônico sem `order_status` e `status` | `kiwify.js:296-301` |
| `tenantId` | string \| null | resolvido antes da reserva; `null` vira `pending_tenant` | `kiwify.js:286,339-346` |
| `orderId` / `eventType` / `orderStatus` | string | identificação do evento na Kiwify | `kiwify.js:229-231,452-456` |
| `processedAt` | number (epoch ms) | gravado junto com `status: success` | `kiwify.js:458-459` |
| `chargeAmount` | number | `Commissions.charge_amount / 100` ou `order_value` | `kiwify.js:360,460` |
| `paymentMethod` | string | `body.payment_method` ou `kiwify` | `kiwify.js:361,461` |
| `customerEmail` | string \| null | `Customer.email` ou `email` | `kiwify.js:462` |

🟢 A chave do nó usa `chaveSegura` (substitui `.#$[]/` por `_`, máx. 128 caracteres) (`kiwify.js:215-218`). 🟢 Rules: `.read` só super_admin e `.write: false` — todas as escritas vêm do Admin SDK (`database.rules.json:230-233`). 🟢 Reentrega idêntica responde `200 already_processed`; conflito de tenant/payload contra evento `success` responde `409 conflict_ignored` (`kiwify.js:307-335`). 🟡 Eventos com `orderId` ausente viram `SEM_ORDER_ID` e ainda reservam nó — podem colidir.

## 91. `UltimoPagamento` e `WebhookDebug` 🟢

| Estrutura | Campo | Tipo | Regra | Origem |
|---|---|---|---|---|
| `UltimoPagamento` | `orderId` | string | ID do pedido | `kiwify.js:364-372` |
| | `valor` | number | valor em reais | `kiwify.js:360` |
| | `data` | number (epoch ms) | carimbo persistido da reserva | `kiwify.js:367` |
| | `metodo` | string | `payment_method` ou `kiwify` | `kiwify.js:368` |
| | `origem` | literal `kiwify` | — | `kiwify.js:369` |
| | `status` / `eventType` | string | status e tipo do evento | `kiwify.js:370-371` |
| `WebhookDebug` | `timestamp` | number | `Date.now()` | `kiwify.js:146,158-168` |
| | `payload` | object | completo em eventos aceitos; reduzido em rejeições | `kiwify.js:151-156` |
| | `result` | string | descrição legível do desfecho | `kiwify.js:160` |
| | `signatureValid` / `orderId` / `eventType` / `status` | boolean/string | metadados do request | `kiwify.js:162-165` |
| | `email` / `tenantId` | string | `N/A` quando `incluirPayload: false` | `kiwify.js:149-150` |

🟢 `webhook_debug` é um push log somente leitura para o painel master (`database.rules.json:211-214`). 🟢 Rejeições por assinatura/método/order_id **não** gravam payload completo, evitando depósito de PII arbitrário (`kiwify.js:151-156`). 🟡 Aceites gravam o payload integral da Kiwify, incluindo dados do comprador, sem política de retenção própria neste módulo (a limpeza geral está em `retencaoSegurancaJob`).

## 92. `LimitesDoSistema` e enforcement de quantidade 🟢

| Alvo | Trigger | Limite lido | Comportamento | Origem |
|---|---|---|---|---|
| `tenants/<tid>/obras` | `onValueWritten` | `config/limiteObras` | se crescimento > limite, transação volta ao `beforeVal`; sem `beforeVal`, aborta | `index.js:644-646,580-601` |
| `tenants/<tid>/usuarios` | `onValueWritten` | `config/limiteUsuarios` | idem | `index.js:648-650` |
| `profiles/<uid>` | `onValueWritten` | `config/limiteUsuarios + 1` (dono) | perfil novo vira `pendente`; claims `{role:'pendente', tenantId:null}` | `index.js:616-640` |
| `tenants/<tid>/subdominioSlug` | `onValueWritten` | feature `subdominio` | reverte para slug anterior/`tenantId` e remove `tenants_public` órfão | `index.js:654-678` |
| `tenants/<tid>/config/slug` | `onValueWritten` | idem | idem | `index.js:678` |

| Constante | Valor | Significado | Origem |
|---|---:|---|---|
| `LIMITE_PLANO_ILIMITADO` | 9999 | acima disso o trigger não atua | `index.js:547` |
| `LIMITE_FALLBACK` | 1 | plano mais restrito quando metadado ausente | `index.js:548` |

🟢 `normalizarLimite` do servidor rejeita `null`/0/NaN e arredonda para baixo (`index.js:550-555`). 🟢 Perfis `pendentes` são excluídos da contagem de assentos (`index.js:603-612`). 🟡 Não há trigger de quantidade para `limiteTrabalhadores`. 🟡 O limite no cliente (`getPlanLimits`) é exibido a partir de `DB.config`, sem validar o plano — a autoridade é o trigger/Rules.

## 93. `CheckoutKiwify` e `external_reference` 🟢

| Plano vendável | Preço | Dias | Link | Alias aceitos no front |
|---|---|---:|---|---|
| `start` | R$ 69,90 | 31 | `https://pay.kiwify.com.br/hHQz2Zu` | `start_anual` |
| `pro` | R$ 105,90 | 31 | `https://pay.kiwify.com.br/d0Gfv34` | `pro_anual`, `premium` |
| `ilimitado` | R$ 299,00 | 31 | `https://pay.kiwify.com.br/z2hLFKq` | `ilimitado_anual`, `full_anual`, `full`, `master`, `MASTER_SYSTEM` |

| Etapa | Regra | Origem |
|---|---|---|
| origem do tenant | `sessionStorage.gestaoUser.tenantId` → `window.OBRA_CHECKOUT_TENANT_ID` | `plans.js:62-69`; `data_core.js:392` |
| URL final | `link + '?external_reference=' + encodeURIComponent(tenantId)` (ou `&` se já houver query) | `plans.js:107-109` |
| sem link válido | abre WhatsApp com mensagem "quero assinar o plano X (conta Y)" | `plans.js:71-77,101-105` |
| webhook identifica | tenta `external_reference` em `tenants`, depois `tenants_public/<slug>/tenantId`, depois e-mail | `kiwify.js:40-105` |

🟢 O painel master pode passar `tenantId` e `linkKiwify` explicitamente via `startKiwifyCheckoutFor` (`plans.js:84-88`). 🟡 Sem `tenantId` na sessão (ou se o checkout for aberto da landing), a identificação depende do e-mail do comprador casar com `emailAdmin`/perfil/convite.

## 94. `BillingUiState` e campos protegidos 🟢

| Símbolo | Tipo | Regra | Origem |
|---|---|---|---|
| `window.__billingState` | string \| null | espelho do nó `billingState`; usado por `hasFeature` e pelo handler de erro de leitura | `data_core.js:53,256,389,396,402-404` |
| `window.__lastBillingData` | object | reaplicado em trocas de página | `data_core.js:143` |
| `window.IS_READONLY_MODE` | boolean | `true` em `somente_leitura` e `bloqueado` | `data_core.js:149-150,168,188,206,224` |
| `billingStateRef` | Firebase Reference | listener isolado em `tenants/<tid>/billingState`; removido em troca de tenant | `data_core.js:53,384-386,402-404` |
| `PROTECTED_TENANT_FIELDS` | Set | `plano`, `planoVencimento`, `trialExpiracao`, `status`, `emailAdmin`, `webhookCriacao` + 11 campos de cobrança | `data_core.js:647-654` |
| `PROTECTED_CONFIG_FIELDS` | Set | `limiteObras`, `limiteUsuarios`, `limiteTrabalhadores`, `telefonesPermitidos` | `data_core.js:655-659` |
| `PLAN_DEFAULTS` | `{obras, usuarios, trabalhadores}` | fallback de `getPlanLimits()` quando config ausente | `data_core.js:230-241` |

🟢 Reenviar campos de cobrança no update do cliente faz `.validate` falhar e derruba **toda** a gravação — por isso a remoção explícita (`data_core.js:649-650`). 🟢 `renderBillingEnforcement` trata `bloqueado`, `somente_leitura`, `carencia` e `ativo`, com textos distintos para trial e assinatura paga (`data_core.js:167-226`). 🟡 O fallback local cobre só parcialmente o cálculo do servidor (ver §87).

## 95. Matriz de autorização RTDB — cobrança 🟢

| Operação | Super_admin | Membro do tenant | Observação | Origem |
|---|---|---|---|---|
| ler `tenants/<tid>` | sim | sim, se `billingState !== 'bloqueado'` | admin por e-mail/perfil/claim | `database.rules.json:33` |
| ler `tenants/<tid>/billingState` | sim | sim, mesmo bloqueado | exceção para tela de bloqueio | `database.rules.json:51` |
| escrever no tenant/coleções | sim | não em `somente_leitura`/`bloqueado` | guarda repetida em praticamente todas as coleções | `database.rules.json:34,61,79-130` |
| alterar `plano`/`planoVencimento` | sim | não (`.validate` exige valor igual) | criação permite só `free_trial` | `database.rules.json:38-43` |
| alterar `billingState` | sim | não (`.validate` exige valor igual) | criação permite `ativo` ou ausência | `database.rules.json:50-53` |
| alterar limites | sim | não (`.validate` exige valor igual) | defaults 1/1/9999 na criação | `database.rules.json:62-70` |
| ler `billing_events` / `webhook_debug` | sim | não | `.write: false` para todos | `database.rules.json:211-214,230-233` |
| ler `webhook_debug` via `super_admins/<uid>/ativo !== false` | — | — | também vale para leitura de `admin_ops` e `whatsapp_messages` | `database.rules.json:220-228` |

🟢 As rules não confiam em `DB` do cliente: consultam `root.child('profiles/' + auth.uid + '/role')`, claims e `data.child('emailAdmin')` (`database.rules.json:30-77`). 🟡 A verificação literal `auth.token.email === 'tonycampelo@gmail.com'` é um atalho legado de super_admin espalhado pelas rules.

## 96. Kiwify API (painel master) — credenciais e cache 🟢

| Recurso | Path | Parâmetros | Origem |
|---|---|---|---|
| `account` | `/account-details` | — | `kiwify_api.js:20-21` |
| `products` | `/products` | `page_size`, `page_number` | `kiwify_api.js:22` |
| `sales` | `/sales` | `start_date`, `end_date`, `page_size`, `page_number`, `status`, `product_id`, `payment_method` | `kiwify_api.js:23-26` |
| `webhooks` | `/webhooks` | `page_size`, `page_number` | `kiwify_api.js:27` |

| Item | Regra | Origem |
|---|---|---|
| Base URL | `https://public-api.kiwify.com/v1` | `kiwify_api.js:16` |
| Autenticação | `POST /oauth/token` com `client_id`/`client_secret` → Bearer token + header `x-kiwify-account-id` | `kiwify_api.js:6-11` |
| Janela máxima de vendas | 90 dias | `kiwify_api.js:17` |
| Segredos | `KIWIFY_CLIENT_ID`, `KIWIFY_CLIENT_SECRET`, `KIWIFY_ACCOUNT_ID`, `KIWIFY_API_TOKEN`, `KIWIFY_TOKEN` (webhook) | `index.js:820-826,840-858` |
| Cache de token | objeto em memória `cacheTokenKiwify`, injetado em `handleAdminRequest` | `index.js:839,850` |

🟢 O módulo `kiwify_api.js` não importa Firebase: fica testável e nenhum segredo volta ao navegador (`kiwify_api.js:8-11`). 🟢 `adminAccountApi` usa `cors: false` e valida o ID token dentro de `handleAdminRequest` (`index.js:840-848`). 🟡 O cache de token é por instância da função; reinícios e múltiplas instâncias podem gerar novas autenticações.

## 97. `MetaWebhookMessage` — payload normalizado da Meta 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| `object` | literal `whatsapp_business_account` | único aceito; `page`/Messenger retorna `null` | `whatsapp_auth.js:69` |
| `entry[].id` | string | comparado a `META_WABA_ID` quando configurado | `whatsapp_auth.js:61,83` |
| `changes[].value.metadata.phone_number_id` | string | comparado a `META_PHONE_NUMBER_ID` quando configurado | `whatsapp_auth.js:62-63` |
| `messages[0].from` | string | remetente em formato E.164; normalizado antes do matching | `whatsapp_auth.js:76,79` |
| `messages[0].id` | string | base da chave de dedup; ausência desativa a reserva | `whatsapp_auth.js:80,163` |
| `texto` | string | `msg.text.body` ou `msg.button.text`, nesta ordem | `whatsapp_auth.js:81` |
| `audioUrl` | string \| `null` | `https://graph.facebook.com/<encodeURIComponent(audio.id)>` | `whatsapp_auth.js:23,77,82` |
| `value` | object | payload bruto de `changes[].value`, passado para `validarOrigem` | `whatsapp_auth.js:84` |

| Request | Verificação | Resposta | Origem |
|---|---|---|---|
| `GET` | `hub.mode === 'subscribe'` + `validarVerifyToken` | `200 hub.challenge` ou `403 Token inválido` | `whatsapp_auth.js:192-199` |
| `POST` | `x-hub-signature-256` + `req.rawBody` + HMAC-SHA256 | `401 Invalid signature` | `whatsapp_auth.js:201-205` |
| POST com payload fora do formato | `extrairMensagem` devolve `null` | `404 Not Found` | `whatsapp_auth.js:207-208` |
| POST com WABA/phone divergentes | `validarOrigem === false` | `403 Origin not allowed` | `whatsapp_auth.js:209-212` |
| Outros métodos | — | `405 Method not allowed` | `whatsapp_auth.js:201` |

🟢 O HMAC é calculado sobre o corpo **cru**, não sobre `req.body` parseado (`whatsapp_auth.js:38-46`). 🟢 `seguroEqual` aplica SHA-256 antes de `timingSafeEqual`, igualando os tamanhos comparados (`whatsapp_auth.js:26-31`). 🟡 `extrairMensagem` considera apenas a **primeira** mensagem do primeiro `changes` com `messages[0].from`.

## 98. `WhatsappAuthorization` e motivos de rejeição 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| `ok` | boolean | `true` somente com tenant único e estado permitido | `whatsapp_auth.js:107-154` |
| `tenantId` | string | somente quando `ok === true` | `whatsapp_auth.js:123,135` |
| `user` | objeto \| `null` | registro de `users/<email>`; `null` quando veio da allowlist | `whatsapp_auth.js:123,135` |
| `origem` | enum(`users`\|`telefonesPermitidos`) | fonte da associação | `whatsapp_auth.js:123,135` |
| `motivo` | enum dos motivos abaixo | presente apenas em falha | `whatsapp_auth.js:109,122,138,143-151` |

| Motivo | Condição | Efeito | Origem |
|---|---|---|---|
| `telefone_invalido` | `normalizarTelefone` devolve `''` | 403, sem processar | `whatsapp_auth.js:108-109` |
| `numero_ambigu` | o número casa com mais de um tenant em `users` ou na allowlist | 403 — nunca escolhe o primeiro | `whatsapp_auth.js:120-124,137` |
| `numero_nao_autorizado` | nenhum casamento em `users` nem na allowlist | 403 + mensagem "Número não autorizado" | `whatsapp_auth.js:138,223-231` |
| `tenant_inexistente` | `tenants/<tid>` não existe | 403 | `whatsapp_auth.js:143` |
| `tenant_inativo` | `status` `inativo` ou `bloqueado` | 403 | `whatsapp_auth.js:144-146` |
| `tenant_bloqueado` | `billingState` `bloqueado` ou `somente_leitura` | 403 | `whatsapp_auth.js:147-149` |
| `usuario_inativo` | `user.status` em `inativo`/`bloqueado`/`desativado` | 403 | `whatsapp_auth.js:150-152` |

| Regra de normalização | Detalhe | Origem |
|---|---|---|
| `normalizarTelefone` | mantém só dígitos; se >11 e começa com `55`, remove o prefixo; exige 10–11 dígitos | `whatsapp_auth.js:49-53` |
| Matching em `users` | compara `whatsappId` **e** `telefone`, ambos normalizados; exige `tenantId` presente | `whatsapp_auth.js:111-119` |
| Fallback | `tenant.config.telefonesPermitidos`, aceito como escalar ou array (`[bruto].flat()`) | `whatsapp_auth.js:126-133` |
| Precedência | `users` primeiro; allowlist só se `candidatos.length === 0` | `whatsapp_auth.js:120-138` |

🟢 A associação usa Admin SDK e não depende das rules — por isso a checagem de unicidade é explícita (`whatsapp_auth.js:102-106`). 🟢 O bloqueio por cobrança reusa `billingState`, sem regra paralela (`whatsapp_auth.js:147`). 🟡 `db.ref('users')` e `db.ref('tenants')` são lidos por completo a cada mensagem.

## 99. `WhatsappMessageReservation` — `whatsapp_messages/<chave>` 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| chave do nó | string | `msgId` com caracteres não alfanuméricos removidos (exceto `_` e `-`), máx. 128 | `whatsapp_auth.js:156-157` |
| `recebidaEm` | number (epoch ms) | `Date.now()` na reserva; base da retenção | `whatsapp_auth.js:166,171` |
| `status` | enum(`processing`\|`done`\|`rejected`) | `processing` na reserva; atualizado ao concluir | `whatsapp_auth.js:166,171,258,230,239,245` |
| `concluidaEm` | number (epoch ms) | gravado junto com `done`/`rejected` | `whatsapp_auth.js:179` |

| Desfecho | Ação no nó | HTTP | Origem |
|---|---|---|---|
| nova mensagem | transação cria `processing` | processa e responde `200 OK` | `whatsapp_auth.js:161-174,258-259` |
| reentrega do mesmo `msgId` | transação encontra valor existente | `200 DUPLICATE` (sem reprocessar) | `whatsapp_auth.js:214-218` |
| remetente/estado/URL inválidos | `status: rejected` | `403`/`400` | `whatsapp_auth.js:230,239,245` |
| exceção no processamento | reserva removida no `catch` | `500 Internal error` (Meta reenvia) | `whatsapp_auth.js:260-269` |
| sem `msgId` | reserva ignorada (`ref: null`) | segue processamento | `whatsapp_auth.js:163` |

🟢 Fallback sem `transaction` faz `once` + `set`, para compatibilidade com mocks e instâncias antigas (`whatsapp_auth.js:168-172`). 🟢 `concluirMensagem` não deixa erro de gravação falhar a resposta (`whatsapp_auth.js:176-183`). 🟢 Rules: `.write:false`, `.read` só super_admin (`database.rules.json:219-222`; `tests/abuso.test.js:127`). 🟢 Retenção de 24 h por `recebidaEm` (`retencao.js:14,21`). 🟡 Reserva `processing` presa só expira na limpeza diária, não por lease curto.

## 100. `WhatsappIntent` — intenção local e JSON do GPT 🟢

| Intenção | Gatilho local | Dados gerados | GPT? | Origem |
|---|---|---|---|---|
| `criar_tarefa` | texto curto começando com `TAREFA` (sem `LISTA`) | `{tarefa:{titulo, obra_nome}, _etapas}` | não | `index.js:205-213` |
| `criar_tarefa` | `detectarEtapas(txt)` retorna algo | `{tarefa:{titulo:txt, obra_nome:null}, _etapas}` | não | `index.js:228-231` |
| `lancar_ponto` | `^PONTO `, `^PRESEN`, ou `PONTO/PRESENÇA/ENTRADA/SAÍDA/FALTA` | `{ponto:{trabalhadores, presenca, obra_nome:null}}` | não | `index.js:206,214-217` |
| `consultar` | `OI`, `OLA`, `^BOM DIA`, `TAREFA`, `LISTA`, `MENU` | `{intencao:'consultar'}` | não | `index.js:218-226` |
| `consultar_ponto` | `PONTO`/`PRESENÇA` exatos | `{intencao:'consultar_ponto'}` | não | `index.js:221-223` |
| qualquer outra | texto longo, áudio ou sem match local | JSON do `gpt-4o-mini` | sim | `index.js:238-271` |

| Campo do JSON | Tipo | Regra | Origem |
|---|---|---|---|
| `intencao` | enum(`lancar_ponto`\|`criar_tarefa`\|`consultar`) | prompt restringe as três opções | `index.js:241` |
| `ponto.trabalhadores` | string[] | nomes mencionados ou a frase "toda a equipe" | `index.js:243,255` |
| `ponto.presenca` | enum(`Presente`\|`Falta`\|`Meio período`) | usado como `_s`/`presenca` no registro | `index.js:244,354` |
| `ponto.obra_nome` | string \| `nao_informada` | preposições são ignoradas no prompt | `index.js:245,256` |
| `ponto.data` | string `YYYY-MM-DD` | data de hoje em `America/Sao_Paulo` injetada no prompt | `index.js:236,246` |
| `tarefa.titulo` | string | descrição clara extraída | `index.js:249` |
| `tarefa.obra_nome` | string \| `nao_informada` | resolvida por `buscarObra()` | `index.js:250,277` |
| `_etapas` | `EtapaDetectada[]` | somente na detecção local; não vem do GPT | `index.js:212,230,320` |

🟢 `isTextoCurto = !audioUrl && txt.length < 200` evita custo de GPT em comandos curtos (`index.js:200`). 🟢 Prefixo `TAREFA` supports `"TAREFA Obra - descrição"`: o trecho antes de `" - "` vira `obra_nome` (`index.js:209-210`). 🟡 Erro de digitação `SAÍTA` é tratado como `Saída` em `index.js:215`. 🟡 `consultar_ponto` não tem branch de tratamento em `processarMensagem`. 🟡 O JSON do GPT não passa por validação de schema.

## 101. `EtapaCatalogo` — 10 etapas e sinônimos 🟢

| Etapa | Código | Frente | Prioridade padrão | Exemplos de sinônimos |
|---|---|---|---|---|
| Terraplanagem e Fundação | `FUND` | Fundação | Alta | terraplanagem, sapata, radier, estaca, escavação, aterro, arrimo |
| Estrutura | `ESTR` | Estrutura | Alta | concreto armado, laje, viga, pilar, fôrma, ferragem, steel deck |
| Alvenaria | `ALVE` | Alvenaria | Média | parede, tijolo, reboco, chapisco, massa, drywall, azulejo |
| Cobertura | `COBE` | Cobertura | Média | telhado, telha, caibro, cumeeira, calha, manta asfáltica |
| Hidrossanitário | `HIDR` | Hidrossanitário | Média | encanamento, esgoto, PVC, registro, bacia, ralo, bomba d'água |
| Elétrica | `ELET` | Elétrica | Média | fiação, eletroduto, quadro de luz, disjuntor, tomada, aterramento |
| Esquadrias | `ESQU` | Esquadrias | Baixa | porta, janela, vidro, blindex, portão, caixilho, batente |
| Revestimento e Acabamento | `ACAB` | Acabamento | Baixa | pintura, piso, rodapé, forro, sancas, rejunte, silicone |
| Instalações Especiais | `ESPE` | Instalações Especiais | Média | gás, aquecedor, painel solar, automação, elevador, sprinkler |
| Urbanização e Paisagismo | `URBA` | Urbanização | Baixa | jardim, grama, calçada, paver, estacionamento, drenagem, entulho |

| Item | Regra | Origem |
|---|---|---|
| normalização | minúsculas, NFD sem acentos, não-`[a-z0-9\s]` → espaço, colapsa espaços | `obra-etapas.js:189-197` |
| score | cada synonym batido soma `palavraNorm.split(' ').length` | `obra-etapas.js:217-221` |
| ordenação | `resultados.sort((a,b) => b.score - a.score)` | `obra-etapas.js:237` |
| urgência | `PALAVRAS_URGENCIA` (`urgente`, `agora`, `hoje`, `asap`, `emergencia`, …) força prioridade `Alta` | `obra-etapas.js:187,199-207` |
| confiança em `extrairTarefas` | `alta` se `score >= 3`, `media` se `>0`, `baixa` se sem etapa (frase com ≥2 palavras) | `obra-etapas.js:252-279` |
| divisão de frases | `split(/[,;\n.]+/)`, descarta sentenças com ≤3 caracteres | `obra-etapas.js:241-244` |
| capitalização | primeira letra maiúscula, resto minúsculo | `obra-etapas.js:286-288` |

🟢 `detectarEtapas` e `extrairTarefas` são funções puras e exportadas — usadas pelo fluxo ativo (`detectarEtapas`) e pelo parser desconectado (`extrairTarefas`) (`obra-etapas.js:290`). 🟡 `PALAVRAS_URGENCIA` tem `'pra ja'` duplicado e uma variante sem acento (`'de urgncia'`). 🟡 Termos de uma letra/acentuação dependem inteiramente da normalização NFD.

## 102. `TarefaViaWhatsApp` — gravação em `tenants/<tid>/tarefas` 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| `cod` | string | `TF` + `String(lista.length + 1).padStart(3,'0')` | `index.js:318` |
| `obra` | string | `obraMatch.cod \|\| obraMatch._id` | `index.js:323` |
| `desc` | string | `dados.tarefa.titulo` | `index.js:324` |
| `etapa` / `etapaCodigo` / `frente` / `prioridade` | string \| `null` | primeira etapa detectada; `prioridade` cai para `Média` | `index.js:320-328` |
| `resp` | string | fixo `'Equipe'` | `index.js:329` |
| `status` | literal `Pendente` | — | `index.js:330` |
| `criadoPor` | string | `user.nome \|\| 'WhatsApp'` | `index.js:331` |
| `criadoEm` | `ServerValue.TIMESTAMP` | carimbo do servidor | `index.js:332` |
| `origem` | literal `WhatsApp` | distingue de tarefas manuais | `index.js:333` |

| Resolução de obra | Regra | Origem |
|---|---|---|
| filtro | status em `ativa`, `em andamento`, `planejada`, `execucao` (normalizados) | `index.js:286-288` |
| 1ª passada | `nome`, `cod` ou `_id` normalizados, iguais ao pedido | `index.js:294-301` |
| 2ª passada | `norm(o.nome).includes(buscaNorm)` | `index.js:303-306` |
| 3ª passada | `melhorMatch(..., threshold 0.3)` | `index.js:309` |
| sem obra | responde `Obra "<nome>" não encontrada.` e aborta | `index.js:314` |

🟢 A resposta de sucesso inclui etapa/frente/prioridade quando detectadas (`index.js:338-340`). 🟡 Código sequencial por tamanho da lista pode colidir após exclusões. 🟡 `norm(o.cod)` usa `.normalize()` sem garantir string (`index.js:92-95`).

## 103. `PresencaViaWhatsApp` — gravação em `tenants/<tid>/presenca` 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| `data` | string `YYYY-MM-DD` | `dados.ponto.data \|\| getHojeBR()` | `index.js:353` |
| `obra` | string | `obraMatch.cod \|\| obraMatch._id` | `index.js:368` |
| `trab` / `nome` / `funcao` / `vinculo` / `equipe` | string | do trabalhador casado; `vinculo` default `Informal` | `index.js:368-370` |
| `entrada` / `saida` | string `HH:mm` | Presente `07:00/17:00`; Meio período `07:00/12:00`; Falta `00:00/00:00` | `index.js:370` |
| `hnorm` | number | `8` (Presente), `4` (Meio período), `0` (Falta) | `index.js:362-365` |
| `hextra` | number | fixo `0` | `index.js:371` |
| `presenca` / `_s` | string | `Presente`, `Meio período` ou `Falta`; `_s` removido antes de gravar | `index.js:374,383` |
| `diaria` / `total` | number | diária do trabalhador; metade em meio período; zero em falta | `index.js:362-365,371` |
| `pgtoStatus` / `valpago` | string / number | `Pendente` / `0` | `index.js:371` |
| `lancador` | string | `user.nome \|\| 'WhatsApp Bot'` | `index.js:372` |
| `hrLanc` | string | hora em `America/Sao_Paulo` via `Intl.DateTimeFormat('pt-BR')` | `index.js:373` |
| `origem` | literal `WhatsApp` | — | `index.js:374` |
| `telefoneAutor` | string | telefone do remetente (`From` só dígitos) | `index.js:167,374` |

| Etapa do matching | Regra | Origem |
|---|---|---|
| trabalhadores | somente `norm(status) === 'ativo'` | `index.js:346-349` |
| nome | `melhorMatch(nomeB, listaAtivos, t => t.nome, 0.5)` | `index.js:359` |
| sem match | resposta inclui `⚠️ "<nome>" não achado` | `index.js:360` |
| transação | índice por `data === n.data && trab === n.trab`; atualiza ou adiciona | `index.js:378-393` |

🟢 A transação evita duplicar `data + trab` quando chegam duas mensagens concorrentes (`index.js:379-393`). 🟡 O resumo é enviado mesmo quando nenhum trabalhador foi encontrado. 🟡 O relatório diário lê `tenants/<tid>/ponto/<hoje>` e não `presenca`, divergindo desta gravação.

## 104. `TarefaPendente` — `tenants/<tid>/tarefas_pendentes/<from>` 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| chave `<from>` | string | telefone bruto recebido, **sem normalização** | `parser-tarefas.js:14` |
| `transcricao` | string | texto transcrito pelo Whisper | `parser-tarefas.js:15` |
| `tarefas` | `TarefaDetectada[]` | saída de `extrairTarefas` | `parser-tarefas.js:16` |
| `timestamp` | number (epoch ms) | `Date.now()` | `parser-tarefas.js:17` |

| Comando | Função | Efeito | Origem |
|---|---|---|---|
| prévia | `buildConfirmacaoPreview` | ícones 🟢/🟡/🔴 por confiança etapa/frente/prioridade/status + instruções | `parser-tarefas.js:25-50` |
| `CONFIRMAR` | `confirmarTarefas` | `push` em `tarefas`; remove pendente; `criadoEm` UTC | `parser-tarefas.js:56-92` |
| `EDITAR n texto` | `editarTarefaPendente` | redeteca etapa/prioridade e reenvia prévia | `parser-tarefas.js:94-128` |
| `CANCELAR` | `cancelarTarefas` | remove pendente | `parser-tarefas.js:130-134` |

🟢 O parser usa `db.ref(...).push()` (chave gerada) em vez do código sequencial do fluxo ativo (`parser-tarefas.js:69`). 🔴 Nenhuma dessas funções é importada por `index.js`: o fluxo ativo grava tarefa diretamente, sem prévia/confirmação. 🟡 Chave `<from>` sem normalização separa o mesmo remetente em pendências distintas. 🟡 `criadoEm` usa UTC (`toISOString().split('T')[0]`), divergente de `getHojeBR()`.

## 105. `WhatsappSecrets`, respostas e proteção RTDB 🟢

| Símbolo / segredo | Valor / regra | Origem |
|---|---|---|
| `META_VERIFY_TOKEN` | comparado a `hub.verify_token` com `seguroEqual` | `index.js:129,141`; `whatsapp_auth.js:193-196` |
| `META_APP_SECRET` | HMAC-SHA256 do `rawBody` | `index.js:129,142`; `whatsapp_auth.js:39-46` |
| `META_WABA_ID` | `entry.id` esperado (opcional) | `index.js:129,143`; `whatsapp_auth.js:61` |
| `META_PHONE_NUMBER_ID` | `metadata.phone_number_id` esperado e usado no envio | `index.js:129,143,408`; `whatsapp_auth.js:63` |
| `META_ACCESS_TOKEN` | Bearer na Graph API v20.0 | `index.js:129,407,435` |
| `OPENAI_KEY` | Whisper e GPT-4o-mini | `index.js:129,176,260` |
| `DOMINIO_GRAPH` | `graph.facebook.com`; aceito também `*.fbcdn.net` para mídia | `whatsapp_auth.js:23,92-100` |
| `LIMITE_AUDIO` | `8 * 1024 * 1024` bytes | `whatsapp_auth.js:24`; `index.js:179-184` |

| Operação | Regra no RTDB | Origem |
|---|---|---|
| ler `whatsapp_messages` | só super_admin (claim, role ou e-mail legado) | `database.rules.json:219-221` |
| escrever `whatsapp_messages` | `.write: false` — somente Admin SDK | `database.rules.json:222` |
| alterar `users/<email>.telefone` | só super_admin ou `super_admins/<uid>/ativo !== false` | `database.rules.json:261-263`; `tests/abuso.test.js:129` |
| alterar `users/<email>.whatsappId` | idem | `database.rules.json:264-266`; `tests/abuso.test.js:129` |
| alterar `tenants/<tid>/config/telefonesPermitidos` | idem | `database.rules.json:74-76`; `tests/abuso.test.js:131` |

| Resposta enviada | Texto-base | Origem |
|---|---|---|
| não autorizado | `Número não autorizado. Fale com o administrador.` | `whatsapp_auth.js:226-227` |
| erro | `Erro no servidor.` | `whatsapp_auth.js:266`; `index.js:402` |
| obra não encontrada | `Obra "<nome>" não encontrada.` / `não identificada.` | `index.js:314,344` |
| tarefa registrada | `🎯 *Tarefa Registrada!* … Já está no painel! ✅` | `index.js:339` |
| presença | `📋 Presença — <data BR>:` + resultados por trabalhador | `index.js:395-396` |
| consulta geral | data, obra, presentes, faltas, tarefas abertas + instruções | `index.js:515-538` |
| relatório diário | cabeçalho com `tenant.nome`, presentes/faltas/total e tarefas | `index.js:448-512` |

🟢 Identidade do bot no RTDB é protegida por rules e validada por `tests/abuso.test.js:124-131`. 🟢 Nenhum segredo da Meta volta ao navegador — as funções usam `defineSecret`/Secret Manager (`index.js:129`). 🟡 Graph API sem retry nem dead-letter: falha de envio é apenas logada (`index.js:437-446`).

## 106. `SuperAdminAllowlist` — `super_admins/<uid>` 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| chave `<uid>` | string | UID do Firebase Auth; gravado só com Admin SDK | `claims.js:40-45`; `database.rules.json:234-239` |
| `uid` | string | copiado do parâmetro na migração legada | `claims.js:58-63` |
| `email` | string | normalizado (trim + minúsculas); permite ausência na allowlist | `claims.js:37,43` |
| `role` | literal `super_admin` | gravado na migração | `claims.js:60` |
| `migradoEm` | number (epoch ms) | `Date.now()` na migração automática | `claims.js:62` |
| `ativo` | boolean \\| ausente | `false` revoga a autoridade; ausente = ativo | `claims.js:43`; `super_admin.js:78` |

| Origem da decisão | Condição em `avaliarSuperAdmin` | `motivo` | Origem |
|---|---|---|---|
| allowlist | nó existe, `ativo !== false` e (`email` ausente ou igual) | `allowlist` | `claims.js:40-45` |
| e-mail mestre | `email === 'tonycampelo@gmail.com'` | `email_mestre` | `claims.js:11,48-50` |
| migração legada | `currentClaims.role === 'super_admin'` **e** `users/<chave>/role === 'super_admin'` | `legado_migrado` | `claims.js:52-68` |
| sem identidade | UID ou e-mail vazios | `sem_identidade` | `claims.js:38` |
| negação | nenhuma condição anterior | `nao_autorizado` | `claims.js:71` |

🟢 `.read` restrito a super_admin e `.write:false` nas rules — o cliente não pode gravar a allowlist (`database.rules.json:234-239`). 🟢 `users/<email>` é apenas passaporte legado: **não promove**, só preserva uma promoção já existente nas claims (`claims.js:7-9`). 🟢 `chaveEmail` troca `.` por `,` (`claims.js:17-19`); `normalizarRole` converte `mestre` em `encarregado` (`claims.js:21-24`).

## 107. `ClaimSnapshot` — `profiles/<uid>` → Custom Claims 🟢

| Campo da claim | Tipo | Regra | Origem |
|---|---|---|---|
| `role` | string | `admin`, `rh`, `engenheiro`, `encarregado`, `comprador`, `pendente`, `bloqueado`, `super_admin` | `index.js:699-758`; `database.rules.json:20` |
| `tenantId` | string \\| `null` | perfil do usuário; `MASTER_SYSTEM` só para super_admin; `null` para `pendente`/`bloqueado` | `index.js:702,708,734` |
| `modulosPermitidos` | objeto `chave:true` | somente quando `role === 'rh'`; chaves com valor `true` | `index.js:792-800` |
| `acessoObras` | enum(`todas`\\|`especificas`) | `especificas` somente quando o perfil diz exatamente isso | `index.js:801` |
| `obrasPermitidas` | string[] | máx. 50, sem vazios, `trim()` | `index.js:802-805` |

| Situação do perfil | Claims geradas | Efeito adicional | Origem |
|---|---|---|---|
| `status='pendente'` | `{role:'pendente', tenantId:null}` | nenhuma claim de módulo/obra | `index.js:706-709` |
| `status='bloqueado'` | `{role:'bloqueado', tenantId:null}` | `revokeRefreshTokens(uid)` | `index.js:706-712` |
| perfil deletado | — | `Auth.deleteUser`; se falhar, `disabled:true` + claims `null` | `index.js:684-697` |
| novo perfil acima do limite | `{role:'pendente', tenantId:null}` | trava de assentos | `index.js:716-720` |
| `role='super_admin'` sem autoridade | `{role:'admin', tenantId: seguro}` | perfil reescrito com `cargoAtualizadoPor`; revoke se antes era master | `index.js:741-758` |
| RH | `{role:'rh', tenantId, modulosPermitidos, acessoObras, obrasPermitidas}` | assinatura evita update redundante | `index.js:762-809` |

🟢 `assinaturaAtual`/`assinaturaPerfil` comparam módulos, acesso e obras ordenados para evitar `setCustomUserClaims` desnecessário (`index.js:762-785`). 🟢 Para não-RH, `setCustomUserClaims` substitui o objeto inteiro e remove as chaves de RH (`index.js:807-809`). 🟡 `mestre` é normalizado para `encarregado` nas claims, mas ainda Aceito como alias nas rules (`index.js:700-701`; `storage.rules:14`).

## 108. `AdminRequestContext` e `AuditEntry` — `admin_audit` 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| `requestId` | string | `x-request-id` ou `body.requestId`, sanitizado `[A-Za-z0-9_-]`, máx. 128; senão `crypto.randomUUID()` | `auditoria.js:22-26` |
| `roteiro` | string | padrão `admin`; handlers usam `admin:conta` etc. | `auditoria.js:20,29`; `super_admin.js:351` |
| `ipHash` | string | `hashIp(req)` — 32 hex, sem IP em claro | `auditoria.js:27`; `abuso.js:33-41` |
| `userAgent` | string | cabeçalho `user-agent`, máx. 200 caracteres | `auditoria.js:28` |
| `duracaoMs` | number | `Date.now() - inicio`, nunca negativo | `auditoria.js:30,38-40` |
| `atorUid` / `atorEmail` | string \\| `null` | `null` em tentativas de token inválido | `auditoria.js:48-49` |
| `acao` | string | máx. 64; padrão `desconhecida` | `auditoria.js:50` |
| `alvo` | string | máx. 300 | `auditoria.js:51` |
| `sucesso` | boolean | `false` em exceções | `auditoria.js:52` |
| `detalhes` | string | máx. 300; contém `err.code || err.message` | `auditoria.js:53`; `super_admin.js:456` |
| `timestamp` | number (epoch ms) | `Date.now()` na gravação; base da retenção de 90 dias | `auditoria.js:42`; `retencao.js:12,19` |

| Comportamento | Regra | Origem |
|---|---|---|
| gravação | `db.ref('admin_audit').push(registro)` | `auditoria.js:61` |
| sem `db` | `false`; se obrigatória, lança `503 auditoria_indisponivel` | `auditoria.js:56-59` |
| falha de escrita | `false`; se obrigatória, lança `503 auditoria_falhou` | `auditoria.js:63-67` |
| falhas de auth | também registradas, com `ator=null` | `super_admin.js:453-460` |
| link de reset | **nunca** entra em `detalhes` | `super_admin.js:153` |
| rules | `.read` só super_admin; `.write:false`; índices `timestamp`, `atorEmail` | `database.rules.json:203-210` |

🟢 Toda resposta de erro devolve `requestId` e `idempotente` para repetição segura (`super_admin.js:462-468`).

## 109. `AdminOperationReservation` — `admin_ops/<requestId>` 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| chave | string | `requestId` com caracteres inválidos removidos; vazio desativa a reserva | `auditoria.js:75-77` |
| `acao` | string | máx. 64 | `auditoria.js:79` |
| `alvo` | string | máx. 300 | `auditoria.js:80` |
| `atorUid` | string \\| `null` | UID do operador | `auditoria.js:81` |
| `reservadoEm` | number (epoch ms) | base da retenção de 24 h | `auditoria.js:82`; `retencao.js:13,20` |

| Desfecho | Transação / ação | Resposta | Origem |
|---|---|---|---|
| primeira chamada | `transaction(atual => atual ? undefined : info)` | executa ação | `auditoria.js:85-88` |
| reentrega | nó já existe, `committed=false` | `200 {ok:true, idempotente:true, requestId}` | `super_admin.js:381-387` |
| efeito não aplicado | `liberarOperacao` remove a reserva | retry permitido | `super_admin.js:448-450` |
| efeito aplicado + auditoria falhou | reserva mantida | `503 auditoria_falhou` na 1ª, `200 idempotente` na 2ª | `hardening.md:89-92` |
| fallback sem `transaction` | `once` + `set` para mocks | mesmo contrato | `auditoria.js:89-92` |

🟢 Rules: `.read` só super_admin/allowlist, `.write:false`, índice `reservadoEm` (`database.rules.json:223-229`).

## 110. `RateLimitBucket` — `rate_limits/<chave>/<bucket>` 🟢

| Campo | Tipo | Regra | Origem |
|---|---|---|---|
| `chave` | string | `admin:ip:<hashIp>`, `admin:uid:<uid>`, `admin:acao:<uid>`, `admin:kiwify:<uid>`, `criar:ip:…`, `criar:uid:…`; sanitizada para `[A-Za-z0-9_:@-]` | `abuso.js:52`; `super_admin.js:365,368,377,405`; `usuarios.js:72,95` |
| `<bucket>` | number | `Math.floor(Date.now() / janelaMs)` | `abuso.js:50` |
| `n` | number | incremento atômico por transação; `total > limite` → `429` | `abuso.js:53-58,72-76` |
| `expiraEm` | number (epoch ms) | `Date.now() + 2 * janelaMs`; usado pela retenção de 2 h | `abuso.js:66-70`; `retencao.js:15,22` |

| Limite | Janela | Origem |
|---|---|---|
| corpo > 16 KB | imediato | `413 payload_muito_grande` (`abuso.js:5,15-28`) |
| `admin:ip` 60, `admin:uid` 120, `admin:acao` 30, `admin:kiwify` 30 | 60 s | `super_admin.js:365,368,377,405` |
| `criar:ip` 20, `criar:uid` 60 | 60 s | `usuarios.js:72,95` |
| excesso | `retryAfter = ceil(janelaMs/1000)` | `429 muchas_tentativas` + header `Retry-After` (`abuso.js:73-75`) |

🟢 `.read:false` e `.write:false` — o nó é manipulado apenas pelo Admin SDK (`database.rules.json:215-218`). 🟢 `expiraEm` é gravado em `try/catch`: falha de TTL não derruba a operação (`abuso.js:66-70`). 🟡 Fallback `once`+`set` só existe para mocks e não é a porta de entrada em produção (`abuso.js:59-64`).

## 111. Matriz de permissões efetiva 🟢

| Nó / caminho | super_admin | admin | rh (com módulo) | engenheiro | encarregado/mestre | comprador |
|---|---|---|---|---|---|---|
| `profiles` (lista) | sim | não | não | não | não | não |
| `profiles/<uid>` próprio | sim | sim (campos protegidos imutáveis) | idem | idem | idem | idem |
| `tenants/<tid>` | sim | sim, se `emailAdmin` ou `profiles.tenantId` | leitura se mesmo tenant | leitura se mesmo tenant | leitura se mesmo tenant | leitura se mesmo tenant |
| `tenants/<tid>/config` | sim | sim, salvo `somente_leitura`/`bloqueado` | não | não | não | não |
| `config.telefonesPermitidos` | sim | não | não | não | não | não |
| `presenca`, `tarefas`, `almocos` | sim | sim | se `modulosPermitidos.<módulo>` | sim | sim | não |
| `obras`, `medicao` | sim | sim | se módulo habilitado | sim | não | não |
| `estoque`, `canteiro`, `compras`, `comprasPrivadas` | sim | sim | se módulo habilitado | não | não | sim |
| `movEstoque`, `trabalhadores`, `usuarios`, `financeiro`, `orcamento` | sim | sim | se módulo habilitado | não | não | não |
| `aprovacoes/<id>` | sim (via API) | sim (via API) | se `aprovacoes` + módulo do tipo | cria solicitações | cria solicitações | não |
| `auditoria`, `notificacoes`, `tarefas_pendentes` | leitura | leitura no próprio tenant | leitura no próprio tenant | leitura no próprio tenant | leitura no próprio tenant | leitura no próprio tenant |
| `admin_audit`, `admin_ops`, `billing_events`, `webhook_debug`, `whatsapp_messages`, `rate_limits`, `super_admins` | leitura; `.write:false` | não | não | não | não | não |
| Storage `tenants/<tid>/**` | sim, com `tenantId='MASTER_SYSTEM'` | sim | sim | sim | sim | sim |
| Storage fora de `tenants/<tid>/` | não | não | não | não | não | não |

🟢 Regras comuns: `profiles/<uid>/tenantId === $tenantId` e `billingState !== 'bloqueado'` para leitura; `!== 'somente_leitura'` e `!== 'bloqueado'` para escrita (`database.rules.json:30-161`). 🟢 `rh` só entra quando `auth.token.modulosPermitidos.<modulo> === true` **ou** o perfil espelha `true`; para obras, `acessoObras='especificas'` restringe por `obrasPermitidas` (`database.rules.json:79-128`; `index.js:788-806`). 🟢 Campos imutáveis para o cliente: `profiles.uid/email/role/tenantId/status`, `users.uid/role/tenantId`, `invites.tenantId`, `tenants.plano/planoVencimento/status/billingState` (salvo super_admin) (`database.rules.json:13-27,35-59,249-282`). 🟡 `mestre` continua como alias legado em várias expressões.

## 112. `RetentionPolicy`, cabeçalhos e segredos 🟢

| Política / configuração | Valor | Origem |
|---|---|---|
| `admin_audit` | 90 dias por `timestamp` | `retencao.js:12,19` |
| `admin_ops` | 24 h por `reservadoEm` | `retencao.js:13,20` |
| `whatsapp_messages` | 24 h por `recebidaEm` | `retencao.js:14,21` |
| `rate_limits` | 2 h por `expiraEm < agora` | `retencao.js:15,22,42` |
| job | `every day 03:30`, `America/Sao_Paulo`, 256 MiB, 120 s | `index.js:913-918` |
| CSP | sem `unsafe-eval`; `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`; `img-src` explícito | `hardening.md:103-106` |
| COOP | `same-origin-allow-popups` (necessário ao `signInWithPopup`) | `cors.md:47-49`; `hardening.md:107-108` |
| CORS Storage | `*.obrareal.com` + `controle-obras-c889d.web.app`/`.firebaseapp.com`, sem `PUT`/`DELETE`, `Vary: Origin` | `cors.md:7-17,47-55` |
| CORS Worker | `ALLOWED_ORIGINS` espelha `cors.json` | `cors.md:10-17` |
| Functions | `cors:false` em admin APIs e webhooks; `maxInstances:3` (admin/Kiwify), `5` (WhatsApp) | `cors.md:41-45`; `index.js:840-884,128` |
| Segredos de deploy | `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_WABA_ID`, `META_PHONE_NUMBER_ID`, `KIWIFY_TOKEN`, `KIWIFY_CLIENT_ID`, `KIWIFY_CLIENT_SECRET`, `KIWIFY_ACCOUNT_ID` | `hardening.md:144-152` |
| Bootstrap local | `functions/serviceAccountKey.json` (gitignorado), e-mail `tonycampelo@gmail.com` | `set_super_admin.js:1-27`; `super-admin.md:88-98` |
| Dependências | `npm audit` 0 vulnerabilidades; Admin SDK 14.5.1 / Functions 7.4.0 com imports modulares | `hardening.md:113-121` |

🟢 `.gitignore` cobre `.env*`, `serviceAccountKey.json` e exports locais; varredura dos 423 commits não encontrou chave privada versionada (`hardening.md:128-131`). 🟡 `'unsafe-inline'` ainda é necessário por handlers inline existentes. 🔴 O histórico Git antigo contém `node_modules` e a chave Web pública, sem reescrita.

## 113. `HostingConfig` e `RewriteMap` — `firebase.json` 🟢

| Chave | Valor | Origem |
|---|---|---|
| `hosting.public` | `public` | `firebase.json:3` |
| `hosting.ignore` | `**/.*`, `**/node_modules/**`, `**/*.bak`, `**/*.bak-auth`, `**/*.backup` | `firebase.json:4-10` |
| `database.rules` | `database.rules.json` | `firebase.json:57-59` |
| `storage.rules` | `storage.rules` | `firebase.json:60-62` |
| `functions.source` | `functions` | `firebase.json:63-65` |
| projeto ativo | `controle-obras-c889d` | `.firebaserc:3` |

| Rewrite | Destino | Origem |
|---|---|---|
| `/api/kiwify` | `kiwifyWebhook` | `firebase.json:12-15` |
| `/api/whatsapp` | `whatsappWebhook` | `firebase.json:16-19` |
| `/api/admin/criar-usuario` | `criarUsuarioTenant` | `firebase.json:20-23` |
| `/api/admin/conta` | `adminAccountApi` | `firebase.json:24-27` |
| `/api/admin/cargo` | `gerenciarCargo` | `firebase.json:28-31` |
| `/api/admin/aprovacao` | `decidirAprovacaoApi` | `firebase.json:32-35` |
| `**` | `/index.html` (SPA) | `firebase.json:36-39` |

🟢 O fallback local em `server.js:8-13` espelha o rewrite SPA: `express.static('public')` e `app.get('*') → public/index.html`, com `PORT` default `8080`. 🟢 `apphosting.yaml` declara `cpu:1` e `memoryMiB:512`, mas não participa do pipeline observado. 🟡 Um deploy de Hosting sem functions gera `404` nas rotas `/api/admin/*` (`super-admin.md:205`).

## 114. `WorkerRoutingConfig` — Cloudflare Worker 🟢

| Campo | Valor | Origem |
|---|---|---|
| `name` | `gestaodeobras-worker` | `wrangler.jsonc:2`; `wrangler.toml:1` |
| `main` | `cloudflare-worker/worker.js` (JSONC) / `worker.js` (TOML) | `wrangler.jsonc:3`; `wrangler.toml:2` |
| `compatibility_date` | `2024-01-01` | `wrangler.jsonc:4`; `wrangler.toml:3` |
| rotas | `obrareal.com/*`, `*.obrareal.com/*` (zona `obrareal.com`) | `wrangler.jsonc:5-8`; `wrangler.toml:5-8` |
| `FIREBASE_URL` | `https://controle-obras-c889d.web.app` | `worker.js:13` |
| `ROOT_DOMAIN` | `obrareal.com` | `worker.js:19` |
| `RESERVED_SUBDOMAINS` | `www`, `admin`, `api`, `mail`, `ftp` | `worker.js:16` |
| redirect de reservado | `301 https://obrareal.com<path><search>` | `worker.js:72-74` |

| Request | Resposta | Origem |
|---|---|---|
| `OPTIONS` | `204` + CORS da allowlist, sem proxy | `worker.js:57-61` |
| raiz / `www` | proxy direto para Firebase | `worker.js:66-69` |
| slug de tenant | proxy com `X-Forwarded-Host: <slug>.obrareal.com`, `host` removido | `worker.js:76-78,109-119` |
| assets `js|css|png|jpg|svg|ico|woff?` | `Cache-Control: public, max-age=3600` | `worker.js:132-133` |
| demais paths | `Cache-Control: no-cache, no-store, must-revalidate` | `worker.js:134-136` |

🟢 `extractSlug` remove `.obrareal.com` do hostname e devolve `null` quando não há subdomínio (`worker.js:88-99`). 🟢 A lista reservada do app é maior (`app`, `login`, `master`, `webhook`, `pix`, etc.) e bloqueia a escolha de slug (`slug.js:21-29`). 🟡 Duas configurações do Wrangler duplicam a definição do worker; `FIREBASE_URL` é fixo em código.

## 115. `TenantByHostContext` — detecção de tenant no cliente 🟢

| Campo / regra | Valor | Origem |
|---|---|---|
| `CURRENT_TENANT_ID` | definido pelo hostname ou `?tenant=` | `data_core.js:270-290` |
| produção | `obrareal.com` ou `*.obrareal.com` — hostname é autoridade, `?tenant=` ignorado | `data_core.js:276-277` |
| dev/staging | `?tenant=<slug>` aceito em `localhost`, `web.app`, `firebaseapp.com` | `data_core.js:277-282` |
| `www` | não é slug de cliente | `data_core.js:285-288` |
| `tenants_public/<slug>` | leitura direta por chave; sem `orderByChild` | `tenants-public.md:24-37`; `data_core.js:292` |
| slug normalizado | minúsculas, NFD sem acentos, `a-z0-9`, 3–30 caracteres | `slug.js:31-47` |
| slug reservado | ~35 nomes de infraestrutura/páginas/marca | `slug.js:21-29` |
| `buildTenantUrl` | produção `https://<slug>.obrareal.com/app.html`; dev `?tenant=<slug>` | `slug.js:78-94` |
| `buildWelcomeUrl` | `login.html?bemvindo=1&email=<email>` no subdomínio | `slug.js:96-99` |
| cross-tenant no login | `signOut()` quando `perfil.tenantId !== CURRENT_TENANT_ID` e não é super_admin | `auth_core.js:396-402` |
| claims propagadas | até 6 tentativas de `getIdTokenResult(true)` antes de liberar o app | `auth_core.js:425-439` |

🟢 `buildAccountUpdates` grava em uma única transação multi-path: `tenants/<slug>` (`free_trial`, `trialExpiracao = now + 30 dias`, `origem:'self_signup'`, limites 1/1/9999), `tenants_public/<slug>` (branding) e `users/<email>` (passaporte) (`slug.js:108-140`). 🟢 A migração `scripts/migrar-tenants-public.js` roda após o deploy das rules e antes de divulgar subdomínios (`tenants-public.md:39-58`). 🟡 A sessão do Firebase não atravessa origens, por isso o redirecionamento para o subdomínio acontece no login.

## 116. `CorsPolicy` e `SecurityHeaders` 🟢

| Política | Definição | Origem |
|---|---|---|
| origens permitidas (Storage) | `https://obrareal.com`, `https://www.obrareal.com`, `https://*.obrareal.com`, `https://controle-obras-c889d.web.app`, `https://controle-obras-c889d.firebaseapp.com` | `cors.json:3-9` |
| métodos (Storage) | `GET`, `HEAD`, `POST` | `cors.json:10` |
| headers de resposta (Storage) | `Content-Type`, `x-goog-resumable` | `cors.json:11` |
| `maxAgeSeconds` (Storage) | `3600` | `cors.json:12` |
| comando de aplicação | `gcloud storage buckets update gs://controle-obras-c889d.firebasestorage.app --cors-file=cors.json` | `cors.md:22-30` |
| origens permitidas (Worker) | regex `^https://([a-z0-9-]+\.)?obrareal\.com$`, `web.app`, `firebaseapp.com` | `worker.js:23-31` |
| CORS do Worker | `Allow-Origin` = origem casada, `Allow-Credentials:true`, `Allow-Methods: GET, HEAD, POST, OPTIONS`, `Max-Age:3600`, `Vary: Origin` | `worker.js:38-50` |
| CSP | `default-src 'self'`; `script-src 'self' 'unsafe-inline'` + CDNs; `worker-src 'self' blob:`; `object-src 'none'`; `base-uri 'self'`; `frame-ancestors 'none'` | `firebase.json:46-47` |
| COOP | `same-origin-allow-popups` | `firebase.json:50-51` |
| Functions | `cors:false` em admin APIs, Kiwify e WhatsApp | `cors.md:41-45` |

🟢 Aplicar CORS do bucket é manual — a CLI do Firebase não faz isso (`cors.md:19-21`). 🟢 `Vary: Origin` nunca é duplicado no worker (`worker.js:40-42`). 🟡 `PUT`/`DELETE` foram removidos do CORS; uploads resumáveis grandes exigem readicionar `PUT` (`cors.md:53-55`). 🟡 `cors.json` e `ALLOWED_ORIGINS` precisam ser atualizados juntos (`cors.md:17`).

## 117. `CiPipeline`, `RuntimeConfig` e segredos de deploy 🟢

| Configuração | Valor | Origem |
|---|---|---|
| `test.yml` gatilho | `push` e `pull_request` em `main`, `master` | `test.yml:3-7` |
| `test.yml` runtime | `ubuntu-latest`, `setup-node@v4`, Node 20, `cache: npm` | `test.yml:9-18` |
| `test.yml` comandos | `npm install`, `npm test -- --run` | `test.yml:19-22` |
| `deploy.yml` gatilho | `push` em `main` | `deploy.yml:2-5` |
| `deploy.yml` runtime | `ubuntu-latest`, `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` | `deploy.yml:6-10` |
| `deploy.yml` action | `FirebaseExtended/action-hosting-deploy@v0`, `channelId: live` | `deploy.yml:12-18` |
| segredo do Actions | `FIREBASE_SERVICE_ACCOUNT_CONTROLE_OBRAS_C889D` | `deploy.yml:16` |
| Vitest | `environment:'jsdom'`, `globals:true` | `vitest.config.mjs:3-8` |
| Node raiz | `20` | `package.json:5-7` |
| Node Functions | `24` | `functions/package.json:5-7` |
| scripts raiz | `build` (echo), `start` (node server.js), `test` (vitest) | `package.json:8-12` |
| scripts Functions | `serve`, `shell`, `deploy`, `logs` | `functions/package.json:9-14` |
| segredos Functions | `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_WABA_ID`, `META_PHONE_NUMBER_ID`, `KIWIFY_TOKEN`, `KIWIFY_CLIENT_ID`, `KIWIFY_CLIENT_SECRET`, `KIWIFY_ACCOUNT_ID` | `hardening.md:144-152` |
| bootstrap local | `functions/serviceAccountKey.json` + e-mail `tonycampelo@gmail.com` | `set_super_admin.js:1-27` |
| migração local | `node scripts/migrar-tenants-public.js` | `tenants-public.md:43-54` |
| verificações | `npm test -- --run`, `npm audit --omit=dev`, `npm audit --prefix functions`, `node -e "require('./functions/index.js')"`, `git diff --check` | `hardening.md:166-174` |

🟢 `deploy.yml` usa apenas Hosting; functions/rules/secrets exigem `firebase deploy --only ...` manual (`hardening.md:141-156`). 🟢 A verificação pós-deploy inclui token da Meta no Secret Manager, logs de `retencaoSegurancaJob`/`auditoria_falhou`, CORS do Storage e publicação do worker (`hardening.md:158-164`). 🟡 `.firebaserc` está em `.gitignore:11` embora presente no repositório. 🟡 O emulador de rules falha com `Failed to get details for project: demo-gestaodeobras`; asserções estáticas em `tests/security/rules.test.js` são o substituto (`hardening.md:176-179`).

