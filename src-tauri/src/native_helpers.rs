use serde::Serialize;

#[derive(Serialize)]
pub struct NativeHelperStatus {
    available: bool,
    requires_elevation: bool,
    installed_helper_version: Option<String>,
    supported_counters: Vec<&'static str>,
    blocked_counters: Vec<&'static str>,
    note: &'static str,
}

#[tauri::command]
pub fn native_helper_status() -> NativeHelperStatus {
    NativeHelperStatus {
        available: false,
        requires_elevation: true,
        installed_helper_version: None,
        supported_counters: vec![
            "OS hardware inventory",
            "safe user-space benchmarks",
            "model-side topology and queue inference",
        ],
        blocked_counters: vec![
            "memory-controller queue occupancy",
            "per-root-port PCIe counters",
            "NVMe controller thermal throttle flags",
            "driver-level retransmit and DMA counters",
        ],
        note: "Privileged helpers are intentionally scaffolded but not installed. Shipping them requires a signed helper, explicit user consent, and per-OS review.",
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
