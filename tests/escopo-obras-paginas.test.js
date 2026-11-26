// tests/escopo-obras-paginas.test.js
// Presença, Almoços e Funcionários só exibem dados das obras do usuário logado
// e dos trabalhadores vinculados a essas obras.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseObrasTrabalhador, trabNaObra, obraNoEscopo, trabNoEscopo, trabalhadoresNoEscopo
} from './utils_wrapper.js';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const appSrc = read('public/js/app_core.js');
const slice = (inicio, fim) => appSrc.slice(appSrc.indexOf(inicio), appSrc.indexOf(fim));

const ESCOPO = ['OB1'];
const noEscopo = () => ESCOPO;

function helpersDeEscopo() {
  const window = {
    getObrasPermitidas: () => ESCOPO,
    obraNoEscopo: (obra, permitidas) => obraNoEscopo(obra, permitidas),
    trabNoEscopo: (t, permitidas) => trabNoEscopo(t, permitidas),
    trabalhadoresNoEscopo: (lista, permitidas) => trabalhadoresNoEscopo(lista, permitidas),
    trabNaObra: (t, cod) => trabNaObra(t, cod),
    parseObrasTrabalhador: (t) => parseObrasTrabalhador(t)
  };
  return {
    window,
    escopoObrasDaSessao: noEscopo,
    obraNoEscopoAtual: (obra) => obraNoEscopo(obra, noEscopo()),
    trabNoEscopoAtual: (t) => trabNoEscopo(t, noEscopo()),
    trabsNoEscopoAtual: (lista) => trabalhadoresNoEscopo(lista || [], noEscopo())
  };
}

describe('obras do trabalhador', () => {
  it('aceita texto separado por vírgula/ponto e vírgula e array', () => {
    expect(parseObrasTrabalhador({ obras: ' OB1 , OB2; OB3 ' })).toEqual(['OB1', 'OB2', 'OB3']);
    expect(parseObrasTrabalhador({ obras: ['OB1', 'OB2'] })).toEqual(['OB1', 'OB2']);
    expect(parseObrasTrabalhador(null)).toEqual([]);
  });

  it('compara códigos inteiros: OB1 não casa com OB10', () => {
    expect(trabNaObra({ obras: 'OB10' }, 'OB1')).toBe(false);
    expect(trabNaObra({ obras: 'OB10, OB1' }, 'OB1')).toBe(true);
    expect(trabNaObra({ obras: '' }, 'OB1')).toBe(true); // legado sem restrição
    expect(trabNaObra({ obras: 'OB1' }, '')).toBe(false);
  });

  it('obraNoEscopo aplica a lista do usuário e trabNoEscopo respeita a ficha', () => {
    expect(obraNoEscopo('OB9', null)).toBe(true);
    expect(obraNoEscopo('OB9', ESCOPO)).toBe(false);
    expect(trabNoEscopo({ obras: 'OB9' }, ESCOPO)).toBe(false);
    expect(trabNoEscopo({ obras: 'OB9, OB1' }, ESCOPO)).toBe(true);
    expect(trabNoEscopo({ obras: '' }, ESCOPO)).toBe(true);
    expect(trabalhadoresNoEscopo([{ obras: 'OB9' }, { obras: 'OB1' }], ESCOPO)).toHaveLength(1);
    expect(trabNoEscopo({ obras: '' }, [])).toBe(false); // lista vazia = falha fechada
    expect(trabalhadoresNoEscopo([{ obras: '' }], [])).toEqual([]);
  });
});

describe('escopoObrasDaSessao', () => {
  it('usa e-mail da sessão e normaliza mestre para encarregado', () => {
    const codigo = slice('// ==================== ESCOPO DE OBRAS DA SESSÃO ====================',
      '// ==================== SYSTEM GLOBALS (ANTI-REFERENCE ERROR) ====================');
    const sessao = { email: 'eng@x.com', role: 'mestre' };
    const fakeWindow = {
      getObrasPermitidas: vi.fn(() => ESCOPO),
      obraNoEscopo: () => true, trabNoEscopo: () => true, trabalhadoresNoEscopo: (l) => l
    };
    const fakeDb = { usuarios: [{ email: 'eng@x.com' }] };
    new Function('window', 'sessionStorage', 'DB', codigo)(
      fakeWindow,
      { getItem: () => JSON.stringify(sessao) },
      fakeDb
    );
    expect(fakeWindow.escopoObrasDaSessao()).toEqual(ESCOPO);
    expect(fakeWindow.getObrasPermitidas).toHaveBeenCalledWith(fakeDb.usuarios, 'eng@x.com', 'encarregado');
  });
});

describe('Funcionários — lista filtrada com índice original', () => {
  it('mostra só trabalhadores das obras do escopo e mantém índice para ações', () => {
    const codigo = slice('// ==================== TRABALHADORES ====================',
      '// ==================== ALMOÇOS ====================');
    const DB = {
      trabalhadores: [
        { cod: 'T1', nome: 'Fora', obras: 'OB9', status: 'Ativo' },
        { cod: 'T2', nome: 'Dentro', obras: 'OB10', status: 'Ativo' },
        { cod: 'T3', nome: 'Na Obra', obras: 'OB1', status: 'Ativo' }
      ],
      presenca: [], financeiro: []
    };
    const html = {};
    const h = helpersDeEscopo();
    const win = new Function('window', 'document', 'DB', 'safeSetInner', 'fmt', 'statusBadge',
      'uiEmptyState', 'trabNoEscopoAtual', 'escopoObrasDaSessao',
      codigo + '\nreturn { renderTrabalhadores };')(
      h.window,
      { getElementById: () => null }, DB,
      (id, conteudo) => { html[id] = conteudo; },
      (v) => `R$ ${v}`, (v) => v, () => '',
      h.trabNoEscopoAtual, h.escopoObrasDaSessao
    );
    win.renderTrabalhadores();
    expect(html['trab-tbody']).toContain('Na Obra');
    expect(html['trab-tbody']).not.toContain('Fora');
    expect(html['trab-tbody']).not.toContain('>Dentro<');
    expect(html['trab-tbody']).toContain('editTrabalhador(2)');
    expect(html['trab-tbody']).toContain("deleteItem('trabalhadores',2)");
  });
});

describe('Presença — registros e quadro no escopo', () => {
  function carregarPresenca(DB, els = {}) {
    const codigo = slice('// ==================== PRESENÇA ====================',
      '// ==================== TAREFAS ====================');
    const h = helpersDeEscopo();
    const elementos = {
      'pres-quadro-semanal': { innerHTML: '' },
      'pres-sort-select': { value: 'data_desc' },
      'pres-group-select': { value: '' },
      ...els
    };
    const html = {};
    const fakeWindow = { summarizePresence: () => [], calcWeeklyPendingPayments: () => [] };
    const win = new Function('window', 'document', 'DB', 'safeSetInner', 'fmt', 'fmtDate', 'statusBadge',
      'obName', 'uiEmptyState', 'today', 'obraNoEscopoAtual', 'trabsNoEscopoAtual',
      'escopoObrasDaSessao', 'openModal', 'editPresenca', codigo + '\nreturn { renderPresenca };')(
      fakeWindow,
      { getElementById: (id) => elementos[id] || null }, DB,
      (id, conteudo) => { html[id] = conteudo; },
      (v) => `R$ ${v}`, (v) => String(v || ''), (v) => v, (v) => String(v || ''),
      () => '', '2026-11-25', h.obraNoEscopoAtual, h.trabsNoEscopoAtual,
      h.escopoObrasDaSessao, () => {}, () => {}
    );
    win.renderPresenca();
    return { win, html, elementos };
  }

  it('a tabela esconde presenças de fora do escopo e mantém o índice original', () => {
    const DB = {
      obras: [{ cod: 'OB1', nome: 'Um' }],
      trabalhadores: [],
      presenca: [
        { data: '2026-11-25', obra: 'OB1', nome: 'Ana', total: 100, presenca: 'Presente' },
        { data: '2026-11-25', obra: 'OB9', nome: 'Beto', total: 100, presenca: 'Presente' },
        { data: '2026-11-24', obra: 'OB1', nome: 'Carla', total: 100, presenca: 'Falta' }
      ]
    };
    const { html } = carregarPresenca(DB);
    expect(html['pres-tbody']).toContain('Ana');
    expect(html['pres-tbody']).toContain('Carla');
    expect(html['pres-tbody']).not.toContain('Beto');
    expect(html['pres-tbody']).toContain('editPresenca(2)');
    expect(html['pres-kpi']).toContain('>1</div>');
  });

  it('o quadro semanal mostra apenas trabalhadores das obras do escopo', () => {
    const DB = {
      trabalhadores: [
        { cod: 'T1', nome: 'Ana', status: 'Ativo', obras: 'OB1' },
        { cod: 'T2', nome: 'Beto', status: 'Ativo', obras: 'OB9' },
        { cod: 'T3', nome: 'Carla', status: 'Ativo', obras: 'OB10' }
      ],
      presenca: []
    };
    const { elementos } = carregarPresenca(DB);
    expect(elementos['pres-quadro-semanal'].innerHTML).toContain('Ana');
    expect(elementos['pres-quadro-semanal'].innerHTML).not.toContain('Beto');
    expect(elementos['pres-quadro-semanal'].innerHTML).not.toContain('Carla');
  });
});

describe('Almoços — lista, KPIs e fechamentos no escopo', () => {
  function carregarAlmocos(DB, elementos = {}) {
    const codigo = slice('// ==================== ALMOÇOS ====================',
      'function calcAlmocoTotal()');
    const h = helpersDeEscopo();
    const els = {
      'almoco-quadro-semanal': { innerHTML: '' },
      'almocos-tbody': { innerHTML: '', querySelectorAll: () => [] },
      'almocos-kpi': { innerHTML: '' },
      'almocos-resumo': { innerHTML: '' },
      'almocos-empreiteiro': { innerHTML: '' },
      'almocos-pgto-pendentes': { innerHTML: '' },
      'almoco-busca': { value: '' },
      'almoco-group-select': { value: '' },
      'almoco-sort-select': { value: 'data_desc' },
      ...elementos
    };
    const win = new Function('window', 'document', 'DB', 'escHtml', 'fmt', 'fmtDate', 'obName', 'statusBadge',
      'toast', 'persistDB', 'openModal', 'editAlmoco', 'toggleAlmocoModo',
      'obraNoEscopoAtual', 'trabsNoEscopoAtual', 'escopoObrasDaSessao', 'confirm', 'setTimeout', codigo + '\nreturn window;')(
      { ...h.window }, { getElementById: (id) => els[id] || null }, DB,
      (v) => String(v == null ? '' : v), (v) => `R$ ${Number(v) || 0}`,
      (v) => String(v || ''), (v) => (v === 'OB1' ? 'Obra Um' : String(v || '')),
      (v) => v, () => {}, () => {}, () => {}, () => {}, () => {},
      h.obraNoEscopoAtual, h.trabsNoEscopoAtual, h.escopoObrasDaSessao,
      () => true, (fn) => fn()
    );
    return { win, els };
  }

  const hoje = (() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const ini = new Date(d); ini.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return ini.getFullYear() + '-' + String(ini.getMonth() + 1).padStart(2, '0') + '-' + String(ini.getDate()).padStart(2, '0');
  })();

  it('esconde almoços e fechamentos de outras obras', () => {
    const DB = {
      trabalhadores: [{ cod: 'T1', nome: 'Ana', status: 'Ativo', obras: 'OB1' }],
      almocos: [
        { data: hoje, obra: 'OB1', empreiteiro: 'Ana', qtd: 2, vunit: 20, vtotal: 40, pgtoStatus: 'Pendente' },
        { data: hoje, obra: 'OB9', empreiteiro: 'Fora', qtd: 9, vunit: 20, vtotal: 180, pgtoStatus: 'Pendente' },
        { data: hoje, obra: 'OB1', empreiteiro: 'Carla', qtd: 1, vunit: 20, vtotal: 20, pgtoStatus: 'Pendente' },
        { data: hoje, obra: 'OB9', empreiteiro: 'Beto', qtd: 9, vunit: 20, vtotal: 180, pgtoStatus: 'Pendente' }
      ]
    };
    const { win, els } = carregarAlmocos(DB);
    win.renderAlmocos();
    expect(els['almocos-tbody'].innerHTML).toContain('Ana');
    expect(els['almocos-tbody'].innerHTML).toContain('Carla');
    expect(els['almocos-tbody'].innerHTML).toContain('editAlmoco(2)');
    expect(els['almocos-tbody'].innerHTML).not.toContain('Fora');
    expect(els['almocos-tbody'].innerHTML).not.toContain('Beto');
    expect(els['almocos-kpi'].innerHTML).toContain('3 un');
    expect(els['almocos-kpi'].innerHTML).not.toContain('9 un');
    expect(els['almocos-resumo'].innerHTML).toContain('Obra Um');
    expect(els['almocos-empreiteiro'].innerHTML).toContain('Carla');
    expect(els['almocos-empreiteiro'].innerHTML).not.toContain('Beto');
    expect(els['almocos-pgto-pendentes'].innerHTML).toContain('R$ 60');
    expect(els['almoco-quadro-semanal'].innerHTML).not.toContain("openAlmocoModal('T2'");
  });

  it('o fechamento em lote não altera registros fora do escopo', async () => {
    const DB = {
      trabalhadores: [],
      almocos: [
        { data: hoje, obra: 'OB1', empreiteiro: 'Ana', qtd: 1, vtotal: 20, pgtoStatus: 'Pendente' },
        { data: hoje, obra: 'OB9', empreiteiro: 'Beto', qtd: 1, vtotal: 30, pgtoStatus: 'Pendente' }
      ]
    };
    const { win } = carregarAlmocos(DB);
    await win.fecharSemanaAlmocos();
    expect(DB.almocos[0].pgtoStatus).toBe('Pago');
    expect(DB.almocos[1].pgtoStatus).toBe('Pendente');
  });
});

describe('validação de escrita no escopo', () => {
  const trechoPresenca = slice('async function savePresenca(', 'async function editPresenca(');
  const trechoAlmoco = slice('async function saveAlmoco(', 'async function editAlmoco(');
  const trechoTrab = slice('async function saveTrabalhador(', 'async function editTrabalhador(');

  it('savePresenca e saveAlmoco rejeitam obra fora do escopo', () => {
    expect(trechoPresenca).toContain('if (!obraNoEscopoAtual(obraVal))');
    expect(trechoPresenca).toContain('window.trabNaObra(t, obraVal)');
    expect(trechoAlmoco).toContain('if (!obraNoEscopoAtual(obraVal))');
    expect(trechoAlmoco).toContain('window.trabNaObra(trabalhador, obraVal)');
  });

  it('os quadros não associam registro de obra à qual o trabalhador não pertence', () => {
    const quadroAlmocos = slice('function renderQuadroAlmocos()', 'async function openAlmocoModal(');
    const quadroPresenca = slice('function renderQuadroSemanal()', 'function openPresenceModal(');
    expect(quadroAlmocos).toContain('window.trabNaObra(w, a.obra)');
    expect(quadroPresenca).toContain('window.trabNaObra(w, record.obra)');
  });

  it('saveTrabalhador normaliza e valida as obras vinculadas', () => {
    expect(trechoTrab).toContain('window.parseObrasTrabalhador({ obras: obrasDigitadas })');
    expect(trechoTrab).toContain('obrasTrab.some(o => !escopoAtual.includes(o))');
    expect(trechoTrab).toContain("obras: obrasTrab.join(', ')");
  });
});
