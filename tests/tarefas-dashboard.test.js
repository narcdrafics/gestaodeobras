// tests/tarefas-dashboard.test.js
// Contratos da melhoria de tarefas e da visibilidade delas no dashboard.
// Mistura testes funcionais (cálculo puro) com inspeção de fonte para os
// fluxos de UI que dependem de Firebase/DOM.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

if (typeof window === 'undefined') {
  globalThis.window = globalThis;
}

import '../public/js/utils.module.js?tarefas-dashboard';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const HOJE = '2026-11-12';
const tarefasHtml = read('public/pages/tarefas.html');
const dashboardHtml = read('public/pages/dashboard.html');
const appSrc = read('public/js/app_core.js');
const utilsSrc = read('public/js/utils.module.js');
const css = read('public/css/app.css');

function baseDB() {
  return {
    obras: [
      { cod: 'T1', nome: 'Timbumba', status: 'Em andamento' },
      { cod: 'T2', nome: 'Muro', status: 'Concluída' }
    ],
    tarefas: [
      { cod: 'TF001', obra: 'T1', desc: 'Alvenaria atrasada', resp: 'João', prior: 'Alta', status: 'A fazer', prazo: '2026-11-10' },
      { cod: 'TF002', obra: 'T2', desc: 'Pintura atrasada', resp: 'Ana', prior: 'Média', status: 'Em andamento', prazo: '2026-11-11' },
      { cod: 'TF003', obra: 'T1', desc: 'Instalar cerca', resp: 'João', prior: 'Baixa', status: 'A fazer', prazo: HOJE },
      { cod: 'TF004', obra: 'T1', desc: 'Concluída no prazo', resp: 'Beto', prior: 'Alta', status: 'Concluída', prazo: '2026-11-01' },
      { cod: 'TF005', obra: 'T1', desc: 'Sem prazo', resp: '', prior: 'Baixa', status: 'A fazer', prazo: '' }
    ]
  };
}

describe('calcTarefasResumo', () => {
  it('separa atrasadas de hoje e ignora concluídas', () => {
    const r = window.calcTarefasResumo(baseDB(), HOJE);
    expect(r.hoje).toBe(HOJE);
    expect(r.abertas).toBe(4); // TF001, TF002, TF003, TF005
    expect(r.atrasadas).toBe(2); // TF001, TF002
    expect(r.vencemHoje).toBe(1); // TF003
    expect(r.itens.map(t => t.cod)).toEqual(['TF001', 'TF002', 'TF003']);
  });

  it('anexa nome legível da obra e flags para a UI', () => {
    const r = window.calcTarefasResumo(baseDB(), HOJE);
    const atrasada = r.itens.find(t => t.cod === 'TF001');
    expect(atrasada.obraNome).toBe('Timbumba');
    expect(atrasada.atrasada).toBe(true);
    expect(atrasada.venceHoje).toBe(false);

    const hoje = r.itens.find(t => t.cod === 'TF003');
    expect(hoje.atrasada).toBe(false);
    expect(hoje.venceHoje).toBe(true);
  });

  it('não quebra com banco sem tarefas', () => {
    const r = window.calcTarefasResumo({}, HOJE);
    expect(r).toMatchObject({ abertas: 0, atrasadas: 0, vencemHoje: 0, itens: [] });
  });
});

describe('alertas de tarefas', () => {
  it('agrupa todas as atrasadas em um único alerta de prioridade alta', () => {
    const { alertas } = window.calcDashboardResumo(baseDB(), HOJE);
    const atrasadas = alertas.filter(a => a.tipo === 'TAREFA ATRASADA');
    expect(atrasadas).toHaveLength(1);
    expect(atrasadas[0].prior).toBe('alto');
    expect(atrasadas[0].desc).toContain('2 tarefa(s) atrasada(s)');
  });

  it('mantém um alerta médio por tarefa que vence hoje', () => {
    const { alertas } = window.calcDashboardResumo(baseDB(), HOJE);
    const hoje = alertas.filter(a => a.tipo === 'TAREFA HOJE');
    expect(hoje).toHaveLength(1);
    expect(hoje[0].desc).toBe('Instalar cerca');
    expect(hoje[0].prior).toBe('medio');
  });

  it('expõe o resumo de tarefas no resultado do dashboard', () => {
    const { tarefas } = window.calcDashboardResumo(baseDB(), HOJE);
    expect(tarefas.atrasadas).toBe(2);
    expect(tarefas.vencemHoje).toBe(1);
  });
});

describe('página de tarefas — filtros e busca', () => {
  it('oferece filtros de status, prioridade, responsável, vencidas e minhas', () => {
    ['tar-status-filter', 'tar-prio-filter', 'tar-resp-filter', 'tar-vencidas', 'tar-minhas', 'tar-ordem']
      .forEach(id => expect(tarefasHtml).toContain(`id="${id}"`));
    expect(tarefasHtml).toContain('Limpar filtros');
  });

  it('usa busca com debounce em vez de re-render a cada tecla', () => {
    expect(tarefasHtml).toContain('id="tar-busca"');
    expect(tarefasHtml).toMatch(/oninput="onTaskSearch\(\)"/);
    expect(appSrc).toContain('function onTaskSearch()');
    expect(appSrc).toContain('setTimeout(renderTarefas, 220)');
    expect(appSrc).toContain('function limparFiltrosTarefas()');
  });

  it('renderTarefas aplica todos os filtros e ordenação', () => {
    const trecho = appSrc.slice(appSrc.indexOf('function renderTarefas()'), appSrc.indexOf('function renderTaskTable('));
    ['statusFilter', 'prioFilter', 'respFilter', 'soVencidas', 'soMinhas', 'ordem', 'busca']
      .forEach(nome => expect(trecho).toContain(nome));
    expect(trecho).toContain("const atrasadas = tasks.filter(t => t._atrasada).length");
    expect(trecho).toContain('Atrasadas');
  });
});

describe('dashboard — visibilidade das tarefas', () => {
  it('tem painel dedicado e link para abrir todas as tarefas', () => {
    expect(dashboardHtml).toContain('id="dash-tarefas-grid"');
    expect(dashboardHtml).toContain('verTarefasDashboard()');
  });

  it('desenha KPIs de tarefas e o painel com conclusão rápida', () => {
    expect(appSrc).toContain('Tarefas Abertas');
    expect(appSrc).toContain('Tarefas Atrasadas');
    expect(appSrc).toContain("document.getElementById('dash-tarefas-grid')");
    expect(appSrc).toContain('concluirTarefaRapida(${t._idx})');
  });

  it('reserva slots dos alertas para tarefas', () => {
    expect(appSrc).toContain("alertas.filter(a => a.tipo.startsWith('TAREFA'))");
  });

  it('célula de tarefas da obra abre a lista filtrada', () => {
    expect(appSrc).toContain('verTarefasDaObra(');
    expect(appSrc).toContain('class="link-btn"');
  });
});

describe('ações rápidas e kanban', () => {
  it('conclui/inicia/move com snapshot para desfazer', () => {
    ['tarefaTaAtrasada', 'tarefaStatusEfetivo', 'concluirTarefaRapida', 'toggleTarefaConcluida',
      'iniciarTarefa', 'moverTarefaStatus', 'toastComDesfazer', 'desfazerAcao']
      .forEach(fn => expect(appSrc).toContain(`function ${fn}(`));
    expect(appSrc).toContain('_undoSnapshotTarefas = JSON.parse(JSON.stringify(DB.tarefas');
    expect(appSrc).toContain('DB.tarefas = snap');
    expect(appSrc).toContain("el.className = 'toast success toast-undo'");
    expect(appSrc).toContain('onclick="desfazerAcao()"');
  });

  it('tabela oferece ações rápidas e destaque de atrasadas', () => {
    const trecho = appSrc.slice(appSrc.indexOf('function renderTaskTable('), appSrc.indexOf('function renderKanban('));
    expect(trecho).toContain('concluirTarefaRapida(${t._idx})');
    expect(trecho).toContain('iniciarTarefa(${t._idx})');
    expect(trecho).toContain('toggleTarefaConcluida(${t._idx})');
    expect(trecho).toContain('tarefa-atrasada');
    expect(trecho).toContain('statusBadge(tarefaStatusEfetivo(t))');
  });

  it('kanban é arrastável e cria tarefas em cada coluna', () => {
    const trecho = appSrc.slice(appSrc.indexOf('function renderKanban('), appSrc.indexOf('// ==================== MODAL ENTRADA'));
    ['ondragover="onTaskDragOver(event)"', 'ondrop="onTaskDrop(event,',
      'ondragstart="onTaskDragStart(event,', 'abrirNovaTarefaNoStatus(', 'draggable="true"']
      .forEach(s => expect(trecho).toContain(s));
    expect(appSrc).toContain('function onTaskDrop(');
    expect(appSrc).toContain('moverTarefaStatus(idx, status)');
  });

  it('página Hoje mostra atrasadas agrupadas', () => {
    const trecho = appSrc.slice(appSrc.indexOf('// ==================== HOJE'), appSrc.indexOf('// ==================== TAREFAS'));
    expect(trecho).toContain("tipo: 'TAREFA ATRASADA'");
    expect(trecho).toContain('tarefasAtrasadas.length');
    expect(trecho).toContain('Tarefas Atrasadas');
  });
});

describe('CSS das tarefas', () => {
  it('estiliza painel, atrasos, desfazer e arraste', () => {
    ['.dash-tarefa-item', '.dash-tarefa-info', 'tr.tarefa-atrasada', '.tarefa-atrasada-tag',
      '.toast-undo-btn', '.kanban-card.dragging', '.kanban-cards.drag-over', '.link-btn']
      .forEach(s => expect(css).toContain(s));
  });
});
