import test from "node:test";
import assert from "node:assert/strict";
import { authorizeUrl } from "../src/web/oauth.js";

test("authorizeUrl requests identify and guilds", () => {
  const url = new URL(authorizeUrl({ clientId: "cid", redirectUri: "https://example.com/oauth/callback", state: "state" }));
  assert.equal(url.origin + url.pathname, "https://discord.com/api/oauth2/authorize");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "cid");
  assert.equal(url.searchParams.get("scope"), "identify guilds");
  assert.equal(url.searchParams.get("redirect_uri"), "https://example.com/oauth/callback");
  assert.equal(url.searchParams.get("state"), "state");
});
