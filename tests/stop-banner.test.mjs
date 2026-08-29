/**
 * The service-stop banner's CLIENT logic (dialtone#1320 P4b, restructured #1427).
 *
 * This had no test at all, which is how it shipped with an empty state that
 * could never render: `renderStopBanner` returns a STRING containing an IIFE,
 * so nothing in the module graph ever executes it and a green suite said
 * nothing about what a customer sees.
 *
 * So this evaluates the emitted script against a minimal fake DOM. That is
 * worth the harness because the branch structure is the feature: the operator
 * asked for the absence to be STATED and the next stop to appear BELOW it,
 * where before they were mutually exclusive.
 */
import assert from 'node:assert/strict';

import { renderStopBanner } from '../templates/shared.js';

/** Enough DOM for the banner: it only ever creates <p> and <a> and appends. */
function fakeDom(windowPayload) {
  const el = {
    dataset: { dtSlug: 'dineronthego', dtTz: 'America/Chicago' },
    hidden: true,
    children: [],
    classes: new Set(),
    set textContent(v) { if (v === '') this.children.length = 0; },
    get textContent() { return ''; },
    classList: { add: (c) => el.classes.add(c), remove: (c) => el.classes.delete(c) },
    appendChild: (c) => el.children.push(c),
  };
  const make = () => ({ className: '', textContent: '', href: '', target: '', rel: '' });
  const sandbox = {
    document: { getElementById: () => el, createElement: make },
    window: { fetch: true },
    fetch: async () => ({ ok: true, json: async () => windowPayload }),
    Intl,
    Date,
    isNaN,
    encodeURIComponent,
  };
  return { el, sandbox };
}

async function run(windowPayload) {
  const emitted = renderStopBanner({ usesStops: true, slug: 'dineronthego', timezone: 'America/Chicago' });
  const body = emitted.slice(emitted.indexOf('<script>') + 8, emitted.lastIndexOf('</script>'));
  const { el, sandbox } = fakeDom(windowPayload);
  const keys = Object.keys(sandbox);
  new Function(...keys, body)(...keys.map((k) => sandbox[k]));
  await new Promise((r) => setImmediate(r));
  return el;
}

const stop = (starts, ends) => ({
  label: 'Brewery Lot',
  address_line1: '1200 Main St',
  city: 'Nashville',
  state: 'TN',
  postal_code: '37203',
  starts_at: starts,
  ends_at: ends,
});

const iso = (min) => new Date(Date.now() + min * 60_000).toISOString();
const text = (el) => el.children.map((c) => c.textContent);

// A stop in progress: the heading a customer acts on, and the range named as
// the trade names it.
{
  const el = await run({ current_stop: stop(iso(-60), iso(120)), next_stop: null, uses_stops: true });
  assert.equal(el.hidden, false);
  assert.ok(text(el).includes('Pick up location'), 'current stop heading');
  assert.ok(text(el).some((t) => t.startsWith('Service window ')), 'range labelled Service window');
  assert.ok(!el.classes.has('dt-stop-quiet'), 'a real stop is NOT painted quiet');
  const link = el.children.find((c) => c.href);
  assert.ok(link.href.includes('maps.google.com'), 'address is a map link, not text');
}

// THE REGRESSION THIS FILE EXISTS FOR. No stop now, one later: the absence is
// stated FIRST and the next stop renders under it. Before #1427 the absence
// was skipped entirely, so "Next stop, Tomorrow" stood alone and said nothing
// about whether the truck was out right now.
{
  const el = await run({ current_stop: null, next_stop: stop(iso(1200), iso(1400)), uses_stops: true });
  const t = text(el);
  assert.equal(t[0], 'There are no stops currently', 'absence leads');
  assert.ok(t.includes('Next stop'), 'next stop still rendered');
  assert.ok(t.includes('Brewery Lot'), 'and it carries the place');
  assert.ok(
    el.children.some((c) => c.className.includes('dt-stop-next')),
    'the second block is marked so CSS can space it',
  );
  assert.ok(el.classes.has('dt-stop-quiet'), 'not-out reads quiet, not as a brand bar');
}

// Nothing posted at all — the state that was UNREACHABLE before #1426, because
// uses_stops was false for a truck with no stops.
{
  const el = await run({ current_stop: null, next_stop: null, uses_stops: true });
  assert.deepEqual(text(el), ['There are no stops currently']);
  assert.equal(el.hidden, false, 'the absence is shown, not silently skipped');
}

// Degrades to nothing rather than to a wrong address.
{
  const el = await run(null);
  assert.equal(el.hidden, true, 'a failed window fetch leaves the banner hidden');
}

assert.equal(renderStopBanner({ usesStops: false, slug: 'x' }), '', 'inert for a fixed venue');

console.log('stop-banner.test.mjs: all assertions passed');
