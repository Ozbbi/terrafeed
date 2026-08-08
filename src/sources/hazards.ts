import { cached } from '../lib/cache';
import { getJson } from '../lib/net';
import { bboxOf } from '../lib/geo';
import { clamp01, signalId, type LayerDef, type Signal } from './types';

interface EonetFeed {
  events: {
    id: string;
    title: string;
    description: string | null;
    link: string;
    closed: string | null;
    categories: { id: string; title: string }[];
    geometry: {
      date: string;
      type: 'Point' | 'Polygon';
      coordinates: number[] | number[][][];
      magnitudeValue?: number | null;
      magnitudeUnit?: string | null;
    }[];
  }[];
}

const FEED = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=20&limit=400';

/** Rough ordering of how much attention each EONET category usually deserves. */
const CATEGORY_WEIGHT: Record<string, number> = {
  volcanoes: 0.8,
  severeStorms: 0.75,
  wildfires: 0.6,
  floods: 0.7,
  landslides: 0.65,
  drought: 0.45,
  dustHaze: 0.35,
  seaLakeIce: 0.25,
  snow: 0.3,
  temperatureExtremes: 0.5,
  manmade: 0.55,
  waterColor: 0.2,
};

export const hazardsLayer: LayerDef = {
  id: 'hazards',
  label: 'Natural hazards',
  group: 'Hazards',
  color: '#ff7043',
  description: 'Open wildfire, storm, volcano, flood and ice events tracked by NASA EONET.',
  attribution: 'NASA Earth Observatory Natural Event Tracker',
  refreshMs: 20 * 60_000,
  defaultOn: true,
  async load({ db }) {
    const feed = await cached('eonet:events', 15 * 60_000, () => getJson<EonetFeed>(FEED));

    return feed.events.flatMap<Signal>((event) => {
      const latest = event.geometry.at(-1);
      if (!latest) return [];

      let lon: number;
      let lat: number;
      if (latest.type === 'Point') {
        [lon, lat] = latest.coordinates as number[];
      } else {
        const [west, south, east, north] = bboxOf(latest.coordinates);
        lon = (west + east) / 2;
        lat = (south + north) / 2;
      }
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return [];

      const category = event.categories[0];
      const base = CATEGORY_WEIGHT[category?.id ?? ''] ?? 0.4;
      const time = Date.parse(latest.date);
      // Events that have kept reporting for days are the ones still burning.
      const persistence = clamp01(event.geometry.length / 12) * 0.2;

      return [
        {
          id: signalId('hazards', event.id),
          layer: 'hazards',
          source: 'NASA EONET',
          title: event.title,
          summary: event.description || category?.title,
          time: Number.isFinite(time) ? time : Date.now(),
          lon,
          lat,
          severity: clamp01(base + persistence),
          iso3: db.countryAt([lon, lat])?.iso3 ?? null,
          url: event.link.replace('/api/v3/', '/'),
          meta: {
            category: category?.title ?? 'unknown',
            observations: event.geometry.length,
            ...(latest.magnitudeValue != null
              ? { magnitude: `${latest.magnitudeValue} ${latest.magnitudeUnit ?? ''}`.trim() }
              : {}),
          },
        },
      ];
    });
  },
};
