# API Admin — Conta (`POST|GET /api/admin/conta`)

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Fontes: `firebase.json:23-26`, `functions/super_admin.js`, `functions/auditoria.js`, `functions/kiwify_api.js`, `_reversa_sdd/flowcharts/admin-e-super-admin.md`, `domain.md` RN-007/RN-010/RN-011.

## Visão Geral

🟢 API do painel Master. `POST` executa ações administrativas (reset/bloqueio/exclusão de usuário, limites, plano, bloqueio de tenant) com reserva idempotente e auditoria fail-closed; `GET` consulta a API pública da Kiwify com credenciais separadas.

## Responsabilidades

- 🟢 Autorizar por `super_admins/<uid>`, e-mail mestre legado ou passaporte `users/<email>/role='super_admin'`.
- 🟢 Aplicar cotas por IP, UID, ação e recurso Kiwify antes de efeitos.
- 🟢 Reservar operações destrutivas em `admin_ops/<requestId>` e registrar `admin_audit`.
- 🟢 Responder `503 auditoria_falhou` quando a auditoria obrigatória falha.
- 🟢 Consultar Kiwify (`products`, `sales`, `account`, `webhooks`) com cache de token e catálogo local.

## Regras de Negócio

- 🟢 RN-007: ordem de confiança do master — allowlist → e-mail mestre → passaporte legado.
- 🟢 RN-011: operação destrutiva exige reserva e auditoria; link de reset nunca entra na auditoria.
- 🟢 RN-010: validação de corpo e cota antes de Auth/RTDB.
- 🟢 RN-017: `status` e `billingState` podem divergir; a API define ambos em `definir_plano`/`bloquear_tenant`.
- 🟡 `EMAIL_MESTRA = tonycampelo@gmail.com` é exceção histórica replicada em rules/Storage.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 Aceitar somente POST/GET | Must | Outro método ⇒ 405 |
| RF-02 | 🟢 Validar corpo e cota `admin:ip` 60/min | Must | Excede ⇒ 413/429 antes do Auth |
| RF-03 | 🟢 `verifyIdToken(token, true)` e uid/e-mail presentes | Must | Falha ⇒ 401 |
| RF-04 | 🟢 Autorizar master pelas 3 fontes | Must | Não autorizado ⇒ 403; conta desativada ⇒ 403 |
| RF-05 | 🟢 Cota `admin:uid` 120/min e `admin:acao` 30/min | Must | Excede ⇒ 429 |
| RF-06 | 🟢 Ação inválida ⇒ 400 | Must | Fora de `ACOES` ⇒ 400 `acao_invalida` |
| RF-07 | 🟢 Reserva idempotente para ações destrutivas | Must | Mesmo `requestId` ⇒ 200 `idempotente=true`, sem reaplicar |
| RF-08 | 🟢 Auditoria obrigatória fail-closed | Must | Falha ao auditar ⇒ 503 `auditoria_falhou`, reserva mantida |
| RF-09 | 🟢 `reset_password` sem auto-reset e link só na resposta | Must | Link nunca em `admin_audit` |
| RF-10 | 🟢 `definir_plano` grava plano, vencimento, limites e limpa carência/bloqueio | Must | `free_trial` recebe `trialExpiracao = vencimento` |
| RF-11 | 🟢 `bloquear_tenant` alterna `status`/`billingState` e motivo | Must | Bloqueio ⇒ `bloqueado_pagamento`/`bloqueado`; liberação ⇒ `ativo`/`ativo` |
| RF-12 | 🟢 GET Kiwify valida `tipo` e parâmetros | Must | Fora de `products|sales|account|webhooks` ⇒ 400; `page_size≤100`, `page_number≤1000` |
| RF-13 | 🟢 Resposta `configurado=false` quando credenciais ausentes | Should | Sem segredos, painel não quebra |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | `checkRevoked=true`, reconfirmação no RTDB | `super_admin.js:46-91` | 🟢 |
| Segurança | Hash de IP com salt (`abuso.js`) | `domain.md` RN-012 | 🟢 |
| Disponibilidade | Fail-closed na auditoria | `auditoria.js`; `ADR-004` | 🟢 |
| Performance | Cache de token da API Kiwify | `functions/kiwify_api.js` | 🟢 |

## Critérios de Aceitação

```gherkin
Dado um master autenticado com requestId já usado em exclusão de usuário
Quando a mesma ação é reenviada
Então a resposta é 200 com idempotente=true e nenhum efeito é aplicado novamente

Dado uma ação destrutiva cuja auditoria falha
Quando a API tenta registrar o evento
Então a resposta é 503 auditoria_falhou e a reserva permanece para diagnóstico

Dado um GET com tipo=sales e parâmetros válidos
Quando as credenciais da API Kiwify estão configuradas
Então a resposta é 200 com resultado e catálogoLocal de PLANOS
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-11 | Must | Caminho crítico do painel Master |
| RF-12, RF-13 | Should | Integração externa com fallback |
| Ações comentadas/deprecadas | Won't | 🟡 se houver flags desativadas no código |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `functions/super_admin.js` | `handleAdminRequest`, `verificarSuperAdmin`, `ACOES` | 🟢 |
| `functions/auditoria.js` | `registrar`, `reservarOperacao` | 🟢 |
| `functions/kiwify_api.js` | `credenciaisKiwify`, `consultarKiwify` | 🟢 |
| `functions/claims.js` | `avaliarSuperAdmin` | 🟢 |
| `functions/index.js:840` | `exports.adminAccountApi` | 🟢 |
