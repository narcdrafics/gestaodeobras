// tests/acesso-por-obra.test.js
// Usuário não-admin designado a obras específicas só enxerga (e só regrava) as dele.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  getObrasPermitidas, filterDbByObras, mergeScopedDb,
  codigosObra, registroDaObra, registrosDaObra, trabalhadoresDaObra
} from './utils_wrapper.js';

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

describe('isolamento de trabalhadores e vínculos por obra', () => {
  const dbTrabs = {
    trabalhadores: [
      { cod: 'T1', nome: 'Ana', obras: 'OB001' },
      { cod: 'T2', nome: 'Bia', obras: 'OB002' },
      { cod: 'T3', nome: 'Caio', obras: 'OB001, OB002' },
      { cod: 'T4', nome: 'Sem obra', obras: '' }
    ]
  };

  it('codigosObra separa lista por vírgula/ponto e vírgula sem casamento parcial', () => {
    expect(codigosObra('OB001; OB002')).toEqual(['OB001', 'OB002']);
    expect(codigosObra('OB001,OB002')).toEqual(['OB001', 'OB002']);
    expect(registroDaObra({ obras: 'OB0010' }, 'trabalhadores', ['OB001'])).toBe(false);
    expect(registroDaObra({ obras: 'OB001, OB002' }, 'trabalhadores', ['OB002'])).toBe(true);
  });

  it('trabalhadores de outra obra (e sem obra) não entram no DB filtrado', () => {
    const f = filterDbByObras(dbTrabs, ['OB001']);
    expect(f.trabalhadores.map(t => t.cod)).toEqual(['T1', 'T3']);
    expect(f.trabalhadores.map(t => t.nome)).not.toContain('Bia');
  });

  it('trabalhadoresDaObra filtra por uma obra específica mesmo para admin', () => {
    expect(trabalhadoresDaObra(dbTrabs, 'OB002').map(t => t.cod)).toEqual(['T2', 'T3']);
    expect(trabalhadoresDaObra(dbTrabs, 'OB999')).toEqual([]);
    expect(registrosDaObra(dbTrabs, 'trabalhadores', 'OB001')).toHaveLength(2);
  });

  it('mergeScopedDb preserva trabalhadores de fora do escopo e não grava os de dentro em outra obra', () => {
    const full = {
      ...dbTrabs,
      obras: [{ cod: 'OB001' }, { cod: 'OB002' }]
    };
    const scoped = filterDbByObras(full, ['OB001']);
    scoped.trabalhadores.push({ cod: 'T5', nome: 'Dia', obras: 'OB002' });
    const m = mergeScopedDb(full, scoped, ['OB001']);
    expect(m.trabalhadores.map(t => t.cod).sort()).toEqual(['T1', 'T2', 'T3', 'T4']);
    expect(m.trabalhadores.find(t => t.cod === 'T5')).toBeUndefined();
  });

  it('movimentação de estoque é do escopo também pelo destino', () => {
    const mov = { movEstoque: [{ id: 1, obra: 'OB002', obraDestino: 'OB001' }] };
    expect(filterDbByObras(mov, ['OB001']).movEstoque).toHaveLength(1);
    expect(filterDbByObras(mov, ['OB003']).movEstoque).toHaveLength(0);
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
    expect(trecho).toContain('...escopoObras');
    expect(trecho).toContain('...(modulosRh ?');
    expect(trecho).toContain('obrasPermitidas.length === 0');
  });
  it('carga filtra e gravação remonta os arrays', () => {
    expect(data).toContain('aplicarEscopoLocal(');
    expect(data).toContain('DB = restaurarFotosLocais(aplicarEscopoLocal(cached))');
    expect(data).toContain('window.mergeScopedDb(lastTenantData');
  });

  it('todas as telas de trabalhadores usam o filtro por obra (sem "sem obra = todas")', () => {
    expect(app).toContain('trabalhadoresDaObraTela(');
    expect(app).not.toMatch(/if \(!t\.obras \|\| t\.obras\.trim\(\) === ''\) return true;/);
    expect(app).not.toContain("!t.obras || t.obras.trim() === ''");
    expect(read('public/pages/trabalhadores.html')).toContain('id="trab-obra-filtro"');
    expect(read('public/pages/presenca.html')).toContain('id="pres-obra-filtro"');
    expect(read('public/pages/almocos.html')).toContain('id="almoco-obra-filtro"');
  });

  it('datalists, modais e PIX não usam o cadastro inteiro fora da obra', () => {
    const trechoDatalist = app.slice(app.indexOf('function populateMedicaoDatalists()'), app.indexOf('function populateMedicaoDatalists()') + 1200);
    expect(trechoDatalist).toContain('trabalhadoresDaObraTela(obra)');
    expect(trechoDatalist).toContain('DB.almocos || []).filter(a => a && a.obra === obra)');
    const trechoAlmoco = app.slice(app.indexOf("if (id === 'modal-almoco')"), app.indexOf("if (id === 'modal-almoco')") + 500);
    expect(trechoAlmoco).toContain('atualizarDatalistEquipesAlmoco()');
    expect(app).toContain('function atualizarDatalistEquipesAlmoco()');
  });

  it('aprovações e dados comerciais respeitam o escopo', () => {
    const aprovacoes = read('public/js/aprovacoes_ui.js');
    expect(aprovacoes).toContain('function aprovacaoNoEscopo(ap)');
    expect(aprovacoes).toContain('.filter(ap => aprovacaoNoEscopo(ap))');
    expect(aprovacoes).toContain('if (!aprovacaoNoEscopo(ap))');
    const compras = read('public/js/compras_ui.js');
    expect(compras).toContain('function filtrarPrivadas(dados)');
    expect(compras).toContain('privadas = filtrarPrivadas(');
    expect(compras).toContain('obra: String(dados.obra || \'\')');
  });

  it('o servidor rejeita aprovações que mexem em obra fora do escopo', () => {
    const fn = read('functions/aprovacoes.js');
    expect(fn).toContain('function aprovacaoDentroDoEscopo(aprovacao, usuario)');
    expect(fn).toContain("marcarFalha(db, tenantId, aprovacaoId, aprovacao, 'obra_fora_do_escopo', agora)");
  });
});
