// dev/preview-menu.mjs — render a template against live or fixture data with
// ZERO deploy. The whole point of the Option A module split (#914): iterate on
// a template and see the real HTML instantly, instead of pushing to the
// prod-only worker and waiting on the ~5-min edge cache.
//
//   node dev/preview-menu.mjs <slug> [template] [--out FILE]
//
// Data source: the staging get_public_menu_by_slug RPC. Set MENU_ANON_KEY (the
// staging anon key) in the environment. With --fixture it uses a built-in
// payload instead, so it runs with no network and no key.
//
//   MENU_ANON_KEY=<staging anon> node dev/preview-menu.mjs suis-sushi cards
//   node dev/preview-menu.mjs demo lacquer --fixture --out /tmp/menu.html
import { writeFileSync } from 'node:fs';
import { buildMenuCtx } from '../templates/shared.js';
import { renderMenu, TEMPLATE_REGISTRY } from '../templates/index.js';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const pos = args.filter((a) => !a.startsWith('--'));
const slug = pos[0] || 'demo';
const template = pos[1] || null; // null = honor the row's menu_template
const outIdx = args.indexOf('--out');
const outFile = outIdx > -1 ? args[outIdx + 1] : null;

const FIXTURE = {
  restaurant: {
    name: 'Preview Bistro', display_name: 'Preview Bistro',
    tagline: 'Rendered locally, no deploy.', timezone: 'America/Chicago',
    primary_color: '#8A1C2B', secondary_color: '#E8A020', font: 'Playfair Display',
    hero_image_url: null, logo_url: null, menu_template: template || 'lacquer'
  },
  categories: [
    { name: 'Starters', sort_order: 1, items: [
      { name: 'Soup of the Day', description: 'Ask your server', base_price_cents: 800, is_available: true },
      { name: 'House Salad', description: 'Greens, vinaigrette', base_price_cents: 900, is_available: true }
    ] }
  ]
};

async function loadPayload() {
  if (flags.has('--fixture')) return FIXTURE;
  const url = process.env.MENU_SUPABASE_URL || 'https://mxhyvvgjtqllohpvrwon.supabase.co';
  const key = process.env.MENU_ANON_KEY;
  if (!key) {
    console.error('Set MENU_ANON_KEY (staging anon key), or pass --fixture for offline data.');
    process.exit(1);
  }
  const res = await fetch(`${url}/rest/v1/rpc/get_public_menu_by_slug`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: key, authorization: `Bearer ${key}` },
    body: JSON.stringify({ p_slug: slug })
  });
  if (!res.ok) { console.error(`RPC failed ${res.status}: ${await res.text()}`); process.exit(1); }
  return res.json();
}

const payload = await loadPayload();
if (template) payload.restaurant = { ...payload.restaurant, menu_template: template };
const ctx = buildMenuCtx(payload, slug);
const resolved = TEMPLATE_REGISTRY[ctx.menuTemplate] ? ctx.menuTemplate : `${ctx.menuTemplate} → lacquer (fallback)`;
const html = renderMenu(ctx);

if (outFile) { writeFileSync(outFile, html); console.error(`[${resolved}] ${html.length} bytes → ${outFile}`); }
else process.stdout.write(html);
