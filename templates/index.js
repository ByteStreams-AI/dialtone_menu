// templates/index.js — the template registry. Dispatch is
// (REGISTRY[ctx.menuTemplate] ?? DEFAULT_TEMPLATE).render(ctx), so an unknown
// or unset menu_template falls back to `standard` — the neutral card list. An
// unrecognized value renders something the operator didn't choose, so it gets
// the same neutral default as a brand-new tenant (dialtone#1010), not Lacquer's
// editorial look. Adding a template is: add its module, add one line here — no
// new if/else branch in worker.js.
import { lacquer } from './lacquer.js';
import { cards } from './cards.js';
import { standard } from './standard.js';
import { catering } from './catering.js';

export const TEMPLATE_REGISTRY = {
  [lacquer.id]: lacquer,
  [cards.id]: cards,
  [standard.id]: standard
};

/** Registered ids, for callers that need to enumerate (preview, tests). */
export const TEMPLATE_IDS = Object.keys(TEMPLATE_REGISTRY);

export const DEFAULT_TEMPLATE = standard;

export function renderMenu(ctx) {
  const template = TEMPLATE_REGISTRY[ctx.menuTemplate] ?? DEFAULT_TEMPLATE;
  return template.render(ctx);
}

/**
 * The home surface (#986 Phase 2). A template that hasn't grown its own home
 * design yet borrows Standard's, so enabling the mode never yields a blank
 * root — the operator turned it on and is owed a page. Editorial and Cards get
 * bespoke homes next; when they do, adding `renderHome` to their module is the
 * whole change.
 */
export function renderHome(ctx) {
  const template = TEMPLATE_REGISTRY[ctx.menuTemplate] ?? DEFAULT_TEMPLATE;
  const render = template.renderHome ?? standard.renderHome;
  return render(ctx);
}

/** True when this ctx should serve the home page at the root. */
export function servesHomeAtRoot(ctx) {
  return ctx.site?.mode === 'home_and_menu';
}

/**
 * The CATERING registry (dialtone#1553, #1559).
 *
 * Its own registry, not a slot on the menu templates, because what varies is a
 * different axis: how much selling the page does, which is orthogonal to
 * whether the menu is editorial or a photo grid. One template ships; adding a
 * second is a module and one line here.
 *
 * The branch a visitor actually sees is chosen by THEM — the occasion they pick
 * — not by the operator. One truck serves weddings and Tuesday office lunches,
 * so a per-tenant choice would be wrong for half its customers either way.
 */
export const CATERING_REGISTRY = {
  [catering.id]: catering
};

export const DEFAULT_CATERING_TEMPLATE = catering;

export function renderCatering(ctx) {
  const template = CATERING_REGISTRY[ctx.cateringTemplate] ?? DEFAULT_CATERING_TEMPLATE;
  return template.render(ctx);
}
