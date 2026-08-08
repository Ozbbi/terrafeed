import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  propagate,
  twoline2satrec,
  type SatRec,
} from 'satellite.js';

import { cached } from '../lib/cache';
import { getText } from '../lib/net';
import { signalId, type LayerDef, type Signal } from './types';

const GROUPS = [
  { group: 'stations', label: 'Crewed / station', severity: 0.5 },
  { group: 'weather', label: 'Weather', severity: 0.3 },
];

interface Tracked {
  name: string;
  noradId: string;
  satrec: SatRec;
  label: string;
  severity: number;
}

function parseTle(raw: string, label: string, severity: number): Tracked[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  const out: Tracked[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const [name, l1, l2] = [lines[i], lines[i + 1], lines[i + 2]];
    if (!l1.startsWith('1 ') || !l2.startsWith('2 ')) continue;
    try {
      out.push({
        name: name.trim(),
        noradId: l1.slice(2, 7).trim(),
        satrec: twoline2satrec(l1, l2),
        label,
        severity,
      });
    } catch {
      // A malformed element set should not take the whole layer down.
    }
  }
  return out;
}

async function loadElements(): Promise<Tracked[]> {
  const sets = await Promise.allSettled(
    GROUPS.map(async ({ group, label, severity }) => {
      const raw = await cached(`celestrak:${group}`, 6 * 60 * 60_000, () =>
        getText(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`),
      );
      return parseTle(raw, label, severity);
    }),
  );

  return sets.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
}

/** Propagates every tracked object to `at`. Cheap enough to run on a timer. */
export function positionsAt(tracked: Tracked[], at: Date): Signal[] {
  const gmst = gstime(at);

  return tracked.flatMap<Signal>((sat) => {
    let state;
    try {
      state = propagate(sat.satrec, at);
    } catch {
      return [];
    }
    if (!state?.position || typeof state.position === 'boolean') return [];

    const geodetic = eciToGeodetic(state.position, gmst);
    const lon = degreesLong(geodetic.longitude);
    const lat = degreesLat(geodetic.latitude);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return [];

    const velocity =
      state.velocity && typeof state.velocity !== 'boolean'
        ? Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z)
        : null;

    return [
      {
        id: signalId('sats', sat.noradId),
        layer: 'sats',
        source: 'Celestrak',
        title: sat.name,
        summary: `${sat.label} satellite · NORAD ${sat.noradId}`,
        time: at.getTime(),
        lon,
        lat,
        severity: sat.severity,
        live: true,
        url: `https://celestrak.org/satcat/table-satcat.php?CATNR=${sat.noradId}`,
        meta: {
          noradId: sat.noradId,
          altitudeKm: Math.round(geodetic.height),
          ...(velocity ? { speedKmS: velocity.toFixed(2) } : {}),
          group: sat.label,
        },
      },
    ];
  });
}

let elements: Tracked[] = [];

export const satsLayer: LayerDef = {
  id: 'sats',
  label: 'Satellites',
  group: 'Movement',
  color: '#c9b6ff',
  description: 'Live ground tracks propagated from public two-line element sets.',
  attribution: 'Celestrak general perturbations catalogue',
  refreshMs: 15_000,
  defaultOn: false,
  async load() {
    if (!elements.length) elements = await loadElements();
    return positionsAt(elements, new Date());
  },
};
