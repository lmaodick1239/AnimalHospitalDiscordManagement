import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.ts";
import { getGuildSettings, setShiftCounter, upsertGuildSettings } from "../src/stores/guildSettings.ts";

test("inserts guild settings with defaults and preserves omitted fields", () => {
  const db = openDb(":memory:");
  const first = upsertGuildSettings(db, { guildId: "g1", defaultChannelId: "c1" });
  assert.deepEqual(first, {
    guildId: "g1", defaultChannelId: "c1", timezone: "UTC", shiftLeadRoleId: null,
    tickEmoji: "✅", idleHours: 6, tombstoneHours: 2, shiftCounter: 0,
  });
  setShiftCounter(db, "g1", 8);
  const updated = upsertGuildSettings(db, { guildId: "g1", defaultChannelId: "c2", timezone: "Asia/Tokyo" });
  assert.equal(updated.defaultChannelId, "c2");
  assert.equal(updated.timezone, "Asia/Tokyo");
  assert.equal(updated.shiftCounter, 8);
  assert.equal(getGuildSettings(db, "missing"), undefined);
  db.close();
});
