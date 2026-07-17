// templates/index.js — the template registry. Dispatch is
// (REGISTRY[ctx.menuTemplate] ?? REGISTRY.lacquer).render(ctx), so an unknown
// or unset menu_template falls back to lacquer. Adding a template is: add its
// module, add one line here — no new if/else branch in worker.js.
import { lacquer } from './lacquer.js';
import { cards } from './cards.js';

export const TEMPLATE_REGISTRY = {
  [lacquer.id]: lacquer,
  [cards.id]: cards
};

export const DEFAULT_TEMPLATE = lacquer;

export function renderMenu(ctx) {
  const template = TEMPLATE_REGISTRY[ctx.menuTemplate] ?? DEFAULT_TEMPLATE;
  return template.render(ctx);
}
