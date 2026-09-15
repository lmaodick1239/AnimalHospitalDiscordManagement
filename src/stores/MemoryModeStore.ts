import type { Kind } from "../domain/rooms.ts";
import type { ModeStore } from "./ModeStore.ts";

export class MemoryModeStore implements ModeStore {
  private readonly modes = new Map<string, Kind>();

  get(userId: string, instanceId: string): Kind {
    return this.modes.get(`${userId}:${instanceId}`) ?? "ANOMALY";
  }

  toggle(userId: string, instanceId: string): Kind {
    const kind = this.get(userId, instanceId) === "ANOMALY" ? "MAYBE" : "ANOMALY";
    this.set(userId, instanceId, kind);
    return kind;
  }

  set(userId: string, instanceId: string, kind: Kind): void {
    this.modes.set(`${userId}:${instanceId}`, kind);
  }
}
