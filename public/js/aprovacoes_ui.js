// ==================== APROVAÇÕES — UI (cliente) ====================
// O cliente apenas solicita e decide. A gravação do resultado é feita pela
// Cloud Function `aplicarAprovacao` (servidor), nunca por persistDB().
(function () {
  'use strict';

  const PRAZO_MS = 15 * 24 * 60 * 60 * 1000;
  const DIAS_ALERTA = [7, 12, 15];

  const TIPOS = {
    movimentacao_estoque: 'Material / ferramenta',
    trabalhador_add: 'Incluir trabalhador',
    trabalhador_remove: 'Remover trabalhador',
    financeiro_lancamento: 'Lançamento financeiro',
    financeiro_status: 'Status de pagamento',
    orcamento_fechamento: 'Fechamento de orçamento',
    compra_criacao: 'Compra',
    medicao_fechamento: 'Fechamento de medição'
  };
  const CAMPOS_SENSIVEIS = ['forn', 'pixkey', 'vunit', 'vtotal', 'vorc', 'prazo'];

  let aprovacoesRef = null;
  let notificacoesRef = null;
  let cache = {};
  let notificacoesCache = {};
  let notificacoesUid = null;
  let tenantAtual = null;
  let filtroStatus = 'pendente';
  let filtroTipo = '';

  function sessao() {
    try {
      return JSON.parse(sessionStorage.getItem('gestaoUser') || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function papel() {
    const role = sessao().role || 'admin';
    return window.normalizeRole ? window.normalizeRole(role) : (role === 'mestre' ? 'encarregado' : role);
  }

  function ehAdmin() {
    const role = papel();
    return role === 'admin' || role === 'super_admin';
  }

  function tenantId() {
    try {
      if (typeof superAdminActiveTenant !== 'undefined' && superAdminActiveTenant && superAdminActiveTenant.id) {
        return superAdminActiveTenant.id;
      }
    } catch (e) { /* variável pode não existir em páginas de login */ }
    return sessao().tenantId || window.OBRA_CHECKOUT_TENANT_ID || '';
  }

  function uid() {
    try {
      return (firebase.auth().currentUser || {}).uid || sessao().uid || '';
    } catch (e) {
      return sessao().uid || '';
    }
  }

  function podeDecidir(ap) {
    if (!ap) return false;
    if (ehAdmin()) return ap.status === 'pendente';
    return papel() === 'engenheiro' && ap.tipo === 'movimentacao_estoque' && ap.status === 'pendente';
  }

  /**
   * Papéis de canteiro não gravam diretamente em estoque/cadastros/financeiro:
   * preparam a operação e enviam para decisão. Admin e comprador escrevem direto.
   * Ponto/fotos/tarefas/almocos continuam diretos — não passam por aqui.
   */
  function requerAprovacao() {
    const role = papel();
    return role === 'encarregado' || role === 'engenheiro';
  }
  window.requerAprovacao = requerAprovacao;

  function labelTipo(tipo) {
    return TIPOS[tipo] || tipo || 'Solicitação';
  }

  function descricao(ap) {
    if (ap.descricao) return String(ap.descricao);
    const p = ap.payload || {};
    if (p.movimentacao) return `${p.movimentacao.tipo || 'Movimentação'} — ${p.movimentacao.mat || p.movimentacao.codMat || ''}`;
    if (p.trabalhador) return `Trabalhador ${p.trabalhador.nome || p.cod || ''}`;
    if (p.lancamento) return `${p.lancamento.desc || 'Lançamento'} — ${p.lancamento.obra || ''}`;
    if (p.compra) return `${p.compra.mat || 'Compra'} (${p.compra.qtd || 0})`;
    if (p.item) return p.item.desc || p.item.servico || labelTipo(ap.tipo);
    return labelTipo(ap.tipo);
  }

  function diasRestantes(ap) {
    const expiraEm = Number(ap.expiraEm);
    if (!Number.isFinite(expiraEm)) return null;
    return Math.ceil((expiraEm - Date.now()) / (24 * 60 * 60 * 1000));
  }

  function statusBadgeAprovacao(status) {
    const mapa = {
      pendente: ['badge-orange', 'Pendente'],
      aprovado: ['badge-green', 'Aprovado'],
      rejeitado: ['badge-red', 'Rejeitado'],
      expirado: ['badge-red', 'Expirado'],
      erro: ['badge-red', 'Erro']
    };
    const [classe, texto] = mapa[status] || ['badge-blue', status || '—'];
    return `<span class="badge ${classe}">${texto}</span>`;
  }

  function esc(txt) {
    return window.escHtml ? window.escHtml(txt == null ? '' : String(txt)) : String(txt == null ? '' : txt);
  }

  // ==================== CARREGAMENTO ====================
  function iniciarAprovacoes() {
    const tid = tenantId();
    const userId = uid();
    if (!tid || typeof firebase === 'undefined' || !firebase.database) return;
    if (tenantAtual === tid && aprovacoesRef && notificacoesUid === userId) return;

    if (tenantAtual !== tid || !aprovacoesRef) {
      if (aprovacoesRef) aprovacoesRef.off();
      tenantAtual = tid;
      aprovacoesRef = firebase.database().ref(`tenants/${tid}/aprovacoes`);
      aprovacoesRef.on('value', (snap) => {
        cache = snap.val() || {};
        try { if (typeof DB !== 'undefined' && DB) DB.aprovacoes = cache; } catch (e) { }
        renderAprovacoes();
        atualizarBadgeAprovacoes();
      }, (erro) => console.warn('[aprovacoes] erro ao ouvir solicitações:', erro && erro.code));
    }

    if (userId && notificacoesUid !== userId) {
      if (notificacoesRef) notificacoesRef.off();
      notificacoesUid = userId;
      notificacoesCache = {};
      notificacoesRef = firebase.database().ref(`notificacoes/${tid}/${userId}`);
      notificacoesRef.on('value', (snap) => {
        notificacoesCache = snap.val() || {};
        atualizarBadgeNotificacoes();
      }, (erro) => console.warn('[aprovacoes] erro ao ouvir notificações:', erro && erro.code));
    }
  }
  window.iniciarAprovacoes = iniciarAprovacoes;

  // O tenant/uid podem ficar prontos depois do DOMContentLoaded (auth assíncrona).
  window.addEventListener('firebaseSync', () => iniciarAprovacoes());

  // ==================== AÇÕES DO SOLICITANTE ====================
  async function solicitarAprovacao(tipo, payload, descricao, alvo) {
    const tid = tenantId();
    const userId = uid();
    if (!tid || !userId) {
      if (typeof toast === 'function') toast('Sessão inválida para solicitar aprovação.', 'error');
      return null;
    }
    if (!TIPOS[tipo]) {
      if (typeof toast === 'function') toast('Tipo de solicitação inválido.', 'error');
      return null;
    }
    const agora = Date.now();

    // Evita duplo clique/reenvio: mesma solicitação pendente nos últimos 60s.
    const descricaoFinal = descricao || labelTipo(tipo);
    const payloadFinal = payload || {};
    const recente = Object.values(cache).find(ap =>
      ap && ap.status === 'pendente' && ap.solicitadoPor === userId &&
      ap.tipo === tipo && ap.descricao === descricaoFinal &&
      agora - Number(ap.solicitadoEm || 0) < 60 * 1000 &&
      JSON.stringify(ap.payload || {}) === JSON.stringify(payloadFinal)
    );
    if (recente) {
      if (typeof toast === 'function') toast('Solicitação já enviada. Aguarde a decisão.', 'warning');
      return recente.id || null;
    }

    const ref = firebase.database().ref(`tenants/${tid}/aprovacoes`).push();
    const registro = {
      id: ref.key,
      tipo,
      status: 'pendente',
      solicitadoPor: userId,
      solicitadoEm: agora,
      expiraEm: agora + PRAZO_MS,
      descricao: descricaoFinal,
      payload: payloadFinal,
      alvo: alvo || ''
    };
    try {
      await ref.set(registro);
      if (typeof toast === 'function') toast('Solicitação enviada para aprovação!', 'success');
      return ref.key;
    } catch (e) {
      console.error('[aprovacoes] erro ao solicitar:', e);
      if (typeof toast === 'function') toast('Não foi possível enviar a solicitação.', 'error');
      return null;
    }
  }
  window.solicitarAprovacao = solicitarAprovacao;

  /** Atalho usado pelos save* do app: retorna true quando o desvio foi feito. */
  async function desviarParaAprovacao(tipo, payload, descricao, alvo) {
    if (!requerAprovacao()) return false;
    const id = await solicitarAprovacao(tipo, payload, descricao, alvo);
    return !!id;
  }
  window.desviarParaAprovacao = desviarParaAprovacao;

  // ==================== DECISÃO ====================
  async function decidirAprovacao(id, decisao) {
    const ap = cache[id];
    const tid = tenantId();
    if (!ap || !tid) return;
    if (!podeDecidir(ap)) {
      if (typeof toast === 'function') toast('Você não tem autoridade para esta decisão.', 'error');
      return;
    }
    if (decisao !== 'aprovado' && decisao !== 'rejeitado') return;

    const motivoEl = document.getElementById('ap-motivo');
    const motivo = motivoEl ? motivoEl.value.trim() : '';
    if (decisao === 'rejeitado' && !motivo) {
      if (typeof toast === 'function') toast('Informe o motivo da rejeição.', 'error');
      return;
    }

    const caminho = `tenants/${tid}/aprovacoes/${id}`;
    const updates = {
      [`${caminho}/status`]: decisao,
      [`${caminho}/decididoPor`]: uid(),
      [`${caminho}/decididoEm`]: Date.now(),
      [`${caminho}/decididoPorPapel`]: ehAdmin() ? 'admin' : 'engenheiro'
    };
    if (decisao === 'rejeitado') updates[`${caminho}/motivo`] = motivo.slice(0, 500);
    // A rules exige notificarAdmin === true quando o engenheiro decide.
    if (!ehAdmin()) updates[`${caminho}/notificarAdmin`] = true;

    try {
      await firebase.database().ref().update(updates);
      if (typeof closeModal === 'function') closeModal('modal-aprovacao');
      if (typeof toast === 'function') {
        toast(decisao === 'aprovado' ? 'Solicitação aprovada e aplicada.' : 'Solicitação rejeitada.', 'success');
      }
    } catch (e) {
      console.error('[aprovacoes] erro ao decidir:', e);
      if (typeof toast === 'function') toast('Não foi possível registrar a decisão.', 'error');
    }
  }
  window.decidirAprovacao = decidirAprovacao;

  function payloadParaExibicao(payload, ap) {
    let copia;
    try { copia = JSON.parse(JSON.stringify(payload || {})); } catch (e) { copia = {}; }
    const restrito = !ehAdmin() && (papel() === 'encarregado' || papel() === 'engenheiro');
    if (restrito) {
      CAMPOS_SENSIVEIS.forEach(campo => {
        delete copia[campo];
        if (copia.compra) delete copia.compra[campo];
        if (copia.compraPrivada) delete copia.compraPrivada[campo];
        if (copia.lancamento) delete copia.lancamento[campo];
        if (copia.movimentacao) delete copia.movimentacao[campo];
      });
      delete copia.compraPrivada;
    }
    return JSON.stringify(copia, null, 2);
  }

  async function abrirAprovacao(id) {
    const ap = cache[id];
    if (!ap) return;
    if (typeof openModal === 'function') await openModal('modal-aprovacao');
    const set = (campo, valor) => {
      const el = document.getElementById(campo);
      if (el) el.textContent = valor;
    };
    set('ap-id', id);
    set('ap-tipo', labelTipo(ap.tipo));
    set('ap-desc', descricao(ap));
    set('ap-solicitante', ap.solicitadoPor || '—');
    set('ap-criado', ap.solicitadoEm ? new Date(ap.solicitadoEm).toLocaleString('pt-BR') : '—');
    const restante = diasRestantes(ap);
    set('ap-prazo', ap.expiraEm
      ? `${new Date(ap.expiraEm).toLocaleDateString('pt-BR')} (${restante == null ? '—' : restante + ' dia(s)'})`
      : '—');
    set('ap-status', String(ap.status || '—'));
    set('ap-motivo-decisao', ap.motivo || '—');
    const pre = document.getElementById('ap-payload');
    if (pre) pre.textContent = payloadParaExibicao(ap.payload, ap);

    const pode = podeDecidir(ap);
    const botoes = document.getElementById('ap-acoes');
    if (botoes) botoes.style.display = pode ? 'flex' : 'none';
    const soLeitura = document.getElementById('ap-acoes-leitura');
    if (soLeitura) soLeitura.style.display = pode ? 'none' : 'flex';
    const motivoGrp = document.getElementById('ap-motivo-grp');
    if (motivoGrp) motivoGrp.style.display = pode ? 'flex' : 'none';
    const motivoLinha = document.getElementById('ap-motivo-linha');
    if (motivoLinha) motivoLinha.style.display = ap.motivo ? 'flex' : 'none';
    const aviso = document.getElementById('ap-aviso-engenheiro');
    if (aviso) aviso.style.display = (pode && papel() === 'engenheiro') ? 'block' : 'none';
    const checkbox = document.getElementById('ap-notificar');
    if (checkbox) checkbox.checked = true;
    const motivoInput = document.getElementById('ap-motivo');
    if (motivoInput) motivoInput.value = '';
  }
  window.abrirAprovacao = abrirAprovacao;

  // ==================== LISTAGEM ====================
  function renderAprovacoes() {
    const tbody = document.getElementById('aprov-tbody');
    if (!tbody) return;
    const lista = Object.entries(cache)
      .map(([id, ap]) => ({ ...ap, _id: id }))
      .filter(ap => !filtroStatus || ap.status === filtroStatus)
      .filter(ap => !filtroTipo || ap.tipo === filtroTipo)
      .sort((a, b) => (a.solicitadoEm || 0) - (b.solicitadoEm || 0));

    tbody.innerHTML = lista.length
      ? lista.map(ap => {
        const dias = diasRestantes(ap);
        const prazo = ap.status === 'pendente' && dias != null
          ? `<span class="${dias <= 3 ? 'ap-prazo-urgente' : ''}">${dias}d</span>`
          : '—';
        const acoes = ap.status === 'pendente'
          ? `<button class="btn btn-secondary btn-sm" onclick="abrirAprovacao('${esc(ap._id)}')">${podeDecidir(ap) ? 'Decidir' : 'Ver'}</button>`
          : `<button class="btn btn-secondary btn-sm" onclick="abrirAprovacao('${esc(ap._id)}')">Ver</button>`;
        return `<tr>
          <td data-label="Tipo">${esc(labelTipo(ap.tipo))}</td>
          <td data-label="Descrição">${esc(descricao(ap))}</td>
          <td data-label="Solicitante">${esc(ap.solicitadoPor || '—')}</td>
          <td data-label="Solicitado em">${ap.solicitadoEm ? esc(new Date(ap.solicitadoEm).toLocaleDateString('pt-BR')) : '—'}</td>
          <td data-label="Prazo">${prazo}</td>
          <td data-label="Status">${statusBadgeAprovacao(ap.status)}</td>
          <td data-label="Ações">${acoes}</td>
        </tr>`;
      }).join('')
      : `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text3)">Nenhuma solicitação encontrada.</td></tr>`;

    const total = document.getElementById('aprov-total');
    if (total) total.textContent = String(lista.length);
  }
  window.renderAprovacoes = renderAprovacoes;

  function filtrarAprovacoes() {
    const status = document.getElementById('aprov-status-filter');
    const tipo = document.getElementById('aprov-tipo-filter');
    filtroStatus = status ? status.value : 'pendente';
    filtroTipo = tipo ? tipo.value : '';
    renderAprovacoes();
  }
  window.filtrarAprovacoes = filtrarAprovacoes;

  // ==================== BADGES / NOTIFICAÇÕES ====================
  function garantirBadge(id, icone, titulo, onclick) {
    let el = document.getElementById(id);
    if (el) return el;
    const header = document.querySelector('.header-right');
    if (!header) return null;
    el = document.createElement('button');
    el.id = id;
    el.className = 'btn btn-secondary btn-sm header-badge-btn';
    el.title = titulo;
    el.style.display = 'none';
    el.innerHTML = `<span class="material-symbols-outlined md-18" style="vertical-align:middle">${icone}</span> <span class="badge-count">0</span>`;
    if (onclick) el.onclick = onclick;
    const userBadge = document.getElementById('active-user-badge');
    if (userBadge) header.insertBefore(el, userBadge);
    else header.prepend(el);
    return el;
  }

  function atualizarBadgeAprovacoes() {
    const role = papel();
    if (!ehAdmin() && role !== 'engenheiro') return;
    const el = garantirBadge('aprovacoes-badge', 'approval', 'Solicitações pendentes', () => {
      if (typeof showPage === 'function') showPage('aprovacoes');
    });
    if (!el) return;
    const pendentes = Object.values(cache).filter(ap => ap && ap.status === 'pendente' && podeDecidir(ap));
    const contador = el.querySelector('.badge-count');
    if (contador) contador.textContent = String(pendentes.length);
    el.style.display = pendentes.length ? 'inline-flex' : 'none';
    const navCount = document.getElementById('nav-aprovacoes-count');
    if (navCount) {
      navCount.textContent = String(pendentes.length);
      navCount.style.display = pendentes.length ? 'inline-flex' : 'none';
    }
  }
  window.atualizarBadgeAprovacoes = atualizarBadgeAprovacoes;

  function atualizarBadgeNotificacoes() {
    const el = garantirBadge('notificacoes-badge', 'notifications', 'Notificações', () => {
      if (typeof showPage === 'function') showPage('aprovacoes');
      try { sessionStorage.setItem('gestaoNotificacoesVistas', String(Date.now())); } catch (e) { }
      atualizarBadgeNotificacoes();
    });
    if (!el) return;
    let vistas = 0;
    try { vistas = Number(sessionStorage.getItem('gestaoNotificacoesVistas') || 0); } catch (e) { }
    const naoLidas = Object.values(notificacoesCache).filter(n => n && !n.lido && Number(n.criadoEm || 0) > vistas);
    const contador = el.querySelector('.badge-count');
    if (contador) contador.textContent = String(naoLidas.length);
    el.style.display = naoLidas.length ? 'inline-flex' : 'none';
  }
  window.atualizarBadgeNotificacoes = atualizarBadgeNotificacoes;

  // ==================== AUDITORIA DE REGISTRO DE OBRA (UX) ====================
  // As rules mantêm auditoria como append-only do servidor; aqui só registramos
  // o histórico local de quem fez a escrita para o admin conferir depois.
  function registrarAuditoriaOperacional(acao, detalhes) {
    try {
      const chave = 'gestaoAuditoriaLocal';
      const historico = JSON.parse(localStorage.getItem(chave) || '[]');
      historico.unshift({
        acao,
        detalhes: String(detalhes || '').slice(0, 300),
        ator: sessao().email || uid(),
        papel: papel(),
        tenantId: tenantId(),
        criadoEm: Date.now()
      });
      localStorage.setItem(chave, JSON.stringify(historico.slice(0, 200)));
    } catch (e) {
      console.warn('[aprovacoes] não foi possível guardar auditoria local:', e);
    }
  }
  window.registrarAuditoriaOperacional = registrarAuditoriaOperacional;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      iniciarAprovacoes();
      garantirBadge('aprovacoes-badge', 'approval', 'Solicitações pendentes', () => {
        if (typeof showPage === 'function') showPage('aprovacoes');
      });
      garantirBadge('notificacoes-badge', 'notifications', 'Notificações', () => {
        if (typeof showPage === 'function') showPage('aprovacoes');
        try { sessionStorage.setItem('gestaoNotificacoesVistas', String(Date.now())); } catch (e) { }
        atualizarBadgeNotificacoes();
      });
      window.dispatchEvent(new CustomEvent('aprovacoesReady'));
    });
  } else {
    iniciarAprovacoes();
  }
})();
