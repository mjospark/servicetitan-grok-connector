# ServiceTitan ↔ Grok Bot Connector

Free **marketplace plugin** + **paid hosted MCP bridge** for trade businesses on ServiceTitan.

- Marketplace listing: **must stay free** ([Publisher Terms](https://cursor.com/marketplace-publisher-terms) / [Submit a plugin](https://x.ai/bot/marketplace/submit-a-plugin))
- Monetization: hosted bridge subscription via **your** Stripe Checkout → license keys
- Built for BrightPath Electrical (Utah); MIT so others can self-host

## Quick start (local, $0)

```bash
cd /workspace/servicetitan-connector
cp .env.example .env          # MOCK=1 by default
npm install
npm test                      # smoke: mock client + license gate
npm run dev:web               # http://localhost:8787 — demo signup issues a key
npm run dev:mcp               # stdio MCP server (fixture data)
```

### Env highlights
| Var | Purpose |
|-----|---------|
| `MOCK=1` | Fixture data; no ST or Stripe needed |
| `SERVICE_TITAN_*` | Partner API creds when `MOCK=0` |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` | Your Stripe **test** then **live** keys |
| `ST_LICENSE_KEY` / `LICENSE_KEY` | Gate for live API calls |
| `LICENSE_STORE_PATH` | JSON file of issued licenses |

## Architecture

```
Grok Bot ──stdio/MCP──► MCP server ──► ServiceTitan API (or mock)
                              ▲
                              │ license check (skip if MOCK=1)
Landing/Signup ──Stripe Checkout──► webhook ──► licenses.json
```

**Tools:** `list_jobs_today`, `list_jobs_range`, `get_job`, `list_open_estimates`, `list_overdue_invoices`, `list_schedule_gaps`, `draft_customer_followup` (text only).

## Payments (money → Matthew’s Stripe)

1. Create a free Stripe account at stripe.com (you do this in the browser).
2. Put **test** keys in `.env` (`sk_test_…`, `pk_test_…`, `price_…` for a $49/mo product).
3. `npm run dev:web` → subscribe → Checkout → webhook/`license-by-session` issues `ST-XXXX-…`
4. Flip live: replace with `sk_live_` / `pk_live_` / live price id; set webhook secret; host on Railway/Fly free tier.

Demo mode (no Stripe keys): landing still issues a local license key so the loop is testable tonight.

## Host later (still free tier)

- **Railway / Fly.io / Render** free tier: deploy `node dist/web/server.js` + MCP separately
- Point `PUBLIC_BASE_URL` at the public HTTPS URL
- Stripe webhook endpoint: `POST https://YOUR_HOST/api/stripe/webhook`

## ServiceTitan partner API

1. https://developer.servicetitan.io — apply for partner / API access  
2. Create app → client id, secret, app key; note tenant id  
3. Set `MOCK=0` + `SERVICE_TITAN_*` + active license key  

Until approved, ship demos on `MOCK=1`.

## Skill

See `skill/SKILL.md` — morning digest, never message customers without approval.

## Outreach

See `outreach/` and `NAP_BRIEFING.md` for X posts, wishlist note, and trades script.
