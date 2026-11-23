// tests/security/rules.test.js
// Garante que os limites de plano não voltem a ser controlados só pelo cliente.
//
// Modelo de defesa:
//  1. Firebase Rules: metadados de plano/limites imutáveis para o tenant.
//  2. Cloud Functions (Admin SDK): enforcement da QUANTIDADE de obras/usuários,
//     pois o RTDB não suporta numChildren() nas rules.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const rules = JSON.parse(fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8'));
const tenantRules = rules.rules.tenants.$tenantId;
const functionsSrc = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
const authSrc = fs.readFileSync(path.join(root, 'public', 'js', 'auth_core.js'), 'utf8');
const slugSrc = fs.readFileSync(path.join(root, 'public', 'js', 'slug.js'), 'utf8');
const dataSrc = fs.readFileSync(path.join(root, 'public', 'js', 'data_core.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'public', 'js', 'app_core.js'), 'utf8');

describe('database.rules.json — proteção do paywall', () => {
  it('campos de plano são imutáveis para o tenant', () => {
    for (const field of ['plano', 'planoVencimento', 'trialExpiracao', 'status', 'emailAdmin', 'billingState']) {
      expect(tenantRules[field]?.['.validate']).toContain("=== 'super_admin'");
    }
  });

  it('nega leitura quando tenant estiver com billingState = bloqueado', () => {
    const readRule = tenantRules['.read'];
    expect(readRule).toContain("data.child('billingState').val() !== 'bloqueado'");
    expect(readRule).toContain("=== 'super_admin'");
  });

  it('nega escrita quando tenant estiver com billingState = somente_leitura ou bloqueado', () => {
    const writeRule = tenantRules['.write'];
    expect(writeRule).toContain("data.child('billingState').val() !== 'somente_leitura'");
    expect(writeRule).toContain("data.child('billingState').val() !== 'bloqueado'");
    expect(writeRule).toContain("=== 'super_admin'");
  });

  it('o campo billingState continua legível para exibir a tela de bloqueio', () => {
    // Sem esta exceção o .read negado no pai impede o front de saber que está bloqueado.
    const statusRule = tenantRules.billingState['.read'];
    expect(statusRule).toContain("auth != null");
    expect(statusRule).toContain("root.child('profiles/' + auth.uid + '/tenantId').val() === $tenantId");
    expect(statusRule).toContain("data.parent().child('emailAdmin').val() === auth.token.email");
  });

  it('subdomínio personalizado só pode ser alterado por Pro+ (slug inicial permitido)', () => {
    const validate = tenantRules.subdominioSlug?.['.validate'];
    expect(validate).toContain("newData.val() === $tenantId");
    expect(validate).toContain("data.parent().child('plano').val() === 'pro'");
    expect(validate).toContain("data.parent().child('plano').val() === 'ilimitado'");
    expect(tenantRules.config.slug['.validate']).toContain("newData.val() === $tenantId");
    expect(functionsSrc).toContain("hasFeature('subdominio', tenant.plano, tenant)");
  });

  it('billingState só pode ser escrito pelo servidor (admin SDK)', () => {
    const validate = tenantRules.billingState['.validate'];
    expect(validate).toContain("auth.token.role === 'super_admin'");
    expect(validate).toContain("auth.token.email === 'tonycampelo@gmail.com'");
    expect(validate).toMatch(/data\.exists\(\)\s*\?\s*newData\.val\(\)\s*===\s*data\.val\(\)/);
    expect(validate).toContain("newData.val() === 'ativo'");
  });

  it('tarefas_pendentes também respeita carência/somente leitura/bloqueio', () => {
    const tarefas = rules.rules.tarefas_pendentes.$tenantId;
    expect(tarefas['.read']).toContain("root.child('tenants/' + $tenantId + '/billingState').val() !== 'bloqueado'");
    expect(tarefas['.write']).toContain("root.child('tenants/' + $tenantId + '/billingState').val() !== 'somente_leitura'");
    expect(tarefas['.write']).toContain("root.child('tenants/' + $tenantId + '/billingState').val() !== 'bloqueado'");
  });

  it('estoque e canteiro respeitam o estado de cobrança', () => {
    const estoque = tenantRules.estoque;
    expect(estoque['.read']).toContain("data.parent().child('billingState').val() !== 'bloqueado'");
    expect(estoque['.write']).toContain("data.parent().child('billingState').val() !== 'somente_leitura'");
    const canteiro = estoque.canteiro.$obraId;
    expect(canteiro['.read']).toContain("data.parent().parent().child('billingState').val() !== 'bloqueado'");
    expect(canteiro['.write']).toContain("data.parent().parent().child('billingState').val() !== 'somente_leitura'");
  });

  it('limites do plano só podem ser alterados por super_admin', () => {
    for (const field of ['limiteObras', 'limiteUsuarios', 'limiteTrabalhadores']) {
      const validate = tenantRules.config[field]?.['.validate'];
      expect(validate).toContain("=== 'super_admin'");
      expect(validate).toMatch(/data\.exists\(\)\s*\?\s*newData\.val\(\)\s*===\s*data\.val\(\)/);
    }
  });

  it('status do perfil não pode ser auto-reativado pelo usuário', () => {
    const validate = rules.rules.profiles.$uid.status?.['.validate'];
    expect(validate).toContain("=== 'super_admin'");
    expect(validate).toMatch(/data\.exists\(\)\s*\?\s*newData\.val\(\)\s*===\s*data\.val\(\)/);
  });

  it('rules não usam numChildren() (método inexistente no RTDB)', () => {
    expect(JSON.stringify(rules)).not.toContain('numChildren');
  });

  it('todas as expressões têm parênteses/colchetes balanceados', () => {
    const erros = [];
    const visitar = (no, caminho = '') => {
      for (const [chave, valor] of Object.entries(no || {})) {
        const atual = caminho ? `${caminho}/${chave}` : chave;
        if (['.read', '.write', '.validate'].includes(chave) && typeof valor === 'string') {
          let p = 0, b = 0, c = 0;
          for (const ch of valor) {
            if (ch === '(') p++; else if (ch === ')') p--;
            else if (ch === '[') b++; else if (ch === ']') b--;
            else if (ch === '{') c++; else if (ch === '}') c--;
          }
          if (p || b || c) erros.push(`${atual}: ${p}/${b}/${c}`);
        }
        if (valor && typeof valor === 'object') visitar(valor, atual);
      }
    };
    visitar(rules.rules);
    expect(erros).toEqual([]);
  });
});

describe('database.rules.json — tenants_public sem enumeração', () => {
  const publicRules = rules.rules.tenants_public;

  it('o nó pai não pode ser listado (sem .read no pai)', () => {
    expect(publicRules['.read']).toBeUndefined();
    expect(publicRules['.indexOn']).toBeUndefined();
  });

  it('a leitura pública é apenas pela chave direta do slug', () => {
    expect(publicRules.$slug?.['.read']).toBe(true);
  });

  it('o slug é a chave e o tenantId é obrigatório', () => {
    const validate = publicRules.$slug?.['.validate'];
    expect(validate).toContain("newData.child('slug').val() === $slug");
    expect(validate).toContain("newData.child('tenantId').isString()");
  });

  it('escrita exige super_admin ou o próprio tenant', () => {
    const write = publicRules.$slug?.['.write'];
    expect(write).toContain("=== 'super_admin'");
    expect(write).toContain("profiles/' + auth.uid + '/tenantId");
  });

  it('o tenant não altera o subdomínio público quando está bloqueado ou em leitura', () => {
    const write = publicRules.$slug?.['.write'];
    expect(write).toContain("'/billingState').val() !== 'somente_leitura'");
    expect(write).toContain("'/billingState').val() !== 'bloqueado'");
  });

  it('o cliente nunca consulta tenants_public com orderByChild/equalTo', () => {
    const allSrc = [dataSrc, appSrc, authSrc].join('\n');
    expect(allSrc).not.toMatch(/tenants_public'\)\s*\.orderByChild|tenants_public[\s\S]{0,80}orderByChild\('slug'\)/);
  });

  it('escritas do nó público incluem tenantId', () => {
    // auto-cadastro (escolha do slug): a escrita mora em slug.js
    expect(slugSrc).toMatch(/tenants_public\/\$\{slug\}`\]\s*=\s*\{[\s\S]{0,160}tenantId:\s*slug/);
    expect(appSrc).toMatch(/tenants_public\/\$\{slugVal\}[\s\S]{0,160}tenantId:\s*slugVal/);
  });

  it('renomear o slug move o nó público para a nova chave', () => {
    expect(dataSrc).toMatch(/tenants_public\/\$\{oldSlug\}`\]\s*=\s*null/);
    expect(dataSrc).toMatch(/tenants_public\/\$\{newSlug\}`\]\s*=\s*\{/);
  });
});

describe('database.rules.json — logs de webhook', () => {
  it('webhook_debug é legível apenas por super_admin e não aceita escrita do cliente', () => {
    const debug = rules.rules.webhook_debug;
    expect(debug?.['.read']).toContain("=== 'super_admin'");
    expect(debug?.['.write']).toBe(false);
  });
});

describe('functions/index.js — enforcement de quantidade', () => {
  it('exporta os triggers de obras e usuários', () => {
    expect(functionsSrc).toMatch(/exports\.enforceObrasLimit\s*=\s*onValueWritten\(\s*"tenants\/\{tenantId\}\/obras"/);
    expect(functionsSrc).toMatch(/exports\.enforceUsuariosLimit\s*=\s*onValueWritten\(\s*"tenants\/\{tenantId\}\/usuarios"/);
  });

  it('exporta o job diário de cobrança (dailyBillingStateJob)', () => {
    expect(functionsSrc).toMatch(/exports\.dailyBillingStateJob\s*=\s*onSchedule\(/);
    expect(functionsSrc).toContain('atualizarBillingStatesJob');
  });

  it('lê o limite do tenant (campo protegido pelas rules)', () => {
    expect(functionsSrc).toContain('config/${campo}');
    expect(functionsSrc).toContain('limiteObras');
    expect(functionsSrc).toContain('limiteUsuarios');
  });

  it('reverte crescimento acima do limite sem apagar registros legados', () => {
    expect(functionsSrc).toContain('reverterCrescimentoAcimaDoLimite');
    expect(functionsSrc).toMatch(/transaction\(/);
    expect(functionsSrc).toContain('contarFilhos(beforeVal) === 0');
  });

  it('não trata limite ausente como 0 (Number(null) === 0)', () => {
    expect(functionsSrc).toContain('LIMITE_FALLBACK');
    expect(functionsSrc).toMatch(/n <= 0\)\s*return LIMITE_FALLBACK/);
  });

  it('marca perfis acima do limite como pendentes em vez de excluir', () => {
    expect(functionsSrc).toContain('aplicarLimiteDeAssentos');
    expect(functionsSrc).toMatch(/profiles\/\$\{uid\}\/status.*set\('pendente'\)/);
  });
});

describe('auth_core.js — o login não desfaz a trava', () => {
  it('o touch de lastLogin não reescreve role/tenantId', () => {
    const touch = authSrc.match(/profileRef\.update\(\{[^}]*lastLogin[^}]*\}\)/g) || [];
    expect(touch.length).toBeGreaterThan(0);
    for (const snippet of touch) {
      expect(snippet).not.toContain('role');
      expect(snippet).not.toContain('tenantId');
    }
  });

  it('bloqueia login de perfil pendente', () => {
    expect(authSrc).toContain("status === 'pendente'");
  });
});

describe('bloqueio no servidor — integração front-end', () => {
  const appHtml = fs.readFileSync(path.join(root, 'public', 'app.html'), 'utf8');

  it('a tela de bloqueio substitui o alert + logout', () => {
    expect(appHtml).toContain('id="screen-blocked"');
    expect(appHtml).toContain("startKiwifyCheckout('start')");
    expect(appHtml).toContain("startKiwifyCheckout('pro')");

    const handler = dataSrc.slice(
      dataSrc.indexOf('function _onFirebaseValue'),
      dataSrc.indexOf('function processCloudUpdate')
    );
    expect(handler).toContain('renderBillingEnforcement(data)');
    expect(handler).not.toContain('alert(');
    expect(handler).not.toContain('doLogout()');
  });

  it('lê billingState isoladamente mesmo quando o nó do tenant é negado', () => {
    expect(dataSrc).toContain("firebase.database().ref('tenants/' + tenantId + '/billingState')");
    expect(dataSrc).toContain('function _onBillingStateValue');
    expect(dataSrc).toContain('billingStateRef.off(\'value\')');
  });

  it('não reenvia metadados de cobrança no update do cliente', () => {
    const bloco = dataSrc.slice(
      dataSrc.indexOf('const PROTECTED_TENANT_FIELDS'),
      dataSrc.indexOf('const PROTECTED_CONFIG_FIELDS')
    );
    for (const campo of ['billingState', 'billingStateMotivo', 'carenciaAte', 'status', 'planoVencimento']) {
      expect(bloco).toContain(`'${campo}'`);
    }
  });

  it('o banner de cobrança sobrevive à troca de página', () => {
    const showPage = appSrc.slice(appSrc.indexOf('window.showPage'), appSrc.indexOf('function renderPage'));
    expect(showPage).toContain("#billing-banner-container");
    expect(showPage).toContain('bannerHtml');
  });

  it('o job roda diariamente no fuso do Brasil', () => {
    const job = functionsSrc.slice(functionsSrc.indexOf('exports.dailyBillingStateJob'));
    expect(job).toContain('onSchedule(');
    expect(job).toContain('America/Sao_Paulo');
    expect(job).toContain('atualizarBillingStatesJob(admin.database())');
  });

  it('os checks do navegador são apenas UX, não autoridade', () => {
    expect(dataSrc).toContain('apenas experiência de uso');
    expect(dataSrc).toContain('IS_READONLY_MODE');
    expect(dataSrc).toContain('as regras do servidor barram no backend');
  });
});

// ==================== FASE 3 — PAPÉIS ====================
const TOK = {
  admin: "auth.token.role === 'admin'",
  superAdmin: "auth.token.role === 'super_admin'",
  encarregado: "auth.token.role === 'encarregado'",
  mestre: "auth.token.role === 'mestre'",
  engenheiro: "auth.token.role === 'engenheiro'",
  comprador: "auth.token.role === 'comprador'"
};
const naoContem = (rule, ...papeis) => papeis.forEach(p => expect(rule).not.toContain(TOK[p]));
const contem = (rule, ...papeis) => papeis.forEach(p => expect(rule).toContain(TOK[p]));

describe('database.rules.json — matriz de papéis no tenant', () => {
  it('a escrita no tenant deixa de ser放行 para qualquer membro', () => {
    const write = tenantRules['.write'];
    contem(write, 'admin', 'superAdmin');
    expect(write).toContain("root.child('profiles/' + auth.uid + '/tenantId').val() === $tenantId");
    // Não basta checar tenantId/billing: o papel precisa aparecer na decisão.
    expect(write).toContain("root.child('profiles/' + auth.uid + '/role').val() === 'admin'");
    expect(write).toContain("root.child('tenants/' + $tenantId + '/emailAdmin').val() === auth.token.email");
  });

  it('registro de obra (ponto, fotos/tarefas e almoços) é escrita direta dos dois papéis', () => {
    ['presenca', 'tarefas', 'almocos'].forEach(no => {
      const write = tenantRules[no]?.['.write'];
      expect(write, `no ${no}`).toBeDefined();
      contem(write, 'encarregado', 'mestre', 'engenheiro');
    });
    // Fotos vivem em medicao.photos/photoUrl e podem ser anexadas pelo encarregado
    // sem dar a ele acesso aos valores financeiros da medição.
    contem(tenantRules.medicao.$itemId.photos['.write'], 'encarregado', 'mestre');
    contem(tenantRules.medicao.$itemId.photoUrl['.write'], 'encarregado', 'mestre');
  });

  it('encarregado não escreve em estoque, trabalhadores, usuários, financeiro, orçamento, compras, medição ou config', () => {
    ['estoque', 'movEstoque', 'trabalhadores', 'usuarios', 'financeiro',
      'orcamento', 'compras', 'medicao', 'config'].forEach(no => {
      const write = tenantRules[no]?.['.write'];
      expect(write, `no ${no}`).toBeDefined();
      naoContem(write, 'encarregado', 'mestre');
    });
  });

  it('engenheiro não escreve em estoque, movimentação, trabalhadores, usuários, financeiro, orçamento ou config', () => {
    ['estoque', 'movEstoque', 'trabalhadores', 'usuarios', 'financeiro', 'orcamento', 'config']
      .forEach(no => naoContem(tenantRules[no]['.write'], 'engenheiro'));
  });

  it('engenheiro escreve obras/rascunho de medição, mas não compras', () => {
    contem(tenantRules.obras['.write'], 'engenheiro');
    contem(tenantRules.medicao['.write'], 'engenheiro');
    naoContem(tenantRules.compras['.write'], 'engenheiro', 'encarregado', 'mestre');
    contem(tenantRules.compras['.write'], 'comprador');
  });

  it('canteiro e estoque continuam respeitando cobrança e agora exigem papel', () => {
    const estoqueWrite = tenantRules.estoque['.write'];
    expect(estoqueWrite).toContain("data.parent().child('billingState').val() !== 'somente_leitura'");
    naoContem(estoqueWrite, 'encarregado', 'mestre', 'engenheiro');
    contem(estoqueWrite, 'comprador');
    const canteiroWrite = tenantRules.estoque.canteiro.$obraId['.write'];
    expect(canteiroWrite).toContain("data.parent().parent().child('billingState').val() !== 'somente_leitura'");
    naoContem(canteiroWrite, 'encarregado', 'mestre', 'engenheiro');
  });
});

describe('database.rules.json — aprovacoes', () => {
  const aprov = tenantRules.aprovacoes;
  const write = aprov.$id['.write'];

  it('criação só com status pendente, solicitante autenticado e payload íntegro', () => {
    expect(write).toContain("newData.child('status').val() === 'pendente'");
    expect(write).toContain("newData.child('solicitadoPor').val() === auth.uid");
    expect(write).toContain("newData.child('payload').exists()");
    expect(write).toContain('+ 1296000000'); // 15 dias
    expect(write).toContain("!newData.child('alertas').exists()");
    expect(write).toContain("!newData.child('expiradoEm').exists()");
    expect(write).toContain("!newData.child('aplicadoEm').exists()");
  });

  it('cada papel só cria os tipos da sua matriz', () => {
    expect(write).toContain("newData.child('tipo').val() === 'trabalhador_add'");
    expect(write).toContain("newData.child('tipo').val() === 'financeiro_lancamento'");
    expect(write).toContain("newData.child('tipo').val() === 'compra_criacao'");
    expect(write).toContain("newData.child('tipo').val() === 'medicao_fechamento'");
    // O bloco do encarregado vem antes do bloco do engenheiro. Isolando-o,
    // ele só pode criar os 3 tipos de material/trabalhador.
    const inicioEng = write.indexOf("(auth.token.role === 'engenheiro' ||");
    expect(inicioEng).toBeGreaterThan(0);
    const criacaoEnc = write.slice(0, inicioEng);
    expect(criacaoEnc).toContain("newData.child('tipo').val() === 'trabalhador_remove'");
    expect(criacaoEnc).not.toContain("newData.child('tipo').val() === 'financeiro_status'");
  });

  it('admin decide qualquer tipo; engenheiro só movimentacao_estoque e avisa o admin', () => {
    expect(write).toContain("newData.child('decididoPorPapel').val() === 'admin'");
    expect(write).toContain("newData.child('decididoPorPapel').val() === 'engenheiro'");
    expect(write).toContain("data.child('tipo').val() === 'movimentacao_estoque'");
    expect(write).toContain("newData.child('notificarAdmin').val() === true");
    expect(write).toContain("newData.child('decididoPor').val() === auth.uid");
    expect(write).toContain("data.child('status').val() === 'pendente'");
    expect(write).toContain('now < data.child(\'expiraEm\').val()');
  });

  it('payload e metadados são imutáveis; expiração/alertas pertencem ao servidor', () => {
    expect(write).toContain("newData.child('payload').val() === data.child('payload').val()");
    expect(write).toContain("newData.child('alertas').val() === data.child('alertas').val()");
    expect(write).toContain("!newData.child('expiradoEm').exists()");
    expect(write).toContain("!newData.child('aplicadoEm').exists()");
    expect(write).toContain("newData.child('status').val() !== 'rejeitado' || newData.child('motivo').isString()");
    expect(aprov['.write']).toBe(false);
    expect(aprov['.indexOn']).toEqual(expect.arrayContaining(['status', 'solicitadoPor', 'tipo']));
  });

  it('o nó vira somente leitura para cliente após a decisão', () => {
    // A transição só sai de 'pendente'; status 'expirado'/'erro' são escritos pelo Admin SDK.
    expect(write).toContain("data.child('status').val() === 'pendente'");
    expect(write).toContain("newData.child('status').val() === 'aprovado' || newData.child('status').val() === 'rejeitado'");
  });
});

describe('database.rules.json — nós sensíveis fora do tenant', () => {
  it('não ficam dentro do tenant (onde o .read do pai daria acesso a todos)', () => {
    expect(tenantRules.comprasPrivadas).toBeUndefined();
    expect(tenantRules.auditoria).toBeUndefined();
    expect(tenantRules.notificacoes).toBeUndefined();
  });

  it('comprasPrivadas só para admin/comprador do próprio tenant', () => {
    const no = rules.rules.comprasPrivadas.$tenantId;
    contem(no['.read'], 'admin', 'comprador');
    naoContem(no['.read'], 'encarregado', 'mestre', 'engenheiro');
    contem(no['.write'], 'admin', 'comprador');
    expect(no['.write']).toContain("'/billingState').val() !== 'somente_leitura'");
  });

  it('auditoria é append-only e legível só por admin', () => {
    const no = rules.rules.auditoria.$tenantId;
    expect(no['.write']).toBe(false);
    contem(no['.read'], 'admin');
    naoContem(no['.read'], 'encarregado', 'mestre', 'engenheiro', 'comprador');
  });

  it('notificações são append-only e indexadas por destinatário', () => {
    // Se ficassem em notificacoes/{tenantId}/{id} com um mapa destinatarios,
    // a rules do pai precisaria liberar leitura para todos do tenant.
    const no = rules.rules.notificacoes.$tenantId.$uid;
    expect(rules.rules.notificacoes.$tenantId['.read']).toBeUndefined();
    expect(no['.write']).toBe(false);
    expect(no['.read']).toContain('auth.uid === $uid');
    expect(no['.read']).toContain("root.child('profiles/' + auth.uid + '/tenantId').val() === $tenantId");
    expect(no['.indexOn']).toContain('criadoEm');
  });
});
