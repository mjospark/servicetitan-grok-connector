# Marketplace listing (FREE — do not charge for install)

**Submit:** https://x.ai/bot/marketplace/submit-a-plugin  
**Publisher terms:** listing must be free (no charge for install/use of the marketplace plugin itself). Monetization = separate hosted bridge (this repo’s web signup).

## Short description (≤160 chars)
ServiceTitan board in Grok Bot: today’s jobs, estimates, overdue invoices, schedule gaps. Read-only. Hosted bridge is a separate paid sub.

## Long description
Connect ServiceTitan to Grok Bot for trade businesses (electrical, HVAC, plumbing).

**Tools (read-only):**
- list_jobs_today / list_jobs_range / get_job
- list_open_estimates / list_overdue_invoices
- list_schedule_gaps
- draft_customer_followup (text only — never auto-sends)

**Auth:** ServiceTitan partner OAuth (client id/secret/tenant/app key) **or** `MOCK=1` for demo fixtures. Paid hosted bridge issues a license key (`ST_LICENSE_KEY`) required for live API calls.

**Not affiliated** with ServiceTitan, Inc. or xAI.

## Testing instructions (for reviewers)
1. `cd servicetitan-connector && cp .env.example .env && npm i && npm test`
2. `MOCK=1 npm run dev:mcp` — stdio MCP with fixture jobs for 2026-10-25
3. `npm run dev:web` — open http://localhost:8787 — subscribe in demo mode → license key issued, no Stripe charge
4. Confirm tools return JSON with `mock: true` and never send email

## Logo
`assets/logo.svg` (1:1). Export PNG 512×512 if the form requires raster.
