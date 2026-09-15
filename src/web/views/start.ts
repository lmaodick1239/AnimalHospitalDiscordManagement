import { layout, esc } from "./layout.js";
import { csrfFormField } from "../csrf.js";

export function startPage(opts: { csrf: string; guilds: { id: string; name: string }[]; inviteUrl: string }): string {
  const content = opts.guilds.length === 0
    ? `<main><h1>Animal Hospital Organizer</h1><p>Invite the bot and run /setup</p><a href="${esc(opts.inviteUrl)}">Invite bot</a></main>`
    : `<main><h1>Choose a guild</h1>${opts.guilds.map((guild) => `<form method="post" action="/start">${csrfFormField(opts.csrf)}<input type="hidden" name="guildId" value="${esc(guild.id)}"><button>${esc(guild.name)}</button></form>`).join("")}</main>`;
  return layout({ title: "Start session", body: content });
}
