// templates/cards.js — the photo-forward 'cards' template (#914).
// Body + CSS + item/section renderers, extracted verbatim from worker.js.
import {
  escapeHtml, normalizeText, normalizeCents, formatCurrency, hexToRgba,
  safeLogoUrl, isValidServingTime, formatServingRange, renderAppQr
} from './shared.js';

const MENU_CARDS_CSS = `
    *{box-sizing:border-box;} html,body{margin:0;}
    body{background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;}
    img{display:block;max-width:100%;}
    .menu-hero{position:relative;isolation:isolate;min-height:56vw;max-height:340px;overflow:hidden;background:#000;}
    .menu-hero__photo{position:absolute;inset:0;z-index:-2;background-size:cover;background-position:center;}
    /* The photo carries no text now (the identity moved to the brandbar), so
       this is only a soft landing into the page ground — NOT a legibility
       scrim. It used to ramp to 92% black to hold up the bottom-anchored
       logo/tagline, which crushed the lower half of the photo for nothing. */
    .menu-hero__scrim{position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,transparent 0%,transparent 68%,rgba(18,17,16,.72) 100%);}
    .brand-logo{width:88px;height:88px;object-fit:contain;border-radius:16px;background:rgba(255,255,255,.92);padding:8px;box-shadow:0 4px 16px rgba(0,0,0,.4);flex:0 0 auto;}
    .brand-wordmark{font-family:var(--font-display);font-weight:800;font-size:clamp(1.5rem,4vw,2rem);line-height:1;margin:0;color:var(--gold);letter-spacing:-.01em;}
    .brand-wordmark.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);}
    .tagline{margin:0;color:#ece3d7;font-size:1rem;font-weight:500;}
    /* Brandbar — identity over controls on the left, app QR held to the right. */
    .brandbar{display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;padding:1rem;max-width:1120px;margin:0 auto;border-bottom:1px solid var(--line);}
    /* Group sits at its content width so the QR's auto margins can absorb the
       leftover space evenly and centre it in the gap. */
    .brandbar__group{display:flex;flex-direction:column;gap:.75rem;flex:0 1 auto;min-width:0;}
    .brandbar__identity{display:flex;align-items:center;gap:.9rem;min-width:0;}
    .controls{display:flex;gap:.6rem;}
    /* Definite basis, not a percentage: the group is shrink-to-fit now, so a
       % basis has nothing to resolve against and collapses to the text width. */
    .select-wrap{position:relative;flex:0 0 260px;}
    .select-wrap::after{content:"";position:absolute;right:.85rem;top:50%;width:.5rem;height:.5rem;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:translateY(-70%) rotate(45deg);pointer-events:none;}
    select,.search input{width:100%;height:44px;border-radius:12px;background:var(--card);border:1px solid var(--line);color:var(--ink);font-size:.95rem;padding:0 1rem;font-family:inherit;}
    select{appearance:none;-webkit-appearance:none;padding-right:2.2rem;cursor:pointer;}
    /* Half its old width — it used to flex:1 and swallow the whole bar. */
    .search{position:relative;flex:0 0 240px;}
    .search svg{position:absolute;left:.8rem;top:50%;transform:translateY(-50%);width:1.05rem;height:1.05rem;stroke:var(--muted);fill:none;stroke-width:2;stroke-linecap:round;pointer-events:none;}
    .search input{padding-left:2.4rem;}
    .search input::placeholder{color:var(--muted);}
    .app-qr{display:inline-flex;flex-direction:column;align-items:center;gap:.5rem;text-decoration:none;flex:0 0 auto;margin:0 auto;}
    .app-qr-code{background:#fff;padding:8px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.28);}
    .app-qr-code svg{display:block;width:96px;height:96px;}
    .app-qr-caption{font-size:.72rem;font-weight:700;letter-spacing:.02em;color:var(--gold);text-align:center;}
    main{padding:1rem 1rem 2.5rem;max-width:1120px;margin:0 auto;}
    .cat{scroll-margin-top:70px;margin-top:1.8rem;}
    .cat-head{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;margin-bottom:.9rem;}
    .cat-head h2{font-family:var(--font-display);font-weight:800;font-size:1.5rem;margin:0;}
    .cat-head .dot{color:var(--primary);}
    .served{color:var(--gold);font-size:.76rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;}
    .grid{display:grid;gap:.8rem;grid-template-columns:repeat(auto-fill,minmax(285px,1fr));}
    .card{display:flex;gap:.9rem;background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;min-height:104px;}
    .card-body{flex:1;padding:.85rem .2rem .85rem .95rem;display:flex;flex-direction:column;gap:.28rem;min-width:0;}
    .card-name{margin:0;font-size:1.02rem;font-weight:700;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;}
    .card-desc{margin:0;color:var(--muted);font-size:.86rem;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    .card-price{margin-top:auto;display:flex;align-items:center;gap:.5rem;font-size:.98rem;}
    .card-price .amt{font-weight:800;font-variant-numeric:tabular-nums;}
    .card-price .was{color:var(--muted);font-size:.82rem;}
    .badge{background:var(--gold);color:#231a06;font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:.16rem .42rem;border-radius:6px;}
    .pill-21{background:transparent;border:1px solid var(--line);color:var(--muted);font-size:.62rem;font-weight:700;padding:.1rem .4rem;border-radius:999px;}
    .thumb{flex:0 0 104px;width:104px;align-self:stretch;}
    .thumb img{width:100%;height:100%;object-fit:cover;}
    .thumb--ph{display:flex;align-items:center;justify-content:center;background:radial-gradient(120% 120% at 30% 20%,var(--ph-a),transparent 60%),linear-gradient(135deg,var(--ph-b),rgba(20,10,10,.9));}
    .thumb--ph span{font-family:var(--font-display);font-weight:800;font-size:2rem;color:rgba(245,222,190,.5);}
    .empty{color:var(--muted);text-align:center;padding:2rem 0;display:none;}
    footer{border-top:1px solid var(--line);margin-top:2rem;padding:1.2rem 1rem;color:var(--muted);font-size:.8rem;text-align:center;}
    footer a{color:var(--gold);text-decoration:none;}
    @media (min-width:860px){
      html,body{height:100%;} body{overflow:hidden;}
      .layout{display:flex;flex-direction:column;height:100vh;}
      .menu-hero{flex:0 0 auto;height:clamp(240px,34vh,330px);max-height:none;min-height:0;}
      .content{flex:1;min-height:0;overflow-y:auto;}
    }
    @media (max-width:560px){
      .brandbar{gap:1rem;}
      .brandbar__group{flex:1 1 100%;}
      .app-qr{margin:0 auto;}
      /* Share the row evenly — the desktop basis (260px) would let Categories
         eat a phone-width row and squeeze Search to nothing. */
      .select-wrap{flex:1 1 0;}
      .search{flex:1 1 0;}
    }`;
function renderCardsItem(item) {
  const safe = item && typeof item === 'object' ? item : {};
  const name = normalizeText(safe.name, 160) || 'Menu Item';
  const description = normalizeText(safe.description, 600);
  const base = normalizeCents(safe.base_price_cents);
  const special = normalizeCents(safe.special_price_cents);
  const active = special === null ? base : special;
  const onSpecial = special !== null && base !== null;
  const hasAlcohol = Boolean(safe.is_alcohol);
  const img = safeLogoUrl(safe.image_url || '');
  const initial = escapeHtml((name.trim().charAt(0) || '?').toUpperCase());
  const thumb = img
    ? `<div class="thumb"><img src="${escapeHtml(img)}" alt="" loading="lazy"></div>`
    : `<div class="thumb thumb--ph" aria-hidden="true"><span>${initial}</span></div>`;
  const priceMarkup = active === null
    ? ''
    : `<div class="card-price">${onSpecial ? '<span class="badge">Special</span>' : ''}<span class="amt">${escapeHtml(formatCurrency(active))}</span>${onSpecial ? `<s class="was">${escapeHtml(formatCurrency(base))}</s>` : ''}</div>`;
  const searchKey = `${name} ${description}`.toLowerCase();
  return [
    `<article class="card" data-search="${escapeHtml(searchKey)}">`,
    '  <div class="card-body">',
    `    <h3 class="card-name">${escapeHtml(name)}${hasAlcohol ? '<span class="pill-21">21+</span>' : ''}</h3>`,
    description ? `    <p class="card-desc">${escapeHtml(description)}</p>` : '',
    `    ${priceMarkup}`,
    '  </div>',
    `  ${thumb}`,
    '</article>'
  ].filter(Boolean).join('');
}

function renderCardsSection(id, title, note, items) {
  return [
    `<section class="cat" id="${escapeHtml(id)}">`,
    '  <div class="cat-head">',
    `    <h2>${escapeHtml(title)}<span class="dot">.</span></h2>`,
    note ? `    <span class="served">${escapeHtml(note)}</span>` : '',
    '  </div>',
    `  <div class="grid">${items.map((it) => renderCardsItem(it)).join('')}</div>`,
    '</section>'
  ].filter(Boolean).join('');
}

function renderCardsMenuBody(ctx) {
  const categories = Array.isArray(ctx.categories) ? ctx.categories.filter((c) => Array.isArray(c && c.items) && c.items.length) : [];

  // Derived "Chef's Specials" — items carrying a special price (an honest
  // stand-in for a "popular" section; no popularity data exists).
  const specials = [];
  categories.forEach((c) => (c.items || []).forEach((it) => {
    if (normalizeCents(it && it.special_price_cents) !== null) specials.push(it);
  }));

  const servedNote = (c) => {
    const start = normalizeText(c.serving_start_time, 10);
    const end = normalizeText(c.serving_end_time, 10);
    return start && end && isValidServingTime(start) && isValidServingTime(end)
      ? `Served ${formatServingRange(start, end)}`
      : '';
  };

  const sections = [
    specials.length ? renderCardsSection('cat-specials', 'Chef’s Specials', '', specials) : '',
    ...categories.map((c, i) => renderCardsSection(`cat-${i}`, normalizeText(c.name, 160) || 'Menu Category', servedNote(c), c.items))
  ].filter(Boolean).join('\n');

  const options = [
    specials.length ? '<option value="cat-specials">Chef’s Specials</option>' : '',
    ...categories.map((c, i) => `<option value="cat-${i}">${escapeHtml(normalizeText(c.name, 160) || 'Menu Category')}</option>`)
  ].filter(Boolean).join('');

  const brandMark = ctx.logoUrl
    ? `<img class="brand-logo" src="${escapeHtml(ctx.logoUrl)}" alt="${escapeHtml(ctx.wordmark)} logo"><h1 class="brand-wordmark sr-only">${escapeHtml(ctx.wordmark)}</h1>`
    : `<h1 class="brand-wordmark">${escapeHtml(ctx.wordmark)}</h1>`;

  // Hero is now the photo alone — the identity moved out from under the scrim
  // and into the brandbar below it. With no photo there is nothing to show, so
  // the band is dropped entirely rather than rendering an empty black slab.
  const heroMarkup = ctx.heroImageUrl
    ? [
        '  <header class="menu-hero has-photo">',
        `    <div class="menu-hero__photo" style="background-image: url('${escapeHtml(ctx.heroImageUrl)}')"></div>`,
        '    <div class="menu-hero__scrim"></div>',
        '  </header>'
      ].join('\n')
    : '';

  // Brandbar — the identity lockup (mark + tagline) over the controls, with the
  // app QR held to the right of that whole group.
  const brandbarMarkup = [
    '      <div class="brandbar">',
    '        <div class="brandbar__group">',
    '          <div class="brandbar__identity">',
    `            ${brandMark}`,
    ctx.tagline ? `            <p class="tagline">${escapeHtml(ctx.tagline)}</p>` : '',
    '          </div>',
    '          <div class="controls">',
    '            <div class="select-wrap"><select id="catSelect" aria-label="Jump to category"><option value="" disabled selected>Categories</option>' + options + '</select></div>',
    '            <div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg><input id="q" type="search" placeholder="Search" aria-label="Search the menu"></div>',
    '          </div>',
    '        </div>',
    `        ${renderAppQr()}`,
    '      </div>'
  ].filter(Boolean).join('\n');

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeHtml(ctx.pageTitle)}</title>`,
    `  <meta name="description" content="${escapeHtml(ctx.pageDescription)}">`,
    '  <meta name="robots" content="index,follow">',
    `  <meta property="og:title" content="${escapeHtml(ctx.pageTitle)}">`,
    `  <meta property="og:description" content="${escapeHtml(ctx.pageDescription)}">`,
    '  <meta property="og:type" content="website">',
    ctx.canonicalUrl ? `  <link rel="canonical" href="${escapeHtml(ctx.canonicalUrl)}">` : '',
    `  <meta property="og:url" content="${escapeHtml(ctx.canonicalUrl || `https://dialtone.menu/m/${encodeURIComponent(ctx.slug)}`)}">`,
    `  <meta property="og:image" content="${escapeHtml(ctx.heroImageUrl || ctx.logoUrl || 'https://dialtone.menu/images/dialtone-banner.png')}">`,
    '  <meta name="twitter:card" content="summary_large_image">',
    ctx.fontHref ? '  <link rel="preconnect" href="https://fonts.googleapis.com">' : '',
    ctx.fontHref ? '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' : '',
    ctx.fontHref ? `  <link rel="stylesheet" href="${escapeHtml(ctx.fontHref)}">` : '',
    '  <style>',
    `    :root { --primary: ${ctx.primaryColor}; --gold: ${ctx.secondaryColor}; --font-display: ${ctx.fontFamily}; --bg:#121110; --bar:rgba(18,17,16,.92); --card:#1c1a18; --ink:#f4efe8; --muted:#a49a8f; --line:rgba(255,255,255,.09); --ph-a:${hexToRgba(ctx.secondaryColor, 0.16)}; --ph-b:${hexToRgba(ctx.primaryColor, 0.55)}; }`,
    MENU_CARDS_CSS,
    '  </style>',
    '</head>',
    '<body>',
    '  <div class="layout">',
    heroMarkup,
    '    <div class="content">',
    brandbarMarkup,
    '      <main>',
    `        ${sections || '<p class="empty" style="display:block">No menu items are currently available.</p>'}`,
    '        <p class="empty" id="empty">No items match your search.</p>',
    '      </main>',
    `      <footer><span>${escapeHtml(ctx.wordmark)} · Menu by <a href="https://dialtone.menu">DialTone</a></span></footer>`,
    '    </div>',
    '  </div>',
    '  <script>',
    '    (function(){',
    '      var sel=document.getElementById("catSelect");',
    '      if(sel)sel.addEventListener("change",function(){var el=document.getElementById(sel.value);if(el)el.scrollIntoView({behavior:"smooth",block:"start"});});',
    '      var q=document.getElementById("q"),cards=[].slice.call(document.querySelectorAll(".card")),cats=[].slice.call(document.querySelectorAll(".cat")),empty=document.getElementById("empty");',
    '      if(q)q.addEventListener("input",function(){',
    '        var t=q.value.trim().toLowerCase(),any=false;',
    '        cards.forEach(function(c){var m=!t||c.getAttribute("data-search").indexOf(t)>-1;c.style.display=m?"":"none";if(m)any=true;});',
    '        cats.forEach(function(cat){var vis=cat.querySelectorAll(".card:not([style*=\\"none\\"])").length;cat.style.display=vis?"":"none";});',
    '        if(empty)empty.style.display=any?"none":"block";',
    '      });',
    '    })();',
    '  </script>',
    '</body>',
    '</html>'
  ].filter(Boolean).join('\n');
}
export const cards = { id: 'cards', label: 'Cards', render: renderCardsMenuBody };
