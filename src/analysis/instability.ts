import type { Signal } from '../sources/types';
import type { IndicatorSeries } from '../sources/worldbank';
import { clamp01 } from '../sources/types';

export interface Component {
  key: string;
  label: string;
  /** 0..100, higher means more stress. */
  score: number;
  weight: number;
  detail: string;
}

export interface InstabilityScore {
  total: number;
  components: Component[];
  /** Signals that drove the event and news components. */
  drivers: Signal[];
  sampleSize: number;
}

/** Maps a value onto 0..100 stress, linearly between two anchor points. */
function ramp(value: number, calm: number, severe: number): number {
  if (!Number.isFinite(value)) return 0;
  const t = (value - calm) / (severe - calm);
  return clamp01(t) * 100;
}

const latest = (series: IndicatorSeries[], code: string): number | null =>
  series.find((s) => s.code === code)?.latest?.value ?? null;

/**
 * A transparent composite, not a forecast. Structural terms come from World Bank
 * annual data; pressure terms come from what Terrafeed has actually observed in
 * the country over the last two days. Every component is shown to the user with
 * its own score, so a high total can always be traced back to its cause.
 */
export function instabilityScore(
  iso3: string,
  indicators: IndicatorSeries[],
  signals: Signal[],
): InstabilityScore {
  const now = Date.now();
  const window = 48 * 3_600_000;
  const inCountry = signals.filter(
    (signal) => signal.iso3 === iso3 && now - signal.time <= window,
  );

  const eventSignals = inCountry.filter(
    (signal) => signal.layer !== 'news' && signal.layer !== 'sats',
  );
  const newsSignals = inCountry.filter((signal) => signal.layer === 'news');

  const eventPressure = eventSignals.reduce(
    (sum, signal) => sum + signal.severity * (1 - (now - signal.time) / window) ** 0.5,
    0,
  );
  const newsPressure = newsSignals.reduce(
    (sum, signal) => sum + (signal.severity >= 0.55 ? signal.severity : signal.severity * 0.25),
    0,
  );

  const inflation = latest(indicators, 'FP.CPI.TOTL.ZG');
  const growth = latest(indicators, 'NY.GDP.MKTP.KD.ZG');
  const unemployment = latest(indicators, 'SL.UEM.TOTL.ZS');

  const components: Component[] = [
    {
      key: 'inflation',
      label: 'Price stability',
      score: inflation == null ? 0 : ramp(inflation, 2, 40),
      weight: inflation == null ? 0 : 0.15,
      detail: inflation == null ? 'no recent World Bank reading' : `${inflation.toFixed(1)}% yoy`,
    },
    {
      key: 'growth',
      label: 'Output',
      score: growth == null ? 0 : ramp(-growth, -6, 6),
      weight: growth == null ? 0 : 0.15,
      detail: growth == null ? 'no recent World Bank reading' : `${growth.toFixed(1)}% growth`,
    },
    {
      key: 'labour',
      label: 'Labour market',
      score: unemployment == null ? 0 : ramp(unemployment, 3, 25),
      weight: unemployment == null ? 0 : 0.12,
      detail:
        unemployment == null ? 'no recent World Bank reading' : `${unemployment.toFixed(1)}% jobless`,
    },
    {
      key: 'events',
      label: 'Observed events',
      score: ramp(eventPressure, 0, 8),
      weight: 0.33,
      detail: `${eventSignals.length} hazard/security signals in 48h`,
    },
    {
      key: 'reporting',
      label: 'Reporting pressure',
      score: ramp(newsPressure, 0, 10),
      weight: 0.25,
      detail: `${newsSignals.length} headlines placed in country`,
    },
  ];

  // Renormalise so missing indicators do not silently deflate the total.
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0) || 1;
  const total = components.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight;

  const drivers = [...inCountry]
    .sort((a, b) => b.severity - a.severity || b.time - a.time)
    .slice(0, 8);

  return { total: Math.round(total), components, drivers, sampleSize: inCountry.length };
}

export function instabilityBand(total: number): { label: string; color: string } {
  if (total >= 70) return { label: 'severe stress', color: '#e5484d' };
  if (total >= 50) return { label: 'elevated', color: '#f5a531' };
  if (total >= 30) return { label: 'watch', color: '#f2d13b' };
  return { label: 'baseline', color: '#5ef2dc' };
}
