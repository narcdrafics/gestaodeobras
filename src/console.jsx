import { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";

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

const STATUS_OBRA = { em_andamento: ["EM ANDAMENTO"], pausada: ["PAUSADA"], concluida: ["CONCLUÍDA"], projeto: ["PROJETO"] };
const STATUS_TK = { pendente: ["PENDENTE"], em_andamento: ["ANDAMENTO"], concluida: ["CONCLUÍDA"], bloqueada: ["BLOQUEADA"] };
const PRIO_TK = { critica: "#f87171", alta: "#fb923c", media: "#f59e0b", baixa: "#4a5568" };
const STATUS_FN = { pago: "PAGO", pendente: "PENDENTE", recebimento: "RECEBIDO" };

const ALL_CMDS = ["dashboard", "obras", "trabalhadores", "presenca", "tarefas", "estoque", "financeiro", "relatorios", "help", "clear"];

function Ruler({ label }) {
  return (
    <div style={{ color: C.dim, fontSize: 10, letterSpacing: 3, marginBottom: 10, marginTop: 2 }}>
      ── {label} {"─".repeat(Math.max(0, 52 - (label?.length || 0)))}
    </div>
  );
}

function Tag({ color, children }) {
  return (
    <span style={{
      color, border: `1px solid ${color}`, borderRadius: 2,
      padding: "1px 6px", fontSize: 10, letterSpacing: 1.5, fontWeight: 700,
    }}>{children}</span>
  );
}

function StatBox({ label, value, color = C.text, sub = "" }) {
  return (
    <div style={{ border: `1px solid ${C.border2}`, padding: "10px 14px", background: C.panel, minWidth: 130 }}>
      <div style={{ fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.dim, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Bar({ value, max, color }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ background: C.dim2, height: 4, borderRadius: 2, flex: 1, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color || C.accent, borderRadius: 2, transition: "width 0.6s ease" }} />
    </div>
  );
}

function useDB() {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkDB = setInterval(() => {
      if (window.DB) {
        setDb(window.DB);
        setLoading(false);
        clearInterval(checkDB);
      }
    }, 200);
    return () => clearInterval(checkDB);
  }, []);

  return { db, loading };
}

function Dashboard({ db }) {
  if (!db) return <div style={{ color: C.dim }}>Carregando dados...</div>;

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

  return (
    <div>
      <Ruler label="DASHBOARD GERAL" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        <StatBox label="Obras Ativas" value={obras.filter(o => o.status === "em_andamento").length} color={C.blue} />
        <StatBox label="Orçamento Total" value={fmt.brl(totalOrc)} color={C.text} sub={`Gasto: ${fmt.pct(totalGasto, totalOrc)}`} />
        <StatBox label="Trabalhadores" value={ativos} color={C.green} sub="ativos hoje" />
        <StatBox label="Presença Hoje" value={`${presentes}/${presencaHoje.length}`} color={C.cyan} />
        <StatBox label="Tarefas Críticas" value={criticas} color={criticas > 0 ? C.red : C.green} />
        <StatBox label="Estoque Crítico" value={baixoEstoque} color={baixoEstoque > 0 ? C.orange : C.green} />
      </div>

      <Ruler label="OBRAS EM ANDAMENTO" />
      {obras.filter(o => o.status === "em_andamento").map(o => (
        <div key={o.id} style={{ marginBottom: 14, paddingLeft: 8, borderLeft: `2px solid ${C.border2}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ color: C.accent, fontSize: 12, fontWeight: 700 }}>{o.id}</span>
            <span style={{ color: C.text, fontSize: 13 }}>{o.nome}</span>
            <Tag color={C.blue}>EM ANDAMENTO</Tag>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: C.dim }}>
            <span>{fmt.brl(o.gasto)} / {fmt.brl(o.orcamento)}</span>
            <Bar value={o.gasto} max={o.orcamento} color={o.gasto / o.orcamento > 0.8 ? C.red : C.blue} />
            <span style={{ minWidth: 45 }}>{fmt.pct(o.gasto, o.orcamento)}</span>
          </div>
        </div>
      ))}

      <Ruler label="ALERTAS DO SISTEMA" />
      {criticas > 0 && <div style={{ color: C.red, fontSize: 12, padding: "3px 0" }}>⚠  {criticas} tarefa(s) com prioridade CRÍTICA em aberto</div>}
      {baixoEstoque > 0 && <div style={{ color: C.orange, fontSize: 12, padding: "3px 0" }}>⚠  {baixoEstoque} item(ns) de estoque abaixo do mínimo</div>}
      {pendentes > 0 && <div style={{ color: C.orange, fontSize: 12, padding: "3px 0" }}>⚠  {pendentes} pagamento(s) pendentes</div>}
      {criticas === 0 && baixoEstoque === 0 && pendentes === 0 && <div style={{ color: C.green, fontSize: 12 }}>✓  Sem alertas críticos no momento</div>}
    </div>
  );
}

function Obras({ db, args }) {
  if (!db) return <div style={{ color: C.dim }}>Carregando...</div>;

  const obras = db.obras || [];

  if (args[0] && args[0].startsWith("OB")) {
    const o = obras.find(x => x.id === args[0].toUpperCase());
    if (!o) return <div style={{ color: C.red, fontSize: 12 }}>Obra não encontrada: {args[0]}</div>;
    const trabsObra = (db.trabalhadores || []).filter(t => t.obra === o.id);
    const tksObra = (db.tarefas || []).filter(t => t.obra === o.id);

    return (
      <div>
        <Ruler label={`OBRA ${o.id}`} />
        <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Nome</span><span style={{ color: C.text, fontSize: 12 }}>{o.nome}</span></div>
        <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Status</span><Tag color={C.blue}>{o.status?.toUpperCase().replace("_", " ")}</Tag></div>
        <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Responsável</span><span style={{ color: C.text, fontSize: 12 }}>{o.responsavel || "—"}</span></div>
        <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Início</span><span style={{ color: C.text, fontSize: 12 }}>{o.inicio || "—"}</span></div>
        <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Previsão Término</span><span style={{ color: C.text, fontSize: 12 }}>{o.previsao || "—"}</span></div>
        <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Orçamento</span><span style={{ color: C.accent, fontSize: 12 }}>{fmt.brl(o.orcamento)}</span></div>
        <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Gasto</span><span style={{ color: o.gasto / o.orcamento > 0.8 ? C.red : C.green, fontSize: 12 }}>{fmt.brl(o.gasto)}</span></div>

        <div style={{ marginTop: 14 }}>
          <Ruler label="TRABALHADORES" />
          {trabsObra.map(t => (
            <div key={t.id} style={{ fontSize: 12, color: t.ativo ? C.text : C.dim, padding: "2px 0" }}>
              {t.ativo ? "●" : "○"} {t.nome} — {t.funcao} — {fmt.brl(t.diaria)}/dia
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <Ruler label="TAREFAS" />
          {tksObra.map(t => (
            <div key={t.id} style={{ fontSize: 12, padding: "2px 0", display: "flex", gap: 10 }}>
              <span style={{ color: PRIO_TK[t.prioridade] || C.dim, minWidth: 8 }}>◆</span>
              <span style={{ color: C.text, flex: 1 }}>{t.titulo}</span>
              <Tag color={STATUS_TK[t.status]?.[1] ? C.blue : C.dim}>{t.status?.toUpperCase()}</Tag>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Ruler label="OBRAS" />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.dim, textAlign: "left" }}>
            {["ID", "NOME", "STATUS", "RESP", "ORÇAMENTO", "GASTO", "%"].map(h => (
              <th key={h} style={{ padding: "3px 10px 3px 0", letterSpacing: 1, fontSize: 10 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {obras.map(o => {
            const pct = (o.gasto / o.orcamento * 100).toFixed(0);
            return (
              <tr key={o.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{o.id}</td>
                <td style={{ padding: "6px 10px 6px 0", color: C.text }}>{o.nome}</td>
                <td style={{ padding: "6px 10px 6px 0" }}><Tag color={C.blue}>{o.status?.replace("_", " ")}</Tag></td>
                <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{o.responsavel || "—"}</td>
                <td style={{ padding: "6px 10px 6px 0", color: C.text }}>{fmt.brl(o.orcamento)}</td>
                <td style={{ padding: "6px 10px 6px 0", color: o.gasto / o.orcamento > 0.85 ? C.red : C.text }}>{fmt.brl(o.gasto)}</td>
                <td style={{ padding: "6px 10px 6px 0", color: pct > 85 ? C.red : C.accent }}>{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ color: C.dim, fontSize: 11, marginTop: 8 }}>Dica: <span style={{ color: C.accent }}>obras OB001</span> para detalhes</div>
    </div>
  );
}

function Trabalhadores({ db, args }) {
  if (!db) return <div style={{ color: C.dim }}>Carregando...</div>;

  const trabs = db.trabalhadores || [];

  if (args[0] && args[0].startsWith("TR")) {
    const t = trabs.find(x => x.id === args[0].toUpperCase());
    if (!t) return <div style={{ color: C.red, fontSize: 12 }}>Trabalhador não encontrado: {args[0]}</div>;
    const obra = (db.obras || []).find(o => o.id === t.obra);
    const ponto = (db.presenca || []).filter(p => p.trabalhador === t.nome);

    return (
      <div>
        <Ruler label={`TRABALHADOR ${t.id}`} />
        <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Nome</span><span style={{ color: C.text, fontSize: 12 }}>{t.nome}</span></div>
        <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Função</span><span style={{ color: C.text, fontSize: 12 }}>{t.funcao}</span></div>
        <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Obra</span><span style={{ color: C.text, fontSize: 12 }}>{t.obra} — {obra?.nome || "?"}</span></div>
        <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Diária</span><span style={{ color: C.accent, fontSize: 12 }}>{fmt.brl(t.diaria)}</span></div>
        <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Status</span><Tag color={t.ativo ? C.green : C.red}>{t.ativo ? "ATIVO" : "INATIVO"}</Tag></div>
        {ponto.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Ruler label="REGISTROS DE PONTO" />
            {ponto.map(p => (
              <div key={p.id} style={{ fontSize: 12, padding: "2px 0", color: p.status === "falta" ? C.red : C.text }}>
                {p.data}  {p.entrada} → {p.saida}  {p.horas > 0 ? `(${p.horas}h)` : "FALTA"}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <Ruler label="TRABALHADORES" />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.dim, textAlign: "left" }}>
            {["ID", "NOME", "FUNÇÃO", "OBRA", "DIÁRIA", "STATUS"].map(h => (
              <th key={h} style={{ padding: "3px 10px 3px 0", letterSpacing: 1, fontSize: 10 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trabs.map(t => (
            <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{t.id}</td>
              <td style={{ padding: "6px 10px 6px 0", color: C.text }}>{t.nome}</td>
              <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{t.funcao}</td>
              <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{t.obra}</td>
              <td style={{ padding: "6px 10px 6px 0", color: C.accent }}>{fmt.brl(t.diaria)}</td>
              <td style={{ padding: "6px 10px 6px 0" }}><Tag color={t.ativo ? C.green : C.red}>{t.ativo ? "ATIVO" : "INATIVO"}</Tag></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Presenca({ db }) {
  if (!db) return <div style={{ color: C.dim }}>Carregando...</div>;

  const hoje = window.getTodayBR?.() || new Date().toISOString().split("T")[0];
  const presencaHoje = (db.presenca || []).filter(p => p.data === hoje);
  const presentes = presencaToday?.filter(p => p.status === "presente").length || 0;
  const faltas = presencaToday?.filter(p => p.status === "falta").length || 0;
  const parcial = presencaToday?.filter(p => p.status === "meio_dia").length || 0;

  return (
    <div>
      <Ruler label={`PRESENÇA / PONTO — ${hoje}`} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <StatBox label="Presentes" value={presentes} color={C.green} />
        <StatBox label="Faltas" value={faltas} color={C.red} />
        <StatBox label="Meio Dia" value={parcial} color={C.orange} />
        <StatBox label="Total" value={presencaHoje?.length || 0} color={C.text} />
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.dim, textAlign: "left" }}>
            {["TRABALHADOR", "OBRA", "ENTRADA", "SAÍDA", "HORAS", "STATUS"].map(h => (
              <th key={h} style={{ padding: "3px 10px 3px 0", letterSpacing: 1, fontSize: 10 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {presencaHoje?.map(p => (
            <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: "6px 10px 6px 0", color: C.text }}>{p.trabalhador}</td>
              <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{p.obra}</td>
              <td style={{ padding: "6px 10px 6px 0", color: p.status === "falta" ? C.red : C.green }}>{p.entrada}</td>
              <td style={{ padding: "6px 10px 6px 0", color: p.status === "falta" ? C.red : C.dim }}>{p.saida}</td>
              <td style={{ padding: "6px 10px 6px 0", color: C.accent }}>{p.horas > 0 ? p.horas + "h" : "—"}</td>
              <td style={{ padding: "6px 10px 6px 0" }}>
                <Tag color={p.status === "presente" ? C.green : p.status === "falta" ? C.red : C.orange}>
                  {p.status?.toUpperCase().replace("_", " ")}
                </Tag>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tarefas({ db, args }) {
  if (!db) return <div style={{ color: C.dim }}>Carregando...</div>;

  let lista = db.tarefas || [];
  const filtro = args[0];

  if (filtro) {
    if (filtro.startsWith("OB")) lista = lista.filter(t => t.obra === filtro.toUpperCase());
    else lista = lista.filter(t => t.prioridade === filtro || t.status === filtro);
  }

  return (
    <div>
      <Ruler label={`TAREFAS${filtro ? ` — FILTRO: ${filtro.toUpperCase()}` : ""}`} />
      {lista.length === 0 && <div style={{ color: C.dim, fontSize: 12 }}>Nenhuma tarefa encontrada.</div>}
      {lista.map(t => (
        <div key={t.id} style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 0" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
            <span style={{ color: PRIO_TK[t.prioridade], fontSize: 10 }}>◆ {t.prioridade?.toUpperCase()}</span>
            <span style={{ color: C.text, fontSize: 13 }}>{t.titulo}</span>
            <Tag color={STATUS_TK[t.status]?.[1] ? C.blue : C.dim}>{t.status?.toUpperCase()}</Tag>
          </div>
          <div style={{ fontSize: 11, color: C.dim, display: "flex", gap: 16 }}>
            <span>Obra: {t.obra}</span>
            <span>Responsável: {t.responsavel}</span>
            <span>Prazo: {t.prazo}</span>
          </div>
        </div>
      ))}
      <div style={{ color: C.dim, fontSize: 11, marginTop: 8 }}>Filtros: <span style={{ color: C.accent }}>tarefas critica | tarefas OB001</span></div>
    </div>
  );
}

function Estoque({ db, args }) {
  if (!db) return <div style={{ color: C.dim }}>Carregando...</div>;

  let lista = db.estoque || [];
  if (args[0] === "critico") lista = lista.filter(e => e.quantidade <= e.minimo);

  return (
    <div>
      <Ruler label={`ESTOQUE${args[0] ? ` — ${args[0].toUpperCase()}` : ""}`} />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.dim, textAlign: "left" }}>
            {["ITEM", "UN", "QTD", "MÍN", "CUSTO", "TOTAL", "OBRA", "ALERTA"].map(h => (
              <th key={h} style={{ padding: "3px 10px 3px 0", letterSpacing: 1, fontSize: 10 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lista.map(e => {
            const critico = e.quantidade <= e.minimo;
            return (
              <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "6px 10px 6px 0", color: C.text }}>{e.item}</td>
                <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{e.unidade}</td>
                <td style={{ padding: "6px 10px 6px 0", color: critico ? C.red : C.green, fontWeight: critico ? 700 : 400 }}>{e.quantidade}</td>
                <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{e.minimo}</td>
                <td style={{ padding: "6px 10px 6px 0", color: C.text }}>{fmt.brl(e.custo)}</td>
                <td style={{ padding: "6px 10px 6px 0", color: C.accent }}>{fmt.brl(e.quantidade * e.custo)}</td>
                <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{e.obra}</td>
                <td style={{ padding: "6px 10px 6px 0" }}>{critico ? <Tag color={C.red}>⚠ BAIXO</Tag> : <span style={{ color: C.green }}>✓</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ color: C.dim, fontSize: 11, marginTop: 8 }}>Filtro: <span style={{ color: C.accent }}>estoque critico</span></div>
    </div>
  );
}

function Financeiro({ db, args }) {
  if (!db) return <div style={{ color: C.dim }}>Carregando...</div>;

  let lista = db.financeiro || [];
  if (args[0] === "pendente") lista = lista.filter(f => f.status === "pendente");
  if (args[0] === "entrada") lista = lista.filter(f => f.tipo === "entrada");
  if (args[0] === "saida") lista = lista.filter(f => f.tipo === "saida");

  const totalEntrada = lista.filter(f => f.tipo === "entrada").reduce((s, f) => s + f.valor, 0);
  const totalSaida = lista.filter(f => f.tipo === "saida").reduce((s, f) => s + f.valor, 0);
  const saldo = totalEntrada - totalSaida;

  return (
    <div>
      <Ruler label={`FINANCEIRO${args[0] ? ` — ${args[0].toUpperCase()}` : ""}`} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <StatBox label="Entradas" value={fmt.brl(totalEntrada)} color={C.green} />
        <StatBox label="Saídas" value={fmt.brl(totalSaida)} color={C.red} />
        <StatBox label="Saldo" value={fmt.brl(saldo)} color={saldo >= 0 ? C.green : C.red} />
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.dim, textAlign: "left" }}>
            {["DATA", "DESCRIÇÃO", "TIPO", "CAT", "VALOR", "OBRA", "STATUS"].map(h => (
              <th key={h} style={{ padding: "3px 10px 3px 0", letterSpacing: 1, fontSize: 10 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lista.map(f => (
            <tr key={f.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{f.data}</td>
              <td style={{ padding: "6px 10px 6px 0", color: C.text }}>{f.descricao}</td>
              <td style={{ padding: "6px 10px 6px 0" }}><Tag color={f.tipo === "entrada" ? C.green : C.red}>{f.tipo?.toUpperCase()}</Tag></td>
              <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{f.categoria}</td>
              <td style={{ padding: "6px 10px 6px 0", color: f.tipo === "entrada" ? C.green : C.red, fontWeight: 700 }}>{f.tipo === "saida" ? "-" : "+"}{fmt.brl(f.valor)}</td>
              <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{f.obra}</td>
              <td style={{ padding: "6px 10px 6px 0" }}><Tag color={C.green}>{f.status?.toUpperCase()}</Tag></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Relatorios({ db }) {
  if (!db) return <div style={{ color: C.dim }}>Carregando...</div>;

  const obras = db.obras || [];
  const trabs = db.trabalhadores || [];
  const tareas = db.tarefas || [];
  const estq = db.estoque || [];
  const finan = db.financeiro || [];

  const totalOrc = obras.reduce((s, o) => s + (o.orcamento || 0), 0);
  const totalGasto = obras.reduce((s, o) => s + (o.gasto || 0), 0);
  const totalEntrada = finan.filter(f => f.tipo === "entrada").reduce((s, f) => s + f.valor, 0);
  const totalSaida = finan.filter(f => f.tipo === "saida").reduce((s, f) => s + f.valor, 0);

  return (
    <div>
      <Ruler label="RELATÓRIOS GERENCIAIS" />
      <Ruler label="RESUMO FINANCEIRO" />
      <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Orçamento total</span><span style={{ color: C.text, fontSize: 12 }}>{fmt.brl(totalOrc)}</span></div>
      <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Total gasto em obras</span><span style={{ color: C.red, fontSize: 12 }}>{fmt.brl(totalGasto)}</span></div>
      <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Disponível</span><span style={{ color: C.green, fontSize: 12 }}>{fmt.brl(totalOrc - totalGasto)}</span></div>
      <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Entradas no período</span><span style={{ color: C.green, fontSize: 12 }}>{fmt.brl(totalEntrada)}</span></div>
      <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Saídas no período</span><span style={{ color: C.red, fontSize: 12 }}>{fmt.brl(totalSaida)}</span></div>
      <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Saldo fluxo</span><span style={{ color: totalEntrada > totalSaida ? C.green : C.red, fontSize: 12 }}>{fmt.brl(totalEntrada - totalSaida)}</span></div>

      <Ruler label="RESUMO OPERACIONAL" />
      <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Total de obras</span><span style={{ color: C.text, fontSize: 12 }}>{obras.length}</span></div>
      <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Obras em andamento</span><span style={{ color: C.blue, fontSize: 12 }}>{obras.filter(o => o.status === "em_andamento").length}</span></div>
      <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Obras concluídas</span><span style={{ color: C.green, fontSize: 12 }}>{obras.filter(o => o.status === "concluida").length}</span></div>
      <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Trabalhadores ativos</span><span style={{ color: C.cyan, fontSize: 12 }}>{trabs.filter(t => t.ativo).length}</span></div>
      <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Tarefas abertas</span><span style={{ color: C.text, fontSize: 12 }}>{tareas.filter(t => t.status !== "concluida").length}</span></div>
      <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Tarefas críticas</span><span style={{ color: C.red, fontSize: 12 }}>{tareas.filter(t => t.prioridade === "critica" && t.status !== "concluida").length}</span></div>
      <div style={{ display: "flex", gap: 12, padding: "3px 0" }}><span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>Estoque abaixo mínimo</span><span style={{ color: C.orange, fontSize: 12 }}>{estq.filter(e => e.quantidade <= e.minimo).length}</span></div>
    </div>
  );
}

function HelpView() {
  return (
    <div>
      <Ruler label="NAVEGAÇÃO" />
      {[
        ["dashboard", "Visão geral — obras, alertas, KPIs"],
        ["obras", "Lista todas as obras"],
        ["obras OB001", "Detalha uma obra específica"],
        ["trabalhadores", "Lista trabalhadores"],
        ["presenca", "Ponto do dia atual"],
        ["tarefas", "Lista tarefas"],
        ["estoque", "Lista estoque"],
        ["financeiro", "Lançamentos financeiros"],
        ["relatorios", "Relatório gerencial consolidado"],
      ].map(([cmd, desc]) => (
        <div key={cmd} style={{ display: "flex", gap: 12, padding: "2px 0", fontSize: 12 }}>
          <span style={{ color: C.accent, minWidth: 220, fontFamily: "monospace" }}>{cmd}</span>
          <span style={{ color: C.dim }}>{desc}</span>
        </div>
      ))}
      <Ruler label="TERMINAL" />
      <div style={{ display: "flex", gap: 12, padding: "2px 0", fontSize: 12 }}><span style={{ color: C.accent, minWidth: 220, fontFamily: "monospace" }}>clear</span><span style={{ color: C.dim }}>Limpa o terminal</span></div>
      <div style={{ display: "flex", gap: 12, padding: "2px 0", fontSize: 12 }}><span style={{ color: C.accent, minWidth: 220, fontFamily: "monospace" }}>help</span><span style={{ color: C.dim }}>Esta ajuda</span></div>
      <div style={{ color: C.dim, fontSize: 11, marginTop: 12 }}>Atalhos: ↑↓ histórico · Tab autocomplete</div>
    </div>
  );
}

function resolveCommand(cmd, db) {
  const parts = cmd.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (command === "dashboard") return <Dashboard db={db} />;
  if (command === "obras") return <Obras db={db} args={args} />;
  if (command === "trabalhadores") return <Trabalhadores db={db} args={args} />;
  if (command === "presenca") return <Presenca db={db} />;
  if (command === "tarefas") return <Tarefas db={db} args={args} />;
  if (command === "estoque") return <Estoque db={db} args={args} />;
  if (command === "financeiro") return <Financeiro db={db} args={args} />;
  if (command === "relatorios") return <Relatorios db={db} />;
  if (command === "help") return <HelpView />;
  return null;
}

const BOOT = [
  { text: "Gestão de Obras v1.1.0", color: C.accent, size: 15, bold: true },
  { text: "Firebase Realtime DB · React + Vite", color: C.dim, size: 11 },
  { text: 'Digite "help" para ver todos os módulos.', color: "#555", size: 11 },
];

function Cursor() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn(p => !p), 500);
    return () => clearInterval(t);
  }, []);
  return <span style={{ opacity: on ? 1 : 0, color: C.accent, fontSize: 14 }}>█</span>;
}

export default function ConsoleApp() {
  const { db, loading } = useDB();
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [cmdHist, setCmdHist] = useState([]);
  const [cmdIdx, setCmdIdx] = useState(-1);
  const [booted, setBooted] = useState(false);
  const [suggest, setSuggest] = useState([]);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => setBooted(true), 600); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);

  const run = useCallback((cmd) => {
    if (!cmd.trim()) return;
    if (cmd.toLowerCase() === "clear") { setHistory([]); setInput(""); return; }

    const output = resolveCommand(cmd, db);
    const isUnknown = output === null;

    setCmdHist(h => [cmd, ...h.slice(0, 49)]);
    setCmdIdx(-1);
    setSuggest([]);

    setHistory(h => [...h, {
      cmd,
      output: isUnknown
        ? <span style={{ color: C.red, fontSize: 12 }}>Módulo não encontrado: "{cmd}". Digite "help".</span>
        : output,
    }]);
    setInput("");
  }, [db]);

  const handleKey = useCallback((e) => {
    if (e.key === "Enter") { run(input); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = Math.min(cmdIdx + 1, cmdHist.length - 1);
      setCmdIdx(idx);
      setInput(cmdHist[idx] || "");
      setSuggest([]);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = Math.max(cmdIdx - 1, -1);
      setCmdIdx(idx);
      setInput(idx >= 0 ? cmdHist[idx] : "");
      setSuggest([]);
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const v = input.toLowerCase();
      const matches = ALL_CMDS.filter(c => c.startsWith(v) && c !== v);
      if (matches.length === 1) setInput(matches[0]);
      else if (matches.length > 1) setSuggest(matches);
    }
    if (e.ctrlKey && e.key === "l") { e.preventDefault(); setHistory([]); }
    setSuggest([]);
  }, [input, cmdIdx, cmdHist, run]);

  const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const obrasAtivas = (db?.obras || []).filter(o => o.status === "em_andamento").length;
  const trabsAtivos = (db?.trabalhadores || []).filter(t => t.ativo).length;
  const tarefasCriticas = (db?.tarefas || []).filter(t => t.prioridade === "critica" && t.status !== "concluida").length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: ${C.bg}; height: 100%; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${C.border2}; border-radius: 2px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .cmd-block { animation: fadeUp 0.18s ease both; }
      `}</style>

      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'JetBrains Mono', monospace", color: C.text, display: "flex", flexDirection: "column" }} onClick={() => inputRef.current?.focus()}>
        <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", gap: 5 }}>
              {[C.red, C.accent, C.green].map((c, i) => <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: c, opacity: 0.7 }} />)}
            </div>
            <span style={{ color: C.accent, fontSize: 12, letterSpacing: 4, fontWeight: 700 }}>GESTÃO DE OBRAS</span>
            <span style={{ color: C.border2, fontSize: 12 }}>/</span>
            <span style={{ color: C.dim, fontSize: 10, letterSpacing: 2 }}>CONSOLE</span>
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 10, color: C.dim, alignItems: "center" }}>
            <span>OBRAS <span style={{ color: C.blue }}>{obrasAtivas}</span></span>
            <span>TRABALHADORES <span style={{ color: C.cyan }}>{trabsAtivos}</span></span>
            <span>TAREFAS CRÍTICAS <span style={{ color: tarefasCriticas > 0 ? C.red : C.green }}>{tarefasCriticas}</span></span>
            <span style={{ color: C.border2 }}>|</span>
            <span style={{ color: "#333" }}>{now}</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px", maxHeight: "calc(100vh - 88px)" }}>
          {booted && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ color: C.border2, fontSize: 10, marginBottom: 8 }}>{"─".repeat(70)}</div>
              {BOOT.map((l, i) => <div key={i} style={{ color: l.color, fontSize: l.size || 12, fontWeight: l.bold ? 700 : 400, lineHeight: 1.7 }}>{l.text}</div>)}
              <div style={{ color: C.border2, fontSize: 10, marginTop: 8 }}>{"─".repeat(70)}</div>
            </div>
          )}

          {history.map((item, i) => (
            <div key={i} className="cmd-block" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span style={{ color: C.green, fontSize: 11 }}>obra@real</span>
                <span style={{ color: C.border2, fontSize: 11 }}>:</span>
                <span style={{ color: C.blue, fontSize: 11 }}>~</span>
                <span style={{ color: C.text, fontSize: 11 }}>$</span>
                <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{item.cmd}</span>
              </div>
              <div style={{ paddingLeft: 16, borderLeft: `2px solid ${C.border}` }}>{item.output}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div style={{ background: C.panel, borderTop: `1px solid ${C.border}`, padding: "0 28px", position: "sticky", bottom: 0 }}>
          {suggest.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.border}`, padding: "6px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {suggest.map(s => (
                <span key={s} onClick={() => { setInput(s); setSuggest([]); inputRef.current?.focus(); }}
                  style={{ color: C.accent, fontSize: 11, padding: "2px 8px", border: `1px solid ${C.border2}`, borderRadius: 2, cursor: "pointer" }}>
                  {s}
                </span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0" }}>
            <span style={{ color: C.green, fontSize: 12, whiteSpace: "nowrap" }}>obra@real</span>
            <span style={{ color: C.border2, fontSize: 12 }}>:</span>
            <span style={{ color: C.blue, fontSize: 12 }}>~</span>
            <span style={{ color: C.text, fontSize: 12 }}>$</span>
            <input ref={inputRef} autoFocus value={input} onChange={e => { setInput(e.target.value); setSuggest([]); }} onKeyDown={handleKey}
              placeholder="módulo [argumento] — ex: obras OB001" spellCheck={false} autoComplete="off"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f1f5f9", fontFamily: "inherit", fontSize: 13, fontWeight: 600, caretColor: C.accent }} />
            <Cursor />
          </div>
        </div>
      </div>
    </>
  );
}