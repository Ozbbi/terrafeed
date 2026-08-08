import { cached } from '../lib/cache';
import { gdeltJson } from '../lib/gdelt';
import { getXml } from '../lib/net';
import { children, itemDate, itemImage, itemLink, stripHtml, text } from '../lib/xml';
import { jitter, type LngLat } from '../lib/geo';
import { DEFAULT_FEEDS, type FeedRegion, type NewsFeedDef } from '../data/feeds';
import { clamp01, signalId, type FetchContext, type LayerDef, type Signal } from './types';

/** Escalation vocabulary, weighted by how strongly it implies an acute event. */
const KEYWORDS: [RegExp, number][] = [
  [/\b(nuclear|coup|invasion|invade|massacre)\b/i, 0.95],
  [/\b(airstrike|air strike|missile|drone strike|shelling|bombard)\b/i, 0.85],
  [/\b(killed|dead|casualt|fatalit)\w*/i, 0.75],
  [/\b(evacuat|state of emergency|martial law|curfew)\w*/i, 0.7],
  [/\b(sanction|embargo|blockade|export ban)\w*/i, 0.65],
  [/\b(ceasefire|truce|peace deal|hostage release)\b/i, 0.6],
  [/\b(protest|riot|unrest|strike action|clash)\w*/i, 0.55],
  [/\b(outage|blackout|cyberattack|ransomware|breach)\w*/i, 0.55],
  [/\b(default|devaluation|collapse|bailout|recession)\b/i, 0.5],
  [/\b(election|referendum|resign|impeach)\w*/i, 0.4],
];

function scoreHeadline(title: string): number {
  let score = 0.22;
  for (const [pattern, weight] of KEYWORDS) {
    if (pattern.test(title)) score = Math.max(score, weight);
  }
  return clamp01(score);
}

/**
 * Where a story goes when the headline names no place we recognise. Dropping
 * those used to be the behaviour, which quietly biased the map towards the
 * regions whose city names appear most often in English copy. Keeping them at
 * their publisher's region is less precise but far less misleading — and the
 * detail card says which of the two happened.
 */
const REGION_CENTROIDS: Record<FeedRegion, LngLat> = {
  Global: [0, 20],
  Europe: [10, 50],
  Eurasia: [55, 52],
  'Middle East': [45, 29],
  Africa: [20, 2],
  Asia: [100, 25],
  Americas: [-70, 0],
  Oceania: [145, -25],
};

/** GDELT stamps are `YYYYMMDDTHHMMSSZ`, which Date.parse refuses. */
function parseGdeltDate(raw: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(raw ?? '');
  if (!m) return Date.now();
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  domain: string;
  language: string;
  sourcecountry?: string;
  socialimage?: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

/**
 * Several narrower queries instead of one broad one. GDELT ranks by recency
 * within a query, so a single query is dominated by whichever theme is loudest
 * that hour; splitting them guarantees each theme gets its own slice.
 */
const GDELT_QUERIES: { id: string; query: string }[] = [
  {
    id: 'conflict',
    query: '(airstrike OR shelling OR offensive OR ceasefire OR militants OR insurgency) sourcelang:english',
  },
  {
    id: 'statecraft',
    query: '(sanctions OR summit OR "foreign minister" OR treaty OR "state of emergency" OR coup) sourcelang:english',
  },
  {
    id: 'economy',
    query: '(inflation OR "central bank" OR default OR "supply chain" OR pipeline OR "export ban") sourcelang:english',
  },
  {
    id: 'disaster',
    query: '(earthquake OR flooding OR wildfire OR cyclone OR evacuation OR outbreak) sourcelang:english',
  },
];

async function loadGdelt({ db }: FetchContext): Promise<Signal[]> {
  const jobs = GDELT_QUERIES.map(async ({ id, query }) => {
    const url =
      'https://api.gdeltproject.org/api/v2/doc/doc?format=json&mode=artlist&maxrecords=60' +
      `&sort=datedesc&timespan=6h&query=${encodeURIComponent(query)}`;

    const data = await cached(`gdelt:${id}`, 8 * 60_000, () => gdeltJson<GdeltResponse>(url));

    return (data.articles ?? []).flatMap<Signal>((article) => {
      const title = stripHtml(article.title ?? '');
      const where = db.locate(title);
      if (!where) return [];
      const [lon, lat] = jitter([where.lon, where.lat], article.url, 0.6);
      const mentioned = db.locateAll(title);

      return [
        {
          id: signalId('news', article.url),
          layer: 'news',
          source: article.domain || 'GDELT',
          title,
          summary: `via GDELT · ${article.domain}`,
          time: parseGdeltDate(article.seendate),
          lon,
          lat,
          severity: scoreHeadline(title),
          iso3: where.iso3,
          countries: mentioned.flatMap((m) => (m.iso3 ? [m.iso3] : [])),
          url: article.url,
          image: article.socialimage || undefined,
          meta: {
            place: where.label,
            aggregator: 'GDELT 2.0',
            theme: id,
            ...(article.sourcecountry ? { sourceCountry: article.sourcecountry } : {}),
          },
        },
      ];
    });
  });

  const settled = await Promise.allSettled(jobs);
  return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
}

async function loadFeed(feed: NewsFeedDef, { db }: FetchContext): Promise<Signal[]> {
  const doc = await cached(`rss:${feed.url}`, 6 * 60_000, () => getXml(feed.url));
  const items = [...children(doc, 'item'), ...children(doc, 'entry')];
  const region = feed.region ?? 'Global';

  return items.slice(0, 40).flatMap<Signal>((item) => {
    const title = stripHtml(text(item, 'title'));
    if (!title) return [];

    const link = itemLink(item);
    const where = db.locate(title);
    const mentioned = db.locateAll(title);
    const fallback = REGION_CENTROIDS[region] ?? REGION_CENTROIDS.Global;

    // Named places get tight jitter; region fallbacks get a wide scatter so a
    // cluster of them never reads as a real concentration of events.
    const [lon, lat] = where
      ? jitter([where.lon, where.lat], link || title, 0.6)
      : jitter(fallback, link || title, 9);

    return [
      {
        id: signalId('news', link || `${feed.name}:${title}`),
        layer: 'news',
        source: feed.name,
        title,
        summary: stripHtml(text(item, 'description')).slice(0, 300) || undefined,
        time: itemDate(item),
        lon,
        lat,
        severity: scoreHeadline(title) * (where ? 1 : 0.75),
        iso3: where?.iso3 ?? null,
        countries: mentioned.flatMap((m) => (m.iso3 ? [m.iso3] : [])),
        url: link,
        image: itemImage(item),
        meta: {
          feed: feed.name,
          region,
          placement: where ? `named: ${where.label}` : `approximate: ${region} desk`,
        },
      },
    ];
  });
}

/** Collapses the per-feed results, keeping the strongest version of a story. */
function mergeResults(settled: PromiseSettledResult<Signal[]>[], cap: number): Signal[] {
  const byId = new Map<string, Signal>();
  for (const result of settled) {
    if (result.status !== 'fulfilled') continue;
    for (const signal of result.value) {
      // Same story from several outlets: keep the earliest sighting but let
      // later, higher-scoring versions raise the severity.
      const existing = byId.get(signal.id);
      if (!existing) byId.set(signal.id, signal);
      else if (signal.severity > existing.severity) byId.set(signal.id, signal);
    }
  }
  return [...byId.values()].sort((a, b) => b.time - a.time).slice(0, cap);
}

const newsFeeds = (ctx: FetchContext) =>
  (ctx.settings.feeds.length ? ctx.settings.feeds : DEFAULT_FEEDS).filter(
    (feed) => feed.beat !== 'sport',
  );

const sportFeeds = (ctx: FetchContext) =>
  (ctx.settings.feeds.length ? ctx.settings.feeds : DEFAULT_FEEDS).filter(
    (feed) => feed.beat === 'sport',
  );

export const newsLayer: LayerDef = {
  id: 'news',
  label: 'World news',
  group: 'Information',
  color: '#5ef2dc',
  description:
    'Headlines from 31 regional and global desks, placed by the locations named in the text.',
  attribution: 'GDELT 2.0 + publisher RSS feeds',
  refreshMs: 5 * 60_000,
  defaultOn: true,
  async load(ctx) {
    const jobs: Promise<Signal[]>[] = [
      loadGdelt(ctx),
      ...newsFeeds(ctx).map((feed) => loadFeed(feed, ctx)),
    ];
    return mergeResults(await Promise.allSettled(jobs), 1200);
  },
};

export const sportLayer: LayerDef = {
  id: 'sport',
  label: 'Sport',
  group: 'Information',
  color: '#7ee787',
  description: 'Results, fixtures and transfers from seven sports desks.',
  attribution: 'BBC, Sky, ESPN, Guardian, France 24, CBC and Daily Sabah sport feeds',
  refreshMs: 5 * 60_000,
  defaultOn: false,
  async load(ctx) {
    const signals = mergeResults(
      await Promise.allSettled(sportFeeds(ctx).map((feed) => loadFeed(feed, ctx))),
      400,
    );

    // Sport carries none of the escalation vocabulary the scorer looks for, and
    // a "clash" or a "defeat" on the back page must not colour the map like an
    // actual one. Flat and low is the honest reading.
    return signals.map((signal) => ({ ...signal, layer: 'sport' as const, severity: 0.18 }));
  },
};
