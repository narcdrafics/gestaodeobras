// tests/almocos-usabilidade.test.js
// Almoços devem ter a mesma usabilidade de Presença: quadro semanal navegável,
// clique na célula pré-preenchido, busca/grupo/ordenação e fechamentos.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const appSrc = read('public/js/app_core.js');
const pagina = read('public/pages/almocos.html');
const presenca = read('public/pages/presenca.html');

function elem(opcoes = {}) {
  return {
    innerHTML: '',
    value: opcoes.value || '',
    style: {},
    innerText: opcoes.text || '',
    options: opcoes.options || [],
    classList: { contains: (c) => (opcoes.classes || []).includes(c) },
    querySelectorAll: (sel) => (opcoes.rows || []).filter(r => !sel.includes('group-header') || r.classList.contains('group-header'))
  };
}

function carregarModulo(DB, elementos = {}, retornos = {}) {
  const inicio = appSrc.indexOf('// ==================== ALMOÇOS ====================');
  const fim = appSrc.indexOf('function calcAlmocoTotal()');
  const codigo = appSrc.slice(inicio, fim);
  const els = {
    'almoco-quadro-semanal': elem(),
    'almocos-tbody': elem(),
    'almocos-kpi': elem(),
    'almocos-resumo': elem(),
    'almocos-empreiteiro': elem(),
    'almocos-pgto-pendentes': elem(),
    'almoco-busca': elem(),
    'almoco-group-select': elem({ value: '' }),
    'almoco-sort-select': elem({ value: 'data_desc' }),
    'al-data': elem(),
    'al-empreiteiro': elem(),
    'al-obra': elem({ options: [{ value: 'OB1' }] }),
    ...elementos
  };
  const document = { getElementById: (id) => els[id] || null };
  const win = {
    parseObrasTrabalhador: (t) => String((t && t.obras) || '').split(/[,;]/).map(s => s.trim()).filter(Boolean)
  };
  win.trabNaObra = (t, cod) => {
    const obras = win.parseObrasTrabalhador(t);
    return !obras.length || obras.includes(String(cod || '').trim());
  };
  const editAlmoco = retornos.editAlmoco || vi.fn();
  const persistDB = retornos.persistDB || vi.fn(async () => {});
  const toast = retornos.toast || vi.fn();
  const openModal = retornos.openModal || vi.fn(async () => {});
  const confirmar = retornos.confirmar === undefined ? true : retornos.confirmar;

  new Function(
    'window', 'document', 'DB', 'escHtml', 'fmt', 'fmtDate', 'obName', 'statusBadge',
    'toast', 'persistDB', 'openModal', 'editAlmoco', 'toggleAlmocoModo',
    'escopoObrasDaSessao', 'obraNoEscopoAtual', 'trabNoEscopoAtual', 'trabsNoEscopoAtual',
    'confirm', 'setTimeout', codigo
  )(
    win, document, DB,
    (v) => String(v == null ? '' : v),
    (v) => `R$ ${Number(v) || 0}`,
    (v) => String(v || ''),
    (v) => (v === 'OB1' ? 'Obra Um' : String(v || '')),
    (v) => `<span class="badge">${v || '—'}</span>`,
    toast, persistDB, openModal, editAlmoco, vi.fn(),
    () => null, () => true, () => true, (lista) => (lista || []).filter(Boolean),
    (typeof confirmar === 'function' ? confirmar : () => confirmar), (fn) => fn()
  );
  return { win, els, editAlmoco, persistDB, toast, openModal };
}

function dbBase() {
  return {
    obras: [{ cod: 'OB1', nome: 'Obra Um' }],
    trabalhadores: [
      { cod: 'T1', nome: 'João', status: 'Ativo', equipe: 'Alvenaria', obras: 'OB1' },
      { cod: 'T2', nome: 'Maria', status: 'Ativo', equipe: 'Pintura', obras: 'OB1' }
    ],
    almocos: []
  };
}

describe('almocos — contrato da página', () => {
  it('espelha a toolbar de Presença (semana, busca, grupo e ordenação)', () => {
    for (const trecho of ['changeAlmocoWeek(-1)', 'changeAlmocoWeek(1)', 'fecharSemanaAlmocos()',
      'filterAlmoco(this.value)', 'id="almoco-group-select"', 'id="almoco-sort-select"',
      'id="almoco-quadro-semanal"', 'id="almocos-tbody"']) {
      expect(pagina).toContain(trecho);
    }
    for (const id of ['pres-busca', 'pres-group-select', 'pres-sort-select']) {
      expect(presenca).toContain(`id="${id}"`);
    }
  });

  it('mantém os três fechamentos e o CSS responsivo do quadro', () => {
    for (const id of ['almocos-resumo', 'almocos-empreiteiro', 'almocos-pgto-pendentes']) {
      expect(pagina).toContain(`id="${id}"`);
    }
    expect(pagina).toContain('.almoco-board');
    expect(pagina).toContain('position: sticky');
    expect(pagina).toContain('@media (max-width: 767px)');
    expect(pagina).toContain('@media (max-width: 480px)');
  });
});

describe('almocos — quadro semanal', () => {
  it('gera 7 dias de segunda a domingo e navega de 7 em 7 dias', () => {
    const { win } = carregarModulo(dbBase());
    const dias = win.getAlmocoWeekDates();
    expect(dias).toHaveLength(7);
    expect(dias.map(d => d.name)).toEqual(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']);
    const primeiro = dias[0].date;
    win.changeAlmocoWeek(-1);
    const anterior = win.getAlmocoWeekDates()[0].date;
    const diff = (new Date(primeiro) - new Date(anterior)) / 86400000;
    expect(diff).toBe(7);
    win.changeAlmocoWeek(1);
    expect(win.getAlmocoWeekDates()[0].date).toBe(primeiro);
  });

  it('renderiza células clicáveis com ícone de status por trabalhador/dia', () => {
    const DB = dbBase();
    const { win, els } = carregarModulo(DB);
    const dia = win.getAlmocoWeekDates()[0].date;
    DB.almocos.push({ data: dia, obra: 'OB1', empreiteiro: 'João', qtd: 2, vunit: 20, vtotal: 40, pgtoStatus: 'Pago', valpago: 40 });
    win.renderQuadroAlmocos();
    const html = els['almoco-quadro-semanal'].innerHTML;
    expect(html).toContain('class="almoco-board"');
    expect(html).toContain("openAlmocoModal('T1', '" + dia + "', 0)");
    expect(html).toContain('check_circle');
    expect(html).toContain('2 ref.');
    expect(html).toContain('Maria'); // linha sem registro continua clicável
    expect(html).toContain("openAlmocoModal('T2', '" + dia + "', -1)");
    expect(html).toContain('more_horiz');
  });

  it('abre o modal pré-preenchido e usa edição quando a célula já tem lançamento', async () => {
    const DB = dbBase();
    const { win, els, editAlmoco, openModal } = carregarModulo(DB);
    const dia = win.getAlmocoWeekDates()[2].date;
    win.openAlmocoModal('T1', dia, 4);
    expect(editAlmoco).toHaveBeenCalledWith(4);
    expect(openModal).not.toHaveBeenCalled();

    await win.openAlmocoModal('T1', dia);
    expect(openModal).toHaveBeenCalledWith('modal-almoco');
    expect(els['al-data'].value).toBe(dia);
    expect(els['al-empreiteiro'].value).toBe('João');
    expect(els['al-obra'].value).toBe('OB1');
  });
});

describe('almocos — lista, filtros e fechamentos', () => {
  it('ordena por data e agrupa por empreiteiro/obra', () => {
    const DB = dbBase();
    DB.almocos = [
      { data: '2026-11-20', obra: 'OB1', empreiteiro: 'João', qtd: 1, vtotal: 20 },
      { data: '2026-11-22', obra: 'OB1', empreiteiro: 'Maria', qtd: 2, vtotal: 40 }
    ];
    const { win, els } = carregarModulo(DB);
    win.renderAlmocos();
    let html = els['almocos-tbody'].innerHTML;
    expect(html.indexOf('2026-11-22')).toBeLessThan(html.indexOf('2026-11-20')); // desc

    els['almoco-sort-select'].value = 'data_asc';
    els['almoco-group-select'].value = 'empreiteiro';
    win.renderAlmocos();
    html = els['almocos-tbody'].innerHTML;
    expect(html.indexOf('2026-11-20')).toBeLessThan(html.indexOf('2026-11-22')); // asc
    expect(html).toContain('group-header');
    expect(html.indexOf('João')).toBeLessThan(html.indexOf('Maria'));
  });

  it('filterAlmoco esconde linhas e cabeçalhos de grupos vazios', () => {
    const linha1 = elem({ text: 'joão obra um' });
    const linha2 = elem({ text: 'maria obra um' });
    const cabecalhoJoao = elem({ classes: ['group-header'], text: 'João' });
    const cabecalhoMaria = elem({ classes: ['group-header'], text: 'Maria' });
    cabecalhoJoao.nextElementSibling = linha1;
    linha1.nextElementSibling = cabecalhoMaria;
    cabecalhoMaria.nextElementSibling = linha2;
    const tbody = elem({ rows: [cabecalhoJoao, linha1, cabecalhoMaria, linha2] });
    const { win } = carregarModulo(dbBase(), { 'almocos-tbody': tbody });
    win.filterAlmoco('maria');
    expect(linha1.style.display).toBe('none');
    expect(linha2.style.display).toBe('');
    expect(cabecalhoJoao.style.display).toBe('none');
    expect(cabecalhoMaria.style.display).toBe('');
    win.filterAlmoco('');
    expect(cabecalhoJoao.style.display).toBe('');
    expect(linha1.style.display).toBe('');
  });

  it('KPIs e fechamentos acompanham a semana navegada', () => {
    const DB = dbBase();
    const atual = new Date();
    const seg = new Date(atual);
    seg.setDate(atual.getDate() - ((atual.getDay() + 6) % 7));
    const fmtDia = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const anterior = new Date(seg); anterior.setDate(seg.getDate() - 7);
    DB.almocos = [
      { data: fmtDia(seg), obra: 'OB1', empreiteiro: 'João', qtd: 1, vunit: 20, vtotal: 20, pgtoStatus: 'Pendente' },
      { data: fmtDia(anterior), obra: 'OB1', empreiteiro: 'Maria', qtd: 9, vunit: 20, vtotal: 180, pgtoStatus: 'Pago', valpago: 180 }
    ];
    const { win, els } = carregarModulo(DB);
    win.renderAlmocos();
    expect(els['almocos-kpi'].innerHTML).toContain('1 un');
    expect(els['almocos-empreiteiro'].innerHTML).toContain('João');
    expect(els['almocos-resumo'].innerHTML).toContain('Obra Um');
    expect(els['almocos-pgto-pendentes'].innerHTML).toContain('R$ 20');

    win.changeAlmocoWeek(-1);
    expect(els['almocos-kpi'].innerHTML).toContain('9 un');
    expect(els['almocos-empreiteiro'].innerHTML).toContain('Maria');
    expect(els['almocos-pgto-pendentes'].innerHTML).toContain('Nenhum pagamento pendente');
  });

  it('fechamento em lote só fecha pendentes da semana e persiste', async () => {
    const DB = dbBase();
    const dias = (() => {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      const ini = new Date(d); ini.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return [ini, ...Array.from({ length: 6 }, (_, i) => { const x = new Date(ini); x.setDate(ini.getDate() + i + 1); return x; })];
    })();
    const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    DB.almocos = [
      { data: iso(dias[0]), obra: 'OB1', empreiteiro: 'João', qtd: 2, vtotal: 40, pgtoStatus: 'Pendente' },
      { data: iso(dias[1]), obra: 'OB1', empreiteiro: 'Maria', qtd: 1, vtotal: 20, pgtoStatus: 'Pago', valpago: 20 }
    ];
    const { win, persistDB } = carregarModulo(DB);
    await win.fecharSemanaAlmocos();
    expect(DB.almocos[0].pgtoStatus).toBe('Pago');
    expect(DB.almocos[0].valpago).toBe(40);
    expect(DB.almocos[1].pgtoStatus).toBe('Pago');
    expect(persistDB).toHaveBeenCalled();

    const cancelado = carregarModulo(dbBase(), {}, { confirmar: false });
    expect(cancelado.persistDB).not.toHaveBeenCalled();
  });
});
