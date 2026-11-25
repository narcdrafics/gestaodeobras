import { describe, it, expect } from 'vitest';
import { buildObraReport, buildFinanceEntries } from './utils_wrapper.js';

const HOJE = '2026-11-12';

function baseDB() {
  return {
    config: { nomeEmpresa: 'Construtora Alfa', logoUrl: 'data:image/png;base64,abc' },
    obras: [
      { cod: 'OB1', nome: 'Residencial Alfa', status: 'Em andamento', orc: 5000, mestre: 'Carlos' },
      { cod: 'OB2', nome: 'Galpão', status: 'Em andamento', orc: 0, mestre: '' },
      { cod: 'OB3', nome: 'Sem orçamento', status: 'Em andamento', orc: 0, mestre: '' }
    ],
    orcamento: [
      { obra: 'OB1', tipo: 'Mão de obra', vtotal: 2000 },
      { obra: 'OB1', tipo: 'Material', vtotal: 1000 },
      { obra: 'OB1', tipo: 'Geral', vtotal: 300 },
      { obra: 'OB2', tipo: 'Material', vtotal: 9999 }
    ],
    financeiro: [
      { data: '2026-11-10', obra: 'OB1', tipo: 'Material', desc: 'Cimento', real: 500, prev: 800, status: 'Pago' },
      { data: '2026-11-11', obra: 'OB1', tipo: 'Geral', desc: 'Frete', real: 300, prev: 300, status: 'Pendente' },
      { data: '2026-11-12', obra: 'OB1', tipo: 'Material', desc: 'Areia (só previsto)', real: 0, prev: 9999, status: 'Pendente' },
      { data: '2026-10-05', obra: 'OB1', tipo: 'Material', desc: 'Material antigo', real: 700, prev: 700, status: 'Pago' },
      { data: '2026-11-11', obra: 'OB2', tipo: 'Material', desc: 'Outra obra', real: 1000, prev: 1000, status: 'Pago' }
    ],
    presenca: [
      { data: '2026-11-12', obra: 'OB1', trab: 'w1', nome: 'Ana', presenca: 'Presente', total: 100, pgtoStatus: 'Pago' },
      { data: '2026-11-11', obra: 'OB1', trab: 'w1', nome: 'Ana', presenca: 'Presente', total: 100, pgtoStatus: 'Pendente' },
      { data: '2026-10-20', obra: 'OB1', trab: 'w2', nome: 'Beto', presenca: 'Presente', total: 150, pgtoStatus: 'Pendente' }
    ],
    medicao: [
      { semana: '2026-11-10', obra: 'OB1', etapa: 'Estrutura', servico: 'Laje', equipe: 'Equipe A', qprev: 10, qreal: 5, vtotal: 1000, pgtoStatus: 'Pendente' },
      { semana: '2026-10-01', obra: 'OB1', etapa: 'Fundação', servico: 'Sapata', equipe: 'Equipe B', qprev: 10, qreal: 10, vtotal: 500, pgtoStatus: 'Pago' },
      { semana: '2026-11-12', obra: 'OB2', etapa: 'Estrutura', servico: 'Pilar', equipe: 'Equipe C', qprev: 10, qreal: 10, vtotal: 700, pgtoStatus: 'Pago' }
    ],
    almocos: [
      { data: '2026-11-12', obra: 'OB1', empreiteiro: 'Equipe A', vtotal: 50, pgtoStatus: 'Pago' }
    ],
    tarefas: [
      { obra: 'OB1', desc: 'Pintura', prazo: '2026-11-01', status: 'Pendente' }
    ],
    compras: [
      { obra: 'OB1', mat: 'Tinta', status: 'Aguardando' }
    ]
  };
}

describe('buildObraReport: fonte única de custo e orçamento', () => {
  it('compara categorias sem diferenciar maiúsculas e inclui "outros" no total', () => {
    const r = buildObraReport(baseDB(), 'OB1', { hoje: HOJE });
    const byKey = Object.fromEntries(r.categorias.map(c => [c.key, c]));

    expect(byKey['mao-de-obra'].previsto).toBe(2000); // orçamento "Mão de obra"
    expect(byKey.material.previsto).toBe(1000);
    expect(byKey.outros.previsto).toBe(300); // "Geral" não pode sumir
    expect(r.resumo.totalPrevisto).toBe(3300);
    expect(r.resumo.totalRealizado).toBe(3400);
    expect(r.resumo.status).toBe('Acima do orçamento em 3.0%');
    expect(r.resumo.pct).toBeCloseTo(103.03, 2);
  });

  it('classifica o previsto pelo empreiteiro do item, mesmo com o tipo padrão', () => {
    const db = baseDB();
    db.orcamento.push(
      { obra: 'OB1', tipo: 'Mão de obra', empreiteiro: 'Walter', vtotal: 500 },
      { obra: 'OB1', tipo: 'Mão de obra', vtotal: 100 },
      { obra: 'OB1', tipo: 'Material', empreiteiro: '   ', vtotal: 10 }
    );

    const r = buildObraReport(db, 'OB1', { hoje: HOJE });
    const byKey = Object.fromEntries(r.categorias.map(c => [c.key, c]));

    expect(byKey.empreiteiro.previsto).toBe(500); // Walter, tipo "Mão de obra"
    expect(byKey.empreiteiro.realizado).toBe(1500); // medições da obra
    expect(byKey['mao-de-obra'].previsto).toBe(2100); // item sem empreiteiro segue o tipo
    expect(byKey.material.previsto).toBe(1010); // empreiteiro em branco não conta
    expect(r.resumo.totalPrevisto).toBe(3910);
    expect(r.orcamento.find(o => o.empreiteiro === 'Walter').tipo).toBe('Mão de obra'); // dado original intacto
  });

  it('não soma compras nem lançamento apenas previsto ao custo realizado', () => {
    const r = buildObraReport(baseDB(), 'OB1', { hoje: HOJE });
    const byKey = Object.fromEntries(r.categorias.map(c => [c.key, c]));

    expect(byKey.material.realizado).toBe(1200); // 500 + 700; compras e "Areia" prevista ficam fora
    expect(r.entradas.some(e => e.desc === 'Areia (só previsto)')).toBe(false);
    expect(r.resumo.totalRealizado).toBe(3400);
  });

  it('fecha pago + a pagar com o realizado e com o extrato', () => {
    const r = buildObraReport(baseDB(), 'OB1', { hoje: HOJE });
    const extrato = r.entradas.reduce((a, e) => a + e.valorRealizado, 0);

    expect(r.resumo.totalPago).toBe(1850);
    expect(r.resumo.totalAPagar).toBe(1550);
    expect(r.resumo.totalPago + r.resumo.totalAPagar).toBe(r.resumo.totalRealizado);
    expect(extrato).toBe(r.resumo.totalRealizado);
  });

  it('calcula avanço físico ponderado e avanço financeiro separados', () => {
    const r = buildObraReport(baseDB(), 'OB1', { hoje: HOJE });
    expect(r.resumo.fisico).toBeCloseTo(66.67, 2);
    expect(r.resumo.pct).toBeCloseTo(103.03, 2);
    expect(r.medicoes.find(m => m.servico === 'Laje').avanco).toBeCloseTo(50, 5);
  });

  it('sem orçamento não vira Infinity/NaN: pct é null e status é explícito', () => {
    const r = buildObraReport(baseDB(), 'OB3', { hoje: HOJE });
    expect(r.resumo.totalPrevisto).toBe(0);
    expect(r.resumo.pct).toBeNull();
    expect(r.resumo.status).toBe('Sem orçamento definido');
    expect(r.categorias.every(c => c.previsto === 0)).toBe(true);
  });

  it('filtra o realizado pelo período, mantendo o orçamento total da obra', () => {
    const r = buildObraReport(baseDB(), 'OB1', {
      hoje: HOJE,
      dataInicio: '2026-11-01',
      dataFim: '2026-11-30'
    });
    expect(r.resumo.totalRealizado).toBe(2050); // 800 manuais + 200 presença + 1000 medição + 50 almoço
    expect(r.resumo.totalPrevisto).toBe(3300);
    expect(r.resumo.status).toBe('Abaixo do orçamento em 37.9%');
    expect(r.medicoes).toHaveLength(1);
  });

  it('não soma lançamento manual de Empreiteiro quando a etapa já tem medição', () => {
    const db = baseDB();
    db.financeiro.push({
      data: '2026-11-12', obra: 'OB1', etapa: 'Estrutura', tipo: 'Empreiteiro',
      desc: 'Pagamento da laje', real: 1000, prev: 1000, status: 'Pago'
    });

    const r = buildObraReport(db, 'OB1', { hoje: HOJE });
    expect(r.resumo.totalRealizado).toBe(3400); // não vira 4400
    expect(r.duplicados).toHaveLength(1);
    expect(r.duplicados[0].desc).toBe('Pagamento da laje');
    expect(r.entradas.some(e => e.desc === 'Pagamento da laje')).toBe(false);
    expect(r.entradas.reduce((a, e) => a + e.valorRealizado, 0)).toBe(r.resumo.totalRealizado);
  });

  it('mantém lançamento de Empreiteiro quando não há medição da mesma etapa', () => {
    const db = baseDB();
    db.financeiro.push({
      data: '2026-11-12', obra: 'OB1', etapa: 'Acabamento', tipo: 'Empreiteiro',
      desc: 'Pintura terceirizada', real: 400, prev: 400, status: 'Pendente'
    });

    const r = buildObraReport(db, 'OB1', { hoje: HOJE });
    expect(r.resumo.totalRealizado).toBe(3800);
    expect(r.duplicados).toHaveLength(0);
    expect(r.entradas.some(e => e.desc === 'Pintura terceirizada')).toBe(true);
  });

  it('agrupa equipe e pendências sem perder a origem', () => {
    const r = buildObraReport(baseDB(), 'OB1', { hoje: HOJE });
    expect(r.equipe.map(e => e.nome)).toEqual(['Ana', 'Beto']);
    expect(r.equipe.find(e => e.nome === 'Ana')).toMatchObject({ dias: 2, total: 200, pago: 100, aPagar: 100 });
    expect(r.pendencias).toEqual(expect.arrayContaining([
      expect.objectContaining({ tipo: 'Tarefa atrasada', desc: 'Pintura' }),
      expect.objectContaining({ tipo: 'Compra pendente', desc: 'Tinta' })
    ]));
  });

  it('organiza tarefas da obra com fotos e status de execução', () => {
    const db = baseDB();
    db.tarefas.push(
      { cod: 'TF002', obra: 'OB1', desc: 'Alvenaria', status: 'Concluída', conclusao: '2026-11-10', photoUrl: 'https://storage/evidencia1.jpg' },
      { cod: 'TF003', obra: 'OB1', desc: 'Reboco', status: 'Em andamento', perc: 60, photos: ['data:image/jpeg;base64,123'] }
    );

    const r = buildObraReport(db, 'OB1', { hoje: HOJE });
    expect(r.tarefas).toHaveLength(3);
    const executada = r.tarefas.find(t => t.cod === 'TF002');
    expect(executada.isExecutada).toBe(true);
    expect(executada.photos).toEqual(['https://storage/evidencia1.jpg']);

    const andamento = r.tarefas.find(t => t.cod === 'TF003');
    expect(andamento.isExecutada).toBe(false);
    expect(andamento.photos).toEqual(['data:image/jpeg;base64,123']);
  });
});

describe('buildFinanceEntries: valor realizado x valor previsto', () => {
  it('mantém o previsto no fluxo de caixa, mas zera o realizado quando só há previsão', () => {
    const fin = [{ obra: 'OB1', data: '2026-11-01', tipo: 'Material', prev: 800, real: 0, status: 'Pendente' }];
    const { all } = buildFinanceEntries(fin, [], [], []);
    expect(all[0].valor).toBe(800);
    expect(all[0].valorPrevisto).toBe(800);
    expect(all[0].valorRealizado).toBe(0);
  });

  it('filtra por obra quando solicitado', () => {
    const fin = [
      { obra: 'OB1', data: '2026-11-01', tipo: 'Material', real: 100 },
      { obra: 'OB2', data: '2026-11-01', tipo: 'Material', real: 200 }
    ];
    const { all } = buildFinanceEntries(fin, [], [], [], { obra: 'OB1' });
    expect(all).toHaveLength(1);
    expect(all[0].valorRealizado).toBe(100);
  });
});
