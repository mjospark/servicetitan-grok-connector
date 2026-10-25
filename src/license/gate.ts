import { isMockMode } from "../st/index.js";
import { isLicenseActive } from "./store.js";

export class LicenseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LicenseError";
  }
}

/**
 * Mock mode always works (demo / local).
 * Live mode requires LICENSE_KEY env match OR an active key from the store
 * (passed as ST_LICENSE_KEY env on the MCP process, or tool argument).
 */
export function assertLicensed(providedKey?: string): void {
  if (isMockMode()) return;

  const key =
    providedKey?.trim() ||
    process.env.ST_LICENSE_KEY?.trim() ||
    process.env.LICENSE_KEY?.trim();

  if (!key) {
    throw new LicenseError(
      "Live ServiceTitan access requires a license key (free or Pro). " +
        "Set ST_LICENSE_KEY (from signup) or run with MOCK=1 for demo data. " +
        "Get a key at the hosted bridge landing page."
    );
  }
  if (!isLicenseActive(key)) {
    throw new LicenseError(
      "License key is missing, expired, or canceled. " +
        "Renew on the hosted bridge landing page, or use MOCK=1."
    );
  }
}
