import test from "node:test";
import assert from "node:assert/strict";
import {
  COMPONENTS,
  DEFAULT_BUILD,
  HARDWARE_SOURCES,
  catalogSummary,
  componentCatalogMatches,
  resolvePciDevice,
  resolveUsbDevice,
  scoreBuild
} from "../src/systemDesigner.js";

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

test("catalog exposes a larger sourced constants database", () => {
  const summary = catalogSummary();
  assert.ok(summary.totalItems >= 60);
  assert.ok(summary.sourceCount >= 6);
  assert.ok(summary.sourcedItemCount >= 8);
  assert.ok(summary.generated.deviceIdCount >= 12);
  assert.ok(summary.generated.sourceCount >= 3);
  assert.ok(COMPONENTS.cpu.some((part) => part.id === "amd-ryzen-9-9950x"));
  assert.ok(COMPONENTS.storage.some((part) => part.id === "samsung-9100-pro-4tb"));
  assert.ok(HARDWARE_SOURCES["samsung-990-pro"].url.startsWith("https://"));
});

test("designer returns provenance labels for selected parts", () => {
  const build = scoreBuild({
    ...DEFAULT_BUILD,
    cpu: "intel-i9-14900k",
    storage: "samsung-990-pro-2tb",
    topology: "intel-dmi4-saturated"
  });

  assert.ok(build.provenance.cpu.some((label) => label.includes("14900K")));
  assert.ok(build.provenance.storage.some((label) => label.includes("990 PRO")));
  assert.ok(build.provenance.topology.some((label) => label.includes("14900K")));
});

test("generated catalog resolves PCI and USB device IDs", () => {
  const gpu = resolvePciDevice("10de", "2684");
  const usbNic = resolveUsbDevice("0x0bda", "0x8156");

  assert.match(gpu.name, /RTX 4090/);
  assert.match(usbNic.name, /2.5GbE/);
});

test("designer parts expose generated catalog matches", () => {
  const build = scoreBuild({
    ...DEFAULT_BUILD,
    gpu: "rtx-4090",
    storage: "samsung-990-pro-2tb"
  });

  assert.ok(build.catalogMatches.gpu.some((match) => match.name?.includes("RTX 4090") || match.label?.includes("RTX 4090")));
  assert.ok(build.catalogMatches.storage.some((match) => match.name?.includes("990 PRO") || match.label?.includes("990")));
  assert.ok(componentCatalogMatches(build.parts.gpu).length > 0);
});
