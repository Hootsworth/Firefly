import test from "node:test";
import assert from "node:assert/strict";
import { compareScenarios } from "../src/comparison.js";

const before = {
  fileSize: 20,
  fileSizeUnit: "GB",
  observedSeconds: 24,
  portMbps: 10000,
  protocolEfficiency: 0.94,
  latencyMs: 0.25,
  packetLossPct: 0,
  sourceReadMBps: 3500,
  destinationWriteMBps: 900,
  busMBps: 7000,
  memoryCopyMBps: 25000,
  cpuTransformMBps: 20000,
  queueDepth: 4,
  concurrency: 1,
  osOverheadPct: 4,
  architecturePenaltyPct: 0,
  thermalThrottlePct: 0
};

test("comparison waits for both snapshots", () => {
  const comparison = compareScenarios(before, null);
  assert.equal(comparison.ready, false);
});

test("comparison identifies an improved after state", () => {
  const comparison = compareScenarios(before, {
    ...before,
    observedSeconds: 13,
    destinationWriteMBps: 2400
  }, "Cable swap");

  assert.equal(comparison.ready, true);
  assert.equal(comparison.status.tone, "good");
  assert.ok(comparison.expectedPct > 0);
  assert.ok(comparison.rows.some((row) => row.label === "Primary limit"));
});

test("comparison identifies a regressed after state", () => {
  const comparison = compareScenarios(before, {
    ...before,
    observedSeconds: 40,
    portMbps: 1000
  }, "BIOS change");

  assert.equal(comparison.status.tone, "bad");
  assert.ok(comparison.observedPct < 0);
});
