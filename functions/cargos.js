// Centraliza TODA alteração de cargo/tenant em código de servidor (Admin SDK).
//
// O navegador nunca escreve role/tenantId/status em profiles/<uid> nem em
// users/<email>: ele chama POST /api/admin/cargo com o Firebase ID token.
// Aqui o token é verificado e o papel do chamador é reconfirmado no banco.

const { EMAIL_MESTRA, chaveEmail, emailNormalizado, normalizarRole } = require('./claims');
const { validarCorpo, hashIp, consumirCota } = require('./abuso');
const { ACOES_DESTRUTIVAS, contextoRequisicao, registrar, reservarOperacao, liberarOperacao } = require('./auditoria');

const ROLES_TENANT = new Set(['admin', 'rh', 'engenheiro', 'encarregado', 'comprador', 'pendente']);
const ROLES_MASTER = new Set([...ROLES_TENANT, 'super_admin', 'desativado', 'bloqueado']);

// Cargo RH: fica entre admin e engenheiro. O admin escolhe, por usuário, quais
// módulos ele pode usar e em quais obras atua. Padrão = pessoas/ponto.
const MODULOS_RH = new Set([
  'funcionarios', 'presenca', 'almocos', 'tarefas', 'obras', 'medicao',
  'estoque', 'compras', 'financeiro', 'orcamento', 'aprovacoes'
]);
const MODULOS_RH_PADRAO = { funcionarios: true, presenca: true, almocos: true };

/** Aceita apenas chaves conhecidas e valores booleanos; padrão quando ausente. */
function normalizarModulosRh(valor, cargo) {
  if (cargo !== 'rh') return null;
  const entrada = valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : null;
  if (!entrada) return { ...MODULOS_RH_PADRAO };
  const saida = {};
  MODULOS_RH.forEach(modulo => {
    if (entrada[modulo] === true) saida[modulo] = true;
  });
  return saida;
}

function erro(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

function responder(res, status, payload) {
  return res.status(status).json(payload);
}

function uidValido(valor) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(String(valor || ''));
}

/** Verifica o ID token e resolve o papel do chamador sem confiar no cliente. */
async function verificarChamador(req, { auth, db }) {
  const header = String((req.headers && req.headers.authorization) || '');
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw erro(401, 'nao_autenticado', 'Informe o token de autenticação.');

  let claims;
  try {
    claims = await auth.verifyIdToken(match[1].trim(), true);
  } catch (e) {
    throw erro(401, 'token_invalido', 'Sua sessão expirou. Entre novamente.');
  }

  const uid = String(claims.uid || '');
  const email = emailNormalizado(claims.email);
  if (!uid || !email) throw erro(401, 'token_invalido', 'Token sem identidade válida.');

  const [userRecord, perfilSnap, allowSnap, passaporteSnap] = await Promise.all([
    auth.getUser(uid).catch(() => null),
    db.ref(`profiles/${uid}`).once('value').catch(() => null),
    db.ref(`super_admins/${uid}`).once('value').catch(() => null),
    db.ref(`users/${chaveEmail(email)}`).once('value').catch(() => null)
  ]);

  if (!userRecord || userRecord.disabled) {
    throw erro(403, 'conta_bloqueada', 'Esta conta está bloqueada no Firebase Auth.');
  }

  const perfil = (perfilSnap && perfilSnap.val()) || {};
  const allow = (allowSnap && allowSnap.val()) || null;
  const passaporte = (passaporteSnap && passaporteSnap.val()) || {};

  const ehMaster =
    email === EMAIL_MESTRA ||
    !!(allow && allow.ativo !== false) ||
    (claims.role === 'super_admin' && perfil.role === 'super_admin' && passaporte.role === 'super_admin');
  const ehAdmin = !ehMaster && (claims.role === 'admin' || perfil.role === 'admin');

  if (!ehMaster && !ehAdmin) throw erro(403, 'sem_permissao', 'Acesso restrito a administradores.');

  return {
    uid,
    email,
    claims,
    ehMaster,
    ehAdmin,
    tenantId: perfil.tenantId || claims.tenantId || null
  };
}

async function resolverAlvo(db, auth, dados) {
  let uid = String(dados.uid || '').trim();
  let email = emailNormalizado(dados.email);
  if (uid && !uidValido(uid)) throw erro(400, 'uid_invalido', 'UID inválido.');
  if (email.length > 254) throw erro(400, 'email_invalido', 'E-mail inválido.');

  if (!uid && email) {
    const snap = await db.ref('profiles').orderByChild('email').equalTo(email).once('value');
    const encontrados = (snap && snap.val()) || {};
    uid = Object.keys(encontrados)[0] || '';
    if (!uid) {
      const passaporteUid = await db.ref(`users/${chaveEmail(email)}/uid`).once('value');
      uid = (passaporteUid && passaporteUid.val()) || '';
    }
  }

  if (!uid && email && auth.getUserByEmail) {
    try {
      const registro = await auth.getUserByEmail(email);
      uid = registro.uid;
    } catch (e) {
      if (!e || !/user-not-found/.test(e.code || '')) throw e;
    }
  }

  if (uid && !email) {
    const snap = await db.ref(`profiles/${uid}`).once('value');
    const perfil = (snap && snap.val()) || {};
    email = emailNormalizado(perfil.email);
    if (!email && auth.getUser) {
      const registro = await auth.getUser(uid).catch(() => null);
      email = emailNormalizado(registro && registro.email);
    }
  }

  if (!uid || !email) throw erro(404, 'alvo_nao_encontrado', 'Usuário de destino não encontrado.');
  return { uid, email };
}

async function lerPerfil(db, uid) {
  const snap = await db.ref(`profiles/${uid}`).once('value');
  return (snap && snap.val()) || {};
}

async function lerPassaporte(db, email) {
  const snap = await db.ref(`users/${chaveEmail(email)}`).once('value');
  return (snap && snap.val()) || null;
}

async function registrarAuditoria(db, ator, acao, alvo, sucesso, detalhes, contexto, obrigatoria = false) {
  // ator null: token inválido/escalada negada também deixam rastro.
  return registrar(db, { ator, acao, alvo, sucesso, detalhes, contexto, obrigatoria });
}

/** CMD: define o cargo de outro usuário. Nunca permite autoalteração. */
async function acaoDefinirCargo({ db, auth }, dados, chamador) {
  const alvo = await resolverAlvo(db, auth, dados);
  if (alvo.uid === chamador.uid || alvo.email === chamador.email) {
    throw erro(400, 'auto_alteracao', 'Você não pode alterar seu próprio cargo por aqui.');
  }

  // role ausente NÃO pode virar 'admin' por padrão: isso promoveria o alvo
  // silenciosamente quando o campo é omitido por engano ou por ataque.
  const cargoBruto = String(dados.role == null ? '' : dados.role).trim();
  if (!cargoBruto) throw erro(400, 'cargo_obrigatorio', 'Informe o cargo desejado.');
  const cargo = normalizarRole(cargoBruto);
  // A negativa de privilégio vem antes da whitelist: promover a super_admin
  // é sempre 403 para não-master, nunca um mero "cargo inválido".
  if (cargo === 'super_admin' && !chamador.ehMaster) {
    throw erro(403, 'sem_permissao', 'Somente Super Admin pode conceder acesso master.');
  }
  const permitidas = chamador.ehMaster ? ROLES_MASTER : ROLES_TENANT;
  if (!permitidas.has(cargo)) throw erro(400, 'cargo_invalido', 'Cargo não reconhecido.');

  const [perfil, passaporte] = await Promise.all([
    lerPerfil(db, alvo.uid),
    lerPassaporte(db, alvo.email)
  ]);

  let tenantId;
  if (cargo === 'super_admin') {
    tenantId = 'MASTER_SYSTEM';
  } else if (chamador.ehMaster) {
    tenantId = String(dados.tenantId || perfil.tenantId || (passaporte && passaporte.tenantId) || '');
    if (tenantId === 'MASTER_SYSTEM') tenantId = '';
  } else {
    if (!chamador.tenantId) throw erro(403, 'sem_tenant', 'Chamador sem tenant válido.');
    const passaporteTenant = passaporte && passaporte.tenantId;
    // Perfil sem tenant NÃO é "livre para adoção": um admin não pode mirar
    // uma conta Auth qualquer e incorporá-la à sua empresa.
    if (!perfil.tenantId && !passaporteTenant) {
      throw erro(403, 'sem_tenant', 'Este usuário ainda não pertence a uma empresa.');
    }
    if ((perfil.tenantId && perfil.tenantId !== chamador.tenantId) ||
        (passaporteTenant && passaporteTenant !== chamador.tenantId)) {
      throw erro(403, 'tenant_invalido', 'Este usuário pertence a outra empresa.');
    }
    if (dados.tenantId && dados.tenantId !== chamador.tenantId) {
      throw erro(403, 'tenant_invalido', 'Não é possível mover usuário entre empresas.');
    }
    tenantId = chamador.tenantId;
  }

  const status = cargo === 'desativado' || cargo === 'bloqueado' ? 'bloqueado' : 'ativo';
  // Carimbo sempre do servidor: o cliente não pode forjar cargoAtualizadoEm.
  const agora = Date.now();
  const perfilUpdates = {
    role: cargo,
    tenantId: tenantId || null,
    status,
    cargoAtualizadoEm: agora,
    cargoAtualizadoPor: chamador.email
  };
  const nome = String(dados.nome || '').trim();
  if (nome) perfilUpdates.name = nome;

  // Permissões granulares e escopo de obras são opcionais e só valem para RH.
  // O admin define no modal; o servidor normaliza para não aceitar chaves
  // arbitrárias nem promover o usuário a admin disfarçado.
  const modulos = normalizarModulosRh(dados.modulosPermitidos, cargo);
  if (modulos) perfilUpdates.modulosPermitidos = modulos;
  else if (cargo !== 'rh') perfilUpdates.modulosPermitidos = null;

  const obras = Array.isArray(dados.obrasPermitidas)
    ? dados.obrasPermitidas.map(o => String(o || '').trim()).filter(Boolean).slice(0, 500)
    : null;
  if (cargo === 'rh') {
    perfilUpdates.acessoObras = dados.acessoObras === 'especificas' ? 'especificas' : 'todas';
    perfilUpdates.obrasPermitidas = perfilUpdates.acessoObras === 'especificas' && obras && obras.length
      ? obras : null;
  } else {
    perfilUpdates.acessoObras = null;
    perfilUpdates.obrasPermitidas = null;
  }

  await db.ref(`profiles/${alvo.uid}`).update(perfilUpdates);

  // Passaporte global e convite são espelhos do perfil; nunca a origem da autoridade.
  const espelho = {
    role: cargo,
    tenantId: tenantId || null,
    modulosPermitidos: modulos || null,
    acessoObras: cargo === 'rh' ? (perfilUpdates.acessoObras || 'todas') : null,
    obrasPermitidas: cargo === 'rh' ? (perfilUpdates.obrasPermitidas || null) : null
  };
  if (passaporte) {
    await db.ref(`users/${chaveEmail(alvo.email)}`).update(espelho);
  }
  const inviteSnap = await db.ref(`invites/${chaveEmail(alvo.email)}`).once('value');
  if (inviteSnap && inviteSnap.val()) {
    await db.ref(`invites/${chaveEmail(alvo.email)}`).update(espelho);
  }

  // Allowlist gravada somente pelo Admin SDK. Ao remover o cargo, a entrada
  // desaparece junto — o syncCustomClaims derruba as claims na hora.
  await db.ref(`super_admins/${alvo.uid}`).set(
    cargo === 'super_admin'
      ? { uid: alvo.uid, email: alvo.email, role: 'super_admin', concedidoPor: chamador.email, concedidoEm: agora }
      : null
  );

  // Revoga tokens antigos: as novas claims só entram no próximo ID token.
  try {
    await auth.revokeRefreshTokens(alvo.uid);
  } catch (e) {
    console.warn('[Cargos] Falha ao revogar tokens:', e.message || e);
  }

  return {
    uid: alvo.uid, email: alvo.email, role: cargo, tenantId: tenantId || null, status,
    modulosPermitidos: modulos,
    acessoObras: cargo === 'rh' ? (perfilUpdates.acessoObras || 'todas') : null,
    obrasPermitidas: cargo === 'rh' ? (perfilUpdates.obrasPermitidas || null) : null
  };
}

/** CMD: desvincula o usuário do tenant sem apagar a conta do Firebase Auth. */
async function acaoRemoverUsuario({ db, auth }, dados, chamador) {
  const alvo = await resolverAlvo(db, auth, dados);
  if (alvo.uid === chamador.uid || alvo.email === chamador.email) {
    throw erro(400, 'auto_alteracao', 'Você não pode remover seu próprio acesso.');
  }

  const perfil = await lerPerfil(db, alvo.uid);
  const tenantId = String(dados.tenantId || perfil.tenantId || '');

  if (!chamador.ehMaster) {
    if (!chamador.tenantId || (tenantId && tenantId !== chamador.tenantId)) {
      throw erro(403, 'tenant_invalido', 'Este usuário pertence a outra empresa.');
    }
  }

  // Carimbo sempre do servidor: o cliente não pode forjar cargoAtualizadoEm.
  const agora = Date.now();
  await db.ref(`profiles/${alvo.uid}`).update({
    role: 'desativado',
    tenantId: null,
    status: 'bloqueado',
    cargoAtualizadoEm: agora,
    cargoAtualizadoPor: chamador.email
  });

  if (await lerPassaporte(db, alvo.email)) {
    await db.ref(`users/${chaveEmail(alvo.email)}`).update({ role: 'desativado', tenantId: null });
  }
  await db.ref(`invites/${chaveEmail(alvo.email)}`).set(null);
  await db.ref(`super_admins/${alvo.uid}`).set(null);

  if (tenantId && tenantId !== 'MASTER_SYSTEM') {
    try {
      const snap = await db.ref(`tenants/${tenantId}/usuarios`).once('value');
      const usuarios = (snap && snap.val()) || null;
      if (Array.isArray(usuarios)) {
        const filtrados = usuarios.filter((u) => {
          const emailUsuario = emailNormalizado(u && (u.email || u.username));
          return emailUsuario !== alvo.email && u.uid !== alvo.uid;
        });
        if (filtrados.length !== usuarios.length) {
          await db.ref(`tenants/${tenantId}/usuarios`).set(filtrados);
        }
      }
    } catch (e) {
      console.warn('[Cargos] Falha ao limpar lista do tenant:', e.message || e);
    }
  }

  try {
    await auth.revokeRefreshTokens(alvo.uid);
    await auth.updateUser(alvo.uid, { disabled: true });
  } catch (e) {
    console.warn('[Cargos] Falha ao bloquear credencial:', e.message || e);
  }

  return { uid: alvo.uid, email: alvo.email, removido: true, tenantId };
}

const ACOES = {
  definir_cargo: acaoDefinirCargo,
  remover_usuario: acaoRemoverUsuario
};

async function handleCargoRequest(req, res, options) {
  const inicio = Date.now();
  const contexto = contextoRequisicao(req, inicio, 'admin:cargo');
  let chamador = null;
  let acao = 'desconhecida';
  let alvo = '';
  let reserva = null;
  let efeitoAplicado = false;
  try {
    // Barreiras baratas primeiro: flood não deve virar várias leituras RTDB.
    if (req.method !== 'POST') throw erro(405, 'metodo_nao_permitido', 'Método não permitido.');
    const dados = validarCorpo(req);
    await consumirCota(options.db, `cargo:ip:${hashIp(req)}`, 60, 60 * 1000);

    chamador = await verificarChamador(req, options);
    await consumirCota(options.db, `cargo:uid:${chamador.uid}`, 60, 60 * 1000);

    acao = String(dados.acao || '').slice(0, 64);
    alvo = String(dados.email || dados.uid || '').slice(0, 300);
    if (!Object.prototype.hasOwnProperty.call(ACOES, acao)) {
      throw erro(400, 'acao_invalida', 'Ação não reconhecida.');
    }

    if (ACOES_DESTRUTIVAS.has(acao)) {
      reserva = await reservarOperacao(options.db, contexto.requestId, {
        acao, alvo, atorUid: chamador.uid
      });
      if (!reserva.committed) {
        return responder(res, 200, { ok: true, idempotente: true, requestId: contexto.requestId });
      }
    }

    const resultado = await ACOES[acao](options, dados, chamador);
    efeitoAplicado = true;
    const detalhes = acao === 'definir_cargo'
      ? `${resultado.role} @ ${resultado.tenantId || 'sem tenant'}`
      : String(resultado.tenantId || '');
    await registrarAuditoria(options.db, chamador, acao, alvo, true, detalhes, contexto, true);
    return responder(res, 200, { ok: true, ...resultado, requestId: contexto.requestId });
  } catch (err) {
    const status = Number(err.status) || 500;
    if (status >= 500) console.error('[Cargos] Erro na API:', err);
    if (err.retryAfter && res && typeof res.set === 'function') {
      res.set('Retry-After', String(err.retryAfter));
    }
    // Se o efeito já foi aplicado, manter a reserva é o que impede uma reentrega
    // de reaplicar a ação. O cliente recebe o requestId para repetir com segurança.
    if (reserva && reserva.committed && !efeitoAplicado) {
      await liberarOperacao(options.db, contexto.requestId);
    }

    contexto.duracaoMs = Math.max(0, Date.now() - inicio);
    // Tentativas sem token/papel também são registradas (ator null).
    let auditoriaFalhou = false;
    try {
      await registrarAuditoria(options.db, chamador, acao, alvo, false, err.code || err.message, contexto);
    } catch (e) {
      auditoriaFalhou = true;
      console.error('[Cargos] Falha na auditoria obrigatória:', e && e.message);
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
  handleCargoRequest,
  verificarChamador,
  ACOES,
  ROLES_TENANT,
  ROLES_MASTER,
  MODULOS_RH,
  MODULOS_RH_PADRAO,
  normalizarModulosRh
};
