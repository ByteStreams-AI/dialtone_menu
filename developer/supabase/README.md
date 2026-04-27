# Supabase Setup For DialTone

This folder contains scripts and steps for wiring Supabase to the waitlist form.

## Files
- `01_waitlist_schema.sql`: creates the `waitlist_submissions` table, indexes, and RLS policies, including separate contact-name and restaurant-name fields.
- `setup-supabase.sh`: interactive helper script to prompt for project values, link Supabase, set Worker secret, and guide final checks.

## Prereqs
- Supabase CLI installed (`supabase --version`)
- Wrangler available globally (`wrangler --version`) or locally via repo devDependency (`npx wrangler --version`)
- Access to your Supabase project dashboard

## 1) Gather values from Supabase
From **Project Settings -> API**:
- Project URL, for example `https://<project-ref>.supabase.co`
- `publishable` (`sb_publishable_...`) key
- Project ref (`<project-ref>`)

## 2) Run setup helper (interactive)

```bash
bash developer/supabase/setup-supabase.sh
```

The script will:
- Show an intro banner at start and exit banner on success/failure/cancel
- Prompt for `SUPABASE_URL`, `SUPABASE_PROJECT_REF`, and `SUPABASE_ANON_KEY`
- Reuse existing `.env.supabase` values as defaults when available
- Prompt `SUPABASE_ANON_KEY` as visible input (more reliable paste behavior across terminals)
- Prompt secret fields hidden first with visible fallback when paste fails
- Show a confirmation summary and ask for approval before applying any changes
- Save local values in `.env.supabase`
- Run `supabase link --project-ref ...`
- Prompt you to run SQL schema file in Supabase SQL Editor
- Set Cloudflare Worker secret `SUPABASE_KEY` (using global `wrangler` or fallback `npx wrangler`)

Recommended for production reliability:
- Also set `SUPABASE_SERVICE_ROLE_KEY` as a Worker secret (server-side only):

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

The Worker prefers `SUPABASE_SERVICE_ROLE_KEY` and falls back to `SUPABASE_KEY`.

This pattern is reusable across projects and reduces setup time because each run can bootstrap from prior `.env.supabase` values.

## 3) Optional non-interactive mode
If you want CI-friendly execution, set values inline and pass `--yes` (or `-y`) to skip the confirmation prompt:

```bash
SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_PROJECT_REF="<project-ref>" \
SUPABASE_ANON_KEY="sb_publishable_..." \
bash developer/supabase/setup-supabase.sh --yes
```

You can also use `-y` as a shorthand:

```bash
bash developer/supabase/setup-supabase.sh -y
```

Without `--yes`, the script always pauses at a confirmation summary before applying changes.

## 4) Run SQL schema
In Supabase SQL Editor, execute:
- `developer/supabase/01_waitlist_schema.sql`

## 5) Confirm Worker config
In `wrangler.toml` under `[vars]`, set:
- `SUPABASE_URL = "https://<project-ref>.supabase.co"`

Do not store `SUPABASE_KEY` in source control.

## 6) Validate locally

```bash
npx wrangler dev --port 8787
```

Test waitlist form submission on `http://localhost:8787/`.

Note on runtime config:
- The API now fails fast if Supabase URL or DB key is missing.
- A successful `POST /api/contact` now implies the row was inserted in Supabase.
- If local dev logs `missing SUPABASE_URL or DB key secret`, run remote dev or add local dev vars.

### Local dev options
Option A (recommended): use remote mode so Worker secrets are available.

```bash
npx wrangler dev --remote --port 8787
```

Option B: local mode with `.dev.vars` (do not commit this file):

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
RESEND_API_KEY=<resend-api-key>
CONTACT_EMAIL=hello@bytestreams.ai
SITE_NAME=DialToneMenu
```

## 7) Quick verification queries
Run in Supabase SQL Editor:

```sql
select id, email, name, comment, created_at
from public.waitlist_submissions
order by created_at desc
limit 20;
```

If emails send but no DB rows appear:
1. Re-run `developer/supabase/01_waitlist_schema.sql` (includes grants + RLS insert policies for both `anon` and `authenticated`).
2. Set `SUPABASE_SERVICE_ROLE_KEY` in Cloudflare Worker secrets.
3. Submit the form once more and re-run the select query.
