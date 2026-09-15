import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.ts";
import { upsertGuildSettings } from "../src/stores/guildSettings.ts";
import { insertInstance } from "../src/stores/instances.ts";
import { getUncleared, listReports, occupancy } from "../src/stores/reports.ts";
import { InProcessEventSink } from "../src/stores/InProcessEventSink.ts";
import type { LogEvent } from "../src/stores/EventSink.ts";
import { withRoomLock } from "../src/stores/locks.ts";
import { applyReport, ClosedInstanceError, DiscordPostError, DiscordTickError, decideReport, type DiscordPort } from "../src/domain/reportMachine.ts";
import type { Instance } from "../src/stores/instances.ts";

let nextId = 0;

function seed() {
  const db = openDb(":memory:");
  upsertGuildSettings(db, { guildId: "g", defaultChannelId: "c" });
  const instance = insertInstance(db, {
    id: "i", guildId: "g", shiftNumber: 1, parentChannelId: "p", destinationChannelId: "d",
    isThread: true, threadName: "thread", createdBy: "u", createdByDisplayName: "User",
    createdAt: "2026-01-01T00:00:00.000Z", lastActivityAt: "2026-01-01T00:00:00.000Z",
  });
  return { db, instance };
}

function port(overrides: Partial<DiscordPort> = {}): DiscordPort {
  return {
    unarchive: async () => {},
    sendReport: async () => ({ messageId: "m1" }),
    tickReport: async () => ({ ok: true }),
    ...overrides,
  };
}

function opts(db: ReturnType<typeof seed>["db"], instance: Instance, discord: DiscordPort, events = new InProcessEventSink()) {
  let second = 0;
  return { db, instance, room: "RM3" as const, kind: "ANOMALY" as const, userId: "u", displayName: "User", tickEmoji: "✅", clock: { now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, second++)) }, events, discord, newId: () => `r${nextId++}` };
}

test("posts then ticks then posts again", async () => {
  const { db, instance } = seed(); const events: LogEvent[] = []; const sink = new InProcessEventSink(); sink.subscribe("i", (e) => events.push(e));
  const first = await applyReport({ ...opts(db, instance, port(), sink) });
  assert.equal(first.type, "posted"); assert.equal(listReports(db, "i").length, 1); assert.equal(occupancy(db, "i").RM3, "ANOMALY");
  const second = await applyReport({ ...opts(db, instance, port(), sink), kind: "MAYBE" });
  assert.equal(second.type, "ticked"); assert.equal(occupancy(db, "i").RM3, null); assert.deepEqual(events.map((e) => e.type), ["report", "tick"]);
  const third = await applyReport({ ...opts(db, instance, port(), sink), kind: "MAYBE" });
  assert.equal(third.type, "posted"); assert.equal(occupancy(db, "i").RM3, "MAYBE");
});

test("decideReport reflects closed and occupied state", async () => {
  const { db, instance } = seed();
  assert.deepEqual(decideReport(db, instance, "RM1", "MAYBE"), { action: "post", room: "RM1", kind: "MAYBE" });
  await applyReport({ ...opts(db, instance, port()) });
  assert.equal(decideReport(db, instance, "RM3", "MAYBE").action, "tick");
  const closed = { ...instance, closedAt: "now" };
  assert.throws(() => decideReport(db, closed, "RM1", "ANOMALY"), ClosedInstanceError);
});

test("closed instance makes no Discord calls", async () => {
  const { db, instance } = seed(); const closed = { ...instance, closedAt: "now" }; let calls = 0;
  await assert.rejects(() => applyReport({ ...opts(db, closed, port({ unarchive: async () => { calls++; } })), instance: closed }), ClosedInstanceError);
  assert.equal(calls, 0);
});

test("outage does not tick, gone ticks orphan then posts, send failure inserts nothing", async () => {
  const { db, instance } = seed(); await applyReport({ ...opts(db, instance, port()) });
  await assert.rejects(() => applyReport({ ...opts(db, instance, port({ tickReport: async () => ({ ok: false, reason: "outage" }) })) }), (e: any) => e instanceof DiscordTickError && e.reason === "outage");
  assert.equal(getUncleared(db, "i", "RM3")?.tickedAt, null);
  const result = await applyReport({ ...opts(db, instance, port({ tickReport: async () => ({ ok: false, reason: "gone" }), sendReport: async () => ({ messageId: "m2" }) })) });
  assert.equal(result.type, "posted"); assert.equal(listReports(db, "i").filter((r) => r.tickedAt).length, 1);
  const before = listReports(db, "i").length;
  await assert.rejects(() => applyReport({ ...opts(db, instance, port({ sendReport: async () => { throw new Error("no"); } }), new InProcessEventSink()), room: "RM1" }), DiscordPostError);
  assert.equal(listReports(db, "i").length, before);
});

test("overlapping calls serialize into one ticked report", async () => {
  const { db, instance } = seed(); let release!: () => void; const wait = new Promise<void>((r) => { release = r; });
  const discord = port({ sendReport: async () => { await wait; return { messageId: "m" }; } });
  const a = withRoomLock("i", "RM3", () => applyReport({ ...opts(db, instance, discord) }));
  const b = withRoomLock("i", "RM3", () => applyReport({ ...opts(db, instance, discord) }));
  await new Promise((r) => setTimeout(r, 5)); release(); await Promise.all([a, b]);
  assert.equal(listReports(db, "i").length, 1); assert.equal(listReports(db, "i")[0].tickedAt !== null, true);
});
