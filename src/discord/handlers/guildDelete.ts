import type Database from "better-sqlite3";
import type { Clock } from "../../clock.js";
import type { EventSink } from "../../stores/EventSink.js";
import { listOpenInstances } from "../../stores/instances.js";
import { finalizeClose } from "../../domain/closeInstanceFlow.js";

export async function handleGuildDelete(opts: {
  db: Database.Database;
  events: EventSink;
  clock: Clock;
  guildId: string;
}): Promise<void> {
  for (const instance of listOpenInstances(opts.db, opts.guildId)) {
    await finalizeClose({ db: opts.db, client: null, events: opts.events, instance, clock: opts.clock });
  }
}
