// ==================== HELPERS ====================

/**
 * Persiste o banco de dados com tratamento de erros.
 * Retorna true se salvou com sucesso, false se falhou.
 */
async function safePersistDB(force = false) {
  try {
    await persistDB(force);
    return true;
  } catch (err) {
    console.error('[Persist] Erro ao salvar:', err);
    toast('Erro ao salvar dados. Tente novamente.', 'error');
    return false;
  }
}

// ==================== SYSTEM GLOBALS (ANTI-REFERENCE ERROR) ====================
// Cria 'stubs' para evitar que saves de uma página "crachem" tentando dar reload em UI de outra página
window.renderDashboard = window.renderDashboard || function () { };
window.renderObras = window.renderObras || function () { };
window.renderTrabalhadores = window.renderTrabalhadores || function () { };


window.renderPresenca = window.renderPresenca || function () { };
window.renderTarefas = window.renderTarefas || function () { };
window.renderEstoque = window.renderEstoque || function () { };
window.renderMovEstoque = window.renderMovEstoque || function () { };
window.renderCompras = window.renderCompras || function () { };
window.renderFinanceiro = window.renderFinanceiro || function () { };
window.renderOrcamento = window.renderOrcamento || function () { };
window.renderMedicao = window.renderMedicao || function () { };
window.renderAdmin = window.renderAdmin || function () { };
window.renderFotos = window.renderFotos || function () { };
window.renderSuperAdmin = window.renderSuperAdmin || function () { };
window.renderAlmocos = window.renderAlmocos || function () { };
window.renderRelatorios = window.renderRelatorios || function () { };

// Funções de formatação - fornecidas pelo utils.module.js via window
// NOTA: fmt, fmtPct, fmtDate são declarados em utils.module.js e atribuídos ao window
const cleanInput = (v) => (!v || v === 'undefined' || v === 'indefinido') ? '' : v;





// (Removido do topo para evitar conflito de redeclare)



// ==================== PAGE NAVIGATION (DYNAMIC FETCH) ====================
const cachePaginas = {};

// Use a mesma versão dos scripts base para renovar o cache do HTML
const HTML_CACHE_VERSION = '202603260845';

async function carregarHTML(caminho) {
  if (cachePaginas[caminho]) return cachePaginas[caminho];
  try {
    const urlComVersionamento = `${caminho}?v=${HTML_CACHE_VERSION}`;
    const res = await fetch(urlComVersionamento);
    if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
    const html = await res.text();
    cachePaginas[caminho] = html;
    return html;
  } catch (err) {
    console.error('Falha ao buscar:', caminho, err);
    return `<div style="padding: 20px; color: var(--red)">Erro ao carregar o componente: ${caminho}</div>`;
  }
}

async function showPage(id) {
  // Atualiza o menu lateral (Estilos)
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => { if (n.getAttribute('onclick')?.includes(id)) n.classList.add('active'); });
  document.querySelector('.sidebar').classList.remove('open');

  // Adiciona um loading simples enquanto busca
  const mainEl = document.getElementById("conteudo-principal");
  safeSetInner(mainEl, '<div style="padding:30px;text-align:center;color:var(--text3)">Carregando tela...</div>');

  // Busca e injeta o HTML da pasta pages/
  const html = await carregarHTML(`pages/${id}.html`);
  safeSetInner(mainEl, `<div class="page active" id="page-${id}">${html}</div>`);

  // Chama a lógica de renderização
  renderPage(id);
}

function renderPage(id) {
  // Usa window[id] para garantir que pega a função mais recente (após módulos carregarem)
  const renderers = {
    dashboard: () => window.renderDashboard?.(),
    obras: () => window.renderObras?.(),
    trabalhadores: () => window.renderTrabalhadores?.(),
    presenca: () => window.renderPresenca?.(),
    tarefas: () => window.renderTarefas?.(),
    estoque: () => window.renderEstoque?.(),
    movEstoque: () => window.renderMovEstoque?.(),
    compras: () => window.renderCompras?.(),
    financeiro: () => window.renderFinanceiro?.(),
    orcamento: () => window.renderOrcamento?.(),
    medicao: () => window.renderMedicao?.(),
    admin: () => window.renderAdmin?.(),
    fotos: () => window.renderFotos?.(),
    super_admin: () => window.renderSuperAdmin?.(),
    relatorios: () => window.renderRelatorios?.(),
    almocos: () => window.renderAlmocos?.()
  };
  if (renderers[id]) {
    renderers[id]();
  }
}
// Renderiza o banner de trial progressivo
function renderTrialBanner(daysLeft) {
  let banner = document.getElementById('trial-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'trial-banner';
    banner.className = 'trial-banner';
    document.body.prepend(banner);
  }
  const msg = daysLeft <= 1 ? 'últimas 24 horas' : `${daysLeft} dias restantes`;
  safeSetInner(banner, `
    <span>⏳ <b>${msg}</b> no seu teste grátis. Assine agora e nunca perca seus dados.</span>
    <button class="btn-pay" onclick="window.open('https://wa.me/5598985262006?text=Olá, quero assinar o plano Pro do Obra Real!', '_blank')">Assinar Pro →</button>
  `);
}

// Escuta atualizações do Firebase para gerenciar o banner de Trial e Atualizar a UI Autonamente
window.addEventListener('firebaseSync', e => {
  const data = e.detail;
  
  // 1. Atualiza Banner de Trial
  if (data.plano === 'free_trial' && data.daysLeftTrial !== undefined && data.daysLeftTrial <= 14 && data.daysLeftTrial > 0) {
    renderTrialBanner(data.daysLeftTrial);
  } else {
    const existing = document.getElementById('trial-banner');
    if (existing) existing.remove();
  }

  // 2. ATUALIZAÇÃO AUTOMÁTICA DE INTERFACE (Fix Dashboard/Financeiro vazio no load)
  // Identifica qual página está ativa e força o re-render
  const activePage = document.querySelector('.page.active');
  if (activePage) {
    const id = activePage.id.replace('page-', '');
    console.log(`[Sync] Atualizando interface da página: ${id}`);
    renderPage(id);
  }
});












// ==================== EXPORT FUNCTIONS ====================
function exportarImagemDashboard() {
  toast('Gerando imagem... Aguarde', 'info');
  const btnDiv = document.querySelector('.page-header div[style*="align-items: center"]');
  if (btnDiv) btnDiv.style.display = 'none'; // Esconde barra de botões

  html2canvas(document.getElementById('conteudo-principal'), {
    scale: 2, // Maior qualidade (High DPI)
    useCORS: true,
    backgroundColor: '#1E1E1E'
  }).then(canvas => {
    const imgData = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = imgData;
    a.download = `Relatorio_Obras_${new Date().toISOString().split('T')[0]}.png`;
    a.click();
    if (btnDiv) btnDiv.style.display = 'flex';
    toast('Imagem gerada! Pronta para WhatsApp.', 'success');
  }).catch(err => {
    console.error(err);
    toast('Falha ao gerar a imagem.', 'error');
    if (btnDiv) btnDiv.style.display = 'flex';
  });
}

// ==================== RELATÓRIOS E COMPONENTES AUXILIARES ====================
// (Lógica de relatórios agora centralizada em js/modules/relatorios.js)

// ==================== COMPONENTES DE INTERFACE (ORQUESTRADOR) ====================

// ==================== MODAL UTILS (DYNAMIC FETCH) ====================

async function openModal(id) {
  const modalContainer = document.getElementById('modal-container');
  const modalContent = document.getElementById('modal-content');

  safeSetInner(modalContent, '<div style="padding:20px;text-align:center">Carregando modal...</div>');
  modalContainer.classList.add('open');

  const html = await carregarHTML(`modals/${id}.html`);
  safeSetInner(modalContent, html);

  // Super Admin: injeta banner de seleção de empresa no topo do modal
  const sessionUser = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
  if (sessionUser.role === 'super_admin') {
    await injectSuperAdminTenantBanner(modalContent);
  }

  // Populate selects
  const m = modalContent;
  const obraSelects = m.querySelectorAll('select[id$="-obra"], select[id^="pr-obra"], select[id^="fn-obra"], select[id^="cp-obra"], select[id^="md-obra"], select[id^="tf-obra"], select[id^="es-obra"], select[id^="mv-obra"], select[id^="oc-obra"]');
  obraSelects.forEach(sel => {
    safeSetInner(sel, DB.obras.map(o => `<option value="${sanitizeHTML(o.cod)}">${sanitizeHTML(o.cod)} — ${sanitizeHTML(o.nome)}</option>`).join(''));
  });
  if (id === 'modal-presenca') {
    const tsel = document.getElementById('pr-trab');
    if (tsel) {
      safeSetInner(tsel, DB.trabalhadores.filter(t => t.status === 'Ativo').map(t => `<option value="${sanitizeHTML(t.cod)}">${sanitizeHTML(t.nome)}</option>`).join(''));
      // Auto-preenche apenas ao criar novo (não ao editar)
      const prEditIdx = document.getElementById('pr-edit-idx') ? parseInt(document.getElementById('pr-edit-idx').value) : -1;
      if (prEditIdx === -1) {
        document.getElementById('pr-data').value = today;
        filterTrabByObra(); // Dispara o filtro inteligente de obras imediatamente ao abrir limpo
        calcPresenca();
      }
    }
  }
  if (id === 'modal-tarefa') {
    document.getElementById('tf-cod').value = nextCod(DB.tarefas, 'TF');
    document.getElementById('tf-criacao').value = today;
  }
  if (id === 'modal-compra') {
    document.getElementById('cp-num').value = nextCod(DB.compras, 'PC');
    document.getElementById('cp-data').value = today;
  }
  if (id === 'modal-financeiro') {
    const fnEditIdx = document.getElementById('fn-edit-idx') ? parseInt(document.getElementById('fn-edit-idx').value) : -1;
    if (fnEditIdx === -1) document.getElementById('fn-data').value = today;
  }
  if (id === 'modal-presenca') {
    const prEditIdx = document.getElementById('pr-edit-idx') ? parseInt(document.getElementById('pr-edit-idx').value) : -1;
    if (prEditIdx === -1) calcPresenca();
  }
  if (id === 'modal-obra') {
    const obEditIdx = document.getElementById('ob-edit-idx') ? parseInt(document.getElementById('ob-edit-idx').value) : -1;
    if (obEditIdx === -1) document.getElementById('ob-cod').value = nextCod(DB.obras, 'OB');
  }
  if (id === 'modal-trabalhador') {
    window._currentTrFoto = null;
    const trEditIdx = document.getElementById('tr-idx') ? parseInt(document.getElementById('tr-idx').value) : -1;
    if (trEditIdx === -1) {
      document.getElementById('tr-cod').value = nextCod(DB.trabalhadores, 'TR');
      document.getElementById('tr-admissao').value = today;
    }
    const fInput = document.getElementById('tr-foto');
    const fPreview = document.getElementById('tr-foto-preview');
    if (fInput && fPreview) {
      fInput.onchange = e => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = re => {
            fPreview.style.display = 'block';
            fPreview.querySelector('img').src = re.target.result;
            window._currentTrFoto = re.target.result;
          };
          reader.readAsDataURL(file);
        }
      };
    }
  }
  if (id === 'modal-estoque') {
    const esEditIdx = document.getElementById('es-edit-idx') ? parseInt(document.getElementById('es-edit-idx').value) : -1;
    if (esEditIdx === -1) document.getElementById('es-cod').value = nextCod(DB.estoque, 'ES');
  }
  if (id === 'modal-movest') {
    document.getElementById('mv-data').value = today;
    const msel = document.getElementById('mv-mat');
    if (msel) {
      safeSetInner(msel, DB.estoque.map(e => `<option value="${sanitizeHTML(e.cod)}">${sanitizeHTML(e.cod)} — ${sanitizeHTML(e.mat)} (${sanitizeHTML(e.obra)})</option>`).join(''));
      fillMatInfo();
    }
  }
  if (id === 'modal-medicao') document.getElementById('md-semana').value = today;
  if (id === 'modal-almoco') {
    const osel = m.querySelector('#al-obra');
    if (osel) safeSetInner(osel, DB.obras.map(o => `<option value="${sanitizeHTML(o.cod)}">${sanitizeHTML(o.cod)} — ${sanitizeHTML(o.nome)}</option>`).join(''));
    const dlist = m.querySelector('#list-equipes');
    if (dlist) {
      const equipes = [...new Set(DB.trabalhadores.map(t => t.equipe).filter(e => e && e !== 'Própria'))];
      const nomes = DB.trabalhadores.map(t => t.nome);
      const opcoes = [...new Set([...equipes, ...nomes])];
      safeSetInner(dlist, opcoes.map(e => `<option value="${sanitizeHTML(e)}">`).join(''));
    }
    m.querySelector('#al-data').value = today;
    calcAlmocoTotal();
  }
  if (id === 'modal-usuario') {
    if (document.getElementById('usr-edit-idx') && document.getElementById('usr-edit-idx').value === '-1') {
      document.getElementById('usr-email').value = '';
      document.getElementById('usr-email').disabled = false;
      document.getElementById('usr-name').value = '';
      document.getElementById('usr-role').value = 'engenheiro';
    }
  }
}

function closeModal(id) {
  document.getElementById('modal-container').classList.remove('open');
  const editIdx = document.getElementById('usr-edit-idx');
  if (id === 'modal-usuario' && editIdx) editIdx.value = '-1';
  const alEditIdx = document.getElementById('al-edit-idx');
  if (id === 'modal-almoco' && alEditIdx) alEditIdx.value = '-1';
  const tfEditIdx = document.getElementById('tf-edit-idx');
  if (id === 'modal-tarefa' && tfEditIdx) tfEditIdx.value = '-1';
  const obEditIdx = document.getElementById('ob-edit-idx');
  if (id === 'modal-obra' && obEditIdx) obEditIdx.value = '-1';
  const prEditIdx = document.getElementById('pr-edit-idx');
  if (id === 'modal-presenca' && prEditIdx) prEditIdx.value = '-1';
  const esEditIdx = document.getElementById('es-edit-idx');
  if (id === 'modal-estoque' && esEditIdx) esEditIdx.value = '-1';
  const mvEditIdx = document.getElementById('mv-edit-idx');
  if (id === 'modal-movest' && mvEditIdx) mvEditIdx.value = '-1';
  const cpEditIdx = document.getElementById('cp-edit-idx');
  if (id === 'modal-compra' && cpEditIdx) cpEditIdx.value = '-1';
  const fnEditIdx = document.getElementById('fn-edit-idx');
  if (id === 'modal-financeiro' && fnEditIdx) fnEditIdx.value = '-1';
  const ocEditIdx = document.getElementById('oc-edit-idx');
  if (id === 'modal-orcamento' && ocEditIdx) ocEditIdx.value = '-1';
  const mdEditIdx = document.getElementById('md-edit-idx');
  if (id === 'modal-medicao' && mdEditIdx) mdEditIdx.value = '-1';
  const trEditIdx = document.getElementById('tr-idx');
  if (id === 'modal-trabalhador' && trEditIdx) trEditIdx.value = '-1';
}

// Funções de presença migradas para presenca.js e funções de estoque para estoque.js

// calcAvanco, calcMovTotal, calcCompraTotal, calcFinDiff, calcOrcTotal
// declarados abaixo junto ao restante das funções de cálculo de formulário

// ==================== SAVE FUNCTIONS ====================
async function saveObra() {

  const cod = document.getElementById('ob-cod').value.trim();
  if (!cod) { toast('Informe o código da obra', 'error'); return; }
  const editIdx = parseInt(document.getElementById('ob-edit-idx').value) || -1;
  // Verifica unicidade do código (exceto ao editar o próprio registro)
  const duplicado = DB.obras.some((o, i) => o.cod === cod && i !== editIdx);
  if (duplicado) { toast(`Código "${cod}" já existe! Use outro.`, 'error'); return; }
  const data = {
    cod, nome: document.getElementById('ob-nome').value,
    end: document.getElementById('ob-end').value,
    tipo: document.getElementById('ob-tipo').value,
    status: document.getElementById('ob-status').value,
    inicio: document.getElementById('ob-inicio').value,
    prazo: document.getElementById('ob-prazo').value,
    orc: parseFloat(document.getElementById('ob-orc').value) || 0,
    mestre: document.getElementById('ob-mestre').value,
    eng: document.getElementById('ob-eng').value,
    cliente: document.getElementById('ob-cliente').value,
    cliente_contato: document.getElementById('ob-cliente-contato').value,
    contrato_tipo: document.getElementById('ob-contrato-tipo').value,
    obs: document.getElementById('ob-obs').value
  };
  if (editIdx >= 0) {
    DB.obras[editIdx] = data;
    toast('Obra atualizada!');
  } else {
    // Validação SaaS: Limite de Obras
    const limite = DB.config.limiteObras || 2;
    if (DB.obras.length >= limite) {
      toast(`Seu plano atingiu o limite de ${limite} obras. Faça upgrade para cadastrar mais!`, 'error');
      return;
    }
    DB.obras.push(data);
    toast('Obra cadastrada!');
  }
  closeModal('modal-obra'); await safePersistDB(); renderObras(); renderDashboard();
}

async function editObra(idx) {
  await openModal('modal-obra');
  document.getElementById('ob-edit-idx').value = idx;
  const o = DB.obras[idx];
  document.getElementById('ob-cod').value = o.cod;
  document.getElementById('ob-nome').value = o.nome;
  document.getElementById('ob-end').value = o.end;
  document.getElementById('ob-tipo').value = o.tipo;
  document.getElementById('ob-status').value = o.status;
  document.getElementById('ob-inicio').value = o.inicio;
  document.getElementById('ob-prazo').value = o.prazo;
  document.getElementById('ob-orc').value = o.orc;
  document.getElementById('ob-mestre').value = o.mestre;
  document.getElementById('ob-eng').value = o.eng;
  document.getElementById('ob-cliente').value = o.cliente;
  document.getElementById('ob-cliente-contato').value = o.cliente_contato || '';
  document.getElementById('ob-contrato-tipo').value = o.contrato_tipo || 'Administração';
  document.getElementById('ob-obs').value = o.obs;
}

async function saveTrabalhador() {

  // Obtém o índice do campo oculto (mais seguro que variável global)
  const hiddenIdxVal = document.getElementById('tr-idx') ? document.getElementById('tr-idx').value : '-1';
  const editIdx = parseInt(hiddenIdxVal) >= 0 ? parseInt(hiddenIdxVal) : -1;

  const cod = document.getElementById('tr-cod').value.trim();
  if (!cod) { toast('Informe o código', 'error'); return; }
  
  // Verifica unicidade do código (desconsiderando o registro em edição)
  const duplicado = DB.trabalhadores.some((t, i) => t.cod === cod && i !== editIdx);
  if (duplicado) { toast(`Código "${cod}" já existe! Use outro.`, 'error'); return; }
  const data = {
    cod, nome: document.getElementById('tr-nome').value.trim(),
    cpf: document.getElementById('tr-cpf').value,
    funcao: document.getElementById('tr-funcao').value,
    vinculo: document.getElementById('tr-vinculo').value,
    equipe: document.getElementById('tr-equipe').value,
    obras: document.getElementById('tr-obras').value,
    diaria: parseFloat(document.getElementById('tr-diaria').value) || 0,
    pgto: document.getElementById('tr-pgto').value,
    pixtipo: document.getElementById('tr-pixtipo').value,
    pixkey: document.getElementById('tr-pixkey').value,
    contato: document.getElementById('tr-contato').value,
    status: document.getElementById('tr-status').value,
    admissao: document.getElementById('tr-admissao').value,
    endereco: document.getElementById('tr-endereco').value,
    cidade: document.getElementById('tr-cidade').value,
    foto: window._currentTrFoto || (editIdx >= 0 ? DB.trabalhadores[editIdx].foto : null)
  };
  if (editIdx >= 0 && DB.trabalhadores[editIdx]) {
    // 1. Captura Segura dos Dados Antigos ANTES de atualizar
    const oldWorker = { ...DB.trabalhadores[editIdx] };
    const oldName = (oldWorker.nome || '').trim();
    const oldCod = (oldWorker.cod || '').trim();
    
    const newName = (data.nome || '').trim();
    const newCod = (data.cod || '').trim();

    DB.trabalhadores[editIdx] = data; // Atualiza o cadastro principal
    
    // 2. Propagação em Cascata (Se Nome OU Código mudaram)
    if ((oldName !== newName && newName) || (oldCod !== newCod && newCod)) {
      console.log(`[Sync] Propagando alteração de "${oldName}" (${oldCod}) para "${newName}" (${newCod})...`);

      // 1. Presença (Folha de Ponto) — Vínculo primário por Código (trab) ou Nome
      if (DB.presenca) {
        DB.presenca.forEach(p => {
          if (p.trab === oldCod || p.nome === oldName) {
            p.nome = newName;
            p.trab = newCod;
          }
        });
      }

      // 2. Tarefas (Responsável)
      if (DB.tarefas) {
        DB.tarefas.forEach(t => {
          if (t.resp === oldName) t.resp = newName;
        });
      }

      // 3. Financeiro (Fornecedor/Beneficiário)
      if (DB.financeiro) {
        DB.financeiro.forEach(f => {
          if (f.forn === oldName) f.forn = newName;
          // Se for pagamento de diária gerado automaticamente, o vínculo de código pode estar em outro lugar,
          // mas o campo 'forn' é o principal para busca na tela.
        });
      }

      // 4. Medições (Equipe Terceira)
      if (DB.medicao) {
        DB.medicao.forEach(m => {
          if (m.equipe === oldName) m.equipe = newName;
        });
      }

      // 5. Almoços (Empreiteiro/Responsável)
      if (DB.almocos) {
        DB.almocos.forEach(a => {
          if (a.empreiteiro === oldName) a.empreiteiro = newName;
        });
      }

      // 6. Cadastro de Obras (Mestre Responsável)
      if (DB.obras) {
        DB.obras.forEach(o => {
          if (o.mestre === oldName) o.mestre = newName;
        });
      }
    }
    toast('Cadastro e históricos atualizados!');
  } else {
    DB.trabalhadores.push(data);
    toast('Novo trabalhador cadastrado!');
  }

  closeModal('modal-trabalhador');

  // Atualizações Globais na UI (antes do sync para UX mais rápida)
  if (typeof renderTrabalhadores === 'function') renderTrabalhadores();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderFinanceiro === 'function') renderFinanceiro();

  // Força sincronização imediata com diagnóstico de erro
  try {
    await persistDB(true);
  } catch (err) {
    const code = err?.code || 'UNKNOWN';
    console.error('[saveTrabalhador] Falha ao sincronizar com a nuvem:', code, err?.message || err);
    toast(`Salvo localmente. Erro na nuvem: ${code}`, 'error');
  }
}

async function editTrabalhador(idx) {
  await openModal('modal-trabalhador');
  if (document.getElementById('tr-idx')) {
     document.getElementById('tr-idx').value = idx;
  }
  const t = DB.trabalhadores[idx];
  document.getElementById('tr-cod').value = t.cod;
  document.getElementById('tr-nome').value = t.nome;
  document.getElementById('tr-cpf').value = t.cpf;
  document.getElementById('tr-funcao').value = t.funcao;
  document.getElementById('tr-vinculo').value = t.vinculo;
  document.getElementById('tr-equipe').value = t.equipe;
  document.getElementById('tr-obras').value = t.obras;
  document.getElementById('tr-diaria').value = t.diaria;
  document.getElementById('tr-pgto').value = t.pgto || 'PIX';
  document.getElementById('tr-pixtipo').value = t.pixtipo || 'cpf';
  document.getElementById('tr-pixkey').value = t.pixkey || '';
  document.getElementById('tr-contato').value = t.contato || '';
  document.getElementById('tr-status').value = t.status;
  document.getElementById('tr-admissao').value = t.admissao;
  document.getElementById('tr-endereco').value = t.endereco || '';
  document.getElementById('tr-cidade').value = t.cidade || '';
  
  // Foto Preview
  const fPreview = document.getElementById('tr-foto-preview');
  if (fPreview && t.foto) {
    fPreview.style.display = 'block';
    fPreview.querySelector('img').src = t.foto;
  } else if (fPreview) {
    fPreview.style.display = 'none';
  }

  // Cálculo Último Pagamento
  const ultPgto = DB.financeiro
    .filter(f => f.trab === t.cod && (f.status === 'Pago' || f.pgtoStatus === 'Pago'))
    .sort((a, b) => new Date(b.data) - new Date(a.data))[0];
  document.getElementById('tr-last-pay').value = ultPgto ? fmtDate(ultPgto.data) : 'Nenhum pagamento registrado';
}

async function savePresenca(keepOpen = false) {
  // Validação dos campos obrigatórios
  const modoMassa = document.querySelector('input[name="pr-modo"]:checked')?.value === 'massa';
  const dataVal = document.getElementById('pr-data').value;
  const obraVal = document.getElementById('pr-obra').value;
  const editIdx = parseInt(document.getElementById('pr-edit-idx').value) || -1;
  
  if (!dataVal) { toast('Informe a data!', 'error'); return; }
  if (!obraVal) { toast('Selecione a obra!', 'error'); return; }

  let lastSavedData = null; // Captura último registro salvo para o toast fora do loop
  let trabsParaSalvar = [];

  if (modoMassa) {
    const checks = document.querySelectorAll('.pr-massa-check:checked');
    if (checks.length === 0) { toast('Selecione ao menos um trabalhador!', 'error'); return; }
    checks.forEach(c => trabsParaSalvar.push(c.value));
  } else {
    const trabVal = document.getElementById('pr-trab').value;
    if (!trabVal) { toast('Selecione o trabalhador!', 'error'); return; }
    trabsParaSalvar.push(trabVal);
  }

  for (const tsel of trabsParaSalvar) {
    const t = DB.trabalhadores.find(x => x.cod === tsel);
    
    // Bloqueia duplicidade de data para o mesmo trabalhador
    const jaExiste = DB.presenca.some((p, idx) => 
      p.data === dataVal && 
      p.trab === tsel && 
      (editIdx < 0 || idx !== editIdx)
    );

    if (jaExiste) {
      const nomeTrab = t ? t.nome : tsel;
      toast(`⚠️ Já existe registro para ${nomeTrab} em ${fmtDate(dataVal)}!`, 'error');
      if (modoMassa) continue;
      return;
    }

  // Vínculo Automático: Se o peão não estiver engajado na Obra em sua ficha local, anexa a tag!
  if (t && (!t.obras || !t.obras.includes(obraVal))) {
    t.obras = t.obras && t.obras.trim() !== '' ? (t.obras + ", " + obraVal) : obraVal;
  }

    const isInformal = t && t.vinculo === 'Informal';

    const data = {
      data: dataVal,
      obra: obraVal,
      trab: tsel,
      nome: t ? t.nome : tsel,
      funcao: t ? t.funcao : document.getElementById('pr-funcao').value, // No modo massa pega da ficha
      vinculo: t ? t.vinculo : '',
      equipe: t ? t.equipe : '',
      frente: document.getElementById('pr-frente').value,
      entrada: document.getElementById('pr-entrada').value,
      saida: document.getElementById('pr-saida').value,
      hnorm: parseFloat(document.getElementById('pr-hnorm').value) || 0,
      hextra: isInformal ? 0 : (parseFloat(document.getElementById('pr-hextra').value) || 0),
      presenca: document.getElementById('pr-presenca').value,
      justif: document.getElementById('pr-obs').value,
      diaria: t ? t.diaria : (parseFloat(document.getElementById('pr-diaria').value) || 0),
      total: (() => {
        const presencaVal = document.getElementById('pr-presenca').value;
        if (presencaVal === 'Falta') return 0;
        if (presencaVal === 'Meio período') {
          const diariaBase = t ? t.diaria : (parseFloat(document.getElementById('pr-diaria').value) || 0);
          return diariaBase / 2;
        }
        if (isInformal) return t ? t.diaria : 0;
        return parseFloat(document.getElementById('pr-total').value) || 0;
      })(),

      pgtoStatus: document.getElementById('pr-pgto-status').value || 'Pendente',
      valpago: parseFloat(document.getElementById('pr-valpago').value) || 0,
      // Almoco agora é captado na tela de Gestão de Almoços
      lancador: document.getElementById('pr-lancador').value,
      hrLanc: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      obs: document.getElementById('pr-obs').value
    };

    if (editIdx >= 0 && !modoMassa) {
      DB.presenca[editIdx] = data;
    } else {
      DB.presenca.push(data);
    }
    lastSavedData = data; // Captura para uso no toast após o loop
  }

  if (keepOpen) {
    document.getElementById('pr-trab').value = '';
    document.getElementById('pr-funcao').value = '';
    document.getElementById('pr-presenca').value = 'Presente';
    document.getElementById('pr-hnorm').value = '';
    document.getElementById('pr-hextra').value = '';
    document.getElementById('pr-diaria').value = '';
    document.getElementById('pr-total').value = '';
    document.getElementById('pr-valpago').value = '';
    document.getElementById('pr-pgto-status').value = 'Pendente';
    document.getElementById('pr-obs').value = '';
    if (document.getElementById('pr-parcial-grp')) document.getElementById('pr-parcial-grp').style.display = 'none';
    if (document.getElementById('pr-parcial-msg')) document.getElementById('pr-parcial-msg').style.display = 'none';
    document.getElementById('pr-edit-idx').value = '-1';
    togglePresenca();
  } else {
    closeModal('modal-presenca');
  }

  try {
    await persistDB();
    let tmsg = editIdx >= 0 ? 'Presença atualizada!' : 'Presença registrada!';
    if (lastSavedData?.pgtoStatus === 'Parcial') tmsg = `Status Parcial: Falta Pagar R$ ${((lastSavedData.total || 0) - (lastSavedData.valpago || 0)).toFixed(2).replace('.', ',')}`;
    toast(tmsg);
  } catch (err) {
    // Mesmo que a nuvem falhe, os dados já estão no DB local em memória
    console.error('Erro ao persistir presença:', err);
    toast('Presença salva localmente, mas falhou na nuvem. Tente sincronizar.', 'error');
  }

  renderPresenca();
  renderFinanceiro();
  renderDashboard();
}

// Helpers para Presença em Massa e Regras SaaS
function togglePresencaModo() {
  const modo = document.querySelector('input[name="pr-modo"]:checked').value;
  const indivGrp = document.getElementById('pr-indiv-grp');
  const massaGrp = document.getElementById('pr-massa-grp');
  const hExtGrp = document.getElementById('pr-hextra-grp');
  
  if (modo === 'massa') {
    indivGrp.style.display = 'none';
    massaGrp.style.display = '';
    hExtGrp.style.display = 'none'; // No modo massa esconde HE por padrão pra agilizar
    filterTrabByObra();
  } else {
    indivGrp.style.display = '';
    massaGrp.style.display = 'none';
    fillTrabInfo(); // Recalcula visibilidade do HE
  }
}

function selectAllTrabs(check) {
  const checks = document.querySelectorAll('.pr-massa-check');
  checks.forEach(c => c.checked = check);
}

async function editPresenca(idx) {
  await openModal('modal-presenca');
  document.getElementById('pr-edit-idx').value = idx;
  const p = DB.presenca[idx];
  document.getElementById('pr-data').value = p.data;
  document.getElementById('pr-obra').value = p.obra;

  // Dispara o filtro inteligente programaticamente antes de resgatar o valor do trabalhador
  filterTrabByObra();

  // Seleciona trabalhador pelo COD salvo
  const trSelect = document.getElementById('pr-trab');
  if (p.trab) {
    trSelect.value = p.trab;
  } else {
    // fallback para dados antigos sem o campo trab
    const found = Array.from(trSelect.options).find(o => o.text === p.nome);
    if (found) trSelect.value = found.value;
  }
  // Preenche funcao e diária do trabalhador selecionado
  const trabData = DB.trabalhadores.find(x => x.cod === trSelect.value);
  if (trabData) {
    document.getElementById('pr-funcao').value = trabData.funcao;
    document.getElementById('pr-diaria').value = trabData.diaria;
  } else {
    document.getElementById('pr-funcao').value = p.funcao;
    document.getElementById('pr-diaria').value = p.diaria;
  }
  document.getElementById('pr-frente').value = p.frente;
  document.getElementById('pr-entrada').value = p.entrada;
  document.getElementById('pr-saida').value = p.saida;
  document.getElementById('pr-hnorm').value = p.hnorm;
  document.getElementById('pr-hextra').value = p.hextra;
  document.getElementById('pr-presenca').value = p.presenca;
  // pr-almoco removido
  document.getElementById('pr-obs').value = p.justif || p.obs || '';
  document.getElementById('pr-diaria').value = p.diaria;
  document.getElementById('pr-total').value = p.total;
  document.getElementById('pr-pgto-status').value = p.pgtoStatus || 'Pendente';
  document.getElementById('pr-valpago').value = p.valpago || '';
  document.getElementById('pr-lancador').value = p.lancador;
  togglePresenca();
  toggleParcial('pr');
}

function togglePresenca() {
  const v = document.getElementById('pr-presenca').value;
  const show = v !== 'Falta';
  const entGrp = document.getElementById('pr-entrada-grp');
  const saiGrp = document.getElementById('pr-saida-grp');
  if (entGrp) entGrp.style.display = show ? '' : 'none';
  if (saiGrp) saiGrp.style.display = show ? '' : 'none';
  if (!show) {
    const totalEl = document.getElementById('pr-total');
    if (totalEl) totalEl.value = 0;
  }
}

window.toggleParcial = function (prefix) {
  let statusSel = document.getElementById(prefix === 'fn' ? 'fn-status' : prefix + '-pgto-status');
  const isParcial = statusSel && statusSel.value === 'Parcial';
  const grp = document.getElementById(prefix + '-parcial-grp');
  const msg = document.getElementById(prefix + '-parcial-msg');
  if (grp) grp.style.display = isParcial ? '' : 'none';
  if (msg) msg.style.display = isParcial ? '' : 'none';
  if (isParcial) window.calcParcial(prefix);
};

window.calcParcial = function (prefix) {
  let total = 0;
  let valPago = parseFloat(document.getElementById(prefix + '-valpago').value) || 0;
  if (prefix === 'fn') total = parseFloat(document.getElementById('fn-real').value) || parseFloat(document.getElementById('fn-prev').value) || 0;
  if (prefix === 'md') total = parseFloat(document.getElementById('md-vtotal').value) || 0;
  if (prefix === 'pr') total = parseFloat(document.getElementById('pr-total').value) || 0;

  let faltante = total - valPago;
  const msg = document.getElementById(prefix + '-parcial-msg');
  if (msg) {
    if (faltante > 0) msg.textContent = `Aviso: Falta Pagar R$ ${faltante.toFixed(2).replace('.', ',')}`;
    else if (faltante < 0) msg.textContent = `Aviso: Cuidado, excede o total (R$ ${Math.abs(faltante).toFixed(2).replace('.', ',')})`;
    else msg.textContent = 'Aviso: Totalmente quitado.';
  }
};

// ==================== CÁLCULOS DE FORMULÁRIO ====================
// Funções de cálculo migradas para seus respectivos módulos (estoque.js, compras.js, financeiro.js, medicoes.js)

window.toggleDestinoMov = function () {
  const t = document.getElementById('mv-tipo').value;
  const grp = document.getElementById('grp-mv-destino');
  if (grp) grp.style.display = t === 'Transferência' ? 'block' : 'none';
};

// ==================== LOTE DE PAGAMENTO (FOLHA) ====================
window.lotePendentes = [];

window.prepareLotePgto = async function () {
  await openModal('modal-lote');
  const saldos = {};
  DB.presenca.filter(p => p.pgtoStatus !== 'Pago').forEach(p => {
    // Identificador único (idealmente código do trab, senão foca no nome base)
    const key = p.trab || (p.nome + '-' + p.funcao);

    let devido = (parseFloat(p.total) || 0) - (p.pgtoStatus === 'Parcial' ? (parseFloat(p.valpago) || 0) : 0);
    if (devido > 0) {
      if (!saldos[key]) {
        saldos[key] = {
          chave: key, nome: p.nome, funcao: p.funcao,
          diarias: 0, valor: 0, indices: []
        };
      }
      saldos[key].diarias += 1;
      saldos[key].valor += devido;
      saldos[key].indices.push(p);
    }
  });

  window.lotePendentes = Object.values(saldos).sort((a, b) => b.valor - a.valor);
  renderLoteTbody();
};

window.renderLoteTbody = function () {
  const tbody = document.getElementById('lote-tbody');
  if (!tbody) return;
  if (lotePendentes.length === 0) {
    safeSetInner(tbody, '<tr><td colspan="5" style="text-align:center;padding:30px;">🎉 Nenhuma diária pendente! Toda a folha já está quitada.</td></tr>');
    document.getElementById('lote-total-sel').textContent = 'R$ 0,00';
    return;
  }

  safeSetInner(tbody, lotePendentes.map((item, i) => `<tr>
    <td style="text-align:center"><input type="checkbox" class="ck-lote-item" value="${i}" onchange="updateLoteTotal()" style="transform:scale(1.2)"></td>
    <td><b>${sanitizeHTML(item.nome)}</b> <small style="color:var(--text3)">(${sanitizeHTML(item.funcao)})</small></td>
    <td style="text-align:center"><span class="badge badge-gray">${item.diarias}</span></td>
    <td style="text-align:right">Dinheiro/Pix</td>
    <td style="text-align:right; font-weight:bold; color:var(--red)">${fmt(item.valor)}</td>
    <td style="text-align:center">
      <button class="btn btn-success btn-sm" onclick="initiatePixPayment('lote', ${i})" title="Pagar via PIX" style="background:var(--green); border-color:var(--green);">💸</button>
    </td>
  </tr>`).join(''));

  updateLoteTotal();
};

window.toggleLoteAll = function (el) {
  const cks = document.querySelectorAll('.ck-lote-item');
  cks.forEach(ck => ck.checked = el.checked);
  updateLoteTotal();
};

window.updateLoteTotal = function () {
  const cks = document.querySelectorAll('.ck-lote-item:checked');
  let total = 0;
  cks.forEach(ck => {
    const item = lotePendentes[parseInt(ck.value)];
    if (item) total += item.valor;
  });
  const el = document.getElementById('lote-total-sel');
  if (el) el.textContent = fmt(total);
};

window.processLotePgto = async function () {
  const cks = document.querySelectorAll('.ck-lote-item:checked');
  if (cks.length === 0) { toast('Nenhum trabalhador selecionado!', 'error'); return; }

  cks.forEach(ck => {
    const item = lotePendentes[parseInt(ck.value)];
    if (item) {
      item.indices.forEach(p => {
        p.pgtoStatus = 'Pago';
        p.valpago = p.total;
      });
    }
  });

  toast(`${cks.length} pagamentos realizados com sucesso!`);
  closeModal('modal-lote');
  await safePersistDB();

  renderPresenca();
  renderFinanceiro();
  renderDashboard();
};



async function saveTarefa() {

  const data = {
    cod: document.getElementById('tf-cod').value,
    obra: document.getElementById('tf-obra').value,
    etapa: document.getElementById('tf-etapa').value,
    frente: document.getElementById('tf-frente').value,
    desc: document.getElementById('tf-desc').value,
    resp: document.getElementById('tf-resp').value,
    prior: document.getElementById('tf-prior').value,
    status: document.getElementById('tf-status').value,
    criacao: document.getElementById('tf-criacao').value,
    prazo: document.getElementById('tf-prazo').value,
    conclusao: document.getElementById('tf-conclusao').value,
    perc: parseInt(document.getElementById('tf-perc').value) || 0,
    photoUrl: document.getElementById('tf-photo-url').value || '',
    obs: document.getElementById('tf-obs').value
  };
  const editIdx = parseInt(document.getElementById('tf-edit-idx').value) || -1;
  if (editIdx >= 0) {
    DB.tarefas[editIdx] = data;
    toast('Tarefa atualizada!');
  } else {
    DB.tarefas.push(data);
    toast('Tarefa criada!');
  }
  closeModal('modal-tarefa'); await safePersistDB(); renderTarefas();
}

async function editTarefa(idx) {
  await openModal('modal-tarefa');
  document.getElementById('tf-edit-idx').value = idx;
  const t = DB.tarefas[idx];
  document.getElementById('tf-cod').value = t.cod;
  document.getElementById('tf-obra').value = t.obra;
  document.getElementById('tf-etapa').value = t.etapa;
  document.getElementById('tf-frente').value = t.frente;
  document.getElementById('tf-desc').value = t.desc;
  document.getElementById('tf-resp').value = t.resp;
  document.getElementById('tf-prior').value = t.prior;
  document.getElementById('tf-status').value = t.status;
  document.getElementById('tf-criacao').value = t.criacao;
  document.getElementById('tf-prazo').value = t.prazo;
  document.getElementById('tf-conclusao').value = t.conclusao;
  document.getElementById('tf-perc').value = t.perc;
  document.getElementById('tf-photo-url').value = t.photoUrl || '';
  const preview = document.getElementById('tf-photo-preview');
  if (t.photoUrl) {
    preview.style.display = 'block';
    preview.querySelector('img').src = t.photoUrl;
  } else {
    preview.style.display = 'none';
  }
  document.getElementById('tf-obs').value = t.obs || '';
}

async function saveEstoque() {

  const data = {
    cod: document.getElementById('es-cod').value,
    mat: document.getElementById('es-mat').value,
    unid: document.getElementById('es-unid').value,
    obra: document.getElementById('es-obra').value,
    min: parseFloat(document.getElementById('es-min').value) || 0,
    entrada: parseFloat(document.getElementById('es-entrada').value) || 0,
    saida: 0,
    custo: parseFloat(document.getElementById('es-custo').value) || 0,
    obs: document.getElementById('es-obs').value
  };
  const editIdx = parseInt(document.getElementById('es-edit-idx').value) || -1;
  if (editIdx >= 0) {
    if (DB.estoque[editIdx].saida !== undefined) {
      data.saida = DB.estoque[editIdx].saida; // preserve existing usage counter
    }
    DB.estoque[editIdx] = data;
    toast('Item de estoque atualizado!');
  } else {
    DB.estoque.push(data);
    toast('Item de estoque cadastrado!');
  }
  closeModal('modal-estoque'); await safePersistDB(); renderEstoque();
}

async function editEstoque(idx) {
  await openModal('modal-estoque');
  document.getElementById('es-edit-idx').value = idx;
  const e = DB.estoque[idx];
  document.getElementById('es-cod').value = e.cod;
  document.getElementById('es-mat').value = e.mat;
  document.getElementById('es-unid').value = e.unid;
  document.getElementById('es-obra').value = e.obra;
  document.getElementById('es-min').value = e.min;
  document.getElementById('es-entrada').value = e.entrada;
  document.getElementById('es-custo').value = e.custo;
  document.getElementById('es-obs').value = e.obs || '';
}

async function saveMovEstoque() {
  const codMat = document.getElementById('mv-mat').value;
  let e = DB.estoque.find(x => x.cod === codMat);
  const tipo = document.getElementById('mv-tipo').value;
  const qtd = parseFloat(document.getElementById('mv-qtd').value) || 0;

  const obraOrigem = document.getElementById('mv-obra').value;
  const obraDestino = document.getElementById('mv-destino-obra') ? document.getElementById('mv-destino-obra').value : '';
  const matName = document.getElementById('mv-matname').value;

  if (tipo === 'Transferência') {
    if (!obraDestino || obraOrigem === obraDestino) {
      toast('Selecione uma Obra Destino diferente da Origem!', 'error');
      return;
    }

    // 1. Dar baixa na Origem
    if (e) {
      if (qtd > window.calcSaldo(e)) { toast('Qtd. maior que saldo na Origem!', 'error'); return; }
      e.saida += qtd;
    }

    // 2. Localizar/Criar no Destino
    let eDest = DB.estoque.find(x => x.obra === obraDestino && x.mat === e.mat && x.unid === e.unid);
    if (!eDest) {
      eDest = {
        cod: 'MAT-' + Date.now() + Math.floor(Math.random() * 1000),
        mat: e.mat, unid: e.unid, obra: obraDestino,
        min: e.min || 0, entrada: 0, saida: 0, custo: e.custo || 0, obs: 'Transferido.'
      };
      DB.estoque.push(eDest);
    }
    eDest.entrada += qtd;

    // 3. Registrar Movimento de SAÍDA (Origem)
    const dataSaida = {
      data: document.getElementById('mv-data').value,
      codMat, mat: matName,
      obra: obraOrigem,
      tipo: 'Transferência (Saída)', qtd,
      frente: document.getElementById('mv-frente').value,
      retirado: document.getElementById('mv-retirado').value,
      autor: document.getElementById('mv-autor').value,
      nf: document.getElementById('mv-nf').value,
      vunit: parseFloat(document.getElementById('mv-vunit').value) || 0,
      vtotal: parseFloat(document.getElementById('mv-vtotal').value) || 0,
      obs: 'Destino: ' + obraDestino + '. ' + document.getElementById('mv-obs').value
    };
    DB.movEstoque.push(dataSaida);

    // 4. Registrar Movimento de ENTRADA (Destino)
    const dataEntrada = {
      ...dataSaida,
      tipo: 'Transferência (Entrada)',
      obra: obraDestino,
      codMat: eDest.cod,
      obs: 'Origem: ' + obraOrigem + '. ' + document.getElementById('mv-obs').value
    };
    DB.movEstoque.push(dataEntrada);

    toast('Transferência Dupla registrada!');
  } else {
    // Normal Entrada/Saida Logic
    if (e) {
      if (tipo === 'Entrada') e.entrada += qtd;
      else { if (qtd > window.calcSaldo(e)) { toast('Qtd. maior que saldo!', 'error'); return; } e.saida += qtd; }
    }
    const data = {
      data: document.getElementById('mv-data').value,
      codMat, mat: matName,
      obra: obraOrigem,
      tipo, qtd,
      frente: document.getElementById('mv-frente').value,
      retirado: document.getElementById('mv-retirado').value,
      autor: document.getElementById('mv-autor').value,
      nf: document.getElementById('mv-nf').value,
      vunit: parseFloat(document.getElementById('mv-vunit').value) || 0,
      vtotal: parseFloat(document.getElementById('mv-vtotal').value) || 0,
      obs: document.getElementById('mv-obs').value
    };
    const editIdx = parseInt(document.getElementById('mv-edit-idx').value) || -1;
    if (editIdx >= 0) {
      DB.movEstoque[editIdx] = data;
      toast('Movimentação atualizada!');
    } else {
      DB.movEstoque.push(data);
      toast('Movimentação registrada!');
    }
  }

  closeModal('modal-movest'); await safePersistDB(); renderMovEstoque(); renderEstoque();
}

async function editMovEstoque(idx) {
  await openModal('modal-movest');
  document.getElementById('mv-edit-idx').value = idx;
  const m = DB.movEstoque[idx];
  document.getElementById('mv-data').value = m.data;
  document.getElementById('mv-mat').value = m.codMat;
  document.getElementById('mv-matname').value = m.mat;
  document.getElementById('mv-obra').value = m.obra;

  if (m.tipo.includes('Transferência')) {
    document.getElementById('mv-tipo').value = 'Transferência';
    window.toggleDestinoMov();
  } else {
    document.getElementById('mv-tipo').value = m.tipo;
    window.toggleDestinoMov();
  }

  document.getElementById('mv-qtd').value = m.qtd;
  document.getElementById('mv-frente').value = m.frente;
  document.getElementById('mv-retirado').value = m.retirado;
  document.getElementById('mv-autor').value = m.autor;
  document.getElementById('mv-nf').value = m.nf;
  document.getElementById('mv-vunit').value = m.vunit;
  document.getElementById('mv-vtotal').value = m.vtotal;
  document.getElementById('mv-obs').value = m.obs || '';
}

async function saveCompra() {

  const data = {
    num: document.getElementById('cp-num').value,
    data: document.getElementById('cp-data').value,
    obra: document.getElementById('cp-obra').value,
    etapa: document.getElementById('cp-etapa').value,
    mat: document.getElementById('cp-mat').value,
    qtd: parseFloat(document.getElementById('cp-qtd').value) || 0,
    unid: document.getElementById('cp-unid').value,
    status: document.getElementById('cp-status').value,
    forn: document.getElementById('cp-forn').value,
    vunit: parseFloat(document.getElementById('cp-vunit').value) || 0,
    vtotal: parseFloat(document.getElementById('cp-vtotal').value) || 0,
    pixkey: document.getElementById('cp-pixkey').value,
    vorc: parseFloat(document.getElementById('cp-vorc').value) || 0,
    prazo: document.getElementById('cp-prazo').value,
    receb: document.getElementById('cp-receb').value,
    conf: document.getElementById('cp-conf').value,
    obs: document.getElementById('cp-obs').value
  };
  const editIdx = parseInt(document.getElementById('cp-edit-idx').value) || -1;
  if (editIdx >= 0) {
    DB.compras[editIdx] = data;
    toast('Compra atualizada!');
  } else {
    DB.compras.push(data);
    toast('Compra registrada!');
  }
  closeModal('modal-compra'); await safePersistDB(); renderCompras();
}

async function editCompra(idx) {
  await openModal('modal-compra');
  document.getElementById('cp-edit-idx').value = idx;
  const c = DB.compras[idx];
  document.getElementById('cp-num').value = c.num;
  document.getElementById('cp-data').value = c.data;
  document.getElementById('cp-obra').value = c.obra;
  document.getElementById('cp-etapa').value = c.etapa || '';
  document.getElementById('cp-mat').value = c.mat;
  document.getElementById('cp-qtd').value = c.qtd;
  document.getElementById('cp-unid').value = c.unid;
  document.getElementById('cp-status').value = c.status;
  document.getElementById('cp-forn').value = c.forn;
  document.getElementById('cp-vunit').value = c.vunit;
  document.getElementById('cp-vtotal').value = c.vtotal;
  document.getElementById('cp-pixkey').value = c.pixkey || '';
  document.getElementById('cp-vorc').value = c.vorc;
  document.getElementById('cp-prazo').value = c.prazo;
  document.getElementById('cp-receb').value = c.receb;
  document.getElementById('cp-conf').value = c.conf;
  document.getElementById('cp-obs').value = c.obs || '';
}

async function saveFinanceiro() {

  const prev = parseFloat(document.getElementById('fn-prev').value) || 0;
  const real = parseFloat(document.getElementById('fn-real').value) || 0;
  const status = document.getElementById('fn-status').value;
  let valpago = parseFloat(document.getElementById('fn-valpago').value) || 0;

  // Regras de integridade para valpago:
  // - Status "Pago": valpago deve ser o valor total (real > 0 ? real : prev)
  // - Status "Pendente" ou "Atrasado": valpago deve ser zero
  // - Status "Parcial": valpago é o que o usuário digitou
  if (status === 'Pago') {
    valpago = real > 0 ? real : prev;
  } else if (status === 'Pendente' || status === 'Atrasado') {
    valpago = 0;
  }

  const data = {
    data: document.getElementById('fn-data').value,
    obra: document.getElementById('fn-obra').value,
    etapa: document.getElementById('fn-etapa').value,
    tipo: document.getElementById('fn-tipo').value,
    desc: document.getElementById('fn-desc').value,
    forn: document.getElementById('fn-forn').value,
    prev, real,
    pgto: document.getElementById('fn-pgto').value,
    status,
    valpago,
    nf: document.getElementById('fn-nf').value,
    obs: document.getElementById('fn-obs').value
  };

  const editIdx = parseInt(document.getElementById('fn-edit-idx').value) || -1;
  if (editIdx >= 0) {
    DB.financeiro[editIdx] = data;
    let tmsg = 'Lançamento financeiro atualizado!';
    if (status === 'Parcial') {
      const falta = (real > 0 ? real : prev) - valpago;
      tmsg = falta > 0
        ? `Status Parcial: Falta Pagar R$ ${falta.toFixed(2).replace('.', ',')}`
        : 'Status Parcial: Totalmente quitado.';
    }
    toast(tmsg);
  } else {
    DB.financeiro.push(data);
    let tmsg = 'Lançamento financeiro salvo!';
    if (status === 'Parcial') {
      const falta = (real > 0 ? real : prev) - valpago;
      tmsg = falta > 0
        ? `Status Parcial: Falta Pagar R$ ${falta.toFixed(2).replace('.', ',')}`
        : 'Status Parcial: Totalmente quitado.';
    }
    toast(tmsg);
  }
  closeModal('modal-financeiro'); await safePersistDB(); renderFinanceiro(); renderDashboard();
}

async function editFinanceiro(idx) {
  await openModal('modal-financeiro');
  document.getElementById('fn-edit-idx').value = idx;
  const f = DB.financeiro[idx];
  document.getElementById('fn-data').value = f.data;
  document.getElementById('fn-obra').value = f.obra;
  document.getElementById('fn-etapa').value = f.etapa;
  document.getElementById('fn-tipo').value = f.tipo;
  document.getElementById('fn-desc').value = f.desc;
  document.getElementById('fn-forn').value = f.forn;
  document.getElementById('fn-prev').value = f.prev;
  document.getElementById('fn-real').value = f.real;
  document.getElementById('fn-pgto').value = f.pgto || 'PIX';
  document.getElementById('fn-status').value = f.status;
  document.getElementById('fn-valpago').value = f.valpago || '';
  document.getElementById('fn-nf').value = f.nf || '';
  document.getElementById('fn-obs').value = f.obs || '';
  calcFinDiff(); // Atualiza o campo Diferença ao abrir
  toggleParcial('fn'); // Mostra/oculta campo de valpago
  if (f.status === 'Parcial') window.calcParcial('fn'); // Exibe "Falta Pagar" imediatamente
}

// calcOrcTotal migrado para orcamento.js

async function saveOrcamento() {

  const qtd = parseFloat(document.getElementById('oc-qtd').value) || 0;
  const vunit = parseFloat(document.getElementById('oc-vunit').value) || 0;
  const data = {
    obra: document.getElementById('oc-obra').value,
    etapa: document.getElementById('oc-etapa').value,
    tipo: document.getElementById('oc-tipo').value,
    desc: document.getElementById('oc-desc').value,
    qtd, unid: document.getElementById('oc-unid').value,
    vunit, vtotal: qtd * vunit, vreal: 0,
    obs: document.getElementById('oc-obs').value
  };
  const editIdx = parseInt(document.getElementById('oc-edit-idx').value) || -1;
  if (editIdx >= 0) {
    if (DB.orcamento[editIdx].vreal !== undefined) {
      data.vreal = DB.orcamento[editIdx].vreal; // preserve the current progress amount
    }
    DB.orcamento[editIdx] = data;
    toast('Item de orçamento atualizado!');
  } else {
    DB.orcamento.push(data);
    toast('Item de orçamento salvo!');
  }
  closeModal('modal-orcamento'); await safePersistDB(); renderOrcamento();
}

async function editOrcamento(idx) {
  await openModal('modal-orcamento');
  document.getElementById('oc-edit-idx').value = idx;
  const o = DB.orcamento[idx];
  document.getElementById('oc-obra').value = o.obra;
  document.getElementById('oc-etapa').value = o.etapa;
  document.getElementById('oc-tipo').value = o.tipo;
  document.getElementById('oc-desc').value = o.desc;
  document.getElementById('oc-qtd').value = o.qtd;
  document.getElementById('oc-unid').value = o.unid;
  document.getElementById('oc-vunit').value = o.vunit;
  document.getElementById('oc-vtotal').value = o.vtotal;
  document.getElementById('oc-obs').value = o.obs || '';
}

async function saveMedicao() {

  const qprev = parseFloat(document.getElementById('md-qprev').value) || 0;
  const qreal = parseFloat(document.getElementById('md-qreal').value) || 0;
  const vunit = parseFloat(document.getElementById('md-vunit').value) || 0;
  const data = {
    semana: document.getElementById('md-semana').value,
    obra: document.getElementById('md-obra').value,
    etapa: document.getElementById('md-etapa').value,
    frente: document.getElementById('md-frente').value,
    equipe: document.getElementById('md-equipe').value,
    servico: document.getElementById('md-servico').value,
    unid: document.getElementById('md-unid').value,
    qprev, qreal,
    vunit, vtotal: qreal * vunit,
    retr: document.getElementById('md-retr').value,
    pgtoStatus: document.getElementById('md-pgto-status').value,
    valpago: parseFloat(document.getElementById('md-valpago').value) || 0,
    photoUrl: document.getElementById('md-photo-url').value || '',
    obs: document.getElementById('md-obs').value
  };
  const editIdx = parseInt(document.getElementById('md-edit-idx').value) || -1;
  if (editIdx >= 0) {
    DB.medicao[editIdx] = data;
    let tmsg = 'Medição atualizada!';
    if (data.pgtoStatus === 'Parcial') tmsg = `Status Parcial: Falta Pagar R$ ${(data.vtotal - data.valpago).toFixed(2).replace('.', ',')}`;
    toast(tmsg);
  } else {
    DB.medicao.push(data);
    let tmsg = 'Medição salva!';
    if (data.pgtoStatus === 'Parcial') tmsg = `Status Parcial: Falta Pagar R$ ${(data.vtotal - data.valpago).toFixed(2).replace('.', ',')}`;
    toast(tmsg);
  }
  closeModal('modal-medicao'); await safePersistDB(); renderMedicao && renderMedicao(); renderFinanceiro && renderFinanceiro(); renderDashboard && renderDashboard();
}

async function editMedicao(idx) {
  await openModal('modal-medicao');
  document.getElementById('md-edit-idx').value = idx;
  const m = DB.medicao[idx];
  document.getElementById('md-semana').value = m.semana;
  document.getElementById('md-obra').value = m.obra;
  document.getElementById('md-etapa').value = cleanInput(m.etapa);
  document.getElementById('md-frente').value = cleanInput(m.frente);
  document.getElementById('md-equipe').value = cleanInput(m.equipe);
  document.getElementById('md-servico').value = cleanInput(m.servico);
  document.getElementById('md-unid').value = cleanInput(m.unid);
  document.getElementById('md-qprev').value = m.qprev;
  document.getElementById('md-qreal').value = m.qreal;
  document.getElementById('md-vunit').value = m.vunit || 0;
  document.getElementById('md-vtotal').value = m.vtotal || 0;
  document.getElementById('md-retr').value = m.retr;
  document.getElementById('md-pgto-status').value = m.pgtoStatus || 'Pendente';
  document.getElementById('md-valpago').value = m.valpago || '';
  document.getElementById('md-photo-url').value = m.photoUrl || '';
  toggleParcial('md');
  const preview = document.getElementById('md-photo-preview');
  if (m.photoUrl) {
    preview.style.display = 'block';
    preview.querySelector('img').src = m.photoUrl;
  } else {
    preview.style.display = 'none';
  }
  document.getElementById('md-obs').value = cleanInput(m.obs);
}

// saveUsuario migrado para admin.js

// ==================== DELETE ====================
function deleteItem(table, idx) {
  if (!confirm('Remover este registro?')) return;
  if (idx < 0 || idx >= DB[table].length) {
    toast('Erro: Índice inválido. Recarregue a página.', 'error');
    return;
  }
  DB[table].splice(idx, 1);
  persistDB();
  const activePageEl = document.querySelector('.page.active');
  if (activePageEl) {
    const pageId = activePageEl.id.replace('page-', '');
    renderPage(pageId);
  } else {
    // Fallback refresh for critical tabs
    if (table === 'orcamento') renderOrcamento();
    if (table === 'financeiro') renderFinanceiro();
  }
  toast('Removido!');
}

// ==================== FILTER TABLE ====================
function filterTable(tbodyId, query, cols) {
  const q = query.toLowerCase();
  const rows = document.getElementById(tbodyId).querySelectorAll('tr:not(.empty-row)');
  rows.forEach(r => {
    const cells = r.querySelectorAll('td');
    const match = cols.some(ci => cells[ci] && cells[ci].textContent.toLowerCase().includes(q));
    r.style.display = match || !q ? '' : 'none';
  });
}

// ==================== TOAST ====================
function toast(msg, type = 'success') {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  safeSetInner(el, `${type === 'success' ? '✅' : '❌'} ${sanitizeHTML(msg)}`);
  c.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ==================== INIT ====================
window.onclick = function (e) {
  const container = document.getElementById('modal-container');
  if (e.target === container) closeModal(); // Fecha qualquer modal que estiver aberto se clicar fora
};

document.getElementById('header-date').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

// renderDashboard(); // SaaS: Removido disparo automático. Será chamado em auth.js após controle de acesso.

// SaaS: Disparo de checkAuth removido daqui (movido para o final do arquivo para evitar duplicidade)

// ==================== MASTER SYSTEM LOGIC ====================
function openNewTenantModal() {
  const content = document.getElementById('modal-create-tenant').innerHTML;
  const container = document.getElementById('modal-content');
  safeSetInner(container, content);
  document.getElementById('modal-container').classList.add('open');
}

async function saveNewTenant() {
  // Busca dentro do container do modal para evitar pegar o template duplicado
  const modal = document.getElementById('modal-content');
  const nome = modal.querySelector('#ct-nome').value.trim();
  let slugVal = modal.querySelector('#ct-slug').value.trim().toLowerCase();
  const emailOwner = modal.querySelector('#ct-email').value.trim().toLowerCase();
  const lobras = parseInt(modal.querySelector('#ct-limite-obras').value) || 0;
  const lusr = parseInt(modal.querySelector('#ct-limite-usr').value) || 0;

  if (!nome) return toast('Preencha o nome da empresa.', 'error');
  if (!slugVal) return toast('Preencha o subdomínio.', 'error');
  if (!emailOwner) return toast('Preencha o e-mail do administrador.', 'error');

  slugVal = slugVal.replace(/[^a-z0-9]/g, '');
  if (!slugVal) return toast('O subdomínio deve conter letras e números.', 'error');

  // Validação básica de e-mail
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailOwner)) return toast('Digite um e-mail válido.', 'error');

  try {
    // Verificar se subdomínio já existe
    const existingSlug = await firebase.database().ref('tenants_public').orderByChild('slug').equalTo(slugVal).once('value');
    if (existingSlug.exists()) {
      return toast(`O subdomínio "${slugVal}" já está sendo usado por outra empresa!`, 'error');
    }

    // 1. Criar Estrutura do Tenant (Padrão SaaS Unificado)
    // Nota: o ID do tenant é o próprio slug para facilitar lookup direto
    await firebase.database().ref(`tenants/${slugVal}`).set({
      nomeEmpresa: nome,
      slug: slugVal,
      emailAdmin: emailOwner,
      status: 'ativo',
      plano: 'premium', // Começa como Premium por ser manual do Admin
      planoVencimento: Date.now() + (31 * 24 * 60 * 60 * 1000),
      webhookCriacao: Date.now(),
      config: {
        nomeEmpresa: nome,
        slug: slugVal,
        esquemaCores: 'emerald',
        limiteObras: lobras,
        limiteUsuarios: lusr,
        limiteTrabalhadores: 9999
      }
    });

    const sanitizedEmail = emailOwner.replace(/\./g, ',');

    // 2. Inserir no Novo Título Global (Painel Mestre e Passaporte)
    await firebase.database().ref(`users/${sanitizedEmail}`).set({
      email: emailOwner, // <--- Adicionado para regras de segurança
      tenantId: slugVal,
      role: 'admin',
      nome: nome,
      origem: 'super_admin_manual'
    });

    // 3. Espelhar slug no nó público (para leitura da logo antes do login)
    await firebase.database().ref(`tenants_public/${slugVal}`).set({
      slug: slugVal,
      nomeEmpresa: nome,
      esquemaCores: 'emerald'
    });

    toast('Empresa criada! O dono já pode logar com seu e-mail.');
    closeModal();
    renderSuperAdmin();
  } catch (err) {
    console.error(err);
    toast('Erro ao criar empresa.', 'error');
  }
}

function changeMasterPassword() {
  const newVal = document.getElementById('master-new-password')?.value;
  if (!newVal || newVal.length < 6) {
    return toast('A nova senha deve ter no mínimo 6 caracteres.', 'error');
  }
  const user = firebase.auth().currentUser;
  if (!user) return toast('Você precisa estar logado para alterar a senha.', 'error');

  user.updatePassword(newVal)
    .then(() => {
      toast('Senha do Mestre alterada com sucesso! Use no próximo login.');
      document.getElementById('master-new-password').value = '';
    })
    .catch(err => {
      console.error('Erro na senha:', err);
      if (err.code === 'auth/requires-recent-login') {
        toast('Sua sessão expirou. Deslogue e logue novamente para redefinir.', 'error');
      } else {
        toast('Falha ao alterar senha. ' + err.message, 'error');
      }
    });
}

// ==================== PHOTO MANAGEMENT & LIGHTBOX ====================
async function handleFileUpload(input, previewId, urlInputId) {
  const file = input.files[0];
  if (!file) return;

  // Log para depuração inicial
  console.log('Iniciando Upload:', { name: file.name, size: file.size, type: file.type });

  if (typeof firebase.storage !== 'function') {
    console.error('Firebase Storage SDK not loaded!');
    toast('Erro: SDK de Storage não carregado.', 'error');
    return;
  }

  // Verifica se o bucket está configurado
  const bucket = firebase.app().options.storageBucket;
  if (!bucket) {
    console.error('Storage Bucket não configurado no firebaseConfig!');
    toast('Erro: Bucket de Storage não configurado.', 'error');
    return;
  }
  console.log('Usando Bucket:', bucket);

  const user = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
  const tid = user.tenantId || 'global';

  toast('Enviando foto...', 'success');

  try {
    const storage = firebase.storage();
    const storageRef = storage.ref();
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const filePath = `tenants/${tid}/evidencias/${fileName}`;
    const fileRef = storageRef.child(filePath);

    console.log('Caminho do Arquivo:', filePath);

    const metadata = { contentType: file.type };
    const uploadTask = fileRef.put(file, metadata);

    // Acompanhamento de progresso opcional (para debug futuro)
    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log('Upload is ' + progress + '% done');
      },
      (error) => { throw error; }
    );

    await uploadTask;
    const url = await fileRef.getDownloadURL();
    console.log('Upload concluído! URL:', url);

    safeSetValue(urlInputId, url);
    const preview = document.getElementById(previewId);
    if (preview) {
      preview.style.display = 'block';
      const img = preview.querySelector('img');
      if (img) img.src = url;
    }

    toast('Foto enviada com sucesso!');
  } catch (err) {
    console.error('Upload Error Completo:', err);
    let errorMsg = 'Erro ao enviar foto.';

    if (err.code === 'storage/unauthorized') {
      errorMsg = 'Erro de Permissão (Confirme as Regras do Storage).';
    } else if (err.code === 'storage/quota-exceeded') {
      errorMsg = 'Limite de armazenamento atingido.';
    } else if (err.code === 'storage/retry-limit-exceeded') {
      errorMsg = 'Tempo limite excedido. Verifique sua conexão ou se o Storage está ativo.';
    } else if (err.code === 'storage/unknown') {
      errorMsg = 'Erro desconhecido no Firebase Storage.';
    }

    toast(`${errorMsg} (${err.code || 'Ver console'})`, 'error');
  }
}



function openLightbox(url) {
  let lb = document.getElementById('lightbox-container');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'lightbox-container';
    lb.className = 'lightbox-overlay';
    lb.onclick = closeLightbox;
    safeSetInner(lb, `<div class="lightbox-content"><img src=""><span class="lightbox-close">×</span></div>`);
    document.body.appendChild(lb);
  }
  lb.querySelector('img').src = url;
  lb.classList.add('open');
}

function closeLightbox() {
  document.getElementById('lightbox-container').classList.remove('open');
}

// SaaS: Inicialização ÚNICA e SEGURA após carregamento de todos os componentes
if (typeof window.safeCheckAuth === 'function') {
  window.safeCheckAuth();
}

// FECHAR SIDEBAR AO CLICAR FORA (Mobile / Dashboard Overlay)
document.addEventListener('click', (event) => {
  const sidebar = document.querySelector('.sidebar');
  const menuToggle = document.querySelector('.menu-toggle');
  
  if (sidebar && sidebar.classList.contains('open')) {
    // Se o clique não foi dentro da sidebar E não foi no botão de abrir o menu...
    if (!sidebar.contains(event.target) && !menuToggle.contains(event.target)) {
      sidebar.classList.remove('open');
    }
  }
});

// ==================== SYNC STATUS FEEDBACK ====================
window.addEventListener('syncStatus', (e) => {
  const { status, code } = e.detail;
  let indicator = document.getElementById('sync-indicator');
  
  if (!indicator) {
    const container = document.querySelector('.header-right');
    if (!container) return;
    indicator = document.createElement('div');
    indicator.id = 'sync-indicator';
    indicator.className = 'sync-indicator';
    container.prepend(indicator);
  }

  indicator.style.opacity = '1';
  indicator.onclick = null; // Reseta clique
  indicator.style.cursor = 'default';
  if (status === 'syncing') {
    indicator.innerHTML = '<div class="sync-dot spinning"></div><span>Sincronizando...</span>';
    indicator.className = 'sync-indicator syncing';
  } else if (status === 'synced') {
    indicator.innerHTML = '<div class="sync-dot"></div><span>Sincronizado</span>';
    indicator.className = 'sync-indicator synced';
    setTimeout(() => {
      if (indicator.classList.contains('synced')) indicator.style.opacity = '0.3'; 
    }, 3000);
  } else if (status === 'error') {
    const msg = code === 'PERMISSION_DENIED' ? 'Acesso Negado (Firebase)' : 
                code === 'DISCONNECTED' ? 'Sem Conexão' : 'Erro na Nuvem';
    
    indicator.innerHTML = `<div class="sync-dot"></div><span>${msg}</span> 
                           <button class="sync-retry-btn" onclick="persistDB(true); event.stopPropagation();">🔄 Tentar Agora</button>`;
    indicator.className = 'sync-indicator error';
    indicator.title = `Código do Erro: ${code}`;
    indicator.style.cursor = 'pointer';
    indicator.onclick = () => persistDB(true);
  }
});







