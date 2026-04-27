# Deployment Guide — DialTone.Menu

**Stack:** Cloudflare Workers + Static Assets, Supabase (PostgreSQL), Resend (email)
**Worker name:** `dawn-pine-d058`
**Production URL:** https://dialtone.menu

---

## One-Time Setup

Complete these steps once when setting up a fresh environment.

### 1. Set Cloudflare secrets on the Worker

```bash
bash developer/ci/deploy-prod-secrets.sh
```

Prompts for and uploads:
- `RESEND_API_KEY` — Resend API key for contact form emails
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key for DB inserts (preferred)
- `SUPABASE_KEY` — Supabase anon key (fallback)

Verify secrets are live after running:
```bash
npx wrangler secret list
```

### 2. Run the Supabase schema

In the [Supabase SQL Editor](https://supabase.com/dashboard), open your project and run:
```
developer/supabase/01_waitlist_schema.sql
```

This creates the `waitlist_submissions` table, RLS policies, and required indexes.

### 3. Add GitHub Actions secrets

In GitHub → Repository → Settings → Secrets and variables → Actions, add:

| Secret name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Workers Edit API token scoped to this account |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |

### 4. Confirm `wrangler.toml` vars

In [`wrangler.toml`](../wrangler.toml) under `[vars]`, verify:
- `SUPABASE_URL` points to `https://hltmzafywzqajjzjpqva.supabase.co`
- `CONTACT_EMAIL` is set to the monitored inbox
- `SITE_NAME` is set correctly

---

## Every Deploy

### 5. Run local checks

```bash
pnpm install --frozen-lockfile
pnpm run validate:deploy
pnpm run test:robots
```

`validate:deploy` checks:
- Required `wrangler.toml` vars and bindings are intact
- Supabase project ref matches the expected value
- Worker runtime env usage is consistent
- CI workflow secret wiring is present

### 6. Review staged changes

```bash
git status
git diff --staged
```

### 7. Push branch and open a PR

```bash
git push origin feat/your-branch-name
```

Open a pull request on GitHub targeting `main`. Direct pushes to `main` are protected.

### 8. Merge the PR

Once the PR is reviewed and merged, GitHub Actions automatically runs:

1. **Install dependencies** — `pnpm install --frozen-lockfile`
2. **Validate config** — `pnpm run validate:deploy`
3. **Verify Cloudflare secrets** — `wrangler secret list` checks that `RESEND_API_KEY` and at least one Supabase DB key are present; fails the deploy if missing
4. **Deploy** — `wrangler deploy` uploads the Worker and all static assets to Cloudflare

Workflow file: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

---

## Post-Deploy Smoke Test

After the GitHub Actions deploy job shows green:

1. Open https://dialtone.menu — confirm pages load
2. Submit the waitlist form
3. Confirm all three outcomes:
   - `/api/contact` returns `200 OK`
   - Row appears in Supabase `waitlist_submissions` table
   - Email arrives at `hello@bytestreams.ai`

Quick Supabase verification query:
```sql
select id, name, restaurant_name, email, created_at
from public.waitlist_submissions
order by created_at desc
limit 5;
```

---

## Secret Rotation

To rotate a secret at any time:

```bash
bash developer/ci/deploy-prod-secrets.sh
```

Or rotate a single secret:
```bash
npx wrangler secret put RESEND_API_KEY
```

The Worker picks up the new value immediately — no redeploy required.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Form returns `503` | `SUPABASE_URL` or Supabase key missing | Run `npx wrangler secret list`, then `deploy-prod-secrets.sh` |
| Form returns `502` on submit | Supabase insert failed | Check Supabase RLS policies; re-run schema SQL |
| Email not sent but DB row saved | `RESEND_API_KEY` missing or invalid | Rotate key via `wrangler secret put RESEND_API_KEY` |
| CI fails at secret-presence check | Secret not yet uploaded to Cloudflare | Run `deploy-prod-secrets.sh`, then re-trigger the workflow |
| CI fails at `validate:deploy` | Config drift in `wrangler.toml` or `worker.js` | Run `pnpm run validate:deploy` locally and fix reported issues |

---

## Related Files

| File | Purpose |
|---|---|
| [`wrangler.toml`](../wrangler.toml) | Worker config, vars, asset binding, required secrets |
| [`worker.js`](../worker.js) | API and asset routing, Supabase persistence, Resend email |
| [`developer/ci/deploy-prod-secrets.sh`](ci/deploy-prod-secrets.sh) | Interactive production secret upload script |
| [`developer/ci/validate-cloudflare-config.mjs`](ci/validate-cloudflare-config.mjs) | Pre-deploy config validation |
| [`developer/supabase/01_waitlist_schema.sql`](supabase/01_waitlist_schema.sql) | Supabase schema, RLS policies, indexes |
| [`developer/supabase/setup-supabase.sh`](supabase/setup-supabase.sh) | Initial Supabase project setup helper |
| [`developer/supabase/README.md`](supabase/README.md) | Supabase setup instructions |
| [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) | GitHub Actions deploy workflow |
