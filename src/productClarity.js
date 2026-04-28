export const PRODUCT_MODES = [
  {
    id: "transfer",
    name: "Transfer diagnosis",
    promise: "Explain why a file copy or wired transfer is slower than the modeled path.",
    inputs: "File size, observed time, link speed, storage rates, topology, and overhead assumptions.",
    output: "Expected t, observed t', delta, bottleneck stack, confidence notes."
  },
  {
    id: "hardware",
    name: "Hardware ground truth",
    promise: "Collect the facts Firefly can read from the host before asking for assumptions.",
    inputs: "OS hardware APIs, PCI/storage/network probes, load and memory hints.",
    output: "Measured facts, redacted identifiers, missing permissions, confidence level."
  },
  {
    id: "benchmark",
    name: "Benchmark engine",
    promise: "Run small controlled probes that isolate memory, burst I/O, and queue pressure.",
    inputs: "Safe local benchmark runners with bounded memory, disk, and file counts.",
    output: "Measured service rate, elapsed time, and how the result maps back to the model."
  }
];

export const CONFIDENCE_LEVELS = [
  {
    level: "Measured",
    meaning: "Read directly from the host or produced by a benchmark in this session.",
    example: "CPU model from system_profiler, RAM copy throughput from benchmark."
  },
  {
    level: "Derived",
    meaning: "Calculated from measured facts and deterministic protocol databases.",
    example: "PCIe 4.0 x4 ceiling after 128b/130b encoding overhead."
  },
  {
    level: "Assumed",
    meaning: "Provided by the user or defaulted because the OS did not expose it.",
    example: "SLC cache size, post-cache write rate, exact PCH competing traffic."
  },
  {
    level: "Blocked",
    meaning: "Requires elevated APIs, vendor tooling, or signed native drivers.",
    example: "Some thermals, memory-controller counters, direct I/O bus queues."
  }
];
