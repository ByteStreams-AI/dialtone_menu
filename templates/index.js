// templates/index.js — the template registry. Dispatch is
// (REGISTRY[ctx.menuTemplate] ?? REGISTRY.lacquer).render(ctx), so an unknown
// or unset menu_template falls back to lacquer. Adding a template is: add its
// module, add one line here — no new if/else branch in worker.js.
import { lacquer } from './lacquer.js';
import { cards } from './cards.js';
import { standard } from './standard.js';

export const TEMPLATE_REGISTRY = {
  [lacquer.id]: lacquer,
  [cards.id]: cards,
  [standard.id]: standard
};

/** Registered ids, for callers that need to enumerate (preview, tests). */
export const TEMPLATE_IDS = Object.keys(TEMPLATE_REGISTRY);

export const DEFAULT_TEMPLATE = lacquer;

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
