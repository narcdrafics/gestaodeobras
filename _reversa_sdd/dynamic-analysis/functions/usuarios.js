// Criação de credenciais pelo painel administrativo.
//
// O painel grava o convite em `invites/<email>` e chama esta função. Aqui, com o
// Firebase Admin SDK, contas NOVAS recebem uma senha temporária devolvida apenas
// ao administrador autenticado, para exibição na tela. Contas que já existem no
// Auth mantêm a senha atual: redefini-la aqui derrubava o acesso do usuário no
// momento em que o admin apenas ajustava o cargo/as obras dele.
// A senha NUNCA é gravada no Realtime Database; role/tenantId continuam sendo
// definidos pelo perfil e propagados por `syncCustomClaims`.
const { onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const crypto = require('crypto');
const { validarCorpo, hashIp, consumirCota } = require('./abuso');
const { EMAIL_MESTRA, chaveEmail } = require('./claims');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES_ADMIN = ['admin', 'super_admin'];

function gerarSenhaTemporaria() {
  // Sem caracteres ambíguos (0/O, 1/l/I) para facilitar leitura e cópia.
  const grupos = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnopqrstuvwxyz',
    '23456789',
    '@#*!'
  ];
  const todos = grupos.join('');
  const sortear = (alfabeto) => alfabeto[crypto.randomInt(alfabeto.length)];

  const caracteres = grupos.map(sortear);
  while (caracteres.length < 12) caracteres.push(sortear(todos));

  // Fisher-Yates: evita que os caracteres obrigatórios fiquem sempre no início.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}

function responder(res, status, payload) {
  return res.status(status).json(payload);
}

async function papelDoChamador(uid, claims) {
  // O perfil no RTDB é a autoridade; claims sozinhas não bastam (token antigo
  // poderia manter cargo revogado até expirar).
  const [registro, perfilSnap, allowSnap] = await Promise.all([
    getAuth().getUser(uid).catch(() => null),
    getDatabase().ref(`profiles/${uid}`).once('value'),
    getDatabase().ref(`super_admins/${uid}`).once('value')
  ]);
  if (!registro || registro.disabled) return { role: null, tenantId: null };

  const perfil = perfilSnap.val() || {};
  const allow = allowSnap.val() || null;
  const ehMaster = String((claims && claims.email) || registro.email || '').toLowerCase() === EMAIL_MESTRA ||
    !!(allow && allow.ativo !== false) ||
    (perfil.role === 'super_admin' && (claims && claims.role) === 'super_admin');
  if (ehMaster) return { role: 'super_admin', tenantId: perfil.tenantId || null };
  return { role: perfil.role || null, tenantId: perfil.tenantId || null };
}

exports.criarUsuarioTenant = onRequest(
  { cors: false, memory: '256MiB', timeoutSeconds: 60, maxInstances: 3 },
  async (req, res) => {
    if (req.method !== 'POST') {
      return responder(res, 405, { error: 'metodo_nao_permitido' });
    }

    try {
      validarCorpo(req);
      await consumirCota(getDatabase(), `criar:ip:${hashIp(req)}`, 20, 60 * 1000);
    } catch (e) {
      if (e.retryAfter && typeof res.set === 'function') res.set('Retry-After', String(e.retryAfter));
      return responder(res, e.status || 429, { error: e.code || 'muitas_tentativas' });
    }

    const header = req.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) return responder(res, 401, { error: 'nao_autenticado' });

    let chamador;
    try {
      // Tokens revogados por bloqueio/rebaixamento deixam de valer na hora.
      chamador = await getAuth().verifyIdToken(match[1], true);
    } catch (e) {
      return responder(res, 401, { error: 'token_invalido' });
    }

    try {
      const chamadorInfo = await papelDoChamador(chamador.uid, chamador);
      if (!ROLES_ADMIN.includes(chamadorInfo.role)) {
        return responder(res, 403, { error: 'sem_permissao' });
      }
      await consumirCota(getDatabase(), `criar:uid:${chamador.uid}`, 60, 60 * 1000);

      const body = req.body || {};
      const email = String(body.email || '').trim().toLowerCase();
      const name = String(body.name || '').trim();
      const tenantId = String(body.tenantId || '').trim();

      if (!EMAIL_RE.test(email) || email.length > 254 || !name || name.length > 120 ||
          !tenantId || tenantId.length > 128) {
        return responder(res, 400, { error: 'dados_invalidos' });
      }
      if (email === String(chamador.email || '').toLowerCase() || chamador.uid === body.uid) {
        return responder(res, 400, { error: 'auto_alteracao' });
      }
      if (chamadorInfo.role !== 'super_admin' && tenantId !== chamadorInfo.tenantId) {
        return responder(res, 403, { error: 'tenant_invalido' });
      }

      // O convite é gravado pelo painel antes desta chamada: ele prova que o
      // e-mail foi autorizado para este tenant e define o cargo do novo usuário.
      const emailKey = chaveEmail(email);
      const inviteRef = getDatabase().ref(`invites/${emailKey}`);
      const inviteSnap = await inviteRef.once('value');
      const invite = inviteSnap.val();
      if (!invite || invite.tenantId !== tenantId) {
        return responder(res, 409, { error: 'convite_inexistente' });
      }

      // Consumo atômico: a mesma credencial não pode ser gerada duas vezes.
      // Se a criação falhar, a reserva é devolvida para não travar o admin.
      const reserva = await inviteRef.child('usos').transaction((atual) => {
        const usos = Number(atual) || 0;
        return usos >= 1 ? undefined : usos + 1;
      });
      if (!reserva.committed) {
        return responder(res, 409, { error: 'convite_ja_usado' });
      }

      let senha = null; // preenchida só para contas realmente novas
      let existente = null;
      let uid;
      let criado = false;

      try {
        try {
          existente = await getAuth().getUserByEmail(email);
        } catch (e) {
          if (e.code !== 'auth/user-not-found') throw e;
        }

        if (existente) {
          // Nunca permita que um admin de outra empresa vincule uma conta já
          // pertencente a um tenant diferente. Vínculo vazio também bloqueia.
          let perfil = {};
          try {
            const perfilSnap = await getDatabase().ref(`profiles/${existente.uid}`).once('value');
            perfil = perfilSnap.val() || {};
          } catch (e) {
            // Perfil pode ainda não existir; as claims abaixo bastam nesse caso.
          }
          const tenantVinculado =
            (existente.customClaims && existente.customClaims.tenantId) || perfil.tenantId;
          if (chamadorInfo.role !== 'super_admin' && (!tenantVinculado || tenantVinculado !== tenantId)) {
            throw Object.assign(new Error('email_vinculado_outro_tenant'), { code: 'email_vinculado_outro_tenant', status: 409 });
          }

          // A conta já existe: manter a senha atual. Redefinir aqui era a causa
          // de "perdi o acesso ao slug" quando o admin só ajustava obra/cargo.
          uid = existente.uid;
        } else {
          senha = gerarSenhaTemporaria();
          const novo = await getAuth().createUser({
            email,
            password: senha,
            displayName: name
          });
          uid = novo.uid;
          criado = true;
        }
      } catch (e) {
        await inviteRef.child('usos').transaction((atual) => Math.max(0, (Number(atual) || 1) - 1)).catch(() => {});
        throw e;
      }

      // Não gravar senha no RTDB: o fluxo de primeiro login consome o convite,
      // cria o perfil e o syncCustomClaims continua dono de role/tenantId.
      return responder(res, 200, {
        uid,
        email,
        password: senha,
        criado,
        senhaTemporaria: criado,
        contaExistente: !criado
      });
    } catch (e) {
      console.warn('[criarUsuarioTenant] Falha:', e && (e.code || e.message || e));
      const status = Number(e && e.status) || 500;
      if (status === 409 && e.code) return responder(res, 409, { error: e.code });
      if (e && e.code === 'auth/email-already-exists') {
        return responder(res, 409, { error: 'email_ja_existe' });
      }
      return responder(res, 500, { error: 'erro_interno' });
    }
  }
);
