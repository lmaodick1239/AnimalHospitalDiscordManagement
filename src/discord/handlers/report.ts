import { GuildMember, type ButtonInteraction, type ChatInputCommandInteraction, type Client } from "discord.js";
import type Database from "better-sqlite3";
import type { Clock } from "../../clock.js";
import type { EventSink } from "../../stores/EventSink.js";
import type { ModeStore } from "../../stores/ModeStore.js";
import type { DiscordPort } from "../../domain/reportMachine.js";
import { findOpenByDestination, getInstance } from "../../stores/instances.js";
import { withRoomLock } from "../../stores/locks.js";
import { applyReport, ClosedInstanceError, DiscordPostError, DiscordTickError } from "../../domain/reportMachine.js";
import { isRoom, type Kind, type Room } from "../../domain/rooms.js";
import { clearedAck, modeAck, postedAck } from "../../domain/strings.js";
import { parsePanelCustomId } from "../panel.js";

export type ReportDeps = { db: Database.Database; client: Client; clock: Clock; events: EventSink; modes: ModeStore; discordPort: DiscordPort };

function displayName(interaction: ChatInputCommandInteraction | ButtonInteraction): string { return interaction.member instanceof GuildMember ? interaction.member.displayName : interaction.user.username; }
async function runPress(opts: { instanceId: string; room: Room; kind: Kind; userId: string; displayName: string }, deps: ReportDeps) {
  const instance = getInstance(deps.db, opts.instanceId); if (!instance) throw new ClosedInstanceError();
  const settings = deps.db.prepare("SELECT tick_emoji FROM guild_settings WHERE guild_id = ?").get(instance.guildId) as { tick_emoji: string } | undefined;
  return withRoomLock(opts.instanceId, opts.room, () => applyReport({ db: deps.db, instance, room: opts.room, kind: opts.kind, userId: opts.userId, displayName: opts.displayName, tickEmoji: settings?.tick_emoji ?? "✅", clock: deps.clock, events: deps.events, discord: deps.discordPort, newId: () => crypto.randomUUID() }));
}
function errorMessage(error: unknown): string { if (error instanceof ClosedInstanceError) return "Session closed."; if (error instanceof DiscordTickError) return "Discord failed to add the tick. Try again."; if (error instanceof DiscordPostError) return "Discord failed to send. Try again."; return error instanceof Error ? error.message : String(error); }

export async function handleReportSlash(interaction: ChatInputCommandInteraction, deps: ReportDeps): Promise<void> {
  const instance = findOpenByDestination(deps.db, interaction.channelId); if (!instance) { await interaction.reply({ content: "Run this in the session thread or use the panel", ephemeral: true }); return; }
  const room = interaction.options.getString("room", true); const kind = (interaction.options.getString("kind") ?? deps.modes.get(interaction.user.id, instance.id)) as Kind;
  if (!isRoom(room)) { await interaction.reply({ content: "Invalid room.", ephemeral: true }); return; }
  try { const result = await runPress({ instanceId: instance.id, room, kind, userId: interaction.user.id, displayName: displayName(interaction) }, deps); await interaction.reply({ content: result.type === "posted" ? postedAck(room, kind) : clearedAck(room), ephemeral: true }); } catch (error) { await interaction.reply({ content: errorMessage(error), ephemeral: true }); }
}

export async function handleButton(interaction: ButtonInteraction, deps: ReportDeps): Promise<void> {
  const parsed = parsePanelCustomId(interaction.customId); if (!parsed) { await interaction.reply({ content: "Invalid button.", ephemeral: true }); return; }
  const instance = getInstance(deps.db, parsed.instanceId); if (!instance || instance.closedAt) { await interaction.reply({ content: "Session closed.", ephemeral: true }); return; }
  if (parsed.kind === "mode") { await interaction.reply({ content: modeAck(deps.modes.toggle(interaction.user.id, instance.id)), ephemeral: true }); return; }
  const kind = deps.modes.get(interaction.user.id, instance.id); await interaction.deferReply({ ephemeral: true });
  try { const result = await runPress({ instanceId: instance.id, room: parsed.room, kind, userId: interaction.user.id, displayName: displayName(interaction) }, deps); await interaction.editReply(result.type === "posted" ? postedAck(parsed.room, kind) : clearedAck(parsed.room)); } catch (error) { await interaction.editReply(errorMessage(error)); }
}
