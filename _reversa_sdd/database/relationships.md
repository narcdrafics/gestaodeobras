# Relacionamentos e integridade referencial — RTDB (obra-real)

> 🟡 **INFERIDO** de `database.rules.json`, `functions/` e validações no cliente. 🔴 RTDB não tem FK declarada: toda integridade é lógica.
> Fonte canônica: [`../erd-complete.md`](../erd-complete.md) §3.

## Relacionamentos 🟡

| Pai → Filho | Cardinalidade | Chave no filho | Quem garante | Confiança |
|---|---|---|---|---|
| `AuthUser` → `Profile` | 1:1 | `uid` | trigger `syncCustomClaims` + rules | 🟢 |
| `AuthUser` → `CustomClaims` | 1:1 | `uid` | `setCustomUserClaims` substitui o objeto inteiro | 🟢 |
| `AuthUser` → `SuperAdminAllowlist` | 0..1:1 | `uid` | allowlist + e-mail mestre + migração | 🟢 |
| `Tenant` → `Profile` | 1:N | `profiles[].tenantId` | rules comparam com `auth.token.tenantId` | 🟢 |
| `Tenant` → `TenantPublic` | 1:1 | `slug` | `.validate slug === $slug` + criação atômica | 🟢 |
| `Tenant` → `Invite` | 1:N | `invites[].tenantId` | `criarUsuarioTenant` consome `usos` por transação | 🟢 |
| `Tenant` → `Obra` | 1:N | `tenantId` implícito no caminho | rules por nó + `enforceObrasLimit` | 🟢 |
| `Obra` → `Tarefa`, `Presenca`, `Almoco`, `Compra`, `MovEstoque`, `Lancamento`, `OrcamentoServico`, `Medicao` | 1:N | `<entidade>[].obra = cod` | validação no save + `filterDbByObras` no cliente | 🟢 |
| `Obra` ↔ `Trabalhador` | N:M | `trabalhadores[].obras` (CSV/array) | `trabNaObra` no cliente; 🟡 rules não filtram por obra | 🟢/🟡 |
| `Trabalhador` → `Presenca` | 1:N | `presenca[].trab` ou `nome` | dedupe por data; recálculo retroativo após mudança de diária | 🟢 |
| `Compra` → `CompraPrivada` | 1:1 | `compraId` | redaction no cliente + trigger de aprovação | 🟢 |
| `EstoqueItem` → `MovEstoque` | 1:N | `movEstoque[].codMat` | `efeitosMovimentacao` valida saldo e grava `antes/depois` | 🟢 |
| `OrcamentoServico` → `Medicao` | 1:N (ou 0) | `serviceId` ou `orcKey` | `migrateServiceIds`, `confirmMedicaoVinculo`, `serviceIdReview` | 🟢 |
| `OrcamentoServico` → `LancamentoFinanceiro` | 1:N (ou 0) | `financeiro[].serviceId` | `buildFinanceEntries` agrupa em `pago`/`aPagar` | 🟢 |
| `Profile` → `Aprovacao` | N:M | `solicitadoPor`, `decididoPor` | `verificarChamador` + transação de decisão | 🟢 |
| `Aprovacao` → `Auditoria` | 1:0..1 | `aprovacaoId` | `update()` multi-path no trigger | 🟢 |
| `Aprovacao` → `Notificacao` | 1:N | `aprovacaoId` + `uid` no caminho | uma cópia por destinatário para as rules autorizarem | 🟢 |
| `AdminOps` → `AdminAudit` | 1:0..1 | `requestId` | auditoria obrigatória fail-closed (`503`) | 🟢 |
| `Tenant` → `BillingEvent` | 1:N (pode não haver tenant) | `billing_events[].tenantId` | `identifyTenant` + `payloadHash` sem `status` | 🟢 |
| `WhatsappMessage` → `Tarefa`/`Presenca` | 1:0..N | `tenantId` resolvido no processamento | dedup transacional; ACK após efeito | 🟢 |
| `TarefaPendente` → `Tarefa` | 0..1:N | `tarefas_pendentes/<from>` | 🔴 parser desconectado do fluxo ativo | 🔴 |
| `Tarefa`/`Medicao` → `Foto` (Storage) | 1:N (até 6) | `photos[]` (URLs) | `uploadEvidenceFile` + sanitização de URL | 🟢 |

## Integridade além do ERD 🟢

1. 🟢 `role` e `tenantId` de `Profile` são imutáveis para o cliente; promoção só via Admin SDK.
2. 🟢 `users/<email>` não promove ninguém — só preserva `super_admin` já existente nas claims.
3. 🟢 `emailAdmin` do tenant equivale a admin nas rules e na API de aprovação, mas não cria `ehAdmin` no cliente.
4. 🟢 `comprasPrivadas` fica fora de `tenants/<tid>` porque uma rule de pai não pode revogar `.read` de filho.
5. 🟢 Nós de sistema (`admin_audit`, `admin_ops`, `rate_limits`, `billing_events`, `webhook_debug`, `whatsapp_messages`, `super_admins`) têm `.write:false`.
6. 🟢 `estoque._saldo`/`_status`, `tarefa.Atrasada`, `finDerivedStatus` são derivados em leitura — não gravar (ADR-008).
7. 🟡 `obrasPermitidas` é recortado a 50 no cliente/RH; não há validação equivalente nas rules de todas as entidades.
8. 🔴 `tarefas_pendentes` tem contrato na raiz e gravação sob `tenants/<tid>/` — relação não validada pelas rules testadas (GAP-04).

## Lacunas 🔴

- 🔴 Nenhuma medição de órfãos referenciais em produção (ex.: `tarefas[].obra` sem obra correspondente).
- 🔴 GAP-04: caminho divergente de `tarefas_pendentes`.
- 🟡 L-11: transferência de estoque não credita destino — integridade de saldo violada pelo próprio código (não pela rule).
