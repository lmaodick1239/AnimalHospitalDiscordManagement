import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.ts";
import { insertInstance, getInstance } from "../src/stores/instances.ts";
import { upsertGuildSettings } from "../src/stores/guildSettings.ts";
import { handleGuildDelete } from "../src/discord/handlers/guildDelete.ts";
import type { EventSink, LogEvent } from "../src/stores/EventSink.ts";

test("guild delete closes every open session and emits closed events", async () => {
  const db = openDb(":memory:");
  upsertGuildSettings(db, { guildId: "g1", defaultChannelId: "c1" });
  for (const id of ["i1", "i2"]) insertInstance(db, {
    id, guildId: "g1", shiftNumber: Number(id.slice(1)), parentChannelId: "c1", destinationChannelId: id,
    isThread: false, threadName: null, createdBy: "u1", createdByDisplayName: "Ada",
    createdAt: "2026-01-01T00:00:00.000Z", lastActivityAt: "2026-01-01T00:00:00.000Z",
  });
  const events: LogEvent[] = [];
  await handleGuildDelete({ db, events: { emit: (event) => events.push(event), subscribe: () => () => {} }, clock: { now: () => new Date("2026-01-01T01:00:00.000Z") }, guildId: "g1" });
  assert.equal(getInstance(db, "i1")?.closedAt, "2026-01-01T01:00:00.000Z");
  assert.equal(getInstance(db, "i2")?.closedAt, "2026-01-01T01:00:00.000Z");
  assert.equal(events.filter((event) => event.type === "closed").length, 2);
  db.close();
});
