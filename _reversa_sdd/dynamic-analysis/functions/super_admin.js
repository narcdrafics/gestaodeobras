/**
 * functions/super_admin.js
 * API do painel Super Admin. Todas as operações sensíveis (Auth do Firebase,
 * planos, limites, bloqueios e leitura da Kiwify) passam por aqui com Admin SDK.
 *
 * Nunca confie no papel vindo do navegador: o ID token é verificado no servidor
 * e o papel é confirmado em super_admins/<uid> (allowlist do servidor) ou, em
 * contas legadas, em users/<email> + profiles/<uid>. O cliente não grava mais
 * nenhum desses nós — alterações de cargo passam por /api/admin/cargo.
 */

const { PLANOS, normalizarPlanoAdmin, limitesDoPlano, diasDoPlano, MS_DIA } = require('./plan_catalog');
const { credenciaisKiwify, consultarKiwify, RECURSOS } = require('./kiwify_api');
const { validarCorpo, hashIp, consumirCota } = require('./abuso');
const { ACOES_DESTRUTIVAS, contextoRequisicao, registrar, reservarOperacao, liberarOperacao } = require('./auditoria');

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
    // checkRevoked: um token emitido antes de um bloqueio/rebaixamento deixa
    // de autorizar na hora, em vez de valer até o próximo refresh (~1h).
    claims = await auth.verifyIdToken(match[1].trim(), true);
  } catch (e) {
    throw erro(401, 'token_invalido', 'Sua sessão expirou. Entre novamente.');
  }

  const uid = String(claims.uid || '');
  const email = emailNormalizado(claims.email);
  if (!uid || !email) throw erro(401, 'token_invalido', 'Token sem identidade válida.');

  const [userRecord, profileSnap, passportSnap, allowSnap] = await Promise.all([
    auth.getUser(uid).catch(() => null),
    db.ref(`profiles/${uid}`).once('value').catch(() => null),
    db.ref(`users/${chaveEmail(email)}`).once('value').catch(() => null),
    db.ref(`super_admins/${uid}`).once('value').catch(() => null)
  ]);

  if (!userRecord || userRecord.disabled) {
    throw erro(403, 'conta_bloqueada', 'Esta conta está bloqueada no Firebase Auth.');
  }

  const perfil = (profileSnap && profileSnap.val()) || {};
  const passaporte = (passportSnap && passportSnap.val()) || {};
  const allow = (allowSnap && allowSnap.val()) || null;
  const masterAtivo = !!(allow && allow.ativo !== false);
  const masterLegado = email === EMAIL_MESTRA;
  const autorizado =
    masterLegado ||
    masterAtivo ||
    ((perfil.role === 'super_admin' || claims.role === 'super_admin') &&
      passaporte.role === 'super_admin');

  if (!autorizado) {
    throw erro(403, 'sem_permissao', 'Acesso restrito ao Super Admin.');
  }

  return { uid, email, claims };
}

async function registrarAuditoria(db, ator, acao, alvo, sucesso, detalhes, contexto, obrigatoria = false) {
  // ator null: tentativas de token inválido também deixam rastro.
  return registrar(db, { ator, acao, alvo, sucesso, detalhes, contexto, obrigatoria });
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

async function acaoResetSenha({ db, auth }, dados, ator) {
  const email = emailNormalizado(dados.email);
  if (!email) throw erro(400, 'email_obrigatorio', 'Informe o e-mail do usuário.');
  if (ator && email === emailNormalizado(ator.email)) {
    throw erro(400, 'auto_reset', 'Você não pode redefinir sua própria senha por aqui.');
  }

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (e) {
    throw erro(404, 'usuario_nao_encontrado', 'Não existe conta do Firebase para este e-mail.');
  }
  if (ator && userRecord.uid === ator.uid) {
    throw erro(400, 'auto_reset', 'Você não pode redefinir sua própria senha por aqui.');
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

  // O tenant vem do perfil gravado no servidor: um token vazado não pode
  // apagar a lista de usuários de uma empresa arbitrária.
  const tid = String((alvo.perfil && alvo.perfil.tenantId) || '').trim();
  const updates = {};
  if (alvo.uid) {
    updates[`profiles/${alvo.uid}`] = null;
    updates[`super_admins/${alvo.uid}`] = null;
  }
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
  const inicio = Date.now();
  const contexto = contextoRequisicao(req, inicio, 'admin:conta');
  let ator = null;
  let acaoAudit = 'desconhecida';
  let alvoAudit = '';
  let reserva = null;
  let efeitoAplicado = false;

  try {
    // Validação barata primeiro: método, tamanho e cota antes de tocar no Auth
    // ou no banco, para que flood não amplifique em várias leituras RTDB.
    if (req.method !== 'POST' && req.method !== 'GET') {
      throw erro(405, 'metodo_nao_permitido', 'Método não permitido.');
    }
    validarCorpo(req);
    await consumirCota(db, `admin:ip:${hashIp(req)}`, 60, 60 * 1000);

    ator = await verificarSuperAdmin(req, { auth, db });
    await consumirCota(db, `admin:uid:${ator.uid}`, 120, 60 * 1000);

    if (req.method === 'POST') {
      const body = req.body || {};
      acaoAudit = String(body.acao || 'desconhecida').slice(0, 64);
      alvoAudit = String(body.tenantId || body.email || body.uid || '').slice(0, 300);
      if (!Object.prototype.hasOwnProperty.call(ACOES, acaoAudit)) {
        throw erro(400, 'acao_invalida', 'Ação não reconhecida.');
      }
      await consumirCota(db, `admin:acao:${ator.uid}`, 30, 60 * 1000);

      const obrigatoria = ACOES_DESTRUTIVAS.has(acaoAudit);
      if (obrigatoria) {
        reserva = await reservarOperacao(db, contexto.requestId, {
          acao: acaoAudit, alvo: alvoAudit, atorUid: ator.uid
        });
        // Mesmo requestId = reentrega: não reaplica a ação destrutiva.
        if (!reserva.committed) {
          return responder(res, 200, { ok: true, idempotente: true, requestId: contexto.requestId });
        }
      }

      const resultado = await ACOES[acaoAudit]({ db, auth }, body, ator);
      efeitoAplicado = true;
      contexto.duracaoMs = Math.max(0, Date.now() - inicio);
      // Em ação destrutiva a auditoria é parte da transação: se não gravar,
      // a operação não pode ser considerada concluída (fail-closed).
      await registrarAuditoria(db, ator, acaoAudit, alvoAudit, true, '', contexto, obrigatoria);
      return responder(res, 200, { ok: true, ...resultado, requestId: contexto.requestId });
    }

    const tipo = String((req.query && req.query.tipo) || 'products').slice(0, 32);
    if (!Object.prototype.hasOwnProperty.call(RECURSOS, tipo)) {
      throw erro(400, 'tipo_invalido', 'Recurso Kiwify desconhecido.');
    }
    acaoAudit = `kiwify_${tipo}`;
    alvoAudit = tipo;
    await consumirCota(db, `admin:kiwify:${ator.uid}`, 30, 60 * 1000);

    // Parâmetros são construídos explicitamente: req.query inteiro nunca é
    // repassado ao upstream, e page_size/page_number têm teto.
    const params = {};
    for (const nome of ['page_size', 'page_number', 'status', 'product_id']) {
      if (req.query && req.query[nome] != null) params[nome] = req.query[nome];
    }
    const pageSize = Number(params.page_size);
    if (Number.isFinite(pageSize) && pageSize > 0) params.page_size = Math.min(Math.floor(pageSize), 100);
    else delete params.page_size;
    const pageNumber = Number(params.page_number);
    if (Number.isFinite(pageNumber) && pageNumber > 0) params.page_number = Math.min(Math.floor(pageNumber), 1000);
    else delete params.page_number;

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
      params,
      credenciais,
      http: options.http,
      cache: options.cache,
      agora: Date.now()
    });
    contexto.duracaoMs = Math.max(0, Date.now() - inicio);
    await registrarAuditoria(db, ator, acaoAudit, alvoAudit, true, '', contexto);
    return responder(res, 200, { ok: true, ...resultado, catalogoLocal: Object.values(PLANOS) });
  } catch (err) {
    const status = Number(err.status) || 500;
    if (status >= 500) console.error('[SuperAdmin] Erro na API:', err);
    if (err.retryAfter && res && typeof res.set === 'function') {
      res.set('Retry-After', String(err.retryAfter));
    }

    // Só libera a reserva se o efeito NÃO foi aplicado. Se a auditoria falhou
    // depois da escrita, manter a reserva evita reaplicar a ação na reentrega.
    if (reserva && reserva.committed && !efeitoAplicado) {
      await liberarOperacao(db, contexto.requestId);
    }

    contexto.duracaoMs = Math.max(0, Date.now() - inicio);
    // Tentativas falhas de autenticação/autorização também entram na auditoria.
    let auditoriaFalhou = false;
    try {
      await registrarAuditoria(db, ator, acaoAudit, alvoAudit, false, err.code || err.message, contexto);
    } catch (e) {
      auditoriaFalhou = true;
      console.error('[SuperAdmin] Falha na auditoria obrigatória:', e && e.message);
    }
    const statusFinal = auditoriaFalhou ? 503 : status;
    return responder(res, statusFinal, {
      ok: false,
      erro: auditoriaFalhou ? 'auditoria_falhou' : (err.code || 'erro_interno'),
      mensagem: statusFinal >= 500 ? 'Erro interno no servidor.' : (err.message || 'Falha na operação.'),
      requestId: contexto.requestId,
      idempotente: efeitoAplicado
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
