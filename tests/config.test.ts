import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.ts";

const base = {
  DISCORD_TOKEN: "t",
  DISCORD_CLIENT_ID: "id",
  DISCORD_CLIENT_SECRET: "sec",
  PUBLIC_BASE_URL: "https://example.com/",
  SESSION_SECRET: "s",
  SQLITE_PATH: "./data/app.sqlite",
};

test("strips trailing slash and defaults port", () => {
  const c = loadConfig(base);
  assert.equal(c.publicBaseUrl, "https://example.com");
  assert.equal(c.port, 3000);
  assert.equal(c.bindHost, "0.0.0.0");
  assert.equal(c.trustProxy, false);
});

test("PORT and TRUST_PROXY", () => {
  const c = loadConfig({ ...base, PORT: "8080", TRUST_PROXY: "1" });
  assert.equal(c.port, 8080);
  assert.equal(c.trustProxy, true);
});

test("missing DISCORD_TOKEN throws", () => {
  const { DISCORD_TOKEN, ...rest } = base;
  assert.throws(() => loadConfig(rest), /DISCORD_TOKEN/);
});

test("missing other required variables throws", () => {
  for (const name of [
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "SESSION_SECRET",
    "SQLITE_PATH",
    "PUBLIC_BASE_URL",
  ] as const) {
    const env = { ...base };
    delete env[name];
    assert.throws(() => loadConfig(env), new RegExp(name));
  }
});

test("empty required variables throw", () => {
  assert.throws(() => loadConfig({ ...base, SESSION_SECRET: "" }), /SESSION_SECRET/);
});

test("invalid port throws", () => {
  assert.throws(() => loadConfig({ ...base, PORT: "not-a-number" }), /PORT/);
});

