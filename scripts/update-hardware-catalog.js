import { writeFile } from "node:fs/promises";
import {
  CATALOG_SOURCE_DEFINITIONS,
  buildWikidataQuery,
  flattenDeviceVendors,
  normalizeWikidataResults,
  parsePciIds,
  parseUsbIds,
  summarizeGeneratedCatalog
} from "../src/catalogAdapters.js";

const outputUrl = new URL("../src/hardwareCatalog.generated.js", import.meta.url);
const args = new Set(process.argv.slice(2));
const offline = args.has("--offline");

const FIREFLY_WIKIDATA_TERMS = [
  "GeForce RTX 4090",
  "GeForce RTX 4080 SUPER",
  "GeForce RTX 4070 SUPER",
  "Radeon RX 7900 XTX",
  "Radeon RX 7800 XT",
  "Intel Arc A770",
  "Samsung 990 PRO",
  "Samsung 980 PRO",
  "Intel Ethernet Controller I226-V",
  "Mellanox ConnectX-6"
];

const CURATED_PCI_DEVICES = [
  { vendorId: "10de", deviceId: "2684", vendor: "NVIDIA Corporation", name: "AD102 GeForce RTX 4090", sourceId: "pci-ids" },
  { vendorId: "10de", deviceId: "2704", vendor: "NVIDIA Corporation", name: "AD103 GeForce RTX 4080 SUPER", sourceId: "pci-ids" },
  { vendorId: "10de", deviceId: "2783", vendor: "NVIDIA Corporation", name: "AD104 GeForce RTX 4070 SUPER", sourceId: "pci-ids" },
  { vendorId: "1002", deviceId: "744c", vendor: "Advanced Micro Devices, Inc. [AMD/ATI]", name: "Navi 31 Radeon RX 7900 XTX", sourceId: "pci-ids" },
  { vendorId: "1002", deviceId: "747e", vendor: "Advanced Micro Devices, Inc. [AMD/ATI]", name: "Navi 32 Radeon RX 7800 XT", sourceId: "pci-ids" },
  { vendorId: "8086", deviceId: "56a0", vendor: "Intel Corporation", name: "DG2 Arc A770 Graphics", sourceId: "pci-ids" },
  { vendorId: "144d", deviceId: "a80c", vendor: "Samsung Electronics Co Ltd", name: "NVMe SSD Controller PM9A1/980 PRO", sourceId: "pci-ids" },
  { vendorId: "144d", deviceId: "a80d", vendor: "Samsung Electronics Co Ltd", name: "NVMe SSD Controller PM9A3/990 PRO class", sourceId: "pci-ids" },
  { vendorId: "15b3", deviceId: "1017", vendor: "Mellanox Technologies", name: "MT27800 Family [ConnectX-5]", sourceId: "pci-ids" },
  { vendorId: "15b3", deviceId: "101b", vendor: "Mellanox Technologies", name: "MT28908 Family [ConnectX-6]", sourceId: "pci-ids" },
  { vendorId: "8086", deviceId: "15f3", vendor: "Intel Corporation", name: "Ethernet Controller I225-V", sourceId: "pci-ids" },
  { vendorId: "8086", deviceId: "125c", vendor: "Intel Corporation", name: "Ethernet Controller I226-V", sourceId: "pci-ids" }
];

const CURATED_USB_DEVICES = [
  { vendorId: "04e8", deviceId: "4001", vendor: "Samsung Electronics Co., Ltd", name: "Portable SSD T7", sourceId: "usb-ids" },
  { vendorId: "1058", deviceId: "25a3", vendor: "Western Digital Technologies, Inc.", name: "Elements / My Passport storage bridge", sourceId: "usb-ids" },
  { vendorId: "0bda", deviceId: "8153", vendor: "Realtek Semiconductor Corp.", name: "RTL8153 Gigabit Ethernet Adapter", sourceId: "usb-ids" },
  { vendorId: "0bda", deviceId: "8156", vendor: "Realtek Semiconductor Corp.", name: "RTL8156 2.5GbE Adapter", sourceId: "usb-ids" },
  { vendorId: "174c", deviceId: "2362", vendor: "ASMedia Technology Inc.", name: "ASM2362 NVMe USB bridge", sourceId: "usb-ids" },
  { vendorId: "152d", deviceId: "0583", vendor: "JMicron Technology Corp.", name: "JMS583 USB 3.1 Gen 2 to PCIe NVMe bridge", sourceId: "usb-ids" }
];

const CURATED_WIKIDATA_COMPONENTS = [
  {
    id: "Q115269086",
    label: "GeForce RTX 4090",
    manufacturer: "Nvidia",
    sourceId: "wikidata-sparql",
    url: "https://www.wikidata.org/wiki/Q115269086"
  },
  {
    id: "Q117188456",
    label: "Samsung 990 Pro",
    manufacturer: "Samsung Electronics",
    sourceId: "wikidata-sparql",
    url: "https://www.wikidata.org/wiki/Q117188456"
  }
];

const catalog = offline ? offlineCatalog() : await liveCatalog();
await writeFile(outputUrl, `export const GENERATED_HARDWARE_CATALOG = ${JSON.stringify(catalog, null, 2)};\n`);

const summary = summarizeGeneratedCatalog(catalog);
console.log(`Wrote ${new URL(outputUrl).pathname}`);
console.log(`Sources: ${summary.sourceCount}`);
console.log(`PCI devices: ${summary.pciDeviceCount}`);
console.log(`USB devices: ${summary.usbDeviceCount}`);
console.log(`Wikidata components: ${summary.wikidataCount}`);

async function liveCatalog() {
  const [pciText, usbText, wikidataComponents] = await Promise.all([
    fetchText(CATALOG_SOURCE_DEFINITIONS.pciIds.url),
    fetchText(CATALOG_SOURCE_DEFINITIONS.usbIds.url),
    fetchWikidata(FIREFLY_WIKIDATA_TERMS)
  ]);

  const pciDevices = mergeDevices(flattenDeviceVendors(parsePciIds(pciText)), CURATED_PCI_DEVICES);
  const usbDevices = mergeDevices(flattenDeviceVendors(parseUsbIds(usbText)), CURATED_USB_DEVICES);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: "live",
    sources: Object.values(CATALOG_SOURCE_DEFINITIONS),
    pciDevices,
    usbDevices,
    wikidataComponents: mergeWikidata(wikidataComponents, CURATED_WIKIDATA_COMPONENTS)
  };
}

function offlineCatalog() {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: "offline",
    sources: Object.values(CATALOG_SOURCE_DEFINITIONS),
    pciDevices: mergeDevices(flattenDeviceVendors(parsePciIds(`
10de  NVIDIA Corporation
\t2684  AD102 GeForce RTX 4090
\t2704  AD103 GeForce RTX 4080 SUPER
\t2783  AD104 GeForce RTX 4070 SUPER
1002  Advanced Micro Devices, Inc. [AMD/ATI]
\t744c  Navi 31 Radeon RX 7900 XTX
\t747e  Navi 32 Radeon RX 7800 XT
8086  Intel Corporation
\t15f3  Ethernet Controller I225-V
\t125c  Ethernet Controller I226-V
144d  Samsung Electronics Co Ltd
\ta80d  NVMe SSD Controller PM9A3/990 PRO class
15b3  Mellanox Technologies
\t101b  MT28908 Family [ConnectX-6]
`)), CURATED_PCI_DEVICES),
    usbDevices: mergeDevices(flattenDeviceVendors(parseUsbIds(`
04e8  Samsung Electronics Co., Ltd
\t4001  Portable SSD T7
0bda  Realtek Semiconductor Corp.
\t8153  RTL8153 Gigabit Ethernet Adapter
\t8156  RTL8156 2.5GbE Adapter
174c  ASMedia Technology Inc.
\t2362  ASM2362 NVMe USB bridge
152d  JMicron Technology Corp.
\t0583  JMS583 USB 3.1 Gen 2 to PCIe NVMe bridge
`)), CURATED_USB_DEVICES),
    wikidataComponents: CURATED_WIKIDATA_COMPONENTS
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "FireflyHardwareCatalog/1.0 (https://github.com/Hootsworth/Firefly)",
      "Accept-Encoding": "gzip"
    }
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  return response.text();
}

async function fetchWikidata(searchTerms) {
  const query = buildWikidataQuery(searchTerms);
  const url = new URL(CATALOG_SOURCE_DEFINITIONS.wikidata.url);
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");

  const response = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "FireflyHardwareCatalog/1.0 (https://github.com/Hootsworth/Firefly)"
    }
  });
  if (!response.ok) throw new Error(`Failed to fetch Wikidata metadata: ${response.status} ${response.statusText}`);
  return normalizeWikidataResults(await response.json());
}

function mergeDevices(primary, curated) {
  const merged = new Map();
  for (const device of [...curated, ...primary]) {
    merged.set(`${device.vendorId}:${device.deviceId}`, device);
  }
  return [...merged.values()].sort((a, b) => a.vendorId.localeCompare(b.vendorId) || a.deviceId.localeCompare(b.deviceId));
}

function mergeWikidata(primary, curated) {
  const merged = new Map();
  for (const item of [...curated, ...primary]) {
    merged.set(item.id, item);
  }
  return [...merged.values()].sort((a, b) => a.label.localeCompare(b.label));
}
