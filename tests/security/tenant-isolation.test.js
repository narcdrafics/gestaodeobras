// Isolamento entre empresas — regras do RTDB e do Storage.
// Os testes abaixo EXECUTAM as expressões lidas de database.rules.json com
// snapshots falsos, em vez de apenas conferir strings. Assim uma regressão
// que reabra o acesso cruzado entre tenants quebra a suíte.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const rules = JSON.parse(read('database.rules.json')).rules;

/** Snapshot mínimo compatível com o subconjunto usado nas rules do RTDB. */
class Snap {
  constructor(raiz, caminho = []) {
    this.raiz = raiz;
    this.caminho = caminho;
  }

  get valor() {
    return this.caminho.reduce((atual, chave) => (atual == null ? null : atual[chave]), this.raiz);
  }

  child(caminho) {
    return new Snap(this.raiz, [...this.caminho, ...String(caminho).split('/').filter(Boolean)]);
  }

  parent() {
    return new Snap(this.raiz, this.caminho.slice(0, -1));
  }

  val() {
    const valor = this.valor;
    return valor === undefined ? null : valor;
  }

  exists() {
    const valor = this.valor;
    return valor !== null && valor !== undefined;
  }

  isString() { return typeof this.valor === 'string'; }
  isNumber() { return typeof this.valor === 'number'; }
  isBoolean() { return typeof this.valor === 'boolean'; }
  hasChildren(chaves) {
    const valor = this.valor;
    return valor != null && chaves.every((chave) => valor[chave] !== undefined);
  }
}

function avaliar(expr, { estado, novoEstado, caminho = [], auth, vars = {} }) {
  const nomes = ['auth', 'root', 'data', 'newData', 'now', ...Object.keys(vars)];
  const valores = [
    auth,
    new Snap(estado),
    new Snap(estado, caminho),
    new Snap(novoEstado || estado, caminho),
    Date.now(),
    ...Object.values(vars)
  ];
  // eslint-disable-next-line no-new-func
  return Function(...nomes, `"use strict"; return (${expr});`)(...valores);
}

function authDe({ uid, email, role, tenantId }) {
  return { uid, token: { uid, email, role, tenantId } };
}

function estadoBase() {
  return {
    profiles: {
      adminA: { uid: 'adminA', email: 'adminA@a.com', role: 'admin', tenantId: 'tenantA', status: 'ativo' },
      adminB: { uid: 'adminB', email: 'adminB@b.com', role: 'admin', tenantId: 'tenantB', status: 'ativo' },
      membroA: { uid: 'membroA', email: 'membro@a.com', role: 'engenheiro', tenantId: 'tenantA', status: 'ativo' },
      master: { uid: 'master', email: 'tonycampelo@gmail.com', role: 'super_admin', tenantId: 'MASTER_SYSTEM', status: 'ativo' },
      masterUid2: { uid: 'masterUid2', email: 'master2@b.com', role: 'admin', tenantId: 'tenantC', status: 'ativo' }
    },
    super_admins: {
      masterUid2: { uid: 'masterUid2', email: 'master2@b.com', role: 'super_admin' }
    },
    users: {
      'adminA@a,com': { uid: 'adminA', email: 'adminA@a.com', role: 'admin', tenantId: 'tenantA' },
      'vitima@b,com': { uid: 'vitimaB', email: 'vitima@b.com', role: 'engenheiro', tenantId: 'tenantB' },
      'legado@b,com': { uid: 'legadoB', email: 'legado@b.com', role: 'super_admin', tenantId: 'tenantB' }
    },
    invites: {
      'convidado@a,com': { email: 'convidado@a.com', tenantId: 'tenantA', role: 'engenheiro' },
      'convidado@b,com': { email: 'convidado@b.com', tenantId: 'tenantB', role: 'engenheiro' }
    },
    tenants: {
      tenantA: { emailAdmin: 'adminA@a.com', billingState: 'ativo' },
      tenantB: { emailAdmin: 'adminB@b.com', billingState: 'ativo' }
    },
    tenants_public: {
      sluga: { slug: 'sluga', tenantId: 'tenantA' },
      slugb: { slug: 'slugb', tenantId: 'tenantB' }
    },
    admin_audit: {}
  };
}

const adminA = () => authDe({ uid: 'adminA', email: 'adminA@a.com', role: 'admin', tenantId: 'tenantA' });
const adminB = () => authDe({ uid: 'adminB', email: 'adminB@b.com', role: 'admin', tenantId: 'tenantB' });
const membroA = () => authDe({ uid: 'membroA', email: 'membro@a.com', role: 'engenheiro', tenantId: 'tenantA' });
const master = () => authDe({ uid: 'master', email: 'tonycampelo@gmail.com', role: 'super_admin', tenantId: 'MASTER_SYSTEM' });
const allowlist = () => authDe({ uid: 'masterUid2', email: 'master2@b.com', role: 'admin', tenantId: 'tenantC' });

describe('isolamento — leitura de users/<email>', () => {
  const regra = rules.users.$email['.read'];
  const ctx = (auth) => ({ estado: estadoBase(), auth, caminho: ['users', 'vitima@b,com'], vars: { $email: 'vitima@b,com' } });

  it('usuário comum de outra empresa não lê o passaporte global', () => {
    expect(avaliar(regra, ctx(membroA()))).toBe(false);
  });

  it('o próprio usuário lê seu passaporte, ainda que o nó não tenha uid', () => {
    const semUid = estadoBase();
    delete semUid.users['vitima@b,com'].uid;
    const auth = authDe({ uid: 'vitimaB', email: 'vitima@b.com', role: 'engenheiro', tenantId: 'tenantB' });
    expect(avaliar(regra, { ...ctx(auth), estado: semUid })).toBe(true);
  });

  it('master por allowlist ou e-mail mestre lê qualquer passaporte', () => {
    expect(avaliar(regra, ctx(allowlist()))).toBe(true);
    expect(avaliar(regra, ctx(master()))).toBe(true);
  });
});

describe('isolamento — convites', () => {
  const leitura = rules.invites.$email['.read'];
  const escrita = rules.invites.$email['.write'];
  const tenantValidate = rules.invites.$email.tenantId['.validate'];
  const emailValidate = rules.invites.$email.email['.validate'];

  it('admin de outra empresa não lê convite alheio', () => {
    const ctx = (auth) => ({ estado: estadoBase(), auth, caminho: ['invites', 'convidado@b,com'], vars: { $email: 'convidado@b,com' } });
    expect(avaliar(leitura, ctx(adminA()))).toBe(false);
    expect(avaliar(leitura, ctx(adminB()))).toBe(true);
    expect(avaliar(leitura, ctx(master()))).toBe(true);
  });

  it('admin não convida para outra empresa, mesmo com a chave de e-mail certa', () => {
    const estado = estadoBase();
    const novo = JSON.parse(JSON.stringify(estado));
    novo.invites['novo@b,com'] = { email: 'novo@b.com', tenantId: 'tenantB', role: 'engenheiro' };
    const base = {
      estado,
      novoEstado: novo,
      auth: adminA(),
      caminho: ['invites', 'novo@b,com'],
      vars: { $email: 'novo@b,com' }
    };
    expect(avaliar(escrita, base)).toBe(false);
    expect(avaliar(tenantValidate, { ...base, caminho: ['invites', 'novo@b,com', 'tenantId'] })).toBe(false);
  });

  it('admin convida para o próprio tenant', () => {
    const estado = estadoBase();
    const novo = JSON.parse(JSON.stringify(estado));
    novo.invites['novo@a,com'] = { email: 'novo@a.com', tenantId: 'tenantA', role: 'engenheiro' };
    const base = {
      estado,
      novoEstado: novo,
      auth: adminA(),
      caminho: ['invites', 'novo@a,com'],
      vars: { $email: 'novo@a,com' }
    };
    expect(avaliar(escrita, base)).toBe(true);
    expect(avaliar(emailValidate, { ...base, caminho: ['invites', 'novo@a,com', 'email'] })).toBe(true);
    expect(avaliar(tenantValidate, { ...base, caminho: ['invites', 'novo@a,com', 'tenantId'] })).toBe(true);
  });

  it('membro comum não se auto-convida para ganhar cargo de admin', () => {
    const estado = estadoBase();
    const novo = JSON.parse(JSON.stringify(estado));
    novo.invites['membro@a,com'] = { email: 'membro@a.com', tenantId: 'tenantA', role: 'admin' };
    expect(avaliar(escrita, {
      estado,
      novoEstado: novo,
      auth: membroA(),
      caminho: ['invites', 'membro@a,com'],
      vars: { $email: 'membro@a,com' }
    })).toBe(false);
  });

  it('admin não apaga convite de outro tenant; o destinatário pode apagar o seu', () => {
    const estado = estadoBase();
    const novo = JSON.parse(JSON.stringify(estado));
    delete novo.invites['convidado@b,com'];
    const base = (auth) => ({
      estado,
      novoEstado: novo,
      auth,
      caminho: ['invites', 'convidado@b,com'],
      vars: { $email: 'convidado@b,com' }
    });
    expect(avaliar(escrita, base(adminA()))).toBe(false);
    expect(avaliar(escrita, base(adminB()))).toBe(true);
    expect(avaliar(escrita, base(authDe({ uid: 'convidadoB', email: 'convidado@b.com', role: 'engenheiro', tenantId: 'tenantB' })))).toBe(true);
  });
});

describe('isolamento — slug público', () => {
  const escrita = rules.tenants_public.$slug['.write'];
  const tenantValidate = rules.tenants_public.$slug.tenantId['.validate'];

  it('admin de A não sequestra o slug de B', () => {
    const estado = estadoBase();
    const novo = JSON.parse(JSON.stringify(estado));
    novo.tenants_public.slugb = { slug: 'slugb', tenantId: 'tenantA' };
    const base = { estado, novoEstado: novo, auth: adminA(), caminho: ['tenants_public', 'slugb'], vars: { $slug: 'slugb' } };
    expect(avaliar(escrita, base)).toBe(false);
    expect(avaliar(tenantValidate, { ...base, caminho: ['tenants_public', 'slugb', 'tenantId'] })).toBe(false);
  });

  it('admin altera apenas o slug do próprio tenant; master pode qualquer um', () => {
    const estado = estadoBase();
    const novo = JSON.parse(JSON.stringify(estado));
    novo.tenants_public.sluga.logoUrl = 'nova-logo.png';
    const base = { estado, novoEstado: novo, caminho: ['tenants_public', 'sluga'], vars: { $slug: 'sluga' } };
    expect(avaliar(escrita, { ...base, auth: adminA() })).toBe(true);
    expect(avaliar(escrita, { ...base, auth: adminB() })).toBe(false);
    expect(avaliar(escrita, { ...base, auth: master() })).toBe(true);
  });
});

// O auto-cadastro (slug_onboarding) ainda precisa funcionar depois do hardening.
// A exceção de self_signup é avaliada aqui com o estado que RESULTÁ do update
// multi-path: newData.parent() enxerga os irmãos escritos na mesma operação.
describe('auto-cadastro — primeira empresa via slug', () => {
  const email = 'nova@empresa.com';
  const chaveEmail = 'nova@empresa,com';
  const slug = 'novaempresa';
  const uid = 'novoUid';
  const vars = { $tenantId: slug, $slug: slug, $email: chaveEmail, $uid: uid };
  const novoUsuario = () => authDe({ uid, email, role: undefined, tenantId: undefined });

  function cenario() {
    const estado = estadoBase();
    const novo = JSON.parse(JSON.stringify(estado));
    const agora = Date.now();
    novo.tenants[slug] = {
      nomeEmpresa: 'Nova Empresa',
      slug,
      subdominioSlug: slug,
      emailAdmin: email,
      status: 'ativo',
      plano: 'free_trial',
      webhookCriacao: agora,
      trialExpiracao: agora + 30 * 24 * 60 * 60 * 1000,
      origem: 'self_signup',
      criadoPorUid: uid,
      config: {
        nomeEmpresa: 'Nova Empresa',
        slug,
        esquemaCores: 'emerald',
        limiteObras: 1,
        limiteUsuarios: 1,
        limiteTrabalhadores: 9999
      }
    };
    novo.tenants_public[slug] = { slug, tenantId: slug, nomeEmpresa: 'Nova Empresa', esquemaCores: 'emerald' };
    novo.users[chaveEmail] = {
      uid, email, tenantId: slug, role: 'admin', nome: 'Nova Empresa', origem: 'self_signup'
    };
    return { estado, novo };
  }

  function avaliarRegra(regra, caminho, opcoes = {}) {
    const { estado, novo } = cenario();
    return avaliar(regra, {
      estado,
      novoEstado: opcoes.novoEstado || novo,
      auth: opcoes.auth || novoUsuario(),
      caminho,
      vars
    });
  }

  it('o novo usuário cria tenant, nó público e passaporte na mesma escrita atômica', () => {
    expect(avaliarRegra(rules.tenants.$tenantId['.write'], ['tenants', slug])).toBe(true);
    expect(avaliarRegra(rules.tenants.$tenantId.config['.write'], ['tenants', slug, 'config'])).toBe(true);
    expect(avaliarRegra(rules.tenants_public.$slug['.write'], ['tenants_public', slug])).toBe(true);
    expect(avaliarRegra(rules.tenants_public.$slug.tenantId['.validate'], ['tenants_public', slug, 'tenantId'])).toBe(true);
    expect(avaliarRegra(rules.users.$email['.write'], ['users', chaveEmail])).toBe(true);
    expect(avaliarRegra(rules.users.$email.tenantId['.validate'], ['users', chaveEmail, 'tenantId'])).toBe(true);
  });

  it('o perfil é criado depois, casando com o passaporte recém-gravado', () => {
    const { novo } = cenario();
    novo.profiles[uid] = { uid, email, tenantId: slug, role: 'admin', name: 'Nova Empresa', status: 'ativo' };
    const base = { estado: novo, novoEstado: novo, auth: novoUsuario(), vars };
    expect(avaliar(rules.profiles.$uid['.write'], { ...base, caminho: ['profiles', uid] })).toBe(true);
    expect(avaliar(rules.profiles.$uid.tenantId['.validate'], { ...base, caminho: ['profiles', uid, 'tenantId'] })).toBe(true);
  });

  it('outro usuário não cria a empresa em nome do dono do e-mail', () => {
    const atacante = authDe({ uid: 'atacante', email: 'atacante@x.com', role: undefined, tenantId: undefined });
    expect(avaliarRegra(rules.tenants.$tenantId['.write'], ['tenants', slug], { auth: atacante })).toBe(false);
    expect(avaliarRegra(rules.tenants_public.$slug['.write'], ['tenants_public', slug], { auth: atacante })).toBe(false);
    expect(avaliarRegra(rules.users.$email['.write'], ['users', chaveEmail], { auth: atacante })).toBe(false);
  });

  it('a exceção não permite sobrescrever tenant ou slug já existente', () => {
    const existente = estadoBase();
    existente.tenants.sluga = { emailAdmin: 'adminA@a.com', origem: 'master', billingState: 'ativo' };
    const novo = JSON.parse(JSON.stringify(existente));
    novo.tenants.sluga = { emailAdmin: email, origem: 'self_signup', billingState: 'ativo' };
    novo.tenants_public.sluga = { slug: 'sluga', tenantId: 'tenantA' };
    const base = {
      estado: existente,
      novoEstado: novo,
      auth: novoUsuario(),
      vars: { $tenantId: 'sluga', $slug: 'sluga' }
    };
    expect(avaliar(rules.tenants.$tenantId['.write'], { ...base, caminho: ['tenants', 'sluga'] })).toBe(false);
    expect(avaliar(rules.tenants_public.$slug['.write'], { ...base, caminho: ['tenants_public', 'sluga'] })).toBe(false);
  });
});

describe('isolamento — nós por tenant', () => {
  const casos = [
    ['tenants.$tenantId.read', rules.tenants.$tenantId['.read'], 'tenantB'],
    ['tenants.$tenantId.write', rules.tenants.$tenantId['.write'], 'tenantB'],
    ['comprasPrivadas.read', rules.comprasPrivadas.$tenantId['.read'], 'tenantB'],
    ['auditoria.read', rules.auditoria.$tenantId['.read'], 'tenantB'],
    ['tarefas_pendentes.read', rules.tarefas_pendentes.$tenantId['.read'], 'tenantB'],
    ['notificacoes.read', rules.notificacoes.$tenantId.$uid['.read'], 'tenantB']
  ];

  for (const [nome, regra, tenant] of casos) {
    it(`${nome}: admin de A não acessa B`, () => {
      const vars = { $tenantId: tenant, $uid: 'vitimaB' };
      expect(avaliar(regra, { estado: estadoBase(), auth: adminA(), vars })).toBe(false);
      expect(avaliar(regra, { estado: estadoBase(), auth: adminB(), vars })).not.toBe(false);
    });
  }

  it('admin não cria tenant em nome de outra pessoa', () => {
    const estado = estadoBase();
    const novo = JSON.parse(JSON.stringify(estado));
    novo.tenants.tenantC = { emailAdmin: 'adminB@b.com', billingState: 'ativo' };
    const base = { estado, auth: adminA(), caminho: ['tenants', 'tenantC'], vars: { $tenantId: 'tenantC' } };
    expect(avaliar(rules.tenants.$tenantId['.write'], { ...base, novoEstado: novo })).toBe(false);

    novo.tenants.tenantC.emailAdmin = 'adminA@a.com';
    expect(avaliar(rules.tenants.$tenantId['.write'], { ...base, novoEstado: novo })).toBe(true);
  });

  it('a leitura de estoque do tenant B é negada a membro de A', () => {
    const estado = estadoBase();
    estado.tenants.tenantB.estoque = { item: 1 };
    expect(avaliar(rules.tenants.$tenantId.estoque['.read'], {
      estado,
      auth: membroA(),
      caminho: ['tenants', 'tenantB', 'estoque'],
      vars: { $tenantId: 'tenantB' }
    })).toBe(false);
  });
});

describe('isolamento — auditoria global', () => {
  const regra = rules.admin_audit['.read'];
  const ctx = (auth) => ({ estado: estadoBase(), auth });

  it('passaporte legado com role super_admin não autoriza leitura', () => {
    expect(avaliar(regra, ctx(authDe({ uid: 'legadoB', email: 'legado@b.com', role: 'engenheiro', tenantId: 'tenantB' })))).toBe(false);
  });

  it('allowlist canônica autoriza leitura', () => {
    expect(avaliar(regra, ctx(allowlist()))).toBe(true);
  });
});

describe('painel Master — primeiro acesso sem leitura privada', () => {
  const adminLogin = read('public/admin-login.html');
  const auth = read('public/js/auth_core.js');

  it('não consulta users/<email> antes de autenticar', () => {
    expect(adminLogin).not.toMatch(/ref\(`users\/\$\{sanitized\}`\)/);
    expect(adminLogin).toContain('window._adminLoginGuard = true');
  });

  it('a decisão final usa a claim de super_admin e encerra a sessão sem autoridade', () => {
    expect(auth).toContain('if (window._adminLoginGuard)');
    expect(auth).toContain("userProfile.role !== 'super_admin'");
    expect(auth).toContain('await firebase.auth().signOut()');
  });
});

describe('Storage — isolamento por tenant', () => {
  const storage = read('storage.rules');
  const app = read('public/js/app_core.js');

  it('exige claims de tenant e papel conhecido no mesmo caminho', () => {
    expect(storage).toContain('request.auth.token.tenantId == tenantId');
    expect(storage).toContain("request.auth.token.role == 'admin'");
    expect(storage).not.toMatch(/membroTenant\(tenantId\)[\s\S]{0,80}tenantId\s*==\s*request\.auth/);
  });

  it('master precisa da claim MASTER_SYSTEM emitida pelo servidor', () => {
    expect(storage).toContain("request.auth.token.role == 'super_admin'");
    expect(storage).toContain("request.auth.token.tenantId == 'MASTER_SYSTEM'");
  });

  it('limita tamanho e tipo de arquivo e mantém fallback negado', () => {
    expect(storage).toContain('request.resource.size <= 10 * 1024 * 1024');
    expect(storage).toContain("request.resource.contentType.matches('image/.*')");
    expect(storage).toContain("match /{allPaths=**}");
    expect(storage).toContain('allow read, write: if false;');
    expect(storage).not.toContain('allow read, write: if true');
  });

  it('o upload do cliente usa exatamente o prefixo protegido', () => {
    expect(app).toContain('`tenants/${tid}/evidencias/${fileName}`');
    expect(storage).toContain('match /tenants/{tenantId}/{allPaths=**}');
  });
});
