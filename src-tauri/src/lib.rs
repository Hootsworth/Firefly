mod native_helpers;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            native_helpers::native_helper_status,
            native_helpers::privileged_counter_plan
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Firefly desktop shell");
}
