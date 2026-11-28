# API Admin — Decisão de aprovação (`POST /api/admin/aprovacao`)

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `firebase.json:31-34`, `functions/aprovacoes-api.js`, `functions/aprovacoes.js`, `_reversa_sdd/flowcharts/aprovacoes.md`, `domain.md` RN-026–RN-034, `ADR-005`.

## Visão Geral

🟢 Decide solicitações de aprovação pendentes com hierarquia efetiva recalculada no servidor. A decisão é gravada por transação (concorrência ⇒ 409) e os efeitos são aplicados por trigger separado, com reserva própria e revalidação de autoridade.

## Responsabilidades

- 🟢 Verificar token, conta ativa, papel efetivo (maior entre claim e perfil), quotas e tenant.
- 🟢 Validar decisão (`aprovado`/`rejeitado`), motivo obrigatório na rejeição e estado da aprovação.
- 🟢 Aplicar regras por tipo: admin/master, RH com módulos, engenheiro em `movimentacao_estoque` com `notificarAdmin`.
- 🟢 Gravar decisão por transação e registrar auditoria.
- 🟢 Expor payload sem campos sensíveis para papéis restritos (redaction no cliente).

## Regras de Negócio

- 🟢 RN-026: apenas `encarregado`, `engenheiro` e `rh` têm escrita desviada para aprovação.
- 🟢 RN-029: decisão concorrente ⇒ `409 ja_decidida`; aplicação tem reserva e retomada após 10 min.
- 🟢 RN-030: `podeAplicar` revalida decisor e autoridade **no momento da aplicação**.
- 🟢 RN-032: RH exige `modulosPermitidos.aprovacoes` **e** módulo do tipo; engenheiro só estoque e avisa admin.
- 🟢 RN-034: auditoria serializa `antes`/`depois` com limite de 4000 caracteres; notificações replicadas por destinatário.
- 🟢 GAP-04 resolvido (P4): `tarefas_pendentes` removido — gravação direta em `tarefas`; nenhum efeito de aprovação para esse nó.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Somente POST com Bearer válido (`checkRevoked`) | Must | Falha ⇒ 401/405 |
| RF-02 | 🟢 Conta ativa no Auth e no perfil | Must | Inativa ⇒ 403 `conta_bloqueada` |
| RF-03 | 🟢 Papel efetivo = maior entre claim e perfil | Must | Claim desatualizada não rebaixa o decisor |
| RF-04 | 🟢 Cotas IP/UID 60/min | Must | Excede ⇒ 429 |
| RF-05 | 🟢 Corpo válido: `id`, `decisao`, `motivo` se rejeitado | Must | Inválido ⇒ 400 |
| RF-06 | 🟢 Aprovação pendente, não expirada/não aplicada | Must | Caso contrário ⇒ 404/409/400 |
| RF-07 | 🟢 `billingState='ativo'` | Must | Bloqueado/somente_leitura ⇒ 403 `plano_bloqueado` |
| RF-08 | 🟢 Tenant do perfil compatível (master pode operar outro tenant) | Must | Divergente ⇒ 403 `tenant_invalido` |
| RF-09 | 🟢 `papelPodeDecidir` por papel/módulo/tipo | Must | Negado ⇒ 403 `sem_permissao` com diagnóstico |
| RF-10 | 🟢 Transação: só o primeiro decide `pendente` | Must | Concorrência ⇒ `409 ja_decidida` |
| RF-11 | 🟢 Auditoria `decidir_aprovacao` e 200 | Must | `admin_audit` contém ator, decisão, papel e módulos |
| RF-12 | 🟡 Redaction de campos sensíveis para papéis restritos | Should | `forn`, `pixkey`, `vunit`, `vtotal`, `vorc`, `prazo`, `compraPrivada` não exibidos |
| RF-13 | 🟢 Não gerar comportamento para `tarefas_pendentes` | Must | Decisão P4: nó removido em favor da gravação direta em `tarefas` |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | Token com `checkRevoked` e reconfirmação no RTDB | `aprovacoes-api.js` | 🟢 |
| Segurança | Redaction no cliente para papéis restritos | `flowcharts/aprovacoes.md` §6 | 🟡 |
| Disponibilidade | Transação otimista para decisão única | `ADR-005` | 🟢 |
| Integridade | Auditoria com limite de 4000 caracteres | `RN-034` | 🟢 |

## Critérios de Aceitação

```gherkin
Dado um RH com modulosPermitidos.aprovacoes=true e uma aprovação do tipo movimentacao_estoque sem módulo habilitado
Quando a decisão é enviada
Então a resposta é 403 sem_permissao com diagnóstico de papel/módulo

Dado duas decisões concorrentes para a mesma aprovação pendente
Quando ambas chegam ao servidor
Então apenas uma é gravada e a outra recebe 409 ja_decidida

Dado uma rejeição sem motivo
Quando a API valida o corpo
Então a resposta é 400 e nenhuma decisão é gravada
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-11, RF-13 | Must | Porta única de efeitos sensíveis |
| RF-12 | Should | Privacidade de dados comerciais |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `functions/aprovacoes-api.js` | `handleAprovacaoRequest`, `papelPodeDecidir`, `verificarChamador` | 🟢 |
| `functions/aprovacoes.js` | `aplicarAprovacaoPorId`, `construirEfeitos`, `podeAplicar` | 🟢 |
| `functions/claims.js` | hierarquia efetiva | 🟢 |
| `public/js/aprovacoes_ui.js` | `payloadParaExibicao` | 🟡 |
| `functions/index.js:879,892` | export da API e do trigger | 🟢 |
