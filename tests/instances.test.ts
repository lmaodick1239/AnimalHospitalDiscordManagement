import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.ts";
import {
  closeAllOpenForGuild, closeInstance, countOpenInstances, findOpenByDestination,
  findOpenUnthreaded, getInstance, insertInstance, listOpenIdleSince, listOpenInstances,
  setInstanceMessages, touchActivity,
} from "../src/stores/instances.ts";
import { upsertGuildSettings } from "../src/stores/guildSettings.ts";

const at = "2026-01-01T00:00:00.000Z";
function fixture() {
  const db = openDb(":memory:");
  upsertGuildSettings(db, { guildId: "g1", defaultChannelId: "c1" });
  return db;
}
function row(id: string, destinationChannelId = id, isThread = false) {
  return { id, guildId: "g1", shiftNumber: Number(id.slice(1)), parentChannelId: "c1", destinationChannelId, isThread, threadName: null, createdBy: "u1", createdByDisplayName: "Ada", createdAt: at, lastActivityAt: at };
}

test("maps instances and supports lifecycle queries", () => {
  const db = fixture();
  const instance = insertInstance(db, row("i1", "d1"));
  assert.equal(instance.isThread, false);
  assert.equal(getInstance(db, "i1")?.id, "i1");
  assert.equal(countOpenInstances(db, "g1"), 1);
  assert.equal(listOpenInstances(db, "g1").length, 1);
  assert.equal(findOpenByDestination(db, "d1")?.id, "i1");
  assert.equal(findOpenUnthreaded(db, "d1")?.id, "i1");
  assert.equal(listOpenIdleSince(db, "2026-01-02T00:00:00.000Z").length, 1);
  setInstanceMessages(db, "i1", "b1", "p1");
  touchActivity(db, "i1", "2026-01-01T02:00:00.000Z");
  assert.equal(getInstance(db, "i1")?.panelMessageId, "p1");
  closeInstance(db, "i1", "2026-01-01T03:00:00.000Z");
  assert.equal(countOpenInstances(db, "g1"), 0);
  db.close();
});

test("findOpenUnthreaded ignores threaded instances", () => {
  const db = fixture();
  insertInstance(db, row("i1", "thread-1", true));
  assert.equal(findOpenByDestination(db, "thread-1")?.id, "i1");
  assert.equal(findOpenUnthreaded(db, "thread-1"), undefined);
  db.close();
});

test("closes all open instances for a guild", () => {
  const db = fixture();
  insertInstance(db, row("i1"));
  insertInstance(db, row("i2"));
  assert.equal(closeAllOpenForGuild(db, "g1", "2026-01-02T00:00:00.000Z"), 2);
  db.close();
});
