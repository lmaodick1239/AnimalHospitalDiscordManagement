import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryModeStore } from "../src/stores/MemoryModeStore.ts";

test("mode defaults to anomaly and toggle flips twice", () => {
  const modes = new MemoryModeStore();
  assert.equal(modes.get("u", "i"), "ANOMALY");
  assert.equal(modes.toggle("u", "i"), "MAYBE");
  assert.equal(modes.toggle("u", "i"), "ANOMALY");
});

test("modes are independent by user and instance", () => {
  const modes = new MemoryModeStore();
  modes.set("u1", "i1", "MAYBE");
  assert.equal(modes.get("u1", "i1"), "MAYBE");
  assert.equal(modes.get("u2", "i1"), "ANOMALY");
  assert.equal(modes.get("u1", "i2"), "ANOMALY");
});
