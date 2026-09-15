import type Database from "better-sqlite3";
import type { Client } from "discord.js";
import type { Clock } from "../clock.js";
import { closeInstance } from "../stores/instances.js";
import type { EventSink } from "../stores/EventSink.js";
import type { Instance } from "../stores/instances.js";
import { buildPanelEmbed } from "../discord/panel.js";

export async function finalizeClose(opts: {
  db: Database.Database;
  client: Client | null;
  events: EventSink;
  instance: Instance;
  clock: Clock;
}): Promise<void> {
  if (opts.instance.closedAt) return;
  const closedAt = opts.clock.now().toISOString();
  closeInstance(opts.db, opts.instance.id, closedAt);
  opts.events.emit({ type: "closed", instanceId: opts.instance.id, closedAt });
  if (!opts.client) return;

  try {
    const channel = await opts.client.channels.fetch(opts.instance.destinationChannelId);
    if (channel && "messages" in channel && opts.instance.panelMessageId) {
      const message = await channel.messages.fetch(opts.instance.panelMessageId);
      await message.edit({
        embeds: [buildPanelEmbed({
          shiftNumber: opts.instance.shiftNumber,
          url: "",
          startedBy: opts.instance.createdByDisplayName,
          closed: true,
        })],
        components: [],
      });
    }
    if (channel && "send" in channel) {
      await channel.send({ content: "Game ended. Shift Closed." });
    }
  } catch (error) { console.error(error); }

  if (opts.instance.isThread) {
    try {
      const thread = await opts.client.channels.fetch(opts.instance.destinationChannelId);
      if (thread && "setName" in thread) {
        const currentName = ("name" in thread && typeof thread.name === "string" && thread.name) ? thread.name : (opts.instance.threadName ?? "thread");
        if (!currentName.endsWith("(closed)")) {
          const newName = `${currentName.trim().slice(0, 91)} (closed)`;
          await thread.setName(newName);
        }
      }
      if (thread && "setArchived" in thread) await thread.setArchived(true);
    } catch (error) { console.error(error); }
  }
}
