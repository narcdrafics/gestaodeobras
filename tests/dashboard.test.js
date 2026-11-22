import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

if (typeof window === 'undefined') {
  globalThis.window = globalThis;
}

import '../public/js/utils.module.js?dashboard';

// Quinta-feira. Semana = seg 09/11 até hoje; mês = 01/11 até hoje.
const HOJE = '2026-11-12';

function baseDB() {
  return {
    trabalhadores: [
      { cod: 'w1', nome: 'Ana', diaria: 100 },
      { cod: 'w2', nome: 'Beto', diaria: 100 }
    ],
    obras: [
      { cod: 'T1', nome: 'Timbumba', status: 'Em andamento', orc: 4000, mestre: 'Carlos' },
      { cod: 'T2', nome: 'Muro Timbumba', status: 'Concluída', orc: 0, mestre: '' },
      { cod: 'T3', nome: 'Galpão', status: 'Em andamento', orc: 0, mestre: '' }
    ],
    presenca: [
      { data: '2026-11-12', obra: 'T1', trab: 'w1', presenca: 'Presente', hnorm: 8, hextra: 0 },
      { data: '2026-11-12', obra: 'T1', trab: 'w2', presenca: 'Presente', hnorm: 8, hextra: 0 },
      { data: '2026-11-10', obra: 'T1', trab: 'w1', presenca: 'Presente', hnorm: 8, hextra: 0 },
      { data: '2026-11-03', obra: 'T1', trab: 'w1', presenca: 'Presente', hnorm: 8, hextra: 0 },
      { data: '2026-10-20', obra: 'T1', trab: 'w1', presenca: 'Presente', hnorm: 8, hextra: 0 },
      { data: '2026-11-11', obra: 'T1', trab: 'w2', presenca: 'Falta', hnorm: 0, hextra: 0 }
    ],
    financeiro: [
      { data: '2026-11-11', obra: 'T1', desc: 'cimento', real: 1000, prev: 1000 },
      { data: '2026-10-05', obra: 'T1', desc: 'areia', real: 2000, prev: 2000 },
      { obra: 'T1', desc: 'sem data', real: 500, prev: 500 },
      { data: '2026-11-11', obra: 'T1', desc: 'só previsto', real: 0, prev: 9999 }
    ],
    medicao: [
      { semana: '2026-11-09', obra: 'T1', equipe: 'A', vtotal: 800 },
      { semana: '2026-10-15', obra: 'T1', equipe: 'A', vtotal: 300 }
    ],
    tarefas: [
      { obra: 'T1', desc: 'Concretar laje', prazo: '2026-11-10', status: 'Pendente' },
      { obra: 'T1', desc: 'Pedir areia', prazo: '2026-11-12', status: 'Pendente' },
      { obra: 'T1', desc: 'Fundação', prazo: '2026-11-01', status: 'Concluída' }
    ],
    compras: [{ obra: 'T1', mat: 'Cimento 50kg', status: 'Aguardando' }]
  };
}

beforeEach(() => { globalThis.DB = baseDB(); });

describe('calcCustoObra: Total real = soma de todos os custos desde o início', () => {
  it('soma mão de obra + empreitadas + financeiro (real)', () => {
    const r = window.calcCustoObra(DB, 'T1');
    expect(r.maoDeObra).toBe(500);
    expect(r.medicoes).toBe(1100);
    expect(r.financeiro).toBe(3500); // 1000 + 2000 + 500 sem data; o "só previsto" não conta
    expect(r.total).toBe(5100);
  });

  it('semana e mês somam só o período', () => {
    const sem = window.calcCustoObra(DB, 'T1', { tipo: 'semana', baseDate: HOJE });
    expect(sem.total).toBe(300 + 800 + 1000);
    const mes = window.calcCustoObra(DB, 'T1', { tipo: 'mes', baseDate: HOJE });
    expect(mes.total).toBe(400 + 800 + 1000);
  });

  it('lançamento sem data entra no total, mas não em período', () => {
    const mes = window.calcCustoObra(DB, 'T1', { tipo: 'mes', baseDate: HOJE });
    expect(mes.financeiro).toBe(1000);
  });

  it('INVARIANTE: total real >= custo do mês >= custo da semana (o bug do print)', () => {
    for (const o of DB.obras) {
      const sem = window.calcCustoObra(DB, o.cod, { tipo: 'semana', baseDate: HOJE }).total;
      const mes = window.calcCustoObra(DB, o.cod, { tipo: 'mes', baseDate: HOJE }).total;
      const total = window.calcCustoObra(DB, o.cod).total;
      expect(total).toBeGreaterThanOrEqual(mes);
      expect(mes).toBeGreaterThanOrEqual(sem);
    }
  });

  it('só considera a própria obra', () => {
    expect(window.calcCustoObra(DB, 'T3').total).toBe(0);
  });

  it('diárias da semana contam dias pagos (falta não conta, e não é só "hoje")', () => {
    const sem = window.calcCustoObra(DB, 'T1', { tipo: 'semana', baseDate: HOJE });
    expect(sem.diarias).toBe(3); // 2 hoje + 1 na terça; a falta de quarta fica de fora
  });
});

describe('calcDashboardResumo', () => {
  it('KPIs do dia usam as mesmas regras da página Hoje', () => {
    const { kpis } = window.calcDashboardResumo(DB, HOJE);
    expect(kpis).toEqual({ presentes: 2, faltas: 0, obrasAtivas: 2, diariasHoje: 200 });
  });

  it('% custo é null sem orçamento e numérico com orçamento', () => {
    const { linhas } = window.calcDashboardResumo(DB, HOJE);
    expect(linhas.find(l => l.obra.cod === 'T1').pctCusto).toBeCloseTo(127.5, 5); // 5100 / 4000
    expect(linhas.find(l => l.obra.cod === 'T2').pctCusto).toBeNull();
  });

  it('conta tarefas concluídas e totais', () => {
    const l = window.calcDashboardResumo(DB, HOJE).linhas.find(x => x.obra.cod === 'T1');
    expect([l.tarefasFeitas, l.tarefasTotal]).toEqual([1, 3]);
  });
});

describe('hojeLocal (fuso de São Paulo)', () => {
  afterEach(() => vi.useRealTimers());

  it('às 22h30 de 13/11 em Brasília ainda é dia 13 (UTC já virou para 14)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T01:30:00Z'));
    expect(new Date().toISOString().split('T')[0]).toBe('2026-11-14'); // o que o código antigo usava
    expect(window.hojeLocal()).toBe('2026-11-13');
  });
});

describe('calcAlertas', () => {
  const alertasDe = (db, hoje = HOJE, role) => window.calcDashboardResumo(db, hoje, role).alertas;
  const tipos = (a) => a.map(x => x.tipo);

  it('gera alertas reais e ordena do mais grave ao menos grave', () => {
    const a = alertasDe(DB);
    expect(tipos(a)).toEqual(expect.arrayContaining([
      'TAREFA ATRASADA', 'TAREFA HOJE', 'CUSTO ACIMA DO ORÇAMENTO', 'COMPRA PENDENTE', 'SEM PRESENÇA HOJE', 'OBRA SEM MESTRE'
    ]));
    const ordem = a.map(x => ({ alto: 0, medio: 1, baixo: 2 })[x.prior]);
    expect(ordem).toEqual([...ordem].sort((x, y) => x - y));
    expect(a[0].prior).toBe('alto');
  });

  it('só obra em andamento entra em alertas de presença/mestre/custo', () => {
    const a = alertasDe(DB);
    expect(a.filter(x => x.obra === 'Muro Timbumba')).toHaveLength(0);
    expect(a.find(x => x.tipo === 'SEM PRESENÇA HOJE').obra).toBe('Galpão'); // T1 tem presença hoje
    expect(a.find(x => x.tipo === 'OBRA SEM MESTRE').obra).toBe('Galpão');
  });

  it('domingo não gera "sem presença"', () => {
    expect(tipos(alertasDe(DB, '2026-11-15'))).not.toContain('SEM PRESENÇA HOJE');
  });

  it('mestre não recebe alertas de compra nem de custo', () => {
    const t = tipos(alertasDe(DB, HOJE, 'mestre'));
    expect(t).not.toContain('COMPRA PENDENTE');
    expect(t).not.toContain('CUSTO ACIMA DO ORÇAMENTO');
    expect(t).toContain('TAREFA ATRASADA');
  });

  it('perto do limite (80% a 100%) é médio; sem orçamento não alerta custo', () => {
    DB.obras[0].orc = 6000; // 5100 / 6000 = 85%
    const a = alertasDe(DB);
    expect(a.find(x => x.tipo === 'CUSTO PERTO DO LIMITE').prior).toBe('medio');
    expect(tipos(a)).not.toContain('CUSTO ACIMA DO ORÇAMENTO');
  });
});

describe('renderDashboard (código real do app_core.js sobre o dashboard.html)', () => {
  const root = process.cwd();
  const appSrc = fs.readFileSync(path.join(root, 'public', 'js', 'app_core.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'public', 'pages', 'dashboard.html'), 'utf8');
  const start = appSrc.indexOf('window.renderDashboard = window.renderDashboard || function () {');
  const end = appSrc.indexOf('window.renderObras = window.renderObras || function () { };');

  function render(role = 'admin', hoje = HOJE) {
    sessionStorage.setItem('gestaoUser', JSON.stringify({ role }));
    document.body.innerHTML = html;
    window.statusBadge = (s) => `<span class="badge">${s}</span>`;
    // o dashboard usa a data de hoje; fixa o relógio para o cenário de teste
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${hoje}T15:00:00Z`));
    delete window.renderDashboard;
    new Function(appSrc.slice(start, end))();
    window.renderDashboard();
    vi.useRealTimers();
  }

  const rows = () => [...document.querySelectorAll('#dash-obras-tbody tr')];

  it('desenha KPIs, alertas e as linhas; concluída fica recolhida', () => {
    render();
    expect(document.querySelectorAll('#kpi-grid .kpi-card')).toHaveLength(6);
    expect(document.querySelectorAll('#alerts-grid .alert-card').length).toBeGreaterThan(0);
    expect(rows()).toHaveLength(2); // T1 e T3; a concluída (T2) fica de fora
    expect(document.getElementById('dash-done-count').textContent).toBe('(1)');
  });

  it('mostra Total real correto e % custo; "—" quando não há orçamento', () => {
    render();
    const t1 = rows().find(r => r.textContent.includes('Timbumba') && !r.textContent.includes('Muro'));
    expect(t1.querySelector('[data-label="% Custo"]').textContent).toBe('127.5%');
    expect(t1.querySelector('[data-label="Total Real."]').textContent.replace(/\s/g, '')).toContain('5.100,00');
    const t3 = rows().find(r => r.textContent.includes('Galpão'));
    expect(t3.querySelector('[data-label="% Custo"]').textContent).toBe('—');
  });

  it('mostrar concluídas inclui a linha', () => {
    render();
    document.getElementById('dash-show-done').checked = true;
    window.renderDashboard();
    expect(rows()).toHaveLength(3);
  });

  it('obra sem mestre ganha botão "Atribuir" (e mestre logado não)', () => {
    const atribuir = () => [...document.querySelectorAll('#dash-obras-tbody button')]
      .find(b => b.textContent.trim() === 'Atribuir');
    render('admin');
    expect(atribuir()).not.toBeNull();
    render('mestre');
    expect(atribuir()).toBeUndefined();
  });

  it('ações rápidas respeitam o papel', () => {
    const labels = () => [...document.querySelectorAll('#dash-actions button')].map(b => b.textContent);
    render('admin');
    expect(labels()).toEqual(['+ Lançar Presença', '+ Nova Tarefa', '+ Nova Compra']);
    render('mestre');
    expect(labels()).toEqual(['+ Lançar Presença', '+ Nova Tarefa']);
    render('engenheiro');
    expect(labels()).toEqual(['+ Nova Tarefa', '+ Nova Compra']);
  });

  it('nome de obra com HTML não vira elemento (XSS)', () => {
    DB.obras[0].nome = '<img src=x onerror=alert(1)>';
    render();
    expect(document.querySelector('#dash-obras-tbody img')).toBeNull();
    expect(document.querySelector('#alerts-grid img')).toBeNull();
  });

  it('importar fica dentro do menu "Mais" (o filtro do mestre esconde o menu todo)', () => {
    render();
    const input = document.getElementById('import-file');
    expect(input.parentElement.classList.contains('dash-more')).toBe(true);
  });
});
