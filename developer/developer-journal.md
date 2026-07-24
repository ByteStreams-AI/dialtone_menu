# Developer Journal

## 2026-07-23

- Updated pricing tiers in [public/pricing.html](public/pricing.html): Food Truck monthly price from `$99` to `$149`, and Single Location monthly price from `$199` to `$249`.
- Added an Expo-focused feature bullet to the Multi-Location tier list in [public/pricing.html](public/pricing.html).
- Added a Fire/Hold + Coursing feature bullet to the Enterprise tier list in [public/pricing.html](public/pricing.html).
- Updated the pricing summary line in [public/pricing.html](public/pricing.html) to read: "No setup fees. No annual contracts. No hardware. No per-minute charges."
- Reordered the pricing summary sentence in [public/pricing.html](public/pricing.html) so "Plus a small 1.5% fee only on the orders we bring you." appears before the bold no-fees/no-contracts clause.
- Added a sitewide top-nav `BOOK A CALL` link (first item in each `nav-right` block) across all public HTML pages, pointing to [public/index.html](public/index.html) `/#contact`; updated its color token to `#E8A020` for consistent placement and color.
- Removed the homepage testimonial block (`In Their Words`) from [public/index.html](public/index.html) so the page now transitions directly from the demo section into `Who It's For`.

## 2026-06-09

- Replaced the kitchen handoff preview in [public/features.html](public/features.html) from `kitchen-orders.png` to the production video [public/media/kitchen-order.mp4](public/media/kitchen-order.mp4), using an inline `<video>` player with controls for direct in-page playback.
- Confirmed media assets are not excluded by ignore rules: [.gitignore](.gitignore) does not block `.mp4`, and [public/.assetsignore](public/.assetsignore) only scopes image exclusions.

## 2026-06-06

- Updated the homepage hero headline in [public/index.html](public/index.html) to the requested four-line copy: `Your phone, your orders, your tables.` with the blue emphasis changed to `All on one screen.` for cleaner visual separation in the hero.
- Updated [public/index.html](public/index.html) hero emphasis styling so `All on one screen.` now uses `var(--gold)`, matching the `Tone` brand accent color in the logo.
- Updated the homepage step icon in [public/index.html](public/index.html) from a printer to a monitor to better match the kitchen-screen workflow visual.
- Repositioned the demo playback button in [public/index.html](public/index.html) to the upper third of the media frame (with a mobile adjustment) so it no longer overlaps on-screen copy/subtitles.
- Fine-tuned the demo playback button position/size in [public/index.html](public/index.html) to sit higher (top-quarter) with a slightly smaller control, preventing overlap with centered hero text in the demo thumbnail.
- Updated [public/index.html](public/index.html) hero emphasis typography so `All on one screen.` is forced onto a single line with a slightly reduced size for better fit.
- Adjusted the pricing hero lede in [public/pricing.html](public/pricing.html) to a slightly smaller size and wider measure so the flat-price paragraph fits on two lines.
- Removed the extra outer nav inset in [public/pricing.html](public/pricing.html) so the DialTone.Menu logo lines up with the hero headline column.
- Normalized pricing tier description height in [public/pricing.html](public/pricing.html) so the headline values (`$0`, `$149`, `$279`, `Let's talk`) align on the same horizontal row.
- Commented out the `Basic analytics & weekly summary` Pro-tier feature line in [public/pricing.html](public/pricing.html) per request.
- Reordered homepage sections in [public/index.html](public/index.html) so the Book a Call/contact block appears between Who It's For and Ready to Serve.
- Standardized top navigation format across [public/index.html](public/index.html), [public/features.html](public/features.html), [public/pricing.html](public/pricing.html), [public/privacy.html](public/privacy.html), [public/terms.html](public/terms.html), and [public/404.html](public/404.html) so each page links to the other site pages while excluding itself.

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
- Updated [public/features/admin.html](public/features/admin.html) hero media to a manual click-arrow slideshow using `admin-view01-v2.jpg` through `admin-view04-v2.jpg`.
- Added lightweight inline slideshow styling and script with previous/next controls and a `1 / 4` counter.
- Fixed slideshow asset publishing by allowlisting the four admin screenshots in [public/.assetsignore](public/.assetsignore) so images resolve in deployed/static asset mode.
- Improved slideshow controls in [public/features/admin.html](public/features/admin.html) with stronger arrow layering (`z-index`) and keyboard navigation support (left/right arrows when slideshow is focused).
- Added per-slide open-in-new-tab support in [public/features/admin.html](public/features/admin.html) by wrapping the active screenshot in a `_blank` link that updates as the slideshow advances.
- Replaced the first admin feature-row placeholder in [public/features/admin.html](public/features/admin.html) with the real orders demo video source [public/media/admin-orders-v2.mp4](public/media/admin-orders-v2.mp4) using `type="video/mp4"`.
- Added explicit fullscreen fallback controls for admin videos in [public/features/admin.html](public/features/admin.html) (`⤢` button) using `requestFullscreen` with WebKit fallbacks for browsers where native video fullscreen controls are unreliable.
- Updated analytics video source in [public/features/admin.html](public/features/admin.html) from `admin-analytics-01.webm` to [public/media/admin-analytics-v2.mp4](public/media/admin-analytics-v2.mp4) with `type="video/mp4"`.
- Replaced the settings placeholder at [public/features/admin.html](public/features/admin.html) with a manual image slideshow using [public/images/admin-settings01-v2.jpg](public/images/admin-settings01-v2.jpg) through [public/images/admin-settings06-v2.jpg](public/images/admin-settings06-v2.jpg).
- Refactored slideshow JavaScript in [public/features/admin.html](public/features/admin.html) into a reusable initializer so both the hero admin slideshow and settings slideshow share arrow controls, keyboard navigation, counter updates, and open-in-new-tab behavior.
- Allowlisted the six `admin-settings*-v2.jpg` assets in [public/.assetsignore](public/.assetsignore) so they deploy correctly.
- Updated the Kitchen Command System card copy in [public/features.html](public/features.html) to explicitly describe KDS, BDS, and Expo roles in the operational flow.
- Reworked [public/features/command.html](public/features/command.html) to present three dedicated sections in order (KDS, BDS, Expo) with focused operational copy for each workflow.
- Removed the hero MP4 from [public/features/command.html](public/features/command.html) and switched that hero to a centered single-column layout using a new `feature-hero-centered` style modifier in [public/css/site.css](public/css/site.css).
- Left-aligned the centered hero paragraph on [public/features/command.html](public/features/command.html) via the `.feature-hero-centered .lead` rule in [public/css/site.css](public/css/site.css).
- Replaced the Expo placeholder panel in [public/features/command.html](public/features/command.html) with a manual slideshow cycling [public/images/expo01-v2.jpg](public/images/expo01-v2.jpg) through [public/images/expo03-v2.jpg](public/images/expo03-v2.jpg), including arrow controls, keyboard navigation, counter, and open-in-new-tab behavior.
- Allowlisted Expo slideshow assets in [public/.assetsignore](public/.assetsignore) so the three images are served in deployed static-asset mode.
- Replaced the KDS section media in [public/features/command.html](public/features/command.html) from a static image to an inline player using [public/media/kds-v2.mp4](public/media/kds-v2.mp4).
- Updated the BDS image block in [public/features/command.html](public/features/command.html) so the screenshot opens in a new tab for enlarged viewing.
- Updated [public/features/pos-staff.html](public/features/pos-staff.html) to remove the hero media/image block under "Your whole POS. In a server's pocket." and center that hero section.
- Updated the "Check splitting has never been easier." copy in [public/features/pos-staff.html](public/features/pos-staff.html) to include "tap to pay or cash" and added a UI list line: "Tap to pay at table".
- Removed the full "Take the payment at the table — one tap." and "Print the receipt on the spot." sections from [public/features/pos-staff.html](public/features/pos-staff.html).
- Left-justified the header paragraphs in [public/features/pos-staff.html](public/features/pos-staff.html) while preserving the centered hero section layout.
- Replaced the split-check media placeholder in [public/features/pos-staff.html](public/features/pos-staff.html) with [public/media/staff-pos-splitcheck.mp4](public/media/staff-pos-splitcheck.mp4).
- Added a page-specific top-alignment style for the split-check and handoff sections in [public/features/pos-staff.html](public/features/pos-staff.html) so the heading column and media top line up horizontally.
- Replaced the "One check, open all night — then hand it off." placeholder with [public/media/suis-sushi-checkout.mp4](public/media/suis-sushi-checkout.mp4).
- Tightened the POS row alignment in [public/features/pos-staff.html](public/features/pos-staff.html) with a small top offset on the media column so the headings and MP4 frames visually line up more cleanly.
- Updated the "One check, open all night — then hand it off." section in [public/features/pos-staff.html](public/features/pos-staff.html) to use [public/media/staff-pos-rounds.mp4](public/media/staff-pos-rounds.mp4).
- Added a new loyalty-focused section to [public/features/pos-staff.html](public/features/pos-staff.html) describing how allergy flags, last orders, and aggregate order data are shown to servers as soon as guests are seated.
- Replaced the loyalty profile placeholder media in [public/features/pos-staff.html](public/features/pos-staff.html) with [public/media/staff-pos-guest.mp4](public/media/staff-pos-guest.mp4).
- Normalized all MP4 blocks in [public/features/pos-staff.html](public/features/pos-staff.html) to the same phone-media sizing/style pattern used in [public/features/app.html](public/features/app.html) by switching rows to `.feature-row-media.is-phone` with inline autoplay loop video markup.
- Staged currently unreferenced runtime assets into [public/_temp_unused_asset_review_2026-07-23](public/_temp_unused_asset_review_2026-07-23) (split into `images/` and `media/`) for manual inspection before any permanent removal; added a move manifest at [public/_temp_unused_asset_review_2026-07-23/MOVED_FROM_UNUSED_SCAN.txt](public/_temp_unused_asset_review_2026-07-23/MOVED_FROM_UNUSED_SCAN.txt).
- During review, restored analytics-related media assets from the temp folder back to [public/media](public/media): `admin-analytics-01.webm`, `admin-analytics-kitchen.mp4`, `admin-analytics-loyalty.mp4`, `admin-analytics-orders.mp4`, and `admin-analytics-sales.mp4`.
- Centered the Analytics page hero section in [public/features/analytics.html](public/features/analytics.html) using the same single-column header pattern as the POS staff page and removed the hero media placeholder block.
- Replaced the "Sales and orders over time." media placeholder in [public/features/analytics.html](public/features/analytics.html) with [public/media/admin-analytics-sales.mp4](public/media/admin-analytics-sales.mp4).
- Replaced the "Your busiest days and hours." media placeholder in [public/features/analytics.html](public/features/analytics.html) with [public/media/admin-analytics-orders.mp4](public/media/admin-analytics-orders.mp4).
- Replaced the "New faces and regulars." media placeholder in [public/features/analytics.html](public/features/analytics.html) with [public/media/admin-analytics-loyalty.mp4](public/media/admin-analytics-loyalty.mp4).
- Updated the final Analytics section in [public/features/analytics.html](public/features/analytics.html) to kitchen-performance messaging (cook time, fire-to-table, pass timing, station load) and added a "Coming soon" bullet for menu-item cook-time analytics.
- Replaced the final kitchen-performance media placeholder in [public/features/analytics.html](public/features/analytics.html) with [public/media/admin-analytics-kitchen.mp4](public/media/admin-analytics-kitchen.mp4).
- Refactored [public/features/kiosk.html](public/features/kiosk.html): removed the hero media panel, centered the hero layout with left-aligned paragraph/list text, moved the "Ordering guests actually enjoy." paragraph and list into the hero, removed all other detail sections, and added one standalone image placeholder section directly below the header.
- Added two new kiosk hero list bullets in [public/features/kiosk.html](public/features/kiosk.html) for (1) Tap to Pay/cash checkout options and (2) dynamically updated menu data from the live catalog.
- Replaced the kiosk standalone placeholder section in [public/features/kiosk.html](public/features/kiosk.html) with [public/images/kiosk-home.jpg](public/images/kiosk-home.jpg) and allowlisted that asset in [public/.assetsignore](public/.assetsignore).
- Added [public/images/admin-orders-v2.jpg](public/images/admin-orders-v2.jpg) (created from the existing admin hero screenshot set) and appended it to the Admin hero slideshow in [public/features/admin.html](public/features/admin.html); updated the hero counter to `1 / 5` and allowlisted the asset in [public/.assetsignore](public/.assetsignore).
- Corrected placement in [public/features/admin.html](public/features/admin.html): removed `admin-orders-v2.jpg` from the hero slideshow and inserted it in the Calls/Reservations feature row media slot (around line 206 context), restoring the hero slideshow counter to `1 / 4`.
- Updated that Calls/Reservations image in [public/features/admin.html](public/features/admin.html) to open in a new tab when clicked.
- Removed currently unused files under [public](public): deleted `public/images/admin-orders-v2.jpg`, `public/media/admin-analytics-01.webm`, `public/media/.wrangler/cache/cf.json`, and removed the temporary review stash directory `public/_temp_unused_asset_review_2026-07-23/` after final inspection.

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
