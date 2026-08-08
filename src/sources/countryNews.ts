import type { Country, CountryDb } from '../data/countries';
import { STOP_TERMS } from '../data/gazetteer';
import { cached } from '../lib/cache';
import { jitter } from '../lib/geo';
import { getXml } from '../lib/net';
import { children, itemDate, itemImage, itemLink, stripHtml, text } from '../lib/xml';
import { clamp01, signalId, type Signal } from './types';

/**
 * Extra coverage for one country, fetched when it is brought into focus.
 *
 * The global sweep is deliberately shallow — a few hundred stories for the whole
 * planet — so zooming anywhere smaller than a continent shows a thin scatter.
 *
 * This uses Google News search RSS rather than GDELT: GDELT enforces one request
 * every five seconds and answers 429 with a 200-shaped body, which makes it a
 * poor fit for something triggered by a click. The RSS endpoint returns a
 * hundred stories per country with no such limit.
 */

const ESCALATION =
  /\b(killed|dead|attack|strike|protest|arrest|detain|crash|fire|flood|quake|sanction|collapse|explosion|evacuat)\w*/i;

/** Google News titles arrive as "Headline - Publisher". */
function splitTitle(raw: string): { title: string; publisher: string | null } {
  const match = /^(.*)\s+-\s+([^-]{2,40})$/.exec(raw);
  if (!match) return { title: raw, publisher: null };
  return { title: match[1].trim(), publisher: match[2].trim() };
}

export async function loadCountryNews(country: Country, db: CountryDb): Promise<Signal[]> {
  // A handful of country names are also ordinary words — a bare "Turkey" search
  // returns recipes, "Georgia" returns the US state, "Chad" returns people.
  // These are the same names the gazetteer already refuses to geocode on sight.
  const ambiguous = STOP_TERMS.has(country.name.toLowerCase());
  const query = encodeURIComponent(`"${country.name}"${ambiguous ? ' country' : ''}`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

  const doc = await cached(`gnews:${country.iso3}`, 15 * 60_000, () => getXml(url));

  return children(doc, 'item')
    .slice(0, 60)
    .flatMap<Signal>((item) => {
      const raw = stripHtml(text(item, 'title'));
      if (!raw) return [];

      const { title, publisher } = splitTitle(raw);
      const link = itemLink(item);
      const source = text(item, 'source') || publisher || 'Google News';

      // Prefer a place named in the headline, as long as it is in this country;
      // otherwise scatter across the country itself, which is the point of
      // having asked about it.
      const named = db.locate(title);
      const inCountry = named?.iso3 === country.iso3;
      const [lon, lat] = inCountry
        ? jitter([named.lon, named.lat], link || title, 0.5)
        : jitter(country.center, link || title, 3.5);

      return [
        {
          id: signalId('news', link || `${country.iso3}:${title}`),
          layer: 'news',
          source,
          title,
          summary: `Focused coverage · ${country.name}`,
          time: itemDate(item),
          lon,
          lat,
          severity: clamp01(ESCALATION.test(title) ? 0.6 : 0.28),
          iso3: country.iso3,
          url: link,
          image: itemImage(item),
          meta: {
            focus: country.name,
            placement:
              inCountry && named ? `named: ${named.label}` : `approximate: ${country.name}`,
          },
        },
      ];
    });
}
