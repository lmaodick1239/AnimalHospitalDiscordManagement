import { ROOMS, type Kind, type Room } from "./rooms.js";
import { shiftBanner } from "./strings.js";
import type { Instance } from "../stores/instances.ts";
import type { Report } from "../stores/reports.ts";

export type OccupancyMap = Record<Room, Kind | null>;

export type SnapshotRow =
  | { type: "banner"; shiftNumber: number; createdAt: string; text: string }
  | { type: "report"; report: Report };

export function buildSnapshot(instance: Instance, reports: Report[]): SnapshotRow[] {
  return [
    { type: "banner", shiftNumber: instance.shiftNumber, createdAt: instance.createdAt, text: shiftBanner(instance.shiftNumber) },
    ...[...reports].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((report) => ({ type: "report" as const, report })),
  ];
}

export function occupancyFromReports(reports: Report[]): OccupancyMap {
  const result = Object.fromEntries(ROOMS.map((room) => [room, null])) as OccupancyMap;
  for (const report of reports) {
    if (report.type !== "banner" && report.tickedAt === null && report.room && report.kind) result[report.room] = report.kind;
  }
  return result;
}
