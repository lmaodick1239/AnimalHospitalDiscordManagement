# Plan 01 — Scaffold, config, SQLite

> Parent: [`00-locked-spec.md`](00-locked-spec.md)
> Next: [`02-report-machine.md`](02-report-machine.md)
>
> **For agentic workers:** implement this file fully before 02. Checkboxes are the review gate.

**Goal:** Empty repo becomes a runnable TypeScript Node 20 project with config, schema, and domain primitives that later tasks import.

**Architecture:** ESM + `tsx` for tests. `better-sqlite3` opened once in [`src/db.ts`](src/db.ts). Schema applied on boot. No Discord/web yet.

---

### Task 1: Project bootstrap

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`
- Create: `src/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `npm test`, `npm start`, `npm run build`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "animal-hospital-organizer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "start": "node --import tsx src/index.ts",
    "build": "tsc -p tsconfig.json",
    "test": "node --import tsx --test tests/**/*.test.ts"
  },
  "dependencies": {
    "better-sqlite3": "^11.6.0",
    "discord.js": "^14.16.3",
    "express": "^4.21.2",
    "ulid": "^2.3.0",
    "cookie-signature": "^1.2.2"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/cookie-signature": "^1.1.2",
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

Pin to current compatible majors if install resolves differently; keep package names.

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src"]
}
```

Tests live in `/tests` and run via `tsx`; they are not in `rootDir`.

- [ ] **Step 3: Write `.gitignore`**

```
node_modules/
dist/
.env
*.sqlite
*.sqlite-journal
*.sqlite-wal
*.sqlite-shm
```

- [ ] **Step 4: Write `.env.example`**

```
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
PUBLIC_BASE_URL=http://localhost:3000
SESSION_SECRET=
SQLITE_PATH=./data/app.sqlite
PORT=3000
TRUST_PROXY=
```

- [ ] **Step 5: Write `src/index.ts` stub**

```ts
console.log("animal-hospital-organizer");
```

- [ ] **Step 6: Write `README.md`**

Include: what it is (manual observation logger, not Roblox), env vars from `.env.example`, bot invite needs `bot` + `applications.commands` + permission integer computed in Task 3 of plan 03, `/setup` then `/session start`, Node 20, `npm i && npm test && npm start`.

- [ ] **Step 7: `npm install` and `npx tsc -p tsconfig.json --noEmit`**

Expected: clean. `src/index.ts` is the only `.ts` so far.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json .gitignore .env.example README.md src/index.ts package-lock.json
git commit -m "chore: bootstrap TypeScript Node 20 project"
```

---

### Task 2: Config loader

**Files:**
- Create: `src/config.ts`
- Test: `tests/config.test.ts`

**Interfaces:**
- Consumes: `process.env`
- Produces: `loadConfig(): Config`

```ts
export type Config = {
  discordToken: string;
  discordClientId: string;
  discordClientSecret: string;
  publicBaseUrl: string; // no trailing slash
  sessionSecret: string;
  sqlitePath: string;
  port: number;          // default 3000
  trustProxy: boolean;   // TRUST_PROXY === "1"
  bindHost: "0.0.0.0";
};
export function loadConfig(env?: NodeJS.Dict<string>): Config;
```

- [ ] **Step 1: Write failing tests** in `tests/config.test.ts`

Use `node:test` + `node:assert/strict`.

```ts
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
```

Also throw on missing `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET`, `SQLITE_PATH`, `PUBLIC_BASE_URL`.

- [ ] **Step 2: Run tests — expect FAIL** (`loadConfig` missing)

```
node --import tsx --test tests/config.test.ts
```

- [ ] **Step 3: Implement `src/config.ts`**

Read `env ?? process.env`. Trim `PUBLIC_BASE_URL` trailing `/`. `Number(PORT)` if set else 3000. `trustProxy = env.TRUST_PROXY === "1"`. Throw `Error("missing env ${name}")` for required keys.

- [ ] **Step 4: Re-run tests — expect PASS**

- [ ] **Step 5: Commit** `feat: load and validate process env config`

---

### Task 3: Domain primitives (rooms, strings, timezone, shift)

**Files:**
- Create: `src/domain/rooms.ts`
- Create: `src/domain/strings.ts`
- Create: `src/domain/timezone.ts`
- Create: `src/domain/shift.ts`
- Test: `tests/rooms.test.ts`
- Test: `tests/strings.test.ts`
- Test: `tests/timezone.test.ts`
- Test: `tests/shift.test.ts`

**Interfaces:**

```ts
// rooms.ts
export const ROOMS = ["RM1","RM2","RM3","RM4","RM5","RM6","RM7","RM8"] as const;
export type Room = (typeof ROOMS)[number];
export type Kind = "ANOMALY" | "MAYBE";
export function isRoom(s: string): s is Room;
export function isKind(s: string): s is Kind;

// strings.ts
export function shiftBanner(n: number): string;          // "---- SHIFT {n} ----"
export function reportBody(room: Room, kind: Kind, displayName: string): string;
export function modeAck(kind: Kind): string;             // "Mode: ANOMALY"
export function postedAck(room: Room, kind: Kind): string; // "Posted RM3 ANOMALY"
export function clearedAck(room: Room): string;          // "Cleared RM3"
export function threadTimestampName(d: Date, timeZone: string): string; // HH:mm-DDMMYYYY

// timezone.ts
export function isValidIanaTimeZone(tz: string): boolean; // Intl.supportedValuesOf("timeZone")
export const COMMON_TIMEZONES = [
  "UTC", "Asia/Hong_Kong", "America/New_York", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Asia/Tokyo", "Australia/Sydney",
] as const;

// shift.ts
export function nextCounter(current: number, adminOverride?: number): { shiftNumber: number; counter: number };
// user/omitted: shiftNumber = current+1, counter = shiftNumber
// admin n: shiftNumber = n, counter = Math.max(current, n)
export function assertShiftNumber(n: number): void; // integer 1..99999 else throw
```

- [ ] **Step 1: Write failing tests**

`tests/rooms.test.ts`: `isRoom("RM1")` true, `isRoom("RM01")` false, `isRoom("RM9")` false, `isKind("MAYBE")` true, `isKind("CLEAR")` false.

`tests/strings.test.ts`:

```ts
assert.equal(shiftBanner(4), "---- SHIFT 4 ----");
assert.equal(reportBody("RM3", "ANOMALY", "Ada"), "RM3 ANOMALY\nAda");
assert.equal(modeAck("MAYBE"), "Mode: MAYBE");
assert.equal(postedAck("RM3", "ANOMALY"), "Posted RM3 ANOMALY");
assert.equal(clearedAck("RM3"), "Cleared RM3");
// 2026-09-15T12:03:00+08:00
assert.equal(
  threadTimestampName(new Date("2026-09-15T04:03:00.000Z"), "Asia/Hong_Kong"),
  "12:03-15092026",
);
assert.equal(
  threadTimestampName(new Date("2026-09-15T04:03:00.000Z"), "UTC"),
  "04:03-15092026",
);
```

`tests/timezone.test.ts`: `isValidIanaTimeZone("Asia/Hong_Kong")` true, `"Not/AZone"` false, `"UTC"` true.

`tests/shift.test.ts`:

```ts
assert.deepEqual(nextCounter(3), { shiftNumber: 4, counter: 4 });
assert.deepEqual(nextCounter(3, 10), { shiftNumber: 10, counter: 10 });
assert.deepEqual(nextCounter(12, 10), { shiftNumber: 10, counter: 12 });
assert.throws(() => assertShiftNumber(0));
assert.throws(() => assertShiftNumber(100000));
assert.doesNotThrow(() => assertShiftNumber(1));
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement the four modules.** `threadTimestampName` uses `Intl.DateTimeFormat` with `timeZone`, `hourCycle: "h23"`, extract hour/minute/day/month/year, pad 2 / 2 / 2 / 4. Do not use 12-hour clock.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit** `feat: domain strings, rooms, timezone, shift counter`

---

### Task 4: SQLite schema + open

**Files:**
- Create: `src/db.ts`
- Test: `tests/db.test.ts`

**Interfaces:**

```ts
import type Database from "better-sqlite3";
export function openDb(path: string): Database.Database; // WAL, foreign_keys=ON, migrate
export function migrate(db: Database.Database): void;
```

Schema (exact names — later tasks depend on them):

```sql
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  default_channel_id TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  shift_lead_role_id TEXT,
  tick_emoji TEXT NOT NULL DEFAULT '✅',
  idle_hours INTEGER NOT NULL DEFAULT 6,
  tombstone_hours INTEGER NOT NULL DEFAULT 2,
  shift_counter INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS instances (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  shift_number INTEGER NOT NULL,
  parent_channel_id TEXT NOT NULL,
  destination_channel_id TEXT NOT NULL,
  is_thread INTEGER NOT NULL,
  thread_name TEXT,
  banner_message_id TEXT,
  panel_message_id TEXT,
  created_by TEXT NOT NULL,
  created_by_display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  closed_at TEXT,
  FOREIGN KEY (guild_id) REFERENCES guild_settings(guild_id)
);

CREATE INDEX IF NOT EXISTS idx_instances_guild_open
  ON instances(guild_id) WHERE closed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_instances_open_unthreaded
  ON instances(destination_channel_id) WHERE closed_at IS NULL AND is_thread = 0;

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  room TEXT NOT NULL,
  kind TEXT NOT NULL,
  discord_message_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ticked_at TEXT,
  FOREIGN KEY (instance_id) REFERENCES instances(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_one_uncleared
  ON reports(instance_id, room) WHERE ticked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reports_instance_created
  ON reports(instance_id, created_at);
```

All timestamps ISO-8601 UTC strings (`Date.toISOString()`).

- [ ] **Step 1: Write failing tests** `tests/db.test.ts`

Use `openDb(":memory:")`.

1. After `openDb`, `SELECT name FROM sqlite_master` includes `guild_settings`, `instances`, `reports`.
2. Insert two `reports` rows same `(instance_id, room)` both `ticked_at NULL` → throws (unique).
3. Same after first row has `ticked_at` set → second insert succeeds.
4. Two open unthreaded instances with same `destination_channel_id` → throws.
5. Two open **threaded** instances with same parent but different `destination_channel_id` → ok.
6. `PRAGMA foreign_keys` is `1`.

Need a `guild_settings` row and an `instances` row for FK. Helper in the test file.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `openDb`/`migrate`.** `pragma journal_mode = WAL` (skip if `:memory:`). `pragma foreign_keys = ON`. Run the SQL above. Return the db.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit** `feat: sqlite schema with uncleared-room unique index`

---

### Task 5: Guild settings + instance + report repositories (no machine yet)

**Files:**
- Create: `src/stores/guildSettings.ts`
- Create: `src/stores/instances.ts`
- Create: `src/stores/reports.ts`
- Test: `tests/guildSettings.test.ts`
- Test: `tests/instances.test.ts`
- Test: `tests/reportsRepo.test.ts`

**Interfaces:**

```ts
export type GuildSettings = {
  guildId: string;
  defaultChannelId: string;
  timezone: string;
  shiftLeadRoleId: string | null;
  tickEmoji: string;
  idleHours: number;
  tombstoneHours: number;
  shiftCounter: number;
};

export function upsertGuildSettings(db, input: {
  guildId: string;
  defaultChannelId: string;
  timezone?: string;
  shiftLeadRoleId?: string | null;
  tickEmoji?: string;
  idleHours?: number;
  tombstoneHours?: number;
}): GuildSettings;
// omitted fields keep previous on update; on insert use defaults timezone UTC, tick ✅, idle 6, tombstone 2, counter 0
export function getGuildSettings(db, guildId: string): GuildSettings | undefined;
export function setShiftCounter(db, guildId: string, counter: number): void;

export type Instance = {
  id: string;
  guildId: string;
  shiftNumber: number;
  parentChannelId: string;
  destinationChannelId: string;
  isThread: boolean;
  threadName: string | null;
  bannerMessageId: string | null;
  panelMessageId: string | null;
  createdBy: string;
  createdByDisplayName: string;
  createdAt: string;
  lastActivityAt: string;
  closedAt: string | null;
};

export function insertInstance(db, row: Omit<Instance, "bannerMessageId" | "panelMessageId" | "closedAt"> & {
  bannerMessageId?: string | null;
  panelMessageId?: string | null;
}): Instance;
export function getInstance(db, id: string): Instance | undefined;
export function listOpenInstances(db, guildId: string): Instance[];
export function countOpenInstances(db, guildId: string): number;
export function findOpenByDestination(db, destinationChannelId: string): Instance | undefined;
export function findOpenUnthreaded(db, destinationChannelId: string): Instance | undefined;
export function setInstanceMessages(db, id: string, bannerMessageId: string, panelMessageId: string): void;
export function touchActivity(db, id: string, atIso: string): void;
export function closeInstance(db, id: string, atIso: string): void;
export function listOpenIdleSince(db, cutoffIso: string): Instance[]; // last_activity_at < cutoff, closed_at IS NULL
export function closeAllOpenForGuild(db, guildId: string, atIso: string): number;

export type Report = {
  id: string;
  instanceId: string;
  userId: string;
  displayName: string;
  room: Room;
  kind: Kind;
  discordMessageId: string;
  createdAt: string;
  tickedAt: string | null;
};

export function insertReport(db, row: Omit<Report, "tickedAt">): Report;
export function getUncleared(db, instanceId: string, room: Room): Report | undefined;
export function tickReport(db, id: string, atIso: string): void;
export function listReports(db, instanceId: string): Report[]; // created_at ASC
export function occupancy(db, instanceId: string): Record<Room, Kind | null>;
// for each room: uncleared kind or null
```

- [ ] **Step 1: Write failing tests** covering upsert insert/update keep-counter, `occupancy` pink/yellow/null, unique uncleared via `insertReport`, `closeAllOpenForGuild`, `findOpenUnthreaded` vs threaded.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement repositories with prepared statements. Map snake_case columns to camelCase.**

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit** `feat: guild, instance, and report repositories`

---

Coverage for this file: bootstrap, env, domain strings, schema invariant, repos. Report **machine** (post vs tick) is plan 02.
