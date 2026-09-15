# Animal Hospital Organizer — implementation plans

Read in order. Each file is a review gate; do not skip ahead.

1. [`00-locked-spec.md`](00-locked-spec.md) — locked product + architecture (no code)
2. [`01-scaffold-db.md`](01-scaffold-db.md) — Node/TS bootstrap, config, schema, repos
3. [`02-report-machine.md`](02-report-machine.md) — locks, ModeStore, EventSink, post-or-tick
4. [`03-discord.md`](03-discord.md) — slash commands, panel, destination, DiscordPort
5. [`04-web.md`](04-web.md) — OAuth, pad, occupancy, SSE log
6. [`05-lifecycle.md`](05-lifecycle.md) — idle close, guild leave, boot, verification

**For agentic workers:** use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use `- [ ]` checkboxes.

Do not start coding until the user switches to Code mode.
