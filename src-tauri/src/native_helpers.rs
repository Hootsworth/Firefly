use serde::Serialize;
use std::process::Command;

const HELPER_API_VERSION: &str = "1.0.0";

#[derive(Serialize)]
pub struct NativeHelperStatus {
    available: bool,
    requires_elevation: bool,
    installed_helper_version: Option<String>,
    supported_counters: Vec<&'static str>,
    blocked_counters: Vec<&'static str>,
    note: &'static str,
}

#[derive(Serialize)]
pub struct NativeHelperManifest {
    api_version: &'static str,
    platform: &'static str,
    signed_helper_required: bool,
    install_state: &'static str,
    consent_required: bool,
    safe_commands: Vec<&'static str>,
    privileged_commands: Vec<&'static str>,
    signing_requirements: Vec<&'static str>,
}

#[derive(Serialize)]
pub struct NativeCounterSnapshot {
    api_version: &'static str,
    platform: &'static str,
    elevated: bool,
    counters: Vec<CounterReading>,
    blocked: Vec<&'static str>,
    warnings: Vec<String>,
}

#[derive(Serialize)]
pub struct CounterReading {
    name: &'static str,
    value: String,
    unit: &'static str,
    confidence: &'static str,
    source: &'static str,
}

#[tauri::command]
pub fn native_helper_status() -> NativeHelperStatus {
    NativeHelperStatus {
        available: true,
        requires_elevation: true,
        installed_helper_version: Some(HELPER_API_VERSION.to_string()),
        supported_counters: vec![
            "OS hardware inventory",
            "safe user-space benchmarks",
            "model-side topology and queue inference",
            "best-effort CPU load and memory pressure snapshot",
            "best-effort process elevation state",
        ],
        blocked_counters: vec![
            "memory-controller queue occupancy",
            "per-root-port PCIe counters",
            "NVMe controller thermal throttle flags",
            "driver-level retransmit and DMA counters",
        ],
        note: "Firefly exposes safe user-space counters now. Deeper counters require the signed helper manifest and explicit elevation.",
    }
}

#[tauri::command]
pub fn privileged_counter_plan() -> Vec<&'static str> {
    vec![
        "macOS: signed helper tool for powermetrics, ioreg, and storage/controller telemetry.",
        "Windows: service-backed ETW/Performance Counter collector with WMI fallback.",
        "Linux: polkit-gated helper for perf, nvme-cli, lspci -vv, and /sys topology counters.",
        "All platforms: redact stable identifiers before returning data to the webview.",
    ]
}

#[tauri::command]
pub fn native_helper_manifest() -> NativeHelperManifest {
    NativeHelperManifest {
        api_version: HELPER_API_VERSION,
        platform: std::env::consts::OS,
        signed_helper_required: true,
        install_state: "not-installed",
        consent_required: true,
        safe_commands: vec![
            "native_helper_status",
            "native_helper_manifest",
            "native_counter_snapshot",
        ],
        privileged_commands: vec![
            "memory_controller_queue_depth",
            "pcie_root_port_replay_counters",
            "nvme_controller_thermal_throttle_flags",
            "driver_dma_and_retransmit_counters",
        ],
        signing_requirements: signing_requirements(),
    }
}

#[tauri::command]
pub fn native_counter_snapshot() -> NativeCounterSnapshot {
    let mut warnings = Vec::new();
    let mut counters = Vec::new();

    counters.push(CounterReading {
        name: "process_elevated",
        value: process_is_elevated().to_string(),
        unit: "boolean",
        confidence: "derived",
        source: "platform privilege probe",
    });

    match load_average() {
        Ok(value) => counters.push(CounterReading {
            name: "system_load_average_1m",
            value,
            unit: "load",
            confidence: "best-effort",
            source: load_source(),
        }),
        Err(error) => warnings.push(error),
    }

    match memory_pressure() {
        Ok(value) => counters.push(CounterReading {
            name: "memory_pressure",
            value,
            unit: "summary",
            confidence: "best-effort",
            source: memory_source(),
        }),
        Err(error) => warnings.push(error),
    }

    NativeCounterSnapshot {
        api_version: HELPER_API_VERSION,
        platform: std::env::consts::OS,
        elevated: process_is_elevated(),
        counters,
        blocked: vec![
            "memory-controller queue occupancy needs a signed helper or kernel facility",
            "PCIe replay/error counters need elevated root-port access",
            "NVMe throttle flags need vendor/admin telemetry access",
            "ETW/perf/powermetrics streams need explicit OS permission",
        ],
        warnings,
    }
}

fn signing_requirements() -> Vec<&'static str> {
    match std::env::consts::OS {
        "macos" => vec![
            "Developer ID Application certificate",
            "SMAppService or launchd helper with explicit user approval",
            "notarization before public distribution",
        ],
        "windows" => vec![
            "Authenticode code-signing certificate",
            "Windows service install with UAC consent",
            "ETW provider access declared in service documentation",
        ],
        "linux" => vec![
            "packaged polkit policy",
            "root-owned helper binary",
            "distribution-specific package signing",
        ],
        _ => vec!["platform-specific signing and elevation review"],
    }
}

fn load_average() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        command_output(
            "powershell",
            &[
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average",
            ],
        )
    }

    #[cfg(not(target_os = "windows"))]
    {
        command_output(
            "sh",
            &[
                "-c",
                "uptime | sed 's/.*load averages*: //' | awk -F, '{print $1}'",
            ],
        )
    }
}

fn memory_pressure() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        command_output("sh", &["-c", "vm_stat | head -n 8 | tr '\\n' ';'"])
    }

    #[cfg(target_os = "linux")]
    {
        command_output(
            "sh",
            &[
                "-c",
                "grep -E 'MemTotal|MemAvailable|SwapTotal|SwapFree' /proc/meminfo | tr '\\n' ';'",
            ],
        )
    }

    #[cfg(target_os = "windows")]
    {
        command_output(
            "powershell",
            &[
                "-NoProfile",
                "-Command",
                "$m=Get-CimInstance Win32_OperatingSystem; 'FreePhysicalMemoryKB=' + $m.FreePhysicalMemory + ';TotalVisibleMemoryKB=' + $m.TotalVisibleMemorySize",
            ],
        )
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        Err("memory pressure probe is not implemented for this platform".to_string())
    }
}

fn load_source() -> &'static str {
    if cfg!(target_os = "windows") {
        "Win32_Processor LoadPercentage"
    } else {
        "uptime"
    }
}

fn memory_source() -> &'static str {
    if cfg!(target_os = "macos") {
        "vm_stat"
    } else if cfg!(target_os = "linux") {
        "/proc/meminfo"
    } else if cfg!(target_os = "windows") {
        "Win32_OperatingSystem"
    } else {
        "unsupported"
    }
}

fn command_output(program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(|error| format!("failed to run {program}: {error}"))?;
    if !output.status.success() {
        return Err(format!("{program} exited with status {}", output.status));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn process_is_elevated() -> bool {
    #[cfg(target_os = "windows")]
    {
        command_output(
            "powershell",
            &[
                "-NoProfile",
                "-Command",
                "([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)",
            ],
        )
        .map(|value| value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
    }

    #[cfg(not(target_os = "windows"))]
    {
        command_output("id", &["-u"])
            .map(|value| value.trim() == "0")
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_declares_privileged_boundary() {
        let manifest = native_helper_manifest();
        assert!(manifest.signed_helper_required);
        assert!(manifest.consent_required);
        assert!(manifest
            .privileged_commands
            .iter()
            .any(|name| name.contains("pcie")));
    }

    #[test]
    fn snapshot_always_reports_privilege_state() {
        let snapshot = native_counter_snapshot();
        assert_eq!(snapshot.api_version, HELPER_API_VERSION);
        assert!(snapshot
            .counters
            .iter()
            .any(|counter| counter.name == "process_elevated"));
        assert!(!snapshot.blocked.is_empty());
    }
}
