# Tracer — índice de análise dinâmica

> Gerado pelo Tracer em 2026-11-28 (UTC) · `doc_level` = completo · skill executada manualmente a partir de `.reversa/staged-skills/reversa-tracer/SKILL.md` (não instalada no harness).

## Escopo

- **Modalidade:** emulador Firebase `auth` + `database` + `functions`, projeto demo `demo-gestaodeobras` (sem acesso ao projeto real `controle-obras-c889d`).
- **Data:** 2026-11-28 (UTC).
- **Rodadas:** 2 — `auth` e `usuarios-e-cargos`.
- **Vereditos consolidados:** 11 hipóteses — 9 🟢 confirmadas em runtime, 2 🟡 inconclusivas, 0 🔴 divergências confirmadas.
  - `auth`: 5 hipóteses — 3 🟢 / 2 🟡 / 0 🔴 (H3 e H4 permanecem inconclusivos).
  - `usuarios-e-cargos`: 6 hipóteses — 6 🟢 / 0 🟡 / 0 🔴.

## Artefatos

| Rodada | Relatório | Log da execução | Resultado estruturado | Probe |
|--------|-----------|-----------------|----------------------|-------|
| `auth` | [auth.md](auth.md) | [emulator-run.log](emulator-run.log) | [probe-results.json](probe-results.json) | [probe-auth.js](probe-auth.js) |
| `usuarios-e-cargos` | [usuarios-e-cargos.md](usuarios-e-cargos.md) | [emulator-usuarios-e-cargos.log](emulator-usuarios-e-cargos.log) | [probe-usuarios-e-cargos-results.json](probe-usuarios-e-cargos-results.json) | [probe-usuarios-e-cargos.js](probe-usuarios-e-cargos.js) |

- [events.jsonl](events.jsonl) — 12 linhas: 5 eventos `H1`–`H5` (`auth`), 1 nota `SETUP-NAMESPACE` (tentativa descartada) e 6 eventos `U1`–`U6` (`usuarios-e-cargos`). Valores sensíveis redacionados; e-mails fictícios `*.invalid`.

## Reprodução e evidências brutas

- `firebase emulators:exec --only auth,database,functions --project demo-gestaodeobras --config _reversa_sdd/dynamic-analysis/emulator-config.json --non-interactive "node <probe>.js"`, com JDK 21 portátil em `C:\Users\tonyd\AppData\Local\Temp\opencode\jdk21\` (o Firebase CLI 15.37 recusa Java < 21).
- [emulator-config.json](emulator-config.json) — config temporária dos emuladores; não substitui o `firebase.json` legado.
- [database.rules.json](database.rules.json) e [storage.rules](storage.rules) — cópias exatas das rules legadas, usadas apenas pelo emulador.
- `functions/` — junction para `functions/` do projeto; o original não foi alterado.
- `database-debug.log` — log do emulador de RTDB da última execução; o aviso nas linhas 16–19 registra a divergência de namespace que invalidou a primeira tentativa de `usuarios-e-cargos`.

## Estado

Tracer marcado como ✅ em `.reversa/plan.md`, com `checkpoints.tracer` em `.reversa/state.json` registrando a rodada atual e o histórico da rodada `auth`. Nenhum arquivo legado foi editado; nada foi commitado ou pushado.
