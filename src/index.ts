import { Client, GatewayIntentBits } from "discord.js";
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./loadEnv.js";

loadEnv();

import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { systemClock } from "./clock.js";
import { InProcessEventSink } from "./stores/InProcessEventSink.js";
import { MemoryModeStore } from "./stores/MemoryModeStore.js";
import { createBot } from "./discord/client.js";
import { createDiscordPort } from "./discord/postOrTick.js";
import { createWebApp } from "./web/app.js";
import { registerGlobalCommands } from "./discord/registerCommands.js";
import { startIdleCloser } from "./jobs/idleCloser.js";

export { createBot } from "./discord/client.js";

const config = loadConfig();
fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true });
const db = openDb(config.sqlitePath);
const events = new InProcessEventSink();
const modes = new MemoryModeStore();
const discordClient = new Client({ intents: [GatewayIntentBits.Guilds] });
const discordPort = createDiscordPort(discordClient, db);
const client = createBot({ config, db, clock: systemClock, events, modes, client: discordClient, discordPort });
const app = createWebApp({ config, db, client, clock: systemClock, events, discordPort });

await registerGlobalCommands(config.discordToken, config.discordClientId);
await client.login(config.discordToken);
const server = app.listen(config.port, config.bindHost, () => {
  console.log(`http://${config.bindHost}:${config.port}`);
});
const idleCloser = startIdleCloser({ db, client, events, clock: systemClock });

function shutdown(): void {
  idleCloser.stop();
  server.close(() => process.exit(0));
  void client.destroy();
  db.close();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
