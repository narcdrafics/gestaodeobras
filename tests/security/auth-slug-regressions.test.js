// Regressões do hardening de segurança que quebravam login e slug.
// São testes de fonte porque o fluxo depende de Firebase Hosting/Auth em produção.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const auth = read('public/js/auth_core.js');
const data = read('public/js/data_core.js');
const firebaseJson = JSON.parse(read('firebase.json'));
const wrangler = read('cloudflare-worker/wrangler.toml');
const htmls = ['public/login.html', 'public/admin-login.html', 'public/app.html'].map(read);

const cabecalho = (chave) => {
  const entry = firebaseJson.hosting.headers.find(h => h.headers.some(x => x.key === chave));
  return entry.headers.find(x => x.key === chave).value;
};

describe('login — contexto do tenant', () => {
  it('data_core expõe a promise para os outros scripts', () => {
    expect(data).toContain('window.subdomainContextPromise = subdomainContextPromise;');
    expect(data).toContain('function comLimite(');
  });

  it('aguarda o tenant antes da validação cross-tenant (login e listener)', () => {
    const login = auth.slice(auth.indexOf('async function handleAuthSuccess'), auth.indexOf('// 3. Validação Cross-Tenant'));
    expect(login).toContain('await aguardarContextoTenant()');

    const listener = auth.slice(auth.indexOf('function checkAuth()'), auth.indexOf('function safeCheckAuth()'));
    expect(listener).toContain('await aguardarContextoTenant()');
  });

  it('conta sem perfil/convite encerra a sessão em vez de deixar autenticado', () => {
    const bloco = auth.slice(
      auth.indexOf('// Conta autenticada sem perfil'),
      auth.indexOf('// 3. Validação Cross-Tenant')
    );
    expect(bloco).toContain('await firebase.auth().signOut()');
    expect(bloco).toContain('sessionStorage.removeItem');
  });

  it('o guard do painel Master também vale para o login com Google', () => {
    const fn = auth.slice(auth.indexOf('function doGoogleLogin()'), auth.indexOf('// ================== EMAIL LOGIN'));
    expect(fn).toContain('window._adminLoginGuard = true');
    expect(fn).toContain('window._adminLoginGuard = false');
  });

  it('?tenant= não substitui o hostname em produção', () => {
    const fn = data.slice(data.indexOf('function detectSubdomain()'), data.indexOf('async function loadTenantBySlug'));
    expect(fn).toContain("host === 'obrareal.com'");
    expect(fn).toContain("host.endsWith('.obrareal.com')");
    expect(fn).toMatch(/tenantParam\s*&&\s*!isProducao/);
  });
});

describe('deploy — headers, rotas e cache', () => {
  it('CSP permite os hosts usados por Google Auth e Firebase Storage', () => {
    const csp = cabecalho('Content-Security-Policy');
    for (const host of ['https://www.googleapis.com', 'https://accounts.google.com', 'https://firebasestorage.googleapis.com']) {
      expect(csp).toContain(host);
    }
    // Necessário para o popup do Firebase; voltar a same-origin quebra o login.
    expect(cabecalho('Cross-Origin-Opener-Policy')).toBe('same-origin-allow-popups');
  });

  it('o Worker continua interceptando a raiz e os subdomínios', () => {
    expect(wrangler).toContain('{ pattern = "obrareal.com/*"');
    expect(wrangler).toContain('{ pattern = "*.obrareal.com/*"');
    expect(read('wrangler.jsonc')).toContain('"main": "cloudflare-worker/worker.js"');
  });

  it('as páginas de login e o app servem a mesma versão corrigida dos scripts', () => {
    for (const html of htmls) {
      expect(html).toContain('js/auth_core.js?v=20261124003');
      expect(html).toContain('js/data_core.js?v=20261124003');
    }
  });

  it('backups de código não são publicados pelo Hosting', () => {
    expect(firebaseJson.hosting.ignore).toEqual(expect.arrayContaining(['**/*.bak-auth', '**/*.backup']));
  });
});
