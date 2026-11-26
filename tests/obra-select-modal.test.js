// tests/obra-select-modal.test.js
// Todo modal com campo de obra deve oferecer o dropdown de códigos (admin) e
// pré-selecionar a obra quando o usuário tem acesso a uma única obra.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const appSrc = read('public/js/app_core.js');
const modalTrab = read('public/modals/modal-trabalhador.html');

class SelectFake {
  constructor() {
    this._html = '';
    this.options = [];
    this.value = '';
    this.multiple = true;
    this.disabled = false;
    this.dispatchEvent = vi.fn();
  }
  set innerHTML(html) {
    this._html = html;
    this.options = [...html.matchAll(/<option value="([^"]*)"/g)].map(m => ({ value: m[1], selected: false }));
    this.value = this.options.length ? this.options[0].value : ''; // navegador seleciona a 1ª
  }
  get innerHTML() { return this._html; }
  get selectedOptions() { return this.options.filter(o => o.selected); }
}

function carregarHelpers(escopo, obras) {
  const inicio = appSrc.indexOf('// ==================== ESCOPO DE OBRAS DA SESSÃO ====================');
  const fim = appSrc.indexOf('// ==================== SYSTEM GLOBALS (ANTI-REFERENCE ERROR) ====================');
  const codigo = appSrc.slice(inicio, fim) +
    '\nreturn { prepararSelectsDeObra, lerObrasDoFormTrabalhador, syncTrabObrasHint };';

  const selects = [new SelectFake(), new SelectFake()];
  const trObras = new SelectFake();
  const modalContent = { querySelectorAll: () => selects };
  const document = { getElementById: (id) => (id === 'tr-obras' ? trObras : null) };
  const win = {
    getObrasPermitidas: () => escopo,
    obraNoEscopo: (obra, permitidas) => !Array.isArray(permitidas) || permitidas.includes(String(obra)),
    trabNoEscopo: () => true,
    trabalhadoresNoEscopo: (lista) => lista
  };
  const api = new Function('window', 'document', 'DB', 'sessionStorage', codigo)(
    win, document, { obras, usuarios: [] }, { getItem: () => JSON.stringify({ email: 'u@x.com', role: 'engenheiro' }) }
  );
  return { ...api, selects, trObras, modalContent };
}

const obras = [
  { cod: 'OB1', nome: 'Obra Um' },
  { cod: 'OB2', nome: 'Obra Dois' }
];

describe('selects de obra nos modais', () => {
  it('admin recebe o dropdown com todos os códigos de obra', () => {
    const { prepararSelectsDeObra, selects, trObras } = carregarHelpers(null, obras);
    prepararSelectsDeObra({ querySelectorAll: () => selects });
    for (const sel of selects) {
      expect(sel.innerHTML).toContain('OB1 — Obra Um');
      expect(sel.innerHTML).toContain('OB2 — Obra Dois');
      expect(sel.disabled).toBe(false);
    }
    expect(trObras.options.map(o => o.value)).toEqual(['OB1', 'OB2']);
  });

  it('usuário com uma obra já sai com o código selecionado e campo travado', () => {
    const { prepararSelectsDeObra, selects, trObras } = carregarHelpers(['OB1'], obras);
    prepararSelectsDeObra({ querySelectorAll: () => selects });
    for (const sel of selects) {
      expect(sel.options.map(o => o.value)).toEqual(['OB1']);
      expect(sel.value).toBe('OB1');
      expect(sel.disabled).toBe(true);
      expect(sel.dispatchEvent).toHaveBeenCalled(); // dispara onchange (pr-obra, al-obra, md-obra...)
    }
    expect(trObras.selectedOptions.map(o => o.value)).toEqual(['OB1']);
    expect(trObras.disabled).toBe(true);
  });

  it('inclui o código permitido mesmo se a obra não estiver cadastrada na lista', () => {
    const { prepararSelectsDeObra, selects } = carregarHelpers(['OB99'], []);
    prepararSelectsDeObra({ querySelectorAll: () => selects });
    expect(selects[0].value).toBe('OB99');
    expect(selects[0].disabled).toBe(true);
  });
});

describe('campo Obra(s) do trabalhador', () => {
  it('o modal oferece um dropdown de códigos com seleção múltipla', () => {
    expect(modalTrab).toMatch(/<select[^>]*id="tr-obras"[^>]*multiple[^>]*>/);
    expect(modalTrab).toContain('id="tr-obras-hint"');
  });

  it('lê todas as obras selecionadas no multi-select', () => {
    const { lerObrasDoFormTrabalhador, trObras } = carregarHelpers(null, obras);
    const document = { getElementById: (id) => (id === 'tr-obras' ? trObras : null) };
    const ler = new Function('document',
      appSrc.slice(appSrc.indexOf('function lerObrasDoFormTrabalhador()'),
        appSrc.indexOf('function syncTrabObrasHint()')) + '\nreturn lerObrasDoFormTrabalhador;')(document);
    trObras.innerHTML = '<option value="OB1"></option><option value="OB2"></option>';
    trObras.options[0].selected = true;
    trObras.options[1].selected = true;
    expect(ler()).toBe('OB1, OB2');
  });

  it('mantém compatibilidade com campo de texto legado', () => {
    const ler = new Function('document',
      appSrc.slice(appSrc.indexOf('function lerObrasDoFormTrabalhador()'),
        appSrc.indexOf('function syncTrabObrasHint()')) + '\nreturn lerObrasDoFormTrabalhador;')(
      { getElementById: () => ({ value: 'OB1, OB2' }) }
    );
    expect(ler()).toBe('OB1, OB2');
  });

  it('saveTrabalhador lê o multi-select e editTrabalhador marca as opções', () => {
    const trechoSave = appSrc.slice(appSrc.indexOf('async function saveTrabalhador('),
      appSrc.indexOf('async function editTrabalhador('));
    const trechoEdit = appSrc.slice(appSrc.indexOf('async function editTrabalhador('),
      appSrc.indexOf('async function editPresenca('));
    expect(trechoSave).toContain('lerObrasDoFormTrabalhador()');
    expect(trechoEdit).toContain('Array.from(trObrasEl.options)');
    expect(trechoEdit).toContain('o.selected = codigos.includes(o.value)');
  });
});
