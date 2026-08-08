import { cached } from '../lib/cache';
import { getXml } from '../lib/net';
import { attr, children, firstChild, itemDate, itemLink, stripHtml, text } from '../lib/xml';
import { clamp01, signalId, type LayerDef, type Signal } from './types';

const FEED = 'https://www.gdacs.org/xml/rss.xml';

const ALERT_SEVERITY: Record<string, number> = { green: 0.35, orange: 0.7, red: 0.95 };

const EVENT_LABEL: Record<string, string> = {
  EQ: 'Earthquake',
  TC: 'Tropical cyclone',
  FL: 'Flood',
  VO: 'Volcano',
  DR: 'Drought',
  WF: 'Wildfire',
  TS: 'Tsunami',
};

export const gdacsLayer: LayerDef = {
  id: 'gdacs',
  label: 'Disaster alerts',
  group: 'Hazards',
  color: '#e5484d',
  description: 'Multi-hazard alerts with population-impact estimates from GDACS (UN/EC).',
  attribution: 'Global Disaster Alert and Coordination System',
  refreshMs: 15 * 60_000,
  defaultOn: true,
  async load({ db }) {
    const doc = await cached('gdacs:rss', 12 * 60_000, () => getXml(FEED));

    return children(doc, 'item').flatMap<Signal>((item) => {
      const lat = Number(text(item, 'lat'));
      const lon = Number(text(item, 'long') || text(item, 'lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];

      const level = text(item, 'alertlevel').toLowerCase();
      const eventType = text(item, 'eventtype');
      const severityNode = firstChild(item, 'severity');
      const populationNode = firstChild(item, 'population');
      const country = text(item, 'country');
      const eventId = text(item, 'eventid') || itemLink(item);
      const affected = Number(attr(populationNode, 'value'));

      return [
        {
          id: signalId('gdacs', `${eventType}-${eventId}`),
          layer: 'gdacs',
          source: 'GDACS',
          title: stripHtml(text(item, 'title')),
          summary: stripHtml(text(item, 'description')).slice(0, 400),
          time: itemDate(item),
          lon,
          lat,
          severity: clamp01(
            (ALERT_SEVERITY[level] ?? 0.4) + (Number.isFinite(affected) && affected > 1e6 ? 0.05 : 0),
          ),
          iso3: db.countryAt([lon, lat])?.iso3 ?? null,
          url: itemLink(item),
          meta: {
            alertLevel: level || 'unknown',
            hazard: EVENT_LABEL[eventType] ?? eventType ?? 'unknown',
            ...(country ? { country } : {}),
            ...(attr(severityNode, 'value')
              ? { measure: `${attr(severityNode, 'value')} ${attr(severityNode, 'unit')}`.trim() }
              : {}),
            ...(Number.isFinite(affected) && affected > 0 ? { populationExposed: affected } : {}),
          },
        },
      ];
    });
  },
};
