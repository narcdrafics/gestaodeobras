import { useState, useEffect, useRef, useCallback } from "react";

// ─── PALETA ───────────────────────────────────────────────────────────────────
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
  purple:  "#a78bfa",
  cyan:    "#22d3ee",
  orange:  "#fb923c",
};

// ─── DADOS MOCK (espelha estrutura Firebase do projeto) ───────────────────────
const DB = {
  obras: [
    { id: "OB001", nome: "Edifício Bela Vista", status: "em_andamento", responsavel: "Carlos Melo", inicio: "2026-01-10", previsao: "2026-09-30", orcamento: 1850000, gasto: 742000 },
    { id: "OB002", nome: "Residencial Ipê", status: "em_andamento", responsavel: "Ana Lima", inicio: "2025-11-01", previsao: "2026-06-15", orcamento: 980000, gasto: 650000 },
    { id: "OB003", nome: "Galpão Industrial Norte", status: "pausada", responsavel: "João Santos", inicio: "2026-02-20", previsao: "2026-12-01", orcamento: 3200000, gasto: 120000 },
    { id: "OB004", nome: "Reforma Sede ADM", status: "concluida", responsavel: "Maria Souza", inicio: "2025-08-01", previsao: "2026-01-31", orcamento: 450000, gasto: 431000 },
    { id: "OB005", nome: "Condomínio Serra Verde", status: "em_andamento", responsavel: "Pedro Alves", inicio: "2026-03-01", previsao: "2027-06-30", orcamento: 7400000, gasto: 310000 },
  ],
  trabalhadores: [
    { id: "TR001", nome: "Raimundo Costa", funcao: "Pedreiro", obra: "OB001", diaria: 180, ativo: true },
    { id: "TR002", nome: "Silvio Nascimento", funcao: "Carpinteiro", obra: "OB001", diaria: 200, ativo: true },
    { id: "TR003", nome: "Francisca Barros", funcao: "Servente", obra: "OB002", diaria: 140, ativo: true },
    { id: "TR004", nome: "Antônio Ferreira", funcao: "Eletricista", obra: "OB002", diaria: 220, ativo: true },
    { id: "TR005", nome: "Luiz Oliveira", funcao: "Encanador", obra: "OB005", diaria: 210, ativo: false },
    { id: "TR006", nome: "Benedita Moura", funcao: "Pintor", obra: "OB001", diaria: 160, ativo: true },
  ],
  presenca: [
    { id: "PR001", trabalhador: "Raimundo Costa", obra: "OB001", data: "2026-05-04", entrada: "07:02", saida: "17:15", horas: 10.2, status: "presente" },
    { id: "PR002", trabalhador: "Silvio Nascimento", obra: "OB001", data: "2026-05-04", entrada: "07:10", saida: "17:00", horas: 9.8, status: "presente" },
    { id: "PR003", trabalhador: "Francisca Barros", obra: "OB002", data: "2026-05-04", entrada: "--", saida: "--", horas: 0, status: "falta" },
    { id: "PR004", trabalhador: "Antônio Ferreira", obra: "OB002", data: "2026-05-04", entrada: "08:00", saida: "17:00", horas: 9.0, status: "presente" },
    { id: "PR005", trabalhador: "Benedita Moura", obra: "OB001", data: "2026-05-04", entrada: "07:30", saida: "12:00", horas: 4.5, status: "meio_dia" },
  ],
  tarefas: [
    { id: "TK001", titulo: "Concretagem laje 3º andar", obra: "OB001", prioridade: "alta", status: "em_andamento", prazo: "2026-05-10", responsavel: "Carlos Melo" },
    { id: "TK002", titulo: "Instalação elétrica bloco B", obra: "OB002", prioridade: "media", status: "pendente", prazo: "2026-05-20", responsavel: "Antônio Ferreira" },
    { id: "TK003", titulo: "Pintura fachada Norte", obra: "OB001", prioridade: "baixa", status: "pendente", prazo: "2026-06-01", responsavel: "Benedita Moura" },
    { id: "TK004", titulo: "Vistoria fundação bloco C", obra: "OB005", prioridade: "critica", status: "bloqueada", prazo: "2026-05-06", responsavel: "Pedro Alves" },
    { id: "TK005", titulo: "Entrega chaves sala ADM", obra: "OB004", prioridade: "alta", status: "concluida", prazo: "2026-01-31", responsavel: "Maria Souza" },
  ],
  estoque: [
    { id: "ES001", item: "Cimento CP-II (sc 50kg)", unidade: "sc", quantidade: 320, minimo: 100, custo: 38.5, obra: "OB001" },
    { id: "ES002", item: "Vergalhão CA-50 10mm", unidade: "barra", quantidade: 48, minimo: 50, custo: 32.0, obra: "OB001" },
    { id: "ES003", item: "Areia média (m³)", unidade: "m³", quantidade: 12, minimo: 5, custo: 120.0, obra: "OB002" },
    { id: "ES004", item: "Tijolo 8 furos", unidade: "milheiro", quantidade: 3.2, minimo: 2, custo: 680.0, obra: "OB005" },
    { id: "ES005", item: "Tinta acrílica (18L)", unidade: "lata", quantidade: 2, minimo: 5, custo: 190.0, obra: "OB001" },
  ],
  financeiro: [
    { id: "FN001", descricao: "Fornecedor Cimento Norte", tipo: "saida", categoria: "material", valor: 12320, data: "2026-05-02", obra: "OB001", status: "pago" },
    { id: "FN002", descricao: "Folha de pagamento – semana 17", tipo: "saida", categoria: "mao_obra", valor: 8640, data: "2026-05-03", obra: "OB001", status: "pago" },
    { id: "FN003", descricao: "Medição parcial cliente", tipo: "entrada", categoria: "receita", valor: 95000, data: "2026-05-01", obra: "OB002", status: "recebido" },
    { id: "FN004", descricao: "Aluguel andaime", tipo: "saida", categoria: "equipamento", valor: 3200, data: "2026-05-04", obra: "OB005", status: "pendente" },
    { id: "FN005", descricao: "Adiantamento mão de obra", tipo: "saida", categoria: "mao_obra", valor: 4300, data: "2026-05-04", obra: "OB001", status: "pendente" },
  ],
  almocos: [
    { data: "2026-05-04", obra: "OB001", qtd: 14, valor_unit: 18.5, total: 259, fornecedor: "Marmita Boa" },
    { data: "2026-05-04", obra: "OB002", qtd: 8, valor_unit: 18.5, total: 148, fornecedor: "Marmita Boa" },
    { data: "2026-05-03", obra: "OB001", qtd: 13, valor_unit: 18.5, total: 240.5, fornecedor: "Marmita Boa" },
  ],
  medicoes: [
    { id: "MD001", obra: "OB002", descricao: "Fundação – Fase 1", valor: 95000, data: "2026-05-01", status: "aprovada" },
    { id: "MD002", obra: "OB001", descricao: "Estrutura – Bloco A", valor: 142000, data: "2026-04-15", status: "pendente" },
  ],
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = {
  brl: (v) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
  pct: (a, b) => `${((a / b) * 100).toFixed(1)}%`,
  date: (s) => s,
};

const STATUS_OBRA = { em_andamento: [C.blue, "EM ANDAMENTO"], pausada: [C.orange, "PAUSADA"], concluida: [C.green, "CONCLUÍDA"] };
const STATUS_TK   = { pendente: [C.dim, "PENDENTE"], em_andamento: [C.blue, "ANDAMENTO"], concluida: [C.green, "CONCLUÍDA"], bloqueada: [C.red, "BLOQUEADA"] };
const PRIO_TK     = { critica: C.red, alta: C.orange, media: C.accent, baixa: C.dim };
const STATUS_FN   = { pago: [C.green, "PAGO"], recebido: [C.green, "RECEBIDO"], pendente: [C.orange, "PENDENTE"] };

// ─── COMPONENTES BASE ─────────────────────────────────────────────────────────
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

function KV({ label, value, color, wide }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "3px 0", minWidth: wide ? 360 : 0 }}>
      <span style={{ color: C.dim, minWidth: 160, fontSize: 12 }}>{label}</span>
      <span style={{ color: color || C.text, fontSize: 12 }}>{value}</span>
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

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ border: `1px solid ${C.border2}`, padding: "10px 14px", background: C.panel, minWidth: 130 }}>
      <div style={{ fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.dim, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── MÓDULOS (páginas) ────────────────────────────────────────────────────────

function Dashboard() {
  const totalOrc = DB.obras.reduce((s, o) => s + o.orcamento, 0);
  const totalGasto = DB.obras.reduce((s, o) => s + o.gasto, 0);
  const ativos = DB.trabalhadores.filter(t => t.ativo).length;
  const presentes = DB.presenca.filter(p => p.status === "presente").length;
  const criticas = DB.tarefas.filter(t => t.prioridade === "critica" && t.status !== "concluida").length;
  const baixoEstoque = DB.estoque.filter(e => e.quantidade <= e.minimo).length;

  return (
    <div>
      <Ruler label="DASHBOARD GERAL" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        <StatBox label="Obras Ativas" value={DB.obras.filter(o => o.status === "em_andamento").length} color={C.blue} />
        <StatBox label="Orçamento Total" value={fmt.brl(totalOrc)} color={C.text} sub={`Gasto: ${fmt.pct(totalGasto, totalOrc)}`} />
        <StatBox label="Trabalhadores" value={ativos} color={C.green} sub="ativos hoje" />
        <StatBox label="Presença Hoje" value={`${presentes}/${DB.presenca.length}`} color={C.cyan} />
        <StatBox label="Tarefas Críticas" value={criticas} color={criticas > 0 ? C.red : C.green} />
        <StatBox label="Estoque Crítico" value={baixoEstoque} color={baixoEstoque > 0 ? C.orange : C.green} />
      </div>

      <Ruler label="OBRAS EM ANDAMENTO" />
      {DB.obras.filter(o => o.status === "em_andamento").map(o => (
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
      {DB.financeiro.filter(f => f.status === "pendente").length > 0 && (
        <div style={{ color: C.orange, fontSize: 12, padding: "3px 0" }}>
          ⚠  {DB.financeiro.filter(f => f.status === "pendente").length} pagamento(s) financeiro(s) pendentes
        </div>
      )}
      {criticas === 0 && baixoEstoque === 0 && <div style={{ color: C.green, fontSize: 12 }}>✓  Sem alertas críticos no momento</div>}
    </div>
  );
}

function Obras({ args }) {
  if (args[0] && args[0].startsWith("OB")) {
    const o = DB.obras.find(x => x.id === args[0].toUpperCase());
    if (!o) return <div style={{ color: C.red, fontSize: 12 }}>Obra não encontrada: {args[0]}</div>;
    const [cor, label] = STATUS_OBRA[o.status] || [C.dim, o.status];
    const trabsObra = DB.trabalhadores.filter(t => t.obra === o.id);
    const tksObra = DB.tarefas.filter(t => t.obra === o.id);
    return (
      <div>
        <Ruler label={`OBRA ${o.id}`} />
        <KV label="Nome" value={o.nome} color={C.text} />
        <KV label="Status" value={<Tag color={cor}>{label}</Tag>} />
        <KV label="Responsável" value={o.responsavel} />
        <KV label="Início" value={o.inicio} />
        <KV label="Previsão Término" value={o.previsao} />
        <KV label="Orçamento" value={fmt.brl(o.orcamento)} color={C.accent} />
        <KV label="Gasto" value={fmt.brl(o.gasto)} color={o.gasto / o.orcamento > 0.8 ? C.red : C.green} />
        <KV label="Execução" value={fmt.pct(o.gasto, o.orcamento)} />
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
          {tksObra.map(t => {
            const [sc, sl] = STATUS_TK[t.status] || [C.dim, t.status];
            return (
              <div key={t.id} style={{ fontSize: 12, padding: "2px 0", display: "flex", gap: 10 }}>
                <span style={{ color: PRIO_TK[t.prioridade] || C.dim, minWidth: 8 }}>◆</span>
                <span style={{ color: C.text, flex: 1 }}>{t.titulo}</span>
                <Tag color={sc}>{sl}</Tag>
              </div>
            );
          })}
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
            {["ID", "NOME", "STATUS", "RESPONSÁVEL", "ORÇAMENTO", "GASTO", "%"].map(h => (
              <th key={h} style={{ padding: "3px 10px 3px 0", letterSpacing: 1, fontSize: 10 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DB.obras.map((o, i) => {
            const [cor, label] = STATUS_OBRA[o.status] || [C.dim, o.status];
            const pct = (o.gasto / o.orcamento * 100).toFixed(0);
            return (
              <tr key={o.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{o.id}</td>
                <td style={{ padding: "6px 10px 6px 0", color: C.text }}>{o.nome}</td>
                <td style={{ padding: "6px 10px 6px 0" }}><Tag color={cor}>{label}</Tag></td>
                <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{o.responsavel}</td>
                <td style={{ padding: "6px 10px 6px 0", color: C.text }}>{fmt.brl(o.orcamento)}</td>
                <td style={{ padding: "6px 10px 6px 0", color: o.gasto / o.orcamento > 0.85 ? C.red : C.text }}>{fmt.brl(o.gasto)}</td>
                <td style={{ padding: "6px 10px 6px 0", color: pct > 85 ? C.red : C.accent }}>{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ color: C.dim, fontSize: 11, marginTop: 8 }}>
        Dica: <span style={{ color: C.accent }}>obras OB001</span> para detalhes de uma obra
      </div>
    </div>
  );
}

function Trabalhadores({ args }) {
  if (args[0] && args[0].startsWith("TR")) {
    const t = DB.trabalhadores.find(x => x.id === args[0].toUpperCase());
    if (!t) return <div style={{ color: C.red, fontSize: 12 }}>Trabalhador não encontrado: {args[0]}</div>;
    const obra = DB.obras.find(o => o.id === t.obra);
    const ponto = DB.presenca.filter(p => p.trabalhador === t.nome);
    return (
      <div>
        <Ruler label={`TRABALHADOR ${t.id}`} />
        <KV label="Nome" value={t.nome} color={C.text} />
        <KV label="Função" value={t.funcao} />
        <KV label="Obra" value={`${t.obra} — ${obra?.nome || "?"}`} />
        <KV label="Diária" value={fmt.brl(t.diaria)} color={C.accent} />
        <KV label="Status" value={<Tag color={t.ativo ? C.green : C.red}>{t.ativo ? "ATIVO" : "INATIVO"}</Tag>} />
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
          {DB.trabalhadores.map(t => (
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

function Presenca() {
  const hoje = "2026-05-04";
  const presentes = DB.presenca.filter(p => p.status === "presente").length;
  const faltas = DB.presenca.filter(p => p.status === "falta").length;
  const parcial = DB.presenca.filter(p => p.status === "meio_dia").length;
  return (
    <div>
      <Ruler label={`PRESENÇA / PONTO — ${hoje}`} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <StatBox label="Presentes" value={presentes} color={C.green} />
        <StatBox label="Faltas" value={faltas} color={C.red} />
        <StatBox label="Meio Dia" value={parcial} color={C.orange} />
        <StatBox label="Total" value={DB.presenca.length} color={C.text} />
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
          {DB.presenca.map(p => (
            <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: "6px 10px 6px 0", color: C.text }}>{p.trabalhador}</td>
              <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{p.obra}</td>
              <td style={{ padding: "6px 10px 6px 0", color: p.status === "falta" ? C.red : C.green }}>{p.entrada}</td>
              <td style={{ padding: "6px 10px 6px 0", color: p.status === "falta" ? C.red : C.dim }}>{p.saida}</td>
              <td style={{ padding: "6px 10px 6px 0", color: C.accent }}>{p.horas > 0 ? `${p.horas}h` : "—"}</td>
              <td style={{ padding: "6px 10px 6px 0" }}>
                <Tag color={p.status === "presente" ? C.green : p.status === "falta" ? C.red : C.orange}>
                  {p.status.toUpperCase().replace("_", " ")}
                </Tag>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tarefas({ args }) {
  const filtro = args[0]; // ex: critica, pendente, OB001
  let lista = DB.tarefas;
  if (filtro) {
    if (filtro.startsWith("OB")) lista = lista.filter(t => t.obra === filtro.toUpperCase());
    else lista = lista.filter(t => t.prioridade === filtro || t.status === filtro);
  }
  return (
    <div>
      <Ruler label={`TAREFAS${filtro ? ` — FILTRO: ${filtro.toUpperCase()}` : ""}`} />
      {lista.length === 0 && <div style={{ color: C.dim, fontSize: 12 }}>Nenhuma tarefa encontrada.</div>}
      {lista.map(t => {
        const [sc, sl] = STATUS_TK[t.status] || [C.dim, t.status];
        return (
          <div key={t.id} style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 0" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
              <span style={{ color: PRIO_TK[t.prioridade], fontSize: 10 }}>◆ {t.prioridade.toUpperCase()}</span>
              <span style={{ color: C.text, fontSize: 13 }}>{t.titulo}</span>
              <Tag color={sc}>{sl}</Tag>
            </div>
            <div style={{ fontSize: 11, color: C.dim, display: "flex", gap: 16 }}>
              <span>Obra: {t.obra}</span>
              <span>Responsável: {t.responsavel}</span>
              <span>Prazo: <span style={{ color: t.status !== "concluida" && t.prazo <= "2026-05-06" ? C.red : C.dim }}>{t.prazo}</span></span>
            </div>
          </div>
        );
      })}
      <div style={{ color: C.dim, fontSize: 11, marginTop: 8 }}>
        Filtros: <span style={{ color: C.accent }}>tarefas critica | tarefas OB001 | tarefas pendente</span>
      </div>
    </div>
  );
}

function Estoque({ args }) {
  const filtro = args[0];
  let lista = DB.estoque;
  if (filtro === "critico") lista = lista.filter(e => e.quantidade <= e.minimo);
  return (
    <div>
      <Ruler label={`ESTOQUE${filtro ? ` — ${filtro.toUpperCase()}` : ""}`} />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.dim, textAlign: "left" }}>
            {["ITEM", "UN", "QTD", "MÍNIMO", "CUSTO UNIT", "TOTAL", "OBRA", "ALERTA"].map(h => (
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
      <div style={{ color: C.dim, fontSize: 11, marginTop: 8 }}>
        Filtro: <span style={{ color: C.accent }}>estoque critico</span>
      </div>
    </div>
  );
}

function Financeiro({ args }) {
  const filtro = args[0];
  let lista = DB.financeiro;
  if (filtro === "pendente") lista = lista.filter(f => f.status === "pendente");
  if (filtro === "entrada") lista = lista.filter(f => f.tipo === "entrada");
  if (filtro === "saida") lista = lista.filter(f => f.tipo === "saida");

  const totalEntrada = lista.filter(f => f.tipo === "entrada").reduce((s, f) => s + f.valor, 0);
  const totalSaida = lista.filter(f => f.tipo === "saida").reduce((s, f) => s + f.valor, 0);
  const saldo = totalEntrada - totalSaida;

  return (
    <div>
      <Ruler label={`FINANCEIRO${filtro ? ` — ${filtro.toUpperCase()}` : ""}`} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <StatBox label="Entradas" value={fmt.brl(totalEntrada)} color={C.green} />
        <StatBox label="Saídas" value={fmt.brl(totalSaida)} color={C.red} />
        <StatBox label="Saldo" value={fmt.brl(saldo)} color={saldo >= 0 ? C.green : C.red} />
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.dim, textAlign: "left" }}>
            {["DATA", "DESCRIÇÃO", "TIPO", "CATEGORIA", "VALOR", "OBRA", "STATUS"].map(h => (
              <th key={h} style={{ padding: "3px 10px 3px 0", letterSpacing: 1, fontSize: 10 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lista.map(f => {
            const [sc, sl] = STATUS_FN[f.status] || [C.dim, f.status];
            return (
              <tr key={f.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{f.data}</td>
                <td style={{ padding: "6px 10px 6px 0", color: C.text }}>{f.descricao}</td>
                <td style={{ padding: "6px 10px 6px 0" }}>
                  <Tag color={f.tipo === "entrada" ? C.green : C.red}>{f.tipo.toUpperCase()}</Tag>
                </td>
                <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{f.categoria}</td>
                <td style={{ padding: "6px 10px 6px 0", color: f.tipo === "entrada" ? C.green : C.red, fontWeight: 700 }}>
                  {f.tipo === "saida" ? "-" : "+"}{fmt.brl(f.valor)}
                </td>
                <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{f.obra}</td>
                <td style={{ padding: "6px 10px 6px 0" }}><Tag color={sc}>{sl}</Tag></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ color: C.dim, fontSize: 11, marginTop: 8 }}>
        Filtros: <span style={{ color: C.accent }}>financeiro pendente | financeiro entrada | financeiro saida</span>
      </div>
    </div>
  );
}

function Medicoes() {
  return (
    <div>
      <Ruler label="MEDIÇÕES" />
      {DB.medicoes.map(m => {
        const obra = DB.obras.find(o => o.id === m.obra);
        return (
          <div key={m.id} style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 0" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 4 }}>
              <span style={{ color: C.dim, fontSize: 11 }}>{m.id}</span>
              <span style={{ color: C.text, fontSize: 13 }}>{m.descricao}</span>
              <Tag color={m.status === "aprovada" ? C.green : C.orange}>{m.status.toUpperCase()}</Tag>
            </div>
            <div style={{ fontSize: 11, color: C.dim, display: "flex", gap: 16 }}>
              <span>Obra: {m.obra} — {obra?.nome}</span>
              <span>Valor: <span style={{ color: C.accent, fontWeight: 700 }}>{fmt.brl(m.valor)}</span></span>
              <span>Data: {m.data}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Almocos() {
  const total = DB.almocos.reduce((s, a) => s + a.total, 0);
  return (
    <div>
      <Ruler label="ALMOÇOS / MARMITAS" />
      <StatBox label="Total (período)" value={fmt.brl(total)} color={C.accent} />
      <div style={{ marginTop: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.dim, textAlign: "left" }}>
              {["DATA", "OBRA", "QTD", "UN.", "TOTAL", "FORNECEDOR"].map(h => (
                <th key={h} style={{ padding: "3px 10px 3px 0", letterSpacing: 1, fontSize: 10 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DB.almocos.map((a, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{a.data}</td>
                <td style={{ padding: "6px 10px 6px 0", color: C.text }}>{a.obra}</td>
                <td style={{ padding: "6px 10px 6px 0", color: C.cyan }}>{a.qtd}</td>
                <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{fmt.brl(a.valor_unit)}</td>
                <td style={{ padding: "6px 10px 6px 0", color: C.accent, fontWeight: 700 }}>{fmt.brl(a.total)}</td>
                <td style={{ padding: "6px 10px 6px 0", color: C.dim }}>{a.fornecedor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Relatorios() {
  const totalOrc = DB.obras.reduce((s, o) => s + o.orcamento, 0);
  const totalGasto = DB.obras.reduce((s, o) => s + o.gasto, 0);
  const totalEntrada = DB.financeiro.filter(f => f.tipo === "entrada").reduce((s, f) => s + f.valor, 0);
  const totalSaida = DB.financeiro.filter(f => f.tipo === "saida").reduce((s, f) => s + f.valor, 0);
  return (
    <div>
      <Ruler label="RELATÓRIOS GERENCIAIS" />
      <Ruler label="RESUMO FINANCEIRO" />
      <KV label="Orçamento total contratado" value={fmt.brl(totalOrc)} color={C.text} />
      <KV label="Total gasto em obras" value={fmt.brl(totalGasto)} color={C.red} />
      <KV label="Disponível" value={fmt.brl(totalOrc - totalGasto)} color={C.green} />
      <KV label="Entradas no período" value={fmt.brl(totalEntrada)} color={C.green} />
      <KV label="Saídas no período" value={fmt.brl(totalSaida)} color={C.red} />
      <KV label="Saldo fluxo" value={fmt.brl(totalEntrada - totalSaida)} color={totalEntrada > totalSaida ? C.green : C.red} />

      <Ruler label="RESUMO OPERACIONAL" />
      <KV label="Total de obras" value={DB.obras.length} />
      <KV label="Obras em andamento" value={DB.obras.filter(o => o.status === "em_andamento").length} color={C.blue} />
      <KV label="Obras concluídas" value={DB.obras.filter(o => o.status === "concluida").length} color={C.green} />
      <KV label="Trabalhadores ativos" value={DB.trabalhadores.filter(t => t.ativo).length} color={C.cyan} />
      <KV label="Tarefas abertas" value={DB.tarefas.filter(t => t.status !== "concluida").length} />
      <KV label="Tarefas críticas" value={DB.tarefas.filter(t => t.prioridade === "critica" && t.status !== "concluida").length} color={C.red} />
      <KV label="Itens estoque abaixo mínimo" value={DB.estoque.filter(e => e.quantidade <= e.minimo).length} color={C.orange} />
    </div>
  );
}

function HelpView() {
  const sections = [
    {
      titulo: "NAVEGAÇÃO",
      cmds: [
        ["dashboard", "Visão geral — obras, alertas, KPIs"],
        ["obras", "Lista todas as obras"],
        ["obras OB001", "Detalha uma obra específica"],
        ["trabalhadores", "Lista trabalhadores"],
        ["trabalhadores TR001", "Detalha trabalhador + ponto"],
        ["presenca", "Ponto do dia atual"],
        ["tarefas", "Lista tarefas (todos os status)"],
        ["tarefas critica", "Filtra por prioridade ou status"],
        ["tarefas OB001", "Filtra por obra"],
        ["estoque", "Lista estoque"],
        ["estoque critico", "Mostra apenas itens abaixo do mínimo"],
        ["financeiro", "Lançamentos financeiros"],
        ["financeiro pendente", "Filtros: pendente / entrada / saida"],
        ["medicoes", "Medições por obra"],
        ["almocos", "Controle de marmitas"],
        ["relatorios", "Relatório gerencial consolidado"],
      ],
    },
    {
      titulo: "TERMINAL",
      cmds: [
        ["clear", "Limpa o terminal"],
        ["help", "Esta ajuda"],
      ],
    },
  ];
  return (
    <div>
      {sections.map(s => (
        <div key={s.titulo}>
          <Ruler label={s.titulo} />
          {s.cmds.map(([cmd, desc]) => (
            <div key={cmd} style={{ display: "flex", gap: 12, padding: "2px 0", fontSize: 12 }}>
              <span style={{ color: C.accent, minWidth: 220, fontFamily: "monospace" }}>{cmd}</span>
              <span style={{ color: C.dim }}>{desc}</span>
            </div>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 12, color: C.dim, fontSize: 11 }}>
        Atalhos: ↑↓ histórico · Tab autocomplete · Ctrl+L limpar
      </div>
    </div>
  );
}

// ─── ROTEADOR DE COMANDOS ─────────────────────────────────────────────────────
const ALL_CMDS = [
  "dashboard", "obras", "trabalhadores", "presenca", "tarefas",
  "estoque", "financeiro", "medicoes", "almocos", "relatorios",
  "help", "clear",
];

function resolveCommand(raw) {
  const parts = raw.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (cmd === "dashboard")     return <Dashboard />;
  if (cmd === "obras")         return <Obras args={args} />;
  if (cmd === "trabalhadores") return <Trabalhadores args={args} />;
  if (cmd === "presenca")      return <Presenca />;
  if (cmd === "tarefas")       return <Tarefas args={args} />;
  if (cmd === "estoque")       return <Estoque args={args} />;
  if (cmd === "financeiro")    return <Financeiro args={args} />;
  if (cmd === "medicoes")      return <Medicoes />;
  if (cmd === "almocos")       return <Almocos />;
  if (cmd === "relatorios")    return <Relatorios />;
  if (cmd === "help")          return <HelpView />;
  return null;
}

// ─── BOOT SEQUENCE ────────────────────────────────────────────────────────────
const BOOT = [
  { text: "Gestão de Obras v1.1.0", color: C.accent, size: 15, bold: true },
  { text: "Firebase Realtime DB · Multitenancy · Cloudflare Worker", color: C.dim, size: 11 },
  { text: 'Digite "help" para ver todos os módulos disponíveis.', color: "#555", size: 11 },
];

// ─── BLINK CURSOR ─────────────────────────────────────────────────────────────
function Cursor() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn(p => !p), 500);
    return () => clearInterval(t);
  }, []);
  return <span style={{ opacity: on ? 1 : 0, color: C.accent, fontSize: 14 }}>█</span>;
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function App() {
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

  const run = useCallback((raw) => {
    const cmd = raw.trim();
    if (!cmd) return;

    if (cmd.toLowerCase() === "clear") { setHistory([]); setInput(""); return; }
    if (cmd === "\x0c") { setHistory([]); return; } // Ctrl+L

    const output = resolveCommand(cmd);
    const isUnknown = output === null;

    setCmdHist(h => [cmd, ...h.slice(0, 49)]);
    setCmdIdx(-1);
    setSuggest([]);

    setHistory(h => [...h, {
      cmd,
      output: isUnknown
        ? <span style={{ color: C.red, fontSize: 12 }}>Módulo não encontrado: "{cmd}". Digite "help" para listar comandos.</span>
        : output,
    }]);
    setInput("");
  }, []);

  const handleKey = useCallback((e) => {
    if (e.key === "Enter") { run(input); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = Math.min(cmdIdx + 1, cmdHist.length - 1);
      setCmdIdx(idx);
      setInput(cmdHist[idx] || "");
      setSuggest([]);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = Math.max(cmdIdx - 1, -1);
      setCmdIdx(idx);
      setInput(idx === -1 ? "" : cmdHist[idx] || "");
      setSuggest([]);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const v = input.toLowerCase();
      const matches = ALL_CMDS.filter(c => c.startsWith(v) && c !== v);
      if (matches.length === 1) { setInput(matches[0]); setSuggest([]); }
      else if (matches.length > 1) { setSuggest(matches); }
      return;
    }
    if (e.ctrlKey && e.key === "l") { e.preventDefault(); setHistory([]); return; }
    setSuggest([]);
  }, [input, cmdIdx, cmdHist, run]);

  const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: ${C.bg}; height: 100%; }
        ::-webkit-scrollbar { width: 3px; background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border2}; border-radius: 2px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .cmd-block { animation: fadeUp 0.18s ease both; }
        .suggest-item:hover { background: ${C.border}; }
      `}</style>

      <div
        style={{
          minHeight: "100vh", background: C.bg,
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          color: C.text, display: "flex", flexDirection: "column",
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {/* ── TOPBAR ── */}
        <div style={{
          background: C.panel, borderBottom: `1px solid ${C.border}`,
          padding: "8px 20px", display: "flex", justifyContent: "space-between",
          alignItems: "center", position: "sticky", top: 0, zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* traffic lights */}
            <div style={{ display: "flex", gap: 5 }}>
              {[C.red, C.accent, C.green].map((c, i) => (
                <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: c, opacity: 0.7 }} />
              ))}
            </div>
            <span style={{ color: C.accent, fontSize: 12, letterSpacing: 4, fontWeight: 700 }}>GESTÃO DE OBRAS</span>
            <span style={{ color: C.border2, fontSize: 12 }}>/</span>
            <span style={{ color: C.dim, fontSize: 10, letterSpacing: 2 }}>CONSOLE</span>
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 10, color: C.dim, alignItems: "center" }}>
            <span>OBRAS <span style={{ color: C.blue }}>{DB.obras.filter(o => o.status === "em_andamento").length}</span></span>
            <span>TRABALHADORES <span style={{ color: C.cyan }}>{DB.trabalhadores.filter(t => t.ativo).length}</span></span>
            <span>TAREFAS CRÍTICAS <span style={{ color: DB.tarefas.filter(t => t.prioridade === "critica" && t.status !== "concluida").length > 0 ? C.red : C.green }}>
              {DB.tarefas.filter(t => t.prioridade === "critica" && t.status !== "concluida").length}
            </span></span>
            <span style={{ color: C.border2 }}>|</span>
            <span style={{ color: "#333" }}>{now}</span>
          </div>
        </div>

        {/* ── TERMINAL BODY ── */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "20px 28px",
          maxHeight: "calc(100vh - 88px)",
        }}>
          {/* Boot */}
          {booted && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ color: C.border2, fontSize: 10, marginBottom: 8 }}>{"─".repeat(70)}</div>
              {BOOT.map((l, i) => (
                <div key={i} style={{ color: l.color, fontSize: l.size || 12, fontWeight: l.bold ? 700 : 400, lineHeight: 1.7 }}>
                  {l.text}
                </div>
              ))}
              <div style={{ color: C.border2, fontSize: 10, marginTop: 8 }}>{"─".repeat(70)}</div>
            </div>
          )}

          {/* History */}
          {history.map((item, i) => (
            <div key={i} className="cmd-block" style={{ marginBottom: 20 }}>
              {/* prompt line */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span style={{ color: C.green, fontSize: 11 }}>obra@real</span>
                <span style={{ color: C.border2, fontSize: 11 }}>:</span>
                <span style={{ color: C.blue, fontSize: 11 }}>~</span>
                <span style={{ color: C.text, fontSize: 11 }}>$</span>
                <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{item.cmd}</span>
              </div>
              {/* output */}
              <div style={{ paddingLeft: 16, borderLeft: `2px solid ${C.border}` }}>
                {item.output}
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* ── INPUT AREA ── */}
        <div style={{
          background: C.panel, borderTop: `1px solid ${C.border}`,
          padding: "0 28px", position: "sticky", bottom: 0,
        }}>
          {/* Suggestions */}
          {suggest.length > 0 && (
            <div style={{
              borderTop: `1px solid ${C.border}`, padding: "6px 0",
              display: "flex", flexWrap: "wrap", gap: 6,
            }}>
              {suggest.map(s => (
                <span
                  key={s}
                  className="suggest-item"
                  onClick={() => { setInput(s); setSuggest([]); inputRef.current?.focus(); }}
                  style={{
                    color: C.accent, fontSize: 11, padding: "2px 8px",
                    border: `1px solid ${C.border2}`, borderRadius: 2, cursor: "pointer",
                  }}
                >{s}</span>
              ))}
            </div>
          )}

          {/* Prompt */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0" }}>
            <span style={{ color: C.green, fontSize: 12, whiteSpace: "nowrap" }}>obra@real</span>
            <span style={{ color: C.border2, fontSize: 12 }}>:</span>
            <span style={{ color: C.blue, fontSize: 12 }}>~</span>
            <span style={{ color: C.text, fontSize: 12 }}>$</span>
            <input
              ref={inputRef}
              autoFocus
              value={input}
              onChange={e => { setInput(e.target.value); setSuggest([]); }}
              onKeyDown={handleKey}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "#f1f5f9", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                caretColor: C.accent,
              }}
              placeholder="módulo [argumento]  — ex: obras OB001"
              spellCheck={false}
              autoComplete="off"
            />
            <Cursor />
          </div>
        </div>
      </div>
    </>
  );
}
