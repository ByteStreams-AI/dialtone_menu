/**
 * The order-submit proxy (dialtone#1182 Phase 2d).
 *
 * The proxy itself is trivial; the properties that are not are about what
 * reaches the Edge Function.
 *
 * THE CLIENT IP IS THE POINT. `web_create_order` throttles per IP, reading
 * `cf-connecting-ip` and then `x-forwarded-for`. A sub-request from this Worker
 * arrives with the Worker's egress IP unless the guest's is copied on
 * deliberately — which would turn a per-guest limit into one global bucket
 * every guest shares and one attacker exhausts. That failure is completely
 * invisible in a response: orders keep succeeding until the shared limit trips.
 *
 * Only Cloudflare's `cf-connecting-ip` is passed on, and nothing else from the
 * incoming request. Cloudflare sets that header itself and a client cannot
 * forge it; forwarding client-supplied headers would let a caller choose its
 * own rate-limit bucket.
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

const ORDER = {
  restaurant_id: '11111111-1111-1111-1111-111111111111',
  customer_name: 'Sam',
  customer_phone: '+15125550123',
  items: [{ menu_item_id: 'item-roll', quantity: 1 }],
  fulfillment: 'pickup',
  join_loyalty: false,
};

/** Records what the Edge Function was asked, and answers with `reply`. */
function stubFunction(reply = { status: 'ok', order_id: 'o1', short_code: 'ABC123' }, status = 200) {
  const seen = [];
  globalThis.fetch = async (url, options = {}) => {
    seen.push({
      url: String(url),
      method: options.method,
      headers: options.headers ?? {},
      body: options.body,
    });
    return new Response(JSON.stringify(reply), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return seen;
}

function post(headers = {}, body = ORDER) {
  return new Request('https://suis-sushi.m.dialtone.menu/api/order', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

try {
  // 1. The body reaches the Edge Function unchanged, and the answer comes back
  //    verbatim — the refusal wording lives in one place, not two.
  {
    const seen = stubFunction();
    const res = await worker.fetch(post({ 'cf-connecting-ip': '203.0.113.7' }), makeEnv(), {});

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await res.json(), { status: 'ok', order_id: 'o1', short_code: 'ABC123' });

    assert.equal(seen.length, 1);
    assert.match(seen[0].url, /\/functions\/v1\/web_create_order$/);
    assert.equal(seen[0].method, 'POST');
    assert.deepEqual(JSON.parse(seen[0].body), ORDER);
  }

  // 2. THE GUEST'S IP IS PASSED ON. Without this every order shares one bucket.
  {
    const seen = stubFunction();
    await worker.fetch(post({ 'cf-connecting-ip': '203.0.113.7' }), makeEnv(), {});
    assert.equal(seen[0].headers['cf-connecting-ip'], '203.0.113.7',
      'the per-IP throttle sees the Worker, not the guest, without this');
  }

  // 3. Nothing ELSE from the incoming request is forwarded. A caller that sends
  //    its own x-forwarded-for must not be able to pick its rate-limit bucket —
  //    `clientIpFromHeaders` falls back to that header when the CF one is
  //    absent, which is exactly the case an attacker would engineer.
  {
    const seen = stubFunction();
    await worker.fetch(
      post({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '9.9.9.9', cookie: 'a=b' }),
      makeEnv(),
      {},
    );
    assert.equal(seen[0].headers['x-forwarded-for'], undefined,
      'a client-supplied x-forwarded-for must not reach the throttle');
    assert.equal(seen[0].headers['cookie'], undefined);
  }

  // 4. No CF header (direct hit on the workers.dev host, or a local run) sends
  //    no IP at all rather than a made-up one. The function then counts only
  //    per phone, which is the honest degradation.
  {
    const seen = stubFunction();
    await worker.fetch(post(), makeEnv(), {});
    assert.equal(seen[0].headers['cf-connecting-ip'], undefined);
  }

  // 5. A refusal is passed through with its status AND its code — the client
  //    needs the ORDER_* code to say something useful.
  {
    stubFunction({ status: 'rejected', code: 'ORDER_PAST_LAST_CALL' }, 400);
    const res = await worker.fetch(post({ 'cf-connecting-ip': '203.0.113.7' }), makeEnv(), {});
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, 'ORDER_PAST_LAST_CALL');
  }

  // 6. Rate limiting passes through as 429, unembellished.
  {
    stubFunction({ status: 'rate_limited' }, 429);
    const res = await worker.fetch(post({ 'cf-connecting-ip': '203.0.113.7' }), makeEnv(), {});
    assert.equal(res.status, 429);
  }

  // 7. GET is not a way to place an order.
  {
    stubFunction();
    const res = await worker.fetch(
      new Request('https://suis-sushi.m.dialtone.menu/api/order'),
      makeEnv(),
      {},
    );
    assert.equal(res.status, 405);
  }

  // 8. An oversized body is refused HERE rather than relayed. This endpoint is
  //    a checkout, not a general-purpose relay to our own backend.
  {
    const seen = stubFunction();
    const res = await worker.fetch(post({}, 'x'.repeat(40 * 1024)), makeEnv(), {});
    assert.equal(res.status, 413);
    assert.equal(seen.length, 0, 'an oversized body must not be forwarded');
  }

  // 9. Missing configuration is 503, matching the sibling routes.
  {
    stubFunction();
    const res = await worker.fetch(
      post({ 'cf-connecting-ip': '203.0.113.7' }),
      makeEnv({ PUBLIC_MENU_SUPABASE_ANON_KEY: '' }),
      {},
    );
    assert.equal(res.status, 503);
  }

  // 10. Upstream unreachable is a 502 — distinguishable from a refusal, so the
  //     client can say "try again" rather than "your order was rejected".
  {
    globalThis.fetch = async () => { throw new Error('network down'); };
    const res = await worker.fetch(post({ 'cf-connecting-ip': '203.0.113.7' }), makeEnv(), {});
    assert.equal(res.status, 502);
  }

  // 11. Matched ABOVE the branded-host catch-all, which would otherwise render
  //     the menu — 200 and HTML in answer to a checkout POST.
  {
    stubFunction();
    const res = await worker.fetch(post({ 'cf-connecting-ip': '203.0.113.7' }), makeEnv(), {});
    assert.doesNotMatch(res.headers.get('content-type'), /text\/html/);
  }

  console.log('order submit tests passed');
} finally {
  globalThis.fetch = originalFetch;
}
