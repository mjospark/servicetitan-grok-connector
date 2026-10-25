/**
 * Live ServiceTitan API client skeleton.
 * Real calls need partner credentials from https://developer.servicetitan.io
 * OAuth2 client-credentials → https://auth.servicetitan.io/connect/token
 * API base: https://api.servicetitan.io
 *
 * When MOCK=0 and credentials are set, this client is used.
 * Until partner access is approved, keep MOCK=1.
 */
import type {
  Estimate,
  Invoice,
  Job,
  ScheduleGap,
  ServiceTitanClient,
} from "./types.js";

export interface LiveConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  appKey: string;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

export class LiveServiceTitanClient implements ServiceTitanClient {
  private cfg: LiveConfig;
  private token: TokenCache | null = null;
  private readonly authUrl = "https://auth.servicetitan.io/connect/token";
  private readonly apiBase = "https://api.servicetitan.io";

  constructor(cfg: LiveConfig) {
    this.cfg = cfg;
  }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - 60_000) {
      return this.token.accessToken;
    }
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
    });
    const res = await fetch(this.authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ServiceTitan auth failed (${res.status}): ${text}`);
    }
    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.token = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return this.token.accessToken;
  }

  private async api<T>(path: string, query?: Record<string, string>): Promise<T> {
    const token = await this.getToken();
    const url = new URL(`${this.apiBase}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    }
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "ST-App-Key": this.cfg.appKey,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ServiceTitan API ${path} failed (${res.status}): ${text}`);
    }
    return (await res.json()) as T;
  }

  async listJobs(fromIso: string, toIso: string): Promise<Job[]> {
    // JPM Jobs: GET /jpm/v2/tenant/{tenant}/jobs
    const data = await this.api<{ data: Array<Record<string, unknown>> }>(
      `/jpm/v2/tenant/${this.cfg.tenantId}/jobs`,
      {
        startsOnOrAfter: fromIso,
        startsBefore: toIso,
        pageSize: "100",
      }
    );
    return (data.data ?? []).map(mapJob);
  }

  async getJob(id: number): Promise<Job | null> {
    try {
      const data = await this.api<Record<string, unknown>>(
        `/jpm/v2/tenant/${this.cfg.tenantId}/jobs/${id}`
      );
      return mapJob(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("(404)")) return null;
      throw e;
    }
  }

  async listOpenEstimates(): Promise<Estimate[]> {
    const data = await this.api<{ data: Array<Record<string, unknown>> }>(
      `/sales/v2/tenant/${this.cfg.tenantId}/estimates`,
      { status: "Open", pageSize: "100" }
    );
    return (data.data ?? []).map(mapEstimate);
  }

  async listOverdueInvoices(): Promise<Invoice[]> {
    const data = await this.api<{ data: Array<Record<string, unknown>> }>(
      `/accounting/v2/tenant/${this.cfg.tenantId}/invoices`,
      { status: "Exported", pageSize: "100" }
    );
    const today = new Date();
    return (data.data ?? [])
      .map(mapInvoice)
      .filter((inv) => inv.balance > 0 && new Date(inv.dueDate) < today)
      .map((inv) => ({
        ...inv,
        status: "Overdue",
        daysOverdue: Math.max(
          0,
          Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000)
        ),
      }));
  }

  async listScheduleGaps(_dateIso: string): Promise<ScheduleGap[]> {
    // Live gap computation needs technician schedules + appointments APIs.
    // Partner apps typically use /dispatch/v2/... — document and return empty
    // until credentials are approved; mock client covers demos.
    return [];
  }
}

function mapJob(raw: Record<string, unknown>): Job {
  const loc = (raw.locationAddress ?? raw.address ?? {}) as Record<string, string>;
  const addr =
    typeof raw.address === "string"
      ? raw.address
      : [loc.street, loc.unit, loc.city, loc.state, loc.zip].filter(Boolean).join(", ");
  return {
    id: Number(raw.id),
    number: String(raw.jobNumber ?? raw.number ?? raw.id),
    status: String(raw.jobStatus ?? raw.status ?? "Unknown"),
    summary: String(raw.summary ?? raw.description ?? ""),
    customerName: String(
      (raw.customer as { name?: string } | undefined)?.name ??
        raw.customerName ??
        "Unknown"
    ),
    customerPhone: undefined,
    address: addr || "—",
    scheduledStart: String(raw.scheduledStart ?? raw.start ?? ""),
    scheduledEnd: String(raw.scheduledEnd ?? raw.end ?? ""),
    technician: String(
      (raw.assignedTechnicians as Array<{ name?: string }> | undefined)?.[0]?.name ??
        raw.technicianName ??
        "Unassigned"
    ),
    jobType: String((raw.type as { name?: string } | undefined)?.name ?? raw.jobType ?? ""),
    priority: String(raw.priority ?? "Normal"),
    businessUnit: String(
      (raw.businessUnit as { name?: string } | undefined)?.name ?? ""
    ),
  };
}

function mapEstimate(raw: Record<string, unknown>): Estimate {
  return {
    id: Number(raw.id),
    number: String(raw.estimateNumber ?? raw.number ?? raw.id),
    status: String(raw.status ?? "Open"),
    customerName: String(
      (raw.customer as { name?: string } | undefined)?.name ?? "Unknown"
    ),
    jobId: raw.jobId != null ? Number(raw.jobId) : null,
    summary: String(raw.name ?? raw.summary ?? ""),
    total: Number(raw.total ?? raw.subTotal ?? 0),
    createdOn: String(raw.createdOn ?? ""),
    expiresOn: String(raw.expirationDate ?? raw.expiresOn ?? ""),
  };
}

function mapInvoice(raw: Record<string, unknown>): Invoice {
  return {
    id: Number(raw.id),
    number: String(raw.invoiceNumber ?? raw.number ?? raw.id),
    status: String(raw.status ?? ""),
    customerName: String(
      (raw.customer as { name?: string } | undefined)?.name ?? "Unknown"
    ),
    jobId: raw.jobId != null ? Number(raw.jobId) : null,
    total: Number(raw.total ?? 0),
    balance: Number(raw.balance ?? 0),
    invoiceDate: String(raw.invoiceDate ?? raw.createdOn ?? "").slice(0, 10),
    dueDate: String(raw.dueDate ?? "").slice(0, 10),
    daysOverdue: 0,
  };
}

export function createLiveClientFromEnv(): LiveServiceTitanClient {
  const clientId = process.env.SERVICE_TITAN_CLIENT_ID ?? "";
  const clientSecret = process.env.SERVICE_TITAN_CLIENT_SECRET ?? "";
  const tenantId = process.env.SERVICE_TITAN_TENANT_ID ?? "";
  const appKey = process.env.SERVICE_TITAN_APP_KEY ?? "";
  if (!clientId || !clientSecret || !tenantId || !appKey) {
    throw new Error(
      "MOCK=0 requires SERVICE_TITAN_CLIENT_ID, CLIENT_SECRET, TENANT_ID, and APP_KEY"
    );
  }
  return new LiveServiceTitanClient({ clientId, clientSecret, tenantId, appKey });
}
