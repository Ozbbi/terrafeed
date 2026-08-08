//! Settings persistence: a single JSON blob in the OS app-config directory.
//! The frontend owns the schema; Rust only stores it and mirrors the custom-host
//! list into the network allowlist.

use std::collections::HashSet;
use std::path::PathBuf;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("no config dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

fn sync_allowlist(value: &Value) {
    let hosts: HashSet<String> = value
        .get("customHosts")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(|h| h.trim().trim_start_matches("www.").to_ascii_lowercase())
                .filter(|h| !h.is_empty())
                .collect()
        })
        .unwrap_or_default();
    crate::net::set_user_hosts(hosts);
}

#[tauri::command]
pub fn settings_load(app: AppHandle) -> Result<Value, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(json!({}));
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&raw).unwrap_or_else(|_| json!({}));
    sync_allowlist(&value);
    Ok(value)
}

#[tauri::command]
pub fn settings_save(app: AppHandle, value: Value) -> Result<(), String> {
    let path = settings_path(&app)?;
    let body = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
    std::fs::write(&path, body).map_err(|e| e.to_string())?;
    sync_allowlist(&value);
    Ok(())
}
