import { GuildMember, type ChatInputCommandInteraction, type AutocompleteInteraction } from "discord.js";
import type Database from "better-sqlite3";
import type { Client } from "discord.js";
import type { Config } from "../../config.js";
import type { Clock } from "../../clock.js";
import type { EventSink } from "../../stores/EventSink.js";
import { createInstanceFlow, NotSetupError, ThrottleError, CapError, BotPermsError, UnthreadedConflictError } from "../createInstance.js";
import { getGuildSettings } from "../../stores/guildSettings.js";
import { listOpenInstances, getInstance, findOpenByDestination, closeInstance } from "../../stores/instances.js";
import { isShiftLead } from "../permissions.js";
import { finalizeClose } from "../../domain/closeInstanceFlow.js";

export async function handleSession(interaction: ChatInputCommandInteraction, deps: { db: Database.Database; client: Client; config: Config; clock: Clock; events: EventSink }): Promise<void> {
  const sub = interaction.options.getSubcommand();
  if (!interaction.guildId) return;
  const settings = getGuildSettings(deps.db, interaction.guildId);
  const member = interaction.member instanceof GuildMember ? interaction.member : null;
  const perms = member ? member.permissions.bitfield : 0n;
  if (sub === "start-admin" && !isShiftLead({ memberPermissions: perms, memberRoleIds: member ? [...member.roles.cache.keys()] : [], shiftLeadRoleId: settings?.shiftLeadRoleId ?? null })) { await interaction.reply({ content: "You need the Shift Lead role or Manage Server.", ephemeral: true }); return; }
  if (sub === "close") { await handleClose(interaction, deps, perms); return; }
  await interaction.deferReply({ ephemeral: true });
  try {
    const result = await createInstanceFlow({ db: deps.db, client: deps.client, config: deps.config, clock: deps.clock, events: deps.events, guildId: interaction.guildId, actorId: interaction.user.id, actorDisplayName: member?.displayName ?? interaction.user.username, actorPermissions: perms, mode: sub === "start-admin" ? "admin" : "user", admin: sub === "start-admin" ? { channelId: interaction.options.getChannel("channel", true).id, thread: interaction.options.getBoolean("thread", true), shift: interaction.options.getInteger("shift") ?? undefined, threadName: interaction.options.getString("thread_name") ?? undefined } : undefined });
    await interaction.editReply(`Started SHIFT ${result.instance.shiftNumber}\n${result.url}`);
  } catch (error) {
    const message = error instanceof NotSetupError ? "set an output channel" : error instanceof ThrottleError ? "Slow down. Max 3 sessions per minute." : error instanceof CapError ? "This server already has 20 open sessions." : error instanceof BotPermsError ? `Bot is missing permissions: ${error.message}` : error instanceof UnthreadedConflictError ? error.message : error instanceof Error ? error.message : String(error);
    await interaction.editReply(message);
  }
}

async function handleClose(interaction: ChatInputCommandInteraction, deps: { db: Database.Database; client: Client; config: Config; clock: Clock; events: EventSink }, perms: bigint): Promise<void> {
  const settings = getGuildSettings(deps.db, interaction.guildId!);
  const member = interaction.member instanceof GuildMember ? interaction.member : null;
  if (!isShiftLead({ memberPermissions: perms, memberRoleIds: member ? [...member.roles.cache.keys()] : [], shiftLeadRoleId: settings?.shiftLeadRoleId ?? null })) { await interaction.reply({ content: "You need the Shift Lead role or Manage Server.", ephemeral: true }); return; }
  const id = interaction.options.getString("instance"); const instance = id ? getInstance(deps.db, id) : findOpenByDestination(deps.db, interaction.channelId);
  if (!instance) { await interaction.reply({ content: "No open session found.", ephemeral: true }); return; }
  if (instance.guildId !== interaction.guildId) { await interaction.reply({ content: "No open session found.", ephemeral: true }); return; }
  if (instance.closedAt) { await interaction.reply({ content: "Already closed.", ephemeral: true }); return; }
  try {
    await interaction.reply({ content: `Closed SHIFT ${instance.shiftNumber}.`, ephemeral: true });
  } catch (error) {
    console.error("Failed to reply to close interaction:", error);
  }
  await finalizeClose({ db: deps.db, client: deps.client, events: deps.events, instance, clock: deps.clock });
}

export async function handleCloseAutocomplete(interaction: AutocompleteInteraction, db: Database.Database): Promise<void> { const focused = interaction.options.getFocused().toLowerCase(); await interaction.respond(listOpenInstances(db, interaction.guildId!).filter((i) => `${i.shiftNumber} ${i.threadName ?? "channel"} ${i.id}`.toLowerCase().includes(focused)).slice(0, 25).map((i) => ({ name: `SHIFT ${i.shiftNumber} · ${i.threadName ?? "channel"} · ${i.id}`.slice(0, 100), value: i.id }))); }
