// tests/aprovacoes-expiracao.test.js
// Prazos de 7/12 dias, expiração em 15, idempotência dos alertas e retomada
// de aplicações que ficaram reservadas no servidor.
import { describe, it, expect } from 'vitest';
import aprovacoes from '../functions/aprovacoes.js';
import { criarFakeDB, baseTenant, DIA } from './helpers/fake-db.js';

const {
  diasDecorridos, alertasDevidos, deveExpirar, processarAprovacoesJob,
  papelPodeDecidir, podeAplicar, aplicarAprovacaoPorId
} = aprovacoes;

const SOLICITADO = Date.UTC(2026, 10, 1, 12);

function pendente(sobrescrever = {}) {
  return {
    id: 'AP1',
    tipo: 'movimentacao_estoque',
    status: 'pendente',
    solicitadoPor: 'uid-enc',
    solicitadoEm: SOLICITADO,
    expiraEm: SOLICITADO + 15 * DIA,
    payload: { movimentacao: { codMat: 'ES1', qtd: 5, tipo: 'Entrada', obra: 'obra-a' } },
    ...sobrescrever
  };
}

function prepararJob(aprovacoes, extras = {}) {
  const inicial = baseTenant();
  Object.assign(inicial.tenants.t1, extras);
  inicial.tenants.t1.aprovacoes = aprovacoes.reduce((mapa, ap) => {
    mapa[ap.id] = ap;
    return mapa;
  }, {});
  return criarFakeDB(inicial);
}

describe('aprovacoes — cálculo dos prazos', () => {
  it('conta dias corridos a partir de solicitadoEm', () => {
    expect(diasDecorridos(SOLICITADO, SOLICITADO + 6 * DIA)).toBe(6);
    expect(diasDecorridos(SOLICITADO, SOLICITADO + 7 * DIA)).toBe(7);
    expect(diasDecorridos(SOLICITADO, SOLICITADO + 15 * DIA)).toBe(15);
    expect(diasDecorridos(undefined, SOLICITADO)).toBe(-1);
  });

  it('só devolve alertas vencidos e ainda não registrados', () => {
    const ap = pendente();
    expect(alertasDevidos(ap, SOLICITADO + 6 * DIA)).toEqual([]);
    expect(alertasDevidos(ap, SOLICITADO + 7 * DIA)).toEqual([7]);
    expect(alertasDevidos(ap, SOLICITADO + 12 * DIA)).toEqual([7, 12]);
    expect(alertasDevidos(ap, SOLICITADO + 14 * DIA)).toEqual([7, 12]);
    expect(alertasDevidos(ap, SOLICITADO + 15 * DIA)).toEqual([7, 12, 15]);
    expect(alertasDevidos({ ...ap, alertas: { '7': SOLICITADO + 7 * DIA } }, SOLICITADO + 12 * DIA))
      .toEqual([12]);
    expect(alertasDevidos({ ...ap, status: 'aprovado' }, SOLICITADO + 20 * DIA)).toEqual([]);
  });

  it('expira ao completar 15 dias, mas não antes', () => {
    const ap = pendente();
    expect(deveExpirar(ap, SOLICITADO + 14 * DIA + 1)).toBe(false);
    expect(deveExpirar(ap, SOLICITADO + 15 * DIA)).toBe(true);
    expect(deveExpirar({ ...ap, status: 'aprovado' }, SOLICITADO + 20 * DIA)).toBe(false);
  });
});

describe('aprovacoes — job diário', () => {
  it('no 7º dia cria um alerta e notifica solicitante e admin, uma única vez', async () => {
    const db = prepararJob([pendente()]);
    const agora = SOLICITADO + 7 * DIA;

    const primeiro = await processarAprovacoesJob(db, agora);
    expect(primeiro).toMatchObject({ alertas: 1, expiradas: 0, retomadas: 0 });
    expect(db.ler('tenants/t1/aprovacoes/AP1/alertas')).toHaveProperty('7', agora);

    const notificacoes = Object.values(db.ler('notificacoes/t1/uid-enc'));
    expect(notificacoes).toHaveLength(1);
    expect(notificacoes[0]).toMatchObject({ tipo: 'aprovacao_prazo', uid: 'uid-enc' });
    expect(Object.values(db.ler('notificacoes/t1/uid-admin'))).toHaveLength(1);
    expect(db.ler('notificacoes/t1/uid-outro')).toBeUndefined();

    const segundo = await processarAprovacoesJob(db, agora);
    expect(segundo.alertas).toBe(0);
    expect(Object.values(db.ler('notificacoes/t1/uid-enc'))).toHaveLength(1);
  });

  it('recupera alertas atrasados de uma vez (7 e 12) se o job não rodou', async () => {
    const db = prepararJob([pendente()]);
    const resultado = await processarAprovacoesJob(db, SOLICITADO + 12 * DIA);
    expect(resultado.alertas).toBe(2);
    expect(db.ler('tenants/t1/aprovacoes/AP1/alertas')).toHaveProperty('7');
    expect(db.ler('tenants/t1/aprovacoes/AP1/alertas')).toHaveProperty('12');
  });

  it('aos 15 dias expira sem aplicar nada e avisa solicitante e admin', async () => {
    const db = prepararJob([pendente()]);
    const agora = SOLICITADO + 15 * DIA;
    const resultado = await processarAprovacoesJob(db, agora);

    expect(resultado).toMatchObject({ expiradas: 1 });
    expect(db.ler('tenants/t1/aprovacoes/AP1/status')).toBe('expirado');
    expect(db.ler('tenants/t1/aprovacoes/AP1/expiradoEm')).toBe(agora);
    expect(db.ler('tenants/t1/estoque/0/entrada')).toBe(100);
    expect(db.ler('tenants/t1/aprovacoes/AP1/aplicadoEm')).toBeUndefined();

    const notificacoes = Object.values(db.ler('notificacoes/t1/uid-enc'));
    expect(notificacoes.some(n => n.tipo === 'aprovacao_expirada')).toBe(true);

    // Ainda que alguém tente aplicar depois, a operação não acontece.
    const tentativa = await aplicarAprovacaoPorId(db, 't1', 'AP1', agora + 1000);
    expect(tentativa).toMatchObject({ aplicado: false });
    expect(db.ler('tenants/t1/estoque/0/entrada')).toBe(100);
  });

  it('retoma aplicação reservada que não chegou a ser gravada', async () => {
    const ap = pendente({
      status: 'aprovado',
      decididoPor: 'uid-admin',
      decididoPorPapel: 'admin',
      reservadoEm: SOLICITADO + 4 * DIA
    });
    const db = prepararJob([ap]);
    const resultado = await processarAprovacoesJob(db, SOLICITADO + 5 * DIA);

    expect(resultado.retomadas).toBe(1);
    expect(db.ler('tenants/t1/estoque/0/entrada')).toBe(105);
    expect(db.ler('tenants/t1/aprovacoes/AP1/aplicadoEm')).toBe(SOLICITADO + 5 * DIA);
    expect(Object.values(db.ler('auditoria/t1'))).toHaveLength(1);
  });

  it('processa apenas o próprio tenant e mantém papéis legados sem poder de decisão', async () => {
    const db = prepararJob([pendente()]);
    await processarAprovacoesJob(db, SOLICITADO + 7 * DIA);
    expect(Object.keys(db.ler('notificacoes'))).toEqual(['t1']);

    const ap = pendente();
    for (const papel of ['mestre', 'encarregado', 'pendente', 'desativado', undefined]) {
      expect(papelPodeDecidir(papel, ap)).toBe(false);
      expect(podeAplicar({
        ...ap, status: 'aprovado', decididoPor: 'uid-x', decididoPorPapel: papel
      }, SOLICITADO + 3 * DIA)).toMatchObject({ ok: false, motivo: 'decisor_sem_autoridade' });
    }
  });
});
