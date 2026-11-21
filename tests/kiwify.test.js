import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  validateKiwifySignature,
  identifyTenant,
  mapProductToPlan,
  handleKiwifyWebhook
} from '../functions/kiwify.js';

describe('Kiwify Webhook - Validação de Assinatura', () => {
  const secret = 'kiwify_secret_token_12345';
  const payload = JSON.stringify({ order_id: 'ord_123', status: 'paid' });
  const rawBody = Buffer.from(payload, 'utf8');

  it('valida assinatura HMAC-SHA1 correta', () => {
    const signature = crypto.createHmac('sha1', secret).update(rawBody).digest('hex');
    const valid = validateKiwifySignature(rawBody, signature, secret);
    expect(valid).toBe(true);
  });

  it('rejeita se a assinatura estiver errada', () => {
    const valid = validateKiwifySignature(rawBody, 'wrong_hex_signature_deadbeef', secret);
    expect(valid).toBe(false);
  });

  it('rejeita se o payload tiver sido adulterado', () => {
    const signature = crypto.createHmac('sha1', secret).update(rawBody).digest('hex');
    const tampered = Buffer.from(JSON.stringify({ order_id: 'ord_123', status: 'refunded' }), 'utf8');
    const valid = validateKiwifySignature(tampered, signature, secret);
    expect(valid).toBe(false);
  });

  it('rejeita quando signature ou secret estiverem ausentes', () => {
    expect(validateKiwifySignature(rawBody, null, secret)).toBe(false);
    expect(validateKiwifySignature(rawBody, '', secret)).toBe(false);
    expect(validateKiwifySignature(rawBody, 'abcd', null)).toBe(false);
  });
});

describe('Kiwify Webhook - Identificação de Tenant', () => {
  let mockDbData;
  let mockDb;

  beforeEach(() => {
    mockDbData = {
      'tenants': {
        'tenant_alpha': { config: { nomeEmpresa: 'Alpha Construtora' }, emailAdmin: 'alpha@obra.com' },
        'tenant_beta': { config: { nomeEmpresa: 'Beta Engenharia' }, emailAdmin: 'dono@beta.com' }
      },
      'tenants/tenant_alpha': { config: { nomeEmpresa: 'Alpha Construtora' }, emailAdmin: 'alpha@obra.com' },
      'tenants/tenant_beta': { config: { nomeEmpresa: 'Beta Engenharia' }, emailAdmin: 'dono@beta.com' },
      'tenants_public/meuslug/tenantId': 'tenant_alpha',
      'profiles': {
        'uid_1': { email: 'engenheiro@beta.com', tenantId: 'tenant_beta' },
        'uid_master': { email: 'master@obra.com', tenantId: 'MASTER_SYSTEM' }
      },
      'invites/convidado@beta,com/tenantId': 'tenant_beta'
    };

    mockDb = {
      ref: (path = '') => ({
        once: async () => ({
          exists: () => path in mockDbData,
          val: () => mockDbData[path] || null
        })
      })
    };
  });

  it('identifica tenant via external_reference direta no body', async () => {
    const body = { external_reference: 'tenant_alpha' };
    const tid = await identifyTenant(body, {}, mockDb);
    expect(tid).toBe('tenant_alpha');
  });

  it('identifica tenant via trackingParameters (src ou sck)', async () => {
    const body = { trackingParameters: { src: 'tenant_beta' } };
    const tid = await identifyTenant(body, {}, mockDb);
    expect(tid).toBe('tenant_beta');
  });

  it('identifica tenant via slug em tenants_public', async () => {
    const body = { external_reference: 'meuslug' };
    const tid = await identifyTenant(body, {}, mockDb);
    expect(tid).toBe('tenant_alpha');
  });

  it('Plano B: identifica tenant pelo e-mail do comprador casado com emailAdmin', async () => {
    const body = {
      Customer: { email: 'alpha@obra.com' }
    };
    const tid = await identifyTenant(body, {}, mockDb);
    expect(tid).toBe('tenant_alpha');
  });

  it('Plano B: identifica tenant pelo perfil de usuário correspondente', async () => {
    const body = {
      Customer: { email: 'engenheiro@beta.com' }
    };
    const tid = await identifyTenant(body, {}, mockDb);
    expect(tid).toBe('tenant_beta');
  });

  it('retorna null se não encontrar tenant', async () => {
    const body = {
      Customer: { email: 'desconhecido@nenhum.com' }
    };
    const tid = await identifyTenant(body, {}, mockDb);
    expect(tid).toBeNull();
  });
});

describe('Kiwify Webhook - Mapeamento de Produto para Plano', () => {
  it('mapeia produto Start mensal (+31 dias)', () => {
    const body = { Product: { product_name: 'Obra Real - Plano Start Mensal' } };
    const res = mapProductToPlan(body);
    expect(res.plano).toBe('start');
    expect(res.limites.limiteObras).toBe(2);
    expect(res.limites.limiteUsuarios).toBe(2);
    expect(res.isYearly).toBe(false);
    expect(res.planoVencimento).toBeGreaterThan(Date.now() + 30 * 24 * 60 * 60 * 1000);
  });

  it('mapeia produto Start anual (+365 dias)', () => {
    const body = { Product: { product_name: 'Plano Start Anual' } };
    const res = mapProductToPlan(body);
    expect(res.plano).toBe('start_anual');
    expect(res.isYearly).toBe(true);
    expect(res.planoVencimento).toBeGreaterThan(Date.now() + 364 * 24 * 60 * 60 * 1000);
  });

  it('mapeia produto Pro mensal (+31 dias)', () => {
    const body = { Product: { product_name: 'Obra Real Pro' } };
    const res = mapProductToPlan(body);
    expect(res.plano).toBe('pro');
    expect(res.limites.limiteObras).toBe(5);
    expect(res.limites.limiteUsuarios).toBe(5);
  });

  it('mapeia produto Ilimitado / Master', () => {
    const body = { Product: { product_name: 'Plano Ilimitado Obras Livres' } };
    const res = mapProductToPlan(body);
    expect(res.plano).toBe('ilimitado');
    expect(res.limites.limiteObras).toBe(9999);
  });
});

describe('Kiwify Webhook - Processamento de Requisições (handleKiwifyWebhook)', () => {
  const secret = 'kiwify_secret_key';
  let memoryDb;
  let mockDb;

  beforeEach(() => {
    memoryDb = {
      'tenants': {
        'tenant_100': {
          emailAdmin: 'cliente@teste.com',
          plano: 'free_trial',
          status: 'ativo'
        }
      },
      'tenants/tenant_100': {
        emailAdmin: 'cliente@teste.com',
        plano: 'free_trial',
        status: 'ativo'
      }
    };

    mockDb = {
      ref: (path = '') => ({
        once: async () => ({
          exists: () => path in memoryDb,
          val: () => memoryDb[path] || null
        }),
        set: async (val) => {
          memoryDb[path] = val;
        },
        update: async (updates) => {
          for (const [k, v] of Object.entries(updates)) {
            memoryDb[k] = v;
          }
        },
        push: (val) => {
          const pushKey = `push_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const fullPath = `${path}/${pushKey}`;
          if (val !== undefined) {
            memoryDb[fullPath] = val;
          }
          return {
            key: pushKey,
            set: async (newVal) => {
              memoryDb[fullPath] = newVal;
            }
          };
        }
      })
    };
  });

  function createMockReqRes({ method = 'POST', body, query = {}, headers = {} }) {
    const raw = Buffer.from(JSON.stringify(body || {}), 'utf8');
    const signature = crypto.createHmac('sha1', secret).update(raw).digest('hex');

    const req = {
      method,
      rawBody: raw,
      body: body || {},
      query: { signature, ...query },
      headers: { ...headers }
    };

    const res = {
      statusCode: 200,
      sentBody: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      send(data) {
        this.sentBody = data;
        return this;
      },
      json(data) {
        this.sentBody = data;
        return this;
      }
    };

    return { req, res, signature };
  }

  it('rejeita com 401 se método não for POST', async () => {
    const { req, res } = createMockReqRes({ method: 'GET', body: {} });
    await handleKiwifyWebhook(req, res, { secret, db: mockDb });
    expect(res.statusCode).toBe(401);
  });

  it('rejeita com 401 se a assinatura for inválida', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: { order_id: 'ord_1' },
      query: { signature: 'invalid_signature_hex_12345678901234567890' }
    });
    await handleKiwifyWebhook(req, res, { secret, db: mockDb });
    expect(res.statusCode).toBe(401);
  });

  it('processa compra aprovada (order_approved) com sucesso', async () => {
    const payload = {
      order_id: 'order_test_001',
      webhook_event_type: 'order_approved',
      order_status: 'paid',
      external_reference: 'tenant_100',
      Product: { product_name: 'Plano Pro Mensal' },
      Commissions: { charge_amount: 10590 },
      payment_method: 'credit_card',
      Customer: { email: 'cliente@teste.com' }
    };

    const { req, res } = createMockReqRes({ body: payload });
    await handleKiwifyWebhook(req, res, { secret, db: mockDb });

    expect(res.statusCode).toBe(200);
    expect(res.sentBody.status).toBe('processed');
    expect(memoryDb['tenants/tenant_100/plano']).toBe('pro');
    expect(memoryDb['tenants/tenant_100/status']).toBe('ativo');
    expect(memoryDb['tenants/tenant_100/config/limiteObras']).toBe(5);
    expect(memoryDb['tenants/tenant_100/origemAtivacao']).toBe('kiwify');
    expect(memoryDb['tenants/tenant_100/ultimoPagamento'].valor).toBe(105.9);
  });

  it('idempotência: chamada duplicada é ignorada sem alterações', async () => {
    const payload = {
      order_id: 'order_dup_001',
      webhook_event_type: 'order_approved',
      order_status: 'paid',
      external_reference: 'tenant_100',
      Product: { product_name: 'Plano Pro' }
    };

    const { req: req1, res: res1 } = createMockReqRes({ body: payload });
    await handleKiwifyWebhook(req1, res1, { secret, db: mockDb });
    expect(res1.sentBody.status).toBe('processed');

    // Segunda chamada (retry)
    const { req: req2, res: res2 } = createMockReqRes({ body: payload });
    await handleKiwifyWebhook(req2, res2, { secret, db: mockDb });
    expect(res2.statusCode).toBe(200);
    expect(res2.sentBody.status).toBe('already_processed');
  });

  it('trata reembolso (order_refunded) bloqueando o acesso', async () => {
    const payload = {
      order_id: 'order_ref_001',
      webhook_event_type: 'order_refunded',
      order_status: 'refunded',
      external_reference: 'tenant_100',
      Customer: { email: 'cliente@teste.com' }
    };

    const { req, res } = createMockReqRes({ body: payload });
    await handleKiwifyWebhook(req, res, { secret, db: mockDb });

    expect(res.statusCode).toBe(200);
    expect(memoryDb['tenants/tenant_100/status']).toBe('bloqueado_pagamento');
    expect(memoryDb['tenants/tenant_100/motivoBloqueio']).toBe('reembolso');
  });

  it('trata chargeback bloqueando o acesso', async () => {
    const payload = {
      order_id: 'order_cb_001',
      webhook_event_type: 'chargeback',
      order_status: 'chargedback',
      external_reference: 'tenant_100'
    };

    const { req, res } = createMockReqRes({ body: payload });
    await handleKiwifyWebhook(req, res, { secret, db: mockDb });

    expect(res.statusCode).toBe(200);
    expect(memoryDb['tenants/tenant_100/status']).toBe('bloqueado_pagamento');
    expect(memoryDb['tenants/tenant_100/motivoBloqueio']).toBe('chargeback');
  });

  it('trata atraso de pagamento (subscription_late) enviando para a carência A2', async () => {
    const payload = {
      order_id: 'order_late_001',
      webhook_event_type: 'subscription_late',
      order_status: 'waiting_payment',
      external_reference: 'tenant_100'
    };

    const { req, res } = createMockReqRes({ body: payload });
    await handleKiwifyWebhook(req, res, { secret, db: mockDb });

    expect(res.statusCode).toBe(200);
    expect(memoryDb['tenants/tenant_100/status']).toBe('carencia');
    expect(memoryDb['tenants/tenant_100/carenciaAte']).toBeGreaterThan(Date.now());
  });

  it('auditoria: registra eventos e testes no nó webhook_debug para o painel master', async () => {
    const payload = {
      order_id: 'order_audit_test',
      webhook_event_type: 'order_approved',
      order_status: 'paid',
      external_reference: 'tenant_100',
      Customer: { email: 'cliente@teste.com' }
    };

    const { req, res } = createMockReqRes({ body: payload });
    await handleKiwifyWebhook(req, res, { secret, db: mockDb });

    const debugEntries = Object.keys(memoryDb).filter(k => k.startsWith('webhook_debug/'));
    expect(debugEntries.length).toBeGreaterThan(0);
    const lastEntry = memoryDb[debugEntries[0]];
    expect(lastEntry.orderId).toBe('order_audit_test');
    expect(lastEntry.result).toContain('Success');
  });
});
