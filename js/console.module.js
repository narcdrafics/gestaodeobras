// ==================== CONSOLE TERMINAL ====================
// Interface estilo terminal para gestão de obras
//>Integra com window.DB (dados Firebase)

const C = {
  bg:      "#090b0d",
  panel:   "#0e1114",
  border:  "#1c2028",
  border2: "#252c35",
  text:    "#c8d0db",
  dim:     "#4a5568",
  dim2:    "#2d3748",
  accent:  "#f59e0b",
  green:   "#34d399",
  red:     "#f87171",
  blue:    "#60a5fa",
  cyan:    "#22d3ee",
  orange:  "#fb923c",
};

const fmt = {
  brl: (v) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
  pct: (a, b) => b ? `${((a / b) * 100).toFixed(1)}%` : "0%",
};

const STATUS_OBRA = { em_andamento: ["EM ANDAMENTO"], pausada: ["PAUSADA"], concluida: ["CONCLUÍDA"] };
const STATUS_TK = { pendente: ["PENDENTE"], em_andamento: ["ANDAMENTO"], concluida: ["CONCLUÍDA"], bloqueada: ["BLOQUEADA"] };
const PRIO_TK = { critica: "#f87171", alta: "#fb923c", media: "#f59e0b", baixa: "#4a5568" };

const ALL_CMDS = ["dashboard", "obras", "trabalhadores", "presenca", "tarefas", "estoque", "financeiro", "relatorios", "help", "clear"];

let consoleHistory = [];
let consoleInput = "";
let cmdHistory = [];
let cmdIdx = -1;
let consoleBooted = false;

function ruler(label) {
  const dashes = "─".repeat(Math.max(0, 52 - (label?.length || 0)));
  return `<div style="color:${C.dim};font-size:10px;letter-spacing:3;margin-bottom:10px;">── ${label} ${dashes}</div>`;
}

function tag(color, text) {
  return `<span style="color:${color};border:1px solid ${color};border-radius:2px;padding:1px 6px;font-size:10px;letter-spacing:1.5;font-weight:700;">${text}</span>`;
}

function statBox(label, value, color = C.text, sub = "") {
  return `<div style="border:1px solid ${C.border2};padding:10px 14px;background:${C.panel};min-width:130px;">
    <div style="font-size:9px;color:${C.dim};text-transform:uppercase;letter-spacing:2;margin-bottom:5px;">${label}</div>
    <div style="font-size:20px;font-weight:700;color:${color}">${value}</div>
    ${sub ? `<div style="font-size:10px;color:${C.dim};margin-top:3px;">${sub}</div>` : ""}
  </div>`;
}

function getDB() {
  return window.DB || { obras: [], trabalhadores: [], presenca: [], tarefas: [], estoque: [], financeiro: [] };
}

function renderDashboard() {
  const db = getDB();
  const obras = db.obras || [];
  const trabs = db.trabalhadores || [];
  const tareas = db.tarefas || [];
  const estq = db.estoque || [];
  const finan = db.financeiro || [];

  const totalOrc = obras.reduce((s, o) => s + (o.orcamento || 0), 0);
  const totalGasto = obras.reduce((s, o) => s + (o.gasto || 0), 0);
  const ativos = trabs.filter(t => t.ativo).length;
  const hoje = window.getTodayBR?.() || new Date().toISOString().split("T")[0];
  const presencaHoje = (db.presenca || []).filter(p => p.data === hoje);
  const presentes = presencaHoje.filter(p => p.status === "presente").length;
  const criticas = tareas.filter(t => t.prioridade === "critica" && t.status !== "concluida").length;
  const baixoEstoque = estq.filter(e => e.quantidade <= e.minimo).length;
  const pendentes = finan.filter(f => f.status === "pendente").length;

  let html = ruler("DASHBOARD GERAL");
  html += `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">`;
  html += statBox("Obras Ativas", obras.filter(o => o.status === "em_andamento").length, C.blue);
  html += statBox("Orçamento Total", fmt.brl(totalOrc), C.text, `Gasto: ${fmt.pct(totalGasto, totalOrc)}`);
  html += statBox("Trabalhadores", ativos, C.green, "ativos hoje");
  html += statBox("Presença Hoje", `${presentes}/${presencaHoje.length}`, C.cyan);
  html += statBox("Tarefas Críticas", criticas, criticas > 0 ? C.red : C.green);
  html += statBox("Estoque Crítico", baixoEstoque, baixoEstoque > 0 ? C.orange : C.green);
  html += `</div>`;

  html += ruler("OBRAS EM ANDAMENTO");
  obras.filter(o => o.status === "em_andamento").forEach(o => {
    const pct = (o.gasto / o.orcamento * 100).toFixed(1);
    html += `<div style="margin-bottom:14px;padding-left:8px;border-left:2px solid ${C.border2}">`;
    html += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">`;
    html += `<span style="color:${C.accent};font-size:12px;font-weight:700;">${o.id}</span>`;
    html += `<span style="color:${C.text};font-size:13px;">${o.nome}</span>`;
    html += tag(C.blue, "EM ANDAMENTO");
    html += `</div>`;
    html += `<div style="display:flex;align-items:center;gap:8px;font-size:11px;color:${C.dim}">`;
    html += `<span>${fmt.brl(o.gasto)} / ${fmt.brl(o.orcamento)}</span>`;
    const barPct = Math.min(100, (o.gasto / o.orcamento) * 100);
    const barColor = o.gasto / o.orcamento > 0.8 ? C.red : C.blue;
    html += `<div style="background:${C.dim2};height:4px;border-radius:2px;flex:1;overflow:hidden;"><div style="width:${barPct}%;height:100%;background:${barColor};border-radius:2px;"></div></div>`;
    html += `<span style="min-width:45px;">${pct}%</span>`;
    html += `</div></div>`;
  });

  html += ruler("ALERTAS DO SISTEMA");
  if (criticas > 0) html += `<div style="color:${C.red};font-size:12px;padding:3px 0;">⚠  ${criticas} tarefa(s) com prioridade CRÍTICA em aberto</div>`;
  if (baixoEstoque > 0) html += `<div style="color:${C.orange};font-size:12px;padding:3px 0;">⚠  ${baixoEstoque} item(ns) de estoque abaixo do mínimo</div>`;
  if (pendentes > 0) html += `<div style="color:${C.orange};font-size:12px;padding:3px 0;">⚠  ${pendentes} pagamento(s) pendentes</div>`;
  if (criticas === 0 && baixoEstoque === 0 && pendentes === 0) html += `<div style="color:${C.green};font-size:12px;">✓  Sem alertas críticos no momento</div>`;

  return html;
}

function renderObras(args) {
  const db = getDB();
  const obras = db.obras || [];

  if (args[0] && args[0].startsWith("OB")) {
    const o = obras.find(x => x.id === args[0].toUpperCase());
    if (!o) return `<div style="color:${C.red};font-size:12px;">Obra não encontrada: ${args[0]}</div>`;
    const trabs = (db.trabalhadores || []).filter(t => t.obra === o.id);
    const tks = (db.tarefas || []).filter(t => t.obra === o.id);

    let html = ruler(`OBRA ${o.id}`);
    html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Nome</span><span style="color:${C.text};font-size:12px;">${o.nome}</span></div>`;
    html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Status</span>${tag(C.blue, o.status.toUpperCase().replace("_", " "))}</div>`;
    html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Responsável</span><span style="color:${C.text};font-size:12px;">${o.responsavel || "—"}</span></div>`;
    html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Início</span><span style="color:${C.text};font-size:12px;">${o.inicio || "—"}</span></div>`;
    html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Previsão Término</span><span style="color:${C.text};font-size:12px;">${o.previsao || "—"}</span></div>`;
    html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Orçamento</span><span style="color:${C.accent};font-size:12px;">${fmt.brl(o.orcamento)}</span></div>`;
    html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Gasto</span><span style="color:${o.gasto / o.orcamento > 0.8 ? C.red : C.green};font-size:12px;">${fmt.brl(o.gasto)}</span></div>`;

    html += `<div style="margin-top:14px;">${ruler("TRABALHADORES")}`;
    trabs.forEach(t => {
      html += `<div style="font-size:12px;padding:2px 0;color:${t.ativo ? C.text : C.dim}">${t.ativo ? "●" : "○"} ${t.nome} — ${t.funcao} — ${fmt.brl(t.diaria)}/dia</div>`;
    });
    html += `</div>`;

    html += `<div style="margin-top:14px;">${ruler("TAREFAS")}`;
    tks.forEach(t => {
      const sc = STATUS_TK[t.status]?.[0] || C.dim;
      html += `<div style="font-size:12px;padding:2px 0;display:flex;gap:10px;">`;
      html += `<span style="color:${PRIO_TK[t.prioridade] || C.dim};min-width:8px;">◆</span>`;
      html += `<span style="color:${C.text};flex:1;">${t.titulo}</span>`;
      html += tag(sc, t.status.toUpperCase());
      html += `</div>`;
    });
    html += `</div>`;
    return html;
  }

  let html = ruler("OBRAS");
  html += `<table style="width:100%;border-collapse:collapse;font-size:12px;">`;
  html += `<thead><tr style="border-bottom:1px solid ${C.border};color:${C.dim};text-align:left;">`;
  ["ID", "NOME", "STATUS", "RESP", "ORÇAMENTO", "GASTO", "%"].forEach(h => {
    html += `<th style="padding:3px 10px 3px 0;letter-spacing:1;font-size:10px;">${h}</th>`;
  });
  html += `</tr></thead><tbody>`;

  obras.forEach(o => {
    const pct = (o.gasto / o.orcamento * 100).toFixed(0);
    html += `<tr style="border-bottom:1px solid ${C.border}">`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.dim}">${o.id}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.text}">${o.nome}</td>`;
    html += `<td style="padding:6px 10px 6px 0">${tag(C.blue, o.status.replace("_", " "))}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.dim}">${o.responsavel || "—"}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.text}">${fmt.brl(o.orcamento)}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${o.gasto / o.orcamento > 0.85 ? C.red : C.text}">${fmt.brl(o.gasto)}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${pct > 85 ? C.red : C.accent}">${pct}%</td>`;
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  html += `<div style="color:${C.dim};font-size:11px;margin-top:8px;">Dica: <span style="color:${C.accent}">obras OB001</span> para detalhes</div>`;
  return html;
}

function renderTrabalhadores(args) {
  const db = getDB();
  const trabs = db.trabalhadores || [];

  if (args[0] && args[0].startsWith("TR")) {
    const t = trabs.find(x => x.id === args[0].toUpperCase());
    if (!t) return `<div style="color:${C.red};font-size:12px;">Trabalhador não encontrado: ${args[0]}</div>`;
    const obra = (db.obras || []).find(o => o.id === t.obra);
    const ponto = (db.presenca || []).filter(p => p.trabalhador === t.nome);

    let html = ruler(`TRABALHADOR ${t.id}`);
    html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Nome</span><span style="color:${C.text};font-size:12px;">${t.nome}</span></div>`;
    html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Função</span><span style="color:${C.text};font-size:12px;">${t.funcao}</span></div>`;
    html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Obra</span><span style="color:${C.text};font-size:12px;">${t.obra} — ${obra?.nome || "?"}</span></div>`;
    html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Diária</span><span style="color:${C.accent};font-size:12px;">${fmt.brl(t.diaria)}</span></div>`;
    html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Status</span>${tag(t.ativo ? C.green : C.red, t.ativo ? "ATIVO" : "INATIVO")}</div>`;

    if (ponto.length > 0) {
      html += `<div style="margin-top:12px;">${ruler("REGISTROS DE PONTO")}`;
      ponto.forEach(p => {
        html += `<div style="font-size:12px;padding:2px 0;color:${p.status === "falta" ? C.red : C.text}">${p.data}  ${p.entrada} → ${p.saida}  ${p.horas > 0 ? `(${p.horas}h)` : "FALTA"}</div>`;
      });
      html += `</div>`;
    }
    return html;
  }

  let html = ruler("TRABALHADORES");
  html += `<table style="width:100%;border-collapse:collapse;font-size:12px;">`;
  html += `<thead><tr style="border-bottom:1px solid ${C.border};color:${C.dim};text-align:left;">`;
  ["ID", "NOME", "FUNÇÃO", "OBRA", "DIÁRIA", "STATUS"].forEach(h => {
    html += `<th style="padding:3px 10px 3px 0;letter-spacing:1;font-size:10px;">${h}</th>`;
  });
  html += `</tr></thead><tbody>`;

  trabs.forEach(t => {
    html += `<tr style="border-bottom:1px solid ${C.border}">`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.dim}">${t.id}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.text}">${t.nome}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.dim}">${t.funcao}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.dim}">${t.obra}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.accent}">${fmt.brl(t.diaria)}</td>`;
    html += `<td style="padding:6px 10px 6px 0">${tag(t.ativo ? C.green : C.red, t.ativo ? "ATIVO" : "INATIVO")}</td>`;
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  return html;
}

function renderPresenca() {
  const db = getDB();
  const hoje = window.getTodayBR?.() || new Date().toISOString().split("T")[0];
  const presencaHoje = (db.presenca || []).filter(p => p.data === hoje);
  const presentes = presencaHoje.filter(p => p.status === "presente").length;
  const faltas = presencaHoje.filter(p => p.status === "falta").length;
  const parcial = presencaHoje.filter(p => p.status === "meio_dia").length;

  let html = ruler(`PRESENÇA / PONTO — ${hoje}`);
  html += `<div style="display:flex;gap:8px;margin-bottom:16px;">`;
  html += statBox("Presentes", presentes, C.green);
  html += statBox("Faltas", faltas, C.red);
  html += statBox("Meio Dia", parcial, C.orange);
  html += statBox("Total", presencaHoje.length, C.text);
  html += `</div>`;

  html += `<table style="width:100%;border-collapse:collapse;font-size:12px;">`;
  html += `<thead><tr style="border-bottom:1px solid ${C.border};color:${C.dim};text-align:left;">`;
  ["TRABALHADOR", "OBRA", "ENTRADA", "SAÍDA", "HORAS", "STATUS"].forEach(h => {
    html += `<th style="padding:3px 10px 3px 0;letter-spacing:1;font-size:10px;">${h}</th>`;
  });
  html += `</tr></thead><tbody>`;

  presencaHoje.forEach(p => {
    html += `<tr style="border-bottom:1px solid ${C.border}">`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.text}">${p.trabalhador}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.dim}">${p.obra}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${p.status === "falta" ? C.red : C.green}">${p.entrada}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${p.status === "falta" ? C.red : C.dim}">${p.saida}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.accent}">${p.horas > 0 ? p.horas + "h" : "—"}</td>`;
    const statusColor = p.status === "presente" ? C.green : p.status === "falta" ? C.red : C.orange;
    html += `<td style="padding:6px 10px 6px 0">${tag(statusColor, p.status.toUpperCase().replace("_", " "))}</td>`;
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  return html;
}

function renderTarefas(args) {
  const db = getDB();
  let lista = db.tarefas || [];
  const filtro = args[0];

  if (filtro) {
    if (filtro.startsWith("OB")) lista = lista.filter(t => t.obra === filtro.toUpperCase());
    else lista = lista.filter(t => t.prioridade === filtro || t.status === filtro);
  }

  let html = ruler(`TAREFAS${filtro ? ` — FILTRO: ${filtro.toUpperCase()}` : ""}`);
  if (lista.length === 0) html += `<div style="color:${C.dim};font-size:12px;">Nenhuma tarefa encontrada.</div>`;

  lista.forEach(t => {
    const sc = STATUS_TK[t.status]?.[0] || C.dim;
    html += `<div style="border-bottom:1px solid ${C.border};padding:8px 0;">`;
    html += `<div style="display:flex;gap:10px;align-items:center;margin-bottom:4px;">`;
    html += `<span style="color:${PRIO_TK[t.prioridade] || C.dim};font-size:10px;">◆ ${t.prioridade.toUpperCase()}</span>`;
    html += `<span style="color:${C.text};font-size:13px;">${t.titulo}</span>`;
    html += tag(sc, t.status.toUpperCase());
    html += `</div>`;
    html += `<div style="font-size:11px;color:${C.dim};display:flex;gap:16px;">`;
    html += `<span>Obra: ${t.obra}</span>`;
    html += `<span>Responsável: ${t.responsavel}</span>`;
    html += `<span>Prazo: ${t.prazo}</span>`;
    html += `</div></div>`;
  });

  html += `<div style="color:${C.dim};font-size:11px;margin-top:8px;">Filtros: <span style="color:${C.accent}">tarefas critica | tarefas OB001</span></div>`;
  return html;
}

function renderEstoque(args) {
  const db = getDB();
  let lista = db.estoque || [];
  if (args[0] === "critico") lista = lista.filter(e => e.quantidade <= e.minimo);

  let html = ruler(`ESTOQUE${args[0] ? ` — ${args[0].toUpperCase()}` : ""}`);
  html += `<table style="width:100%;border-collapse:collapse;font-size:12px;">`;
  html += `<thead><tr style="border-bottom:1px solid ${C.border};color:${C.dim};text-align:left;">`;
  ["ITEM", "UN", "QTD", "MÍN", "CUSTO", "TOTAL", "OBRA", "ALERTA"].forEach(h => {
    html += `<th style="padding:3px 10px 3px 0;letter-spacing:1;font-size:10px;">${h}</th>`;
  });
  html += `</tr></thead><tbody>`;

  lista.forEach(e => {
    const critico = e.quantidade <= e.minimo;
    html += `<tr style="border-bottom:1px solid ${C.border}">`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.text}">${e.item}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.dim}">${e.unidade}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${critico ? C.red : C.green};font-weight:${critico ? 700 : 400}">${e.quantidade}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.dim}">${e.minimo}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.text}">${fmt.brl(e.custo)}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.accent}">${fmt.brl(e.quantidade * e.custo)}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.dim}">${e.obra}</td>`;
    html += `<td style="padding:6px 10px 6px 0">${critico ? tag(C.red, "⚠ BAIXO") : `<span style="color:${C.green}">✓</span>`}</td>`;
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  html += `<div style="color:${C.dim};font-size:11px;margin-top:8px;">Filtro: <span style="color:${C.accent}">estoque critico</span></div>`;
  return html;
}

function renderFinanceiro(args) {
  const db = getDB();
  let lista = db.financeiro || [];
  if (args[0] === "pendente") lista = lista.filter(f => f.status === "pendente");
  if (args[0] === "entrada") lista = lista.filter(f => f.tipo === "entrada");
  if (args[0] === "saida") lista = lista.filter(f => f.tipo === "saida");

  const totalEntrada = lista.filter(f => f.tipo === "entrada").reduce((s, f) => s + f.valor, 0);
  const totalSaida = lista.filter(f => f.tipo === "saida").reduce((s, f) => s + f.valor, 0);
  const saldo = totalEntrada - totalSaida;

  let html = ruler(`FINANCEIRO${args[0] ? ` — ${args[0].toUpperCase()}` : ""}`);
  html += `<div style="display:flex;gap:8px;margin-bottom:16px;">`;
  html += statBox("Entradas", fmt.brl(totalEntrada), C.green);
  html += statBox("Saídas", fmt.brl(totalSaida), C.red);
  html += statBox("Saldo", fmt.brl(saldo), saldo >= 0 ? C.green : C.red);
  html += `</div>`;

  html += `<table style="width:100%;border-collapse:collapse;font-size:12px;">`;
  html += `<thead><tr style="border-bottom:1px solid ${C.border};color:${C.dim};text-align:left;">`;
  ["DATA", "DESCRIÇÃO", "TIPO", "CAT", "VALOR", "OBRA", "STATUS"].forEach(h => {
    html += `<th style="padding:3px 10px 3px 0;letter-spacing:1;font-size:10px;">${h}</th>`;
  });
  html += `</tr></thead><tbody>`;

  lista.forEach(f => {
    html += `<tr style="border-bottom:1px solid ${C.border}">`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.dim}">${f.data}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.text}">${f.descricao}</td>`;
    html += `<td style="padding:6px 10px 6px 0">${tag(f.tipo === "entrada" ? C.green : C.red, f.tipo.toUpperCase())}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.dim}">${f.categoria}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${f.tipo === "entrada" ? C.green : C.red};font-weight:700">${f.tipo === "saida" ? "-" : "+"}${fmt.brl(f.valor)}</td>`;
    html += `<td style="padding:6px 10px 6px 0;color:${C.dim}">${f.obra}</td>`;
    html += `<td style="padding:6px 10px 6px 0">${tag(C.green, f.status.toUpperCase())}</td>`;
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  return html;
}

function renderRelatorios() {
  const db = getDB();
  const obras = db.obras || [];
  const trabs = db.trabalhadores || [];
  const tareas = db.tarefas || [];
  const estq = db.estoque || [];
  const finan = db.financeiro || [];

  const totalOrc = obras.reduce((s, o) => s + (o.orcamento || 0), 0);
  const totalGasto = obras.reduce((s, o) => s + (o.gasto || 0), 0);
  const totalEntrada = finan.filter(f => f.tipo === "entrada").reduce((s, f) => s + f.valor, 0);
  const totalSaida = finan.filter(f => f.tipo === "saida").reduce((s, f) => s + f.valor, 0);

  let html = ruler("RELATÓRIOS GERENCIAIS");
  html += ruler("RESUMO FINANCEIRO");
  html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Orçamento total</span><span style="color:${C.text};font-size:12px;">${fmt.brl(totalOrc)}</span></div>`;
  html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Total gasto em obras</span><span style="color:${C.red};font-size:12px;">${fmt.brl(totalGasto)}</span></div>`;
  html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Disponível</span><span style="color:${C.green};font-size:12px;">${fmt.brl(totalOrc - totalGasto)}</span></div>`;
  html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Entradas no período</span><span style="color:${C.green};font-size:12px;">${fmt.brl(totalEntrada)}</span></div>`;
  html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Saídas no período</span><span style="color:${C.red};font-size:12px;">${fmt.brl(totalSaida)}</span></div>`;
  html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Saldo fluxo</span><span style="color:${totalEntrada > totalSaida ? C.green : C.red};font-size:12px;">${fmt.brl(totalEntrada - totalSaida)}</span></div>`;

  html += ruler("RESUMO OPERACIONAL");
  html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Total de obras</span><span style="color:${C.text};font-size:12px;">${obras.length}</span></div>`;
  html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Obras em andamento</span><span style="color:${C.blue};font-size:12px;">${obras.filter(o => o.status === "em_andamento").length}</span></div>`;
  html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Obras concluídas</span><span style="color:${C.green};font-size:12px;">${obras.filter(o => o.status === "concluida").length}</span></div>`;
  html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min_width:160px;font-size:12px;">Trabalhadores ativos</span><span style="color:${C.cyan};font-size:12px;">${trabs.filter(t => t.ativo).length}</span></div>`;
  html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Tarefas abertas</span><span style="color:${C.text};font-size:12px;">${tareas.filter(t => t.status !== "concluida").length}</span></div>`;
  html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Tarefas críticas</span><span style="color:${C.red};font-size:12px;">${tareas.filter(t => t.prioridade === "critica" && t.status !== "concluida").length}</span></div>`;
  html += `<div style="display:flex;gap:12px;padding:3px 0;"><span style="color:${C.dim};min-width:160px;font-size:12px;">Estoque abaixo mínimo</span><span style="color:${C.orange};font-size:12px;">${estq.filter(e => e.quantidade <= e.minimo).length}</span></div>`;

  return html;
}

function renderHelp() {
  let html = ruler("NAVEGAÇÃO");
  const cmds = [
    ["dashboard", "Visão geral — obras, alertas, KPIs"],
    ["obras", "Lista todas as obras"],
    ["obras OB001", "Detalha uma obra específica"],
    ["trabalhadores", "Lista trabalhadores"],
    ["presenca", "Ponto do dia atual"],
    ["tarefas", "Lista tarefas"],
    ["estoque", "Lista estoque"],
    ["estoque critico", "Itens abaixo do mínimo"],
    ["financeiro", "Lançamentos financeiros"],
    ["relatorios", "Relatório gerencial consolidado"],
  ];
  cmds.forEach(([cmd, desc]) => {
    html += `<div style="display:flex;gap:12px;padding:2px 0;font-size:12px;">`;
    html += `<span style="color:${C.accent};min-width:220px;font-family:monospace;">${cmd}</span>`;
    html += `<span style="color:${C.dim};">${desc}</span>`;
    html += `</div>`;
  });
  html += ruler("TERMINAL");
  html += `<div style="display:flex;gap:12px;padding:2px 0;font-size:12px;"><span style="color:${C.accent};min-width:220px;font-family:monospace;">clear</span><span style="color:${C.dim};">Limpa o terminal</span></div>`;
  html += `<div style="display:flex;gap:12px;padding:2px 0;font-size:12px;"><span style="color:${C.accent};min-width:220px;font-family:monospace;">help</span><span style="color:${C.dim};">Esta ajuda</span></div>`;
  html += `<div style="color:${C.dim};font-size:11px;margin-top:12px;">Atalhos: ↑↓ histórico · Tab autocomplete</div>`;
  return html;
}

function resolveConsoleCommand(cmd) {
  const parts = cmd.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (command === "dashboard") return renderDashboard();
  if (command === "obras") return renderObras(args);
  if (command === "trabalhadores") return renderTrabalhadores(args);
  if (command === "presenca") return renderPresenca();
  if (command === "tarefas") return renderTarefas(args);
  if (command === "estoque") return renderEstoque(args);
  if (command === "financeiro") return renderFinanceiro(args);
  if (command === "relatorios") return renderRelatorios();
  if (command === "help") return renderHelp();
  return null;
}

function renderConsole() {
  const container = document.getElementById("console-container");
  if (!container) return;

  const db = getDB();
  const obrasAtivas = (db.obras || []).filter(o => o.status === "em_andamento").length;
  const trabsAtivos = (db.trabalhadores || []).filter(t => t.ativo).length;
  const tarefasCriticas = (db.tarefas || []).filter(t => t.prioridade === "critica" && t.status !== "concluida").length;
  const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  container.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
      #console-container { background: ${C.bg}; min-height: 100vh; font-family: 'JetBrains Mono', monospace; color: ${C.text}; }
      .console-input { background: transparent; border: none; outline: none; color: #f1f5f9; font-family: inherit; font-size: 13px; font-weight: 600; caret-color: ${C.accent}; }
      .cmd-block { animation: fadeUp 0.18s ease both; }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      .cursor { animation: blink 1s infinite; color: ${C.accent}; }
      ::-webkit-scrollbar { width: 3px; }
      ::-webkit-scrollbar-thumb { background: ${C.border2}; border-radius: 2px; }
    </style>

    <div style="background:${C.panel};border-bottom:1px solid ${C.border};padding:8px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:10;">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="display:flex;gap:5px;">
          <div style="width:9px;height:9px;border-radius:50%;background:${C.red};opacity:0.7"></div>
          <div style="width:9px;height:9px;border-radius:50%;background:${C.accent};opacity:0.7"></div>
          <div style="width:9px;height:9px;border-radius:50%;background:${C.green};opacity:0.7"></div>
        </div>
        <span style="color:${C.accent};font-size:12px;letter-spacing:4;font-weight:700;">GESTÃO DE OBRAS</span>
        <span style="color:${C.border2};font-size:12px;">/</span>
        <span style="color:${C.dim};font-size:10px;letter-spacing:2;">CONSOLE</span>
      </div>
      <div style="display:flex;gap:20px;font-size:10px;color:${C.dim};align-items:center;">
        <span>OBRAS <span style="color:${C.blue}">${obrasAtivas}</span></span>
        <span>TRABALHADORES <span style="color:${C.cyan}">${trabsAtivos}</span></span>
        <span>TAREFAS CRÍTICAS <span style="color:${tarefasCriticas > 0 ? C.red : C.green}">${tarefasCriticas}</span></span>
        <span style="color:${C.border2}">|</span>
        <span style="color:#333">${now}</span>
      </div>
    </div>

    <div style="flex:1;overflow-y:auto;padding:20px 28px;max-height:calc(100vh - 88px);" id="console-body">
      ${consoleBooted ? `
        <div style="margin-bottom:22px;">
          <div style="color:${C.border2};font-size:10px;margin-bottom:8px;">${"─".repeat(70)}</div>
          <div style="color:${C.accent};font-size:15px;font-weight:700;line-height:1.7;">Gestão de Obras v1.1.0</div>
          <div style="color:${C.dim};font-size:11px;line-height:1.7;">Firebase Realtime DB · Dados Reais</div>
          <div style="color:#555;font-size:11px;line-height:1.7;">Digite "help" para ver todos os módulos disponíveis.</div>
          <div style="color:${C.border2};font-size:10px;margin-top:8px;">${"─".repeat(70)}</div>
        </div>
      ` : ''}

      ${consoleHistory.map((item, i) => `
        <div class="cmd-block" style="margin-bottom:20px;">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
            <span style="color:${C.green};font-size:11px;">obra@real</span>
            <span style="color:${C.border2};font-size:11px;">:</span>
            <span style="color:${C.blue};font-size:11px;">~</span>
            <span style="color:${C.text};font-size:11px;">$</span>
            <span style="color:#e2e8f0;font-size:13px;font-weight:600;">${item.cmd}</span>
          </div>
          <div style="padding-left:16px;border-left:2px solid ${C.border};">${item.output}</div>
        </div>
      `).join('')}

      <div id="console-bottom"></div>
    </div>

    <div style="background:${C.panel};border-top:1px solid ${C.border};padding:0 28px;position:sticky;bottom:0;">
      <div style="display:flex;align-items:center;gap:8px;padding:12px 0;">
        <span style="color:${C.green};font-size:12px;white-space:nowrap;">obra@real</span>
        <span style="color:${C.border2};font-size:12px;">:</span>
        <span style="color:${C.blue};font-size:12px;">~</span>
        <span style="color:${C.text};font-size:12px;">$</span>
        <input type="text" id="console-input" class="console-input" placeholder="módulo [argumento] — ex: obras OB001" style="flex:1;" autofocus>
        <span class="cursor">█</span>
      </div>
    </div>
  `;

  const input = document.getElementById("console-input");
  if (input) {
    input.addEventListener("keydown", handleConsoleKey);
    input.focus();
  }
}

function handleConsoleKey(e) {
  if (e.key === "Enter") {
    const input = e.target;
    const cmd = input.value.trim();
    if (!cmd) return;

    if (cmd.toLowerCase() === "clear") {
      consoleHistory = [];
      consoleInput = "";
      renderConsole();
      return;
    }

    const output = resolveConsoleCommand(cmd);
    const isUnknown = output === null;

    cmdHistory.unshift(cmd);
    if (cmdHistory.length > 50) cmdHistory.pop();
    cmdIdx = -1;

    consoleHistory.push({
      cmd,
      output: isUnknown
        ? `<span style="color:${C.red};font-size:12px;">Módulo não encontrado: "${cmd}". Digite "help".</span>`
        : output
    });
    consoleInput = "";
    input.value = "";

    renderConsole();
    setTimeout(() => {
      const bottom = document.getElementById("console-bottom");
      if (bottom) bottom.scrollIntoView({ behavior: "smooth" });
    }, 50);
    return;
  }

  if (e.key === "ArrowUp") {
    e.preventDefault();
    const idx = Math.min(cmdIdx + 1, cmdHistory.length - 1);
    cmdIdx = idx;
    e.target.value = cmdHistory[idx] || "";
    return;
  }

  if (e.key === "ArrowDown") {
    e.preventDefault();
    const idx = Math.max(cmdIdx - 1, -1);
    cmdIdx = idx;
    e.target.value = idx >= 0 ? cmdHistory[idx] : "";
    return;
  }

  if (e.key === "Tab") {
    e.preventDefault();
    const v = e.target.value.toLowerCase();
    const matches = ALL_CMDS.filter(c => c.startsWith(v) && c !== v);
    if (matches.length === 1) {
      e.target.value = matches[0];
    } else if (matches.length > 1) {
      console.log("Matches:", matches);
    }
    return;
  }

  if (e.ctrlKey && e.key === "l") {
    e.preventDefault();
    consoleHistory = [];
    renderConsole();
    return;
  }
}

window.renderConsole = renderConsole;
window.initConsole = function() {
  consoleBooted = true;
  renderConsole();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(window.initConsole, 600));
} else {
  setTimeout(window.initConsole, 600);
}