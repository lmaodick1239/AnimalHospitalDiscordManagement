import { test } from "node:test";
import assert from "node:assert/strict";
import type Database from "better-sqlite3";
import { openDb } from "../src/db.ts";

function seedGuildAndInstance(db: Database.Database, id = "i1", destination = "d1", isThread = 0): void {
  db.prepare("INSERT OR IGNORE INTO guild_settings (guild_id, default_channel_id) VALUES (?, ?)").run("g1", "c1");
  db.prepare(`
    INSERT INTO instances (
      id, guild_id, shift_number, parent_channel_id, destination_channel_id,
      is_thread, created_by, created_by_display_name, created_at, last_activity_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, "g1", 1, "c1", destination, isThread, "u1", "Ada", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
}

function report(db: Database.Database, id: string, instanceId: string, room = "RM1", tickedAt: string | null = null): void {
  db.prepare(`
    INSERT INTO reports (
      id, instance_id, user_id, display_name, room, kind, discord_message_id, created_at, ticked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, instanceId, "u1", "Ada", room, "ANOMALY", `m-${id}`, "2026-01-01T00:00:00.000Z", tickedAt);
}

test("creates the required tables", () => {
  const db = openDb(":memory:");
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
  assert.deepEqual(new Set(names.map(({ name }) => name)), new Set(["guild_settings", "instances", "reports"]));
  db.close();
});

test("enforces one uncleared report per instance and room", () => {
  const db = openDb(":memory:");
  seedGuildAndInstance(db);
  report(db, "r1", "i1");
  assert.throws(() => report(db, "r2", "i1"));
  db.close();
});

test("allows a new report after the previous one is ticked", () => {
  const db = openDb(":memory:");
  seedGuildAndInstance(db);
  report(db, "r1", "i1", "RM1", "2026-01-01T01:00:00.000Z");
  assert.doesNotThrow(() => report(db, "r2", "i1"));
  db.close();
});

test("enforces one open unthreaded instance per destination", () => {
  const db = openDb(":memory:");
  seedGuildAndInstance(db, "i1", "d1", 0);
  assert.throws(() => seedGuildAndInstance(db, "i2", "d1", 0));
  db.close();
});

test("allows threaded instances sharing a parent", () => {
  const db = openDb(":memory:");
  seedGuildAndInstance(db, "i1", "thread1", 1);
  assert.doesNotThrow(() => seedGuildAndInstance(db, "i2", "thread2", 1));
  db.close();
});

test("enables foreign keys", () => {
  const db = openDb(":memory:");
  assert.equal((db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys, 1);
  db.close();
});

void report;
