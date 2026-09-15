import type { Kind } from "../domain/rooms.ts";

export interface ModeStore {
  get(userId: string, instanceId: string): Kind;
  toggle(userId: string, instanceId: string): Kind;
  set(userId: string, instanceId: string, kind: Kind): void;
}
