# Histórico de Versões (Changelog) - Obra Real

Todas as mudanças notáveis para o projeto **Obra Real** serão documentadas neste arquivo seguindo o padrão [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) e [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
