// Marca d'água: texto = nome da empresa, com interruptores independentes para
// o fundo do app e para relatórios/impressões (feature `relatorio.marca`).
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const data = read('public/js/data_core.js');
const app = read('public/js/app_core.js');
const admin = read('public/pages/admin.html');
const css = read('public/css/app.css');

const slice = (src, inicio, fim) => src.slice(src.indexOf(inicio), src.indexOf(fim));

function makeBody() {
  const attrs = new Map();
  return {
    style: {},
    setAttribute(k, v) { attrs.set(k, String(v)); },
    removeAttribute(k) { attrs.delete(k); },
    getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; }
  };
}

// Avalia só as funções da marca d'água, com document/window mockados.
function makeMarca(featureAllowed = true, cfgFromDB = null) {
  const src = slice(data, 'function _escaparTextoSvg', '// SaaS: Inicialização de contexto por subdomínio');
  const chamadas = [];
  const windowMock = {
    requireFeature: (feature) => { chamadas.push(feature); return featureAllowed; }
  };
  const documentMock = { body: makeBody() };
  const factory = new Function('window', 'document', 'DB',
    `${src}\nreturn { aplicarMarcaDagua, cssMarcaDaguaImpressao, _escaparTextoSvg };`);
  const helpers = factory(windowMock, documentMock, { config: cfgFromDB });
  return { ...helpers, body: documentMock.body, chamadas };
}

function makeSaveConfig(featureAllowed = true) {
  const src = slice(app, 'function saveConfig()', '// ---- Acesso por obra (modal de usuário)');
  const DB = { config: { nomeEmpresa: 'Antiga' } };
  const els = {
    'cfg-empresa': { value: 'Nova Empresa' },
    'cfg-esquema': { value: 'emerald' },
    'cfg-tema': { value: 'dark' },
    'cfg-slug': { value: ' Minha Obra ' },
    'cfg-logo-url': { value: '' },
    'cfg-marca-app': { checked: true },
    'cfg-marca-relatorios': { checked: false }
  };
  const persistDB = vi.fn();
  const loadTheme = vi.fn();
  const toast = vi.fn();
  const chamadas = [];
  const windowMock = {
    requireFeature: (feature) => { chamadas.push(feature); return featureAllowed; }
  };
  const factory = new Function('DB', 'document', 'window', 'loadTheme', 'persistDB', 'toast',
    `${src}\nreturn saveConfig;`);
  const saveConfig = factory(
    DB,
    { getElementById: (id) => els[id] || null },
    windowMock,
    loadTheme,
    persistDB,
    toast
  );
  return { saveConfig, DB, els, persistDB, loadTheme, toast, chamadas };
}

describe('configuração padrão e integração', () => {
  it('começa desligada e é aplicada junto com o tema', () => {
    const cfgInicial = slice(data, 'const staticDB', '  usuarios: []');
    expect(cfgInicial).toContain('marcaDaguaApp: false');
    expect(cfgInicial).toContain('marcaDaguaRelatorios: false');

    const loadThemeSrc = slice(data, 'function loadTheme(', "// Marca d'água: texto = nome da empresa");
    expect(loadThemeSrc).toContain('aplicarMarcaDagua(cfg);');
  });

  it('admin expõe os dois interruptores dentro do card de relatorio.marca', () => {
    expect(admin).toContain('data-feature="relatorio.marca"');
    expect(admin).toContain('id="cfg-marca-app"');
    expect(admin).toContain('id="cfg-marca-relatorios"');
    expect(admin.indexOf('id="cfg-marca-app"')).toBeGreaterThan(admin.indexOf('data-feature="relatorio.marca"'));

    const renderSrc = slice(app, 'function renderAdmin()', '// ==================== FOTOS');
    expect(renderSrc).toContain("marcaApp.checked = cfg.marcaDaguaApp === true");
    expect(renderSrc).toContain("marcaRel.checked = cfg.marcaDaguaRelatorios === true");
  });

  it('saveConfig grava os dois estados e reaplica o tema', () => {
    const ctx = makeSaveConfig();
    ctx.saveConfig();

    expect(ctx.DB.config.marcaDaguaApp).toBe(true);
    expect(ctx.DB.config.marcaDaguaRelatorios).toBe(false);
    expect(ctx.DB.config.nomeEmpresa).toBe('Nova Empresa');
    expect(ctx.chamadas).toContain('relatorio.marca');
    expect(ctx.loadTheme).toHaveBeenCalledOnce();
    expect(ctx.persistDB).toHaveBeenCalledOnce();
  });

  it('saveConfig não salva marca sem a feature do plano', () => {
    const ctx = makeSaveConfig(false);
    ctx.saveConfig();

    expect(ctx.DB.config).toEqual({ nomeEmpresa: 'Antiga' });
    expect(ctx.persistDB).not.toHaveBeenCalled();
    expect(ctx.toast).not.toHaveBeenCalled();
  });

  it('config antigas sem os checkboxes desligam a marca', () => {
    const ctx = makeSaveConfig();
    delete ctx.els['cfg-marca-app'];
    delete ctx.els['cfg-marca-relatorios'];
    ctx.saveConfig();

    expect(ctx.DB.config.marcaDaguaApp).toBe(false);
    expect(ctx.DB.config.marcaDaguaRelatorios).toBe(false);
  });
});

describe('aplicarMarcaDagua', () => {
  it('desenha o nome da empresa no fundo e marca os relatórios', () => {
    const ctx = makeMarca();
    const nome = 'Construtora & <Alfa> "X"';
    ctx.aplicarMarcaDagua({ nomeEmpresa: nome, marcaDaguaApp: true, marcaDaguaRelatorios: true });

    expect(ctx.body.getAttribute('data-watermark-print')).toBe(nome);
    expect(ctx.body.style.backgroundImage).toContain('url("data:image/svg+xml,');
    expect(ctx.body.style.backgroundRepeat).toBe('repeat');
    expect(ctx.body.style.backgroundSize).toBe('420px 220px');

    const svg = decodeURIComponent(ctx.body.style.backgroundImage.split('data:image/svg+xml,')[1].replace(/\)$/, '').replace(/^"/, ''));
    expect(svg).toContain('Construtora &amp; &lt;Alfa&gt; &quot;X&quot;'); // escapa XML
    expect(svg).toContain('fill-opacity="0.055"'); // leve, não atrapalha leitura
    expect(svg).toContain('rotate(-30 210 110)'); // diagonal
  });

  it('os interruptores são independentes', () => {
    const appOnly = makeMarca();
    appOnly.aplicarMarcaDagua({ nomeEmpresa: 'Alfa', marcaDaguaApp: true, marcaDaguaRelatorios: false });
    expect(appOnly.body.style.backgroundImage).toContain('data:image/svg+xml');
    expect(appOnly.body.getAttribute('data-watermark-print')).toBeNull();

    const relOnly = makeMarca();
    relOnly.aplicarMarcaDagua({ nomeEmpresa: 'Alfa', marcaDaguaApp: false, marcaDaguaRelatorios: true });
    expect(relOnly.body.getAttribute('data-watermark-print')).toBe('Alfa');
    expect(relOnly.body.style.backgroundImage).toBe('');
  });

  it('respeita o plano e exige nome da empresa', () => {
    const bloqueado = makeMarca(false);
    bloqueado.aplicarMarcaDagua({ nomeEmpresa: 'Alfa', marcaDaguaApp: true, marcaDaguaRelatorios: true });
    expect(bloqueado.chamadas).toContain('relatorio.marca');
    expect(bloqueado.body.getAttribute('data-watermark-print')).toBeNull();
    expect(bloqueado.body.style.backgroundImage).toBe('');

    const semNome = makeMarca();
    semNome.aplicarMarcaDagua({ nomeEmpresa: '   ', marcaDaguaApp: true, marcaDaguaRelatorios: true });
    expect(semNome.body.getAttribute('data-watermark-print')).toBeNull();
    expect(semNome.body.style.backgroundImage).toBe('');
  });

  it('o CSS de impressão é o mesmo usado pelo app e pela janela do relatório', () => {
    const ctx = makeMarca();
    const impressao = ctx.cssMarcaDaguaImpressao();
    for (const trecho of [
      'body[data-watermark-print]::before',
      'content:attr(data-watermark-print)',
      'rotate(-30deg)',
      'color:rgba(0,0,0,.06)',
      'print-color-adjust:exact'
    ]) {
      expect(impressao).toContain(trecho);
    }
  });
});

describe('impressão', () => {
  it('o @media print do app desenha a marca sem usar a imagem de fundo', () => {
    const printBlock = slice(css, '@media print {', '.hide-mobile');
    expect(printBlock).toContain('body { background: #fff !important; color: #000 !important; }');
    expect(printBlock).toContain('body[data-watermark-print]::before');
    expect(printBlock).toContain('content: attr(data-watermark-print)');
    expect(printBlock).toContain('rotate(-30deg)');
    expect(printBlock).toContain('rgba(0, 0, 0, .06)');
  });

  it('exportHoje injeta a marca na janela própria de impressão', () => {
    const exportFn = slice(app, 'window.exportHoje = function exportHoje()', '// ==================== OBRAS');
    expect(exportFn).toContain("window.requireFeature('relatorio.marca')");
    expect(exportFn).toContain('wmCss +');
    expect(exportFn).toContain("'<body' + wmAttr + '>'");

    const preamble = slice(app, "  // Marca d'água do relatório diário", '  // Custos do dia com valores históricos gravados');
    const cssChamadas = [];
    const run = (cfg, permitido) => new Function('DB', 'window', `${preamble}\nreturn { wmCss, wmAttr };`)(
      { config: cfg },
      {
        requireFeature: () => permitido,
        cssMarcaDaguaImpressao: () => { cssChamadas.push(true); return 'CSS_DA_MARCA'; }
      }
    );

    const ligado = run(
      { nomeEmpresa: 'Construtora & <Alfa>', marcaDaguaApp: false, marcaDaguaRelatorios: true },
      true
    );
    expect(ligado.wmCss).toBe('<style>CSS_DA_MARCA</style>');
    expect(cssChamadas).toHaveLength(1);
    expect(ligado.wmAttr).toContain('data-watermark-print="Construtora &amp; &lt;Alfa>"');

    const desligado = run(
      { nomeEmpresa: 'Alfa', marcaDaguaApp: true, marcaDaguaRelatorios: false },
      true
    );
    expect(desligado.wmCss).toBe('');
    expect(desligado.wmAttr).toBe('');

    const semPlano = run(
      { nomeEmpresa: 'Alfa', marcaDaguaApp: true, marcaDaguaRelatorios: true },
      false
    );
    expect(semPlano.wmCss).toBe('');
    expect(semPlano.wmAttr).toBe('');
  });

  it('app e HTML servem a mesma versão de cache dos scripts', () => {
    expect(app).toContain("const HTML_CACHE_VERSION = '20261126014';");
    for (const html of ['public/app.html', 'public/login.html', 'public/admin-login.html']) {
      expect(read(html)).toContain('?v=20261126014');
    }
  });
});
