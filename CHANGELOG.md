# Histórico de Versões (Changelog) - Obra Real

Todas as mudanças notáveis para o projeto **Obra Real** serão documentadas neste arquivo seguindo o padrão [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) e [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-11-14
### Adicionado
- Cadastro com escolha do slug: ao entrar pela primeira vez, o usuário escolhe o endereço da empresa (`<slug>.obrareal.com`) numa tela com checagem de disponibilidade em tempo real (`js/slug.js`, `js/slug_onboarding.js`).
- A empresa é criada numa única escrita atômica (tenant + nó público + passaporte global), o que impede duas empresas com o mesmo slug e faz a conta aparecer no painel do Master.
- Painel do Master: mostra `slug.obrareal.com`, plano e origem (auto-cadastro) de cada empresa e avisa/atualiza quando entra uma empresa nova.
- Slugs reservados (www, app, admin, login...) não podem ser escolhidos.

### Modificado
- Auto-onboarding deixa de gerar slug aleatório (`joao123`). Em produção, após criar, o usuário é levado a `https://<slug>.obrareal.com/login.html` (e-mail preenchido); em dev/staging a URL vira `app.html?tenant=<slug>`.
- Login em subdomínio de uma empresa por conta sem vínculo não cria mais empresa nova (antes gerava um tenant órfão).

### Segurança
- Painel do Master passa a escapar nome, slug, e-mail e IDs vindos do banco (antes iam direto para `innerHTML` e `onclick`, permitindo XSS contra o Master).

---

## [1.2.0] - 2026-11-10
### Segurança
- Hosting passa a publicar apenas `public/` (antes `"public": "./"` expunha JSONs de dados, regras, código das functions e testes).
- Removidos do repositório `users.json`, `auth_users.json`, `tenant.json` e `entities.json`; adicionados ao `.gitignore` junto com `serviceAccountKey.json`.

### Modificado
- Arquivos do front (`index/app/login/admin-login/obrigado.html`, `css/`, `img/`, `js/`, `pages/`, `modals/`) movidos para `public/`.
- `server.js` serve somente `public/`; testes apontam para `public/js/`.
- `raw/` e `wiki/` movidos para `docs/`.
- `package.json` da raiz: removidas dependências sem uso (`axios`, `firebase`, `firebase-functions`, `firebase-tools`, `openai`).

### Removido
- Backups `js/app_core.js.bak`, `.tmp` e `.bak2`; pasta `scratch/`; `test_*.js` soltos na raiz; `.code-workspace` e `mempalace.yaml`.
- Bloco comentado de `renderPage` em `app_core.js`.

---

## [1.1.0] - 2026-04-01
### Adicionado
- Infraestrutura de testes unitários com **Vitest** e `jsdom`.
- Módulo isolado de utilitários em `js/utils.module.js` para garantir integridade de cálculos.
- Primeiros testes unitários para o módulo de estoque e formatação de dados.

### Modificado
- `package.json`: Adicionado script `npm test`.

---

## [1.0.0] - 2026-03-27
### Adicionado
- Versão inicial estável com gestão de obras, tarefas, estoque e financeiro.
- Sincronização em tempo real com Firebase.
- Sistema de subdomínios (multitenancy).
- Banner de trial progressivo e integração com WhatsApp.
