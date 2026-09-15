# Codebase Review

> Generated 2026-09-15. Covers all source files and tests.

---

## Verdicts

Receiving-code-review pass recorded 2026-09-15. Nothing is implemented yet. Tokens used below and in the Summary Table:

- `fix` — agreed change, not implemented
- `accepted` — current behavior kept by product decision
- `wontfix` — finding rejected (wrong / spec / YAGNI)
- `defer` — real but not this pass (hygiene / tests / later)

---

## Critical — Data Integrity / Security

### C1. `oauthTokens` Map leaks access tokens and breaks on restart
**File:** `src/web/app.ts`
**Verdict:** fix — TTL/evict the in-memory Map; missing token after restart → 302 `/login?returnTo=/`, do not persist tokens (spec: in-process MVP).

`oauthTokens` is a module-level `Map<string, string>` with no TTL, no eviction, and no persistence.

- On process restart every logged-in user gets a 502 because `fetchUserGuilds("")` is called with an empty string.
- Tokens accumulate indefinitely — one entry per unique Discord user ID who has ever logged in.
- Re-authentication silently overwrites the old token without revoking it.

---

### C2. `allowCreate` throttle is per-process, module-global, and resets on restart
**File:** `src/discord/createInstance.ts`
**Verdict:** wontfix — in-memory 3/60s throttle matches locked spec; restart reset is implied; leftover timestamps are bounded.

The `creates` Map is never evicted except by the sliding-window filter inside `allowCreate`. A user who creates 3 sessions then never creates again leaves their timestamp array in memory forever. More critically: a process restart (crash, deploy) resets the throttle completely — a user can create 3 sessions, wait for a crash, and immediately create 3 more.

---

### C3. `memberViewOnChannel` does not actually check channel permissions
**File:** `src/web/permissions.ts`
**Verdict:** fix — delete unused `memberViewOnChannel`; live gate is `memberCanViewChannel` in `getAuthorized`.

```ts
// fetches member and channel, then:
return true;
```

The function returns `true` if both the member and channel API calls succeed, without ever checking whether the member has `ViewChannel` on that channel. It is currently unused in production routing (the bot-client-based `memberCanViewChannel` is used instead), but its existence is a trap — if wired in, it would grant access to any guild member regardless of channel permissions.

---

### C4. `reactWithGuildEmoji` mutates guild settings with a raw inline SQL statement
**File:** `src/discord/postOrTick.ts`
**Verdict:** wontfix — inline `UPDATE tick_emoji='✅'` is the locked persist-on-invalid-emoji path; `'✅'` is already the store default; fallback catch exists.

When an emoji is invalid, it resets `tick_emoji` to `'✅'` via:
```ts
opts.db.prepare("UPDATE guild_settings SET tick_emoji = '✅' WHERE guild_id = ?").run(opts.guildId);
```
This bypasses the `guildSettings` store entirely, uses a hardcoded string literal instead of a shared constant, and has no error handling. If the DB write fails, the invalid emoji is not persisted as reset — the next tick will try the invalid emoji again.

---

### C5. `settings!` non-null assertion is wrong after guild deletion
**File:** `src/web/app.ts` — `getAuthorized`
**Verdict:** fix — if `guild_settings` is missing, serve the pad with `{timezone:'UTC', tickEmoji:'✅'}` until tombstone; do not 404; guildDelete does not delete settings.

```ts
const settings = getGuildSettings(opts.db, guildId); // can be undefined
if (!instance || instance.guildId !== guildId || isTombstoned(instance, settings, ...)) {
  res.status(404)...
  return null;
}
return { userId, instance, settings: settings! }; // ← asserts non-null
```

If a guild is deleted, `settings` is `undefined`. `isTombstoned` handles `undefined` correctly (defaults to 2h). But if the instance is not yet tombstoned (recently closed), the guard passes and `settings!` produces a runtime `undefined` that is typed as `GuildSettings`, silently corrupting downstream reads.

---

## High — Logic Bugs

### H1. Shift counter incremented before instance is committed
**File:** `src/discord/createInstance.ts`
**Verdict:** accepted — skipped SHIFT n after a failed Discord create is fine; leave `setShiftCounter` before commit.

```ts
setShiftCounter(opts.db, opts.guildId, counter.counter); // ← written to DB
// ... thread creation, message sends ...
} catch (error) { closeInstance(opts.db, id, ...); throw error; }
```

If thread creation or message sending fails, the instance is closed correctly but the shift counter is already advanced. The next successful start silently skips a shift number. The counter should be set after `insertInstance`, inside the try block.

---

### H2. `applyReport` — `touchActivity` not called on the "gone → post" path
**File:** `src/domain/reportMachine.ts`
**Verdict:** fix — call `touchActivity` immediately after the gone-path `tickReport` (orphan tick counts as activity).

When `tick.reason === "gone"`, the code calls `tickReport` to clear the orphaned report, then falls through to post a new one. `touchActivity` is called after the new post succeeds, but not for the tick step. If `sendReport` then throws a `DiscordPostError`, the tick is committed to the DB but `lastActivityAt` is never updated — the instance will idle-close sooner than expected.

---

### H3. `finalizeClose` — double channel fetch for the same channel ID
**File:** `src/domain/closeInstanceFlow.ts`
**Verdict:** defer — reuse the first `channels.fetch` when `isThread`; extra fetch is real, not blocking; spec also writes two fetches.

When `isThread` is true, `destinationChannelId` is fetched twice: once to edit the panel message, and again to archive the thread. Both fetches target the same channel. The second fetch is redundant and doubles Discord API calls on every thread close.

---

### H4. `handleClose` — no `deferReply` before async work
**File:** `src/discord/handlers/session.ts`
**Verdict:** fix — `deferReply({ ephemeral: true })` before close work, then `editReply` (close can commit after the 3s ack window).

`handleClose` calls `finalizeClose` (which makes Discord API calls) and then `interaction.reply(...)`. Discord interactions expire after 3 seconds. If `finalizeClose` takes longer (slow Discord API, rate limit), the reply fails silently and the user sees no confirmation even though the session was closed successfully.

---

### H5. `locks.ts` — Map entry not cleaned up under sustained concurrent load
**File:** `src/stores/locks.ts`
**Verdict:** wontfix — `chains.delete` identity check is correct; last waiter removes the Map entry; not a leak.

```ts
void held.then(() => {
  if (chains.get(key) === held) chains.delete(key);
});
```

Under a burst of calls, each new call overwrites `chains.get(key)` before the previous `held` resolves, so the identity check is always false for all but the last call. The key is never deleted until the final call in the burst completes. For a room that receives continuous traffic, the key persists indefinitely — a memory leak.

---

### H6. `decideReport` is called outside the lock and its result is immediately stale
**File:** `src/discord/handlers/report.ts`
**Verdict:** wontfix — `decideReport` is test-only; production `applyReport` is inside `withRoomLock` and re-reads uncleared.

`decideReport` is exported as a public API and tested, but it is only safe if the caller holds the room lock. No caller does. Between `decideReport` and the actual `applyReport`, another concurrent request can change the state. The function is effectively dead for safety purposes — `applyReport` re-checks everything inside the lock.

---

### H7. SSE reconnect can start two concurrent polling intervals
**File:** `src/public/app.js`
**Verdict:** wontfix — `onerror` starts a poll interval only if `polling === null`; success `clearInterval` then `connect()`; does not stack.

If the SSE connection drops and polling starts, then `poll()` succeeds and calls `connect()`. If the new `EventSource` immediately errors, `onerror` fires again. At this point `polling` is `null` (cleared in `poll`), so a second polling interval is started. The two intervals run concurrently, doubling the poll rate and leaking the first interval handle.

---

### H8. `createBot` — `discordPort` created twice in production
**File:** `src/discord/client.ts`
**Verdict:** wontfix — prod `index.ts` constructs `discordPort` once and injects it; fallback in `createBot` is unused, not a double create.

```ts
discordPort: opts.discordPort ?? createDiscordPort(client, opts.db)
```

`index.ts` always passes `discordPort` explicitly, so the fallback `createDiscordPort` call inside `createBot` is dead in production. The import is live but the code path is never exercised under real conditions, meaning the fallback is untested.

---

## Medium — Spec Violations

### M1. Web start permission check is wrong — spec says View only, code requires View + Send
**Files:** `src/web/app.ts`, `src/discord/permissions.ts`
**Verdict:** fix — web start must check View only (`memberCanView`), not View+Send (`memberCanStart`); spec line 65.

Spec (§2): *"web start/report requires View."* The `/start` handler calls `memberCanStart(perms)` which requires both `ViewChannel` AND `SendMessages`. A user with View-only access can use the web pad but cannot start a session from it, contradicting the spec.

---

### M2. Tombstone check uses `settings` from a potentially-deleted guild
**File:** `src/web/app.ts`
**Verdict:** wontfix — `isTombstoned` `?? 2` is the spec default; guildDelete never deletes `guild_settings`.

Related to C5 above. The spec says closed instances are visible until `closed_at + tombstone_hours`, then 404. If the guild is deleted, `settings` is `undefined` and `isTombstoned` defaults to 2h — which may not match what the guild had configured. The tombstone window silently changes on guild deletion.

---

### M3. `shiftLeadRoleId` cannot be cleared via `/setup`
**File:** `src/discord/handlers/setup.ts`
**Verdict:** fix — add optional boolean `/setup clear_shift_lead`; handler passes `shiftLeadRoleId: null` only when clear is true and `shift_lead` is omitted; if both set, prefer the Role (do not clear). Store already writes null when provided.

```ts
shiftLeadRoleId: interaction.options.getRole("shift_lead")?.id,
```

When the option is omitted, this is `undefined`, which `upsertGuildSettings` treats as "don't change". There is no way to remove a previously set `shiftLeadRoleId` through the command. The spec does not explicitly address this, but the UI implies it should be clearable.

---

## Medium — Questionable Decisions

### Q1. `CSRF_COOKIE` constant defined in two files
**Files:** `src/web/cookies.ts`, `src/web/csrf.ts`
**Verdict:** defer — delete unused `CSRF_COOKIE` in `cookies.ts` (app imports csrf.ts only).

Both export `CSRF_COOKIE = "aho_csrf"`. `app.ts` imports `CSRF_COOKIE` from `csrf.ts` for cookie writes but `COOKIE_NAME` from `cookies.ts` for session reads. If either definition drifts, CSRF validation silently breaks with no type error.

---

### Q2. Route files in `src/web/routes/` are empty stubs
**Files:** `src/web/routes/instance.ts`, `src/web/routes/start.ts`
**Verdict:** defer — delete empty `registerInstanceRoutes` / `registerStartRoutes` stubs; routing lives in `createWebApp`.

Both export functions that do nothing. All routing is inlined in `createWebApp`. These files add confusion — a reader will open them expecting route definitions and find only comments.

---

### Q3. `loadEnv` silently swallows all parse errors
**File:** `src/loadEnv.ts`
**Verdict:** defer — stop swallowing `loadEnvFile` parse errors.

The `catch` block ignores all errors from `loadFn`. If `.env` exists but has a syntax error, the app starts with missing env vars and throws a confusing `missing env DISCORD_TOKEN` error rather than a clear parse error.

---

### Q4. Web mode and Discord mode are completely independent with no user indication
**Files:** `src/public/app.js`, `src/stores/MemoryModeStore.ts`
**Verdict:** wontfix — spec: web Mode is browser-local and never touches ModeStore.

The web client tracks `mode` locally in JS. The Discord bot tracks mode in `MemoryModeStore` (server-side, per-process). Toggling mode on Discord does not affect the web UI and vice versa. There is no indication of this to the user.

---

### Q5. `app.js` — tick mark appended by inspecting `textContent`
**File:** `src/public/app.js`
**Verdict:** defer — gate the tick suffix on class/dataset, not `textContent.endsWith(" ✅")`.

```js
if (!row.textContent.endsWith(" ✅")) row.textContent += " ✅";
```

If the display name or room name ends with ` ✅`, the tick mark is never appended. The tick mark should be tracked via a class or data attribute, not by inspecting text content.

---

### Q6. `getAuthorized` re-fetches instance from DB on every SSE connection; captured instance is never refreshed
**File:** `src/web/app.ts`
**Verdict:** wontfix — SSE only needs instance id; POST `getAuthorized` re-reads; close is EventSink.

The `instance` object captured at SSE connection time is never refreshed. If the instance closes while a client is connected, `auth.instance.closedAt` remains `null` for the lifetime of the connection. The `closed` event is delivered via the event sink (partially mitigating this), but the captured state is stale.

---

### Q7. `nextCounter` allows admin override to reuse an already-used shift number
**File:** `src/domain/shift.ts`
**Verdict:** wontfix — spec allows duplicate open shift labels; no unique constraint.

`adminOverride` is validated to be 1–99999 but is not checked against existing shift numbers in the DB. An admin can start SHIFT 1 again after it has already been used, creating two instances with the same `shiftNumber` in the same guild. The `shiftNumber` column has no unique constraint.

---

### Q8. `buildPanelComponents` accepts `undefined` instanceId and generates invalid custom IDs
**File:** `src/discord/panel.ts`
**Verdict:** defer — make `buildPanelComponents(instanceId: string)` required; callers already pass id.

When `instanceId` is `undefined`, buttons get custom IDs like `"mode:"` and `"rm:RM1"` which `parsePanelCustomId` rejects (regex requires a non-empty instanceId segment). These buttons would silently do nothing when pressed. The `undefined` path appears to be dead code but is a footgun.

---

### Q9. `registerGlobalCommands` runs on every startup
**File:** `src/index.ts`
**Verdict:** defer — global command PUT every boot matches plan 05; skip unchanged or move to CLI later.

`registerGlobalCommands` makes a `PUT` to Discord's application commands API on every process start. Discord rate-limits this endpoint. In a crash-loop scenario this will hit the rate limit quickly and delay recovery. Commands should only be registered when they change, or registration should be a separate CLI step.

---

### Q10. `migrate` has no schema versioning
**File:** `src/db.ts`
**Verdict:** defer — add `user_version` when the first ALTER is needed; `IF NOT EXISTS` is enough now.

All DDL is in a single `db.exec` with `CREATE TABLE IF NOT EXISTS`. Adding a column cannot be expressed idempotently this way. Any future schema change requires manual migration or a migration runner. There is no `user_version` pragma or migration table.

---

### Q11. `bindHost` is hardcoded and not configurable
**File:** `src/config.ts`
**Verdict:** wontfix — `bindHost: "0.0.0.0"` is locked spec.

`bindHost: "0.0.0.0"` is hardcoded as a literal type. Binding to all interfaces is fine for containers but surprising in development and potentially a security concern on multi-homed hosts.

---

### Q12. `upsertGuildSettings` — `shiftLeadRoleIdProvided` sentinel is fragile
**File:** `src/stores/guildSettings.ts`
**Verdict:** wontfix — `shiftLeadRoleIdProvided` is assigned after spread so it cannot be overridden; input type has no that field.

```ts
}).run({
  ...input,
  shiftLeadRoleIdProvided: input.shiftLeadRoleId === undefined ? 0 : 1,
});
```

`input` is spread first, then the sentinel is added. If `input` ever gains a `shiftLeadRoleIdProvided` property, the spread would override the sentinel silently. The sentinel should be computed before the spread or the object should be constructed explicitly without spreading.

---

### Q13. `closeIdleOnce` — N+1 queries per tick
**File:** `src/jobs/idleCloser.ts`
**Verdict:** defer — N+1 `getGuildSettings` per idle tick; JOIN later if SQLite 20/guild/60s matters.

`listAllOpenInstances` returns every open instance across all guilds, then `getGuildSettings` is called inside the loop for each one. With many guilds this is N+1 queries per 60-second tick.

---

## Low — Test Coverage Gaps

### T1. No test for `allowCreate` cross-user isolation
**File:** `tests/throttle.test.ts`
**Verdict:** defer — add `allowCreate("b")===true` after 3× `"a"`; per-user keys already exist.

Tests only one user. The `creates` Map is module-global and shared across all users. There is no test verifying that throttling user A does not affect user B, or that the Map is cleaned up correctly after the window expires for multiple users.

---

### T2. No test for `reactWithGuildEmoji` fallback emoji reset
**File:** `src/discord/postOrTick.ts`
**Verdict:** defer — test invalid-emoji persist-to-✅ + fallback `react`.

The `invalid_emoji` fallback path (reset to `✅` in DB, retry react) has no test. This is the path that mutates guild settings as a side effect.

---

### T3. No test for the SSE `/events` endpoint
**File:** `src/web/app.ts`
**Verdict:** defer — EventSink unit exists; Express `/events` SSE/auth/heartbeat optional.

The SSE endpoint, heartbeat, and unsubscribe-on-close logic are entirely untested. The heartbeat interval leak (if `req.on("close")` never fires, e.g., due to a proxy that doesn't forward TCP close) is also unguarded.

---

### T4. `db.test.ts` has a `void report` suppressor
**File:** `tests/db.test.ts`
**Verdict:** wontfix — `report()` is used in db.test.ts; the leftover `void report;` is unused-statement hygiene, not a hidden unused helper.

`void report;` at the end of the file suppresses a TypeScript "declared but never read" warning for the `report` helper. This hides the fact that the helper is unused in at least one test path rather than removing the unused code.

---

### T5. `tsconfig.json` excludes `tests/` from type checking
**File:** `tsconfig.json`
**Verdict:** defer — src-only `tsc` + `tsx --test` is enough unless we add a tests typecheck config.

`"include": ["src"]` means test files are not type-checked by `tsc`. Tests run via `tsx` which transpiles without type checking. Type errors in test files (wrong mock shapes, etc.) are silently ignored.

---

## Summary Table

| ID | Severity | File | Issue | Verdict |
|----|----------|------|-------|---------|
| C1 | Critical | `src/web/app.ts` | OAuth token Map leaks and breaks on restart | fix |
| C2 | Critical | `src/discord/createInstance.ts` | Throttle resets on process restart | wontfix |
| C3 | Critical | `src/web/permissions.ts` | `memberViewOnChannel` never checks permissions | fix |
| C4 | Critical | `src/discord/postOrTick.ts` | Inline SQL bypasses settings store | wontfix |
| C5 | Critical | `src/web/app.ts` | `settings!` assertion wrong after guild deletion | fix |
| H1 | High | `src/discord/createInstance.ts` | Shift counter written before instance committed | accepted |
| H2 | High | `src/domain/reportMachine.ts` | `touchActivity` skipped on gone→post path | fix |
| H3 | High | `src/domain/closeInstanceFlow.ts` | Double channel fetch on thread close | defer |
| H4 | High | `src/discord/handlers/session.ts` | No `deferReply` before async close work | fix |
| H5 | High | `src/stores/locks.ts` | Lock Map leaks under sustained load | wontfix |
| H6 | High | `src/discord/handlers/report.ts` | `decideReport` called outside lock, result stale | wontfix |
| H7 | High | `src/public/app.js` | SSE reconnect can spawn two polling intervals | wontfix |
| H8 | High | `src/discord/client.ts` | `discordPort` created twice; fallback untested | wontfix |
| M1 | Medium | `src/web/app.ts` | Web start requires View+Send, spec says View only | fix |
| M2 | Medium | `src/web/app.ts` | Tombstone window wrong after guild deletion | wontfix |
| M3 | Medium | `src/discord/handlers/setup.ts` | `shiftLeadRoleId` cannot be cleared | fix |
| Q1 | Low | `src/web/cookies.ts` + `csrf.ts` | `CSRF_COOKIE` defined twice | defer |
| Q2 | Low | `src/web/routes/` | Route files are empty stubs | defer |
| Q3 | Low | `src/loadEnv.ts` | Parse errors silently swallowed | defer |
| Q4 | Low | `src/public/app.js` | Web/Discord mode are independent, no indication | wontfix |
| Q5 | Low | `src/public/app.js` | Tick mark checked via `textContent` string suffix | defer |
| Q6 | Low | `src/web/app.ts` | SSE captured instance never refreshed | wontfix |
| Q7 | Low | `src/domain/shift.ts` | Admin can reuse existing shift numbers | wontfix |
| Q8 | Low | `src/discord/panel.ts` | `undefined` instanceId produces invalid custom IDs | defer |
| Q9 | Low | `src/index.ts` | Commands registered on every startup | defer |
| Q10 | Low | `src/db.ts` | No schema versioning | defer |
| Q11 | Low | `src/config.ts` | `bindHost` hardcoded, not configurable | wontfix |
| Q12 | Low | `src/stores/guildSettings.ts` | Sentinel fragile under spread | wontfix |
| Q13 | Low | `src/jobs/idleCloser.ts` | N+1 queries per idle-closer tick | defer |
| T1 | Low | `tests/throttle.test.ts` | No cross-user throttle isolation test | defer |
| T2 | Low | `src/discord/postOrTick.ts` | No test for emoji fallback reset | defer |
| T3 | Low | `src/web/app.ts` | SSE endpoint entirely untested | defer |
| T4 | Low | `tests/db.test.ts` | `void report` suppressor hides unused helper | wontfix |
| T5 | Low | `tsconfig.json` | Tests excluded from type checking | defer |
