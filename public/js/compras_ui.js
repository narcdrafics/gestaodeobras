// ==================== COMPRAS — SEGREGAÇÃO DE DADOS COMERCIAIS ====================
// `forn`, `pixkey`, `vunit`, `vtotal`, `vorc` e `prazo` NÃO ficam no nó do tenant:
//engenheiro/encarregado podem ler o tenant inteiro, então esconder input não
// bastaria. Eles ficam em `comprasPrivadas/{tenantId}/{id}` com rules próprias.
(function () {
  'use strict';

  const SENSITIVE = ['forn', 'pixkey', 'vunit', 'vtotal', 'vorc', 'prazo'];

  let privadas = {};
  let ref = null;
  let tenantAtual = null;

  function sessao() {
    try { return JSON.parse(sessionStorage.getItem('gestaoUser') || '{}') || {}; }
    catch (e) { return {}; }
  }

  function papel() {
    const role = sessao().role || 'admin';
    return window.normalizeRole ? window.normalizeRole(role) : (role === 'mestre' ? 'encarregado' : role);
  }

  function tenantId() {
    try {
      if (typeof superAdminActiveTenant !== 'undefined' && superAdminActiveTenant && superAdminActiveTenant.id) {
        return superAdminActiveTenant.id;
      }
    } catch (e) { /* pode não existir fora do app */ }
    return sessao().tenantId || window.OBRA_CHECKOUT_TENANT_ID || '';
  }

  /** Admin/super/comprador, ou RH com o módulo de compras habilitado. */
  function podeVerDadosComerciais() {
    const role = papel();
    if (role === 'admin' || role === 'super_admin' || role === 'comprador') return true;
    if (role !== 'rh') return false;
    const modulos = sessao().modulosPermitidos || {};
    return modulos.compras === true;
  }
  window.podeVerDadosComerciais = podeVerDadosComerciais;

  function iniciarCompras() {
    const tid = tenantId();
    if (!tid || typeof firebase === 'undefined' || !firebase.database) return;
    if (!podeVerDadosComerciais()) {
      if (ref) { ref.off(); ref = null; }
      privadas = {};
      window.COMPRAS_PRIVADAS = privadas;
      return;
    }
    if (tenantAtual === tid && ref) return;
    if (ref) ref.off();
    tenantAtual = tid;
    ref = firebase.database().ref(`comprasPrivadas/${tid}`);
    ref.on('value', (snap) => {
      privadas = snap.val() || {};
      window.COMPRAS_PRIVADAS = privadas;
      if (typeof window.renderCompras === 'function') window.renderCompras();
    }, (erro) => console.warn('[compras] erro ao ler dados comerciais:', erro && erro.code));
  }
  window.iniciarCompras = iniciarCompras;
  window.addEventListener('firebaseSync', () => iniciarCompras());

  /** Valor comercial da compra: prioriza o nó privado, com fallback legado. */
  function dadoComercial(compra, campo) {
    if (!SENSITIVE.includes(campo)) return compra && compra[campo];
    const chave = compra && (compra.id || compra.num);
    const privada = (chave && privadas[chave]) || {};
    const valor = privada[campo];
    return valor !== undefined ? valor : (compra ? compra[campo] : undefined);
  }
  window.dadoComercial = dadoComercial;

  /** Grava só os dados sensíveis; o registro público vai por persistDB(). */
  async function salvarDadosComerciais(id, dados) {
    if (!id || !podeVerDadosComerciais()) return;
    const sensiveis = {};
    SENSITIVE.forEach(campo => {
      if (dados[campo] !== undefined) sensiveis[campo] = dados[campo];
    });
    if (!Object.keys(sensiveis).length) return;
    const tid = tenantId();
    try {
      await firebase.database().ref(`comprasPrivadas/${tid}/${id}`).update({
        ...sensiveis,
        compraId: id,
        criadoEm: Date.now()
      });
    } catch (e) {
      console.error('[compras] falha ao salvar dados comerciais:', e);
      if (typeof toast === 'function') toast('Compra salva, mas os dados comerciais não puderam ser gravados.', 'warning');
    }
  }
  window.salvarDadosComerciais = salvarDadosComerciais;

  /** Remove campos sensíveis do registro público (defesa em profundidade). */
  function compraPublica(dados) {
    const publica = { ...dados };
    SENSITIVE.forEach(campo => { delete publica[campo]; });
    return publica;
  }
  window.compraPublica = compraPublica;

  /** Ajusta o modal conforme o papel: campos comerciais só para quem pode ver. */
  function prepareModalCompra(root) {
    const alvo = root || document;
    if (!podeVerDadosComerciais()) {
      SENSITIVE.forEach(campo => {
        const el = alvo.querySelector(`#cp-${campo}`);
        const grupo = el && el.closest('.form-group');
        if (grupo) grupo.style.display = 'none';
      });
    }
    if (typeof window.requerAprovacao === 'function' && window.requerAprovacao()) {
      const btn = alvo.querySelector('#modal-compra button.btn-primary');
      if (btn) {
        btn.textContent = 'Enviar para aprovação';
        btn.onclick = () => { if (typeof window.saveCompra === 'function') window.saveCompra(); };
      }
    }
  }
  window.prepareModalCompra = prepareModalCompra;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => iniciarCompras());
  } else {
    iniciarCompras();
  }
})();
