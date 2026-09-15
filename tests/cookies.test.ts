import test from "node:test";
import assert from "node:assert/strict";
import { COOKIE_NAME, cookieHeader, signSession, unsignSession } from "../src/web/cookies.js";

test("signed session round trips and tampering is rejected", () => {
  const signed = signSession("123456789", "secret");
  assert.equal(unsignSession(signed, "secret"), "123456789");
  assert.equal(unsignSession(`${signed}x`, "secret"), null);
  assert.equal(unsignSession(signed, "other"), null);
});

test("session cookie header has locked security attributes", () => {
  const header = cookieHeader(COOKIE_NAME, "value", { maxAgeSec: 604800, secure: true });
  assert.match(header, /^aho_session=value;/);
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Path=\//);
  assert.match(header, /Max-Age=604800/);
  assert.match(header, /Secure/);
});
