export type FeedRegion =
  | 'Global'
  | 'Europe'
  | 'Eurasia'
  | 'Middle East'
  | 'Africa'
  | 'Asia'
  | 'Americas'
  | 'Oceania';

/** Sports desks are kept apart so they can be filtered as a block: most people
 *  watching a world map want either the fixtures or the crises, rarely both. */
export type FeedBeat = 'news' | 'sport';

export interface NewsFeedDef {
  name: string;
  url: string;
  region: FeedRegion;
  beat?: FeedBeat;
}

/**
 * Every entry here was fetched and parsed before being added. The list is
 * deliberately weighted away from Anglo-American outlets: a wire desk in London
 * and a wire desk in Washington cover the same stories, so adding a third one
 * buys nothing, while a regional outlet is often the only source that reports a
 * story at all.
 */
export const DEFAULT_FEEDS: NewsFeedDef[] = [
  // Global desks
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', region: 'Global' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', region: 'Global' },
  { name: 'Guardian World', url: 'https://www.theguardian.com/world/rss', region: 'Global' },
  { name: 'NPR World', url: 'https://feeds.npr.org/1004/rss.xml', region: 'Global' },
  { name: 'Deutsche Welle', url: 'https://rss.dw.com/rdf/rss-en-world', region: 'Global' },
  { name: 'France 24', url: 'https://www.france24.com/en/rss', region: 'Global' },
  { name: 'UN News', url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', region: 'Global' },
  { name: 'Sky News', url: 'https://feeds.skynews.com/feeds/rss/world.xml', region: 'Global' },

  // Europe
  { name: 'Euronews', url: 'https://www.euronews.com/rss?level=theme&name=news', region: 'Europe' },
  { name: 'Politico Europe', url: 'https://www.politico.eu/feed/', region: 'Europe' },

  // Eurasia
  { name: 'Ukrinform', url: 'https://www.ukrinform.net/rss/block-lastnews', region: 'Eurasia' },
  { name: 'Meduza', url: 'https://meduza.io/rss/en/all', region: 'Eurasia' },
  { name: 'Moscow Times', url: 'https://www.themoscowtimes.com/rss/news', region: 'Eurasia' },

  // Middle East
  { name: 'Middle East Eye', url: 'https://www.middleeasteye.net/rss', region: 'Middle East' },
  { name: 'Arab News', url: 'https://www.arabnews.com/rss.xml', region: 'Middle East' },
  { name: 'Jerusalem Post', url: 'https://www.jpost.com/rss/rssfeedsheadlines.aspx', region: 'Middle East' },
  { name: 'Daily Sabah', url: 'https://www.dailysabah.com/rss/homepage', region: 'Middle East' },
  { name: 'Anadolu Agency', url: 'https://www.aa.com.tr/en/rss/default?cat=world', region: 'Middle East' },

  // Africa
  {
    name: 'AllAfrica',
    url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf',
    region: 'Africa',
  },
  { name: 'Africanews', url: 'https://www.africanews.com/feed/rss', region: 'Africa' },

  // Asia
  {
    name: 'The Hindu',
    url: 'https://www.thehindu.com/news/international/feeder/default.rss',
    region: 'Asia',
  },
  { name: 'South China Morning Post', url: 'https://www.scmp.com/rss/91/feed', region: 'Asia' },
  { name: 'Nikkei Asia', url: 'https://asia.nikkei.com/rss/feed/nar', region: 'Asia' },
  { name: 'Japan Times', url: 'https://www.japantimes.co.jp/feed/', region: 'Asia' },
  { name: 'Straits Times', url: 'https://www.straitstimes.com/news/world/rss.xml', region: 'Asia' },
  {
    name: 'Channel News Asia',
    url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml',
    region: 'Asia',
  },

  // Americas
  { name: 'CBC World', url: 'https://www.cbc.ca/webfeed/rss/rss-world', region: 'Americas' },
  { name: 'MercoPress', url: 'https://en.mercopress.com/rss/', region: 'Americas' },
  { name: 'Buenos Aires Times', url: 'https://www.batimes.com.ar/feed', region: 'Americas' },
  { name: 'Rio Times', url: 'https://riotimesonline.com/feed/', region: 'Americas' },

  // Oceania
  {
    name: 'ABC Australia',
    url: 'https://www.abc.net.au/news/feed/2942460/rss.xml',
    region: 'Oceania',
  },

  // Sport — every one of these was fetched and parsed before being listed.
  { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml', region: 'Global', beat: 'sport' },
  { name: 'Sky Sports', url: 'https://www.skysports.com/rss/12040', region: 'Global', beat: 'sport' },
  { name: 'ESPN', url: 'https://www.espn.com/espn/rss/news', region: 'Americas', beat: 'sport' },
  {
    name: 'Guardian Sport',
    url: 'https://www.theguardian.com/sport/rss',
    region: 'Global',
    beat: 'sport',
  },
  {
    name: 'France 24 Sport',
    url: 'https://www.france24.com/en/sport/rss',
    region: 'Europe',
    beat: 'sport',
  },
  {
    name: 'CBC Sports',
    url: 'https://www.cbc.ca/webfeed/rss/rss-sports',
    region: 'Americas',
    beat: 'sport',
  },
  {
    name: 'Daily Sabah Sport',
    url: 'https://www.dailysabah.com/rss/sports',
    region: 'Middle East',
    beat: 'sport',
  },
];

export const FEED_REGIONS: FeedRegion[] = [
  'Global',
  'Europe',
  'Eurasia',
  'Middle East',
  'Africa',
  'Asia',
  'Americas',
  'Oceania',
];
