export const REQUIREMENT_STATUS = [
  {
    name: "Product clarity",
    status: "met",
    implementation: "Firefly now exposes its three modes, confidence levels, measured/derived/assumed boundaries, and output promises directly in the UI.",
    gap: "Public copy will still need user testing, but the product contract is now visible."
  },
  {
    name: "Low-level hardware polling",
    status: "met",
    implementation: "The local server exposes /api/probe, backed by Node OS probes: macOS system_profiler/sysctl, Linux /proc + lsblk + lspci, Windows PowerShell CIM/WMI.",
    gap: "Some counters remain permission-limited by the OS and are reported as probe warnings."
  },
  {
    name: "Topology mapping",
    status: "partial",
    implementation: "Model supports CPU-attached vs PCH-attached devices, active PCIe lanes, and shared DMI/PCH contention.",
    gap: "Exact motherboard routing still depends on OS-exposed PCI tree and board metadata."
  },
  {
    name: "Theoretical maximums database",
    status: "met",
    implementation: "Local database now includes sourced protocol ceilings, PCIe generation/lane calculations, and a larger real-component catalog with provenance notes.",
    gap: "Vendor-specific SSD cache sizes and controller behavior still need continuous maintenance and field validation."
  },
  {
    name: "Background noise isolation",
    status: "partial",
    implementation: "Model accepts baseline OS overhead, queue depth, packet loss, and concurrent jobs; probe can collect host load hints.",
    gap: "Accurate per-bus queue length requires privileged counters or vendor tools."
  },
  {
    name: "Benchmark engine",
    status: "met",
    implementation: "Safe local runners now execute bounded RAM copy, burst I/O, and tiny-file queue pressure tests through /api/benchmarks/:id/run.",
    gap: "DMI contention remains guided/manual because it requires specific PCH-attached drives and NIC topology."
  },
  {
    name: "Privilege escalation",
    status: "partial",
    implementation: "Tauri now exposes a native helper manifest, safe user-space counter snapshot, and explicit signed-helper boundary.",
    gap: "Direct memory-controller or I/O-bus access still requires administrator/root privileges and platform-specific signing."
  }
];

export const BENCHMARK_PLANS = [
  {
    id: "pure-ram",
    name: "Pure RAM micro-benchmark",
    target: "RAM MT/s, CAS latency, CPU cache, memory pressure",
    process: "Allocate a 2 GB buffer and copy it to another buffer in memory.",
    expected: "t and t' should be close. A high delta points to memory pressure, background load, or incorrect XMP/EXPO settings."
  },
  {
    id: "burst-io",
    name: "Burst I/O benchmark",
    target: "PCIe bus, SSD controller, peak cache write behavior",
    process: "Write a single 1 GB file from RAM to NVMe storage.",
    expected: "Should hit peak service rate without exhausting SLC cache or thermal limits."
  },
  {
    id: "sustained-queue",
    name: "Sustained queue stress test",
    target: "Storage-controller IOPS and queueing behavior",
    process: "Write 100,000 tiny 4 KB files from RAM to storage.",
    expected: "Creates a large queue; expected time should rise with arrival rate and service saturation."
  },
  {
    id: "read-io",
    name: "Read I/O benchmark",
    target: "Storage read path, filesystem cache behavior, temp volume throughput",
    process: "Create a bounded temp file, then read it back into memory.",
    expected: "Gives Firefly a measured source-read ceiling for local storage modeling."
  },
  {
    id: "sustained-write",
    name: "Sustained write probe",
    target: "Post-burst write behavior and early cache exhaustion signals",
    process: "Write a larger bounded temp file in chunks to observe sustained throughput.",
    expected: "Helps estimate destination write ceilings more realistically than a tiny burst."
  },
  {
    id: "dmi-bottleneck",
    name: "DMI bottleneck test",
    target: "Chipset bridge shared by PCH-attached drives and NICs",
    process: "Copy between two PCH-attached drives while pushing traffic through a PCH-attached NIC.",
    expected: "The DMI/PCH bridge should be identified as the bottleneck when the individual devices still have headroom."
  }
];
