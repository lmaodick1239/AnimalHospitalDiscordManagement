import test from "node:test";
import assert from "node:assert/strict";
import { formatHms } from "../src/domain/formatTime.js";

test("formatHms formats an ISO timestamp in the guild timezone", () => {
  assert.equal(formatHms("2026-09-15T04:03:07.000Z", "Asia/Hong_Kong"), "12:03:07");
});
