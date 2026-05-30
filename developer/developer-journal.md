# Developer Journal

## 2026-05-30
- Implemented Issue #27 in [worker.js](worker.js) by adding a new dynamic public menu route at `/m/<slug>` that fetches menu data via Supabase RPC (`get_public_menu_by_slug`) and server-renders a branded HTML page.
- Added request-driven edge caching for menu pages and unknown-slug responses with `Cache-Control: public, max-age=0, s-maxage=300`, keeping freshness tied to traffic rather than a scheduled republish flow.
- Added security hardening for tenant-authored content in [worker.js](worker.js): HTML escaping for restaurant/category/item/modifier text, `safeLogoUrl` URL scheme checks, `safeFontFamily` and `googleFontHref` sanitization, and color fallbacks with strict `#RRGGBB` validation.
- Added menu UX details in [worker.js](worker.js): branding header (logo or text wordmark), optional `Visit our site` CTA, category serving-hours labels, special-price rendering with struck-through base price, modifier-group rendering, and client-side "served later" tagging using restaurant-local timezone with cross-midnight handling.
- Updated [wrangler.toml](wrangler.toml) to include `/m/*` in `run_worker_first` so menu routes are always handled by the Worker (not static-asset fallback) in production.
- Added test coverage in [tests/public-menu.test.mjs](tests/public-menu.test.mjs) and a script in [package.json](package.json) (`test:menu`) to validate RPC wiring, escaping, pricing display, serving-hours labels, website-link attributes, 404 behavior, and config-failure handling.
- Added local-env compatibility fallback in [worker.js](worker.js) so menu RPC auth key resolution also checks existing `SUPABASE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` when dedicated public-menu anon variables are not set.
- Updated [worker.js](worker.js) 404 handling for Supabase RPC responses: when RPC 404 indicates missing `get_public_menu_by_slug` (`PGRST202` / function-not-found text), return `503 Service Unavailable`; otherwise map to the friendly menu-not-found `404` page for slug-miss UX consistency.
- Updated [wrangler.toml](wrangler.toml) comments to document public-menu env wiring and response semantics clearly: slug misses return friendly `404`, while RPC/function-missing environment mismatches return `503`; added local `.dev.vars` override examples for `PUBLIC_MENU_SUPABASE_URL` / `PUBLIC_MENU_SUPABASE_ANON_KEY`.
- Added commented local placeholders to [.dev.vars](.dev.vars) for `PUBLIC_MENU_SUPABASE_URL` and `PUBLIC_MENU_SUPABASE_ANON_KEY` so menu route testing can be enabled quickly without touching committed runtime vars.
- Validation run: `pnpm run test:robots && pnpm run test:menu` passed.

## 2026-05-18
- Updated "Book a 15-Minute Call" CTAs in [public/pricing.html](public/pricing.html) (Pro tier) and [public/features.html](public/features.html) (final CTA section) to point to the homepage contact form anchor (`/#contact`) instead of `mailto:` links.
- Added a new roadmap pill `Tap to Pay` to the “We ship constantly.” section in [public/features.html](public/features.html).

- Fixed Cloudflare deploy blocker by creating real Workers KV namespaces for `RATE_LIMIT_KV` and updating [wrangler.toml](wrangler.toml) `id`/`preview_id` from placeholder zeros to valid namespace IDs.

- Replaced static admin dashboard image in [public/features.html](public/features.html) with a slideshow cycling through admin-orders01.png, admin-orders02.png, and admin-orders03.png, including next/prev controls and keyboard navigation.

- Updated Pilot trial duration copy in [public/pricing.html](public/pricing.html) from 60 days to 14 days across all related references (tier tagline, price unit, Pilot footnote, and Pilot program detail copy including conversion timing at day 15).

- Updated pricing-page copy in [public/pricing.html](public/pricing.html) from the source brief at `~/dev/notes/projects/dialtone/pricing-page-copy.md`: changed hero headline/subtitle, updated all four tier prices/fees/features/CTAs (including Starter $99 and Pro $279), added explicit call-cost passthrough lines per tier, inserted the below-grid call-cost + transaction-fee explainer block, and renamed the follow-on section heading to `02 - Questions you might have`.

- Added a local dev convenience script in [package.json](package.json): `dev:wrangler` now runs `wrangler dev` so local Worker development can be started with `pnpm run dev:wrangler` (or `npm run dev:wrangler`).

- Fixed READY TO SERVE CTA clickability in [public/index.html](public/index.html) by ensuring the section's decorative radial overlay cannot intercept pointer events and by elevating the section container above the pseudo-element.

- Cleaned launch-facing content in [public/features.html](public/features.html): removed the defensive "roadmap context" sentence and deleted internal build artifacts (capture checklist and Issue 1-8 status chips) from the public page.

- Made the Kitchen card preview image clickable in [public/features.html](public/features.html) so it opens the full screenshot in a new tab.

- Updated READY TO SERVE copy in [public/index.html](public/index.html) to remove "at restaurants" and increased `.waitlist-sub` font size by 50% for stronger launch emphasis.

- Updated live-state copy in [public/index.html](public/index.html) by removing "across Nashville" from the READY TO SERVE section sentence.

- Aligned [public/features.html](public/features.html) with the primary site brand system: switched to Playfair Display + DM Sans, replaced the dark blue visual theme with the cream/navy/gold palette, and converted feature/screenshot panels to light surfaces for a consistent launch presentation.
- Updated [public/.assetsignore](public/.assetsignore) to allow production screenshots (`kitchen-orders.png`, `admin-orders.png`, `order_review_sms.jpg`, `payment_received_sms.jpg`) in addition to `favicon.svg`, so features-page images render in local/prod asset serving.
- Removed waitlist-oriented homepage messaging in [public/index.html](public/index.html) for launch readiness by replacing nav/hero CTAs and the waitlist form block with live-state CTAs (`See Features`, `View Pricing`).

## 2026-05-13
- Hardened request throttling in [worker.js](worker.js) with an optional Cloudflare KV-backed rate limiter (`RATE_LIMIT_KV`) and automatic fallback to the existing in-memory limiter if KV is not configured or unavailable.
- Normalized Supabase campaign persistence in [worker.js](worker.js) back to `campaign: 'launch'` to stay aligned with the schema default and avoid reporting splits.
- Updated [developer/ci/validate-cloudflare-config.mjs](developer/ci/validate-cloudflare-config.mjs) to make Supabase project-ref enforcement environment-aware: it now validates only when `EXPECTED_SUPABASE_PROJECT_REF` or `EXPECTED_SUPABASE_PROJECT_REFS` is set.
- Added optional `RATE_LIMIT_KV` namespace placeholders to [wrangler.toml](wrangler.toml) so durable cross-isolate throttling can be enabled by swapping in real KV namespace IDs.
- Implemented Issue 1 page scaffold by adding [public/features.html](public/features.html) with canonical `/features` metadata, Open Graph/Twitter tags, and Product JSON-LD schema.
- Added canonical route handling for `/features` in [worker.js](worker.js) and updated sitemap output to include `/features`.
- Implemented Issue 2 hero in [public/features.html](public/features.html): final headline/subhead copy, CTA pair (`See pricing` + `Talk to us`), and a prominent voice-sample player using `public/media/dialtonemenu-order.mp3`.
- Added a hero voice selector UI shell (Warm/Upbeat/Refined) to support future multi-voice sample expansion without changing hero layout.
- Implemented Issue 3 in [public/features.html](public/features.html): added the full Section 1 "The phone never stops ringing. Neither does DialTone." narrative with the requested lunch-rush framing.
- Added equal-weight proof metric blocks (`<1 second`, `24/7`, `0 missed calls`) and a simple before/after missed-call visual panel to complete the right-column section layout on desktop and stacked mobile.
- Implemented Issue 4 in [public/features.html](public/features.html): added the full kitchen-handoff section copy plus three supporting proof cards (modifiers, allergen flags, real order numbers).
- Added a high-fidelity screenshot placeholder panel marked `replace-with-production-screenshot` with an order-card mock so layout can ship now and be replaced with a real kitchen screenshot before launch.
- Implemented Issue 5 in [public/features.html](public/features.html): added the full payment-flow section copy (`They tap. You're paid.`), payment methods row, and tip behavior callout.
- Added two production-style placeholders (`replace-with-production-screenshot`) for SMS receipt/pay-link and Stripe checkout visuals so we can continue buildout now and replace with real captures later.
- Implemented Issue 6 in [public/features.html](public/features.html): added the admin visibility section (`Every call, every order, every dollar - in one place.`) with supporting copy and three proof cards.
- Added a production-style admin dashboard placeholder panel (`replace-with-production-screenshot`) including KPI and order-table mocks so section structure is complete while waiting for final UI captures.
- Implemented Issue 7 in [public/features.html](public/features.html): added the configuration triad section (`Built for your menu. Your hours. Your voice.`) with full copy for voice selection, menu setup, and hours configuration.
- Added three production-style micro placeholders (`replace-with-production-screenshot`) so each configuration column can be swapped to real UI captures later without changing layout.
- Implemented Issue 8 in [public/features.html](public/features.html): added the low-emphasis roadmap section (`We ship constantly.`) and final conversion close (`Ready to pick up every call?`) with CTA pair.
- Replaced the old roadmap/final-CTA scaffold placeholder with a concrete replacement checklist section so remaining launch tasks are explicit (real screenshot swaps only).
- Replaced Issue 5 payment placeholders in [public/features.html](public/features.html) with real captures from [public/images/order_review_sms.jpg](public/images/order_review_sms.jpg) and [public/images/payment_received_sms.jpg](public/images/payment_received_sms.jpg).
- Updated payment card labels to `production-screenshot` and added descriptive image alt text for accessibility.

## 2026-04-28
- Updated the hero CTA text in `public/index.html` from "Go To Full Waitlist Form" to "Join the Waitlist" to match the requested landing-page copy.
- Removed underline styling from the shared primary CTA class in `public/index.html` so the hero "Join the Waitlist" button renders as a button instead of a default underlined link.

## 2026-04-23
- Added `robots.txt` at project root using the requested policy pattern.
- Allowed general crawling except `/admin/` and `/api/`.
- Blocked `GPTBot` completely.
- Added sitemap references for both DialTone and ByteStreams:
  - `https://dialtone.menu/sitemap.xml`
  - `https://bytestreams.ai/sitemap.xml`
- Added a ByteStreams-only robots template at `developer/bytestreams-robots.txt` for host-specific deployment on bytestreams.ai.
- Moved robots handling into `worker.js` via an explicit `/robots.txt` route so robots policy is no longer managed as a static asset.
- Route now emits host-specific sitemap values (`dialtone.menu` vs `bytestreams.ai`) and keeps `GPTBot` blocked.
- Added a lightweight Node test at `tests/robots.test.mjs` with `pnpm run test:robots` to validate:
  - DialTone host emits DialTone sitemap
  - ByteStreams host emits ByteStreams sitemap
  - `GPTBot` remains blocked
  - Non-robots paths still fall through to `env.ASSETS.fetch`
- Fixed routing bug where missing static paths could surface as 500.
- Worker now normalizes unmatched lookup failures to HTTP 404 for `GET`/`HEAD` when assets lookup throws or returns 500.
- Extended tests to cover missing-path cases like `/robot.txt` and `/favicon.ico` so regressions are caught quickly.
- Re-structured the Worker entrypoint into an explicit route-dispatch style (`routeRequest`) to keep known-path handling clear without removing existing behavior.
- Added explicit probe-path handlers in `worker.js`:
  - `/favicon.ico` returns `204 No Content`
  - `/.well-known/security.txt` returns a plaintext security contact policy
  - `/sitemap.xml` returns a direct `404` placeholder (no throw)
- Extended `tests/robots.test.mjs` to assert the new explicit route behavior.
- Addressed PR #8 review comments:
  - Added `try/catch` + 500-to-404 normalization in `handleFavicon` to avoid uncaught 500s on missing/misconfigured asset binding.
  - Removed dead `isKnownStaticPath` branch from `routeRequest` and kept a single explicit asset fallback path.
  - Added regression coverage to assert favicon lookup throws resolve to HTTP 404.
- Implemented a real `/sitemap.xml` route in `worker.js` for the public pages (`/`, `/privacy.html`, `/terms.html`) with `application/xml` responses.
- Updated `tests/robots.test.mjs` to validate sitemap XML content and confirmed the route suite still passes.
- Tightened `.assetsignore` so internal project files are not deployed as public assets (`.wrangler/`, `tests/`, `AGENTS.md`, `CLAUDE.md`).
- Tightened `.assetsignore` further so only `images/favicon.png` remains publicly deployed from `images/`; all other image files are now excluded.
- Excluded accidental root temp file `tmp-convo.md` after deploy output showed it was being published as a public asset.

## 2026-04-26 (Rebranding)
- **Rebranded entire website from old design (vermillion/ink palette, Fraunces fonts) to new design (navy/blue/gold palette, Playfair Display + DM Sans fonts)**
- Updated `public/index.html`:
  - Replaced complete landing page with new design from `docs/dialtone-landing.html`
  - Applied new color palette: Navy (#06234B), Blue (#1155CC), Gold (#E8A020), Cream (#FAF7F2), Warm (#F2EDE4)
  - Updated typography: Playfair Display (display), DM Sans (body/UI)
  - Preserved demo section with "Real Call. No Script." heading and play-button placeholder for audio (user to provide MP4/audio later)
  - Implemented scroll-reveal animations with IntersectionObserver
  - Updated form handling and signature validation
- Updated `public/pricing.html`:
  - Migrated color palette from --vermillion/--ink/--paper to --navy/--blue/--gold/--cream
  - Updated font imports from Fraunces/Instrument Sans to Playfair Display/DM Sans
  - Updated logo from multi-element structure to split "Dial<span>Tone</span>" with gold accent
  - Maintained pricing table structure and all content
  - Kept separate from main landing page navigation (no pricing link in nav)
- Updated `public/privacy.html` and `public/terms.html`:
  - Applied same color palette migration
  - Updated typography to new font stack
  - Updated logo styling to match new branding
  - Preserved all policy content with new visual design
- **Validated compatibility:**
  - ✅ Cloudflare Pages free tier supports audio files (25 MiB max per file, 20,000 files max, global CDN)
  - ✅ Supabase storage supports audio with global CDN delivery for future backend integration
- Bulk sed replacements to efficiently update all old color variable references across pages
- Follow-up polish for launch readiness:
  - Removed all public-facing `/pricing.html` links from `public/404.html`, `public/privacy.html`, `public/terms.html`, and the pricing footer itself so pricing is direct-URL only.
  - Deleted accidental `public/index.html.bak` backup file to prevent unintended public access to stale page content.

## 2026-04-26 (Waitlist Form & Supabase Integration)
- **Replaced simple email-only waitlist form with full contact form:**
  - Landing page now captures: Restaurant name, email, comment (optional)
  - Form submits to existing `/api/contact` Worker endpoint via async fetch
  - Updated form handler `handleClaimSpot()` with validation, loading states, and success/error responses
  - Form shows "Submitting..." during submission, "✓ Spot claimed!" on success
  - Auto-resets after 3 seconds to allow another submission
- **Extended Worker `/api/contact` handler with Supabase persistence:**
  - Now accepts name, email, comment (message) from form payload
  - Sends email via Resend (existing flow preserved)
  - Saves submission to Supabase `waitlist_submissions` table with created_at timestamp
  - Supabase save errors are logged but don't fail email response (graceful degradation)
- **Updated CSS for multi-field form layout:**
  - Changed `.waitlist-form` from inline flex to flex column layout
  - Added textarea styling with min-height: 80px, vertical resize allowed
  - Input and textarea share consistent padding (14px 18px), borders (1.5px), and focus colors
- **Added Supabase configuration to wrangler.toml:**
  - New var: `SUPABASE_URL` (example: https://your-project.supabase.co)
  - New secret: `SUPABASE_KEY` (set via `npx wrangler secret put SUPABASE_KEY`)
  - Included SQL schema example and Row Level Security (RLS) setup instructions in comments
  - Configuration is optional — submissions still email if Supabase env vars missing
- **Created new Worker helper function `saveToSupabase()`:**
  - POST to `{SUPABASE_URL}/rest/v1/waitlist_submissions` via PostgREST API
  - Sends: email, name, comment, created_at (ISO 8601 timestamp)
  - Uses Bearer token auth + apikey header for anonymous access with RLS policy
  - Returns parsed JSON on success or throws on HTTP errors
- **Executed Supabase setup helper successfully:**
  - Ran `./developer/supabase/setup-supabase.sh`
  - Linked Supabase project via `supabase link`
  - Uploaded Cloudflare Worker secret `SUPABASE_KEY` to worker `dawn-pine-d058`
  - Updated `wrangler.toml` `SUPABASE_URL` to `https://hltmzafywzqajjzjpqva.supabase.co`
- **Improved Supabase setup helper for multi-project reuse:**
  - Updated `developer/supabase/setup-supabase.sh` to prompt interactively for `SUPABASE_URL`, `SUPABASE_PROJECT_REF`, and `SUPABASE_ANON_KEY`.
  - Script now auto-loads existing `.env.supabase` values and uses them as prompt defaults.
  - Added project-ref auto-derivation from Supabase URL when possible.
  - Added docs updates in `developer/supabase/README.md` for prompt-based flow and optional non-interactive mode.
- **Supabase insert reliability hardening:**
  - Updated `worker.js` to prefer `SUPABASE_SERVICE_ROLE_KEY` for DB inserts and fallback to `SUPABASE_KEY`.
  - Added explicit log when Supabase save is skipped due to missing URL/secret.
  - Updated `developer/supabase/01_waitlist_schema.sql` with explicit grants and insert policies for both `anon` and `authenticated` roles.
  - Extended setup script to optionally prompt for and set `SUPABASE_SERVICE_ROLE_KEY`.
  - Updated setup README with remediation steps for "email sent but no DB row".
- **Contact API fail-fast behavior update:**
  - Updated `worker.js` so `/api/contact` now returns `503` when Supabase URL/DB key config is missing.
  - Updated `worker.js` so `/api/contact` now returns `502` when Supabase insert fails.
  - Insert now occurs before email send, so successful response implies a persisted DB row.
  - Added runtime health log booleans (`hasSupabaseUrl`, `hasSupabaseDbKey`, key source flags) for quick diagnosis.
- **Setup script UX polish:**
  - Added intro banner to `developer/supabase/setup-supabase.sh` to clearly announce mode/options and context.
  - Added exit banners for success, cancel (`130`), and generic failure states with next-step hints.
  - Changed `SUPABASE_ANON_KEY` prompt to visible input to avoid hidden-paste terminal issues.
  - Added confirmation summary screen (masked keys) with explicit user confirmation before applying changes.
  - Added required-field validation loops for project ref and anon key prompts.
  - Added `--yes` / `-y` flag to skip confirmation prompt for CI/scripted non-interactive runs; interactive confirmation remains default.
- **Site naming refinement:**
  - Changed default `SITE_NAME` from `DialTone` to `DialToneMenu` in runtime/local-dev config examples to keep future DialTone-branded sites distinguishable in contact-email subjects and sender display names.
- **Lead capture refinement:**
  - Split the public waitlist form into separate contact name and restaurant name fields.
  - Updated the Worker, outbound email formatting, and Supabase schema to persist both values distinctly.
  - Removed the duplicate hero form and replaced it with a CTA link that jumps to the bottom waitlist form to keep one clear submission path.
- **Hero polish test:**
  - Darkened the emphasized hero headline word color slightly for a closer match to the reference art direction; kept as a single-line CSS tweak for easy rollback.
- **Waitlist CTA polish:**
  - Added a gold `Join the Launch Team` line above the bottom waitlist form using the same gold token as key stat highlights.
  - Updated copy to `Join Our Launch Team` and switched it to the same Playfair headline style as `50 Restaurants.` at 50% scale.
- **Header brand polish:**
  - Updated the left header brand link text from `DialTone` to `DialToneMenu`, preserving the alternating color treatment via existing logo span styling.
- **Footer brand polish:**
  - Updated the footer brand text from `DialTone` to `DialToneMenu`, preserving the same alternating color treatment via existing logo span styling.
- **Legal pages brand polish:**
  - Updated header and footer branding in `public/privacy.html` and `public/terms.html` to `DialToneMenu` with the same alternating color treatment used on the landing page.
- **Header spacing/brand text polish:**
  - Normalized header brand text to `DialTone.Menu` across public pages while preserving the existing alternating color treatment on `Tone`.
- **CI/runtime compatibility fix:**
  - Aligned favicon route expectations to `images/favicon.svg` in `tests/robots.test.mjs` and synced stale `wrangler.toml` comments that still referenced `favicon.png`.
- **GitHub Actions deploy hardening:**
  - Added `developer/ci/validate-cloudflare-config.mjs` to fail fast when critical Cloudflare/Supabase config wiring drifts.
  - Added `pnpm run validate:deploy` script and inserted it before deploy in `.github/workflows/deploy.yml`.
  - Validation now checks for required deploy-secret wiring (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`), Worker Supabase fail-fast env usage, and core `wrangler.toml` values (`SUPABASE_URL`, assets binding, API passthrough).
  - Added strict Supabase project-ref enforcement so CI fails if `SUPABASE_URL` does not point to the expected project (`hltmzafywzqajjzjpqva`).
- **Production secret deployment:**
  - Created `developer/ci/deploy-prod-secrets.sh` to interactively prompt for and upload `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_KEY` to Cloudflare via `wrangler secret put`.
  - Script never writes secrets to disk, masks values in confirmation summary, validates at least one Supabase DB key is provided, and verifies the full secret list at the end.
  - Added `[secrets]` enforcement block to `wrangler.toml` declaring required secret names — Wrangler will warn on deploy if any are absent.
  - Added CI `Verify required Worker secrets exist in Cloudflare` step in `.github/workflows/deploy.yml` that runs `wrangler secret list` before deploy and fails if `RESEND_API_KEY` or both Supabase keys are missing.
  - Updated `validate-cloudflare-config.mjs` to assert `[secrets]` block and all three required secret names are present in `wrangler.toml`.
- **Campaign tracking default:**
  - Added `campaign` column to Supabase `waitlist_submissions` schema with `NOT NULL DEFAULT 'launch'`, including backfill for existing rows.
  - Updated `worker.js` insert payload so form submissions persist `campaign: 'launch'` server-side without any frontend field changes.
- **Secret deploy script exit handling fix:**
  - Updated `developer/ci/deploy-prod-secrets.sh` to show success only when the full upload/verification flow completes.
  - Added signal traps and explicit completion state so interrupted runs (Ctrl+C/termination) show `Process terminated without completion` instead of a success banner.
  - Changed secret prompt input mode to visible by default to avoid terminals that appear unresponsive in hidden-entry mode; added optional `--hide-input` flag when hidden entry is preferred.
  - Added immediate per-field confirmation output in masked form (`Value Entered: xxxx...xxxx`) after each secret input is captured.

- **Post-update review pass:**
  - Confirmed landing page now uses one canonical submission form at the bottom waitlist section with the hero using a CTA link.
  - Confirmed DB schema + Worker + UI are aligned on separate `name` and `restaurant_name` values.
  - Corrected historical behavior note: contact flow no longer uses graceful degradation for DB persistence; it is now fail-fast (`503` on missing config, `502` on insert failure).
  - Updated `wrangler.toml` Supabase comments to match current fail-fast behavior and include `restaurant_name` in the schema snippet.

## 2026-04-27 (PR #23 Merge and Project Sign-off)
- Merged PR #23 (`feat/rebrand`) after addressing review findings and resolving branch conflicts.
- Removed sensitive files from repository history (`.env.supabase`, `supabase/.temp/`) and force-updated branch during remediation.
- Added and retained `/api/contact` per-IP rate limiting using `CF-Connecting-IP` to reduce abuse risk against Resend quota.
- Validated production end-to-end flow:
  - Waitlist submission accepted in production.
  - Resend email sent and received successfully.
  - Supabase row insert verified in production.
- Marked the project implementation complete and ready for operational maintenance mode.

## 2026-04-28
- Updated Supabase waitlist insert payload in `worker.js` to persist `campaign: 'Menu Launch'` instead of `campaign: 'launch'`.
