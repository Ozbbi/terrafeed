import { clamp01, type Signal } from '../sources/types';

const WINDOW_MS = 48 * 3_600_000;

/** Per-country 0..1 pressure used for the choropleth overlay. Same idea as the
 *  event component of the instability score, but cheap enough to recompute on
 *  every signal update. */
export function countryPressure(signals: Signal[], now = Date.now()): Map<string, number> {
  const totals = new Map<string, number>();

  for (const signal of signals) {
    if (!signal.iso3 || signal.layer === 'sats') continue;
    const age = now - signal.time;
    if (age > WINDOW_MS) continue;

    const freshness = Math.max(0.2, 1 - age / WINDOW_MS);
    const weight = signal.layer === 'news' ? 0.6 : 1;
    totals.set(signal.iso3, (totals.get(signal.iso3) ?? 0) + signal.severity * freshness * weight);
  }

  const scaled = new Map<string, number>();
  for (const [iso3, score] of totals) scaled.set(iso3, clamp01(score / 6));
  return scaled;
}
