/**
 * The 10DLC notice beside the app QR (dialtone#1581).
 *
 * The QR pitches "Earn points! Download the app" — a loyalty solicitation with
 * no disclosure beside it. This adds one, and the interesting assertion is
 * what it must NOT say.
 */
import assert from 'node:assert/strict';

import { renderMenu } from '../templates/index.js';
import { buildMenuCtx } from '../templates/shared.js';

const ctxFor = (template) =>
  buildMenuCtx(
    {
      restaurant: {
        name: 'Shortys LLC',
        display_name: "Shorty's",
        timezone: 'America/Chicago',
        menu_template: template,
        ordering_enabled: true,
      },
      categories: [],
      hours: [],
      contact: {},
      site: {},
    },
    'shortys',
    { orderAppBound: true },
  );

for (const template of ['standard', 'cards', 'lacquer']) {
  const html = renderMenu({ ...ctxFor(template), menuUrl: '/menu' });

  // 1. Present on every template, naming the restaurant rather than the slug.
  assert.match(html, /SMS loyalty messages from Shorty&#39;s|SMS loyalty messages from Shorty's/,
    `${template} names the restaurant`);
  assert.ok(!html.includes('from shortys.'), `${template} does not print the slug`);
  assert.match(html, /\.app-qr-consent/, `${template} carries the shared styles`);

  // 2. THE REGISTERED TEXT, VERBATIM (operator, 2026-09-10).
  //
  //    This is the wording filed with Telnyx, so it is the authority: a live
  //    CTA that differs from the registered one is a misdeclared campaign,
  //    which is a worse finding than any wording question.
  //
  //    A shortened, medium-adapted version was proposed and rejected. Matching
  //    the declaration is what carriers check.
  // v2 opening (operator, 2026-09-10): the QR → install → provide-details
  // flow, replacing "clicking 'Submit'".
  assert.ok(html.includes('By clicking the QR Code, installing the app'),
    `${template} carries the registered opening`);
  assert.ok(html.includes('Reply STOP to opt out'), `${template} carries STOP`);
  assert.ok(html.includes('Reply HELP for help'), `${template} carries HELP`);

  // 3. The version marker is the DRIFT TRIPWIRE. This text is duplicated from
  //    packages/shared in the dialtone repo — a cross-repo package cannot be
  //    imported — so the marker is how a divergence becomes visible.
  //    dialtone#1583 moves the text into the menu payload so there is one
  //    source instead of two.
  // This worker renders the APP opt-in channel only — the QR is the opt-in on
  // both the home page and the menu footer — so it carries that entry's text.
  assert.ok(html.includes('By clicking the QR Code, installing the app'),
    `${template} carries the APP channel's registered opening`);
  assert.match(html, /data-consent-version="2026-09-10\.v4"/,
    `${template} stamps the version it rendered`);

  // 3b. ONE collapsible, and the full text is IN THE SOURCE either way.
  //
  //     The disclosure now lives inside the "Order via App" panel, SHOWN
  //     plainly rather than behind a second `<details>` (operator, follow-up
  //     2). Two taps to reach a consent notice is the version closest to
  //     hiding it.
  //
  //     `<details>` for the panel rather than a popup, for the original
  //     reason: a carrier or crawler reviewing the CTA finds the registered
  //     wording whether or not anyone opened it, and it needs no JavaScript.
  assert.match(html, /<details class="app-qr-panel/, `${template} panel is collapsible`);
  assert.match(html, /<summary>Order via App<\/summary>/, `${template} labels the panel`);

  //     The disclosure must sit INSIDE that panel, below the QR — not
  //     somewhere else on the page, and not behind another tap.
  {
    const panel = html.slice(html.indexOf('<details class="app-qr-panel'));
    const body = panel.slice(0, panel.indexOf('</details>') + 10);
    assert.ok(body.includes('Standard Message and Data Rates'),
      `${template} keeps the Disclosure Statement inside the app panel`);
    // Named, not an unlabelled block of small legal text a guest scrolls past.
    assert.ok(body.includes('Disclosure Statement'),
      `${template} labels the Disclosure Statement`);
    assert.ok(!/<details/.test(body.slice(body.indexOf('app-qr-consent'))),
      `${template} does not bury the disclosure behind a second collapsible`);
    assert.ok(body.indexOf('<svg') < body.indexOf('Standard Message and'),
      `${template} shows the QR above the disclosure`);
  }

  //     And it is NOT called "Privacy policy": that is a different document,
  //     already linked inside, and a tap that promises one and delivers the
  //     other is worse than no label at all.
  assert.ok(!/<summary>[^<]*[Pp]rivacy policy/.test(html), `${template} does not mislabel`);

  // 4. The clauses that ARE true of a program someone is deciding whether to
  //    join.
  for (const clause of [
    'Message frequency may vary',
    'Standard Message and Data Rates may apply',
    'Consent is not a condition of purchase',
    'will not be sold or shared with third parties',
    'dialtone.menu/privacy',
  ]) {
    assert.ok(html.includes(clause), `${template} carries "${clause}"`);
  }
}

// 5. A tenant with no display name still identifies a sender.
{
  const ctx = buildMenuCtx(
    { restaurant: { name: '', timezone: 'UTC', menu_template: 'standard', ordering_enabled: true },
      categories: [], hours: [], contact: {}, site: {} },
    'x',
    { orderAppBound: true },
  );
  const html = renderMenu({ ...ctx, menuUrl: '/menu' });
  // Never an empty sender. buildMenuCtx's wordmark fallback supplies whatever
  // the rest of the page is calling this restaurant, so the disclosure agrees
  // with the heading above it rather than inventing a second name.
  assert.ok(!html.includes('SMS loyalty messages from .'), 'never an empty sender');
  assert.match(html, /SMS loyalty messages from \S+/, 'always names a sender');
}

console.log('qr-consent.test.mjs — 5 checks passed');
