# Job — Relatório diário, Tarefas

> 🟢 CONFIRMADO · 🔴 LACUNA.

## Pré-requisitos

- [ ] 🟢 GAP-03 resolvido: decisão P3 define `presenca` como nó canônico; ajustar o job.
- [ ] Segredos `META_ACCESS_TOKEN`/`META_PHONE_NUMBER_ID` disponíveis.
- [ ] 🔴 GAP-05: definir política de retry antes de productionizar.

## Tarefas

- [ ] T-01, Registrar schedule 21:00 UTC — Origem: `functions/index.js:448`; Critério: config correta; 🟢
- [ ] T-02, Aplicar gate `hasFeature` e `billingState` — Origem: `plan_features.js`; Critério: sem feature ⇒ sem envio; 🟢
- [ ] T-03, Calcular `getHojeBR()` — Origem: `functions/index.js:53-60`; Critério: ADR-009; 🟢
- [ ] T-04, 🟢 Ajustar leitura para `tenants/<tid>/presenca` — Origem: decisão P3; Critério: resumo contém as presenças reais; 🟢
- [ ] T-05, Enviar para `adminPhone` via Graph API — Origem: `index.js:423-446`; Critério: entrega; 🟢

## Testes

- [ ] TT-01, feature desativada ⇒ sem envio
- [ ] TT-02, tenant bloqueado ⇒ sem envio
- [ ] TT-03 (🟢), resumo com presenças do bot em `presenca` — decisão P3

## Lacunas Pendentes (🔴)

- 🟢 GAP-03 decidido (P3): usar `presenca`. 🔴 GAP-05 — P5 sem decisão; não implementar retry sem validação.
