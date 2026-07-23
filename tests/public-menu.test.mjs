import assert from 'node:assert/strict';
import worker from '../worker.js';

const originalFetch = globalThis.fetch;

function makeEnv(overrides = {}) {
  return {
    PUBLIC_MENU_SUPABASE_URL: 'https://example.supabase.co',
    PUBLIC_MENU_SUPABASE_ANON_KEY: 'anon-key',
    ASSETS: {
      fetch: async () => new Response('asset fallback', { status: 200 })
    },
    ...overrides
  };
}

function samplePayload() {
  return {
    restaurant: {
      name: 'Main <Street> Kitchen',
      display_name: 'Main Street Kitchen',
      tagline: 'Fresh & local <always>',
      logo_url: 'https://cdn.example.com/logo.png',
      primary_color: '#123456',
      secondary_color: '#DDAA33',
      font: 'Playfair Display<script>alert(1)</script>',
      website_url: 'https://mainstreet.example.com',
      timezone: 'America/Chicago'
    },
    categories: [
      {
        name: 'Breakfast Specials',
        description: 'Served early',
        sort_order: 1,
        serving_start_time: '07:00',
        serving_end_time: '11:00',
        items: [
          {
            name: 'Farm Eggs <Deluxe>',
            description: 'Two eggs & toast',
            base_price_cents: 999,
            special_price_cents: 850,
            is_alcohol: false,
            modifier_groups: [
              {
                name: 'Add-ons',
                is_required: false,
                min_selections: 0,
                max_selections: 2,
                options: [
                  { name: 'Avocado', price_delta_cents: 150 }
                ]
              },
              {
                name: 'Egg style',
                is_required: true,
                min_selections: 1,
                max_selections: 1,
                options: [
                  { name: 'Scrambled', price_delta_cents: 0 },
                  { name: 'Over easy', price_delta_cents: 0 }
                ]
              }
            ]
          },
          {
            name: 'House Granola',
            description: 'No special price',
            base_price_cents: 1299,
            special_price_cents: null,
            is_alcohol: false,
            modifier_groups: []
          }
        ]
      }
    ],
    last_updated: '2026-05-30T12:00:00.000Z'
  };
}

async function run() {
  let rpcCalls = 0;
  globalThis.fetch = async (url, options = {}) => {
    rpcCalls += 1;
    assert.equal(url, 'https://example.supabase.co/rest/v1/rpc/get_public_menu_by_slug');
    assert.equal(options.method, 'POST');

    const parsedBody = JSON.parse(String(options.body || '{}'));
    assert.equal(parsedBody.p_slug, 'main-street');
    assert.equal(options.headers.apikey, 'anon-key');

    return new Response(JSON.stringify(samplePayload()), {
      status: 200,
      headers: {
        'content-type': 'application/json'
      }
    });
  };

  const request = new Request('https://dialtone.menu/m/main-street');
  const response = await worker.fetch(request, makeEnv());
  const html = await response.text();

  assert.equal(response.status, 200, 'Public menu route should return 200 for valid slug');
  assert.equal(rpcCalls, 1, 'Public menu route should call RPC exactly once per uncached request');
  assert.match(
    response.headers.get('cache-control') || '',
    /public,\s*max-age=0,\s*s-maxage=300/,
    'Public menu response should be edge-cacheable with request-driven freshness'
  );
  assert.match(
    response.headers.get('content-type') || '',
    /^text\/html/i,
    'Public menu should render as HTML'
  );

  assert.match(html, /<title>Main Street Kitchen Menu \| DialTone<\/title>/, 'Page title should include restaurant name');
  assert.match(html, /Fresh &amp; local &lt;always&gt;/, 'Tagline should be HTML-escaped');
  assert.match(html, /Farm Eggs &lt;Deluxe&gt;/, 'Item names should be HTML-escaped');
  assert.match(html, /Visit our site/, 'Website CTA should render when website_url exists');
  assert.match(html, /target="_blank"/, 'Website CTA should open in a new tab');
  assert.match(html, /rel="noopener noreferrer"/, 'Website CTA should enforce safe rel attributes');
  // App-download QR on the right of the header + its bold caption.
  assert.match(html, /class="app-qr"[^>]*href="https:\/\/dialtone\.menu"/, 'App QR should link to dialtone.menu (retargets to app stores later)');
  assert.match(html, /class="app-qr-code"><svg[^>]*viewBox="0 0 25 25"/, 'App QR should render the self-contained SVG');
  assert.match(html, /class="app-qr-caption">Download the app to order</, 'QR caption should render');
  assert.match(html, /\.app-qr-caption \{[^}]*font-weight: 700/, 'QR caption should be bold');
  assert.match(html, /\.tagline \{[^}]*font-style: italic/, 'Tagline is an italic serif in the hero (Phase 1 redesign)');
  assert.match(html, /Served 7:00 AM-11:00 AM/, 'Serving window label should be rendered');
  // Special item: a "Special" label + the special price, no strikethrough.
  assert.match(html, /class="special-label">Special<\/span>\$8\.50/, 'Special item should show a "Special" label + the special price');
  assert.doesNotMatch(html, /<del>/, 'Special pricing should no longer use a strikethrough');
  assert.doesNotMatch(html, /\$9\.99/, 'The struck-through base price should no longer appear for a special item');
  // Regular item: plain base price, never $0.00 from a null special.
  assert.match(html, /\$12\.99/, 'Regular-priced item should show its base price plainly');
  assert.doesNotMatch(html, /\$0\.00/, 'A null special_price_cents must not render as $0.00');
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/, 'Untrusted font input should be sanitized');
  // Selection-rule phrasing: no awkward "Choose 1-1" / "Choose 0-2".
  assert.match(html, /Choose 1<\/span>/, 'min===max should read "Choose 1"');
  assert.match(html, /Choose up to 2<\/span>/, 'min 0 should read "Choose up to <max>"');
  assert.doesNotMatch(html, /Choose 1-1/, 'should not render "Choose 1-1"');
  assert.doesNotMatch(html, /Choose 0-2/, 'should not render "Choose 0-<max>"');

  globalThis.fetch = async () => new Response('null', {
    status: 200,
    headers: {
      'content-type': 'application/json'
    }
  });

  const notFoundResponse = await worker.fetch(new Request('https://dialtone.menu/m/unknown-spot'), makeEnv());
  const notFoundHtml = await notFoundResponse.text();

  assert.equal(notFoundResponse.status, 404, 'Unknown slug should return 404');
  assert.match(
    notFoundResponse.headers.get('cache-control') || '',
    /public,\s*max-age=0,\s*s-maxage=300/,
    '404 menu response should also be cacheable at edge'
  );
  assert.match(notFoundHtml, /Menu not found/, '404 page should have friendly message');

  const methodNotAllowed = await worker.fetch(
    new Request('https://dialtone.menu/m/main-street', { method: 'POST' }),
    makeEnv()
  );
  assert.equal(methodNotAllowed.status, 405, 'POST to menu route should be rejected');

  const missingConfigResponse = await worker.fetch(
    new Request('https://dialtone.menu/m/main-street'),
    makeEnv({ PUBLIC_MENU_SUPABASE_ANON_KEY: '' })
  );
  assert.equal(missingConfigResponse.status, 503, 'Missing menu RPC config should return 503');

  globalThis.fetch = async () => new Response(JSON.stringify({
    code: 'PGRST202',
    message: 'Could not find function public.get_public_menu_by_slug'
  }), {
    status: 404,
    headers: {
      'content-type': 'application/json'
    }
  });

  const missingRpcResponse = await worker.fetch(
    new Request('https://dialtone.menu/m/main-street'),
    makeEnv()
  );
  assert.equal(
    missingRpcResponse.status,
    503,
    'Missing RPC endpoint in Supabase project should surface as service unavailable'
  );

  globalThis.fetch = async () => new Response(JSON.stringify({
    message: 'Not found'
  }), {
    status: 404,
    headers: {
      'content-type': 'application/json'
    }
  });

  const slugNotFoundViaRpc404 = await worker.fetch(
    new Request('https://dialtone.menu/m/main-street'),
    makeEnv()
  );
  assert.equal(
    slugNotFoundViaRpc404.status,
    404,
    'Generic RPC 404 responses should be mapped to friendly menu-not-found'
  );
  assert.match(
    await slugNotFoundViaRpc404.text(),
    /Menu not found/,
    'Mapped menu-not-found responses should render friendly copy'
  );

  console.log('public menu route tests passed');
}

async function runHostRouting() {
  // A branded menu subdomain (`<slug>.m.dialtone.menu`) IS that restaurant's menu.
  let rpcSlug = null;
  globalThis.fetch = async (url, options = {}) => {
    rpcSlug = JSON.parse(String(options.body || '{}')).p_slug;
    return new Response(JSON.stringify(samplePayload()), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  const subRoot = await worker.fetch(new Request('https://main-street.m.dialtone.menu/'), makeEnv());
  assert.equal(subRoot.status, 200, 'menu subdomain root should render the menu');
  assert.equal(rpcSlug, 'main-street', 'menu subdomain should derive the slug from the host');
  assert.match(
    await subRoot.text(),
    /<title>Main Street Kitchen Menu \| DialTone<\/title>/,
    'subdomain should render that restaurant’s menu'
  );

  // A deep link on the subdomain also lands on the menu (whole host = the menu).
  rpcSlug = null;
  const subDeep = await worker.fetch(new Request('https://main-street.m.dialtone.menu/anything'), makeEnv());
  assert.equal(subDeep.status, 200, 'any path on a menu subdomain renders the menu');
  assert.equal(rpcSlug, 'main-street', 'deep link still resolves the host slug');

  // Names that used to be reserved to protect our own hosts are now just slugs:
  // a restaurant called "The Kitchen" can have kitchen.m.dialtone.menu, because
  // nothing but restaurants lives under .m.
  for (const slug of ['kitchen', 'admin', 'm', 'www']) {
    rpcSlug = null;
    globalThis.fetch = async (url, options = {}) => {
      rpcSlug = JSON.parse(String(options.body || '{}')).p_slug;
      return new Response(JSON.stringify(samplePayload()), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const resp = await worker.fetch(new Request(`https://${slug}.m.dialtone.menu/`), makeEnv());
    assert.equal(resp.status, 200, `${slug}.m.dialtone.menu serves a menu`);
    assert.equal(rpcSlug, slug, `${slug} is treated as a restaurant slug under .m.`);
  }

  // Reserved app subdomains, the apex, multi-label hosts (the pay wildcard), and
  // off-domain hosts are NOT menus: no RPC lookup, falls through to the
  // marketing asset pipeline.
  // The apex, the app hosts and the pay wildcard are NOT menus. This list is the
  // regression guard for dialtone#1011: a one-label host must never be read as a
  // restaurant slug again, whatever the route configuration says.
  for (const host of [
    'https://dialtone.menu/',
    'https://www.dialtone.menu/',
    'https://admin.dialtone.menu/',
    'https://kitchen.dialtone.menu/',
    'https://kitchen-staging.dialtone.menu/',
    'https://beverage.dialtone.menu/',
    'https://expo.dialtone.menu/',
    'https://pay.dialtone.menu/',
    'https://suis-sushi.pay.dialtone.menu/',
    'https://main-street.dialtone.menu/',
    'https://m.dialtone.menu/',
    'https://example.com/'
  ]) {
    let rpcCalled = false;
    globalThis.fetch = async () => {
      rpcCalled = true;
      return new Response('{}', { status: 200 });
    };
    const resp = await worker.fetch(new Request(host), makeEnv());
    assert.equal(rpcCalled, false, `${host} must not trigger a menu lookup`);
    assert.equal(await resp.text(), 'asset fallback', `${host} should serve the marketing site, not a menu`);
  }

  // Crawler paths still resolve on a menu subdomain (they don't render the menu).
  globalThis.fetch = async () => new Response('null', { status: 200, headers: { 'content-type': 'application/json' } });
  const robots = await worker.fetch(new Request('https://main-street.m.dialtone.menu/robots.txt'), makeEnv());
  assert.match(robots.headers.get('content-type') || '', /text\/plain/, 'robots.txt resolves on a menu subdomain');

  console.log('menu subdomain routing tests passed');
}

// #986 Phase 2 — what the root serves depends on site_mode, but /menu and
// /m/<slug> must be the menu FOREVER, because that is what printed QR codes
// point at.
async function runSiteSurfaces() {
  const withSite = (mode, extra = {}) => {
    const p = samplePayload();
    p.restaurant.menu_template = 'standard';
    p.site = {
      mode,
      story_headline: 'Fire, salt, time',
      story_body: 'We opened in 2019.',
      gallery: ['r1/a.webp'],
      social_instagram: 'https://instagram.com/place',
      ...extra
    };
    p.contact = { phone: '+15551110000', address_line1: '1 Main St', city: 'Chicago', state: 'IL', postal_code: '60654' };
    p.hours = [{ day_of_week: 1, open_time: '11:00', close_time: '21:00', is_closed: false }];
    return p;
  };
  const serve = async (payload, requestUrl) => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
    return (await worker.fetch(new Request(requestUrl), makeEnv())).text();
  };

  // --- menu_only: the root is the menu, exactly as before this feature.
  const menuOnlyRoot = await serve(withSite('menu_only'), 'https://main-street.m.dialtone.menu/');
  assert.match(menuOnlyRoot, /class="menu-header"/, 'menu_only root renders the menu');
  assert.doesNotMatch(menuOnlyRoot, /class="site-header"/, 'menu_only root is not the home page');
  // Both copies of the menu point at the root, which is the address the
  // operator promotes — otherwise they compete as duplicate content.
  assert.match(menuOnlyRoot, /rel="canonical" href="https:\/\/main-street\.m\.dialtone\.menu\/"/, 'menu_only root self-canonicalizes');
  const menuOnlyMenu = await serve(withSite('menu_only'), 'https://main-street.m.dialtone.menu/menu');
  assert.match(menuOnlyMenu, /rel="canonical" href="https:\/\/main-street\.m\.dialtone\.menu\/"/, 'menu_only /menu canonicalizes to the root');

  // --- home_and_menu: the root becomes the home page, /menu stays the menu.
  const homeRoot = await serve(withSite('home_and_menu'), 'https://main-street.m.dialtone.menu/');
  assert.match(homeRoot, /class="site-header"/, 'home mode renders the home page at the root');
  assert.match(homeRoot, /Fire, salt, time/, 'the story headline renders');
  assert.match(homeRoot, /View the menu/, 'the home page always links to the menu');
  assert.match(homeRoot, /restaurant-gallery\/r1\/a\.webp/, 'gallery paths become URLs on the storage origin');
  assert.match(homeRoot, /11:00 AM/, 'hours render from the admin, not re-entered content');
  assert.match(homeRoot, /rel="canonical" href="https:\/\/main-street\.m\.dialtone\.menu\/"/, 'the home page is canonical for itself');

  const homeMenu = await serve(withSite('home_and_menu'), 'https://main-street.m.dialtone.menu/menu');
  assert.match(homeMenu, /class="menu-header"/, '/menu is the menu even with a home page enabled');
  // The return trip: the menu links BACK to the home page when one exists.
  assert.match(homeMenu, /class="home-link" href="https:\/\/main-street\.m\.dialtone\.menu\/"/, 'the menu links home when a home page exists');

  // …and does not when there is nowhere to go.
  const menuOnlyRootAgain = await serve(withSite('menu_only'), 'https://main-street.m.dialtone.menu/');
  assert.doesNotMatch(menuOnlyRootAgain, /class="home-link"/, 'no Home link in menu_only — there is no home page');

  // The legacy path form gets no Home link: /m/<slug> is always the menu, and a
  // nav link should not move the visitor to a different host mid-session.
  const legacyHomeMode = await serve(withSite('home_and_menu'), 'https://dialtone.menu/m/main-street');
  assert.doesNotMatch(legacyHomeMode, /class="home-link"/, 'no Home link on the path form');
  assert.match(homeMenu, /rel="canonical" href="https:\/\/main-street\.m\.dialtone\.menu\/menu"/, '/menu is canonical for itself in home mode');

  // The phone line tells the customer WHY to call, and shows the number the way
  // they would read it — E.164 is what Telnyx and Stripe need, not what belongs
  // on a restaurant's own page.
  assert.match(homeRoot, /To place an order or make a reservation/, 'the call-to-action explains the number');
  assert.match(homeRoot, /\(555\) 111-0000/, 'the number renders without the +1');
  assert.match(homeRoot, /href="tel:\+15551110000"/, 'the tel: link keeps E.164, which is what dials');

  // --- the promise that protects printed QR codes.
  const legacy = await serve(withSite('home_and_menu'), 'https://dialtone.menu/m/main-street');
  assert.match(legacy, /class="menu-header"/, '/m/<slug> is ALWAYS the menu, even in home mode');
  assert.doesNotMatch(legacy, /class="site-header"/, '/m/<slug> never becomes the home page');

  // --- an unset/unknown mode behaves as menu_only: this feature can only be
  // turned on deliberately.
  const unknown = await serve(withSite('landing'), 'https://main-street.m.dialtone.menu/');
  assert.match(unknown, /class="menu-header"/, 'an unknown site_mode falls back to the menu');

  // --- every template renders its OWN home surface (#986 Phase 2b). They all
  // borrowed Standard's until now, which gave an Editorial restaurant a light
  // card-list home page — one site, two designs.
  const homeSignatures = {
    lacquer: /class="menu-hero/,      // the lacquer band, not a header card
    cards: /class="brandbar/,          // identity over the photo
    standard: /class="site-header"/    // the white header card
  };
  for (const [template, signature] of Object.entries(homeSignatures)) {
    const p = withSite('home_and_menu');
    p.restaurant.menu_template = template;
    const home = await serve(p, 'https://main-street.m.dialtone.menu/');
    assert.match(home, signature, `${template} renders its own home surface`);
    assert.match(home, /View the menu/, `${template} home always links to the menu`);
    assert.match(home, /Fire, salt, time/, `${template} home renders the story`);
    assert.match(home, /restaurant-gallery\/r1\/a\.webp/, `${template} home renders the gallery`);
    assert.match(home, /11:00 AM/, `${template} home renders hours from the admin`);
  }

  // An unknown template id falls back to the default template's home rather
  // than rendering nothing.
  const unknownHome = withSite('home_and_menu');
  unknownHome.restaurant.menu_template = 'no-such-template';
  const fallbackHome = await serve(unknownHome, 'https://main-street.m.dialtone.menu/');
  assert.match(fallbackHome, homeSignatures.lacquer, 'an unknown template falls back to the default home');

  // Each template's MENU carries the Home link, not just Standard's.
  for (const template of ['lacquer', 'cards', 'standard']) {
    const p = withSite('home_and_menu');
    p.restaurant.menu_template = template;
    const menu = await serve(p, 'https://main-street.m.dialtone.menu/menu');
    assert.match(menu, /class="home-link"/, `${template} menu links home`);
  }

  console.log('site surface routing tests passed');
}

async function runTemplateSelection() {
  // Default template (no menu_template) → the editorial 'lacquer' body.
  globalThis.fetch = async () =>
    new Response(JSON.stringify(samplePayload()), { status: 200, headers: { 'content-type': 'application/json' } });
  const lacquer = await (await worker.fetch(new Request('https://dialtone.menu/m/main-street'), makeEnv())).text();
  assert.match(lacquer, /class="menu-hero/, 'default template renders the lacquer hero');
  assert.match(lacquer, /class="item"/, 'default template renders typographic item rows');
  assert.doesNotMatch(lacquer, /id="catSelect"/, 'default template has no cards category dropdown');

  // menu_template = 'cards' → the photo-forward cards body, with item photos.
  const cardsPayload = samplePayload();
  cardsPayload.restaurant.menu_template = 'cards';
  cardsPayload.categories[0].items[0].image_url = 'https://cdn.example.com/eggs.jpg';
  // second item has no image_url → placeholder tile.
  globalThis.fetch = async () =>
    new Response(JSON.stringify(cardsPayload), { status: 200, headers: { 'content-type': 'application/json' } });
  const cards = await (await worker.fetch(new Request('https://dialtone.menu/m/main-street'), makeEnv())).text();

  assert.match(cards, /id="catSelect"/, 'cards template renders the category dropdown');
  assert.match(cards, /id="q"[^>]*type="search"/, 'cards template renders the search field');
  assert.match(cards, /class="grid"/, 'cards template renders the card grid');
  assert.match(cards, /class="card"/, 'cards template renders item cards');
  assert.match(cards, /<img src="https:\/\/cdn\.example\.com\/eggs\.jpg"[^>]*loading="lazy"/, 'an item photo renders as a thumbnail');
  assert.match(cards, /class="thumb thumb--ph"/, 'a photo-less item renders the branded placeholder tile');
  // A special item → a "Special" badge + struck base price.
  assert.match(cards, /class="badge">Special<\/span>/, 'special items show a Special badge in cards');
  assert.doesNotMatch(cards, /class="menu-hero__inner">\s*<img class="brand-logo"[^>]*>\s*<h1 class="brand-wordmark">/, 'cards uses its own hero, not lacquer rows');
  // Escaping still holds (untrusted font in samplePayload).
  assert.doesNotMatch(cards, /<script>alert\(1\)<\/script>/, 'untrusted font input is sanitized in cards');

  // menu_template = 'standard' → the plain card list (dialtone#984). This is
  // the case the OLD hardcoded `=== 'cards' ? 'cards' : 'lacquer'` ternary in
  // buildMenuCtx silently swallowed: the module and the registry entry existed
  // and the page still rendered lacquer.
  const standardPayload = samplePayload();
  standardPayload.restaurant.menu_template = 'standard';
  standardPayload.restaurant.hero_image_url = 'https://cdn.example.com/hero.jpg';
  globalThis.fetch = async () =>
    new Response(JSON.stringify(standardPayload), { status: 200, headers: { 'content-type': 'application/json' } });
  const standard = await (await worker.fetch(new Request('https://dialtone.menu/m/main-street'), makeEnv())).text();

  assert.match(standard, /class="menu-header"/, 'standard renders the white header card');
  assert.match(standard, /class="categories"/, 'standard renders the category card list');
  assert.match(standard, /class="modifier-group"/, 'standard renders modifier groups');
  assert.doesNotMatch(standard, /id="catSelect"/, 'standard has no cards category dropdown');
  // The header is a CARD, not a photo band — standard deliberately ignores the
  // hero even when one is set. Only the social unfurl uses it.
  assert.doesNotMatch(standard, /class="menu-hero/, 'standard renders no hero band');
  assert.match(
    standard,
    /property="og:image" content="https:\/\/cdn\.example\.com\/hero\.jpg"/,
    'standard still prefers the hero for the social unfurl',
  );
  assert.doesNotMatch(standard, /<script>alert\(1\)<\/script>/, 'untrusted font input is sanitized in standard');

  // An unknown/legacy value falls back to lacquer rather than 500ing or blanking.
  const legacyPayload = samplePayload();
  legacyPayload.restaurant.menu_template = 'no-such-template';
  globalThis.fetch = async () =>
    new Response(JSON.stringify(legacyPayload), { status: 200, headers: { 'content-type': 'application/json' } });
  const legacy = await (await worker.fetch(new Request('https://dialtone.menu/m/main-street'), makeEnv())).text();
  assert.match(legacy, /class="menu-hero/, 'an unknown template id falls back to lacquer');

  console.log('menu template selection tests passed');
}

run()
  .then(runHostRouting)
  .then(runTemplateSelection)
  .then(runSiteSurfaces)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    globalThis.fetch = originalFetch;
  });
