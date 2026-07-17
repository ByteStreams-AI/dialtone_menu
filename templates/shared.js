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
export function buildMenuCtx(payload, slug) {
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

  const menuTemplate = normalizeText(restaurant.menu_template, 20) === 'cards' ? 'cards' : 'lacquer';

  return {
    restaurant, categories, restaurantName, displayName, wordmark, tagline,
    timezone, websiteUrl, logoUrl, heroImageUrl, primaryColor, secondaryColor,
    pageTitle, pageDescription, fontFamily, fontHref, menuTemplate, slug
  };
}
