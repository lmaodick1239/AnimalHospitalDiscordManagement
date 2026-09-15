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

export function inviteUrl(clientId: string): string {
  return `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&scope=bot%20applications.commands&permissions=${BOT_PERMISSIONS.toString()}`;
}

export function memberCanView(permissions: bigint): boolean {
  return (permissions & PermissionFlagsBits.ViewChannel) !== 0n;
}

export function memberCanStart(permissions: bigint): boolean {
  return memberCanView(permissions) && (permissions & PermissionFlagsBits.SendMessages) !== 0n;
}

export function botCanHost(permissions: bigint): boolean {
  return (permissions & BOT_PERMISSIONS) === BOT_PERMISSIONS;
}

export function isManageServer(permissions: bigint): boolean {
  return (permissions & (PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild)) !== 0n;
}

export function isShiftLead(opts: { memberPermissions: bigint; memberRoleIds: string[]; shiftLeadRoleId: string | null }): boolean {
  return isManageServer(opts.memberPermissions) || (opts.shiftLeadRoleId !== null && opts.memberRoleIds.includes(opts.shiftLeadRoleId));
}
