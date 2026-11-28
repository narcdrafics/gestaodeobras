// tests/fechamento-lote-obra.test.js
// O fechamento de folha em lote precisa respeitar a obra de cada lançamento.
// Códigos de trabalhador podem se repetir entre obras (importações antigas),
// então agrupar só por `trab` atribui o salário de um funcionário a outro.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const appSrc = read('public/js/app_core.js');
const modal = read('public/modals/modal-lote.html');
const codigo = appSrc.slice(
  appSrc.indexOf('// ==================== LOTE DE PAGAMENTO (FOLHA) ===================='),
  appSrc.indexOf('async function saveTarefa(')
);

function elemento(valor = '') {
  return {
    value: valor,
    innerHTML: '',
    textContent: '',
    style: {},
    options: [],
    classList: { contains: () => false }
  };
}

function carregar(DB, { obraPresenca = '', modalAberto = false, escopo = null } = {}) {
  const els = {
    'modal-container': { classList: { contains: () => modalAberto } },
    'pres-obra-filtro': elemento(obraPresenca),
    'lote-periodo': elemento('semana'),
    'lote-obra-filtro': elemento(''),
    'lote-custom-dates': elemento(),
    'lote-data-ini': elemento('2026-11-01'),
    'lote-data-fim': elemento('2026-11-30'),
    'lote-tbody': elemento(),
    'lote-total-sel': elemento()
  };
  const document = {
    getElementById: (id) => els[id] || null,
    querySelector: () => null,
    querySelectorAll: () => []
  };
  const win = {
    escHtml: (v) => String(v == null ? '' : v),
    obName: (cod) => (cod === 'OB1' ? 'Obra Um' : String(cod || ''))
  };
  const popularFiltroObra = (id) => {
    const el = els[id];
    if (!el) return;
    const atual = el.value;
    el.innerHTML = '<option value="">Todas as obras</option>' +
      (DB.obras || []).map(o => `<option value="${o.cod}">${o.nome}</option>`).join('');
    el.options = [{ value: '' }, ...(DB.obras || []).map(o => ({ value: o.cod }))];
    if (atual && el.options.some(o => o.value === atual)) el.value = atual;
  };
  const obraFiltroTela = (id) => (els[id] ? String(els[id].value || '').trim() : '');
  const openModal = vi.fn(async () => {});
  const toast = vi.fn();

  new Function(
    'window', 'document', 'DB', 'openModal', 'toast', 'fmt', 'getCurrentWeekDates',
    'obraNoEscopoAtual', 'popularFiltroObra', 'obraFiltroTela',
    codigo
  )(win, document, DB, openModal, toast, (v) => `R$ ${v}`,
    () => ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'],
    (obra) => escopo === null || escopo.includes(String(obra || '').trim()),
    popularFiltroObra, obraFiltroTela);

  return { win, els, openModal, toast };
}

const presencasConflitantes = () => [
  { data: '2026-11-25', obra: 'OB1', trab: 'TR002', nome: 'Valdenir', funcao: 'Ajudante', total: 70, pgtoStatus: 'Pendente' },
  { data: '2026-11-25', obra: 'OB004', trab: 'TR002', nome: 'Jakson Pereira', funcao: 'Encaregado', total: 3500, pgtoStatus: 'Pendente' }
];

describe('fechamento em lote por obra', () => {
  it('não mistura trabalhadores de obras diferentes com o mesmo código', async () => {
    const DB = { obras: [{ cod: 'OB1', nome: 'Obra Um' }, { cod: 'OB004', nome: 'Pindaí' }], presenca: presencasConflitantes() };
    const { win } = carregar(DB);
    await win.prepareLotePgto('todas');

    expect(win.lotePendentes).toHaveLength(2);
    const valdenir = win.lotePendentes.find(s => s.nome === 'Valdenir');
    const jakson = win.lotePendentes.find(s => s.nome === 'Jakson Pereira');
    expect(valdenir.valor).toBe(70);
    expect(valdenir.obra).toBe('OB1');
    expect(jakson.valor).toBe(3500);
    expect(jakson.obra).toBe('OB004');
  });

  it('herda a obra da tela de presença e mantém a escolha ao trocar o período', async () => {
    const DB = { obras: [{ cod: 'OB1', nome: 'Obra Um' }, { cod: 'OB004', nome: 'Pindaí' }], presenca: presencasConflitantes() };
    const { win, els } = carregar(DB, { obraPresenca: 'OB1' });
    await win.prepareLotePgto('todas');
    expect(els['lote-obra-filtro'].value).toBe('OB1');
    expect(win.lotePendentes.map(s => s.nome)).toEqual(['Valdenir']);

    // Trocar o select acontece com o modal aberto: a obra escolhida prevalece.
    els['modal-container'].classList.contains = () => true;
    els['lote-obra-filtro'].value = 'OB004';
    await win.prepareLotePgto('quinzenal');
    expect(win.lotePendentes.map(s => s.nome)).toEqual(['Jakson Pereira']);
  });

  it('ignora pendências fora do escopo e mostra a obra em cada linha', async () => {
    const DB = { obras: [{ cod: 'OB1', nome: 'Obra Um' }, { cod: 'OB004', nome: 'Pindaí' }], presenca: presencasConflitantes() };
    const { win, els } = carregar(DB, { escopo: ['OB1'] });
    await win.prepareLotePgto('todas');
    expect(win.lotePendentes.map(s => s.nome)).toEqual(['Valdenir']);
    win.renderLoteTbody();
    expect(els['lote-tbody'].innerHTML).toContain('Obra Um');
    expect(els['lote-tbody'].innerHTML).toContain('Valdenir');
    expect(els['lote-tbody'].innerHTML).not.toContain('Jakson Pereira');
  });

  it('o modal oferece filtro de obra e coluna de obra', () => {
    expect(modal).toContain('id="lote-obra-filtro"');
    expect(modal).toContain('onchange="changeLoteObra()"');
    expect(modal).toContain('<th>Obra</th>');
  });
});
