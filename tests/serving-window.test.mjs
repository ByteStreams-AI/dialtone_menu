import assert from 'node:assert/strict';

import {
  buildMenuCtx,
  restaurantClockNow,
  withinServingWindow
} from '../templates/shared.js';

/**
 * Time-gated categories are hidden outside their window.
 *
 * The rule is a DELIBERATE COPY of `menu_item_within_serving_window`
 * (migration 0087), which a Worker cannot call — so these assertions exist to
 * keep the copy faithful. The server still refuses an out-of-window line at
 * order creation; this only stops a guest building a cart they cannot buy.
 */

// --- the rule, branch for branch against the SQL -------------------------

assert.equal(withinServingWindow(null, null, '20:00'), true, 'no window = always serving');
assert.equal(withinServingWindow('07:00', null, '20:00'), true, 'half a window is no window');
assert.equal(withinServingWindow(null, '11:00', '20:00'), true, 'half a window is no window');

assert.equal(withinServingWindow('07:00', '11:00', '08:00'), true, 'inside a same-day window');
assert.equal(withinServingWindow('07:00', '11:00', '20:00'), false, 'outside a same-day window');
assert.equal(withinServingWindow('07:00', '11:00', '07:00'), true, 'start is INCLUSIVE');
assert.equal(withinServingWindow('07:00', '11:00', '11:00'), false, 'end is EXCLUSIVE');

assert.equal(withinServingWindow('22:00', '02:00', '23:30'), true, 'crosses midnight, before');
assert.equal(withinServingWindow('22:00', '02:00', '01:30'), true, 'crosses midnight, after');
assert.equal(withinServingWindow('22:00', '02:00', '12:00'), false, 'crosses midnight, outside');

// The one that reads backwards. "Always" is the intuitive answer and it is the
// opposite of what the database does — get this wrong and a guest can add an
// item the server then refuses, which is the failure this whole file removes.
assert.equal(withinServingWindow('11:00', '11:00', '11:00'), false, 'zero-length window is NEVER');

// Fails OPEN: hiding a restaurant's entire menu because a timezone string was
// malformed is far worse than showing an item that cannot be ordered.
assert.equal(withinServingWindow('07:00', '11:00', null), true, 'unusable clock fails open');

// --- the clock ------------------------------------------------------------

const noon = new Date('2026-08-30T17:00:00Z');
assert.equal(restaurantClockNow('America/Chicago', noon), '12:00', 'converts into the zone');
assert.equal(restaurantClockNow('', noon), '17:00', 'absent zone = UTC, matching the SQL');
assert.equal(restaurantClockNow('Not/AZone', noon), null, 'a rejected zone yields null');

// Midnight must be 00:00, never 24:00 — an `hour12: false` formatter renders
// it as 24 in some implementations, which sorts after every window and would
// close the late-night menu at exactly the hour it matters.
const midnightUtc = new Date('2026-08-30T00:00:00Z');
assert.equal(restaurantClockNow('UTC', midnightUtc), '00:00', 'midnight is 00:00');
assert.equal(withinServingWindow('22:00', '02:00', restaurantClockNow('UTC', midnightUtc)), true,
  'late-night menu is open at midnight');

// --- and it actually reaches the ctx, ONLY where orders can be taken -------

function payload(ordering) {
  return {
    restaurant: { name: 'Clock Cafe', timezone: 'America/Chicago', ordering_enabled: ordering },
    categories: [
      { name: 'Breakfast', serving_start_time: '07:00', serving_end_time: '11:00', items: [{ name: 'Eggs' }] },
      { name: 'All Day', serving_start_time: null, serving_end_time: null, items: [{ name: 'Fries' }] },
      { name: 'Late Night', serving_start_time: '22:00', serving_end_time: '02:00', items: [{ name: 'Tacos' }] }
    ]
  };
}

const names = (ctx) => ctx.categories.map((c) => c.name);
const AT_08 = new Date('2026-08-30T13:00:00Z'); // 08:00 Chicago
const AT_20 = new Date('2026-08-31T01:00:00Z'); // 20:00 Chicago
const AT_23 = new Date('2026-08-31T04:00:00Z'); // 23:00 Chicago

// A BROCHURE shows everything, whatever the hour. The "Served 7:00 AM-11:00 AM"
// label is how a customer browsing at 8pm learns to come back in the morning —
// hiding the category would leave that label visible only during the window it
// describes, which is when it is least useful.
assert.deepEqual(names(buildMenuCtx(payload(false), 'c', { now: AT_20 })),
  ['Breakfast', 'All Day', 'Late Night'], 'brochure shows a closed category');
assert.deepEqual(names(buildMenuCtx(payload(false), 'c', { now: AT_08 })),
  ['Breakfast', 'All Day', 'Late Night'], 'brochure is not time-dependent at all');

// An ORDERING menu hides what cannot be bought: everything on it invites an
// add, and the server refuses an out-of-window line at order creation.
assert.deepEqual(names(buildMenuCtx(payload(true), 'c', { now: AT_08 })),
  ['Breakfast', 'All Day'], 'morning: breakfast orderable, late night not');
assert.deepEqual(names(buildMenuCtx(payload(true), 'c', { now: AT_20 })),
  ['All Day'], 'evening: breakfast is GONE');
assert.deepEqual(names(buildMenuCtx(payload(true), 'c', { now: AT_23 })),
  ['All Day', 'Late Night'], 'late night opens');

// An environment that cannot serve the cart is a brochure however the operator
// has the switch set (dialtone#1221) — so it must not hide anything either.
assert.deepEqual(
  names(buildMenuCtx(payload(true), 'c', { now: AT_20, orderAppBound: false })),
  ['Breakfast', 'All Day', 'Late Night'],
  'unbound ORDER_APP renders as a brochure, and hides nothing'
);

// An untimed menu is never touched, on either surface.
assert.deepEqual(
  names(buildMenuCtx(
    { restaurant: { name: 'X', timezone: 'America/Chicago', ordering_enabled: true }, categories: [{ name: 'Menu', items: [{ name: 'A' }] }] },
    'x',
    { now: AT_20 }
  )),
  ['Menu'],
  'a menu with no windows is unaffected'
);

console.log('serving-window tests passed');
