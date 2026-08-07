/**
 * The ordering-window route (dialtone#1173).
 *
 * `/api/order-window` answers "can an order be placed right now, and when does
 * that stop". The properties worth pinning are the ones a status code hides:
 *
 * - it is NEVER cacheable — a cached window is precisely the bug this route
 *   exists to avoid, since the menu page it sits on is edge-cached for 300s;
 * - the slug comes from the HOST when there is one, so a query param cannot
 *   ask one restaurant's page about another restaurant's hours;
 * - it must be matched ABOVE the branded-host branch, which otherwise renders
 *   the menu for every unmatched path and would answer this with HTML.
 *
 * Same known limit as the other worker tests: these call `worker.fetch()`
 * directly, below the layer where `not_found_handling` short-circuits. `/api/*`
 * is already in `run_worker_first`, which is what makes the route reachable in
 * a real deploy.
 */
import assert from 'node:assert/strict';

import worker from '../worker.js';

const originalFetch = globalThis.fetch;

function makeEnv(overrides = {}) {
  return {
    PUBLIC_MENU_SUPABASE_URL: 'https://example.supabase.co',
    PUBLIC_MENU_SUPABASE_ANON_KEY: 'anon-key',
    ASSETS: { fetch: async () => new Response('asset fallback', { status: 200 }) },
    ...overrides,
  };
}

const WINDOW_ROW = {
  open_now: true,
  closes_at: '2026-08-07T03:00:00.000Z',
  cutoff_at: '2026-08-07T02:45:00.000Z',
  accepting_orders: true,
  notice_at: '2026-08-07T02:15:00.000Z',
  manual_closure: false,
  closure_message: null,
};

/** Records what the RPC was asked, and answers with `rows`. */
function stubRpc(rows, status = 200) {
  const seen = [];
  globalThis.fetch = async (url, options = {}) => {
    seen.push({ url: String(url), body: JSON.parse(options.body || '{}') });
    return new Response(JSON.stringify(rows), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return seen;
}

try {
  // 1. The happy path: the row is passed through and the response cannot be
  //    cached by anything.
  {
    const seen = stubRpc([WINDOW_ROW]);
    const res = await worker.fetch(
      new Request('https://suis-sushi.m.dialtone.menu/api/order-window'),
      makeEnv(),
      {},
    );

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store',
      'a cached ordering window is the bug this route exists to avoid');
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await res.json(), WINDOW_ROW);

    assert.equal(seen.length, 1);
    assert.match(seen[0].url, /\/rest\/v1\/rpc\/get_order_window_by_slug$/);
    assert.deepEqual(seen[0].body, { p_slug: 'suis-sushi' },
      'the slug must come from the host on a branded menu domain');
  }

  // 2. The branded host WINS over a query param. Otherwise one restaurant's
  //    menu page could be made to display another restaurant's last call.
  {
    const seen = stubRpc([WINDOW_ROW]);
    await worker.fetch(
      new Request('https://suis-sushi.m.dialtone.menu/api/order-window?slug=rival-ramen'),
      makeEnv(),
      {},
    );
    assert.deepEqual(seen[0].body, { p_slug: 'suis-sushi' },
      'a query param must not override the host');
  }

  // 3. On a host with no slug in it — the `/m/<slug>` form, and the preview
  //    Worker's workers.dev host — the query param is the only source.
  {
    const seen = stubRpc([WINDOW_ROW]);
    const res = await worker.fetch(
      new Request('https://dialtone-menu-preview.workers.dev/api/order-window?slug=suis-sushi'),
      makeEnv(),
      {},
    );
    assert.equal(res.status, 200);
    assert.deepEqual(seen[0].body, { p_slug: 'suis-sushi' });
  }

  // 4. A closed restaurant is a normal 200 answer, not an error. The client
  //    distinguishes closed / past-cutoff / manually closed by the fields.
  {
    stubRpc([{
      open_now: false,
      closes_at: null,
      cutoff_at: null,
      accepting_orders: false,
      notice_at: null,
      manual_closure: true,
      closure_message: 'Closed for a private event',
    }]);
    const res = await worker.fetch(
      new Request('https://suis-sushi.m.dialtone.menu/api/order-window'),
      makeEnv(),
      {},
    );
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.accepting_orders, false);
    assert.equal(body.manual_closure, true);
    assert.equal(body.closure_message, 'Closed for a private event');
  }

  // 5. An unknown slug returns no rows — 404, and distinguishable from an
  //    outage so the client can tell "no such restaurant" from "try later".
  {
    stubRpc([]);
    const res = await worker.fetch(
      new Request('https://nobody.m.dialtone.menu/api/order-window'),
      makeEnv(),
      {},
    );
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'unknown_slug');
    assert.equal(res.headers.get('cache-control'), 'no-store');
  }

  // 6. Upstream failure is a 502 the client can fail OPEN on. The server still
  //    refuses the order at submit, so blocking a guest because our own check
  //    is down would cost an order and protect nothing.
  {
    globalThis.fetch = async () => { throw new Error('network down'); };
    const res = await worker.fetch(
      new Request('https://suis-sushi.m.dialtone.menu/api/order-window'),
      makeEnv(),
      {},
    );
    assert.equal(res.status, 502);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  }

  // 7. Missing configuration is 503, matching the menu route's own semantics.
  {
    stubRpc([WINDOW_ROW]);
    const res = await worker.fetch(
      new Request('https://suis-sushi.m.dialtone.menu/api/order-window'),
      makeEnv({ PUBLIC_MENU_SUPABASE_ANON_KEY: '' }),
      {},
    );
    assert.equal(res.status, 503);
  }

  // 8. No usable slug at all — a bare host and no query param.
  {
    stubRpc([WINDOW_ROW]);
    const res = await worker.fetch(
      new Request('https://dialtone.menu/api/order-window'),
      makeEnv(),
      {},
    );
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'invalid_slug');
  }

  // 9. The route is matched ABOVE the branded-host catch-all. Without that it
  //    would render the MENU — 200, HTML, and a client parsing hours out of a
  //    web page. Asserting the content type is what notices.
  {
    stubRpc([WINDOW_ROW]);
    const res = await worker.fetch(
      new Request('https://suis-sushi.m.dialtone.menu/api/order-window'),
      makeEnv(),
      {},
    );
    assert.doesNotMatch(res.headers.get('content-type'), /text\/html/,
      'the window route must not fall through to the menu renderer');
  }

  console.log('order window tests passed');
} finally {
  globalThis.fetch = originalFetch;
}
