import { PermissionFlagsBits, REST, Routes, SlashCommandBuilder, ChannelType } from "discord.js";
import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";
import { ROOMS } from "../domain/rooms.js";

export function commandJson(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  const setup = new SlashCommandBuilder()
    .setName("setup").setDescription("Configure the hospital").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .addChannelOption((o) => o.setName("channel").setDescription("Output channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
    .addStringOption((o) => o.setName("timezone").setDescription("IANA timezone").setAutocomplete(true))
    .addRoleOption((o) => o.setName("shift_lead").setDescription("Shift Lead role"))
    .addStringOption((o) => o.setName("tick_emoji").setDescription("Tick emoji"))
    .addIntegerOption((o) => o.setName("idle_hours").setDescription("Idle close hours").setMinValue(1).setMaxValue(72))
    .addIntegerOption((o) => o.setName("tombstone_hours").setDescription("Tombstone hours").setMinValue(1).setMaxValue(72));

  const session = new SlashCommandBuilder().setName("session").setDescription("Manage sessions")
    .addSubcommand((o) => o.setName("start").setDescription("Start a session"))
    .addSubcommand((o) => o.setName("start-admin").setDescription("Start an administered session")
      .addChannelOption((x) => x.setName("channel").setDescription("Parent channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addBooleanOption((x) => x.setName("thread").setDescription("Use a thread").setRequired(true))
      .addIntegerOption((x) => x.setName("shift").setDescription("Shift number").setMinValue(1).setMaxValue(99999))
      .addStringOption((x) => x.setName("thread_name").setDescription("Thread name").setMaxLength(100)))
    .addSubcommand((o) => o.setName("close").setDescription("Close a session")
      .addStringOption((x) => x.setName("instance").setDescription("Instance").setAutocomplete(true)));

  const report = new SlashCommandBuilder().setName("report").setDescription("Report a room")
    .addStringOption((o) => o.setName("room").setDescription("Room").setRequired(true).addChoices(...ROOMS.map((name) => ({ name, value: name }))))
    .addStringOption((o) => o.setName("kind").setDescription("Report kind").addChoices({ name: "ANOMALY", value: "ANOMALY" }, { name: "MAYBE", value: "MAYBE" }));
  return [setup, session, report].map((command) => command.toJSON());
}

export async function registerGlobalCommands(token: string, clientId: string): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationCommands(clientId), { body: commandJson() });
}
