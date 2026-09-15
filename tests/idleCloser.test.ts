import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.ts";
import { insertInstance, getInstance, touchActivity } from "../src/stores/instances.ts";
import { upsertGuildSettings } from "../src/stores/guildSettings.ts";
import { closeIdleOnce, idleCutoffIso } from "../src/jobs/idleCloser.ts";
import type { EventSink, LogEvent } from "../src/stores/EventSink.ts";

const now = new Date("2026-01-01T12:00:00.000Z");
function setup() {
  const db = openDb(":memory:");
  upsertGuildSettings(db, { guildId: "g1", defaultChannelId: "c1", idleHours: 6 });
  const common = { guildId: "g1", parentChannelId: "c1", isThread: false, threadName: null, createdBy: "u1", createdByDisplayName: "Ada", createdAt: "2026-01-01T00:00:00.000Z" };
  insertInstance(db, { ...common, id: "old", shiftNumber: 1, destinationChannelId: "d1", lastActivityAt: "2026-01-01T04:00:00.000Z" });
  insertInstance(db, { ...common, id: "new", shiftNumber: 2, destinationChannelId: "d2", lastActivityAt: "2026-01-01T11:00:00.000Z" });
  return db;
}

test("idle closer closes only instances older than guild idle hours", async () => {
  const db = setup();
  const events: LogEvent[] = [];
  const count = await closeIdleOnce({ db, client: null, events: { emit: (event) => events.push(event), subscribe: () => () => {} }, clock: { now: () => now } });
  assert.equal(idleCutoffIso(now, 6), "2026-01-01T06:00:00.000Z");
  assert.equal(count, 1);
  assert.equal(getInstance(db, "old")?.closedAt, now.toISOString());
  assert.equal(getInstance(db, "new")?.closedAt, null);
  assert.equal(events.length, 1);
  touchActivity(db, "new", "2026-01-01T05:00:00.000Z");
  touchActivity(db, "new", now.toISOString());
  assert.equal(await closeIdleOnce({ db, client: null, events: { emit: () => {}, subscribe: () => () => {} }, clock: { now: () => now } }), 0);
  db.close();
});
