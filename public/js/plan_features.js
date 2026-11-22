/**
 * public/js/plan_features.js
 * Espelho browser da matriz de features (autoridade: functions/plan_features.js).
 * Expõe window.OBRA_FEATURES. tests/plan-features.test.js valida a paridade.
 */
(function () {
  'use strict';

  var NIVEIS_PLANO = {
    free_trial: 2,
    start: 1,
    start_anual: 1,
    pro: 2,
    pro_anual: 2,
    premium: 2,
    ilimitado: 3,
    ilimitado_anual: 3,
    full_anual: 3,
    master: 3,
    MASTER_SYSTEM: 3
  };

  var NIVEL_NOME = { 1: 'Start', 2: 'Pro', 3: 'Ilimitado' };

  var FEATURES = {
    'empreiteiro.subetapa': {
      nivel: 1,
      nome: 'Controle por empreiteiro e subetapa',
      descricao: 'Organize serviços por empreiteiro e acompanhe cada subetapa da obra.'
    },
    'perfis.usuario': {
      nivel: 1,
      nome: 'Perfis de usuário',
      descricao: 'Convide usuários e defina perfis de acesso dentro da empresa.'
    },
    'relatorio.marca': {
      nivel: 2,
      nome: 'Relatório com marca',
      descricao: 'Relatórios com logo e identidade visual da sua empresa (white-label).'
    },
    'exportacao': {
      nivel: 2,
      nome: 'Exportação',
      descricao: 'Exporte relatórios, imagens e backup dos dados da obra.'
    },
    'relatorio.whatsapp.diario': {
      nivel: 2,
      nome: 'Relatório diário no WhatsApp',
      descricao: 'Envio automático do resumo diário de ponto e tarefas pelo WhatsApp.'
    },
    'subdominio': {
      nivel: 2,
      nome: 'Subdomínio personalizado',
      descricao: 'Escolha e altere o endereço suaempresa.obrareal.com.'
    },
    'pix.folha': {
      nivel: 3,
      nome: 'PIX e folha de pagamento',
      descricao: 'Fechamento de folha e pagamentos via PIX direto pelo sistema.'
    }
  };

  var ALIASES = {
    full: 'ilimitado',
    ilimitadoanual: 'ilimitado_anual',
    mastersystem: 'MASTER_SYSTEM',
    startanual: 'start_anual',
    proanual: 'pro_anual'
  };

  function normalizarPlano(plano) {
    var bruto = String(plano || '').trim();
    var chave = bruto.replace(/[\s_-]/g, '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(NIVEIS_PLANO, bruto)) return bruto;
    if (ALIASES[chave]) return ALIASES[chave];
    var normalizado = Object.keys(NIVEIS_PLANO).find(function (p) {
      return p.replace(/[\s_-]/g, '').toLowerCase() === chave;
    });
    return normalizado || 'free_trial';
  }

  function nivelDoPlano(plano) {
    return NIVEIS_PLANO[normalizarPlano(plano)];
  }

  function planoNecessario(nome) {
    var feature = FEATURES[nome];
    return feature ? NIVEL_NOME[feature.nivel] : null;
  }

  function hasFeature(nome, plano, contexto) {
    var feature = FEATURES[nome];
    if (!feature) return false;
    if (contexto && contexto.billingState === 'bloqueado') return false;
    return nivelDoPlano(plano) >= feature.nivel;
  }

  function featuresDoPlano(plano, contexto) {
    return Object.keys(FEATURES).filter(function (nome) {
      return hasFeature(nome, plano, contexto);
    });
  }

  function planoProMais(plano) {
    return nivelDoPlano(plano) >= 2;
  }

  function descrever(nome) {
    var feature = FEATURES[nome];
    if (!feature) return null;
    var copia = {};
    Object.keys(feature).forEach(function (k) { copia[k] = feature[k]; });
    copia.plano = planoNecessario(nome);
    return copia;
  }

  window.OBRA_FEATURES = {
    NIVEIS_PLANO: NIVEIS_PLANO,
    NIVEL_NOME: NIVEL_NOME,
    FEATURES: FEATURES,
    normalizarPlano: normalizarPlano,
    nivelDoPlano: nivelDoPlano,
    planoNecessario: planoNecessario,
    hasFeature: hasFeature,
    featuresDoPlano: featuresDoPlano,
    planoProMais: planoProMais,
    descrever: descrever
  };
})();
