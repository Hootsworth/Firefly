export const CATALOG_SOURCE_DEFINITIONS = {
  pciIds: {
    id: "pci-ids",
    label: "PCI ID Repository",
    url: "https://pci-ids.ucw.cz/v2.2/pci.ids",
    homepage: "https://pci-ids.ucw.cz/",
    kind: "device-id-map",
    license: "GPL-2.0-or-later OR BSD-3-Clause"
  },
  usbIds: {
    id: "usb-ids",
    label: "USB ID Repository",
    url: "https://linux-usb.sourceforge.net/usb.ids",
    homepage: "https://www.linux-usb.org/usb-ids.html",
    kind: "device-id-map",
    license: "Generated snapshot; see upstream repository terms"
  },
  wikidata: {
    id: "wikidata-sparql",
    label: "Wikidata SPARQL",
    url: "https://query.wikidata.org/sparql",
    homepage: "https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service",
    kind: "structured-metadata",
    license: "CC0 for Wikidata entity data"
  }
};

export const CATALOG_VENDOR_FILTERS = {
  pci: new Set([
    "1002", // AMD/ATI
    "1022", // AMD
    "10de", // NVIDIA
    "12d2", // NVIDIA legacy
    "144d", // Samsung
    "15b3", // Mellanox/NVIDIA Networking
    "1849", // ASRock
    "1987", // Phison
    "1b4b", // Marvell
    "1c5c", // SK hynix
    "1d97", // Shenzhen Longsys/SSD controllers
    "1e0f", // KIOXIA/Toshiba memory/storage entries
    "1e4b", // MAXIO
    "2646", // Kingston
    "8086", // Intel
    "1d0f" // Amazon/Annapurna cloud devices
  ]),
  usb: new Set([
    "04e8", // Samsung
    "0781", // SanDisk
    "0951", // Kingston
    "0bda", // Realtek
    "0bc2", // Seagate
    "1058", // Western Digital
    "125f", // A-DATA
    "13fe", // Phison
    "152d", // JMicron
    "174c", // ASMedia
    "17ef", // Lenovo
    "2109", // VIA Labs
    "2357", // TP-Link
    "2b73" // UGREEN and common USB accessories
  ])
};

const DEFAULT_KEYWORDS = [
  "nvidia",
  "geforce",
  "rtx",
  "quadro",
  "amd",
  "radeon",
  "intel",
  "arc",
  "nvme",
  "ssd",
  "ethernet",
  "mellanox",
  "connectx",
  "samsung",
  "western digital",
  "wd",
  "realtek",
  "thunderbolt",
  "usb4"
];

export function parsePciIds(text, options = {}) {
  return parseIds(text, {
    sourceId: "pci-ids",
    vendorFilter: options.vendorFilter || CATALOG_VENDOR_FILTERS.pci,
    keywords: options.keywords || DEFAULT_KEYWORDS,
    maxDevicesPerVendor: options.maxDevicesPerVendor || 32
  });
}

export function parseUsbIds(text, options = {}) {
  return parseIds(text, {
    sourceId: "usb-ids",
    vendorFilter: options.vendorFilter || CATALOG_VENDOR_FILTERS.usb,
    keywords: options.keywords || DEFAULT_KEYWORDS,
    maxDevicesPerVendor: options.maxDevicesPerVendor || 28
  });
}

function parseIds(text, options) {
  const vendors = [];
  let currentVendor = null;

  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith("#") || rawLine.startsWith("C ") || rawLine.startsWith("\t\t")) continue;

    const vendorMatch = rawLine.match(/^([0-9a-fA-F]{4})\s+(.+)$/);
    if (vendorMatch) {
      const vendorId = vendorMatch[1].toLowerCase();
      currentVendor = {
        vendorId,
        vendor: cleanName(vendorMatch[2]),
        devices: []
      };
      if (options.vendorFilter.has(vendorId)) vendors.push(currentVendor);
      continue;
    }

    const deviceMatch = rawLine.match(/^\t([0-9a-fA-F]{4})\s+(.+)$/);
    if (!deviceMatch || !currentVendor || !options.vendorFilter.has(currentVendor.vendorId)) continue;

    const device = {
      vendorId: currentVendor.vendorId,
      deviceId: deviceMatch[1].toLowerCase(),
      vendor: currentVendor.vendor,
      name: cleanName(deviceMatch[2]),
      sourceId: options.sourceId
    };

    if (currentVendor.devices.length < options.maxDevicesPerVendor || matchesKeywords(device, options.keywords)) {
      currentVendor.devices.push(device);
    }
  }

  return vendors.map((vendor) => ({
    ...vendor,
    devices: rankDevices(vendor.devices, options.keywords).slice(0, options.maxDevicesPerVendor)
  }));
}

export function flattenDeviceVendors(vendors) {
  return vendors.flatMap((vendor) => vendor.devices.map((device) => ({
    ...device,
    vendor: vendor.vendor
  })));
}

export function buildDeviceLookup(devices) {
  return Object.fromEntries(devices.map((device) => [`${device.vendorId}:${device.deviceId}`, device]));
}

export function buildWikidataQuery(searchTerms) {
  const values = searchTerms.map((term) => `"${escapeSparqlString(term)}"`).join(" ");
  return `
SELECT ?item ?itemLabel ?manufacturerLabel ?inception WHERE {
  VALUES ?searchTerm { ${values} }
  SERVICE wikibase:mwapi {
    bd:serviceParam wikibase:endpoint "www.wikidata.org";
      wikibase:api "EntitySearch";
      mwapi:search ?searchTerm;
      mwapi:language "en".
    ?item wikibase:apiOutputItem mwapi:item.
  }
  OPTIONAL { ?item wdt:P176 ?manufacturer. }
  OPTIONAL { ?item wdt:P571 ?inception. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${Math.max(1, searchTerms.length * 4)}
`.trim();
}

export function normalizeWikidataResults(payload) {
  const bindings = payload?.results?.bindings || [];
  return bindings.map((binding) => ({
    id: binding.item?.value?.split("/").pop(),
    label: binding.itemLabel?.value,
    manufacturer: binding.manufacturerLabel?.value,
    inception: binding.inception?.value?.slice(0, 10),
    sourceId: "wikidata-sparql",
    url: binding.item?.value
  })).filter((item) => item.id && item.label);
}

export function summarizeGeneratedCatalog(catalog) {
  const pciDeviceCount = catalog.pciDevices?.length || 0;
  const usbDeviceCount = catalog.usbDevices?.length || 0;
  const wikidataCount = catalog.wikidataComponents?.length || 0;
  return {
    sourceCount: catalog.sources?.length || 0,
    deviceIdCount: pciDeviceCount + usbDeviceCount,
    pciDeviceCount,
    usbDeviceCount,
    wikidataCount,
    generatedAt: catalog.generatedAt,
    mode: catalog.mode || "unknown"
  };
}

function rankDevices(devices, keywords) {
  return [...devices].sort((a, b) => scoreDevice(b, keywords) - scoreDevice(a, keywords) || a.name.localeCompare(b.name));
}

function scoreDevice(device, keywords) {
  const haystack = `${device.vendor} ${device.name}`.toLowerCase();
  return keywords.reduce((score, keyword) => score + (haystack.includes(keyword) ? 1 : 0), 0);
}

function matchesKeywords(device, keywords) {
  return scoreDevice(device, keywords) > 0;
}

function cleanName(value) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeSparqlString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
