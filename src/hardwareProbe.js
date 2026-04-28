import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function probeHardware() {
  const os = platform();
  const startedAt = new Date().toISOString();
  if (os === "darwin") return { os, startedAt, ...(await probeMac()) };
  if (os === "linux") return { os, startedAt, ...(await probeLinux()) };
  if (os === "win32") return { os, startedAt, ...(await probeWindows()) };
  return {
    os,
    startedAt,
    confidence: "unsupported",
    warnings: [`No hardware probe adapter exists for ${os}.`],
    devices: []
  };
}

async function probeMac() {
  const warnings = [];
  const [hardware, storage, network, pci, sysctl, uptime] = await Promise.all([
    run("system_profiler", ["SPHardwareDataType"]),
    run("system_profiler", ["SPStorageDataType"]),
    run("system_profiler", ["SPNetworkDataType"]),
    run("system_profiler", ["SPPCIDataType"]),
    run("sysctl", ["-a"]),
    run("uptime", [])
  ]);

  for (const result of [hardware, storage, network, pci, sysctl, uptime]) {
    if (result.error) warnings.push(result.error);
  }

  return {
    confidence: "best-effort",
    warnings,
    facts: buildFacts({
      os: "darwin",
      hardware: hardware.stdout,
      storage: storage.stdout,
      network: network.stdout,
      sysctl: `${sysctl.stdout}\n${uptime.stdout}`,
      warnings
    }),
    autofill: buildAutofill({
      os: "darwin",
      hardware: hardware.stdout,
      storage: storage.stdout,
      network: network.stdout,
      sysctl: `${sysctl.stdout}\n${uptime.stdout}`
    }),
    raw: {
      hardware: redact(hardware.stdout),
      storage: redact(storage.stdout),
      network: redact(network.stdout),
      pci: redact(pci.stdout),
      sysctl: usefulSysctl(redact(`${sysctl.stdout}\n${uptime.stdout}`))
    },
    devices: extractMacDevices(`${storage.stdout}\n${pci.stdout}`)
  };
}

async function probeLinux() {
  const warnings = [];
  const [cpu, block, pci, meminfo, loadavg, ipAddr] = await Promise.all([
    run("cat", ["/proc/cpuinfo"]),
    run("lsblk", ["-O", "--json"]),
    run("lspci", ["-vv"]),
    run("cat", ["/proc/meminfo"]),
    run("cat", ["/proc/loadavg"]),
    run("ip", ["-details", "link"])
  ]);

  for (const result of [cpu, block, pci, meminfo, loadavg, ipAddr]) {
    if (result.error) warnings.push(result.error);
  }

  return {
    confidence: warnings.length ? "partial" : "best-effort",
    warnings,
    facts: buildFacts({
      os: "linux",
      hardware: cpu.stdout,
      storage: block.stdout,
      network: ipAddr.stdout,
      sysctl: `${meminfo.stdout}\n${loadavg.stdout}`,
      warnings
    }),
    autofill: buildAutofill({
      os: "linux",
      hardware: cpu.stdout,
      storage: block.stdout,
      network: ipAddr.stdout,
      sysctl: `${meminfo.stdout}\n${loadavg.stdout}`
    }),
    raw: {
      cpu: trimLarge(cpu.stdout),
      block: block.stdout,
      pci: trimLarge(pci.stdout),
      network: trimLarge(ipAddr.stdout),
      meminfo: meminfo.stdout,
      loadavg: loadavg.stdout
    },
    devices: extractLinuxPciDevices(pci.stdout)
  };
}

async function probeWindows() {
  const warnings = [];
  const script = [
    "Get-CimInstance Win32_ComputerSystem | ConvertTo-Json -Compress",
    "Get-CimInstance Win32_Processor | ConvertTo-Json -Compress",
    "Get-CimInstance Win32_DiskDrive | ConvertTo-Json -Compress",
    "Get-CimInstance Win32_PnPEntity | Where-Object {$_.PNPClass -in @('Net','SCSIAdapter','System')} | ConvertTo-Json -Compress"
  ].join("; ");
  const result = await run("powershell.exe", ["-NoProfile", "-Command", script]);
  if (result.error) warnings.push(result.error);

  return {
    confidence: result.error ? "partial" : "best-effort",
    warnings,
    facts: buildFacts({
      os: "win32",
      hardware: result.stdout,
      storage: result.stdout,
      network: result.stdout,
      sysctl: "",
      warnings
    }),
    autofill: buildAutofill({
      os: "win32",
      hardware: result.stdout,
      storage: result.stdout,
      network: result.stdout,
      sysctl: ""
    }),
    raw: { cim: result.stdout },
    devices: []
  };
}

async function run(command, args) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: 8000,
      maxBuffer: 8 * 1024 * 1024
    });
    return { stdout, stderr };
  } catch (error) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      error: `${command} ${args.join(" ")} failed: ${error.message}`
    };
  }
}

function extractMacDevices(text) {
  return text
    .split("\n")
    .filter((line) => /NVMExpress|Ethernet|PCI|Thunderbolt|SSD/i.test(line))
    .slice(0, 80)
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractLinuxPciDevices(text) {
  return text
    .split("\n")
    .filter((line) => /^[0-9a-f:.]+/.test(line))
    .slice(0, 120);
}

function trimLarge(text) {
  if (text.length <= 120_000) return text;
  return `${text.slice(0, 120_000)}\n...[truncated]`;
}

export function redact(text) {
  return text
    .replace(/(Serial Number \(system\): ).+/gi, "$1[redacted]")
    .replace(/(Hardware UUID: ).+/gi, "$1[redacted]")
    .replace(/(Provisioning UDID: ).+/gi, "$1[redacted]")
    .replace(/(Volume UUID: ).+/gi, "$1[redacted]")
    .replace(/(kern\.hostname: ).+/gi, "$1[redacted]")
    .replace(/(kern\.uuid: ).+/gi, "$1[redacted]")
    .replace(/(MAC Address:\s*)[0-9a-f]{2}(?::[0-9a-f]{2}){5}/gi, "$1[mac-redacted]")
    .replace(/(Hardware Address:\s*)[0-9a-f]{2}(?::[0-9a-f]{2}){5}/gi, "$1[mac-redacted]")
    .replace(/(ARP Resolved Hardware Address:\s*)[0-9a-f]{2}(?::[0-9a-f]{2}){5}/gi, "$1[mac-redacted]")
    .replace(/(IPv4 Addresses?:\s*)\d{1,3}(?:\.\d{1,3}){3}/gi, "$1[ip-redacted]")
    .replace(/(Addresses?:\s*)\d{1,3}(?:\.\d{1,3}){3}/gi, "$1[ip-redacted]")
    .replace(/(Router:\s*)\d{1,3}(?:\.\d{1,3}){3}/gi, "$1[ip-redacted]")
    .replace(/(Server (?:Addresses|Identifier):\s*)\d{1,3}(?:\.\d{1,3}){3}/gi, "$1[ip-redacted]")
    .replace(/(ARP Resolved IP Address:\s*)\d{1,3}(?:\.\d{1,3}){3}/gi, "$1[ip-redacted]")
    .replace(/(Network Signature:\s*).+/gi, "$1[redacted]")
    .replace(/(NetworkSignatureHash:\s*).+/gi, "$1[redacted]")
    .replace(/([a-f0-9]{0,4}:){2,7}[a-f0-9]{1,4}/gi, "[ipv6-redacted]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip-redacted]")
    .replace(/\b[0-9a-f]{2}(?::[0-9a-f]{2}){5}\b/gi, "[mac-redacted]")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[uuid-redacted]");
}

function usefulSysctl(text) {
  return text
    .split("\n")
    .filter((line) =>
      /^(hw\.|machdep\.cpu\.|kern\.os(productversion|release|type|version)|kern\.boottime)/.test(line)
    )
    .slice(0, 120)
    .join("\n");
}

function buildFacts({ os, hardware, storage, network = "", sysctl, warnings }) {
  const memoryBytes =
    firstNumber(/Memory:\s*([0-9.]+)\s*GB/i, hardware, 1_000_000_000) ||
    firstNumber(/hw\.memsize:\s*([0-9]+)/i, sysctl, 1) ||
    firstNumber(/MemTotal:\s*([0-9]+)\s*kB/i, sysctl, 1024);
  const performanceCores = firstNumber(/Performance and ([0-9]+) Efficiency/i, hardware, 1)
    ? firstNumber(/([0-9]+)\s*Performance and/i, hardware, 1)
    : firstNumber(/hw\.perflevel0\.physicalcpu:\s*([0-9]+)/i, sysctl, 1);
  const efficiencyCores = firstNumber(/and ([0-9]+) Efficiency/i, hardware, 1) || firstNumber(/hw\.perflevel1\.physicalcpu:\s*([0-9]+)/i, sysctl, 1);
  const cpuModel =
    firstText(/Chip:\s*(.+)/i, hardware) ||
    firstText(/machdep\.cpu\.brand_string:\s*(.+)/i, sysctl) ||
    firstText(/model name\s*:\s*(.+)/i, hardware) ||
    "Unknown CPU";
  const storageDevices = parseStorageDevices(os, storage);
  const networkInterfaces = parseNetworkInterfaces(os, network);
  const load = parseLoad(os, sysctl);

  return {
    os,
    cpu: {
      model: cpuModel,
      performanceCores: performanceCores || null,
      efficiencyCores: efficiencyCores || null
    },
    memory: {
      bytes: memoryBytes || null,
      GB: memoryBytes ? Number((memoryBytes / 1_000_000_000).toFixed(1)) : null
    },
    storage: {
      devices: storageDevices
    },
    network: {
      interfaces: networkInterfaces
    },
    load,
    probeQuality: warnings.length ? "partial" : "measured"
  };
}

function parseStorageDevices(os, storage) {
  if (os === "linux") {
    try {
      const data = JSON.parse(storage);
      return (data.blockdevices || []).map((device) => ({
        name: device.name,
        model: device.model || "unknown",
        protocol: device.tran || device.subsystems || "unknown",
        size: device.size || "unknown",
        rotational: device.rota === false ? "SSD/NVMe" : device.rota === true ? "rotational" : "unknown"
      }));
    } catch {
      return [];
    }
  }

  const chunks = storage.split(/\n\s{4}(?=[^\s].+:)/g);
  return chunks
    .map((chunk) => ({
      name: firstText(/Device Name:\s*(.+)/i, chunk) || firstText(/^\s*([^:\n]+):/m, chunk) || "unknown",
      protocol: firstText(/Protocol:\s*(.+)/i, chunk) || "unknown",
      medium: firstText(/Medium Type:\s*(.+)/i, chunk) || "unknown",
      smart: firstText(/S\.M\.A\.R\.T\. Status:\s*(.+)/i, chunk) || "unknown",
      capacity: firstText(/Capacity:\s*(.+)/i, chunk) || "unknown"
    }))
    .filter((device) => device.name !== "Storage" && (device.name !== "unknown" || device.protocol !== "unknown"));
}

function parseNetworkInterfaces(os, network) {
  if (os === "linux") {
    return network
      .split("\n")
      .filter((line) => /^\d+:\s/.test(line))
      .map((line) => ({
        name: line.match(/^\d+:\s*([^:]+):/)?.[1] || "unknown",
        link: line.includes("state UP") ? "up" : "down"
      }))
      .slice(0, 12);
  }

  return network
    .split(/\n\s{4}(?=[^\s].+:)/g)
    .map((chunk) => ({
      name: firstText(/^\s*([^:\n]+):/m, chunk) || "unknown",
      link: firstText(/Status:\s*(.+)/i, chunk) || firstText(/BSD Device Name:\s*(.+)/i, chunk) || "unknown",
      type: firstText(/Type:\s*(.+)/i, chunk) || firstText(/Hardware:\s*(.+)/i, chunk) || "unknown"
    }))
    .filter((item) => item.name !== "unknown" && item.name !== "Network")
    .slice(0, 12);
}

function parseLoad(os, sysctl) {
  const loadavg =
    sysctl.match(/load averages?:?\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i) ||
    sysctl.match(/^([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/m);
  const memoryFree = firstNumber(/MemAvailable:\s*([0-9]+)\s*kB/i, sysctl, 1024);
  return {
    oneMinute: loadavg ? Number(loadavg[1]) : null,
    fiveMinute: loadavg ? Number(loadavg[2]) : null,
    memoryAvailableBytes: memoryFree || null,
    summary: loadavg ? `load ${loadavg[1]} / ${loadavg[2]} / ${loadavg[3]}` : memoryFree ? `${Math.round(memoryFree / 1_000_000_000)} GB available` : "not exposed"
  };
}

function buildAutofill({ hardware, storage, sysctl }) {
  const suggestions = {};
  const memoryBytes = firstNumber(/Memory:\s*([0-9.]+)\s*GB/i, hardware, 1_000_000_000) || firstNumber(/hw\.memsize:\s*([0-9]+)/i, sysctl, 1);
  const hasEfficiency = /Efficiency/i.test(hardware) || /hw\.perflevel1/i.test(sysctl);
  const hasUsbStorage = /Protocol:\s*USB/i.test(storage);

  if (memoryBytes) {
    suggestions.memoryCopyMBps = {
      value: memoryBytes >= 16_000_000_000 ? 25000 : 16000,
      confidence: "assumed",
      reason: "Estimated from detected memory capacity until a RAM benchmark is applied."
    };
  }

  if (hasEfficiency) {
    suggestions.cpuCoreClass = {
      value: "unknown",
      confidence: "measured",
      reason: "Heterogeneous cores detected; keep scheduler placement explicit."
    };
  }

  if (hasUsbStorage) {
    suggestions.preset = {
      value: "usb32gen2",
      confidence: "measured",
      reason: "External USB storage detected in the OS storage report."
    };
  }

  return suggestions;
}

function firstText(pattern, text) {
  const match = text.match(pattern);
  return match?.[1]?.trim() || null;
}

function firstNumber(pattern, text, multiplier) {
  const match = text.match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value * multiplier : null;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  probeHardware()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
