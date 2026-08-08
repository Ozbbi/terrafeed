import type { CountryDb } from '../data/countries';
import { greatCircle, type LngLat } from '../lib/geo';
import type { Signal } from '../sources/types';

export interface StoryLink {
  /** Sorted iso3 pair, used as the identity of the link. */
  id: string;
  from: string;
  to: string;
  fromPoint: LngLat;
  toPoint: LngLat;
  /** Distinct stories naming both countries in the window. */
  count: number;
  /** Severity of the most serious of those stories. */
  severity: number;
  /** The story that earned that severity, for the tooltip. */
  headline: string;
  source: string;
}

/** Beyond this, a headline is listing a region rather than describing a relation. */
const MAX_COUNTRIES_PER_STORY = 3;
const WINDOW_MS = 24 * 3_600_000;

/**
 * Which countries are being talked about *together* right now.
 *
 * A headline that names two countries is nearly always describing something
 * between them — a strike, a deal, a shipment, an expulsion. Aggregating those
 * co-mentions turns a scatter of dots into the thing a reader actually wants
 * from a world map: who is currently entangled with whom, and how heavily.
 *
 * Only the first few countries per story are paired. A piece that lists eight
 * countries is a round-up, and pairing all 28 combinations would bury the real
 * relations under a mesh of noise.
 */
export function storyLinks(signals: Signal[], db: CountryDb, max = 70): StoryLink[] {
  const now = Date.now();
  const links = new Map<string, StoryLink>();

  for (const signal of signals) {
    if (signal.layer !== 'news') continue;
    if (now - signal.time > WINDOW_MS) continue;

    const countries = (signal.countries ?? []).slice(0, MAX_COUNTRIES_PER_STORY);
    if (countries.length < 2) continue;

    for (let i = 0; i < countries.length; i += 1) {
      for (let j = i + 1; j < countries.length; j += 1) {
        const a = countries[i];
        const b = countries[j];
        if (a === b) continue;

        const [from, to] = a < b ? [a, b] : [b, a];
        const id = `${from}~${to}`;

        const existing = links.get(id);
        if (existing) {
          existing.count += 1;
          if (signal.severity > existing.severity) {
            existing.severity = signal.severity;
            existing.headline = signal.title;
            existing.source = signal.source;
          }
          continue;
        }

        const fromCountry = db.byIso3.get(from);
        const toCountry = db.byIso3.get(to);
        if (!fromCountry || !toCountry) continue;

        links.set(id, {
          id,
          from,
          to,
          fromPoint: fromCountry.center,
          toPoint: toCountry.center,
          count: 1,
          severity: signal.severity,
          headline: signal.title,
          source: signal.source,
        });
      }
    }
  }

  // Busiest relations first, so the cap keeps the signal and drops the tail.
  return [...links.values()]
    .sort((a, b) => b.count - a.count || b.severity - a.severity)
    .slice(0, max);
}

export function linksToGeoJson(links: StoryLink[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: links.map((link) => ({
      type: 'Feature',
      id: link.id,
      properties: {
        id: link.id,
        count: link.count,
        severity: link.severity,
        headline: link.headline,
        source: link.source,
        pair: `${link.from} ↔ ${link.to}`,
      },
      geometry: {
        type: 'LineString',
        coordinates: greatCircle(link.fromPoint, link.toPoint),
      },
    })),
  };
}
