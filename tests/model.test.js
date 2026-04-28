import test from "node:test";
import assert from "node:assert/strict";
import { analyzeScenario, formatSeconds, mbpsToMBps } from "../src/model.js";

const baseScenario = {
  fileSize: 10,
  fileSizeUnit: "GB",
  observedSeconds: 10,
  portMbps: 10000,
  protocolEfficiency: 0.94,
  latencyMs: 0,
  packetLossPct: 0,
  sourceReadMBps: 3500,
  destinationWriteMBps: 3000,
  busMBps: 7000,
  memoryCopyMBps: 25000,
  cpuTransformMBps: 20000,
  gpuTransformMBps: 0,
  compressionRatio: 1,
  queueDepth: 1,
  concurrency: 1,
  osOverheadPct: 0,
  architecturePenaltyPct: 0,
  thermalThrottlePct: 0
};

test("converts line rate from Mb/s to MB/s", () => {
  assert.equal(mbpsToMBps(10000), 1250);
});

test("uses the slowest stage as the primary bottleneck", () => {
  const result = analyzeScenario({
    ...baseScenario,
    portMbps: 100000,
    sourceReadMBps: 5000,
    destinationWriteMBps: 800
  });

  assert.equal(result.bottleneck.name, "Destination write");
  assert.equal(result.stages[0].name, "Destination write");
});

test("flags observed runs that are much slower than expected", () => {
  const result = analyzeScenario({
    ...baseScenario,
    observedSeconds: 40
  });

  assert.equal(result.verdict.status, "slower");
  assert.ok(result.deltaPct > result.tolerancePct);
});

test("flags observed runs that are faster than the modeled path", () => {
  const result = analyzeScenario({
    ...baseScenario,
    observedSeconds: 2
  });

  assert.equal(result.verdict.status, "faster");
  assert.ok(result.deltaPct < -result.tolerancePct);
});

test("adds warnings for invalid capacities", () => {
  const result = analyzeScenario({
    ...baseScenario,
    portMbps: 0
  });

  assert.equal(result.verdict.status, "invalid");
  assert.ok(result.warnings.some((warning) => warning.includes("Port speed")));
});

test("models compression as fewer transferred bytes", () => {
  const normal = analyzeScenario(baseScenario);
  const compressed = analyzeScenario({
    ...baseScenario,
    compressionRatio: 0.5
  });

  assert.ok(compressed.expectedSeconds < normal.expectedSeconds);
  assert.ok(compressed.warnings.some((warning) => warning.includes("Compression")));
});

test("includes GPU as a possible constraint when provided", () => {
  const result = analyzeScenario({
    ...baseScenario,
    gpuTransformMBps: 600
  });

  assert.equal(result.bottleneck.name, "GPU transform");
  assert.ok(result.recommendations.some((item) => item.includes("GPU-assisted")));
});

test("packet loss widens tolerance and slows expected time", () => {
  const clean = analyzeScenario(baseScenario);
  const lossy = analyzeScenario({
    ...baseScenario,
    packetLossPct: 10
  });

  assert.ok(lossy.expectedSeconds > clean.expectedSeconds);
  assert.ok(lossy.tolerancePct > clean.tolerancePct);
  assert.ok(lossy.warnings.some((warning) => warning.includes("Packet loss")));
});

test("formats negative deltas as durations without throwing", () => {
  assert.equal(formatSeconds(-1.25), "-1.25 s");
  assert.equal(formatSeconds(-95), "-1m 35s");
});

test("emits confidence ledger for scenario provenance", () => {
  const result = analyzeScenario(baseScenario);
  assert.ok(result.confidence.assumed.some((item) => item.includes("Memory copy")));
  assert.ok(result.confidence.blocked.some((item) => item.includes("memory-controller")));
});
