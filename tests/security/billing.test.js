// tests/security/billing.test.js
// Regras de ciclo de vida do SaaS: a UI é apenas experiência de uso; a autoridade
// é calcularBillingState() (job diário) + database.rules.json (bloqueio de acesso).
import { describe, it, expect } from 'vitest';
import {
  calcularBillingState,
  atualizarBillingStatesJob,
  MS_DIA,
  TRIAL_READONLY_DAYS,
  PAID_GRACE_DAYS,
  PAID_READONLY_DAYS
} from '../../functions/billing.js';

const AGORA = Date.parse('2026-06-01T12:00:00.000Z');
const dias = (n) => n * MS_DIA;

function makeFakeDb(tenants) {
  const state = { tenants: JSON.parse(JSON.stringify(tenants)) };
  const written = [];

  return {
    written,
    ref(caminho = '') {
      return {
        async once() {
          return { val: () => (caminho === 'tenants' ? state.tenants : null) };
        },
        async update(updates) {
          written.push(updates);
          for (const [key, value] of Object.entries(updates)) {
            const partes = key.split('/').filter(Boolean);
            let alvo = state;
            for (const parte of partes.slice(0, -1)) {
              alvo = alvo[parte];
            }
            alvo[partes[partes.length - 1]] = value;
          }
        }
      };
    }
  };
}

describe('calcularBillingState — free trial', () => {
  it('trial vigente fica ativo', () => {
    const r = calcularBillingState({
      plano: 'free_trial',
      trialExpiracao: AGORA + dias(10)
    }, AGORA);
    expect(r.billingState).toBe('ativo');
    expect(r.motivo).toBe('trial_vigente');
    expect(r.diasRestantes).toBe(10);
  });

  it('trial sem data usa webhookCriacao + 30 dias', () => {
    const r = calcularBillingState({
      plano: 'free_trial',
      webhookCriacao: AGORA - dias(29)
    }, AGORA);
    expect(r.billingState).toBe('ativo');
  });

  it('trial vencido entra em 7 dias de somente leitura', () => {
    const r = calcularBillingState({
      plano: 'free_trial',
      trialExpiracao: AGORA - dias(1)
    }, AGORA);
    expect(r.billingState).toBe('somente_leitura');
    expect(r.motivo).toBe('trial_expirado');
    expect(r.diasRestantes).toBe(TRIAL_READONLY_DAYS - 1);
  });

  it('no último dia da janela ainda é somente leitura; no dia seguinte bloqueia', () => {
    const expiracao = AGORA - dias(TRIAL_READONLY_DAYS);
    expect(calcularBillingState({ plano: 'free_trial', trialExpiracao: expiracao }, AGORA).billingState)
      .toBe('somente_leitura');
    expect(calcularBillingState({ plano: 'free_trial', trialExpiracao: expiracao - 1 }, AGORA).billingState)
      .toBe('bloqueado');
  });
});

describe('calcularBillingState — planos pagos', () => {
  const planoPago = { plano: 'pro', planoVencimento: AGORA + dias(20) };

  it('plano vigente fica ativo', () => {
    const r = calcularBillingState(planoPago, AGORA);
    expect(r.billingState).toBe('ativo');
    expect(r.motivo).toBe('plano_vigente');
  });

  it('vencido entra em carência de 5 dias', () => {
    const r = calcularBillingState({ ...planoPago, planoVencimento: AGORA - dias(2) }, AGORA);
    expect(r.billingState).toBe('carencia');
    expect(r.motivo).toBe('vencido_em_carencia');
    expect(r.diasRestantes).toBe(PAID_GRACE_DAYS - 2);
  });

  it('após a carência entra em somente leitura por 7 dias e depois bloqueia', () => {
    const vencimento = AGORA - dias(PAID_GRACE_DAYS + 1);
    const leitura = calcularBillingState({ ...planoPago, planoVencimento: vencimento }, AGORA);
    expect(leitura.billingState).toBe('somente_leitura');
    expect(leitura.motivo).toBe('carencia_expirada');

    const bloqueio = calcularBillingState({
      ...planoPago,
      planoVencimento: AGORA - dias(PAID_GRACE_DAYS + PAID_READONLY_DAYS + 1)
    }, AGORA);
    expect(bloqueio.billingState).toBe('bloqueado');
    expect(bloqueio.motivo).toBe('inadimplente');
  });

  it('respeita a carência de 3 dias do cancelamento gravada pelo webhook', () => {
    // Bug corrigido: o webhook grava carenciaAte=3 dias mesmo com vencimento futuro.
    const r = calcularBillingState({
      ...planoPago,
      status: 'carencia',
      carenciaAte: AGORA + dias(3)
    }, AGORA);
    expect(r.billingState).toBe('carencia');
    expect(r.motivo).toBe('carencia_webhook');
  });

  it('usa carenciaAte como início da janela de somente leitura', () => {
    const r = calcularBillingState({
      ...planoPago,
      planoVencimento: AGORA - dias(20),
      carenciaAte: AGORA - dias(2)
    }, AGORA);
    expect(r.billingState).toBe('somente_leitura');
    expect(r.diasRestantes).toBe(PAID_READONLY_DAYS - 2);
  });

  it('não bloqueia por carenciaAte antiga quando o plano foi renovado', () => {
    const r = calcularBillingState({
      ...planoPago,
      carenciaAte: AGORA - dias(30)
    }, AGORA);
    expect(r.billingState).toBe('ativo');
  });

  it('não bloqueia tenant sem data de vencimento confiável', () => {
    expect(calcularBillingState({ plano: 'pro' }, AGORA)).toEqual({
      billingState: 'ativo',
      motivo: 'sem_vencimento'
    });
  });
});

describe('calcularBillingState — exceções', () => {
  it('chargeback/reembolso bloqueia na hora', () => {
    const r = calcularBillingState({
      plano: 'pro',
      planoVencimento: AGORA + dias(30),
      status: 'bloqueado_pagamento',
      motivoBloqueio: 'chargeback'
    }, AGORA);
    expect(r).toMatchObject({ billingState: 'bloqueado', motivo: 'chargeback' });
  });

  it('MASTER_SYSTEM nunca cai em cobrança, mesmo com dados antigos', () => {
    const r = calcularBillingState({
      plano: 'free_trial',
      trialExpiracao: AGORA - dias(365)
    }, AGORA, 'MASTER_SYSTEM');
    expect(r).toMatchObject({ billingState: 'ativo', motivo: 'master_system' });
  });
});

describe('atualizarBillingStatesJob', () => {
  it('atualiza apenas tenants que mudaram de estado', async () => {
    const db = makeFakeDb({
      vencido: {
        plano: 'free_trial',
        trialExpiracao: AGORA - dias(TRIAL_READONLY_DAYS + 2),
        billingState: 'ativo'
      },
      vigente: { plano: 'pro', planoVencimento: AGORA + dias(10), billingState: 'ativo' }
    });

    const resultado = await atualizarBillingStatesJob(db, AGORA);

    expect(resultado.total).toBe(2);
    expect(resultado.alterados).toBe(1);
    expect(db.written).toHaveLength(1);
    expect(db.written[0]['tenants/vencido/billingState']).toBe('bloqueado');
    expect(db.written[0]['tenants/vencido/billingStateMotivo']).toBe('trial_encerrado');
    expect(db.written[0]['tenants/vencido/billingStateAtualizadoEm']).toBe(AGORA);
  });

  it('não grava nada quando todos os estados já estão corretos', async () => {
    const db = makeFakeDb({
      ok: { plano: 'pro', planoVencimento: AGORA + dias(10), billingState: 'ativo' }
    });
    const resultado = await atualizarBillingStatesJob(db, AGORA);
    expect(resultado.alterados).toBe(0);
    expect(db.written).toHaveLength(0);
  });

  it('não bloqueia o tenant MASTER_SYSTEM', async () => {
    const db = makeFakeDb({
      MASTER_SYSTEM: {
        plano: 'free_trial',
        trialExpiracao: AGORA - dias(999),
        billingState: 'ativo'
      }
    });
    const resultado = await atualizarBillingStatesJob(db, AGORA);
    expect(resultado.alterados).toBe(0);
    expect(db.written).toHaveLength(0);
  });
});
