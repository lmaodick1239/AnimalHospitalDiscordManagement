import type { Kind, Room } from "./rooms.js";

export function shiftBanner(n: number): string {
  return `---- SHIFT ${n} ----`;
}

export function reportBody(room: Room, kind: Kind, displayName: string): string {
  return `${room} ${kind}\n${displayName}`;
}

export function modeAck(kind: Kind): string {
  return `Mode: ${kind}`;
}

export function postedAck(room: Room, kind: Kind): string {
  return `Posted ${room} ${kind}`;
}

export function clearedAck(room: Room): string {
  return `Cleared ${room}`;
}

export function threadTimestampName(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(d);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.hour}:${values.minute}-${values.day}${values.month}${values.year}`;
}
