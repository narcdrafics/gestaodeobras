import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as backend from '../functions/plan_features.js';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// O módulo browser é UMD-style (window.OBRA_FEATURES); avaliamos num contexto isolado.
const fakeWindow = {};
vm.runInNewContext(read('public/js/plan_features.js'), { window: fakeWindow });
const front = fakeWindow.OBRA_FEATURES;

const dataCore = read('public/js/data_core.js');
const appCore = read('public/js/app_core.js');
const functionsIndex = read('functions/index.js');
const rules = JSON.parse(read('database.rules.json'));

describe('matriz de features por plano', () => {
  it('front e Functions usam exatamente a mesma matriz', () => {
    expect(front).toBeTruthy();
    expect(JSON.stringify(front.FEATURES)).toBe(JSON.stringify(backend.FEATURES));
    expect(JSON.stringify(front.NIVEIS_PLANO)).toBe(JSON.stringify(backend.NIVEIS_PLANO));
    expect(JSON.stringify(front.NIVEL_NOME)).toBe(JSON.stringify(backend.NIVEL_NOME));
  });

  it('Start tem empreiteiro/subetapa e perfis, mas não tem slug, exportação nem PIX', () => {
    expect(backend.hasFeature('empreiteiro.subetapa', 'start')).toBe(true);
    expect(backend.hasFeature('perfis.usuario', 'start')).toBe(true);
    expect(backend.hasFeature('subdominio', 'start')).toBe(false);
    expect(backend.hasFeature('exportacao', 'start')).toBe(false);
    expect(backend.hasFeature('relatorio.marca', 'start')).toBe(false);
    expect(backend.hasFeature('relatorio.whatsapp.diario', 'start')).toBe(false);
    expect(backend.hasFeature('pix.folha', 'start')).toBe(false);
  });

  it('Pro libera marca, exportação, WhatsApp e subdomínio; Ilimitado libera PIX/folha', () => {
    for (const f of ['relatorio.marca', 'exportacao', 'relatorio.whatsapp.diario', 'subdominio']) {
      expect(backend.hasFeature(f, 'pro')).toBe(true);
      expect(backend.hasFeature(f, 'ilimitado')).toBe(true);
    }
    expect(backend.hasFeature('pix.folha', 'pro')).toBe(false);
    expect(backend.hasFeature('pix.folha', 'ilimitado')).toBe(true);
    expect(backend.featuresDoPlano('ilimitado')).toContain('pix.folha');
  });

  it('normaliza aliases e trata tenant bloqueado como sem features', () => {
    expect(backend.normalizarPlano('start_anual')).toBe('start_anual');
    expect(backend.normalizarPlano('FULL')).toBe('ilimitado');
    expect(backend.normalizarPlano('premium')).toBe('premium');
    expect(backend.normalizarPlano('MASTER_SYSTEM')).toBe('MASTER_SYSTEM');
    expect(backend.normalizarPlano('plano_desconhecido')).toBe('free_trial');
    expect(backend.hasFeature('pix.folha', 'full_anual')).toBe(true);
    expect(backend.hasFeature('subdominio', 'pro', { billingState: 'bloqueado' })).toBe(false);
    expect(backend.hasFeature('inexistente', 'ilimitado')).toBe(false);
  });

  it('o mesmo resultado é obtido no navegador e no backend', () => {
    for (const plano of ['free_trial', 'start', 'pro', 'ilimitado']) {
      expect(front.featuresDoPlano(plano)).toEqual(backend.featuresDoPlano(plano));
    }
    expect(front.hasFeature('pix.folha', 'start')).toBe(false);
    expect(front.hasFeature('pix.folha', 'ilimitado')).toBe(true);
  });
});

describe('integração da matriz na interface', () => {
  it('expõe window.hasFeature/requireFeature usando o plano atual', () => {
    expect(dataCore).toContain('window.hasFeature = function hasFeature');
    expect(dataCore).toContain('window.requireFeature = function requireFeature');
    expect(dataCore).toContain("window.hasFeature('subdominio')");
    expect(dataCore).toContain("window.showUpgradeModal('subdominio')");
    expect(appCore).toContain('function applyFeatureGates');
    expect(appCore).toContain("data-feature-locked");
    expect(appCore).toContain('showUpgradeModal');
  });

  it('marca os controles com data-feature nas telas', () => {
    expect(read('public/app.html')).toContain('data-feature="exportacao"');
    expect(read('public/app.html')).toContain('data-feature="relatorio.marca"');
    expect(read('public/pages/admin.html')).toContain('data-feature="subdominio"');
    expect(read('public/pages/admin.html')).toContain('data-feature="relatorio.marca"');
    expect(read('public/pages/financeiro.html')).toContain('data-feature="pix.folha"');
    expect(read('public/pages/dashboard.html')).toContain('data-feature="exportacao"');
    expect(read('public/pages/hoje.html')).toContain('data-feature="exportacao"');
  });

  it('oferece modal de upgrade com os três planos', () => {
    const modal = read('public/modals/modal-upgrade.html');
    for (const plano of ['start', 'pro', 'ilimitado']) {
      expect(modal).toContain(`startKiwifyCheckout('${plano}')`);
    }
    expect(modal).toContain('upgrade-required-plan');
    expect(read('public/css/app.css')).toContain('[data-feature-locked="1"]::after');
  });

  it('checkout abre URL real dos 3 planos com external_reference', () => {
    const urls = [];
    const fake = {
      open: (url) => urls.push(url),
      OBRA_CHECKOUT_TENANT_ID: 'tenant_123',
      APP_WHATSAPP: '5598985262006'
    };
    vm.runInNewContext(read('public/js/plans.js'), {
      window: fake,
      sessionStorage: { getItem: () => null },
      encodeURIComponent,
      console
    });

    for (const plano of ['start', 'pro', 'ilimitado']) {
      fake.startKiwifyCheckout(plano);
    }
    expect(urls).toHaveLength(3);
    for (const url of urls) {
      expect(url).toContain('https://pay.kiwify.com.br/');
      expect(url).toContain('external_reference=tenant_123');
    }
    expect(urls[2]).toBe('https://pay.kiwify.com.br/z2hLFKq?external_reference=tenant_123');
  });

  it('Ilimitado custa R$ 299,00 em todos os pontos de venda', () => {
    expect(read('public/js/plans.js')).toContain("preco: 'R$ 299,00'");
    expect(read('public/index.html')).toContain('R$ 299,00');
    expect(read('public/pages/admin.html')).toContain('R$ 299,00');
    expect(read('public/modals/modal-upgrade.html')).toContain('R$ 299,00/mês');
  });
});

describe('enforcement no backend', () => {
  it('dailyReport usa a mesma flag do front', () => {
    expect(functionsIndex).toContain("require('./plan_features')");
    expect(functionsIndex).toContain("hasFeature('relatorio.whatsapp.diario', tenant.plano, tenant)");
  });

  it('subdomínio é checado por trigger e por rules', () => {
    expect(functionsIndex).toContain('async function enforceSubdomainPlan');
    expect(functionsIndex).toContain("hasFeature('subdominio', tenant.plano, tenant)");
    expect(functionsIndex).toContain('"tenants/{tenantId}/subdominioSlug"');
    expect(functionsIndex).toContain('"tenants/{tenantId}/config/slug"');

    const tenant = rules.rules.tenants.$tenantId;
    expect(tenant.subdominioSlug['.validate']).toContain("=== 'free_trial'");
    expect(tenant.subdominioSlug['.validate']).toContain("=== 'pro'");
    expect(tenant.config.slug['.validate']).toContain("=== 'ilimitado'");
    expect(tenant.subdominioSlug['.validate']).toContain("newData.val() === $tenantId");
  });

  it(' slug de cadastro continua disponível para free_trial', () => {
    const slug = read('public/js/slug.js');
    expect(slug).toContain("plano: 'free_trial'");
    expect(slug).toContain('subdominioSlug: slug');
  });
});
