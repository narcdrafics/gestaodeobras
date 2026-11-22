/**
 * public/js/plans.js
 * Catálogo único de planos e ponto de checkout (landing + app).
 *
 * Usado por index.html (landing), app.html e páginas internas. Manter aqui os
 * preços, limites e links evita que a landing anuncie um plano que o checkout
 * não sabe vender. O webhook (functions/kiwify.js) reconhece start, pro e
 * ilimitado/full.
 */
(function () {
  'use strict';

  var PLANOS = {
    start: {
      nome: 'Start',
      preco: 'R$ 69,90',
      periodo: '/mês',
      obras: '2 obras',
      usuarios: '2 usuários',
      link: 'https://pay.kiwify.com.br/hHQz2Zu'
    },
    pro: {
      nome: 'Pro',
      preco: 'R$ 105,90',
      periodo: '/mês',
      obras: '5 obras',
      usuarios: '5 usuários',
      link: 'https://pay.kiwify.com.br/d0Gfv34'
    },
    ilimitado: {
      nome: 'Ilimitado',
      preco: 'R$ 299,00',
      periodo: '/mês',
      obras: 'obras ilimitadas',
      usuarios: 'usuários ilimitados',
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
   * Cobre os 3 planos; se o link não estiver configurado, cai no suporte.
   */
  window.startKiwifyCheckout = function startKiwifyCheckout(plano) {
    var dados = PLANOS[plano];
    if (!dados) {
      console.warn('[Checkout] Plano desconhecido:', plano);
      return;
    }

    var tenantId = tenantIdAtual();

    if (!dados.link || dados.link.indexOf('SEU_LINK') !== -1) {
      abrirWhatsApp('Olá, quero assinar o plano ' + dados.nome + ' do Obra Real' +
        (tenantId ? ' (conta ' + tenantId + ')' : '') + '. Pode me ajudar?');
      return;
    }

    var separador = dados.link.indexOf('?') >= 0 ? '&' : '?';
    var url = dados.link +
      (tenantId ? separador + 'external_reference=' + encodeURIComponent(tenantId) : '');
    window.open(url, '_blank');
  };
})();
