import { PermissionFlagsBits, type Client, type GuildMember, type GuildChannel } from "discord.js";

async function member(client: Client, guildId: string, userId: string): Promise<GuildMember | null> {
  try { return await client.guilds.fetch(guildId).then((guild) => guild.members.fetch(userId)); } catch { return null; }
}

export async function isGuildMember(client: Client, guildId: string, userId: string): Promise<boolean> {
  return (await member(client, guildId, userId)) !== null;
}

export async function memberCanViewChannel(client: Client, guildId: string, channelId: string, userId: string): Promise<boolean> {
  const foundMember = await member(client, guildId, userId);
  if (!foundMember) return false;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || !("permissionsFor" in channel)) return false;
    const permissions = (channel as GuildChannel).permissionsFor(foundMember);
    return permissions?.has(PermissionFlagsBits.ViewChannel) ?? false;
  } catch { return false; }
}

export async function memberDisplayName(client: Client, guildId: string, userId: string, fallback: string): Promise<string> {
  const foundMember = await member(client, guildId, userId);
  return foundMember?.displayName ?? fallback;
}

export async function memberViewOnChannel(opts: { botToken: string; guildId: string; channelId: string; userId: string }): Promise<boolean> {
  const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${opts.guildId}/members/${opts.userId}`, { headers: { Authorization: `Bot ${opts.botToken}` } });
  if (memberResponse.status === 404) return false;
  if (!memberResponse.ok) return false;
  const channelResponse = await fetch(`https://discord.com/api/v10/channels/${opts.channelId}`, { headers: { Authorization: `Bot ${opts.botToken}` } });
  if (!channelResponse.ok) return false;
  return true;
}
