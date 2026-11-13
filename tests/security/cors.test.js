// Testa a lógica de CORS do worker: nenhuma origem externa pode receber ACAO.
import { describe, it, expect } from 'vitest';

const worker = (await import('../../cloudflare-worker/worker.js')).default;

const ctx = { waitUntil() {}, passThroughOnException() {} };

function makeRequest(url, method = 'GET', origin) {
  const headers = new Headers();
  if (origin) headers.set('Origin', origin);
  return new Request(url, { method, headers });
}

describe('cloudflare-worker — CORS restrito', () => {
  it('aceita subdomínio de tenant', async () => {
    const res = await worker.fetch(makeRequest('https://empresa.obrareal.com/', 'GET', 'https://empresa.obrareal.com'), {}, ctx);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://empresa.obrareal.com');
  });

  it('aceita o domínio raiz e o web.app', async () => {
    for (const origin of ['https://obrareal.com', 'https://controle-obras-c889d.web.app']) {
      const res = await worker.fetch(makeRequest(`${origin}/`, 'GET', origin), {}, ctx);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    }
  });

  it('não devolve ACAO para origem externa', async () => {
    const res = await worker.fetch(makeRequest('https://empresa.obrareal.com/', 'GET', 'https://evil.example'), {}, ctx);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('rejeita domínio parecido (obrareal.com.evil)', async () => {
    const res = await worker.fetch(makeRequest('https://obrareal.com/', 'GET', 'https://obrareal.com.evil.example'), {}, ctx);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('preflight permitido responde 204 com métodos seguros', async () => {
    const res = await worker.fetch(makeRequest('https://empresa.obrareal.com/', 'OPTIONS', 'https://empresa.obrareal.com'), {}, ctx);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://empresa.obrareal.com');
    expect(res.headers.get('Access-Control-Allow-Methods')).not.toContain('DELETE');
    expect(res.headers.get('Access-Control-Allow-Methods')).not.toContain('PUT');
  });

  it('preflight de origem externa não libera CORS', async () => {
    const res = await worker.fetch(makeRequest('https://empresa.obrareal.com/', 'OPTIONS', 'https://evil.example'), {}, ctx);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
