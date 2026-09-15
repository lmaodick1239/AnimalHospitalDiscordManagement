import type Database from "better-sqlite3";

export type Instance = {
  id: string;
  guildId: string;
  shiftNumber: number;
  parentChannelId: string;
  destinationChannelId: string;
  isThread: boolean;
  threadName: string | null;
  bannerMessageId: string | null;
  panelMessageId: string | null;
  createdBy: string;
  createdByDisplayName: string;
  createdAt: string;
  lastActivityAt: string;
  closedAt: string | null;
};

type InstanceRow = {
  id: string; guild_id: string; shift_number: number; parent_channel_id: string;
  destination_channel_id: string; is_thread: number; thread_name: string | null;
  banner_message_id: string | null; panel_message_id: string | null; created_by: string;
  created_by_display_name: string; created_at: string; last_activity_at: string; closed_at: string | null;
};

function map(row: InstanceRow): Instance {
  return {
    id: row.id,
    guildId: row.guild_id,
    shiftNumber: row.shift_number,
    parentChannelId: row.parent_channel_id,
    destinationChannelId: row.destination_channel_id,
    isThread: row.is_thread === 1,
    threadName: row.thread_name,
    bannerMessageId: row.banner_message_id,
    panelMessageId: row.panel_message_id,
    createdBy: row.created_by,
    createdByDisplayName: row.created_by_display_name,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    closedAt: row.closed_at,
  };
}

function mapMany(rows: InstanceRow[]): Instance[] {
  return rows.map(map);
}

export function insertInstance(db: Database.Database, row: Omit<Instance, "bannerMessageId" | "panelMessageId" | "closedAt"> & {
  bannerMessageId?: string | null;
  panelMessageId?: string | null;
}): Instance {
  db.prepare(`
    INSERT INTO instances (
      id, guild_id, shift_number, parent_channel_id, destination_channel_id, is_thread,
      thread_name, banner_message_id, panel_message_id, created_by, created_by_display_name,
      created_at, last_activity_at, closed_at
    ) VALUES (@id, @guildId, @shiftNumber, @parentChannelId, @destinationChannelId, @isThread,
      @threadName, @bannerMessageId, @panelMessageId, @createdBy, @createdByDisplayName,
      @createdAt, @lastActivityAt, NULL)
  `).run({ ...row, isThread: row.isThread ? 1 : 0, bannerMessageId: row.bannerMessageId ?? null, panelMessageId: row.panelMessageId ?? null });
  return getInstance(db, row.id)!;
}

export function getInstance(db: Database.Database, id: string): Instance | undefined {
  const row = db.prepare("SELECT * FROM instances WHERE id = ?").get(id) as InstanceRow | undefined;
  return row ? map(row) : undefined;
}

export function listOpenInstances(db: Database.Database, guildId: string): Instance[] {
  return mapMany(db.prepare("SELECT * FROM instances WHERE guild_id = ? AND closed_at IS NULL ORDER BY created_at ASC").all(guildId) as InstanceRow[]);
}

export function countOpenInstances(db: Database.Database, guildId: string): number {
  return (db.prepare("SELECT COUNT(*) AS count FROM instances WHERE guild_id = ? AND closed_at IS NULL").get(guildId) as { count: number }).count;
}

export function findOpenByDestination(db: Database.Database, destinationChannelId: string): Instance | undefined {
  const row = db.prepare("SELECT * FROM instances WHERE destination_channel_id = ? AND closed_at IS NULL ORDER BY created_at ASC LIMIT 1").get(destinationChannelId) as InstanceRow | undefined;
  return row ? map(row) : undefined;
}

export function findOpenUnthreaded(db: Database.Database, destinationChannelId: string): Instance | undefined {
  const row = db.prepare("SELECT * FROM instances WHERE destination_channel_id = ? AND closed_at IS NULL AND is_thread = 0 LIMIT 1").get(destinationChannelId) as InstanceRow | undefined;
  return row ? map(row) : undefined;
}

export function setInstanceMessages(db: Database.Database, id: string, bannerMessageId: string, panelMessageId: string): void {
  db.prepare("UPDATE instances SET banner_message_id = ?, panel_message_id = ? WHERE id = ?").run(bannerMessageId, panelMessageId, id);
}

export function touchActivity(db: Database.Database, id: string, atIso: string): void {
  db.prepare("UPDATE instances SET last_activity_at = ? WHERE id = ?").run(atIso, id);
}

export function closeInstance(db: Database.Database, id: string, atIso: string): void {
  db.prepare("UPDATE instances SET closed_at = ? WHERE id = ? AND closed_at IS NULL").run(atIso, id);
}

export function listOpenIdleSince(db: Database.Database, cutoffIso: string): Instance[] {
  return mapMany(db.prepare("SELECT * FROM instances WHERE closed_at IS NULL AND last_activity_at < ? ORDER BY last_activity_at ASC").all(cutoffIso) as InstanceRow[]);
}

export function listAllOpenInstances(db: Database.Database): Instance[] {
  return mapMany(db.prepare("SELECT * FROM instances WHERE closed_at IS NULL ORDER BY created_at ASC").all() as InstanceRow[]);
}

export function closeAllOpenForGuild(db: Database.Database, guildId: string, atIso: string): number {
  return db.prepare("UPDATE instances SET closed_at = ? WHERE guild_id = ? AND closed_at IS NULL").run(atIso, guildId).changes;
}
