import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { handleKiwifyWebhook, mapProductToPlan } from '../functions/kiwify.js';

const SECRET = 'kiwify_webhook_secret';

function criarDb(estado = {}, opcoes = {}) {
  const dados = JSON.parse(JSON.stringify(estado));
  const escritas = [];
  let falharProximaEscrita = opcoes.falharProximaEscrita || false;

  function ler(caminho) {
    if (!caminho) return Object.fromEntries(Object.entries(dados).filter(([k]) => k.includes('/') === false));
    return Object.prototype.hasOwnProperty.call(dados, caminho) ? dados[caminho] : null;
  }
  function gravar(caminho, valor) {
    if (valor == null) delete dados[caminho];
    else dados[caminho] = valor;
  }

  function ref(caminho = '') {
    const api = {
      once: async () => {
        const v = ler(caminho);
        return { exists: () => v != null, val: () => v };
      },
      set: async (v) => gravar(caminho, v),
      update: async (v) => {
        if (caminho) {
          gravar(caminho, { ...(ler(caminho) || {}), ...v });
          return;
        }
        // Escrita multi-path (db.ref().update(...)): atômica no RTDB real.
        if (falharProximaEscrita) {
          falharProximaEscrita = false;
          throw new Error('falha simulada de rede');
        }
        escritas.push({ ...v });
        for (const [k, valor] of Object.entries(v)) gravar(k, valor);
      },
      remove: async () => gravar(caminho, null),
      push: (v) => {
        const key = `debug_${Math.random().toString(36).slice(2)}`;
        if (v !== undefined) gravar(`${caminho}/${key}`, v);
        return { key, set: async (valor) => gravar(`${caminho}/${key}`, valor) };
      },
      child: (chave) => ref(`${caminho}/${chave}`),
      transaction: async (fn) => {
        const anterior = ler(caminho);
        const proximo = fn(anterior);
        if (proximo !== undefined) gravar(caminho, proximo);
        return { committed: proximo !== undefined, snapshot: { val: () => proximo === undefined ? anterior : proximo } };
      }
    };
    return api;
  }
  return {
    ref,
    dados,
    escritas,
    falharProximaEscrita() { falharProximaEscrita = true; }
  };
}

function reqKiwify(body, { query = {}, headerAssinatura = null } = {}) {
  const raw = Buffer.from(JSON.stringify(body), 'utf8');
  const assinatura = crypto.createHmac('sha1', SECRET).update(raw).digest('hex');
  return {
    method: 'POST',
    rawBody: raw,
    body,
    query: { signature: assinatura, ...query },
    headers: headerAssinatura ? { 'x-kiwify-signature': headerAssinatura } : {}
  };
}

function resMock() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    send(b) { this.body = b; return this; },
    json(b) { this.body = b; return this; }
  };
}

function pedidoPago({ orderId = 'ORD_123', eventType = 'order_approved', orderStatus = 'paid', reference = 'tenant_alpha', product = 'Plano Pro' } = {}) {
  return {
    order_id: orderId,
    webhook_event_type: eventType,
    order_status: orderStatus,
    external_reference: reference,
    Product: { product_name: product },
    Customer: { email: 'dono@alpha.com' },
    Commissions: { charge_amount: 9990 },
    payment_method: 'credit_card'
  };
}

function baseDb() {
  return criarDb({
    'tenants/tenant_alpha': { status: 'ativo', billingState: 'bloqueado', plano: 'free_trial' },
    tenants: { tenant_alpha: { status: 'ativo', billingState: 'bloqueado', plano: 'free_trial' } }
  });
}

describe('Kiwify — idempotência atômica', () => {
  let db;
  beforeEach(() => { db = baseDb(); });

  it('marca status success na MESMA escrita dos efeitos do tenant', async () => {
    const res = resMock();
    await handleKiwifyWebhook(reqKiwify(pedidoPago()), res, { secret: SECRET, db });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('processed');
    const escrita = db.escritas[0];
    expect(escrita['tenants/tenant_alpha/plano']).toBeTruthy();
    expect(escrita['billing_events/ORD_123/order_approved'].status).toBe('success');
    expect(db.dados['billing_events/ORD_123/order_approved'].payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('concorrência: duas entregas simultâneas processam uma vez só', async () => {
    const r1 = resMock();
    const r2 = resMock();
    await Promise.all([
      handleKiwifyWebhook(reqKiwify(pedidoPago()), r1, { secret: SECRET, db }),
      handleKiwifyWebhook(reqKiwify(pedidoPago()), r2, { secret: SECRET, db })
    ]);
    const statusos = [r1.body.status, r2.body.status].sort();
    expect(statusos).toEqual(['already_processed', 'processed']);
    expect(db.escritas).toHaveLength(1);
  });

  it('chave canônica ignora orderStatus (variável entre entregas)', async () => {
    const r1 = resMock();
    const r2 = resMock();
    await handleKiwifyWebhook(reqKiwify(pedidoPago({ orderStatus: 'paid' })), r1, { secret: SECRET, db });
    await handleKiwifyWebhook(reqKiwify(pedidoPago({ orderStatus: 'authorized' })), r2, { secret: SECRET, db });
    expect(r1.body.status).toBe('processed');
    expect(r2.body.status).toBe('already_processed');
    expect(db.escritas).toHaveLength(1);
  });

  it('reentrega com payload divergente retorna 409 conflict_ignored', async () => {
    const r1 = resMock();
    const r2 = resMock();
    await handleKiwifyWebhook(reqKiwify(pedidoPago({ product: 'Plano Pro' })), r1, { secret: SECRET, db });
    await handleKiwifyWebhook(reqKiwify(pedidoPago({ product: 'Ilimitado Anual' })), r2, { secret: SECRET, db });
    expect(r1.body.status).toBe('processed');
    expect(r2.statusCode).toBe(409);
    expect(r2.body.status).toBe('conflict_ignored');
    expect(db.escritas).toHaveLength(1);
  });

  it('falha na escrita final libera a reserva; retry produz o mesmo planoVencimento', async () => {
    db.falharProximaEscrita();
    const falho = resMock();
    await expect(handleKiwifyWebhook(reqKiwify(pedidoPago()), falho, { secret: SECRET, db })).rejects.toThrow('falha simulada');
    expect(db.dados['billing_events/ORD_123/order_approved']).toBeFalsy();

    // Avança o relógio para provar que o carimbo vem da reserva, não do retry.
    const agoraReal = Date.now;
    const primeiro = mapProductToPlan(pedidoPago(), 1_700_000_000_000).planoVencimento;
    Date.now = () => 1_700_000_000_000 + 60 * 60 * 1000;
    try {
      const retry = resMock();
      await handleKiwifyWebhook(reqKiwify(pedidoPago()), retry, { secret: SECRET, db });
      expect(retry.statusCode).toBe(200);
      expect(retry.body.status).toBe('processed');
      const marca = db.dados['billing_events/ORD_123/order_approved'];
      const carimbo = db.dados['tenants/tenant_alpha/planoVencimento'];
      expect(marca.claimedAt).toBe(1_700_000_000_000 + 60 * 60 * 1000);
      // O vencimento é calculado a partir do claimedAt persistido, não de um
      // Date.now() solto no meio do processamento.
      expect(carimbo).toBe(mapProductToPlan(pedidoPago(), marca.claimedAt).planoVencimento);
      expect(primeiro).not.toBe(carimbo);
    } finally {
      Date.now = agoraReal;
    }
  });

  it('tenant_not_found é reprocessável (pendente, não terminal)', async () => {
    const semTenant = criarDb({ tenants: {} });
    const body = pedidoPago({ reference: 'nao_existe', product: 'Plano Pro' });
    const r1 = resMock();
    await handleKiwifyWebhook(reqKiwify(body), r1, { secret: SECRET, db: semTenant });
    expect(r1.statusCode).toBe(202);
    expect(semTenant.dados['billing_events/ORD_123/order_approved'].status).toBe('pending_tenant');

    // Depois que a conta é criada, uma nova entrega pode ativar.
    semTenant.ref('tenants/tenant_alpha').set({ status: 'ativo', billingState: 'bloqueado' });
    const r2 = resMock();
    await handleKiwifyWebhook(reqKiwify({ ...body, external_reference: 'tenant_alpha' }), r2, { secret: SECRET, db: semTenant });
    expect(r2.statusCode).toBe(200);
    expect(r2.body.status).toBe('processed');
  });

  it('assinatura aceita header quando a query está ausente', async () => {
    const body = pedidoPago();
    const raw = Buffer.from(JSON.stringify(body), 'utf8');
    const assinatura = crypto.createHmac('sha1', SECRET).update(raw).digest('hex');
    const res = resMock();
    await handleKiwifyWebhook({
      method: 'POST', rawBody: raw, body, query: {},
      headers: { 'x-kiwify-signature': assinatura }
    }, res, { secret: SECRET, db });
    expect(res.statusCode).toBe(200);
  });

  it('cancelamento não desbloqueia tenant com chargeback anterior', async () => {
    const bloqueado = criarDb({
      'tenants/tenant_alpha': { status: 'bloqueado_pagamento', billingState: 'bloqueado', planoVencimento: Date.now() + 86400000 },
      tenants: { tenant_alpha: { status: 'bloqueado_pagamento', billingState: 'bloqueado', planoVencimento: Date.now() + 86400000 } }
    });
    const res = resMock();
    await handleKiwifyWebhook(
      reqKiwify(pedidoPago({ eventType: 'subscription_canceled', orderStatus: 'canceled' })),
      res,
      { secret: SECRET, db: bloqueado }
    );
    expect(res.statusCode).toBe(200);
    const escrita = bloqueado.escritas[0];
    expect(escrita['tenants/tenant_alpha/billingState']).toBeUndefined();
    expect(escrita['tenants/tenant_alpha/cancelamentoAgendado']).toBe(true);
  });
});
