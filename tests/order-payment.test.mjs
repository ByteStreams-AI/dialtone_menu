/**
 * The order-payment proxy (dialtone#1182 Phase 2e).
 *
 * A sibling of `/api/order`, and the interesting part is where it deliberately
 * DIFFERS from it.
 *
 * `/api/order` forwards `cf-connecting-ip` because the order-creating call is
 * throttled per IP. This one does not, because there is no budget to spend: it
 * is idempotent on the order's PaymentIntent, so a second call mints nothing.
 * Forwarding an address nobody reads would invite a later change to assume the
 * throttle is here, when the control that matters lives one call earlier.
 *
 * The other property is the same one its sibling has: the Edge Function's own
 * vocabulary reaches the client verbatim. `restaurant_not_connected` is not a
 * generic failure — it means the restaurant cannot take card payments at all,
 * and the checkout says so and points at the phone. Flattening it here would
 * turn a specific, actionable answer into "try again", which is advice that
 * cannot work.
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

const OK = {
  status: 'ok',
  client_secret: 'pi_123_secret_abc',
  stripe_account_id: 'acct_123',
  total_cents: 2497,
  tip_cents: 300,
};

function stubFunction(reply = OK, status = 200) {
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

function post(headers = {}, body = { short_code: 'AB12CD', tip_cents: 300 }) {
  return new Request('https://suis-sushi.m.dialtone.menu/api/order-payment', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

try {
  // 1. Body through unchanged, answer back verbatim, never cached. A cached
  //    client secret would be a different guest's payment.
  {
    const seen = stubFunction();
    const res = await worker.fetch(post(), makeEnv(), {});

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await res.json(), OK);

    assert.equal(seen.length, 1);
    assert.match(seen[0].url, /\/functions\/v1\/web_create_payment_intent$/);
    assert.equal(seen[0].method, 'POST');
    assert.deepEqual(JSON.parse(seen[0].body), { short_code: 'AB12CD', tip_cents: 300 });
  }

  // 2. No client IP is forwarded, and no other client header either. There is
  //    no per-IP budget on this call; the throttle is on the one that creates
  //    the order.
  {
    const seen = stubFunction();
    await worker.fetch(
      post({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '9.9.9.9', cookie: 'a=b' }),
      makeEnv(),
      {},
    );
    assert.equal(seen[0].headers['cf-connecting-ip'], undefined);
    assert.equal(seen[0].headers['x-forwarded-for'], undefined);
    assert.equal(seen[0].headers['cookie'], undefined);
  }

  // 3. A restaurant that never finished Stripe onboarding is a SPECIFIC answer
  //    and must survive the hop. The guest is told to call rather than to retry.
  {
    stubFunction({ status: 'restaurant_not_connected' }, 422);
    const res = await worker.fetch(post(), makeEnv(), {});
    assert.equal(res.status, 422);
    assert.deepEqual(await res.json(), { status: 'restaurant_not_connected' });
  }

  // 4. So does an order that can no longer be paid, and a locked tip.
  {
    stubFunction({ status: 'not_payable', order_status: 'paid' }, 409);
    const res = await worker.fetch(post(), makeEnv(), {});
    assert.equal(res.status, 409);
    assert.equal((await res.json()).status, 'not_payable');
  }

  // 5. GET is refused before the backend is touched.
  {
    const seen = stubFunction();
    const res = await worker.fetch(
      new Request('https://suis-sushi.m.dialtone.menu/api/order-payment'),
      makeEnv(),
      {},
    );
    assert.equal(res.status, 405);
    assert.equal(seen.length, 0, 'a GET must not reach the Edge Function');
  }

  // 6. An oversized body is refused here. This request is a short code and a
  //    tip; anything larger is not this request.
  {
    const seen = stubFunction();
    const res = await worker.fetch(post({}, 'x'.repeat(4096)), makeEnv(), {});
    assert.equal(res.status, 413);
    assert.equal(seen.length, 0);
  }

  // 7. Missing configuration is 503, not a 500 or an HTML page.
  {
    const res = await worker.fetch(post(), makeEnv({ PUBLIC_MENU_SUPABASE_URL: '' }), {});
    assert.equal(res.status, 503);
  }

  // 8. An unreachable backend is 502 — the client fails safe and the guest is
  //    told to try again, with no charge attempted.
  {
    globalThis.fetch = async () => {
      throw new Error('network down');
    };
    const res = await worker.fetch(post(), makeEnv(), {});
    assert.equal(res.status, 502);
  }

  // 9. Never HTML. Every unmatched path on a menu host renders the menu, so a
  //    route that failed to match would answer with a page and a 200 — which
  //    the client would try to parse as a payment session.
  {
    stubFunction();
    const res = await worker.fetch(post(), makeEnv(), {});
    assert.match(res.headers.get('content-type') ?? '', /application\/json/);
  }

  console.log('order payment tests passed');
} finally {
  globalThis.fetch = originalFetch;
}
