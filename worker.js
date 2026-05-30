const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8'
};

const PUBLIC_MENU_CACHE_SECONDS = 300;
const FALLBACK_PRIMARY = '#06234B';
const FALLBACK_SECONDARY = '#E8A020';
const SYSTEM_FONT_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

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
  const restaurant = payload.restaurant && typeof payload.restaurant === 'object' ? payload.restaurant : {};
  const categories = Array.isArray(payload.categories) ? payload.categories : [];

  const restaurantName = normalizeText(restaurant.name, 160) || 'Restaurant';
  const displayName = normalizeText(restaurant.display_name, 160);
  const wordmark = displayName || restaurantName;
  const tagline = normalizeText(restaurant.tagline, 240);
  const timezone = normalizeText(restaurant.timezone, 120);
  const websiteUrl = safeLogoUrl(restaurant.website_url || '');
  const logoUrl = safeLogoUrl(restaurant.logo_url || '');
  const primaryColor = sanitizeHexColor(restaurant.primary_color, FALLBACK_PRIMARY);
  const secondaryColor = sanitizeHexColor(restaurant.secondary_color, FALLBACK_SECONDARY);
  const pageTitle = `${wordmark} Menu | DialTone`;
  const pageDescription = tagline || `Browse the latest menu from ${restaurantName}.`;

  const fontFamily = safeFontFamily(normalizeText(restaurant.font, 120));
  const fontHref = googleFontHref(normalizeText(restaurant.font, 120));

  const categoryHtml = categories.length
    ? categories.map((category) => renderMenuCategory(category, timezone)).join('')
    : '<p class="empty-state">No menu items are currently available.</p>';

  const logoMarkup = logoUrl
    ? `<img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(wordmark)} logo">`
    : `<div class="brand-wordmark">${escapeHtml(wordmark)}</div>`;

  const websiteCtaMarkup = websiteUrl
    ? `<a class="site-link" href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener noreferrer">Visit our site</a>`
    : '';

  const body = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeHtml(pageTitle)}</title>`,
    `  <meta name="description" content="${escapeHtml(pageDescription)}">`,
    '  <meta name="robots" content="index,follow">',
    `  <meta property="og:title" content="${escapeHtml(pageTitle)}">`,
    `  <meta property="og:description" content="${escapeHtml(pageDescription)}">`,
    '  <meta property="og:type" content="website">',
    `  <meta property="og:url" content="https://dialtone.menu/m/${encodeURIComponent(slug)}">`,
    `  <meta property="og:image" content="${escapeHtml(logoUrl || 'https://dialtone.menu/images/dialtone-banner.png')}">`,
    '  <meta name="twitter:card" content="summary_large_image">',
    `  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">`,
    `  <meta name="twitter:description" content="${escapeHtml(pageDescription)}">`,
    fontHref ? `  <link rel="preconnect" href="https://fonts.googleapis.com">` : '',
    fontHref ? `  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` : '',
    fontHref ? `  <link rel="stylesheet" href="${escapeHtml(fontHref)}">` : '',
    '  <style>',
    `    :root { --brand-primary: ${primaryColor}; --brand-secondary: ${secondaryColor}; --brand-soft: ${hexToRgba(primaryColor, 0.08)}; }`,
    `    body { margin: 0; color: #122236; background: radial-gradient(circle at top right, ${hexToRgba(secondaryColor, 0.18)}, transparent 40%), #faf7f2; font-family: ${fontFamily}; }`,
    '    main { max-width: 980px; margin: 0 auto; padding: 24px 20px 56px; }',
    '    .menu-header { display: flex; justify-content: space-between; gap: 20px; align-items: center; padding: 18px 20px; border: 1px solid rgba(6, 35, 75, 0.16); border-radius: 16px; background: #ffffff; box-shadow: 0 10px 32px rgba(6, 35, 75, 0.08); }',
    '    .brand-block { display: flex; flex-direction: column; gap: 8px; min-width: 0; }',
    '    .brand-logo { max-height: 72px; max-width: min(40vw, 220px); width: auto; border-radius: 8px; object-fit: contain; }',
    '    .brand-wordmark { font-size: clamp(1.8rem, 3vw, 2.3rem); line-height: 1.05; font-weight: 700; color: var(--brand-primary); }',
    '    .tagline { margin: 0; color: #4f5e73; }',
    '    .site-link { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; background: var(--brand-primary); color: #fff; border-radius: 999px; padding: 11px 18px; font-weight: 700; white-space: nowrap; }',
    '    .categories { margin-top: 24px; display: grid; gap: 18px; }',
    '    .category { background: #fff; border: 1px solid rgba(6, 35, 75, 0.12); border-radius: 14px; padding: 18px; }',
    '    .category-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 10px; }',
    '    .category-title-wrap h2 { margin: 0; color: var(--brand-primary); font-size: clamp(1.35rem, 2.5vw, 1.65rem); }',
    '    .category-description { margin: 6px 0 0; color: #5a6c83; }',
    '    .served-label { font-size: 0.84rem; font-weight: 700; padding: 6px 10px; border-radius: 999px; color: var(--brand-primary); background: var(--brand-soft); border: 1px solid rgba(6, 35, 75, 0.2); }',
    '    .served-label.later { opacity: 0.72; }',
    '    .item { padding: 14px 0; border-top: 1px solid rgba(6, 35, 75, 0.12); }',
    '    .item:first-of-type { border-top: 0; }',
    '    .item-head { display: flex; justify-content: space-between; gap: 14px; align-items: baseline; }',
    '    .item-name { margin: 0; font-size: 1.05rem; color: #132743; }',
    '    .alcohol-pill { margin-left: 8px; font-size: 0.72rem; color: #8a2d12; background: #ffe3d8; border: 1px solid #ffc5af; padding: 2px 8px; border-radius: 999px; vertical-align: middle; }',
    '    .item-description { margin: 7px 0 0; color: #5a6c83; }',
    '    .price { font-weight: 700; color: #132743; white-space: nowrap; }',
    '    .price .special-label { color: #b00020; font-size: 0.72em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-right: 6px; }',
    '    .modifiers { margin-top: 10px; display: grid; gap: 8px; }',
    '    .modifier-group { background: #f6f9fc; border: 1px solid rgba(6, 35, 75, 0.08); border-radius: 10px; padding: 9px 10px; }',
    '    .modifier-header { display: flex; gap: 8px; flex-wrap: wrap; font-size: 0.85rem; color: #334b69; }',
    '    .modifier-options { margin: 6px 0 0; padding-left: 18px; color: #4f6178; }',
    '    .modifier-options li { margin: 2px 0; }',
    '    .empty-state { margin: 10px 0 0; color: #4f6178; background: #fff; border: 1px dashed rgba(6, 35, 75, 0.25); border-radius: 12px; padding: 16px; text-align: center; }',
    '    @media (max-width: 720px) {',
    '      .menu-header { flex-direction: column; align-items: flex-start; }',
    '      .site-link { width: 100%; }',
    '      .category-header { flex-direction: column; }',
    '    }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main>',
    '    <header class="menu-header">',
    `      <div class="brand-block">${logoMarkup}${tagline ? `<p class="tagline">${escapeHtml(tagline)}</p>` : ''}</div>`,
    `      ${websiteCtaMarkup}`,
    '    </header>',
    `    <section class="categories" data-restaurant-timezone="${escapeHtml(timezone)}">${categoryHtml}</section>`,
    '  </main>',
    '  <script>',
    '    (() => {',
    '      const categories = document.querySelectorAll(".category[data-start][data-end]");',
    '      const section = document.querySelector(".categories");',
    '      if (!section || !categories.length) return;',
    '      const timezone = section.dataset.restaurantTimezone;',
    '      if (!timezone) return;',
    '      const nowParts = new Intl.DateTimeFormat("en-US", {',
    '        hour: "2-digit",',
    '        minute: "2-digit",',
    '        hour12: false,',
    '        timeZone: timezone',
    '      }).formatToParts(new Date());',
    '      const hour = Number(nowParts.find((p) => p.type === "hour")?.value ?? "0");',
    '      const minute = Number(nowParts.find((p) => p.type === "minute")?.value ?? "0");',
    '      const nowMinutes = hour * 60 + minute;',
    '      const toMinutes = (value) => {',
    '        const [h, m] = String(value).split(":").map((part) => Number(part));',
    '        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;',
    '        return h * 60 + m;',
    '      };',
    '      categories.forEach((category) => {',
    '        const start = toMinutes(category.dataset.start);',
    '        const end = toMinutes(category.dataset.end);',
    '        const label = category.querySelector(".served-label");',
    '        if (start === null || end === null || !label) return;',
    '        const wrapsMidnight = end < start;',
    '        const isNow = wrapsMidnight',
    '          ? nowMinutes >= start || nowMinutes <= end',
    '          : nowMinutes >= start && nowMinutes <= end;',
    '        if (!isNow) {',
    '          label.classList.add("later");',
    '          label.textContent = `${label.textContent} • Served later`;',
    '        }',
    '      });',
    '    })();',
    '  </script>',
    '</body>',
    '</html>'
  ].filter(Boolean).join('\n');

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': `public, max-age=0, s-maxage=${PUBLIC_MENU_CACHE_SECONDS}`
    }
  });
}

function renderMenuCategory(category, timezone) {
  const safeCategory = category && typeof category === 'object' ? category : {};
  const name = normalizeText(safeCategory.name, 160) || 'Menu Category';
  const description = normalizeText(safeCategory.description, 500);
  const start = normalizeText(safeCategory.serving_start_time, 10);
  const end = normalizeText(safeCategory.serving_end_time, 10);
  const hasWindow = Boolean(start && end && isValidServingTime(start) && isValidServingTime(end));
  const items = Array.isArray(safeCategory.items) ? safeCategory.items : [];

  const servedLabel = hasWindow
    ? `<span class="served-label">Served ${formatServingRange(start, end, timezone)}</span>`
    : '';

  const itemHtml = items.length
    ? items.map((item) => renderMenuItem(item)).join('')
    : '<p class="empty-state">No items in this category right now.</p>';

  return [
    `<article class="category"${hasWindow ? ` data-start="${escapeHtml(start)}" data-end="${escapeHtml(end)}"` : ''}>`,
    '  <div class="category-header">',
    '    <div class="category-title-wrap">',
    `      <h2>${escapeHtml(name)}</h2>`,
    description ? `      <p class="category-description">${escapeHtml(description)}</p>` : '',
    '    </div>',
    `    ${servedLabel}`,
    '  </div>',
    `  ${itemHtml}`,
    '</article>'
  ].filter(Boolean).join('');
}

function renderMenuItem(item) {
  const safeItem = item && typeof item === 'object' ? item : {};
  const name = normalizeText(safeItem.name, 160) || 'Menu Item';
  const description = normalizeText(safeItem.description, 1200);
  const basePriceCents = normalizeCents(safeItem.base_price_cents);
  const specialPriceCents = normalizeCents(safeItem.special_price_cents);
  const activePrice = specialPriceCents === null ? basePriceCents : specialPriceCents;
  const hasAlcohol = Boolean(safeItem.is_alcohol);
  const modifierGroups = Array.isArray(safeItem.modifier_groups) ? safeItem.modifier_groups : [];

  // On special when there's a special price (distinct from the base).
  // Special items show a "Special" label + the special price; regular
  // items show their price plainly. No strikethrough.
  const onSpecial = specialPriceCents !== null && basePriceCents !== null;
  const priceMarkup = activePrice === null
    ? ''
    : `<span class="price">${onSpecial ? '<span class="special-label">Special</span>' : ''}${escapeHtml(formatCurrency(activePrice))}</span>`;

  const modifiersMarkup = modifierGroups.length
    ? `<div class="modifiers">${modifierGroups.map((group) => renderModifierGroup(group)).join('')}</div>`
    : '';

  return [
    '<article class="item">',
    '  <div class="item-head">',
    `    <h3 class="item-name">${escapeHtml(name)}${hasAlcohol ? '<span class="alcohol-pill">21+</span>' : ''}</h3>`,
    `    ${priceMarkup}`,
    '  </div>',
    description ? `  <p class="item-description">${escapeHtml(description)}</p>` : '',
    `  ${modifiersMarkup}`,
    '</article>'
  ].filter(Boolean).join('');
}

function renderModifierGroup(group) {
  const safeGroup = group && typeof group === 'object' ? group : {};
  const name = normalizeText(safeGroup.name, 120) || 'Modifier';
  const isRequired = Boolean(safeGroup.is_required);
  const minSelections = Number.isFinite(Number(safeGroup.min_selections)) ? Number(safeGroup.min_selections) : null;
  const maxSelections = Number.isFinite(Number(safeGroup.max_selections)) ? Number(safeGroup.max_selections) : null;
  const options = Array.isArray(safeGroup.options) ? safeGroup.options : [];

  const optionMarkup = options.length
    ? `<ul class="modifier-options">${options.map((option) => renderModifierOption(option)).join('')}</ul>`
    : '';

  return [
    '<section class="modifier-group">',
    '  <div class="modifier-header">',
    `    <strong>${escapeHtml(name)}</strong>`,
    isRequired ? '<span>Required</span>' : '<span>Optional</span>',
    minSelections !== null && maxSelections !== null
      ? `<span>Choose ${escapeHtml(String(minSelections))}-${escapeHtml(String(maxSelections))}</span>`
      : '',
    '  </div>',
    `  ${optionMarkup}`,
    '</section>'
  ].filter(Boolean).join('');
}

function renderModifierOption(option) {
  const safeOption = option && typeof option === 'object' ? option : {};
  const name = normalizeText(safeOption.name, 120) || 'Option';
  const delta = normalizeCents(safeOption.price_delta_cents);
  const priceDeltaLabel = delta && delta > 0 ? ` (+${formatCurrency(delta)})` : '';
  return `<li>${escapeHtml(name)}${escapeHtml(priceDeltaLabel)}</li>`;
}

function normalizeCents(value) {
  // null/undefined/'' must stay null — NOT 0. Number(null) === 0 (finite),
  // which previously made a null special_price_cents render as "$0.00"
  // with the base struck through for every non-special item.
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.round(parsed);
}

function formatCurrency(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(cents / 100);
}

function isValidServingTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value));
}

function formatServingRange(start, end) {
  return `${format12Hour(start)}-${format12Hour(end)}`;
}

function format12Hour(value) {
  const [hoursText, minutesText] = String(value).split(':');
  const hours = Number.parseInt(hoursText, 10);
  const minutes = Number.parseInt(minutesText, 10);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return escapeHtml(String(value));
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const normalizedHour = hours % 12 || 12;
  return `${normalizedHour}:${String(minutes).padStart(2, '0')} ${period}`;
}

function sanitizeHexColor(value, fallback) {
  const normalized = normalizeText(value || '', 7);
  return /^#[0-9A-Fa-f]{6}$/.test(normalized) ? normalized : fallback;
}

function safeFontFamily(font) {
  const cleaned = String(font || '').replace(/[^a-zA-Z0-9 -]/g, '').trim();
  if (!cleaned) {
    return SYSTEM_FONT_STACK;
  }
  return `'${cleaned}', ${SYSTEM_FONT_STACK}`;
}

function googleFontHref(font) {
  const cleaned = String(font || '').replace(/[^a-zA-Z0-9 -]/g, '').trim();
  if (!cleaned) {
    return null;
  }
  const family = cleaned.replace(/\s+/g, '+');
  return `https://fonts.googleapis.com/css2?family=${family}:wght@400;600;700&display=swap`;
}

function safeLogoUrl(url) {
  const normalized = normalizeText(url || '', 2000);
  if (!/^https?:\/\//i.test(normalized)) {
    return null;
  }
  return normalized;
}

function hexToRgba(hex, alpha) {
  const normalizedAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
  if (!/^#[0-9A-Fa-f]{6}$/.test(String(hex))) {
    return hex;
  }
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${normalizedAlpha})`;
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
  const pages = ['/', '/features', '/pricing.html', '/privacy.html', '/terms.html'];
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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
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
