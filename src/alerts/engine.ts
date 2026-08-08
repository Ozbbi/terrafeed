import { distanceKm } from '../lib/geo';
import type { AlertRule } from '../state/settings';
import { clamp01, type Signal } from '../sources/types';

export interface Alert {
  id: string;
  ruleId: string;
  ruleLabel: string;
  title: string;
  detail: string;
  time: number;
  severity: number;
  /** Distinct providers that independently reported the cluster. */
  sources: string[];
  signals: Signal[];
  lon: number;
  lat: number;
  acknowledged?: boolean;
}

/** Signals further apart than this are treated as separate situations. */
const CLUSTER_RADIUS_KM = 260;

function matches(rule: AlertRule, signal: Signal, now: number): boolean {
  if (signal.severity < rule.minSeverity) return false;
  if (rule.layers.length && !rule.layers.includes(signal.layer)) return false;
  if (now - signal.time > rule.windowMinutes * 60_000) return false;

  if (rule.keyword.trim()) {
    const haystack = `${signal.title} ${signal.summary ?? ''}`.toLowerCase();
    if (!haystack.includes(rule.keyword.trim().toLowerCase())) return false;
  }

  if (rule.area) {
    const km = distanceKm([rule.area.lon, rule.area.lat], [signal.lon, signal.lat]);
    if (km > rule.area.radiusKm) return false;
  }
  return true;
}

function cluster(signals: Signal[], radiusKm: number): Signal[][] {
  const remaining = [...signals].sort((a, b) => b.time - a.time);
  const clusters: Signal[][] = [];

  while (remaining.length) {
    const seed = remaining.shift() as Signal;
    const group = [seed];
    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      if (distanceKm([seed.lon, seed.lat], [remaining[i].lon, remaining[i].lat]) <= radiusKm) {
        group.push(remaining.splice(i, 1)[0]);
      }
    }
    clusters.push(group);
  }
  return clusters;
}

/**
 * A rule fires only when enough *independent* providers describe the same place
 * inside the same window. One outlet repeating itself, or one sensor network
 * emitting a hundred detections, is not corroboration and will not trigger.
 */
export function evaluateRules(rules: AlertRule[], signals: Signal[], now = Date.now()): Alert[] {
  const alerts: Alert[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const candidates = signals.filter((signal) => matches(rule, signal, now));
    if (!candidates.length) continue;

    for (const group of cluster(candidates, rule.area?.radiusKm ?? CLUSTER_RADIUS_KM)) {
      const sources = [...new Set(group.map((signal) => signal.source))];
      if (sources.length < rule.corroboration) continue;

      const strongest = group.reduce((best, signal) =>
        signal.severity > best.severity ? signal : best,
      );
      const lon = group.reduce((sum, s) => sum + s.lon, 0) / group.length;
      const lat = group.reduce((sum, s) => sum + s.lat, 0) / group.length;

      alerts.push({
        // Coordinates are quantised so a drifting cluster keeps its identity and
        // the same situation is not announced twice.
        id: `${rule.id}:${lon.toFixed(0)}:${lat.toFixed(0)}`,
        ruleId: rule.id,
        ruleLabel: rule.label,
        title: strongest.title,
        detail:
          sources.length > 1
            ? `${sources.length} independent sources · ${sources.slice(0, 4).join(', ')}`
            : sources[0],
        time: Math.max(...group.map((signal) => signal.time)),
        severity: clamp01(
          strongest.severity + 0.05 * Math.max(0, sources.length - rule.corroboration),
        ),
        sources,
        signals: group.sort((a, b) => b.severity - a.severity).slice(0, 20),
        lon,
        lat,
      });
    }
  }

  return alerts.sort((a, b) => b.severity - a.severity || b.time - a.time);
}

/** Alerts present now that were not present on the previous evaluation. */
export function newAlerts(previous: Alert[], current: Alert[]): Alert[] {
  const seen = new Set(previous.map((alert) => alert.id));
  return current.filter((alert) => !seen.has(alert.id));
}

export async function notify(alert: Alert): Promise<void> {
  if (!('__TAURI_INTERNALS__' in window)) return;
  try {
    const { isPermissionGranted, requestPermission, sendNotification } = await import(
      '@tauri-apps/plugin-notification'
    );
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === 'granted';
    if (!granted) return;

    sendNotification({ title: `Terrafeed · ${alert.ruleLabel}`, body: alert.title });
  } catch {
    // Notifications are a convenience; never let them break the update loop.
  }
}
