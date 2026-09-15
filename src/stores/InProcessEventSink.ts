import type { EventSink, LogEvent } from "./EventSink.ts";

type Listener = (ev: LogEvent) => void;

export class InProcessEventSink implements EventSink {
  private readonly listeners = new Map<string, Set<Listener>>();

  emit(ev: LogEvent): void {
    for (const listener of [...(this.listeners.get(ev.instanceId) ?? [])]) {
      try {
        listener(ev);
      } catch {
        // One subscriber must not prevent delivery to the remaining subscribers.
      }
    }
  }

  subscribe(instanceId: string, fn: Listener): () => void {
    let listeners = this.listeners.get(instanceId);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(instanceId, listeners);
    }
    listeners.add(fn);
    return () => {
      listeners!.delete(fn);
      if (listeners!.size === 0) this.listeners.delete(instanceId);
    };
  }
}
