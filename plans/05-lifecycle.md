# Plan 05 — Idle close, bot leave, process wiring, verification

> Parent: [`00-locked-spec.md`](00-locked-spec.md)
> Prev: [`04-web.md`](04-web.md)

**Goal:** One process boots Discord + Express + SQLite, auto-closes idle instances, closes on guild leave, and is verifiable without guessing.

---

### Task 26: Close helper used by command, idle job, and guild leave

**Files:**
- Create: `src/domain/closeInstanceFlow.ts`
- Test: `tests/closeInstanceFlow.test.ts`

**Interfaces:**

```ts
export async function finalizeClose(opts: {
  db: Database;
  client: Client | null; // null = skip Discord edits
  events: EventSink;
  instance: Instance;
  clock: Clock;
}): Promise<void>;
```

Algorithm:

1. If `instance.closedAt` already set: still `events.emit({ type: "closed", ... })` **only if** callers want idempotent UI — **do not double-emit**. If already closed, return immediately.
2. `closeInstance(db, instance.id, clock.now().toISOString())`.
3. `events.emit({ type: "closed", instanceId, closedAt })`.
4. If `client`:
   - Fetch destination channel; fetch panel message by `panelMessageId`; `edit({ embeds: [buildPanelEmbed({ ..., closed: true })], components: [] })`. Catch and log.
   - If `instance.isThread`, fetch thread, `setArchived(true)`. Catch and log.
5. Never throw after SQLite close succeeded.

- [ ] **Step 1: Unit-test with fake client (`{ channels: { fetch: async () => { throws } } }`) that close still sets `closedAt` and emit happens once. Second call no-ops without second emit.

Use a tiny fake EventSink recording calls.

- [ ] **Step 2: FAIL → implement → PASS**

- [ ] **Step 3: Change `/session close` (plan 03 Task 17) to call `finalizeClose` instead of duplicating edits.

- [ ] **Step 4: Commit** `feat: shared instance close with best-effort discord edits`

---

### Task 27: Idle closer

**Files:**
- Create: `src/jobs/idleCloser.ts`
- Test: `tests/idleCloser.test.ts`

**Interfaces:**

```ts
export function idleCutoffIso(now: Date, idleHours: number): string;
// now - idleHours, toISOString

export async function closeIdleOnce(opts: {
  db: Database;
  client: Client | null;
  events: EventSink;
  clock: Clock;
}): Promise<number>; // how many closed

export function startIdleCloser(opts: {
  db: Database;
  client: Client;
  events: EventSink;
  clock: Clock;
  intervalMs?: number; // default 60_000
}): { stop: () => void };
```

`closeIdleOnce`:

- `SELECT` open instances (or `list all open` — add `listAllOpenInstances(db)` in `src/stores/instances.ts` if missing).
- For each, `getGuildSettings`; `cutoff = now - idleHours`.
- If `instance.lastActivityAt < cutoff` (string compare is ok because ISO UTC `Z`), `finalizeClose`.
- Instances whose guild_settings row is missing: still close (treat idleHours default 6).

`startIdleCloser`: `setInterval` 60s, run `closeIdleOnce`, catch log. `unref()` the interval so tests can exit. `stop` clears interval.

- [ ] **Step 1: Tests** with memory db, two instances, idleHours 6. Clock frozen. One with `last_activity_at` 7h ago closes; one 1h ago stays. Tick (`touchActivity`) prevents close.

- [ ] **Step 2: Add `listAllOpenInstances` if not present. Commit with tests.

- [ ] **Step 3: Commit** `feat: 60s idle closer using guild idle_hours`

---

### Task 28: `guildDelete`

**Files:**
- Create: `src/discord/handlers/guildDelete.ts`
- Modify: `src/discord/client.ts` to register `client.on(Events.GuildDelete, ...)`

**Interfaces:**

```ts
export async function handleGuildDelete(opts: {
  db: Database;
  events: EventSink;
  clock: Clock;
  guildId: string;
}): Promise<void>;
```

`listOpenInstances(db, guildId)` then `finalizeClose` with `client: null` (cannot edit). Spec: stop web writes via `closedAt`; tombstone 404 from that `closedAt`.

- [ ] **Step 1: Test: two open instances close; EventSink got two `closed` events.

- [ ] **Step 2: Implement + wire

- [ ] **Step 3: Commit** `feat: close open sessions when the bot leaves a guild`

---

### Task 29: Tombstone helper (shared by web)

**Files:**
- Create: `src/domain/tombstone.ts`
- Test: `tests/tombstone.test.ts`
- Modify: `src/web/routes/instance.ts` to use it

```ts
export function isTombstoned(instance: Instance, settings: GuildSettings | undefined, now: Date): boolean;
// false if closedAt null
// hours = settings?.tombstoneHours ?? 2
// true if now >= Date.parse(closedAt) + hours * 3600_000
```

- [ ] **Step 1: Tests** closed 1h ago + tombstone 2 → false; 3h ago → true; open → false.

- [ ] **Step 2: Implement, use in GET page/events/poll/report.

- [ ] **Step 3: Commit** `feat: tombstone 404 after configured hours`

---

### Task 30: Process entrypoint

**Files:**
- Modify: `src/index.ts`
- Create: `src/loadEnv.ts` optional — or read `.env` manually. **Do not add dotenv unless needed.** Document that operators export env or use a process manager. If you want local dx, add `dotenv` as a dependency and `import "dotenv/config"` first line — acceptable.

**`src/index.ts`:**

```ts
import { loadConfig } from "./config.ts";
import { openDb } from "./db.ts";
import { systemClock } from "./clock.ts";
import { InProcessEventSink } from "./stores/InProcessEventSink.ts";
import { MemoryModeStore } from "./stores/MemoryModeStore.ts";
import { createBot } from "./discord/client.ts";
import { createDiscordPort } from "./discord/postOrTick.ts";
import { createWebApp } from "./web/app.ts";
import { registerGlobalCommands } from "./discord/registerCommands.ts";
import { startIdleCloser } from "./jobs/idleCloser.ts";
import fs from "node:fs";
import path from "node:path";

const config = loadConfig();
fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true });
const db = openDb(config.sqlitePath);
const events = new InProcessEventSink();
const modes = new MemoryModeStore();
const clock = systemClock;
const client = createBot({ config, db, clock, events, modes });
const discordPort = createDiscordPort(client, db);
// web app needs discordPort — pass into createWebApp
const app = createWebApp({ config, db, client, clock, events, discordPort });

await registerGlobalCommands(config.discordToken, config.discordClientId);
await client.login(config.discordToken);
const server = app.listen(config.port, config.bindHost, () => {
  console.log(`http://${config.bindHost}:${config.port}`);
});
startIdleCloser({ db, client, events, clock });

function shutdown() {
  server.close();
  void client.destroy();
  db.close();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

Wire `createWebApp` / `createBot` so `discordPort` is constructed once and reused by button/slash handlers (put it on deps in `createBot`).

- [ ] **Step 1: Implement. `npm start` should boot (will fail login without token — that's ok).

- [ ] **Step 2: Commit** `feat: boot discord, web, sqlite, idle closer in one process`

---

### Task 31: README + invite permissions

**Files:**
- Modify: `README.md`

Must include:

- Manual logger, not Roblox
- Create a Discord app; bot + OAuth2 redirect `${PUBLIC_BASE_URL}/oauth/callback`
- Scopes bot + applications.commands; OAuth identify + guilds
- Permission integer: print from `BOT_PERMISSIONS` (document the number generated by running `node --import tsx -e "import { BOT_PERMISSIONS } from './src/discord/permissions.ts'; console.log(BOT_PERMISSIONS.toString())"`)
- `/setup` then `/session start`
- Env table from `.env.example`
- Node 20, `npm i`, `npm test`, `npm start`
- SQLite path created automatically

- [ ] **Step 1: Write README**
- [ ] **Step 2: Commit** `docs: operator README`

---

### Task 32: Verification (do not claim done without this)

Run, in order:

```
npm test
npx tsc -p tsconfig.json --noEmit
```

Expected: all tests PASS, tsc clean.

Manual checklist (operator, after env is set):

1. Invite bot with the README URL.
2. `/setup` channel + `Asia/Hong_Kong`.
3. `/session start` → thread named `HH:mm-DDMMYYYY`, banner `---- SHIFT 1 ----`, panel 9 buttons, ephemeral URL.
4. Press RM3 → `RM3 ANOMALY\n{nick}`. Press RM3 → `✅` on that message, ephemeral `Cleared RM3`. Press RM3 → new ANOMALY.
5. Mode button → ephemeral `Mode: MAYBE`; RM4 posts MAYBE.
6. Second `/session start` while first open → SHIFT 2, second thread, both work.
7. `/session start-admin` thread=false on a **busy** parent that already has an **unthreaded** instance → rejected. Thread=true on that parent → ok.
8. `/report room:RM1` inside thread works; in `#general` unrelated → `Run this in the session thread or use the panel`.
9. Open the URL, OAuth, pad pink on occupied rooms, log rows, portrait 2×4.
10. Web press ticks Discord message (crosstalk).
11. `/session close` removes buttons, archives thread, URL shows Closed, POST 409, after tombstone hours 404.
12. Restart process: Mode resets ANOMALY; log rebuilds from SQLite; occupancy correct.

- [ ] **Step 1: Run `npm test` and `tsc`. If fail, fix — do not skip.
- [ ] **Step 2: Commit any fixes** `test: green suite and typecheck`

---

## Spec coverage map

| Spec item | Task |
|---|---|
| SQLite schema + unique uncleared | 01 T4 |
| Domain strings / TZ / shift | 01 T3 |
| Repos | 01 T5 |
| Locks, ModeStore, EventSink | 02 T6–T7 |
| Post-or-tick machine | 02 T9 |
| Discord panel / perms | 03 T11 |
| Slash commands | 03 T12–T18 |
| Create instance user/admin | 03 T16–T17 |
| Web OAuth pad SSE | 04 T20–T25 |
| Idle + leave + tombstone + boot | 05 T26–T30 |

## Out of scope reminder

No Docker, Redis, React, Roblox, `/rm1`, `/mode`, web Close, web admin-invoke, instance list, logout, message-content, report edit, forum, private threads, pinning, parser.
