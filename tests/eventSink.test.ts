import { test } from "node:test";
import assert from "node:assert/strict";
import { InProcessEventSink } from "../src/stores/InProcessEventSink.ts";

test("emits only to instance listeners and supports unsubscribe", () => {
  const sink = new InProcessEventSink();
  const seen: string[] = [];
  const unsubscribe = sink.subscribe("i1", (event) => seen.push(event.type));
  sink.subscribe("i2", (event) => seen.push(`other:${event.type}`));
  sink.emit({ type: "snapshot", instanceId: "i1" });
  unsubscribe();
  sink.emit({ type: "report", instanceId: "i1", report: {} as never });
  assert.deepEqual(seen, ["snapshot"]);
});

test("listener errors do not prevent other listeners", () => {
  const sink = new InProcessEventSink();
  const seen: string[] = [];
  sink.subscribe("i", () => { throw new Error("bad listener"); });
  sink.subscribe("i", (event) => seen.push(event.type));
  sink.emit({ type: "snapshot", instanceId: "i" });
  assert.deepEqual(seen, ["snapshot"]);
});
