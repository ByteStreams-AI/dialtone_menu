import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const wranglerPath = path.join(root, 'wrangler.toml');
const workerPath = path.join(root, 'worker.js');
const workflowPath = path.join(root, '.github', 'workflows', 'deploy.yml');
const expectedSupabaseProjectRef = process.env.EXPECTED_SUPABASE_PROJECT_REF || 'hltmzafywzqajjzjpqva';

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
  requireMatch(content, /run_worker_first\s*=\s*\[[\s\S]*"\/api\/\*"[\s\S]*\]/m, 'wrangler.toml: run_worker_first must include /api/*');
  requireMatch(content, /^\[secrets\]$/m, 'wrangler.toml: missing [secrets] block — required for deploy-time enforcement');
  requireMatch(content, /RESEND_API_KEY/, 'wrangler.toml: RESEND_API_KEY not listed under [secrets]');
  requireMatch(content, /SUPABASE_SERVICE_ROLE_KEY/, 'wrangler.toml: SUPABASE_SERVICE_ROLE_KEY not listed under [secrets]');
  requireMatch(content, /SUPABASE_KEY/, 'wrangler.toml: SUPABASE_KEY not listed under [secrets]');

  const supabaseUrl = extractWranglerVar(content, 'SUPABASE_URL');
  if (supabaseUrl) {
    try {
      const host = new URL(supabaseUrl).hostname;
      const projectRef = host.split('.')[0] || '';
      if (projectRef !== expectedSupabaseProjectRef) {
        failures.push(
          `wrangler.toml: SUPABASE_URL project ref must be ${expectedSupabaseProjectRef}, found ${projectRef}`
        );
      }
    } catch {
      failures.push('wrangler.toml: SUPABASE_URL is not a valid URL');
    }
  }
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