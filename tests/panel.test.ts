import test from "node:test";
import assert from "node:assert/strict";
import { buildPanelComponents, buildPanelEmbed, parsePanelCustomId, panelCustomId } from "../src/discord/panel.ts";

test("panel custom ids parse and reject invalid values", () => {
  const id = panelCustomId("rm", "01ARZ3NDEKTSV4RRFFQ69G5FAV", "RM3");
  assert.deepEqual(parsePanelCustomId(id), { kind: "rm", instanceId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", room: "RM3" });
  assert.equal(parsePanelCustomId("rm:id:RM9"), null);
  assert.equal(parsePanelCustomId("x".repeat(101)), null);
});

test("panel has mode and room rows with bound ids", () => {
  const rows = buildPanelComponents("instance");
  assert.equal(rows.length, 3);
  const serialized = rows.map((row) => row.toJSON().components as Array<{ label?: string; custom_id?: string }>);
  assert.deepEqual(serialized.map((row) => row.map((button) => button.label)), [["Mode", "Next Shift"], ["RM1", "RM2", "RM3", "RM4", "RM5"], ["RM6", "RM7", "RM8"]]);
  assert.equal(serialized[1]![2]!.custom_id, "rm:instance:RM3");
});

test("closed panel embed includes Closed", () => {
  assert.match(buildPanelEmbed({ shiftNumber: 3, url: "https://example.test", startedBy: "A", closed: true }).data.title!, /Closed/);
});
