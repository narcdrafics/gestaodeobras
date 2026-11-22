// tests/aprovacoes.test.js
// Cobertura da aplicação das solicitações pelo servidor: cada tipo de operação,
// idempotência, auditoria, notificações e a delegação limitada ao engenheiro.
import { describe, it, expect } from 'vitest';
import aprovacoes from '../functions/aprovacoes.js';
import { criarFakeDB, baseTenant, aprovacaoBase, DIA } from './helpers/fake-db.js';

const {
  normalizarRole, papelPodeDecidir, podeAplicar, validarIntegridadeFinanceira,
  aplicarAprovacaoPorId, aoEscreverAprovacao
} = aprovacoes;

const AGORA = Date.UTC(2026, 10, 4, 12); // 3 dias após solicitadoEm

function preparar(aprovacao, extras = {}) {
  const inicial = baseTenant();
  Object.assign(inicial.tenants.t1, extras);
  inicial.tenants.t1.aprovacoes = { AP1: aprovacao };
  return criarFakeDB(inicial);
}

describe('aprovacoes — funções puras de autoridade', () => {
  it('normaliza o alias legado sem escalar papel', () => {
    expect(normalizarRole('mestre')).toBe('encarregado');
    expect(normalizarRole('encarregado')).toBe('encarregado');
    expect(normalizarRole('admin')).toBe('admin');
    expect(papelPodeDecidir('mestre', aprovacaoBase())).toBe(false);
    expect(papelPodeDecidir('encarregado', aprovacaoBase())).toBe(false);
    expect(papelPodeDecidir('admin', aprovacaoBase())).toBe(true);
    expect(papelPodeDecidir('super_admin', aprovacaoBase())).toBe(true);
  });

  it('engenheiro decide apenas movimentacao_estoque e obrigatoriamente notifica o admin', () => {
    const mov = aprovacaoBase({ tipo: 'movimentacao_estoque' });
    expect(papelPodeDecidir('engenheiro', mov)).toBe(false);
    expect(papelPodeDecidir('engenheiro', { ...mov, notificarAdmin: true })).toBe(true);
    expect(papelPodeDecidir('engenheiro', {
      ...mov, tipo: 'trabalhador_add', notificarAdmin: true
    })).toBe(false);
    expect(papelPodeDecidir('engenheiro', {
      ...mov, tipo: 'financeiro_status', notificarAdmin: true
    })).toBe(false);
  });

  it('podeAplicar bloqueia status inválido, expiração, payload ausente e decisor sem poder', () => {
    expect(podeAplicar(aprovacaoBase(), AGORA).ok).toBe(true);
    expect(podeAplicar({ ...aprovacaoBase(), status: 'pendente' }, AGORA))
      .toMatchObject({ ok: false, motivo: 'status_invalido' });
    expect(podeAplicar({ ...aprovacaoBase(), expiraEm: AGORA - 1 }, AGORA))
      .toMatchObject({ ok: false, motivo: 'expirada' });
    expect(podeAplicar({ ...aprovacaoBase(), expiradoEm: AGORA - 1000 }, AGORA))
      .toMatchObject({ ok: false, motivo: 'expirada' });
    expect(podeAplicar({ ...aprovacaoBase(), payload: null }, AGORA))
      .toMatchObject({ ok: false, motivo: 'sem_payload' });
    expect(podeAplicar({ ...aprovacaoBase(), decididoPorPapel: 'encarregado' }, AGORA))
      .toMatchObject({ ok: false, motivo: 'decisor_sem_autoridade' });
    expect(podeAplicar({ ...aprovacaoBase(), tipo: 'desconhecido' }, AGORA))
      .toMatchObject({ ok: false, motivo: 'tipo_invalido' });
  });

  it('revalida a integridade do financeiro no servidor', () => {
    expect(validarIntegridadeFinanceira({ prev: 1000, real: 1200, status: 'Pago', valpago: 0 }).valpago).toBe(1200);
    expect(validarIntegridadeFinanceira({ prev: 1000, real: 0, status: 'Pago', valpago: 0 }).valpago).toBe(1000);
    expect(validarIntegridadeFinanceira({ prev: 1000, real: 1000, status: 'Atrasado', valpago: 900 }).valpago).toBe(0);
    expect(validarIntegridadeFinanceira({ prev: 1000, real: 1000, status: 'Parcial', valpago: 300 }).valpago).toBe(300);
    expect(validarIntegridadeFinanceira({ prev: 1000, real: 1000, status: 'Parcial', valpago: 5000 }).valpago).toBe(1000);
    expect(() => validarIntegridadeFinanceira({ status: 'Liquidado' })).toThrow('status_pagamento_invalido');
  });
});

describe('aprovacoes — aplicação das operações', () => {
  it('movimentação de entrada atualiza estoque, cria movimentação, auditoria e notificação', async () => {
    const ap = aprovacaoBase({
      payload: {
        movimentacao: {
          codMat: 'ES1', mat: 'Cimento', qtd: 10, tipo: 'Entrada',
          obra: 'obra-a', nf: 'NF-123'
        }
      }
    });
    const db = preparar(ap);
    const res = await aplicarAprovacaoPorId(db, 't1', 'AP1', AGORA);

    expect(res).toMatchObject({ aplicado: true, aprovacaoId: 'AP1', tenantId: 't1' });
    expect(db.ler('tenants/t1/estoque/0/entrada')).toBe(110);
    expect(db.ler('tenants/t1/movEstoque/0')).toMatchObject({
      tipo: 'Entrada', qtd: 10, nf: 'NF-123', codMat: 'ES1'
    });
    expect(db.ler('tenants/t1/aprovacoes/AP1/aplicadoEm')).toBe(AGORA);

    const [auditoria] = Object.values(db.ler('auditoria/t1'));
    expect(auditoria).toMatchObject({
      acao: 'movimentacao_estoque', aprovacaoId: 'AP1',
      ator: 'uid-admin', atorRole: 'admin', solicitadoPor: 'uid-enc'
    });
    const [notificacao] = Object.values(db.ler('notificacoes/t1/uid-enc'));
    expect(notificacao).toMatchObject({
      tipo: 'aprovacao_decidida', paraAdmin: false, uid: 'uid-enc', lido: false
    });
    expect(db.ler('notificacoes/t1/uid-admin')).toBeDefined();
  });

  it('é idempotente: uma segunda aplicação não duplica estoque nem movimentação', async () => {
    const ap = aprovacaoBase({
      payload: { movimentacao: { codMat: 'ES1', qtd: 5, tipo: 'Entrada', obra: 'obra-a' } }
    });
    const db = preparar(ap);
    await aplicarAprovacaoPorId(db, 't1', 'AP1', AGORA);
    const segunda = await aplicarAprovacaoPorId(db, 't1', 'AP1', AGORA + 1000);

    expect(segunda).toMatchObject({ aplicado: false, motivo: 'ja_processada_ou_reservada' });
    expect(db.ler('tenants/t1/estoque/0/entrada')).toBe(105);
    expect(Object.keys(db.ler('tenants/t1/movEstoque'))).toHaveLength(1);
    expect(Object.keys(db.ler('auditoria/t1'))).toHaveLength(1);
  });

  it('saída sem saldo falha, marca status erro e avisa o admin', async () => {
    const ap = aprovacaoBase({
      payload: { movimentacao: { codMat: 'ES1', qtd: 1000, tipo: 'Saída', obra: 'obra-a' } }
    });
    const db = preparar(ap);
    const res = await aplicarAprovacaoPorId(db, 't1', 'AP1', AGORA);

    expect(res).toMatchObject({ aplicado: false, motivo: 'saldo_insuficiente' });
    expect(db.ler('tenants/t1/aprovacoes/AP1/status')).toBe('erro');
    expect(db.ler('tenants/t1/estoque/0/saida')).toBe(20);
    const notificacoes = Object.values(db.ler('notificacoes/t1/uid-admin'));
    expect(notificacoes[0]).toMatchObject({ tipo: 'aprovacao_erro', paraAdmin: true, uid: 'uid-admin' });
  });

  it('transferência gera saída na origem, entrada no destino e cria item quando necessário', async () => {
    const ap = aprovacaoBase({
      payload: {
        movimentacao: {
          codMat: 'ES1', qtd: 8, tipo: 'Transferência',
          obra: 'obra-a', obraDestino: 'obra-b'
        }
      }
    });
    const db = preparar(ap);
    const res = await aplicarAprovacaoPorId(db, 't1', 'AP1', AGORA);

    expect(res.aplicado).toBe(true);
    expect(db.ler('tenants/t1/estoque/0/saida')).toBe(28);
    expect(db.ler('tenants/t1/estoque/1')).toMatchObject({ obra: 'obra-b', mat: 'Cimento', entrada: 8 });
    const movs = Object.values(db.ler('tenants/t1/movEstoque'));
    expect(movs.map(m => m.tipo)).toEqual(['Transferência (Saída)', 'Transferência (Entrada)']);
  });

  it('decisão do engenheiro gera aviso extra ao admin', async () => {
    const ap = aprovacaoBase({
      decididoPor: 'uid-eng',
      decididoPorPapel: 'engenheiro',
      notificarAdmin: true,
      payload: { movimentacao: { codMat: 'ES1', qtd: 2, tipo: 'Entrada', obra: 'obra-a' } }
    });
    const db = preparar(ap);
    const res = await aplicarAprovacaoPorId(db, 't1', 'AP1', AGORA);

    expect(res.aplicado).toBe(true);
    const notificacoes = Object.values(db.ler('notificacoes/t1/uid-admin'));
    expect(notificacoes.map(n => n.tipo)).toEqual(
      expect.arrayContaining(['aprovacao_decidida', 'decisao_engenheiro'])
    );
    const aviso = notificacoes.find(n => n.tipo === 'decisao_engenheiro');
    expect(aviso).toMatchObject({ paraAdmin: true, uid: 'uid-admin' });
    expect(db.ler('notificacoes/t1/uid-eng')).toBeUndefined();
    expect(db.ler('notificacoes/t1/uid-enc')).toBeUndefined();
    const [auditoria] = Object.values(db.ler('auditoria/t1'));
    expect(auditoria.atorRole).toBe('engenheiro');
  });

  it('trabalhador_add e trabalhador_remove alteram a lista apenas após decisão', async () => {
    const add = aprovacaoBase({
      tipo: 'trabalhador_add',
      payload: { trabalhador: { cod: 'T2', nome: 'Maria', funcao: 'Pedreira' } }
    });
    const dbAdd = preparar(add);
    expect((await aplicarAprovacaoPorId(dbAdd, 't1', 'AP1', AGORA)).aplicado).toBe(true);
    expect(dbAdd.ler('tenants/t1/trabalhadores/1')).toMatchObject({ cod: 'T2', nome: 'Maria' });

    const remove = aprovacaoBase({
      tipo: 'trabalhador_remove', payload: { cod: 'T1' }
    });
    const dbRemove = preparar(remove);
    expect((await aplicarAprovacaoPorId(dbRemove, 't1', 'AP1', AGORA)).aplicado).toBe(true);
    expect(dbRemove.ler('tenants/t1/trabalhadores')).toEqual([]);
  });

  it('lançamento financeiro solicitado nasce Pendente com valpago zero; status só muda com aprovação', async () => {
    const lanc = aprovacaoBase({
      tipo: 'financeiro_lancamento',
      payload: {
        lancamento: {
          desc: 'Aditivo', obra: 'obra-a', prev: 500, real: 500,
          status: 'Pago', valpago: 500
        }
      }
    });
    const dbLanc = preparar(lanc);
    expect((await aplicarAprovacaoPorId(dbLanc, 't1', 'AP1', AGORA)).aplicado).toBe(true);
    expect(dbLanc.ler('tenants/t1/financeiro/1')).toMatchObject({
      desc: 'Aditivo', status: 'Pendente', valpago: 0
    });

    const status = aprovacaoBase({
      tipo: 'financeiro_status',
      payload: { indice: 1, status: 'Pago', valpago: 999 }
    });
    const dbStatus = preparar(status, {
      financeiro: [
        { desc: 'Empreitada', prev: 1000, real: 1000, status: 'Pendente', valpago: 0 },
        { desc: 'Aditivo', prev: 500, real: 500, status: 'Pendente', valpago: 0 }
      ]
    });
    expect((await aplicarAprovacaoPorId(dbStatus, 't1', 'AP1', AGORA)).aplicado).toBe(true);
    expect(dbStatus.ler('tenants/t1/financeiro/1')).toMatchObject({ status: 'Pago', valpago: 500 });
  });

  it('compra cria registro público sem dados comerciais e guarda os sensíveis em comprasPrivadas', async () => {
    const ap = aprovacaoBase({
      tipo: 'compra_criacao',
      payload: {
        compra: {
          id: 'CP-9', mat: 'Cimento', qtd: 20, unid: 'sc', status: 'Aprovado',
          forn: 'Fornecedor', vunit: 30, vtotal: 600, vorc: 650, prazo: '2026-12-01', pixkey: 'chave'
        },
        compraPrivada: { forn: 'Fornecedor', vunit: 30, vtotal: 600, pixkey: 'chave' }
      }
    });
    const db = preparar(ap);
    expect((await aplicarAprovacaoPorId(db, 't1', 'AP1', AGORA)).aplicado).toBe(true);

    const compra = db.ler('tenants/t1/compras/0');
    expect(compra).toMatchObject({ id: 'CP-9', mat: 'Cimento', qtd: 20 });
    for (const campo of ['forn', 'pixkey', 'vunit', 'vtotal', 'vorc', 'prazo']) {
      expect(compra).not.toHaveProperty(campo);
    }
    expect(db.ler('comprasPrivadas/t1/CP-9')).toMatchObject({
      pixkey: 'chave', forn: 'Fornecedor', aprovacaoId: 'AP1'
    });
  });

  it('fechamento de orçamento e medição recalcula totais e registra o decisor', async () => {
    const orc = aprovacaoBase({
      tipo: 'orcamento_fechamento',
      payload: { indice: 0, item: { qtd: 12, vunit: 100 } }
    });
    const dbOrc = preparar(orc);
    expect((await aplicarAprovacaoPorId(dbOrc, 't1', 'AP1', AGORA)).aplicado).toBe(true);
    expect(dbOrc.ler('tenants/t1/orcamento/0')).toMatchObject({
      id: 'SVC1', qtd: 12, vtotal: 1200, aprovacao: 'Aprovado', aprovadoPor: 'uid-admin'
    });

    const med = aprovacaoBase({
      tipo: 'medicao_fechamento', payload: { indice: 0, item: { qreal: 5, vunit: 100 } }
    });
    const dbMed = preparar(med);
    expect((await aplicarAprovacaoPorId(dbMed, 't1', 'AP1', AGORA)).aplicado).toBe(true);
    expect(dbMed.ler('tenants/t1/medicao/0')).toMatchObject({
      qreal: 5, vtotal: 500, aprovacao: 'Aprovado'
    });
  });

  it('cria item novo de orçamento e medição quando o engenheiro prepara a inclusão', async () => {
    const orc = aprovacaoBase({
      tipo: 'orcamento_fechamento',
      payload: {
        criar: true,
        item: { id: 'SVC-NOVO', desc: 'Aditivo', obra: 'obra-a', qtd: 3, vunit: 200 }
      }
    });
    const dbOrc = preparar(orc);
    expect((await aplicarAprovacaoPorId(dbOrc, 't1', 'AP1', AGORA)).aplicado).toBe(true);
    expect(dbOrc.ler('tenants/t1/orcamento/1')).toMatchObject({
      id: 'SVC-NOVO', desc: 'Aditivo', qtd: 3, vunit: 200, vtotal: 600, aprovacao: 'Aprovado'
    });

    const med = aprovacaoBase({
      tipo: 'medicao_fechamento',
      payload: {
        criar: true,
        item: { obra: 'obra-a', servico: 'Aditivo', qreal: 4, vunit: 100 }
      }
    });
    const dbMed = preparar(med);
    expect((await aplicarAprovacaoPorId(dbMed, 't1', 'AP1', AGORA)).aplicado).toBe(true);
    expect(dbMed.ler('tenants/t1/medicao/1')).toMatchObject({
      servico: 'Aditivo', qreal: 4, vtotal: 400, aprovacao: 'Aprovado'
    });
  });

  it('o trigger ignora rejeição e updates internos da própria aplicação', async () => {
    const ap = aprovacaoBase({ status: 'pendente' });
    const db = preparar(ap);
    const rejeitado = await aoEscreverAprovacao(
      db, 't1', 'AP1', { ...ap, status: 'rejeitado' }, ap, AGORA
    );
    expect(rejeitado).toMatchObject({ ignorado: true });
    expect(db.ler('tenants/t1/estoque/0/entrada')).toBe(100);

    const apAprovado = { ...ap, status: 'aprovado' };
    const updateInterno = await aoEscreverAprovacao(
      db, 't1', 'AP1', { ...apAprovado, aplicadoEm: AGORA }, apAprovado, AGORA
    );
    expect(updateInterno).toMatchObject({ ignorado: true });
  });

  it('não aplica nada depois da expiração, mesmo com status aprovado', async () => {
    const ap = aprovacaoBase({
      expiraEm: AGORA - DIA,
      payload: { movimentacao: { codMat: 'ES1', qtd: 5, tipo: 'Entrada', obra: 'obra-a' } }
    });
    const db = preparar(ap);
    const res = await aplicarAprovacaoPorId(db, 't1', 'AP1', AGORA);
    expect(res).toMatchObject({ aplicado: false, motivo: 'expirada' });
    expect(db.ler('tenants/t1/estoque/0/entrada')).toBe(100);
    expect(db.ler('tenants/t1/aprovacoes/AP1/status')).toBe('erro');
  });
});
