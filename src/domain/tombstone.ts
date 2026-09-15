import type { GuildSettings } from "../stores/guildSettings.js";
import type { Instance } from "../stores/instances.js";

export function isTombstoned(instance: Instance, settings: GuildSettings | undefined, now: Date): boolean {
  if (!instance.closedAt) return false;
  const hours = settings?.tombstoneHours ?? 2;
  return now.getTime() >= Date.parse(instance.closedAt) + hours * 3600000;
}
