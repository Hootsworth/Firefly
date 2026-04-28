import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BUILD, scoreBuild } from "../src/systemDesigner.js";

test("scores a default system design", () => {
  const build = scoreBuild(DEFAULT_BUILD);
  assert.ok(build.scores.overall > 0);
  assert.ok(build.analysis.expectedSeconds > 0);
  assert.equal(build.parts.storage.id, "samsung-990-pro-2tb");
});

test("PCH-heavy topology lowers topology score and adds DMI stage", () => {
  const direct = scoreBuild({ ...DEFAULT_BUILD, topology: "cpu-direct" });
  const pch = scoreBuild({ ...DEFAULT_BUILD, topology: "amd-prom21-heavy" });
  assert.ok(pch.scores.topology < direct.scores.topology);
  assert.ok(pch.analysis.stages.some((stage) => stage.name.includes("DMI")));
});

test("higher-end storage improves expected transfer rate", () => {
  const sata = scoreBuild({ ...DEFAULT_BUILD, storage: "samsung-870-evo-1tb" });
  const gen5 = scoreBuild({ ...DEFAULT_BUILD, storage: "sabrent-rocket-5-2tb" });
  assert.ok(gen5.analysis.effectiveRateMBps > sata.analysis.effectiveRateMBps);
});

test("named real-world parts expose concrete modeling specs", () => {
  const build = scoreBuild({
    ...DEFAULT_BUILD,
    cpu: "intel-i9-14900k",
    gpu: "rtx-4090",
    memory: "ddr5-7200-dual",
    network: "mellanox-connectx5-100gbe"
  });

  assert.equal(build.parts.cpu.label, "Intel Core i9-14900K");
  assert.ok(build.specs.cpu.some((item) => item.includes("Raptor Lake")));
  assert.ok(build.specs.network.some((item) => item.includes("12.50 GB/s")));
});
