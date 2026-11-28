# Lacunas bloqueantes — Webhook WhatsApp

> 🟢 GAP-01/02/03/04 decididos em `_reversa_sdd/questions.md` (P1–P4); 🔴 GAP-05 segue pendente (P5).

| ID | Lacuna | Impacto na spec | Decisão necessária | Bloqueante? |
|----|--------|-----------------|--------------------|-------------|
| GAP-01 | 🟢 decisão P1: resumo de presença de hoje do remetente | RF-11 passa a ter comportamento definido | Respondida em `questions.md` P1 | Não (implementação pendente) |
| GAP-02 | 🟢 decisão P2: ativar prévia/confirmação no webhook | Fluxo passa a ser implementável | Respondida em P2 | Não (implementação pendente) |
| GAP-03 | 🟢 decisão P3: `presenca` é o nó canônico | Leitura do job passa a ter origem definida | Respondida em P3 | Não (ajuste pendente) |
| GAP-05 | 🔴 Graph API sem retry/fila/dead-letter | RF-13 sem mecanismo de reenvio | Definir política: retry com backoff, fila ou dead-letter | Sim |
| GAP-04 | 🟢 decisão P4: nó removido — gravação direta em `tarefas` | Matriz de autorização simplificada | Respondida em P4 | Não |
| 🟡 Q-01 | `dados` do GPT não validado contra schema antes de `.tarefa`/`.ponto` | Risco de exceção em resposta malformada | Definir schema mínimo obrigatório | Não |

## Regra para o Redator/Revisor

🟢 GAP-01…GAP-04 têm decisão humana registrada em `questions.md`; 🔴 GAP-05 permanece bloqueante. Esta unit mantém apenas o comportamento 🟢 confirmado nas units `webhook-whatsapp` e `job-relatorio-diario`.
