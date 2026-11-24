import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { validarCorpo, hashIp, consumirCota, LIMITE_PADRAO_BODY } from '../functions/abuso.js';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function dbCota(estado = {}) {
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
  function gravar(caminho, valor) {
    const partes = caminho.split('/').filter(Boolean);
    let atual = dados;
    for (const p of partes.slice(0, -1)) {
      if (!atual[p] || typeof atual[p] !== 'object') atual[p] = {};
      atual = atual[p];
    }
    atual[partes[partes.length - 1]] = valor;
  }
  return {
    dados,
    ref: (caminho) => ({
      once: async () => { const v = ler(caminho); return { val: () => v, exists: () => v != null }; },
      set: async (v) => gravar(caminho, v),
      transaction: async (fn) => {
        const anterior = ler(caminho);
        const proximo = fn(anterior);
        gravar(caminho, proximo);
        return { committed: true, snapshot: { val: () => proximo } };
      }
    })
  };
}

describe('Controles de abuso', () => {
  it('rejeita payload acima do limite antes de qualquer leitura', () => {
    expect(() => validarCorpo({ headers: {}, body: { a: 'ok' } })).not.toThrow();
    expect(() => validarCorpo({ headers: { 'content-length': String(LIMITE_PADRAO_BODY + 1) }, body: {} }))
      .toThrowError(expect.objectContaining({ status: 413, code: 'payload_muito_grande' }));
    const grande = { dados: 'x'.repeat(LIMITE_PADRAO_BODY + 1) };
    expect(() => validarCorpo({ headers: {}, body: grande }))
      .toThrowError(expect.objectContaining({ status: 413 }));
  });

  it('faz hash do IP (não grava PII) e é estável por cliente', () => {
    const a = hashIp({ headers: { 'x-forwarded-for': '200.1.2.3, 10.0.0.1' } });
    const b = hashIp({ headers: { 'x-forwarded-for': '200.1.2.3' } });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{32}$/);
    expect(a).not.toContain('200.1.2.3');
    expect(hashIp({ headers: {} })).toBe('sem-ip');
  });

  it('cota atômica: N+1ª chamada retorna 429 com Retry-After', async () => {
    const db = dbCota();
    for (let i = 0; i < 3; i++) await consumirCota(db, 'teste:ip:abc', 3, 60_000);
    await expect(consumirCota(db, 'teste:ip:abc', 3, 60_000))
      .rejects.toMatchObject({ status: 429, code: 'muitas_tentativas', retryAfter: 60 });
    const buckets = Object.keys(db.dados.rate_limits['teste:ip:abc'] || {});
    expect(buckets).toHaveLength(1);
  });

  it('chaves de cota são sanitizadas contra caminhos RTDB inválidos', async () => {
    const db = dbCota();
    await consumirCota(db, 'admin:ip:../segredo', 5, 60_000);
    expect(Object.keys(db.dados.rate_limits)[0]).not.toContain('..');
  });
});

describe('CSP / headers (firebase.json)', () => {
  const firebase = JSON.parse(read('firebase.json'));
  const headers = Object.fromEntries(
    firebase.hosting.headers[0].headers.map((h) => [h.key.toLowerCase(), h.value])
  );
  const csp = headers['content-security-policy'];

  it('não permite unsafe-eval nem img-src curinga', () => {
    expect(csp).not.toContain("'unsafe-eval'");
    const imgSrc = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith('img-src'));
    // Nenhum source pode ser o curinga nu `https:` (qualquer host).
    expect(/(?:^|\s)https:(?:\s|$)/.test(imgSrc)).toBe(false);
    expect(imgSrc).toContain('https://www.gstatic.com');
  });

  it('fixa base-uri, form-action, frame-ancestors e object-src', () => {
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('mantém COOP compatível com popup do Firebase Auth', () => {
    expect(headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
  });
});

describe('CORS e regras de identidade', () => {
  it('worker e Storage usam allowlist, sem curinga', () => {
    const worker = read('cloudflare-worker/worker.js');
    expect(worker).toMatch(/allowlist|ALLOWED_ORIGINS|allowedOrigins/);
    expect(worker).not.toContain("'*'");
    const cors = JSON.parse(read('cors.json'));
    const origens = cors[0].origin;
    expect(origens.length).toBeGreaterThan(0);
    expect(origens.some((o) => o === '*')).toBe(false);
  });

  it('webhooks administrativos não usam CORS aberto', () => {
    const index = read('functions/index.js');
    expect(index).toContain('cors: false');
    const usuarios = read('functions/usuarios.js');
    expect(usuarios).toContain('cors: false');
  });

  it('rules protegem cotas, dedup e identidade do WhatsApp', () => {
    const rules = JSON.parse(read('database.rules.json')).rules;
    expect(rules.rate_limits['.write']).toBe(false);
    expect(rules.whatsapp_messages['.write']).toBe(false);
    const user = rules.users.$email;
    expect(user.whatsappId['.validate']).toContain('super_admin');
    expect(user.telefone['.validate']).toContain('super_admin');
    expect(rules.tenants.$tenantId.config.telefonesPermitidos['.validate']).toContain('super_admin');
  });
});
