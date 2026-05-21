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
- Preserve CI deploy secret checks (`RESEND_API_KEY` and at least one Supabase DB key).

---

## SEO Standards & Instructions

### Target Keywords (as of 2026-05-21)
- Primary: `voice ai agent for restaurants`
- Primary: `agentic workflow for restaurants`
- Supporting: `restaurant phone ordering ai`, `ai phone answering for restaurants`, `automated phone ordering system`, `restaurant voice assistant`, `ai order taking for restaurants`

### On-Page SEO — Required on Every Page
When creating or updating any HTML page, always verify/apply the following:

1. **`<title>` tag** — Must include at least one target keyword naturally. Keep under 60 characters. Format: `[Keyword Phrase] | DialTone` or `DialTone — [Keyword Phrase]`.

2. **`<meta name="description">`** — 140–160 characters. Include the primary keyword naturally. This is the search result snippet — make it conversion-worthy, not just keyword-stuffed.

3. **Open Graph tags** — `og:title`, `og:description`, `og:type`, `og:url`, `og:image` must all be present. `og:image` should point to `https://dialtone.menu/images/dialtone-banner.png` (1200×630) on the homepage.

4. **Twitter Card tags** — `twitter:card` (use `summary_large_image`), `twitter:title`, `twitter:description` must mirror OG tags.

5. **`<link rel="canonical">`** — Every page must have a canonical pointing to its own full `https://dialtone.menu/[page].html` URL (homepage uses `https://dialtone.menu/`).

6. **`<meta name="keywords">`** — Include 6–10 long-tail keyword variants. Comma-separated. Refresh when targeting new search terms.

7. **JSON-LD structured data** — The homepage carries a `SoftwareApplication` schema. Keep it updated when product details change (pricing, description, contact). Use `https://schema.org/` types. Validate at https://search.google.com/test/rich-results after changes.

### Body Copy Keyword Placement Rules
- **`<h1>`** — Conversion-optimized. Do not force keywords into the H1 unless it reads naturally.
- **First `<p>` below H1** — Must contain the primary keyword phrase naturally (e.g., "DialTone is a voice AI agent for restaurants that…").
- **Section headings (`<h2>`, `<h3>`)** — At least one should include a target keyword or close variant.
- **Supporting paragraphs** — Use keyword variants, not exact repetition. Avoid keyword stuffing.

### Sitemap & Robots
- `public/sitemap.xml` — List all indexable pages with `<lastmod>`, `<changefreq>`, and `<priority>`. Update `<lastmod>` whenever a page's content changes. Homepage priority = `1.0`; content pages = `0.8`; legal pages = `0.3`. **Never include `404.html`.**
- `public/robots.txt` — Must point `Sitemap:` to `https://dialtone.menu/sitemap.xml`. Keep `Disallow: /admin/` and `Disallow: /api/`. GPTBot is blocked (`User-agent: GPTBot / Disallow: /`).

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
