# Tracer — `usuarios-e-cargos`

> Gerado pelo Tracer em 2026-11-28 (UTC) · `doc_level` = completo · modalidade = emulador Firebase (`auth` + `database` + `functions`, projeto `demo-gestaodeobras`).
> Legenda: 🟢 confirmado em runtime · 🟡 inconclusivo · 🔴 divergência confirmada.

## Escopo

Fluxo de criação de credenciais e gestão de cargo/tenant (`criarUsuarioTenant` e `gerenciarCargo`) escolhido porque concentra as regras de autoridade centralizada, consumo de convite e desativação de acesso descritas em `api-admin-criar-usuario/requirements.md`, `api-admin-cargo/requirements.md`, `contrato-admin-e-usuarios/requirements.md` e `flowcharts/usuarios-e-cargos.md`. Nenhuma decisão humana de `questions.md` foi reclassificada: GAP-05 (P5) permanece bloqueante e P6–P10, P15 e P19 continuam pendentes.

Comandos executados (nenhum arquivo legado foi alterado):

- `firebase emulators:exec --only auth,database,functions --project demo-gestaodeobras --config _reversa_sdd/dynamic-analysis/emulator-config.json --non-interactive "node probe-usuarios-e-cargos.js"`
- JDK 21.0.13.1 portátil em `C:\Users\tonyd\AppData\Local\Temp\opencode\jdk21\` (o Firebase CLI 15.37 recusa o Java 17 do sistema).
- `FIREBASE_CONFIG` com `databaseURL=http://127.0.0.1:9000?ns=demo-gestaodeobras`, alinhado ao `initializeApp` do probe. Config temporária, cópias de `database.rules.json`/`storage.rules` e um junction `functions/` dentro de `dynamic-analysis/`, para iniciar os emuladores sem editar o `firebase.json` legado.
- Uma primeira tentativa com `?ns=demo-gestaodeobras-default-rtdb` no probe foi **descartada**: as Functions liam `?ns=demo-gestaodeobras` e devolveram 403/sem_tenant. O descarte está registrado em `events.jsonl` (`SETUP-NAMESPACE`); nenhum veredito dessa tentativa foi considerado.

## Hipóteses e vereditos

| ID | Afirmação da spec | Localizador | Entrada | Saída observada | Evidência | Veredito |
|----|-------------------|-------------|---------|-----------------|-----------|----------|
| U1 | Convite válido (`usos=0`, tenant compatível) ⇒ `200` com uid/e-mail e senha temporária de 12 caracteres; convite consumido e senha ausente no RTDB | `api-admin-criar-usuario/requirements.md#RF-07`, `#RF-08` | `POST /api/admin/criar-usuario` com convite `usos=0` para `tracer-uc-u1@exemplo.invalid`, tenant `tenant-tracer-usuarios` | `200`, `criado:true`, senha redacionada nos artefatos (`len=12`), `usos=1` no convite; nenhuma senha em `profiles`, `users` ou `invites` | `emulator-usuarios-e-cargos.log` (evento U1); `events.jsonl` U1 | 🟢 CONFIRMADO EM RUNTIME |
| U2 | Convite já usado ⇒ `409 convite_ja_usado`, sem criar conta | `api-admin-criar-usuario/requirements.md#RF-07` | `POST /api/admin/criar-usuario` com convite `usos=1` para `tracer-uc-u2@exemplo.invalid` | `409 {"error":"convite_ja_usado"}`; `getAuth().getUserByEmail()` não encontrou conta | `emulator-usuarios-e-cargos.log` (evento U2); `events.jsonl` U2 | 🟢 CONFIRMADO EM RUNTIME |
| U3 | Admin comum promovendo outro usuário a `super_admin` ⇒ `403` e perfil inalterado | `api-admin-cargo/requirements.md#RF-07`; `flowcharts/usuarios-e-cargos.md` §2 | `POST /api/admin/cargo` `definir_cargo role=super_admin` para `tracer-uc-u3` por admin comum | `403 sem_permissao` ("Somente Super Admin pode conceder acesso master."); perfil permaneceu `rh` e `super_admins/<uid>` vazio | `emulator-usuarios-e-cargos.log` (evento U3); `events.jsonl` U3 | 🟢 CONFIRMADO EM RUNTIME |
| U4 | Auto-alteração ⇒ `400 auto_alteracao` | `api-admin-cargo/requirements.md#RF-04` | `POST /api/admin/cargo` `definir_cargo` com o `uid` do próprio chamador | `400 auto_alteracao` ("Você não pode alterar seu próprio cargo por aqui.") | `emulator-usuarios-e-cargos.log` (evento U4); `events.jsonl` U4 | 🟢 CONFIRMADO EM RUNTIME |
| U5 | `definir_cargo` com `role=mestre` ⇒ perfil `encarregado`; módulos RH persistem apenas com `true` e são propagados às claims | `api-admin-cargo/requirements.md#RF-06`, `#RF-09`; `contrato-admin-e-usuarios/requirements.md#RF-03` | `POST /api/admin/cargo` para `tracer-uc-u5`: `role=mestre`, depois `role=rh` com `modulosPermitidos:{presenca:true, compras:false, arbitrario:true}` | `200` nas duas chamadas; perfil `encarregado` e depois `rh`; perfil e claims com apenas `{presenca:true}`; `compras` e `arbitrario` descartados (claims em 3 ms) | `emulator-usuarios-e-cargos.log` (evento U5, logs de `syncCustomClaims`); `events.jsonl` U5 | 🟢 CONFIRMADO EM RUNTIME |
| U6 | `remover_usuario` ⇒ perfil `desativado`/`bloqueado`/sem tenant e conta do Auth desabilitada | `api-admin-cargo/requirements.md#RF-12` | `POST /api/admin/cargo` `remover_usuario` para `tracer-uc-u6`, com passaporte em `users/` | `200 removido:true`; perfil `role=desativado`, `status=bloqueado`, sem `tenantId`; `getAuth().getUser().disabled === true`; passaporte `role=desativado`, sem tenant | `emulator-usuarios-e-cargos.log` (evento U6); `events.jsonl` U6 | 🟢 CONFIRMADO EM RUNTIME |

## Divergências

Nenhuma divergência confirmada em runtime. As 6 hipóteses foram confirmadas na execução válida (namespace `demo-gestaodeobras`). A tentativa com `?ns=demo-gestaodeobras-default-rtdb` foi um **problema de setup**, não comportamento da spec: o probe e as Functions operavam em namespaces diferentes do RTDB emulator. Ela não produziu vereditos e foi registrada apenas como `SETUP-NAMESPACE` em `events.jsonl`.

## Recomendações

- [ ] Ao repetir qualquer rodada, fixar um único namespace RTDB tanto no `FIREBASE_CONFIG` das Functions quanto no `initializeApp` do probe (usar `?ns=demo-gestaodeobras`), evitando a falsa divergência de 403/sem_tenant.
- [ ] Repetir a rodada `auth` com o namespace alinhado antes de classificar H3 e H4; elas permanecem 🟡 em `auth.md` e não foram reclassificadas por esta execução.
- [ ] Não reclassificar GAP-05, GAP-06, GAP-07, GAP-08, GAP-09, GAP-10, L-15 ou L-19 com base nesta execução: nenhum deles foi observado diretamente aqui.
- [ ] Senhas temporárias devem continuar redacionadas em qualquer artefato derivado; os e-mails usados são fictícios (`*.invalid`).
- [ ] Instrumentação adicional (novo teste ou hook) só com autorização explícita; nada foi aplicado ao código legado.
- [ ] Nada foi commitado ou pushado.

## Limitações

- As regras de RTDB/Storage não foram exercitadas por um cliente autenticado: o probe usou Admin SDK, que ignora rules. GAP-08 permanece aberto.
- O cliente web (`admin.html`, modais, toasts) não foi observado: não há executor de navegador no ambiente. Apenas as APIs HTTP e o estado server-side foram verificados.
- Controles de abuso (`validarCorpo` com limite de 16 KB e `consumirCota` de 20/min por IP) não foram estressados: as chamadas ficaram abaixo dos limites.
- Jobs agendados (`aprovacoesPrazosJob`, `retencaoSegurancaJob`, `dailyBillingStateJob`, `dailyReport`) não foram exercitados: o emulador de Pub/Sub não foi iniciado.
- O Functions Emulator usou Node 26 do host, enquanto `functions/package.json` declara Node 24 (aviso não bloqueante).
- Critério de parada do plano respeitado: 2 subidas de emulador (1 descartada + 1 válida), 12 escritas/chamadas controladas; nenhuma conta ou escrita em projeto real.
- Logs da primeira tentativa foram sobrescritos pela execução válida; o descarte sobrevive apenas na nota `SETUP-NAMESPACE` de `events.jsonl` e no aviso de namespace em `database-debug.log`.
