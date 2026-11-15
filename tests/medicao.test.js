import { describe, it, expect } from 'vitest';
import {
  buildMedicaoResumo,
  medicaoQuantidadeAnterior,
  medicaoAprovacao,
  normalizeAprovacao,
  budgetServiceKey,
  medicaoServiceKey,
  buildFinanceEntries,
  buildObraReport
} from './utils_wrapper.js';

function baseDB() {
  return {
    config: { nomeEmpresa: 'Construtora Alfa' },
    obras: [
      { cod: 'OB1', nome: 'Residencial Alfa', status: 'Em andamento' },
      { cod: 'OB2', nome: 'Sem orçamento', status: 'Em andamento' }
    ],
    orcamento: [
      { obra: 'OB1', etapa: 'Estrutura', desc: 'Laje', unid: 'm²', qtd: 100, vunit: 50, vtotal: 5000 },
      { obra: 'OB1', etapa: 'Alvenaria', desc: 'Parede', unid: 'm²', qtd: 50, vunit: 20, vtotal: 1000 }
    ],
    medicao: [
      {
        semana: '2026-11-01', obra: 'OB1', etapa: 'Estrutura', servico: 'Laje',
        qprev: 100, qreal: 30, vunit: 50, vtotal: 1500, aprovacao: 'Aprovada', equipe: 'Equipe A'
      },
      {
        semana: '2026-11-08', obra: 'OB1', etapa: 'Estrutura', servico: 'Laje',
        qprev: 100, qreal: 20, vunit: 50, vtotal: 1000, aprovacao: 'Pendente', equipe: 'Equipe A'
      },
      {
        semana: '2026-10-01', obra: 'OB1', etapa: 'Alvenaria', servico: 'Parede',
        qprev: 50, qreal: 50, vunit: 20, vtotal: 1000, aprovacao: 'Aprovada', equipe: 'Equipe B'
      },
      {
        semana: '2026-11-10', obra: 'OB1', etapa: 'Estrutura', servico: 'Laje',
        qprev: 100, qreal: 10, vunit: 50, vtotal: 500, aprovacao: 'Rejeitada', equipe: 'Equipe A'
      }
    ],
    financeiro: [],
    presenca: [],
    almocos: [],
    tarefas: [],
    compras: []
  };
}

describe('buildMedicaoResumo: avanço acumulado por serviço', () => {
  it('soma o histórico no acumulado e calcula saldo e percentual', () => {
    const r = buildMedicaoResumo(baseDB(), 'OB1');
    const laje = r.servicos.find(s => s.desc === 'Laje');
    const parede = r.servicos.find(s => s.desc === 'Parede');

    expect(laje.qprev).toBe(100);
    expect(laje.qacum).toBe(50); // 30 + 20 (rejeitada fica fora)
    expect(laje.saldo).toBe(50);
    expect(laje.pct).toBeCloseTo(50, 5);
    expect(laje.valorAcum).toBe(2500);

    expect(parede.qacum).toBe(50);
    expect(parede.pct).toBeCloseTo(100, 5);
  });

  it('pondera o avanço físico pelo valor do orçamento', () => {
    const r = buildMedicaoResumo(baseDB(), 'OB1');
    // (50% * 5000 + 100% * 1000) / 6000 = 58,33%
    expect(r.totais.fisico).toBeCloseTo(58.33, 2);
  });

  it('separa medido, aprovado, a aprovar e rejeitado', () => {
    const r = buildMedicaoResumo(baseDB(), 'OB1');
    expect(r.totais.valorMedido).toBe(4000); // inclui a rejeitada
    expect(r.totais.aprovado).toBe(2500);
    expect(r.totais.aAprovar).toBe(1000);
    expect(r.totais.rejeitado).toBe(500);
    expect(r.totais.count).toBe(4);
  });

  it('filtra o período sem perder o acumulado histórico', () => {
    const r = buildMedicaoResumo(baseDB(), 'OB1', {
      dataInicio: '2026-11-01',
      dataFim: '2026-11-30'
    });
    expect(r.totais.valorMedido).toBe(3000); // 1500 + 1000 + 500 rejeitada
    expect(r.totais.count).toBe(3);
    const laje = r.servicos.find(s => s.desc === 'Laje');
    expect(laje.qacum).toBe(50); // continua usando o histórico completo
  });

  it('filtra por etapa e por aprovação', () => {
    const porEtapa = buildMedicaoResumo(baseDB(), 'OB1', { etapa: 'Estrutura' });
    expect(porEtapa.servicos.map(s => s.desc)).toEqual(['Laje']);
    expect(porEtapa.totais.fisico).toBeCloseTo(50, 5);

    const pendentes = buildMedicaoResumo(baseDB(), 'OB1', { aprovacao: 'Pendente' });
    expect(pendentes.totais.valorMedido).toBe(1000);
    expect(pendentes.medicoes).toHaveLength(1);
  });

  it('não gera Infinity/NaN quando não há orçamento nem quantidade prevista', () => {
    const db = baseDB();
    db.medicao.push({
      semana: '2026-11-12', obra: 'OB2', etapa: 'Serviços', servico: 'Avulso',
      qprev: 0, qreal: 3, vtotal: 300, aprovacao: 'Aprovada'
    });
    const r = buildMedicaoResumo(db, 'OB2');
    expect(r.totais.fisico).toBeNull();
    expect(r.servicos[0].pct).toBeNull();
    expect(Number.isFinite(r.servicos[0].saldo)).toBe(true);
  });
});

describe('medicaoQuantidadeAnterior', () => {
  it('soma o histórico do serviço e ignora a própria medição editada', () => {
    const db = baseDB();
    expect(medicaoQuantidadeAnterior(db, { obra: 'OB1', etapa: 'Estrutura', servico: 'Laje' })).toBe(50);
    expect(medicaoQuantidadeAnterior(db, {
      obra: 'OB1', etapa: 'Estrutura', servico: 'Laje', excludeIdx: 1
    })).toBe(30);
  });

  it('não conta medições rejeitadas', () => {
    const db = baseDB();
    db.medicao.forEach(m => { m.aprovacao = 'Rejeitada'; });
    expect(medicaoQuantidadeAnterior(db, { obra: 'OB1', etapa: 'Estrutura', servico: 'Laje' })).toBe(0);
  });

  it('usa a chave estável do orçamento quando disponível', () => {
    const db = baseDB();
    const key = budgetServiceKey(db.orcamento[0]);
    db.medicao[0].orcKey = key;
    expect(medicaoServiceKey(db.medicao[0])).toBe(key);
    expect(medicaoQuantidadeAnterior(db, { obra: 'OB1', orcKey: key, excludeIdx: 0 })).toBe(20);
  });
});

describe('aprovação de medição', () => {
  it('normaliza rótulos e assume Aprovada para registros antigos', () => {
    expect(normalizeAprovacao('aprovado')).toBe('Aprovada');
    expect(normalizeAprovacao('REJEITADA')).toBe('Rejeitada');
    expect(normalizeAprovacao('qualquer coisa')).toBe('Pendente');
    expect(medicaoAprovacao({})).toBe('Aprovada');
    expect(medicaoAprovacao({ aprovacao: 'Pendente' })).toBe('Pendente');
  });

  it('exclui medição rejeitada do custo financeiro', () => {
    const med = [
      { semana: '2026-11-01', obra: 'OB1', servico: 'Laje', vtotal: 1000, aprovacao: 'Aprovada' },
      { semana: '2026-11-02', obra: 'OB1', servico: 'Laje', vtotal: 500, aprovacao: 'Rejeitada' }
    ];
    const { all } = buildFinanceEntries([], [], med, []);
    expect(all).toHaveLength(1);
    expect(all[0].valorRealizado).toBe(1000);
    expect(all[0].aprovacao).toBe('Aprovada');
  });

  it('reflete a exclusão no relatório e mantém a linha rejeitada identificada', () => {
    const r = buildObraReport(baseDB(), 'OB1', { dataInicio: '2026-11-01', dataFim: '2026-11-30' });
    expect(r.resumo.totalRealizado).toBe(2500); // 1500 aprovada + 1000 pendente
    expect(r.resumo.fisico).toBeCloseTo(58.33, 2);
    const rejeitada = r.medicoes.find(m => m.aprovacao === 'Rejeitada');
    expect(rejeitada).toBeTruthy();
    expect(rejeitada.valor).toBe(500);
  });

  it('não mistura pagamento com aprovação física', () => {
    const db = baseDB();
    db.medicao[0].pgtoStatus = 'Pago';
    const r = buildMedicaoResumo(db, 'OB1');
    const laje = r.servicos.find(s => s.desc === 'Laje');
    expect(laje.qacum).toBe(50); // pagamento não altera o avanço
    expect(r.totais.fisico).toBeCloseTo(58.33, 2);
  });
});
