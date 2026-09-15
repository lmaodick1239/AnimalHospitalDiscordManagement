export const ROOMS = ["RM1", "RM2", "RM3", "RM4", "RM5", "RM6", "RM7", "RM8"] as const;
export type Room = (typeof ROOMS)[number];
export type Kind = "ANOMALY" | "MAYBE";

export function isRoom(s: string): s is Room {
  return (ROOMS as readonly string[]).includes(s);
}

export function isKind(s: string): s is Kind {
  return s === "ANOMALY" || s === "MAYBE";
}
