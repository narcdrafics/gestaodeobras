import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  validarVerifyToken,
  validarAssinatura,
  normalizarTelefone,
  validarOrigem,
  extrairMensagem,
  urlAudioPermitida,
  autorizarRemetente,
  verificarEstado,
  chaveDedup,
  reservarMensagem,
  handleWhatsappWebhook
} from '../functions/whatsapp_auth.js';

const APP_SECRET = 'meta_app_secret_teste';
const VERIFY_TOKEN = 'verify_token_longo_e_aleatorio_2026';

function criarDb(estado = {}) {
  const dados = JSON.parse(JSON.stringify(estado));

  function ler(caminho) {
    const partes = caminho.split('/').filter(Boolean);
    let atual = dados;
    for (const p of partes) {
      if (atual == null || typeof atual !== 'object') return null;
      atual = atual[p];
    }
    return atual == null ? null : atual;
  }
  function escrever(caminho, valor) {
    const partes = caminho.split('/').filter(Boolean);
    let atual = dados;
    for (const p of partes.slice(0, -1)) {
      if (!atual[p] || typeof atual[p] !== 'object') atual[p] = {};
      atual = atual[p];
    }
    const ultima = partes[partes.length - 1];
    if (valor == null) delete atual[ultima];
    else atual[ultima] = valor;
  }

  function ref(caminho) {
    return {
      once: async () => {
        const v = ler(caminho);
        return { exists: () => v != null, val: () => v };
      },
      set: async (v) => escrever(caminho, v),
      update: async (v) => {
        const atual = ler(caminho) || {};
        escrever(caminho, { ...atual, ...v });
      },
      remove: async () => escrever(caminho, null),
      transaction: async (fn) => {
        const anterior = ler(caminho);
        const proximo = fn(anterior);
        if (proximo !== undefined) escrever(caminho, proximo);
        return { committed: proximo !== undefined, snapshot: { val: () => proximo === undefined ? anterior : proximo } };
      }
    };
  }
  return { ref, dados };
}

function reqPost(body, { assinaturaValida = true, wabaId, phoneNumberId } = {}) {
  const raw = Buffer.from(JSON.stringify(body), 'utf8');
  const assinatura = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(raw).digest('hex');
  return {
    method: 'POST',
    rawBody: raw,
    body,
    query: {},
    headers: {
      'x-hub-signature-256': assinaturaValida ? assinatura : 'sha256=' + '0'.repeat(64)
    },
    _wabaId: wabaId,
    _phoneNumberId: phoneNumberId
  };
}

function resMock() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    send(b) { this.body = b; return this; }
  };
}

function mensagemValida({ de = '5511999999999', msgId = 'wamid.abc123', texto = 'OI' } = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'WABA_1',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '11999999999', phone_number_id: 'PHONE_1' },
          messages: [{ id: msgId, from: de, text: { body: texto } }]
        }
      }]
    }]
  };
}

describe('WhatsApp — verificações criptográficas e de origem', () => {
  const raw = Buffer.from('{"hello":"world"}', 'utf8');

  it('valida o verify token em tempo constante e rejeita tokens divergentes', () => {
    expect(validarVerifyToken(VERIFY_TOKEN, VERIFY_TOKEN)).toBe(true);
    expect(validarVerifyToken('errado', VERIFY_TOKEN)).toBe(false);
    expect(validarVerifyToken(null, VERIFY_TOKEN)).toBe(false);
    expect(validarVerifyToken(VERIFY_TOKEN, '')).toBe(false);
  });

  it('valida HMAC-SHA256 sobre o rawBody e rejeita adulteração', () => {
    const sig = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(raw).digest('hex');
    expect(validarAssinatura({ rawBody: raw, headers: { 'x-hub-signature-256': sig } }, APP_SECRET)).toBe(true);
    expect(validarAssinatura({ rawBody: Buffer.from('{"hello":"hacked"}'), headers: { 'x-hub-signature-256': sig } }, APP_SECRET)).toBe(false);
    expect(validarAssinatura({ rawBody: raw, headers: {} }, APP_SECRET)).toBe(false);
    expect(validarAssinatura({ rawBody: raw, headers: { 'x-hub-signature-256': sig } }, '')).toBe(false);
  });

  it('normaliza telefone sem matching parcial', () => {
    expect(normalizarTelefone('5511999999999')).toBe('11999999999');
    expect(normalizarTelefone('(11) 99999-9999')).toBe('11999999999');
    expect(normalizarTelefone('11999999999')).toBe('11999999999');
    expect(normalizarTelefone('12')).toBe('');
    expect(normalizarTelefone('9898')).toBe('');
  });

  it('só aceita whatsapp_business_account e ignora o ramo page (SSRF)', () => {
    const msg = extrairMensagem(mensagemValida());
    expect(msg.from).toBe('5511999999999');
    expect(msg.msgId).toBe('wamid.abc123');
    expect(extrairMensagem({ object: 'page', entry: [{ messaging: [{}] }] })).toBeNull();
  });

  it('valida WABA e phone_number_id quando configurados', () => {
    const { entryId, value } = extrairMensagem(mensagemValida());
    expect(validarOrigem(entryId, value, { wabaId: 'WABA_1', phoneNumberId: 'PHONE_1' })).toBe(true);
    expect(validarOrigem(entryId, value, { wabaId: 'OUTRA', phoneNumberId: 'PHONE_1' })).toBe(false);
    expect(validarOrigem(entryId, value, { wabaId: 'WABA_1', phoneNumberId: 'OUTRO' })).toBe(false);
    expect(validarOrigem(entryId, value, {})).toBe(true);
  });

  it('aceita apenas URLs de mídia da Graph API', () => {
    expect(urlAudioPermitida('https://graph.facebook.com/v20.0/abc')).toBe(true);
    expect(urlAudioPermitida('https://evil.example.com/audio.ogg')).toBe(false);
    expect(urlAudioPermitida('http://graph.facebook.com/abc')).toBe(false);
    expect(urlAudioPermitida('https://graph.facebook.com.evil.com/abc')).toBe(false);
  });
});

describe('WhatsApp — autorização de tenant', () => {
  let db;
  beforeEach(() => {
    db = criarDb({
      users: {
        'admin@alpha,com': { uid: 'u1', tenantId: 'alpha', nome: 'Ana', status: 'ativo', telefone: '(11) 99999-9999' },
        'chefe@beta,com': { uid: 'u2', tenantId: 'beta', nome: 'Bia', status: 'ativo', whatsappId: '5511888888888' }
      },
      tenants: {
        alpha: { status: 'ativo', billingState: 'ativo', config: { telefonesPermitidos: ['11999999999'] } },
        beta: { status: 'ativo', billingState: 'ativo' }
      }
    });
  });

  it('encontra tenant pelo telefone normalizado em users', async () => {
    const r = await autorizarRemetente(db, { from: '5511999999999' });
    expect(r.ok).toBe(true);
    expect(r.tenantId).toBe('alpha');
    expect(r.origem).toBe('users');
  });

  it('não aceita substring: DDD curto não casa com número diferente', async () => {
    const r = await autorizarRemetente(db, { from: '5511999999998' });
    expect(r.ok).toBe(false);
  });

  it('rejeita número ambíguo em vez de escolher o primeiro tenant', async () => {
    const duplicado = criarDb({
      users: {
        'a@a,com': { tenantId: 'alpha', telefone: '11999999999' },
        'b@b,com': { tenantId: 'beta', telefone: '11999999999' }
      },
      tenants: { alpha: {}, beta: {} }
    });
    const r = await autorizarRemetente(duplicado, { from: '5511999999999' });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('numero_ambigu');
  });

  it('usa o fallback telefonesPermitidos apenas quando há match único', async () => {
    const r = await autorizarRemetente(db, { from: '5511777777777' });
    expect(r.ok).toBe(false);
    const fallback = criarDb({
      users: {},
      tenants: { gama: { config: { telefonesPermitidos: ['11777777777'] } } }
    });
    const ok = await autorizarRemetente(fallback, { from: '5511777777777' });
    expect(ok.ok).toBe(true);
    expect(ok.tenantId).toBe('gama');
  });

  it('bloqueia tenant e usuário inativos/bloqueados', () => {
    const dono = { status: 'inativo' };
    const tenant = { status: 'ativo', billingState: 'ativo' };
    expect(verificarEstado(dono, tenant).ok).toBe(false);
    expect(verificarEstado({}, { ...tenant, billingState: 'bloqueado' }).ok).toBe(false);
    expect(verificarEstado({}, { ...tenant, billingState: 'somente_leitura' }).ok).toBe(false);
    expect(verificarEstado({}, tenant).ok).toBe(true);
  });

  it('reserva msg.id atomicamente: segundo delivery é duplicado', async () => {
    const primeira = await reservarMensagem(db, 'wamid.abc123');
    const segunda = await reservarMensagem(db, 'wamid.abc123');
    expect(primeira.ok).toBe(true);
    expect(segunda.ok).toBe(false);
    expect(db.dados.whatsapp_messages[chaveDedup('wamid.abc123')].status).toBe('processing');
  });
});

describe('WhatsApp — handler HTTP', () => {
  const secrets = {
    verifyToken: VERIFY_TOKEN,
    appSecret: APP_SECRET,
    wabaId: 'WABA_1',
    phoneNumberId: 'PHONE_1'
  };

  function montar(estado = {}) {
    const db = criarDb({
      users: { 'admin@alpha,com': { tenantId: 'alpha', nome: 'Ana', status: 'ativo', telefone: '11999999999' } },
      tenants: { alpha: { status: 'ativo', billingState: 'ativo' } },
      ...estado
    });
    const processar = async () => {};
    const responder = async () => {};
    const executar = (req) => {
      const res = resMock();
      return handleWhatsappWebhook(req, res, { db, secrets, processar, responder }).then(() => res);
    };
    return { db, processar, responder, executar };
  }

  it('GET devolve challenge apenas com verify token correto', async () => {
    const { executar } = montar();
    const ok = await executar({ method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': VERIFY_TOKEN, 'hub.challenge': 'desafio' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toBe('desafio');
    const ruim = await executar({ method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'errado', 'hub.challenge': 'x' } });
    expect(ruim.statusCode).toBe(403);
  });

  it('rejeita assinatura inválida com 401 antes de qualquer processamento', async () => {
    let processou = false;
    const db = criarDb({});
    const res = resMock();
    await handleWhatsappWebhook(reqPost(mensagemValida(), { assinaturaValida: false }), res, {
      db, secrets, processar: async () => { processou = true; }, responder: async () => {}
    });
    expect(res.statusCode).toBe(401);
    expect(processou).toBe(false);
  });

  it('rejeita origem divergente com 403', async () => {
    const { executar } = montar();
    // A origem é lida do payload; trocar o id do entry simula WABA diferente.
    const body = mensagemValida();
    body.entry[0].id = 'WABA_ERRADA';
    const res = await executar(reqPost(body));
    expect(res.statusCode).toBe(403);
  });

  it('processa mensagem autorizada e faz ACK apenas ao final', async () => {
    const chamadas = [];
    const db = criarDb({
      users: { 'admin@alpha,com': { tenantId: 'alpha', nome: 'Ana', status: 'ativo', telefone: '11999999999' } },
      tenants: { alpha: { status: 'ativo', billingState: 'ativo' } }
    });
    const res = resMock();
    await handleWhatsappWebhook(reqPost(mensagemValida()), res, {
      db,
      secrets,
      processar: async (ctx) => chamadas.push(ctx),
      responder: async () => {}
    });
    expect(res.statusCode).toBe(200);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].tenantId).toBe('alpha');
    expect(chamadas[0].user.nome).toBe('Ana');
    expect(db.dados.whatsapp_messages[chaveDedup('wamid.abc123')].status).toBe('done');
  });

  it('replay do mesmo msg.id não processa duas vezes', async () => {
    let n = 0;
    const db = criarDb({
      users: { 'admin@alpha,com': { tenantId: 'alpha', telefone: '11999999999' } },
      tenants: { alpha: { status: 'ativo', billingState: 'ativo' } }
    });
    const opts = { db, secrets, processar: async () => { n += 1; }, responder: async () => {} };
    const r1 = await handleWhatsappWebhook(reqPost(mensagemValida()), resMock(), opts);
    const r2 = await handleWhatsappWebhook(reqPost(mensagemValida()), resMock(), opts);
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(n).toBe(1);
  });

  it('falha no processamento libera a reserva e responde 500 para a Meta reenviar', async () => {
    const db = criarDb({
      users: { 'admin@alpha,com': { tenantId: 'alpha', telefone: '11999999999' } },
      tenants: { alpha: { status: 'ativo', billingState: 'ativo' } }
    });
    const res = resMock();
    await handleWhatsappWebhook(reqPost(mensagemValida()), res, {
      db, secrets,
      processar: async () => { throw new Error('boom'); },
      responder: async () => {}
    });
    expect(res.statusCode).toBe(500);
    expect(db.dados.whatsapp_messages[chaveDedup('wamid.abc123')]).toBeFalsy();
  });

  it('remetente não autorizado não chega ao processamento', async () => {
    let processou = false;
    const db = criarDb({ users: {}, tenants: {} });
    const res = resMock();
    await handleWhatsappWebhook(reqPost(mensagemValida()), res, {
      db, secrets,
      processar: async () => { processou = true; },
      responder: async () => {}
    });
    expect(res.statusCode).toBe(403);
    expect(processou).toBe(false);
  });
});
