//! In-app article reader.
//!
//! Opens the source article in a separate Tauri window instead of handing it to
//! the system browser. The reader window is a plain remote webview with no IPC
//! access to the app, so a hostile page cannot reach Terrafeed's commands.

use std::sync::atomic::{AtomicUsize, Ordering};

use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};
use url::Url;

static COUNTER: AtomicUsize = AtomicUsize::new(0);

#[tauri::command]
pub async fn open_reader(app: AppHandle, url: String, title: Option<String>) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|e| format!("invalid url: {e}"))?;
    if !matches!(parsed.scheme(), "https" | "http") {
        return Err(format!("blocked scheme: {}", parsed.scheme()));
    }

    let label = format!("reader-{}", COUNTER.fetch_add(1, Ordering::Relaxed));
    let heading = title
        .filter(|value| !value.trim().is_empty())
        .map(|value| {
            let trimmed: String = value.chars().take(90).collect();
            format!("{trimmed} — Terrafeed")
        })
        .unwrap_or_else(|| "Terrafeed reader".to_string());

    WebviewWindowBuilder::new(&app, label, WebviewUrl::External(parsed))
        .title(heading)
        .inner_size(1180.0, 860.0)
        .min_inner_size(520.0, 420.0)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}
