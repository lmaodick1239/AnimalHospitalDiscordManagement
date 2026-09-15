import Database from "better-sqlite3";

export function openDb(path: string): Database.Database {
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  if (path !== ":memory:") {
    db.pragma("journal_mode = WAL");
  }
  migrate(db);
  return db;
}

export function migrate(db: Database.Database): void {
  // Add type column to existing databases that predate it
  const cols = db.pragma("table_info(reports)") as { name: string; notnull: number }[];
  if (cols.length > 0 && !cols.some((c) => c.name === "type")) {
    db.exec(`ALTER TABLE reports ADD COLUMN type TEXT NOT NULL DEFAULT 'report'`);
  }

  // Allow room and kind to be nullable if pre-existing schema had NOT NULL constraints
  const roomCol = cols.find((c) => c.name === "room");
  if (roomCol && roomCol.notnull === 1) {
    db.pragma("foreign_keys = OFF");
    db.exec(`
      CREATE TABLE reports_migrated (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        room TEXT,
        kind TEXT,
        discord_message_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        ticked_at TEXT,
        type TEXT NOT NULL DEFAULT 'report',
        FOREIGN KEY (instance_id) REFERENCES instances(id)
      );
      INSERT INTO reports_migrated SELECT id, instance_id, user_id, display_name, room, kind, discord_message_id, created_at, ticked_at, type FROM reports;
      DROP TABLE reports;
      ALTER TABLE reports_migrated RENAME TO reports;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_one_uncleared ON reports(instance_id, room) WHERE ticked_at IS NULL AND type = 'report';
      CREATE INDEX IF NOT EXISTS idx_reports_instance_created ON reports(instance_id, created_at);
    `);
    db.pragma("foreign_keys = ON");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      default_channel_id TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      shift_lead_role_id TEXT,
      tick_emoji TEXT NOT NULL DEFAULT '✅',
      idle_hours INTEGER NOT NULL DEFAULT 6,
      tombstone_hours INTEGER NOT NULL DEFAULT 2,
      shift_counter INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS instances (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      shift_number INTEGER NOT NULL,
      parent_channel_id TEXT NOT NULL,
      destination_channel_id TEXT NOT NULL,
      is_thread INTEGER NOT NULL,
      thread_name TEXT,
      banner_message_id TEXT,
      panel_message_id TEXT,
      created_by TEXT NOT NULL,
      created_by_display_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_activity_at TEXT NOT NULL,
      closed_at TEXT,
      FOREIGN KEY (guild_id) REFERENCES guild_settings(guild_id)
    );

    CREATE INDEX IF NOT EXISTS idx_instances_guild_open
      ON instances(guild_id) WHERE closed_at IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_instances_open_unthreaded
      ON instances(destination_channel_id) WHERE closed_at IS NULL AND is_thread = 0;

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      room TEXT,
      kind TEXT,
      discord_message_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      ticked_at TEXT,
      type TEXT NOT NULL DEFAULT 'report',
      FOREIGN KEY (instance_id) REFERENCES instances(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_one_uncleared
      ON reports(instance_id, room) WHERE ticked_at IS NULL AND type = 'report';

    CREATE INDEX IF NOT EXISTS idx_reports_instance_created
      ON reports(instance_id, created_at);
  `);
}
