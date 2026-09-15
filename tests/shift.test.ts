import { test } from "node:test";
import assert from "node:assert/strict";
import { assertShiftNumber, nextCounter } from "../src/domain/shift.ts";

test("increments and applies admin shift counter overrides", () => {
  assert.deepEqual(nextCounter(3), { shiftNumber: 4, counter: 4 });
  assert.deepEqual(nextCounter(3, 10), { shiftNumber: 10, counter: 10 });
  assert.deepEqual(nextCounter(12, 10), { shiftNumber: 10, counter: 12 });
});

test("validates shift number range", () => {
  assert.throws(() => assertShiftNumber(0));
  assert.throws(() => assertShiftNumber(100000));
  assert.doesNotThrow(() => assertShiftNumber(1));
});
