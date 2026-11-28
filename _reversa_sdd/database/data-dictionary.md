# Dicionário de dados — Firebase Realtime Database (obra-real)

> 🟡 **INFERIDO** de `database.rules.json` (16 nós raiz, 35 `.validate`, 35 `.write`, 24 `.read`, 9 `.indexOn`) e do código cliente/functions. 🔴 Sem DDL, migrations ou leitura direta do banco.
> Fonte canônica completa: [`../data-dictionary.md`](../data-dictionary.md) — 117 seções. Este arquivo é o índice de banco do Data Master.

## 1. Nós raiz declarados nas rules 🟡

| Nó | Propósito | Índices declarados | Acesso |
|---|---|---|---|
| `profiles/<uid>` | Perfil e papel do usuário | `email`, `tenantId` | leitura restrita a super_admin; escrita própria limitada a campos imutáveis |
| `tenants/<slug>` | Config, plano, billing e arrays de operação | — (aprovacoes: `status`, `solicitadoPor`, `tipo`, `expiraEm`) | leitura do admin do tenant; `billingState !== bloqueado` |
| `tenants_public/<slug>` | Branding pré-login | — | pública |
| `comprasPrivadas/<tid>/<id>` | Dados sensíveis de compras (fornecedor/PIX) | `criadoEm` | fora de `tenants/` porque rule de pai não revoga `.read` de filho |
| `auditoria/<tid>/<pushId>` | Auditoria de aprovações | `criadoEm`, `ator` | leitura por tenant |
| `notificacoes/<tid>/<uid>/<pushId>` | Notificações por destinatário | `criadoEm`, `lido` | leitura/escrita do destinatário |
| `admin_audit/<pushId>` | Auditoria de operações admin | `timestamp`, `atorEmail` | `.write:false` (Admin SDK) |
| `admin_ops/<requestId>` | Reserva de operação admin | `reservadoEm` | `.write:false`; lease 24 h |
| `webhook_debug` | Telemetria de webhooks | — | `.write:false` |
| `rate_limits/<chave>/<bucket>` | Contadores por janela | — | `.write:false`; retenção 2 h |
| `whatsapp_messages/<chaveDedup>` | Dedup transacional de mensagens | — | `.write:false`; retenção 24 h |
| `billing_events/<orderId>/<eventType>` | Eventos Kiwify com `payloadHash` | — | `.write:false` |
| `super_admins/<uid>` | Allowlist canônica de master | `email` | `.write:false` |
| `users/<email,>` | Legado de mapeamento e-mail→tenant | `telefone` | não promove papéis |
| `invites/<email,>` | Convites com `tenantId` e `usos` | — | consumidos por transação |
| `tarefas_pendentes` | 🔴 contrato na raiz, gravação sob `tenants/<tid>/` (GAP-04) | — | divergente |

## 2. Entidades lógicas sob `tenants/<tid>` 🟡

| Entidade | Caminho | Chave | Campos-chave | Seção canônica |
|---|---|---|---|---|
| `Obra` | `obras[]` | `cod` | `status`, `orc`, datas | §27-30 |
| `Tarefa` | `tarefas[]` | `cod` | `obra`, `status`, `prazo`, `photos` | §31-36 |
| `Trabalhador` | `trabalhadores[]` | `cod` | `diaria`, `vinculo`, `obras` | §37-41 |
| `Presenca` | `presenca[]` | `data + trab/nome + obra` | `presenca`, `hnorm`, `hextra`, `total`, `pgtoStatus`, `valpago` | §42-47 |
| `Almoco` | `almocos[]` | `data + empreiteiro + obra` | `qtd`, `vtotal`, `pgtoStatus` | §48-51 |
| `Compra` | `compras[]` | `id` | `mat`, `qtd`, `status` | §52, §55 |
| `EstoqueItem` | `estoque[]` | `cod` | `mat`, `entrada`, `saida`, `min`, `_saldo` (derivado) | §56 |
| `MovEstoque` | `movEstoque[]` | `pushId` | `codMat`, `tipo`, `qtd`, `obraDestino` | §57-59 |
| `LancamentoFinanceiro` | `financeiro[]` | `pushId` | `prev`, `real`, `status`, `source` | §60-64 |
| `OrcamentoServico` | `orcamento[]` | `id` | `etapa`, `qtd`, `vunit`, `vtotal` | §65-69 |
| `Medicao` | `medicao[]` | `pushId` | `serviceId`, `qreal`, `vtotal`, `photos` | §70-74 |
| `Aprovacao` | `aprovacoes/<id>` | `id` | `tipo`, `status`, `payload`, `expiraEm` | §21-22 |
| `TarefaPendente` | `tarefas_pendentes/<from>` | `from` | `transcricao`, `tarefas[]` | §32, §104 (🔴) |
| `Foto` | `evidencias/<arquivo>` (Storage) | `path` | URL, `contentType`, alvo | §33, §80-85 |

## 3. Tipos e restrições confirmadas nas rules 🟢

| Campo | Tipo/regra | Origem |
|---|---|---|
| `profiles/<uid>/role` | string imutável; enum `admin`, `rh`, `engenheiro`, `encarregado`, `comprador`, `pendente`, `desativado`; promoção só Admin SDK | `database.rules.json:20` |
| `profiles/<uid>/uid` | string == `auth.uid` na criação, imutável depois | `:14` |
| `profiles/<uid>/email` | string == `auth.token.email` na criação, imutável depois | `:17` |
| `profiles/<uid>/tenantId` | string não vazio; deve casar com `users/` ou `invites/` ou super_admin; imutável | `:23` |
| `profiles/<uid>/status` | `ativo` na criação; imutável para o cliente | `:26` |
| `tenants/<slug>/plano` | `free_trial` na criação; imutável para o cliente | `:39` |
| `tenants/<slug>/billingState` | `ativo` na criação; `somente_leitura`/`bloqueado` bloqueiam escrita | `:50-53` |
| `tenants/<slug>/config/limiteObras` | number == `1` na criação | `:63` |
| `tenants/<slug>/config/limiteUsuarios` | number == `1` na criação | `:65` |
| `tenants/<slug>/config/limiteTrabalhadores` | number == `9999` na criação | `:69` |
| `tenants/<slug>/trialExpiracao` | number ≤ `now + 2764800000` (32 dias) | `:45` |
| `tenants/<slug>/subdominioSlug` | null, igual ao slug, ou plano habilitado | `:58` |

> 🟡 A tipagem dos arrays de operação (`obras[]`, `tarefas[]`, …) vem do código cliente; as rules não declaram `.validate` campo a campo para esses arrays.

## 4. Valores derivados — não persistir 🟢

`estoque._saldo`, `estoque._status`, `tarefa.Atrasada`, `finDerivedStatus`, `StatusEfetivo`, `DashboardResumo`, `FinanceEntry`, `GaleriaFotos` — ver `../erd-complete.md` §2 e ADR-008.

## 5. Lacunas 🔴

- 🔴 Nenhuma contagem de registros nem detecção de órfãos em produção.
- 🔴 `tarefas_pendentes` fora do contrato de rules testado (GAP-04).
- 🟡 `renderCompras` não filtra por obra (L-16); normalização dupla de estoque (L-17).
