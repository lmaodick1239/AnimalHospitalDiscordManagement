import { ulid } from "ulid";
import type { Client, TextChannel } from "discord.js";
import type Database from "better-sqlite3";
import type { Config } from "../config.js";
import type { Clock } from "../clock.js";
import type { EventSink } from "../stores/EventSink.js";
import { getGuildSettings, setShiftCounter } from "../stores/guildSettings.js";
import { countOpenInstances, findOpenUnthreaded, insertInstance, setInstanceMessages, closeInstance, type Instance } from "../stores/instances.js";
import { nextCounter } from "../domain/shift.js";
import { memberCanStart, botCanHost } from "./permissions.js";
import { resolveThreadName } from "./destination.js";
import { shiftBanner } from "../domain/strings.js";
import { buildPanelComponents, buildPanelEmbed } from "./panel.js";

export class ThrottleError extends Error { constructor() { super("rate limited"); } }
export class CapError extends Error { constructor() { super("too many open instances"); } }
export class NotSetupError extends Error { constructor() { super("set an output channel"); } }
export class BotPermsError extends Error { constructor(readonly missing: string) { super(missing); } }
export class UnthreadedConflictError extends Error { constructor() { super("channel already has an open unthreaded instance"); } }

const creates = new Map<string, number[]>();
export function allowCreate(userId: string, nowMs: number, windowMs = 60_000): boolean {
  const recent = (creates.get(userId) ?? []).filter((at) => nowMs - at < windowMs);
  if (recent.length >= 3) { creates.set(userId, recent); return false; }
  recent.push(nowMs); creates.set(userId, recent); return true;
}

export async function createInstanceFlow(opts: { db: Database.Database; client: Client; config: Config; clock: Clock; events: EventSink; guildId: string; actorId: string; actorDisplayName: string; actorPermissions: bigint; mode: "user" | "admin"; admin?: { channelId: string; thread: boolean; shift?: number; threadName?: string } }): Promise<{ instance: Instance; url: string }> {
  const settings = getGuildSettings(opts.db, opts.guildId);
  if (!settings) throw new NotSetupError();
  const parentId = opts.mode === "user" ? settings.defaultChannelId : opts.admin!.channelId;
  const channel = await opts.client.channels.fetch(parentId);
  if (!channel || channel.type !== 0 || !("threads" in channel)) throw new Error("channel must be a guild text channel");
  const parent = channel as TextChannel;
  const me = parent.guild.members.me;
  const ownPerms = me ? parent.permissionsFor(me).bitfield : 0n;
  if (!botCanHost(ownPerms)) throw new BotPermsError("View Channel, Send Messages, Send Messages in Threads, Embed Links, Read Message History, Add Reactions, Create Public Threads, Manage Threads, Use External Emojis");
  if (opts.mode === "user" && !memberCanStart(opts.actorPermissions)) throw new Error("You need View Channel and Send Messages in the output channel.");
  const adminThread = opts.mode === "user" || opts.admin!.thread;
  if (opts.mode === "admin" && !opts.admin!.thread && findOpenUnthreaded(opts.db, parentId)) throw new UnthreadedConflictError();
  if (countOpenInstances(opts.db, opts.guildId) >= 20) throw new CapError();
  if (!allowCreate(opts.actorId, opts.clock.now().getTime())) throw new ThrottleError();
  const counter = nextCounter(settings.shiftCounter, opts.mode === "admin" ? opts.admin!.shift : undefined);
  setShiftCounter(opts.db, opts.guildId, counter.counter);
  let destinationId = parentId; let threadName: string | null = null;
  if (adminThread) {
    threadName = resolveThreadName({ now: opts.clock.now(), timeZone: settings.timezone, adminName: opts.mode === "admin" ? opts.admin!.threadName : undefined });
    const thread = await parent.threads.create({ name: threadName, autoArchiveDuration: 1440, reason: `shift ${counter.shiftNumber}` });
    destinationId = thread.id;
  }
  const id = ulid(); const now = opts.clock.now().toISOString();
  const instance = insertInstance(opts.db, { id, guildId: opts.guildId, shiftNumber: counter.shiftNumber, parentChannelId: parentId, destinationChannelId: destinationId, isThread: adminThread, threadName, createdBy: opts.actorId, createdByDisplayName: opts.actorDisplayName, createdAt: now, lastActivityAt: now });
  try {
    const dest = await opts.client.channels.fetch(destinationId);
    if (!dest || !dest.isTextBased() || !("send" in dest)) throw new Error("destination unavailable");
    const banner = await dest.send({ content: shiftBanner(counter.shiftNumber) });
    const url = `${opts.config.publicBaseUrl}/g/${opts.guildId}/i/${id}`;
    const panel = await dest.send({ embeds: [buildPanelEmbed({ shiftNumber: counter.shiftNumber, url, startedBy: opts.actorDisplayName })], components: buildPanelComponents(id) });
    setInstanceMessages(opts.db, id, banner.id, panel.id);
    return { instance: { ...instance, bannerMessageId: banner.id, panelMessageId: panel.id }, url };
  } catch (error) { closeInstance(opts.db, id, opts.clock.now().toISOString()); throw error; }
}
