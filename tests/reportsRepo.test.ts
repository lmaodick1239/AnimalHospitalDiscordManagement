import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.ts";
import { upsertGuildSettings } from "../src/stores/guildSettings.ts";
import { insertInstance } from "../src/stores/instances.ts";
import { getUncleared, insertReport, listReports, occupancy, tickReport } from "../src/stores/reports.ts";

const at = "2026-01-01T00:00:00.000Z";
function fixture() {
  const db = openDb(":memory:");
  upsertGuildSettings(db, { guildId: "g1", defaultChannelId: "c1" });
  insertInstance(db, { id: "i1", guildId: "g1", shiftNumber: 1, parentChannelId: "c1", destinationChannelId: "d1", isThread: false, threadName: null, createdBy: "u1", createdByDisplayName: "Ada", createdAt: at, lastActivityAt: at });
  return db;
}
function report(id: string, room: "RM1" | "RM2", kind: "ANOMALY" | "MAYBE") {
  return { id, instanceId: "i1", userId: "u1", displayName: "Ada", room, kind, discordMessageId: `m-${id}`, createdAt: at, type: "report" as const };
}

test("stores reports, occupancy, and ticks", () => {
  const db = fixture();
  insertReport(db, report("r1", "RM1", "ANOMALY"));
  insertReport(db, report("r2", "RM2", "MAYBE"));
  assert.equal(getUncleared(db, "i1", "RM1")?.kind, "ANOMALY");
  assert.equal(occupancy(db, "i1").RM1, "ANOMALY");
  assert.equal(occupancy(db, "i1").RM2, "MAYBE");
  assert.equal(occupancy(db, "i1").RM3, null);
  tickReport(db, "r1", "2026-01-01T01:00:00.000Z");
  assert.equal(getUncleared(db, "i1", "RM1"), undefined);
  assert.equal(listReports(db, "i1").length, 2);
  db.close();
});

test("banner rows are listed but ignored by occupancy", () => {
  const db = fixture();
  insertReport(db, { id: "b1", instanceId: "i1", userId: "u1", displayName: "", room: null, kind: null, discordMessageId: "", createdAt: at, type: "banner" } as any);
  assert.equal(listReports(db, "i1").length, 1);
  assert.equal(occupancy(db, "i1").RM1, null);
  db.close();
});
