import test from "node:test";
import assert from "node:assert/strict";
import { allowCreate } from "../src/discord/createInstance.ts";

test("allowCreate permits three creates per minute and resets after the window", () => {
  assert.equal(allowCreate("user", 0, 60_000), true);
  assert.equal(allowCreate("user", 1, 60_000), true);
  assert.equal(allowCreate("user", 2, 60_000), true);
  assert.equal(allowCreate("user", 3, 60_000), false);
  assert.equal(allowCreate("user", 60_000, 60_000), true);
});
