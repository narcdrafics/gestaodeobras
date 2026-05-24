// js/estoque.module.js
// Motor de estoque — todas as regras de negócio centralizadas aqui
// Importar em qualquer página: import { Estoque } from './estoque.module.js'

import { db } from './firebase-config.js'; // ajustar path conforme projeto
import {
  ref, get, set, push, update, remove, serverTimestamp, runTransaction
} from 'firebase/database';

// ─────────────────────────────────────────────────────────────
// TIPOS DE MOVIMENTAÇÃO (imutáveis — nunca alterar os valores)
// ─────────────────────────────────────────────────────────────
export const TIPO_MOV = {
  ENTRADA:        'entrada',        // novo item entra no estoque central
  SAIDA_CANTEIRO: 'saida_canteiro', // sai do estoque para o canteiro de uma obra
  RETORNO:        'retorno',        // volta do canteiro para o estoque
  TRANSFERENCIA:  'transferencia',  // move entre obras (gera saída + entrada)
  AJUSTE:         'ajuste',         // correção manual com motivo obrigatório
  EXCLUSAO:       'exclusao',       // item removido (só permitido se qty = 0 e sem pendente)
};

// ─────────────────────────────────────────────────────────────
// STATUS DO ITEM
// ─────────────────────────────────────────────────────────────
export const STATUS_ITEM = {
  DISPONIVEL: 'disponivel', // no estoque central
  NO_CANTEIRO: 'no_canteiro', // saiu para obra, não retornou
  TRANSFERIDO: 'transferido', // em trânsito entre obras
};

// ─────────────────────────────────────────────────────────────
// HELPERS DE PATH DO FIREBASE
// ─────────────────────────────────────────────────────────────
const path = {
  itens:       (tid)              => `tenants/${tid}/estoque/itens`,
  item:        (tid, itemId)      => `tenants/${tid}/estoque/itens/${itemId}`,
  movs:        (tid)              => `tenants/${tid}/estoque/movimentacoes`,
  mov:         (tid, movId)       => `tenants/${tid}/estoque/movimentacoes/${movId}`,
  canteiro:    (tid, obraId)      => `tenants/${tid}/estoque/canteiro/${obraId}`,
  canteiroItem:(tid, obraId, iid) => `tenants/${tid}/estoque/canteiro/${obraId}/${iid}`,
};

// ─────────────────────────────────────────────────────────────
// NORMALIZAÇÃO — previne duplicação por nome
// ─────────────────────────────────────────────────────────────

/**
 * Normaliza o nome do item para comparação:
 * remove acentos, lowercase, colapsa espaços, remove pontuação
 * "Cimento CP-II" === "cimento cpii" === "CIMENTO  CP II"
 */
export function normalizarNome(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_\/\\]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifica se já existe item com nome equivalente no tenant.
 * Retorna o item existente ou null.
 */
export async function buscarItemDuplicado(tenantId, nomeNovo, excluirId = null) {
  const snap = await get(ref(db, path.itens(tenantId)));
  if (!snap.exists()) return null;

  const nomeNorm = normalizarNome(nomeNovo);
  const itens = snap.val();

  for (const [id, item] of Object.entries(itens)) {
    if (id === excluirId) continue;
    if (normalizarNome(item.nome) === nomeNorm) {
      return { id, ...item };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// CRIAR ITEM NO ESTOQUE
// ─────────────────────────────────────────────────────────────

/**
 * Cria um novo item no estoque central.
 * Bloqueia se já existe item com nome equivalente.
 *
 * @param {string} tenantId
 * @param {Object} dados - { nome, unidade, quantidadeInicial, estoqueMinimo, categoria }
 * @param {string} uid - uid do usuário que criou
 * @returns {{ ok: boolean, erro?: string, itemId?: string }}
 */
export async function criarItem(tenantId, dados, uid) {
  const { nome, unidade, quantidadeInicial = 0, estoqueMinimo = 0, categoria = '' } = dados;

  if (!nome?.trim()) return { ok: false, erro: 'Nome do item é obrigatório.' };
  if (!unidade?.trim()) return { ok: false, erro: 'Unidade é obrigatória.' };
  if (quantidadeInicial < 0) return { ok: false, erro: 'Quantidade inicial não pode ser negativa.' };

  // Bloqueia duplicata por nome
  const duplicado = await buscarItemDuplicado(tenantId, nome);
  if (duplicado) {
    return {
      ok: false,
      erro: `Já existe um item com nome similar: "${duplicado.nome}". Use a movimentação de ENTRADA para adicionar quantidade.`,
      duplicado,
    };
  }

  const itemRef = push(ref(db, path.itens(tenantId)));
  const itemId  = itemRef.key;
  const agora   = Date.now();

  const novoItem = {
    nome:          nome.trim(),
    nomeNorm:      normalizarNome(nome), // campo indexado para busca rápida
    unidade:       unidade.trim(),
    categoria:     categoria.trim(),
    quantidade:    Number(quantidadeInicial),
    estoqueMinimo: Number(estoqueMinimo),
    status:        STATUS_ITEM.DISPONIVEL,
    qtdNoCanteiro: 0,       // soma de tudo que saiu e não retornou
    criadoEm:      agora,
    criadoPor:     uid,
    atualizadoEm:  agora,
  };

  await set(itemRef, novoItem);

  // Registra movimentação de entrada inicial se qty > 0
  if (quantidadeInicial > 0) {
    await _registrarMovimentacao(tenantId, {
      tipo:        TIPO_MOV.ENTRADA,
      itemId,
      itemNome:    novoItem.nome,
      unidade:     novoItem.unidade,
      quantidade:  quantidadeInicial,
      motivo:      'Cadastro inicial do item',
      obraOrigemId: null,
      obraDestinoId: null,
      uid,
    });
  }

  return { ok: true, itemId };
}

// ─────────────────────────────────────────────────────────────
// ENTRADA NO ESTOQUE (reposição / compra)
// ─────────────────────────────────────────────────────────────

/**
 * Registra entrada de quantidade no estoque central.
 * NUNCA deve ser chamado pelo modal de movimentação de canteiro.
 *
 * @param {string} tenantId
 * @param {string} itemId
 * @param {number} quantidade
 * @param {string} motivo - ex: "Compra NF 1234", "Doação"
 * @param {string} uid
 */
export async function registrarEntrada(tenantId, itemId, quantidade, motivo, uid) {
  if (!motivo?.trim()) return { ok: false, erro: 'Motivo da entrada é obrigatório.' };
  if (quantidade <= 0)  return { ok: false, erro: 'Quantidade deve ser maior que zero.' };

  const itemSnap = await get(ref(db, path.item(tenantId, itemId)));
  if (!itemSnap.exists()) return { ok: false, erro: 'Item não encontrado.' };

  const item = itemSnap.val();

  // Bloqueia entrada via modal de movimentação de canteiro (safeguard)
  // O modal de movimentação deve passar context='canteiro'
  // Entradas legítimas NÃO passam esse contexto
  await runTransaction(ref(db, path.item(tenantId, itemId)), (current) => {
    if (!current) return current;
    current.quantidade   = (current.quantidade || 0) + quantidade;
    current.atualizadoEm = Date.now();
    return current;
  });

  await _registrarMovimentacao(tenantId, {
    tipo:          TIPO_MOV.ENTRADA,
    itemId,
    itemNome:      item.nome,
    unidade:       item.unidade,
    quantidade,
    motivo,
    obraOrigemId:  null,
    obraDestinoId: null,
    uid,
  });

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// SAÍDA PARA O CANTEIRO
// ─────────────────────────────────────────────────────────────

/**
 * Registra saída de item do estoque para o canteiro de uma obra.
 * Bloqueia se quantidade disponível for insuficiente.
 */
export async function registrarSaidaCanteiro(tenantId, itemId, obraId, obraNome, quantidade, uid) {
  if (quantidade <= 0) return { ok: false, erro: 'Quantidade deve ser maior que zero.' };
  if (!obraId)         return { ok: false, erro: 'Obra de destino é obrigatória.' };

  const itemRef = ref(db, path.item(tenantId, itemId));
  let resultado = { ok: false, erro: '' };

  await runTransaction(itemRef, (current) => {
    if (!current) return; // abort

    const disponivel = (current.quantidade || 0);
    if (disponivel < quantidade) {
      resultado = {
        ok: false,
        erro: `Estoque insuficiente. Disponível: ${disponivel} ${current.unidade}. Solicitado: ${quantidade}.`,
      };
      return; // abort transaction
    }

    current.quantidade    = disponivel - quantidade;
    current.qtdNoCanteiro = (current.qtdNoCanteiro || 0) + quantidade;
    current.atualizadoEm  = Date.now();
    resultado = { ok: true, itemNome: current.nome, unidade: current.unidade };
    return current;
  });

  if (!resultado.ok) return resultado;

  // Atualiza registro do canteiro da obra
  const canteiroRef = ref(db, path.canteiroItem(tenantId, obraId, itemId));
  await runTransaction(canteiroRef, (current) => {
    if (!current) {
      return {
        itemId,
        itemNome:   resultado.itemNome,
        unidade:    resultado.unidade,
        quantidade,
        saidaEm:    Date.now(),
        retornos:   [],
      };
    }
    current.quantidade = (current.quantidade || 0) + quantidade;
    return current;
  });

  await _registrarMovimentacao(tenantId, {
    tipo:          TIPO_MOV.SAIDA_CANTEIRO,
    itemId,
    itemNome:      resultado.itemNome,
    unidade:       resultado.unidade,
    quantidade,
    motivo:        `Saída para obra: ${obraNome}`,
    obraOrigemId:  null,
    obraDestinoId: obraId,
    obraDestinoNome: obraNome,
    uid,
  });

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// RETORNO DO CANTEIRO PARA O ESTOQUE
// ─────────────────────────────────────────────────────────────

/**
 * Registra retorno de item do canteiro de volta ao estoque central.
 * Bloqueia se quantidade a retornar > quantidade que está no canteiro.
 */
export async function registrarRetorno(tenantId, itemId, obraId, obraNome, quantidade, motivo, uid) {
  if (quantidade <= 0) return { ok: false, erro: 'Quantidade deve ser maior que zero.' };

  // 1. Verifica quanto está no canteiro
  const canteiroSnap = await get(ref(db, path.canteiroItem(tenantId, obraId, itemId)));
  if (!canteiroSnap.exists()) {
    return { ok: false, erro: 'Este item não consta como saído para esta obra.' };
  }

  const canteiro = canteiroSnap.val();
  const qtdNoCanteiro = canteiro.quantidade || 0;

  if (quantidade > qtdNoCanteiro) {
    return {
      ok: false,
      erro: `Não é possível retornar ${quantidade} ${canteiro.unidade}. Quantidade no canteiro: ${qtdNoCanteiro}.`,
    };
  }

  // 2. Atualiza o canteiro
  const novaQtdCanteiro = qtdNoCanteiro - quantidade;
  if (novaQtdCanteiro === 0) {
    await remove(ref(db, path.canteiroItem(tenantId, obraId, itemId)));
  } else {
    await update(ref(db, path.canteiroItem(tenantId, obraId, itemId)), {
      quantidade: novaQtdCanteiro,
    });
  }

  // 3. Atualiza o item no estoque
  await runTransaction(ref(db, path.item(tenantId, itemId)), (current) => {
    if (!current) return current;
    current.quantidade    = (current.quantidade || 0) + quantidade;
    current.qtdNoCanteiro = Math.max(0, (current.qtdNoCanteiro || 0) - quantidade);
    current.atualizadoEm  = Date.now();
    return current;
  });

  await _registrarMovimentacao(tenantId, {
    tipo:         TIPO_MOV.RETORNO,
    itemId,
    itemNome:     canteiro.itemNome,
    unidade:      canteiro.unidade,
    quantidade,
    motivo:       motivo || `Retorno da obra: ${obraNome}`,
    obraOrigemId: obraId,
    obraOrigemNome: obraNome,
    obraDestinoId: null,
    uid,
  });

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// TRANSFERÊNCIA ENTRE OBRAS
// ─────────────────────────────────────────────────────────────

/**
 * Transfere item diretamente de um canteiro para outro.
 * Não passa pelo estoque central.
 * Bloqueia se obraOrigem === obraDestino.
 */
export async function registrarTransferencia(
  tenantId, itemId, obraOrigemId, obraOrigemNome,
  obraDestinoId, obraDestinoNome, quantidade, uid
) {
  if (obraOrigemId === obraDestinoId) {
    return { ok: false, erro: 'Obra de origem e destino não podem ser a mesma.' };
  }
  if (quantidade <= 0) return { ok: false, erro: 'Quantidade deve ser maior que zero.' };

  // Verifica quantidade disponível na obra de origem
  const canteiroSnap = await get(ref(db, path.canteiroItem(tenantId, obraOrigemId, itemId)));
  if (!canteiroSnap.exists()) {
    return { ok: false, erro: 'Item não encontrado no canteiro de origem.' };
  }

  const canteiro = canteiroSnap.val();
  if (quantidade > canteiro.quantidade) {
    return {
      ok: false,
      erro: `Disponível no canteiro de origem: ${canteiro.quantidade} ${canteiro.unidade}. Solicitado: ${quantidade}.`,
    };
  }

  // Debita na origem
  const novaQtdOrigem = canteiro.quantidade - quantidade;
  if (novaQtdOrigem === 0) {
    await remove(ref(db, path.canteiroItem(tenantId, obraOrigemId, itemId)));
  } else {
    await update(ref(db, path.canteiroItem(tenantId, obraOrigemId, itemId)), {
      quantidade: novaQtdOrigem,
    });
  }

  // Credita no destino
  const canteiroDestinoRef = ref(db, path.canteiroItem(tenantId, obraDestinoId, itemId));
  await runTransaction(canteiroDestinoRef, (current) => {
    if (!current) {
      return {
        itemId,
        itemNome: canteiro.itemNome,
        unidade:  canteiro.unidade,
        quantidade,
        saidaEm:  Date.now(),
      };
    }
    current.quantidade = (current.quantidade || 0) + quantidade;
    return current;
  });

  // Não altera o estoque central (item não passou por lá)
  // Registra movimentação única com tipo transferencia
  await _registrarMovimentacao(tenantId, {
    tipo:           TIPO_MOV.TRANSFERENCIA,
    itemId,
    itemNome:       canteiro.itemNome,
    unidade:        canteiro.unidade,
    quantidade,
    motivo:         `Transferência de ${obraOrigemNome} → ${obraDestinoNome}`,
    obraOrigemId,
    obraOrigemNome,
    obraDestinoId,
    obraDestinoNome,
    uid,
  });

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// EXCLUSÃO SEGURA DE ITEM
// ─────────────────────────────────────────────────────────────

/**
 * Remove um item do estoque.
 * BLOQUEIA se:
 *   - qtdNoCanteiro > 0 (item ainda está em alguma obra)
 *   - quantidade > 0 (ainda tem saldo — exige ajuste primeiro)
 */
export async function excluirItem(tenantId, itemId, uid) {
  const itemSnap = await get(ref(db, path.item(tenantId, itemId)));
  if (!itemSnap.exists()) return { ok: false, erro: 'Item não encontrado.' };

  const item = itemSnap.val();

  if ((item.qtdNoCanteiro || 0) > 0) {
    return {
      ok: false,
      erro: `Não é possível excluir "${item.nome}". Ainda há ${item.qtdNoCanteiro} ${item.unidade} no canteiro. Registre o retorno antes de excluir.`,
    };
  }

  if ((item.quantidade || 0) > 0) {
    return {
      ok: false,
      erro: `Não é possível excluir "${item.nome}" com saldo de ${item.quantidade} ${item.unidade} em estoque. Faça um ajuste para zerar antes de excluir.`,
    };
  }

  // Verifica se existe no canteiro de qualquer obra
  const canteiroSnap = await get(ref(db, `tenants/${tenantId}/estoque/canteiro`));
  if (canteiroSnap.exists()) {
    const canteiros = canteiroSnap.val();
    for (const [obraId, itens] of Object.entries(canteiros)) {
      if (itens[itemId]) {
        return {
          ok: false,
          erro: `Item ainda registrado no canteiro da obra ${obraId}. Registre o retorno antes de excluir.`,
        };
      }
    }
  }

  // Registra exclusão no histórico antes de remover
  await _registrarMovimentacao(tenantId, {
    tipo:     TIPO_MOV.EXCLUSAO,
    itemId,
    itemNome: item.nome,
    unidade:  item.unidade,
    quantidade: 0,
    motivo:   'Item excluído do cadastro',
    uid,
  });

  await remove(ref(db, path.item(tenantId, itemId)));

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// AJUSTE MANUAL
// ─────────────────────────────────────────────────────────────

/**
 * Ajuste de quantidade com motivo obrigatório.
 * Usado para correções de inventário.
 * Motivo mínimo: 10 caracteres (evita "ok", "teste", etc.)
 */
export async function registrarAjuste(tenantId, itemId, novaQuantidade, motivo, uid) {
  if (motivo?.trim().length < 10) {
    return { ok: false, erro: 'Descreva o motivo do ajuste (mínimo 10 caracteres).' };
  }
  if (novaQuantidade < 0) {
    return { ok: false, erro: 'Quantidade não pode ser negativa.' };
  }

  let quantidadeAnterior = 0;
  let itemNome = '';
  let unidade  = '';

  await runTransaction(ref(db, path.item(tenantId, itemId)), (current) => {
    if (!current) return current;
    quantidadeAnterior = current.quantidade || 0;
    itemNome           = current.nome;
    unidade            = current.unidade;
    current.quantidade   = novaQuantidade;
    current.atualizadoEm = Date.now();
    return current;
  });

  const diferenca = novaQuantidade - quantidadeAnterior;

  await _registrarMovimentacao(tenantId, {
    tipo:       TIPO_MOV.AJUSTE,
    itemId,
    itemNome,
    unidade,
    quantidade: Math.abs(diferenca),
    motivo:     `Ajuste: ${diferenca >= 0 ? '+' : ''}${diferenca} ${unidade}. ${motivo}`,
    uid,
  });

  return { ok: true, diferenca };
}

// ─────────────────────────────────────────────────────────────
// CONSULTAS
// ─────────────────────────────────────────────────────────────

/** Lista todos os itens com alerta de estoque mínimo */
export async function listarItensComAlerta(tenantId) {
  const snap = await get(ref(db, path.itens(tenantId)));
  if (!snap.exists()) return [];

  return Object.entries(snap.val())
    .map(([id, item]) => ({ id, ...item }))
    .filter(item => (item.quantidade || 0) <= (item.estoqueMinimo || 0))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

/** Lista tudo que está no canteiro de uma obra específica */
export async function listarCanteiro(tenantId, obraId) {
  const snap = await get(ref(db, path.canteiro(tenantId, obraId)));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, item]) => ({ id, ...item }));
}

/** Histórico de movimentações de um item */
export async function listarMovimentacoes(tenantId, itemId, limit = 50) {
  const snap = await get(ref(db, path.movs(tenantId)));
  if (!snap.exists()) return [];

  return Object.entries(snap.val())
    .map(([id, mov]) => ({ id, ...mov }))
    .filter(mov => !itemId || mov.itemId === itemId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// INTERNO — registrar movimentação (nunca chamar direto)
// ─────────────────────────────────────────────────────────────
async function _registrarMovimentacao(tenantId, dados) {
  const movRef = push(ref(db, path.movs(tenantId)));
  await set(movRef, {
    ...dados,
    timestamp:   Date.now(),
    movId:       movRef.key,
  });
}

// ─────────────────────────────────────────────────────────────
// VALIDAÇÕES DO MODAL — uso direto na UI antes de chamar as funções acima
// ─────────────────────────────────────────────────────────────

/**
 * Valida o formulário do modal de movimentação antes de qualquer operação.
 * Retorna lista de erros ou array vazio se OK.
 *
 * IMPORTANTE: O modal de movimentação NUNCA deve chamar registrarEntrada().
 * Entrada é operação separada, com modal próprio.
 */
export function validarFormMovimentacao(dados) {
  const erros = [];
  const { tipo, itemId, quantidade, obraOrigemId, obraDestinoId, motivo } = dados;

  if (!itemId)    erros.push('Selecione um item.');
  if (!tipo)      erros.push('Selecione o tipo de movimentação.');
  if (!quantidade || quantidade <= 0) erros.push('Quantidade deve ser maior que zero.');

  // Bloqueia entrada via modal de movimentação — entrada tem fluxo próprio
  if (tipo === TIPO_MOV.ENTRADA) {
    erros.push('⛔ Entrada de itens não é permitida pelo modal de movimentação. Use o botão "Nova Entrada" no cadastro de estoque.');
  }

  if (tipo === TIPO_MOV.SAIDA_CANTEIRO && !obraDestinoId) {
    erros.push('Selecione a obra de destino.');
  }

  if (tipo === TIPO_MOV.RETORNO && !obraOrigemId) {
    erros.push('Selecione a obra de origem do retorno.');
  }

  if (tipo === TIPO_MOV.TRANSFERENCIA) {
    if (!obraOrigemId)  erros.push('Selecione a obra de origem.');
    if (!obraDestinoId) erros.push('Selecione a obra de destino.');
    if (obraOrigemId && obraDestinoId && obraOrigemId === obraDestinoId) {
      erros.push('Obra de origem e destino não podem ser iguais.');
    }
  }

  if (tipo === TIPO_MOV.AJUSTE && (!motivo || motivo.trim().length < 10)) {
    erros.push('Descreva o motivo do ajuste (mínimo 10 caracteres).');
  }

  return erros;
}

/**
 * Despacha a movimentação correta com base no tipo.
 * Ponto de entrada único para o modal de movimentação.
 * Garante que ENTRADA nunca seja chamada por aqui.
 */
export async function despacharMovimentacao(tenantId, dados, uid) {
  // Validação prévia
  const erros = validarFormMovimentacao(dados);
  if (erros.length > 0) return { ok: false, erros };

  const { tipo, itemId, quantidade, obraOrigemId, obraOrigemNome,
          obraDestinoId, obraDestinoNome, motivo } = dados;

  switch (tipo) {
    case TIPO_MOV.SAIDA_CANTEIRO:
      return registrarSaidaCanteiro(tenantId, itemId, obraDestinoId, obraDestinoNome, quantidade, uid);

    case TIPO_MOV.RETORNO:
      return registrarRetorno(tenantId, itemId, obraOrigemId, obraOrigemNome, quantidade, motivo, uid);

    case TIPO_MOV.TRANSFERENCIA:
      return registrarTransferencia(
        tenantId, itemId,
        obraOrigemId, obraOrigemNome,
        obraDestinoId, obraDestinoNome,
        quantidade, uid
      );

    case TIPO_MOV.AJUSTE:
      return registrarAjuste(tenantId, itemId, quantidade, motivo, uid);

    case TIPO_MOV.ENTRADA:
      // Dupla proteção — nunca chega aqui por causa da validação, mas por segurança:
      return { ok: false, erro: 'Entrada bloqueada neste fluxo. Use o modal de entrada.' };

    default:
      return { ok: false, erro: `Tipo de movimentação desconhecido: ${tipo}` };
  }
}
