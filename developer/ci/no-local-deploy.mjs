#!/usr/bin/env node
// Guard: `pnpm deploy` must NOT deploy from a developer's machine.
//
// dialtone.menu is deployed ONLY by GitHub Actions (.github/workflows/deploy.yml),
// which runs `pnpm wrangler deploy` on push to `main` (or via the "Deploy site"
// workflow_dispatch). A LOCAL `wrangler deploy` ships whatever worker.js +
// wrangler.toml are in the working tree — and a deploy from a stale/feature
// branch has repeatedly reverted the branded `*.m.dialtone.menu` menus back to
// the marketing 404 (the branch lacked the `.m.` host routing + route config).
//
// So `pnpm deploy` now refuses. CI is unaffected — it calls `pnpm wrangler
// deploy` directly, not this script.
console.error(
  [
    '',
    '  ⛔  Local deploy is disabled.',
    '',
    '     dialtone.menu deploys ONLY via GitHub Actions:',
    '       • push to `main`, or',
    '       • run the "Deploy site" workflow (Actions → Deploy site → Run workflow).',
    '',
    '     A local `wrangler deploy` ships your local worker.js + wrangler.toml and',
    '     has repeatedly reverted the branded *.m.dialtone.menu menus. Let CI own it.',
    '',
    '     If you REALLY intend to deploy from this machine (rare, deliberate):',
    '       pnpm wrangler deploy',
    '',
  ].join('\n'),
);
process.exit(1);
