/**
 * Obra Real - Slug (endereço da empresa)
 *
 * O slug é o endereço da empresa: <slug>.obrareal.com. Ele é também o ID do tenant
 * (tenants/<slug>) e a chave do nó público (tenants_public/<slug>).
 * Mesma regra do painel do Master: somente letras minúsculas e números.
 *
 * Tudo aqui é independente de DOM. Só createTenantAccount / isSlugTaken tocam no
 * banco, e recebem o `db` (firebase.database()) por parâmetro para poderem ser testadas.
 */
(function (root) {
  'use strict';

  const BASE_DOMAIN = 'obrareal.com';
  const MIN_LEN = 3;
  const MAX_LEN = 30;
  const NAME_MAX_LEN = 80;
  const TRIAL_MS = 30 * 24 * 60 * 60 * 1000;

  // Endereços que não podem virar empresa: infraestrutura, páginas do sistema e marca.
  const RESERVED = new Set([
    'www', 'app', 'api', 'admin', 'administrador', 'login', 'signin', 'signup', 'cadastro',
    'painel', 'dashboard', 'master', 'mastersystem', 'super', 'superadmin', 'root', 'system',
    'sistema', 'suporte', 'support', 'ajuda', 'help', 'mail', 'email', 'smtp', 'ftp', 'imap',
    'webhook', 'webhooks', 'static', 'assets', 'cdn', 'img', 'js', 'css', 'docs', 'blog',
    'status', 'staging', 'dev', 'test', 'teste', 'demo', 'index', 'obrigado', 'localhost',
    'obrareal', 'obralegal', 'gestaodeobras', 'firebase', 'whatsapp', 'bot', 'pix',
    'financeiro', 'null', 'undefined'
  ]);

  /** Minúsculas, sem acento, só a-z e 0-9, no máximo MAX_LEN caracteres. */
  function normalizeSlug(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, MAX_LEN);
  }

  /** @returns {{ok: boolean, slug: string, error: string}} */
  function validateSlug(value) {
    const slug = normalizeSlug(value);
    if (!slug) return { ok: false, slug, error: 'Digite o endereço da sua empresa.' };
    if (slug.length < MIN_LEN) return { ok: false, slug, error: `Use pelo menos ${MIN_LEN} caracteres.` };
    if (RESERVED.has(slug)) return { ok: false, slug, error: 'Esse endereço é reservado. Escolha outro.' };
    return { ok: true, slug, error: '' };
  }

  /** Nome de empresa seguro para exibir: sem < >, sem caracteres de controle, espaços colapsados. */
  function cleanCompanyName(value) {
    return String(value == null ? '' : value)
      .replace(/[<>\u0000-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, NAME_MAX_LEN);
  }

  /** Sugestão inicial: nome da empresa; se vier curto/vazio, usa a parte local do e-mail. */
  function suggestSlug(companyName, email) {
    let base = normalizeSlug(companyName);
    if (base.length < MIN_LEN) base = normalizeSlug(String(email || '').split('@')[0]);
    if (base.length < MIN_LEN) base = (base + 'obras').slice(0, MAX_LEN);
    return base;
  }

  function isProductionHost(hostname) {
    const h = String(hostname || '').toLowerCase();
    return h === BASE_DOMAIN || h.endsWith('.' + BASE_DOMAIN);
  }

  /** Em produção o slug vira subdomínio, e subdomínio é outra origem (a sessão não acompanha). */
  function isCrossOrigin(slug, loc) {
    loc = loc || root.location;
    return isProductionHost(loc.hostname) && String(loc.hostname).toLowerCase() !== `${slug}.${BASE_DOMAIN}`;
  }

  /**
   * URL de entrada da empresa.
   *  - produção:  https://<slug>.obrareal.com/<path>
   *  - dev/staging (localhost, web.app...): mesma origem, com ?tenant=<slug> (o data_core já lê isso).
   */
  function buildTenantUrl(slug, loc, path, params) {
    loc = loc || root.location;
    path = path || 'app.html';
    const qs = new URLSearchParams(params || {});
    if (isProductionHost(loc.hostname)) {
      const q = qs.toString();
      return `https://${slug}.${BASE_DOMAIN}/${path}${q ? '?' + q : ''}`;
    }
    qs.set('tenant', slug);
    const dir = String(loc.pathname || '/').replace(/[^/]*$/, '');
    return `${loc.origin}${dir}${path}?${qs.toString()}`;
  }

  /** Página de login do subdomínio recém-criado, com o e-mail já preenchido. */
  function buildWelcomeUrl(slug, email, loc) {
    return buildTenantUrl(slug, loc, 'login.html', { bemvindo: '1', email: email || '' });
  }

  /**
   * Escritas da criação da conta, em um único update multi-path (tudo ou nada):
   *  - tenants/<slug>         -> o que o painel do Master lista
   *  - tenants_public/<slug>  -> leitura pública do tema antes do login (também reserva o slug)
   *  - users/<email>          -> passaporte global (origem: self_signup)
   * Os valores de plano/limites/status seguem exatamente o que as regras do banco exigem na criação.
   */
  function buildAccountUpdates(p) {
    const now = p.now || Date.now();
    const slug = p.slug;
    const email = String(p.email || '').trim().toLowerCase();
    const nomeEmpresa = cleanCompanyName(p.nomeEmpresa) || 'Minha Empresa';
    const sanitizedEmail = email.replace(/\./g, ',');

    const updates = {};
    updates[`tenants/${slug}`] = {
      nomeEmpresa,
      slug,
      subdominioSlug: slug,
      emailAdmin: email,
      status: 'ativo',
      plano: 'free_trial',
      webhookCriacao: now,
      trialExpiracao: now + TRIAL_MS,
      origem: 'self_signup',
      criadoPorUid: p.uid,
      config: {
        nomeEmpresa,
        slug,
        esquemaCores: 'emerald',
        limiteObras: 1,
        limiteUsuarios: 1,
        limiteTrabalhadores: 9999
      }
    };
    updates[`tenants_public/${slug}`] = {
      slug,
      tenantId: slug,
      nomeEmpresa,
      esquemaCores: 'emerald'
    };
    updates[`users/${sanitizedEmail}`] = {
      uid: p.uid,
      email,
      tenantId: slug,
      role: 'admin',
      nome: cleanCompanyName(p.nome) || nomeEmpresa,
      origem: 'self_signup'
    };
    return { updates, sanitizedEmail, nomeEmpresa };
  }

  async function isSlugTaken(db, slug) {
    // Leitura direta pela chave (o nó pai nunca é listado).
    const snap = await db.ref(`tenants_public/${slug}`).once('value');
    return snap.exists();
  }

  function isPermissionDenied(err) {
    return !!err && (err.code === 'PERMISSION_DENIED' || /permission[_ ]denied/i.test(String(err.message || '')));
  }

  /**
   * Cria a empresa. Rejeita com err.code:
   *  - 'slug/invalid': slug fora da regra
   *  - 'slug/taken':   alguém ficou com o endereço (inclusive numa corrida entre dois cadastros)
   * Qualquer outro erro do banco é repassado como veio.
   * @returns {Promise<{slug: string, nomeEmpresa: string}>}
   */
  async function createTenantAccount(db, params) {
    const v = validateSlug(params.slug);
    if (!v.ok) throw Object.assign(new Error(v.error), { code: 'slug/invalid' });

    const built = buildAccountUpdates({ ...params, slug: v.slug });
    try {
      await db.ref().update(built.updates);
    } catch (err) {
      // As regras só deixam criar quando o nó ainda não existe: negado + slug ocupado = perdeu a corrida.
      if (isPermissionDenied(err)) {
        let taken = false;
        try { taken = await isSlugTaken(db, v.slug); } catch (e) { /* mantém o erro original */ }
        if (taken) throw Object.assign(new Error('Endereço já em uso.'), { code: 'slug/taken' });
      }
      throw err;
    }
    return { slug: v.slug, nomeEmpresa: built.nomeEmpresa };
  }

  const api = {
    BASE_DOMAIN, MIN_LEN, MAX_LEN, NAME_MAX_LEN, RESERVED,
    normalizeSlug, validateSlug, cleanCompanyName, suggestSlug,
    isProductionHost, isCrossOrigin, buildTenantUrl, buildWelcomeUrl,
    buildAccountUpdates, isSlugTaken, createTenantAccount
  };

  root.ObraSlug = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
