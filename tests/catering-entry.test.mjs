/**
 * How a visitor REACHES the catering page (dialtone#1553).
 *
 * The page shipped with no entry point: the URL existed and nothing linked to
 * it. Two placements, chosen for opposite reasons.
 *
 * BETWEEN STOPS is the moment the page admits it cannot sell food, and a truck
 * is between stops most of the time. Today that ends the visit.
 *
 * THE HOME HEADER serves broad intent. The MENU header deliberately does not —
 * its job is selling lunch to someone hungry, and a header link there competes
 * with ordering.
 */
import assert from 'node:assert/strict';

import { renderHome } from '../templates/index.js';
import { buildMenuCtx, renderCateringLink, renderStopBanner } from '../templates/shared.js';

const ctxFor = (template, over = {}) =>
  buildMenuCtx(
    {
      restaurant: {
        name: 'Diner On The Go',
        display_name: 'Diner On The Go',
        timezone: 'America/New_York',
        menu_template: template,
        site_mode: 'home_and_menu',
        catering_enabled: true,
        ...over,
      },
      categories: [],
      hours: [],
      contact: {},
      site: {},
    },
    'dineronthego',
    {},
  );

// 1. Every home template offers it — and none does when catering is off.
for (const template of ['standard', 'cards', 'lacquer']) {
  const ctx = { ...ctxFor(template), menuUrl: '/menu' };
  const on = renderHome(ctx);
  assert.match(on, /href="\/catering"/, `${template} home links to catering`);
  assert.match(on, /\.hero-pill/, `${template} carries the shared pill styles`);

  const off = renderHome({ ...ctx, cateringEnabled: false });
  assert.ok(!off.includes('href="/catering"'), `${template} hides it when off`);
}

// 2. It is a LINK, not a second button. Two equal-weight calls to action make a
//    person choose before they have read anything, and the menu is what most
//    visitors came for.
{
  const html = renderHome({ ...ctxFor('standard'), menuUrl: '/menu' });
  const header = html.slice(html.indexOf('header-actions'), html.indexOf('</div>', html.indexOf('header-actions')));
  // A PILL BUTTON the same size as View Menu now (operator, follow-up 2),
  // not a secondary link.
  assert.match(header, /class="hero-pill hero-pill--ghost"/);
  assert.match(header, /Catering &amp; Events/);
  assert.ok(!/class="menu-cta"[^>]*href="\/catering"/.test(header), 'catering is not styled as the primary CTA');
}

// 3. The stop banner offers it ONLY when catering is on…
{
  const on = renderStopBanner({ usesStops: true, slug: 's', timezone: 'UTC', cateringEnabled: true });
  const off = renderStopBanner({ usesStops: true, slug: 's', timezone: 'UTC', cateringEnabled: false });
  assert.match(on, /data-dt-catering="1"/);
  assert.ok(!off.includes('data-dt-catering'), 'no attribute, so the script cannot offer it');
}

// 4. …and only in the NO-STOP branch. Over a live stop the page has food to
//    sell, and this would compete with it.
{
  const html = renderStopBanner({ usesStops: true, slug: 's', timezone: 'UTC', cateringEnabled: true });
  const script = html.slice(html.indexOf('<script>'));
  const putFn = script.slice(script.indexOf('function put('), script.indexOf('function note('));
  const noteFn = script.slice(script.indexOf('function note('));
  assert.ok(!putFn.includes('dtCatering'), 'a live stop does not offer catering');
  assert.match(noteFn, /dtCatering/, 'the absence does');
}

// 5. The flag is an ATTRIBUTE, never interpolated into script source — the same
//    rule the slug and timezone follow, because a database value that reached
//    JS source could end a string literal.
{
  const html = renderStopBanner({ usesStops: true, slug: 's', timezone: 'UTC', cateringEnabled: true });
  assert.match(html, /data-dt-catering="1"[^>]*>/);
  assert.match(html, /el\.dataset\.dtCatering/);
}

// 6. The helper itself, so a template that adopts it later cannot get it wrong.
{
  assert.equal(renderCateringLink({ cateringEnabled: false }), '');
  assert.equal(renderCateringLink(null), '');
  assert.match(renderCateringLink({ cateringEnabled: true }), /href="\/catering"/);
}

console.log('catering-entry.test.mjs — 6 checks passed');
