import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearedAck,
  modeAck,
  postedAck,
  reportBody,
  shiftBanner,
  threadTimestampName,
} from "../src/domain/strings.ts";

test("formats protocol strings", () => {
  assert.equal(shiftBanner(4), "---- SHIFT 4 ----");
  assert.equal(reportBody("RM3", "ANOMALY", "Ada"), "RM3 ANOMALY\nAda");
  assert.equal(modeAck("MAYBE"), "Mode: MAYBE");
  assert.equal(postedAck("RM3", "ANOMALY"), "Posted RM3 ANOMALY");
  assert.equal(clearedAck("RM3"), "Cleared RM3");
});

test("formats thread timestamp in the requested timezone", () => {
  const date = new Date("2026-09-15T04:03:00.000Z");
  assert.equal(threadTimestampName(date, "Asia/Hong_Kong"), "12:03-15092026");
  assert.equal(threadTimestampName(date, "UTC"), "04:03-15092026");
});
