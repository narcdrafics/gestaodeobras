// Tracer — probe de observação do módulo usuarios-e-cargos no emulador Firebase demo.
// Somente observação: usuários, convites e chamadas HTTP ficam confinados ao emulador.
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const ROOT = 'C:/Users/tonyd/OneDrive/Documentos/gestaodeobras';
const adminRequire = createRequire(path.join(ROOT, 'functions/package.json'));
const { initializeApp } = adminRequire('firebase-admin/app');
const { getAuth } = adminRequire('firebase-admin/auth');
const { getDatabase } = adminRequire('firebase-admin/database');

const PROJECT = 'demo-gestaodeobras';
const OUT = __dirname;
const EVENTS = path.join(OUT, 'events.jsonl');
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FUNCTIONS_HOST = '127.0.0.1:5001';
const TENANT = 'tenant-tracer-usuarios';

initializeApp({
  projectId: PROJECT,
  databaseURL: 'http://127.0.0.1:9000?ns=' + PROJECT
});
const auth = getAuth();
const db = getDatabase();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString();
const chaveEmail = (email) => String(email || '').trim().toLowerCase().replace(/\./g, ',');

function event(hipotese, veredito, entrada, saida, evidencia, notas) {
  const line = JSON.stringify({
    hipotese, veredito, entrada, saida, evidencia, notas, timestamp: stamp()
  });
  fs.appendFileSync(EVENTS, line + '\n', 'utf8');
  console.log('TRACER_EVENT ' + line);
}

async function ensureUser(uid, email, perfil, claims) {
  try {
    await auth.getUser(uid);
  } catch (e) {
    await auth.createUser({ uid, email, displayName: perfil.nome || perfil.name || uid });
  }
  await auth.setCustomUserClaims(uid, claims);
  await db.ref('profiles/' + uid).set(perfil);
  await sleep(200);
}

async function getIdToken(uid) {
  const custom = await auth.createCustomToken(uid);
  const resp = await fetch(
    'http://' + AUTH_HOST + '/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key',
    { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }) }
  );
  const json = await resp.json();
  if (!json.idToken) throw new Error('sem idToken: ' + JSON.stringify(json).slice(0, 200));
  return json.idToken;
}

async function callFunction(nome, body, token) {
  const requestId = 'tracer-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const resp = await fetch('http://' + FUNCTIONS_HOST + '/' + PROJECT + '/us-central1/' + nome, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + token, 'x-request-id': requestId },
    body: JSON.stringify(body)
  });
  let json = null;
  try { json = await resp.json(); } catch (_) {}
  return { status: resp.status, body: json, requestId };
}

async function readNo(uid) {
  const snap = await db.ref('profiles/' + uid).once('value');
  return snap.val() || null;
}
async function readClaims(uid) {
  const user = await auth.getUser(uid);
  return user.customClaims || null;
}
async function waitClaims(uid, predicate, timeoutMs = 8000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    last = await readClaims(uid);
    if (predicate(last)) return { ok: true, claims: last, waitedMs: Date.now() - started };
    await sleep(200);
  }
  return { ok: false, claims: last, waitedMs: Date.now() - started };
}
function resumoHTTP(r, redactPassword = false) {
  const b = Object.assign({}, r.body || {});
  if (redactPassword && b.password) b.password = '[REDACTED len=' + String(b.password).length + ']';
  return { status: r.status, body: b };
}

(async () => {
  const results = [];
  const adminUid = 'tracer-uc-admin';
  const adminEmail = 'tracer-uc-admin@exemplo.invalid';
  try {
    await ensureUser(adminUid, adminEmail,
      { role: 'admin', tenantId: TENANT, status: 'ativo', nome: 'Admin Traçador' },
      { role: 'admin', tenantId: TENANT });
    const token = await getIdToken(adminUid);

    // U1 — convite válido => 200, senha temporária de 12 caracteres, convite consumido.
    {
      const email = 'tracer-uc-u1@exemplo.invalid';
      const key = chaveEmail(email);
      await db.ref('invites/' + key).set({ email, tenantId: TENANT, role: 'rh', usos: 0, nomeEmpresa: 'Tracer' });
      const r = await callFunction('criarUsuarioTenant', { email, name: 'Usuario U1', tenantId: TENANT }, token);
      const uid = r.body && r.body.uid;
      const senha = r.body && r.body.password;
      const convite = (await db.ref('invites/' + key).once('value')).val() || {};
      const nos = [];
      if (uid) {
        for (const ref of ['profiles/' + uid, 'users/' + key, 'invites/' + key]) {
          nos.push({ ref, contemSenha: senha ? JSON.stringify((await db.ref(ref).once('value')).val() || {}).includes(senha) : false });
        }
      }
      const ok = r.status === 200 && uid && typeof senha === 'string' && senha.length === 12 &&
        Number(convite.usos) === 1 && nos.every((n) => !n.contemSenha);
      const divergencia = r.status !== 200 && r.status >= 400 && r.status !== 409;
      event('U1', ok ? 'CONFIRMADO EM RUNTIME' : (divergencia ? 'DIVERGÊNCIA CONFIRMADA' : 'INCONCLUSIVO'),
        'POST /api/admin/criar-usuario com convite usos=0 para ' + email,
        JSON.stringify(resumoHTTP(r, true)),
        'Functions emulator (criarUsuarioTenant) + RTDB invites/' + key,
        JSON.stringify({ usosConvite: convite.usos, senhaTamanho: senha ? senha.length : null, nos, requestId: r.requestId }));
      results.push({ id: 'U1', veredito: ok ? 'CONFIRMADO EM RUNTIME' : (divergencia ? 'DIVERGÊNCIA CONFIRMADA' : 'INCONCLUSIVO') });
    }

    // U2 — convite já usado => 409 e nenhuma conta criada.
    {
      const email = 'tracer-uc-u2@exemplo.invalid';
      const key = chaveEmail(email);
      await db.ref('invites/' + key).set({ email, tenantId: TENANT, role: 'rh', usos: 1, nomeEmpresa: 'Tracer' });
      const r = await callFunction('criarUsuarioTenant', { email, name: 'Usuario U2', tenantId: TENANT }, token);
      let existeConta = false;
      try { await auth.getUserByEmail(email); existeConta = true; } catch (_) {}
      const ok = r.status === 409 && r.body && r.body.error === 'convite_ja_usado' && !existeConta;
      event('U2', ok ? 'CONFIRMADO EM RUNTIME' : 'INCONCLUSIVO',
        'POST /api/admin/criar-usuario com convite usos=1 para ' + email,
        JSON.stringify(resumoHTTP(r)),
        'Functions emulator (criarUsuarioTenant) + Auth/RTDB emulator',
        JSON.stringify({ contaCriada: existeConta, requestId: r.requestId }));
      results.push({ id: 'U2', veredito: ok ? 'CONFIRMADO EM RUNTIME' : 'INCONCLUSIVO' });
    }

    // U3 — admin comum não promove a super_admin.
    {
      const uid = 'tracer-uc-u3';
      const email = 'tracer-uc-u3@exemplo.invalid';
      await ensureUser(uid, email,
        { role: 'rh', tenantId: TENANT, status: 'ativo', nome: 'Alvo U3' },
        { role: 'rh', tenantId: TENANT });
      const r = await callFunction('gerenciarCargo',
        { acao: 'definir_cargo', uid, role: 'super_admin', tenantId: TENANT }, token);
      const perfil = await readNo(uid);
      const allow = (await db.ref('super_admins/' + uid).once('value')).val() || null;
      const ok = r.status === 403 && r.body && r.body.erro === 'sem_permissao' &&
        perfil.role === 'rh' && !allow;
      event('U3', ok ? 'CONFIRMADO EM RUNTIME' : (r.status === 200 ? 'DIVERGÊNCIA CONFIRMADA' : 'INCONCLUSIVO'),
        'POST /api/admin/cargo definir_cargo role=super_admin para ' + uid + ' por admin comum',
        JSON.stringify(resumoHTTP(r)),
        'Functions emulator (gerenciarCargo) + RTDB profiles/' + uid + ' e super_admins/' + uid,
        JSON.stringify({ rolePerfil: perfil.role, allowlist: allow, requestId: r.requestId }));
      results.push({ id: 'U3', veredito: ok ? 'CONFIRMADO EM RUNTIME' : (r.status === 200 ? 'DIVERGÊNCIA CONFIRMADA' : 'INCONCLUSIVO') });
    }

    // U4 — auto-alteração negada.
    {
      const r = await callFunction('gerenciarCargo',
        { acao: 'definir_cargo', uid: adminUid, role: 'rh', tenantId: TENANT }, token);
      const ok = r.status === 400 && r.body && r.body.erro === 'auto_alteracao';
      event('U4', ok ? 'CONFIRMADO EM RUNTIME' : (r.status === 200 ? 'DIVERGÊNCIA CONFIRMADA' : 'INCONCLUSIVO'),
        'POST /api/admin/cargo definir_cargo com uid do próprio chamador',
        JSON.stringify(resumoHTTP(r)),
        'Functions emulator (gerenciarCargo)',
        JSON.stringify({ requestId: r.requestId }));
      results.push({ id: 'U4', veredito: ok ? 'CONFIRMADO EM RUNTIME' : (r.status === 200 ? 'DIVERGÊNCIA CONFIRMADA' : 'INCONCLUSIVO') });
    }

    // U5 — mestre => encarregado no perfil; módulos RH só com true e só para rh.
    {
      const uid = 'tracer-uc-u5';
      const email = 'tracer-uc-u5@exemplo.invalid';
      await ensureUser(uid, email,
        { role: 'engenheiro', tenantId: TENANT, status: 'ativo', nome: 'Alvo U5' },
        { role: 'engenheiro', tenantId: TENANT });
      const r1 = await callFunction('gerenciarCargo',
        { acao: 'definir_cargo', uid, role: 'mestre', tenantId: TENANT }, token);
      const p1 = await readNo(uid);
      const r2 = await callFunction('gerenciarCargo',
        { acao: 'definir_cargo', uid, role: 'rh', tenantId: TENANT,
          modulosPermitidos: { presenca: true, compras: false, arbitrario: true } }, token);
      const p2 = await readNo(uid);
      const esperada = await waitClaims(uid, (c) => !!c && c.role === 'rh' &&
        !!c.modulosPermitidos && c.modulosPermitidos.presenca === true &&
        c.modulosPermitidos.compras === undefined && c.modulosPermitidos.arbitrario === undefined);
      const ok = r1.status === 200 && p1.role === 'encarregado' && r2.status === 200 &&
        p2.role === 'rh' && p2.modulosPermitidos && p2.modulosPermitidos.presenca === true &&
        !p2.modulosPermitidos.compras && !p2.modulosPermitidos.arbitrario && esperada.ok;
      event('U5', ok ? 'CONFIRMADO EM RUNTIME' : 'INCONCLUSIVO',
        'POST /api/admin/cargo definir_cargo role=mestre, depois role=rh com modulosPermitidos {presenca:true, compras:false, arbitrario:true}',
        JSON.stringify({ r1: resumoHTTP(r1), r2: resumoHTTP(r2), perfilAposMestre: p1.role, perfilAposRh: p2.role, modulosPerfil: p2.modulosPermitidos, claims: esperada.claims }),
        'Functions emulator (gerenciarCargo) + RTDB profiles/' + uid + ' + Auth emulator',
        JSON.stringify({ requestIds: [r1.requestId, r2.requestId], esperaMs: esperada.waitedMs }));
      results.push({ id: 'U5', veredito: ok ? 'CONFIRMADO EM RUNTIME' : 'INCONCLUSIVO' });
    }

    // U6 — remover_usuario desativa perfil e conta.
    {
      const uid = 'tracer-uc-u6';
      const email = 'tracer-uc-u6@exemplo.invalid';
      await ensureUser(uid, email,
        { role: 'rh', tenantId: TENANT, status: 'ativo', nome: 'Alvo U6' },
        { role: 'rh', tenantId: TENANT });
      await db.ref('users/' + chaveEmail(email)).set({ uid, email, role: 'rh', tenantId: TENANT });
      const r = await callFunction('gerenciarCargo', { acao: 'remover_usuario', uid }, token);
      const perfil = await readNo(uid);
      const user = await auth.getUser(uid);
      const passaporte = (await db.ref('users/' + chaveEmail(email)).once('value')).val() || {};
      const ok = r.status === 200 && r.body && r.body.removido === true &&
        perfil.role === 'desativado' && perfil.status === 'bloqueado' && !perfil.tenantId &&
        user.disabled === true && passaporte.role === 'desativado' && !passaporte.tenantId;
      event('U6', ok ? 'CONFIRMADO EM RUNTIME' : (r.status === 200 ? 'DIVERGÊNCIA CONFIRMADA' : 'INCONCLUSIVO'),
        'POST /api/admin/cargo remover_usuario para ' + uid,
        JSON.stringify(resumoHTTP(r)),
        'Functions emulator (gerenciarCargo) + RTDB profiles/' + uid + ' + Auth emulator',
        JSON.stringify({ rolePerfil: perfil.role, statusPerfil: perfil.status, tenantPerfil: perfil.tenantId, authDisabled: user.disabled, passaporte: { role: passaporte.role, tenantId: passaporte.tenantId }, requestId: r.requestId }));
      results.push({ id: 'U6', veredito: ok ? 'CONFIRMADO EM RUNTIME' : (r.status === 200 ? 'DIVERGÊNCIA CONFIRMADA' : 'INCONCLUSIVO') });
    }
  } catch (e) {
    event('SETUP-USUARIOS', 'INCONCLUSIVO', 'inicialização do probe', String((e && e.message) || e).slice(0, 400), 'probe-usuarios-e-cargos.js', 'exceção durante a execução controlada');
    results.push({ id: 'SETUP', veredito: 'INCONCLUSIVO' });
  }
  fs.writeFileSync(path.join(OUT, 'probe-usuarios-e-cargos-results.json'), JSON.stringify(results, null, 2) + '\n', 'utf8');
  console.log('TRACER_DONE ' + JSON.stringify(results));
  process.exit(0);
})();
