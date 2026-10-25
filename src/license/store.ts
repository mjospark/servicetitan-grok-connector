import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 16);

export interface LicenseRecord {
  key: string;
  email: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSessionId?: string;
  status: "active" | "past_due" | "canceled" | "trialing";
  plan: string;
  createdAt: string;
  updatedAt: string;
}

export interface LicenseStoreData {
  licenses: LicenseRecord[];
}

function storePath(): string {
  return process.env.LICENSE_STORE_PATH ?? "./data/licenses.json";
}

function empty(): LicenseStoreData {
  return { licenses: [] };
}

export function loadStore(): LicenseStoreData {
  const path = storePath();
  if (!existsSync(path)) return empty();
  try {
    return JSON.parse(readFileSync(path, "utf8")) as LicenseStoreData;
  } catch {
    return empty();
  }
}

export function saveStore(data: LicenseStoreData): void {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function generateLicenseKey(): string {
  const raw = nanoid();
  return `ST-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

export function findByKey(key: string): LicenseRecord | undefined {
  const normalized = key.trim().toUpperCase();
  return loadStore().licenses.find((l) => l.key.toUpperCase() === normalized);
}

export function findBySession(sessionId: string): LicenseRecord | undefined {
  return loadStore().licenses.find((l) => l.stripeSessionId === sessionId);
}

export function findByCustomer(customerId: string): LicenseRecord | undefined {
  return loadStore().licenses.find((l) => l.stripeCustomerId === customerId);
}

export function upsertLicense(record: LicenseRecord): LicenseRecord {
  const data = loadStore();
  const idx = data.licenses.findIndex((l) => l.key === record.key);
  if (idx >= 0) data.licenses[idx] = record;
  else data.licenses.push(record);
  saveStore(data);
  return record;
}

export function issueLicense(opts: {
  email: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSessionId?: string;
  plan?: string;
  status?: LicenseRecord["status"];
}): LicenseRecord {
  // Idempotent on session id
  if (opts.stripeSessionId) {
    const existing = findBySession(opts.stripeSessionId);
    if (existing) return existing;
  }
  const now = new Date().toISOString();
  const record: LicenseRecord = {
    key: generateLicenseKey(),
    email: opts.email,
    stripeCustomerId: opts.stripeCustomerId,
    stripeSubscriptionId: opts.stripeSubscriptionId,
    stripeSessionId: opts.stripeSessionId,
    status: opts.status ?? "active",
    plan: opts.plan ?? "pro",
    createdAt: now,
    updatedAt: now,
  };
  return upsertLicense(record);
}

export function setStatusByCustomer(
  customerId: string,
  status: LicenseRecord["status"]
): LicenseRecord | undefined {
  const data = loadStore();
  const idx = data.licenses.findIndex((l) => l.stripeCustomerId === customerId);
  if (idx < 0) return undefined;
  data.licenses[idx] = {
    ...data.licenses[idx],
    status,
    updatedAt: new Date().toISOString(),
  };
  saveStore(data);
  return data.licenses[idx];
}

/** True if license allows real (non-mock) API use. */
export function isLicenseActive(key: string | undefined): boolean {
  // Static env override for self-host without Stripe
  const envKey = process.env.LICENSE_KEY?.trim();
  if (envKey && key && key.trim().toUpperCase() === envKey.toUpperCase()) {
    return true;
  }
  if (!key) return false;
  const rec = findByKey(key);
  return !!rec && (rec.status === "active" || rec.status === "trialing");
}
