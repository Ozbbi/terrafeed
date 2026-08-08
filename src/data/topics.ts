export interface Topic {
  id: string;
  label: string;
  group: TopicGroup;
  /** Any of these appearing in a headline places it in the topic. */
  terms: string[];
}

export type TopicGroup =
  | 'Conflict & security'
  | 'Statecraft'
  | 'Energy & commodities'
  | 'Economy'
  | 'Technology'
  | 'Climate & environment'
  | 'Health'
  | 'Society'
  | 'Sport'
  | 'Business';

export const TOPIC_GROUPS: TopicGroup[] = [
  'Conflict & security',
  'Statecraft',
  'Energy & commodities',
  'Economy',
  'Technology',
  'Climate & environment',
  'Health',
  'Society',
  'Sport',
  'Business',
];

/** A starting catalogue. Terms are matched on word boundaries, so short entries
 *  are safe, but each list is kept specific enough not to swallow the feed. */
export const TOPIC_CATALOG: Topic[] = [
  // Conflict & security
  {
    id: 'ground-war',
    label: 'Ground fighting',
    group: 'Conflict & security',
    terms: ['offensive', 'frontline', 'front line', 'shelling', 'artillery', 'ground assault', 'incursion', 'counteroffensive'],
  },
  {
    id: 'air-strikes',
    label: 'Air & missile strikes',
    group: 'Conflict & security',
    terms: ['airstrike', 'air strike', 'missile', 'drone strike', 'bombardment', 'air raid', 'interceptor'],
  },
  {
    id: 'naval',
    label: 'Naval & maritime security',
    group: 'Conflict & security',
    terms: ['warship', 'frigate', 'destroyer', 'carrier group', 'naval', 'tanker attack', 'piracy', 'blockade', 'freedom of navigation'],
  },
  {
    id: 'nuclear',
    label: 'Nuclear',
    group: 'Conflict & security',
    terms: ['nuclear', 'enrichment', 'uranium', 'warhead', 'iaea', 'nonproliferation', 'test site'],
  },
  {
    id: 'terrorism',
    label: 'Terrorism & insurgency',
    group: 'Conflict & security',
    terms: ['terror attack', 'terrorist', 'insurgent', 'militant', 'suicide bomb', 'car bomb', 'ied', 'claimed responsibility'],
  },
  {
    id: 'coup',
    label: 'Coups & political violence',
    group: 'Conflict & security',
    terms: ['coup', 'junta', 'martial law', 'state of emergency', 'assassination', 'mutiny'],
  },
  {
    id: 'ceasefire',
    label: 'Ceasefires & talks',
    group: 'Conflict & security',
    terms: ['ceasefire', 'truce', 'peace talks', 'peace deal', 'negotiations', 'prisoner exchange', 'hostage release'],
  },
  {
    id: 'defence-industry',
    label: 'Defence procurement',
    group: 'Conflict & security',
    terms: ['arms deal', 'defence budget', 'defense budget', 'weapons package', 'military aid', 'arms export', 'procurement'],
  },

  // Statecraft
  {
    id: 'sanctions',
    label: 'Sanctions & export controls',
    group: 'Statecraft',
    terms: ['sanction', 'sanctions', 'embargo', 'export control', 'blacklist', 'asset freeze', 'tariff'],
  },
  {
    id: 'diplomacy',
    label: 'Diplomacy & summits',
    group: 'Statecraft',
    terms: ['summit', 'diplomatic', 'ambassador', 'foreign minister', 'bilateral', 'state visit', 'treaty'],
  },
  {
    id: 'alliances',
    label: 'Alliances & blocs',
    group: 'Statecraft',
    terms: ['nato', 'brics', 'european union', 'asean', 'african union', 'g7', 'g20', 'opec', 'accession'],
  },
  {
    id: 'elections',
    label: 'Elections & transitions',
    group: 'Statecraft',
    terms: ['election', 'referendum', 'ballot', 'inauguration', 'resign', 'impeach', 'no-confidence'],
  },
  {
    id: 'borders',
    label: 'Border & territorial disputes',
    group: 'Statecraft',
    terms: ['border dispute', 'territorial', 'sovereignty', 'annex', 'demarcation', 'exclusive economic zone', 'airspace violation'],
  },
  {
    id: 'espionage',
    label: 'Espionage & influence',
    group: 'Statecraft',
    terms: ['espionage', 'spy', 'intelligence agency', 'covert', 'disinformation', 'interference', 'expelled diplomats'],
  },

  // Energy & commodities
  {
    id: 'oil',
    label: 'Oil',
    group: 'Energy & commodities',
    terms: ['crude', 'oil price', 'barrel', 'refinery', 'opec', 'pipeline', 'brent', 'wti'],
  },
  {
    id: 'gas-lng',
    label: 'Gas & LNG',
    group: 'Energy & commodities',
    terms: ['natural gas', 'lng', 'gas pipeline', 'gas supply', 'gazprom', 'terminal'],
  },
  {
    id: 'power-grid',
    label: 'Power & grid',
    group: 'Energy & commodities',
    terms: ['blackout', 'power outage', 'grid failure', 'electricity', 'power plant', 'load shedding', 'substation'],
  },
  {
    id: 'renewables',
    label: 'Renewables & nuclear power',
    group: 'Energy & commodities',
    terms: ['solar', 'wind farm', 'hydrogen', 'reactor', 'renewable', 'battery storage', 'grid connection'],
  },
  {
    id: 'metals',
    label: 'Metals & critical minerals',
    group: 'Energy & commodities',
    terms: ['rare earth', 'lithium', 'cobalt', 'copper', 'nickel', 'mining', 'smelter', 'critical minerals'],
  },
  {
    id: 'food',
    label: 'Food & agriculture',
    group: 'Energy & commodities',
    terms: ['grain', 'wheat', 'harvest', 'fertiliser', 'fertilizer', 'food price', 'export ban', 'crop'],
  },

  // Economy
  {
    id: 'inflation',
    label: 'Inflation & rates',
    group: 'Economy',
    terms: ['inflation', 'interest rate', 'central bank', 'rate cut', 'rate hike', 'monetary policy', 'consumer price'],
  },
  {
    id: 'markets',
    label: 'Markets',
    group: 'Economy',
    terms: ['stock market', 'equities', 'bond yield', 'selloff', 'rally', 'index fell', 'index rose', 'volatility'],
  },
  {
    id: 'currency',
    label: 'Currencies',
    group: 'Economy',
    terms: ['currency', 'exchange rate', 'devaluation', 'lira', 'yuan', 'dollar index', 'peg', 'capital controls'],
  },
  {
    id: 'debt',
    label: 'Debt & default',
    group: 'Economy',
    terms: ['default', 'debt restructuring', 'bailout', 'imf', 'sovereign debt', 'credit rating', 'downgrade'],
  },
  {
    id: 'trade',
    label: 'Trade & supply chains',
    group: 'Economy',
    terms: ['supply chain', 'trade deal', 'shipping rates', 'port congestion', 'container', 'freight', 'customs'],
  },
  {
    id: 'labour',
    label: 'Labour & strikes',
    group: 'Economy',
    terms: ['strike', 'walkout', 'union', 'layoffs', 'job cuts', 'unemployment', 'collective bargaining'],
  },

  // Technology
  {
    id: 'ai',
    label: 'Artificial intelligence',
    group: 'Technology',
    terms: ['artificial intelligence', 'ai model', 'machine learning', 'chatbot', 'data centre', 'data center', 'gpu', 'compute'],
  },
  {
    id: 'semis',
    label: 'Semiconductors',
    group: 'Technology',
    terms: ['semiconductor', 'chipmaker', 'chip export', 'foundry', 'wafer', 'lithography', 'tsmc', 'asml'],
  },
  {
    id: 'cyber',
    label: 'Cyber & infrastructure attacks',
    group: 'Technology',
    terms: ['cyberattack', 'ransomware', 'data breach', 'hacked', 'malware', 'zero-day', 'ddos', 'undersea cable'],
  },
  {
    id: 'space',
    label: 'Space',
    group: 'Technology',
    terms: ['satellite', 'launch', 'orbit', 'rocket', 'spacecraft', 'space agency', 'gps jamming'],
  },
  {
    id: 'platforms',
    label: 'Platforms & regulation',
    group: 'Technology',
    terms: ['antitrust', 'privacy law', 'content moderation', 'social media ban', 'app store', 'regulator fined'],
  },

  // Climate & environment
  {
    id: 'extreme-weather',
    label: 'Extreme weather',
    group: 'Climate & environment',
    terms: ['hurricane', 'typhoon', 'cyclone', 'heatwave', 'flooding', 'drought', 'blizzard', 'storm surge'],
  },
  {
    id: 'wildfire',
    label: 'Wildfire',
    group: 'Climate & environment',
    terms: ['wildfire', 'bushfire', 'forest fire', 'evacuation order', 'burn area', 'firefighters'],
  },
  {
    id: 'geohazard',
    label: 'Earthquakes & volcanoes',
    group: 'Climate & environment',
    terms: ['earthquake', 'aftershock', 'tsunami', 'volcano', 'eruption', 'landslide', 'magnitude'],
  },
  {
    id: 'climate-policy',
    label: 'Climate policy',
    group: 'Climate & environment',
    terms: ['emissions', 'carbon', 'cop summit', 'net zero', 'climate finance', 'fossil fuel phase'],
  },
  {
    id: 'water',
    label: 'Water & rivers',
    group: 'Climate & environment',
    terms: ['water shortage', 'reservoir', 'dam', 'river level', 'aquifer', 'desalination', 'canal draft'],
  },

  // Health
  {
    id: 'outbreak',
    label: 'Outbreaks',
    group: 'Health',
    terms: ['outbreak', 'epidemic', 'pandemic', 'cholera', 'measles', 'ebola', 'avian influenza', 'quarantine'],
  },
  {
    id: 'health-systems',
    label: 'Health systems',
    group: 'Health',
    terms: ['hospital', 'vaccine', 'who declares', 'medical supplies', 'health ministry', 'drug shortage'],
  },

  // Society
  {
    id: 'protest',
    label: 'Protests & unrest',
    group: 'Society',
    terms: ['protest', 'demonstration', 'riot', 'unrest', 'clashes', 'crackdown', 'curfew', 'tear gas'],
  },
  {
    id: 'migration',
    label: 'Migration & displacement',
    group: 'Society',
    terms: ['refugee', 'migrant', 'displaced', 'asylum', 'border crossing', 'deportation', 'camp'],
  },
  {
    id: 'humanitarian',
    label: 'Humanitarian crisis',
    group: 'Society',
    terms: ['famine', 'starvation', 'aid convoy', 'humanitarian', 'malnutrition', 'relief effort', 'shelter'],
  },
  // Business
  {
    id: 'earnings',
    label: 'Earnings & guidance',
    group: 'Business',
    terms: ['earnings', 'quarterly results', 'profit warning', 'revenue growth', 'guidance cut', 'record profit'],
  },
  {
    id: 'mergers',
    label: 'Deals & takeovers',
    group: 'Business',
    terms: ['acquisition', 'merger', 'takeover bid', 'buyout', 'ipo', 'stake sale', 'spin-off'],
  },
  {
    id: 'aviation-shipping',
    label: 'Aviation & shipping',
    group: 'Business',
    terms: ['airline', 'aircraft order', 'grounded fleet', 'shipping line', 'container rates', 'port strike', 'boeing', 'airbus'],
  },
  {
    id: 'autos',
    label: 'Autos & EVs',
    group: 'Business',
    terms: ['carmaker', 'electric vehicle', 'ev sales', 'battery plant', 'recall', 'assembly plant'],
  },
  {
    id: 'pharma',
    label: 'Pharma & biotech',
    group: 'Business',
    terms: ['drugmaker', 'clinical trial', 'fda approval', 'patent expiry', 'vaccine maker', 'biotech'],
  },

  // Society, continued
  {
    id: 'culture',
    label: 'Culture & media',
    group: 'Society',
    terms: ['film festival', 'box office', 'streaming service', 'album', 'museum', 'press freedom', 'journalist detained'],
  },
  {
    id: 'education',
    label: 'Education & science',
    group: 'Society',
    terms: ['university', 'research funding', 'peer-reviewed', 'study finds', 'academic', 'scientists said'],
  },

  // Sport
  {
    id: 'football',
    label: 'Football',
    group: 'Sport',
    terms: ['football', 'soccer', 'premier league', 'la liga', 'serie a', 'bundesliga', 'champions league', 'fifa', 'uefa', 'transfer fee'],
  },
  {
    id: 'motorsport',
    label: 'Motorsport',
    group: 'Sport',
    terms: ['formula 1', 'formula one', 'grand prix', 'motogp', 'rally', 'pole position', 'podium finish'],
  },
  {
    id: 'olympics',
    label: 'Olympics & athletics',
    group: 'Sport',
    terms: ['olympic', 'olympics', 'athletics', 'world championship', 'gold medal', 'sprinter', 'marathon'],
  },
  {
    id: 'us-sports',
    label: 'US leagues',
    group: 'Sport',
    terms: ['nba', 'nfl', 'mlb', 'nhl', 'super bowl', 'playoffs', 'quarterback', 'touchdown'],
  },
  {
    id: 'cricket-tennis',
    label: 'Cricket & tennis',
    group: 'Sport',
    terms: ['cricket', 'test match', 'wicket', 'tennis', 'grand slam', 'wimbledon', 'us open', 'roland garros'],
  },
  {
    id: 'sport-business',
    label: 'Sport business & doping',
    group: 'Sport',
    terms: ['doping', 'anti-doping', 'wada', 'match-fixing', 'broadcast rights', 'sponsorship deal', 'banned substance'],
  },
  {
    id: 'justice',
    label: 'Courts & accountability',
    group: 'Society',
    terms: ['court ruled', 'indicted', 'war crimes', 'icc', 'tribunal', 'verdict', 'arrest warrant', 'inquiry'],
  },
];

/** A topic the user defined, either typed literally or expanded by the model. */
export interface CustomTopic {
  id: string;
  label: string;
  terms: string[];
  origin: 'manual' | 'ai';
  /** The model's one-line reading of the request, shown so it can be checked. */
  note?: string;
}

const escapeRe = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cache = new Map<string, RegExp>();

function matcherFor(terms: string[]): RegExp {
  const key = terms.join(' ');
  const hit = cache.get(key);
  if (hit) return hit;

  // Word-boundary alternation, Unicode-aware so non-Latin headlines still match.
  const pattern = new RegExp(
    `(^|[^\\p{L}])(${terms.map(escapeRe).join('|')})([^\\p{L}]|$)`,
    'iu',
  );
  cache.set(key, pattern);
  return pattern;
}

export const topicMatches = (text: string, terms: string[]): boolean =>
  terms.length > 0 && matcherFor(terms).test(text);

export const TOPIC_BY_ID = new Map(TOPIC_CATALOG.map((topic) => [topic.id, topic]));
