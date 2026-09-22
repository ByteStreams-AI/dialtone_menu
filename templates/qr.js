/**
 * A QR encoder, just big enough for one job (dialtone_menu#125).
 *
 * The menu's app QR has to carry `app.dialtone.menu/r/<slug>`, which differs
 * per tenant, so it cannot stay a static hand-generated SVG. This worker has
 * no runtime dependencies and that is deliberate, so rather than vendor a
 * general-purpose library (the smallest good one is ~2,300 lines, nearly all
 * of it SJIS and multibyte handling we never reach) this encodes exactly the
 * case we have and refuses everything else.
 *
 * Deliberately narrow:
 *   - BYTE mode only. URLs are ASCII; alphanumeric mode would be denser but
 *     lowercase slugs are not in its charset anyway.
 *   - EC level M. What the previous static QR used (`npx qrcode -e M`), and
 *     the right trade for a code printed on a table: 15% recovery survives a
 *     thumbprint without inflating the module count.
 *   - Versions 1-6, which is not a guess: the longest URL this can be asked
 *     for is 28 chars of prefix plus the 63-char maximum slug the `/r/`
 *     route's own regex allows = 91 bytes, and v6 at level M holds 106.
 *     Capping at 6 also means no version-information blocks, which only
 *     appear from v7 — a whole BCH(18,6) stage that would be dead code.
 *
 * Correctness is pinned by differential test, not by reading: every matrix
 * this produces is compared against `qrcode-generator` (an independent MIT
 * implementation) for a spread of inputs, and those matrices are checked in
 * as fixtures so the property survives without a dev dependency. A QR that is
 * subtly wrong still scans on some phones, so "it worked on mine" is not
 * evidence here.
 */

// ---- GF(256), the field QR's Reed-Solomon works over --------------------
// Primitive polynomial 0x11D, as the spec fixes it.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Generator polynomial for `degree` EC codewords. */
function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      // Coefficients run highest-degree first, so multiplying by x keeps the
      // index and multiplying by the root shifts it down one. Getting these
      // two the wrong way round yields the polynomial REVERSED, which is
      // invisible at degree 1 because [1,1] is a palindrome.
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** The EC codewords for one block. */
function rsRemainder(data, ecLen) {
  const gen = rsGenerator(ecLen);
  const rem = new Uint8Array(ecLen);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    for (let i = 0; i < ecLen; i++) rem[i] ^= mul(gen[i + 1], factor);
  }
  return rem;
}

// ---- Per-version tables, level M only -----------------------------------
// [total codewords, ec codewords per block, block count]
// Data codewords per block = (total - ec*blocks) / blocks, and the spec's
// group-2 blocks (one codeword longer) do not occur at level M below v7.
const VERSIONS = {
  1: { total: 26, ecPerBlock: 10, blocks: 1, align: [] },
  2: { total: 44, ecPerBlock: 16, blocks: 1, align: [6, 18] },
  3: { total: 70, ecPerBlock: 26, blocks: 1, align: [6, 22] },
  4: { total: 100, ecPerBlock: 18, blocks: 2, align: [6, 26] },
  5: { total: 134, ecPerBlock: 24, blocks: 2, align: [6, 30] },
  6: { total: 172, ecPerBlock: 16, blocks: 4, align: [6, 34] }
};
const MAX_VERSION = 6;

/** Data codewords available to the payload at this version. */
const dataCodewords = (v) => VERSIONS[v].total - VERSIONS[v].ecPerBlock * VERSIONS[v].blocks;

/** Smallest version that fits `byteLen` bytes, or 0 if none does. */
function pickVersion(byteLen) {
  for (let v = 1; v <= MAX_VERSION; v++) {
    // 4 bits mode + 8 bits character count, then the payload.
    if (dataCodewords(v) * 8 >= 12 + byteLen * 8) return v;
  }
  return 0;
}

// ---- Bit stream ----------------------------------------------------------
function buildCodewords(bytes, version) {
  const capacity = dataCodewords(version);
  const bits = [];
  const push = (value, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, 8); // character count, 8 bits for v1-9 in byte mode
  for (const b of bytes) push(b, 8);

  // Terminator, then pad to a whole codeword, then alternating pad bytes.
  const limit = capacity * 8;
  for (let i = 0; i < 4 && bits.length < limit; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const out = new Uint8Array(capacity);
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    out[i / 8] = byte;
  }
  for (let i = bits.length / 8, pad = 0; i < capacity; i++, pad++) {
    out[i] = pad % 2 === 0 ? 0xec : 0x11;
  }
  return out;
}

/** Split into blocks, compute EC, and interleave as the spec requires. */
function interleave(codewords, version) {
  const { ecPerBlock, blocks } = VERSIONS[version];
  const perBlock = codewords.length / blocks;
  const dataBlocks = [];
  const ecBlocks = [];
  for (let i = 0; i < blocks; i++) {
    const block = codewords.slice(i * perBlock, (i + 1) * perBlock);
    dataBlocks.push(block);
    ecBlocks.push(rsRemainder(block, ecPerBlock));
  }

  const out = [];
  for (let i = 0; i < perBlock; i++) for (const b of dataBlocks) out.push(b[i]);
  for (let i = 0; i < ecPerBlock; i++) for (const b of ecBlocks) out.push(b[i]);
  return out;
}

// ---- Matrix --------------------------------------------------------------
const FINDER = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1]
];

function blankMatrix(version) {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
  const set = (r, c, v) => {
    if (r >= 0 && r < size && c >= 0 && c < size) modules[r][c] = v;
  };

  // Finders, each with its light separator.
  for (const [ro, co] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inside = r >= 0 && r < 7 && c >= 0 && c < 7;
        set(ro + r, co + c, inside ? FINDER[r][c] : 0);
      }
    }
  }

  // Alignment patterns, skipping the three that would sit on a finder.
  const centers = VERSIONS[version].align;
  for (const r of centers) {
    for (const c of centers) {
      if ((r === 6 && c === 6) || (r === 6 && c === centers[centers.length - 1]) ||
          (c === 6 && r === centers[centers.length - 1])) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1 ? 1 : 0);
        }
      }
    }
  }

  // Timing patterns.
  for (let i = 8; i < size - 8; i++) {
    const bit = i % 2 === 0 ? 1 : 0;
    set(6, i, bit);
    set(i, 6, bit);
  }

  // The always-dark module: (4V+9, 8), which is (size-8, 8). Its transpose
  // (8, size-8) is where format bit 7 goes, and the two coincide whenever that
  // bit happens to be 1 — so swapping them is correct for some masks and wrong
  // for others, which is as hard to notice as a bug gets.
  set(size - 8, 8, 1);
  for (let i = 0; i < 9; i++) {
    if (modules[8][i] === -1) set(8, i, 0);
    if (modules[i][8] === -1) set(i, 8, 0);
  }
  for (let i = 0; i < 8; i++) {
    if (modules[8][size - 1 - i] === -1) set(8, size - 1 - i, 0);
    if (modules[size - 1 - i][8] === -1) set(size - 1 - i, 8, 0);
  }
  return { size, modules };
}

/** True where a module is structural and must not carry data. */
function reservedMask(version) {
  const { size } = blankMatrix(version);
  const base = blankMatrix(version).modules;
  const reserved = Array.from({ length: size }, () => new Uint8Array(size));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) reserved[r][c] = base[r][c] === -1 ? 0 : 1;
  }
  return reserved;
}

function placeData(matrix, reserved, bytes) {
  const { size, modules } = matrix;
  const bits = [];
  for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);

  let idx = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // the vertical timing column is skipped entirely
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (reserved[row][col]) continue;
        modules[row][col] = idx < bits.length ? bits[idx] : 0;
        idx++;
      }
    }
    upward = !upward;
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
];

/** Format information: 5 bits of (EC level, mask) under BCH(15,5), XOR 0x5412. */
function formatBits(maskIndex) {
  const data = (0b00 << 3) | maskIndex; // 0b00 = level M
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem <<= 1;
    if (rem & 0x400) rem ^= 0x537;
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function applyFormat(matrix, reserved, maskIndex) {
  const { size, modules } = matrix;
  const bits = formatBits(maskIndex);
  // MSB first: the 15-bit string is laid down starting from bit 14, so the
  // first placed module carries the high bit. Reversing this still produces a
  // symmetrical, plausible-looking code — it simply is not a valid BCH
  // codeword, so scanners find no format information and read nothing.
  const bit = (i) => (bits >> (14 - i)) & 1;

  for (let i = 0; i <= 5; i++) modules[8][i] = bit(i);
  modules[8][7] = bit(6);
  modules[8][8] = bit(7);
  modules[7][8] = bit(8);
  for (let i = 9; i <= 14; i++) modules[14 - i][8] = bit(i);

  // Second copy: bits 0-6 up the bottom-left, bits 7-14 across the top-right,
  // starting at column size-8 (NOT size-7 — bit 7 lives there, beside the dark
  // module, and off-by-one here shifts every remaining bit).
  for (let i = 0; i <= 6; i++) modules[size - 1 - i][8] = bit(i);
  for (let i = 7; i <= 14; i++) modules[8][size - 15 + i] = bit(i);
  modules[size - 8][8] = 1;
  void reserved;
}

/** The spec's four penalty rules; the lowest total wins. */
function penalty(modules, size) {
  let score = 0;

  // Rule 1 — runs of five or more.
  for (let i = 0; i < size; i++) {
    for (const read of [(j) => modules[i][j], (j) => modules[j][i]]) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        if (read(j) === read(j - 1)) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else run = 1;
      }
    }
  }

  // Rule 2 — 2x2 blocks of one colour.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) score += 3;
    }
  }

  // Rule 3 — finder-like 1:1:3:1:1 runs with four light modules beside them.
  const A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const matches = (read, start) => {
    let a = true;
    let b = true;
    for (let k = 0; k < 11; k++) {
      const v = read(start + k);
      if (v !== A[k]) a = false;
      if (v !== B[k]) b = false;
    }
    return a || b;
  };
  for (let i = 0; i < size; i++) {
    for (let j = 0; j + 11 <= size; j++) {
      if (matches((k) => modules[i][k], j)) score += 40;
      if (matches((k) => modules[k][i], j)) score += 40;
    }
  }

  // Rule 4 — deviation from an even split of dark and light.
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += modules[r][c];
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/**
 * Encode `text` as a QR matrix.
 *
 * Returns `null` rather than throwing when the text cannot fit, because every
 * caller here renders a page: a menu must still serve when a slug is absurd,
 * and the panel simply omits the code.
 */
export function encodeQr(text, options = {}) {
  const bytes = new TextEncoder().encode(String(text ?? ''));
  if (bytes.length === 0) return null;
  const version = pickVersion(bytes.length);
  if (!version) return null;

  const stream = interleave(buildCodewords(bytes, version), version);
  const reserved = reservedMask(version);

  // `options.mask` forces one mask instead of scoring all eight. Only the
  // differential test uses it, to tell a mask-SELECTION difference from a
  // structural one — the two look identical in a whole-matrix comparison.
  const candidates = Number.isInteger(options.mask) ? [options.mask] : [0, 1, 2, 3, 4, 5, 6, 7];
  let best = null;
  for (const maskIndex of candidates) {
    const matrix = blankMatrix(version);
    placeData(matrix, reserved, stream);
    for (let r = 0; r < matrix.size; r++) {
      for (let c = 0; c < matrix.size; c++) {
        if (!reserved[r][c] && MASKS[maskIndex](r, c)) matrix.modules[r][c] ^= 1;
      }
    }
    applyFormat(matrix, reserved, maskIndex);
    const score = penalty(matrix.modules, matrix.size);
    if (!best || score < best.score) best = { score, matrix };
  }

  return { size: best.matrix.size, modules: best.matrix.modules.map((row) => Array.from(row)) };
}

/**
 * The same self-contained SVG shape the static code used: one white ground and
 * one black path, viewBox in module units, no margin (the CSS supplies the
 * quiet zone). Returns '' when the text cannot be encoded.
 */
export function qrSvg(text) {
  const qr = encodeQr(text);
  if (!qr) return '';
  const { size, modules } = qr;

  let path = '';
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (!modules[r][c]) { c++; continue; }
      let run = 0;
      while (c + run < size && modules[r][c + run]) run++;
      path += `M${c} ${r + 0.5}h${run}`;
      c += run;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<path fill="#ffffff" d="M0 0h${size}v${size}H0z"/>` +
    `<path stroke="#000000" d="${path}"/></svg>`;
}
