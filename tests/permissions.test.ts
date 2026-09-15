import test from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { BOT_PERMISSIONS, inviteUrl, isManageServer, isShiftLead, memberCanStart, memberCanView, botCanHost } from "../src/discord/permissions.ts";

test("permission helpers use the locked Discord bits", () => {
  assert.equal(memberCanView(PermissionFlagsBits.ViewChannel), true);
  assert.equal(memberCanStart(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages), true);
  assert.equal(botCanHost(BOT_PERMISSIONS), true);
  assert.equal(isManageServer(PermissionFlagsBits.ManageGuild), true);
  assert.equal(isManageServer(PermissionFlagsBits.Administrator), true);
  assert.equal(isShiftLead({ memberPermissions: 0n, memberRoleIds: ["lead"], shiftLeadRoleId: "lead" }), true);
  assert.equal(isShiftLead({ memberPermissions: 0n, memberRoleIds: [], shiftLeadRoleId: null }), false);
  assert.equal(isShiftLead({ memberPermissions: PermissionFlagsBits.ManageGuild, memberRoleIds: [], shiftLeadRoleId: "lead" }), true);
  const url = inviteUrl("123");
  assert.match(url, /client_id=123/);
  assert.match(url, /scope=bot%20applications.commands/);
  assert.match(url, new RegExp(`permissions=${BOT_PERMISSIONS.toString()}`));
});
