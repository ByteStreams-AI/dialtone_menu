/**
 * The catering page and its submit proxy (dialtone#1553).
 *
 * Two properties that are not obvious from reading the code:
 *
 * THE PAGE MUST EXIST ONLY WHEN THE OPERATOR SWITCHED IT ON. Every UNMATCHED
 * path on `<slug>.m…` renders the menu, so a missing branch would have served
 * food at /catering, and a missing gate would advertise a service nobody can
 * honour.
 *
 * THE CLIENT IP IS THE POINT, same as `/api/order`: a sub-request carries this
 * Worker's egress IP unless the guest's is copied on deliberately, which turns
 * a per-guest limit into one global bucket. That failure is invisible in a
 * response — enquiries keep succeeding until the shared limit trips.
 */
import assert from 'node:assert/strict';

import worker, { menuCacheKeyUrl } from '../worker.js';

const originalFetch = globalThis.fetch;

function makeEnv(overrides = {}) {
  return {
    PUBLIC_MENU_SUPABASE_URL: 'https://example.supabase.co',
    PUBLIC_MENU_SUPABASE_ANON_KEY: 'anon-key',
    ASSETS: { fetch: async () => new Response('asset fallback', { status: 200 }) },
    ...overrides,
  };
}

const ENQUIRY = {
  restaurant_id: '11111111-1111-1111-1111-111111111111',
  event_type: 'wedding',
  event_name: 'Sarah & Ade',
  event_at: '2026-11-20T23:00:00.000Z',
  contact_name: 'Sarah',
  contact_phone: '+16155550123',
  extras: { dietary: 'Nut free' },
};

function stubFunction(reply = { status: 'ok', request_id: 'req-1' }, status = 201) {
  const seen = [];
  globalThis.fetch = async (url, options = {}) => {
    seen.push({ url: String(url), method: options.method, headers: options.headers ?? {}, body: options.body });
    return new Response(JSON.stringify(reply), { status, headers: { 'content-type': 'application/json' } });
  };
  return seen;
}

/** A menu payload, with catering on or off. */
function stubMenu(cateringEnabled) {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        restaurant: {
          id: '11111111-1111-1111-1111-111111111111',
          name: "Sui's Sushi",
          display_name: "Sui's Sushi",
          timezone: 'America/Chicago',
          menu_template: 'standard',
          ordering_enabled: false,
          catering_enabled: cateringEnabled,
          catering_template: 'guided',
        },
        categories: [],
        hours: [],
        contact: {},
        site: {},
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
}

function post(headers = {}, body = ENQUIRY) {
  return new Request('https://suis-sushi.m.dialtone.menu/api/catering', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const page = () => new Request('https://suis-sushi.m.dialtone.menu/catering');

try {
  // 1. The page renders when catering is on — and is NOT the menu.
  {
    stubMenu(true);
    const res = await worker.fetch(page(), makeEnv(), { waitUntil() {} });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<!-- catering -->/, 'the catering template rendered');
    assert.match(html, /What's the occasion\?/);
    // Every branch is server-rendered, so a failed script degrades to the
    // plain form rather than a blank page.
    for (const t of ['wedding', 'corporate', 'private_party', 'public_event', 'other']) {
      assert.ok(html.includes(`data-branch="${t}"`), `${t} branch is in the markup`);
    }
    // public_event redefines a CORE field, and that has to survive to the page.
    assert.match(html, /Expected attendance\?/);
  }

  // 2. FAILS CLOSED. A restaurant that has not switched catering on has no
  //    such page — answering would advertise a service nobody can honour.
  {
    stubMenu(false);
    const res = await worker.fetch(page(), makeEnv(), { waitUntil() {} });
    assert.equal(res.status, 404, 'catering off ⇒ no page');
    const html = await res.text();
    // The right noun AND the right brand. "Menu not found" on a /catering URL
    // tells the reader the wrong thing; an unbranded DialTone page puts OUR
    // chrome on a restaurant's own host in front of their customer.
    assert.match(html, /not taking catering enquiries/);
    assert.ok(!html.includes('Menu not found'), 'names catering, not the menu');
    assert.match(html, /Sui&#39;s Sushi|Sui's Sushi/, 'wears the restaurant, not DialTone');
    // Not a dead end: someone arriving from a bookmark is a customer in the
    // doorway, and the menu is one link away.
    assert.match(html, /View the menu/);
    assert.match(html, /noindex/, 'a temporary state must not rank');
    // NOT edge-cached. This refusal is a toggle the operator may have flipped
    // seconds ago; caching it for five minutes produces "I turned it on and
    // nothing happened", which reads as the feature being broken.
    assert.equal(res.headers.get('cache-control'), 'no-store');
  }

  // 2b. THE PATH FORM. The branded hosts no longer reach staging (#979), so
  //     the preview Worker's /m/<slug> form is the only place this page can be
  //     seen before production — without it, it ships unviewed.
  {
    stubMenu(true);
    const res = await worker.fetch(
      new Request('https://dialtone.menu/m/suis-sushi/catering'),
      makeEnv(),
      { waitUntil() {} },
    );
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<!-- catering -->/);
  }

  // 2c. `/m/<slug>` still means THE MENU exactly. Every QR minted so far points
  //     at it, and widening its pattern rather than adding a sibling would have
  //     changed what those codes resolve to.
  {
    stubMenu(true);
    const res = await worker.fetch(
      new Request('https://dialtone.menu/m/suis-sushi'),
      makeEnv(),
      { waitUntil() {} },
    );
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.ok(!html.includes('<!-- catering -->'), '/m/<slug> is the menu, not catering');
  }

  // 2d. THE DEMO HOST. `<slug>.demo.dialtone.menu` carries a slug in its first
  //     label like `.m.` does, so it resolves through the same branch — a
  //     prospect sees catering on their own branded demo URL, against staging
  //     data and test keys.
  {
    stubMenu(true);
    const res = await worker.fetch(
      new Request('https://suis-sushi.demo.dialtone.menu/catering'),
      makeEnv(),
      { waitUntil() {} },
    );
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<!-- catering -->/);
  }

  // 2e. A THIRD SURFACE NEEDS A THIRD CACHE KEY.
  //
  //     This is the one no worker.fetch() test can see: there is no edge cache
  //     in front of it, so the collision exists only in production. `/catering`
  //     fell into the same `else` as `auto` and shared the ROOT's entry, so a
  //     branded host served its cached HOME page at /catering — and on the
  //     other ordering would have served catering at the root.
  {
    const u = new URL('https://suis-sushi.m.dialtone.menu/catering');
    const keys = ['menu', 'auto', 'catering'].map((hint) => menuCacheKeyUrl(u, 'suis-sushi', hint));
    assert.equal(new Set(keys).size, 3, 'menu, root and catering need distinct cache entries');
    assert.match(keys[2], /__catering$/);
  }

  // 2f. THE EMITTED SCRIPT, EVALUATED — not the source that produced it.
  //
  //     The flow's script is built inside a TEMPLATE LITERAL, where a single
  //     backslash before `d` is an unrecognised escape that collapses to a bare
  //     `d`. The date regex shipped as /^(d{4})-(d{2}).../, matched nothing,
  //     and the summary showed a raw "2027-03-13T11:00" to the person deciding
  //     whether to send. Reading templates/catering.js shows a correct regex;
  //     only the OUTPUT is wrong, so only the output can be asserted.
  {
    stubMenu(true);
    const res = await worker.fetch(page(), makeEnv(), { waitUntil() {} });
    const html = await res.text();

    const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    // Parses at all: a bad escape can be a syntax error, which kills the whole
    // flow and degrades to the plain form — working, but silently not this.
    assert.doesNotThrow(() => new Function(script), 'the emitted script parses');

    const from = script.indexOf('function prettyWhen');
    assert.ok(from > -1, 'the date formatter is in the page');
    const body = script.slice(from, script.indexOf('\n  }', from) + 4);
    const prettyWhen = new Function('return (' + body.replace('function prettyWhen', 'function') + ')')();

    assert.match(prettyWhen('2027-03-13T11:00'), /March 13, 2027 at 11:00am/);
    assert.match(prettyWhen('2027-03-13T00:30'), /12:30am/, 'midnight is 12, not 0');
    assert.match(prettyWhen('2027-03-13T12:05'), /12:05pm/, 'noon is 12pm, not 0pm');
    // Formatted from the PARTS: the value is a wall time at the restaurant, and
    // Date-parsing it would show the visitor a different hour than they typed.
    assert.equal(prettyWhen('nonsense'), 'nonsense');
  }

  // 2g. ONE FIELD PER THING BEING ASKED FOR.
  //
  //     "What's the event?" carried the helper "Name, and a website if it has
  //     one" over a single text box — so the visitor had to invent a format,
  //     and a browser autofilled `http://` into it, which read as the field
  //     being for the URL. Two labelled inputs, and the website is optional.
  {
    stubMenu(true);
    const res = await worker.fetch(page(), makeEnv(), { waitUntil() {} });
    const html = await res.text();
    const branch = html.slice(html.indexOf('data-branch="public_event"'));
    const screen = branch.slice(0, branch.indexOf('</fieldset>'));

    assert.ok(!screen.includes('a website if it has one'), 'no two-in-one helper');
    assert.match(screen, /name="event_name"[^>]*required/, 'the name is still required');
    assert.match(screen, /name="extras\.website"/, 'the website is its own field');
    assert.ok(!/name="extras\.website"[^>]*required/.test(screen), 'and it is optional');
    // Labels appear only on multi-field screens, so their presence is also the
    // check that this became one.
    assert.match(screen, /Event name/);
    assert.match(screen, /Website \(optional\)/);
  }

  // 3. The enquiry reaches the Edge Function unchanged, and the answer comes
  //    back verbatim — the refusal wording lives in one place.
  {
    const seen = stubFunction();
    const res = await worker.fetch(post({ 'cf-connecting-ip': '203.0.113.9' }), makeEnv(), {});
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await res.json(), { status: 'ok', request_id: 'req-1' });
    assert.equal(seen.length, 1);
    assert.match(seen[0].url, /\/functions\/v1\/web_create_catering_request$/);
    assert.deepEqual(JSON.parse(seen[0].body), ENQUIRY);
  }

  // 4. THE GUEST'S IP IS PASSED ON. Without it every enquiry shares one bucket.
  {
    const seen = stubFunction();
    await worker.fetch(post({ 'cf-connecting-ip': '203.0.113.9' }), makeEnv(), {});
    assert.equal(seen[0].headers['cf-connecting-ip'], '203.0.113.9');
  }

  // 5. A CLIENT-SUPPLIED IP IS NOT. Forwarding it would let a caller pick its
  //    own rate-limit bucket, which is the same as having no limit.
  {
    const seen = stubFunction();
    await worker.fetch(post({ 'x-forwarded-for': '198.51.100.4' }), makeEnv(), {});
    assert.equal(seen[0].headers['cf-connecting-ip'], undefined);
    assert.equal(seen[0].headers['x-forwarded-for'], undefined);
  }

  // 6. A refusal is relayed with its status AND its vocabulary intact — the
  //    page keys its wording off `status`.
  {
    stubFunction({ status: 'rate_limited' }, 429);
    const res = await worker.fetch(post({ 'cf-connecting-ip': '203.0.113.9' }), makeEnv(), {});
    assert.equal(res.status, 429);
    assert.deepEqual(await res.json(), { status: 'rate_limited' });
  }

  // 7. Not a relay: an oversized body is refused before any sub-request.
  {
    const seen = stubFunction();
    const res = await worker.fetch(post({}, 'x'.repeat(17 * 1024)), makeEnv(), {});
    assert.equal(res.status, 413);
    assert.equal(seen.length, 0, 'nothing was forwarded');
  }

  // 8. GET is not a submission.
  {
    const res = await worker.fetch(
      new Request('https://suis-sushi.m.dialtone.menu/api/catering'),
      makeEnv(),
      {},
    );
    assert.equal(res.status, 405);
  }

  console.log('catering.test.mjs — 13 checks passed');
} finally {
  globalThis.fetch = originalFetch;
}
