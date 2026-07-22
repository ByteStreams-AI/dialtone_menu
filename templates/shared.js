// templates/shared.js — the ctx normalizer + helpers shared by every template.
// Extracted verbatim from worker.js (Option A, #914). buildMenuCtx() is the
// single seam: worker's buildMenuSuccessResponse computed these bindings then
// branched; now every template's render(ctx) consumes the same object.

// ---- fallbacks (mirror worker.js) ----
export const FALLBACK_PRIMARY = '#06234B';
export const FALLBACK_SECONDARY = '#E8A020';
export const SYSTEM_FONT_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// ---- pure format/normalize helpers (verbatim from worker.js) ----
export function normalizeCents(value) {
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

export function formatCurrency(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(cents / 100);
}

export function isValidServingTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value));
}

export function formatServingRange(start, end) {
  return `${format12Hour(start)}-${format12Hour(end)}`;
}

export function format12Hour(value) {
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

export function sanitizeHexColor(value, fallback) {
  const normalized = normalizeText(value || '', 7);
  return /^#[0-9A-Fa-f]{6}$/.test(normalized) ? normalized : fallback;
}

export function safeFontFamily(font) {
  const cleaned = String(font || '').replace(/[^a-zA-Z0-9 -]/g, '').trim();
  if (!cleaned) {
    return SYSTEM_FONT_STACK;
  }
  return `'${cleaned}', ${SYSTEM_FONT_STACK}`;
}

export function googleFontHref(font) {
  const cleaned = String(font || '').replace(/[^a-zA-Z0-9 -]/g, '').trim();
  if (!cleaned) {
    return null;
  }
  const family = cleaned.replace(/\s+/g, '+');
  return `https://fonts.googleapis.com/css2?family=${family}:wght@400;600;700&display=swap`;
}

export function safeLogoUrl(url) {
  const normalized = normalizeText(url || '', 2000);
  if (!/^https?:\/\//i.test(normalized)) {
    return null;
  }
  return normalized;
}

export function hexToRgba(hex, alpha) {
  const normalizedAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
  if (!/^#[0-9A-Fa-f]{6}$/.test(String(hex))) {
    return hex;
  }
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${normalizedAlpha})`;
}
export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function normalizeText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

// ---- app-download QR (shared by both templates) ----
// App-download QR. Static, self-contained SVG — encodes https://dialtone.menu
// for now; will retarget the App Store / Play Store once the app ships.
// Regenerate with:
//   npx qrcode -e M -t svg -o qr.svg "<url>"   (margin:0; framed by CSS quiet zone)
// Shared by BOTH templates — it lived inline in the lacquer body, which sits
// after the 'cards' early-return, so a cards tenant silently lost the app CTA.
export const APP_QR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25" shape-rendering="crispEdges"><path fill="#ffffff" d="M0 0h25v25H0z"/><path stroke="#000000" d="M0 0.5h7m1 0h5m1 0h1m3 0h7M0 1.5h1m5 0h1m1 0h1m3 0h2m4 0h1m5 0h1M0 2.5h1m1 0h3m1 0h1m1 0h2m3 0h2m3 0h1m1 0h3m1 0h1M0 3.5h1m1 0h3m1 0h1m3 0h1m1 0h2m1 0h2m1 0h1m1 0h3m1 0h1M0 4.5h1m1 0h3m1 0h1m1 0h1m2 0h1m2 0h1m3 0h1m1 0h3m1 0h1M0 5.5h1m5 0h1m4 0h1m2 0h1m3 0h1m5 0h1M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M10 7.5h2m1 0h1m2 0h1M0 8.5h1m2 0h6m1 0h1m3 0h4m2 0h1m1 0h3M0 9.5h2m1 0h1m1 0h1m2 0h1m1 0h1m1 0h4m3 0h5M0 10.5h1m2 0h7m1 0h3m1 0h1m1 0h1m2 0h2m2 0h1M0 11.5h1m2 0h1m3 0h6m2 0h1m2 0h2m1 0h4M1 12.5h1m1 0h1m1 0h2m2 0h4m3 0h1m1 0h2m4 0h1M0 13.5h1m6 0h1m1 0h1m3 0h1m1 0h2m3 0h1m2 0h1M0 14.5h2m1 0h5m2 0h6m2 0h1m1 0h5M0 15.5h1m1 0h1m1 0h1m6 0h1m3 0h1m1 0h3m1 0h2m1 0h1M0 16.5h1m1 0h1m2 0h4m1 0h1m3 0h1m1 0h5m1 0h2M8 17.5h2m1 0h3m2 0h1m3 0h1m1 0h2M0 18.5h7m1 0h4m4 0h1m1 0h1m1 0h1m3 0h1M0 19.5h1m5 0h1m1 0h1m3 0h1m1 0h3m3 0h1m2 0h2M0 20.5h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h9m2 0h2M0 21.5h1m1 0h3m1 0h1m1 0h2m4 0h1m1 0h3m4 0h2M0 22.5h1m1 0h3m1 0h1m3 0h1m1 0h1m1 0h1m2 0h1m2 0h5M0 23.5h1m5 0h1m2 0h2m3 0h2m3 0h2m1 0h3M0 24.5h7m1 0h3m2 0h2m1 0h3m2 0h1m2 0h1"/></svg>';

export function renderAppQr() {
  return (
    `<a class="app-qr" href="https://dialtone.menu" target="_blank" rel="noopener noreferrer" aria-label="Download the app to order">` +
    `<span class="app-qr-code">${APP_QR_SVG}</span>` +
    `<span class="app-qr-caption">Download the app to order</span></a>`
  );
}
// ---- the ctx normalizer (the seam) ----
// Verbatim from worker.js buildMenuSuccessResponse lines 430-451: everything
// computed BEFORE the old cards early-return. Every template render(ctx)
// consumes this. menuTemplate is included so the registry can dispatch on it.
/** Weekday labels for the rendered hours table (0 = Sunday, matching the DB). */
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * The site block (#986 Phase 2). Everything here is RENDERED, never captured on
 * the site: hours, address and phone come from the admin, so a home page can't
 * disagree with the real ones. Gallery arrives as storage PATHS and the origin
 * is applied here, so no environment is baked into the payload.
 */
function buildSite(payload, options) {
  const site = payload.site && typeof payload.site === 'object' ? payload.site : {};
  const contact = payload.contact && typeof payload.contact === 'object' ? payload.contact : {};
  const hours = Array.isArray(payload.hours) ? payload.hours : [];
  const storageBase = normalizeText(options.storageBaseUrl || '', 300).replace(/\/$/, '');

  const gallery = (Array.isArray(site.gallery) ? site.gallery : [])
    .map((path) => normalizeText(path, 400))
    .filter(Boolean)
    .map((path) => (storageBase ? `${storageBase}/storage/v1/object/public/restaurant-gallery/${path}` : ''))
    .filter(Boolean);

  const socials = [
    { key: 'instagram', label: 'Instagram', url: safeLogoUrl(site.social_instagram || '') },
    { key: 'facebook', label: 'Facebook', url: safeLogoUrl(site.social_facebook || '') },
    { key: 'tiktok', label: 'TikTok', url: safeLogoUrl(site.social_tiktok || '') },
    { key: 'x', label: 'X', url: safeLogoUrl(site.social_x || '') }
  ].filter((s) => s.url);

  const addressParts = [
    normalizeText(contact.address_line1, 200),
    normalizeText(contact.city, 120),
    [normalizeText(contact.state, 40), normalizeText(contact.postal_code, 20)].filter(Boolean).join(' ')
  ].filter(Boolean);

  return {
    // Anything unrecognized behaves as menu_only — the mode can only ever turn
    // the home page ON deliberately.
    mode: normalizeText(site.mode, 20) === 'home_and_menu' ? 'home_and_menu' : 'menu_only',
    storyHeadline: normalizeText(site.story_headline, 200),
    storyBody: normalizeText(site.story_body, 5000),
    gallery,
    socials,
    phone: normalizeText(contact.phone, 40),
    address: addressParts.join(', '),
    hours: hours
      .filter((h) => h && Number.isInteger(h.day_of_week))
      .map((h) => ({
        label: DAY_LABELS[h.day_of_week] || '',
        isClosed: Boolean(h.is_closed),
        open: format12Hour(normalizeText(h.open_time, 10)),
        close: format12Hour(normalizeText(h.close_time, 10))
      }))
      .filter((h) => h.label)
  };
}

export function buildMenuCtx(payload, slug, options = {}) {
  const restaurant = payload.restaurant && typeof payload.restaurant === 'object' ? payload.restaurant : {};
  const categories = Array.isArray(payload.categories) ? payload.categories : [];

  const restaurantName = normalizeText(restaurant.name, 160) || 'Restaurant';
  const displayName = normalizeText(restaurant.display_name, 160);
  const wordmark = displayName || restaurantName;
  const tagline = normalizeText(restaurant.tagline, 240);
  const timezone = normalizeText(restaurant.timezone, 120);
  const websiteUrl = safeLogoUrl(restaurant.website_url || '');
  const logoUrl = safeLogoUrl(restaurant.logo_url || '');
  const heroImageUrl = safeLogoUrl(restaurant.hero_image_url || '');
  const primaryColor = sanitizeHexColor(restaurant.primary_color, FALLBACK_PRIMARY);
  const secondaryColor = sanitizeHexColor(restaurant.secondary_color, FALLBACK_SECONDARY);
  const pageTitle = `${wordmark} Menu | DialTone`;
  const pageDescription = tagline || `Browse the latest menu from ${restaurantName}.`;

  const fontFamily = safeFontFamily(normalizeText(restaurant.font, 120));
  const fontHref = googleFontHref(normalizeText(restaurant.font, 120));

  // Pass the requested id through untouched and let the REGISTRY decide whether
  // it exists (renderMenu falls back to lacquer for anything unknown). This was
  // a hardcoded `=== 'cards' ? 'cards' : 'lacquer'` ternary, which silently
  // coerced every NEW template back to lacquer — so adding a module and a
  // registry line was not enough to ship one (dialtone#984). Validating here
  // instead would mean importing the registry, which imports this file.
  const menuTemplate = normalizeText(restaurant.menu_template, 20);

  return {
    restaurant, categories, restaurantName, displayName, wordmark, tagline,
    timezone, websiteUrl, logoUrl, heroImageUrl, primaryColor, secondaryColor,
    pageTitle, pageDescription, fontFamily, fontHref, menuTemplate, slug,
    site: buildSite(payload, options),
    // Which surface this request resolved to, and the URL that should own it in
    // search results. Both are decided by the worker (it knows the host and the
    // path); templates only render them.
    surface: options.surface === 'home' ? 'home' : 'menu',
    canonicalUrl: normalizeText(options.canonicalUrl || '', 400),
    menuUrl: normalizeText(options.menuUrl || '', 400),
    homeUrl: normalizeText(options.homeUrl || '', 400)
  };
}
