import { ChannelType, type AutocompleteInteraction, type ChatInputCommandInteraction, type TextChannel } from "discord.js";
import type Database from "better-sqlite3";
import { COMMON_TIMEZONES, isValidIanaTimeZone } from "../../domain/timezone.js";
import { botCanHost, isManageServer } from "../permissions.js";
import { upsertGuildSettings } from "../../stores/guildSettings.js";

function memberPermissions(interaction: ChatInputCommandInteraction | AutocompleteInteraction): bigint {
  const permissions = interaction.member && "permissions" in interaction.member ? interaction.member.permissions : 0n;
  return typeof permissions === "bigint" ? permissions : BigInt(permissions.toString());
}

function validEmoji(value: string): boolean {
  return value.length > 0 && (value.length <= 8 || /^<a?:\w+:\d+>$/.test(value));
}

export async function handleSetup(interaction: ChatInputCommandInteraction, db: Database.Database): Promise<void> {
  if (!interaction.guildId || !isManageServer(memberPermissions(interaction))) {
    await interaction.reply({ content: "You need Manage Server to run /setup.", ephemeral: true }); return;
  }
  const channel = interaction.options.getChannel("channel", true);
  if (channel.type !== ChannelType.GuildText || !("permissionsFor" in channel)) {
    await interaction.reply({ content: "Channel must be a guild text channel.", ephemeral: true }); return;
  }
  const textChannel = channel as TextChannel;
  const me = textChannel.guild.members.me;
  const perms = me ? textChannel.permissionsFor(me).bitfield : 0n;
  if (!botCanHost(perms)) {
    await interaction.reply({ content: "Bot is missing permissions to host sessions in that channel.", ephemeral: true }); return;
  }
  const timezone = interaction.options.getString("timezone") ?? undefined;
  if (timezone !== undefined && !isValidIanaTimeZone(timezone)) {
    await interaction.reply({ content: "Unknown timezone.", ephemeral: true }); return;
  }
  const rawEmoji = interaction.options.getString("tick_emoji");
  const tickEmoji = rawEmoji === null ? undefined : (rawEmoji.trim() === "" ? "✅" : rawEmoji.trim());
  if (tickEmoji !== undefined && !validEmoji(tickEmoji)) {
    await interaction.reply({ content: "Invalid tick emoji.", ephemeral: true }); return;
  }
  const idle = interaction.options.getInteger("idle_hours");
  const tombstone = interaction.options.getInteger("tombstone_hours");
  const settings = upsertGuildSettings(db, {
    guildId: interaction.guildId, defaultChannelId: channel.id, timezone,
    shiftLeadRoleId: interaction.options.getRole("shift_lead")?.id,
    tickEmoji, idleHours: idle === null ? undefined : Math.max(1, Math.min(72, idle)),
    tombstoneHours: tombstone === null ? undefined : Math.max(1, Math.min(72, tombstone)),
  });
  await interaction.reply({ content: `Configured output <#${settings.defaultChannelId}> · ${settings.timezone} · tick ${settings.tickEmoji} · idle ${settings.idleHours}h · tombstone ${settings.tombstoneHours}h`, ephemeral: true });
}

export async function handleTimezoneAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused();
  const values: string[] = [...COMMON_TIMEZONES];
  if (focused && isValidIanaTimeZone(focused) && !values.includes(focused)) values.push(focused);
  await interaction.respond(values.filter((tz) => tz.toLowerCase().includes(focused.toLowerCase())).slice(0, 25).map((name) => ({ name, value: name })));
}
