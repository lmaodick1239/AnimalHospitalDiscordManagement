const chains = new Map<string, Promise<unknown>>();

export function lockKey(instanceId: string, room: string): string {
  return `${instanceId}:${room}`;
}

export function withRoomLock<T>(instanceId: string, room: string, fn: () => Promise<T>): Promise<T> {
  const key = lockKey(instanceId, room);
  const prev = chains.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  const held = next.then(
    () => undefined,
    () => undefined,
  );
  chains.set(key, held);
  void held.then(() => {
    if (chains.get(key) === held) chains.delete(key);
  });
  return next;
}
