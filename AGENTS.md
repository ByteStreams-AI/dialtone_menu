# Agent Instructions

## PR Review Comment Handling
- When asked to address PR review comments, always post a reply comment on the PR summarizing what was changed and how it was validated.
- Do not assume code changes alone are sufficient; leave an explicit PR thread response unless the user says not to.
- Do not merge or close a PR unless explicitly asked.

## Landing Page Lead Capture Conventions
- Keep one canonical submission form in the bottom waitlist section (`#waitlist`).
- Keep the hero area CTA-only (anchor link to `#waitlist`), not a duplicate submission form.
- Waitlist payload fields are: `name`, `restaurantName`, `email`, and `message`.
- If freeform notes are omitted in the UI, send a non-empty fallback message so `/api/contact` validation still passes.

## Contact API Data Flow Conventions
- `/api/contact` requires `name`, `restaurantName`, `email`, and `message`.
- Persistence is fail-fast: Supabase insert must succeed before sending email.
- Response semantics:
	- `503` when Supabase config is incomplete.
	- `502` when Supabase insert or provider send fails.
	- `200` only when persistence succeeds and email send succeeds.

## Production Baseline (Post PR #23)
- The rebrand + waitlist pipeline shipped and is now the production baseline on `main`.
- Keep `/api/contact` IP rate limiting in place using `CF-Connecting-IP` before DB/email calls.
- Keep secrets out of git (`.env.supabase`, `supabase/.temp/`); rotate immediately if exposure is suspected.
- Preserve CI deploy secret checks (at least one Supabase DB key required).
- Email notifications go to `hello@dialtone.menu` (Google Workspace); sent via Cloudflare Email Service binding (`env.EMAIL`).

---

## Marketing Positioning

- Lead with **DialTone as a restaurant operating system**, not as an AI product or AI agent.
- Phone answering is the primary differentiator: explain immediately that DialTone answers the restaurant's phone, takes orders and reservations, and sends orders into the same payment and kitchen flow.
- Use this message hierarchy in prospect-facing copy: **restaurant operating system first; phone answering second; connected ordering, payments, kitchen flow, and delivery next**.
- Do not use `voice AI`, `AI agent`, `AI-powered`, or similar AI-first category labels in marketing headlines, metadata, calls to action, pricing bullets, or opening product descriptions. Restaurant operators have responded negatively to AI-led positioning in cold calls and demos.
- Describe the customer outcome in plain language: every call answered, orders captured, payments connected, and tickets routed to the kitchen.
- Legal, privacy, consent, and compliance copy may and should identify automation, artificial intelligence, transcription, recording, or model limitations when accurate disclosure requires it. Do not remove or soften those disclosures to satisfy marketing language rules.
- Technical and internal engineering documentation may use precise AI terminology when it is needed to describe architecture or behavior.

---

## SEO Standards & Instructions

### Target Keywords (as of 2026-07-28)
- Primary: `restaurant operating system`
- Primary: `restaurant operations platform`
- Supporting: `restaurant phone answering system`, `automated restaurant phone ordering`, `restaurant order management system`, `restaurant kitchen display system`, `restaurant ordering platform`

### On-Page SEO — Required on Every Page
When creating or updating any HTML page, always verify/apply the following:

1. **`<title>` tag** — Must include at least one target keyword naturally. Keep under 60 characters. Format: `[Keyword Phrase] | DialTone` or `DialTone — [Keyword Phrase]`. Do not use AI-first category labels.

2. **`<meta name="description">`** — 140–160 characters. Include a primary keyword naturally, then make phone answering the lead differentiator where relevant. This is the search result snippet — make it conversion-worthy, not just keyword-stuffed.

3. **Open Graph tags** — `og:title`, `og:description`, `og:type`, `og:url`, `og:image` must all be present. `og:image` should point to `https://dialtone.menu/images/dialtone-banner.png` (1200×630) on the homepage.

4. **Twitter Card tags** — `twitter:card` (use `summary_large_image`), `twitter:title`, `twitter:description` must mirror OG tags.

5. **`<link rel="canonical">`** — Every page must have a canonical pointing to its own full `https://dialtone.menu/[page].html` URL (homepage uses `https://dialtone.menu/`).

6. **`<meta name="keywords">`** — When present, keep 6–10 relevant long-tail variants, comma-separated. Google does not use this tag for ranking, so prioritize titles, descriptions, visible copy, internal links, and useful content.

7. **JSON-LD structured data** — The homepage carries connected `Organization`, `WebSite`, and `SoftwareApplication` entities plus visible-FAQ-matched `FAQPage` data. Feature detail pages carry `BreadcrumbList` data matching their visible `Features / Page` breadcrumb. Keep pricing, descriptions, contact details, URLs, and visible copy synchronized with schema. Use `https://schema.org/` types and validate with Google's [Rich Results Test](https://search.google.com/test/rich-results) after changes.

8. **Social metadata** — Indexable marketing and legal pages must include complete Open Graph and Twitter card metadata. Keep social titles and descriptions aligned with the page's current positioning.

### Body Copy Keyword Placement Rules
- **`<h1>`** — Every indexable page must have exactly one visible `<h1>`. Keep it conversion-optimized; do not force keywords into it unless they read naturally.
- **First `<p>` below H1** — Establish DialTone as a restaurant operating system or restaurant operations platform, then explain that it answers the phone and connects orders to payment and kitchen flow.
- **Section headings (`<h2>`, `<h3>`)** — At least one should include a target keyword or close variant.
- **Supporting paragraphs** — Use keyword variants, not exact repetition. Avoid keyword stuffing.
- **Internal links** — Link related feature concepts in body copy with descriptive anchor text where useful; do not rely only on global navigation.

### Structured Data Contracts
- Homepage software pricing must match the published paid plans. Current aggregate range: `$199`–`$399`, with three standard paid offers; Pilot and custom Enterprise pricing are not represented in that range.
- FAQ structured data must contain only questions and answers visible to visitors on the same page, with matching wording.
- Feature-page breadcrumb JSON-LD must mirror the visible breadcrumb. The visible breadcrumb is part of the page UI; JSON-LD is machine-readable and not separately rendered.
- Do not add schema solely to target a rich result. It must accurately describe visible page content.

### Sitemap & Robots
- `public/sitemap.xml` — List all indexable pages with `<lastmod>`, `<changefreq>`, and `<priority>`. Update `<lastmod>` whenever a page's content changes. Homepage priority = `1.0`; content pages = `0.8`; legal pages = `0.3`. **Never include `404.html`.**
- `public/robots.txt` — Must point `Sitemap:` to `https://dialtone.menu/sitemap.xml`. Keep `Disallow: /admin/` and `Disallow: /api/`. GPTBot is blocked (`User-agent: GPTBot / Disallow: /`).

### SEO Validation
- Run `pnpm run test:seo` after changing public-page metadata, headings, canonicals, schema, breadcrumbs, FAQ copy, or sitemap entries.
- The SEO suite enforces concise titles, 140–160 character descriptions, self-canonicals, one `<h1>`, required social tags, parseable JSON-LD, homepage entity/pricing accuracy, visible FAQ parity, feature breadcrumbs, sitemap coverage, and `404.html` exclusion/noindex behavior.
- Also run `pnpm run test:robots` after changing sitemap or robots behavior.

### After Any Deployment
1. Submit `https://dialtone.menu/sitemap.xml` in Google Search Console → Sitemaps.
2. Use URL Inspection → Request Indexing on any page with major content changes.
3. Monitor Search Console for crawl errors weekly.

### Long-Term Traffic Drivers (Do These)
These are not code tasks — they are ongoing growth actions that compound over time:

- **Google Search Console** — Must be set up before first deploy. Verify domain ownership, submit sitemap, monitor impressions and click-through rates monthly.
- **Directory Listings** — Submit to: Product Hunt, G2, Capterra, GetApp, Yelp for Business, Clutch.co. Each listing = a backlink + independent traffic source. Prioritize G2 and Capterra for B2B restaurant tech searches.
- **Backlinks** — Target restaurant industry blogs, local business journals, and food service trade publications. A single editorial mention from a relevant site carries more ranking weight than all on-page SEO combined.
- **Content Marketing** — Create one blog post per month targeting a long-tail keyword restaurants actually search (e.g., "how to stop missing restaurant phone orders during dinner rush", "restaurant phone ordering system comparison"). Host at `/blog/[slug].html` and add each to `sitemap.xml`.
- **Social Proof / Press** — Any media coverage or customer quotes should be added to the homepage and linked back to from the source. Signals trust to both users and Google.
- **Page Speed** — Run Lighthouse on `https://dialtone.menu` monthly. Core Web Vitals (LCP, CLS, FID) are ranking signals. Target LCP < 2.5s.
