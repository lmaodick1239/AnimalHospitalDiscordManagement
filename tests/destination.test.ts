import test from "node:test";
import assert from "node:assert/strict";
import { resolveThreadName } from "../src/discord/destination.ts";

test("resolveThreadName trims explicit names and enforces Discord length", () => {
  assert.equal(resolveThreadName({ now: new Date(), timeZone: "UTC", adminName: "  shift room  " }), "shift room");
  assert.throws(() => resolveThreadName({ now: new Date(), timeZone: "UTC", adminName: "   " }), /empty thread name/);
  assert.throws(() => resolveThreadName({ now: new Date(), timeZone: "UTC", adminName: "x".repeat(101) }), /Discord max/);
});

test("resolveThreadName uses the guild timestamp when omitted", () => {
  assert.equal(resolveThreadName({ now: new Date("2025-01-02T03:04:00.000Z"), timeZone: "UTC" }), "03:04-02012025");
});
