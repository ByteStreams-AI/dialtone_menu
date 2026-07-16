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
  assert.match(html, /\.tagline \{[^}]*font-weight: 700/, 'Tagline should be bold');
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
  // A branded menu subdomain (`<slug>.dialtone.menu`) IS that restaurant's menu.
  let rpcSlug = null;
  globalThis.fetch = async (url, options = {}) => {
    rpcSlug = JSON.parse(String(options.body || '{}')).p_slug;
    return new Response(JSON.stringify(samplePayload()), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  const subRoot = await worker.fetch(new Request('https://main-street.dialtone.menu/'), makeEnv());
  assert.equal(subRoot.status, 200, 'menu subdomain root should render the menu');
  assert.equal(rpcSlug, 'main-street', 'menu subdomain should derive the slug from the host');
  assert.match(
    await subRoot.text(),
    /<title>Main Street Kitchen Menu \| DialTone<\/title>/,
    'subdomain should render that restaurant’s menu'
  );

  // A deep link on the subdomain also lands on the menu (whole host = the menu).
  rpcSlug = null;
  const subDeep = await worker.fetch(new Request('https://main-street.dialtone.menu/anything'), makeEnv());
  assert.equal(subDeep.status, 200, 'any path on a menu subdomain renders the menu');
  assert.equal(rpcSlug, 'main-street', 'deep link still resolves the host slug');

  // Reserved app subdomains, the apex, multi-label hosts (the pay wildcard), and
  // off-domain hosts are NOT menus: no RPC lookup, falls through to the
  // marketing asset pipeline.
  for (const host of [
    'https://dialtone.menu/',
    'https://www.dialtone.menu/',
    'https://admin.dialtone.menu/',
    'https://kitchen-staging.dialtone.menu/',
    'https://pay.dialtone.menu/',
    'https://suis-sushi.pay.dialtone.menu/',
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
  const robots = await worker.fetch(new Request('https://main-street.dialtone.menu/robots.txt'), makeEnv());
  assert.match(robots.headers.get('content-type') || '', /text\/plain/, 'robots.txt resolves on a menu subdomain');

  console.log('menu subdomain routing tests passed');
}

run()
  .then(runHostRouting)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    globalThis.fetch = originalFetch;
  });
