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
  protocols: {
    "ethernet-1gbe": { label: "1 GbE", MBps: 125, efficiency: 0.94 },
    "ethernet-10gbe": { label: "10 GbE", MBps: 1250, efficiency: 0.94 },
    "usb-3.2-gen2": { label: "USB 3.2 Gen 2", MBps: 1250, efficiency: 0.82 },
    "thunderbolt-4": { label: "Thunderbolt 4", MBps: 5000, efficiency: 0.78 },
    "dmi-4-x8": { label: "Intel DMI 4.0 x8", MBps: pcieMBps(4, 8), efficiency: 1 }
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
