import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findEnvPath, loadEnv } from "../src/loadEnv.js";

test("findEnvPath locates .env in specified path, cwd, or executable directory", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-test-"));
  const envFile = path.join(tmpDir, ".env");
  fs.writeFileSync(envFile, "TEST_VAR=hello\n");

  try {
    // Explicit path given
    assert.equal(findEnvPath(envFile), envFile);

    // Search directories provided
    assert.equal(findEnvPath(undefined, [tmpDir]), envFile);

    // Fallback when not found returns undefined
    assert.equal(findEnvPath(undefined, [path.join(tmpDir, "nonexistent")]), undefined);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
