// templates/lacquer.js — the editorial default 'lacquer' template (#914).
// The document was inlined in worker.js buildMenuSuccessResponse; here it is
// wrapped as renderLacquerMenuBody(ctx), body construction verbatim. Lacquer
// stays the default the registry falls back to.
import {
  escapeHtml, normalizeText, normalizeCents, formatCurrency, hexToRgba,
  isValidServingTime, formatServingRange, renderAppQr
} from './shared.js';

const MENU_CSS = `
    :root {
      --paper: #FBF7F0; --raised: #ffffff; --ink: #211812; --muted: #7A6A5E;
      --hairline: rgba(33, 24, 18, 0.12); --hero-ground: #17100F; --hero-ink: #FBF3E6;
      --font-body: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      --maxw: 46rem;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--font-body); font-size: 16px; line-height: 1.55; -webkit-font-smoothing: antialiased; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

    .menu-hero { position: relative; isolation: isolate; color: var(--hero-ink); background: radial-gradient(120% 90% at 82% 8%, rgba(245, 193, 74, 0.18), transparent 46%), linear-gradient(168deg, #3A0C0C 0%, #200A0A 48%, var(--hero-ground) 100%); background-color: var(--hero-ground); padding: clamp(3.25rem, 11vh, 6.5rem) 1.5rem clamp(2.5rem, 7vh, 4rem); overflow: hidden; }
    .menu-hero__photo { position: absolute; inset: 0; z-index: -2; background-size: cover; background-position: center; }
    .menu-hero__scrim { position: absolute; inset: 0; z-index: -1; background: linear-gradient(180deg, rgba(15, 8, 8, 0.34) 0%, rgba(15, 8, 8, 0.60) 100%); opacity: 0; }
    .menu-hero.has-photo .menu-hero__scrim { opacity: 1; }
    .menu-hero__inner { max-width: var(--maxw); margin: 0 auto; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.8rem; }
    .brand-logo { max-height: 104px; max-width: min(62vw, 280px); width: auto; object-fit: contain; }
    .brand-wordmark { margin: 0; font-family: var(--font-display); font-weight: 800; font-size: clamp(2.4rem, 7.5vw, 4.2rem); line-height: 0.98; letter-spacing: -0.01em; color: var(--hero-ink); text-wrap: balance; }
    .hero-rule { width: 3rem; height: 2px; border: 0; margin: 0.3rem 0 0; background: var(--brand-secondary); }
    .tagline { margin: 0.1rem 0 0; color: rgba(251, 243, 230, 0.82); font-size: clamp(1rem, 2.4vw, 1.15rem); font-style: italic; font-family: var(--font-display); }
    .hero-actions { margin-top: 1.25rem; display: flex; gap: 0.6rem; flex-wrap: wrap; justify-content: center; }
    .site-link { display: inline-flex; align-items: center; gap: 0.4rem; text-decoration: none; font-weight: 600; font-size: 0.95rem; padding: 0.68rem 1.25rem; border-radius: 999px; background: var(--brand-secondary); color: #241206; }
    .app-qr { display: inline-flex; flex-direction: column; align-items: center; gap: 0.5rem; text-decoration: none; margin-top: 1.6rem; }
    .app-qr-code { background: #fff; padding: 8px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28); }
    .app-qr-code svg { display: block; width: 104px; height: 104px; }
    .app-qr-caption { font-size: 0.8rem; font-weight: 700; letter-spacing: 0.02em; color: var(--brand-secondary); text-align: center; }

    main { max-width: var(--maxw); margin: 0 auto; padding: clamp(2rem, 6vw, 3.25rem) 1.5rem 1rem; }
    .categories { display: flex; flex-direction: column; gap: clamp(2.25rem, 6vw, 3.5rem); }
    .category-header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding-bottom: 0.65rem; margin-bottom: 1.1rem; border-bottom: 1px solid var(--hairline); }
    .category-title-wrap { display: flex; flex-direction: column; gap: 0.12rem; }
    .category-header h2 { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: clamp(1.5rem, 3.5vw, 1.95rem); color: var(--brand-primary); letter-spacing: -0.01em; }
    .category-description { margin: 0; color: var(--muted); font-size: 0.92rem; max-width: 34ch; }
    .served-label { flex: none; align-self: center; white-space: nowrap; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--brand-primary); background: var(--brand-soft); border: 1px solid var(--hairline); padding: 0.32rem 0.6rem; border-radius: 999px; }
    .served-label.later { color: var(--muted); background: transparent; }
    .item { padding: 1rem 0; border-bottom: 1px solid var(--hairline); }
    .item:last-child { border-bottom: 0; }
    .item-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
    .item-name { margin: 0; font-family: var(--font-display); font-weight: 600; font-size: 1.12rem; line-height: 1.25; color: var(--ink); }
    .alcohol-pill { margin-left: 0.5rem; vertical-align: middle; font-family: var(--font-body); font-size: 0.62rem; font-weight: 700; letter-spacing: 0.04em; color: #8A2D12; background: #FFE3D8; border: 1px solid #FFC5AF; padding: 0.1rem 0.4rem; border-radius: 999px; }
    .price { flex: none; font-weight: 600; font-size: 1.02rem; color: var(--ink); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .price .special-label { margin-right: 0.45rem; color: var(--brand-primary); font-size: 0.66em; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; vertical-align: 0.12em; }
    .item-description { margin: 0.4rem 0 0; color: var(--muted); font-size: 0.95rem; max-width: 60ch; }
    .modifiers { margin-top: 0.65rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .modifier-header { display: flex; gap: 0.5rem; flex-wrap: wrap; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--muted); }
    .modifier-options { margin: 0.3rem 0 0; padding-left: 1.1rem; color: var(--ink); font-size: 0.9rem; }
    .modifier-options li { margin: 0.15rem 0; }
    .empty-state { margin: 1rem 0 0; color: var(--muted); border: 1px dashed var(--hairline); border-radius: 12px; padding: 1rem; text-align: center; }
    footer { max-width: var(--maxw); margin: 2.25rem auto 0; padding: 1.75rem 1.5rem 2.75rem; border-top: 1px solid var(--hairline); display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; color: var(--muted); font-size: 0.8rem; }
    footer a { color: var(--brand-primary); text-decoration: none; font-weight: 600; }
    a:focus-visible, .site-link:focus-visible { outline: 2px solid var(--brand-secondary); outline-offset: 3px; border-radius: 6px; }
    @media (max-width: 560px) { .category-header { flex-direction: column; align-items: flex-start; gap: 0.4rem; } .served-label { align-self: flex-start; } }
`;
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

// Human-readable selection rule. Avoids awkward "Choose 1-1" / "Choose 0-1":
//   min === max      -> "Choose 1"
//   min === 0        -> "Choose up to 2"   (the "Optional" label covers 0)
//   otherwise        -> "Choose 1-3"
function formatSelectionRule(min, max) {
  if (min === null || max === null) return '';
  if (min === max) return `Choose ${min}`;
  if (min === 0) return `Choose up to ${max}`;
  return `Choose ${min}-${max}`;
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

  const selectionRule = formatSelectionRule(minSelections, maxSelections);

  return [
    '<section class="modifier-group">',
    '  <div class="modifier-header">',
    `    <strong>${escapeHtml(name)}</strong>`,
    isRequired ? '<span>Required</span>' : '<span>Optional</span>',
    selectionRule ? `<span>${escapeHtml(selectionRule)}</span>` : '',
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
function renderLacquerMenuBody(ctx) {
  const {
    categories, timezone, logoUrl, wordmark, websiteUrl, tagline, heroImageUrl,
    pageTitle, pageDescription, fontHref, primaryColor, secondaryColor,
    fontFamily, slug
  } = ctx;

  const categoryHtml = categories.length
    ? categories.map((category) => renderMenuCategory(category, timezone)).join('')
    : '<p class="empty-state">No menu items are currently available.</p>';

  // A logo (when present) is the hero brand mark, with the wordmark kept for SEO
  // only; without a logo the wordmark carries the hero.
  const brandMarkMarkup = logoUrl
    ? `<img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(wordmark)} logo"><h1 class="brand-wordmark sr-only">${escapeHtml(wordmark)}</h1>`
    : `<h1 class="brand-wordmark">${escapeHtml(wordmark)}</h1>`;

  const websiteCtaMarkup = websiteUrl
    ? `<a class="site-link" href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener noreferrer">Visit our site</a>`
    : '';

  const appQrMarkup = renderAppQr();

  // Hero band — brand mark + tagline + CTA + the app QR, over a lacquer ground
  // (and the operator's hero photo, when set, behind a scrim).
  const heroMarkup = [
    `  <header class="menu-hero${heroImageUrl ? ' has-photo' : ''}">`,
    heroImageUrl ? `    <div class="menu-hero__photo" style="background-image: url('${escapeHtml(heroImageUrl)}')"></div>` : '',
    '    <div class="menu-hero__scrim"></div>',
    '    <div class="menu-hero__inner">',
    `      ${brandMarkMarkup}`,
    '      <hr class="hero-rule">',
    tagline ? `      <p class="tagline">${escapeHtml(tagline)}</p>` : '',
    websiteCtaMarkup ? `      <div class="hero-actions">${websiteCtaMarkup}</div>` : '',
    `      ${appQrMarkup}`,
    '    </div>',
    '  </header>'
  ].filter(Boolean).join('\n');

  const footerMarkup = [
    '  <footer>',
    `    <span>${escapeHtml(wordmark)} · Menu by <a href="https://dialtone.menu">DialTone</a></span>`,
    '    <span>Prices and availability may change.</span>',
    '  </footer>'
  ].join('\n');

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
    `  <meta property="og:image" content="${escapeHtml(heroImageUrl || logoUrl || 'https://dialtone.menu/images/dialtone-banner.png')}">`,
    '  <meta name="twitter:card" content="summary_large_image">',
    `  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">`,
    `  <meta name="twitter:description" content="${escapeHtml(pageDescription)}">`,
    fontHref ? `  <link rel="preconnect" href="https://fonts.googleapis.com">` : '',
    fontHref ? `  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` : '',
    fontHref ? `  <link rel="stylesheet" href="${escapeHtml(fontHref)}">` : '',
    '  <style>',
    `    :root { --brand-primary: ${primaryColor}; --brand-secondary: ${secondaryColor}; --brand-soft: ${hexToRgba(primaryColor, 0.08)}; --font-display: ${fontFamily}; }`,
    MENU_CSS,
    '  </style>',
    '</head>',
    '<body>',
    heroMarkup,
    '  <main>',
    `    <section class="categories" data-restaurant-timezone="${escapeHtml(timezone)}">${categoryHtml}</section>`,
    '  </main>',
    footerMarkup,
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
  return body;
}

export const lacquer = { id: 'lacquer', label: 'Lacquer', render: renderLacquerMenuBody };
