import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const appSrc = fs.readFileSync(path.join(process.cwd(), 'public', 'js', 'app_core.js'), 'utf8');

describe('botões de ação das tabelas', () => {
  it('nenhum botão de ação fica vazio', () => {
    expect(appSrc).not.toMatch(/<button[^>]*>\s*<\/button>/);
  });

  it.each([
    'editObra', 'editTrabalhador', 'editAlmoco', 'editTarefa',
    'editEstoque', 'editMovEstoque', 'editCompra', 'editUsuario', 'editPresenca'
  ])('%s mostra texto visível "Editar"', (fn) => {
    const botao = new RegExp(`<button[^>]*onclick="${fn}\\([^)]*\\)"[^>]*>[\\s\\S]*?Editar<\\/button>`);
    expect(appSrc).toMatch(botao);
  });

  it('ações que mostram só ícone têm dica e nome acessível', () => {
    const semDica = /<button(?![^>]*\b(?:title|aria-label)=)[^>]*>\s*<span class="material-symbols-outlined[^>]*>[a-z_]+\s*<\/span>\s*<\/button>/g;
    expect(appSrc.match(semDica) || []).toHaveLength(0);
  });
});
