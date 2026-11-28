# Contrato de dados — Autenticação, tenant e RBAC

> 🟢 CONFIRMADO · 🟡 INFERIDO · 🔴 LACUNA. Cobre os módulos `auth` e `seguranca-e-rbac` da matriz de impacto §4. Fontes: `flowcharts/auth.md`, `flowcharts/seguranca-e-rbac.md`, `domain.md` RN-001–RN-015, `permissions.md`, `database.rules.json`, `storage.rules`.

## Visão Geral

🟢 Contrato de identidade e isolamento: `profiles/<uid>` é a autoridade de papel/tenant, `users/<email>` é passaporte legado, `invites/<email>` é convite, e Custom Claims são o espelho consumido por Storage e pelo cliente.

## Responsabilidades

- 🟢 Detectar tenant pelo subdomínio e impedir sessão cross-tenant.
- 🟢 Aguardar claims atualizadas antes de liberar a aplicação (6 tentativas).
- 🟢 Aplicar quatro camadas de autorização (rules, claims, perfil, lógica de servidor).
- 🟢 Proteger APIs com validação de corpo, cotas, hash de IP e auditoria.

## Regras de Negócio

- 🟢 RN-001: tenant vem do perfil no RTDB, nunca do navegador.
- 🟢 RN-002: `bloqueado` perde leitura/escrita; `somente_leitura` só lê.
- 🟢 RN-013: login em subdomínio encerra sessão se `perfil.tenantId !== CURRENT_TENANT_ID`.
- 🟢 RN-014: sessão não atravessa origens; redireciona para `<slug>.obrareal.com/login.html`.
- 🟢 RN-015: `tenants_public/<slug>` lido por chave, nunca `orderByChild`.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | 🟢 `detectSubdomain()` define `CURRENT_TENANT_ID` | Must | Hostname errado não carrega dados de outro tenant |
| RF-02 | 🟢 `signOut` em divergência de tenant/pendência | Must | Usuário sem acesso não vê a app |
| RF-03 | 🟢 `getIdTokenResult(true)` com até 6 tentativas | Must | Claims atualizadas antes da liberação |
| RF-04 | 🟢 Quatro camadas de autorização | Must | ADR-006 aplicado em APIs e rules |
| RF-05 | 🟢 Cotas IP/UID e hash de IP com salt | Must | Abuso recebe 413/429 sem IP em claro |
| RF-06 | 🟢 Auditoria obrigatória em operação sensível | Must | Falha ⇒ 503 |
| RF-07 | 🟡 Alias `mestre` tratado como `encarregado` | Should | GAP-09 registrado |

## Critérios de Aceitação

```gherkin
Dado um usuário autenticado no subdomínio da empresa A com perfil da empresa B
Quando a app carrega
Então signOut é chamado e mensagem "sem acesso a esta empresa" é exibida

Dado um tenant com billingState='bloqueado'
Quando o cliente tenta ler ou escrever em tenants/<tid>
Então as rules negam a operação
```

## Rastreabilidade

| Arquivo | Símbolo | Cobertura |
|---------|---------|-----------|
| `public/js/auth_core.js:306-439` | `detectSubdomain`, login, signOut | 🟢 |
| `public/js/data_core.js:263-294` | tenant/feature state | 🟢 |
| `database.rules.json:30-161` | rules de tenant | 🟢 |
| `storage.rules:4-22` | claims | 🟢 |
| `functions/abuso.js`, `functions/auditoria.js` | proteção | 🟢 |
