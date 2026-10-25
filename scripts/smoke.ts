/**
 * Smoke test: mock client + license issue + tool-shaped calls.
 * Run: npm test  (or npx tsx scripts/smoke.ts)
 */
import { mkdirSync } from "node:fs";
import { MockServiceTitanClient } from "../src/st/mockClient.js";
import {
  generateLicenseKey,
  isLicenseActive,
  issueLicense,
  loadStore,
} from "../src/license/store.js";
import { assertLicensed, LicenseError } from "../src/license/gate.js";

process.env.MOCK = "1";
process.env.LICENSE_STORE_PATH = "./data/licenses.smoke.json";

mkdirSync("./data", { recursive: true });

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log("  OK  ", msg);
    passed++;
  } else {
    console.error("  FAIL", msg);
    failed++;
  }
}

async function main() {
  console.log("=== ServiceTitan connector smoke ===\n");

  console.log("1) Mock client");
  const client = new MockServiceTitanClient();
  const today = "2026-10-25";
  const jobs = await client.listJobs(
    `${today}T00:00:00-06:00`,
    `${today}T23:59:59-06:00`
  );
  assert(jobs.length >= 3, `listJobs today → ${jobs.length} jobs`);
  const job = await client.getJob(1001);
  assert(!!job && job.number === "JOB-1001", "getJob 1001");
  const estimates = await client.listOpenEstimates();
  assert(estimates.length >= 2, `open estimates → ${estimates.length}`);
  const invoices = await client.listOverdueInvoices();
  assert(invoices.every((i) => i.balance > 0), "overdue invoices have balance");
  const gaps = await client.listScheduleGaps(today);
  assert(gaps.length >= 1, `schedule gaps → ${gaps.length}`);

  console.log("\n2) License store");
  const key = generateLicenseKey();
  assert(/^ST-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key), `key format ${key}`);
  const issued = issueLicense({
    email: "smoke@brightpath.test",
    stripeSessionId: "smoke_session_1",
    status: "active",
  });
  assert(isLicenseActive(issued.key), "issued key is active");
  const again = issueLicense({
    email: "smoke@brightpath.test",
    stripeSessionId: "smoke_session_1",
  });
  assert(again.key === issued.key, "idempotent on session id");
  assert(loadStore().licenses.length >= 1, "store persisted");

  console.log("\n3) License gate");
  process.env.MOCK = "1";
  try {
    assertLicensed();
    assert(true, "mock mode allows unlicensed");
  } catch {
    assert(false, "mock mode should allow unlicensed");
  }
  process.env.MOCK = "0";
  delete process.env.LICENSE_KEY;
  delete process.env.ST_LICENSE_KEY;
  let threw = false;
  try {
    assertLicensed();
  } catch (e) {
    threw = e instanceof LicenseError;
  }
  assert(threw, "live mode without key → LicenseError");
  process.env.ST_LICENSE_KEY = issued.key;
  try {
    assertLicensed();
    assert(true, "live mode with active key OK");
  } catch (e) {
    assert(false, `live with key failed: ${e}`);
  }
  process.env.MOCK = "1";

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
