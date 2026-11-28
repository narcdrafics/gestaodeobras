// Tracer — probe de observação do módulo auth no emulador Firebase demo.
// Somente leitura/observação: cria usuários e perfis fictícios dentro do emulador.
const fs = require('fs');
const path = require('path');
const ROOT = 'C:/Users/tonyd/OneDrive/Documentos/gestaodeobras';
const { createRequire } = require('module');
const adminRequire = createRequire(path.join(ROOT, 'functions/package.json'));
const { initializeApp } = adminRequire('firebase-admin/app');
const { getAuth } = adminRequire('firebase-admin/auth');
const { getDatabase } = adminRequire('firebase-admin/database');

const PROJECT = 'demo-gestaodeobras';
const OUT = __dirname;
const EVENTS = path.join(OUT, 'events.jsonl');

initializeApp({
  projectId: PROJECT,
  databaseURL: 'http://127.0.0.1:9000?ns=' + PROJECT + '-default-rtdb'
});
const auth = getAuth();
const db = getDatabase();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString();

async function waitForClaims(uid, predicate, timeoutMs = 12000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const user = await auth.getUser(uid);
      last = user.customClaims || null;
      if (predicate(last)) {
        return { ok: true, claims: last, waitedMs: Date.now() - started };
      }
    } catch (e) {
      last = { erro: String(e && e.message || e).slice(0, 200) };
    }
    await sleep(250);
  }
  return { ok: false, claims: last, waitedMs: Date.now() - started };
}

async function readProfile(uid) {
  const snap = await db.ref('profiles/' + uid).once('value');
  return snap.val() || null;
}

function event(hipotese, veredito, entrada, saida, evidencia, notas) {
  const line = JSON.stringify({
    hipotese, veredito, entrada, saida, evidencia, notas, timestamp: stamp()
  });
  fs.appendFileSync(EVENTS, line + '\n', 'utf8');
  console.log('TRACER_EVENT ' + line);
}

const cases = [
  {
    id: 'H1',
    uid: 'tracer-auth-h1',
    email: 'tracer-auth-h1@exemplo.invalid',
    tenant: 'tenant-tracer-a',
    setup: async () => {
      await db.ref('tenants/tenant-tracer-a/config').set({ plano: 'tracer', limiteUsuarios: 10, limiteObras: 10 });
    },
    profile: { role: 'admin', tenantId: 'tenant-tracer-a', status: 'ativo', nome: 'Traçador H1' },
    predicate: (c) => !!c && c.role === 'admin' && c.tenantId === 'tenant-tracer-a'
  },
  {
    id: 'H2',
    uid: 'tracer-auth-h2',
    email: 'tracer-auth-h2@exemplo.invalid',
    tenant: 'tenant-tracer-a',
    setup: async () => {},
    profile: { role: 'mestre', tenantId: 'tenant-tracer-a', status: 'ativo', nome: 'Traçador H2' },
    predicate: (c) => !!c && c.role === 'encarregado'
  },
  {
    id: 'H3',
    uid: 'tracer-auth-h3',
    email: 'tracer-auth-h3@exemplo.invalid',
    tenant: 'tenant-tracer-a',
    setup: async () => {},
    profile: { role: 'super_admin', tenantId: 'tenant-tracer-a', status: 'ativo', nome: 'Traçador H3' },
    predicate: (c) => !!c && c.role === 'admin'
  },
  {
    id: 'H4',
    uid: 'tracer-auth-h4',
    email: 'tracer-auth-h4@exemplo.invalid',
    tenant: 'tenant-tracer-lotado',
    setup: async () => {
      await db.ref('tenants/tenant-tracer-lotado/config').set({ plano: 'tracer', limiteUsuarios: 1 });
      for (const extra of ['tracer-auth-h4-owner', 'tracer-auth-h4-coworker']) {
        await auth.createUser({ uid: extra, email: extra + '@exemplo.invalid' });
        await db.ref('profiles/' + extra).set({
          role: 'admin', tenantId: 'tenant-tracer-lotado', status: 'ativo', nome: extra
        });
      }
      await sleep(1200);
    },
    profile: { role: 'admin', tenantId: 'tenant-tracer-lotado', status: 'ativo', nome: 'Traçador H4' },
    predicate: (c) => !!c && c.role === 'pendente' && c.tenantId === null
  },
  {
    id: 'H5',
    uid: 'tracer-auth-h5',
    email: 'tracer-auth-h5@exemplo.invalid',
    tenant: 'tenant-tracer-a',
    setup: async () => {},
    profile: {
      role: 'rh',
      tenantId: 'tenant-tracer-a',
      status: 'ativo',
      nome: 'Traçador H5',
      acessoObras: 'especificas',
      modulosPermitidos: { financeiro: true },
      obrasPermitidas: Array.from({ length: 60 }, (_, i) => 'obra-tracer-' + String(i + 1).padStart(2, '0'))
    },
    predicate: (c) => !!c && c.role === 'rh' && Array.isArray(c.obrasPermitidas) && c.obrasPermitidas.length === 50
  }
];

(async () => {
  fs.writeFileSync(EVENTS, '', 'utf8');
  const results = [];
  for (const c of cases) {
    try {
      await c.setup();
      await auth.createUser({ uid: c.uid, email: c.email });
      await db.ref('profiles/' + c.uid).set(c.profile);
      const waited = await waitForClaims(c.uid, c.predicate);
      const perfilDepois = await readProfile(c.uid);
      const veredito = waited.ok ? 'CONFIRMADO EM RUNTIME' : 'INCONCLUSIVO';
      const detalhes = {
        hipotese: c.id,
        claims: waited.claims,
        perfilDepois: perfilDepois && {
          role: perfilDepois.role,
          tenantId: perfilDepois.tenantId,
          status: perfilDepois.status,
          cargoAtualizadoPor: perfilDepois.cargoAtualizadoPor || null
        },
        esperaMs: waited.waitedMs
      };
      event(
        c.id,
        veredito,
        'criação de usuário ' + c.email + ' e escrita em profiles/' + c.uid + ' (tenant ' + c.tenant + ')',
        JSON.stringify(waited.claims),
        'Firebase Auth emulator getAccountInfo + RTDB emulator profiles/' + c.uid,
        JSON.stringify(detalhes)
      );
      results.push({ id: c.id, veredito, detalhes });
    } catch (e) {
      const msg = String((e && e.message) || e).slice(0, 400);
      event(c.id, 'INCONCLUSIVO', 'execução da hipótese ' + c.id, 'erro: ' + msg, 'probe-auth.js', 'exceção durante a execução controlada');
      results.push({ id: c.id, veredito: 'INCONCLUSIVO', erro: msg });
    }
  }
  fs.writeFileSync(path.join(OUT, 'probe-results.json'), JSON.stringify(results, null, 2) + '\n', 'utf8');
  console.log('TRACER_DONE ' + JSON.stringify(results.map((r) => ({ id: r.id, veredito: r.veredito }))));
  process.exit(0);
})().catch((e) => {
  event('SETUP', 'INCONCLUSIVO', 'inicialização do probe', String((e && e.message) || e).slice(0, 400), 'probe-auth.js', 'falha de setup');
  process.exit(1);
});
