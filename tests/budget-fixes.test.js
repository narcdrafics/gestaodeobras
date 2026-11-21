import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildObraReport, migrateServiceIds } from './utils_wrapper.js';

const HOJE = '2026-11-19';
const OB = 'OB001';

// Os 4 serviços reais da obra Timbumba (tipo no padrão "Mão de obra", mas com empreiteiro)
const ID = { pisosW: 'f8f0294b', banhW: '3525cabe', pisosE: 'b04a5864', banhE: '54a1c258' };
const orcamentoReal = () => ([
  { id: ID.pisosW, obra: OB, etapa: 'Revestimentos', subEtapa: 'Casa 9', empreiteiro: 'Walter', tipo: 'Mão de obra', desc: 'Revestimentos e pisos', unid: 'm2', qtd: 206, vunit: 35, vtotal: 7210 },
  { id: ID.banhW, obra: OB, etapa: 'Revestimentos', subEtapa: 'Casa 9', empreiteiro: 'Walter', tipo: 'Mão de obra', desc: 'Banheiros', unid: 'un', qtd: 7, vunit: 800, vtotal: 5600 },
  { id: ID.pisosE, obra: OB, etapa: 'Revestimentos', subEtapa: 'Casa 10', empreiteiro: 'Edmilson', tipo: 'Mão de obra', desc: 'Revestimentos e pisos', unid: 'm2', qtd: 177, vunit: 30, vtotal: 5310 },
  { id: ID.banhE, obra: OB, etapa: 'Revestimentos', subEtapa: 'Casa 10', empreiteiro: 'Edmilson', tipo: 'Mão de obra', desc: 'Banheiros', unid: 'un', qtd: 7, vunit: 700, vtotal: 4900 }
]);

const med = (serviceId, servico, equipe, qreal, vunit, semana) => ({
  obra: OB, etapa: 'Revestimentos', servico, serviceId, equipe, semana,
  qprev: 0, qant: 0, qreal, qacum: qreal, vunit, vtotal: qreal * vunit, aprovacao: 'Aprovada', pgtoStatus: 'Pago'
});

function dbReal() {
  return {
    config: { nomeEmpresa: 'Construtora' },
    obras: [{ cod: OB, nome: 'Timbumba', status: 'Em andamento' }],
    orcamento: orcamentoReal(),
    medicao: [
      med(ID.pisosW, 'Revestimentos e pisos', 'Walter', 108, 35, '2026-11-05'),   // 3.780
      med(ID.banhW, 'Banheiros', 'Walter', 1, 800, '2026-11-06'),                 //   800
      med(ID.pisosE, 'Revestimentos e pisos', 'Edmilson', 110, 30, '2026-11-07'), // 3.300
      med(ID.banhE, 'Banheiros', 'Edmilson', 1, 700, '2026-11-08')                //   700  => 8.580
    ],
    presenca: [
      { obra: OB, data: '2026-11-10', trab: 'w1', nome: 'Equipe própria 1', presenca: 'Presente', total: 3730, pgtoStatus: 'Pendente' },
      { obra: OB, data: '2026-11-11', trab: 'w2', nome: 'Equipe própria 2', presenca: 'Presente', total: 3730, pgtoStatus: 'Pendente' } // => 7.460
    ],
    financeiro: [], almocos: [], compras: [], tarefas: []
  };
}

describe('categorizeBudgetItem: o previsto cai onde o realizado entra', () => {
  const cat = (o) => window.categorizeBudgetItem(o);

  it('serviço de mão de obra COM empreiteiro conta como Empreiteiro', () => {
    expect(cat({ tipo: 'Mão de obra', empreiteiro: 'Walter' })).toBe('empreiteiro');
    expect(cat({ tipo: 'mão de obra', empreiteiro: ' Edmilson ' })).toBe('empreiteiro');
  });
  it('sem empreiteiro (ou só espaços) continua Mão de obra própria', () => {
    expect(cat({ tipo: 'Mão de obra' })).toBe('mao-de-obra');
    expect(cat({ tipo: 'Mão de obra', empreiteiro: '   ' })).toBe('mao-de-obra');
  });
  it('material e equipamento não são afetados pelo empreiteiro', () => {
    expect(cat({ tipo: 'Material', empreiteiro: 'Walter' })).toBe('material');
    expect(cat({ tipo: 'Equipamento', empreiteiro: 'Walter' })).toBe('material');
  });
  it('tipo Empreiteiro e casos vazios', () => {
    expect(cat({ tipo: 'Empreiteiro' })).toBe('empreiteiro');
    expect(cat({ tipo: 'Geral', empreiteiro: 'X' })).toBe('outros');
    expect(cat(null)).toBe('outros');
  });
});

describe('Relatório com os dados reais da Timbumba', () => {
  const rel = () => buildObraReport(dbReal(), OB, { hoje: HOJE, dataInicio: '2026-11-01', dataFim: '2026-11-19' });
  const por = (r) => Object.fromEntries(r.categorias.map(c => [c.key, c]));

  it('os R$ 23.020 do orçamento ficam em Empreiteiros, comparados com as medições (8.580)', () => {
    const c = por(rel());
    expect(c.empreiteiro.previsto).toBe(23020);
    expect(c.empreiteiro.realizado).toBe(8580);
    expect(c.empreiteiro.realizado / c.empreiteiro.previsto).toBeCloseTo(0.3727, 3);
  });

  it('Mão de obra própria (diárias) fica sem orçamento, e não mais com 23.020 inflados', () => {
    const c = por(rel());
    expect(c['mao-de-obra'].previsto).toBe(0);
    expect(c['mao-de-obra'].realizado).toBe(7460);
  });

  it('o total geral não muda: só a divisão por categoria estava errada', () => {
    const r = rel();
    expect(r.resumo.totalPrevisto).toBe(23020);
    expect(r.resumo.totalRealizado).toBe(16040);
    expect(r.resumo.pct).toBeCloseTo(69.68, 2);
    expect(r.resumo.status).toBe('Abaixo do orçamento em 30.3%');
  });

  it('a soma das categorias continua fechando com o total', () => {
    const r = rel();
    expect(r.categorias.reduce((s, c) => s + c.previsto, 0)).toBe(r.resumo.totalPrevisto);
    expect(r.categorias.reduce((s, c) => s + c.realizado, 0)).toBe(r.resumo.totalRealizado);
  });
});

describe('Orçamento parcial: a razão realizado/previsto não vira "estouro"', () => {
  // Reproduz os números relatados: 23.020 previstos (4 serviços) x 205.778 gastos na obra toda.
  const relObraToda = () => {
    const db = dbReal();
    db.presenca = [
      { obra: OB, data: '2026-11-10', trab: 'w1', nome: 'Equipe própria', presenca: 'Presente', total: 145198, pgtoStatus: 'Pendente' }
    ];
    db.financeiro = [
      { obra: OB, data: '2026-11-15', tipo: 'Geral', desc: 'Outras etapas da obra', real: 52000, prev: 0, status: 'Pago' }
    ];
    return buildObraReport(db, OB, { hoje: HOJE, dataInicio: '2026-11-01', dataFim: '2026-11-19' });
  };

  it('23.020 previstos cobrem 11,2% dos 205.778 gastos, com 197.198 sem previsão', () => {
    const r = relObraToda();
    expect(r.resumo.totalPrevisto).toBe(23020);
    expect(r.resumo.totalRealizado).toBe(205778);
    expect(r.resumo.coberturaOrcamento).toBeCloseTo(11.2, 1);
    expect(r.resumo.realizadoSemPrevisto).toBe(197198);
    expect(r.resumo.orcamentoParcial).toBe(true);
  });

  it('a situação fala em orçamento incompleto, não em "Acima do orçamento em 793,9%"', () => {
    const r = relObraToda();
    expect(r.resumo.pct).toBeCloseTo(893.9, 1); // a conta crua continua disponível
    expect(r.resumo.status).toContain('Orçamento incompleto');
    expect(r.resumo.status).toContain('197.198');
    expect(r.resumo.status).not.toContain('Acima do orçamento');
  });

  it('orçamento que cobre todas as categorias continua mostrando estouro normalmente', () => {
    const db = dbReal();
    db.orcamento.push({ id: 'mo', obra: OB, tipo: 'Mão de obra', desc: 'Equipe própria', vtotal: 100000 });
    db.presenca = [
      { obra: OB, data: '2026-11-10', trab: 'w1', nome: 'Equipe própria', presenca: 'Presente', total: 145198, pgtoStatus: 'Pendente' }
    ];
    const r = buildObraReport(db, OB, { hoje: HOJE, dataInicio: '2026-11-01', dataFim: '2026-11-19' });
    expect(r.resumo.realizadoSemPrevisto).toBe(0);
    expect(r.resumo.orcamentoParcial).toBe(false);
    expect(r.resumo.status).toContain('Acima do orçamento');
  });
});

describe('Migração: mesmo serviço em duas casas com empreiteiros diferentes', () => {
  // Medições antigas, sem serviceId, só com a chave de texto (obra|etapa|serviço) e a equipe digitada
  const legadas = (equipe) => ({ obra: OB, etapa: 'Revestimentos', servico: 'Revestimentos e pisos', equipe, qreal: 10, vtotal: 350, aprovacao: 'Aprovada' });

  it('liga cada medição ao item do empreiteiro certo pela equipe, sem pedir revisão', () => {
    const db = { orcamento: orcamentoReal().map(o => { const { id, ...r } = o; return r; }), medicao: [legadas('Walter'), legadas('Edmilson')] };
    migrateServiceIds(db);
    expect(db.medicao[0].serviceId).toBe(db.orcamento[0].id); // Walter / Casa 9
    expect(db.medicao[1].serviceId).toBe(db.orcamento[2].id); // Edmilson / Casa 10
    expect(db.medicao[0].serviceIdReview).toBeUndefined();
    expect(db.medicao[1].serviceIdReview).toBeUndefined();
  });

  it('sem equipe na medição antiga, não há como saber: liga ao primeiro e marca para revisão', () => {
    const db = { orcamento: orcamentoReal().map(o => { const { id, ...r } = o; return r; }), medicao: [legadas('')] };
    migrateServiceIds(db);
    expect(db.medicao[0].serviceId).toBe(db.orcamento[0].id);
    expect(db.medicao[0].serviceIdReview).toBe(true);
  });
});

describe('parseEditIdx: índice 0 é edição, não registro novo', () => {
  it.each([['0', 0], ['3', 3], [' 2 ', 2], ['-1', -1], ['', -1], [undefined, -1], [null, -1], ['abc', -1]])(
    'parseEditIdx(%j) = %j', (entrada, esperado) => {
      expect(window.parseEditIdx(entrada)).toBe(esperado);
    });

  it('nenhum formulário do app volta a usar parseInt(...) || -1', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'public', 'js', 'app_core.js'), 'utf8');
    expect(src).not.toMatch(/parseInt\([^)]*\)\s*\|\|\s*-1/);
  });
});

// ---- formulários reais do app_core.js, extraídos e executados sobre um DOM de teste ----
const appSrc = fs.readFileSync(path.join(process.cwd(), 'public', 'js', 'app_core.js'), 'utf8');
const extract = (name) => {
  // app_core.js usa CRLF: \r?\n faz o regex funcionar com qualquer final de linha.
  const m = appSrc.match(new RegExp(`async function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\r?\\n\\}\\r?\\n`));
  if (!m) throw new Error(`função ${name} não encontrada`);
  return m[0];
};

describe('saveOrcamento (código real)', () => {
  let DB, toast, persistDB;
  const campos = { 'oc-edit-idx': '-1', 'oc-obra': OB, 'oc-etapa': 'Revestimentos', 'oc-subetapa': 'Casa 11', 'oc-empreiteiro': 'Walter',
    'oc-frente': '', 'oc-equipe': '', 'oc-tipo': 'Mão de obra', 'oc-desc': 'Banheiros', 'oc-qtd': '7', 'oc-vunit': '800', 'oc-unid': 'un', 'oc-obs': '' };

  const rodar = async (over = {}) => {
    document.body.innerHTML = Object.entries({ ...campos, ...over }).map(([id, v]) => `<input id="${id}" value="${String(v).replace(/"/g, '&quot;')}">`).join('');
    const fn = new Function('DB', 'toast', 'closeModal', 'persistDB', 'renderOrcamento', 'escHtml', 'parseEditIdx',
      `${extract('saveOrcamento')}\nreturn saveOrcamento;`)(DB, toast, vi.fn(), persistDB, vi.fn(), window.escHtml, window.parseEditIdx);
    await fn();
  };

  beforeEach(() => {
    DB = { orcamento: orcamentoReal() };
    toast = vi.fn();
    persistDB = vi.fn(async () => { });
    window.newServiceId = () => 'novo-id';
  });

  it('editar o PRIMEIRO item atualiza no lugar (antes: criava um duplicado com ID novo)', async () => {
    await rodar({ 'oc-edit-idx': '0', 'oc-desc': 'Revestimentos e pisos (corrigido)', 'oc-unid': 'm2', 'oc-qtd': '206', 'oc-vunit': '35', 'oc-subetapa': 'Casa 9', 'oc-empreiteiro': 'Walter' });
    expect(DB.orcamento).toHaveLength(4);
    expect(DB.orcamento[0].id).toBe(ID.pisosW);            // o ID não muda: as medições continuam ligadas
    expect(DB.orcamento[0].desc).toBe('Revestimentos e pisos (corrigido)');
    expect(DB.orcamento[0].vtotal).toBe(7210);
  });

  it('item novo é acrescentado com ID', async () => {
    await rodar();
    expect(DB.orcamento).toHaveLength(5);
    expect(DB.orcamento[4].id).toBe('novo-id');
  });

  it('avisa quando o mesmo serviço tem outra unidade em outro item (m2 x un), sem bloquear', async () => {
    await rodar({ 'oc-unid': 'm2' }); // "Banheiros" já existe com "un"
    const aviso = toast.mock.calls.find(c => c[1] === 'warning');
    expect(aviso).toBeTruthy();
    expect(aviso[0]).toContain('Atenção');
    expect(aviso[0]).toContain('"un"');
    expect(DB.orcamento).toHaveLength(5); // salvou mesmo assim
  });

  it('mesma unidade: sem aviso; editando o próprio item: não compara consigo mesmo', async () => {
    await rodar({ 'oc-unid': 'un' });
    expect(toast.mock.calls.some(c => c[1] === 'warning')).toBe(false);
    toast.mockClear();
    await rodar({ 'oc-edit-idx': '1', 'oc-desc': 'Banheiros', 'oc-unid': 'un', 'oc-subetapa': 'Casa 9' });
    expect(toast.mock.calls.some(c => c[1] === 'warning')).toBe(false);
  });

  it('o aviso escapa HTML digitado na descrição', async () => {
    DB.orcamento.push({ id: 'x', obra: OB, etapa: 'Revestimentos', desc: '<img src=x onerror=alert(1)>', unid: 'un' });
    await rodar({ 'oc-desc': '<img src=x onerror=alert(1)>', 'oc-unid': 'm2' });
    const aviso = toast.mock.calls.find(c => c[1] === 'warning');
    expect(aviso[0]).not.toContain('<img');
    expect(aviso[0]).toContain('&lt;img');
  });
});

describe('confirmMedicaoVinculo (código real)', () => {
  it('remove o aviso de revisão, grava e atualiza a tela', async () => {
    const DB = { medicao: [{ obra: OB, serviceId: 'a', serviceIdReview: true }, { obra: OB, serviceId: 'b', serviceIdReview: true }] };
    const persistDB = vi.fn(async () => { });
    const renderMedicao = vi.fn();
    const toast = vi.fn();
    document.body.innerHTML = '';
    const fn = new Function('DB', 'persistDB', 'renderMedicao', 'openMedicaoHistorico', 'toast',
      `${extract('confirmMedicaoVinculo')}\nreturn confirmMedicaoVinculo;`)(DB, persistDB, renderMedicao, vi.fn(), toast);
    await fn(0);
    expect(DB.medicao[0].serviceIdReview).toBeUndefined();
    expect(DB.medicao[1].serviceIdReview).toBe(true); // só a escolhida
    expect(persistDB).toHaveBeenCalledOnce();
    expect(renderMedicao).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith('Vínculo confirmado!');
  });
});
