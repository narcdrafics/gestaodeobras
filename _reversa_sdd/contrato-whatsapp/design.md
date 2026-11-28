# Contrato de dados — WhatsApp, Design

> 🟢 CONFIRMADO · 🔴 LACUNA BLOQUEANTE. Fontes: `flowcharts/whatsapp-bot.md`, `webhook-whatsapp/questions.md`, `ADR-004`, `ADR-011`.

## Estrutura de dados

| Nó | Campos | Confiança |
|----|--------|-----------|
| `whatsapp_messages/<chaveDedup>` | `recebidaEm`, `status ∈ {processing, done, rejected}`, `concluidaEm` (chave = `msg.id` sanitizado, sem `msgId`/`from` gravados — `whatsapp_auth.js:156-179`) | 🟢 |
| `tenants/<tid>/tarefas/<id>` | `cod=TF###`, `desc`, `obra`, `etapa`, `frente`, `prioridade`, `status=Pendente`, `criadoPor`, `criadoEm=ServerValue.TIMESTAMP`, `origem=WhatsApp` | 🟢 |
| `tenants/<tid>/presenca/<id>` | `data`, `obra`, `trab`, `nome`, `funcao`, `vinculo`, `equipe`, `entrada`, `saida`, `hnorm`, `hextra`, `presenca`, `diaria`, `total`, `pgtoStatus`, `valpago`, `lancador`, `hrLanc`, `origem`, `telefoneAutor` (`index.js:367-375`) | 🟢 |
| `users/<email>` | `whatsappId`, `telefone` (somente super_admin escreve) | 🟢 |
| `tenants/<tid>/config/telefonesPermitidos` | allowlist de fallback (somente super_admin) | 🟢 |
| `tenants/<tid>/tarefas_pendentes/<from>` | 🟢 decisão P4: nó removido — gravação direta em `tarefas` (hoje ainda escrito pelo parser órfão) | 🟢 |

## Fluxos principais

1. 🟢 **Handshake/POST:** valida token/HMAC/origem → extrai mensagem → dedup → autoriza → checa estado → processa → responde.
2. 🟢 **Áudio:** valida URL (`graph.facebook.com`/`*.fbcdn.net`) → download ≤8 MB/20 s → Whisper-1 pt → transcrição.
3. 🟢 **Intenção:** comandos curtos locais primeiro; fallback GPT-4o-mini com `response_format: json_object` e data fixa em `America/Sao_Paulo`.
4. 🟢 **Escrita:** `buscarObra` (exata → contém → fuzzy 0,3); tarefa `TF###` ou presença via transação `data+trab`.
5. 🟢 **Resposta:** `POST graph.facebook.com/v20.0/<phoneId>/messages` com Bearer token; mensagem vazia não é enviada.
6. 🟢 **Relatório diário:** 21:00 UTC (18h), feature `relatorio.whatsapp.diario`, `adminPhone`, status ≠ inativo. Decisão P3: ler `presenca` (ajuste pendente).

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Autenticação isolada de regras de negócio (injeção) | `whatsapp_auth.js:185-188` | 🟢 |
| Dedup por transação com reserva e limpeza em 24 h | `ADR-004`, `whatsapp_auth.js:161-183` | 🟢 |
| Intenção local antes de LLM (custo/latência) | `ADR-011`, `index.js:198-234` | 🟢 |
| Empate de tenant rejeitado, nunca "primeiro casado" | `whatsapp_auth.js:120-138` | 🟢 |
| Horário de negócio em `America/Sao_Paulo` | `ADR-009` | 🟢 |

## Estado Interno

🟢 `whatsapp_messages.status`: `processing` → `done` | `rejected`; exceção remove a reserva para reprocessamento. 🟢 `dailyReport` com `maxInstances: 1`. 🟡 Reserva presa só é removida pela limpeza de 24 h, não por lease curto (contraste com Kiwify).

## Observabilidade

🟢 Logs de envio/erro da Graph API e de conclusão do job. 🟢 `webhook_debug`-like rejeições em `whatsapp_messages`. 🟡 Sem retry, fila ou dead-letter (GAP-05); erros são apenas logados.

## Riscos e Lacunas — BLOQUEANTES

| ID | Lacuna | Impacto no contrato | Confiança |
|----|--------|---------------------|-----------|
| 🟢 GAP-01 | decisão P1: resumo de presença de hoje do remetente | RF-11 tem comportamento definido | 🟢 |
| 🟢 GAP-02 | decisão P2: ativar prévia/confirmação | Fluxo deixa de ser "planejado, não ativo" | 🟢 |
| 🟢 GAP-03 | decisão P3: `presenca` canônico | Contadores deixam de zerar após ajuste | 🟢 |
| 🟢 GAP-04 | decisão P4: nó removido, gravação direta em `tarefas` | Sem caminho divergente | 🟢 |
| 🔴 GAP-05 | Graph API sem retry/fila/dead-letter | Sem garantia de entrega | 🔴 |
| 🟡 Q-01 | `dados` do GPT sem schema | Risco de exceção em `.tarefa`/`.ponto` | 🟢 |

## Regras para Revisor

🟢 GAP-01…GAP-04 transformados em comportamento implementável por decisão humana em `questions.md`; 🔴 GAP-05 permanece visível até decisão.
