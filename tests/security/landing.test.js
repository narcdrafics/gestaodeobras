import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const landing = read('public/index.html');
const legal = read('public/legal.html');
const plans = read('public/js/plans.js');
const appHtml = read('public/app.html');
const adminHtml = read('public/pages/admin.html');
const loginHtml = read('public/login.html');

describe('landing — preços, FAQ e checkout', () => {
  it('mostra os 3 planos com preços e links de checkout', () => {
    for (const plano of ['start', 'pro', 'ilimitado']) {
      expect(landing).toContain(`startKiwifyCheckout('${plano}')`);
    }
    expect(landing).toContain('R$ 69,90');
    expect(landing).toContain('R$ 105,90');
    expect(landing).toContain('R$ 299,00');
    expect(landing).not.toContain('R$ 149,90');
    expect(landing).toContain('id="precos"');
  });

  it('lista os recursos incluídos em cada plano', () => {
    expect(landing).toContain('Controle por empreiteiro e subetapa');
    expect(landing).toContain('Perfis de usuário');
    expect(landing).toContain('Relatório com a marca da sua empresa');
    expect(landing).toContain('Exportação de relatórios e imagens');
    expect(landing).toContain('Relatório diário no WhatsApp e subdomínio próprio');
    expect(landing).toContain('PIX e folha de pagamento');
    expect(landing).toContain('Quais recursos entram em cada plano?');
  });

  it('traz FAQ de cancelamento, dados e suporte e CTA de teste grátis', () => {
    expect(landing).toContain('id="faq"');
    expect(landing).toContain('Como funciona o cancelamento?');
    expect(landing).toContain('O que acontece com meus dados se eu não renovar?');
    expect(landing).toContain('Como recebo suporte?');
    expect(landing).toContain('Testar grátis por 30 dias');
    expect(landing).toContain('login.html#signup');
    expect(loginHtml).toContain("window.location.hash === '#signup'");
    expect(loginHtml).toContain("switchTab('signup')");
  });

  it('checkout centralizado cobre start, pro e ilimitado', () => {
    expect(plans).toContain('start:');
    expect(plans).toContain('pro:');
    expect(plans).toContain('ilimitado:');
    expect(plans).toContain('window.startKiwifyCheckout');
    expect(plans).toContain('external_reference');
    expect(plans).toContain("link: 'https://pay.kiwify.com.br/z2hLFKq'");
    expect(plans).not.toContain("link: ''");
    expect(landing).toContain('js/plans.js');
    expect(appHtml).toContain('js/plans.js');
    expect(appHtml).toContain("startKiwifyCheckout('ilimitado')");
  });

  it('removeu o checkout duplicado de data_core.js', () => {
    const dataCore = read('public/js/data_core.js');
    expect(dataCore).not.toContain('const KIWIFY_LINKS');
    expect(dataCore).not.toContain('window.startKiwifyCheckout =');
    expect(dataCore).toContain('js/plans.js');
  });

  it('publica links legais reais na landing e na página de legal', () => {
    expect(landing).toContain('legal.html#termos');
    expect(landing).toContain('legal.html#privacidade');
    expect(landing).toContain('legal.html#reembolso');
    expect(landing).toContain('legal.html#suporte');
    expect(landing).not.toMatch(/<a href="#">(Termos|Privacidade|Suporte)/);

    for (const id of ['termos', 'privacidade', 'reembolso', 'suporte']) {
      expect(legal).toContain(`id="${id}"`);
    }
    expect(legal).toContain('LGPD');
    expect(legal).toContain('art. 49');
    expect(legal).toContain('Regra de reembolso');
  });
});
