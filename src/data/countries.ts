import { bboxOf, inBBox, type BBox, type LngLat } from '../lib/geo';
import { COUNTRY_ALIASES, PLACES, STOP_TERMS, type Place } from './gazetteer';

export interface CountryProps {
  iso3: string;
  iso2: string | null;
  name: string;
  nameLong: string;
  continent: string;
  subregion: string;
  region: string;
  pop: number | null;
  gdp: number | null;
  income: string | null;
  lx: number | null;
  ly: number | null;
}

export interface Country extends CountryProps {
  bbox: BBox;
  center: LngLat;
}

export interface GeoMatch {
  lon: number;
  lat: number;
  iso3: string | null;
  label: string;
  /** Higher wins when several terms hit the same headline. */
  weight: number;
}

interface Term {
  pattern: RegExp;
  /** The literal being matched, needed to work out how much text it claims. */
  text: string;
  match: GeoMatch;
}

export interface CountryDb {
  geojson: GeoJSON.FeatureCollection;
  list: Country[];
  byIso3: Map<string, Country>;
  /** Best-effort placement of free text. Returns null when nothing is recognised. */
  locate(text: string): GeoMatch | null;
  /**
   * Every distinct country the text names, strongest match first. `locate` only
   * answers "where does this pin go"; this answers "who is this story about",
   * which is what makes a link between two countries meaningful.
   */
  locateAll(text: string, max?: number): GeoMatch[];
  /** Country whose bounding box contains the point (first match, largest last). */
  countryAt(point: LngLat): Country | null;
}

let pending: Promise<CountryDb> | null = null;

const escapeRe = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const termFor = (text: string, match: GeoMatch): Term => ({
  // Word-boundary match so "Iran" does not fire inside "Iranian-adjacent" noise
  // like "Tehranian"; the alias list handles demonyms explicitly.
  pattern: new RegExp(`(^|[^\\p{L}])${escapeRe(text)}([^\\p{L}]|$)`, 'iu'),
  text,
  match,
});

function buildTerms(countries: Country[]): Term[] {
  const terms: Term[] = [];

  for (const place of PLACES) {
    const base: GeoMatch = {
      lon: place.lon,
      lat: place.lat,
      iso3: place.iso3,
      label: place.name,
      weight: 3,
    };
    terms.push(termFor(place.name, base));
    for (const alias of place.aliases ?? []) {
      terms.push(termFor(alias, { ...base, label: alias, weight: 4 }));
    }
  }

  for (const country of countries) {
    const base: GeoMatch = {
      lon: country.center[0],
      lat: country.center[1],
      iso3: country.iso3,
      label: country.name,
      weight: 1,
    };
    const names = new Set([country.name, country.nameLong]);
    for (const name of names) {
      if (!name || STOP_TERMS.has(name.toLowerCase()) || name.length < 4) continue;
      terms.push(termFor(name, base));
    }
    for (const alias of COUNTRY_ALIASES[country.iso3] ?? []) {
      terms.push(termFor(alias, { ...base, weight: 2 }));
    }
  }

  // Longest patterns first: "South Korea" must beat "Korea".
  return terms.sort((a, b) => b.pattern.source.length - a.pattern.source.length);
}

export function loadCountries(): Promise<CountryDb> {
  if (pending) return pending;

  pending = fetch('data/countries.geojson')
    .then((response) => {
      if (!response.ok) throw new Error(`countries.geojson: HTTP ${response.status}`);
      return response.json() as Promise<GeoJSON.FeatureCollection>;
    })
    .then((geojson) => {
      const list: Country[] = geojson.features.map((feature) => {
        const props = feature.properties as unknown as CountryProps;
        const bbox = bboxOf((feature.geometry as GeoJSON.Polygon).coordinates);
        const center: LngLat =
          props.lx != null && props.ly != null
            ? [props.lx, props.ly]
            : [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
        return { ...props, bbox, center };
      });

      const byIso3 = new Map(list.map((country) => [country.iso3, country]));
      const terms = buildTerms(list);
      // Smallest area first so a point inside Vatican-sized boxes is not claimed
      // by the surrounding giant.
      const byArea = [...list].sort(
        (a, b) =>
          (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]) -
          (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]),
      );

      return {
        geojson,
        list,
        byIso3,
        locate(text: string) {
          if (!text) return null;
          let best: GeoMatch | null = null;
          for (const term of terms) {
            if (!term.pattern.test(text)) continue;
            if (!best || term.match.weight > best.weight) best = term.match;
            if (best.weight >= 4) break;
          }
          return best;
        },
        locateAll(text: string, max = 4) {
          if (!text) return [];

          // Terms are longest-first, so claiming the span each match consumes
          // and refusing to match inside a claimed span is what stops one
          // country name being read out of another: "DR Congo" must not also
          // yield Congo-Brazzaville, and "South Sudan" must not yield Sudan.
          const claimed: [number, number][] = [];
          const best = new Map<string, GeoMatch>();

          for (const term of terms) {
            const iso3 = term.match.iso3;
            if (!iso3) continue;

            const found = term.pattern.exec(text);
            if (!found) continue;

            // Group 1 is the leading boundary character, so the literal starts
            // just after it.
            const start = found.index + found[1].length;
            const end = start + term.text.length;
            if (claimed.some(([from, to]) => start < to && end > from)) continue;

            claimed.push([start, end]);
            const held = best.get(iso3);
            if (!held || term.match.weight > held.weight) best.set(iso3, term.match);
          }

          return [...best.values()].sort((a, b) => b.weight - a.weight).slice(0, max);
        },
        countryAt(point: LngLat) {
          return byArea.find((country) => inBBox(point, country.bbox)) ?? null;
        },
      } satisfies CountryDb;
    });

  return pending;
}

export const placeByName = (name: string): Place | undefined =>
  PLACES.find((place) => place.name.toLowerCase() === name.toLowerCase());
