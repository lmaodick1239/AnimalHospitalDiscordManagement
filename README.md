# Animal Hospital Organizer

Animal Hospital Organizer is a manual Animal Hospital observation logger for Discord and a web pad. It records room observations for `RM1` through `RM8`; it does not integrate with Roblox.

## Requirements

- Node.js 20 or newer
- Discord bot application with the `bot` and `applications.commands` scopes
- The bot invite permission integer is computed in Plan 03 Task 3.

## Bootstrap

```bash
npm i
npm test
npm run build
npm start
```

Copy `.env.example` to `.env` and fill in the required values:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `PUBLIC_BASE_URL`
- `SESSION_SECRET`
- `SQLITE_PATH`
- `PORT` (default `3000`)
- `TRUST_PROXY` (set to `1` when required)

After the bot is implemented and invited, run `/setup` first, then `/session start` to create an observation shift.
