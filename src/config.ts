export type Config = {
  discordToken: string;
  discordClientId: string;
  discordClientSecret: string;
  publicBaseUrl: string;
  sessionSecret: string;
  sqlitePath: string;
  port: number;
  trustProxy: boolean;
  bindHost: "0.0.0.0";
};

const REQUIRED_KEYS = [
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "PUBLIC_BASE_URL",
  "SESSION_SECRET",
  "SQLITE_PATH",
] as const;

function required(env: NodeJS.Dict<string>, name: string): string {
  const value = env[name];
  if (!value?.trim()) {
    throw new Error(`missing env ${name}`);
  }
  return value;
}

export function loadConfig(env: NodeJS.Dict<string> = process.env): Config {
  const values = Object.fromEntries(
    REQUIRED_KEYS.map((name) => [name, required(env, name)]),
  ) as Record<(typeof REQUIRED_KEYS)[number], string>;

  const port = env.PORT === undefined || env.PORT === "" ? 3000 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("invalid env PORT");
  }

  return {
    discordToken: values.DISCORD_TOKEN,
    discordClientId: values.DISCORD_CLIENT_ID,
    discordClientSecret: values.DISCORD_CLIENT_SECRET,
    publicBaseUrl: values.PUBLIC_BASE_URL.replace(/\/+$/, ""),
    sessionSecret: values.SESSION_SECRET,
    sqlitePath: values.SQLITE_PATH,
    port,
    trustProxy: env.TRUST_PROXY === "1",
    bindHost: "0.0.0.0",
  };
}
