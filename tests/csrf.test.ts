import test from "node:test";
import assert from "node:assert/strict";
import { csrfFormField, csrfOk, newCsrfToken, originAllowed } from "../src/web/csrf.js";

test("CSRF token is 32 bytes of hex and renders a hidden field", () => {
  const token = newCsrfToken();
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.equal(csrfFormField(token), `<input type="hidden" name="csrf" value="${token}">`);
});

test("origin checks compare scheme and host while allowing referer paths", () => {
  assert.equal(originAllowed("https://example.com", "https://example.com"), true);
  assert.equal(originAllowed("https://example.com/g/1/i/2", "https://example.com"), true);
  assert.equal(originAllowed("https://evil.com", "https://example.com"), false);
  assert.equal(originAllowed(undefined, "https://example.com"), false);
});

test("CSRF requires matching tokens and an allowed origin or referer", () => {
  const base = { cookieToken: "abc", bodyToken: "abc", origin: "https://example.com", referer: undefined, publicBaseUrl: "https://example.com" };
  assert.equal(csrfOk(base), true);
  assert.equal(csrfOk({ ...base, bodyToken: "def" }), false);
  assert.equal(csrfOk({ ...base, origin: undefined, referer: undefined }), false);
  assert.equal(csrfOk({ ...base, origin: "https://evil.com" }), false);
  assert.equal(csrfOk({ ...base, origin: undefined, referer: "https://example.com/path" }), true);
});
