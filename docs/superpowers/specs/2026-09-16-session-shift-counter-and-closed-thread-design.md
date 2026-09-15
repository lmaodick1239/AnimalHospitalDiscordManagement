# Session Shift Counter & Closed Thread Formatting — Design

## Problem Summary
1. **Shift Count**: Currently tracked globally across the guild in `guild_settings.shift_counter`. Users want the shift count to be per session (each new session starts at `SHIFT 1`, or admin override, and increments only for that session).
2. **Thread Renaming**: When closing a session, if it is running in a Discord thread, rename the thread to `<original_name> (closed)` (truncated safely to Discord's 100-character limit if needed) before or while archiving.
3. **Closing Message**: When closing a session, send a message to the destination channel: `Game ended. Shift Closed.`

---

## 1. Shift Count Per Session
- **Creation (`createInstanceFlow`)**:
  - For normal `/session start`, default `shiftNumber = 1`.
  - For `/session start-admin`, if `admin.shift` is provided, `shiftNumber = admin.shift`; otherwise `shiftNumber = 1`.
  - No longer reads or updates `guild_settings.shift_counter`.
- **Advancement (`advanceShift`)**:
  - Increments the instance's own `instance.shiftNumber + 1`.
  - Updates `instances.shift_number` in DB.
  - Inserts banner report row into the report log.
  - Ticks uncleared reports.
  - No longer updates `guild_settings.shift_counter`.

---

## 2. Thread Renaming on Close
- In `finalizeClose` ([src/domain/closeInstanceFlow.ts](src/domain/closeInstanceFlow.ts)):
  - If `instance.isThread` is true:
    - Fetch thread channel via `opts.client.channels.fetch(opts.instance.destinationChannelId)`.
    - If channel has `setName`:
      - Determine current name (from `thread.name` or `instance.threadName`).
      - If not already ending in `(closed)`:
        - Format: `${baseName} (closed)`
        - Enforce Discord's 100 character limit (e.g. `${baseName.slice(0, 91)} (closed)`).
        - Call `await thread.setName(closedName)`.
    - Also update `instances.thread_name` in DB if desired, or keep track.
    - Call `await thread.setArchived(true)`.

---

## 3. Destination Close Message
- In `finalizeClose` ([src/domain/closeInstanceFlow.ts](src/domain/closeInstanceFlow.ts)):
  - Before archiving the thread / after updating the panel embed:
  - If channel has `send` (`channel.isTextBased() && "send" in channel`):
    - Send message: `Game ended. Shift Closed.`
  - Guard with try/catch so failure to send doesn't block the rest of closing or throw unhandled exceptions.

---

## 4. Web UI & SSE
- The web UI already listens to `shift` and `closed` SSE events and renders the current instance shift number.
- With `advanceShift` operating directly on `instance.shiftNumber + 1`, web UI receives the correct incremented shift number via SSE without any changes needed.
