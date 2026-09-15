import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSnapshot, occupancyFromReports } from "../src/domain/logSnapshot.ts";
import type { Instance } from "../src/stores/instances.ts";
import type { Report } from "../src/stores/reports.ts";

const instance: Instance = {
  id: "i", guildId: "g", shiftNumber: 7, parentChannelId: "p", destinationChannelId: "d",
  isThread: true, threadName: "t", bannerMessageId: null, panelMessageId: null, createdBy: "u",
  createdByDisplayName: "User", createdAt: "2026-01-01T00:00:00.000Z", lastActivityAt: "2026-01-01T00:00:00.000Z", closedAt: null,
};

function report(overrides: Partial<Report>): Report {
  return { id: "r", instanceId: "i", userId: "u", displayName: "User", room: "RM1", kind: "ANOMALY", discordMessageId: "m", createdAt: "2026-01-01T00:01:00.000Z", tickedAt: null, ...overrides };
}

test("empty snapshot contains only the shift banner", () => {
  assert.deepEqual(buildSnapshot(instance, []), [{ type: "banner", shiftNumber: 7, createdAt: instance.createdAt, text: "---- SHIFT 7 ----" }]);
});

test("snapshot preserves reports in created order", () => {
  const later = report({ id: "later", room: "RM2", kind: "MAYBE", createdAt: "2026-01-01T00:02:00.000Z" });
  const earlier = report({ id: "earlier", createdAt: "2026-01-01T00:01:00.000Z", tickedAt: "2026-01-01T00:03:00.000Z" });
  assert.deepEqual(buildSnapshot(instance, [later, earlier]).map((row) => row.type === "report" ? row.report.id : row.type), ["banner", "earlier", "later"]);
});

test("occupancy includes only uncleared reports and defaults missing rooms", () => {
  const map = occupancyFromReports([
    report({ room: "RM1", kind: "MAYBE" }),
    report({ id: "r2", room: "RM2", kind: "ANOMALY", tickedAt: "2026-01-01T00:03:00.000Z" }),
    report({ id: "r3", room: "RM2", kind: "MAYBE", tickedAt: "2026-01-01T00:04:00.000Z" }),
  ]);
  assert.equal(map.RM1, "MAYBE"); assert.equal(map.RM2, null); assert.equal(map.RM8, null);
});
