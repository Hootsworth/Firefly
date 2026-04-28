# Firefly

Firefly is a deterministic system-path diagnostics app for answering one question:

> How long should this operation take on this machine, and where did the missing time go?

It models expected process time (`t`), compares it with observed time (`t'`), and explains the delta across storage, bus, memory, CPU, GPU, network, topology, queueing, and thermal constraints. It is not trying to be another synthetic benchmark. It is a reasoning tool for understanding whether a machine is behaving the way its parts and topology imply it should.

## What Firefly Does

- Builds an expected-time model from explicit service-rate ceilings.
- Compares modeled time with observed runtime.
- Ranks the most likely constraints instead of blaming one component blindly.
- Handles edge cases such as SLC cache exhaustion, active PCIe lane bifurcation, PCH/DMI contention, thermal throttling, packet loss, queue depth, compression, flex-mode RAM, and heterogeneous CPU cores.
- Includes safe local benchmark probes for RAM, read I/O, burst writes, sustained writes, and tiny-file queue pressure.
- Includes best-effort hardware probes using OS APIs.
- Lets you design a theoretical machine from named real-world components and see what it should be capable of.
- Lets you compare before/after states for driver updates, cable swaps, BIOS changes, firmware changes, or tuning passes.
- Packages as a Tauri desktop app.

## Current Status

Firefly is an early engineering preview. The deterministic model, browser app, benchmark runners, comparison mode, system designer, PDF export, local macOS bundle, and Windows build workflow are implemented. Deep privileged counters are scaffolded but not installed, because production-grade native helpers require signed binaries, explicit user consent, and OS-specific privilege flows.

## Screens

- `index.html`: explanation and product notes.
- `app.html`: system designer, benchmark engine, hardware probe, scenario model, diagnosis, comparison mode, and PDF report export.

## Requirements

For the web app:

- Node.js 22 or newer
- npm

For desktop builds:

- Rust stable toolchain
- Tauri system prerequisites for your OS
- Windows builds should be produced on Windows or through the included GitHub Actions workflow

## Install

```bash
npm install
```

## Run The Local Web App

```bash
npm start
```

Open:

```text
http://127.0.0.1:4173/app.html
```

## Run Tests

```bash
npm test
```

The test suite covers the deterministic model, benchmark definitions/runners, edge cases, comparison mode, PDF generation, hardware redaction, and the system designer catalog.

## Build Web Assets

```bash
npm run build:web
```

This creates `dist/`, which is used by the Tauri bundle. The directory is generated and intentionally ignored by git.

## Desktop App

Run the desktop app in development mode:

```bash
npm run desktop:dev
```

Build the desktop app for the current platform:

```bash
npm run desktop:build
```

On macOS, the bundle is written under:

```text
src-tauri/target/release/bundle/
```

## Windows Build

Build on a Windows machine:

```powershell
npm ci
npm run desktop:build:windows
```

Expected outputs are written under:

```text
src-tauri\target\release\bundle\
```

Depending on the Tauri bundlers available on the machine, this may include an NSIS `.exe`, MSI `.msi`, and/or the raw `firefly.exe`.

### GitHub Actions Windows Build

This repository includes a production workflow:

```text
.github/workflows/desktop-build.yml
```

It runs on `windows-latest`, installs Node and Rust, runs tests, builds the Tauri Windows package, and uploads the Windows artifacts.

After pushing to GitHub, open the repository's **Actions** tab and run **Desktop builds** manually, or push to `main` to trigger it automatically.

Cross-compiling Windows from macOS is not the recommended path. It needs extra Windows resource tooling such as `llvm-rc`; the workflow avoids that by using a Windows runner.

## Hardware Probe

Run a local probe:

```bash
npm run probe
```

Probe adapters are intentionally best-effort:

- macOS: `system_profiler`, `sysctl`, and `uptime`
- Linux: `/proc`, `lsblk`, `lspci`, `ip`, and load/memory files
- Windows: PowerShell CIM/WMI

Firefly redacts stable identifiers such as serials, UUIDs, MAC addresses, IP addresses, and network signatures before displaying raw probe summaries.

## Benchmark Engine

Implemented benchmark plans:

- Pure RAM micro-benchmark
- Burst I/O write benchmark
- Read I/O benchmark
- Sustained write probe
- Tiny-file sustained queue test
- Guided DMI/PCH bottleneck test

Benchmarks are bounded and use temporary files where needed. Results can be applied to the scenario model to replace assumptions with measured service rates.

## System Designer

The system designer includes named, real-world component classes:

- Apple Silicon, Intel Core/Core Ultra/Xeon, AMD Ryzen/Threadripper/EPYC
- NVIDIA, AMD, Intel, and Apple GPU stages
- DDR4, DDR5, LPDDR5X, workstation, and server memory configurations
- SATA, PCIe 3.0, PCIe 4.0, PCIe 5.0, and external USB SSDs
- 1 GbE, 2.5 GbE, 10 GbE, 25 GbE, 40 GbE, 100 GbE, USB Ethernet, and Wi-Fi scenarios
- CPU-direct, Intel DMI, AMD chipset, Thunderbolt dock, and USB hub topologies

The numbers are modeling constants, not universal benchmark guarantees. Real machines vary by firmware, cooling, filesystem, power state, driver, cable, queue depth, and workload.

## Comparison Mode

Use comparison mode to answer questions like:

- Did the new driver actually help?
- Did the cable swap fix the bottleneck?
- Did the BIOS change improve the modeled path or just change observed noise?
- Did the primary bottleneck move somewhere else?

Capture a before scenario, adjust the model or benchmark results, capture after, and Firefly reports expected-time change, observed-time change, rate change, and bottleneck movement.

## Model Notes

Firefly calculates transfer volume from logical file size and compression ratio, then builds a stage stack:

- source storage read
- destination write
- port and protocol
- PCIe or internal bus
- memory copy
- CPU transform
- optional GPU transform
- optional shared DMI/PCH bridge

The expected throughput is the slowest effective stage adjusted by queue depth, concurrency, packet loss, OS overhead, architecture penalty, and thermal throttling. The app reports an uncertainty band because real systems include noise from caches, interrupt coalescing, antivirus scans, filesystem metadata, power states, scheduler placement, and measurement granularity.

## Privileged Native Helpers

The Tauri app includes a Rust command surface for native helper status and future privileged counter plans. The current helper reports what is available and what still requires elevation.

Planned helper directions:

- macOS: signed helper for `powermetrics`, `ioreg`, storage/controller telemetry
- Windows: service-backed ETW and Performance Counter collector with WMI fallback
- Linux: polkit-gated helper for `perf`, `nvme-cli`, `lspci -vv`, and `/sys` topology counters

These helpers should not be silently installed. They require explicit user consent and platform-specific signing/review.

## Repository Layout

```text
.
├── app.html
├── index.html
├── server.js
├── src/
│   ├── app.js
│   ├── benchmarkEngine.js
│   ├── comparison.js
│   ├── hardwareProbe.js
│   ├── model.js
│   ├── pdfReport.js
│   ├── styles.css
│   └── systemDesigner.js
├── src-tauri/
│   ├── src/
│   ├── icons/
│   └── tauri.conf.json
├── scripts/
├── tests/
└── .github/workflows/
```

## Safety And Privacy

- Probe output is local.
- Raw hardware summaries are redacted before display.
- Benchmark files are temporary and bounded.
- No privileged helper is installed by default.
- No cloud service is required for the model.

## License

MIT
