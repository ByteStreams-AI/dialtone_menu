/**
 * Order app forwarding (dialtone#1182 Phase 2b).
 *
 * The property under test is the BOUNDARY, not the app: which requests this
 * Worker hands to the order Worker, and what the path looks like when it gets
 * there. Getting that wrong is invisible in a status code — the order Worker's
 * SPA fallback answers 200 with HTML — so the assertions are about the
 * forwarded URL, not the response.
 *
 * The order app emits its assets under `/_order/`, so the prefix is forwarded
 * UNCHANGED. Asserting the exact forwarded path is what would catch a
 * reintroduced rewrite (dialtone#1188), which broke the app on its own host.
 *
 * KNOWN LIMIT, same as the `/menu` note in wrangler.toml: these call
 * worker.fetch() directly, which is BELOW the layer where
 * `not_found_handling = "404-page"` short-circuits non-asset paths. A missing
 * `run_worker_first` entry cannot fail here. That is what the deployed
 * verification script covers, and why both exist.
 */
import assert from 'node:assert/strict';
import worker from '../worker.js';

/** Records what the order Worker was asked for, and answers plausibly. */
function makeOrderApp() {
  const seen = [];
  return {
    seen,
    binding: {
      fetch: async (request) => {
        const url = new URL(request.url);
        seen.push(url.pathname);
        // Mimic Workers Static Assets with SPA fallback: real files answer as
        // themselves, everything else falls back to the shell. This is exactly
        // the behaviour that makes a wrong prefix look like success.
        if (url.pathname.startsWith('/_order/assets/')) {
          return new Response('console.log("bundle")', {
            status: 200,
            headers: { 'content-type': 'application/javascript' }
          });
        }
        return new Response('<!doctype html><html><body>shell</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' }
        });
      }
    }
  };
}

function envWith(orderApp) {
  return {
    PUBLIC_MENU_SUPABASE_URL: 'https://example.supabase.co',
    PUBLIC_MENU_SUPABASE_ANON_KEY: 'anon-key',
    ASSETS: { fetch: async () => new Response('asset fallback', { status: 200 }) },
    ...(orderApp ? { ORDER_APP: orderApp } : {})
  };
}

// 1. The prefix is forwarded UNCHANGED. The order Worker serves exactly these
//    paths, so anything that rewrites here puts the request somewhere no file
//    exists — and the SPA fallback then returns the shell with a 200, which
//    loads blank in a browser.
{
  const app = makeOrderApp();
  const res = await worker.fetch(
    new Request('https://suis-sushi.m.dialtone.menu/_order/assets/index-abc123.js'),
    envWith(app.binding)
  );
  assert.deepEqual(app.seen, ['/_order/assets/index-abc123.js']);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /javascript/);
}

// 2. Nested asset paths keep their shape.
{
  const app = makeOrderApp();
  await worker.fetch(
    new Request('https://suis-sushi.m.dialtone.menu/_order/assets/fonts/inter.woff2'),
    envWith(app.binding)
  );
  assert.deepEqual(app.seen, ['/_order/assets/fonts/inter.woff2']);
}

// 3. The plumbing route asks the app for its root, so the SPA fallback serves
//    the shell.
{
  const app = makeOrderApp();
  const res = await worker.fetch(
    new Request('https://suis-sushi.m.dialtone.menu/__order-plumbing'),
    envWith(app.binding)
  );
  assert.deepEqual(app.seen, ['/']);
  assert.equal(res.status, 200);
}

// 4. THE REGRESSION THIS PHASE EXISTS FOR. On a branded host every unmatched
//    path falls through to the menu renderer, so an order path that is not
//    matched FIRST returns menu HTML with a 200 — indistinguishable from success
//    to a status-code check, and a blank page in a browser. Assert the menu
//    renderer never sees it: with no upstream fetch stubbed, reaching the menu
//    path would throw or return a menu page, not the bundle.
{
  const app = makeOrderApp();
  const res = await worker.fetch(
    new Request('https://suis-sushi.m.dialtone.menu/_order/assets/index-abc123.js'),
    envWith(app.binding)
  );
  const body = await res.text();
  assert.equal(body, 'console.log("bundle")');
  assert.ok(!body.includes('<!doctype'), 'order asset must not fall through to the menu renderer');
}

// 5. Ordinary menu paths are untouched — the boundary must not swallow the host
//    it lives on.
{
  const app = makeOrderApp();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('[]', { status: 200 });
  try {
    await worker.fetch(
      new Request('https://suis-sushi.m.dialtone.menu/menu'),
      envWith(app.binding)
    );
  } catch {
    // The menu renderer may reject the stub payload; what matters is that the
    // order binding was never consulted.
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(app.seen, [], 'a menu request must not reach the order app');
}

// 6. Unbound environment (production, until the order Worker is deployed there)
//    answers 503 naming the binding rather than throwing on undefined.fetch —
//    diagnosable from the response alone.
{
  const res = await worker.fetch(
    new Request('https://suis-sushi.m.dialtone.menu/__order-plumbing'),
    envWith(null)
  );
  assert.equal(res.status, 503);
  assert.match(await res.text(), /ORDER_APP/);
}

console.log('order app forwarding tests passed');
