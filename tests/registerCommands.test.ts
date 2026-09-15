import test from "node:test";
import assert from "node:assert/strict";
import { commandJson } from "../src/discord/registerCommands.ts";

test("commandJson defines the locked commands and options", () => {
  const commands = commandJson();
  assert.deepEqual(commands.map((command) => command.name), ["setup", "session", "report"]);
  const setup = commands.find((command) => command.name === "setup")!;
  assert.deepEqual(setup.options?.map((option) => option.name), ["channel", "timezone", "shift_lead", "tick_emoji", "idle_hours", "tombstone_hours"]);
  const session = commands.find((command) => command.name === "session")!;
  assert.deepEqual(session.options?.map((option) => option.name), ["start", "start-admin", "close"]);
  const report = commands.find((command) => command.name === "report")!;
  const room = report.options?.find((option) => option.name === "room") as { choices?: { value: string }[] };
  assert.deepEqual(room.choices?.map((choice) => choice.value), ["RM1", "RM2", "RM3", "RM4", "RM5", "RM6", "RM7", "RM8"]);
  const kind = report.options?.find((option) => option.name === "kind") as { choices?: { value: string }[] };
  assert.deepEqual(kind.choices?.map((choice) => choice.value), ["ANOMALY", "MAYBE"]);
});
