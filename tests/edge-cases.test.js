import test from "node:test";
import assert from "node:assert/strict";
import { analyzeScenario } from "../src/model.js";
import { effectivePcieMBps, pcieMBps, THEORETICAL_MAXIMUMS } from "../src/theoreticalMax.js";

const baseScenario = {
  fileSize: 100,
  fileSizeUnit: "GB",
  observedSeconds: 30,
  portMbps: 100000,
  protocolEfficiency: 1,
  latencyMs: 0,
  packetLossPct: 0,
  sourceReadMBps: 12000,
  destinationWriteMBps: 5000,
  busMBps: 12000,
  memoryCopyMBps: 40000,
  cpuTransformMBps: 40000,
  gpuTransformMBps: 0,
  compressionRatio: 1,
  queueDepth: 1,
  concurrency: 1,
  osOverheadPct: 0,
  architecturePenaltyPct: 0,
  thermalThrottlePct: 0
};

test("database gives PCIe 4.0 x4 after 128b/130b encoding overhead", () => {
  assert.equal(Math.round(pcieMBps(4, 4)), 7877);
  assert.equal(Math.round(THEORETICAL_MAXIMUMS.protocols["dmi-4-x8"].MBps), 15754);
});

test("active PCIe link state is used instead of maximum link state", () => {
  const link = effectivePcieMBps({ generation: 4, activeLanes: 8, maxLanes: 16 });
  assert.equal(Math.round(link.activeMBps), 15754);
  assert.equal(Math.round(link.maxMBps), 31508);
  assert.equal(link.bifurcated, true);

  const result = analyzeScenario({
    ...baseScenario,
    useActivePcieLink: true,
    pcieGeneration: 4,
    pcieActiveLanes: 8,
    pcieMaxLanes: 16,
    busMBps: 50000
  });

  assert.ok(result.warnings.some((warning) => warning.includes("narrower")));
  assert.ok(result.annotations.some((annotation) => annotation.includes("x8")));
});

test("SLC cache exhaustion lowers sustained write service rate", () => {
  const burst = analyzeScenario({
    ...baseScenario,
    fileSize: 20,
    slcCacheGB: 50,
    postCacheWriteMBps: 400
  });
  const sustained = analyzeScenario({
    ...baseScenario,
    fileSize: 100,
    slcCacheGB: 50,
    postCacheWriteMBps: 400
  });

  assert.equal(burst.storageProfile.phases.length, 1);
  assert.equal(sustained.storageProfile.phases.length, 2);
  assert.ok(sustained.storageProfile.effectiveWriteMBps < burst.storageProfile.effectiveWriteMBps);
  assert.ok(sustained.warnings.some((warning) => warning.includes("SLC cache")));
});

test("near-TjMax temperatures flag thermally induced deltas", () => {
  const result = analyzeScenario({
    ...baseScenario,
    temperatureC: 98,
    tjMaxC: 100
  });

  assert.ok(result.warnings.some((warning) => warning.includes("Thermally induced")));
  assert.ok(result.annotations.some((annotation) => annotation.includes("Thermally induced")));
});

test("PCH attached devices can bottleneck on the shared DMI bridge", () => {
  const result = analyzeScenario({
    ...baseScenario,
    topology: "pch",
    dmiMBps: 3500,
    pchCompetingTrafficMBps: 2600,
    destinationWriteMBps: 5000,
    sourceReadMBps: 5000
  });

  assert.equal(result.bottleneck.name, "Shared DMI / PCH link");
  assert.ok(result.warnings.some((warning) => warning.includes("DMI bandwidth")));
});

test("efficiency-core placement and flex RAM are surfaced", () => {
  const result = analyzeScenario({
    ...baseScenario,
    cpuCoreClass: "e-core",
    flexModeRam: true,
    memoryCopyMBps: 1000
  });

  assert.ok(result.warnings.some((warning) => warning.includes("efficiency core")));
  assert.ok(result.warnings.some((warning) => warning.includes("flex mode")));
  assert.ok(result.stages.some((stage) => stage.name === "Memory copy" && stage.effectiveRateMBps === 720));
});
