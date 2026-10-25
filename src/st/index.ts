import { MockServiceTitanClient } from "./mockClient.js";
import { createLiveClientFromEnv } from "./liveClient.js";
import type { ServiceTitanClient } from "./types.js";

export type { ServiceTitanClient, Job, Estimate, Invoice, ScheduleGap } from "./types.js";

export function createClient(): ServiceTitanClient {
  const mock = (process.env.MOCK ?? "1") === "1";
  if (mock) return new MockServiceTitanClient();
  return createLiveClientFromEnv();
}

export function isMockMode(): boolean {
  return (process.env.MOCK ?? "1") === "1";
}
