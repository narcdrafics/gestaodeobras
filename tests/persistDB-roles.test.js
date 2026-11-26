// tests/persistDB-roles.test.js
// A segurança não pode depender só de esconder botão: o update em lote precisa
// sair do cliente já filtrado pelo papel, e o backup local não pode guardar
// dados comerciais de compras para quem não pode vê-los.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const dataSrc = fs.readFileSync(path.join(process.cwd(), 'public/js/data_core.js'), 'utf8');

// Helpers puros (protected fields + filtro por papel)
const helpersSrc = dataSrc.slice(
  dataSrc.indexOf('const PROTECTED_TENANT_FIELDS'),
  dataSrc.indexOf('function persistDB(')
);
const helpers = new Function(
  '_getBillingSessionUser',
  `${helpersSrc}\nreturn {
    buildCloudUpdate, sanitizeComprasForRole, ROLE_WRITE_ALLOW,
    COMPRAS_SENSITIVE_FIELDS, COMPRAS_RESTRICTED_ROLES,
    _sessionRole, _nodeBloqueadoParaRole
  };`
)(() => ({}));

// persistDB isolado, com Firebase/storage/sessão mockados
const persistSrc = dataSrc.slice(
  dataSrc.indexOf('function persistDB('),
  dataSrc.indexOf('function _religarListener(')
);

function makeDB() {
  return {
    plano: 'pro',
    billingState: 'ativo',
    config: { nomeEmpresa: 'Obra Real', limiteObras: 1, limiteUsuarios: 1 },
    obras: [{ cod: 'T1' }],
    presenca: [{ cod: 'P1' }],
    tarefas: [{ cod: 'TF1' }],
    almocos: [{ cod: 'A1' }],
    trabalhadores: [{ cod: 'TR1' }],
    estoque: [{ cod: 'E1' }],
    movEstoque: [{ cod: 'M1' }],
    compras: [{
      num: 'CP1', mat: 'Cimento', qtd: 10, unid: 'sc',
      forn: 'Fornecedor Secreto', pixkey: 'chave-pix',
      vunit: 32, vtotal: 320, vorc: 350, prazo: '2026-12-01'
    }],
    financeiro: [{ cod: 'F1' }],
    orcamento: [{ cod: 'O1' }],
    medicao: [{ cod: 'MD1' }],
    aprovacoes: [{ id: 'AP1' }],
    auditoria: [{ id: 'AU1' }],
    notificacoes: [{ id: 'NO1' }],
    comprasPrivadas: [{ id: 'CP1', pixkey: 'chave-pix' }]
  };
}

function makePersist(role, db = makeDB()) {
  const saved = {};
  const session = { role, email: `${role}@obra.com` };
  const localStorageMock = { setItem: vi.fn(), getItem: vi.fn(() => null) };
  const windowMock = {
    IS_READONLY_MODE: false,
    __billingState: 'ativo',
    dispatchEvent: vi.fn()
  };
  const update = vi.fn(async (payload) => { saved.payload = payload; });
  const dbRef = { update };
  const firebaseMock = { database: () => ({ goOnline: vi.fn() }) };
  class CustomEventMock {
    constructor(type, opts) { this.type = type; Object.assign(this, opts); }
  }

  const factory = new Function(
    'DB', '_getBillingSessionUser', '_currentTenantId', 'firebase', 'dbRef',
    'superAdminActiveTenant', 'buildCloudUpdate', 'ensureSchema',
    'sanitizeComprasForRole', '_sessionRole', 'localStorage', 'sessionStorage', 'window',
    'CustomEvent', 'toast',
    `let _persistenceTimer = null, _isSaving = false, _saveScheduled = false, _ignoreNextEcho = false;
     ${persistSrc}
     return persistDB;`
  );

  const persistDB = factory(
    db,
    () => session,
    'tenant-1',
    firebaseMock,
    dbRef,
    null,
    helpers.buildCloudUpdate,
    (x) => x,
    helpers.sanitizeComprasForRole,
    helpers._sessionRole,
    localStorageMock,
    { getItem: () => JSON.stringify(session) },
    windowMock,
    CustomEventMock,
    vi.fn()
  );

  return { persistDB, update, localStorageMock, windowMock, saved, db };
}

const cachedDB = (storage) => {
  const call = storage.setItem.mock.calls.find(([key]) => key === 'gestaoObraDB');
  expect(call).toBeDefined();
  return JSON.parse(call[1]);
};

describe('buildCloudUpdate — filtro por papel', () => {
  const db = makeDB();

  it('admin envia os dados do app, mas nunca metadados de cobrança nem nós do servidor', () => {
    const update = helpers.buildCloudUpdate(db, 'admin');
    expect(Object.keys(update)).toEqual(expect.arrayContaining([
      'config/nomeEmpresa', 'obras', 'presenca', 'tarefas', 'almocos',
      'estoque', 'movEstoque', 'trabalhadores', 'compras', 'financeiro',
      'orcamento', 'medicao'
    ]));
    for (const proibido of ['plano', 'billingState', 'aprovacoes', 'auditoria',
      'notificacoes', 'comprasPrivadas', 'config/limiteObras', 'config/limiteUsuarios']) {
      expect(update).not.toHaveProperty(proibido);
    }
  });

  it('as opções de marca d\'água acompanham o white-label salvo no admin', () => {
    const cfg = {
      config: {
        nomeEmpresa: 'Construtora Alfa',
        marcaDaguaApp: true,
        marcaDaguaRelatorios: false,
        limiteObras: 1
      }
    };
    const update = helpers.buildCloudUpdate(cfg, 'admin');
    expect(update['config/marcaDaguaApp']).toBe(true);
    expect(update['config/marcaDaguaRelatorios']).toBe(false);
  });

  it('encarregado envia somente registro de obra', () => {
    const update = helpers.buildCloudUpdate(db, 'encarregado');
    expect(Object.keys(update).sort()).toEqual(['almocos', 'presenca', 'tarefas']);
  });

  it('mestre herda exatamente o alias de encarregado', () => {
    expect(helpers._sessionRole({ role: 'mestre' })).toBe('encarregado');
    expect(helpers._sessionRole({ role: 'engenheiro' })).toBe('engenheiro');
    expect(helpers.buildCloudUpdate(db, 'mestre'))
      .toEqual(helpers.buildCloudUpdate(db, 'encarregado'));
  });

  it('engenheiro envia registro de obra, obras e rascunho de medição', () => {
    const update = helpers.buildCloudUpdate(db, 'engenheiro');
    expect(Object.keys(update).sort()).toEqual([
      'almocos', 'medicao', 'obras', 'presenca', 'tarefas'
    ]);
  });

  it('comprador envia compras e estoque; papel pendente não envia nada', () => {
    expect(Object.keys(helpers.buildCloudUpdate(db, 'comprador')).sort())
      .toEqual(['compras', 'estoque']);
    expect(helpers.buildCloudUpdate(db, 'pendente')).toEqual({});
  });
});

describe('sanitizeComprasForRole', () => {
  it('remove todos os campos comerciais sem mutar o DB original', () => {
    const db = makeDB();
    const limpo = helpers.sanitizeComprasForRole(db, 'engenheiro');
    expect(db.compras[0].forn).toBe('Fornecedor Secreto'); // original intacto
    expect(limpo.compras[0]).toMatchObject({ mat: 'Cimento', qtd: 10, unid: 'sc' });
    for (const campo of helpers.COMPRAS_SENSITIVE_FIELDS) {
      expect(limpo.compras[0]).not.toHaveProperty(campo);
    }
  });

  it('admin mantém os campos comerciais', () => {
    expect(helpers.sanitizeComprasForRole(makeDB(), 'admin').compras[0].pixkey)
      .toBe('chave-pix');
  });
});

describe('persistDB — gravação filtrada por papel', () => {
  it('encarregado grava só registro de obra e não guarda PIX/valores no localStorage', async () => {
    const { persistDB, update, localStorageMock, saved } = makePersist('encarregado');
    await persistDB(true);

    expect(update).toHaveBeenCalledOnce();
    expect(Object.keys(saved.payload).sort()).toEqual(['almocos', 'presenca', 'tarefas']);
    const cache = cachedDB(localStorageMock);
    expect(cache.compras[0]).toMatchObject({ mat: 'Cimento', qtd: 10 });
    for (const campo of helpers.COMPRAS_SENSITIVE_FIELDS) {
      expect(cache.compras[0]).not.toHaveProperty(campo);
    }
  });

  it('engenheiro não consegue gravar financeiro/orçamento/compras via update em lote', async () => {
    const { persistDB, saved } = makePersist('engenheiro');
    await persistDB(true);
    expect(Object.keys(saved.payload).sort()).toEqual([
      'almocos', 'medicao', 'obras', 'presenca', 'tarefas'
    ]);
  });

  it('admin continua gravando tudo (menos metadados protegidos)', async () => {
    const { persistDB, saved } = makePersist('admin');
    await persistDB(true);
    expect(saved.payload).toHaveProperty('financeiro');
    expect(saved.payload).toHaveProperty('compras');
    expect(saved.payload).toHaveProperty('config/nomeEmpresa');
    expect(saved.payload).not.toHaveProperty('aprovacoes');
    expect(saved.payload).not.toHaveProperty('plano');
  });

  it('o fallback local continua acontecendo mesmo para papel restrito', async () => {
    const { persistDB, localStorageMock } = makePersist('mestre');
    await persistDB(true);
    expect(localStorageMock.setItem).toHaveBeenCalled();
    expect(cachedDB(localStorageMock)._tenantId).toBe('tenant-1');
  });
});
