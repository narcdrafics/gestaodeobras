// Fake mínimo da API do Realtime Database usada por functions/aprovacoes.js.
// Mantém as mesmas semânticas que importam para o contrato: leitura por path,
// update multi-path, push() e transação com detecção de concorrência.
const clonar = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));

function em(state, path) {
  if (!path) return state;
  let atual = state;
  for (const parte of path.split('/')) {
    if (atual == null || typeof atual !== 'object') return undefined;
    atual = atual[parte];
  }
  return atual;
}

function juntar(path, chave) {
  return [path, chave].filter(Boolean).join('/');
}

function gravar(state, path, valor) {
  if (!path) {
    Object.keys(state).forEach(k => delete state[k]);
    if (valor && typeof valor === 'object') Object.assign(state, valor);
    return;
  }
  const partes = path.split('/');
  const ultima = partes.pop();
  let pai = state;
  for (const parte of partes) {
    if (pai[parte] == null || typeof pai[parte] !== 'object') pai[parte] = {};
    pai = pai[parte];
  }
  if (valor === null || valor === undefined) delete pai[ultima];
  else pai[ultima] = valor;
}

export function criarFakeDB(inicial = {}) {
  const state = clonar(inicial);
  let sequencia = 0;
  const snapshot = (valor) => ({
    val: () => clonar(valor),
    exists: () => valor !== null && valor !== undefined
  });

  function ref(path = '') {
    return {
      key: path ? path.split('/').pop() : null,
      push() { return { key: `push-${++sequencia}` }; },
      async once() { return snapshot(em(state, path)); },
      async set(valor) { gravar(state, path, valor); },
      async update(updates) {
        for (const [chave, valor] of Object.entries(updates)) {
          gravar(state, juntar(path, chave), valor);
        }
      },
      async transaction(fn) {
        const antes = em(state, path);
        const resultado = fn(clonar(antes));
        if (resultado === undefined) {
          return { committed: false, snapshot: snapshot(antes) };
        }
        if (JSON.stringify(resultado) === JSON.stringify(antes ?? null)) {
          return { committed: false, snapshot: snapshot(antes) };
        }
        gravar(state, path, resultado);
        return { committed: true, snapshot: snapshot(resultado) };
      }
    };
  }

  return {
    ref,
    state,
    ler: (path) => clonar(em(state, path))
  };
}

export const DIA = 24 * 60 * 60 * 1000;

export function aprovacaoBase(sobrescrever = {}) {
  const solicitadoEm = Date.UTC(2026, 10, 1, 12);
  return {
    id: 'AP1',
    tipo: 'movimentacao_estoque',
    status: 'aprovado',
    solicitadoPor: 'uid-enc',
    decididoPor: 'uid-admin',
    decididoPorPapel: 'admin',
    decididoEm: solicitadoEm + DIA * 3,
    solicitadoEm,
    expiraEm: solicitadoEm + DIA * 15,
    payload: {},
    ...sobrescrever
  };
}

export function baseTenant() {
  return {
    tenants: {
      't1': {
        plano: 'pro',
        billingState: 'ativo',
        estoque: [{
          cod: 'ES1', mat: 'Cimento', unid: 'sc', obra: 'obra-a',
          entrada: 100, saida: 20, min: 10, custo: 30
        }],
        movEstoque: [],
        trabalhadores: [{ cod: 'T1', nome: 'João' }],
        financeiro: [{
          desc: 'Empreitada', obra: 'obra-a', prev: 1000, real: 1000,
          status: 'Pendente', valpago: 0
        }],
        orcamento: [{ id: 'SVC1', desc: 'Alvenaria', qtd: 10, vunit: 100, vtotal: 1000 }],
        compras: [],
        medicao: [{ servico: 'Alvenaria', obra: 'obra-a', qreal: 2, vunit: 100, vtotal: 200 }],
        aprovacoes: {}
      }
    },
    profiles: {
      'uid-admin': { tenantId: 't1', role: 'admin' },
      'uid-eng': { tenantId: 't1', role: 'engenheiro' },
      'uid-enc': { tenantId: 't1', role: 'encarregado' },
      'uid-outro': { tenantId: 't2', role: 'admin' }
    },
    auditoria: {},
    notificacoes: {},
    comprasPrivadas: {}
  };
}
