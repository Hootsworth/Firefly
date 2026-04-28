import { analyzeScenario, formatRate, formatSeconds } from "./model.js";
import { pcieMBps } from "./theoreticalMax.js";

export const HARDWARE_SOURCES = {
  "pcisig-pcie6-faq": {
    label: "PCI-SIG PCIe 6.0 specification",
    url: "https://pcisig.com/pci-express-6.0-specification",
    note: "PCIe 6.0 reaches 64.0 GT/s and up to 256 GB/s bidirectional bandwidth on x16 using PAM4, FEC, and FLIT mode."
  },
  "intel-14900k-ark": {
    label: "Intel Core i9-14900K product specifications",
    url: "https://www.intel.com/content/www/us/en/products/sku/236773/intel-core-i9-processor-14900k-36m-cache-up-to-6-00-ghz.html",
    note: "24 cores, 32 threads, DMI 4.0 x8, PCIe 5.0/4.0 up to 1x16+4 or 2x8+4, DDR5-5600/DDR4-3200."
  },
  "amd-epyc-9654": {
    label: "AMD EPYC 9654 specifications",
    url: "https://www.amd.com/en/products/processors/server/epyc/4th-generation-9004-and-8004-series/amd-epyc-9654.html",
    note: "96 cores, 192 threads, PCIe 5.0 x128, 12-channel DDR5-4800, 460.8 GB/s per-socket memory bandwidth."
  },
  "samsung-990-pro": {
    label: "Samsung 990 PRO specifications",
    url: "https://www.samsung.com/us/memory-storage/nvme-ssd/990-pro-2tb-nvme-pcie-gen-4-mz-v9p2t0b-am/",
    note: "Sequential read/write speeds up to 7,450/6,900 MB/s."
  },
  "nvidia-rtx-4090": {
    label: "NVIDIA GeForce RTX 4090 specifications",
    url: "https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4090/",
    note: "Ada Lovelace, 16,384 CUDA cores, 24 GB GDDR6X, PCI Express Gen 4."
  },
  "usb-if-usb4": {
    label: "USB-IF USB4 specification family",
    url: "https://www.usb.org/usb4",
    note: "Used for USB4/Thunderbolt-class external path ceilings before protocol and tunneling overhead."
  },
  "model-calibrated": {
    label: "Firefly modeled constant",
    url: "README.md",
    note: "Conservative modeling ceiling derived from public specs and adjusted for real-world overhead; replace with probe or benchmark data when available."
  }
};

export const COMPONENTS = {
  cpu: [
    { id: "apple-m4", label: "Apple M4", family: "Apple Silicon", cores: "4P + 6E", lanes: "SoC fabric", cpuTransformMBps: 26000, memoryCopyMBps: 58000, score: 84 },
    { id: "apple-m4-pro", label: "Apple M4 Pro", family: "Apple Silicon", cores: "up to 10P + 4E", lanes: "SoC fabric", cpuTransformMBps: 43000, memoryCopyMBps: 96000, score: 94 },
    { id: "apple-m3-max", label: "Apple M3 Max", family: "Apple Silicon", cores: "up to 12P + 4E", lanes: "SoC fabric", cpuTransformMBps: 46000, memoryCopyMBps: 120000, score: 95 },
    { id: "apple-m4-max", label: "Apple M4 Max", family: "Apple Silicon", cores: "up to 12P + 4E", lanes: "SoC fabric", cpuTransformMBps: 56000, memoryCopyMBps: 180000, score: 98, sourceIds: ["model-calibrated"] },
    { id: "intel-i5-12400", label: "Intel Core i5-12400", family: "Alder Lake", cores: "6P / 12T", lanes: 20, cpuTransformMBps: 17000, memoryCopyMBps: 36000, score: 68 },
    { id: "intel-i7-13700k", label: "Intel Core i7-13700K", family: "Raptor Lake", cores: "8P + 8E / 24T", lanes: 20, cpuTransformMBps: 34000, memoryCopyMBps: 56000, score: 87 },
    { id: "intel-i9-14900k", label: "Intel Core i9-14900K", family: "Raptor Lake Refresh", cores: "8P + 16E / 32T", lanes: 20, cpuTransformMBps: 43000, memoryCopyMBps: 62000, score: 92, sourceIds: ["intel-14900k-ark"] },
    { id: "intel-ultra-7-155h", label: "Intel Core Ultra 7 155H", family: "Meteor Lake mobile", cores: "6P + 8E + 2LP-E", lanes: "mobile platform", cpuTransformMBps: 24000, memoryCopyMBps: 47000, score: 76 },
    { id: "intel-ultra-9-285k", label: "Intel Core Ultra 9 285K", family: "Arrow Lake desktop", cores: "8P + 16E / 24T", lanes: 24, cpuTransformMBps: 46000, memoryCopyMBps: 76000, score: 93, sourceIds: ["model-calibrated"] },
    { id: "amd-ryzen-5-7600", label: "AMD Ryzen 5 7600", family: "Zen 4", cores: "6C / 12T", lanes: 24, cpuTransformMBps: 22000, memoryCopyMBps: 52000, score: 78 },
    { id: "amd-ryzen-7-7800x3d", label: "AMD Ryzen 7 7800X3D", family: "Zen 4 X3D", cores: "8C / 16T", lanes: 24, cpuTransformMBps: 26000, memoryCopyMBps: 54000, score: 84 },
    { id: "amd-ryzen-9-7950x", label: "AMD Ryzen 9 7950X", family: "Zen 4", cores: "16C / 32T", lanes: 24, cpuTransformMBps: 45000, memoryCopyMBps: 65000, score: 93 },
    { id: "amd-ryzen-9-9950x", label: "AMD Ryzen 9 9950X", family: "Zen 5", cores: "16C / 32T", lanes: 24, cpuTransformMBps: 52000, memoryCopyMBps: 72000, score: 96, sourceIds: ["model-calibrated"] },
    { id: "amd-ryzen-7-9800x3d", label: "AMD Ryzen 7 9800X3D", family: "Zen 5 X3D", cores: "8C / 16T", lanes: 24, cpuTransformMBps: 33000, memoryCopyMBps: 66000, score: 91, sourceIds: ["model-calibrated"] },
    { id: "amd-threadripper-7970x", label: "AMD Threadripper 7970X", family: "Zen 4 HEDT", cores: "32C / 64T", lanes: 48, cpuTransformMBps: 76000, memoryCopyMBps: 145000, score: 98 },
    { id: "intel-xeon-w9-3495x", label: "Intel Xeon w9-3495X", family: "Sapphire Rapids WS", cores: "56C / 112T", lanes: 112, cpuTransformMBps: 90000, memoryCopyMBps: 180000, score: 99 },
    { id: "amd-epyc-9654", label: "AMD EPYC 9654", family: "Zen 4 server", cores: "96C / 192T", lanes: 128, cpuTransformMBps: 145000, memoryCopyMBps: 320000, score: 100, sourceIds: ["amd-epyc-9654"] }
  ],
  gpu: [
    { id: "none", label: "No GPU stage", family: "CPU-only", gpuTransformMBps: 0, lanes: 0, score: 50 },
    { id: "apple-m4-gpu", label: "Apple M4 integrated GPU", family: "Apple Silicon", gpuTransformMBps: 18000, lanes: "unified", score: 66 },
    { id: "intel-arc-a770", label: "Intel Arc A770 16GB", family: "Arc Alchemist", gpuTransformMBps: 26000, lanes: 16, score: 73 },
    { id: "rtx-4060", label: "NVIDIA GeForce RTX 4060", family: "Ada Lovelace", gpuTransformMBps: 32000, lanes: 8, score: 76 },
    { id: "rtx-4070-super", label: "NVIDIA GeForce RTX 4070 SUPER", family: "Ada Lovelace", gpuTransformMBps: 52000, lanes: 16, score: 86 },
    { id: "rtx-4090", label: "NVIDIA GeForce RTX 4090", family: "Ada Lovelace", gpuTransformMBps: 94000, lanes: 16, score: 98, sourceIds: ["nvidia-rtx-4090"] },
    { id: "rtx-4080-super", label: "NVIDIA GeForce RTX 4080 SUPER", family: "Ada Lovelace", gpuTransformMBps: 76000, lanes: 16, score: 93, sourceIds: ["model-calibrated"] },
    { id: "rtx-5090", label: "NVIDIA GeForce RTX 5090", family: "Blackwell", gpuTransformMBps: 132000, lanes: 16, score: 100, sourceIds: ["model-calibrated"] },
    { id: "rx-7800-xt", label: "AMD Radeon RX 7800 XT", family: "RDNA 3", gpuTransformMBps: 47000, lanes: 16, score: 84 },
    { id: "rx-7900-xtx", label: "AMD Radeon RX 7900 XTX", family: "RDNA 3", gpuTransformMBps: 76000, lanes: 16, score: 93 },
    { id: "rx-9070-xt", label: "AMD Radeon RX 9070 XT", family: "RDNA 4", gpuTransformMBps: 78000, lanes: 16, score: 94, sourceIds: ["model-calibrated"] },
    { id: "rtx-6000-ada", label: "NVIDIA RTX 6000 Ada", family: "Workstation Ada", gpuTransformMBps: 98000, lanes: 16, score: 99 }
  ],
  memory: [
    { id: "ddr4-3200-dual", label: "DDR4-3200 dual channel", standard: "DDR4-3200", channels: 2, theoreticalMBps: 51200, memoryCopyMBps: 26000, score: 64 },
    { id: "ddr4-3600-dual", label: "DDR4-3600 dual channel", standard: "DDR4-3600", channels: 2, theoreticalMBps: 57600, memoryCopyMBps: 30000, score: 68 },
    { id: "ddr5-4800-dual", label: "DDR5-4800 dual channel", standard: "DDR5-4800", channels: 2, theoreticalMBps: 76800, memoryCopyMBps: 43000, score: 78 },
    { id: "ddr5-6000-dual", label: "DDR5-6000 EXPO/XMP dual", standard: "DDR5-6000", channels: 2, theoreticalMBps: 96000, memoryCopyMBps: 56000, score: 86 },
    { id: "ddr5-7200-dual", label: "DDR5-7200 tuned dual", standard: "DDR5-7200", channels: 2, theoreticalMBps: 115200, memoryCopyMBps: 68000, score: 91 },
    { id: "lpddr5x-7500-unified", label: "LPDDR5X-7500 unified", standard: "LPDDR5X", channels: "SoC", theoreticalMBps: 120000, memoryCopyMBps: 82000, score: 92 },
    { id: "ddr5-5600-quad", label: "DDR5-5600 quad channel", standard: "DDR5-5600", channels: 4, theoreticalMBps: 179200, memoryCopyMBps: 105000, score: 96 },
    { id: "ddr5-6400-quad", label: "DDR5-6400 quad channel", standard: "DDR5-6400", channels: 4, theoreticalMBps: 204800, memoryCopyMBps: 122000, score: 97, sourceIds: ["model-calibrated"] },
    { id: "ddr5-4800-octa", label: "DDR5-4800 eight channel", standard: "DDR5-4800", channels: 8, theoreticalMBps: 307200, memoryCopyMBps: 190000, score: 99 },
    { id: "ddr5-4800-12ch", label: "DDR5-4800 twelve channel", standard: "DDR5-4800", channels: 12, theoreticalMBps: 460800, memoryCopyMBps: 310000, score: 100, sourceIds: ["amd-epyc-9654"] },
    { id: "ddr5-5600-12ch", label: "DDR5-5600 twelve channel", standard: "DDR5-5600", channels: 12, theoreticalMBps: 537600, memoryCopyMBps: 360000, score: 100, sourceIds: ["model-calibrated"] }
  ],
  storage: [
    { id: "samsung-870-evo-1tb", label: "Samsung 870 EVO 1TB", interface: "SATA III", pcieGeneration: 0, activeLanes: 1, readMBps: 560, writeMBps: 530, postCacheWriteMBps: 500, slcCacheGB: 0, score: 46 },
    { id: "crucial-mx500-1tb", label: "Crucial MX500 1TB", interface: "SATA III", pcieGeneration: 0, activeLanes: 1, readMBps: 560, writeMBps: 510, postCacheWriteMBps: 450, slcCacheGB: 0, score: 44 },
    { id: "samsung-970-evo-plus-1tb", label: "Samsung 970 EVO Plus 1TB", interface: "PCIe 3.0 x4", pcieGeneration: 3, activeLanes: 4, readMBps: 3500, writeMBps: 3300, postCacheWriteMBps: 1500, slcCacheGB: 42, score: 76 },
    { id: "wd-black-sn750-1tb", label: "WD Black SN750 1TB", interface: "PCIe 3.0 x4", pcieGeneration: 3, activeLanes: 4, readMBps: 3470, writeMBps: 3000, postCacheWriteMBps: 1350, slcCacheGB: 32, score: 73 },
    { id: "samsung-980-pro-2tb", label: "Samsung 980 PRO 2TB", interface: "PCIe 4.0 x4", pcieGeneration: 4, activeLanes: 4, readMBps: 7000, writeMBps: 5100, postCacheWriteMBps: 1700, slcCacheGB: 110, score: 86 },
    { id: "samsung-990-pro-2tb", label: "Samsung 990 PRO 2TB", interface: "PCIe 4.0 x4", pcieGeneration: 4, activeLanes: 4, readMBps: 7450, writeMBps: 6900, postCacheWriteMBps: 2100, slcCacheGB: 120, score: 91, sourceIds: ["samsung-990-pro"] },
    { id: "wd-black-sn850x-2tb", label: "WD Black SN850X 2TB", interface: "PCIe 4.0 x4", pcieGeneration: 4, activeLanes: 4, readMBps: 7300, writeMBps: 6600, postCacheWriteMBps: 1900, slcCacheGB: 100, score: 90 },
    { id: "crucial-t500-2tb", label: "Crucial T500 2TB", interface: "PCIe 4.0 x4", pcieGeneration: 4, activeLanes: 4, readMBps: 7400, writeMBps: 7000, postCacheWriteMBps: 2000, slcCacheGB: 90, score: 90 },
    { id: "crucial-t700-2tb", label: "Crucial T700 2TB", interface: "PCIe 5.0 x4", pcieGeneration: 5, activeLanes: 4, readMBps: 12400, writeMBps: 11800, postCacheWriteMBps: 2900, slcCacheGB: 120, score: 96 },
    { id: "sabrent-rocket-5-2tb", label: "Sabrent Rocket 5 2TB", interface: "PCIe 5.0 x4", pcieGeneration: 5, activeLanes: 4, readMBps: 14000, writeMBps: 12000, postCacheWriteMBps: 3000, slcCacheGB: 128, score: 98 },
    { id: "corsair-mp700-pro-2tb", label: "Corsair MP700 PRO 2TB", interface: "PCIe 5.0 x4", pcieGeneration: 5, activeLanes: 4, readMBps: 12400, writeMBps: 11800, postCacheWriteMBps: 2800, slcCacheGB: 128, score: 96 },
    { id: "samsung-9100-pro-4tb", label: "Samsung 9100 PRO 4TB", interface: "PCIe 5.0 x4", pcieGeneration: 5, activeLanes: 4, readMBps: 14800, writeMBps: 13400, postCacheWriteMBps: 3200, slcCacheGB: 160, score: 99, sourceIds: ["model-calibrated"] },
    { id: "solidigm-p44-pro-2tb", label: "Solidigm P44 Pro 2TB", interface: "PCIe 4.0 x4", pcieGeneration: 4, activeLanes: 4, readMBps: 7000, writeMBps: 6500, postCacheWriteMBps: 1900, slcCacheGB: 100, score: 89, sourceIds: ["model-calibrated"] },
    { id: "samsung-t7-1tb", label: "Samsung T7 1TB external", interface: "USB 3.2 Gen 2", pcieGeneration: 0, activeLanes: 1, readMBps: 1050, writeMBps: 1000, postCacheWriteMBps: 420, slcCacheGB: 24, score: 55 },
    { id: "usb4-nvme-enclosure", label: "USB4 NVMe enclosure", interface: "USB4 40 Gb/s", pcieGeneration: 0, activeLanes: 1, readMBps: 3200, writeMBps: 2900, postCacheWriteMBps: 1200, slcCacheGB: 64, score: 70, sourceIds: ["usb-if-usb4", "model-calibrated"] }
  ],
  network: [
    { id: "realtek-1gbe", label: "Realtek 1 GbE", standard: "1000BASE-T", portMbps: 1000, efficiency: 0.94, score: 42 },
    { id: "intel-i225-v-2_5gbe", label: "Intel I225-V 2.5 GbE", standard: "2.5GBASE-T", portMbps: 2500, efficiency: 0.94, score: 58 },
    { id: "intel-i226-v-2_5gbe", label: "Intel I226-V 2.5 GbE", standard: "2.5GBASE-T", portMbps: 2500, efficiency: 0.94, score: 59 },
    { id: "aquantia-aqc113-10gbe", label: "Aquantia AQC113 10 GbE", standard: "10GBASE-T", portMbps: 10000, efficiency: 0.94, score: 82 },
    { id: "intel-x550-t2-10gbe", label: "Intel X550-T2 10 GbE", standard: "10GBASE-T", portMbps: 10000, efficiency: 0.94, score: 83 },
    { id: "mellanox-connectx4-25gbe", label: "Mellanox ConnectX-4 25 GbE", standard: "SFP28", portMbps: 25000, efficiency: 0.93, score: 91 },
    { id: "mellanox-connectx3-40gbe", label: "Mellanox ConnectX-3 40 GbE", standard: "QSFP+", portMbps: 40000, efficiency: 0.92, score: 95 },
    { id: "mellanox-connectx5-100gbe", label: "Mellanox ConnectX-5 100 GbE", standard: "QSFP28", portMbps: 100000, efficiency: 0.91, score: 100 },
    { id: "mellanox-connectx6-200gbe", label: "NVIDIA ConnectX-6 200 GbE", standard: "QSFP56", portMbps: 200000, efficiency: 0.9, score: 100, sourceIds: ["model-calibrated"] },
    { id: "mellanox-connectx7-400gbe", label: "NVIDIA ConnectX-7 400 GbE", standard: "QSFP112", portMbps: 400000, efficiency: 0.89, score: 100, sourceIds: ["model-calibrated"] },
    { id: "usb-c-1gbe", label: "USB-C 1 GbE adapter", standard: "USB Ethernet", portMbps: 1000, efficiency: 0.9, score: 38 },
    { id: "wifi6e-160", label: "Wi-Fi 6E 160 MHz ideal", standard: "802.11ax", portMbps: 2400, efficiency: 0.55, score: 44 },
    { id: "wifi7-320", label: "Wi-Fi 7 320 MHz ideal", standard: "802.11be", portMbps: 5760, efficiency: 0.52, score: 61, sourceIds: ["model-calibrated"] }
  ],
  topology: [
    { id: "cpu-direct", label: "CPU-direct storage", detail: "NVMe on CPU lanes", topology: "cpu-direct", dmiMBps: 0, pchTraffic: 0, score: 94 },
    { id: "intel-dmi4-light", label: "Intel DMI 4.0 x8 light", detail: "PCH shared, light USB/NIC load", topology: "pch", dmiMBps: 15754, pchTraffic: 1200, score: 84 },
    { id: "intel-dmi4-heavy", label: "Intel DMI 4.0 x8 heavy", detail: "PCH drives plus NIC active", topology: "pch", dmiMBps: 15754, pchTraffic: 7600, score: 64 },
    { id: "intel-dmi3-heavy", label: "Intel DMI 3.0 x4 heavy", detail: "older PCH bridge under load", topology: "pch", dmiMBps: 3938, pchTraffic: 1800, score: 48 },
    { id: "intel-dmi4-saturated", label: "Intel DMI 4.0 x8 saturated", detail: "multiple PCH NVMe drives plus 10 GbE", topology: "pch", dmiMBps: 15754, pchTraffic: 12000, score: 44, sourceIds: ["intel-14900k-ark"] },
    { id: "amd-prom21-light", label: "AMD AM5 chipset light", detail: "Promontory 21 chipset path", topology: "pch", dmiMBps: 7877, pchTraffic: 900, score: 78 },
    { id: "amd-prom21-heavy", label: "AMD AM5 chipset heavy", detail: "chipset NVMe plus USB/NIC", topology: "pch", dmiMBps: 7877, pchTraffic: 3600, score: 58 },
    { id: "pcie5-switch-fabric", label: "PCIe 5.0 switch fabric", detail: "workstation switch behind CPU lanes", topology: "cpu-direct", dmiMBps: 0, pchTraffic: 0, score: 90, sourceIds: ["pcisig-pcie6-faq", "model-calibrated"] },
    { id: "thunderbolt-dock", label: "Thunderbolt dock chain", detail: "storage and NIC behind dock", topology: "pch", dmiMBps: 3200, pchTraffic: 900, score: 52 },
    { id: "usb-hub-shared", label: "USB hub shared path", detail: "external SSD plus Ethernet", topology: "pch", dmiMBps: 1100, pchTraffic: 250, score: 38 }
  ]
};

export const DEFAULT_BUILD = {
  cpu: "amd-ryzen-9-7950x",
  gpu: "rtx-4070-super",
  memory: "ddr5-6000-dual",
  storage: "samsung-990-pro-2tb",
  network: "intel-x550-t2-10gbe",
  topology: "cpu-direct"
};

export function componentSources(component) {
  const ids = component?.sourceIds?.length ? component.sourceIds : ["model-calibrated"];
  return ids.map((id) => HARDWARE_SOURCES[id]).filter(Boolean);
}

export function catalogSummary() {
  const groups = Object.fromEntries(Object.entries(COMPONENTS).map(([group, items]) => [group, items.length]));
  const sourcedItems = Object.values(COMPONENTS).flat().filter((item) => item.sourceIds?.some((id) => id !== "model-calibrated"));
  return {
    groups,
    totalItems: Object.values(groups).reduce((sum, count) => sum + count, 0),
    sourceCount: Object.keys(HARDWARE_SOURCES).length,
    sourcedItemCount: sourcedItems.length
  };
}

export function scoreBuild(selection = DEFAULT_BUILD) {
  const parts = Object.fromEntries(
    Object.entries(COMPONENTS).map(([group, options]) => [group, options.find((item) => item.id === (selection[group] || DEFAULT_BUILD[group])) || options[0]])
  );
  const pcieGeneration = parts.storage.pcieGeneration || 0;
  const pcieActiveLanes = parts.storage.activeLanes || 1;
  const busMBps = pcieGeneration > 0 ? pcieMBps(pcieGeneration, pcieActiveLanes) : parts.storage.interface?.includes("USB") ? 1250 : 600;
  const scenario = {
    fileSize: 100,
    fileSizeUnit: "GB",
    observedSeconds: 1,
    portMbps: parts.network.portMbps,
    protocolEfficiency: parts.network.efficiency,
    latencyMs: 0.2,
    packetLossPct: 0,
    sourceReadMBps: parts.storage.readMBps,
    destinationWriteMBps: parts.storage.writeMBps,
    busMBps,
    memoryCopyMBps: parts.memory.memoryCopyMBps,
    cpuTransformMBps: parts.cpu.cpuTransformMBps,
    gpuTransformMBps: parts.gpu.gpuTransformMBps,
    topology: parts.topology.topology,
    dmiMBps: parts.topology.dmiMBps,
    pchCompetingTrafficMBps: parts.topology.pchTraffic,
    slcCacheGB: parts.storage.slcCacheGB,
    postCacheWriteMBps: parts.storage.postCacheWriteMBps,
    queueDepth: 8,
    concurrency: 1,
    osOverheadPct: 4,
    architecturePenaltyPct: 0,
    thermalThrottlePct: 0
  };
  const analysis = analyzeScenario(scenario);
  const balancedScore = Math.round(
    (parts.cpu.score + parts.gpu.score + parts.memory.score + parts.storage.score + parts.network.score + parts.topology.score) / 6
  );
  const bottleneckPenalty = analysis.bottleneck ? Math.min(25, Math.max(0, 90 - (analysis.effectiveRateMBps / 100))) : 20;
  const overall = Math.max(1, Math.min(100, Math.round(balancedScore - bottleneckPenalty / 2)));

  return {
    parts,
    scenario,
    analysis,
    scores: {
      overall,
      transfer: Math.max(1, Math.min(100, Math.round(analysis.effectiveRateMBps / 80))),
      compute: Math.round((parts.cpu.score + parts.gpu.score) / 2),
      storage: parts.storage.score,
      topology: parts.topology.score
    },
    summary: [
      `Expected 100 GB transfer: ${formatSeconds(analysis.expectedSeconds)}`,
      `Expected effective rate: ${formatRate(analysis.effectiveRateMBps)}`,
      `Likely limit: ${analysis.bottleneck?.name || "unknown"}`
    ],
    provenance: Object.fromEntries(
      Object.entries(parts).map(([group, part]) => [group, componentSources(part).map((source) => source.label)])
    ),
    specs: {
      cpu: [
        parts.cpu.family,
        `${parts.cpu.cores} cores`,
        `${formatRate(parts.cpu.cpuTransformMBps)} CPU transform`,
        `${parts.cpu.lanes} lanes`
      ],
      gpu: [
        parts.gpu.family,
        `${formatRate(parts.gpu.gpuTransformMBps)} GPU stage`,
        `${parts.gpu.lanes} lanes`
      ],
      memory: [
        parts.memory.standard,
        `${parts.memory.channels} channel${parts.memory.channels === 1 ? "" : "s"}`,
        `${formatRate(parts.memory.memoryCopyMBps)} modeled copy`
      ],
      storage: [
        parts.storage.interface,
        `${formatRate(parts.storage.readMBps)} read`,
        `${formatRate(parts.storage.writeMBps)} burst write`,
        `${parts.storage.slcCacheGB} GB SLC`
      ],
      network: [
        parts.network.standard,
        `${formatRate(parts.network.portMbps / 8)} line rate`,
        `${Math.round(parts.network.efficiency * 100)}% efficiency`
      ],
      topology: [
        parts.topology.detail,
        parts.topology.dmiMBps ? `${formatRate(parts.topology.dmiMBps)} bridge` : "no shared bridge",
        parts.topology.pchTraffic ? `${formatRate(parts.topology.pchTraffic)} competing` : "no competing PCH load"
      ]
    }
  };
}
