// tests/roles-encarregado.test.js
// Contrato da migração `mestre` -> `encarregado` (papel canônico do canteiro).
// O alias legado continua funcionando por um release, mas nada novo é criado
// com o nome antigo e as claims/dados de sessão são normalizados.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const modalUsuario = read('public/modals/modal-usuario.html');
const authSrc = read('public/js/auth_core.js');
const appSrc = read('public/js/app_core.js');
const utilsSrc = read('public/js/utils.module.js');
const functionsSrc = read('functions/index.js');

describe('papel canônico encarregado — cadastro', () => {
  it('o modal de usuário oferece Encarregado de Obra e não cria mais mestres', () => {
    expect(modalUsuario).toContain('value="encarregado"');
    expect(modalUsuario).toContain('Encarregado de Obra');
    expect(modalUsuario).not.toContain('value="mestre"');
    expect(modalUsuario).toContain('value="engenheiro"');
  });

  it('editar um usuário legado converte mestre para o valor do select', () => {
    const trecho = appSrc.slice(appSrc.indexOf('async function editUsuario('), appSrc.indexOf('async function deleteUsuario('));
    expect(trecho).toContain("u.role === 'mestre' ? 'encarregado'");
  });
});

describe('papel canônico encarregado — sessão e navegação', () => {
  it('normaliza o alias mestre ao gravar o registro do usuário', () => {
    expect(authSrc).toContain("const ROLE_ENCARREGADO = 'encarregado'");
    expect(authSrc).toContain("const ROLE_MESTRE_LEGADO = 'mestre'");
    expect(authSrc).toContain('function normalizeRole(role)');
    expect(authSrc).toContain("role === ROLE_MESTRE_LEGADO ? ROLE_ENCARREGADO");

    const registro = authSrc.slice(authSrc.indexOf('function normalizeUserRecord('), authSrc.indexOf('// ================== GOOGLE LOGIN'));
    expect(registro).toContain('role: normalizeRole(user.role)');
  });

  it('setRestrictions aplica as mesmas regras a encarregado e ao alias legado', () => {
    const restricoes = authSrc.slice(authSrc.indexOf('function setRestrictions('), authSrc.indexOf("window.addEventListener('firebaseSync'"));
    expect(restricoes).toContain('const role = normalizeRole(user.role)');
    expect(restricoes).toContain('if (role === ROLE_ENCARREGADO)');
    expect(restricoes).toContain("normalizeRole(activeUser.role) === ROLE_ENCARREGADO");
    expect(restricoes).not.toContain("role === 'mestre'");
  });

  it('o sentinel não desloga quem trocou apenas o alias mestre -> encarregado', () => {
    const sentinel = authSrc.slice(authSrc.indexOf("window.addEventListener('firebaseSync'"));
    expect(sentinel).toContain('normalizeRole(stillExists.role) !== normalizeRole(activeUser.role)');
  });
});

describe('papel canônico encarregado — dados exibidos', () => {
  it('dashboard não oferece Nova Compra nem Atribuir obra ao encarregado', () => {
    expect(appSrc).toContain("if (role === 'mestre') role = 'encarregado';");
    expect(appSrc).toContain("role !== 'encarregado' && role !== 'mestre'");
  });

  it('alertas de custo/compra também são suprimidos para encarregado', () => {
    expect(utilsSrc).toContain("role !== 'mestre' && role !== 'encarregado'");
  });
});

describe('papel canônico encarregado — claims', () => {
  it('syncCustomClaims converte o alias legado antes de gravar as claims', () => {
    const trecho = functionsSrc.slice(functionsSrc.indexOf('exports.syncCustomClaims'));
    expect(trecho).toContain("if (role === 'mestre') role = 'encarregado';");
    expect(trecho).toContain('setCustomUserClaims(uid, {');
  });
});
