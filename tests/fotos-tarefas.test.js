// tests/fotos-tarefas.test.js
// Exibição de evidências: filtro de obra nas tarefas, galeria de fotos e
// lightbox precisam suportar o formato antigo (photoUrl) e o novo (photos).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const app = read('public/js/app_core.js');
const data = read('public/js/data_core.js');
const css = read('public/css/app.css');

const trecho = (inicio, tamanho) => {
  const i = app.indexOf(inicio);
  return i < 0 ? '' : app.slice(i, i + tamanho);
};

describe('filtro de obra nas tarefas', () => {
  it('repovoa o select de obras antes de aplicar o filtro', () => {
    const fn = trecho('function renderTarefas()', 1600);
    expect(fn).toContain("popularFiltroObra('tar-obra-filter'");
    expect(fn.indexOf('popularFiltroObra')).toBeLessThan(fn.indexOf("document.getElementById('tar-obra-filter')"));
  });

  it('o helper preserva a obra escolhida e aceita rótulo sem nome da obra', () => {
    const fn = trecho('function popularFiltroObra(id, opcoes = {})', 900);
    expect(fn).toContain('const selecionada = String(el.value');
    expect(fn).toContain("el.value = selecionada");
    expect(fn).toContain('opcoes.comNome !== false');
  });
});

describe('galeria de fotos (relatório fotográfico)', () => {
  it('repopula o filtro a cada renderização', () => {
    const fn = trecho('function renderFotos()', 400);
    expect(fn).toContain("popularFiltroObra('fotos-obra-filter')");
    expect(fn).not.toContain('options.length === 1');
  });

  it('coleta fotos de tarefas e medições nos dois formatos', () => {
    const fn = trecho('function renderFotos()', 2200);
    // A galeria usa os coletores com legenda do app principal; o helper
    // fotosDeRegistro continua cobrindo fotoUrl legado + photos no relatório.
    expect(fn).toContain('taskPhotoList(t)');
    expect(fn).toContain('medicaoPhotoList(m)');
    expect(fn).toContain("origem: 'Tarefa'");
    expect(fn).toContain("origem: 'Medição'");
    const helper = trecho('function fotosDeRegistro(registro)', 600);
    expect(helper).toContain('Array.isArray(registro.photos)');
    expect(helper).toContain('[registro.photoUrl]');
    expect(helper).toContain('vistas');
  });

  it('interpola a URL só em data- attribute e mostra aviso se a imagem falhar', () => {
    const fn = trecho('function renderFotos()', 5200);
    expect(fn).toContain('onclick="openLightbox(this.dataset.photo)"');
    expect(fn).toContain('data-photo="${auditEsc(p.url)}"');
    expect(fn).toContain("this.style.opacity='0.5'");
    expect(app).toContain('function abrirFotoCard(card)');
    expect(app).toContain('function fotoErro(img)');
    expect(css).toContain('.photo-card-erro');
  });

  it('a tabela e o quadro de tarefas oferecem a foto sem quebrar o HTML', () => {
    const tabela = trecho('function renderTaskTable(tasks)', 7000);
    const kanban = trecho('function renderKanban(tasks)', 5000);
    expect(tabela).toContain('taskPhotoList(t)');
    expect(tabela).toContain('openTarefaFotos(${t._idx})');
    expect(kanban).toContain('taskPhotoList(t)');
    expect(kanban).toContain('auditEsc(u)');
  });
});

describe('relatório de vistoria', () => {
  it('usa a mesma coleta de fotos das medições', () => {
    const fn = trecho('function generateAuditReport()', 6000);
    // A renderização das miniaturas vive logo acima de generateAuditReport.
    const inicio = app.indexOf('const medicoesHtml = report.medicoes.length');
    const trechoMedicoes = app.slice(inicio, inicio + 900);
    expect(trechoMedicoes).toContain('fotosDeRegistro(m)');
    expect(trechoMedicoes).toContain('auditSafeImage');
    expect(fn).toBeTruthy();
  });
});

describe('lightbox', () => {
  it('mostra mensagem amigável quando a imagem não carrega', () => {
    const fn = trecho('function openLightbox(url)', 1100);
    expect(fn).toContain('img.onerror');
    expect(fn).toContain("erro.hidden = false");
    expect(fn).toContain('img.onload');
    expect(css).toContain('.lightbox-erro');
  });
});

describe('fotos locais no carregamento', () => {
  it('restaura base64 tanto no cache quanto no snapshot da nuvem', () => {
    expect(data).toContain('function restaurarFotosLocais(db)');
    expect(data).toContain('DB = restaurarFotosLocais(aplicarEscopoLocal(cached))');
    expect(data).toContain('DB = restaurarFotosLocais(DB)');
    expect(data).toContain('restaurarFotosLocais(ensureSchema(JSON.parse(oldLocal)))');
  });
});
