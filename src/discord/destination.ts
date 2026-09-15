import { threadTimestampName } from "../domain/strings.js";

export function resolveThreadName(opts: { now: Date; timeZone: string; adminName?: string | null }): string {
  if (opts.adminName !== undefined && opts.adminName !== null) {
    const name = opts.adminName.trim();
    if (!name) throw new Error("empty thread name");
    if (name.length > 100) throw new Error("Discord max thread name length is 100");
    return name;
  }
  return threadTimestampName(opts.now, opts.timeZone);
}
