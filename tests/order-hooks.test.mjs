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

const render = (tpl, on) => tpl.render(buildMenuCtx(payload(on), 'suis-sushi'));

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

console.log('order hooks tests passed');
