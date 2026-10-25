#!/usr/bin/env node
/**
 * ServiceTitan MCP server for Grok Bot.
 * Tools are read-only. Never sends customer emails — draft text only.
 */
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClient, isMockMode } from "../st/index.js";
import { assertLicensed, LicenseError } from "../license/gate.js";

const server = new McpServer({
  name: "servicetitan-grok-connector",
  version: "1.0.0",
});

const client = createClient();

function todayDenver(): string {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${day}`;
}

function dayRange(date: string): { from: string; to: string } {
  return {
    from: `${date}T00:00:00-06:00`,
    to: `${date}T23:59:59-06:00`,
  };
}

function ok(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ ok: true, mock: isMockMode(), data }, null, 2),
      },
    ],
  };
}

function fail(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const code = err instanceof LicenseError ? "LICENSE_REQUIRED" : "ERROR";
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ ok: false, code, error: message }, null, 2),
      },
    ],
    isError: true,
  };
}

const annotations = { readOnlyHint: true as const };

server.registerTool(
  "list_jobs_today",
  {
    description:
      "List ServiceTitan jobs scheduled for today (America/Denver). Read-only.",
    annotations,
  },
  async () => {
    try {
      assertLicensed();
      const day = todayDenver();
      const { from, to } = dayRange(day);
      const jobs = await client.listJobs(from, to);
      return ok({ date: day, count: jobs.length, jobs });
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "list_jobs_range",
  {
    description:
      "List ServiceTitan jobs in a date range (ISO dates YYYY-MM-DD). Read-only.",
    inputSchema: {
      from: z.string().describe("Start date YYYY-MM-DD"),
      to: z.string().describe("End date YYYY-MM-DD (inclusive)"),
    },
    annotations,
  },
  async ({ from, to }) => {
    try {
      assertLicensed();
      const jobs = await client.listJobs(
        `${from}T00:00:00-06:00`,
        `${to}T23:59:59-06:00`
      );
      return ok({ from, to, count: jobs.length, jobs });
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "get_job",
  {
    description: "Get one ServiceTitan job by numeric id. Read-only.",
    inputSchema: {
      id: z.number().int().positive().describe("ServiceTitan job id"),
    },
    annotations,
  },
  async ({ id }) => {
    try {
      assertLicensed();
      const job = await client.getJob(id);
      if (!job) return fail(new Error(`Job ${id} not found`));
      return ok({ job });
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "list_open_estimates",
  {
    description: "List open (not sold/rejected) estimates. Read-only.",
    annotations,
  },
  async () => {
    try {
      assertLicensed();
      const estimates = await client.listOpenEstimates();
      return ok({ count: estimates.length, estimates });
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "list_overdue_invoices",
  {
    description:
      "List invoices with an outstanding balance past due date. Read-only.",
    annotations,
  },
  async () => {
    try {
      assertLicensed();
      const invoices = await client.listOverdueInvoices();
      const totalBalance = invoices.reduce((s, i) => s + i.balance, 0);
      return ok({ count: invoices.length, totalBalance, invoices });
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "list_schedule_gaps",
  {
    description:
      "Find technician gaps ≥30 min on a given date (business hours). Read-only.",
    inputSchema: {
      date: z
        .string()
        .optional()
        .describe("YYYY-MM-DD; defaults to today America/Denver"),
    },
    annotations,
  },
  async ({ date }) => {
    try {
      assertLicensed();
      const day = date ?? todayDenver();
      const gaps = await client.listScheduleGaps(day);
      return ok({ date: day, count: gaps.length, gaps });
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "draft_customer_followup",
  {
    description:
      "Draft a customer follow-up for the owner to approve. NEVER sends email or SMS — returns draft text only.",
    inputSchema: {
      kind: z
        .enum([
          "estimate_followup",
          "invoice_reminder",
          "job_tomorrow",
          "thank_you",
        ])
        .describe("Type of follow-up to draft"),
      customerName: z.string(),
      context: z
        .string()
        .describe("Job/estimate/invoice details to include in the draft"),
    },
    annotations,
  },
  async ({ kind, customerName, context }) => {
    try {
      const templates: Record<string, string> = {
        estimate_followup: `Hi ${customerName},\n\nJust checking in on the estimate we sent (${context}). Happy to answer any questions or adjust the scope — reply to this email or call us anytime.\n\nThanks,\nBrightPath Electrical`,
        invoice_reminder: `Hi ${customerName},\n\nFriendly reminder that invoice ${context} is past due. You can pay online or call us if you need a copy or have questions.\n\nThank you,\nBrightPath Electrical`,
        job_tomorrow: `Hi ${customerName},\n\nQuick reminder that we're scheduled for ${context}. We'll text when the tech is on the way. Reply if you need to reschedule.\n\nSee you soon,\nBrightPath Electrical`,
        thank_you: `Hi ${customerName},\n\nThanks for choosing us for ${context}. If anything doesn't look right, call us and we'll make it right.\n\n— BrightPath Electrical`,
      };
      return ok({
        kind,
        customerName,
        draft: templates[kind],
        warning:
          "DRAFT ONLY — do not send until the owner explicitly approves recipient + exact text.",
      });
    } catch (e) {
      return fail(e);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[servicetitan-mcp] ready mock=${isMockMode()} (stdio)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
