# Animal Hospital Organizer

Animal Hospital Organizer is a manual Animal Hospital observation logger for Discord and a web pad. It records observations for `RM1` through `RM8`; it is not Roblox automation or integration.

## Requirements

- Node.js 20 or newer
- A Discord application with a bot user
- SQLite storage (created automatically at the configured path)

## Install and run

```bash
npm i
npm test
npm run build
npm start
```

The process boots Discord, Express, and SQLite together. Export the environment variables below before starting, or provide them through your process manager. The application does not load `.env` files automatically.

## Discord application setup

1. Create an application in the Discord Developer Portal.
2. Add a bot user and copy its token to `DISCORD_TOKEN`.
3. Add this OAuth redirect URL exactly: `${PUBLIC_BASE_URL}/oauth/callback`.
4. Invite the bot with the `bot` and `applications.commands` scopes. The OAuth login flow requests the `identify` and `guilds` scopes.
5. Generate the invite URL using the permission integer produced by:

```bash
node --import tsx -e "import { BOT_PERMISSIONS } from './src/discord/permissions.ts'; console.log(BOT_PERMISSIONS.toString())"
```

Use that integer as the `permissions` query parameter in the bot invite URL.

After the bot is invited, configure a guild with `/setup`, then start an observation shift with `/session start`.

## Environment

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | Yes | — | Discord bot token |
| `DISCORD_CLIENT_ID` | Yes | — | Discord application/client ID |
| `DISCORD_CLIENT_SECRET` | Yes | — | Discord OAuth client secret |
| `PUBLIC_BASE_URL` | Yes | — | Public web URL, including the scheme |
| `SESSION_SECRET` | Yes | — | Secret used to sign web sessions and OAuth state |
| `SQLITE_PATH` | Yes | — | SQLite database path; parent directories are created automatically |
| `PORT` | No | `3000` | HTTP listening port |
| `TRUST_PROXY` | No | disabled | Set to `1` when HTTPS is terminated by a trusted reverse proxy |

## Typical operator workflow

1. Invite the bot using the generated URL.
2. Run `/setup` in the target guild, selecting the output channel and timezone.
3. Run `/session start` to create a session thread and web-pad URL.
4. Use the Discord panel, `/report`, or the web pad to record room observations.
5. Use `/session close` when the shift ends. Closed sessions remain available for the configured tombstone period, then return HTTP 404; SQLite rows are retained.

## Verification

```bash
npm test
npx tsc -p tsconfig.json --noEmit
```
