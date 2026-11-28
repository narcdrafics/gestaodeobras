// tests/compras-segregacao.test.js
// Compras: dados comerciais fora do nó do tenant, visíveis só para
// admin/super_admin/comprador. Engenheiro e encarregado veem quantidade,
// material, recebimento, conferência, status e evidência — nada de preço,
// fornecedor, PIX ou prazo.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const moduloSrc = read('public/js/compras_ui.js');
const appSrc = read('public/js/app_core.js');
const appHtml = read('public/app.html');
const pagina = read('public/pages/compras.html');
const modal = read('public/modals/modal-compra.html');
const rules = JSON.parse(read('database.rules.json'));

const SENSITIVE = ['forn', 'pixkey', 'vunit', 'vtotal', 'vorc', 'prazo'];

/** Carrega o módulo num sandbox mínimo e devolve a API pública em `window`. */
function carregarModulo(role) {
  const win = { addEventListener: vi.fn() };
  const doc = { readyState: 'complete', addEventListener: vi.fn() };
  const session = { getItem: vi.fn(() => JSON.stringify({ role, tenantId: 't1' })) };
  const listeners = [];
  const firebase = {
    database: () => ({
      ref: () => ({
        on: (evento, cb) => { if (evento === 'value') listeners.push(cb); },
        off: vi.fn(),
        update: vi.fn(async () => {})
      })
    })
  };
  new Function('window', 'document', 'sessionStorage', 'firebase', 'console', 'toast',
    'superAdminActiveTenant', moduloSrc
  )(win, doc, session, firebase, console, vi.fn(), undefined);
  return { win, listeners };
}

describe('compras — segregação dos dados comerciais', () => {
  it('remove todos os campos sensíveis do registro público', () => {
    const { win } = carregarModulo('admin');
    const completo = {
      id: 'CP1', num: 'CP1', mat: 'Cimento', qtd: 10, unid: 'sc',
      forn: 'Fornecedor', pixkey: 'chave', vunit: 32, vtotal: 320,
      vorc: 350, prazo: '2026-12-01', status: 'Aguardando'
    };
    const publico = win.compraPublica(completo);
    for (const campo of SENSITIVE) expect(publico).not.toHaveProperty(campo);
    expect(publico).toMatchObject({ id: 'CP1', mat: 'Cimento', qtd: 10, status: 'Aguardando' });
    expect(completo.forn).toBe('Fornecedor'); // não muta o original
  });

  it('só admin, super_admin e comprador podem ver/gravar os dados comerciais', () => {
    for (const role of ['admin', 'super_admin', 'comprador']) {
      expect(carregarModulo(role).win.podeVerDadosComerciais()).toBe(true);
    }
    for (const role of ['engenheiro', 'encarregado', 'mestre', 'pendente']) {
      expect(carregarModulo(role).win.podeVerDadosComerciais()).toBe(false);
    }
  });

  it('lê o valor do nó privado e só oferece fallback legado quando não há dado privado', () => {
    const { win, listeners } = carregarModulo('admin');
    expect(listeners.length).toBe(1);
    listeners[0]({ val: () => ({ CP1: { forn: 'Fornecedor Privado', vtotal: 999 } }) });

    expect(win.dadoComercial({ id: 'CP1', forn: 'Legado', vtotal: 1 }, 'forn'))
      .toBe('Fornecedor Privado');
    expect(win.dadoComercial({ id: 'CP1', forn: 'Legado' }, 'vtotal')).toBe(999);
    expect(win.dadoComercial({ id: 'CP2', forn: 'Legado' }, 'forn')).toBe('Legado');
    expect(win.dadoComercial({ num: 'CP1', prazo: '2026-01-01' }, 'prazo'))
      .toBe('2026-01-01');
    // Campo não sensível nunca consulta o nó privado.
    expect(win.dadoComercial({ qtd: 5 }, 'qtd')).toBe(5);
  });

  it('não abre listener de dados privados para papéis sem acesso', () => {
    const { win, listeners } = carregarModulo('encarregado');
    expect(win.podeVerDadosComerciais()).toBe(false);
    expect(listeners.length).toBe(0);
  });

  it('esconde os campos comerciais do modal para engenheiro/encarregado', () => {
    const { win } = carregarModulo('engenheiro');
    win.requerAprovacao = () => true; // aprovacoes_ui.js já carregado no app
    const botao = { style: {}, textContent: 'Salvar', onclick: null };
    const grupos = {};
    const alvo = {
      querySelector: (sel) => {
        if (sel === '#modal-compra button.btn-primary') return botao;
        const campo = SENSITIVE.find(c => sel === `#cp-${c}`);
        if (!campo) return null;
        const grupo = { style: {} };
        grupos[campo] = grupo;
        return { closest: () => grupo };
      }
    };
    win.prepareModalCompra(alvo);
    for (const campo of SENSITIVE) expect(grupos[campo].style.display).toBe('none');
    expect(botao.textContent).toBe('Enviar para aprovação');
    expect(typeof botao.onclick).toBe('function');
  });
});

describe('compras — fiação no app e regras', () => {
  it('carrega o módulo com cache-bust e inicializa ao abrir a página', () => {
    expect(appHtml).toContain('js/compras_ui.js?v=20261127001');
    expect(appSrc).toContain('window.prepareModalCompra(modalContent)');
    expect(appSrc).toContain('window.iniciarCompras()');
  });

  it('o cabeçalho da tabela é dinâmico e alinhado com as linhas', () => {
    expect(pagina).toContain('id="compras-head"');
    const render = appSrc.slice(
      appSrc.indexOf('function renderCompras('),
      appSrc.indexOf('async function verEvidenciaCompra(')
    );
    expect(render).toContain("const head = document.getElementById('compras-head')");
    expect(render).toContain('colunas.map(col => `<th>${col.titulo}</th>`)');
    expect(render).toContain("colunas.map(col => `<td>${col.celula(c, i)}</td>`)");
    expect(render).toContain("if (comercial)");
  });

  it('o papel restrito vê apenas quantidade, material, recebimento, conferência, status e evidência', () => {
    const render = appSrc.slice(
      appSrc.indexOf('function renderCompras('),
      appSrc.indexOf('async function verEvidenciaCompra(')
    );
    for (const titulo of ['Qtd.', 'Material/Serviço', 'Status', 'Recebido?', 'Conferido?', 'Evidência']) {
      expect(render).toContain(`titulo: '${titulo}'`);
    }
    // Os campos comerciais existem, mas somente dentro do ramo `if (comercial)`.
    const base = render.slice(0, render.indexOf('if (comercial)'));
    const comercial = render.slice(
      render.indexOf('if (comercial)'),
      render.indexOf("{ titulo: 'Recebido?'")
    );
    for (const campo of SENSITIVE) expect(base).not.toContain(`'${campo}'`);
    // Na tabela aparecem apenas fornecedor, total e prazo — PIX, unitário e
    // orçado ficam restritos ao modal de quem pode ver dados comerciais.
    expect(comercial).toContain("dadoComercial(c, 'forn')");
    expect(comercial).toContain("dadoComercial(c, 'vtotal')");
    expect(comercial).toContain("dadoComercial(c, 'prazo')");
    expect(comercial).not.toContain("'pixkey'");
    expect(comercial).not.toContain("'vunit'");
    expect(comercial).not.toContain("'vorc'");
    expect(appSrc).toContain("onclick=\"verEvidenciaCompra(${i})\"");
  });

  it('a ação de evidência abre a galeria filtrada pela obra da compra', () => {
    const fn = appSrc.slice(
      appSrc.indexOf('async function verEvidenciaCompra('),
      appSrc.indexOf('window.verEvidenciaCompra')
    );
    expect(fn).toContain("showPage('fotos')");
    expect(fn).toContain("filtro.value = c.obra");
  });

  it('o modal mantém os ids usados pela hidratação e peloprepare', () => {
    for (const campo of SENSITIVE) expect(modal).toContain(`id="cp-${campo}"`);
    expect(modal).toContain('id="cp-receb"');
    expect(modal).toContain('id="cp-conf"');
  });

  it('saveCompra grava o público via persistDB e o sensível em comprasPrivadas', () => {
    const fn = appSrc.slice(
      appSrc.indexOf('async function saveCompra('),
      appSrc.indexOf('async function editCompra(')
    );
    expect(fn).toContain('window.compraPublica');
    expect(fn).toContain('await persistDB()');
    expect(fn).toContain('window.salvarDadosComerciais');
    const desvio = fn.slice(fn.indexOf('desviarParaAprovacao'), fn.indexOf('const id ='));
    expect(desvio).toContain('const { forn, pixkey, vunit, vtotal, vorc, prazo, ...publicas } = data;');
    expect(desvio).toContain('compra: { ...publicas');
  });

  it('editCompra hidrata os campos comerciais pelo dado privado', () => {
    const fn = appSrc.slice(
      appSrc.indexOf('async function editCompra('),
      appSrc.indexOf('async function saveFinanceiro(')
    );
    expect(fn).toContain('window.dadoComercial');
    for (const campo of SENSITIVE) expect(fn).toContain(`'${campo}'`);
  });

  it('as rules mantêm compras e comprasPrivadas fora do alcance de engenheiro/encarregado', () => {
    const no = rules.rules.comprasPrivadas.$tenantId;
    for (const regra of [no['.read'], no['.write']]) {
      expect(regra).toContain("'admin'");
      expect(regra).toContain("'comprador'");
      expect(regra).not.toContain("'engenheiro'");
      expect(regra).not.toContain("'encarregado'");
      expect(regra).not.toContain("'mestre'");
    }
    expect(rules.rules.tenants.$tenantId.compras['.write']).toContain("'comprador'");
  });
});
