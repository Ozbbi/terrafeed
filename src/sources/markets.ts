import { cached } from '../lib/cache';
import { getJson } from '../lib/net';

export interface Quote {
  symbol: string;
  label: string;
  group: 'Indices' | 'Energy' | 'Metals' | 'FX' | 'Crypto' | 'Agriculture';
  last: number;
  previousClose: number;
  changePct: number;
  currency: string;
  time: number;
}

/** Yahoo's chart endpoint: keyless, one instrument per call, and it reports a
 *  real previous close — so the change figure is a session move rather than a
 *  distance from the opening print. */
const INSTRUMENTS: { symbol: string; label: string; group: Quote['group'] }[] = [
  { symbol: '^GSPC', label: 'S&P 500', group: 'Indices' },
  { symbol: '^NDX', label: 'Nasdaq 100', group: 'Indices' },
  { symbol: '^DJI', label: 'Dow Jones', group: 'Indices' },
  { symbol: '^GDAXI', label: 'DAX', group: 'Indices' },
  { symbol: '^N225', label: 'Nikkei 225', group: 'Indices' },
  { symbol: '^HSI', label: 'Hang Seng', group: 'Indices' },
  { symbol: 'XU100.IS', label: 'BIST 100', group: 'Indices' },
  { symbol: 'CL=F', label: 'WTI crude', group: 'Energy' },
  { symbol: 'NG=F', label: 'Natural gas', group: 'Energy' },
  { symbol: 'GC=F', label: 'Gold', group: 'Metals' },
  { symbol: 'SI=F', label: 'Silver', group: 'Metals' },
  { symbol: 'HG=F', label: 'Copper', group: 'Metals' },
  { symbol: 'ZW=F', label: 'Wheat', group: 'Agriculture' },
  { symbol: 'EURUSD=X', label: 'EUR/USD', group: 'FX' },
  { symbol: 'USDTRY=X', label: 'USD/TRY', group: 'FX' },
  { symbol: 'USDJPY=X', label: 'USD/JPY', group: 'FX' },
  { symbol: 'BTC-USD', label: 'Bitcoin', group: 'Crypto' },
  { symbol: 'ETH-USD', label: 'Ethereum', group: 'Crypto' },
];

interface ChartResponse {
  chart?: {
    result?: {
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        currency?: string;
        regularMarketTime?: number;
      };
    }[];
    error?: unknown;
  };
}

async function loadOne(instrument: (typeof INSTRUMENTS)[number]): Promise<Quote | null> {
  const url =
    'https://query1.finance.yahoo.com/v8/finance/chart/' +
    `${encodeURIComponent(instrument.symbol)}?interval=1d&range=5d`;

  const data = await cached(`yf:${instrument.symbol}`, 90_000, () => getJson<ChartResponse>(url));
  const meta = data.chart?.result?.[0]?.meta;
  const last = meta?.regularMarketPrice;
  const previousClose = meta?.chartPreviousClose ?? meta?.previousClose;

  if (typeof last !== 'number' || typeof previousClose !== 'number' || previousClose === 0) {
    return null;
  }

  return {
    symbol: instrument.symbol,
    label: instrument.label,
    group: instrument.group,
    last,
    previousClose,
    changePct: ((last - previousClose) / previousClose) * 100,
    currency: meta?.currency ?? '',
    time: (meta?.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000,
  };
}

export async function loadQuotes(): Promise<Quote[]> {
  const settled = await Promise.allSettled(INSTRUMENTS.map(loadOne));

  return settled.flatMap((result) =>
    result.status === 'fulfilled' && result.value ? [result.value] : [],
  );
}

export const MARKET_ATTRIBUTION = 'Yahoo Finance — delayed quotes, previous-close basis';
