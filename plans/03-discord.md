# Plan 03 — Discord client, commands, panel, destination

> Parent: [`00-locked-spec.md`](00-locked-spec.md)
> Prev: [`02-report-machine.md`](02-report-machine.md)
> Next: [`04-web.md`](04-web.md)

**Goal:** discord.js v14 bot that can `/setup`, user/admin invoke, close, `/report`, and drive the shared panel. All structured writes go through `applyReport`.

**Architecture:** `Client` + `GatewayIntentBits.Guilds` only (guild members via REST). Slash commands registered globally. Button `custom_id` format is fixed below. Display names via `GuildMember.displayName`.

---

### Custom ID and permission integer (lock these)

Button custom ids (max 100 chars; ULIDs are 26):

```
mode:{instanceId}
rm:{instanceId}:{RM1..RM8}
```

Invite permission bits (compute in `src/discord/permissions.ts`):

```
ViewChannel
SendMessages
SendMessagesInThreads
EmbedLinks
ReadMessageHistory
AddReactions
CreatePublicThreads
ManageThreads
UseExternalEmojis
```

`inviteUrl(clientId)` = `https://discord.com/oauth2/authorize?client_id={id}&scope=bot%20applications.commands&permissions={bits}`

---

### Task 11: Permission helpers + panel builder

**Files:**
- Create: `src/discord/permissions.ts`
- Create: `src/discord/panel.ts`
- Test: `tests/permissions.test.ts`
- Test: `tests/panel.test.ts`

**Interfaces:**

```ts
import { PermissionFlagsBits } from "discord.js";

export const BOT_PERMISSIONS =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.SendMessagesInThreads |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.ReadMessageHistory |
  PermissionFlagsBits.AddReactions |
  PermissionFlagsBits.CreatePublicThreads |
  PermissionFlagsBits.ManageThreads |
  PermissionFlagsBits.UseExternalEmojis;

export function inviteUrl(clientId: string): string;

export function memberCanView(permissions: bigint): boolean; // ViewChannel
export function memberCanStart(permissions: bigint): boolean; // ViewChannel + SendMessages
export function botCanHost(permissions: bigint): boolean; // all BOT_PERMISSIONS

export function isManageServer(permissions: bigint): boolean;
// Administrator | ManageGuild

export function isShiftLead(opts: {
  memberPermissions: bigint;
  memberRoleIds: string[];
  shiftLeadRoleId: string | null;
}): boolean;
// true if isManageServer OR (shiftLeadRoleId && memberRoleIds includes it)
```

```ts
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from "discord.js";

export function panelCustomId(kind: "mode" | "rm", instanceId: string, room?: Room): string;
export function parsePanelCustomId(id: string):
  | { kind: "mode"; instanceId: string }
  | { kind: "rm"; instanceId: string; room: Room }
  | null;

export function buildPanelComponents(): ActionRowBuilder<ButtonBuilder>[];
// row0: Mode Secondary
// row1: RM1..RM5 Secondary
// row2: RM6..RM8 Secondary
// custom ids filled by bindPanel(instanceId, rows) OR buildPanelComponents(instanceId)

export function buildPanelEmbed(input: {
  shiftNumber: number;
  url: string;
  startedBy: string;
  closed?: boolean;
}): EmbedBuilder;
// open: title `SHIFT {n}`, description url, footer `started by {startedBy}`
// closed: title `SHIFT {n} · Closed`, description url, footer same, NO fields required
```

- [ ] **Step 1: Tests**

`inviteUrl("123")` contains `client_id=123`, `scope=bot%20applications.commands`, and `permissions=` + `BOT_PERMISSIONS.toString()`.

`isShiftLead` with role set / unset / ManageGuild without role.

`parsePanelCustomId("rm:01ARZ3NDEKTSV4RRFFQ69G5FAV:RM3")` round-trips. Invalid room → null. Too long garbage → null.

`buildPanelComponents(instanceId)`: 3 rows, 1+5+3 buttons, labels `Mode`,`RM1`,…`RM8`.

Closed embed title includes `Closed`.

- [ ] **Step 2: FAIL → implement → PASS**

- [ ] **Step 3: Commit** `feat: discord permission bits and panel builders`

---

### Task 12: Register slash commands

**Files:**
- Create: `src/discord/registerCommands.ts`

**Interfaces:**

```ts
export function commandJson(): RESTPostAPIChatInputApplicationCommandsJSONBody[];
export async function registerGlobalCommands(token: string, clientId: string): Promise<void>;
```

Commands (names and options exact):

**`/setup`** default member perms `PermissionFlagsBits.ManageGuild` (Discord will hide from others; still check in handler).

Options:

- `channel` Channel, required, channel types: GuildText only
- `timezone` String, optional, autocomplete
- `shift_lead` Role, optional
- `tick_emoji` String, optional
- `idle_hours` Integer 1–72, optional
- `tombstone_hours` Integer 1–72, optional

**`/session`** subcommands:

- `start` no options
- `start-admin`
  - `channel` Channel required GuildText
  - `thread` Boolean required
  - `shift` Integer 1–99999 optional
  - `thread_name` String optional max 100
- `close`
  - `instance` String optional, autocomplete

**`/report`**

- `room` String required, choices RM1–RM8 (value = name)
- `kind` String optional, choices ANOMALY, MAYBE

- [ ] **Step 1: Unit-test `commandJson()`** names, option names, choice values. Do not hit Discord API in tests.

- [ ] **Step 2: Implement `registerGlobalCommands`** using `REST` + `Routes.applicationCommands(clientId)` PUT.

- [ ] **Step 3: Commit** `feat: global slash command definitions`

---

### Task 13: Destination create (threads / unthreaded)

**Files:**
- Create: `src/discord/destination.ts`
- Test: `tests/destination.test.ts` (pure helpers only)

**Interfaces:**

```ts
export function resolveThreadName(opts: {
  now: Date;
  timeZone: string;
  adminName?: string | null;
}): string;
// trim adminName; if provided and empty after trim → throw Error("empty thread name")
// if omitted/null/undefined → threadTimestampName(now, timeZone)
// if longer than 100 → throw (Discord max); after trim length 1..100 ok
```

The actual Discord create lives in the session handler (Task 15) because it needs `TextChannel.threads.create`. Tests here only cover naming.

Thread create options when calling discord.js:

```ts
{
  name,
  autoArchiveDuration: 1440, // 24h
  reason: `shift ${shiftNumber}`,
}
```

- [ ] **Step 1: Tests for `resolveThreadName`** (empty reject, default timestamp, trim, 100 cap)

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit** `feat: thread name resolver`

---

### Task 14: DiscordPort implementation

**Files:**
- Create: `src/discord/postOrTick.ts`

**Interfaces:**

```ts
import type { Client } from "discord.js";
import type { DiscordPort } from "../domain/reportMachine.ts";

export function createDiscordPort(client: Client, log?: { error: (...a: unknown[]) => void }): DiscordPort;
```

Behavior:

`unarchive`: if `instance.isThread`, fetch thread (`client.channels.fetch(destinationChannelId)`). If `archived`, `setArchived(false)`. Catch and log, never throw.

`sendReport`: fetch destination channel; `channel.send({ content: reportBody(...) })`; return `{ messageId: msg.id }`. Throw on failure.

`tickReport`: fetch channel; fetch message; `message.react(tickEmoji)`.

- If message missing (`Unknown Message` / code 10008) → `{ ok: false, reason: "gone" }`
- If emoji invalid (50035 / 10014) → try `message.react("✅")`. If that works, still `{ ok: true }` **and** caller does not persist fallback here — `/setup` persist of `✅` happens in a dedicated helper used by tick **and** by a wrapper in apply? Spec: "If react() rejects the emoji, react ✅ and keep using ✅ for that guild until /setup changes it".

Add:

```ts
export async function reactWithGuildEmoji(opts: {
  message: Message;
  guildId: string;
  tickEmoji: string;
  db: Database;
}): Promise<{ ok: true } | { ok: false; reason: "gone" | "outage" }>;
```

If custom emoji react fails for **invalid emoji**, `set tick_emoji = '✅'` on guild_settings, react `✅`. If `✅` fails too → `outage`. If unknown message → `gone`. Other Discord API errors → `outage`.

`createDiscordPort` needs `db` as well:

```ts
export function createDiscordPort(client: Client, db: Database, log?: ...): DiscordPort;
```

- [ ] **Step 1: No live Discord tests.** Optional: extract `classifyDiscordError(err): "gone" | "invalid_emoji" | "outage"` and unit-test with fake `{ code: 10008 }`.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit** `feat: discord port for send, tick, unarchive`

---

### Task 15: `/setup` handler

**Files:**
- Create: `src/discord/handlers/setup.ts`

**Interfaces:**

```ts
export async function handleSetup(interaction: ChatInputCommandInteraction, db: Database): Promise<void>;
export async function handleTimezoneAutocomplete(interaction: AutocompleteInteraction): Promise<void>;
```

Rules:

- Member permissions: ManageGuild or Administrator; else ephemeral `You need Manage Server to run /setup.`
- Channel: type GuildText; bot `botCanHost` on that channel; else ephemeral listing missing perms.
- Timezone: if provided, `isValidIanaTimeZone` else ephemeral `Unknown timezone.`
- `idle_hours` / `tombstone_hours` already constrained by command builder; still clamp 1–72.
- `tick_emoji`: if provided, accept unicode (length 1–8 graphemes ok) or `/^<a?:(\w+):(\d+)>$/`. Empty string → `✅`.
- `upsertGuildSettings`. Ephemeral ack summarizing values.

Autocomplete: filter `COMMON_TIMEZONES` plus if `focused` is a valid IANA include it; max 25.

- [ ] **Step 1: Implement. Manual test later in plan 05.**
- [ ] **Step 2: Commit** `feat: /setup guild settings`

---

### Task 16: Create-instance shared function

**Files:**
- Create: `src/discord/createInstance.ts`

**Interfaces:**

```ts
export class ThrottleError extends Error { constructor() { super("rate limited"); } }
export class CapError extends Error { constructor() { super("too many open instances"); } }
export class NotSetupError extends Error { constructor() { super("set an output channel"); } }
export class BotPermsError extends Error { constructor(readonly missing: string) { super(missing); } }
export class UnthreadedConflictError extends Error { constructor() { super("channel already has an open unthreaded instance"); } }

export function allowCreate(userId: string, nowMs: number, windowMs?: number): boolean;
// 3 per 60_000 ms per user. In-memory Map. Tests in tests/throttle.test.ts

export async function createInstanceFlow(opts: {
  db: Database;
  client: Client;
  config: Config;
  clock: Clock;
  events: EventSink;
  guildId: string;
  actorId: string;
  actorDisplayName: string;
  actorPermissions: bigint;
  mode: "user" | "admin";
  admin?: {
    channelId: string;
    thread: boolean;
    shift?: number;
    threadName?: string;
  };
}): Promise<{ instance: Instance; url: string }>;
```

Flow:

1. `getGuildSettings` missing → `NotSetupError` with message `set an output channel`.
2. Parent channel id = user mode ? settings.defaultChannelId : admin.channelId.
3. Fetch channel; must be GuildText.
4. Bot perms `botCanHost` else `BotPermsError`.
5. User mode: `memberCanStart(actorPermissions)` else throw `Error("You need View Channel and Send Messages in the output channel.")`.
6. Admin + `thread===false`: `findOpenUnthreaded(parent)` → `UnthreadedConflictError`.
7. `countOpenInstances >= 20` → `CapError`.
8. `allowCreate(actorId)` false → `ThrottleError`.
9. Shift: user → `nextCounter(settings.shiftCounter)`; admin with n → `assertShiftNumber` then `nextCounter(counter, n)`; admin omit → nextCounter. `setShiftCounter`.
10. If user mode OR admin.thread: `resolveThreadName`; `channel.threads.create({ name, autoArchiveDuration: 1440 })`. Destination = thread.id, `isThread=true`. Else destination = parent, `isThread=false`.
11. `insertInstance` with ulid, created_at = last_activity_at = clock.now ISO, banner/panel null.
12. Send banner `shiftBanner(n)` in destination.
13. Send panel embed + components bound to instance id. URL = `${config.publicBaseUrl}/g/${guildId}/i/${id}`.
14. `setInstanceMessages`.
15. Return `{ instance, url }`.

If banner/panel send fails after insert: `closeInstance` immediately and rethrow (no orphan open instance without a panel).

- [ ] **Step 1: Unit-test `allowCreate`** (3 ok, 4th false, after 60s ok). Use injected nowMs.
- [ ] **Step 2: Implement flow**
- [ ] **Step 3: Commit** `feat: create instance flow for user and admin invoke`

---

### Task 17: `/session` handlers

**Files:**
- Create: `src/discord/handlers/session.ts`

**Interfaces:**

```ts
export async function handleSession(interaction: ChatInputCommandInteraction, deps: {
  db: Database; client: Client; config: Config; clock: Clock; events: EventSink;
}): Promise<void>;
export async function handleCloseAutocomplete(interaction: AutocompleteInteraction, db: Database): Promise<void>;
```

`start`: deferEphemeral; `createInstanceFlow` mode user; reply `Started SHIFT {n}\n{url}`. Map errors to ephemeral strings:

- NotSetupError → `set an output channel`
- ThrottleError → `Slow down. Max 3 sessions per minute.`
- CapError → `This server already has 20 open sessions.`
- UnthreadedConflictError → should not happen for user
- BotPermsError → `Bot is missing permissions: …`

`start-admin`: `isShiftLead` else ephemeral `You need the Shift Lead role or Manage Server.` Then createInstanceFlow mode admin.

`close`: `isShiftLead` else deny. Resolve instance:

- If option `instance` provided, `getInstance`.
- Else `findOpenByDestination(interaction.channelId)`.
- If none: `No open session found.`
- If instance.guildId !== interaction.guildId: deny.
- If already closed: `Already closed.`
- `closeInstance`; `events.emit({ type: "closed", ... })`.
- Fetch panel message; edit embed closed; **set components `[]`**.
- If `isThread`, fetch thread `setArchived(true)` best-effort.
- Ephemeral `Closed SHIFT {n}.`

Autocomplete: `listOpenInstances(guild)`, format `SHIFT {n} · {threadName ?? "channel"} · {id}`, value = id, max 25, filter by focused string.

- [ ] **Step 1: Implement**
- [ ] **Step 2: Commit** `feat: /session start, start-admin, close`

---

### Task 18: `/report` + button handlers

**Files:**
- Create: `src/discord/handlers/report.ts`
- Create: `src/discord/handlers/buttons.ts`

**Interfaces:**

```ts
export async function handleReportSlash(interaction: ChatInputCommandInteraction, deps: ReportDeps): Promise<void>;
export async function handleButton(interaction: ButtonInteraction, deps: ReportDeps): Promise<void>;

export type ReportDeps = {
  db: Database;
  client: Client;
  clock: Clock;
  events: EventSink;
  modes: ModeStore;
  discordPort: DiscordPort;
};
```

Shared `runPress`:

```
async function runPress(opts: {
  instanceId: string;
  room: Room;
  kind: Kind;
  userId: string;
  displayName: string;
}): Promise<ApplyResult>
```

Wrap `withRoomLock(instanceId, room, () => applyReport(...))`.

Slash:

1. `findOpenByDestination(interaction.channelId)` else ephemeral `Run this in the session thread or use the panel`.
2. Room from option; kind = option or `modes.get(userId, instance.id)`.
3. `deferReply({ ephemeral: true })` if needed (apply may take >3s). Prefer `reply` ephemeral if fast; spec: always ephemeral ack `Posted` / `Cleared`.
4. Display name: `interaction.member` GuildMember `displayName`.

Buttons:

- Parse custom id; fetch instance; if missing/closed: `Cleared` no — ephemeral `Session closed.`
- Mode: `modes.toggle`; `reply({ content: modeAck(kind), ephemeral: true })`.
- Room: kind = `modes.get`; `deferReply({ ephemeral: true })`; apply; `editReply(postedAck or clearedAck)`.

Map `ClosedInstanceError` → `Session closed.` `DiscordTickError outage` → `Discord failed to add the tick. Try again.` `DiscordPostError` → `Discord failed to send. Try again.`

- [ ] **Step 1: Implement**
- [ ] **Step 2: Commit** `feat: /report and panel buttons`

---

### Task 19: Client wiring (partial index)

**Files:**
- Modify: `src/index.ts`
- Create: `src/discord/client.ts`

**Interfaces:**

```ts
export function createBot(opts: {
  config: Config;
  db: Database;
  clock: Clock;
  events: EventSink;
  modes: ModeStore;
}): Client;
```

`Client` intents: `GatewayIntentBits.Guilds`.

`interactionCreate`:

- autocomplete timezone → setup handler
- autocomplete instance → session handler
- chat input `/setup` `/session` `/report`
- button → buttons handler

`guildDelete` stub empty until plan 05.

`src/index.ts` for this task may still only log; full listen is plan 05 after web exists. Export `createBot` for 05.

- [ ] **Step 1: Implement `createBot`**
- [ ] **Step 2: Commit** `feat: discord client interaction router`

---

Coverage: Discord commands, panel, destination, port, create/close/press. Web is plan 04. Idle closer and `guildDelete` are plan 05.
