# Session Shift Counter, Thread Renaming, and Close Message Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track shift numbers per-session starting at 1, append `(closed)` to thread names on close, and post `Game ended. Shift Closed.` to the destination channel when a session ends.

**Architecture:** Update `createInstanceFlow` to start shifts at 1 (or admin override) without using `guild_settings.shift_counter`. Update `advanceShift` to advance `instance.shiftNumber` without referencing `guild_settings.shift_counter`. In `finalizeClose`, send `Game ended. Shift Closed.` and rename the Discord thread with suffix `(closed)` before archiving.

**Tech Stack:** TypeScript, Node.js, discord.js, better-sqlite3.

## Global Constraints
- Target thread renaming format: `<original_name> (closed)`, truncated to ≤ 100 characters.
- Closing message text: `Game ended. Shift Closed.`
- Per-session shift count: starts at 1 (or admin override), increments per session.

---

### Task 1: Per-Session Shift Counting

**Files:**
- Modify: `src/domain/shift.ts` (if helper adjustments needed)
- Modify: `src/discord/createInstance.ts`
- Modify: `src/domain/reportMachine.ts`
- Test: `tests/shift.test.ts`
- Test: `tests/reportMachine.test.ts`

- [ ] **Step 1: Write failing tests for per-session shift initialization and advanceShift**
Update `tests/reportMachine.test.ts` or `tests/shift.test.ts` to assert that `advanceShift` advances `instance.shiftNumber + 1` independent of `guildSettings.shiftCounter`.
- [ ] **Step 2: Run tests to confirm failure**
`npm test`
- [ ] **Step 3: Update `createInstanceFlow` and `advanceShift`**
In `src/discord/createInstance.ts`, initialize shift number to `opts.mode === "admin" && opts.admin?.shift !== undefined ? opts.admin.shift : 1`. Avoid incrementing or writing `guildSettings.shiftCounter`.
In `src/domain/reportMachine.ts`, calculate `nextShiftNumber = opts.instance.shiftNumber + 1`. Update `updateInstanceShiftNumber` without `setShiftCounter`.
- [ ] **Step 4: Run tests and verify**
`npm test`

---

### Task 2: Thread Renaming and Ending Message on Close

**Files:**
- Modify: `src/domain/closeInstanceFlow.ts`
- Test: `tests/closeInstanceFlow.test.ts`

- [ ] **Step 1: Write failing tests for `finalizeClose` thread renaming and message posting**
Add tests in `tests/closeInstanceFlow.test.ts` checking that `channel.send` is called with `{ content: "Game ended. Shift Closed." }` and `thread.setName` is called with suffix ` (closed)`.
- [ ] **Step 2: Run tests to confirm failure**
`npm test`
- [ ] **Step 3: Implement closing message and thread renaming in `finalizeClose`**
In `src/domain/closeInstanceFlow.ts`:
1. If `channel && "send" in channel`, send `{ content: "Game ended. Shift Closed." }`.
2. If `opts.instance.isThread`: fetch thread, call `setName(`${currentName.slice(0, 91)} (closed)`)`, then `setArchived(true)`.
- [ ] **Step 4: Run tests and verify**
`npm test`
