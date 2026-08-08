import { cached } from '../lib/cache';
import { getJson } from '../lib/net';
import { stripHtml } from '../lib/xml';
import { clamp01, signalId, type LayerDef, type Signal } from './types';

interface ReliefFeed {
  data: {
    id: string;
    fields: {
      title: string;
      url?: string;
      date?: { created?: string };
      country?: { name: string; iso3?: string; location?: { lat: number; lon: number } }[];
      disaster_type?: { name: string }[];
      source?: { shortname?: string; name?: string }[];
    };
  }[];
}

const FEED =
  'https://api.reliefweb.int/v1/reports?appname=terrafeed-desktop&limit=40' +
  '&sort[]=date.created:desc' +
  '&fields[include][]=title&fields[include][]=url&fields[include][]=date.created' +
  '&fields[include][]=country.name&fields[include][]=country.iso3&fields[include][]=country.location' +
  '&fields[include][]=disaster_type.name&fields[include][]=source.shortname';

/** Report categories that usually signal an acute, not structural, situation. */
const ACUTE = /(displac|outbreak|famine|escalat|attack|flash|emergency|cholera|conflict)/i;

export const reliefLayer: LayerDef = {
  id: 'relief',
  label: 'Humanitarian reporting',
  group: 'Humanitarian',
  color: '#8b7bf7',
  description: 'Situation reports and appeals published through ReliefWeb (UN OCHA).',
  attribution: 'ReliefWeb / UN OCHA',
  refreshMs: 20 * 60_000,
  defaultOn: false,
  async load({ db }) {
    const feed = await cached('reliefweb:reports', 15 * 60_000, () => getJson<ReliefFeed>(FEED));

    return (feed.data ?? []).flatMap<Signal>((report) => {
      const fields = report.fields;
      const country = fields.country?.find((c) => c.location);
      const located = country?.location
        ? { lon: country.location.lon, lat: country.location.lat, iso3: country.iso3 ?? null }
        : null;
      const fallback = located ?? db.locate(fields.title);
      if (!fallback) return [];

      const title = stripHtml(fields.title);
      const created = fields.date?.created ? Date.parse(fields.date.created) : Date.now();

      return [
        {
          id: signalId('relief', report.id),
          layer: 'relief',
          source: 'ReliefWeb',
          title,
          summary: fields.disaster_type?.map((d) => d.name).join(', ') || undefined,
          time: Number.isFinite(created) ? created : Date.now(),
          lon: fallback.lon,
          lat: fallback.lat,
          severity: clamp01(ACUTE.test(title) ? 0.6 : 0.35),
          iso3: 'iso3' in fallback ? fallback.iso3 : null,
          url: fields.url,
          meta: {
            ...(fields.country?.length
              ? { countries: fields.country.map((c) => c.name).join(', ') }
              : {}),
            ...(fields.source?.[0]?.shortname ? { publisher: fields.source[0].shortname } : {}),
          },
        },
      ];
    });
  },
};
