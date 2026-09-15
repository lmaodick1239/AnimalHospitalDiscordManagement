import type Database from "better-sqlite3";
import type { Clock } from "../clock.ts";
import type { Kind, Room } from "./rooms.ts";
import type { EventSink } from "../stores/EventSink.ts";
import type { Instance } from "../stores/instances.ts";
import { touchActivity, updateInstanceShiftNumber } from "../stores/instances.js";
import { getGuildSettings, setShiftCounter } from "../stores/guildSettings.js";
import { getUncleared, insertReport, tickReport, type Report } from "../stores/reports.js";
import { nextCounter } from "./shift.js";

export class ClosedInstanceError extends Error { constructor() { super("instance closed"); this.name = "ClosedInstanceError"; } }
export class DiscordPostError extends Error { constructor(message: string) { super(message); this.name = "DiscordPostError"; } }
export class DiscordTickError extends Error { constructor(message: string, readonly reason: "gone" | "outage") { super(message); this.name = "DiscordTickError"; } }

export type DiscordPort = {
  sendReport(input: { instance: Instance; room: Room; kind: Kind; displayName: string }): Promise<{ messageId: string }>;
  sendBanner(input: { instance: Instance; shiftNumber: number }): Promise<{ messageId: string }>;
  tickReport(input: { instance: Instance; messageId: string; tickEmoji: string }): Promise<{ ok: true } | { ok: false; reason: "gone" | "outage" }>;
  unarchive(instance: Instance): Promise<void>;
};

export type Decide = { action: "post"; room: Room; kind: Kind } | { action: "tick"; existing: Report };
export function decideReport(db: Database.Database, instance: Instance, room: Room, kind: Kind): Decide { if (instance.closedAt) throw new ClosedInstanceError(); const existing = getUncleared(db, instance.id, room); return existing ? { action: "tick", existing } : { action: "post", room, kind }; }
export type ApplyResult = { type: "posted"; report: Report } | { type: "ticked"; report: Report };

export async function applyReport(opts: { db: Database.Database; instance: Instance; room: Room; kind: Kind; userId: string; displayName: string; tickEmoji: string; clock: Clock; events: EventSink; discord: DiscordPort; newId: () => string; }): Promise<ApplyResult> {
  const { db, instance, room, kind, userId, displayName, tickEmoji, clock, events, discord, newId } = opts;
  if (instance.closedAt) throw new ClosedInstanceError(); await discord.unarchive(instance); const uncleared = getUncleared(db, instance.id, room);
  if (uncleared) { const tick = await discord.tickReport({ instance, messageId: uncleared.discordMessageId, tickEmoji }); if (tick.ok) { const tickedAt = clock.now().toISOString(); tickReport(db, uncleared.id, tickedAt); touchActivity(db, instance.id, tickedAt); const report = { ...uncleared, tickedAt }; events.emit({ type: "tick", instanceId: instance.id, report }); return { type: "ticked", report }; } if (tick.reason === "outage") throw new DiscordTickError("react failed", "outage"); tickReport(db, uncleared.id, clock.now().toISOString()); }
  let sent: { messageId: string }; try { sent = await discord.sendReport({ instance, room, kind, displayName }); } catch (error) { throw new DiscordPostError(error instanceof Error ? error.message : String(error)); }
  const createdAt = clock.now().toISOString(); const report = insertReport(db, { id: newId(), instanceId: instance.id, userId, displayName, room, kind, discordMessageId: sent.messageId, createdAt, type: "report" }); touchActivity(db, instance.id, createdAt); events.emit({ type: "report", instanceId: instance.id, report }); return { type: "posted", report };
}

export async function advanceShift(opts: { db: Database.Database; instance: Instance; userId: string; displayName: string; clock: Clock; events: EventSink; discord: DiscordPort; newId: () => string; }): Promise<{ shiftNumber: number; bannerReport: Report }> {
  if (opts.instance.closedAt) throw new ClosedInstanceError();
  const nextShift = opts.instance.shiftNumber + 1;
  const now = opts.clock.now().toISOString();
  const bannerReport = opts.db.transaction(() => {
    updateInstanceShiftNumber(opts.db, opts.instance.id, nextShift);
    opts.db.prepare("UPDATE reports SET ticked_at = ? WHERE instance_id = ? AND ticked_at IS NULL AND type = 'report'").run(now, opts.instance.id);
    return insertReport(opts.db, { id: opts.newId(), instanceId: opts.instance.id, userId: opts.userId, displayName: "", room: null, kind: null, discordMessageId: "", createdAt: now, type: "banner" });
  })();
  opts.events.emit({ type: "shift", instanceId: opts.instance.id, shiftNumber: nextShift, report: bannerReport });
  await opts.discord.sendBanner({ instance: opts.instance, shiftNumber: nextShift });
  return { shiftNumber: nextShift, bannerReport };
}
