import { describe, it, expect } from 'vitest';
import {
  migrateServiceIds, budgetServiceKey, medicaoServiceKey,
  buildOrcamentoBoard, calcBudgetProgress
} from './utils_wrapper.js';

const baseDb = () => ({
  financeiro: [], presenca: [], almocos: [], compras: [], medicao: [], orcamento: []
});

describe('IDs estáveis e migração de vínculos', () => {
  it('atribui IDs únicos e liga medições pela heurística frente/equipe', () => {
    const db = baseDb();
    db.orcamento = [
      { obra: 'OB1', etapa: 'Revestimento', desc: 'Reboco interno', frente: 'Norte', equipe: 'Equipe A', qtd: 100, vunit: 10, vtotal: 1000 },
      { obra: 'OB1', etapa: 'Revestimento', desc: 'Reboco interno', frente: 'Sul', equipe: 'Equipe B', qtd: 80, vunit: 12, vtotal: 960 }
    ];
    db.medicao = [
      { obra: 'OB1', etapa: 'Revestimento', servico: 'Reboco interno', frente: 'Sul', equipe: 'Equipe B', qreal: 10, vtotal: 120 }
    ];

    migrateServiceIds(db);

    const ids = db.orcamento.map(o => o.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(2);
    expect(db.medicao[0].serviceId).toBe(db.orcamento[1].id);
    expect(db.medicao[0].orcKey).toBe('ob1|revestimento|reboco interno');
    expect(db.medicao[0].serviceIdReview).toBeUndefined();
    expect(medicaoServiceKey(db.medicao[0])).toBe(budgetServiceKey(db.orcamento[1]));
  });

  it('é idempotente e preserva o vínculo se a descrição for corrigida depois', () => {
    const db = baseDb();
    db.orcamento = [{ obra: 'OB1', etapa: 'Alvenaria', desc: 'Tijolo com erro', qtd: 10, vtotal: 100 }];
    db.medicao = [{ obra: 'OB1', etapa: 'Alvenaria', servico: 'Tijolo com erro', qreal: 2, vtotal: 20 }];

    migrateServiceIds(db);
    const id = db.orcamento[0].id;
    db.orcamento[0].desc = 'Tijolo cerâmico';
    migrateServiceIds(db);

    expect(db.orcamento[0].id).toBe(id);
    expect(db.medicao[0].serviceId).toBe(id);
    expect(medicaoServiceKey(db.medicao[0])).toBe(id);
  });

  it('marca para revisão quando a chave é ambígua e não há pista suficiente', () => {
    const db = baseDb();
    db.orcamento = [
      { obra: 'OB1', etapa: 'Pintura', desc: 'Parede', qtd: 10, vtotal: 100 },
      { obra: 'OB1', etapa: 'Pintura', desc: 'Parede', qtd: 10, vtotal: 100 }
    ];
    db.medicao = [{ obra: 'OB1', etapa: 'Pintura', servico: 'Parede', qreal: 1, vtotal: 10 }];

    migrateServiceIds(db);

    expect(db.medicao[0].serviceId).toBe(db.orcamento[0].id);
    expect(db.medicao[0].serviceIdReview).toBe(true);
  });

  it('usa sub-etapa para desempatar quando frente e equipe não ajudam', () => {
    const db = baseDb();
    db.orcamento = [
      { obra: 'OB1', etapa: 'Revestimento', subEtapa: 'Frente Norte', desc: 'Reboco', qtd: 10, vtotal: 100 },
      { obra: 'OB1', etapa: 'Revestimento', subEtapa: 'Frente Sul', desc: 'Reboco', qtd: 10, vtotal: 100 }
    ];
    db.medicao = [{ obra: 'OB1', etapa: 'Revestimento', subEtapa: 'Frente Sul', servico: 'Reboco', qreal: 1, vtotal: 10 }];

    migrateServiceIds(db);

    expect(db.medicao[0].serviceId).toBe(db.orcamento[1].id);
    expect(db.medicao[0].serviceIdReview).toBeUndefined();
  });
});

describe('Board do Orçamento', () => {
  it('mostra medido por serviço e pago/a pagar do Financeiro sem repetir a etapa', () => {
    const db = baseDb();
    db.orcamento = [
      { obra: 'OB1', etapa: 'Fundação', desc: 'A', qtd: 10, vunit: 10, vtotal: 100, id: 'svc-a' },
      { obra: 'OB1', etapa: 'Fundação', desc: 'B', qtd: 10, vunit: 10, vtotal: 100, id: 'svc-b' }
    ];
    db.medicao = [{
      obra: 'OB1', etapa: 'Fundação', servico: 'A', serviceId: 'svc-a',
      qreal: 4, vtotal: 40, pgtoStatus: 'Pago'
    }];
    db.financeiro = [
      { obra: 'OB1', etapa: 'Fundação', desc: 'Pagamento B', serviceId: 'svc-b', real: 50, status: 'Pago' },
      { obra: 'OB1', etapa: 'Fundação', desc: 'Aluguel da etapa', real: 30, status: 'Pago' }
    ];

    const board = buildOrcamentoBoard(db, { obra: 'OB1' });
    const [a, b] = board.linhas;
    const grupo = board.grupos[0];

    expect(a.medidoQtd).toBe(4);
    expect(a.medidoValor).toBe(40);
    expect(a.pago).toBe(40);
    expect(b.medidoValor).toBe(0);
    expect(b.pago).toBe(50);
    expect(grupo.subtotais.medido).toBe(40);
    expect(grupo.subtotais.pago).toBe(120); // 40 + 50 + 30 (sem vínculo, uma vez só)
    expect(grupo.semVinculo.pago).toBe(30);
    expect(board.totais.prev).toBe(200);
    expect(board.totais.pago).toBe(120);
  });

  it('não repete custo sem vínculo em cada subetapa da mesma etapa', () => {
    const db = baseDb();
    db.orcamento = [
      { obra: 'OB1', etapa: 'Fundação', desc: 'A', qtd: 10, vtotal: 100, id: 'svc-a' },
      { obra: 'OB1', etapa: 'Fundação', subEtapa: 'Bloco B', desc: 'B', qtd: 8, vtotal: 80, id: 'svc-b' }
    ];
    db.financeiro = [{ obra: 'OB1', etapa: 'Fundação', real: 30, status: 'Pago' }];

    const board = buildOrcamentoBoard(db, { obra: 'OB1' });

    expect(board.grupos).toHaveLength(2);
    expect(board.totais.pago).toBe(30);
    expect(board.grupos.filter(g => g.semVinculo)).toHaveLength(1);
  });

  it('mantém calcBudgetProgress como compatibilidade baseada no medido', () => {
    const db = baseDb();
    db.orcamento = [{ obra: 'OB1', etapa: 'Fundação', vtotal: 1000, id: 'svc-a' }];
    db.medicao = [{ obra: 'OB1', etapa: 'Fundação', servico: 'A', serviceId: 'svc-a', qreal: 6, vtotal: 600 }];
    db.financeiro = [{ obra: 'OB1', etapa: 'Fundação', real: 9000, status: 'Pago' }];

    const res = calcBudgetProgress(db.orcamento, db.financeiro, [], db);

    expect(res[0].realizado).toBe(600);
    expect(res[0].diferenca).toBe(400);
    expect(res[0].perc).toBe('60.0');
    expect(res[0].pago).toBe(0);
  });
});
