import { effectivePcieMBps, pcieMBps } from "./theoreticalMax.js";

const DECIMAL_GB = 1_000_000_000;
const BINARY_GIB = 1_073_741_824;
const DEFAULT_PROTOCOL_EFFICIENCY = 0.92;
const MIN_VALID_RATE_MBPS = 0.001;

export const PRESETS = {
  ethernet1g: {
    label: "1 GbE",
    portMbps: 1000,
    protocolEfficiency: 0.94,
    latencyMs: 0.35
  },
  ethernet10g: {
    label: "10 GbE",
    portMbps: 10000,
    protocolEfficiency: 0.94,
    latencyMs: 0.25
  },
  usb32gen2: {
    label: "USB 3.2 Gen 2",
    portMbps: 10000,
    protocolEfficiency: 0.82,
    latencyMs: 0.12
  },
  thunderbolt4: {
    label: "Thunderbolt 4",
    portMbps: 40000,
    protocolEfficiency: 0.78,
    latencyMs: 0.08
  },
  pcie4x4: {
    label: "PCIe 4.0 x4",
    portMbps: pcieMBps(4, 4) * 8,
    protocolEfficiency: 1,
    latencyMs: 0.03
  }
};

export function mbpsToMBps(mbps) {
  return mbps / 8;
}

export function formatSeconds(seconds) {
  if (!Number.isFinite(seconds)) return "unbounded";
  const sign = seconds < 0 ? "-" : "";
  const absoluteSeconds = Math.abs(seconds);
  if (absoluteSeconds < 0.001) return `${sign}${(absoluteSeconds * 1_000_000).toFixed(0)} us`;
  if (absoluteSeconds < 1) return `${sign}${(absoluteSeconds * 1000).toFixed(1)} ms`;
  if (absoluteSeconds < 90) return `${sign}${absoluteSeconds.toFixed(2)} s`;
  const minutes = Math.floor(absoluteSeconds / 60);
  const remainder = absoluteSeconds % 60;
  if (minutes < 90) return `${sign}${minutes}m ${remainder.toFixed(0)}s`;
  const hours = Math.floor(minutes / 60);
  const minuteRemainder = minutes % 60;
  return `${sign}${hours}h ${minuteRemainder}m`;
}

export function formatRate(mbPerSecond) {
  if (!Number.isFinite(mbPerSecond)) return "unbounded";
  if (mbPerSecond >= 1000) return `${(mbPerSecond / 1000).toFixed(2)} GB/s`;
  if (mbPerSecond >= 10) return `${mbPerSecond.toFixed(1)} MB/s`;
  return `${mbPerSecond.toFixed(2)} MB/s`;
}

export function coerceScenario(raw) {
  const data = { ...raw };
  const preset = data.preset && PRESETS[data.preset] ? PRESETS[data.preset] : null;

  return {
    fileSize: asNumber(data.fileSize, 10),
    fileSizeUnit: data.fileSizeUnit || "GB",
    observedSeconds: asNumber(data.observedSeconds, 12),
    concurrency: Math.max(1, Math.floor(asNumber(data.concurrency, 1))),
    operation: data.operation || "wired-transfer",
    compressionRatio: Math.max(0.01, asNumber(data.compressionRatio, 1)),
    queueDepth: Math.max(1, Math.floor(asNumber(data.queueDepth, 1))),
    protocolEfficiency: clamp(
      asNumber(data.protocolEfficiency, preset?.protocolEfficiency ?? DEFAULT_PROTOCOL_EFFICIENCY),
      0.05,
      1
    ),
    latencyMs: Math.max(0, asNumber(data.latencyMs, preset?.latencyMs ?? 0.2)),
    packetLossPct: clamp(asNumber(data.packetLossPct, 0), 0, 100),
    sourceReadMBps: asNumber(data.sourceReadMBps, 3500),
    destinationWriteMBps: asNumber(data.destinationWriteMBps, 3000),
    portMbps: asNumber(data.portMbps, preset?.portMbps ?? 10000),
    busMBps: asNumber(data.busMBps, 7000),
    pcieGeneration: asNumber(data.pcieGeneration, 4),
    pcieActiveLanes: asNumber(data.pcieActiveLanes, 4),
    pcieMaxLanes: asNumber(data.pcieMaxLanes, 4),
    useActivePcieLink: data.useActivePcieLink === "on" || data.useActivePcieLink === true,
    topology: data.topology || "cpu-direct",
    dmiMBps: asNumber(data.dmiMBps, 0),
    pchCompetingTrafficMBps: asNumber(data.pchCompetingTrafficMBps, 0),
    memoryCopyMBps: asNumber(data.memoryCopyMBps, 25000),
    cpuTransformMBps: asNumber(data.cpuTransformMBps, 20000),
    gpuTransformMBps: asNumber(data.gpuTransformMBps, 0),
    slcCacheGB: Math.max(0, asNumber(data.slcCacheGB, 0)),
    postCacheWriteMBps: asNumber(data.postCacheWriteMBps, 0),
    temperatureC: asNumber(data.temperatureC, 0),
    tjMaxC: asNumber(data.tjMaxC, 0),
    cpuCoreClass: data.cpuCoreClass || "unknown",
    flexModeRam: data.flexModeRam === "on" || data.flexModeRam === true,
    thermalThrottlePct: clamp(asNumber(data.thermalThrottlePct, 0), 0, 95),
    architecturePenaltyPct: clamp(asNumber(data.architecturePenaltyPct, 0), 0, 80),
    osOverheadPct: clamp(asNumber(data.osOverheadPct, 4), 0, 80)
  };
}

export function analyzeScenario(raw) {
  const scenario = coerceScenario(raw);
  const warnings = validateScenario(scenario);
  const sizeBytes = scenario.fileSize * (scenario.fileSizeUnit === "GiB" ? BINARY_GIB : DECIMAL_GB);
  const logicalMB = sizeBytes / 1_000_000;
  const transferredMB = logicalMB * scenario.compressionRatio;
  const storageProfile = effectiveStorageWriteRate(scenario, transferredMB);
  const activePcie = effectivePcieMBps({
    generation: scenario.pcieGeneration,
    activeLanes: scenario.pcieActiveLanes,
    maxLanes: scenario.pcieMaxLanes
  });
  const concurrencyPenalty = 1 + Math.max(0, scenario.concurrency - 1) * 0.08;
  const queueGain = Math.min(1.25, 1 + Math.log2(scenario.queueDepth) * 0.045);
  const lossPenalty = scenario.packetLossPct > 0 ? 1 / Math.max(0.2, 1 - scenario.packetLossPct / 100) : 1;
  const globalPenalty =
    concurrencyPenalty *
    lossPenalty *
    (1 + scenario.osOverheadPct / 100) *
    (1 + scenario.architecturePenaltyPct / 100) *
    (1 + scenario.thermalThrottlePct / 100);

  const networkMBps = mbpsToMBps(scenario.portMbps) * scenario.protocolEfficiency;
  const busMBps = scenario.useActivePcieLink && activePcie.activeMBps > 0 ? activePcie.activeMBps : scenario.busMBps;
  const stages = [
    makeStage("Source storage read", scenario.sourceReadMBps * queueGain, "Disk or source storage cannot feed the pipeline fast enough."),
    makeStage("Destination write", storageProfile.effectiveWriteMBps * queueGain, "Destination storage or filesystem writes are limiting completion."),
    makeStage("Port and protocol", networkMBps, "Cable, port negotiation, protocol efficiency, or link errors are constraining transfer rate."),
    makeStage("PCIe / internal bus", busMBps, "Internal bus bandwidth is below the rest of the path."),
    makeStage("Memory copy", memoryRate(scenario), "RAM copy bandwidth or memory pressure is acting as the ceiling."),
    makeStage("CPU transform", scenario.cpuTransformMBps, "Checksums, encryption, compression, or user-space copies are CPU-bound.")
  ];

  if (scenario.topology === "pch" && scenario.dmiMBps > 0) {
    stages.push(
      makeStage(
        "Shared DMI / PCH link",
        Math.max(0, scenario.dmiMBps - scenario.pchCompetingTrafficMBps),
        "PCH-attached devices are sharing the chipset-to-CPU bridge."
      )
    );
  }

  if (scenario.gpuTransformMBps > 0) {
    stages.push(makeStage("GPU transform", scenario.gpuTransformMBps, "GPU compute, VRAM movement, or PCIe round-trips are limiting the operation."));
  }

  const validStages = stages.filter((stage) => stage.rateMBps >= MIN_VALID_RATE_MBPS);
  const bottleneck = validStages.reduce((slowest, stage) => (stage.effectiveRateMBps < slowest.effectiveRateMBps ? stage : slowest), validStages[0]);
  const idealRateMBps = bottleneck ? bottleneck.effectiveRateMBps : 0;
  const effectiveRateMBps = idealRateMBps / globalPenalty;
  const latencySeconds = (scenario.latencyMs / 1000) * Math.max(1, Math.ceil(transferredMB / 64));
  const expectedSeconds = effectiveRateMBps > 0 ? transferredMB / effectiveRateMBps + latencySeconds : Infinity;
  const observedRateMBps = scenario.observedSeconds > 0 ? transferredMB / scenario.observedSeconds : Infinity;
  const deltaSeconds = scenario.observedSeconds - expectedSeconds;
  const deltaPct = Number.isFinite(expectedSeconds) && expectedSeconds > 0 ? (deltaSeconds / expectedSeconds) * 100 : 0;
  const tolerancePct = inferTolerance(scenario, warnings);
  const verdict = classify(deltaPct, tolerancePct, warnings);
  const stageRankings = validStages
    .map((stage) => {
      const shareOfCeiling = idealRateMBps > 0 ? idealRateMBps / stage.effectiveRateMBps : 0;
      return {
        ...stage,
        pressure: clamp(shareOfCeiling, 0, 1),
        headline: stage.name === bottleneck?.name ? "primary constraint" : shareOfCeiling > 0.82 ? "near constraint" : "headroom"
      };
    })
    .sort((a, b) => a.effectiveRateMBps - b.effectiveRateMBps);

  return {
    scenario,
    size: { logicalMB, transferredMB },
    expectedSeconds,
    observedSeconds: scenario.observedSeconds,
    deltaSeconds,
    deltaPct,
    tolerancePct,
    effectiveRateMBps,
    observedRateMBps,
    bottleneck,
    stages: stageRankings,
    verdict,
    warnings,
    confidence: buildConfidence(scenario, warnings),
    activePcie,
    storageProfile,
    annotations: buildAnnotations(scenario, storageProfile, activePcie),
    recommendations: buildRecommendations({ verdict, deltaPct, scenario, stages: stageRankings, warnings })
  };
}

function makeStage(name, rateMBps, explanation) {
  const safeRate = asNumber(rateMBps, 0);
  return {
    name,
    rateMBps: safeRate,
    effectiveRateMBps: Math.max(0, safeRate),
    explanation
  };
}

function validateScenario(scenario) {
  const warnings = [];
  if (scenario.fileSize <= 0) warnings.push("File size must be above zero.");
  if (scenario.observedSeconds <= 0) warnings.push("Observed time must be above zero.");
  if (scenario.portMbps <= 0) warnings.push("Port speed must be above zero.");
  if (scenario.sourceReadMBps <= 0) warnings.push("Source read speed must be above zero.");
  if (scenario.destinationWriteMBps <= 0) warnings.push("Destination write speed must be above zero.");
  if (scenario.busMBps <= 0) warnings.push("Bus speed must be above zero.");
  if (scenario.useActivePcieLink && scenario.pcieActiveLanes <= 0) warnings.push("Active PCIe lanes must be above zero.");
  if (scenario.memoryCopyMBps <= 0) warnings.push("Memory copy speed must be above zero.");
  if (scenario.cpuTransformMBps <= 0) warnings.push("CPU transform speed must be above zero.");
  if (scenario.compressionRatio < 1) warnings.push("Compression makes transferred bytes smaller than logical file size; compare against bytes on the wire.");
  if (scenario.compressionRatio > 1) warnings.push("Expansion or metadata overhead makes transferred bytes larger than logical file size.");
  if (scenario.packetLossPct >= 5) warnings.push("Packet loss is high enough that retransmits can dominate the expected time.");
  if (scenario.thermalThrottlePct >= 30) warnings.push("Thermal throttling is large; sustained tests may diverge from short benchmarks.");
  if (scenario.temperatureC > 0 && scenario.tjMaxC > 0 && scenario.temperatureC >= scenario.tjMaxC - 3) {
    warnings.push("Thermally induced delta likely: component temperature is at or near TjMax.");
  }
  if (scenario.cpuCoreClass === "e-core") warnings.push("Thread placement on an efficiency core can skew CPU processing time.");
  if (scenario.flexModeRam) warnings.push("Asymmetric RAM flex mode can make memory service rate allocation-dependent.");
  if (scenario.useActivePcieLink && scenario.pcieMaxLanes > scenario.pcieActiveLanes) {
    warnings.push("Active PCIe link is narrower than the maximum link; lane bifurcation is being modeled.");
  }
  if (scenario.slcCacheGB > 0 && scenario.postCacheWriteMBps > 0 && scenario.fileSize * scenario.compressionRatio > scenario.slcCacheGB) {
    warnings.push("Sustained write exceeds SLC cache; destination write rate is modeled as a two-phase service rate.");
  }
  if (scenario.topology === "pch" && scenario.dmiMBps > 0 && scenario.pchCompetingTrafficMBps > 0) {
    warnings.push("PCH-attached devices share DMI bandwidth; bridge contention is included.");
  }
  return warnings;
}

function inferTolerance(scenario, warnings) {
  let tolerance = 12;
  tolerance += Math.min(15, scenario.packetLossPct * 1.5);
  tolerance += Math.min(12, Math.max(0, scenario.concurrency - 1) * 2);
  tolerance += scenario.compressionRatio !== 1 ? 8 : 0;
  tolerance += warnings.length >= 2 ? 5 : 0;
  return clamp(tolerance, 8, 45);
}

function classify(deltaPct, tolerancePct, warnings) {
  if (warnings.some((warning) => warning.includes("must be above zero"))) {
    return {
      status: "invalid",
      title: "Inputs need attention",
      detail: "One or more required capacities are zero or negative, so Firefly cannot infer a useful expected time."
    };
  }

  if (deltaPct > tolerancePct) {
    return {
      status: "slower",
      title: "Observed run is slower than expected",
      detail: "The machine is underperforming the modeled path; inspect the primary and near constraints first."
    };
  }

  if (deltaPct < -tolerancePct) {
    return {
      status: "faster",
      title: "Observed run is faster than expected",
      detail: "The model is probably conservative, cached, compressed, or missing a faster path."
    };
  }

  return {
    status: "expected",
    title: "Observed run is within expectation",
    detail: "The measured result falls inside Firefly's uncertainty band for this system path."
  };
}

function buildRecommendations({ verdict, deltaPct, scenario, stages, warnings }) {
  const recommendations = [];
  const primary = stages[0];
  const near = stages.filter((stage) => stage.headline === "near constraint").slice(0, 2);

  if (primary) {
    recommendations.push(`Start with ${primary.name.toLowerCase()}: it has the lowest modeled ceiling at ${formatRate(primary.effectiveRateMBps)}.`);
  }

  if (near.length) {
    recommendations.push(`Also inspect ${near.map((stage) => stage.name.toLowerCase()).join(" and ")} because they sit close to the primary ceiling.`);
  }

  if (verdict.status === "slower" && deltaPct > 50) {
    recommendations.push("Run a smaller controlled transfer and a sustained transfer; a large delta often means throttling, renegotiated link speed, antivirus scanning, or retransmits.");
  }

  if (scenario.packetLossPct > 0) {
    recommendations.push("Check cable quality, duplex negotiation, switch counters, and retransmission metrics before blaming storage or CPU.");
  }

  if (scenario.gpuTransformMBps > 0) {
    recommendations.push("For GPU-assisted work, profile PCIe transfers separately from shader or compute time; the slower of those often hides under a single GPU label.");
  }

  if (scenario.topology === "pch") {
    recommendations.push("Confirm device routing in the PCI tree; PCH-attached drives and NICs can bottleneck at DMI even when each device looks healthy.");
  }

  if (scenario.cpuCoreClass === "e-core") {
    recommendations.push("Repeat the run with CPU affinity pinned to a performance core to isolate scheduler placement.");
  }

  if (warnings.length === 0 && recommendations.length < 3) {
    recommendations.push("Capture at least three observed runs and compare the median; single-run deltas are noisy.");
  }

  return recommendations;
}

function effectiveStorageWriteRate(scenario, transferredMB) {
  const burstRate = scenario.destinationWriteMBps;
  if (scenario.slcCacheGB <= 0 || scenario.postCacheWriteMBps <= 0) {
    return {
      effectiveWriteMBps: burstRate,
      phases: [{ name: "steady", MB: transferredMB, MBps: burstRate }]
    };
  }

  const cacheMB = scenario.slcCacheGB * 1000;
  const burstMB = Math.min(transferredMB, cacheMB);
  const sustainedMB = Math.max(0, transferredMB - burstMB);
  const seconds = burstMB / burstRate + sustainedMB / scenario.postCacheWriteMBps;
  return {
    effectiveWriteMBps: seconds > 0 ? transferredMB / seconds : burstRate,
    phases: [
      { name: "SLC cache", MB: burstMB, MBps: burstRate },
      { name: "post-cache NAND", MB: sustainedMB, MBps: scenario.postCacheWriteMBps }
    ].filter((phase) => phase.MB > 0)
  };
}

function memoryRate(scenario) {
  const flexPenalty = scenario.flexModeRam ? 0.72 : 1;
  return scenario.memoryCopyMBps * flexPenalty;
}

function buildAnnotations(scenario, storageProfile, activePcie) {
  const annotations = [];
  if (storageProfile.phases.length > 1) {
    annotations.push(`Storage write is modeled in ${storageProfile.phases.length} phases because the transfer exceeds SLC cache.`);
  }
  if (scenario.temperatureC > 0 && scenario.tjMaxC > 0 && scenario.temperatureC >= scenario.tjMaxC - 3) {
    annotations.push("Thermally induced delta: temperature is at or near TjMax.");
  }
  if (activePcie.bifurcated) {
    annotations.push(`Active PCIe link uses x${scenario.pcieActiveLanes}, below the x${scenario.pcieMaxLanes} maximum.`);
  }
  return annotations;
}

function buildConfidence(scenario, warnings) {
  const measured = [];
  const derived = [];
  const assumed = [];
  const blocked = [];

  if (scenario.memoryCopyMBps > 0) assumed.push("Memory copy ceiling unless filled from benchmark.");
  if (scenario.destinationWriteMBps > 0) assumed.push("Destination write ceiling unless filled from benchmark.");
  if (scenario.sourceReadMBps > 0) assumed.push("Source read ceiling unless filled from benchmark.");
  if (scenario.useActivePcieLink) derived.push("Active PCIe ceiling derived from generation and lane count.");
  if (scenario.topology === "pch") derived.push("DMI/PCH bridge modeled from entered ceiling and competing traffic.");
  if (scenario.slcCacheGB > 0) assumed.push("SLC cache behavior depends on drive-specific data.");
  if (scenario.temperatureC > 0 && scenario.tjMaxC > 0) measured.push("Thermal state entered or probed for this run.");
  if (warnings.some((warning) => warning.includes("must be above zero"))) blocked.push("Invalid fields block confident diagnosis.");
  blocked.push("Direct memory-controller and per-bus queue counters require privileged native helpers.");

  return { measured, derived, assumed, blocked };
}

function asNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
