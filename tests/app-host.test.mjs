/**
 * The app entry host — `app.dialtone.menu` (dialtone_app#57).
 *
 * This host exists so a guest never has to TYPE a restaurant slug. A QR carries
 * `/r/<slug>`; the OS opens the app when it is installed, and this page is only
 * ever seen by guests who do not have it.
 *
 * The properties worth pinning are the ones that fail SILENTLY in production:
 *
 * - the association files must 404 while unconfigured rather than serve a
 *   placeholder. A file with a wrong team id or fingerprint verifies against
 *   nothing, and links then open the browser instead of the app — with no
 *   error anywhere on the device, and nothing in a log to notice;
 * - the host must be matched ABOVE the branded-host branch, which renders menu
 *   HTML for every unmatched path. Without that, a request for the association
 *   file would be answered with a web page and a 200, which is exactly the
 *   shape that passes a status-code check and fails verification;
 * - the landing page must still render when branding is unavailable, because
 *   the store buttons are the entire point and the guest is standing in the
 *   restaurant.
 *
 * Same known limit as the other worker tests: these call `worker.fetch()`
 * directly, below `not_found_handling`.
 */
import assert from 'node:assert/strict';

import worker from '../worker.js';

const originalFetch = globalThis.fetch;

const TEAM_ID = 'L33JGV8X8L';
const SHA256 = Array(32).fill('AB').join(':');
const BUNDLE = 'com.bytestreams.dialtoneapp';

function makeEnv(overrides = {}) {
  return {
    PUBLIC_MENU_SUPABASE_URL: 'https://example.supabase.co',
    PUBLIC_MENU_SUPABASE_ANON_KEY: 'anon-key',
    ASSETS: { fetch: async () => new Response('asset fallback', { status: 200 }) },
    ...overrides,
  };
}

const BRANDING = {
  restaurant_id: '8221b632-6f69-443d-b972-57a7a9f551d1',
  name: "Shorty's",
  display_name: "Shorty's",
  tagline: 'Memphis Morning to Midnight',
  logo_url: 'https://example.supabase.co/storage/v1/object/public/branding/s.svg',
  hero_image_url: null,
  primary_color: '#53A45C',
  secondary_color: '#363636',
  font: null,
  timezone: 'America/Chicago',
};

function stubBranding(rows) {
  globalThis.fetch = async () => new Response(JSON.stringify(rows), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function req(path, init) {
  return new Request(`https://app.dialtone.menu${path}`, init);
}

async function run() {
  // ── association files: unconfigured must 404, not serve a placeholder ─────
  {
    const res = await worker.fetch(req('/.well-known/apple-app-site-association'), makeEnv(), {});
    assert.equal(res.status, 404, 'AASA must 404 while APPLE_TEAM_ID is unset');
  }
  {
    const res = await worker.fetch(req('/.well-known/assetlinks.json'), makeEnv(), {});
    assert.equal(res.status, 404, 'assetlinks must 404 while the fingerprint is unset');
  }

  // A malformed value is as dangerous as none — it verifies against nothing.
  {
    const env = makeEnv({ APPLE_TEAM_ID: 'TOO-SHORT', ANDROID_CERT_SHA256: 'not-a-fingerprint' });
    assert.equal((await worker.fetch(req('/.well-known/apple-app-site-association'), env, {})).status, 404);
    assert.equal((await worker.fetch(req('/.well-known/assetlinks.json'), env, {})).status, 404);
  }

  // ── association files: configured ─────────────────────────────────────────
  {
    const env = makeEnv({ APPLE_TEAM_ID: TEAM_ID });
    const res = await worker.fetch(req('/.well-known/apple-app-site-association'), env, {});
    assert.equal(res.status, 200);
    // Apple requires JSON content-type and NO .json extension on the path.
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json();
    assert.equal(body.applinks.details[0].appID, `${TEAM_ID}.${BUNDLE}`);
    assert.deepEqual(body.applinks.details[0].paths, ['/r/*']);
  }
  {
    const env = makeEnv({ ANDROID_CERT_SHA256: SHA256 });
    const res = await worker.fetch(req('/.well-known/assetlinks.json'), env, {});
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body[0].target.package_name, BUNDLE);
    assert.deepEqual(body[0].target.sha256_cert_fingerprints, [SHA256]);
    assert.deepEqual(body[0].relation, ['delegate_permission/common.handle_all_urls']);
  }

  // ── landing page ──────────────────────────────────────────────────────────
  {
    stubBranding([BRANDING]);
    const env = makeEnv({
      APP_STORE_URL: 'https://apps.apple.com/app/id123',
      PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=' + BUNDLE,
    });
    const res = await worker.fetch(req('/r/shortys'), env, {});
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Shorty&#39;s|Shorty's/, 'renders the restaurant name');
    assert.match(html, /#53A45C/, 'applies the brand colour');
    assert.match(html, /apps\.apple\.com/, 'offers the App Store');
    assert.match(html, /play\.google\.com/, 'offers Play');
    // The escape hatch for guests who do not want an app at all.
    assert.match(html, /shortys\.m\.dialtone\.menu\/menu/, 'links through to the menu');
  }

  // A store with no listing yet is OMITTED, never dead-linked.
  {
    stubBranding([BRANDING]);
    const res = await worker.fetch(req('/r/shortys'), makeEnv(), {});
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.doesNotMatch(html, /apps\.apple\.com|play\.google\.com/, 'no dead store buttons');
    assert.match(html, /Just view the menu/, 'menu link still offered');
  }

  // Branding unavailable must NOT strand the guest — the buttons are the point.
  {
    globalThis.fetch = async () => new Response('boom', { status: 500 });
    const env = makeEnv({ APP_STORE_URL: 'https://apps.apple.com/app/id123' });
    const res = await worker.fetch(req('/r/shortys'), env, {});
    assert.equal(res.status, 200, 'renders despite a branding failure');
    assert.match(await res.text(), /apps\.apple\.com/);
  }

  // A slug that does not exist is a real 404, not a branded page for nobody.
  {
    stubBranding([]);
    const res = await worker.fetch(req('/r/no-such-place'), makeEnv(), {});
    assert.equal(res.status, 404);
  }

  // ── routing hygiene ───────────────────────────────────────────────────────
  {
    stubBranding([BRANDING]);
    // Malformed slugs never reach Supabase.
    for (const p of ['/r/', '/r/Not_Valid', '/r/-leading', '/r/a/b']) {
      assert.equal((await worker.fetch(req(p), makeEnv(), {})).status, 404, `${p} must 404`);
    }
    // The app host owns its namespace — it is not the menu and not marketing.
    assert.equal((await worker.fetch(req('/'), makeEnv(), {})).status, 404);
    assert.equal((await worker.fetch(req('/menu'), makeEnv(), {})).status, 404);
    // Writes are refused.
    const res = await worker.fetch(req('/r/shortys', { method: 'POST' }), makeEnv(), {});
    assert.equal(res.status, 405);
  }

  globalThis.fetch = originalFetch;
  console.log('app-host.test.mjs: all assertions passed');
}

await run();
