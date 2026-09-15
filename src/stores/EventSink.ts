import type { Report } from "./reports.ts";

export type LogEvent =
  | { type: "snapshot"; instanceId: string }
  | { type: "report"; instanceId: string; report: Report }
  | { type: "tick"; instanceId: string; report: Report }
  | { type: "shift"; instanceId: string; shiftNumber: number; report: Report }
  | { type: "closed"; instanceId: string; closedAt: string };

export interface EventSink {
  emit(ev: LogEvent): void;
  subscribe(instanceId: string, fn: (ev: LogEvent) => void): () => void;
}
