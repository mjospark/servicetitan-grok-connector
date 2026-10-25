# Nap briefing — ServiceTitan Grok Bridge

Built while you slept. **No money spent.** Nothing charged to you. Payments are wired so cash goes to **your** Stripe when you add keys.

## Already running now
Landing server is up: **http://localhost:8787** (demo mode — subscribe with any email → get a license key, no charge).
If it's down: `cd /workspace/servicetitan-connector && npm run start:web`


## Where it lives
`/workspace/servicetitan-connector/`

| Path | What |
|------|------|
| `src/mcp/server.ts` | MCP tools (read-only + draft-only followups) |
| `src/st/` | Mock + live ServiceTitan clients |
| `src/license/` | License keys JSON store + gate |
| `src/web/server.ts` | Landing API + **Stripe Checkout + webhook** |
| `web-public/` | Landing + success pages |
| `skill/SKILL.md` | Grok Bot skill |
| `assets/` | Logo SVG + marketplace listing copy |
| `outreach/` | X posts, wishlist note, trades script |
| `data/` | Created at runtime (`licenses.json`) |

## How to run (30 seconds)
```bash
cd /workspace/servicetitan-connector
cp -n .env.example .env
npm install
npm test
npm run dev:web    # → http://localhost:8787
```
Open the landing page → enter email → **Get demo license** → success page shows `ST-XXXX-…`.  
That proves signup → license issuance. Stripe keys flip it to real (test) charges.

---

## Honest reach limit (~10k impressions)
**We cannot mass-DM 10k Grok/X users from here.** No tool does that; it would also be spam.

**Highest leverage when you wake (public channels):**
1. Post **Post 1** from `outreach/X_POSTS.md` on your X account, tags `@grok` `@bot`
2. Paste wishlist blurb on https://grokbot.tools/requests (`outreach/WISHLIST_NOTE.md`)
3. Submit free marketplace listing: https://x.ai/bot/marketplace/submit-a-plugin (`assets/MARKETPLACE_LISTING.md`)
4. Warm DMs only — script in `outreach/TRADES_SCRIPT.md` (associates, wishlist commenters, your network)

Organic posts + marketplace + wishlist are the path to ~10k impressions. No ads bought.

---

## Exact next 3 clicks when you wake
1. **Browser →** http://localhost:8787 (start `npm run dev:web` first if needed) → subscribe with your email → copy the demo license key. Confirms the money loop works locally.
2. **Browser →** https://dashboard.stripe.com/register → create **free** Stripe account → Products → add “ServiceTitan Grok Bridge” at **$49/month** recurring → copy Price id + **test** secret/publishable keys into `.env` → restart web → subscribe again with test card `4242 4242 4242 4242`. Money stays in test mode until you switch to live keys.
3. **Browser →** https://x.ai/bot/marketplace/submit-a-plugin → paste copy from `assets/MARKETPLACE_LISTING.md` + `assets/logo.svg` → submit **free** listing. Then post Post 1 from `outreach/X_POSTS.md` (add landing URL once hosted).

Optional 4th: https://developer.servicetitan.io → apply for partner API (live jobs need this; mock works meanwhile).

---

## What’s complete vs blocked on your keys

| Item | Status |
|------|--------|
| MCP tools + mock fixtures | ✅ Done — `npm test` green |
| License gate (mock always on; live needs key) | ✅ Done |
| Landing + demo license issuance | ✅ Done |
| Stripe Checkout session create | ✅ Code ready — needs **your** `STRIPE_SECRET_KEY` + `STRIPE_PRICE_ID` |
| Stripe webhook → issue/revoke license | ✅ Code ready — needs webhook secret + public URL |
| Live ServiceTitan API | 骨架 ready — needs **your** ST partner credentials + `MOCK=0` |
| Marketplace listed | ⏳ You submit (free) |
| Public HTTPS host (Railway/Fly free) | ⏳ You deploy when ready — documented in README |
| Domain | ⏳ Not bought (per no-spend) — use `*.railway.app` / `*.fly.dev` |
| Ads / 10k DMs | ❌ Not done / not possible — outreach pack instead |

---

## Flip Stripe test → live (when you’re ready to collect real $)
1. Stripe Dashboard → activate account (bank info — your business)
2. Create **live** product/price $49/mo → copy live `price_…`
3. `.env`: `sk_live_…`, `pk_live_…`, live `STRIPE_PRICE_ID`
4. Host web with HTTPS; Developers → Webhooks → `https://YOUR_HOST/api/stripe/webhook`  
   Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Paste `whsec_…` into `STRIPE_WEBHOOK_SECRET`
6. Smoke with a real card once; confirm `data/licenses.json` gets a row and key shows on `/success.html`

**Money always settles to the Stripe account whose keys are in `.env` — yours, not anyone else’s.**

---

## Product reminder
- Free plugin listing (legal requirement for marketplace)
- Paid = hosted bridge + license
- Bot never emails customers without your explicit yes (`draft_customer_followup` only)
