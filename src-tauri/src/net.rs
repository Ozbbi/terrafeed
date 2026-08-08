//! Allowlisted outbound HTTP.
//!
//! Two rules, both enforced before a request leaves the process:
//!   1. the scheme must be https (or http for hosts that still lack TLS),
//!   2. the host must match a built-in suffix or one the user added themselves
//!      when configuring a custom feed.
//!
//! This keeps a hostile RSS payload from turning the app into an open proxy or
//! pointing it at something on the user's LAN.

use std::collections::HashSet;
use std::sync::RwLock;

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use url::{Host, Url};

/// Hosts backing the built-in layers. Suffix match on the registrable name, so
/// `earthquake.usgs.gov` is covered by `usgs.gov`.
const BUILTIN_HOSTS: &[&str] = &[
    // hazards & natural events
    "usgs.gov",
    "gsfc.nasa.gov",
    "eosdis.nasa.gov",
    "nasa.gov",
    "gdacs.org",
    "reliefweb.int",
    "weather.gov",
    "open-meteo.com",
    "emsc-csem.org",
    "tsunami.gov",
    // news & open events — every host below backs a feed in data/feeds.ts
    "gdeltproject.org",
    "news.google.com",
    "bbci.co.uk",
    "bbc.co.uk",
    "aljazeera.com",
    "apnews.com",
    "npr.org",
    "dw.com",
    "france24.com",
    "cbc.ca",
    "theguardian.com",
    "reutersagency.com",
    "un.org",
    "who.int",
    "europa.eu",
    "skynews.com",
    "euronews.com",
    "politico.eu",
    "ukrinform.net",
    "meduza.io",
    "themoscowtimes.com",
    "middleeasteye.net",
    "arabnews.com",
    "jpost.com",
    "dailysabah.com",
    "aa.com.tr",
    "allafrica.com",
    "africanews.com",
    "thehindu.com",
    "scmp.com",
    "nikkei.com",
    "japantimes.co.jp",
    "straitstimes.com",
    "channelnewsasia.com",
    "mercopress.com",
    "batimes.com.ar",
    "riotimesonline.com",
    "abc.net.au",
    // air, sea, space
    "adsb.lol",
    "airplanes.live",
    "opensky-network.org",
    "celestrak.org",
    "aisstream.io",
    // economics & markets
    "finance.yahoo.com",
    "yahoo.com",
    "worldbank.org",
    "imf.org",
    "frankfurter.app",
    "coingecko.com",
    "energy-charts.info",
    // reference geometry
    "githubusercontent.com",
];

static USER_HOSTS: Lazy<RwLock<HashSet<String>>> = Lazy::new(|| RwLock::new(HashSet::new()));

/// Replaces the user-authorised host set. Called whenever settings are loaded or
/// saved so a newly added custom feed becomes reachable without a restart.
pub(crate) fn set_user_hosts(hosts: HashSet<String>) {
    if let Ok(mut guard) = USER_HOSTS.write() {
        *guard = hosts;
    }
}

fn host_allowed(host: &str) -> bool {
    let host = host.trim_start_matches("www.").to_ascii_lowercase();
    let matches = |allowed: &str| host == allowed || host.ends_with(&format!(".{allowed}"));

    if BUILTIN_HOSTS.iter().any(|a| matches(a)) {
        return true;
    }
    USER_HOSTS
        .read()
        .map(|set| set.iter().any(|a| matches(a)))
        .unwrap_or(false)
}

/// Rejects loopback / private / link-local literals. Hostnames that *resolve* to
/// private space are still possible, but they would also have to survive the
/// allowlist above, which no public data host does.
fn is_public_target(url: &Url) -> bool {
    match url.host() {
        Some(Host::Ipv4(ip)) => {
            !(ip.is_loopback() || ip.is_private() || ip.is_link_local() || ip.is_unspecified())
        }
        Some(Host::Ipv6(ip)) => !(ip.is_loopback() || ip.is_unspecified()),
        Some(Host::Domain(_)) => true,
        None => false,
    }
}

#[derive(Debug, Deserialize)]
pub struct NetRequest {
    pub url: String,
    #[serde(default)]
    pub headers: Vec<(String, String)>,
    /// Optional `Accept` shorthand; most feeds behave better with an explicit one.
    #[serde(default)]
    pub accept: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct NetResponse {
    pub status: u16,
    pub ok: bool,
    pub content_type: String,
    pub body: String,
    pub final_url: String,
}

#[tauri::command]
pub async fn net_get(req: NetRequest) -> Result<NetResponse, String> {
    let url = Url::parse(&req.url).map_err(|e| format!("invalid url: {e}"))?;

    if !matches!(url.scheme(), "https" | "http") {
        return Err(format!("blocked scheme: {}", url.scheme()));
    }
    if !is_public_target(&url) {
        return Err("blocked: non-public address".into());
    }
    let host = url.host_str().ok_or("blocked: url has no host")?.to_owned();
    if !host_allowed(&host) {
        return Err(format!(
            "blocked host: {host} — add it under Settings › Custom sources to allow it"
        ));
    }

    let mut request = crate::HTTP.get(url.clone());
    if let Some(accept) = &req.accept {
        request = request.header(reqwest::header::ACCEPT, accept);
    }
    for (key, value) in &req.headers {
        // Hop-by-hop and identity headers stay under our control.
        let lowered = key.to_ascii_lowercase();
        if matches!(lowered.as_str(), "host" | "cookie" | "user-agent") {
            continue;
        }
        request = request.header(key, value);
    }

    let response = request.send().await.map_err(|e| e.to_string())?;
    let status = response.status();
    let final_url = response.url().to_string();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_string();
    let body = response.text().await.map_err(|e| e.to_string())?;

    Ok(NetResponse {
        status: status.as_u16(),
        ok: status.is_success(),
        content_type,
        body,
        final_url,
    })
}
