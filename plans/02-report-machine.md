# Plan 02 — Report machine, locks, ModeStore, EventSink

> Parent: [`00-locked-spec.md`](00-locked-spec.md)
> Prev: [`01-scaffold-db.md`](01-scaffold-db.md)
> Next: [`03-discord.md`](03-discord.md)

**Goal:** Pure post-or-tick machine plus the in-process stores Discord and web will share. Discord I/O is injected; this task does not call the API.

**Architecture:** `withRoomLock(instanceId, room, fn)` serializes concurrent presses. `decideReport` is synchronous against SQLite. `applyReport` calls a `DiscordPort` first, then commits. `EventSink.emit` after commit.

---

### Task 6: Per-room Promise lock

**Files:**
- Create: `src/stores/locks.ts`
- Test: `tests/locks.test.ts`

**Interfaces:**

```ts
export function withRoomLock<T>(instanceId: string, room: string, fn: () => Promise<T>): Promise<T>;
export function lockKey(instanceId: string, room: string): string; // `${instanceId}:${room}`
```

Semantics: one in-flight `fn` per key. Overlapping calls chain. The lock releases in `finally` even if `fn` throws. Different keys run concurrent.

- [ ] **Step 1: Write failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { withRoomLock } from "../src/stores/locks.ts";

test("serializes the same key", async () => {
  const order: number[] = [];
  const a = withRoomLock("i", "RM1", async () => {
    order.push(1);
    await new Promise((r) => setTimeout(r, 20));
    order.push(2);
    return "a";
  });
  const b = withRoomLock("i", "RM1", async () => {
    order.push(3);
    return "b";
  });
  assert.deepEqual(await Promise.all([a, b]), ["a", "b"]);
  assert.deepEqual(order, [1, 2, 3]);
});

test("different keys do not wait", async () => {
  let concurrent = 0;
  let max = 0;
  const run = (room: string) =>
    withRoomLock("i", room, async () => {
      concurrent++;
      max = Math.max(max, concurrent);
      await new Promise((r) => setTimeout(r, 20));
      concurrent--;
    });
  await Promise.all([run("RM1"), run("RM2")]);
  assert.equal(max, 2);
});

test("releases on throw", async () => {
  await assert.rejects(() =>
    withRoomLock("i", "RM1", async () => {
      throw new Error("boom");
    }),
  );
  const v = await withRoomLock("i", "RM1", async () => 1);
  assert.equal(v, 1);
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement with a `Map<string, Promise<unknown>>`. Classic tail-chain:**

```ts
const chains = new Map<string, Promise<unknown>>();
export function withRoomLock<T>(instanceId: string, room: string, fn: () => Promise<T>): Promise<T> {
  const key = `${instanceId}:${room}`;
  const prev = chains.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  const held = next.then(
    () => undefined,
    () => undefined,
  );
  chains.set(key, held);
  void held.then(() => {
    if (chains.get(key) === held) chains.delete(key);
  });
  return next;
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit** `feat: serialize concurrent presses per instance+room`

---

### Task 7: ModeStore + EventSink interfaces

**Files:**
- Create: `src/stores/ModeStore.ts`
- Create: `src/stores/MemoryModeStore.ts`
- Create: `src/stores/EventSink.ts`
- Create: `src/stores/InProcessEventSink.ts`
- Test: `tests/modeStore.test.ts`
- Test: `tests/eventSink.test.ts`

**Interfaces:**

```ts
import type { Kind, Room } from "../domain/rooms.ts";

export interface ModeStore {
  get(userId: string, instanceId: string): Kind; // default ANOMALY
  toggle(userId: string, instanceId: string): Kind;
  set(userId: string, instanceId: string, kind: Kind): void;
}

export type LogEvent =
  | { type: "snapshot"; instanceId: string } // clients refetch; optional
  | { type: "report"; instanceId: string; report: import("./reports.ts").Report }
  | { type: "tick"; instanceId: string; report: import("./reports.ts").Report }
  | { type: "closed"; instanceId: string; closedAt: string };

export interface EventSink {
  emit(ev: LogEvent): void;
  subscribe(instanceId: string, fn: (ev: LogEvent) => void): () => void;
}

export class MemoryModeStore implements ModeStore;
export class InProcessEventSink implements EventSink;
```

`MemoryModeStore` key = `${userId}:${instanceId}`. Missing → `ANOMALY`. `toggle` flips and returns the new kind.

`InProcessEventSink` uses `EventEmitter` (or a `Map<string, Set<fn>>`). `emit` calls listeners for that `instanceId` only. `subscribe` returns unsubscribe. Listener errors must not break other listeners.

- [ ] **Step 1: Write failing tests** for default, toggle twice, independent users, emit isolation, unsubscribe.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit** `feat: ModeStore and in-process EventSink`

---

### Task 8: Clock helper

**Files:**
- Create: `src/clock.ts`

**Interfaces:**

```ts
export type Clock = { now: () => Date };
export const systemClock: Clock = { now: () => new Date() };
```

No test required beyond usage in Task 9. Do not call `Date.now` inside the machine; inject `Clock`.

- [ ] **Step 1: Write the file**

- [ ] **Step 2: Commit** `feat: injectable clock`

---

### Task 9: `decideReport` + `applyReport`

**Files:**
- Create: `src/domain/reportMachine.ts`
- Test: `tests/reportMachine.test.ts`

**Interfaces:**

```ts
import type Database from "better-sqlite3";
import type { Kind, Room } from "./rooms.ts";
import type { Clock } from "../clock.ts";
import type { EventSink } from "../stores/EventSink.ts";
import type { Instance } from "../stores/instances.ts";
import type { Report } from "../stores/reports.ts";

export class ClosedInstanceError extends Error { constructor() { super("instance closed"); this.name = "ClosedInstanceError"; } }
export class DiscordPostError extends Error { constructor(message: string) { super(message); this.name = "DiscordPostError"; } }
export class DiscordTickError extends Error {
  constructor(message: string, readonly reason: "gone" | "outage") { super(message); this.name = "DiscordTickError"; }
}

export type DiscordPort = {
  sendReport(input: {
    instance: Instance;
    room: Room;
    kind: Kind;
    displayName: string;
  }): Promise<{ messageId: string }>;
  tickReport(input: {
    instance: Instance;
    messageId: string;
    tickEmoji: string;
  }): Promise<{ ok: true } | { ok: false; reason: "gone" | "outage" }>;
  unarchive(instance: Instance): Promise<void>; // must not throw; log internally in real port
};

export type Decide =
  | { action: "post"; room: Room; kind: Kind }
  | { action: "tick"; existing: Report };

export function decideReport(db: Database.Database, instance: Instance, room: Room, kind: Kind): Decide;
// if instance.closedAt → throw ClosedInstanceError
// if getUncleared → { action: "tick", existing }  // ignore kind
// else { action: "post", room, kind }

export type ApplyResult =
  | { type: "posted"; report: Report }
  | { type: "ticked"; report: Report };

export function applyReport(opts: {
  db: Database.Database;
  instance: Instance;
  room: Room;
  kind: Kind;
  userId: string;
  displayName: string;
  tickEmoji: string;
  clock: Clock;
  events: EventSink;
  discord: DiscordPort;
  newId: () => string; // ulid
}): Promise<ApplyResult>;
```

`applyReport` algorithm (must match tests):

1. If `instance.closedAt` throw `ClosedInstanceError`.
2. `await discord.unarchive(instance)`.
3. `const uncleared = getUncleared(...)`.
4. If uncleared:
   1. `const tick = await discord.tickReport({ instance, messageId: uncleared.discordMessageId, tickEmoji })`.
   2. If `tick.ok`: `tickReport(db, uncleared.id, clock.now().toISOString())`; `touchActivity`; `events.emit({ type: "tick", ... })`; return `{ type: "ticked", report: { ...uncleared, tickedAt } }`.
   3. If `reason === "outage"`: throw `DiscordTickError("react failed", "outage")`. **Do not** write SQLite.
   4. If `reason === "gone"`: `tickReport` the orphan (so unique index frees), then **fall through to post**.
5. Post path:
   1. `const sent = await discord.sendReport(...)`. On throw, wrap `DiscordPostError`, no insert.
   2. `insertReport` with `newId()`, `discordMessageId: sent.messageId`, `createdAt: now`.
   3. `touchActivity`; `events.emit({ type: "report", ... })`; return `{ type: "posted", report }`.

`decideReport` is the sync helper used by tests and by Discord ephemeral copy. `applyReport` re-reads uncleared inside the lock (callers wrap `withRoomLock`).

- [ ] **Step 1: Write failing tests** with an in-memory db from `openDb(":memory:")`, fake `DiscordPort`, fake clock (`let t = 0; now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, t++))`).

Cases:

1. Empty room + ANOMALY → port.sendReport called, row inserted, occupancy RM3 = ANOMALY, event `report`.
2. Second apply same room any kind → port.tickReport, `tickedAt` set, occupancy null, event `tick`. `sendReport` not called.
3. Third apply → sendReport again, two reports rows, one ticked one not.
4. `closedAt` set → `ClosedInstanceError`, no port calls.
5. Tick `outage` → throw, `tickedAt` still null.
6. Tick `gone` → orphan ticked, new post inserted, occupancy is the new kind.
7. `sendReport` throws → no reports row.
8. Two overlapping `applyReport` via `withRoomLock` on empty room: first posts, second ticks (fake port delays send 30ms). Occupancy after both: null, one ticked one not? Wait: first posts (uncleared exists), second ticks. Occupancy null. Reports length 1 ticked.
   - Clarify: overlapping on empty: both passed lock sequentially. First sees empty → post. Second sees uncleared → tick. One row, ticked. Occupancy default.
9. Kind on tick is ignored: first MAYBE, second apply kind ANOMALY still ticks, does not insert.

Seed guild + instance in a test helper `seed(db)`.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement `reportMachine.ts` using repos from plan 01. Do not import discord.js.**

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit** `feat: room-level post-or-tick machine`

---

### Task 10: Occupancy helper already in repos — add SSE snapshot DTO

**Files:**
- Create: `src/domain/logSnapshot.ts`
- Test: `tests/logSnapshot.test.ts`

**Interfaces:**

```ts
export type OccupancyMap = Record<Room, Kind | null>;

export type SnapshotRow =
  | { type: "banner"; shiftNumber: number; createdAt: string; text: string }
  | { type: "report"; report: Report };

export function buildSnapshot(instance: Instance, reports: Report[]): SnapshotRow[];
// first row banner using shiftBanner(instance.shiftNumber) and instance.createdAt
// then each report in created_at order

export function occupancyFromReports(reports: Report[]): OccupancyMap;
// only tickedAt === null counts; missing rooms null
```

- [ ] **Step 1: Tests:** empty reports → only banner. One ANOMALY + one later ticked MAYBE on same room → occupancy null (latest uncleared none). One uncleared MAYBE on RM1 → RM1 yellow, others null.

Wait: invariant is one uncleared per room. Occupancy from uncleared rows only. Test two rooms.

- [ ] **Step 2: FAIL → implement → PASS**

- [ ] **Step 3: Commit** `feat: log snapshot and occupancy DTO`

---

Coverage: locks, mode, events, clock, machine, snapshot. Discord port implementation is plan 03.
