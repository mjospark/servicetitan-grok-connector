# Stripe setup (your account — money to you)

## Test mode (tonight / this week)
1. https://dashboard.stripe.com/register — free account
2. Toggle **Test mode** ON (top right)
3. Products → Add product → Name: `ServiceTitan Grok Bridge` → Recurring **$49 / month**
4. Copy the **Price ID** (`price_…`)
5. Developers → API keys → copy **Secret** (`sk_test_…`) and **Publishable** (`pk_test_…`)
6. Put them in `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_PRICE_ID=price_...
   PUBLIC_BASE_URL=http://localhost:8787
   ```
7. Restart web. Landing button becomes real Checkout.
8. Pay with test card `4242 4242 4242 4242`, any future expiry, any CVC.
9. Success page shows license key; also written to `data/licenses.json`.

### Webhook (local)
```bash
# Install Stripe CLI yourself when ready (free): https://stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:8787/api/stripe/webhook
# paste whsec_… into STRIPE_WEBHOOK_SECRET
```
Events handled: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

Without the CLI, `/api/license-by-session` still issues the key on the success redirect (backup path).

## Live mode (real money → your bank)
1. Activate Stripe account (business + bank)
2. Create the same product in **Live** mode; new live `price_…`
3. Swap `.env` to `sk_live_…` / `pk_live_…` / live price
4. Host on HTTPS (Railway/Fly free tier); set `PUBLIC_BASE_URL`
5. Dashboard → Webhooks → endpoint `https://YOUR_HOST/api/stripe/webhook` → copy `whsec_…`

**Never commit live secret keys. Money always goes to whichever Stripe account owns the keys in `.env`.**
