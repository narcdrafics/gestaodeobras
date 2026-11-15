import { describe, it, expect, beforeEach, vi } from 'vitest';

if (typeof window === 'undefined') {
  globalThis.window = globalThis;
}

import '../public/js/slug.js';

const S = () => window.ObraSlug;

function makeDb({ taken = [], failUpdate = null } = {}) {
  const takenPaths = new Set(taken.map((s) => `tenants_public/${s}`));
  const calls = { updates: [], reads: [] };
  return {
    calls,
    ref(path) {
      return {
        once: async () => {
          calls.reads.push(path);
          return { exists: () => takenPaths.has(path) };
        },
        update: async (u) => {
          if (failUpdate) await failUpdate(u, takenPaths);
          calls.updates.push(u);
        }
      };
    }
  };
}

describe('normalizeSlug / validateSlug', () => {
  it('remove acento, símbolo e maiúscula', () => {
    expect(S().normalizeSlug('  Construções São João! ')).toBe('construcoessaojoao');
    expect(S().normalizeSlug('ABC-123_x')).toBe('abc123x');
    expect(S().normalizeSlug(null)).toBe('');
  });

  it('limita o tamanho', () => {
    expect(S().normalizeSlug('a'.repeat(50))).toHaveLength(30);
  });

  it('rejeita vazio, curto e reservado', () => {
    expect(S().validateSlug('').ok).toBe(false);
    expect(S().validateSlug('ab').ok).toBe(false);
    for (const r of ['www', 'admin', 'app', 'login', 'MASTER_SYSTEM', 'obrareal']) {
      expect(S().validateSlug(r).ok, r).toBe(false);
    }
  });

  it('aceita slug válido e devolve a forma normalizada', () => {
    expect(S().validateSlug('Silva Engenharia')).toEqual({ ok: true, slug: 'silvaengenharia', error: '' });
  });
});

describe('suggestSlug / cleanCompanyName', () => {
  it('sugere pelo nome; se curto, pelo e-mail', () => {
    expect(S().suggestSlug('Silva Engenharia', 'x@y.com')).toBe('silvaengenharia');
    expect(S().suggestSlug('', 'joao.silva@gmail.com')).toBe('joaosilva');
    expect(S().suggestSlug('', 'jo@gmail.com')).toBe('joobras');
  });

  it('limpa o nome da empresa (sem tags, espaços colapsados, tamanho)', () => {
    expect(S().cleanCompanyName('  <img src=x onerror=alert(1)>  Silva   Ltda ')).toBe('img src=x onerror=alert(1) Silva Ltda');
    expect(S().cleanCompanyName('a'.repeat(200))).toHaveLength(80);
  });
});

describe('URL do tenant', () => {
  const prod = { hostname: 'obrareal.com', origin: 'https://obrareal.com', pathname: '/login.html' };
  const dev = { hostname: 'localhost', origin: 'http://localhost:8080', pathname: '/login.html' };

  it('produção: vira subdomínio', () => {
    expect(S().buildTenantUrl('silva', prod, 'app.html')).toBe('https://silva.obrareal.com/app.html');
    expect(S().isCrossOrigin('silva', prod)).toBe(true);
    expect(S().isCrossOrigin('silva', { hostname: 'silva.obrareal.com' })).toBe(false);
  });

  it('dev/staging: mesma origem com ?tenant=', () => {
    expect(S().buildTenantUrl('silva', dev, 'app.html')).toBe('http://localhost:8080/app.html?tenant=silva');
    expect(S().isCrossOrigin('silva', dev)).toBe(false);
    expect(S().isCrossOrigin('silva', { hostname: 'controle-obras.web.app' })).toBe(false);
  });

  it('link de boas-vindas leva o e-mail codificado', () => {
    expect(S().buildWelcomeUrl('silva', 'a+b@x.com', prod))
      .toBe('https://silva.obrareal.com/login.html?bemvindo=1&email=a%2Bb%40x.com');
  });
});

describe('buildAccountUpdates (formato exigido pelas regras do banco)', () => {
  const now = 1_700_000_000_000;
  const { updates, sanitizedEmail } = S().buildAccountUpdates({
    slug: 'silva', nomeEmpresa: 'Silva <b>Eng</b>', email: ' Joao.Silva@Gmail.com ', uid: 'u1', nome: 'João', now
  });

  it('grava os três nós, todos no mesmo update', () => {
    expect(Object.keys(updates).sort()).toEqual(['tenants/silva', 'tenants_public/silva', 'users/joao,silva@gmail,com']);
    expect(sanitizedEmail).toBe('joao,silva@gmail,com');
  });

  it('tenant: valores fixos que as regras exigem na criação', () => {
    const t = updates['tenants/silva'];
    expect(t.plano).toBe('free_trial');
    expect(t.status).toBe('ativo');
    expect(t.config.limiteObras).toBe(1);
    expect(t.config.limiteUsuarios).toBe(1);
    expect(t.config.limiteTrabalhadores).toBe(9999);
    expect(t.webhookCriacao).toBe(now);
    expect(t.trialExpiracao - now).toBe(30 * 24 * 60 * 60 * 1000); // regra aceita até 32 dias
    expect(t.origem).toBe('self_signup');
    expect(t.slug).toBe('silva');
    expect(t.subdominioSlug).toBe('silva');
    expect(t.emailAdmin).toBe('joao.silva@gmail.com');
  });

  it('nó público tem slug === chave e tenantId preenchido', () => {
    expect(updates['tenants_public/silva']).toMatchObject({ slug: 'silva', tenantId: 'silva' });
  });

  it('passaporte global: admin do próprio tenant, origem self_signup', () => {
    expect(updates['users/joao,silva@gmail,com']).toMatchObject({
      uid: 'u1', tenantId: 'silva', role: 'admin', origem: 'self_signup', email: 'joao.silva@gmail.com'
    });
  });

  it('nome da empresa é limpo antes de gravar', () => {
    expect(updates['tenants/silva'].nomeEmpresa).toBe('Silva bEng/b');
    expect(updates['tenants/silva'].config.nomeEmpresa).toBe('Silva bEng/b');
  });
});

describe('createTenantAccount', () => {
  const base = { slug: 'Silva Eng', nomeEmpresa: 'Silva Engenharia', email: 'a@b.com', uid: 'u1', nome: 'Ana' };

  it('cria com um único update atômico e devolve o slug normalizado', async () => {
    const db = makeDb();
    const res = await S().createTenantAccount(db, base);
    expect(res).toEqual({ slug: 'silvaeng', nomeEmpresa: 'Silva Engenharia' });
    expect(db.calls.updates).toHaveLength(1);
    expect(Object.keys(db.calls.updates[0])).toContain('tenants/silvaeng');
  });

  it('slug inválido nem chega no banco', async () => {
    const db = makeDb();
    await expect(S().createTenantAccount(db, { ...base, slug: 'www' })).rejects.toMatchObject({ code: 'slug/invalid' });
    expect(db.calls.updates).toHaveLength(0);
  });

  it('perdeu a corrida (permission denied + slug ocupado) => slug/taken', async () => {
    const db = makeDb({
      taken: ['silvaeng'],
      failUpdate: async () => { throw Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' }); }
    });
    await expect(S().createTenantAccount(db, base)).rejects.toMatchObject({ code: 'slug/taken' });
  });

  it('permission denied com slug livre => repassa o erro original (ex.: regras não publicadas)', async () => {
    const err = Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' });
    const db = makeDb({ failUpdate: async () => { throw err; } });
    await expect(S().createTenantAccount(db, base)).rejects.toBe(err);
  });
});

describe('tela de onboarding (promptSlugOnboarding)', () => {
  beforeEach(async () => {
    document.body.innerHTML = '';
    vi.resetModules();
    await import('../public/js/slug_onboarding.js?ui');
  });

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const type = (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };

  it('sugere o slug, confere disponibilidade e cria a conta ao confirmar', async () => {
    const db = makeDb();
    window.firebase = { database: () => db };
    const p = window.promptSlugOnboarding({ uid: 'u1', email: 'ana@x.com', name: 'Ana' });

    const slugEl = document.getElementById('so-slug');
    const btn = document.getElementById('so-create');
    expect(slugEl.value).toBe('anaengenharia'); // sugerido a partir do nome
    await wait(450);
    expect(document.getElementById('so-status').textContent).toMatch(/disponível/i);
    expect(btn.disabled).toBe(false);

    type(slugEl, 'Silva Obras!');
    expect(slugEl.value).toBe('silvaobras'); // normaliza enquanto digita
    expect(document.getElementById('so-preview-slug').textContent).toBe('silvaobras');
    await wait(450);

    btn.click();
    const created = await p;
    expect(created.slug).toBe('silvaobras');
    expect(db.calls.updates[0]['tenants/silvaobras'].emailAdmin).toBe('ana@x.com');
    expect(document.getElementById('slug-onboarding')).toBeNull(); // fechou
  });

  it('slug ocupado bloqueia o botão', async () => {
    window.firebase = { database: () => makeDb({ taken: ['anaengenharia'] }) };
    window.promptSlugOnboarding({ uid: 'u1', email: 'ana@x.com', name: 'Ana' });
    await wait(450);
    expect(document.getElementById('so-status').textContent).toMatch(/já está em uso/i);
    expect(document.getElementById('so-create').disabled).toBe(true);
  });

  it('cancelar resolve null e não cria nada', async () => {
    const db = makeDb();
    window.firebase = { database: () => db };
    const p = window.promptSlugOnboarding({ uid: 'u1', email: 'ana@x.com', name: 'Ana' });
    document.getElementById('so-cancel').click();
    expect(await p).toBeNull();
    expect(db.calls.updates).toHaveLength(0);
  });

  it('nome da empresa digitado não vira HTML na tela', async () => {
    window.firebase = { database: () => makeDb() };
    window.promptSlugOnboarding({ uid: 'u1', email: 'ana@x.com', name: '<img src=x onerror=alert(1)>' });
    expect(document.querySelector('#slug-onboarding img')).toBeNull();
  });
});

describe('boas-vindas no subdomínio novo', () => {
  it('mostra o aviso e preenche o e-mail', async () => {
    document.body.innerHTML = '<form id="login-form"></form><input id="auth-email">';
    window.history.pushState({}, '', '/login.html?bemvindo=1&email=ana%40x.com');
    vi.resetModules();
    await import('../public/js/slug_onboarding.js?welcome');
    expect(document.querySelector('.so-welcome').textContent).toContain('ana@x.com');
    expect(document.getElementById('auth-email').value).toBe('ana@x.com');
    window.history.pushState({}, '', '/');
  });
});
