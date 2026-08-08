import { cached } from '../lib/cache';
import { getJson } from '../lib/net';
import { clamp01, signalId, type LayerDef, type Signal } from './types';

interface UsgsFeed {
  features: {
    id: string;
    properties: {
      mag: number | null;
      place: string | null;
      time: number;
      url: string;
      tsunami: number;
      felt: number | null;
      alert: string | null;
      type: string;
    };
    geometry: { coordinates: [number, number, number] };
  }[];
}

const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

export const quakesLayer: LayerDef = {
  id: 'quakes',
  label: 'Earthquakes',
  group: 'Hazards',
  color: '#f2b134',
  description: 'Magnitude 2.5+ events worldwide, last 24 hours.',
  attribution: 'USGS Earthquake Hazards Program',
  refreshMs: 5 * 60_000,
  defaultOn: true,
  async load({ db }) {
    const feed = await cached('usgs:quakes', 4 * 60_000, () => getJson<UsgsFeed>(FEED));

    return feed.features
      .filter((f) => f.properties.type === 'earthquake' && f.properties.mag != null)
      .map<Signal>((f) => {
        const [lon, lat, depth] = f.geometry.coordinates;
        const mag = f.properties.mag ?? 0;
        return {
          id: signalId('quakes', f.id),
          layer: 'quakes',
          source: 'USGS',
          title: `M${mag.toFixed(1)} — ${f.properties.place ?? 'unknown location'}`,
          summary: f.properties.tsunami ? 'Tsunami evaluation flagged by USGS.' : undefined,
          time: f.properties.time,
          lon,
          lat,
          // M2.5 is background noise, M7.5+ is a headline event.
          severity: clamp01((mag - 2.5) / 5),
          iso3: db.countryAt([lon, lat])?.iso3 ?? null,
          url: f.properties.url,
          meta: {
            magnitude: mag,
            depthKm: Math.round(depth),
            ...(f.properties.felt ? { feltReports: f.properties.felt } : {}),
            ...(f.properties.alert ? { pagerAlert: f.properties.alert } : {}),
          },
        };
      });
  },
};
