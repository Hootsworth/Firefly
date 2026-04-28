export const PCIE_ENCODING_EFFICIENCY = {
  1: 0.8,
  2: 0.8,
  3: 128 / 130,
  4: 128 / 130,
  5: 128 / 130,
  6: 242 / 256
};

export const PCIE_GT_PER_SECOND = {
  1: 2.5,
  2: 5,
  3: 8,
  4: 16,
  5: 32,
  6: 64
};

export const THEORETICAL_MAXIMUMS = {
  sources: {
    "pcisig-pcie6-faq": {
      label: "PCI-SIG PCIe 6.0 specification",
      url: "https://pcisig.com/pci-express-6.0-specification",
      appliesTo: ["PCIe generation rates", "FLIT mode", "PAM4/FEC overhead"],
      note: "PCI-SIG documents 64.0 GT/s and up to 256.0 GB/s bidirectional bandwidth for PCIe 6.0 x16."
    },
    "ieee-802-ethernet": {
      label: "IEEE 802.3 Ethernet family",
      url: "https://standards.ieee.org/standard/802_3-2022.html",
      appliesTo: ["Ethernet line rates"],
      note: "Line rates are deterministic ceilings before framing, protocol, retransmit, and host overhead."
    }
  },
  protocols: {
    "ethernet-1gbe": { label: "1 GbE", MBps: 125, efficiency: 0.94, sourceIds: ["ieee-802-ethernet"] },
    "ethernet-10gbe": { label: "10 GbE", MBps: 1250, efficiency: 0.94, sourceIds: ["ieee-802-ethernet"] },
    "ethernet-25gbe": { label: "25 GbE", MBps: 3125, efficiency: 0.93, sourceIds: ["ieee-802-ethernet"] },
    "ethernet-40gbe": { label: "40 GbE", MBps: 5000, efficiency: 0.92, sourceIds: ["ieee-802-ethernet"] },
    "ethernet-100gbe": { label: "100 GbE", MBps: 12500, efficiency: 0.91, sourceIds: ["ieee-802-ethernet"] },
    "ethernet-200gbe": { label: "200 GbE", MBps: 25000, efficiency: 0.9, sourceIds: ["ieee-802-ethernet"] },
    "ethernet-400gbe": { label: "400 GbE", MBps: 50000, efficiency: 0.89, sourceIds: ["ieee-802-ethernet"] },
    "usb-3.2-gen2": { label: "USB 3.2 Gen 2", MBps: 1250, efficiency: 0.82 },
    "usb4-40": { label: "USB4 40 Gb/s", MBps: 5000, efficiency: 0.72 },
    "thunderbolt-4": { label: "Thunderbolt 4", MBps: 5000, efficiency: 0.78 },
    "dmi-3-x4": { label: "Intel DMI 3.0 x4", MBps: pcieMBps(3, 4), efficiency: 1, sourceIds: ["pcisig-pcie6-faq"] },
    "dmi-4-x8": { label: "Intel DMI 4.0 x8", MBps: pcieMBps(4, 8), efficiency: 1, sourceIds: ["pcisig-pcie6-faq"] }
  },
  pcie: Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((generation) => [
      `pcie-${generation}`,
      {
        label: `PCIe ${generation}.0`,
        perLaneMBps: pcieMBps(generation, 1),
        encodingEfficiency: PCIE_ENCODING_EFFICIENCY[generation]
      }
    ])
  )
};

export function pcieMBps(generation, lanes) {
  const gt = PCIE_GT_PER_SECOND[generation];
  const efficiency = PCIE_ENCODING_EFFICIENCY[generation];
  if (!gt || !efficiency || lanes <= 0) return 0;
  return gt * 1000 * efficiency * lanes / 8;
}

export function effectivePcieMBps({ generation, activeLanes, maxLanes }) {
  const active = pcieMBps(Number(generation), Number(activeLanes));
  const maximum = pcieMBps(Number(generation), Number(maxLanes || activeLanes));
  return {
    activeMBps: active,
    maxMBps: maximum,
    bifurcated: maximum > 0 && active > 0 && active < maximum
  };
}
