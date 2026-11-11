---
title: EXECUTAR.md
description: Plano de implementação detalhado para WhatsApp Bot com detecção de etapas de obra usando IA
url: local-file
collected: 2026-05-07
published: Unknown
---

# EXECUTAR.md
## Plano de Implementação — WhatsApp Bot + IA de Tarefas
### Repositório: narcdrafics/gestaodeobras

> Execute este arquivo sequencialmente. Cada fase tem um critério de validação antes de avançares.
> Tempo estimado total: 3 semanas (implementando ~2h/dia)

---

## PRÉ-REQUISITOS — Antes de começar qualquer código

### Contas e acessos necessários

- [ ] **Conta Meta for Developers** — `developers.facebook.com`
  - Criar App do tipo **Business**
  - Adicionar produto **WhatsApp**
  - Obter número comercial verificado (pode usar número de teste grátis para dev)
  - Anotar: `Access Token`, `Phone Number ID`, `App Secret`, `WABA ID`

- [ ] **Conta OpenAI** — `platform.openai.com`
  - Necessário para transcrição de áudio (Whisper)
  - Criar API Key
  - Estimar custo: ~$0.006 por minuto de áudio (muito barato)

- [ ] **Firebase CLI instalado e logado**
  ```bash
  npm install -g firebase-tools
  firebase login
  firebase use --project SEU-PROJETO-ID
  ```

- [ ] **Node.js >= 18** instalado (exigido pelas Functions v2)
  ```bash
  node --version  # deve retornar v18 ou superior
  ```

---

## FASE 1 — Estrutura de arquivos (Dia 1)
**Objetivo:** Criar os arquivos novos sem quebrar nada existente

### 1.1 — Criar pasta e arquivos do WhatsApp

No terminal, na raiz do repositório:

```bash
mkdir -p functions/whatsapp
mkdir -p functions/scheduled
touch functions/whatsapp/webhook.js
touch functions/whatsapp/sender.js
touch functions/whatsapp/parser.js
touch functions/whatsapp/obra-etapas.js
touch functions/whatsapp/parser-tarefas.js
touch functions/scheduled/daily-report.js
touch test_webhook_meta.js
```

### 1.2 — Copiar os arquivos gerados

Copiar o conteúdo de cada arquivo gerado para os respectivos destinos:

| Arquivo gerado | Destino no repositório |
|---|---|
| `obra-etapas.js` | `functions/whatsapp/obra-etapas.js` |
| `parser-tarefas.js` | `functions/whatsapp/parser-tarefas.js` |
| `WEBHOOK-SETUP.md` (seções webhook.js, sender.js, parser.js) | `functions/whatsapp/webhook.js`, `sender.js`, `parser.js` |
| `WEBHOOK-SETUP.md` (seção daily-report.js) | `functions/scheduled/daily-report.js` |
| `WEBHOOK-SETUP.md` (seção test_webhook_meta.js) | `test_webhook_meta.js` |

### 1.3 — Instalar dependências nas Functions

```bash
cd functions
npm install node-fetch@3
cd ..
```

> ⚠️ `node-fetch` versão 3 é ESM. Se o `functions/package.json` não tiver `"type": "module"`, usar versão 2:
> ```bash
> npm install node-fetch@2
> ```

### ✅ Validação Fase 1
```bash
ls functions/whatsapp/
# deve listar: webhook.js sender.js parser.js obra-etapas.js parser-tarefas.js

ls functions/scheduled/
# deve listar: daily-report.js
```

---

## FASE 2 — Atualizar firebase.json (Dia 1)
**Objetivo:** Adicionar rota do webhook sem quebrar o SPA existente

### 2.1 — Editar `firebase.json`

Localizar a seção `rewrites` e adicionar a rota do WhatsApp **antes** do catch-all `**`:

```json
"rewrites": [
  {
    "source": "/api/export-pdf",
    "function": "generatePDFReport"
  },
  {
    "source": "/api/whatsapp",
    "function": "whatsappWebhook"
  },
  {
    "source": "**",
    "destination": "/index.html"
  }
]
```

### 2.2 — Atualizar CSP no `firebase.json`

Localizar o header `Content-Security-Policy` e adicionar ao `connect-src`:

```
https://graph.facebook.com https://api.openai.com
```

O `connect-src` final deve ficar:
```
connect-src 'self' https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.googleapis.com https://www.google-analytics.com https://graph.facebook.com https://api.openai.com;
```

### ✅ Validação Fase 2
```bash
# Verificar JSON válido
node -e "require('./firebase.json'); console.log('✅ firebase.json válido')"
```

---

## FASE 3 — Atualizar `functions/index.js` (Dia 1)
**Objetivo:** Exportar a nova função sem afetar as existentes

### 3.1 — Adicionar imports e exports

Abrir `functions/index.js` e adicionar ao final do arquivo:

```javascript
// ─── WhatsApp Bot ───────────────────────────────────────────
const whatsappWebhook = require('./whatsapp/webhook');
const { dailyReport }  = require('./scheduled/daily-report');

exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method === 'GET')  return whatsappWebhook.verify(req, res);
  if (req.method === 'POST') return whatsappWebhook.receive(req, res);
  res.sendStatus(405);
});

exports.dailyReport = dailyReport;
// ────────────────────────────────────────────────────────────
```

> ⚠️ NÃO remover nem modificar as exports existentes (`generatePDFReport`, webhook Kiwify, etc.)

### ✅ Validação Fase 3
```bash
cd functions
node -e "require('./index.js'); console.log('✅ index.js carrega sem erros')"
cd ..
```

---

## FASE 4 — Configurar Secrets (Dia 1)
**Objetivo:** Salvar credenciais no Firebase sem expor no código

### 4.1 — Configurar variáveis Meta e OpenAI

```bash
firebase functions:config:set \
  meta.token="EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  meta.phone_id="10646XXXXXXXXX" \
  meta.verify_token="obrareal_whatsapp_2026" \
  meta.app_secret="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  meta.waba_id="XXXXXXXXXXXXXXX" \
  openai.key="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### 4.2 — Verificar se salvou

```bash
firebase functions:config:get
# deve exibir as chaves meta.* e openai.* (valores mascarados)
```

### 4.3 — Para desenvolvimento local, criar `.runtimeconfig.json`

```bash
firebase functions:config:get > functions/.runtimeconfig.json
```

> ⚠️ Confirmar que `.runtimeconfig.json` está no `.gitignore` (já deve estar, mas verificar)
> ```bash
> grep ".runtimeconfig" .gitignore
> ```

### ✅ Validação Fase 4
```bash
firebase functions:config:get | grep meta
# deve mostrar meta.token, meta.phone_id, etc.
```

---

## FASE 5 — Atualizar Database Rules (Dia 2)
**Objetivo:** Permitir que as Functions escrevam nos nós de tarefas e ponto

### 5.1 — Editar `database.rules.json`

Adicionar regras para os novos nós `tarefas_pendentes`:

```json
"tarefas_pendentes": {
  "$tenantId": {
    ".read": "auth != null && root.child('profiles').child(auth.uid).child('tenantId').val() === $tenantId",
    ".write": "auth != null && root.child('profiles').child(auth.uid).child('tenantId').val() === $tenantId"
  }
}
```

> ℹ️ As Cloud Functions usam `admin SDK` e ignoram as rules — mas adicionar as rules protege acesso direto não autenticado.

### ✅ Validação Fase 5
```bash
node -e "require('./database.rules.json'); console.log('✅ database.rules.json válido')"
```

---

## FASE 6 — Testar localmente com emulador (Dia 2)
**Objetivo:** Validar o webhook antes de qualquer deploy em produção

### 6.1 — Iniciar emulador

```bash
firebase emulators:start --only functions,database
```

O emulador sobe na porta `5001` para functions.

### 6.2 — Testar validação GET (handshake Meta)

```bash
curl -X GET \
  "http://localhost:5001/SEU-PROJETO/us-central1/whatsappWebhook?\
hub.mode=subscribe&\
hub.verify_token=obrareal_whatsapp_2026&\
hub.challenge=TESTE123"

# Resposta esperada: TESTE123
```

### 6.3 — Testar mensagem de texto

```bash
node test_webhook_meta.js
# Substituir SEU-PROJETO no arquivo antes de rodar
```

### 6.4 — Testar mensagem MENU

Editar `test_webhook_meta.js` e trocar o `body` para `"MENU"`:
```bash
node test_webhook_meta.js
# Verificar no log do emulador se o parser respondeu
```

### 6.5 — Testar detecção de etapas

Criar arquivo temporário de teste:
```bash
node -e "
const { extrairTarefas } = require('./functions/whatsapp/obra-etapas');
const resultado = extrairTarefas('fazer reboco no quarto 2, colocar tubos de esgoto no banheiro, instalar tomadas na sala');
console.log(JSON.stringify(resultado, null, 2));
"
```

Resultado esperado:
```json
[
  { "titulo": "Fazer reboco no quarto 2", "etapa": "Alvenaria", "etapaCodigo": "ALVE", "confianca": "alta" },
  { "titulo": "Colocar tubos de esgoto no banheiro", "etapa": "Hidrossanitário", "etapaCodigo": "HIDR", "confianca": "alta" },
  { "titulo": "Instalar tomadas na sala", "etapa": "Elétrica", "etapaCodigo": "ELET", "confianca": "alta" }
]
```

### ✅ Validação Fase 6
- [ ] GET retorna o challenge corretamente
- [ ] POST com MENU retorna o menu formatado no log
- [ ] Detecção de etapas classifica corretamente os 3 exemplos acima

---

## FASE 7 — Deploy (Dia 2)
**Objetivo:** Publicar em produção após testes locais passarem

### 7.1 — Rodar testes unitários existentes

```bash
npm test
# Todos devem passar antes do deploy
```

### 7.2 — Deploy das Functions

```bash
firebase deploy --only functions
```

> O deploy pode demorar 3-5 minutos. Aguardar a conclusão completa.

### 7.3 — Deploy do Hosting (firebase.json atualizado)

```bash
firebase deploy --only hosting
```

### 7.4 — Verificar URLs publicadas

```bash
firebase functions:list
# Deve mostrar whatsappWebhook com a URL pública
```

A URL do webhook será:
```
https://obrareal.com/api/whatsapp
```

### ✅ Validação Fase 7
```bash
# Testar GET em produção
curl "https://obrareal.com/api/whatsapp?hub.mode=subscribe&hub.verify_token=obrareal_whatsapp_2026&hub.challenge=PROD123"
# Deve retornar: PROD123
```

---

## FASE 8 — Configurar Meta for Developers (Dia 3)
**Objetivo:** Registrar o webhook e ativar o número comercial

### 8.1 — Registrar Webhook

1. Acessar `developers.facebook.com` → seu App
2. Menu lateral: **WhatsApp → Configuration**
3. Seção **Webhook** → clicar **Edit**
4. Preencher:
   - **Callback URL:** `https://obrareal.com/api/whatsapp`
   - **Verify Token:** `obrareal_whatsapp_2026`
5. Clicar **Verify and Save**
6. Em **Webhook fields**, clicar **Subscribe** no campo `messages`

### 8.2 — Adicionar número de teste

1. Menu lateral: **WhatsApp → API Setup**
2. Em **To**, adicionar seu número pessoal como número de teste
3. Enviar mensagem de teste pela interface da Meta

### 8.3 — Criar Templates de mensagem (para envios proativos)

1. Menu lateral: **WhatsApp → Message Templates**
2. Criar template `relatorio_diario_obra`:
   - Categoria: **UTILITY**
   - Idioma: **pt_BR**
   - Corpo: `Relatório de {{1}} em {{2}}. Presentes: {{3}}/{{4}}. Tarefas concluídas: {{5}}. Atrasadas: {{6}}. Despesas: {{7}}`
3. Aguardar aprovação da Meta (24-48h)

### ✅ Validação Fase 8
- [ ] Webhook verificado com sucesso (ícone verde no painel Meta)
- [ ] `messages` subscrito
- [ ] Enviar "OI" para o número comercial e receber o menu de resposta

---

## FASE 9 — Cadastrar números dos usuários (Dia 3)
**Objetivo:** Conectar número WhatsApp ao tenant no Firebase

### 9.1 — Estrutura necessária no Firebase

Cada usuário que vai interagir via WhatsApp precisa ter o campo `phone` no perfil:

```
profiles/
  {uid}/
    tenantId: "empresa-xyz"
    role: "admin" | "encarregado" | "funcionario"
    name: "João Silva"
    phone: "5598985262006"   ← NOVO campo (com código do país, sem +)
```

### 9.2 — Adicionar pelo painel Admin existente

Opção A (imediata): Adicionar o campo `phone` manualmente no Firebase Console para os primeiros usuários.

Opção B (definitiva): Adicionar campo de telefone no modal de edição de perfil do `app.html` — implementar posteriormente.

### 9.3 — Testar com número real

1. Cadastrar seu número no Firebase como admin do tenant de teste
2. Enviar "MENU" para o número comercial
3. Confirmar que recebe o menu de resposta personalizado com seu nome

### ✅ Validação Fase 9
- [ ] Enviar "MENU" e receber resposta com nome correto
- [ ] Enviar "PONTO lista" e receber lista (mesmo que vazia)
- [ ] Enviar "RELATÓRIO" e receber resumo do dia

---

## FASE 10 — Ativar transcrição de áudio (Dia 4-5)
**Objetivo:** Habilitar envio de áudio para criação de tarefas

### 10.1 — Atualizar `functions/whatsapp/webhook.js`

Adicionar handler de áudio no método `receive`:

```javascript
// Após a verificação do tipo de mensagem
const { handleAudioTarefas, confirmarTarefas, editarTarefaPendente } = require('./parser-tarefas');
const { sendMessage } = require('./sender');

// Dentro da função receive, substituir o bloco de tipo:
if (message.type === 'audio') {
  // Avisa que está processando
  await sendMessage(from, '🎤 Processando seu áudio...');
  const result = await handleAudioTarefas(message.audio.id, tenant, from);
  await sendMessage(from, result.response);
  return;
}

if (message.type === 'text') {
  const text = message.text.body.trim().toUpperCase();

  // Comandos de confirmação de tarefas pendentes
  if (text === 'CONFIRMAR') {
    const result = await confirmarTarefas(tenant, from);
    await sendMessage(from, result.response);
    return;
  }

  if (text === 'CANCELAR') {
    const db = admin.database();
    await db.ref(`tenants/${tenant.tenantId}/tarefas_pendentes/${from}`).remove();
    await sendMessage(from, '❌ Tarefas descartadas.');
    return;
  }

  if (text.startsWith('EDITAR')) {
    const result = await editarTarefaPendente(text, tenant, from);
    await sendMessage(from, result.response);
    return;
  }

  // Comandos normais do parser existente
  const result = await parseCommand(text, tenant, from);
  await sendMessage(from, result.response);
}
```

### 10.2 — Testar fluxo completo de áudio

1. Gravar áudio no WhatsApp: _"fazer reboco no quarto 2, colocar tubos de esgoto no banheiro social"_
2. Enviar para o número comercial
3. Confirmar que recebe o preview com etapas detectadas
4. Responder "CONFIRMAR"
5. Verificar no Firebase Console se as tarefas foram criadas com `etapa` preenchida

### ✅ Validação Fase 10
- [ ] Áudio transcrito corretamente
- [ ] Etapas detectadas com confiança alta para exemplos de reboco e esgoto
- [ ] Tarefas salvas no Firebase com campo `etapa`, `etapaCodigo` e `criadaVia: "whatsapp"`
- [ ] Tarefa sem etapa detectada salva com `confianca: "baixa"` para revisão

---

## FASE 11 — Relatório Diário Automático (Semana 2)
**Objetivo:** Enviar relatório automático às 18h para admins

### 11.1 — Pré-requisito: template aprovado

O template `relatorio_diario_obra` criado na Fase 8.3 precisa estar **aprovado** pela Meta antes de prosseguir. Verificar status em **WhatsApp → Message Templates**.

### 11.2 — Adicionar campo adminPhone nos tenants

No Firebase Console, adicionar em cada tenant ativo:
```
tenants/{tenantId}/adminPhone: "5598985262006"
tenants/{tenantId}/active: true
tenants/{tenantId}/nomeObra: "Residencial Vila Nova"
```

### 11.3 — Deploy do scheduled function

```bash
firebase deploy --only functions:dailyReport
```

### 11.4 — Testar manualmente antes de aguardar o cron

```bash
# Invocar a função manualmente via emulador
firebase functions:shell
# Dentro do shell:
dailyReport()
```

### ✅ Validação Fase 11
- [ ] Admin recebe relatório às 18h com dados reais do dia
- [ ] Relatório mostra presentes, tarefas concluídas e despesas corretamente

---

## CHECKLIST FINAL DE ENTREGA

### Arquivos criados/modificados
- [ ] `functions/whatsapp/webhook.js`
- [ ] `functions/whatsapp/sender.js`
- [ ] `functions/whatsapp/parser.js`
- [ ] `functions/whatsapp/obra-etapas.js`
- [ ] `functions/whatsapp/parser-tarefas.js`
- [ ] `functions/scheduled/daily-report.js`
- [ ] `functions/index.js` — exports adicionados
- [ ] `firebase.json` — rota `/api/whatsapp` + CSP atualizados
- [ ] `database.rules.json` — nó `tarefas_pendentes` adicionado
- [ ] `test_webhook_meta.js` — arquivo de teste criado
- [ ] `CLAUDE.md` — atualizar seção de issues resolvidos

### Funcionalidades entregues
- [ ] Texto → tarefas com etapa detectada automaticamente
- [ ] Áudio → transcrição → tarefas com etapa detectada
- [ ] Fluxo de confirmação antes de salvar (CONFIRMAR / EDITAR / CANCELAR)
- [ ] Comandos de ponto (entrada, saída, falta, lista)
- [ ] Relatório sob demanda (RELATÓRIO)
- [ ] Relatório diário automático às 18h
- [ ] Comandos de tarefa (lista, atrasadas, nova, concluir)

### Testes realizados
- [ ] `npm test` — todos os testes existentes passando
- [ ] Emulador local — handshake GET funcionando
- [ ] Emulador local — detecção de etapas correta
- [ ] Produção — webhook verificado na Meta
- [ ] Produção — fluxo completo de áudio testado com número real

---

## TROUBLESHOOTING RÁPIDO

| Problema | Causa provável | Solução |
|---|---|---|
| GET retorna 403 | `verify_token` diferente do configurado | Conferir `firebase functions:config:get` |
| POST não chega | Webhook não subscrito no campo `messages` | Verificar Meta → Configuration → Webhook fields |
| "Número não cadastrado" | Campo `phone` ausente no perfil | Adicionar `phone` no Firebase Console |
| Áudio não transcreve | API Key OpenAI inválida ou sem crédito | Verificar `openai.key` e saldo na OpenAI |
| Etapa sempre `null` | Texto muito curto ou gíria não mapeada | Adicionar termo em `obra-etapas.js` e fazer redeploy |
| Functions não deployam | Node.js incompatível | Verificar `engines` no `functions/package.json` |
| CSP bloqueando Meta API | `graph.facebook.com` ausente no header | Revisar Fase 2.2 |

---

## COMMITS SUGERIDOS (em ordem)

```bash
git add functions/whatsapp/ functions/scheduled/
git commit -m "feat: criar estrutura base do WhatsApp bot"

git add firebase.json
git commit -m "feat: adicionar rota /api/whatsapp e atualizar CSP"

git add functions/index.js
git commit -m "feat: exportar whatsappWebhook e dailyReport"

git add database.rules.json
git commit -m "feat: adicionar regras para tarefas_pendentes"

git add test_webhook_meta.js
git commit -m "test: adicionar script de teste do webhook Meta"

git add CLAUDE.md
git commit -m "docs: atualizar CLAUDE.md com contexto da integração WhatsApp"
```