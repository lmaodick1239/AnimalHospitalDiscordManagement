# Plan 04 — Web OAuth, pad, live log, SSE

> Parent: [`00-locked-spec.md`](00-locked-spec.md)
> Prev: [`03-discord.md`](03-discord.md)
> Next: [`05-lifecycle.md`](05-lifecycle.md)

**Goal:** Express app on the same process: Discord OAuth, guild picker / user-invoke, instance pad + occupancy + structured live log.

**Architecture:** Server-rendered HTML + [`src/public/app.js`](src/public/app.js) + [`src/public/app.css`](src/public/app.css). Session cookie holds Discord user id. CSRF token in HTML. SSE from `EventSink`. Web Mode is **browser-local**; never `ModeStore`.

---

### Task 20: Cookie + CSRF

**Files:**
- Create: `src/web/cookies.ts`
- Create: `src/web/csrf.ts`
- Test: `tests/cookies.test.ts`
- Test: `tests/csrf.test.ts`

**Interfaces:**

```ts
export const COOKIE_NAME = "aho_session";
export const CSRF_COOKIE = "aho_csrf";

export function signSession(userId: string, secret: string): string;
export function unsignSession(cookie: string, secret: string): string | null; // discord user id
export type SessionPayload = { userId: string };

export function cookieHeader(name: string, value: string, opts: {
  maxAgeSec: number;
  secure: boolean;
}): string;
// HttpOnly; SameSite=Lax; Path=/; Max-Age; Secure if publicBaseUrl is https OR TRUST_PROXY

export function newCsrfToken(): string; // 32 bytes hex
export function csrfFormField(token: string): string; // <input type="hidden" name="csrf" value="...">
export function originAllowed(originOrReferer: string | undefined, publicBaseUrl: string): boolean;
export function csrfOk(opts: {
  cookieToken: string | undefined;
  bodyToken: string | undefined;
  origin: string | undefined;
  referer: string | undefined;
  publicBaseUrl: string;
}): boolean;
// true iff cookieToken && bodyToken && cookieToken === bodyToken && originAllowed(origin ?? referer)
```

Session cookie value: `cookie-signature` `sign(userId, secret)` (hmac). 7-day max-age = `604800`.

- [ ] **Step 1: Tests** round-trip sign, tamper → null, origin host match with/without trailing path, csrf mismatch false, missing origin false.

`originAllowed("https://example.com", "https://example.com")` true.
`originAllowed("https://example.com/g/1/i/2", "https://example.com")` true (referer).
`originAllowed("https://evil.com", "https://example.com")` false.

- [ ] **Step 2: FAIL → implement → PASS**

- [ ] **Step 3: Commit** `feat: signed session cookie and csrf checks`

---

### Task 21: OAuth + guild membership gate

**Files:**
- Create: `src/web/oauth.ts`
- Create: `src/web/permissions.ts`

**Interfaces:**

```ts
export function authorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string;
// https://discord.com/api/oauth2/authorize?response_type=code&client_id=&scope=identify%20guilds&redirect_uri=&state=

export async function exchangeCode(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ accessToken: string }>;

export async function fetchMe(accessToken: string): Promise<{ id: string; username: string; globalName: string | null }>;
export async function fetchUserGuilds(accessToken: string): Promise<{ id: string; name: string }[]>;

export async function fetchMemberDisplayName(opts: {
  botToken: string;
  guildId: string;
  userId: string;
}): Promise<string | null>;
// GET /guilds/{guildId}/members/{userId} → nick ?? user.global_name ?? user.username
// 404 → null (not a member)

export async function memberViewOnChannel(opts: {
  botToken: string;
  guildId: string;
  channelId: string;
  userId: string;
}): Promise<boolean>;
// GET member + GET channel; compute permission overwrite ViewChannel.
// Use discord.js PermissionOverwrites.resolve if a Guild is cached; otherwise REST:
// 1. GET /guilds/{id}/members/{userId} — 404 = false
// 2. GET /channels/{channelId}
// 3. GET /guilds/{id} roles? Simpler: GET /guilds/{guildId}/members/{userId} and
//    client.channels.fetch + GuildChannel.permissionsFor(userId) when Client is available.
```

Because the bot `Client` is in-process, **prefer**:

```ts
export async function memberCanViewChannel(client: Client, guildId: string, channelId: string, userId: string): Promise<boolean>;
export async function memberDisplayName(client: Client, guildId: string, userId: string, fallback: string): Promise<string>;
export async function isGuildMember(client: Client, guildId: string, userId: string): Promise<boolean>;
```

`guild.members.fetch(userId)` then `channel.permissionsFor(member)?.has(ViewChannel)`. Missing member → false. Missing channel → false.

OAuth `fetchUserGuilds` still needed for the Start picker (mutual guilds). Filter to guilds that exist in `guild_settings` AND `client.guilds.cache.has(id)`.

- [ ] **Step 1: Unit-test `authorizeUrl` query string.** REST wrappers: no live HTTP; keep them thin.
- [ ] **Step 2: Implement**
- [ ] **Step 3: Commit** `feat: discord oauth helpers and channel view gate`

---

### Task 22: HTML layout + CSS

**Files:**
- Create: `src/web/views/layout.ts`
- Create: `src/web/views/start.ts`
- Create: `src/web/views/instance.ts`
- Create: `src/public/app.css`

**Interfaces:**

```ts
export function layout(opts: { title: string; body: string; extraHead?: string }): string;
export function startPage(opts: {
  csrf: string;
  guilds: { id: string; name: string }[];
  inviteUrl: string;
}): string;
export function instancePage(opts: {
  csrf: string;
  guildId: string;
  instanceId: string;
  shiftNumber: number;
  closed: boolean;
  occupancy: OccupancyMap;
  rows: SnapshotRow[];
  timeZone: string;
  tickMark: "✅"; // always
}): string;
```

Escape all interpolated user/guild names with a `esc(s)` that replaces `&<>"'`.

**Start page:** if `guilds.length === 0`, show `Invite the bot and run /setup` and `<a href="{inviteUrl}">`. Else one form per guild: `POST /start` hidden `guildId` + csrf, button = guild name.

**Instance page** (closed: add `disabled` on buttons, banner `SHIFT {n} · Closed`, still render log):

- `#mode` button text `Mode: ANOMALY`
- `#pad` 8 buttons `data-room="RM1"` …
- `#log` ordered list
- `data-instance-url` for SSE `/g/{guildId}/i/{id}/events`
- `data-post-url` `/g/{guildId}/i/{id}/report`
- `data-csrf` on body or meta

CSS variables:

```css
:root {
  --pink: #ff4d6d;
  --yellow: #ffd166;
  --bg: #111;
  --fg: #f5f5f5;
  --muted: #888;
}
```

Pad: `display: grid; gap: 0.75rem;`
Portrait (default): mode `grid-column: 1 / -1`; rooms `grid-template-columns: 1fr 1fr` (2×4).
`@media (min-width: 700px)`: rooms `grid-template-columns: repeat(4, 1fr)` (4×2).
Buttons `min-height: 3.5rem; font-size: 1.1rem; width: 100%`.
`.occ-ANOMALY { background: var(--pink); color: #111; }`
`.occ-MAYBE { background: var(--yellow); color: #111; }`
Log: `min-height: 40vh; overflow: auto;`
`.row-ANOMALY { background: color-mix(in srgb, var(--pink) 35%, transparent); }`
`.row-MAYBE { background: color-mix(in srgb, var(--yellow) 35%, transparent); }`
`.row-ticked { opacity: 0.55; text-decoration: strikethrough; }` use `text-decoration: line-through`.
`.row-banner { font-weight: 700; }`
Times `HH:mm:ss` rendered server-side **and** client-side with `Intl` `timeZone` from `data-tz`.

- [ ] **Step 1: Implement views + CSS. Snapshot test optional: `assert.match(html, /Mode: ANOMALY/)`.
- [ ] **Step 2: Commit** `feat: server-rendered start and instance pages`

---

### Task 23: Format log timestamps

**Files:**
- Create: `src/domain/formatTime.ts`
- Test: `tests/formatTime.test.ts`

```ts
export function formatHms(iso: string, timeZone: string): string;
```

Same `Intl` h23 as thread names, output `HH:mm:ss`.

Test: `2026-09-15T04:03:07.000Z` + `Asia/Hong_Kong` → `12:03:07`.

- [ ] **Step 1: FAIL → implement → PASS → commit** `feat: guild-tz log timestamps`

---

### Task 24: Express app + routes

**Files:**
- Create: `src/web/app.ts`
- Create: `src/web/routes/start.ts`
- Create: `src/web/routes/instance.ts`

**Interfaces:**

```ts
export function createWebApp(opts: {
  config: Config;
  db: Database;
  client: Client;
  clock: Clock;
  events: EventSink;
  discordPort: DiscordPort;
}): Express;
```

Middleware:

- `express.urlencoded({ extended: false })`
- `express.json()`
- static `src/public` at `/static`
- `trust proxy` if `config.trustProxy`

Auth helper: read cookie, `unsignSession`; else 302 `/login?returnTo=`

**Routes:**

`GET /login`

- store `returnTo` (only relative paths starting `/`, else `/`) in signed state
- 302 Discord authorizeUrl. `redirectUri = ${publicBaseUrl}/oauth/callback`

`GET /oauth/callback?code&state`

- exchangeCode, fetchMe, set session cookie 7d, 302 returnTo

`GET /`

- require session
- list mutual guilds ∩ guild_settings ∩ bot guilds
- render startPage

`POST /start`

- require session + csrfOk
- guildId from body
- user must be member + ViewChannel on **default** output channel
- `createInstanceFlow` mode `user` with actorPermissions from `channel.permissionsFor(member)`
- 302 `/g/{guildId}/i/{id}`
- errors: 403/429/400 with short HTML or text: same strings as Discord

`GET /g/:guildId/i/:instanceId`

- require session
- `getInstance`; wrong guild param → 404
- missing → 404
- if `closedAt` and `now > closedAt + tombstoneHours` → 404
- ViewChannel on **parent_channel_id** else 403
- render instancePage (closed flag if closedAt set)

`GET /g/:guildId/i/:instanceId/events` SSE

- same auth + view + tombstone 404
- `Content-Type: text/event-stream`
- first event: `data: { type: "hello", occupancy, rows, closed }` JSON
- subscribe EventSink; write `data: ${JSON.stringify(ev)}\n\n`
- heartbeat comment `:ping\n\n` every 15s
- on close, unsubscribe

`GET /g/:guildId/i/:instanceId/poll`

- same auth
- JSON `{ occupancy, rows, closed }` for SSE fallback

`POST /g/:guildId/i/:instanceId/report`

- session + csrf (JSON body `{ csrf, room, kind }` **or** form). Kind optional; if omitted, web client sends its local mode.
- closed → 409 `{ ok: false, error: "Session closed." }`
- tombstone → 404
- ViewChannel else 403
- `isRoom`/`isKind` else 400
- displayName via `memberDisplayName`
- `withRoomLock` + `applyReport`
- 200 `{ ok: true, result: "posted" | "ticked", occupancy, report }`
- map machine errors to 409/502 `{ ok: false, error }`

Do **not** accept a web Close route.

- [ ] **Step 1: Implement. Extract status-mapping to a small function for tests if easy.
- [ ] **Step 2: Commit** `feat: express oauth, start, instance, sse, report`

---

### Task 25: Client JS (vanilla)

**Files:**
- Create: `src/public/app.js`

Behavior:

1. Read `data-tz`, `data-events`, `data-post`, `data-csrf`, `data-closed`.
2. Mode button: local `let mode = "ANOMALY"`; click toggles; `textContent = "Mode: " + mode`. Do not POST.
3. Room click: `POST` JSON `{ csrf, room, kind: mode }`. Disable that button until response. No success toast. On error, `alert(error)` or a `#err` text node.
4. Occupancy: set class `occ-ANOMALY` / `occ-MAYBE` / none from payload.
5. SSE `EventSource(eventsUrl)`. On message, apply occupancy; if `report` append row; if `tick` mark row by `report.id`; if `closed` disable pad, title Closed.
6. `onerror`: close EventSource, `setInterval(poll, 2000)` until a poll succeeds then try SSE again.
7. Log stick-to-bottom: if user is within 32px of bottom, keep pinning on append.
8. Row HTML: time `formatHms` in JS (duplicate Intl) + banner text or `RM3 ANOMALY` + displayName + if tickedAt ` ✅`.
9. If `data-closed="1"` at load, do not bind POSTs.

Keep file < ~200 lines. No bundler.

- [ ] **Step 1: Implement**
- [ ] **Step 2: Commit** `feat: vanilla pad, mode toggle, sse with poll fallback`

---

Coverage: OAuth, CSRF, start=user-invoke, instance page, occupancy SSE, web report through the same machine. Lifecycle jobs in plan 05.
