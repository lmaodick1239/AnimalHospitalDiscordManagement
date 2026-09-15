import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidIanaTimeZone } from "../src/domain/timezone.ts";

test("validates IANA timezones", () => {
  assert.equal(isValidIanaTimeZone("Asia/Hong_Kong"), true);
  assert.equal(isValidIanaTimeZone("Not/AZone"), false);
  assert.equal(isValidIanaTimeZone("UTC"), true);
});
