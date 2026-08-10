/**
 * Ordering hooks across every template (dialtone#1182 Phase 2c).
 *
 * Ordering is ORTHOGONAL to the template: an operator picks a look and,
 * separately, whether the menu takes orders. So the interesting property is not
 * "the standard template has a button" — it is that **all three behave
 * identically**, because the affordance is one implementation in `shared.js`
 * and each template only decides where it sits.
 *
 * Every assertion below therefore runs over the whole registry. A fourth
 * template added without wiring the hooks fails here rather than shipping a
 * menu that silently cannot be ordered from.
 */
import assert from 'node:assert/strict';

import { buildMenuCtx } from '../templates/shared.js';
import { standard } from '../templates/standard.js';
import { cards } from '../templates/cards.js';
import { lacquer } from '../templates/lacquer.js';

const TEMPLATES = [
  ['standard', standard],
  ['cards', cards],
  ['lacquer', lacquer],
];

function payload(orderingEnabled) {
  return {
    restaurant: {
      id: '11111111-1111-1111-1111-111111111111',
      name: "Sui's Sushi",
      timezone: 'America/Chicago',
      menu_template: 'standard',
      ordering_enabled: orderingEnabled,
    },
    categories: [
      {
        name: 'Rolls',
        items: [
          {
            id: 'item-roll',
            name: 'California Roll',
            base_price_cents: 999,
            is_alcohol: false,
            modifier_groups: [
              {
                id: 'grp-rice',
                name: 'Rice',
                is_required: true,
                min_selections: 1,
                max_selections: 1,
                options: [{ id: 'opt-white', name: 'White rice', price_delta_cents: 0 }],
              },
            ],
          },
          {
            id: 'item-sake',
            name: 'Sake',
            base_price_cents: 1200,
            is_alcohol: true,
            modifier_groups: [],
          },
        ],
      },
    ],
  };
}

const render = (tpl, on, opts = {}) => {
  const data = payload(on);
  // A database that predates 0189 returns a restaurant object with no `id`.
  if (opts.omitRestaurantId) delete data.restaurant.id;
  return tpl.render(
    buildMenuCtx(data, 'suis-sushi', {
      stripePublishableKey: opts.omitStripeKey ? '' : 'pk_test_island',
    }),
  );
};

for (const [name, tpl] of TEMPLATES) {
  // 1. Ordering OFF leaves the brochure exactly as it was. This is the promise
  //    that lets ordering be an orthogonal toggle rather than a kind of menu:
  //    a tenant without it must not pay a byte for it.
  const off = render(tpl, false);
  // `_order` catches the bundle's script tag too — an earlier version of this
  // matched only `dt-order` and let an unconditional <script src="/_order/…">
  // through, which a mutation found rather than review. The point of this
  // assertion is that NOTHING ordering-related ships, so it has to be spelled
  // broadly enough to mean that.
  assert.ok(!/dt-order|dt-menu-data|data-dt-item|_order\//.test(off),
    `${name}: ordering markup leaked into a non-ordering menu`);

  const on = render(tpl, true);

  // 2. Every item carries a hook, so a click anywhere in the row resolves to an
  //    item without the cart holding its own copy of the menu structure.
  assert.equal((on.match(/data-dt-item=/g) || []).length, 2,
    `${name}: expected a hook on every item`);

  // 3. ALCOHOL IS SHOWN BUT NOT ORDERABLE. 0162 puts alcohol on the public menu
  //    in every state; _price_order_items refuses it on web (#881/0141) since
  //    this channel cannot verify age. So exactly ONE of the two items is
  //    addable, and the other explains itself. Hiding it, or letting a guest
  //    reach the server refusal, both reproduce #1158 on a customer surface.
  assert.equal((on.match(/data-dt-add=/g) || []).length, 1,
    `${name}: exactly one non-alcoholic item should be addable`);
  assert.ok(!/data-dt-add="item-sake"/.test(on), `${name}: alcohol must not be addable`);
  assert.ok(/Order in person/.test(on), `${name}: alcohol needs a stated reason, not silence`);

  // 4. The data island carries what a cart needs to build a valid line —
  //    including modifier ids, without which a required-modifier item cannot be
  //    ordered at all.
  assert.ok(/id="dt-menu-data"/.test(on), `${name}: missing the menu data island`);

  // 4b. The bundle that reads the island must actually be loaded. The filename
  //     is stable BY CONSTRUCTION (the app builds its entry to /_order/cart.js)
  //     because this Worker cannot know a content hash — so a change to that
  //     build setting silently breaks ordering, and this is what notices.
  assert.ok(/src="\/_order\/cart\.js"/.test(on), `${name}: cart bundle is never loaded`);
  assert.ok(/<script[^>]+src="\/_order\/cart\.js"[^>]*\bdefer\b/.test(on),
    `${name}: cart script must be deferred — the menu is what the guest came for`);
  assert.ok(/"opt-white"/.test(on), `${name}: island must carry modifier option ids`);

  // 4c. The restaurant's timezone (dialtone#1173). Last call is stated as a
  //     clock time, and it must be the RESTAURANT's clock — a guest ordering
  //     from another zone would otherwise be told the wrong deadline, and the
  //     failure looks like a working page.
  assert.ok(/"timezone":"America\/Chicago"/.test(on),
    `${name}: island must carry the restaurant timezone for last-call formatting`);

  // 4d. The tenant the checkout submits against (dialtone#1182 2d). Omitted
  //     rather than blank when the database predates 0189, so the checkout can
  //     say "not configured" instead of posting an empty tenant and reading
  //     back a generic rejection.
  assert.ok(/"restaurant_id":"11111111-1111-1111-1111-111111111111"/.test(on),
    `${name}: island must carry the restaurant id for checkout`);
  const noId = render(tpl, true, { omitRestaurantId: true });
  assert.ok(!/"restaurant_id"/.test(noId),
    `${name}: island must OMIT restaurant_id rather than send an empty one`);

  // 4e. Stripe's publishable key (dialtone#1182 2e), on the same omit-when-absent
  //     rule. With no key the checkout says online payment is not set up and
  //     points the guest at the phone — an honest, actionable answer — whereas a
  //     blank one mounts an Element that fails at confirm time, long after the
  //     guest has typed a card number.
  assert.ok(/"stripe_publishable_key":"pk_test_island"/.test(on),
    `${name}: island must carry the Stripe publishable key for inline payment`);
  const noKey = render(tpl, true, { omitStripeKey: true });
  assert.ok(!/"stripe_publishable_key"/.test(noKey),
    `${name}: island must OMIT the Stripe key rather than send an empty one`);

  // 5. The island must not be able to close its own script tag. Same escaping
  //    as the JSON-LD block; a literal </script> in item text would otherwise
  //    inject the remainder as markup.
  const island = on.slice(on.indexOf('id="dt-menu-data"'));
  assert.ok(!island.slice(0, island.indexOf('</script>')).includes('</'),
    `${name}: island content is not escaped against a script breakout`);
}

// 6. The affordance is ONE implementation. If a template ever grows its own,
//    this is what notices: the rendered button markup must be identical across
//    all of them.
const buttons = TEMPLATES.map(([, tpl]) => {
  const html = render(tpl, true);
  const m = html.match(/<button[^>]*data-dt-add="item-roll"[^>]*>[^<]*<\/button>/);
  return m ? m[0] : null;
});
assert.ok(buttons.every(Boolean), 'every template must render the add button');
assert.equal(new Set(buttons).size, 1,
  'templates have drifted apart on the add affordance — it is meant to be shared');

// 7. The ordering controls are the TENANT'S colour (dialtone#1211).
//
//    `--brand` and `--brand-ink` are read by ORDER_STYLES and by the cart
//    bundle, and were defined by no template for the whole of Phase 2 — so the
//    `#111` fallback was the colour every tenant got, on every template, and
//    nothing failed. A fallback that is never exercised looks exactly like one
//    that is, which is why this asserts the DEFINITION rather than the usage.
for (const [name, tpl] of TEMPLATES) {
  const on = render(tpl, true);
  assert.ok(/--brand:\s*#[0-9A-Fa-f]{6}/.test(on),
    `${name}: no --brand in :root, so the ordering controls fall back to #111`);
  assert.ok(/--brand-ink:\s*(#fff|#111)\b/.test(on),
    `${name}: no --brand-ink, so a pale brand gets white text on it`);
}

// The ink has to FOLLOW the brand, not merely exist. A fixed value would pass
// the check above while reintroducing the unreadable pairing it exists to stop.
{
  const ink = (primary) =>
    lacquer
      .render(buildMenuCtx({ ...payload(true), restaurant: { ...payload(true).restaurant, primary_color: primary } }, 'suis-sushi', {}))
      .match(/--brand-ink:\s*(#[0-9a-f]{3,6})/)[1];
  assert.equal(ink('#111827'), '#fff', 'a dark brand takes white ink');
  assert.equal(ink('#FDE047'), '#111', 'a pale brand takes dark ink');
}

console.log('order hooks tests passed');
