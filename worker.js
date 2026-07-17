// Template layer (Option A, #914): shared ctx normalizer + helpers, and the
// registry that dispatches menu_template -> a template module (lacquer default).
import { renderMenu } from './templates/index.js';
import { buildMenuCtx, escapeHtml, normalizeText } from './templates/shared.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8'
};

const PUBLIC_MENU_CACHE_SECONDS = 300;

// Per-isolate in-memory rate limiter: max 5 submissions per IP per 60 seconds.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map();

function isRateLimitedInMemory(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function toRateLimitIp(ip) {
  return normalizeText(ip || 'unknown', 80) || 'unknown';
}

async function isRateLimitedWithKv(ip, kvNamespace) {
  // KV is optional and best-effort; it improves cross-isolate limiting while
  // preserving compatibility when no namespace is configured.
  const windowId = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);
  const key = `rl:${ip}:${windowId}`;

  const rawCount = await kvNamespace.get(key);
  const currentCount = Number.parseInt(rawCount || '0', 10);
  if (currentCount >= RATE_LIMIT_MAX) {
    return true;
  }

  await kvNamespace.put(key, String(currentCount + 1), {
    expirationTtl: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) + 5
  });

  return false;
}

async function isRateLimited(ip, env) {
  const normalizedIp = toRateLimitIp(ip);

  if (env.RATE_LIMIT_KV && typeof env.RATE_LIMIT_KV.get === 'function' && typeof env.RATE_LIMIT_KV.put === 'function') {
    try {
      return await isRateLimitedWithKv(normalizedIp, env.RATE_LIMIT_KV);
    } catch (error) {
      console.log('KV rate limiter unavailable, falling back to in-memory limiter:', String(error));
    }
  }

  return isRateLimitedInMemory(normalizedIp);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    return routeRequest(request, env, url, ctx);
  }
};

async function routeRequest(request, env, url, ctx) {
  // A per-restaurant menu subdomain — `<slug>.dialtone.menu` — IS that
  // restaurant's menu for the whole host: `/` and any deep link render the
  // menu; only crawler / asset-support paths resolve to themselves. Reserved
  // app subdomains (admin, kitchen, pay, …) never reach here — each is its own
  // Cloudflare Custom Domain, which takes routing precedence over the wildcard
  // Worker Route that points these menu subdomains at this Worker.
  const hostSlug = extractMenuSlugFromHost(url.hostname);
  if (hostSlug !== null) {
    if (url.pathname === '/robots.txt') {
      return handleRobots(url);
    }
    if (url.pathname === '/favicon.ico') {
      return handleFavicon(request, env);
    }
    if (url.pathname === '/.well-known/security.txt') {
      return handleSecurityTxt();
    }
    return handlePublicMenuPage(request, env, url, hostSlug, ctx);
  }

  // Explicit handlers for known dynamic paths.
  if (url.pathname === '/features' || url.pathname === '/features/') {
    return serveStaticPage(request, env, '/features.html');
  }

  const menuSlug = extractMenuSlug(url.pathname);
  if (menuSlug !== null) {
    return handlePublicMenuPage(request, env, url, menuSlug, ctx);
  }

  if (url.pathname === '/robots.txt') {
    return handleRobots(url);
  }

  if (url.pathname === '/favicon.ico') {
    return handleFavicon(request, env);
  }

  if (url.pathname === '/.well-known/security.txt') {
    return handleSecurityTxt();
  }

  if (url.pathname === '/sitemap.xml') {
    return handleSitemap(url);
  }

  if (url.pathname === '/api/contact') {
    return handleContact(request, env);
  }

  // For all paths not explicitly handled above, delegate to the assets binding
  // and normalize missing lookups to 404.
  return handleAssetRequest(request, env);
}

function extractMenuSlug(pathname) {
  const match = pathname.match(/^\/m\/([^/]+)\/?$/);
  if (!match) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(match[1]).trim();
    return decoded || '';
  } catch {
    return '';
  }
}

// The base domain under which a single-label subdomain is a restaurant menu
// slug: `<slug>.dialtone.menu`. Apex (`dialtone.menu`) and any multi-label host
// (e.g. the `<slug>.pay.dialtone.menu` pay wildcard) are NOT menu subdomains.
const MENU_HOST_SUFFIX = '.dialtone.menu';

// Subdomains that are NOT restaurant slugs: the app surfaces (each its own
// Custom Domain, so they never route here — listed defensively in case one
// ever does) plus common infra / marketing labels. A host whose first label is
// one of these renders the marketing site, never a menu.
const RESERVED_MENU_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'staging', 'dev', 'preview', 'mail', 'email', 'smtp',
  'ns1', 'ns2', 'cdn', 'assets', 'static', 'm',
  'admin', 'admin-staging',
  'kitchen', 'kitchen-staging',
  'beverage', 'beverage-staging',
  'expo', 'expo-staging',
  'pay', 'pay-staging'
]);

// A request to `<label>.dialtone.menu` where `<label>` is a single, valid,
// non-reserved DNS label → that label is the restaurant slug. Returns the slug,
// or null for the apex, reserved subdomains, multi-label hosts, or any host
// outside the menu domain. `get_public_menu_by_slug` remains the sole lookup:
// an unprovisioned subdomain resolves to the friendly menu-not-found page.
function extractMenuSlugFromHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host.endsWith(MENU_HOST_SUFFIX)) {
    return null;
  }
  const label = host.slice(0, -MENU_HOST_SUFFIX.length);
  if (!label || label.includes('.')) {
    return null;
  }
  if (RESERVED_MENU_SUBDOMAINS.has(label)) {
    return null;
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) {
    return null;
  }
  return label;
}

async function handlePublicMenuPage(request, env, url, slug, ctx) {
  if (!isLookupMethod(request.method)) {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'allow': 'GET, HEAD'
      }
    });
  }

  if (!slug) {
    return buildMenuNotFoundResponse();
  }

  const edgeCache = getEdgeCache();
  const cacheKey = new Request(menuCacheKeyUrl(url, slug), { method: 'GET' });
  const shouldUseCache = request.method === 'GET' && edgeCache;

  if (shouldUseCache) {
    const cachedResponse = await edgeCache.match(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }
  }

  const response = await buildPublicMenuResponse(env, slug);

  if (shouldUseCache && isMenuResponseCacheable(response.status)) {
    const cachePut = edgeCache.put(cacheKey, response.clone());
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(cachePut);
    } else {
      await cachePut;
    }
  }

  if (request.method === 'HEAD') {
    return toHeadResponse(response);
  }

  return response;
}

function menuCacheKeyUrl(url, slug) {
  const cacheUrl = new URL(url.toString());
  cacheUrl.pathname = `/m/${encodeURIComponent(slug)}`;
  cacheUrl.search = '';
  return cacheUrl.toString();
}

function getEdgeCache() {
  if (!globalThis.caches || !globalThis.caches.default) {
    return null;
  }
  return globalThis.caches.default;
}

function isMenuResponseCacheable(status) {
  return status === 200 || status === 404;
}

function toHeadResponse(response) {
  return new Response(null, {
    status: response.status,
    headers: response.headers
  });
}

async function buildPublicMenuResponse(env, slug) {
  const supabaseUrl = normalizeText(env.PUBLIC_MENU_SUPABASE_URL || env.SUPABASE_URL || '', 500);
  const supabaseAnonKey = normalizeText(
    env.PUBLIC_MENU_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '',
    2000
  );

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response('Menu is temporarily unavailable.', {
      status: 503,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store'
      }
    });
  }

  let rpcResponse;
  try {
    rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_menu_by_slug`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'apikey': supabaseAnonKey,
        'authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({ p_slug: slug })
    });
  } catch (error) {
    console.log('Public menu RPC network error:', String(error));
    return new Response('Menu is temporarily unavailable.', {
      status: 502,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store'
      }
    });
  }

  if (!rpcResponse.ok) {
    const rpcErrorText = await rpcResponse.text();
    console.log('Public menu RPC failed:', rpcResponse.status, rpcErrorText);
    if (rpcResponse.status === 404) {
      const normalizedError = String(rpcErrorText || '').toLowerCase();
      const missingFunction =
        normalizedError.includes('get_public_menu_by_slug') ||
        normalizedError.includes('could not find function') ||
        normalizedError.includes('pgrst202');

      if (!missingFunction) {
        return buildMenuNotFoundResponse();
      }

      return new Response('Menu is temporarily unavailable.', {
        status: 503,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store'
        }
      });
    }

    return new Response('Menu is temporarily unavailable.', {
      status: 502,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store'
      }
    });
  }

  let payload = null;
  try {
    payload = await rpcResponse.json();
  } catch {
    payload = null;
  }

  if (!payload) {
    return buildMenuNotFoundResponse();
  }

  return buildMenuSuccessResponse(payload, slug);
}

function buildMenuNotFoundResponse() {
  const body = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <title>Menu not found | DialTone</title>',
    '  <meta name="robots" content="index,follow">',
    '  <style>',
    '    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #faf7f2; color: #06234B; }',
    '    main { max-width: 680px; margin: 0 auto; padding: 48px 24px; text-align: center; }',
    '    h1 { margin: 0 0 12px; font-size: 2rem; }',
    '    p { margin: 0; color: #4a5f7d; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main>',
    '    <h1>Menu not found</h1>',
    '    <p>This menu link may be inactive or no longer available.</p>',
    '  </main>',
    '</body>',
    '</html>'
  ].join('\n');

  return new Response(body, {
    status: 404,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': `public, max-age=0, s-maxage=${PUBLIC_MENU_CACHE_SECONDS}`
    }
  });
}


function buildMenuSuccessResponse(payload, slug) {
  const ctx = buildMenuCtx(payload, slug);
  return new Response(renderMenu(ctx), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': `public, max-age=0, s-maxage=${PUBLIC_MENU_CACHE_SECONDS}`
    }
  });
}

async function serveStaticPage(request, env, pathname) {
  const pageUrl = new URL(request.url);
  pageUrl.pathname = pathname;
  pageUrl.search = '';
  const pageRequest = new Request(pageUrl.toString(), request);
  return handleAssetRequest(pageRequest, env);
}

async function handleAssetRequest(request, env) {
  try {
    const response = await env.ASSETS.fetch(request);

    // Missing static assets can surface as 500 from the assets binding;
    // normalize those to 404 so crawlers and clients get the correct status.
    if (response.status === 500 && isLookupMethod(request.method)) {
      return notFoundResponse();
    }

    return response;
  } catch (error) {
    // If asset resolution throws on an unmatched path, return 404 rather
    // than exposing an internal failure.
    if (isLookupMethod(request.method)) {
      console.log('ASSETS fetch lookup error:', String(error));
      return notFoundResponse();
    }

    throw error;
  }
}

function isLookupMethod(method) {
  return method === 'GET' || method === 'HEAD';
}

function notFoundResponse() {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8'
    }
  });
}

function handleRobots(url) {
  const host = url.hostname.toLowerCase();
  const isByteStreamsHost = host === 'bytestreams.ai' || host === 'www.bytestreams.ai';
  const sitemap = isByteStreamsHost
    ? 'https://bytestreams.ai/sitemap.xml'
    : 'https://dialtone.menu/sitemap.xml';

  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /api/',
    '',
    'User-agent: GPTBot',
    'Disallow: /',
    '',
    `Sitemap: ${sitemap}`,
    ''
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8'
    }
  });
}

async function handleFavicon(request, env) {
  // Browsers default-request `/favicon.ico`; rewrite to the SVG asset.
  // Modern browsers honor the HTML `<link rel="icon" type="image/svg+xml">`
  // hints and skip the `.ico` request entirely; this path handles the
  // legacy fallback case and ensures the response still carries the
  // correct `image/svg+xml` content-type from the assets binding.
  const faviconUrl = new URL(request.url);
  faviconUrl.pathname = '/images/favicon.svg';
  faviconUrl.search = 'v=20260427';
  const faviconRequest = new Request(faviconUrl.toString(), request);
  try {
    const response = await env.ASSETS.fetch(faviconRequest);
    if (response.status === 500 && isLookupMethod(request.method)) {
      return notFoundResponse();
    }
    return response;
  } catch (error) {
    if (isLookupMethod(request.method)) {
      console.log('ASSETS favicon lookup error:', String(error));
      return notFoundResponse();
    }
    throw error;
  }
}

function handleSecurityTxt() {
  const body = [
    'Contact: mailto:security@bytestreams.ai',
    'Expires: 2027-04-23T00:00:00.000Z',
    'Preferred-Languages: en',
    ''
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8'
    }
  });
}

function handleSitemap(url) {
  const pages = ['/', '/features', '/pricing.html', '/privacy.html', '/terms.html', '/delete-account.html'];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...pages.map((path) => `  <url><loc>${escapeXml(`${url.origin}${path}`)}</loc></url>`),
    '</urlset>',
    ''
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8'
    }
  });
}

async function handleContact(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (await isRateLimited(clientIp, env)) {
    return jsonResponse({ error: 'Too many requests. Please try again later.' }, 429);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  const name = normalizeText(payload.name, 120);
  const restaurantName = normalizeText(payload.restaurantName, 160);
  const email = normalizeText(payload.email, 254);
  const message = normalizeText(payload.message, 5000);
  const honeypot = normalizeText(payload.website || '', 200);

  if (honeypot) {
    return jsonResponse({ ok: true });
  }

  if (!name || !restaurantName || !email || !message) {
    return jsonResponse({ error: 'Please fill out all fields.' }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Please provide a valid email address.' }, 400);
  }

  // Runtime config health for DB persistence.
  const supabaseDbKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;
  const hasSupabaseUrl = Boolean(env.SUPABASE_URL);
  const hasSupabaseDbKey = Boolean(supabaseDbKey);
  if (!hasSupabaseUrl || !hasSupabaseDbKey) {
    console.log('Contact config health:', JSON.stringify({
      hasSupabaseUrl,
      hasSupabaseDbKey,
      hasServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      hasFallbackKey: Boolean(env.SUPABASE_KEY)
    }));

    return jsonResponse({
      error: 'Form configuration is incomplete. Please contact support.'
    }, 503);
  }

  // Persist first so a successful response always implies a stored row.
  try {
    await saveToSupabase({
      email,
      name,
      restaurantName,
      comment: message,
      supabaseUrl: env.SUPABASE_URL,
      supabaseKey: supabaseDbKey
    });
  } catch (error) {
    console.log('Supabase save error:', String(error));
    return jsonResponse({
      error: 'We could not save your submission. Please try again shortly.'
    }, 502);
  }

  const destinationEmail = env.CONTACT_EMAIL;
  if (!destinationEmail) {
    return jsonResponse({ error: 'Contact destination is not configured.' }, 503);
  }

  if (!env.RESEND_API_KEY) {
    // Surfaces in observability; client-side error keeps submitters in
    // the form rather than bouncing them to a mail app.
    console.log('Contact form unavailable: RESEND_API_KEY secret is not set.');
    return jsonResponse({
      error: 'Contact form is temporarily unavailable. Please try again shortly.'
    }, 503);
  }

  const result = await forwardToResend({
    destinationEmail,
    siteName: env.SITE_NAME,
    name,
    restaurantName,
    email,
    message,
    apiKey: env.RESEND_API_KEY
  });

  if (!result.ok) {
    // Log provider response for CF Workers observability — rate-limit
    // reasons, invalid-key errors, and domain-unverified states all
    // surface here. Details stay server-side.
    console.log('Resend failure:', JSON.stringify({
      httpStatus: result.httpStatus,
      errorName: result.errorName,
      errorMessage: result.errorMessage
    }));

    return jsonResponse({
      error: 'Message delivery failed. Please try again shortly.'
    }, 502);
  }

  return jsonResponse({ ok: true });
}

async function forwardToResend({ destinationEmail, siteName, name, restaurantName, email, message, apiKey }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      // Sender lives on the shared `send.bytestreams.ai` Resend domain
      // (see developer/resend-notes or the project plan memo). `hello@`
      // local-part kept in sync with the recipient mailbox for symmetry.
      from: `${siteName} <contact@send.bytestreams.ai>`,
      to: [destinationEmail],
      // Reply-To: the submitter's address so hitting Reply in Gmail goes
      // straight back to the person who filled out the form. Passed as a
      // single-element array to match Resend's documented canonical form;
      // the regex check in `handleContact` already rejects display-name /
      // bracketed-address syntax (whitespace and `<>` fail the anchored
      // `[^\s@]+@[^\s@]+\.[^\s@]+` pattern), so `email` is a bare address.
      reply_to: [email],
      subject: `${siteName} Contact: ${restaurantName} (${name})`,
      text: buildTextBody({ siteName, name, restaurantName, email, message }),
      html: buildHtmlBody({ siteName, name, restaurantName, email, message })
    })
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  // Resend success returns `{ id: "<resend_message_id>" }`; errors return
  // `{ statusCode, name, message }`. Treat presence of `id` as the ok signal.
  const ok = response.ok && payload !== null && typeof payload.id === 'string';

  return {
    ok,
    httpStatus: response.status,
    errorName: payload && payload.name ? String(payload.name) : '',
    errorMessage: payload && payload.message ? String(payload.message) : ''
  };
}

function buildTextBody({ siteName, name, restaurantName, email, message }) {
  return [
    `New ${siteName} contact form submission`,
    '',
    `Contact: ${name}`,
    `Restaurant: ${restaurantName}`,
    `Email: ${email}`,
    '',
    message,
    '',
    '---',
    `Submitted via the ${siteName} contact form.`,
    'Reply directly to this email to respond to the sender.'
  ].join('\n');
}

function buildHtmlBody({ siteName, name, restaurantName, email, message }) {
  const safeSite = escapeHtml(siteName);
  const safeName = escapeHtml(name);
  const safeRestaurantName = escapeHtml(restaurantName);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message);
  return [
    '<!doctype html>',
    '<html>',
    '<body style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1410;">',
    `<h2 style="margin: 0 0 16px 0;">New ${safeSite} contact form submission</h2>`,
    `<p style="margin: 0 0 8px 0;"><strong>Contact:</strong> ${safeName}</p>`,
    `<p style="margin: 0 0 8px 0;"><strong>Restaurant:</strong> ${safeRestaurantName}</p>`,
    `<p style="margin: 0 0 8px 0;"><strong>Email:</strong> <a href="mailto:${safeEmail}" style="color: #c8391a;">${safeEmail}</a></p>`,
    '<hr style="border: none; border-top: 1px solid #ebe3d5; margin: 16px 0;">',
    `<div style="white-space: pre-wrap; line-height: 1.5;">${safeMessage}</div>`,
    '<hr style="border: none; border-top: 1px solid #ebe3d5; margin: 24px 0 16px 0;">',
    `<p style="margin: 0; font-size: 12px; color: #6b5d4f;">Submitted via the ${safeSite} contact form. Reply directly to this email to respond to the sender.</p>`,
    '</body>',
    '</html>'
  ].join('');
}

async function saveToSupabase({ email, name, restaurantName, comment, supabaseUrl, supabaseKey }) {
  const response = await fetch(`${supabaseUrl}/rest/v1/waitlist_submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      email,
      name,
      restaurant_name: restaurantName,
      campaign: 'launch',
      comment: comment || null,
      created_at: new Date().toISOString()
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase insert failed (${response.status}): ${errorText}`);
  }

  return await response.json();
}


function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS
  });
}
