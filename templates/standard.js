// templates/standard.js — the plain card-list menu (dialtone#984).
//
// This is the design the public menu had BEFORE the July editorial redesign
// (dialtone_menu#32), restored as a first-class option: a light page, a white
// header card holding the brand + CTA + app QR, and one white card per
// category. Ported verbatim from `98372e8^:worker.js` — its whole value is
// being the familiar, neutral choice, so it is a port and not a redesign.
//
// Who it is for: a restaurant whose brand isn't dark/editorial, or that has no
// hero photography. It deliberately does NOT render `hero_image_url` — the
// header is a card, not a photo band. An operator who wants their photo big
// picks Editorial or Cards. (The hero is still used for the social unfurl,
// where a photo beats a logo and nothing on the page changes.)
import {
  escapeHtml, normalizeText, normalizeCents, formatCurrency, hexToRgba,
  isValidServingTime, formatServingRange, renderAppQr, formatPhoneForDisplay
} from './shared.js';

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

  // On special when there's a special price (distinct from the base). Special
  // items show a "Special" label + the special price; regular items show their
  // price plainly. No strikethrough.
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
//   min === max -> "Choose 1"; min === 0 -> "Choose up to 2"; else "Choose 1-3".
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

function renderStandardMenuBody(ctx) {
  const {
    categories, timezone, logoUrl, wordmark, websiteUrl, tagline, heroImageUrl,
    pageTitle, pageDescription, fontHref, primaryColor, secondaryColor,
    fontFamily, slug, canonicalUrl
  } = ctx;

  const categoryHtml = categories.length
    ? categories.map((category) => renderMenuCategory(category, timezone)).join('')
    : '<p class="empty-state">No menu items are currently available.</p>';

  const logoMarkup = logoUrl
    ? `<img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(wordmark)} logo">`
    : `<div class="brand-wordmark">${escapeHtml(wordmark)}</div>`;

  const websiteCtaMarkup = websiteUrl
    ? `<a class="site-link" href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener noreferrer">Visit our site</a>`
    : '';

  // Back to the home page, when the operator has one. Same-host, so it reads as
  // navigation within their site rather than a jump somewhere else.
  const homeCtaMarkup =
    ctx.site.mode === 'home_and_menu' && ctx.homeUrl
      ? `<a class="home-link" href="${escapeHtml(ctx.homeUrl)}">Home</a>`
      : '';

  return [
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
    canonicalUrl ? `  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">` : '',
    `  <meta property="og:url" content="${escapeHtml(canonicalUrl || `https://dialtone.menu/m/${encodeURIComponent(slug)}`)}">`,
    // The page has no hero band, but a social unfurl still prefers a photo over
    // a logo — same order the other two templates use.
    `  <meta property="og:image" content="${escapeHtml(heroImageUrl || logoUrl || 'https://dialtone.menu/images/dialtone-banner.png')}">`,
    '  <meta name="twitter:card" content="summary_large_image">',
    `  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">`,
    `  <meta name="twitter:description" content="${escapeHtml(pageDescription)}">`,
    fontHref ? '  <link rel="preconnect" href="https://fonts.googleapis.com">' : '',
    fontHref ? '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' : '',
    fontHref ? `  <link rel="stylesheet" href="${escapeHtml(fontHref)}">` : '',
    '  <style>',
    `    :root { --brand-primary: ${primaryColor}; --brand-secondary: ${secondaryColor}; --brand-soft: ${hexToRgba(primaryColor, 0.08)}; }`,
    `    body { margin: 0; color: #122236; background: radial-gradient(circle at top right, ${hexToRgba(secondaryColor, 0.18)}, transparent 40%), #faf7f2; font-family: ${fontFamily}; }`,
    '    main { max-width: 980px; margin: 0 auto; padding: 24px 20px 56px; }',
    '    .menu-header { display: flex; justify-content: space-between; gap: 20px; align-items: center; padding: 18px 20px; border: 1px solid rgba(6, 35, 75, 0.16); border-radius: 16px; background: #ffffff; box-shadow: 0 10px 32px rgba(6, 35, 75, 0.08); }',
    '    .brand-block { display: flex; flex-direction: column; gap: 8px; min-width: 0; }',
    '    .brand-logo { max-height: 72px; max-width: min(40vw, 220px); width: auto; border-radius: 8px; object-fit: contain; }',
    '    .brand-wordmark { font-size: clamp(1.8rem, 3vw, 2.3rem); line-height: 1.05; font-weight: 700; color: var(--brand-primary); }',
    '    .tagline { margin: 0; color: #4f5e73; font-size: clamp(1.05rem, 2.2vw, 1.4rem); font-weight: 700; }',
    '    .site-link { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; background: var(--brand-primary); color: #fff; border-radius: 999px; padding: 11px 18px; font-weight: 700; white-space: nowrap; }',
    '    .home-link { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; color: var(--brand-primary); border: 1.5px solid var(--brand-primary); border-radius: 999px; padding: 9px 18px; font-weight: 700; white-space: nowrap; }',
    '    .header-aside { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; flex-shrink: 0; }',
    '    .app-qr { display: inline-flex; flex-direction: column; align-items: center; gap: 6px; text-decoration: none; }',
    '    .app-qr-code { background: #fff; padding: 8px; border-radius: 12px; border: 1px solid rgba(6, 35, 75, 0.12); box-shadow: 0 4px 14px rgba(6, 35, 75, 0.06); }',
    '    .app-qr-code svg { display: block; width: 116px; height: 116px; }',
    '    .app-qr-caption { font-size: 0.82rem; font-weight: 700; color: var(--brand-primary); text-align: center; }',
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
    '      .header-aside { align-items: flex-start; }',
    '      .site-link { width: 100%; }',
    '      .category-header { flex-direction: column; }',
    '    }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main>',
    '    <header class="menu-header">',
    `      <div class="brand-block">${logoMarkup}${tagline ? `<p class="tagline">${escapeHtml(tagline)}</p>` : ''}</div>`,
    `      <div class="header-aside">${homeCtaMarkup}${websiteCtaMarkup}${renderAppQr()}</div>`,
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
}

export const standard = {
  id: 'standard',
  label: 'Standard',
  render: renderStandardMenuBody,
  renderHome: renderStandardHomeBody
};

// ---------------------------------------------------------------------------
// Home surface (#986 Phase 2)
// ---------------------------------------------------------------------------
// Same page furniture as the menu — light ground, white cards, the brand
// tokens — so a restaurant that picks Standard gets one site rather than two
// designs bolted together.
//
// Everything degrades: no headline, no story, no photos, no socials all render
// as absence rather than as empty boxes, because an operator can enable this
// mode before writing anything (developer/restaurant-site.md §4 — warn, don't
// gate). The one element that is ALWAYS present is the menu link: even the
// emptiest home page has to be a working route to the menu, never a dead end.
function renderStandardHomeBody(ctx) {
  const {
    site, logoUrl, wordmark, websiteUrl, tagline, pageTitle, pageDescription,
    fontHref, primaryColor, secondaryColor, fontFamily, canonicalUrl, menuUrl
  } = ctx;

  const logoMarkup = logoUrl
    ? `<img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(wordmark)} logo">`
    : '';

  const galleryMarkup = site.gallery.length
    ? `<section class="gallery">${site.gallery
        .map(
          (url, i) =>
            `<img class="gallery-img" src="${escapeHtml(url)}" alt="${escapeHtml(wordmark)} photo ${i + 1}" loading="lazy">`
        )
        .join('')}</section>`
    : '';

  const hoursMarkup = site.hours.length
    ? `<section class="card info">
        <h2>Hours</h2>
        <dl class="hours">${site.hours
          .map(
            (h) =>
              `<div class="hours-row"><dt>${escapeHtml(h.label)}</dt><dd>${
                h.isClosed ? 'Closed' : `${escapeHtml(h.open)} – ${escapeHtml(h.close)}`
              }</dd></div>`
          )
          .join('')}</dl>
      </section>`
    : '';

  const contactBits = [
    site.address ? `<p class="contact-line">${escapeHtml(site.address)}</p>` : '',
    // Tell the customer WHY they would call. A bare number on a restaurant page
    // is ambiguous — this is the line that turns it into an action, and it is
    // the number the voice agent answers.
    site.phone
      ? `<p class="contact-line contact-call">To place an order or make a reservation<br>` +
        `<a class="contact-phone" href="tel:${escapeHtml(site.phone)}">${escapeHtml(formatPhoneForDisplay(site.phone))}</a></p>`
      : '',
    websiteUrl
      ? `<p class="contact-line"><a href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener noreferrer">Visit our site</a></p>`
      : ''
  ].filter(Boolean).join('');

  const contactMarkup = contactBits ? `<section class="card info"><h2>Find us</h2>${contactBits}</section>` : '';

  const socialMarkup = site.socials.length
    ? `<nav class="socials" aria-label="Social links">${site.socials
        .map(
          (s) =>
            `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.label)}</a>`
        )
        .join('')}</nav>`
    : '';

  const storyMarkup =
    site.storyHeadline || site.storyBody
      ? `<section class="card story">
          ${site.storyHeadline ? `<h1 class="story-headline">${escapeHtml(site.storyHeadline)}</h1>` : ''}
          ${site.storyBody ? `<p class="story-body">${escapeHtml(site.storyBody)}</p>` : ''}
        </section>`
      : '';

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeHtml(pageTitle)}</title>`,
    `  <meta name="description" content="${escapeHtml(pageDescription)}">`,
    '  <meta name="robots" content="index,follow">',
    canonicalUrl ? `  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">` : '',
    `  <meta property="og:title" content="${escapeHtml(pageTitle)}">`,
    `  <meta property="og:description" content="${escapeHtml(pageDescription)}">`,
    '  <meta property="og:type" content="website">',
    canonicalUrl ? `  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">` : '',
    `  <meta property="og:image" content="${escapeHtml(
      ctx.heroImageUrl || site.gallery[0] || logoUrl || 'https://dialtone.menu/images/dialtone-banner.png'
    )}">`,
    '  <meta name="twitter:card" content="summary_large_image">',
    fontHref ? '  <link rel="preconnect" href="https://fonts.googleapis.com">' : '',
    fontHref ? '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' : '',
    fontHref ? `  <link rel="stylesheet" href="${escapeHtml(fontHref)}">` : '',
    '  <style>',
    `    :root { --brand-primary: ${primaryColor}; --brand-secondary: ${secondaryColor}; --brand-soft: ${hexToRgba(primaryColor, 0.08)}; }`,
    `    body { margin: 0; color: #122236; background: radial-gradient(circle at top right, ${hexToRgba(secondaryColor, 0.18)}, transparent 40%), #faf7f2; font-family: ${fontFamily}; }`,
    '    main { max-width: 980px; margin: 0 auto; padding: 24px 20px 56px; display: grid; gap: 18px; }',
    '    .site-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 20px; border: 1px solid rgba(6, 35, 75, 0.16); border-radius: 16px; background: #ffffff; box-shadow: 0 10px 32px rgba(6, 35, 75, 0.08); }',
    '    .brand-logo { max-height: 64px; max-width: min(40vw, 200px); width: auto; object-fit: contain; }',
    '    .brand-wordmark { font-size: clamp(1.6rem, 3vw, 2.1rem); font-weight: 700; color: var(--brand-primary); }',
    '    .tagline { margin: 4px 0 0; color: #4f5e73; font-weight: 700; }',
    '    .menu-cta { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; background: var(--brand-primary); color: #fff; border-radius: 999px; padding: 12px 22px; font-weight: 700; white-space: nowrap; }',
    '    .hero { border-radius: 16px; overflow: hidden; height: min(56.25vw, 46vh, 480px); background: #000 center/cover no-repeat; }',
    '    .card { background: #fff; border: 1px solid rgba(6, 35, 75, 0.12); border-radius: 14px; padding: 20px; }',
    '    .story-headline { margin: 0 0 8px; color: var(--brand-primary); font-size: clamp(1.5rem, 3vw, 2rem); }',
    '    .story-body { margin: 0; color: #40506a; font-size: 1.05rem; line-height: 1.7; white-space: pre-line; }',
    '    .gallery { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }',
    '    .gallery-img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 12px; }',
    '    .info h2 { margin: 0 0 10px; font-size: 1.05rem; color: var(--brand-primary); }',
    '    .hours { margin: 0; display: grid; gap: 4px; }',
    '    .hours-row { display: flex; justify-content: space-between; gap: 16px; color: #40506a; }',
    '    .hours-row dt { font-weight: 600; }',
    '    .hours-row dd { margin: 0; font-variant-numeric: tabular-nums; }',
    '    .contact-line { margin: 0 0 6px; color: #40506a; }',
    '    .contact-call { margin-top: 10px; line-height: 1.5; }',
    '    .contact-phone { font-size: 1.15rem; font-weight: 700; text-decoration: none; }',
    '    .contact-line a { color: var(--brand-primary); }',
    '    .socials { display: flex; flex-wrap: wrap; gap: 10px; }',
    '    .socials a { text-decoration: none; font-weight: 700; color: var(--brand-primary); background: var(--brand-soft); border-radius: 999px; padding: 8px 16px; }',
    '    .info-grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }',
    '    @media (max-width: 720px) { .menu-cta { width: 100%; } }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main>',
    '    <header class="site-header">',
    `      <div>${logoMarkup || `<div class="brand-wordmark">${escapeHtml(wordmark)}</div>`}${
      tagline ? `<p class="tagline">${escapeHtml(tagline)}</p>` : ''
    }</div>`,
    // Always present, even on an otherwise empty home page.
    `      <a class="menu-cta" href="${escapeHtml(menuUrl || '/menu')}">View the menu</a>`,
    '    </header>',
    ctx.heroImageUrl
      ? `    <div class="hero" style="background-image: url('${escapeHtml(ctx.heroImageUrl)}')"></div>`
      : '',
    storyMarkup,
    galleryMarkup,
    hoursMarkup || contactMarkup ? `    <div class="info-grid">${hoursMarkup}${contactMarkup}</div>` : '',
    socialMarkup,
    '  </main>',
    '</body>',
    '</html>'
  ].filter(Boolean).join('\n');
}
