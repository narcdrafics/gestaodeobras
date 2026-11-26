// tests/aprovacoes-ui.test.js
// Contrato da camada de UI de aprovações: fiação no app, papéis que podem
// decidir, desvios dos save* e o limite de 15 dias no cliente.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const appHtml = read('public/app.html');
const appSrc = read('public/js/app_core.js');
const authSrc = read('public/js/auth_core.js');
const estoqueSrc = read('public/js/estoque.module.js');
const uiSrc = read('public/js/aprovacoes_ui.js');
const modal = read('public/modals/modal-aprovacao.html');
const pagina = read('public/pages/aprovacoes.html');

const trecho = (src, inicio, fim) => src.slice(src.indexOf(inicio), src.indexOf(fim));

describe('aprovacoes — fiação no app', () => {
  it('carrega o módulo com cache-bust e oferece a página no menu', () => {
    expect(appHtml).toContain('js/aprovacoes_ui.js?v=');
    expect(appHtml).not.toContain('js/aprovacoes_ui.js?v=20261122006');
    expect(appHtml).toContain('css/app.css?v=');
    expect(appHtml).toContain("onclick=\"showPage('aprovacoes')\"");
    expect(appHtml).toContain('id="nav-aprovacoes"');
  });

  it('renderPage resolve aprovacoes e inicializa os listeners', () => {
    expect(appSrc).toContain('aprovacoes: (...args) =>');
    expect(appSrc).toContain('window.iniciarAprovacoes');
    expect(appSrc).toContain('window.renderAprovacoes');
  });

  it('admin e engenheiro veem o menu; encarregado não', () => {
    const restricoes = trecho(authSrc, 'function setRestrictions(', "window.addEventListener('firebaseSync'");
    expect(restricoes).toContain("role === 'engenheiro'");
    expect(restricoes).toContain('nav-aprovacoes');
  });

  it('a página traz filtros de status/tipo e o modal traz os campos usados pelo renderizador', () => {
    for (const id of ['aprov-tbody', 'aprov-status-filter', 'aprov-tipo-filter', 'aprov-total']) {
      expect(pagina).toContain(`id="${id}"`);
    }
    for (const id of [
      'ap-id', 'ap-tipo', 'ap-desc', 'ap-solicitante', 'ap-criado', 'ap-prazo',
      'ap-status', 'ap-motivo-decisao', 'ap-payload', 'ap-acoes', 'ap-acoes-leitura',
      'ap-motivo-grp', 'ap-aviso-engenheiro', 'ap-notificar', 'ap-motivo'
    ]) {
      expect(modal).toContain(`id="${id}"`);
    }
    expect(modal).toContain("decidirAprovacao(");
  });
});

describe('aprovacoes — contrato do cliente', () => {
  it('expõe as funções usadas pelo app', () => {
    for (const fn of [
      'iniciarAprovacoes', 'solicitarAprovacao', 'desviarParaAprovacao',
      'decidirAprovacao', 'abrirAprovacao', 'renderAprovacoes',
      'requerAprovacao', 'atualizarBadgeAprovacoes'
    ]) {
      expect(uiSrc).toContain(`window.${fn} =`);
    }
  });

  it('toda solicitação nasce pendente, com solicitante e expiração de 15 dias', () => {
    expect(uiSrc).toContain('const PRAZO_MS = 15 * 24 * 60 * 60 * 1000;');
    const criacao = trecho(uiSrc, 'async function solicitarAprovacao(', 'window.solicitarAprovacao');
    expect(criacao).toContain("status: 'pendente'");
    expect(criacao).toContain('solicitadoPor: userId');
    expect(criacao).toContain('expiraEm: agora + PRAZO_MS');
    expect(criacao).toContain('payload: payloadFinal');
    expect(criacao).toContain("ap.status === 'pendente'");
    expect(criacao).toContain('Solicitação já enviada');
  });

  it('engenheiro decide apenas movimentação; decisão vai por API server-side', () => {
    const pode = trecho(uiSrc, 'function podeDecidir(', 'function requerAprovacao(');
    expect(pode).toContain("ap.tipo === 'movimentacao_estoque'");

    const decisao = trecho(uiSrc, 'async function decidirAprovacao(', 'function payloadParaExibicao(');
    expect(decisao).toContain('APROVACAO_API_URL');
    expect(decisao).toContain("method: 'POST'");
    expect(decisao).toContain('Authorization');
    expect(decisao).toContain('aprovacaoId: id');
    expect(decisao).not.toContain('firebase.database().ref().update');
  });

  it('só encarregado e engenheiro são desviados para aprovação', () => {
    const requer = trecho(uiSrc, 'function requerAprovacao(', 'window.requerAprovacao');
    expect(requer).toContain("role === 'encarregado' || role === 'engenheiro'");
    expect(requer).not.toContain("role === 'comprador'");
  });

  it('usa a maior claim/perfil/sessão, sem rebaixar admin por claim desatualizada', () => {
    expect(uiSrc).toContain('let papelClaim = null;');
    expect(uiSrc).toContain('let papelPerfil = null;');
    expect(uiSrc).toContain('getIdTokenResult(true)');
    expect(uiSrc).toContain('profiles/${user.uid}/role');
    const papel = trecho(uiSrc, '/** Maior papel entre claim, perfil e sessão', 'async function atualizarPapelClaim(');
    expect(papel).toContain('[papelClaim, papelPerfil, sessao().role]');
    expect(papel).toContain('HIERARQUIA_PAPEL.find');
    const decisao = trecho(uiSrc, 'async function decidirAprovacao(', 'function payloadParaExibicao(');
    expect(decisao).toContain('await atualizarPapelClaim()');
  });

  it('cada abertura relê a claim e o status da solicitação antes de mostrar botões', () => {
    const abrir = trecho(uiSrc, 'async function abrirAprovacao(', 'window.abrirAprovacao');
    expect(abrir).toContain('await atualizarPapelClaim()');
    expect(abrir).toContain("aprovacoes/${id}");
    expect(abrir).toContain('cache[id] = ap');
    expect(abrir).toContain('const pode = podeDecidir(ap)');
  });

  it('notificações são lidas no caminho por uid, sem vazar as dos outros membros', () => {
    expect(uiSrc).toContain('notificacoes/${tid}/${userId}');
    expect(uiSrc).toContain("window.addEventListener('firebaseSync'");
  });
});

describe('aprovacoes — desvios nas escritas sensíveis', () => {
  const desvios = [
    ['salva entrada de estoque', appSrc, 'async function confirmarEntrada(', '// ==================== ESTOQUE', 'movimentacao_estoque'],
    ['salva trabalhador', appSrc, 'async function saveTrabalhador(', 'async function editTrabalhador(', 'trabalhador_add'],
    ['salva compra', appSrc, 'async function saveCompra(', 'async function editCompra(', 'compra_criacao'],
    ['salva financeiro', appSrc, 'async function saveFinanceiro(', 'async function editFinanceiro(', 'financeiro_lancamento'],
    ['salva orçamento', appSrc, 'async function saveOrcamento(', 'async function editOrcamento(', 'orcamento_fechamento'],
    ['salva medição com valor', appSrc, 'async function saveMedicao(', 'async function editMedicao(', 'medicao_fechamento'],
    ['confirma movimentação', estoqueSrc, 'async function confirmarMovimentacao(', 'window.confirmarMovimentacao', 'movimentacao_estoque']
  ];

  for (const [nome, src, inicio, fim, tipo] of desvios) {
    it(`${nome} solicita ${tipo} ao invés de gravar direto`, () => {
      expect(trecho(src, inicio, fim)).toContain(`'${tipo}'`);
    });
  }

  it('remoção de trabalhador pede trabalhador_remove', () => {
    const del = trecho(appSrc, 'async function deleteItem(', '// ==================== FILTER TABLE');
    expect(del).toContain("'trabalhadores'");
    expect(del).toContain("'trabalhador_remove'");
  });

  it('muda status financeiro via financeiro_status quando é só decisão de pagamento', () => {
    const fin = trecho(appSrc, 'async function saveFinanceiro(', 'async function editFinanceiro(');
    expect(fin).toContain("'financeiro_status'");
    expect(fin).toContain('anterior.status !== status');
  });

  it('nunca envia dados comerciais de compra dentro da solicitação', () => {
    const compra = trecho(appSrc, 'async function saveCompra(', 'async function editCompra(');
    expect(compra).toContain('const { forn, pixkey, vunit, vtotal, vorc, prazo, ...publicas } = data;');
    expect(compra).toContain('compra: { ...publicas');
    expect(compra).not.toContain('compraPrivada');
  });

  it('medicação com valor não carrega fotos base64 na solicitação', () => {
    const med = trecho(appSrc, 'async function saveMedicao(', 'async function editMedicao(');
    expect(med).toContain("!String(u).startsWith('data:')");
    expect(med).toContain('medicao_fechamento');
  });
});
