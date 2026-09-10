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
  assert.match(html, /SMS loyalty from Shorty&#39;s|SMS loyalty from Shorty's/,
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
  assert.ok(html.includes("clicking &#39;Submit,&#39;") || html.includes("clicking 'Submit,'"),
    `${template} carries the registered opening`);
  assert.ok(html.includes('Reply STOP to opt out'), `${template} carries STOP`);
  assert.ok(html.includes('Reply HELP for help'), `${template} carries HELP`);

  // 3. The version marker is the DRIFT TRIPWIRE. This text is duplicated from
  //    packages/shared in the dialtone repo — a cross-repo package cannot be
  //    imported — so the marker is how a divergence becomes visible.
  //    dialtone#1583 moves the text into the menu payload so there is one
  //    source instead of two.
  assert.match(html, /data-consent-version="2026-09-10\.v1"/,
    `${template} stamps the version it rendered`);

  // 3b. COLLAPSIBLE, and the full text is IN THE SOURCE either way.
  //
  //     `<details>` rather than a link to a popup: a carrier or crawler
  //     reviewing the CTA finds the registered wording whether or not anyone
  //     opened it, and it needs no JavaScript. A popup would move the
  //     disclosure off the page, which is the version closest to hiding it.
  assert.match(html, /<details class="app-qr-consent"/, `${template} is collapsible`);
  assert.match(html, /<summary>Rewards SMS terms/, `${template} summarises rather than labels`);

  //     The summary is not a bare label — the two clauses checked first stay
  //     visible without a tap.
  const summary = html.slice(html.indexOf('<summary>'), html.indexOf('</summary>'));
  assert.ok(summary.includes('rates may apply'), `${template} shows rates unopened`);
  assert.ok(summary.includes('Reply STOP'), `${template} shows STOP unopened`);

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
  assert.ok(!html.includes('SMS loyalty from .'), 'never an empty sender');
  assert.match(html, /SMS loyalty from \S+/, 'always names a sender');
}

console.log('qr-consent.test.mjs — 5 checks passed');
