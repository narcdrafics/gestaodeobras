# Endurecimento de segurança — Fase 2

Este documento registra as defensas adicionadas depois do isolamento multi-tenant
e da contenção de escalação de privilégios (ver `tenant-isolation.md` e
`super-admin.md`). Ele é o guia de implementação, deploy e verificação.

## 1. WhatsApp — autorização e deduplicação

Implementação: `functions/whatsapp_auth.js` + `exports.whatsappWebhook` em
`functions/index.js`.

- **Verify token** vem do Secret Manager (`META_VERIFY_TOKEN`), nunca de código.
  O valor antigo `obrareal_whatsapp_2026` existe apenas em documentação legada
  e não deve ser reutilizado.
- **Assinatura**: `X-Hub-Signature-256` validada com `META_APP_SECRET` sobre o
  corpo bruto antes de qualquer processamento.
- **Origem**: `META_WABA_ID` e `META_PHONE_NUMBER_ID` precisam casar com o
  payload; mensagens de outro número/WABA são descartadas.
- **Remetente**: telefone normalizado e comparado de forma exata com
  `tenants/<tenantId>/config/telefonesPermitidos`. Correspondências ambíguas
  entre tenants são rejeitadas (fail-closed).
- **Dedup**: `whatsapp_messages/<msg.id>` reservado por transação antes de
  processar; reentrega da Meta não duplica tarefa nem resposta.
- **ACK**: o 200 de confirmação é enviado **depois** do processamento, para que
  uma falha não seja reconhecida como sucesso.
- Não existe mais o ramo `page` não autorizado. Áudios só são baixados de hosts
  permitidos da Meta (allowlist), com arquivo temporário gerado por
  `crypto.randomUUID()`.
- `telefone`, `whatsappId` e `telefonesPermitidos` são campos protegidos nas
  rules e no cliente (`public/js/data_core.js`).

## 2. Kiwify — idempotência sem dependência de status

Implementação: `functions/kiwify.js`.

- Chave canônica: `orderId + eventType`, **sem** `orderStatus` no caminho.
- `payloadHash` ignora `order_status`/`status`, evitando que a mesma ordem com
  status diferente gere dois efeitos.
- Reserva atômica em `processing` com lease de 2 minutos; evento travado é
  reprocessável após expiração.
- Efeitos (plano/limites/billing) e marca final são gravados na **mesma** escrita
  multi-path. Se a escrita final falha, a reserva é liberada.
- Conflito só é ignorado com segurança contra um evento `success` já aplicado:
  resposta `409 conflict_ignored`. Conflitos com eventos em processamento ou
  falhos não são silenciados.
- `tenant_not_found` não é mais terminal: vira `pending_tenant`, resposta `202`,
  reprocessável quando o tenant aparecer.
- Logs de requisições rejeitadas não incluem payload nem assinatura.

## 3. APIs administrativas

Implementação: `functions/super_admin.js`, `functions/cargos.js`,
`functions/usuarios.js`.

- Método, tamanho do corpo e cota são validados **antes** de tocar no Auth/RTDB.
- `verifyIdToken(token, true)` (checa revogação), perfil no banco, allowlist
  `super_admins/<uid>` e bloqueio de usuários `disabled`.
- Allowlist de ações e recursos com `hasOwnProperty` (não herança de `Object`).
- Auto-redefinição de senha bloqueada; convite consumido atomicamente e tenant
  obrigatório ao criar credenciais.
- Troca de senha chama `revokeRefreshTokens`; `role`/`tenantId` nunca vêm do
  cliente.
- Parâmetros da API Kiwify são explícitos e limitados (`page_size` ≤ 100,
  `page_number` ≤ 1000); `req.query` nunca é repassado ao upstream.
- `cors: false` e `maxInstances: 3` nas APIs administrativas e no webhook
  Kiwify; webhook WhatsApp com `maxInstances: 5`.

## 4. Abuso e limites

Implementação: `functions/abuso.js`.

- Payload máximo de 16 KB rejeitado por `content-length` ou por tamanho do corpo
  serializado.
- IP do cliente é **hashado** (`hashIp`) antes de virar chave de cota; nenhum IP
  em claro é gravado.
- Cotas em `rate_limits/...` via transação RTDB, com `expiraEm` e janelas por
  IP/UID/ação.
- Sem novas dependências de runtime para esse controle.

## 5. Auditoria, idempotência de escrita e retenção

Implementação: `functions/auditoria.js`, `functions/retencao.js`.

- Toda entrada em `admin_audit` contém `requestId`, `roteiro`, `ipHash`,
  `userAgent`, `duracaoMs`, ator, ação, alvo e sucesso.
- Ações destrutivas (`excluir_usuario`, `bloquear_tenant`, `bloquear_usuario`,
  `remover_usuario`, `definir_plano`, `definir_cargo`) usam
  `reservarOperacao()` por `requestId`: reentrega não reaplica o efeito.
- **Fail-closed**: se a auditoria obrigatória falhar, a operação responde `503
  auditoria_falhou`. A reserva só é liberada quando o efeito **não** foi
  aplicado; se a escrita aconteceu e a auditoria falhou, a reentrega com o mesmo
  `requestId` recebe `200 { idempotente: true }`.
- Respostas de erro devolvem o `requestId` para permitir repetição segura.
- `admin_ops`, `admin_audit`, `rate_limits` e `whatsapp_messages` são
  somente-leitura/somente-admin nas rules.
- Job `retencaoSegurancaJob` (diário, 03:30 America/Sao_Paulo) remove dados
  expirados: 90 dias de auditoria, 24h de dedup/reservas, 2h de janelas de cota.

## 6. CSP, COOP e CORS

`firebase.json` e `cloudflare-worker/worker.js`:

- CSP sem `'unsafe-eval'`; `img-src` substituído por domínios explícitos;
  `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`.
- `'unsafe-inline'` permanece temporariamente por handlers inline existentes no
  frontend; removê-lo exige refatorar esses handlers.
- `Cross-Origin-Opener-Policy: same-origin-allow-popups` é necessário para o
  popup do Firebase Auth (`public/js/auth_core.js`). Não usar `same-origin`.
- CORS continua com allowlist em `cors.json` e `ALLOWED_ORIGINS` do worker, com
  `Vary: Origin`. Webhooks e APIs administrativas não dependem de CORS do
  navegador (`cors: false`).

## 7. Dependências

- Raiz e `functions/`: `npm audit` com **0 vulnerabilidades**.
- `functions/package.json`: `firebase-admin@^14.5.1` e
  `firebase-functions@^7.4.0` (peer compatível com Admin 14).
- Admin SDK v14 remove APIs de topo: código migrado para os módulos
  `firebase-admin/app`, `/auth` e `/database` (`initializeApp`, `getAuth`,
  `getDatabase`, `ServerValue`).
- O upgrade foi manual e controlado, não um `npm audit fix --force` cego.

## 8. Histórico Git e segredos

- `functions/node_modules/` estava rastreado (~7 mil arquivos) apesar do
  `.gitignore`: foi removido do índice (`git rm -r --cached`) e continua
  ignorado. Os arquivos locais permanecem para desenvolvimento/teste.
- `.gitignore` passou a cobrir `.env*` (com exceção de `!.env.example`),
  `serviceAccountKey.json` e exports locais.
- Varredura dos 423 commits (exceto `node_modules`) não encontrou chave
  privada, `private_key`, `.env` ou `serviceAccountKey.json` versionados.
- A chave Web `AIza...` em `public/js/data_core.js` é um identificador público
  do Firebase, protegido por regras/domínios autorizados/App Check. Ela foi
  removida do script local `functions/test_tenants_public.js`, que agora exige
  `FIREBASE_WEB_API_KEY`.
- O histórico antigo **ainda contém** `node_modules` e a chave Web pública.
  Reescrever 423 commits é uma operação destrutiva e não foi feita nesta fase;
  se o repositório for público ou for espelhado, avalie `git filter-repo` com
  coordenação e rotação de credenciais.

## 9. Deploy

```bash
# Segredos (Secret Manager)
firebase functions:secrets:set META_VERIFY_TOKEN        # valor aleatório, não o da doc antiga
firebase functions:secrets:set META_APP_SECRET
firebase functions:secrets:set META_WABA_ID
firebase functions:secrets:set META_PHONE_NUMBER_ID
firebase functions:secrets:set KIWIFY_TOKEN
firebase functions:secrets:set KIWIFY_CLIENT_ID
firebase functions:secrets:set KIWIFY_CLIENT_SECRET
firebase functions:secrets:set KIWIFY_ACCOUNT_ID

# Publicar
firebase deploy --only functions:whatsappWebhook,functions:kiwifyWebhook,functions:adminAccountApi,functions:gerenciarCargo,functions:criarUsuarioTenant,functions:retencaoSegurancaJob,database:rules,hosting
```

Depois do deploy:

1. Confirmar no painel da Meta que o verify token configurado é o mesmo do
   Secret Manager e que a URL de webhook aponta para `/api/whatsapp`.
2. Conferir em `firebase functions:log` que `retencaoSegurancaJob` rodou e que
   não há `auditoria_falhou` sem justificativa.
3. Aplicar CORS do Storage conforme `cors.md` e publicar o worker Cloudflare.

## 10. Verificação local

```bash
npm test -- --run
npm audit --omit=dev
npm audit --prefix functions
node -e "require('./functions/index.js')"   # requer FIREBASE_CONFIG/GCLOUD_PROJECT
git diff --check
```

A validação das rules com o emulador depende de Java/projeto configurado e já
falhava antes desta fase com `Failed to get details for project:
demo-gestaodeobras`; use as asserções estáticas em `tests/security/rules.test.js`
como substituto temporário.
