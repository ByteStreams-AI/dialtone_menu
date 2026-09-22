/**
 * The QR encoder (dialtone_menu#125).
 *
 * The load-bearing test is the first one: every matrix is compared, module by
 * module, against one produced by an INDEPENDENT implementation. That is not
 * ceremony. Writing this encoder produced four bugs that a human reading the
 * code would not find and a rendered image would not show:
 *
 *   - the Reed-Solomon generator polynomial came out REVERSED, which is
 *     invisible at degree 1 because [1,1] is a palindrome;
 *   - the always-dark module was placed at the TRANSPOSE of its position,
 *     which is correct for any mask whose format bit 7 is 1 and wrong for the
 *     rest — i.e. it works on roughly half of all inputs;
 *   - format information was laid down LSB-first instead of MSB-first, which
 *     yields a symmetrical, entirely plausible-looking code that is not a
 *     valid BCH codeword at all;
 *   - the second format copy started one bit late, shifting every bit after it.
 *
 * Each of those produces a QR that LOOKS like a QR. Two of them scan on some
 * inputs and not others, which is the worst outcome available: a table tent
 * that works when tested and fails for a guest.
 *
 * Mask SELECTION is deliberately not compared against the reference. That
 * library's rule-1 counts same-coloured neighbours in a 3x3 block rather than
 * the spec's runs of five or more, so its choice is its own; matching it would
 * mean copying the deviation. Selection is pinned separately, below.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { encodeQr, qrSvg } from '../templates/qr.js';

const golden = JSON.parse(readFileSync(new URL('./fixtures/qr-golden.json', import.meta.url)));

// ── every module, against an independent implementation ────────────────────
for (const { text, mask, version, rows } of golden.cases) {
  const qr = encodeQr(text, { mask });
  assert.ok(qr, `failed to encode: ${text}`);
  assert.equal(qr.size, version * 4 + 17, `wrong size for ${text}`);
  assert.equal(qr.size, rows.length);
  for (let r = 0; r < rows.length; r++) {
    assert.equal(qr.modules[r].join(''), rows[r], `row ${r} differs for ${text} (mask ${mask})`);
  }
}

// ── version selection ──────────────────────────────────────────────────────
{
  // Byte-mode capacities at level M, which is what the version table encodes.
  const sizeFor = (n) => encodeQr('a'.repeat(n)).size;
  assert.equal(sizeFor(14), 21, 'v1 holds 14 bytes');
  assert.equal(sizeFor(15), 25, '15 rolls to v2');
  assert.equal(sizeFor(26), 25, 'v2 holds 26');
  assert.equal(sizeFor(27), 29, '27 rolls to v3');
  assert.equal(sizeFor(42), 29, 'v3 holds 42');
  assert.equal(sizeFor(43), 33, '43 rolls to v4');
  assert.equal(sizeFor(62), 33, 'v4 holds 62');
  assert.equal(sizeFor(63), 37, '63 rolls to v5');
  assert.equal(sizeFor(84), 37, 'v5 holds 84');
  assert.equal(sizeFor(85), 41, '85 rolls to v6');
  assert.equal(sizeFor(106), 41, 'v6 holds 106');
}

// ── the bound that justifies stopping at version 6 ─────────────────────────
{
  // The longest URL this can be asked for: the prefix plus the 63-character
  // maximum the /r/ route's own slug regex allows. If either changes, this
  // fails rather than silently dropping the QR from a tenant's menu.
  const longest = `https://app.dialtone.menu/r/${'a'.repeat(63)}`;
  assert.equal(longest.length, 91);
  assert.ok(encodeQr(longest), 'the longest possible /r/ URL must encode');
  assert.equal(encodeQr('a'.repeat(107)), null, 'past v6 it refuses rather than emitting a wrong code');
  assert.equal(encodeQr(''), null, 'empty refuses');
  assert.equal(encodeQr(null), null);
}

// ── mask selection: pinned, because the reference cannot arbitrate it ──────
{
  const chosen = golden.cases.map(({ text }) => {
    const auto = encodeQr(text);
    for (let mask = 0; mask < 8; mask++) {
      const forced = encodeQr(text, { mask });
      if (forced.modules.every((row, r) => row.join('') === auto.modules[r].join(''))) return mask;
    }
    return -1;
  });
  // Any mask yields a scannable code, so this is not correctness — it pins the
  // penalty scoring, where a regression would quietly start choosing codes
  // that carry finder-like patterns and scan worse.
  assert.deepEqual(chosen, [0, 0, 6, 7, 2, 3, 4, 3, 3, 3, 3, 2, 2, 2, 4, 3, 0]);
  assert.ok(!chosen.includes(-1), 'auto output must equal one of the eight forced masks');
}

// ── SVG shape ──────────────────────────────────────────────────────────────
{
  const svg = qrSvg('https://app.dialtone.menu/r/shortys');
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 29 29"/);
  assert.match(svg, /shape-rendering="crispEdges"/);
  assert.match(svg, /fill="#ffffff"/, 'white ground, so it reads on a dark template');
  assert.match(svg, /stroke="#000000"/);
  assert.doesNotMatch(svg, /\n/, 'single line, it is inlined into a page');
  assert.equal(qrSvg(''), '', 'un-encodable text yields no element, never a broken one');
  assert.equal(qrSvg('a'.repeat(200)), '');
}

// ── determinism ────────────────────────────────────────────────────────────
{
  const a = qrSvg('https://app.dialtone.menu/r/suis-sushi');
  const b = qrSvg('https://app.dialtone.menu/r/suis-sushi');
  assert.equal(a, b, 'same input, same bytes — the page is edge-cached');
  assert.notEqual(a, qrSvg('https://app.dialtone.menu/r/shortys'), 'different tenants differ');
}

console.log('qr.test.mjs: all assertions passed');
