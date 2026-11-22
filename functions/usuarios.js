// Criação de credenciais pelo painel administrativo.
//
// O painel grava o convite em `invites/<email>` e chama esta função. Aqui, com o
// Firebase Admin SDK, a conta é criada no Auth com uma senha temporária que é
// devolvida apenas ao administrador autenticado, para exibição na tela.
// A senha NUNCA é gravada no Realtime Database; role/tenantId continuam sendo
// definidos pelo perfil e propagados por `syncCustomClaims`.
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');

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
  if (claims && ROLES_ADMIN.includes(claims.role)) {
    return { role: claims.role, tenantId: claims.tenantId || null };
  }
  // Claims podem estar desatualizadas logo após uma promoção; o perfil no RTDB
  // é a segunda fonte de autoridade.
  const snap = await admin.database().ref(`profiles/${uid}`).once('value');
  const perfil = snap.val() || {};
  return { role: perfil.role || null, tenantId: perfil.tenantId || null };
}

exports.criarUsuarioTenant = onRequest(
  { cors: true, memory: '256MiB', timeoutSeconds: 60 },
  async (req, res) => {
    if (req.method !== 'POST') {
      return responder(res, 405, { error: 'metodo_nao_permitido' });
    }

    const header = req.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) return responder(res, 401, { error: 'nao_autenticado' });

    let chamador;
    try {
      chamador = await admin.auth().verifyIdToken(match[1]);
    } catch (e) {
      return responder(res, 401, { error: 'token_invalido' });
    }

    try {
      const chamadorInfo = await papelDoChamador(chamador.uid, chamador);
      if (!ROLES_ADMIN.includes(chamadorInfo.role)) {
        return responder(res, 403, { error: 'sem_permissao' });
      }

      const body = req.body || {};
      const email = String(body.email || '').trim().toLowerCase();
      const name = String(body.name || '').trim();
      const tenantId = String(body.tenantId || '').trim();

      if (!EMAIL_RE.test(email) || !name || !tenantId) {
        return responder(res, 400, { error: 'dados_invalidos' });
      }
      if (chamadorInfo.role !== 'super_admin' && tenantId !== chamadorInfo.tenantId) {
        return responder(res, 403, { error: 'tenant_invalido' });
      }

      // O convite é gravado pelo painel antes desta chamada: ele prova que o
      // e-mail foi autorizado para este tenant e define o cargo do novo usuário.
      const emailKey = email.replace(/\./g, ',');
      const inviteSnap = await admin.database().ref(`invites/${emailKey}`).once('value');
      const invite = inviteSnap.val();
      if (!invite || invite.tenantId !== tenantId) {
        return responder(res, 409, { error: 'convite_inexistente' });
      }

      const senha = gerarSenhaTemporaria();
      let existente = null;
      try {
        existente = await admin.auth().getUserByEmail(email);
      } catch (e) {
        if (e.code !== 'auth/user-not-found') throw e;
      }

      let uid;
      let criado = false;

      if (existente) {
        // Nunca permita que um admin de outra empresa redefina a senha de uma
        // conta já vinculada a um tenant diferente.
        let perfil = {};
        try {
          const perfilSnap = await admin.database().ref(`profiles/${existente.uid}`).once('value');
          perfil = perfilSnap.val() || {};
        } catch (e) {
          // Perfil pode ainda não existir; as claims abaixo bastam nesse caso.
        }
        const tenantVinculado =
          (existente.customClaims && existente.customClaims.tenantId) || perfil.tenantId;
        if (tenantVinculado && tenantVinculado !== tenantId && chamadorInfo.role !== 'super_admin') {
          return responder(res, 409, { error: 'email_vinculado_outro_tenant' });
        }

        await admin.auth().updateUser(existente.uid, { password: senha, displayName: name });
        uid = existente.uid;
      } else {
        const novo = await admin.auth().createUser({
          email,
          password: senha,
          displayName: name
        });
        uid = novo.uid;
        criado = true;
      }

      // Não gravar senha no RTDB: o fluxo de primeiro login consome o convite,
      // cria o perfil e o syncCustomClaims continua dono de role/tenantId.
      return responder(res, 200, { uid, email, password: senha, criado });
    } catch (e) {
      console.error('[criarUsuarioTenant] Falha:', e);
      if (e && e.code === 'auth/email-already-exists') {
        return responder(res, 409, { error: 'email_ja_existe' });
      }
      return responder(res, 500, { error: 'erro_interno' });
    }
  }
);
