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
