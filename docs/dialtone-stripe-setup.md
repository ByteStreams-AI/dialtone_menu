map out exactly what to enable, because hybrid needs both Connect and Billing configured correctly from the start.

---

## Revenue Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                                                                                                                                   │
│  REVENUE STREAM 1: Per-transaction platform fee                                                                                     │
│  ─────────────────────────────────────────────                                                     │
│  Diner pays $42.00 via Stripe Checkout                                                                                                             │
│         │                                                       │
│         ├──► $40.74 → Restaurant's Connect account                                                            │
│         ├──► $1.26  → DialTone platform fee (3%)                │
│         └──► Stripe fees deducted from restaurant side          │
│                                                                 │
│  Implementation: Connect + `application_fee_amount`             │
│  Works for: ALL restaurants on the platform                     │
│                                                                 │
│                                                                 │
│  REVENUE STREAM 2: Optional subscription tiers                  │
│  ─────────────────────────────────────────────                  │
│  Restaurant subscribes to a tier → monthly charge               │
│         │                                                       │
│         ├──► Free tier: 3% platform fee, voice ordering only    │
│         ├──► Pro $99/mo: 2% platform fee, + reservations        │
│         └──► Growth $299/mo: 1.5% fee, + analytics, + priority  │
│                                                                 │
│  Implementation: Stripe Billing (subscriptions)                 │
│  Key: Tier determines the platform fee % on their transactions  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key design principle:** The tier a restaurant is on controls their `application_fee_amount` percentage. Your Cloudflare Worker reads tier from Supabase when building the Checkout session. One source of truth, simple logic.

---

## What to Enable in Stripe

**Go back to that product selection screen and check:**

| Product | Check? | Why |
|---|---|---|
| Managed Payments | ✓ (already on) | Core payments — non-negotiable |
| **Recurring payments** | ✓ | Subscription tiers for restaurants |
| Usage-based billing | ✗ | Not needed for flat-tier subscriptions. Add later only if you want per-call/per-order metering |
| Invoicing | ✗ | Not needed. Subscriptions handle recurring billing automatically. Skip unless you need custom invoicing |

**Then the critical step** — after completing this product selection, find the "Connect to a platform instead" link at the bottom, OR navigate to **Settings → Connect → Get Started** to enable **Connect** as a separate setup.

You need **both** products activated:
- **Stripe Billing** (Recurring payments) — for restaurant subscriptions
- **Stripe Connect** — for diner → restaurant payment flow with platform fees

---

## The Setup Order (Important)

Don't do these in parallel — sequencing matters:

**1. Complete standard Stripe account setup first**
- Finish the product selection flow
- Verify your business details (they'll ask for EIN, address, bank account)
- Use the same CP-575 info: BYTESTREAMS LLC, 501 UNION ST STE 545 NUM 838628, etc.
- Connect your business bank account for payouts (this is where Stripe pays *you* — platform fees + subscription revenue)

**2. Enable Stripe Connect as a platform**
- Settings → Connect → Get Started
- Choose **Standard** (not Express, not Custom)
- Complete platform profile (I'll detail this below)

**3. Set up your subscription products**
- Products → Create three products: `DialTone Free`, `DialTone Pro`, `DialTone Growth`
- Each with a recurring price ($0, $99/mo, $299/mo)
- Tag each with metadata: `platform_fee_bps: 300` (Free), `200` (Pro), `150` (Growth) — basis points for the fee lookup

**4. Build the restaurant onboarding flow**
- Restaurant signs up → creates Stripe Connect account (OAuth flow via Standard Connect)
- Restaurant picks a subscription tier → Stripe Billing subscription created
- Your Supabase stores: restaurant_id, stripe_connect_account_id, subscription_tier, platform_fee_bps

---

## Stripe Connect Platform Profile — Fields to Get Right

When you hit the Connect setup, here's what to put:

**Platform name:** `DialTone`

**Platform URL:** `https://dialtone.menu`

**Platform business description:** 
> "DialTone is an AI voice ordering platform for restaurants. Customers call the restaurant and place orders via an AI voice agent. DialTone processes the payment through Stripe Connect, routing funds to the restaurant's Stripe account minus a platform fee. Restaurants can optionally subscribe to premium tiers for additional features."

**Expected platform transaction volume:** honest estimate for year 1 — "$0-$100K" is fine for MVP stage

**Industries you serve:** Food & beverage, restaurants

**How will restaurants onboard?** Self-service via Stripe Connect OAuth flow

**Who bears chargeback liability?** The restaurant (their merchant of record status) — this is the Standard Connect default and what you want

**Marketing URL / public-facing info:** `https://dialtone.menu` (make sure the site has at minimum: what DialTone is, who it's for, pricing transparency, contact info)

**Logo:** You'll need a DialTone logo PNG, 512x512 or similar. Even a simple text-based one works for now.

---

## One Thing to Prepare on dialtone.menu Before Stripe Connect Review

Stripe Connect platform applications get reviewed by their compliance team. They look at your platform URL. If dialtone.menu is still a placeholder per your notes, that's a problem for Connect approval.

**Minimum viable dialtone.menu for Connect approval:**

- Landing page explaining what DialTone does (one paragraph is fine)
- "For Restaurants" section describing pricing / how it works
- Privacy policy page
- Terms of service page  
- Contact info (scotton@bytestreams.ai or hello@bytestreams.ai works)

Privacy policy and ToS don't need to be bespoke for MVP — use a generator like termly.io or iubenda, or base on Stripe's own sample platform agreements. Just need them to exist at stable URLs.

If dialtone.menu isn't ready for public consumption yet, **stop here and spin up the landing page first** before submitting Connect platform application. A rejection on Connect for "incomplete platform website" takes longer to recover from than building a simple landing page would.

---

## Data Model Implication for Supabase

Since DialTone Schema v1.0 already exists per your notes, confirm it has (or add):

```sql
-- Restaurants table (or equivalent)
stripe_connect_account_id  text         -- "acct_xxx"
stripe_subscription_id     text         -- "sub_xxx" (null for free tier)
subscription_tier          text         -- 'free' | 'pro' | 'growth'
platform_fee_bps           integer      -- basis points: 300, 200, 150

-- Per-order tracking
stripe_checkout_session_id text
stripe_payment_intent_id   text
platform_fee_amount_cents  integer      -- calculated at charge time
```

You probably have most of this already. Worth a quick schema audit.

---

## Your Next 3 Actions

1. **Close/adjust the current Stripe product flow:** uncheck Usage-based and Invoicing, keep Recurring payments checked
2. **Finish standard account setup** (business details, bank account)
3. **Check dialtone.menu** — is it ready for Stripe Connect compliance review, or do you need to build the landing page first?

What does dialtone.menu currently show? That's the gating question for whether you can submit Connect platform application today or need to ship the landing page first.