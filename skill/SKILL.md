---
name: servicetitan-bridge
description: >
  When the user asks about today's jobs, the board, open estimates, overdue invoices,
  schedule gaps, or ServiceTitan schedule — use the ServiceTitan MCP tools. Morning
  digests and follow-up drafts only; never message customers without explicit approval.
---

# ServiceTitan ↔ Grok Bot

## When to use
- “What’s on the board today / tomorrow?”
- Open estimates, overdue invoices, who has a gap this afternoon
- Draft a follow-up for a customer (estimate, invoice, job reminder)

## Rules
1. **Read-only by default.** Prefer `list_jobs_today`, `list_jobs_range`, `list_open_estimates`, `list_overdue_invoices`, `list_schedule_gaps`, `get_job`.
2. **Never send** email, SMS, or ServiceTitan messages to customers. `draft_customer_followup` returns text only — show the draft and wait for the owner to approve recipient + exact wording (use send-on-behalf / DraftExternalMessage only after that yes).
3. Times are **America/Denver** unless the user says otherwise.
4. If a tool returns `LICENSE_REQUIRED`, tell the user to subscribe on the hosted bridge landing page (or set `MOCK=1` for demo data).
5. Mock mode (`MOCK=1`) uses fixture data — say so when answering so they don’t treat it as live board data.

## Morning digest template
1. `list_jobs_today` → count, by tech, first/last job
2. `list_schedule_gaps` for today → fill-in opportunities
3. `list_overdue_invoices` → total balance + top 3
4. `list_open_estimates` → aging / expiring soon
5. Offer: “Want a draft reminder for any of these? I won’t send without your yes.”

## License
Paid hosted bridge issues `ST-XXXX-XXXX-XXXX-XXXX`. Set as `ST_LICENSE_KEY` on the MCP process. Marketplace plugin listing itself is free.
