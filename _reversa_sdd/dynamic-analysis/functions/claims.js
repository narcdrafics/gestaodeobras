// Regras de autoridade para papéis privilegiados.
//
// O cliente NUNCA pode conceder `super_admin`: nem escrevendo em
// profiles/<uid>, users/<email>, invites/<email> ou qualquer outro nó.
// A fonte canônica é `super_admins/<uid>` (gravada apenas com Admin SDK).
//
// O nó `users/<email>` é mantido por compatibilidade (passaporte global do
// painel Master), mas ele só PRESERVA uma promoção já existente nas claims.
// Um atacante que consiga gravar nesse nó não ganha privilégio novo.

const EMAIL_MESTRA = 'tonycampelo@gmail.com';

function emailNormalizado(valor) {
  return String(valor || '').trim().toLowerCase();
}

function chaveEmail(valor) {
  return emailNormalizado(valor).replace(/\./g, ',');
}

function normalizarRole(role) {
  // `mestre` é alias legado; as claims sempre usam o nome canônico.
  return role === 'mestre' ? 'encarregado' : (role || 'admin');
}

/**
 * Decide se `uid` pode receber claims de super_admin.
 *
 * Ordem de confiança:
 *  1. super_admins/<uid>  -> allowlist gravada só pelo servidor;
 *  2. e-mail mestre legado -> exceção histórica, também aceita nas rules;
 *  3. users/<email>/role + claims atuais -> apenas migração de contas que
 *     JÁ eram super_admin. Nunca promove uma conta nova.
 */
async function avaliarSuperAdmin({ uid, email, currentClaims = {}, db }) {
  const id = String(uid || '');
  const emailAtual = emailNormalizado(email);
  if (!id || !emailAtual) return { autorizado: false, motivo: 'sem_identidade' };

  if (db && typeof db.ref === 'function') {
    const allowSnap = await db.ref(`super_admins/${id}`).once('value');
    const allow = (allowSnap && allowSnap.val()) || null;
    if (allow && allow.ativo !== false && (!allow.email || allow.email === emailAtual)) {
      return { autorizado: true, motivo: 'allowlist' };
    }
  }

  if (emailAtual === EMAIL_MESTRA) {
    return { autorizado: true, motivo: 'email_mestre' };
  }

  // Migração segura: o passaporte legado só conta se a conta já tinha a claim.
  // Assim um cliente não consegue se promover gravando users/<email>.
  if (currentClaims.role === 'super_admin' && db && typeof db.ref === 'function') {
    const legadoSnap = await db.ref(`users/${chaveEmail(emailAtual)}/role`).once('value');
    if (legadoSnap && legadoSnap.val() === 'super_admin') {
      try {
        await db.ref(`super_admins/${id}`).set({
          uid: id,
          email: emailAtual,
          role: 'super_admin',
          migradoEm: Date.now()
        });
      } catch (e) {
        console.warn('[claims] Falha ao migrar super_admin legado:', e.message || e);
      }
      return { autorizado: true, motivo: 'legado_migrado' };
    }
  }

  return { autorizado: false, motivo: 'nao_autorizado' };
}

module.exports = {
  EMAIL_MESTRA,
  chaveEmail,
  emailNormalizado,
  normalizarRole,
  avaliarSuperAdmin
};
