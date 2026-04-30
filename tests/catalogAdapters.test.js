import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDeviceLookup,
  buildWikidataQuery,
  flattenDeviceVendors,
  normalizeWikidataResults,
  parsePciIds,
  parseUsbIds,
  summarizeGeneratedCatalog
} from "../src/catalogAdapters.js";

test("parses filtered PCI IDs into Firefly device records", () => {
  const vendors = parsePciIds(`
# comment
10de  NVIDIA Corporation
\t2684  AD102 GeForce RTX 4090
\t2704  AD103 GeForce RTX 4080 SUPER
1234  Ignored Vendor
\t1111  Ignored Device
144d  Samsung Electronics Co Ltd
\ta80d  NVMe SSD Controller PM9A3/990 PRO class
`);

  const devices = flattenDeviceVendors(vendors);
  const lookup = buildDeviceLookup(devices);

  assert.equal(lookup["10de:2684"].vendor, "NVIDIA Corporation");
  assert.match(lookup["144d:a80d"].name, /990 PRO/);
  assert.equal(lookup["1234:1111"], undefined);
});

test("parses filtered USB IDs into external path records", () => {
  const vendors = parseUsbIds(`
04e8  Samsung Electronics Co., Ltd
\t4001  Portable SSD T7
0bda  Realtek Semiconductor Corp.
\t8156  RTL8156 2.5GbE Adapter
9999  Test Vendor
\t0001  Ignored Device
`);

  const devices = flattenDeviceVendors(vendors);

  assert.ok(devices.some((device) => device.name.includes("Portable SSD")));
  assert.ok(devices.some((device) => device.name.includes("2.5GbE")));
  assert.equal(devices.some((device) => device.vendorId === "9999"), false);
});

test("builds a bounded Wikidata SPARQL query and normalizes results", () => {
  const query = buildWikidataQuery(["GeForce RTX 4090"]);
  assert.match(query, /EntitySearch/);
  assert.match(query, /GeForce RTX 4090/);

  const rows = normalizeWikidataResults({
    results: {
      bindings: [
        {
          item: { value: "https://www.wikidata.org/entity/Q115269086" },
          itemLabel: { value: "GeForce RTX 4090" },
          manufacturerLabel: { value: "Nvidia" },
          inception: { value: "2022-10-12T00:00:00Z" }
        }
      ]
    }
  });

  assert.deepEqual(rows[0], {
    id: "Q115269086",
    label: "GeForce RTX 4090",
    manufacturer: "Nvidia",
    inception: "2022-10-12",
    sourceId: "wikidata-sparql",
    url: "https://www.wikidata.org/entity/Q115269086"
  });
});

test("summarizes a generated catalog for UI and API surfaces", () => {
  const summary = summarizeGeneratedCatalog({
    mode: "test",
    generatedAt: "2026-04-30T00:00:00.000Z",
    sources: [{ id: "pci-ids" }, { id: "usb-ids" }],
    pciDevices: [{ vendorId: "10de", deviceId: "2684" }],
    usbDevices: [{ vendorId: "04e8", deviceId: "4001" }],
    wikidataComponents: [{ id: "Q115269086" }]
  });

  assert.equal(summary.sourceCount, 2);
  assert.equal(summary.deviceIdCount, 2);
  assert.equal(summary.wikidataCount, 1);
});
