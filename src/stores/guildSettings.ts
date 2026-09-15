import type Database from "better-sqlite3";

export type GuildSettings = {
  guildId: string;
  defaultChannelId: string;
  timezone: string;
  shiftLeadRoleId: string | null;
  tickEmoji: string;
  idleHours: number;
  tombstoneHours: number;
  shiftCounter: number;
};

type GuildRow = {
  guild_id: string; default_channel_id: string; timezone: string; shift_lead_role_id: string | null;
  tick_emoji: string; idle_hours: number; tombstone_hours: number; shift_counter: number;
};

function map(row: GuildRow): GuildSettings {
  return {
    guildId: row.guild_id,
    defaultChannelId: row.default_channel_id,
    timezone: row.timezone,
    shiftLeadRoleId: row.shift_lead_role_id,
    tickEmoji: row.tick_emoji,
    idleHours: row.idle_hours,
    tombstoneHours: row.tombstone_hours,
    shiftCounter: row.shift_counter,
  };
}

export function upsertGuildSettings(db: Database.Database, input: {
  guildId: string; defaultChannelId: string; timezone?: string; shiftLeadRoleId?: string | null;
  tickEmoji?: string; idleHours?: number; tombstoneHours?: number;
}): GuildSettings {
  db.prepare(`
    INSERT INTO guild_settings (guild_id, default_channel_id, timezone, shift_lead_role_id, tick_emoji, idle_hours, tombstone_hours)
    VALUES (@guildId, @defaultChannelId, COALESCE(@timezone, 'UTC'), @shiftLeadRoleId, COALESCE(@tickEmoji, '✅'), COALESCE(@idleHours, 6), COALESCE(@tombstoneHours, 2))
    ON CONFLICT(guild_id) DO UPDATE SET
      default_channel_id = excluded.default_channel_id,
      timezone = COALESCE(@timezone, timezone),
      shift_lead_role_id = CASE WHEN @shiftLeadRoleIdProvided = 1 THEN @shiftLeadRoleId ELSE shift_lead_role_id END,
      tick_emoji = COALESCE(@tickEmoji, tick_emoji),
      idle_hours = COALESCE(@idleHours, idle_hours),
      tombstone_hours = COALESCE(@tombstoneHours, tombstone_hours)
  `).run({
    ...input,
    timezone: input.timezone ?? null,
    tickEmoji: input.tickEmoji ?? null,
    idleHours: input.idleHours ?? null,
    tombstoneHours: input.tombstoneHours ?? null,
    shiftLeadRoleId: input.shiftLeadRoleId ?? null,
    shiftLeadRoleIdProvided: input.shiftLeadRoleId === undefined ? 0 : 1,
  });
  return getGuildSettings(db, input.guildId)!;
}

export function getGuildSettings(db: Database.Database, guildId: string): GuildSettings | undefined {
  const row = db.prepare("SELECT * FROM guild_settings WHERE guild_id = ?").get(guildId) as GuildRow | undefined;
  return row ? map(row) : undefined;
}

export function setShiftCounter(db: Database.Database, guildId: string, counter: number): void {
  db.prepare("UPDATE guild_settings SET shift_counter = ? WHERE guild_id = ?").run(counter, guildId);
}
