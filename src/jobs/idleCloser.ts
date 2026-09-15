import type Database from "better-sqlite3";
import type { Client } from "discord.js";
import type { Clock } from "../clock.js";
import type { EventSink } from "../stores/EventSink.js";
import { getGuildSettings } from "../stores/guildSettings.js";
import { listAllOpenInstances } from "../stores/instances.js";
import { finalizeClose } from "../domain/closeInstanceFlow.js";

export function idleCutoffIso(now: Date, idleHours: number): string {
  return new Date(now.getTime() - idleHours * 3600000).toISOString();
}

export async function closeIdleOnce(opts: {
  db: Database.Database;
  client: Client | null;
  events: EventSink;
  clock: Clock;
}): Promise<number> {
  const now = opts.clock.now();
  let closed = 0;
  for (const instance of listAllOpenInstances(opts.db)) {
    const settings = getGuildSettings(opts.db, instance.guildId);
    const cutoff = idleCutoffIso(now, settings?.idleHours ?? 6);
    if (instance.lastActivityAt < cutoff) {
      await finalizeClose({ ...opts, instance });
      closed += 1;
    }
  }
  return closed;
}

export function startIdleCloser(opts: {
  db: Database.Database;
  client: Client;
  events: EventSink;
  clock: Clock;
  intervalMs?: number;
}): { stop: () => void } {
  const timer = setInterval(() => { void closeIdleOnce(opts).catch((error) => console.error(error)); }, opts.intervalMs ?? 60000);
  timer.unref();
  return { stop: () => clearInterval(timer) };
}
