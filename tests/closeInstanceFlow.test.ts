import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.ts";
import { insertInstance, getInstance } from "../src/stores/instances.ts";
import { upsertGuildSettings } from "../src/stores/guildSettings.ts";
import { finalizeClose } from "../src/domain/closeInstanceFlow.ts";
import type { EventSink, LogEvent } from "../src/stores/EventSink.ts";

function sink(events: LogEvent[]): EventSink {
  return { emit: (event) => events.push(event), subscribe: () => () => {} };
}
function instance(db: ReturnType<typeof openDb>) {
  upsertGuildSettings(db, { guildId: "g1", defaultChannelId: "c1" });
  return insertInstance(db, {
    id: "i1", guildId: "g1", shiftNumber: 1, parentChannelId: "c1", destinationChannelId: "d1",
    isThread: true, threadName: "thread", createdBy: "u1", createdByDisplayName: "Ada",
    createdAt: "2026-01-01T00:00:00.000Z", lastActivityAt: "2026-01-01T00:00:00.000Z",
  });
}

test("finalizeClose closes in SQLite and emits once despite Discord failure", async () => {
  const db = openDb(":memory:");
  const original = instance(db);
  const events: LogEvent[] = [];
  const client = { channels: { fetch: async () => { throw new Error("gone"); } } } as never;
  const clock = { now: () => new Date("2026-01-01T01:00:00.000Z") };

  await finalizeClose({ db, client, events: sink(events), instance: original, clock });
  await finalizeClose({ db, client, events: sink(events), instance: getInstance(db, "i1")!, clock });

  assert.equal(getInstance(db, "i1")?.closedAt, "2026-01-01T01:00:00.000Z");
  assert.deepEqual(events, [{ type: "closed", instanceId: "i1", closedAt: "2026-01-01T01:00:00.000Z" }]);
  db.close();
});

test("finalizeClose renames thread to (closed) and posts game ended message", async () => {
  const db = openDb(":memory:");
  const inst = instance(db);
  const events: LogEvent[] = [];
  const sentMessages: any[] = [];
  let renamedTo: string | null = null;
  let archived = false;

  const mockChannel = {
    messages: {
      fetch: async () => ({
        edit: async () => {},
      }),
    },
    send: async (payload: any) => {
      sentMessages.push(payload);
      return { id: "msg-ended" };
    },
    setName: async (name: string) => {
      renamedTo = name;
    },
    setArchived: async (val: boolean) => {
      archived = val;
    },
    name: "14:30-16092026",
  };

  const client = {
    channels: {
      fetch: async () => mockChannel,
    },
  } as never;

  const clock = { now: () => new Date("2026-01-01T01:00:00.000Z") };

  await finalizeClose({ db, client, events: sink(events), instance: { ...inst, panelMessageId: "p1" }, clock });

  assert.deepEqual(sentMessages, [{ content: "Game ended. Shift Closed." }]);
  assert.equal(renamedTo, "14:30-16092026 (closed)");
  assert.equal(archived, true);
  db.close();
});
