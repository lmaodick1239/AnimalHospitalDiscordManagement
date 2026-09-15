import { test } from "node:test";
import assert from "node:assert/strict";
import { isTombstoned } from "../src/domain/tombstone.ts";
import type { Instance } from "../src/stores/instances.ts";
import type { GuildSettings } from "../src/stores/guildSettings.ts";

const base = { id: "i1", guildId: "g1", shiftNumber: 1, parentChannelId: "c1", destinationChannelId: "d1", isThread: false, threadName: null, bannerMessageId: null, panelMessageId: null, createdBy: "u1", createdByDisplayName: "Ada", createdAt: "2026-01-01T00:00:00.000Z", lastActivityAt: "2026-01-01T00:00:00.000Z" } satisfies Omit<Instance, "closedAt">;
const settings = { guildId: "g1", defaultChannelId: "c1", timezone: "UTC", shiftLeadRoleId: null, tickEmoji: "✅", idleHours: 6, tombstoneHours: 2, shiftCounter: 0 } satisfies GuildSettings;

test("tombstone uses configured hours and preserves open instances", () => {
  assert.equal(isTombstoned({ ...base, closedAt: null }, settings, new Date("2026-01-04T00:00:00.000Z")), false);
  assert.equal(isTombstoned({ ...base, closedAt: "2026-01-01T23:00:00.000Z" }, settings, new Date("2026-01-02T00:00:00.000Z")), false);
  assert.equal(isTombstoned({ ...base, closedAt: "2026-01-01T21:00:00.000Z" }, settings, new Date("2026-01-02T00:00:00.000Z")), true);
  assert.equal(isTombstoned({ ...base, closedAt: "2026-01-01T23:00:00.000Z" }, undefined, new Date("2026-01-02T00:00:00.000Z")), false);
});
