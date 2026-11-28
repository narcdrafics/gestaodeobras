# Tracer — `auth`

> Gerado pelo Tracer em 2026-11-28 (UTC) · `doc_level` = completo · modalidade = emulador Firebase (`auth` + `database` + `functions`, projeto `demo-gestaodeobras`).
> Legenda: 🟢 confirmado em runtime · 🟡 inconclusivo · 🔴 divergência confirmada.

## Escopo

Fluxo de autenticação e publicação de Custom Claims (`syncCustomClaims`) escolhido porque é a ponte entre `profiles/<uid>` e as quatro camadas de autorização descritas em `contrato-autenticacao-e-claims/requirements.md`. Nenhuma decisão humana de `questions.md` foi reclassificada: GAP-09 (P9) e GAP-10 (P10) permanecem pendentes.

Comandos executados (nenhum arquivo legado foi alterado):

- `firebase emulators:exec --only auth,database,functions --project demo-gestaodeobras --config _reversa_sdd/dynamic-analysis/emulator-config.json --non-interactive "node probe-auth.js"`
- JDK 21.0.13.1 portátil em `C:\Users\tonyd\AppData\Local\Temp\opencode\jdk21\` (o Firebase CLI 15.37 recusa o Java 17 do sistema).
- Config temporária, cópias de `database.rules.json`/`storage.rules` e um junction `functions/` dentro de `dynamic-analysis/`, para iniciar os emuladores sem editar o `firebase.json` legado.

## Hipóteses e vereditos

| ID | Afirmação da spec | Localizador | Entrada | Saída observada | Evidência | Veredito |
|----|-------------------|-------------|---------|-----------------|-----------|----------|
| H1 | Escrita em `profiles/{uid}` dispara `syncCustomClaims` e a claim espelha `tenantId` do perfil | `trigger-sincronizar-claims/requirements.md#RF-01`; `contrato-autenticacao-e-claims/requirements.md#RN-001` | Usuário `tracer-auth-h1@exemplo.invalid`; perfil `role=admin`, `tenantId=tenant-tracer-a` | Claim `{role:'admin', tenantId:'tenant-tracer-a'}` | `emulator-run.log`: `[syncCustomClaims] Atualizado uid: tracer-auth-h1`; `events.jsonl` H1 | 🟢 CONFIRMADO EM RUNTIME |
| H2 | Papel `mestre` é normalizado para `encarregado`; a claim nunca contém `mestre` | `trigger-sincronizar-claims/requirements.md#RF-02` (GAP-09 em `questions.md#Pergunta 9`) | Usuário `tracer-auth-h2@exemplo.invalid`; perfil gravado com `role=mestre` | Claim `{role:'encarregado', tenantId:'tenant-tracer-a'}`; perfil permanece `mestre` | `emulator-run.log`: `Atualizado uid: tracer-auth-h2 -> role: encarregado`; `events.jsonl` H2 | 🟢 CONFIRMADO EM RUNTIME |
| H3 | Auto-promoção a `super_admin` é corrigida para `admin` com `cargoAtualizadoPor` | `trigger-sincronizar-claims/requirements.md#RF-03` (RN-005) | Usuário `tracer-auth-h3@exemplo.invalid`; perfil com `role=super_admin`, sem allowlist | Claim `{role:'admin', tenantId:'tenant-tracer-a'}` e log `Escalação bloqueada (nao_autorizado)`; na leitura do RTDB o perfil ainda era `super_admin`, sem `cargoAtualizadoPor` | `emulator-run.log`; `events.jsonl` H3 | 🟡 INCONCLUSIVO (correção da claim confirmada; correção gravada no perfil não observada na leitura) |
| H4 | Perfil acima do limite de assentos vira `pendente` e a claim fica sem `tenantId` | `trigger-sincronizar-claims/requirements.md#RF-05` (RN-004) | Tenant `tenant-tracer-lotado` com `limiteUsuarios=1`; dois perfis ativos semeados; novo perfil `tracer-auth-h4@exemplo.invalid` | Após 12 s a claim era `{role:'admin', tenantId:'tenant-tracer-lotado'}`, não `pendente` | `emulator-run.log` (ordem dos eventos mostra o trigger do segundo perfil ativo após o do novo perfil); `events.jsonl` H4 | 🟡 INCONCLUSIVO (semeadura com corrida: a contagem de perfis ativos ainda não era estável) |
| H5 | RH com `acessoObras='especificas'` e 60 obras publica no máximo 50 em `obrasPermitidas` | `trigger-sincronizar-claims/requirements.md#RF-06` (RN-008) | Usuário `tracer-auth-h5@exemplo.invalid`; perfil `role=rh`, 60 obras, módulo `financeiro` | Claim com `role:'rh'`, `acessoObras:'especificas'`, `modulosPermitidos:{financeiro:true}` e exatamente 50 obras | `emulator-run.log`; `events.jsonl` H5 | 🟢 CONFIRMADO EM RUNTIME |

## Divergências

Nenhuma divergência confirmada em runtime. H3 e H4 são **inconclusivos**, não contradições: a evidência disponível não permite afirmar que a spec foi violada.

- H3: a correção da claim foi observada; a correção do perfil (`role`/`cargoAtualizadoPor`) não foi vista na leitura feita pelo probe, possivelmente por assincronia entre a gravação do trigger e a consulta.
- H4: o seed dos dois perfis ativos e a escrita do novo perfil correram em sequência, mas os triggers do emulador foram processados em ordem diferente; `contarPerfisAtivos` pode ter lido apenas um perfil ativo.

### Nota de setup descoberta na rodada `usuarios-e-cargos`

`probe-auth.js:18` inicializa o Admin SDK com `databaseURL=http://127.0.0.1:9000?ns=demo-gestaodeobras-default-rtdb`. Na rodada seguinte, o probe e as Functions precisaram usar o mesmo namespace (`?ns=demo-gestaodeobras`): com os namespaces divergentes, as Functions devolveram 403/sem_tenant e a tentativa foi descartada (`events.jsonl`, nota `SETUP-NAMESPACE`). O aviso correspondente aparece em `database-debug.log:16-19` ("Multiple projectIds are not recommended in single project mode"), com os dois namespaces ativados em `:14` e `:20`.

Esse descompasso é uma causa plausível — não comprovada — para a leitura incompleta em H3 e para a contagem em H4, pois pode manter probe e trigger em visões diferentes do RTDB. Por isso H3 e H4 **permanecem 🟡**: nenhuma nova execução de `auth` foi feita após o alinhamento do namespace e nenhum veredito foi reclassificado com base nessa hipótese de setup.

## Recomendações

- [ ] Repetir H4 com namespace RTDB alinhado entre probe e Functions (`?ns=demo-gestaodeobras`) e espera determinística até que `profiles` contenha 2 perfis ativos no tenant antes de gravar o novo perfil; somente então classificar RF-05.
- [ ] Repetir H3 com o mesmo namespace alinhado e polling do nó `profiles/<uid>/cargoAtualizadoPor` (timeout explícito) para confirmar a correção gravada, sem alterar o código legado.
- [ ] Registrar em `questions.md` (P9/GAP-09) que o perfil conserva `mestre` enquanto a claim usa `encarregado`; a decisão sobre remover o alias continua pendente.
- [ ] Não reclassificar GAP-05, GAP-06, GAP-07, GAP-08, GAP-09, GAP-10, L-15 ou L-19 com base nesta execução — nenhum deles foi observado diretamente.
- [ ] Instrumentação adicional (novo teste ou hook) só com autorização explícita; nada foi aplicado ao código.

## Limitações

- As regras de RTDB/Storage não foram exercitadas por um cliente autenticado: o probe usou Admin SDK, que ignora rules. GAP-08 permanece aberto.
- O cliente web (`detectSubdomain`, `signOut`, `getIdTokenResult(true)` com 6 tentativas) não foi observado: não há executor de navegador no ambiente. RF-01–RF-03 de `contrato-autenticacao-e-claims/requirements.md` ficam fora do runtime.
- Jobs agendados (`dailyReport`, `aprovacoesPrazosJob`, `retencaoSegurancaJob`, `dailyBillingStateJob`) foram ignorados porque o emulador de Pub/Sub não foi iniciado.
- O Functions Emulator usou Node 26 do host, enquanto `functions/package.json` declara Node 24 (aviso não bloqueante).
- Critério de parada do plano atingido: 10 escritas controladas; não foi feita uma segunda rodada corretiva.
- Nada foi commitado ou pushado.
