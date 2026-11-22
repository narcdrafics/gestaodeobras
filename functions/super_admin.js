/**
 * functions/super_admin.js
 * API do painel Super Admin. Todas as operações sensíveis (Auth do Firebase,
 * planos, limites, bloqueios e leitura da Kiwify) passam por aqui com Admin SDK.
 *
 * Nunca confie no papel vindo do navegador: o ID token é verificado no servidor
 * e o papel é confirmado em users/<email> + profiles/<uid>.
 */

const { PLANOS, normalizarPlanoAdmin, limitesDoPlano, diasDoPlano, MS_DIA } = require('./plan_catalog');
const { credenciaisKiwify, consultarKiwify } = require('./kiwify_api');

const EMAIL_MESTRA = 'tonycampelo@gmail.com';
const MAX_LIMITE = 9999;

function erro(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

function emailNormalizado(valor) {
  return String(valor || '').trim().toLowerCase();
}

function chaveEmail(valor) {
  return emailNormalizado(valor).replace(/\./g, ',');
}

function uidValido(valor) {
  return /^[A-Za-z0-9]{1,128}$/.test(String(valor || ''));
}

function inteiroPositivo(valor, padrao, maximo = MAX_LIMITE) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return padrao;
  return Math.min(Math.floor(n), maximo);
}

/** Verifica o token do Firebase e confirma o papel master no banco. */
async function verificarSuperAdmin(req, { auth, db }) {
  const header = String((req.headers && req.headers.authorization) || '');
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw erro(401, 'nao_autenticado', 'Informe o token de autenticação.');

  let claims;
  try {
    claims = await auth.verifyIdToken(match[1].trim());
  } catch (e) {
    throw erro(401, 'token_invalido', 'Sua sessão expirou. Entre novamente.');
  }

  const uid = String(claims.uid || '');
  const email = emailNormalizado(claims.email);
  if (!uid || !email) throw erro(401, 'token_invalido', 'Token sem identidade válida.');

  const [userRecord, profileSnap, passportSnap] = await Promise.all([
    auth.getUser(uid).catch(() => null),
    db.ref(`profiles/${uid}`).once('value').catch(() => null),
    db.ref(`users/${chaveEmail(email)}`).once('value').catch(() => null)
  ]);

  if (!userRecord || userRecord.disabled) {
    throw erro(403, 'conta_bloqueada', 'Esta conta está bloqueada no Firebase Auth.');
  }

  const perfil = (profileSnap && profileSnap.val()) || {};
  const passaporte = (passportSnap && passportSnap.val()) || {};
  const masterLegado = email === EMAIL_MESTRA;
  const autorizado =
    (perfil.role === 'super_admin' || masterLegado) &&
    (passaporte.role === 'super_admin' || masterLegado);

  if (!autorizado) {
    throw erro(403, 'sem_permissao', 'Acesso restrito ao Super Admin.');
  }

  return { uid, email, claims };
}

async function registrarAuditoria(db, ator, acao, alvo, sucesso, detalhes) {
  if (!db || !ator) return;
  try {
    await db.ref('admin_audit').push({
      timestamp: Date.now(),
      atorUid: ator.uid,
      atorEmail: ator.email,
      acao,
      alvo: String(alvo || '').slice(0, 300),
      sucesso: sucesso !== false,
      detalhes: String(detalhes || '').slice(0, 300)
    });
  } catch (e) {
    console.warn('[SuperAdmin] Falha ao gravar auditoria:', e.message || e);
  }
}

async function resolverUsuario(db, { uid, email }) {
  let alvoUid = String(uid || '').trim();
  let alvoEmail = emailNormalizado(email);
  let perfil = null;

  if (alvoUid) {
    if (!uidValido(alvoUid)) throw erro(400, 'uid_invalido', 'UID inválido.');
    const snap = await db.ref(`profiles/${alvoUid}`).once('value');
    perfil = snap.val() || null;
    if (!alvoEmail && perfil && perfil.email) alvoEmail = emailNormalizado(perfil.email);
  } else if (alvoEmail) {
    const snap = await db.ref('profiles').orderByChild('email').equalTo(alvoEmail).once('value');
    const encontrados = snap.val() || {};
    alvoUid = Object.keys(encontrados)[0] || '';
    perfil = alvoUid ? encontrados[alvoUid] : null;
    if (!alvoUid) {
      const passportUid = await db.ref(`users/${chaveEmail(alvoEmail)}/uid`).once('value');
      alvoUid = passportUid.val() || '';
    }
  }

  if (!alvoUid && !alvoEmail) {
    throw erro(400, 'alvo_obrigatorio', 'Informe o UID ou e-mail do usuário.');
  }
  return { uid: alvoUid, email: alvoEmail, perfil };
}

async function acaoResetSenha({ db, auth }, dados) {
  const email = emailNormalizado(dados.email);
  if (!email) throw erro(400, 'email_obrigatorio', 'Informe o e-mail do usuário.');

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (e) {
    throw erro(404, 'usuario_nao_encontrado', 'Não existe conta do Firebase para este e-mail.');
  }
  if (userRecord.disabled) {
    throw erro(409, 'usuario_bloqueado', 'Desbloqueie o usuário antes de redefinir a senha.');
  }

  let link;
  try {
    link = await auth.generatePasswordResetLink(email);
  } catch (e) {
    console.error('[SuperAdmin] generatePasswordResetLink falhou:', e.message || e);
    throw erro(502, 'link_senha_falhou', 'Não foi possível gerar o link de redefinição.');
  }

  // O link é sensível: não entra no log de auditoria, só na resposta autenticada.
  return { email, uid: userRecord.uid, link };
}

async function acaoBloquearUsuario({ db, auth }, dados, ator) {
  const alvo = await resolverUsuario(db, dados);
  if (alvo.uid && alvo.uid === ator.uid) {
    throw erro(400, 'auto_bloqueio', 'Você não pode bloquear sua própria conta.');
  }
  if (alvo.email && alvo.email === ator.email) {
    throw erro(400, 'auto_bloqueio', 'Você não pode bloquear sua própria conta.');
  }
  const bloqueado = dados.bloqueado === true;
  const agora = Date.now();

  if (alvo.uid) {
    // Bloqueio no Auth é a autoridade: invalida token novo e impede login.
    try {
      await auth.updateUser(alvo.uid, { disabled: bloqueado });
      if (bloqueado) await auth.revokeRefreshTokens(alvo.uid);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
    }
    const updates = {};
    updates[`profiles/${alvo.uid}/status`] = bloqueado ? 'bloqueado' : 'ativo';
    updates[`profiles/${alvo.uid}/bloqueadoEm`] = bloqueado ? agora : null;
    updates[`profiles/${alvo.uid}/bloqueadoPor`] = bloqueado ? ator.email : null;
    await db.ref().update(updates);
  } else if (bloqueado) {
    // Sem UID ainda: ao menos barra o passaporte global.
    await db.ref(`users/${chaveEmail(alvo.email)}/bloqueado`).set(true);
  }

  return { uid: alvo.uid, email: alvo.email, bloqueado };
}

async function acaoExcluirUsuario({ db, auth }, dados, ator) {
  const alvo = await resolverUsuario(db, dados);
  if (alvo.uid && alvo.uid === ator.uid) {
    throw erro(400, 'auto_exclusao', 'Você não pode excluir sua própria conta.');
  }
  if (alvo.email && alvo.email === ator.email) {
    throw erro(400, 'auto_exclusao', 'Você não pode excluir sua própria conta.');
  }

  const tid = String(dados.tenantId || (alvo.perfil && alvo.perfil.tenantId) || '').trim();
  const updates = {};
  if (alvo.uid) updates[`profiles/${alvo.uid}`] = null;
  if (alvo.email) {
    updates[`users/${chaveEmail(alvo.email)}`] = null;
    updates[`invites/${chaveEmail(alvo.email)}`] = null;
  }
  if (!Object.keys(updates).length) {
    throw erro(404, 'usuario_nao_encontrado', 'Nada foi encontrado para excluir.');
  }

  // Remove também da lista operacional de usuários da empresa.
  if (tid && tid !== 'MASTER_SYSTEM' && alvo.email) {
    try {
      const snap = await db.ref(`tenants/${tid}/usuarios`).once('value');
      const usuarios = snap.val();
      if (Array.isArray(usuarios)) {
        const filtrados = usuarios.filter((u) => {
          const uEmail = emailNormalizado(u && (u.email || u.username));
          return uEmail !== alvo.email && (!alvo.uid || u.uid !== alvo.uid);
        });
        if (filtrados.length !== usuarios.length) updates[`tenants/${tid}/usuarios`] = filtrados;
      }
    } catch (e) {
      console.warn('[SuperAdmin] Não foi possível limpar usuarios do tenant:', e.message || e);
    }
  }

  await db.ref().update(updates);

  // O trigger syncCustomClaims também exclui ao apagar o perfil; ignore duplicidade.
  if (alvo.uid) {
    try {
      await auth.deleteUser(alvo.uid);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') {
        console.warn('[SuperAdmin] deleteUser falhou (trigger pode ter removido):', e.message || e);
        await auth.updateUser(alvo.uid, { disabled: true }).catch(() => {});
      }
    }
  }

  return { uid: alvo.uid, email: alvo.email, tenantId: tid || null, excluido: true };
}

async function acaoDefinirLimites({ db }, dados) {
  const tid = String(dados.tenantId || '').trim();
  if (!tid) throw erro(400, 'tenant_obrigatorio', 'Informe o tenant.');

  const snap = await db.ref(`tenants/${tid}`).once('value');
  const tenant = snap.val();
  if (!tenant) throw erro(404, 'tenant_nao_encontrado', 'Empresa não encontrada.');

  const plano = normalizarPlanoAdmin(dados.plano || tenant.plano) || 'free_trial';
  const limites = limitesDoPlano(plano, dados.limites || {});
  const updates = {
    [`tenants/${tid}/config/limiteObras`]: limites.obras,
    [`tenants/${tid}/config/limiteUsuarios`]: limites.usuarios,
    [`tenants/${tid}/config/limiteTrabalhadores`]: limites.trabalhadores
  };
  await db.ref().update(updates);
  return { tenantId: tid, limites };
}

async function acaoDefinirPlano({ db }, dados) {
  const tid = String(dados.tenantId || '').trim();
  if (!tid) throw erro(400, 'tenant_obrigatorio', 'Informe o tenant.');

  const snap = await db.ref(`tenants/${tid}`).once('value');
  if (!snap.exists()) throw erro(404, 'tenant_nao_encontrado', 'Empresa não encontrada.');

  const plano = normalizarPlanoAdmin(dados.plano);
  if (!plano) throw erro(400, 'plano_invalido', 'Plano não reconhecido.');

  const catalogo = PLANOS[plano];
  const dias = diasDoPlano(plano, dados.dias);
  const limites = limitesDoPlano(plano, dados.limites || {});
  const agora = Date.now();
  const vencimento = agora + dias * MS_DIA;

  const updates = {
    [`tenants/${tid}/plano`]: plano,
    [`tenants/${tid}/planoVencimento`]: vencimento,
    [`tenants/${tid}/status`]: 'ativo',
    [`tenants/${tid}/billingState`]: 'ativo',
    [`tenants/${tid}/billingStateMotivo`]: 'ajuste_manual_master',
    [`tenants/${tid}/billingStateAtualizadoEm`]: agora,
    [`tenants/${tid}/origemAtivacao`]: 'painel_master',
    [`tenants/${tid}/config/limiteObras`]: limites.obras,
    [`tenants/${tid}/config/limiteUsuarios`]: limites.usuarios,
    [`tenants/${tid}/config/limiteTrabalhadores`]: limites.trabalhadores,
    [`tenants/${tid}/carenciaAte`]: null,
    [`tenants/${tid}/motivoBloqueio`]: null,
    [`tenants/${tid}/dataBloqueio`]: null,
    [`tenants/${tid}/cancelamentoAgendado`]: null,
    [`tenants/${tid}/dataCancelamento`]: null,
    [`tenants/${tid}/avisoCarencia`]: null
  };

  if (plano === 'free_trial') {
    updates[`tenants/${tid}/trialExpiracao`] = vencimento;
  }

  await db.ref().update(updates);
  return { tenantId: tid, plano, dias, planoVencimento: vencimento, limites };
}

async function acaoStatusTenant({ db }, dados) {
  const tid = String(dados.tenantId || '').trim();
  if (!tid) throw erro(400, 'tenant_obrigatorio', 'Informe o tenant.');
  const snap = await db.ref(`tenants/${tid}`).once('value');
  if (!snap.exists()) throw erro(404, 'tenant_nao_encontrado', 'Empresa não encontrada.');

  const bloqueado = dados.bloqueado === true;
  const agora = Date.now();
  const updates = {
    [`tenants/${tid}/status`]: bloqueado ? 'bloqueado_pagamento' : 'ativo',
    [`tenants/${tid}/billingState`]: bloqueado ? 'bloqueado' : 'ativo',
    [`tenants/${tid}/billingStateMotivo`]: bloqueado ? 'bloqueio_manual_master' : 'liberacao_manual_master',
    [`tenants/${tid}/billingStateAtualizadoEm`]: agora,
    [`tenants/${tid}/motivoBloqueio`]: bloqueado ? 'bloqueio_manual_master' : null,
    [`tenants/${tid}/dataBloqueio`]: bloqueado ? agora : null
  };
  await db.ref().update(updates);
  return { tenantId: tid, bloqueado };
}

const ACOES = {
  reset_password: acaoResetSenha,
  bloquear_usuario: acaoBloquearUsuario,
  excluir_usuario: acaoExcluirUsuario,
  definir_limites: acaoDefinirLimites,
  definir_plano: acaoDefinirPlano,
  bloquear_tenant: acaoStatusTenant
};

function responder(res, status, payload) {
  return res.status(status).json(payload);
}

/**
 * Handler HTTP único do painel master.
 * POST /api/admin/conta  -> ações (body: { acao, ...dados })
 * GET  /api/admin/conta  -> ?recurso=kiwify&tipo=products|sales|account|webhooks
 */
async function handleAdminRequest(req, res, options) {
  const { auth, db } = options;
  let ator = null;
  let acaoAudit = 'desconhecida';
  let alvoAudit = '';

  try {
    ator = await verificarSuperAdmin(req, { auth, db });

    if (req.method === 'POST') {
      const body = req.body || {};
      acaoAudit = String(body.acao || 'desconhecida');
      alvoAudit = String(body.tenantId || body.email || body.uid || '');
      const executar = ACOES[acaoAudit];
      if (!executar) throw erro(400, 'acao_invalida', 'Ação não reconhecida.');

      const resultado = await executar({ db, auth }, body, ator);
      await registrarAuditoria(db, ator, acaoAudit, alvoAudit, true);
      return responder(res, 200, { ok: true, ...resultado });
    }

    if (req.method === 'GET') {
      const tipo = String(req.query && req.query.tipo || 'products');
      acaoAudit = `kiwify_${tipo}`;
      alvoAudit = tipo;

      const credenciais = credenciaisKiwify(
        options.credenciaisKiwify || {
          clientId: options.clientId,
          clientSecret: options.clientSecret,
          accountId: options.accountId,
          apiToken: options.apiToken
        }
      );
      const resultado = await consultarKiwify({
        recurso: tipo,
        params: req.query || {},
        credenciais,
        http: options.http,
        cache: options.cache,
        agora: Date.now()
      });
      await registrarAuditoria(db, ator, acaoAudit, alvoAudit, true);
      return responder(res, 200, { ok: true, ...resultado, catalogoLocal: Object.values(PLANOS) });
    }

    throw erro(405, 'metodo_nao_permitido', 'Método não permitido.');
  } catch (err) {
    const status = Number(err.status) || 500;
    if (status >= 500) console.error('[SuperAdmin] Erro na API:', err);
    await registrarAuditoria(db, ator, acaoAudit, alvoAudit, false, err.code || err.message);
    return responder(res, status, {
      ok: false,
      erro: err.code || 'erro_interno',
      mensagem: status >= 500 ? 'Erro interno no servidor.' : (err.message || 'Falha na operação.')
    });
  }
}

module.exports = {
  erro,
  verificarSuperAdmin,
  handleAdminRequest,
  inteiroPositivo,
  chaveEmail,
  ACOES
};
