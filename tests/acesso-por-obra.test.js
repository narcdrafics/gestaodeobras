// tests/acesso-por-obra.test.js
// Usuário não-admin designado a obras específicas só enxerga (e só regrava) as dele.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getObrasPermitidas, filterDbByObras, mergeScopedDb } from './utils_wrapper.js';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const usuarios = [
  { email: 'adm@x.com', role: 'admin' },
  { email: 'eng@x.com', role: 'engenheiro', acessoObras: 'especificas', obrasPermitidas: ['OB001'] },
  { email: 'vazio@x.com', role: 'encarregado', acessoObras: 'especificas', obrasPermitidas: [] },
  { email: 'livre@x.com', role: 'engenheiro', acessoObras: 'todas', obrasPermitidas: [] },
  { email: 'legado@x.com', role: 'engenheiro' }
];

const full = {
  usuarios,
  obras: [{ cod: 'OB001', nome: 'A' }, { cod: 'OB002', nome: 'B' }],
  tarefas: [{ id: 1, obra: 'OB001' }, { id: 2, obra: 'OB002' }, { id: 3, obra: '' }],
  presenca: [{ id: 1, obra: 'OB002' }],
  compras: [{ id: 1, obra: 'OB001' }]
};

describe('getObrasPermitidas', () => {
  it('admin e super_admin sempre veem tudo', () => {
    expect(getObrasPermitidas(usuarios, 'eng@x.com', 'admin')).toBeNull();
    expect(getObrasPermitidas(usuarios, 'eng@x.com', 'super_admin')).toBeNull();
  });
  it('retorna a lista de códigos do usuário restrito (e-mail case-insensitive)', () => {
    expect(getObrasPermitidas(usuarios, 'ENG@x.com', 'engenheiro')).toEqual(['OB001']);
  });
  it('sem restrição, usuário legado ou desconhecido = todas as obras', () => {
    expect(getObrasPermitidas(usuarios, 'livre@x.com', 'engenheiro')).toBeNull();
    expect(getObrasPermitidas(usuarios, 'legado@x.com', 'engenheiro')).toBeNull();
    expect(getObrasPermitidas(usuarios, 'ninguem@x.com', 'engenheiro')).toBeNull();
  });
  it('falha fechada: restrito com lista vazia não vê nenhuma obra', () => {
    expect(getObrasPermitidas(usuarios, 'vazio@x.com', 'encarregado')).toEqual([]);
  });
});

describe('filterDbByObras', () => {
  it('sem restrição devolve o mesmo DB', () => {
    expect(filterDbByObras(full, null)).toBe(full);
  });
  it('mantém só obras e registros das obras permitidas', () => {
    const f = filterDbByObras(full, ['OB001']);
    expect(f.obras.map(o => o.cod)).toEqual(['OB001']);
    expect(f.tarefas).toEqual([{ id: 1, obra: 'OB001' }]);
    expect(f.presenca).toEqual([]);
    expect(f.compras).toHaveLength(1);
    expect(f.usuarios).toBe(full.usuarios);
  });
  it('lista vazia esconde tudo', () => {
    const f = filterDbByObras(full, []);
    expect(f.obras).toEqual([]);
    expect(f.tarefas).toEqual([]);
  });
});

describe('mergeScopedDb', () => {
  it('preserva na gravação os registros de obras fora do escopo', () => {
    const scoped = filterDbByObras(full, ['OB001']);
    scoped.tarefas.push({ id: 9, obra: 'OB001' });
    const m = mergeScopedDb(full, scoped, ['OB001']);
    expect(m.tarefas.map(t => t.id).sort()).toEqual([1, 2, 3, 9]);
    expect(m.presenca).toEqual([{ id: 1, obra: 'OB002' }]);
    expect(m.obras.map(o => o.cod).sort()).toEqual(['OB001', 'OB002']);
  });
  it('deleção dentro do escopo é respeitada, fora do escopo não é afetada', () => {
    const scoped = filterDbByObras(full, ['OB001']);
    scoped.tarefas = [];
    const m = mergeScopedDb(full, scoped, ['OB001']);
    expect(m.tarefas.map(t => t.id).sort()).toEqual([2, 3]);
  });
  it('não deixa o usuário gravar registro em obra fora do escopo', () => {
    const scoped = filterDbByObras(full, ['OB001']);
    scoped.tarefas.push({ id: 7, obra: 'OB002' });
    const m = mergeScopedDb(full, scoped, ['OB001']);
    expect(m.tarefas.filter(t => t.id === 7)).toHaveLength(0);
  });
  it('sem snapshot completo não grava (null) para não apagar dados', () => {
    expect(mergeScopedDb(null, filterDbByObras(full, ['OB001']), ['OB001'])).toBeNull();
  });
  it('sem restrição devolve o DB como veio', () => {
    expect(mergeScopedDb(full, full, null)).toBe(full);
  });
  it('aceita snapshot do RTDB com arrays esparsos (objeto)', () => {
    const esparso = { ...full, tarefas: { 0: { id: 1, obra: 'OB001' }, 2: { id: 2, obra: 'OB002' } } };
    const m = mergeScopedDb(esparso, filterDbByObras(esparso, ['OB001']), ['OB001']);
    expect(m.tarefas.map(t => t.id).sort()).toEqual([1, 2]);
  });
});

describe('acesso por obra — integração de UI e persistência', () => {
  const modal = read('public/modals/modal-usuario.html');
  const app = read('public/js/app_core.js');
  const data = read('public/js/data_core.js');

  it('modal oferece escolha de acesso e lista de obras', () => {
    expect(modal).toContain('id="usr-obras-modo"');
    expect(modal).toContain('value="especificas"');
    expect(modal).toContain('id="usr-obras-lista"');
  });
  it('saveUsuario grava o escopo (novo e edição) e exige ao menos uma obra', () => {
    const trecho = app.slice(app.indexOf('async function saveUsuario('), app.indexOf('// ==================== DELETE'));
    expect(trecho).toContain('lerEscopoObrasDoModal()');
    expect(trecho).toContain('{ email, name, role, ...escopoObras }');
    expect(trecho).toContain('obrasPermitidas.length === 0');
  });
  it('carga filtra e gravação remonta os arrays', () => {
    expect(data).toContain('window.filterDbByObras(');
    expect(data).toContain('window.mergeScopedDb(lastTenantData');
  });
});
