import { test } from "node:test";
import assert from "node:assert/strict";
import { isKind, isRoom } from "../src/domain/rooms.ts";

test("validates exact rooms", () => {
  assert.equal(isRoom("RM1"), true);
  assert.equal(isRoom("RM01"), false);
  assert.equal(isRoom("RM9"), false);
});

test("validates report kinds", () => {
  assert.equal(isKind("MAYBE"), true);
  assert.equal(isKind("CLEAR"), false);
});
