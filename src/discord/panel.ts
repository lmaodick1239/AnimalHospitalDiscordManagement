import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { isRoom, ROOMS, type Room } from "../domain/rooms.js";

export function panelCustomId(kind: "mode" | "rm" | "bump", instanceId: string, room?: Room): string {
  if (kind === "mode") return `mode:${instanceId}`;
  if (kind === "bump") return `bump:${instanceId}`;
  if (!room) throw new Error("room required");
  return `rm:${instanceId}:${room}`;
}

export function parsePanelCustomId(id: string):
  | { kind: "mode"; instanceId: string }
  | { kind: "bump"; instanceId: string }
  | { kind: "rm"; instanceId: string; room: Room }
  | null {
  const mode = /^mode:([^:]{1,90})$/.exec(id);
  if (mode) return { kind: "mode", instanceId: mode[1]! };
  const bump = /^bump:([^:]{1,90})$/.exec(id);
  if (bump) return { kind: "bump", instanceId: bump[1]! };
  const rm = /^rm:([^:]{1,80}):(RM[1-8])$/.exec(id);
  if (rm && isRoom(rm[2]!)) return { kind: "rm", instanceId: rm[1]!, room: rm[2] };
  return null;
}

export function buildPanelComponents(instanceId?: string): ActionRowBuilder<ButtonBuilder>[] {
  const id = (kind: "mode" | "rm" | "bump", room?: Room) => instanceId ? panelCustomId(kind, instanceId, room) : `${kind}:${room ?? ""}`;
  const button = (label: string, customId: string) => new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(ButtonStyle.Secondary);
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(button("Mode", id("mode")), button("Next Shift", id("bump"))),
    new ActionRowBuilder<ButtonBuilder>().addComponents(...ROOMS.slice(0, 5).map((room) => button(room, id("rm", room)))),
    new ActionRowBuilder<ButtonBuilder>().addComponents(...ROOMS.slice(5).map((room) => button(room, id("rm", room)))),
  ];
}

export function buildPanelEmbed(input: { shiftNumber: number; url?: string; startedBy: string; closed?: boolean }): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`SHIFT ${input.shiftNumber}${input.closed ? " · Closed" : ""}`)
    .setFooter({ text: `started by ${input.startedBy}` });
  if (input.url) embed.setDescription(input.url);
  return embed;
}
