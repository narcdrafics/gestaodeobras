# Histórico de Versões (Changelog) - Obra Real

Todas as mudanças notáveis para o projeto **Obra Real** serão documentadas neste arquivo seguindo o padrão [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) e [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
