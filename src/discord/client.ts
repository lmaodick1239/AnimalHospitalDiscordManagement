import { Client, Events, GatewayIntentBits } from "discord.js";
import type { Config } from "../config.js";
import type Database from "better-sqlite3";
import type { Clock } from "../clock.js";
import type { EventSink } from "../stores/EventSink.js";
import type { ModeStore } from "../stores/ModeStore.js";
import { handleSetup, handleTimezoneAutocomplete } from "./handlers/setup.js";
import { handleSession, handleCloseAutocomplete } from "./handlers/session.js";
import { handleReportSlash, handleButton, type ReportDeps } from "./handlers/report.js";
import { createDiscordPort } from "./postOrTick.js";
import { handleGuildDelete } from "./handlers/guildDelete.js";

export function createBot(opts: { config: Config; db: Database.Database; clock: Clock; events: EventSink; modes: ModeStore; discordPort?: ReportDeps["discordPort"]; client?: Client }): Client {
  const client = opts.client ?? new Client({ intents: [GatewayIntentBits.Guilds] });
  client.on(Events.Error, (error) => {
    console.error("Discord client error:", error);
  });
  const deps: ReportDeps = { db: opts.db, client, config: opts.config, clock: opts.clock, events: opts.events, modes: opts.modes, discordPort: opts.discordPort ?? createDiscordPort(client, opts.db) };
  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isAutocomplete()) {
        if (interaction.commandName === "setup" && interaction.options.getFocused(true).name === "timezone") return await handleTimezoneAutocomplete(interaction);
        if (interaction.commandName === "session" && interaction.options.getFocused(true).name === "instance") return await handleCloseAutocomplete(interaction, opts.db);
      }
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === "setup") return await handleSetup(interaction, opts.db);
        if (interaction.commandName === "session") return await handleSession(interaction, { db: opts.db, client, config: opts.config, clock: opts.clock, events: opts.events });
        if (interaction.commandName === "report") return await handleReportSlash(interaction, deps);
      }
      if (interaction.isButton()) return await handleButton(interaction, deps);
    } catch (error) { console.error("Error handling interaction:", error); }
  });
  client.on(Events.GuildDelete, (guild) => { void handleGuildDelete({ db: opts.db, events: opts.events, clock: opts.clock, guildId: guild.id }).catch((error) => console.error(error)); });
  return client;
}
