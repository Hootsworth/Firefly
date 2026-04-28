import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { BENCHMARK_PLANS } from "./capabilities.js";

const MB = 1024 * 1024;

export function listBenchmarks() {
  return BENCHMARK_PLANS.map((plan) => ({
    ...plan,
    runnable: ["pure-ram", "burst-io", "read-io", "sustained-write", "sustained-queue"].includes(plan.id),
    safety: safetyFor(plan.id)
  }));
}

export async function runBenchmark(id, options = {}) {
  if (id === "pure-ram") return runPureRam(options);
  if (id === "burst-io") return runBurstIo(options);
  if (id === "read-io") return runReadIo(options);
  if (id === "sustained-write") return runSustainedWrite(options);
  if (id === "sustained-queue") return runSustainedQueue(options);
  if (id === "dmi-bottleneck") {
    return {
      id,
      status: "manual-required",
      title: "DMI bottleneck test needs a guided multi-device run",
      notes: [
        "Firefly cannot honestly synthesize DMI contention without two PCH-attached drives and a PCH-attached NIC.",
        "Use the topology model fields to enter the DMI ceiling and competing traffic, then run the external copy/network workload."
      ]
    };
  }
  throw new Error(`Unknown benchmark: ${id}`);
}

async function runPureRam(options) {
  const sizeMB = clamp(Number(options.sizeMB || 128), 16, 512);
  const source = Buffer.allocUnsafe(sizeMB * MB);
  const target = Buffer.allocUnsafe(sizeMB * MB);
  source.fill(0xa5);

  const started = performance.now();
  source.copy(target);
  const elapsedMs = performance.now() - started;

  return result({
    id: "pure-ram",
    title: "Pure RAM micro-benchmark",
    bytes: sizeMB * MB,
    elapsedMs,
    metric: "Memory copy throughput",
    notes: ["Safe preview uses a bounded buffer instead of the full 2 GB public-run target."]
  });
}

async function runBurstIo(options) {
  const sizeMB = clamp(Number(options.sizeMB || 64), 8, 256);
  const dir = await mkdtemp(join(tmpdir(), "firefly-burst-"));
  const file = join(dir, "burst.bin");
  const payload = Buffer.allocUnsafe(sizeMB * MB);
  payload.fill(0x5a);

  try {
    const started = performance.now();
    await writeFile(file, payload);
    const elapsedMs = performance.now() - started;
    return result({
      id: "burst-io",
      title: "Burst I/O benchmark",
      bytes: sizeMB * MB,
      elapsedMs,
      metric: "Burst write throughput",
      notes: ["Writes to the OS temp directory with bounded size to avoid accidental disk pressure."]
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runReadIo(options) {
  const sizeMB = clamp(Number(options.sizeMB || 64), 8, 256);
  const dir = await mkdtemp(join(tmpdir(), "firefly-read-"));
  const file = join(dir, "read.bin");
  const payload = Buffer.allocUnsafe(sizeMB * MB);
  payload.fill(0x3c);

  try {
    await writeFile(file, payload);
    const started = performance.now();
    await readFile(file);
    const elapsedMs = performance.now() - started;
    return result({
      id: "read-io",
      title: "Read I/O benchmark",
      bytes: sizeMB * MB,
      elapsedMs,
      metric: "Read throughput",
      notes: ["Reads from the OS temp directory; cache effects are possible and should be treated as measured-local rather than universal disk truth."]
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runSustainedWrite(options) {
  const sizeMB = clamp(Number(options.sizeMB || 256), 64, 1024);
  const chunkMB = clamp(Number(options.chunkMB || 16), 4, 64);
  const dir = await mkdtemp(join(tmpdir(), "firefly-sustain-"));
  const file = join(dir, "sustained.bin");
  const chunk = Buffer.allocUnsafe(chunkMB * MB);
  chunk.fill(0xc3);
  const chunks = Math.ceil(sizeMB / chunkMB);

  try {
    const started = performance.now();
    const { open } = await import("node:fs/promises");
    const handle = await open(file, "w");
    try {
      for (let index = 0; index < chunks; index += 1) {
        await handle.write(chunk, 0, Math.min(chunk.length, (sizeMB - index * chunkMB) * MB));
      }
      await handle.sync();
    } finally {
      await handle.close();
    }
    const elapsedMs = performance.now() - started;
    return result({
      id: "sustained-write",
      title: "Sustained write probe",
      bytes: sizeMB * MB,
      elapsedMs,
      metric: "Sustained write throughput",
      notes: ["Bounded sustained write with fsync; use as a conservative destination-write value."]
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runSustainedQueue(options) {
  const fileCount = clamp(Number(options.fileCount || 400), 50, 2000);
  const fileSizeBytes = clamp(Number(options.fileSizeBytes || 4096), 512, 16384);
  const dir = await mkdtemp(join(tmpdir(), "firefly-queue-"));
  const payload = Buffer.alloc(fileSizeBytes, 0x1f);

  try {
    const started = performance.now();
    for (let index = 0; index < fileCount; index += 1) {
      await writeFile(join(dir, `${String(index).padStart(5, "0")}.bin`), payload);
    }
    const elapsedMs = performance.now() - started;
    return {
      ...result({
        id: "sustained-queue",
        title: "Sustained queue stress test",
        bytes: fileCount * fileSizeBytes,
        elapsedMs,
        metric: "Tiny-file write pressure",
        notes: ["Safe preview uses hundreds of files; the full public validation target is 100,000 files."]
      }),
      fileCount,
      iops: elapsedMs > 0 ? fileCount / (elapsedMs / 1000) : Infinity
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function result({ id, title, bytes, elapsedMs, metric, notes }) {
  const seconds = elapsedMs / 1000;
  return {
    id,
    status: "complete",
    title,
    metric,
    bytes,
    elapsedMs,
    seconds,
    MBps: seconds > 0 ? bytes / MB / seconds : Infinity,
    notes
  };
}

function safetyFor(id) {
  if (id === "pure-ram") return "Bounded memory copy, default 128 MB.";
  if (id === "burst-io") return "Bounded temp write, default 64 MB, auto-cleaned.";
  if (id === "read-io") return "Bounded temp read, default 64 MB, auto-cleaned.";
  if (id === "sustained-write") return "Bounded chunked temp write, default 256 MB, auto-cleaned.";
  if (id === "sustained-queue") return "Bounded tiny-file write, default 400 files, auto-cleaned.";
  return "Manual guided run only; requires specific PCH topology.";
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
