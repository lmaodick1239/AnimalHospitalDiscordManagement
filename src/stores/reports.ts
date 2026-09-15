import type Database from "better-sqlite3";
import { ROOMS, type Kind, type Room } from "../domain/rooms.js";

export type Report = {
  id: string;
  instanceId: string;
  userId: string;
  displayName: string;
  room: Room;
  kind: Kind;
  discordMessageId: string;
  createdAt: string;
  tickedAt: string | null;
};

type ReportRow = {
  id: string; instance_id: string; user_id: string; display_name: string; room: Room;
  kind: Kind; discord_message_id: string; created_at: string; ticked_at: string | null;
};

function map(row: ReportRow): Report {
  return {
    id: row.id,
    instanceId: row.instance_id,
    userId: row.user_id,
    displayName: row.display_name,
    room: row.room,
    kind: row.kind,
    discordMessageId: row.discord_message_id,
    createdAt: row.created_at,
    tickedAt: row.ticked_at,
  };
}

export function insertReport(db: Database.Database, row: Omit<Report, "tickedAt">): Report {
  db.prepare(`
    INSERT INTO reports (id, instance_id, user_id, display_name, room, kind, discord_message_id, created_at, ticked_at)
    VALUES (@id, @instanceId, @userId, @displayName, @room, @kind, @discordMessageId, @createdAt, NULL)
  `).run(row);
  return map(db.prepare("SELECT * FROM reports WHERE id = ?").get(row.id) as ReportRow);
}

export function getUncleared(db: Database.Database, instanceId: string, room: Room): Report | undefined {
  const row = db.prepare("SELECT * FROM reports WHERE instance_id = ? AND room = ? AND ticked_at IS NULL").get(instanceId, room) as ReportRow | undefined;
  return row ? map(row) : undefined;
}

export function tickReport(db: Database.Database, id: string, atIso: string): void {
  db.prepare("UPDATE reports SET ticked_at = ? WHERE id = ? AND ticked_at IS NULL").run(atIso, id);
}

export function listReports(db: Database.Database, instanceId: string): Report[] {
  return (db.prepare("SELECT * FROM reports WHERE instance_id = ? ORDER BY created_at ASC").all(instanceId) as ReportRow[]).map(map);
}

export function occupancy(db: Database.Database, instanceId: string): Record<Room, Kind | null> {
  const result = Object.fromEntries(ROOMS.map((room) => [room, null])) as Record<Room, Kind | null>;
  const rows = db.prepare("SELECT room, kind FROM reports WHERE instance_id = ? AND ticked_at IS NULL").all(instanceId) as { room: Room; kind: Kind }[];
  for (const row of rows) result[row.room] = row.kind;
  return result;
}
