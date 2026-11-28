// Decisão de aprovação via Admin SDK.
//
// O navegador NÃO grava status/decidido* no RTDB: ele chama POST
// /api/admin/aprovacao com o Firebase ID token. Aqui o token é verificado,
// o papel é reconfirmado no banco (incluindo super_admin operando outro
// tenant) e a decisão é escrita com Admin SDK, que ignora as rules do cliente.
// O trigger `aplicarAprovacao` continua aplicando a operação real.

const { EMAIL_MESTRA, emailNormalizado, normalizarRole } = require('./claims');
const { validarCorpo, hashIp, consumirCota } = require('./abuso');
const { contextoRequisicao, registrar } = require('./auditoria');

const TIPOS = new Set([
  'movimentacao_estoque', 'trabalhador_add', 'trabalhador_remove',
  'financeiro_lancamento', 'financeiro_status', 'orcamento_fechamento',
  'compra_criacao', 'medicao_fechamento'
]);
const ADMIN_ROLES = new Set(['admin', 'super_admin']);
// Cada tipo de solicitação pertence a um módulo. O RH só atua no tipo se o
// admin habilitou o módulo correspondente E o de aprovações.
const MODULO_POR_TIPO = {
  movimentacao_estoque: 'estoque',
  trabalhador_add: 'funcionarios',
  trabalhador_remove: 'funcionarios',
  financeiro_lancamento: 'financeiro',
  financeiro_status: 'financeiro',
  orcamento_fechamento: 'orcamento',
  compra_criacao: 'compras',
  medicao_fechamento: 'medicao'
};
// Ordem decrescente de privilégio para reconciliar claim x perfil: um perfil
// desatualizado não pode rebaixar uma claim admin vigente (nem o contrário).
const HIERARQUIA = ['super_admin', 'admin', 'rh', 'engenheiro', 'comprador', 'encarregado', 'pendente', 'bloqueado', 'desativado'];

function erro(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

function responder(res, status, payload) {
  return res.status(status).json(payload);
}

/** Maior papel entre a claim do token e o perfil do banco. */
function papelEfetivo(...papeis) {
  const normalizados = papeis
    .map(p => normalizarRole(p || ''))
    .filter(Boolean);
  return HIERARQUIA.find(role => normalizados.includes(role)) || normalizados[0] || 'admin';
}

function moduloDaAprovacao(tipo) {
  return MODULO_POR_TIPO[tipo] || null;
}

function papelPodeDecidir(papel, aprovacao, modulos) {
  const role = normalizarRole(papel);
  if (ADMIN_ROLES.has(role)) return true;
  // RH decide somente os tipos cujos módulos o admin habilitou explicitamente.
  if (role === 'rh' && modulos && modulos.aprovacoes === true) {
    const modulo = moduloDaAprovacao(aprovacao && aprovacao.tipo);
    return !!modulo && modulos[modulo] === true;
  }
  return role === 'engenheiro'
    && aprovacao.tipo === 'movimentacao_estoque'
    && aprovacao.notificarAdmin === true;
}

/** Verifica o ID token e resolve a autoridade do chamador sem confiar no cliente. */
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
    db.ref(`users/${email.replace(/\./g, ',')}`).once('value').catch(() => null)
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
  const claimsRole = normalizarRole(claims.role || '');
  const perfilRole = normalizarRole(perfil.role || '');
  const role = papelEfetivo(claimsRole, perfilRole);

  const modulos = (perfil.role === 'rh' && perfil.modulosPermitidos && typeof perfil.modulosPermitidos === 'object')
    ? perfil.modulosPermitidos
    : (claims.modulosPermitidos && typeof claims.modulosPermitidos === 'object'
      ? claims.modulosPermitidos : null);

  return {
    uid,
    email,
    claims,
    role,
    claimsRole,
    perfilRole,
    ehMaster,
    modulos,
    ehAdmin: ADMIN_ROLES.has(role) || ADMIN_ROLES.has(claimsRole) || ADMIN_ROLES.has(perfilRole)
  };
}

async function decidir({ db, auth }, dados, chamador) {
  const tenantId = String(dados.tenantId || '').trim();
  const aprovacaoId = String(dados.aprovacaoId || '').trim();
  const decisao = String(dados.decisao || '').trim();
  const motivo = String(dados.motivo || '').trim().slice(0, 500);

  if (!tenantId || !aprovacaoId || /^\.\.?$/.test(aprovacaoId) || /[/.#\[\]$]/.test(aprovacaoId)) {
    throw erro(400, 'dados_invalidos', 'Solicitação inválida.');
  }
  if (decisao !== 'aprovado' && decisao !== 'rejeitado') {
    throw erro(400, 'decisao_invalida', 'Decisão inválida.');
  }
  if (decisao === 'rejeitado' && !motivo) {
    throw erro(400, 'motivo_obrigatorio', 'Informe o motivo da rejeição.');
  }

  const caminho = `tenants/${tenantId}/aprovacoes/${aprovacaoId}`;
  const [apSnap, tenantSnap] = await Promise.all([
    db.ref(caminho).once('value'),
    db.ref(`tenants/${tenantId}`).once('value')
  ]);
  const ap = (apSnap && apSnap.val()) || null;
  if (!ap) throw erro(404, 'aprovacao_inexistente', 'Solicitação não encontrada.');
  if (ap.status !== 'pendente') {
    throw erro(409, 'ja_decidida', 'Esta solicitação já foi decidida.');
  }
  if (ap.expiradoEm || ap.aplicadoEm || Number(ap.expiraEm) <= Date.now()) {
    throw erro(409, 'expirada', 'Esta solicitação expirou.');
  }
  if (!TIPOS.has(ap.tipo) || !ap.payload || typeof ap.payload !== 'object') {
    throw erro(400, 'solicitacao_invalida', 'Solicitação inválida.');
  }

  const tenant = (tenantSnap && tenantSnap.val()) || {};
  if (tenant.billingState === 'somente_leitura' || tenant.billingState === 'bloqueado') {
    throw erro(403, 'plano_bloqueado', 'A empresa está com o plano bloqueado para alterações.');
  }

  if (!chamador.ehMaster) {
    const perfilSnap = await db.ref(`profiles/${chamador.uid}`).once('value');
    const perfil = (perfilSnap && perfilSnap.val()) || {};
    if (perfil.tenantId && perfil.tenantId !== tenantId) {
      throw erro(403, 'tenant_invalido', 'Você não pertence a esta empresa.');
    }
  }

  // A rule antiga autorizava admin por claim, perfil OU emailAdmin do tenant.
  // Mantemos a mesma união para não rebaixar quem já tinha acesso.
  const adminPorEmail = emailNormalizado(tenant.emailAdmin) === chamador.email;
  const ehAdmin = chamador.ehMaster || chamador.ehAdmin || adminPorEmail;
  const papel = ehAdmin ? 'admin' : chamador.role;
  if (!papelPodeDecidir(papel, ap, chamador.modulos)) {
    console.warn('[Aprovações API] sem_permissao', {
      uid: chamador.uid,
      tenantId,
      tipo: ap.tipo,
      claim: chamador.claimsRole,
      perfil: chamador.perfilRole,
      papelEfetivo: papel,
      ehMaster: chamador.ehMaster,
      adminPorEmail
    });
    const falha = erro(403, 'sem_permissao', 'Seu papel nesta empresa não permite decidir este tipo de solicitação.');
    falha.papel = papel;
    falha.claim = chamador.claimsRole;
    falha.perfil = chamador.perfilRole;
    throw falha;
  }

  const agora = Date.now();
  const updates = {
    [`${caminho}/status`]: decisao,
    [`${caminho}/decididoPor`]: chamador.uid,
    [`${caminho}/decididoEm`]: agora,
    [`${caminho}/decididoPorPapel`]: papel
  };
  if (decisao === 'rejeitado') updates[`${caminho}/motivo`] = motivo;
  if (papel === 'engenheiro') updates[`${caminho}/notificarAdmin`] = true;
  if (papel === 'rh' && chamador.modulos) {
    updates[`${caminho}/decididoPorModulos`] = chamador.modulos;
  }

  // Transação: só o primeiro decididor altera um pendente, mesmo em corrida.
  const resultado = await db.ref(caminho).transaction((atual) => {
    if (!atual || atual.status !== 'pendente') return atual;
    if (atual.expiradoEm || atual.aplicadoEm || Number(atual.expiraEm) <= agora) return atual;
    return { ...atual, ...desembrilhar(updates, caminho) };
  });

  if (!resultado.committed) {
    throw erro(409, 'ja_decidida', 'Esta solicitação já foi decidida.');
  }

  return { ok: true, id: aprovacaoId, status: decisao, decididoEm: agora };
}

function desembrilhar(updates, caminho) {
  const prefixo = caminho + '/';
  const obj = {};
  for (const [chave, valor] of Object.entries(updates)) {
    if (chave.startsWith(prefixo)) obj[chave.slice(prefixo.length)] = valor;
  }
  return obj;
}

async function handleAprovacaoRequest(req, res, options) {
  const inicio = Date.now();
  const contexto = contextoRequisicao(req, inicio, 'admin:aprovacao');
  let chamador = null;
  let alvo = '';
  try {
    if (req.method !== 'POST') throw erro(405, 'metodo_nao_permitido', 'Método não permitido.');
    const dados = validarCorpo(req);
    await consumirCota(options.db, `aprovacao:ip:${hashIp(req)}`, 60, 60 * 1000);

    chamador = await verificarChamador(req, options);
    await consumirCota(options.db, `aprovacao:uid:${chamador.uid}`, 60, 60 * 1000);

    alvo = String(dados.aprovacaoId || '').slice(0, 128);
    const resultado = await decidir(options, dados, chamador);
    await registrar(options.db, {
      ator: chamador,
      acao: 'decidir_aprovacao',
      alvo,
      sucesso: true,
      detalhes: `${resultado.status} @ ${String(dados.tenantId || '')}`,
      contexto
    });
    return responder(res, 200, resultado);
  } catch (err) {
    const status = Number(err.status) || 500;
    if (status >= 500) console.error('[Aprovações API] Erro:', err);
    if (err.retryAfter && res && typeof res.set === 'function') {
      res.set('Retry-After', String(err.retryAfter));
    }
    let auditoriaFalhou = false;
    try {
      await registrar(options.db, {
        ator: chamador,
        acao: 'decidir_aprovacao',
        alvo,
        sucesso: false,
        detalhes: err.code || err.message,
        contexto
      });
    } catch (e) {
      auditoriaFalhou = true;
      console.error('[Aprovações API] Falha na auditoria:', e && e.message);
    }
    const corpo = {
      ok: false,
      erro: auditoriaFalhou ? 'auditoria_falhou' : (err.code || 'erro_interno'),
      mensagem: status >= 500 ? 'Erro interno no servidor.' : (err.message || 'Falha na operação.')
    };
    // Diagnóstico somente do próprio chamador (papéis não são segredos).
    if (err.papel) {
      corpo.papel = err.papel;
      corpo.claim = err.claim || '';
      corpo.perfil = err.perfil || '';
    }
    return responder(res, auditoriaFalhou ? 503 : status, corpo);
  }
}

module.exports = {
  handleAprovacaoRequest,
  verificarChamador,
  papelPodeDecidir,
  moduloDaAprovacao,
  MODULO_POR_TIPO
};
