import { distanceKm } from '../lib/geo';
import { clamp01, signalId, type LayerDef, type Signal } from './types';

export interface Chokepoint {
  id: string;
  name: string;
  lon: number;
  lat: number;
  /** Narrowest navigable width, kilometres. */
  widthKm: number;
  note: string;
  /** Radius treated as "at the chokepoint" when scoring nearby signals. */
  radiusKm: number;
}

/** The straits and canals that carry the traffic worth watching. Geography and
 *  the role of each passage are public reference facts. */
export const CHOKEPOINTS: Chokepoint[] = [
  {
    id: 'hormuz',
    name: 'Strait of Hormuz',
    lon: 56.25,
    lat: 26.57,
    widthKm: 39,
    note: 'Only sea route out of the Persian Gulf; the densest crude and LNG corridor on earth.',
    radiusKm: 420,
  },
  {
    id: 'bab-el-mandeb',
    name: 'Bab el-Mandeb',
    lon: 43.35,
    lat: 12.58,
    widthKm: 29,
    note: 'Southern gate of the Red Sea, linking the Suez route to the Indian Ocean.',
    radiusKm: 420,
  },
  {
    id: 'suez',
    name: 'Suez Canal',
    lon: 32.35,
    lat: 30.5,
    widthKm: 0.3,
    note: 'Artificial sea-level canal joining the Mediterranean and the Red Sea.',
    radiusKm: 300,
  },
  {
    id: 'malacca',
    name: 'Strait of Malacca',
    lon: 100.4,
    lat: 2.5,
    widthKm: 2.7,
    note: 'Primary Indian Ocean to Pacific route; the artery for East Asian energy imports.',
    radiusKm: 500,
  },
  {
    id: 'taiwan',
    name: 'Taiwan Strait',
    lon: 119.6,
    lat: 24.5,
    widthKm: 130,
    note: 'Contested passage carrying a large share of global container traffic.',
    radiusKm: 400,
  },
  {
    id: 'panama',
    name: 'Panama Canal',
    lon: -79.68,
    lat: 9.08,
    widthKm: 0.3,
    note: 'Lock canal between the Atlantic and Pacific; throughput is rainfall-dependent.',
    radiusKm: 300,
  },
  {
    id: 'gibraltar',
    name: 'Strait of Gibraltar',
    lon: -5.6,
    lat: 35.95,
    widthKm: 13,
    note: 'Sole natural entrance to the Mediterranean from the Atlantic.',
    radiusKm: 350,
  },
  {
    id: 'bosphorus',
    name: 'Bosphorus',
    lon: 29.06,
    lat: 41.12,
    widthKm: 0.7,
    note: 'Istanbul strait governed by the Montreux Convention; Black Sea grain and oil exit here.',
    radiusKm: 250,
  },
  {
    id: 'dardanelles',
    name: 'Dardanelles',
    lon: 26.4,
    lat: 40.22,
    widthKm: 1.2,
    note: 'Southern half of the Turkish Straits, opening onto the Aegean.',
    radiusKm: 250,
  },
  {
    id: 'danish-straits',
    name: 'Danish Straits',
    lon: 11.0,
    lat: 55.9,
    widthKm: 4,
    note: 'Baltic outlet used heavily for Russian crude exports.',
    radiusKm: 300,
  },
  {
    id: 'kerch',
    name: 'Kerch Strait',
    lon: 36.6,
    lat: 45.3,
    widthKm: 3.1,
    note: 'Connects the Black Sea to the Sea of Azov; repeatedly contested.',
    radiusKm: 250,
  },
  {
    id: 'sunda',
    name: 'Sunda Strait',
    lon: 105.9,
    lat: -5.9,
    widthKm: 24,
    note: 'Malacca alternative between Java and Sumatra; shallow and current-swept.',
    radiusKm: 350,
  },
  {
    id: 'lombok',
    name: 'Lombok Strait',
    lon: 115.8,
    lat: -8.5,
    widthKm: 18,
    note: 'Deep-draft detour used when Malacca is congested or closed.',
    radiusKm: 350,
  },
];

export const chokepointsLayer: LayerDef = {
  id: 'chokepoints',
  label: 'Maritime chokepoints',
  group: 'Trade',
  color: '#f5a531',
  description: 'Thirteen straits and canals, scored by the activity reported around them.',
  attribution: 'Terrafeed reference set',
  refreshMs: 60 * 60_000,
  defaultOn: true,
  async load() {
    return CHOKEPOINTS.map<Signal>((point) => ({
      id: signalId('chokepoints', point.id),
      layer: 'chokepoints',
      source: 'Terrafeed',
      title: point.name,
      summary: point.note,
      time: Date.now(),
      lon: point.lon,
      lat: point.lat,
      severity: 0.2,
      meta: {
        narrowestWidthKm: point.widthKm,
        watchRadiusKm: point.radiusKm,
      },
    }));
  },
};

export interface ChokepointStatus {
  point: Chokepoint;
  pressure: number;
  nearby: Signal[];
}

/**
 * Chokepoint pressure is derived, not reported: it is the weighted severity of
 * everything else the app is already tracking within the watch radius, decayed
 * by distance and age. Two independent layers agreeing pushes it up fastest.
 */
export function chokepointPressure(signals: Signal[]): ChokepointStatus[] {
  const now = Date.now();

  return CHOKEPOINTS.map((point) => {
    const nearby: Signal[] = [];
    const layersSeen = new Set<string>();
    let score = 0;

    for (const signal of signals) {
      if (signal.layer === 'chokepoints' || signal.layer === 'sats') continue;
      const km = distanceKm([point.lon, point.lat], [signal.lon, signal.lat]);
      if (km > point.radiusKm) continue;

      const ageHours = (now - signal.time) / 3_600_000;
      if (ageHours > 48) continue;

      const proximity = 1 - km / point.radiusKm;
      const freshness = Math.max(0.15, 1 - ageHours / 48);
      score += signal.severity * proximity * freshness;
      layersSeen.add(signal.layer);
      nearby.push(signal);
    }

    // Agreement across independent layers matters more than volume from one.
    const corroboration = 1 + 0.35 * Math.max(0, layersSeen.size - 1);
    nearby.sort((a, b) => b.severity - a.severity || b.time - a.time);

    return {
      point,
      pressure: clamp01((score * corroboration) / 6),
      nearby: nearby.slice(0, 12),
    };
  }).sort((a, b) => b.pressure - a.pressure);
}
