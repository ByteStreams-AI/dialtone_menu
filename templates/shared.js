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

/**
 * A phone number as a customer should read it, not as we store it.
 *
 * Numbers are stored E.164 (`+16292503998`) because that is what Telnyx and
 * Stripe need. `+1` in front of a number on a restaurant's own page reads as
 * something to dial internationally, so US/Canada numbers render as
 * `(629) 250-3998`. Anything that is not a 10-digit NANP number is returned
 * untouched rather than mangled — better an unformatted number than a wrong one.
 *
 * The `tel:` href keeps the E.164 form, which is what actually dials correctly.
 */
export function formatPhoneForDisplay(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length !== 10) return raw;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
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
/**
 * The foreground to put ON a brand fill (dialtone#1211).
 *
 * Defining `--brand` makes the ordering controls the tenant's own colour, and a
 * hardcoded white foreground is only safe for as long as that colour is dark.
 * An operator who picks a pale brand — yellow, cream, mint — would get white on
 * it, which is the invisible-call-to-action bug this fix exists to remove,
 * reintroduced in a different colour.
 *
 * WCAG relative luminance, thresholded at the point where white and near-black
 * give equal contrast, so each side of the line gets the more legible of the
 * two. Unparseable input returns white, matching the CSS-level fallback.
 */
export function readableInkOn(hex) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(String(hex))) {
    return '#fff';
  }
  const channel = (pair) => {
    const value = Number.parseInt(pair, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(hex.slice(1, 3)) +
    0.7152 * channel(hex.slice(3, 5)) +
    0.0722 * channel(hex.slice(5, 7));
  return luminance > 0.179 ? '#111' : '#fff';
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

/**
 * The app QR, whose pitch depends on whether this page can take an order
 * (dialtone#1215).
 *
 * "Download to order" was written when the public menu was read-only and the
 * app really was the only way to order. With ordering on it becomes the most
 * prominent ordering copy above the fold, telling the guest to go install
 * something to do what the page already does — with the Add buttons directly
 * underneath it. So when ordering is on the app's pitch is what it still
 * uniquely offers: points and a saved history, not the order itself.
 *
 * The aria-label carries the same claim and moves with the caption.
 */
export function renderAppQr(orderingEnabled = false) {
  const [caption, label] = orderingEnabled
    ? ['Earn points! Download the app.', 'Earn points — download the app']
    : ['Earn points! Download to order.', 'Earn points — download the app to order'];
  return (
    `<a class="app-qr" href="https://dialtone.menu" target="_blank" rel="noopener noreferrer" aria-label="${label}">` +
    `<span class="app-qr-code">${APP_QR_SVG}</span>` +
    `<span class="app-qr-caption">${caption}</span></a>`
  );
}

/**
 * The mount point for the cart control in the template's own header
 * (dialtone#1210).
 *
 * Empty when ordering is off, like every other hook here — a tenant without
 * ordering must not pay a byte for it.
 *
 * The template decides WHERE the control sits; `apps/order` renders WHAT it is,
 * into this element. That split is the same one the rest of this file keeps:
 * the menu is per-template and server-rendered, the cart is one
 * template-agnostic surface. Three templates each rendering their own button
 * would be three implementations of one control, and the count it displays
 * lives in the bundle's state regardless.
 *
 * A page with no slot — one cached before this shipped, or a template added
 * later that forgets it — keeps the floating cart bar and loses nothing.
 */
export function renderCartSlot(orderingEnabled) {
  if (!orderingEnabled) return '';
  return '<div class="dt-cart-slot" data-dt-cart-slot></div>';
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

// schema.org dayOfWeek names, indexed 0=Sunday to match the DB day_of_week.
const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * schema.org/Restaurant JSON-LD (dialtone#986 Phase 3). The structured identity
 * that lets a search engine read the branded site as a RESTAURANT — name,
 * address, hours, phone, socials, menu link — instead of an anonymous page. It
 * is what makes the site eligible for rich results (hours, a map pin, a Menu
 * link) rather than a prettier page nobody finds. Pure emission of data the
 * admin already collects; no operator input, and emitted on both `/` and `/menu`.
 *
 * Reads raw `payload.hours` / `payload.contact` (not the display-formatted
 * `ctx.site`) because openingHoursSpecification needs 24h times + the weekday.
 * The serialized `<`/`>`/`&` are unicode-escaped so no value can break out of
 * the `<script>` (the JSON-LD injection guard); values are normalizeText-bounded.
 */
function buildRestaurantJsonLd(payload, fields) {
  const contact = payload.contact && typeof payload.contact === 'object' ? payload.contact : {};
  const hours = Array.isArray(payload.hours) ? payload.hours : [];

  const address = {};
  const line1 = normalizeText(contact.address_line1, 200);
  const city = normalizeText(contact.city, 120);
  const state = normalizeText(contact.state, 40);
  const zip = normalizeText(contact.postal_code, 20);
  if (line1) address.streetAddress = line1;
  if (city) address.addressLocality = city;
  if (state) address.addressRegion = state;
  if (zip) address.postalCode = zip;

  const openingHours = hours
    .filter(
      (h) =>
        h &&
        Number.isInteger(h.day_of_week) &&
        h.day_of_week >= 0 &&
        h.day_of_week <= 6 &&
        !h.is_closed &&
        normalizeText(h.open_time, 8) &&
        normalizeText(h.close_time, 8),
    )
    .map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${SCHEMA_DAYS[h.day_of_week]}`,
      opens: normalizeText(h.open_time, 8),
      closes: normalizeText(h.close_time, 8),
    }));

  const data = { '@context': 'https://schema.org', '@type': 'Restaurant', name: fields.name };
  if (fields.url) data.url = fields.url;
  if (fields.menuUrl) data.menu = fields.menuUrl;
  if (fields.image) data.image = fields.image;
  const phone = normalizeText(contact.phone, 40);
  if (phone) data.telephone = phone;
  if (Object.keys(address).length) data.address = { '@type': 'PostalAddress', ...address };
  const sameAs = (fields.socials || []).map((s) => s.url).filter(Boolean);
  if (sameAs.length) data.sameAs = sameAs;
  if (openingHours.length) data.openingHoursSpecification = openingHours;

  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `<script type="application/ld+json">${json}</script>`;
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

  const site = buildSite(payload, options);
  const canonicalUrl = normalizeText(options.canonicalUrl || '', 400);
  const menuUrl = normalizeText(options.menuUrl || '', 400);
  const homeUrl = normalizeText(options.homeUrl || '', 400);
  // Same structured identity on every surface + template — the restaurant is the
  // same restaurant whether the menu is Editorial or the home page is showing.
  const jsonLd = buildRestaurantJsonLd(payload, {
    name: wordmark,
    url: homeUrl || canonicalUrl || menuUrl,
    menuUrl,
    image: heroImageUrl || logoUrl,
    socials: site.socials,
  });

  return {
    restaurant, categories, restaurantName, displayName, wordmark, tagline,
    timezone, websiteUrl, logoUrl, heroImageUrl, primaryColor, secondaryColor,
    pageTitle, pageDescription, fontFamily, fontHref, menuTemplate, slug,
    site,
    jsonLd,
    // Which surface this request resolved to, and the URL that should own it in
    // search results. Both are decided by the worker (it knows the host and the
    // path); templates only render them.
    // dialtone#1182 — whether this menu takes orders. The operator toggle,
    // already resolved server-side; the templates only decide how to render it.
    orderingEnabled: Boolean(restaurant.ordering_enabled),
    // dialtone#1182 Phase 2d — the tenant the checkout submits against. Anon by
    // slug since 0072 (get_restaurant_branding_by_slug), and never trusted as an
    // authorisation: create_web_order re-prices through _price_order_items,
    // which verifies every item belongs to this restaurant. Empty until 0189 is
    // applied, which is why the island omits the field rather than sending ''.
    restaurantId: normalizeText(restaurant.id, 64),
    // The Turnstile SITE key — public by design (it appears in the markup of
    // every Turnstile-protected page); the secret stays on the Edge Function.
    // Per-environment, so it comes from the Worker rather than the database.
    // Absent until Turnstile is configured, and the checkout then renders no
    // widget — web_create_order is in mock mode in exactly that case, so the
    // two halves agree instead of the form blocking on a challenge that cannot
    // be verified.
    turnstileSiteKey: normalizeText(options.turnstileSiteKey, 200),
    stripePublishableKey: normalizeText(options.stripePublishableKey, 200),
    surface: options.surface === 'home' ? 'home' : 'menu',
    canonicalUrl,
    menuUrl,
    homeUrl
  };
}

// ── Ordering hooks (dialtone#1182 Phase 2c) ─────────────────────────────────
//
// Ordering is ORTHOGONAL to the template: an operator picks a look and,
// separately, whether the menu takes orders. So the affordance lives here, in
// ONE implementation themed by the per-tenant brand tokens, and each template
// only decides WHERE it sits and how it is styled. Template four inherits
// ordering by calling these, not by implementing a checkout.
//
// Nothing here renders when ordering is off — the brochure output is
// byte-for-byte what it was.

/**
 * Per-item attributes the cart binds to. Emitted on the item element itself so
 * a click anywhere in the row can resolve which item it was, without the cart
 * needing its own copy of the menu structure.
 */
export function orderItemAttrs(item, orderingEnabled) {
  if (!orderingEnabled) return '';
  const id = normalizeText(item && item.id, 64);
  if (!id) return '';
  return ` data-dt-item="${escapeHtml(id)}"`;
}

/**
 * The add affordance, in its three states.
 *
 * ALCOHOL IS SHOWN BUT NOT ORDERABLE. `0162` decided the public menu displays
 * alcohol in every state, while `_price_order_items` refuses it on web (#881 /
 * `0141`) because this channel cannot verify age. So the item keeps its 21+
 * pill and its place on the menu, and the button is replaced by the reason —
 * mirroring the customer app. Hiding it, or letting a guest reach the server
 * refusal, both reproduce #1158 on a customer-facing surface.
 */
export function renderOrderButton(item, orderingEnabled) {
  if (!orderingEnabled) return '';
  const safe = item && typeof item === 'object' ? item : {};
  const id = normalizeText(safe.id, 64);
  if (!id) return '';

  if (safe.is_alcohol) {
    return '<p class="dt-order-note">Order in person — we can\u2019t take 21+ items online</p>';
  }
  return `<button type="button" class="dt-order-add" data-dt-add="${escapeHtml(id)}">Add</button>`;
}

/**
 * One JSON island carrying the orderable shape of the menu — ids, prices and
 * modifier rules — so the cart can build a valid line without a second network
 * call on every menu view.
 *
 * PRICES HERE ARE FOR DISPLAY. This page is edge-cached for 300s and the server
 * re-prices every order (dialtone#1153), so the cart must show the SERVER's
 * total before payment rather than its own arithmetic. A page that quietly
 * charges a different number than it displayed is the worst version of this.
 *
 * Escaped the same way as the JSON-LD block: a literal `</script>` inside the
 * data would otherwise close the tag and inject the remainder as markup.
 */
/**
 * The script tag that loads the cart bundle (dialtone#1182).
 *
 * STABLE FILENAME BY CONSTRUCTION. The order app builds its entry to
 * `/_order/cart.js` with hashed chunks behind it, precisely because this Worker
 * has to name the bundle in someone else's page and cannot know a content hash.
 * The alternative — reading a manifest or scraping the app's index.html — costs
 * a request on every menu render to avoid one predictable filename.
 *
 * The bundle carries its own CSS, so this is the ONLY tag needed. `defer` so it
 * never blocks the menu from rendering: the menu is what the guest came for, and
 * a cart that arrives a moment later costs nothing.
 */
export function renderOrderScript(ctx) {
  if (!ctx || !ctx.orderingEnabled) return '';
  return '<script type="module" src="/_order/cart.js" defer></script>';
}

export function renderMenuDataIsland(ctx) {
  if (!ctx || !ctx.orderingEnabled) return '';
  const items = [];
  for (const category of ctx.categories || []) {
    for (const item of (category && category.items) || []) {
      const id = normalizeText(item && item.id, 64);
      if (!id) continue;
      items.push({
        id,
        name: normalizeText(item.name, 160),
        price_cents: normalizeCents(item.special_price_cents) === null
          ? normalizeCents(item.base_price_cents)
          : normalizeCents(item.special_price_cents),
        is_alcohol: Boolean(item.is_alcohol),
        modifier_groups: (Array.isArray(item.modifier_groups) ? item.modifier_groups : []).map((g) => ({
          id: normalizeText(g && g.id, 64),
          name: normalizeText(g && g.name, 160),
          is_required: Boolean(g && g.is_required),
          min_selections: normalizeCents(g && g.min_selections),
          max_selections: normalizeCents(g && g.max_selections),
          options: (Array.isArray(g && g.options) ? g.options : []).map((o) => ({
            id: normalizeText(o && o.id, 64),
            name: normalizeText(o && o.name, 160),
            price_delta_cents: normalizeCents(o && o.price_delta_cents) || 0
          }))
        }))
      });
    }
  }

  // The timezone rides along because last call is spoken as a CLOCK TIME —
  // "ordering closes at 9:45 PM" — and that has to be the restaurant's clock,
  // not the guest's. It is stable config, so the 300s cache is harmless here in
  // a way it is not for the window itself (dialtone#1173).
  const json = JSON.stringify({
    slug: ctx.slug,
    timezone: ctx.timezone || null,
    // Omitted rather than sent empty when absent (a deployment whose database
    // predates 0189): the checkout can then say "not configured" instead of
    // posting a blank tenant and reading back a generic rejection.
    ...(ctx.restaurantId ? { restaurant_id: ctx.restaurantId } : {}),
    ...(ctx.turnstileSiteKey ? { turnstile_site_key: ctx.turnstileSiteKey } : {}),
    // Same omit-when-absent rule as the tenant id: with no key the checkout
    // says payment is not set up on this menu, which is true and actionable,
    // rather than mounting a Stripe Element that cannot possibly work.
    ...(ctx.stripePublishableKey
      ? { stripe_publishable_key: ctx.stripePublishableKey }
      : {}),
    items,
  })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `<script type="application/json" id="dt-menu-data">${json}</script>`;
}

/**
 * Styling for the order affordance — one string, interpolated by every
 * template's <style>, so the three cannot drift apart on the thing that is
 * meant to be template-agnostic. Colour comes from `--brand` / `--brand-ink`,
 * which every template emits in its `:root` from the tenant's primary colour,
 * so this inherits the restaurant's look without knowing anything about the
 * template's own variable names — which do NOT agree across the three.
 *
 * That indirection is the whole point, and it silently did nothing until
 * dialtone#1211: `--brand` was named here and defined by no template, so the
 * `#111` fallback WAS the colour for every tenant on every template. Keep the
 * fallbacks — they are correct for a page rendered by an older template — but
 * do not read them as evidence the variable is set.
 */
export const ORDER_STYLES = `    .dt-order-add{appearance:none;border:0;cursor:pointer;font:inherit;font-weight:600;letter-spacing:.01em;padding:.5rem 1rem;border-radius:999px;background:var(--brand,#111);color:var(--brand-ink,#fff);margin-top:.6rem;}
    .dt-order-add:hover{filter:brightness(1.08);}
    .dt-order-add:focus-visible{outline:2px solid currentColor;outline-offset:2px;}
    .dt-order-note{margin:.6rem 0 0;font-size:.8rem;opacity:.7;}
    /* The header cart's mount point (dialtone#1210). Layout only — the control
       itself is rendered and styled by the cart bundle, because it is one
       surface across all three templates. Zero-width until the bundle fills it,
       so a page whose script has not loaded yet shows no gap. */
    .dt-cart-slot{display:flex;align-items:center;flex:0 0 auto;}`;
