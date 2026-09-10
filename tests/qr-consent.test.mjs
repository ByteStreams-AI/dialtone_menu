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
  assert.match(html, /Rewards includes SMS from Shorty&#39;s|Rewards includes SMS from Shorty's/,
    `${template} names the restaurant`);
  assert.ok(!html.includes('from shortys.'), `${template} does not print the slug`);
  assert.match(html, /\.app-qr-consent/, `${template} carries the shared styles`);

  // 2. THE FULL OPT-IN TEXT MUST NOT BE HERE.
  //
  //    It opens "By providing your name and phone number and clicking
  //    'Submit,'" — and beside a QR there is no form and no Submit. Printing
  //    it would describe an action the customer is not taking, which is
  //    inaccurate rather than merely redundant. The full disclosure belongs at
  //    the point consent is actually given.
  assert.ok(!html.includes("clicking 'Submit'"), `${template} claims no Submit`);

  // 3. And no opt-out instruction: nobody here has opted IN to anything, so
  //    "Reply STOP" implies an enrolment that has not happened.
  assert.ok(!html.includes('Reply STOP'), `${template} does not imply enrolment`);

  // 4. The clauses that ARE true of a program someone is deciding whether to
  //    join.
  for (const clause of [
    'Message frequency may vary',
    'message and data rates may apply',
    'Consent is not a condition of purchase',
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
  assert.match(html, /Rewards includes SMS from/, 'still names a sender');
}

console.log('qr-consent.test.mjs — 5 checks passed');
