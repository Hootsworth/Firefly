# Firefly

Firefly is a deterministic performance diagnostics app for understanding how a computer should behave.

It answers one core question:

> Given this machine, this topology, and this operation, how long should it take, how long did it actually take, and where did the missing time go?

Firefly is not trying to be another synthetic benchmark. It is a systems reasoning tool. Instead of only saying that a disk, cable, CPU, GPU, bus, or network path is "fast" or "slow", Firefly builds an expected-time model, compares it against observed runtime, and explains the delta across the actual data path.

## Why Firefly Exists

Most performance tools measure one component in isolation. Real machines do not fail in isolation.

A file transfer, render pipeline, copy job, network write, or storage operation may move through:

- source storage
- destination storage
- PCIe lanes
- USB or Thunderbolt links
- chipset bridges
- DMI/PCH paths
- memory copies
- CPU scheduling
- GPU transforms
- network links
- filesystem metadata
- queues, thermals, cache behavior, and OS noise

Firefly models that pipeline before judging the result. The goal is not just to produce a score. The goal is to explain whether the machine is performing the way its hardware, topology, and workload imply it should.

## Current Release

Firefly `1.0.0` is a local-first engineering preview with production-oriented packaging, tests, and documentation.

Implemented today:

- deterministic expected-time model
- observed-vs-modeled delta analysis
- plain-language diagnosis cards
- benchmark engine
- hardware probe adapters
- comparison mode
- visual system designer
- sourced hardware constants catalog
- PDF report export
- Tauri desktop app packaging
- Windows build workflow
- native helper command surface
- signed-helper manifest boundary
- visual regression test workflow

Firefly is still intentionally conservative around privileged hardware access. It does not silently install kernel drivers, services, or root helpers. Deeper counters are exposed through a signed-helper architecture that is ready for future platform-specific signed installers.

## Core Features

### Deterministic Expected-Time Modeling

Firefly estimates expected time, `t`, from service-rate ceilings and workload facts, then compares it against observed time, `t'`.

The model accounts for:

- logical file size
- compression ratio
- source read throughput
- destination write throughput
- port and protocol ceilings
- PCIe generation and active lane count
- bus and bridge bandwidth
- memory copy bandwidth
- CPU transform rate
- optional GPU transform rate
- topology penalties
- queue depth
- concurrent jobs
- packet loss
- OS overhead
- thermal throttling
- architecture penalties

The output includes:

- expected time
- observed time
- delta
- effective throughput
- primary bottleneck
- warning ledger
- confidence notes
- stage-by-stage model breakdown

### Diagnosis Mode

Diagnosis mode is built for the practical question users actually ask:

> Why is this slow?

Firefly translates the model into direct explanations such as:

- the negotiated PCIe link is below the component's maximum
- the storage write path is below the bus ceiling
- the chipset bridge is shared and saturated
- thermal conditions explain most of the delta
- packet loss or OS overhead widened the expected range
- the observed result is faster than the modeled path, so the assumptions are probably conservative or cache-assisted

The app shows the human-readable diagnosis first, then the detailed ledger for users who want to inspect the reasoning.

### Comparison Mode

Comparison mode answers:

> Did this change actually help?

It is designed for before/after analysis after:

- driver updates
- BIOS changes
- firmware updates
- cable swaps
- port changes
- lane-state changes
- cooling changes
- topology changes
- storage upgrades
- network changes

Capture a before state, make the change, capture an after state, and Firefly compares:

- modeled expected time
- observed time
- effective rate
- bottleneck movement
- stage-level changes
- whether the change improved the actual ceiling or only reduced noise
- whether a new bottleneck appeared downstream

This makes comparison mode useful for upgrade validation and debugging regressions.

### Visual System Designer

The system designer lets users build a theoretical machine from named components and estimate what that system should be capable of before benchmarking anything.

The catalog includes modeling entries for:

- Apple Silicon, Intel Core/Core Ultra/Xeon, AMD Ryzen/Threadripper/EPYC
- NVIDIA, AMD, Intel, and Apple GPU paths
- DDR4, DDR5, LPDDR5X, workstation, and server memory configurations
- SATA, PCIe 3.0, PCIe 4.0, PCIe 5.0, and external USB storage
- 1 GbE through 400 GbE network paths
- Wi-Fi 6E and Wi-Fi 7 scenarios
- CPU-direct, chipset, Intel DMI, AMD chipset, PCIe switch, Thunderbolt dock, and USB hub topologies

The designer produces:

- expected transfer score
- expected effective rate
- bottleneck prediction
- topology notes
- provenance labels for selected parts
- configuration warnings

This is useful for PC builders, workstation planning, infrastructure reasoning, and "should this upgrade matter?" analysis.

### Larger Sourced Hardware Constants Database

Firefly now includes a larger local constants database for protocol ceilings, component classes, and real-world modeling presets.

The database includes:

- PCIe generation and lane-rate ceilings with encoding overhead
- Ethernet line-rate conversions
- USB and Thunderbolt-style external path ceilings
- DMI/chipset bridge ceilings
- named CPU, GPU, storage, memory, network, and topology presets
- generated PCI device ID matches for GPUs, NVMe controllers, NICs, and chipset devices
- generated USB device ID matches for external SSD bridges, USB NICs, docks, and adapters
- Wikidata metadata links for selected public component entities
- source/provenance metadata exposed in the UI

The catalog distinguishes between:

- official specification constants
- vendor-published product figures
- PCI/USB device identification snapshots
- broad structured metadata
- calibrated modeling assumptions
- conservative local heuristics

These values are modeling constants, not universal benchmark promises. Real performance depends on firmware, drivers, thermals, power state, filesystem, queue depth, cable quality, topology, and workload shape.

Firefly includes a catalog updater:

```bash
npm run catalog:update
```

The updater pulls the PCI ID Repository, USB ID Repository, and Wikidata SPARQL metadata, filters them into a compact Firefly catalog, and writes:

```text
src/hardwareCatalog.generated.js
```

For deterministic local development without network access:

```bash
npm run catalog:update:offline
```

The generated catalog is also available from the local server:

```text
GET /api/catalog
```

Representative sources embedded in the catalog include:

- PCI-SIG PCI Express specifications: https://pcisig.com/pci-express-6.0-specification
- Intel product specifications: https://www.intel.com/content/www/us/en/products/sku/236773/intel-core-i9-processor-14900k-36m-cache-up-to-6-00-ghz.html
- AMD EPYC product specifications: https://www.amd.com/en/products/processors/server/epyc/4th-generation-9004-and-8004-series/amd-epyc-9654.html
- NVIDIA GeForce specifications: https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4090/
- Samsung NVMe SSD specifications: https://www.samsung.com/us/memory-storage/nvme-ssd/990-pro-2tb-nvme-pcie-gen-4-mz-v9p2t0b-am/
- USB4 specification overview: https://www.usb.org/usb4
- IEEE 802.3 Ethernet standard: https://standards.ieee.org/standard/802_3-2022.html
- PCI ID Repository: https://pci-ids.ucw.cz/
- USB ID Repository: https://www.linux-usb.org/usb-ids.html
- Wikidata SPARQL: https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service

### Benchmark Engine

Firefly includes bounded local benchmark probes that can feed measured values back into the model.

Implemented benchmark plans:

- Pure RAM micro-benchmark
- Burst I/O write benchmark
- Read I/O benchmark
- Sustained write probe
- Tiny-file queue pressure test
- Guided DMI/PCH bottleneck test

The benchmarks are intentionally bounded. They use temporary files where needed and avoid destructive or unbounded stress patterns.

The benchmark engine is designed to isolate different layers:

- RAM copy behavior
- storage read ceilings
- burst write behavior
- sustained write behavior
- queue behavior with many small files
- topology-specific chipset bottlenecks

### Hardware Probe

Firefly can collect best-effort hardware facts from the host system.

Probe adapters use:

- macOS: `system_profiler`, `sysctl`, `uptime`
- Linux: `/proc`, `lsblk`, `lspci`, `ip`, load and memory files
- Windows: PowerShell CIM/WMI

Probe output is redacted before display. Firefly removes stable identifiers such as serial numbers, UUIDs, MAC addresses, IP addresses, and network signatures.

Current probe status:

- low-level hardware polling: implemented as best-effort user-space adapters
- topology mapping: implemented for modeled CPU-attached, chipset-attached, DMI/PCH, PCIe switch, dock, and hub paths
- exact motherboard routing: still depends on OS-exposed PCI trees and board metadata
- deep bus counters: gated behind future signed helpers

### Native Helper Layer

The Tauri desktop app includes a Rust native command surface.

Implemented today:

- native helper status command
- signed-helper manifest
- safe user-space counter snapshot
- process elevation detection
- best-effort load hints
- best-effort memory pressure hints
- explicit blocked-counter reporting
- platform-specific signing requirements in the helper manifest

Firefly deliberately separates safe user-space probes from privileged counters. Direct memory-controller counters, detailed bus telemetry, ETW providers, `powermetrics`, `perf`, vendor tools, and kernel-level driver access require explicit user consent and platform-specific signing.

Future signed helpers should be installable, auditable, removable, and code-signed.

### PDF Report Export

Firefly can export a local PDF report for a scenario.

Reports include:

- expected time
- observed time
- delta
- effective throughput
- bottleneck summary
- warnings
- confidence notes
- selected model inputs

The report is generated locally in the browser. No cloud service is required.

### Visual Regression Tests

Firefly includes Playwright visual coverage for:

- notes/product page
- app designer flow
- comparison mode
- desktop Chromium
- mobile Chromium

Local visual tests use committed screenshot baselines.

CI visual checks run in a smoke mode that validates layout visibility, dimensions, and real screenshot capture output. This keeps GitHub Actions stable across host rendering differences while preserving strict baseline testing for local review.

## App Surfaces

Firefly is split into two main surfaces:

- `index.html`: product explanation, design language, and conceptual overview
- `app.html`: actual diagnostics app, system designer, benchmark engine, probe, model, comparison mode, and PDF export

The app is organized around three jobs:

- **Diagnose**: understand why a real or modeled operation is slow
- **Compare**: understand whether a change helped or moved the bottleneck
- **Design**: build a hypothetical machine and estimate what it should be capable of

## Safety And Privacy

Firefly is local-first.

- No account is required.
- No cloud service is required for modeling.
- Probe output stays local.
- Raw hardware summaries are redacted before display.
- Benchmark files are temporary and bounded.
- No privileged helper is installed by default.
- No kernel driver is installed by default.
- Native helper boundaries are explicit.
- Deep counters require future signed helpers and user consent.

## Requirements

For the web app:

- Node.js 22 or newer
- npm

For desktop builds:

- Rust stable toolchain
- Tauri system prerequisites for the target OS

For visual tests:

- Playwright Chromium

Windows desktop packages should be built on Windows or through the included GitHub Actions workflow.

## Install

```bash
npm install
```

## Quick Start

```bash
npm install
npm start
```

Then open:

```text
http://127.0.0.1:4173/app.html
```

Use the app in this order for the clearest first run:

1. Open **Design** to create or choose a machine profile.
2. Run a safe benchmark probe if you want measured local values.
3. Apply the benchmark result to the model.
4. Enter the observed runtime for the operation.
5. Read the diagnosis and export a PDF report if needed.
6. Capture a before/after comparison when testing a change.

## Run The Web App

```bash
npm start
```

Open:

```text
http://127.0.0.1:4173/app.html
```

## Run The Hardware Probe

```bash
npm run probe
```

The probe prints a redacted local hardware summary. In the web app and desktop app, the probe surface is available from the diagnostics page.

## Run Tests

Run unit and model tests:

```bash
npm test
```

Run visual regression tests:

```bash
npm run test:visual
```

Run CI-style visual smoke checks locally:

```bash
FIREFLY_VISUAL_MODE=smoke npm run test:visual
```

The test suite covers:

- deterministic model behavior
- edge-case handling
- theoretical maximum calculations
- benchmark definitions and runners
- comparison mode
- PDF report generation
- hardware probe redaction
- catalog adapter parsing
- generated PCI/USB device resolution
- system designer catalog
- source/provenance handling
- visual layout regressions

## Build Web Assets

```bash
npm run build:web
```

This creates `dist/`, which is used by the Tauri app. The directory is generated and intentionally ignored by git.

## Desktop App

Run the desktop app in development mode:

```bash
npm run desktop:dev
```

Build the desktop app for the current platform:

```bash
npm run desktop:build
```

On macOS, bundles are written under:

```text
src-tauri/target/release/bundle/
```

## Windows Build

Build on a Windows machine:

```powershell
npm ci
npm run desktop:build:windows
```

Expected outputs:

```text
src-tauri\target\release\bundle\
src-tauri\target\release\firefly.exe
```

Depending on the available Tauri bundlers, the output may include an NSIS installer, MSI installer, and/or raw executable.

### GitHub Actions Windows Build

The repository includes a Windows packaging workflow:

```text
.github/workflows/desktop-build.yml
```

It runs on `windows-latest`, installs Node and Rust, runs unit tests, builds the Tauri Windows package, and uploads the `firefly-windows` artifact.

The repository also includes a visual workflow:

```text
.github/workflows/visual-regression.yml
```

It installs Playwright Chromium, runs CI visual checks, and uploads visual reports on failure.

## Repository Layout

```text
.
├── app.html
├── index.html
├── server.js
├── assets/
│   └── firefly-logo.png
├── scripts/
│   ├── build-web-assets.js
│   └── make-windows-icon.js
├── src/
│   ├── app.js
│   ├── benchmarkEngine.js
│   ├── capabilities.js
│   ├── comparison.js
│   ├── hardwareProbe.js
│   ├── historyStore.js
│   ├── model.js
│   ├── pdfReport.js
│   ├── productClarity.js
│   ├── styles.css
│   ├── systemDesigner.js
│   └── theoreticalMax.js
├── src-tauri/
│   ├── icons/
│   ├── src/
│   │   ├── lib.rs
│   │   ├── main.rs
│   │   └── native_helpers.rs
│   └── tauri.conf.json
├── tests/
│   ├── visual/
│   └── *.test.js
└── .github/workflows/
```

## Design Direction

Firefly uses a brutalist-editorial interface language:

- warm paper backgrounds
- black ink hierarchy
- restrained orange/red accents
- fixed vertical navigation
- large display typography
- thin structural borders
- dark inverse bands
- grain texture
- lateral hover motion
- responsive single-column layouts on mobile

The design goal is to make dense systems reasoning feel readable, tactile, and calm instead of dashboard-noisy.

## Known Limits

Firefly is powerful, but it should be read as a reasoning engine rather than an omniscient hardware oracle.

Current limits:

- exact motherboard lane routing may require board-specific metadata
- vendor SSD cache behavior can vary by firmware and fill state
- thermal behavior depends on cooling, ambient temperature, chassis, and fan curves
- OS scheduling can move work between heterogeneous cores
- filesystem cache can make observed runs appear faster than the physical path
- antivirus, indexing, and background services can affect results
- deep bus counters require signed privileged helpers
- public installer distribution requires code signing and notarization

The model is deliberately transparent so users can see which inputs were measured, probed, sourced, derived, or assumed.

## Future Updates

Planned future work:

- installable signed native helpers for macOS, Windows, and Linux
- macOS notarization and Windows code signing for public installer distribution
- ETW and Performance Counter collection on Windows
- `powermetrics`, IOKit, and storage/controller telemetry on macOS
- `perf`, `nvme-cli`, `lspci -vv`, and `/sys` topology counters on Linux
- versioned update channel for the hardware constants database
- richer live catalog adapters for vendor spec sheets and release feeds
- saved projects and historical machine baselines
- import/export for comparison snapshots
- repeat-run statistics with medians, variance, and outlier detection
- confidence scoring that separates measured, probed, sourced, derived, and assumed inputs
- fix suggestions tied to each bottleneck
- beginner presets such as "external drive is slow", "network copy is slow", and "upgrade check"
- richer PDF reports with charts and comparison history
- visual regression coverage for PDF output and packaged desktop shells
- GitHub Release automation for signed desktop artifacts

## License

Apache-2.0
