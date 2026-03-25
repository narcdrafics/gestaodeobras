/**
 * GESTÃO DE OBRAS — Cloudflare Worker
 * Roteamento wildcard: *.obrareal.com → Firebase Hosting
 *
 * Como funciona:
 * 1. Recebe request em empresa.obrareal.com
 * 2. Faz proxy transparente para o Firebase Hosting
 * 3. O browser continua vendo a URL original (empresa.obrareal.com)
 * 4. O app.js/auth_core.js lê window.location.hostname e detecta o slug
 */

// URL do seu app no Firebase Hosting
const FIREBASE_URL = 'https://controle-obras-c889d.web.app';

// Subdomínios reservados que NÃO devem ser tratados como slug de tenant
const RESERVED_SUBDOMAINS = ['www', 'admin', 'api', 'mail', 'ftp'];

// Domínio principal (sem subdomínio)
const ROOT_DOMAIN = 'obrareal.com';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname; // ex: "construtoraabc.obrareal.com"

    // --- Detecta o slug do subdomínio ---
    const slug = extractSlug(hostname);

    // Se não há slug (acesso direto ao domínio raiz ou www), proxy direto
    if (!slug) {
      return proxyToFirebase(request, url, FIREBASE_URL);
    }

    // Subdomínio reservado: redireciona para o domínio principal
    if (RESERVED_SUBDOMAINS.includes(slug)) {
      return Response.redirect(`https://${ROOT_DOMAIN}${url.pathname}${url.search}`, 301);
    }

    // Tenant válido: proxy transparente para o Firebase
    // O app detecta o subdomínio via window.location.hostname
    return proxyToFirebase(request, url, FIREBASE_URL);
  }
};

/**
 * Extrai o slug do subdomínio.
 * "construtoraabc.gestaodeobras.com.br" → "construtoraabc"
 * "gestaodeobras.com.br" → null
 * "www.gestaodeobras.com.br" → "www"
 */
function extractSlug(hostname) {
  // Remove o domínio raiz para obter o subdomínio
  const withoutRoot = hostname.replace(`.${ROOT_DOMAIN}`, '');

  // Se ficou igual ao hostname, não há subdomínio (ex: gestaodeobras.com.br)
  if (withoutRoot === hostname) return null;

  // Se ficou vazio, é exatamente o domínio raiz
  if (!withoutRoot) return null;

  return withoutRoot.toLowerCase();
}

/**
 * Faz proxy transparente para o Firebase Hosting,
 * preservando o hostname original no browser.
 */
async function proxyToFirebase(request, url, firebaseUrl) {
  // Monta a URL de destino no Firebase (mesmo path/query)
  const targetUrl = `${firebaseUrl}${url.pathname}${url.search}`;

  // Clona os headers e remove o host (Firebase vai usar o próprio)
  const headers = new Headers(request.headers);
  headers.set('X-Forwarded-Host', url.hostname); // Passa o hostname original pro app
  headers.delete('host');

  const firebaseRequest = new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual', // Não seguir redirecionamentos automaticamente
  });

  const response = await fetch(firebaseRequest);

  // Retorna a resposta do Firebase, mas mantém os headers de cache/CORS
  const responseHeaders = new Headers(response.headers);

  // Garante que o CORS funcione para subdomínios
  responseHeaders.set('Access-Control-Allow-Origin', '*');

  // Cache: assets estáticos por 1h, HTML sem cache (para atualizar o app)
  if (url.pathname.match(/\.(js|css|png|jpg|svg|ico|woff2?)(\?.*)?$/)) {
    responseHeaders.set('Cache-Control', 'public, max-age=3600');
  } else {
    responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
