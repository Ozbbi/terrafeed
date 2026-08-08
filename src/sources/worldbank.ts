import { cached } from '../lib/cache';
import { getJson } from '../lib/net';

export interface IndicatorPoint {
  year: number;
  value: number;
}

export interface IndicatorSeries {
  code: string;
  label: string;
  unit: string;
  points: IndicatorPoint[];
  latest: IndicatorPoint | null;
}

export const INDICATORS: { code: string; label: string; unit: string }[] = [
  { code: 'FP.CPI.TOTL.ZG', label: 'Inflation', unit: '% yoy' },
  { code: 'NY.GDP.MKTP.KD.ZG', label: 'GDP growth', unit: '% yoy' },
  { code: 'SL.UEM.TOTL.ZS', label: 'Unemployment', unit: '% labour force' },
  { code: 'NY.GDP.PCAP.CD', label: 'GDP per capita', unit: 'current US$' },
  { code: 'MS.MIL.XPND.GD.ZS', label: 'Military spending', unit: '% of GDP' },
  { code: 'SP.POP.TOTL', label: 'Population', unit: 'people' },
];

interface Observation {
  indicator?: { id?: string };
  date?: string;
  value?: number | null;
}

type WorldBankResponse = [unknown, (Observation | null)[] | null];

/**
 * All six indicators come back in one call. The endpoint accepts a
 * semicolon-separated list as long as `source=2` is set, and it is slow enough
 * (double-digit seconds is normal) that six parallel requests routinely time
 * out where one does not.
 */
export async function loadIndicators(iso3: string): Promise<IndicatorSeries[]> {
  const codes = INDICATORS.map((indicator) => indicator.code).join(';');
  const url =
    `https://api.worldbank.org/v2/country/${iso3}/indicator/${codes}` +
    '?source=2&format=json&per_page=800&date=2000:2026';

  const raw = await cached(`wb:${iso3}`, 24 * 60 * 60_000, () => getJson<WorldBankResponse>(url));

  const byCode = new Map<string, IndicatorPoint[]>();
  for (const entry of raw?.[1] ?? []) {
    const code = entry?.indicator?.id;
    const year = Number(entry?.date);
    if (!code || entry?.value == null || !Number.isFinite(year)) continue;

    const points = byCode.get(code) ?? [];
    points.push({ year, value: entry.value });
    byCode.set(code, points);
  }

  return INDICATORS.flatMap<IndicatorSeries>((indicator) => {
    const points = (byCode.get(indicator.code) ?? []).sort((a, b) => a.year - b.year);
    if (!points.length) return [];
    return [{ ...indicator, points, latest: points.at(-1) ?? null }];
  });
}

export const WORLD_BANK_ATTRIBUTION = 'World Bank Open Data (CC BY 4.0)';
