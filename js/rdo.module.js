/**
 * ObraReal - Modulo RDO (Relatorio Diario de Obra)
 * Arquivo: js/rdo.module.js
 */

'use strict';

// Configuracao de cargos e maquinas
const CARGOS = [
  { id: 'encarregado',  label: 'Encarregado'      },
  { id: 'apontador',    label: 'Apontador'         },
  { id: 'pedreiro',     label: 'Pedreiro'          },
  { id: 'servente',     label: 'Servente'          },
  { id: 'op_betoneira', label: 'Op. Betoneira'     },
  { id: 'almoxarifado', label: 'Almoxarifado'      },
  { id: 'encanador',    label: 'Encanador'         },
  { id: 'eletricista',  label: 'Eletricista'       },
  { id: 'pintor',       label: 'Pintor'            },
  { id: 'gesseiro',     label: 'Gesseiro'          },
  { id: 'ceramista',    label: 'Ceramista'         },
  { id: 'motorista',    label: 'Motorista'         },
  { id: 'limpeza',      label: 'Eq. Limpeza'       },
];

const MAQUINAS = [
  { id: 'cacamba',       label: 'Caçamba'            },
  { id: 'bobcat',        label: 'Bob Cat'             },
  { id: 'retro',         label: 'Retroescavadeira'    },
  { id: 'mini_retro',    label: 'Mini Retro'          },
  { id: 'cam_basculante',label: 'Cam. Basculante'     },
  { id: 'cam_munck',     label: 'Cam. Munck'          },
  { id: 'betoneira',     label: 'Betoneira'           },
];

// Estado interno
let _obraId    = null;
let _obraAtual = null;
let _chuvaOn   = true;
let _rdoRef    = null;

// Injetar o HTML do modal no body
function _injetarModal() {
  if (document.getElementById('rdo-overlay')) return;
  fetch('modals/rdo.modal.html')
    .then(r => r.text())
    .then(html => {
      const div = document.createElement('div');
      div.innerHTML = html;
      document.body.appendChild(div);
      _construirGrids();
    })
    .catch(err => console.error('[RDO] Erro ao carregar modal:', err));
}

// Construir grids de cargos e maquinas
function _construirGrids() {
  const cargosEl = document.getElementById('rdo-cargos-container');
  const maqEl    = document.getElementById('rdo-maquinas-container');
  if (!cargosEl || !maqEl) return;

  cargosEl.innerHTML = CARGOS.map(c => `
    <div class="rdo-counter-item">
      <span class="rdo-counter-label" title="${c.label}">${c.label}</span>
      <input class="rdo-counter-input rdo-field input"
             type="number" min="0" value="0"
             id="rdo-cargo-${c.id}"
             onchange="window.rdoCalcTotal()">
    </div>`).join('');

  maqEl.innerHTML = MAQUINAS.map(m => `
    <div class="rdo-counter-item">
      <span class="rdo-counter-label" title="${m.label}">${m.label}</span>
      <input class="rdo-counter-input rdo-field input"
             type="number" min="0" value="0"
             id="rdo-maq-${m.id}">
    </div>`).join('');
}

// API publica: abrir modal
window.rdoAbrir = function (obraId, obraData) {
  _obraId    = obraId    || null;
  _obraAtual = obraData  || {};

  const overlay = document.getElementById('rdo-overlay');
  if (!overlay) {
    _injetarModal();
    setTimeout(() => window.rdoAbrir(obraId, obraData), 400);
    return;
  }

  const user = _userProfile();
  _set('rdo-empresa',     _obraAtual.empresa   || user.empresa || '');
  _set('rdo-obra',        _obraAtual.nome      || '');
  _set('rdo-responsavel', _obraAtual.responsavel || user.name || '');
  _set('rdo-data',        _hoje());

  CARGOS.forEach(c    => _set('rdo-cargo-' + c.id,  0));
  MAQUINAS.forEach(m  => _set('rdo-maq-'   + m.id,  0));
  window.rdoCalcTotal();

  _chuvaOn = true;
  _setChuvaUI(true);
  _set('rdo-chuva-inicio',   '');
  _set('rdo-chuva-fim',      '');
  _set('rdo-chuva-impacto',  'parcial');
  _set('rdo-atividades',     '');
  _set('rdo-ocorrencias',    '');
  _set('rdo-ass-apontador',  '');
  _set('rdo-ass-encarregado','');
  _set('rdo-ass-engenheiro', '');

  window.rdoAba('editor', document.querySelector('.rdo-tab'));
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

// Fechar modal
window.rdoFechar = function () {
  const overlay = document.getElementById('rdo-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
  if (_rdoRef) { _rdoRef.off(); _rdoRef = null; }
};

window.rdoFecharSeFora = function (e) {
  if (e.target.id === 'rdo-overlay') window.rdoFechar();
};

// Trocar abas
window.rdoAba = function (nome, btnEl) {
  document.getElementById('rdo-aba-editor')    .style.display = nome === 'editor'    ? '' : 'none';
  document.getElementById('rdo-aba-historico') .style.display = nome === 'historico' ? '' : 'none';
  document.querySelectorAll('.rdo-tab').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  if (nome === 'historico') _carregarHistorico();
};

// Toggle chuva
window.rdoChuva = function (tipo) {
  _chuvaOn = tipo === 'com';
  _setChuvaUI(_chuvaOn);
};

function _setChuvaUI(on) {
  const sem = document.getElementById('rdo-tog-sem');
  const com = document.getElementById('rdo-tog-com');
  const det = document.getElementById('rdo-chuva-detalhe');
  if (!sem) return;
  sem.classList.toggle('on', !on);
  com.classList.toggle('on',  on);
  if (det) det.style.display = on ? 'flex' : 'none';
}

// Calcular total de efetivo
window.rdoCalcTotal = function () {
  let total = 0;
  CARGOS.forEach(c => {
    const el = document.getElementById('rdo-cargo-' + c.id);
    if (el) total += parseInt(el.value) || 0;
  });
  const el = document.getElementById('rdo-total-efetivo');
  if (el) el.textContent = total;
};

// Coletar dados do formulario
function _coletarDados() {
  const efetivo  = {};
  const maquinas = {};

  CARGOS.forEach(c => {
    efetivo[c.id] = parseInt(_get('rdo-cargo-' + c.id)) || 0;
  });
  MAQUINAS.forEach(m => {
    maquinas[m.id] = parseInt(_get('rdo-maq-' + m.id)) || 0;
  });

  return {
    empresa:     _get('rdo-empresa'),
    obra:        _get('rdo-obra'),
    data:        _get('rdo-data'),
    responsavel: _get('rdo-responsavel'),
    clima:       _get('rdo-clima'),
    chuva: {
      houve:   _chuvaOn,
      inicio:  _chuvaOn ? _get('rdo-chuva-inicio')  : '',
      fim:     _chuvaOn ? _get('rdo-chuva-fim')      : '',
      impacto: _chuvaOn ? _get('rdo-chuva-impacto')  : '',
    },
    efetivo,
    maquinas,
    atividades:  _get('rdo-atividades'),
    ocorrencias: _get('rdo-ocorrencias'),
    assinaturas: {
      apontador:   _get('rdo-ass-apontador'),
      encarregado: _get('rdo-ass-encarregado'),
      engenheiro:  _get('rdo-ass-engenheiro'),
    },
    criadoEm:  Date.now(),
    criadoPor: _uid(),
  };
}

// Salvar no Firebase
window.rdoSalvar = async function () {
  const dados = _coletarDados();
  if (!dados.data) {
    if (typeof toast === 'function') toast('Informe a data do RDO.', 'error');
    return;
  }

  const tenantId = _tenantId();
  const obraKey = _obraId || 'sem_obra';
  const dataKey = dados.data;

  if (!tenantId) {
    console.error('[RDO] Erro: Tenant nao identificado.');
    if (typeof toast === 'function') toast('Erro: Empresa nao identificada.', 'error');
    return;
  }

  console.log(`[RDO] Tentando salvar em: rdos/${tenantId}/${obraKey}/${dataKey}`);

  try {
    await firebase.database()
      .ref(`rdos/${tenantId}/${obraKey}/${dataKey}`)
      .set(dados);

    if (typeof toast === 'function') toast('✅ RDO salvo com sucesso!');
  } catch (err) {
    console.error('[RDO] Erro ao salvar:', err);
    if (err.code === 'PERMISSION_DENIED') {
      if (typeof toast === 'function') toast('Erro de permissao: Verifique seu login.', 'error');
    } else {
      if (typeof toast === 'function') toast('Erro ao salvar RDO.', 'error');
    }
  }
};

// Carregar historico
function _carregarHistorico() {
  const lista = document.getElementById('rdo-hist-lista');
  if (!lista) return;
  lista.innerHTML = '<div style="text-align:center;color:var(--text3);padding:24px;font-size:13px">Carregando...</div>';

  const tenantId = _tenantId();
  const obraKey = _obraId || 'sem_obra';
  if (_rdoRef) _rdoRef.off();

  if (!tenantId) return;
  _rdoRef = firebase.database().ref(`rdos/${tenantId}/${obraKey}`);
  _rdoRef.orderByKey().limitToLast(30).once('value', snap => {
    const items = [];
    snap.forEach(child => items.unshift({ key: child.key, val: child.val() }));

    if (items.length === 0) {
      lista.innerHTML = '<div style="text-align:center;color:var(--text3);padding:24px;font-size:13px">Nenhum RDO salvo ainda.</div>';
      return;
    }

    lista.innerHTML = items.map(({ key, val }) => {
      const totalEfetivo = Object.values(val.efetivo || {}).reduce((a, b) => a + b, 0);
      const chuvaInfo    = val.chuva?.houve
        ? `🌧️ ${val.chuva.inicio}–${val.chuva.fim}`
        : '☀️ Sem chuva';
      return `
        <div class="rdo-hist-item">
          <span class="rdo-hist-date">${_formatarData(key)}</span>
          <span class="rdo-hist-info">👷 ${totalEfetivo} efetivo &nbsp;·&nbsp; ${chuvaInfo}</span>
          <button class="rdo-hist-btn" onclick="rdoCarregarDia('${key}')">Ver</button>
          <button class="rdo-hist-btn" onclick="rdoExportarDia('${key}')">PDF</button>
        </div>`;
    }).join('');
  });
}

// Carregar RDO de um dia especifico no editor
window.rdoCarregarDia = function (dataKey) {
  return new Promise((resolve) => {
    const tenantId = _tenantId();
    const obraKey = _obraId || 'sem_obra';
    if (!tenantId) return resolve(false);

    console.log(`[RDO] Lendo de: rdos/${tenantId}/${obraKey}/${dataKey}`);
    firebase.database().ref(`rdos/${tenantId}/${obraKey}/${dataKey}`).once('value', snap => {
      const d = snap.val();
      if (!d) {
        if (typeof toast === 'function') toast('RDO nao encontrado.', 'error');
        return resolve(false);
      }

      _set('rdo-empresa',     d.empresa     || '');
      _set('rdo-obra',        d.obra        || '');
      _set('rdo-data',        d.data        || dataKey);
      _set('rdo-responsavel', d.responsavel || '');
      _set('rdo-clima',       d.clima       || 'nublado');

      CARGOS.forEach(c => _set('rdo-cargo-' + c.id, (d.efetivo && d.efetivo[c.id]) || 0));
      MAQUINAS.forEach(m => _set('rdo-maq-'   + m.id, (d.maquinas && d.maquinas[m.id]) || 0));
      window.rdoCalcTotal();

      _chuvaOn = d.chuva?.houve !== false;
      _setChuvaUI(_chuvaOn);
      _set('rdo-chuva-inicio',  d.chuva?.inicio  || '');
      _set('rdo-chuva-fim',     d.chuva?.fim     || '');
      _set('rdo-chuva-impacto', d.chuva?.impacto || 'parcial');

      _set('rdo-atividades',  d.atividades  || '');
      _set('rdo-ocorrencias', d.ocorrencias || '');
      _set('rdo-ass-apontador',   d.assinaturas?.apontador   || '');
      _set('rdo-ass-encarregado', d.assinaturas?.encarregado || '');
      _set('rdo-ass-engenheiro',  d.assinaturas?.engenheiro  || '');

      window.rdoAba('editor', document.querySelectorAll('.rdo-tab')[0]);
      resolve(true);
    });
  });
};

// Exportar PDF
window.rdoExportarDia = async function (dataKey) {
  const ok = await window.rdoCarregarDia(dataKey);
  if (ok) {
    setTimeout(() => window.rdoGerarPDF(), 300);
  }
};

window.rdoGerarPDF = function () {
  window.print();
};

// Registrar pagina no sistema
function _registrarPagina() {
  const tentativas = 30;
  let n = 0;
  const loop = setInterval(() => {
    n++;
    if (n > tentativas) { clearInterval(loop); return; }

    if (typeof window.registerPage === 'function') {
      window.registerPage('rdo', () => {
        const obraAtiva = window.obraAtiva || window.currentObra || null;
        window.rdoAbrir(obraAtiva?.id || null, obraAtiva || {});
      });
      clearInterval(loop);
      return;
    }

    if (typeof window.showPage === 'function' && !window._rdoHooked) {
      const _orig = window.showPage;
      window.showPage = function (pagina, ...args) {
        if (pagina === 'rdo') {
          const obraAtiva = window.obraAtiva || window.currentObra || null;
          window.rdoAbrir(obraAtiva?.id || null, obraAtiva || {});
          return;
        }
        return _orig.call(this, pagina, ...args);
      };
      window._rdoHooked = true;
      clearInterval(loop);
    }
  }, 200);
}

// Botao dashboard
window.rdoAbrirDaObra = function (obraObj) {
  window.rdoAbrir(obraObj?.id || obraObj?.key || null, obraObj || {});
};

// Helpers
function _hoje() {
  return new Date().toISOString().split('T')[0];
}

function _formatarData(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function _get(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function _set(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function _uid() {
  try { return firebase.auth().currentUser?.uid || 'anon'; } catch { return 'anon'; }
}

function _tenantId() {
  try {
    const user = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
    const tid = user.tenantId || window.CURRENT_TENANT_ID || null;
    return (tid && tid !== 'undefined') ? tid : null;
  } catch { 
    return window.CURRENT_TENANT_ID || null; 
  }
}

function _userProfile() {
  try {
    return JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
  } catch { return {}; }
}

// Init
window.addEventListener('DOMContentLoaded', () => {
  _injetarModal();
  _registrarPagina();
});
