import test from "node:test";
import assert from "node:assert/strict";
import { listBenchmarks, runBenchmark } from "../src/benchmarkEngine.js";

test("lists runnable and guided benchmark definitions", () => {
  const benchmarks = listBenchmarks();
  assert.ok(benchmarks.some((benchmark) => benchmark.id === "pure-ram" && benchmark.runnable));
  assert.ok(benchmarks.some((benchmark) => benchmark.id === "dmi-bottleneck" && !benchmark.runnable));
});

test("runs bounded RAM benchmark", async () => {
  const result = await runBenchmark("pure-ram", { sizeMB: 16 });
  assert.equal(result.status, "complete");
  assert.equal(result.bytes, 16 * 1024 * 1024);
  assert.ok(result.MBps > 0);
});

test("runs bounded burst I/O benchmark and cleans up", async () => {
  const result = await runBenchmark("burst-io", { sizeMB: 8 });
  assert.equal(result.status, "complete");
  assert.equal(result.bytes, 8 * 1024 * 1024);
  assert.ok(result.MBps > 0);
});

test("runs bounded read I/O benchmark", async () => {
  const result = await runBenchmark("read-io", { sizeMB: 8 });
  assert.equal(result.status, "complete");
  assert.equal(result.bytes, 8 * 1024 * 1024);
  assert.ok(result.MBps > 0);
});

test("runs bounded sustained write benchmark", async () => {
  const result = await runBenchmark("sustained-write", { sizeMB: 64, chunkMB: 8 });
  assert.equal(result.status, "complete");
  assert.equal(result.bytes, 64 * 1024 * 1024);
  assert.ok(result.MBps > 0);
});

test("runs bounded tiny-file queue benchmark", async () => {
  const result = await runBenchmark("sustained-queue", { fileCount: 50, fileSizeBytes: 512 });
  assert.equal(result.status, "complete");
  assert.equal(result.fileCount, 50);
  assert.ok(result.iops > 0);
});

test("DMI benchmark is exposed as guided when topology is unavailable", async () => {
  const result = await runBenchmark("dmi-bottleneck");
  assert.equal(result.status, "manual-required");
  assert.ok(result.notes.some((note) => note.includes("PCH-attached")));
});
