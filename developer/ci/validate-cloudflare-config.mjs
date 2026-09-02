import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const wranglerPath = path.join(root, 'wrangler.toml');
const workerPath = path.join(root, 'worker.js');
const workflowPath = path.join(root, '.github', 'workflows', 'deploy.yml');
const expectedSupabaseProjectRefs = [
  process.env.EXPECTED_SUPABASE_PROJECT_REFS,
  process.env.EXPECTED_SUPABASE_PROJECT_REF
]
  .filter(Boolean)
  .flatMap((value) => value.split(','))
  .map((value) => value.trim())
  .filter(Boolean);

const failures = [];

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function requireMatch(content, pattern, message) {
  if (!pattern.test(content)) {
    failures.push(message);
  }
}

function extractWranglerVar(content, key) {
  const match = content.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"\\s*$`, 'm'));
  return match ? match[1] : '';
}

function validateWrangler(content) {
  requireMatch(content, /^name\s*=\s*"[a-z0-9-]+"\s*$/m, 'wrangler.toml: missing valid worker name');
  requireMatch(content, /^main\s*=\s*"worker\.js"\s*$/m, 'wrangler.toml: main must point to worker.js');
  requireMatch(content, /^\[vars\]$/m, 'wrangler.toml: missing [vars] block');
  requireMatch(content, /^SUPABASE_URL\s*=\s*"https:\/\/[^"]+\.supabase\.co"\s*$/m, 'wrangler.toml: SUPABASE_URL must be set to a real Supabase project URL');
  requireMatch(content, /^CONTACT_EMAIL\s*=\s*"[^"]+"\s*$/m, 'wrangler.toml: CONTACT_EMAIL is required');
  requireMatch(content, /^SITE_NAME\s*=\s*"[^"]+"\s*$/m, 'wrangler.toml: SITE_NAME is required');
  requireMatch(content, /^binding\s*=\s*"ASSETS"\s*$/m, 'wrangler.toml: assets binding must be ASSETS');
  validateWorkerFirst(content);
  requireMatch(content, /^\[secrets\]$/m, 'wrangler.toml: missing [secrets] block — required for deploy-time enforcement');
  requireMatch(content, /RESEND_API_KEY/, 'wrangler.toml: RESEND_API_KEY not listed under [secrets]');
  requireMatch(content, /SUPABASE_SERVICE_ROLE_KEY/, 'wrangler.toml: SUPABASE_SERVICE_ROLE_KEY not listed under [secrets]');
  requireMatch(content, /SUPABASE_KEY/, 'wrangler.toml: SUPABASE_KEY not listed under [secrets]');

  const supabaseUrl = extractWranglerVar(content, 'SUPABASE_URL');
  if (supabaseUrl) {
    try {
      const host = new URL(supabaseUrl).hostname;
      const projectRef = host.split('.')[0] || '';
      if (expectedSupabaseProjectRefs.length > 0 && !expectedSupabaseProjectRefs.includes(projectRef)) {
        failures.push(
          `wrangler.toml: SUPABASE_URL project ref must be one of [${expectedSupabaseProjectRefs.join(', ')}], found ${projectRef}`
        );
      }
    } catch {
      failures.push('wrangler.toml: SUPABASE_URL is not a valid URL');
    }
  }
}

/**
 * Every path the Worker routes must appear in EVERY `run_worker_first` block.
 *
 * With `not_found_handling = "404-page"`, a path that is neither a static asset
 * nor on this list is short-circuited to /404.html **without invoking the
 * Worker**. The code looks correct, the tests pass, and the live URL serves the
 * marketing 404 page. It has now cost three separate features — `/menu`
 * (#986), `/_order/*` (#1182), and `/r/*` (dialtone_app#57), the last of which
 * shipped with `/.well-known/*` listed and `/r/*` not, so the association file
 * worked on the first deploy while the page it points at 404'd.
 *
 * Worker tests cannot catch this: they call `worker.fetch()` directly, which is
 * below the layer that does the short-circuiting. A config assertion is the
 * only place it can be caught before a deploy.
 *
 * Checking EVERY block also catches the other half of the family: wrangler
 * environments do not inherit, so a path listed in production and forgotten in
 * `[env.preview.assets]` fails only in preview.
 */
const WORKER_FIRST_REQUIRED = [
  '/',
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/.well-known/*',
  '/m/*',
  '/_order/*',
  '/r/*',
  '/menu',
  '/api/*'
];

function validateWorkerFirst(content) {
  const blocks = [...content.matchAll(/run_worker_first\s*=\s*\[([\s\S]*?)\]/g)];

  if (blocks.length === 0) {
    failures.push('wrangler.toml: no run_worker_first block found');
    return;
  }
  // One block per assets-serving environment — production, preview, demo, and
  // whatever comes next. DERIVED rather than hardcoded: this check read
  // `< 2` while three environments existed, so deleting the demo block would
  // have left two and passed. A missing block means an environment silently
  // loses every Worker route it should be serving, which is the trap that has
  // now bitten three times.
  const assetBlocks = [...content.matchAll(/^\[(?:env\.[a-z0-9_-]+\.)?assets\]/gm)].length;
  if (blocks.length < assetBlocks) {
    failures.push(
      `wrangler.toml: found ${assetBlocks} [assets] blocks but only ${blocks.length} run_worker_first blocks ` +
        '— an environment without one short-circuits every Worker route to /404.html'
    );
  }

  blocks.forEach((block, index) => {
    const listed = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const missing = WORKER_FIRST_REQUIRED.filter((p) => !listed.includes(p));
    if (missing.length > 0) {
      failures.push(
        `wrangler.toml: run_worker_first block ${index + 1} is missing ${missing.join(', ')} ` +
          '— those paths would be short-circuited to /404.html without invoking the Worker'
      );
    }
  });
}

function validateWorker(content) {
  requireMatch(content, /if \(url\.pathname === '\/api\/contact'\)/, 'worker.js: /api/contact route handler is missing');
  requireMatch(content, /env\.SUPABASE_SERVICE_ROLE_KEY\s*\|\|\s*env\.SUPABASE_KEY/, 'worker.js: expected SUPABASE_SERVICE_ROLE_KEY fallback to SUPABASE_KEY');
  requireMatch(content, /env\.SUPABASE_URL/, 'worker.js: expected SUPABASE_URL usage');
  requireMatch(content, /env\.RESEND_API_KEY/, 'worker.js: expected RESEND_API_KEY usage');
  requireMatch(content, /\/rest\/v1\/waitlist_submissions/, 'worker.js: expected waitlist_submissions persistence endpoint');
}

function validateWorkflow(content) {
  requireMatch(content, /CLOUDFLARE_API_TOKEN:\s*\$\{\{\s*secrets\.CLOUDFLARE_API_TOKEN\s*\}\}/, 'deploy.yml: missing CLOUDFLARE_API_TOKEN secret wiring');
  requireMatch(content, /CLOUDFLARE_ACCOUNT_ID:\s*\$\{\{\s*secrets\.CLOUDFLARE_ACCOUNT_ID\s*\}\}/, 'deploy.yml: missing CLOUDFLARE_ACCOUNT_ID secret wiring');
  requireMatch(content, /run:\s*pnpm\s+wrangler\s+deploy/, 'deploy.yml: deploy step must run wrangler deploy');
}

const wrangler = readFile(wranglerPath);
const worker = readFile(workerPath);
const workflow = readFile(workflowPath);

validateWrangler(wrangler);
validateWorker(worker);
validateWorkflow(workflow);

if (failures.length > 0) {
  console.error('Cloudflare/Supabase pre-deploy validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Cloudflare/Supabase pre-deploy validation passed.');