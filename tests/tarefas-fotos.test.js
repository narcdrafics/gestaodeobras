// tests/tarefas-fotos.test.js
// Contratos para múltiplas fotos por tarefa, legendas derivadas da descrição
// e enquadramento das evidências na página de impressão do relatório.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const modal = read('public/modals/modal-tarefa.html');
const app = read('public/js/app_core.js');
const css = read('public/css/app.css');
const dataCore = read('public/js/data_core.js');

describe('múltiplas fotos na aba Tarefas', () => {
  it('o modal aceita várias imagens e usa o upload de tarefa', () => {
    expect(modal).toMatch(/id="tf-file"[^>]*multiple[^>]*onchange="handleTarefaPhotos\(this\)"/);
    expect(modal).toContain('id="tf-photo-preview" class="tf-photo-grid"');
    expect(modal).not.toMatch(/id="tf-file"[^>]*capture=/);
  });

  it('o salvamento grava o array de fotos e mantém photoUrl para compatibilidade', () => {
    expect(app).toMatch(/async function saveTarefa\(\)[\s\S]{0,2000}photos,/);
    expect(app).toContain("photoUrl: photos[0] || ''");
    expect(app).toContain('window.handleTarefaPhotos = handleTarefaPhotos');
    expect(app).toContain('window._tarefaPhotos = taskPhotoList(t)');
  });

  it('normaliza formatos legados e limita a quantidade de fotos', () => {
    expect(app).toContain('const MAX_TAREFA_FOTOS = 6;');
    expect(app).toMatch(/function taskPhotoList\(t\)[\s\S]{0,300}t\.photoUrl, t\.foto/);
    expect(app).toMatch(/function openTarefaFotos\(idx, startIndex = 0\)/);
  });

  it('o fallback local em base64 guarda uma lista de fotos, não apenas uma', () => {
    expect(dataCore).toContain("fotosMap['tf_' + t.cod] = [...new Set(b64)].slice(0, 6)");
    expect(dataCore).toContain("Array.isArray(savedFoto) ? savedFoto : [savedFoto]");
  });
});

describe('legendas e impressão', () => {
  it('a legenda das fotos vem da descrição da tarefa', () => {
    expect(app).toContain('return total > 1 ? `${desc} · Foto ${index + 1}/${total}` : desc;');
    expect(app).toContain('<figcaption class="audit-task-photo-caption"');
    expect(app).toContain('window.taskPhotoCaption(t, i, photos.length)');
  });

  it('a seção fotográfica pode quebrar entre páginas, mas cada tarefa permanece inteira', () => {
    expect(css).toContain('body.audit-print #sec-fotos-tarefas { break-inside: auto; page-break-inside: auto; }');
    expect(css).toContain('.audit-task-photo-card { break-inside: avoid; page-break-inside: avoid; }');
    expect(css).toContain('max-height: 36mm;');
    expect(css).toContain('.audit-task-photo-caption { font-size: 8px;');
    expect(css).toContain('aspect-ratio: 16 / 10;');
  });
});
