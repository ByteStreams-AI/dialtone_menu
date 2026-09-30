# PRD — DialTone Social

**Product:** Automated Instagram content pipeline for dialtone.menu
**Owner:** Steve Cotton / ByteStreams LLC
**Repo:** `dialtone_menu` (isolated Worker — see §7.1)
**Date:** 2026-09-13
**Status:** Draft v1 — pending review

---

## 1. Overview and Objectives

DialTone Social is an internal marketing system that keeps the dialtone.menu Instagram account posting consistently — Reels, image/carousel posts, and Stories — without Steve hand-publishing each one.

It is **not** a content generator bolted onto a scheduler. The reusable asset here is a **content bank with a calendar in front of it**: produced video lives in a library, Claude drafts the words around it under the brand rules already written down in `notes/projects/dialtone/`, a human approves, and a cron Worker publishes through Blotato at the scheduled slot.

### 1.1 Why this exists

Social is not a discovery channel for this business. `insta_hashtags.md` already states the real job plainly: hashtags don't drive reach on Instagram anymore, and the account's function is **verification** — an operator who saw a cold call, a Google ad, or a demo lands on the profile and decides in about four seconds whether this is a real restaurant company or another vendor. An account with three posts from May fails that check.

**Current state (verified 2026-09-13):** [@dialtone.menu](https://www.instagram.com/dialtone.menu/) has **1 post, 1 follower, 2 following**, and has been silent for **17 days** — the last post is dated 2026-08-27 and appears to be the food-truck spot. The bio reads *"Every Order: phone, counter, kiosk, or table - lands on one screen as one ticket. And the phone answers itself."*

This is exactly the failure mode above: an operator who clicks through from a cold call today finds a one-post grid. The system's first job is therefore not cadence — it is a **grid** (§11, M4a).

So the objective is **credible consistency**, not virality:

| Objective | Measure | Target (90 days post-launch) |
|---|---|---|
| The profile never looks abandoned | Days since last post, measured daily | ≤ 3 days, 95% of days |
| Publishing costs Steve near-zero time | Minutes/week in the approval queue | ≤ 30 min/week |
| Content matches the positioning doc | Guardrail violations reaching Instagram | 0 |
| Social verifies the sales motion | Profile visits within 48h of a cold call | Tracked, no target v1 |

**Explicit non-goal:** follower growth. A vanity metric here would push the content toward consumer-food posts, which is the exact category the positioning doc spends §6 excluding.

### 1.2 The hard constraint

**This project must have zero impact on the dialtone.menu website.** The live Worker `dawn-pine-d058` serves the marketing site, every branded tenant menu at `<slug>.m.dialtone.menu`, and the order/payment flow. `AGENTS.md` in that repo documents three separate incidents where a routing or config change silently broke live menus while deploys showed green. DialTone Social gets its own Worker, its own config file, its own deploy workflow, and no route on the `dialtone.menu` zone. §7.1 specifies how.

---

## 2. Audiences

Two distinct audiences, and conflating them is the main way this product goes wrong.

### 2.1 Content audience — the restaurant operator

From `bytestreams-positioning-and-taglines.md` §2 and the food-truck material in `conent-bank-notes.md`:

- Independent restaurant owners and small chains (1–5 locations)
- Food truck owners and operators — a distinct, high-value segment; `#FoodTruckLife` / `#FoodTruckOwner` are genuinely operator-populated rather than diner-populated
- **National.** The sales motion is national cold calling; Nashville is where the company sits, not the market it sells to. An operator evaluating the profile could be anywhere in the US, so content must never assume a region
- Front-of-house managers and GMs who feel the phone problem directly

What they need to hear (positioning doc §5, cold-prospect row): **the wedge first** — the specific pain — not the platform story. "AI answers your restaurant's phone so your staff can stay on the floor," not "agentic workflows."

**Note on the bio.** The current bio is the *consolidation* message — "every order lands on one screen as one ticket." Per positioning doc §5 that is warm-prospect language, aimed at someone who already knows what DialTone does. A cold prospect arriving from an ad or a cold call needs the wedge first. Worth a decision (§15 #6); out of scope for the pipeline itself.

### 2.2 System operator — Steve

Single user, authenticated through the Cloudflare Access SSO already on `bytestreams.info`. Needs: see the month at a glance, approve or kill a draft in a few seconds on a phone, drop a new MP4 into the library without ceremony, and never wonder whether something posted.

---

## 3. Content Model

### 3.1 The five pillars

Derived from the existing material, not invented for this document. Each pillar has a fixed source, a default format, and a cadence.

| # | Pillar | What it is | Source material | Default format | Cadence |
|---|---|---|---|---|---|
| **P0** | **Positioning** | What DialTone is, who it's for, and the ask — the "what we're about" content, including the pinned intro | Positioning doc taglines, `public/index.html`, `features/*.html`, brand cards | Carousel, image, Story | 1×/week, **front-loaded at launch** |
| **P4** | **Product proof** | The DialTone app itself — screens, flows, the thing working | `public/media/*.mp4` (12 clips), app screenshots (§F1.1) | Reel, image, carousel | **3×/week** |
| **P6** | **Customer proof** | Real operators running real service on DialTone — the businesses, their brands, their surfaces | Shortys (restaurant) and Diner On The Go (food truck). **T1 relationship consent held; T2 personal consent not held** (§6.7) | Reel, carousel, image | **1×/week** |
| **P1** | **Operator education** | Running a truck or a restaurant better — profitability, prep levels, waste, speed of service, staffing | `conent-bank-notes.md` (menu-design-for-speed, KYN/know-your-numbers daily, prep-from-data, waste) | Story, carousel | 1–2×/week |
| **P2** | **Menu engineering** | What to promote, what to cut, what sells with what, pricing psychology | DialTone analytics concepts — top items, "sold with" affinity, hour-of-week heatmap, per-item day trends | Carousel, Story | 2×/month |
| **P3** | **Cost evaluation** | The money math — missed-call revenue, labor-hour cost, marketplace commission vs. flat 1.5% | `pricing.html`, `entitlements.ts` (`platform_fee_bps` default 150), `dialtone-pricing-model.xlsx` | Carousel, Reel | 2×/month |
| **P5** | **Brand / pain point** | The produced spots | `commercials/*.mp4`, the two shooting scripts, the video production blueprint | Reel | 2×/month |

**P4 carries the calendar — at least 60% of all posts.** This is a product account: images and Reels of the DialTone app are the majority of what ships. Everything else is supporting cast.

**The invariant:** product share ≥ 60% over any rolling 14-day window, enforced by the planner (§F3), not merely implied by the slot template. A template drifts; an invariant doesn't.

**Product share counts P4 + P6.** A real operator running a real shift on DialTone is product content of the highest grade — it is the same evidence as a screenshot, with a named human behind it.

**P6 never blocks the calendar.** Every P6 slot has a P4 fallback that fires automatically when no consented asset is available (§F3). Consent arriving late slows the pillar, never the cadence.

**P6 is the most valuable pillar and the most constrained.** For a national cold-call motion, "a food truck in Maryland runs its whole service on this" outperforms any feature post, because it answers the only question a skeptical operator actually has: *does anyone real use this?* It is capped at 1×/week not by preference but by supply — there are two operators, and over-posting them reads as having only two customers, which is the impression to avoid. Every P6 post requires written consent (§6.7).

**The risk this creates, and how §3.1.1 answers it.** Four product posts a week is the volume at which an account reads as a vendor feed — the precise category positioning doc §6 exists to escape. Volume alone doesn't cause that; *sameness* does. Four "here's a screen" posts a week is a brochure. Four posts showing four different operator outcomes is a product working. The sub-type rotation below is what keeps them distinct, and it is a requirement, not a suggestion.

**P1 remains the floor.** Even at reduced cadence it is the pillar that makes the account read as a restaurant company rather than a software company, and it is the only pillar that needs no footage — which is what lets the planner always fill a slot (§F3).

**P3 and P2 carry the most claim risk** — see §6.2.

### 3.1.1 P4 sub-types (required rotation)

P4 is not one thing repeated. Each post is tagged with a sub-type, and **the planner may not schedule the same sub-type twice within any 7-day window.**

| Sub-type | What it shows | Typical format | Example from the existing library |
|---|---|---|---|
| `feature_spotlight` | One capability, one screen, one sentence of what it saves | Image, carousel | `admin-analytics-sales` — the hour-of-week heatmap |
| `workflow_walkthrough` | A task end to end, 15–30s | Reel | `staff-pos-splitcheck` — split the check by seat |
| `call_to_ticket` | The voice agent taking an order → the ticket appearing on the KDS | Reel | Needs a **consented recording from a live tenant**, or a fresh recording made against staging with a ByteStreams caller. The `als-place-order` demo recording is **not** to be used |
| `before_after` | The manual way vs. the DialTone way, side by side | Carousel, Reel | Paper tickets vs. `admin-orders-v2` |
| `detail_shot` | One small, well-made piece of UI — the thing that says someone cared | Image | Floor-plan fixtures, branded menu templates |
| `real_surface` | What the *guest* sees — public menu, app, kiosk | Image, Reel | `suis-sushi-checkout`, `suis-sushi-reservations` |

**Caption rule for every P4 post:** lead with the operator outcome, not the feature name. "Your closer stops counting singles at 11pm" before "split-check settlement." The screen is the evidence; the outcome is the post. A P4 caption that names a feature in its first sentence fails the voice check (§6.4).

### 3.2 Existing asset inventory

**Produced spots** — `/home/scotton/dev/notes/projects/dialtone/commercials/`:

| File | Pillar | Notes |
|---|---|---|
| `DialTone_missed_calls.mp4` | P5 | Cut per `missed_calls_script.txt` — 5 shots, 20s, "Slammed Staff = Lost Revenue" |
| `DialTone_missed_calls_prod.mp4` | P5 | Production cut of the above |
| `DialTone_food_truck_01.mp4` | P5 | Per `food_truck_script_01.txt` — empty lot → geo-blast → line out the window |
| `dialtone_foodtruck_001_insta.mp4` | P5 | Instagram-formatted cut. **Already published 2026-08-27** — the account's only live post. Ingest with a backdated `published` row so reuse tracking is accurate |
| `cat-cant-answer.mp4` | P5 | Short-form / humor register |

**Product footage** — `dialtone_menu/public/media/` (12 clips): `kds-v2`, `staff-pos-splitcheck`, `staff-pos-rounds`, `staff-pos-guest`, `suis-sushi-checkout`, `suis-sushi-reservations`, `admin-orders-v2`, `admin-analytics-{sales,orders,kitchen,loyalty,v2}`. These already back the features pages, so they are known-good and on-brand.

**Real operators (P6)** — the two live tenants, both requiring written consent before any use (§6.7):

| Operator | Type | Location | Assets on hand |
|---|---|---|---|
| **Shortys** | Restaurant | — | `shortys_branding_pack/` (logo, favicons, SVG), `shortys-images/` (hero, blackened redfish, chicken & waffles), full brunch + dinner menus |
| **Diner On The Go** | Food truck | Orenton, MD | `diner-on-the-go.md` — brand colors (`#D26249` / `#3C6E47`), full menu, catering formats (drop-off, pop-up, full-service). **T1 only:** the owner names and founding story in that file are **not cleared for use** pending T2 consent (§6.7) |

Diner On The Go is the more valuable of the two for content, because the food-truck segment is where `#FoodTruckLife` and `#FoodTruckOwner` are genuinely operator-populated (§6.1). Under T1 alone it still carries a full pillar — the truck, the brand, the menu, the ordering surface, and the plain fact that a working food-truck business runs its service on this. The founder story would strengthen it and is worth pursuing, but nothing is blocked without it.

**Not for use:** the `als-place-order.wav` / `.vtt` recording is a demo against a fictional restaurant. It does not represent a real operator and is excluded from all content.

**Motion-graphic templates:** `dialtone-channels.html`, `dialtone-order-flow.html`, `dialtone-order-flow-vertical.html` — brand-tokenized (`--gold:#E8A020`, `--ink:#14264B`), with a `[data-theme="key"]` chroma-key mode at `#00B140` for OBS compositing, and a vertical variant already built for 9:16. §5.6 turns these into an automated render path.

**Brand assets:** `dialtone-logo-transparent.png`, `dialtone-logo-trimmed.png`, `dialtonemenu-sm/instagram-{square,portrait}.png`.

### 3.3 Formats

| Format | Spec | Blotato `targetType` |
|---|---|---|
| Reel | 9:16, 1080×1920, 15–30s, ≤ 90s hard cap | `reel` |
| Feed image | 1:1 (1080×1080) or 4:5 (1080×1350) | `image` |
| Carousel | 2–10 images, consistent ratio | `carousel` |
| Story | 9:16, image or ≤15s video | `story` |

---

## 4. Scope

### 4.1 In scope (v1)

- **Instagram** — [@dialtone.menu](https://www.instagram.com/dialtone.menu/), the product's own account (not the ByteStreams parent account)
- **Facebook** — [DialTone Menu](https://www.facebook.com/profile.php?id=61591570856435), a Page (confirmed 2026-09-13), so Graph API publishing is available — see §4.4
- Reels, feed images, carousels, Stories
- Claude-drafted captions, hooks, hashtags, and Story card copy
- Media library with ingest, metadata, and reuse tracking
- Approval queue — nothing publishes unreviewed
- Calendar UI in `bytestreams.info` with drag-to-reschedule
- Google Calendar mirror of the approved schedule
- Publishing and scheduling via Blotato
- Brand guardrail enforcement (§6)
- Publish-result recording and failure alerting

### 4.2 Out of scope (v1)

- **Per-restaurant tenant accounts.** This is ByteStreams' own account. Tenant-facing social is a different product with OAuth, entitlements, and per-tenant consent — noted in §13.
- **Platforms beyond Instagram and Facebook.** Blotato also supports TikTok, Threads, LinkedIn, Pinterest, YouTube, Bluesky, and X. The data model is platform-agnostic (§8) so adding one is config, not a rewrite — but v1 ships the two accounts that exist.
- **All generated video** — AI video models and Blotato's `/videos/from-templates` alike. Every video that publishes is a clip a human produced and ingested. The Maître D' spots depend on master-portrait face-swap for character consistency, which no generator preserves, and template-motion video would dilute a grid whose credibility is the entire point (§1.1). `needs_media` is the honest signal that the library is thin; template video would hide it.
- **Comment and DM handling.** Blotato exposes `/comments` and `/dm-automations`; auto-replying to an operator's comment is a sales conversation, not a content task. §13.
- **Paid promotion.** Organic only.
- **Analytics dashboards.** v1 records what published and what failed; engagement reporting is §13.

### 4.4 Facebook — prerequisite and cross-posting rules

**Confirmed a Page** (2026-09-13), so Graph API publishing is available — a personal profile could not have been published to at all, by Blotato or anything else.

Blotato needs the Page's `pageId`, fetched once from `GET /users/me/accounts/{accountId}/subaccounts` and stored in config. `target.pageId` is required on every Facebook post; its absence fails at publish time rather than at validation, so record it during M0 and assert its presence in the publisher's pre-flight check.

**Cross-posting is not mirroring.** A post is generated once per pillar and adapted per platform — same idea, different register:

| | Instagram | Facebook |
|---|---|---|
| Caption length | Short, hook-led, ≤ 2,200 | Longer form tolerated and rewarded; a 3-paragraph P1 tip performs where IG would truncate it |
| Hashtags | 3–5, anchor pair required (§6.1) | **None.** Hashtags do nothing on Facebook and read as imported Instagram content |
| Links | Not clickable in caption — "link in bio" | **Clickable.** P3 cost-evaluation posts should link to `dialtone.menu/pricing.html` |
| Stories | Core format (P1 carries the calendar) | Supported but low-value — skip in v1 |
| Best-fit pillars | All five | P1, P2, P3 especially — operator-education text performs better here than on IG |

**Why Facebook may matter more than Instagram for this ICP.** Independent restaurant owners and food-truck operators skew heavily to Facebook, and local food-truck location posting happens in Facebook Groups. Instagram is the verification surface; Facebook is closer to where the audience actually is. The clickable link alone makes P3 measurably more useful there.

Groups posting is explicitly **out of scope** — it's relationship work, not automation, and posting vendor content into an operator group unprompted is the fastest way to burn the account.

### 4.3 Non-goals, stated as prohibitions

- No change to `worker.js`, `wrangler.toml`, `deploy.yml`, or `run_worker_first` in the dialtone.menu site Worker
- No Worker Route on the `dialtone.menu` zone
- No new binding, secret, or var on `dawn-pine-d058`
- No shared KV namespace with production rate limiting

---

## 5. Features

### F1 — Media Library and Ingest

**What:** A registry of every publishable asset, with the metadata needed to schedule it without a human re-watching it.

**Behavior:**
- Assets live in a Supabase Storage bucket, `social-media-assets`
- Ingest is a CLI script (`social/ingest.mjs`) run from a checkout: it takes a local path, probes the file, uploads it, and inserts a `media_assets` row
- Probing captures duration, width, height, and audio presence via `ffprobe`
- Aspect ratio is derived and validated against the target format — a 16:9 clip registered as reel-eligible is rejected at ingest, not at publish
- Operator supplies pillar, title, and optional notes; everything else is derived
- `used_in_post_ids` accumulates so the scheduler can avoid re-posting the same clip within a configurable window (default 60 days)

**Acceptance criteria:**
1. `node social/ingest.mjs --file ./DialTone_missed_calls_prod.mp4 --pillar P5 --title "Missed calls"` uploads and registers the asset, printing the new `media_assets.id`
2. Ingesting a file whose aspect ratio is not 9:16 with `--formats reel` fails with a message naming the actual ratio
3. Re-ingesting an identical file (same SHA-256) updates the existing row rather than creating a duplicate
4. An asset with `used_in_post_ids` containing a post published within the reuse window is excluded from automatic selection but remains manually selectable

**Technical considerations:**
- `ffprobe` is a local dev dependency for ingest only — the Worker never processes video
- SHA-256 of file bytes is the dedupe key, stored as `content_hash`
- Storage bucket is private; Blotato receives a time-limited signed URL at publish (§F6)
- The five commercials and twelve product clips are ingested once as part of M1 seeding

#### F1.1 — App screenshot capture

P4 at 4×/week consumes still images faster than anyone will produce them by hand, and hand-grabbed screenshots go stale every time the UI ships. So capture is scripted.

**Behavior:**
- A Playwright script (`social/capture.mjs`) drives the **staging and demo environments** — `admin-staging.dialtone.menu`, `kitchen-staging.dialtone.menu`, and `<slug>.demo.dialtone.menu` — through a list of named surfaces, capturing each at both 1080×1350 (4:5) and 1080×1920 (9:16)
- Each capture is registered as a `media_assets` row with `pillar = 'P4'`, its sub-type, and the surface name
- Re-running after a UI change produces new assets; the old ones are marked `is_active = false` rather than deleted, so a published post's media is never invalidated retroactively
- Surfaces are declared in a manifest — adding one is a config line, not code

**Seed surface list:** KDS board, beverage/bar board, order history, order drill-down, Analysis sales tab, Analysis menu tab + heatmap, reservations timeline, spatial floor plan, POS check + split, public menu (each of `standard`/`lacquer`/`cards`), branded menu subdomain, customer app menu + cart, loyalty balance, kiosk.

**Acceptance criteria:**
1. `node social/capture.mjs --surface kds` produces both aspect ratios and registers two `media_assets` rows
2. A capture run against a **production** host fails immediately and loudly (§6.6)
3. Re-capturing a surface deactivates the prior asset without breaking any post that already used it
4. Every captured asset carries its surface name and P4 sub-type

**Technical considerations:**
- Playwright runs locally or in GitHub Actions — never in the Worker
- The demo Worker (`dialtone-menu-demo`) deploys from `main` only, so what it serves is release state, not a work-in-progress branch. That is exactly what makes it safe to screenshot — the preview Worker, which any branch can overwrite, is not
- Seeded staging tenants (Sui's Sushi, Rival Ramen) give realistic-looking content with no real customer in it

---

### F2 — Content Generation (Claude)

**What:** Claude drafts the copy around a chosen pillar and, where relevant, a chosen asset.

**Behavior:**
- Invoked by the planner (F3) or on demand from the calendar UI ("draft one for Thursday")
- Input: pillar, format, target date, the asset (if any), the brand guardrail pack, and the last 30 published captions (for repetition avoidance)
- Output: a structured draft — hook, caption body, hashtags, Story card copy where applicable, and a one-line rationale for why this post, now
- The rationale is displayed in the approval queue; it's how the reviewer judges a draft in three seconds instead of thirty
- Every draft is written to `social_posts` with `status = 'draft'`. Claude never publishes

**Acceptance criteria:**
1. A P1 draft returns a hook ≤ 60 characters, a caption ≤ 2,200 characters, and 3–5 hashtags
2. Hashtags always include the anchor pair `#DialTone #RestaurantOwners` and never include a banned tag (§6.1)
3. A P3 draft that makes a pricing or tier claim includes a `claims[]` array, each entry citing the source file it came from; a claim with no citation fails validation and the draft is rejected before it reaches the queue
4. Generation failure leaves no partial row and emits an alert (§F8)
5. Re-running generation for the same slot replaces the draft only while `status = 'draft'`

**Technical considerations:**
- Model: `claude-opus-5` via `@anthropic-ai/sdk`, with `thinking: {type: "adaptive"}` and `output_config: {effort: "medium"}` — copy generation is not a reasoning-hard task, and medium effort keeps latency and cost down
- Structured output via `output_config.format` against a JSON schema, so the Worker never parses prose
- The guardrail pack (positioning doc §4/§6/§7, voice rules, banned words, hashtag rules) is a stable prefix — put it first with `cache_control: {type: "ephemeral"}` and keep the volatile parts (date, pillar, recent captions) after the breakpoint. Verify with `usage.cache_read_input_tokens`
- Enable server-side fallbacks: `betas: ["server-side-fallback-2026-07-01"]` + `fallbacks: "default"`, and check `stop_reason === "refusal"` before reading content
- Cost: roughly 6K input / 1.5K output per draft. At ~60 drafts/month that is ~360K input + 90K output ≈ **$4/month** at Opus 5 rates ($5/$25 per MTok), less with caching

---

### F3 — The Planner

**What:** A weekly cron job that fills the next two weeks of empty slots with drafts.

**Behavior:**
- Runs Sunday 09:00 America/Chicago
- Reads the slot template (§8, `schedule_slots`) — which weekdays and times carry which pillar
- For each empty future slot inside the horizon, picks a pillar per the cadence in §3.1, selects an eligible asset if the format needs one, and calls F2
- Skips slots that already hold a post in any status
- Never generates more than `MAX_DRAFTS_PER_RUN` (default 10) so a bug can't flood the queue

**Acceptance criteria:**
1. With an empty calendar, a run produces exactly one draft per template slot in the next 14 days, capped at 10
2. Re-running the same day produces zero new drafts (idempotent)
3. A slot whose pillar needs video, with no eligible unused asset, **substitutes a P1 Story card** (F7) for that slot and flags the original slot `needs_media` — the calendar stays full and the shortfall stays visible. It never publishes an empty slot, and never substitutes generated video
4. Pillar cadence over any rolling 14-day window matches §3.1 within ±1 post
5. **Product share (P4) is ≥ 60% over any rolling 14-day window.** A run that would breach this substitutes P4 into the next eligible non-product slot and logs the substitution
6. No P4 sub-type is scheduled twice within any 7-day window (§3.1.1); if the library cannot satisfy this, the slot is flagged `needs_media` rather than repeating a sub-type

**Technical considerations:**
- Cron trigger on the social Worker: `0 14 * * 0` (UTC, = 09:00 CDT). DST is handled by computing local time in-handler, not by changing the cron
- Idempotency key is `(scheduled_for, platform)` with a unique index

---

### F4 — Approval Queue

**What:** The human gate. Nothing reaches Instagram without passing through it.

**Behavior:**
- A list view in `bytestreams.info` of every post with `status = 'draft'`, soonest first
- Each row shows: media thumbnail, hook, full caption, hashtags, pillar, scheduled slot, Claude's rationale, and any claim citations
- Actions: **Approve** (→ `scheduled`), **Edit** (inline caption edit, then approve), **Reschedule** (date/time picker), **Reject** (→ `rejected`, with optional reason), **Regenerate** (new draft for the same slot)
- Approving writes `approved_by` and `approved_at` from the Cloudflare Access JWT
- A rejection reason, when given, is fed into the next generation for that pillar as a negative example

**Acceptance criteria:**
1. Approve moves the post to `scheduled` and makes it eligible for the publisher
2. A post still in `draft` when its scheduled time passes moves to `expired` and is never published
3. Edits are stored with the original preserved in `caption_original` for later comparison
4. The queue is usable on a phone — approve/reject reachable without horizontal scrolling
5. Every state transition writes an audit row (§8, `social_post_events`)

**Technical considerations:**
- SvelteKit form actions, consistent with the existing `/calendar/+page.server.ts` pattern
- Auth via `locals.user` from the existing `hooks.server.ts` — no new auth path

#### F4.1 — Graduated auto-publish

**v1 requires approval on every post.** But the gate is a *policy*, not a hardcoded step, so it can be relaxed per slice once the drafts have earned it — without a rewrite.

**Policy resolution.** A `content_policies` table keyed by `(platform, pillar, format)` carries `requires_approval boolean NOT NULL DEFAULT true`. The planner stamps each post with the resolved value at creation into `social_posts.requires_approval`. A post with `requires_approval = false` is created directly as `scheduled`, skipping the queue; every other post behaves exactly as F4 describes. **Resolution is most-specific-wins**, and an absent row means `true` — the default is always the safe one.

**Earning the relaxation.** Flipping a policy should follow evidence, not impatience, so the queue records the outcome of every review in `social_post_events.detail`:

| Outcome | Meaning |
|---|---|
| `approved_unedited` | Shipped exactly as drafted — the signal that matters |
| `approved_edited` | Needed a human hand; `caption_original` preserves the delta |
| `rejected` | Wrong enough to discard |

The daily digest (F8) reports a rolling per-slice tally. **Suggested promotion criterion: 20 consecutive `approved_unedited` in a slice, with zero `rejected` in the last 30 days.** At that point the digest proposes enabling auto-publish for that slice; a human still flips it. The criterion is a default, not a rule enforced in code.

**Expected graduation order**, easiest to hardest:
1. **P1 Stories** — ephemeral, formulaic, rendered from templates (F7), 24-hour lifespan. Lowest downside, highest volume; the natural first candidate.
2. **P4 product proof** — the footage is fixed and already vetted; only the caption varies.
3. **P2 menu engineering** — advisory copy, no hard claims.
4. **P5 brand spots** — rare enough that approval costs nothing.
5. **P3 cost evaluation** — **never auto-publishes.** It makes pricing and tier claims, and §6.2 exists because that class of claim has already gone wrong three ways in this codebase. A hard gate regardless of track record.

**Safety properties that survive auto-publish:**
- Guardrails (§6) still run at publish time on every post, approved or not — an auto-published post is unreviewed, never unchecked
- `ALL_POSTS_REQUIRE_APPROVAL=true` as a Worker var is a global kill switch overriding every policy row, for use when something looks wrong and there's no time to reason about which slice caused it
- P3 and any post carrying a non-empty `claims[]` array are gated in code, not by policy — a config mistake cannot open that door
- Auto-published posts still appear in the daily digest, flagged as unreviewed, so they are seen within 24 hours even if nobody watched them go out

**Acceptance criteria:**
1. With default policies, every post lands in the queue — v1 behavior is unchanged
2. Setting `requires_approval = false` for `(instagram, P1, story)` causes new P1 Stories to be created as `scheduled` while every other slice still queues
3. A post with a non-empty `claims[]` array queues for approval even when its policy says otherwise
4. `ALL_POSTS_REQUIRE_APPROVAL=true` forces every post to the queue regardless of policy rows
5. The digest reports per-slice approval tallies and names any slice meeting the promotion criterion

---

### F5 — Calendar

**What:** The month view that makes the schedule legible at a glance, at `/social` in `bytestreams.info`.

**Behavior:**
- Month grid, each day showing its posts as compact chips
- Chip colors by status: draft (amber), scheduled (blue), published (green), failed (red), rejected (grey)
- Chip icon by format: Reel, image, carousel, Story
- Click a chip → the post detail / approval panel (F4)
- Drag a chip to another day → reschedules (allowed in `draft` and `scheduled`; blocked once `published`)
- A pillar-balance strip under the grid shows the mix for the visible month against the §3.1 targets
- Approved posts mirror into a dedicated **"DialTone Social"** Google Calendar as read-only events, using the OAuth tokens already in `google_calendar_tokens`

**Acceptance criteria:**
1. The month view renders every post in range with correct status color and format icon
2. Dragging a `scheduled` post to a new day updates `scheduled_for` and updates the mirrored GCal event
3. Dragging a `published` post is refused with an explanatory message
4. Deleting or rejecting a post removes its GCal event
5. A GCal mirror failure never blocks the local state change — it is logged and retried on the next cron

**Technical considerations:**
- **Supabase is the source of truth; Google Calendar is a projection.** Google Calendar has nowhere sane to put media refs, status, pillar, and claim citations
- Reuse `src/lib/server/google-calendar.ts`; add a `calendarId` parameter so social events land on their own calendar rather than the personal one
- The mirror is one-way. Edits made in Google Calendar are ignored and overwritten — stated in the UI so it isn't a surprise
- `social_posts` lives in the **intranet's** Supabase project (the one `bytestreams_info` already reads with `SUPABASE_SERVICE_ROLE_KEY`), not the marketing-site project, so the UI needs no second client

---

### F6 — Publisher

**What:** The cron job that actually posts.

**Behavior:**
- Runs every 15 minutes
- Selects posts where `status = 'scheduled'` and `scheduled_for <= now()`
- For each: re-runs guardrail validation (§6), mints a signed URL for each media asset, uploads to Blotato via `POST /media/uploads`, then publishes via `POST /posts`
- Records `blotato_post_id` and moves to `published`, or to `failed` with the error body
- Retries transient failures (429, 5xx) with exponential backoff up to 3 attempts; a 4xx other than 429 fails immediately without retry
- Concurrency capped at 2 in flight to stay well under Blotato's 30 req/min

**Acceptance criteria:**
1. A scheduled post publishes within 15 minutes of its slot and lands with correct caption, hashtags, and media
2. A post failing guardrail re-validation at publish time moves to `blocked`, never publishes, and alerts — catching a guardrail tightened after approval
3. A Blotato 5xx retries up to 3 times; after that the post is `failed` and alerts
4. A `failed` post can be retried from the UI without re-approval
5. No post publishes twice, even if the cron overlaps (enforced by a conditional status update, not by an application-level lock)

**Technical considerations:**
- Blotato: base `https://backend.blotato.com/v2`, header `blotato-api-key` — **preserve trailing `=` padding on the key**, a documented footgun
- Instagram `content.platform` must match `target.targetType`; `scheduledTime` and `useNextFreeSlot` are root-level siblings of `post`, not nested inside it
- **We publish immediately at our own slot rather than using Blotato's scheduler.** Our calendar is the source of truth, our plan's scheduled-post cap doesn't bind, and one system owns timing
- Signed URLs get a 1-hour TTL — long enough for Blotato to fetch, short enough to be useless if leaked
- A publish attempt is logged to `social_post_events` before the API call and updated after, so a Worker crash mid-call is diagnosable

---

### F7 — Story Card Renderer

**What:** Turns a Claude-written P1/P2/P3 Story into a branded 9:16 image without human design work.

**Behavior:**
- A small set of HTML card templates using the existing brand tokens from `dialtone-order-flow-vertical.html` (`--gold:#E8A020`, `--ink:#14264B`, Poppins/Lora)
- Claude fills the template's slots (headline, body, stat, attribution)
- The Worker renders the HTML to a 1080×1920 PNG via **Cloudflare Browser Rendering**
- The PNG is stored in `social-media-assets` and attached to the post

**Acceptance criteria:**
1. A P1 Story draft produces a 1080×1920 PNG with correct brand colors and fonts
2. Text longer than the template's safe area is caught at render and the draft is flagged rather than shipping clipped text
3. Rendering is deterministic — the same input produces a byte-identical PNG
4. Render failure leaves the post in `draft` with `needs_media`, never publishes a post without its image

**Technical considerations:**
- This is the highest-leverage piece of the whole system. It makes P1 — the calendar's highest-volume pillar — **fully automated end to end**, with no production time and no stock imagery
- Cloudflare Browser Rendering does screenshots, not video. Static Story cards are in scope; animated ones are not (§5.6)
- Fonts must be embedded or self-hosted; a Google Fonts fetch that fails mid-render silently produces a fallback-font card

---

### F8 — Alerting and Health

**Behavior:**
- Any `failed`, `blocked`, or generation error sends an email via Resend to `hello@dialtone.menu`
- A daily 08:00 digest reports: posts published in the last 24h, posts awaiting approval, and days-since-last-post
- If days-since-last-post exceeds 3, the digest is flagged urgent — this is the §1.1 objective, monitored directly

**Acceptance criteria:**
1. A publish failure produces an email within 15 minutes naming the post and the error
2. The daily digest arrives even when nothing happened
3. Alerting failure is logged and never blocks publishing

---

## 6. Brand Guardrails

These are enforced in code, at two points — before a draft enters the queue, and again immediately before publish. They are not prompt suggestions. The positioning doc, the hashtag doc, and `AGENTS.md` all encode decisions that are expensive to re-learn.

### 6.1 Banned language

From `bytestreams-positioning-and-taglines.md` §4/§6 and `insta_hashtags.md`:

**Banned in operator-facing copy:** "agentic", "agentic workflow", "AI-powered", "revolutionary", "leverage", "seamless", "cutting-edge", "game-changing", "transform your business", "restaurant tech", "POS system" (as a self-description).

**Banned offers — hard block, not a style rule.** "free trial", "try it free", "start free", "free for 30 days", "no credit card required", or any variant. **There is no free trial and no pilot program.** Shortys and Diner On The Go were the pilots and that program is closed; Pilot remains an internal tier deliberately absent from the pricing page. This sits with the §6.2 claim rules, not the voice rules: advertising an offer that does not exist is the same failure as advertising a feature that does not exist.

**The only CTA is "Book a 15-minute call"** (`dialtone.menu`, the site's actual CTA). A post proposing any other action — sign up, start now, download, get started free — is blocked.

**Pre-existing asset warning:** `dialtone_menu_video_production_blueprint.md` specifies a universal outro reading *"Start Your Free Trial at DialTone.Menu"*, and the produced commercials may carry it. **Any commercial whose final frames show that line must be re-cut or overlaid before publishing.** F1 ingest requires a `cta_verified` flag on every produced video asset; without it the asset cannot attach to a post.

**Rationale, preserved so it isn't relitigated:** "agentic" is insider language that sounds menacing or empty to an operator. "Agent" is fine and encouraged — it's concrete, it's the thing that answers the phone. The distinction is operator-facing vs. investor-facing surfaces, and Instagram is operator-facing.

**Banned hashtags:** `#RestaurantTech`, `#POS`, `#OrderManagement`, and anything containing "AI" or "automation". These tags are vendors talking to other vendors, and they place the account in exactly the category §6 of the positioning doc exists to escape. A tag is copy, and it's the first thing an eye catches under a caption.

**Required hashtags:** the anchor pair `#DialTone #RestaurantOwners` on every post, plus 1–3 rotated by pillar:
- P4/P5 proof → `#FrontOfHouse`, `#RestaurantOwnerLife`
- Food truck content → `#FoodTruckLife`, `#FoodTruckOwner`
- Operator/founder → `#IndependentRestaurant`, `#SmallBusinessOwner`

**Geographic tags are banned**, including `#MemphisEats`, `#901Eats`, `#NashvilleEats`, and any city or area-code tag. `insta_hashtags.md` lists Memphis tags in its founder rotation; that predates the national cold-call motion and is superseded here. A city tag tells a national prospect they are outside the service area, which is the opposite of true — and the same reasoning applies to the copy: no "here in Nashville," no regional references, no local-market framing.

Total 3–5, in the caption, never a wall in the first comment.

**Facebook exception:** no hashtags at all. They provide no benefit on Facebook and signal cross-posted Instagram content. The banned-word rules (§6.1) still apply in full.

### 6.2 Claim citation

Any post making a **pricing, tier, feature-availability, or savings claim** must carry a `claims[]` array where each entry names its source. Valid sources: `public/pricing.html`, `packages/shared/src/entitlements.ts`, `docs/dialtone-transaction-pricing.md`, `notes/dialtone-pricing-model.xlsx`.

An uncited claim blocks the draft.

**Why this rule exists at all:** `AGENTS.md` documents the pricing-page ↔ entitlements problem failing in three distinct directions — sold-but-not-built (SSO/RBAC gated nothing), built-but-not-sold (web ordering absent from the page), and sold-at-the-wrong-tier (Fire/Hold listed Enterprise-only when it shipped at Single Location). A social post is the same class of claim as the pricing page, with less review and more reach. The 1.5% transaction fee in particular must match `restaurants.platform_fee_bps` (default 150).

### 6.3 SHAFT / alcohol

No alcohol, tobacco, firearms, or adult content in any post — enforced by term matching, not by trust, mirroring the rule in `developer/campaigns-geo-blast.md` §5. **Promote the event, never the drink.** This applies to the ByteStreams brand regardless of any restaurant's license.

### 6.4 Voice checks

From positioning doc §7, checked as heuristics with warnings rather than hard blocks:
- **Operator-first** — "your staff is buried" lands; "leverage AI-powered automation" doesn't
- **Confident, not loud** — no superlatives without a number behind them
- **Concrete, not aspirational** — "Friday at 7pm, the phone rings" beats "during peak hours"; "$30–80/month in call costs" beats "transparent pricing"

### 6.6 No production data in media

**Every product screenshot and screen recording must come from a demo or staging environment. Never production.**

A screenshot of the live admin app contains a real restaurant's orders, guest names, phone numbers, ticket totals, and staff names. Publishing that to Instagram is a customer-data disclosure, and it would be discovered by the customer, not by us.

- **Allowed sources:** `*-staging.dialtone.menu`, `<slug>.demo.dialtone.menu`, local `pnpm db:reset` seed data, and the seeded tenants (Sui's Sushi, Rival Ramen)
- **Banned sources:** any `admin.dialtone.menu` / `kitchen.dialtone.menu` / `beverage.dialtone.menu` host, any `<slug>.m.dialtone.menu` tenant menu, and any capture taken from a real customer's account
- `media_assets.source_env` is a required field — `demo`, `staging`, `local`, or `produced` — and a row without one cannot be attached to a post
- F1.1 capture refuses a production hostname outright rather than warning
- Human-ingested media (F1) requires the operator to declare `source_env`; the declaration is recorded in the audit log against their email

This rule holds for *incidental* production data — a screenshot grabbed from the live admin app because it was convenient. Consent to be a pilot is not consent to have their Friday-night order volume on a vendor's Instagram.

**Deliberately featuring a consenting operator is a different thing and is allowed** under the conditions in §6.7. The distinction is consent and scope, not which host the pixels came from.

### 6.7 Featuring a real operator

P6 features identifiable businesses, and sometimes the people who run them. §6.6's blanket production-data ban has one exception, and it is narrow: **content a tenant has given written permission for.**

#### Two consent tiers — they are not the same permission

Consent is granted per tier. Holding one does not imply the other, and the generator must treat them as independent.

| Tier | Covers | Status (2026-09-13) |
|---|---|---|
| **T1 — Relationship** | That the business is a DialTone customer; the business name and logo; their branded menu, storefront, and app surfaces; their menu items; the business's own public marketing copy | **Held** for Shortys and Diner On The Go |
| **T2 — Personal** | Owner or staff **names**; the founder story; any individual's likeness, voice, or photo; quotes attributed to a person; family or biographical detail | **Not held** — being requested |

**What T1 alone permits**, concretely: "Diner On The Go, a food truck company in Maryland, runs their service on DialTone" — with their logo, their brand colors, their menu, a shot of their branded ordering page. That is a complete, credible P6 post and needs nothing from T2.

**What T1 alone forbids:** naming Randy or Candy, calling them a husband-and-wife team, telling the 2014 founding story, quoting either of them, or showing their faces. All of that is personal information about identifiable individuals, and the business's consent to be referenced is not those individuals' consent to be described.

The distinction matters beyond politeness: a business can consent on behalf of the business. Only a person can consent on behalf of that person. A T2 post drafted under T1 consent is not a gray area.

**Requirements, all of them, before a P6 post can be drafted:**

1. **Written consent on file**, per operator **and per tier**, recorded in `operator_consents` with the date, the scope, and a copy of the permission. Verbal agreement at the end of a support call is not consent.
1a. **The draft declares which tier it needs.** A draft that references any person, name, quote, or biographical detail is T2 by definition — the classifier errs toward T2, and a T2 draft without a live T2 row is blocked.
2. **Scope is explicit and narrow.** Consent to show a branded menu is not consent to show order volume. Consent to be named is not consent to show revenue. The asset's scope is checked against the post at draft and at publish.
3. **Guest data is redacted regardless of consent.** An operator can consent on their own behalf; they cannot consent on behalf of the diner whose name and phone number are on that ticket. Any guest name, phone number, address, or order-level PII is removed or synthesized before capture.
4. **No revenue figures** without separate, explicit sign-off. A restaurant's sales are commercially sensitive, and a competitor down the street reads Instagram too.
5. **Right to withdraw, honored retroactively.** If an operator asks to be removed, their posts come down and their assets go `is_active = false`. `operator_consents.revoked_at` blocks all future use immediately.
6. **Show them the post before it publishes.** Not a legal requirement — a relationship one. A pilot customer who first sees themselves on your Instagram after the fact is a pilot customer you have spent something with.

**`operator_consents`:**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `operator_name` | `text` NOT NULL | "Shortys", "Diner On The Go" |
| `tenant_slug` | `text` NULL | Links to the DialTone tenant |
| `tier` | `text` NOT NULL | `T1_relationship` \| `T2_personal` — one row per tier per operator |
| `consent_scope` | `text[]` NOT NULL | T1: `business_name`, `logo`, `branding`, `menu`, `storefront`, `customer_reference`. T2: `owner_names`, `founder_story`, `likeness`, `quotes`, `call_recording` |
| `allows_business_name` | `boolean` NOT NULL | T1 — named business vs. "a food truck in Maryland" |
| `allows_owner_names` | `boolean` NOT NULL DEFAULT false | T2 — requires a live T2 row; false under T1-only |
| `granted_at` | `timestamptz` NOT NULL | |
| `granted_by` | `text` NOT NULL | Who at the operator signed |
| `document_path` | `text` NOT NULL | The signed record |
| `revoked_at` | `timestamptz` NULL | Non-null blocks all use |
| `notes` | `text` NULL | |

A P6 draft whose referenced operator has no live consent row **at the tier the draft requires** is blocked — not warned. Revoking T2 does not revoke T1, and vice versa.

### 6.5 Enforcement

| Check | Draft time | Publish time | Failure mode |
|---|---|---|---|
| Banned words | ✓ | ✓ | Hard block |
| Banned hashtags | ✓ | ✓ | Hard block |
| Required anchor tags | ✓ | ✓ | Hard block |
| Hashtag count 3–5 | ✓ | ✓ | Hard block |
| Claim citation | ✓ | ✓ | Hard block |
| SHAFT terms | ✓ | ✓ | Hard block |
| No free-trial / pilot offer language (§6.1) | ✓ | ✓ | Hard block |
| CTA is "Book a 15-minute call" or none (§6.1) | ✓ | ✓ | Hard block |
| Produced video has `cta_verified` (§6.1) | ✓ | ✓ | Hard block |
| Caption length | ✓ | ✓ | Hard block |
| `source_env` present and not production (§6.6) | ✓ | ✓ | Hard block |
| P6 operator has live consent **at the required tier** (§6.7) | ✓ | ✓ | Hard block |
| Draft referencing a person classified T2 and gated (§6.7) | ✓ | ✓ | Hard block |
| No guest PII in any media (§6.7) | ✓ | ✓ | Hard block |
| No operator revenue figures without sign-off (§6.7) | ✓ | ✓ | Hard block |
| P4 sub-type not repeated within 7 days (§3.1.1) | ✓ | — | Warning in queue |
| Product share ≥ 60% over 14 days (§3.1) | ✓ | — | Warning in digest |
| Voice heuristics | ✓ | — | Warning in queue |

---

## 7. Technical Architecture

### 7.1 Isolation from the live site

**Requirement: zero impact on dialtone.menu.**

| Decision | Why |
|---|---|
| Separate Worker `dialtone-social` | Its own script, its own failure domain. A bad social deploy cannot serve a wrong page on a tenant menu |
| Separate config file `social/wrangler.toml` | An `[env.social]` block would sit inside the file governing production. A separate file makes co-deploying structurally impossible, not merely unlikely |
| Separate workflow `.github/workflows/deploy-social.yml` | `deploy.yml` is untouched. The social deploy has no path that reaches `dawn-pine-d058` |
| **No Worker Route on the `dialtone.menu` zone** | The `*.dialtone.menu` route incident (dialtone#1011) made every app host serve the marketing site. The social Worker is cron-triggered; it needs no hostname at all |
| `workers_dev = false`, no custom domain | Nothing to route, nothing to certificate, nothing to misconfigure |
| Own secrets, own KV (if needed) | Never shares `RATE_LIMIT_KV` — social traffic must not evict production rate-limit entries |
| CI-only deploys | Matches the standing rule: never `wrangler deploy` from local |
| Content-based verification | A green deploy is not evidence. The 2026-07-24 stale-Worker incident passed a 200-only check for a day |

**Files added to `dialtone_menu`:**
```
social/
  wrangler.toml          # separate config — name = "dialtone-social"
  src/
    index.ts             # scheduled() handler only — no fetch()
    planner.ts           # F3
    generator.ts         # F2 — Anthropic SDK
    publisher.ts         # F6 — Blotato client
    guardrails.ts        # F6 rules (§6)
    render.ts            # F7 — Browser Rendering
    supabase.ts          # DB client
  templates/             # HTML Story cards
  ingest.mjs             # F1 CLI
  tests/
.github/workflows/deploy-social.yml
```

**Files NOT touched:** `worker.js`, `wrangler.toml`, `deploy.yml`, `deploy-preview.yml`, `deploy-demo.yml`, `public/**`, `templates/**`.

**Verification gate in `deploy-social.yml`:** after deploy, assert (a) `dialtone.menu` still returns the marketing homepage title, (b) a known tenant menu host still returns that tenant's menu, (c) the social Worker's scheduled handler is registered. Any failure fails the workflow.

### 7.2 Stack

| Layer | Choice | Rationale |
|---|---|---|
| Compute | Cloudflare Workers (cron-triggered) | Already the deploy target; cron triggers are free; no server to run |
| Database | Supabase Postgres — **the intranet's project** | `bytestreams_info` already reads it with a service-role key, so the calendar UI needs no second client |
| Storage | Supabase Storage, bucket `social-media-assets` | Same project, same credentials, signed-URL support |
| UI | SvelteKit in `bytestreams_info` | Where SSO, the calendar, and the Google OAuth already live |
| Auth | Cloudflare Access JWT | Existing, unchanged |
| Content generation | Claude `claude-opus-5` via `@anthropic-ai/sdk` | §F2 |
| Publishing | Blotato API v2 | Handles Instagram Graph API plumbing and rate limits; Stories publishing in particular requires Meta app review that Blotato has already cleared |
| Rendering | Cloudflare Browser Rendering | HTML → PNG for Story cards |
| Alerting | Resend | Already in use for `/api/contact` |

### 7.3 Why Blotato

Direct Instagram Graph API integration would mean: a Meta app, App Review for `instagram_content_publish`, a container-based two-step publish flow, separate handling per media type, token refresh, and rate-limit accounting. **Stories publishing in particular is a slow approval path.** At $29/month on the Starter plan — which includes full API access, 20 accounts, and no per-post fees — Blotato is cheaper than the first week of that work.

**The risk is vendor dependency**, mitigated by keeping the publisher behind a `SocialPublisher` interface with `upload(media)` and `publish(post)`. Swapping to direct Graph API or another vendor is one module.

---

## 8. Data Model

All tables in the **intranet Supabase project**. Migrations follow the existing `developer/migrations/NNN_*.sql` convention in `bytestreams_info` (next free number: `013`).

### `media_assets`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `storage_path` | `text` NOT NULL | Path within `social-media-assets` |
| `content_hash` | `text` NOT NULL UNIQUE | SHA-256, dedupe key |
| `media_type` | `text` NOT NULL | `video` \| `image` |
| `mime_type` | `text` NOT NULL | |
| `width` | `int` NOT NULL | |
| `height` | `int` NOT NULL | |
| `aspect_ratio` | `text` NOT NULL | Derived: `9:16`, `1:1`, `4:5`, `16:9` |
| `duration_seconds` | `numeric` NULL | Video only |
| `has_audio` | `boolean` NOT NULL DEFAULT false | |
| `pillar` | `text` NOT NULL | `P1`–`P5` |
| `title` | `text` NOT NULL | Human label |
| `description` | `text` NULL | |
| `eligible_formats` | `text[]` NOT NULL | `reel`, `story`, `image`, `carousel` |
| `source_env` | `text` NOT NULL | `demo` \| `staging` \| `local` \| `produced`. Production is not a valid value (§6.6) |
| `cta_verified` | `boolean` NOT NULL DEFAULT false | Produced video only — confirms the outro carries no dead offer (§6.1) |
| `p4_subtype` | `text` NULL | §3.1.1 — required when `pillar = 'P4'` |
| `surface` | `text` NULL | Named app surface for captured assets (e.g. `kds`, `analysis_menu`) |
| `source_note` | `text` NULL | e.g. "commercials/DialTone_missed_calls_prod.mp4" |
| `used_in_post_ids` | `uuid[]` NOT NULL DEFAULT '{}' | Reuse tracking |
| `is_active` | `boolean` NOT NULL DEFAULT true | Retire without deleting |
| `created_at` / `updated_at` | `timestamptz` NOT NULL | |

### `social_posts`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `platform` | `text` NOT NULL DEFAULT 'instagram' | Platform-agnostic from day one |
| `format` | `text` NOT NULL | `reel` \| `image` \| `carousel` \| `story` |
| `pillar` | `text` NOT NULL | `P1`–`P5` |
| `status` | `text` NOT NULL DEFAULT 'draft' | See state machine below |
| `hook` | `text` NULL | ≤ 60 chars |
| `caption` | `text` NOT NULL | ≤ 2,200 chars |
| `caption_original` | `text` NULL | Pre-edit version |
| `hashtags` | `text[]` NOT NULL | 3–5 |
| `media_asset_ids` | `uuid[]` NOT NULL DEFAULT '{}' | Ordered; carousels use order |
| `claims` | `jsonb` NOT NULL DEFAULT '[]' | `[{text, source_file, source_note}]` |
| `rationale` | `text` NULL | Claude's "why this, now" |
| `needs_media` | `boolean` NOT NULL DEFAULT false | |
| `scheduled_for` | `timestamptz` NOT NULL | |
| `published_at` | `timestamptz` NULL | |
| `blotato_post_id` | `text` NULL | |
| `gcal_event_id` | `text` NULL | Mirror handle |
| `error` | `text` NULL | Last failure |
| `attempt_count` | `int` NOT NULL DEFAULT 0 | |
| `generated_by_model` | `text` NULL | e.g. `claude-opus-5` |
| `requires_approval` | `boolean` NOT NULL DEFAULT true | Resolved from `content_policies` at creation (F4.1) |
| `approved_by` | `text` NULL | Email from CF Access JWT |
| `approved_at` | `timestamptz` NULL | |
| `rejection_reason` | `text` NULL | Fed back into generation |
| `created_at` / `updated_at` | `timestamptz` NOT NULL | |

Unique index on `(platform, scheduled_for)`.

**Platform variants.** One idea produces one row per platform, linked by `variant_group_id` (`uuid` NULL). The generator writes both in a single call — Instagram and Facebook captions per the §4.4 register table — and the approval queue shows them together so one tap approves the pair. Publishing, status, and failure are independent per row: a Facebook failure never blocks the Instagram post.

**Status state machine:**
```
draft ──approve──> scheduled ──publish──> published
  │                    │
  │                    ├──guardrail fail──> blocked
  │                    └──api fail (3x)───> failed ──retry──> scheduled
  ├──reject──> rejected
  └──slot passes──> expired
```

### `social_post_events`

Append-only audit log.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` PK generated always as identity | |
| `post_id` | `uuid` NOT NULL REFERENCES `social_posts(id)` | |
| `event` | `text` NOT NULL | `created`, `approved`, `edited`, `rescheduled`, `rejected`, `publish_attempt`, `published`, `failed`, `blocked` |
| `actor` | `text` NOT NULL | Email, or `system` |
| `detail` | `jsonb` NULL | |
| `created_at` | `timestamptz` NOT NULL DEFAULT now() | |

### `content_policies`

Per-slice approval policy (F4.1). Absent row = `requires_approval` true.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `platform` | `text` NOT NULL | |
| `pillar` | `text` NULL | NULL = applies to all pillars on the platform |
| `format` | `text` NULL | NULL = applies to all formats |
| `requires_approval` | `boolean` NOT NULL DEFAULT true | |
| `changed_by` | `text` NOT NULL | Email — flipping this is an audited act |
| `changed_at` | `timestamptz` NOT NULL DEFAULT now() | |
| `note` | `text` NULL | Why it was relaxed |

Unique index on `(platform, pillar, format)`. Most-specific match wins.

### `schedule_slots`

The recurring template the planner fills.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `weekday` | `int` NOT NULL | 0=Sunday |
| `time_local` | `time` NOT NULL | America/Chicago |
| `pillar` | `text` NULL | NULL = planner chooses by cadence |
| `format` | `text` NOT NULL | |
| `is_active` | `boolean` NOT NULL DEFAULT true | |

**Times are America/Chicago, chosen for a national audience** — 11:00 CT is 09:00 PT and 12:00 ET, landing inside the working day coast to coast. The 16:00–17:00 CT slots hit the pre-dinner lull when an operator is most likely to be on a phone. Central is the compromise, not a local preference.

**Seed template** (6 posts/week — sustainable, and above the 3-day staleness threshold):

| Day | Time | Pillar | Format | Note |
|---|---|---|---|---|
| Mon | 11:00 | P4 | Carousel | `feature_spotlight` or `before_after` |
| Tue | 16:00 | P4 | Reel | `workflow_walkthrough` |
| Wed | 11:00 | P1 | Story | Operator education — the non-product floor |
| Thu | 17:00 | **P6** | Reel / carousel | Real operator — consent-gated (§6.7); falls back to P4 `real_surface` when no consented asset is available |
| Fri | 11:00 | P4 | Image | `detail_shot` |
| Sat | 10:00 | rotating | Carousel / Reel | P2 → P3 → P5 → P1, cycling weekly |

**Product share: 4 of 6 = 67%** (three P4 + one P6), clearing the 60% floor with headroom for the Saturday rotation to land on a non-product pillar. Sub-types are hints here, not assignments — the planner picks per §3.1.1's no-repeat-within-7-days rule and may override the hint to satisfy it.

---

## 9. UI Design Principles

- **Inherit the intranet's design system.** `src/app.css` already carries the ByteStreams Brand Kit tokens. No new palette.
- **The calendar is the home screen.** Approval is a panel on it, not a separate destination — the month view is what answers "is the account healthy?" at a glance.
- **Phone-first for approval.** The approve/reject decision happens between other things. Full-width tap targets, no horizontal scroll, caption readable without zoom.
- **Show the rationale.** A draft with a one-line "why this, now" is judged in seconds; one without it gets re-read in full.
- **Status is color, format is icon.** Two independent visual channels so a month reads at a glance.
- **Failures are loud.** A red chip and an email, not a log line.

---

## 10. Security

- **Auth:** Cloudflare Access JWT, unchanged. Every `/social` route guards on `locals.user`; the existing soft-fail pattern in `hooks.server.ts` applies.
- **Secrets** (social Worker only, never on `dawn-pine-d058`): `BLOTATO_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `GOOGLE_OAUTH_*`. Declared by name in `social/wrangler.toml` `[secrets] required` so wrangler warns when one is absent.
- **Storage bucket is private.** Media reaches Blotato via 1-hour signed URLs; no public bucket.
- **Service-role key is server-side only.** It never crosses into client code — same rule the existing `supabase.ts` header comment states.
- **Blotato API key handling:** preserve trailing `=` padding; rotate if the Worker log ever echoes it. Never log request headers.
- **Audit trail:** every state transition records an actor. "Who approved the post that said the wrong price" must be answerable.
- **Blast-radius guarantee:** the social Worker has no binding to the production site Worker, no shared KV, and no route on the zone. Its worst failure is that nothing posts.
- **Compliance posture:** no PHI, no customer PII, no marketing SMS. This system does not touch the consent infrastructure in `campaigns-geo-blast.md` and must not be extended to without revisiting that spec.

---

## 11. Milestones

### Phase 0 — Manual launch (starts immediately, no build)
Content flows **before** the system exists. Ten posts are drafted and ready in [social-launch-content-pack.md](social-launch-content-pack.md) — positioning, the three commercials, four product-proof clips, and two operator-education carousels. Every asset is ByteStreams-produced or seeded demo data, so **nothing waits on consent, and nothing waits on M0**.

- Publish by hand to both accounts at ~5–6/week
- Verify each commercial's outro for the dead free-trial line before posting (§6.1)
- Keep what was posted and when — it seeds `social_posts` as backdated `published` rows in M1, so reuse tracking and days-since-last-post start from truth

**Exit:** a 3×3 grid on Instagram, the same run on Facebook, and days-since-last-post at 0 — achieved with zero code.

### M0 — Foundations (no publishing)
- `social/wrangler.toml`, Worker skeleton, `deploy-social.yml` with the content-verification gate
- Migration `013_create_social_tables.sql`
- Storage bucket + policies
- Record the Facebook Page's `pageId` from Blotato's subaccounts endpoint (§4.4)
- **Exit:** social Worker deploys, cron fires, logs a heartbeat. `dialtone.menu` and a tenant menu verified unchanged by content. Both social accounts connected in Blotato and returned by `GET /users/me/accounts`.

### M1 — Library
- F1 ingest CLI, with `source_env` required (§6.6)
- **F1.1 Playwright capture** against staging/demo, seeded with the surface list — this is the pillar that carries the calendar, so it ships in M1, not later
- Seed all 5 commercials + 12 product clips + brand assets + the first full screenshot run
- **Exit:** `media_assets` holds every existing asset plus a captured still for every seed surface at both aspect ratios; a non-9:16 file is rejected for reel use; a capture attempt against a production host fails.

### M2 — Generation + Approval (no publishing)
- F2 generator with the guardrail pack
- §6 guardrails as a standalone, unit-tested module
- F4 approval queue in `bytestreams_info`
- **Exit:** a draft generates on demand, passes guardrails, and is approvable. A draft containing "agentic" or `#RestaurantTech` is blocked, with a test proving it.

### M3 — Calendar
- F5 month view, drag-to-reschedule, status colors
- Google Calendar mirror on its own calendar
- **Exit:** approving a post creates a GCal event; rescheduling moves it; rejecting deletes it.

### M4 — Publish
- F6 publisher, Blotato client, retry/backoff
- F8 alerting + daily digest
- **Exit:** a real post publishes to Instagram at its slot. A forced failure alerts and is retryable from the UI.

### M4a — Grid backfill (the cold start)
**Largely satisfied by Phase 0 if that ran as intended** — this milestone exists for the case where manual posting stalled. Before the planner takes over, ensure the opening run is complete:
- 8 new posts over ~10 days, joining the existing food-truck post to complete a 3×3 grid on first view
- Mix, honoring the §3.1 product majority: **5× P4** (app screens and flows, one per sub-type per §3.1.1), 2× P5 (`DialTone_missed_calls_prod`, `cat-cant-answer`), 1× P1 (an operator-education card)
- The already-published `dialtone_foodtruck_001_insta.mp4` is the ninth tile — it is not re-posted
- Each still passes the approval queue; this is a burst, not a bypass
- **Exit:** the profile shows a filled grid spanning all three top-of-funnel registers — brand, proof, and useful — and days-since-last-post is 0.

### M5 — Automate the cadence
- F3 planner on the weekly cron
- F7 Story card renderer
- Seed `schedule_slots`
- **Exit:** a Sunday run fills two weeks; P1 Stories render end-to-end with no human media work.

---

## 12. Costs

| Item | Monthly | Note |
|---|---|---|
| Blotato Starter | **$29** | Full API, 20 accounts, no per-post fees. $97 Creator only if account count grows |
| Claude (Opus 5) | **~$4** | ~60 drafts/mo at ~6K in / 1.5K out; less with prompt caching |
| Cloudflare Workers | **$0** | Within the existing paid plan; cron triggers are free |
| Browser Rendering | **~$0–5** | ~25 Story renders/mo |
| Supabase | **$0** | Existing project; storage for ~20 videos is well inside quota |
| Resend | **$0** | Existing |
| **Total** | **~$35–40/mo** | |

Production time for P5 spots (DaVinci + face-swap + Resolve) is a real cost this system does not remove — it removes the *distribution* cost, and F7 removes production entirely for the highest-volume pillar.

---

## 13. Challenges and Mitigations

| Challenge | Risk | Mitigation |
|---|---|---|
| **Breaking the live site** | Severe — tenant menus and payments | §7.1 in full: separate Worker, separate config, separate workflow, no zone route, content-verified deploys |
| **Claude drafts off-voice copy** | Brand damage, slow erosion | Guardrails in code at two points (§6); human approval; rejection reasons fed back |
| **Uncited money claims** | Selling what isn't built — the documented failure mode | Claim citation is a hard block (§6.2) |
| **Blotato dependency** | Vendor outage or shutdown | `SocialPublisher` interface; posts stay `scheduled` and publish late rather than being lost |
| **Video library runs dry** | Cadence collapses to text-only | Deliberate design, not a gap: P1 + F7 need no footage, so the calendar can always be filled from templates alone. The planner substitutes a Story card and flags `needs_media`, and the digest surfaces the count — thin weeks announce themselves instead of being papered over with generated video |
| **Instagram API changes** | Publishing breaks | Blotato absorbs this — a primary reason for using it |
| **Approval becomes the bottleneck** | Queue rots, staleness returns | Batch approval, phone-first UI, daily digest surfacing queue depth |
| **Repetitive content** | Account reads as a bot | Last-30-captions passed to the generator; 60-day asset reuse window; pillar-balance strip |
| **60% product reads as a vendor feed** | Undoes the §6 positioning the account exists to hold | Six required P4 sub-types on a no-repeat-within-7-days rule (§3.1.1); outcome-first caption rule enforced by the voice check; P1 kept as a weekly floor so the account never becomes purely product |
| **Published screenshot contains real customer data** | Customer-data disclosure, discovered by the customer | `source_env` required on every asset, production values rejected at ingest, capture refuses production hosts (§6.6) |
| **Screenshots go stale as the UI ships** | Posts show a product that no longer looks like that | F1.1 re-capture is a scripted run, not a manual chore; superseded assets deactivate without breaking published posts |
| **DST drift on cron** | Posts at the wrong local hour | Cron in UTC, local time computed in-handler |
| **Duplicate publish** | Same post twice | Unique `(platform, scheduled_for)` + conditional status update |

---

## 14. Future Expansion

1. **Further platform fan-out** — TikTok, Threads, LinkedIn from the same drafts, now that the Instagram/Facebook variant mechanism (§8) proves the pattern. TikTok is the strongest candidate: the P5 spots are already vertical and the food-truck audience is there.
2. **Animated Story/Reel rendering.** The HTML motion templates with their `data-theme="key"` chroma mode currently go through OBS by hand — 23KB of runbook. A headless-Chrome-plus-`ffmpeg` job in GitHub Actions could render them unattended. Out of v1 because Cloudflare Browser Rendering does screenshots, not video.
3. **Generated video — deliberately deferred, not forgotten.** If P4/P5 cadence ever becomes the binding constraint, the honest options in order of fidelity are: more produced spots (§14.2 makes these cheaper), then a Veo-class generator behind the face-swap step to hold character consistency. Blotato template video remains rejected at any stage — it solves volume, which is not the problem this account has.
4. **Engagement feedback loop** — pull post performance from Blotato and weight pillar selection toward what works.
5. **Comment and DM triage** — Blotato exposes `/comments` and `/dm-automations`. An operator comment is a sales lead; route it into the outreach pipeline rather than auto-replying.
6. **Blog amplification** — `AGENTS.md` commits to one long-tail blog post per month. Auto-draft the social promotion when a post ships.
7. **Per-restaurant social (a real product).** Each tenant's menu photos, top items, and hours become their Instagram content. This is a sellable feature with its own entitlement key — and its own OAuth, consent, and approval surface. A separate PRD, not an extension of this one.
8. **dialtone.med reuse.** The pillars change entirely; the pipeline doesn't.

---

## 15. Open Decisions

| # | Question | Recommendation |
|---|---|---|
| 1 | ~~Which Instagram account?~~ | **Resolved 2026-09-13:** [@dialtone.menu](https://www.instagram.com/dialtone.menu/) — the product's own account, separate from the ByteStreams parent. Matches the surface separation in positioning doc §2 |
| 2 | ~~Approval gate — every post, or Stories auto-publish?~~ | **Resolved 2026-09-13:** every post in v1, with graduated auto-publish built in but switched off (F4.1). P1 Stories graduate first; P3 cost-evaluation never does |
| 3 | ~~Reel media — library only, or Blotato template video as filler?~~ | **Resolved 2026-09-13:** library only. No generated or template video. When the library can't fill a video slot, the planner substitutes a rendered Story card rather than lowering the bar (§F3) |
| 4 | Is `dialtone_foodtruck_001_insta.mp4` already 9:16? | Verified at ingest; not an assumption to carry |
| 5 | Should `notes/projects/dialtone/commercials/` become the tracked source of truth for produced spots, or does Supabase Storage take over after ingest? | Storage after ingest; the notes directory stays the working/production area |
| 10 | ~~Do Shortys and Diner On The Go have written consent?~~ | **Partially resolved 2026-09-13:** **T1 relationship consent held** for both — P6 is unblocked and can ship on business-level content alone. **T2 personal consent** (owner names, founder story, likeness, quotes) is being requested and is not assumed by any draft until a row exists |
| 11 | Record the existing T1 consents into `operator_consents` | Do this in M1 alongside asset ingest — the guardrail reads the table, not a memory of a conversation. A T1 row per operator with scope `business_name, logo, branding, menu, storefront, customer_reference` |
| 12 | Do the produced commercials carry the "Start Your Free Trial" outro? | Check the final 5 seconds of all five before any publishes. If present, re-cut or overlay — the offer no longer exists (§6.1) |
| 6 | The bio is warm-prospect language ("one screen as one ticket"). Should it lead with the cold-prospect wedge instead? | Lead with the wedge — most profile visits are first contact. Something closer to "The phone answers itself. Orders land on one screen." Not blocking; a one-line change whenever you decide |
| 7 | ~~Which asset is the existing 2026-08-27 post?~~ | **Resolved 2026-09-13:** `dialtone_foodtruck_001_insta.mp4`. Ingest it with a backdated synthetic `social_posts` row (`status = 'published'`, `published_at = 2026-08-27`) so the reuse window and the days-since-last-post metric both start from truth rather than from M1 |
| 8 | ~~Is the Facebook target a Page or a personal profile?~~ | **Resolved 2026-09-13:** it is a Page. Facebook publishing is unblocked; capture `pageId` in M0 |
| 9 | ~~Geo conflict: Memphis or Nashville?~~ | **Resolved 2026-09-13:** Nashville is the company's location; the market is **national**. All geographic tags and regional copy are banned (§6.1). `insta_hashtags.md` needs a matching amendment — it still lists `#MemphisEats` / `#901Eats` |
