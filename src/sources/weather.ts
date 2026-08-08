import { cached } from '../lib/cache';
import { getJson } from '../lib/net';
import { bboxOf } from '../lib/geo';
import { clamp01, signalId, type LayerDef, type Signal } from './types';

interface NwsFeed {
  features: {
    id: string;
    properties: {
      event: string;
      headline: string | null;
      description: string | null;
      severity: string;
      certainty: string;
      urgency: string;
      areaDesc: string;
      sent: string;
      expires: string;
      senderName: string;
    };
    geometry: { type: string; coordinates: unknown } | null;
  }[];
}

const FEED =
  'https://api.weather.gov/alerts/active?status=actual&message_type=alert' +
  '&severity=Severe,Extreme&limit=300';

const SEVERITY: Record<string, number> = { Extreme: 0.9, Severe: 0.7, Moderate: 0.45 };
const URGENCY_BONUS: Record<string, number> = { Immediate: 0.08, Expected: 0.03 };

export const weatherLayer: LayerDef = {
  id: 'weather',
  label: 'Severe weather (US)',
  group: 'Hazards',
  color: '#43b0f1',
  description: 'Active severe and extreme warnings issued by the US National Weather Service.',
  attribution: 'NOAA / National Weather Service',
  refreshMs: 6 * 60_000,
  defaultOn: false,
  async load({ db }) {
    const feed = await cached('nws:alerts', 5 * 60_000, () => getJson<NwsFeed>(FEED));

    return (feed.features ?? []).flatMap<Signal>((alert) => {
      // A large share of NWS alerts carry zone references instead of geometry.
      // Resolving those needs one request per zone, so they are skipped.
      if (!alert.geometry) return [];
      const [west, south, east, north] = bboxOf(alert.geometry.coordinates);
      const lon = (west + east) / 2;
      const lat = (south + north) / 2;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return [];

      const props = alert.properties;
      const sent = Date.parse(props.sent);

      return [
        {
          id: signalId('weather', alert.id),
          layer: 'weather',
          source: 'NWS',
          title: props.event,
          summary: props.headline ?? props.areaDesc,
          time: Number.isFinite(sent) ? sent : Date.now(),
          lon,
          lat,
          severity: clamp01((SEVERITY[props.severity] ?? 0.4) + (URGENCY_BONUS[props.urgency] ?? 0)),
          iso3: db.countryAt([lon, lat])?.iso3 ?? 'USA',
          url: `https://alerts.weather.gov/`,
          meta: {
            area: props.areaDesc.slice(0, 180),
            severity: props.severity,
            urgency: props.urgency,
            certainty: props.certainty,
            office: props.senderName,
            expires: props.expires,
          },
        },
      ];
    });
  },
};
