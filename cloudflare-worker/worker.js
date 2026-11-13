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

// Origens autorizadas a fazer chamadas CORS no app (SaaS multi-tenant).
// Nunca use "*": qualquer site poderia ler respostas autenticadas.
const ALLOWED_ORIGINS = [
  /^https:\/\/([a-z0-9-]+\.)?obrareal\.com$/i,
  /^https:\/\/controle-obras-c889d\.web\.app$/i,
  /^https:\/\/controle-obras-c889d\.firebaseapp\.com$/i,
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((rule) => rule.test(origin));
}

/**
 * Aplica headers CORS apenas para origens da allowlist.
 * Usa `Vary: Origin` para o CDN não reaproveitar a resposta para outra origem.
 */
function applyCors(headers, request) {
  const origin = request.headers.get('Origin');
  // Vary: Origin nunca deve duplicar (Firebase pode já ter enviado)
  if (!headers.has('Vary')) headers.set('Vary', 'Origin');
  if (!isAllowedOrigin(origin)) return headers;

  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', request.headers.get('Access-Control-Request-Headers') || 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '3600');
  return headers;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname; // ex: "construtoraabc.obrareal.com"

    // Preflight CORS: responde direto, sem proxy
    if (request.method === 'OPTIONS') {
      const headers = applyCors(new Headers(), request);
      return new Response(null, { status: 204, headers });
    }

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
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual', // Não seguir redirecionamentos automaticamente
  });

  const response = await fetch(firebaseRequest);

  // Retorna a resposta do Firebase, mas mantém os headers de cache/CORS
  const responseHeaders = new Headers(response.headers);

  // CORS restrito à allowlist (nunca "*")
  // Remove um eventual ACAO do Firebase para não duplicar o header
  responseHeaders.delete('Access-Control-Allow-Origin');
  applyCors(responseHeaders, request);

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
