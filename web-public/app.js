(async function () {
  const modeNote = document.getElementById("modeNote");
  const payBtn = document.getElementById("payBtn");
  const freeBtn = document.getElementById("freeBtn");

  try {
    const cfg = await fetch("/api/config").then((r) => r.json());
    if (cfg.externalPaid) {
      modeNote.textContent =
        "Pro checkout uses your Gumroad/Whop link — no Stripe keys. Money goes to that account.";
      payBtn.textContent = "Pay $49 on Gumroad / Whop";
    } else if (cfg.demoMode) {
      modeNote.textContent =
        "No paid checkout URL yet. Pro is still no-charge demo. Paste your Gumroad $49 product URL into PAID_CHECKOUT_URL (see .env) — uses the shop you already have, no Stripe.";
      payBtn.textContent = "Get Pro license (demo — no charge yet)";
    } else {
      modeNote.textContent = "Stripe Checkout — " + (cfg.priceLabel || "$49/mo");
    }
  } catch {
    modeNote.textContent = "Could not load config.";
  }

  async function postSignup(url, email, statusEl, btn) {
    statusEl.hidden = true;
    statusEl.classList.remove("error");
    btn.disabled = true;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      // External pay link first (Gumroad/Whop), then Stripe URL, then local success
      if (data.external && data.url) {
        // Keep license key in sessionStorage so they can grab it after paying
        if (data.licenseKey) {
          try {
            sessionStorage.setItem("st_pro_key", data.licenseKey);
            sessionStorage.setItem("st_pro_email", email);
          } catch (_) {}
        }
        location.href = data.url;
        return;
      }
      if (data.successUrl) {
        location.href = data.successUrl;
        return;
      }
      if (data.url) {
        location.href = data.url;
        return;
      }
      throw new Error("No redirect URL returned");
    } catch (err) {
      statusEl.hidden = false;
      statusEl.classList.add("error");
      statusEl.textContent = err.message || String(err);
      btn.disabled = false;
    }
  }

  document.getElementById("signup-free").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = new FormData(e.target).get("email");
    await postSignup(
      "/api/signup/free",
      email,
      document.getElementById("status-free"),
      freeBtn
    );
  });

  document.getElementById("signup-pro").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = new FormData(e.target).get("email");
    await postSignup(
      "/api/checkout",
      email,
      document.getElementById("status-pro"),
      payBtn
    );
  });
})();
