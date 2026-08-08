import type { LayerId, Signal } from '../sources/types';

/**
 * How long a story stays on the map after it stops appearing in its feed.
 *
 * A publisher's RSS window is only ever the last 20–50 items, so a story is
 * pushed out of it within hours regardless of how much it still matters.
 * Replacing the layer wholesale on every poll — which is what used to happen —
 * meant a major event silently vanished from the map while it was still the
 * biggest thing happening.
 *
 * Retention therefore scales with severity: routine copy is allowed to fall off
 * quickly, a serious event is held for days.
 */
const RETENTION_FLOOR_MS = 6 * 3_600_000; // routine story: six hours
const RETENTION_CEILING_MS = 4 * 24 * 3_600_000; // severity 1.0: four days

/** Continuously-tracked objects are positions, not events — never retain them. */
const LIVE_LAYERS = new Set<LayerId>(['milair', 'vessels', 'sats', 'chokepoints']);

export function retentionFor(signal: Signal): number {
  const scale = Math.min(1, Math.max(0, signal.severity));
  // Squared so the long tail is reserved for genuinely severe events rather
  // than handed out linearly to everything mid-range.
  return RETENTION_FLOOR_MS + (RETENTION_CEILING_MS - RETENTION_FLOOR_MS) * scale ** 2;
}

export interface MergeResult {
  signals: Signal[];
  /** Signals kept only because of retention — they are no longer in the feed. */
  retained: number;
}

/**
 * Folds a freshly fetched layer into what was already on screen.
 *
 * Fresh data always wins for a given id, so corrections and severity upgrades
 * propagate. Anything missing from the new fetch survives until its retention
 * window expires, and carries `stale: true` so the UI can be honest that it is
 * showing something the source has stopped listing.
 */
export function mergeWithRetention(
  layer: LayerId,
  previous: Signal[],
  incoming: Signal[],
  now = Date.now(),
): MergeResult {
  if (LIVE_LAYERS.has(layer)) return { signals: incoming, retained: 0 };

  const merged = new Map<string, Signal>();
  for (const signal of incoming) merged.set(signal.id, signal);

  let retained = 0;
  for (const signal of previous) {
    if (merged.has(signal.id)) continue;
    if (now - signal.time > retentionFor(signal)) continue;

    merged.set(signal.id, signal.stale ? signal : { ...signal, stale: true });
    retained += 1;
  }

  return {
    signals: [...merged.values()].sort((a, b) => b.time - a.time),
    retained,
  };
}
