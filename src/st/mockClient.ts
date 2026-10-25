import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Estimate,
  Invoice,
  Job,
  ScheduleGap,
  ServiceTitanClient,
  Technician,
} from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function fixturesDir(): string {
  const candidates = [
    join(__dirname, "../fixtures"),
    join(__dirname, "../../src/fixtures"),
    join(process.cwd(), "src/fixtures"),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, "jobs.json"))) return c;
  }
  throw new Error("fixtures not found (jobs.json)");
}

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir(), name), "utf8")) as T;
}

function dayBounds(dateIso: string): { start: Date; end: Date } {
  const day = dateIso.slice(0, 10);
  const start = new Date(`${day}T00:00:00-06:00`);
  const end = new Date(`${day}T23:59:59-06:00`);
  return { start, end };
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export class MockServiceTitanClient implements ServiceTitanClient {
  private jobs: Job[];
  private estimates: Estimate[];
  private invoices: Invoice[];
  private technicians: Technician[];
  private businessHours: { start: string; end: string; timezone: string };

  constructor() {
    this.jobs = loadJson<{ jobs: Job[] }>("jobs.json").jobs;
    this.estimates = loadJson<{ estimates: Estimate[] }>("estimates.json").estimates;
    this.invoices = loadJson<{ invoices: Invoice[] }>("invoices.json").invoices;
    const techData = loadJson<{
      technicians: Technician[];
      businessHours: { start: string; end: string; timezone: string };
    }>("technicians.json");
    this.technicians = techData.technicians;
    this.businessHours = techData.businessHours;
  }

  async listJobs(fromIso: string, toIso: string): Promise<Job[]> {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    return this.jobs.filter((j) => {
      const s = new Date(j.scheduledStart);
      const e = new Date(j.scheduledEnd);
      return overlaps(s, e, from, to);
    });
  }

  async getJob(id: number): Promise<Job | null> {
    return this.jobs.find((j) => j.id === id) ?? null;
  }

  async listOpenEstimates(): Promise<Estimate[]> {
    return this.estimates.filter((e) => e.status === "Open");
  }

  async listOverdueInvoices(): Promise<Invoice[]> {
    return this.invoices.filter((i) => i.status === "Overdue" && i.balance > 0);
  }

  async listScheduleGaps(dateIso: string): Promise<ScheduleGap[]> {
    const { start: dayStart, end: dayEnd } = dayBounds(dateIso);
    const day = dateIso.slice(0, 10);
    const [hStartH, hStartM] = this.businessHours.start.split(":").map(Number);
    const [hEndH, hEndM] = this.businessHours.end.split(":").map(Number);
    const bizStart = new Date(dayStart);
    bizStart.setHours(hStartH, hStartM, 0, 0);
    const bizEnd = new Date(dayStart);
    bizEnd.setHours(hEndH, hEndM, 0, 0);

    const gaps: ScheduleGap[] = [];
    for (const tech of this.technicians.filter((t) => t.active)) {
      const techJobs = this.jobs
        .filter(
          (j) =>
            j.technician === tech.name &&
            overlaps(new Date(j.scheduledStart), new Date(j.scheduledEnd), dayStart, dayEnd)
        )
        .sort(
          (a, b) =>
            new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()
        );

      let cursor = new Date(bizStart);
      for (const job of techJobs) {
        const js = new Date(job.scheduledStart);
        const je = new Date(job.scheduledEnd);
        if (js > cursor) {
          const mins = Math.round((js.getTime() - cursor.getTime()) / 60000);
          if (mins >= 30) {
            gaps.push({
              technician: tech.name,
              date: day,
              gapStart: cursor.toISOString(),
              gapEnd: js.toISOString(),
              durationMinutes: mins,
            });
          }
        }
        if (je > cursor) cursor = je;
      }
      if (bizEnd > cursor) {
        const mins = Math.round((bizEnd.getTime() - cursor.getTime()) / 60000);
        if (mins >= 30) {
          gaps.push({
            technician: tech.name,
            date: day,
            gapStart: cursor.toISOString(),
            gapEnd: bizEnd.toISOString(),
            durationMinutes: mins,
          });
        }
      }
    }
    return gaps;
  }
}
