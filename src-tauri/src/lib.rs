//! Terrafeed desktop backend.
//!
//! The webview cannot talk to most public data APIs directly: they either send
//! no CORS headers at all (USGS, Celestrak, Stooq, every RSS feed) or reject the
//! `tauri://localhost` origin. So all outbound HTTP happens here in Rust, behind
//! a host allowlist, and the frontend only ever calls `net_get`.

mod net;
mod reader;
mod settings;

use std::time::Duration;

use once_cell::sync::Lazy;

pub(crate) static HTTP: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent(concat!(
            "Terrafeed/",
            env!("CARGO_PKG_VERSION"),
            " (+https://github.com/Ozbbi/terrafeed)"
        ))
        // The World Bank indicator endpoint regularly takes 20s+; anything
        // shorter turns the country panel into a coin flip.
        .timeout(Duration::from_secs(60))
        .connect_timeout(Duration::from_secs(15))
        .pool_max_idle_per_host(4)
        .build()
        .expect("failed to build HTTP client")
});

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            app_version,
            net::net_get,
            reader::open_reader,
            settings::settings_load,
            settings::settings_save,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Terrafeed");
}
