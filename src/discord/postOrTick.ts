import type Database from "better-sqlite3";
import type { Client, Message } from "discord.js";
import type { DiscordPort } from "../domain/reportMachine.js";
import type { Instance } from "../stores/instances.js";
import type { Room, Kind } from "../domain/rooms.js";
import { reportBody } from "../domain/strings.js";

export function classifyDiscordError(error: unknown): "gone" | "invalid_emoji" | "outage" {
  const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: number }).code : undefined;
  if (code === 10008) return "gone";
  if (code === 50035 || code === 10014) return "invalid_emoji";
  return "outage";
}

async function fetchMessage(client: Client, channelId: string, messageId: string): Promise<Message> {
  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased() || !("messages" in channel)) throw new Error("channel is not text based");
  return channel.messages.fetch(messageId);
}

export async function reactWithGuildEmoji(opts: { message: Message; guildId: string; tickEmoji: string; db: Database.Database }): Promise<{ ok: true } | { ok: false; reason: "gone" | "outage" }> {
  try {
    await opts.message.react(opts.tickEmoji);
    return { ok: true };
  } catch (error) {
    const kind = classifyDiscordError(error);
    if (kind === "gone") return { ok: false, reason: "gone" };
    if (kind !== "invalid_emoji") return { ok: false, reason: "outage" };
    try {
      opts.db.prepare("UPDATE guild_settings SET tick_emoji = '✅' WHERE guild_id = ?").run(opts.guildId);
      await opts.message.react("✅");
      return { ok: true };
    } catch (fallback) {
      return { ok: false, reason: classifyDiscordError(fallback) === "gone" ? "gone" : "outage" };
    }
  }
}

export function createDiscordPort(client: Client, db: Database.Database, log: { error: (...a: unknown[]) => void } = console): DiscordPort {
  return {
    async unarchive(instance) {
      if (!instance.isThread) return;
      try {
        const channel = await client.channels.fetch(instance.destinationChannelId);
        if (channel && "isThread" in channel && channel.isThread() && channel.archived) await channel.setArchived(false);
      } catch (error) { log.error(error); }
    },
    async sendReport(input: { instance: Instance; room: Room; kind: Kind; displayName: string }) {
      const channel = await client.channels.fetch(input.instance.destinationChannelId);
      if (!channel || !channel.isTextBased() || !("send" in channel)) throw new Error("destination channel unavailable");
      const message = await channel.send({ content: reportBody(input.room, input.kind, input.displayName) });
      return { messageId: message.id };
    },
    async tickReport(input) {
      try {
        const message = await fetchMessage(client, input.instance.destinationChannelId, input.messageId);
        return await reactWithGuildEmoji({ message, guildId: input.instance.guildId, tickEmoji: input.tickEmoji, db });
      } catch (error) {
        return { ok: false, reason: classifyDiscordError(error) === "gone" ? "gone" : "outage" };
      }
    },
  };
}
