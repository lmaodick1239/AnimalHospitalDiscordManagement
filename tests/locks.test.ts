import { test } from "node:test";
import assert from "node:assert/strict";
import { withRoomLock } from "../src/stores/locks.ts";

test("serializes the same key", async () => {
  const order: number[] = [];
  const a = withRoomLock("i", "RM1", async () => {
    order.push(1);
    await new Promise((r) => setTimeout(r, 20));
    order.push(2);
    return "a";
  });
  const b = withRoomLock("i", "RM1", async () => {
    order.push(3);
    return "b";
  });
  assert.deepEqual(await Promise.all([a, b]), ["a", "b"]);
  assert.deepEqual(order, [1, 2, 3]);
});

test("different keys do not wait", async () => {
  let concurrent = 0;
  let max = 0;
  const run = (room: string) =>
    withRoomLock("i", room, async () => {
      concurrent++;
      max = Math.max(max, concurrent);
      await new Promise((r) => setTimeout(r, 20));
      concurrent--;
    });
  await Promise.all([run("RM1"), run("RM2")]);
  assert.equal(max, 2);
});

test("releases on throw", async () => {
  await assert.rejects(() =>
    withRoomLock("i", "RM1", async () => {
      throw new Error("boom");
    }),
  );
  const v = await withRoomLock("i", "RM1", async () => 1);
  assert.equal(v, 1);
});
