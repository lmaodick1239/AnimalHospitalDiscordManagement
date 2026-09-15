import { formatHms } from "../../domain/formatTime.js";
import { layout, esc } from "./layout.js";
import type { Kind, Room } from "../../domain/rooms.js";
import type { Report } from "../../stores/reports.js";

export type OccupancyMap = Record<Room, Kind | null>;
export type SnapshotRow = { type: "banner"; text: string; createdAt: string } | { type: "report"; report: Report };

export function instancePage(opts: { csrf: string; guildId: string; instanceId: string; shiftNumber: number; closed: boolean; occupancy: OccupancyMap; rows: SnapshotRow[]; timeZone: string; tickMark: "✅" }): string {
  const rooms = Object.keys(opts.occupancy) as Room[];
  const buttons = rooms.map((room) => `<button data-room="${room}" class="${opts.occupancy[room] ? `occ-${opts.occupancy[room]}` : ""}"${opts.closed ? " disabled" : ""}>${room}</button>`).join("");
  const rows = opts.rows.map((row) => row.type === "banner"
    ? `<li class="row-banner">${esc(formatHms(row.createdAt, opts.timeZone))} ${esc(row.text)}</li>`
    : `<li data-report-id="${esc(row.report.id)}" class="row-${row.report.kind}${row.report.tickedAt ? " row-ticked" : ""}">${esc(formatHms(row.report.createdAt, opts.timeZone))} ${row.report.tickedAt ? `${esc(opts.tickMark)} ` : ""}${esc(`${row.report.room} ${row.report.kind}`)} ${esc(row.report.displayName)}</li>`).join("");
  const body = `<main data-tz="${esc(opts.timeZone)}" data-events="/g/${esc(opts.guildId)}/i/${esc(opts.instanceId)}/events" data-post="/g/${esc(opts.guildId)}/i/${esc(opts.instanceId)}/report" data-shift="/g/${esc(opts.guildId)}/i/${esc(opts.instanceId)}/shift" data-csrf="${esc(opts.csrf)}" data-closed="${opts.closed ? "1" : "0"}"><h1>SHIFT ${opts.shiftNumber}${opts.closed ? " · Closed" : ""}</h1>${opts.closed ? "<p class=\"closed\">Session closed.</p>" : ""}<section id="pad"><button id="mode" type="button">Mode: ANOMALY</button><button id="next-shift" type="button"${opts.closed ? " disabled" : ""}>Next Shift</button>${buttons}</section><p id="err" role="alert"></p><ol id="log">${rows}</ol></main><script src="/static/app.js" defer></script>`;
  return layout({ title: `SHIFT ${opts.shiftNumber}`, body });
}
