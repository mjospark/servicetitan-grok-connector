/**
 * Landing + free signup + Stripe Checkout for the paid hosted ServiceTitan bridge.
 * Free tier issues a working license with no card. Paid ($49/mo) uses Stripe when keys are set.
 * Money goes to Matthew's Stripe account when HE adds his keys.
 */
import "dotenv/config";
import express from "express";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import {
  findByKey,
  findBySession,
  issueLicense,
  setStatusByCustomer,
} from "../license/store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../../web-public");
const PORT = Number(process.env.WEB_PORT ?? 8787);
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`).replace(
  /\/$/,
  ""
);

const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
const priceId = process.env.STRIPE_PRICE_ID ?? "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const stripeReady =
  (stripeKey.startsWith("sk_test_") || stripeKey.startsWith("sk_live_")) &&
  !stripeKey.includes("REPLACE");

const stripe = stripeReady
  ? new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" })
  : null;

const paidCheckoutUrl = (process.env.PAID_CHECKOUT_URL ?? "").trim();
/** Gumroad / Whop / any hosted pay link — no Stripe keys needed. */
function externalPaid(): boolean {
  return paidCheckoutUrl.startsWith("http://") || paidCheckoutUrl.startsWith("https://");
}

const app = express();

/** Demo checkout when Stripe keys aren't set — still issues a local pro license (no charge). */
function demoMode(): boolean {
  return !stripe || !priceId || priceId.includes("REPLACE");
}

function validEmail(email: string): boolean {
  return !!email && email.includes("@");
}

// Stripe webhook needs raw body — mount BEFORE json parser
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe) {
      res.status(503).json({ error: "Stripe not configured" });
      return;
    }
    let event: Stripe.Event;
    try {
      if (webhookSecret && !webhookSecret.includes("REPLACE")) {
        const sig = req.headers["stripe-signature"];
        if (!sig || Array.isArray(sig)) {
          res.status(400).send("Missing stripe-signature");
          return;
        }
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        event = JSON.parse(req.body.toString("utf8")) as Stripe.Event;
        console.warn(
          "[webhook] STRIPE_WEBHOOK_SECRET not set — accepting unsigned events (dev only)"
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[webhook] verify failed", msg);
      res.status(400).send(`Webhook Error: ${msg}`);
      return;
    }

    try {
      await handleStripeEvent(event);
      res.json({ received: true });
    } catch (err) {
      console.error("[webhook] handler error", err);
      res.status(500).json({ error: "handler failed" });
    }
  }
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    demoMode: demoMode(),
    stripeConfigured: !!stripe,
    priceConfigured: !!(priceId && !priceId.includes("REPLACE")),
    freeTier: true,
    externalPaid: externalPaid(),
    paidCheckoutConfigured: externalPaid(),
    publicBase: PUBLIC_BASE,
  });
});

app.get("/api/config", (_req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
    demoMode: demoMode(),
    priceLabel: "$49/mo",
    productName: "ServiceTitan Grok Bridge — Pro",
    freeTier: true,
    freeLabel: "Free",
    externalPaid: externalPaid(),
    paidProvider: externalPaid() ? "external" : stripe ? "stripe" : "demo",
  });
});

/**
 * Free tier: working license, no card, never touches Stripe.
 */
app.post("/api/signup/free", (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!validEmail(email)) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }

  const license = issueLicense({
    email,
    plan: "free",
    status: "active",
    stripeSessionId: `free_${Date.now()}_${email}`,
  });
  res.json({
    free: true,
    plan: "free",
    licenseKey: license.key,
    message: "Free license issued. No card required.",
    successUrl: `${PUBLIC_BASE}/success.html?free=1&key=${encodeURIComponent(license.key)}&email=${encodeURIComponent(email)}`,
  });
});

/** Start Checkout Session (or demo pro license when Stripe keys aren't set). */
app.post("/api/checkout", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!validEmail(email)) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }

  // Prefer hosted pay link (Gumroad / Whop / etc.) — no Stripe keys required
  if (externalPaid()) {
    const sep = paidCheckoutUrl.includes("?") ? "&" : "?";
    const url = `${paidCheckoutUrl}${sep}wanted=true&email=${encodeURIComponent(email)}`;
    // Issue Pro license now; Gumroad/Whop is the paywall buyers must complete.
    // Set the product's "Redirect after purchase" to:
    //   ${PUBLIC_BASE}/success.html?paid=1&email=...
    // For localhost demos without redirect, license is still issued after email submit
    // once they return — use /api/signup/pro-after-pay from success?paid=1
    const license = issueLicense({
      email,
      plan: "pro",
      status: "active",
      stripeSessionId: `ext_${Date.now()}_${email}`,
    });
    res.json({
      demo: false,
      external: true,
      plan: "pro",
      licenseKey: license.key,
      url,
      message:
        "Redirecting to hosted checkout (no Stripe keys). Money goes to your Gumroad/Whop account.",
      // Show key after they click through; also pass so Gumroad redirect can land on success
      successUrl: `${PUBLIC_BASE}/success.html?external=1&key=${encodeURIComponent(license.key)}&email=${encodeURIComponent(email)}`,
    });
    return;
  }

  if (demoMode()) {
    const license = issueLicense({
      email,
      plan: "pro-demo",
      status: "active",
      stripeSessionId: `demo_${Date.now()}_${email}`,
    });
    res.json({
      demo: true,
      plan: "pro-demo",
      licenseKey: license.key,
      message:
        "No paid checkout URL and no Stripe keys. Pro demo license issued with no charge. " +
        "Set PAID_CHECKOUT_URL to your Gumroad/Whop product link to collect real payments without Stripe keys.",
      successUrl: `${PUBLIC_BASE}/success.html?demo=1&key=${encodeURIComponent(license.key)}&email=${encodeURIComponent(email)}`,
    });
    return;
  }

  try {
    const session = await stripe!.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${PUBLIC_BASE}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_BASE}/?canceled=1`,
      metadata: { product: "servicetitan-grok-bridge", email, plan: "pro" },
      subscription_data: {
        metadata: { product: "servicetitan-grok-bridge", email, plan: "pro" },
      },
      allow_promotion_codes: true,
    });
    res.json({ demo: false, url: session.url, sessionId: session.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[checkout]", msg);
    res.status(500).json({ error: msg });
  }
});

/** After Checkout redirect: fetch/create license for session. */
app.get("/api/license-by-session", async (req, res) => {
  const sessionId = String(req.query.session_id ?? "");
  if (!sessionId) {
    res.status(400).json({ error: "session_id required" });
    return;
  }

  const existing = findBySession(sessionId);
  if (existing) {
    res.json({ licenseKey: existing.key, email: existing.email, status: existing.status });
    return;
  }

  if (demoMode() || !stripe) {
    res.status(404).json({ error: "Session not found (demo mode uses success URL params)" });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });
    if (session.payment_status !== "paid" && session.status !== "complete") {
      res.status(402).json({ error: "Payment not complete", status: session.status });
      return;
    }
    const email =
      session.customer_details?.email ||
      session.customer_email ||
      session.metadata?.email ||
      "unknown@example.com";
    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id;
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;

    const license = issueLicense({
      email,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subId,
      stripeSessionId: session.id,
      plan: "pro",
      status: "active",
    });
    res.json({
      licenseKey: license.key,
      email: license.email,
      status: license.status,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

app.get("/api/license/validate", (req, res) => {
  const key = String(req.query.key ?? "");
  const rec = findByKey(key);
  if (!rec) {
    res.status(404).json({ valid: false });
    return;
  }
  res.json({
    valid: rec.status === "active" || rec.status === "trialing",
    status: rec.status,
    plan: rec.plan,
    email: rec.email,
  });
});

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" && session.mode !== "payment") break;
      const email =
        session.customer_details?.email ||
        session.customer_email ||
        session.metadata?.email ||
        "unknown@example.com";
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      const license = issueLicense({
        email,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subId,
        stripeSessionId: session.id,
        plan: "pro",
        status: "active",
      });
      console.log(`[webhook] issued license ${license.key} for ${email}`);
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const statusMap: Record<string, "active" | "past_due" | "canceled" | "trialing"> = {
        active: "active",
        trialing: "trialing",
        past_due: "past_due",
        canceled: "canceled",
        unpaid: "past_due",
        incomplete: "past_due",
        incomplete_expired: "canceled",
        paused: "past_due",
      };
      const mapped = statusMap[sub.status] ?? "past_due";
      const customerId = String(sub.customer);
      const updated = setStatusByCustomer(customerId, mapped);
      console.log(
        `[webhook] subscription ${sub.id} → ${mapped}`,
        updated?.key ?? "(no license yet)"
      );
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      setStatusByCustomer(String(sub.customer), "canceled");
      console.log(`[webhook] subscription ${sub.id} canceled`);
      break;
    }
    default:
      break;
  }
}

app.get("/", (_req, res) => {
  const index = join(publicDir, "index.html");
  if (existsSync(index)) res.sendFile(index);
  else res.status(500).send("index.html missing");
});

app.listen(PORT, () => {
  console.log(`[web] ServiceTitan bridge landing on ${PUBLIC_BASE}`);
  console.log(`[web] demoMode=${demoMode()} stripe=${!!stripe} freeTier=true`);
});
