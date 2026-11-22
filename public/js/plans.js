/**
 * public/js/plans.js
 * Catálogo único de planos e ponto de checkout (landing + app + painel master).
 *
 * Usado por index.html (landing), app.html e páginas internas. Manter aqui os
 * preços, limites e links evita que a landing anuncie um plano que o checkout
 * não sabe vender. O espelho server-side é functions/plan_catalog.js
 * (tests/super-admin.test.js valida os limites e links).
 */
(function () {
  'use strict';

  // Planos anuais/legados usam o mesmo checkout da família mensal.
  // O painel master trabalha com os IDs canônicos do catálogo do servidor;
  // o checkout, porém, só conhece estes três links.
  var ALIASES = {
    start_anual: 'start',
    pro_anual: 'pro',
    premium: 'pro',
    ilimitado_anual: 'ilimitado',
    full_anual: 'ilimitado',
    full: 'ilimitado',
    master: 'ilimitado',
    MASTER_SYSTEM: 'ilimitado'
  };

  var PLANOS = {
    start: {
      nome: 'Start',
      preco: 'R$ 69,90',
      periodo: '/mês',
      obras: '2 obras',
      usuarios: '2 usuários',
      limites: { obras: 2, usuarios: 2, trabalhadores: 9999 },
      dias: 31,
      link: 'https://pay.kiwify.com.br/hHQz2Zu'
    },
    pro: {
      nome: 'Pro',
      preco: 'R$ 105,90',
      periodo: '/mês',
      obras: '5 obras',
      usuarios: '5 usuários',
      limites: { obras: 5, usuarios: 5, trabalhadores: 9999 },
      dias: 31,
      link: 'https://pay.kiwify.com.br/d0Gfv34'
    },
    ilimitado: {
      nome: 'Ilimitado',
      preco: 'R$ 299,00',
      periodo: '/mês',
      obras: 'obras ilimitadas',
      usuarios: 'usuários ilimitados',
      limites: { obras: 9999, usuarios: 9999, trabalhadores: 9999 },
      dias: 31,
      link: 'https://pay.kiwify.com.br/z2hLFKq'
    }
  };

  window.OBRA_PLANOS = PLANOS;

  function tenantIdAtual() {
    var id = '';
    try {
      var user = JSON.parse(sessionStorage.getItem('gestaoUser') || '{}');
      id = user && user.tenantId ? user.tenantId : '';
    } catch (e) { /* sessão corrompida não deve travar o checkout */ }
    return id || window.OBRA_CHECKOUT_TENANT_ID || '';
  }

  function abrirWhatsApp(mensagem) {
    if (typeof window.openWhatsApp === 'function') {
      window.openWhatsApp(mensagem);
      return;
    }
    var numero = window.APP_WHATSAPP || ['5598', '98526', '2006'].join('');
    window.open('https://wa.me/' + numero + '?text=' + encodeURIComponent(mensagem), '_blank');
  }

  /**
   * Abre o checkout do plano escolhido, passando o tenantId como
   * external_reference para o webhook identificar a conta.
   *
   * @param {string} plano - start | pro | ilimitado (aceita aliases anuais/legados)
   * @param {string} [tenantId] - conta de destino (o painel master informa explicitamente)
   * @param {string} [linkKiwify] - URL de checkout vinda da API da Kiwify (opcional)
   */
  window.startKiwifyCheckoutFor = function startKiwifyCheckoutFor(plano, tenantId, linkKiwify) {
    var planoOriginal = String(plano || '').trim();
    var planoBase = ALIASES[planoOriginal] || planoOriginal;
    var dados = PLANOS[planoBase];
    if (!dados) {
      console.warn('[Checkout] Plano desconhecido:', planoOriginal);
      return;
    }

    var link = String(linkKiwify || dados.link || '').trim();
    var destino = tenantId || tenantIdAtual();
    var nome = planoBase === planoOriginal ? dados.nome : planoOriginal;

    if (!link || link.indexOf('SEU_LINK') !== -1) {
      abrirWhatsApp('Olá, quero assinar o plano ' + nome + ' do Obra Real' +
        (destino ? ' (conta ' + destino + ')' : '') + '. Pode me ajudar?');
      return;
    }

    var separador = link.indexOf('?') >= 0 ? '&' : '?';
    var url = link + (destino ? separador + 'external_reference=' + encodeURIComponent(destino) : '');
    window.open(url, '_blank');
  };

  window.startKiwifyCheckout = function startKiwifyCheckout(plano) {
    window.startKiwifyCheckoutFor(plano);
  };
})();
