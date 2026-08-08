import { useEffect, useMemo, useState } from 'react';

import { generateBrief } from '../analysis/brief';
import { instabilityBand, instabilityScore } from '../analysis/instability';
import { fmtAgo, fmtCompact } from '../lib/format';
import { layerColor } from '../sources/registry';
import { loadIndicators, WORLD_BANK_ATTRIBUTION, type IndicatorSeries } from '../sources/worldbank';
import { useStore } from '../state/store';

/** Percentages want a decimal; populations and dollar figures do not. */
const formatIndicator = (value: number): string =>
  Math.abs(value) >= 10_000 ? fmtCompact(value) : value.toFixed(1);

function Sparkline({ series }: { series: IndicatorSeries }) {
  const points = series.points.slice(-16);
  if (points.length < 2) return null;

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 22 - ((point.value - min) / span) * 20;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg className="spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function CountryPanel({ iso3 }: { iso3: string }) {
  const db = useStore((s) => s.db);
  const signals = useStore((s) => s.signals);
  const selectCountry = useStore((s) => s.selectCountry);
  const select = useStore((s) => s.select);
  const anthropicKey = useStore((s) => s.settings.keys.anthropic);

  const [indicators, setIndicators] = useState<IndicatorSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState('');
  const [briefState, setBriefState] = useState<'idle' | 'running' | 'error'>('idle');
  const [briefError, setBriefError] = useState('');

  const country = db?.byIso3.get(iso3) ?? null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setIndicators([]);
    setBrief('');
    setBriefState('idle');

    loadIndicators(iso3)
      .then((series) => {
        if (!cancelled) setIndicators(series);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [iso3]);

  const score = useMemo(
    () => instabilityScore(iso3, indicators, signals),
    [iso3, indicators, signals],
  );
  const band = instabilityBand(score.total);

  if (!country) return null;

  async function runBrief() {
    if (!country) return;
    setBrief('');
    setBriefError('');
    setBriefState('running');
    try {
      await generateBrief({
        apiKey: anthropicKey.trim(),
        country,
        score,
        indicators,
        signals,
        onDelta: (delta) => setBrief((current) => current + delta),
      });
      setBriefState('idle');
    } catch (error) {
      setBriefError(error instanceof Error ? error.message : String(error));
      setBriefState('error');
    }
  }

  return (
    <aside className="country">
      <header>
        <div>
          <h2>{country.nameLong}</h2>
          <p className="country-sub">
            {country.subregion} · {country.iso3}
            {country.pop ? ` · ${fmtCompact(country.pop)} people` : ''}
          </p>
        </div>
        <button type="button" className="close" onClick={() => selectCountry(null)}>
          ×
        </button>
      </header>

      <section className="score">
        <div className="score-value" style={{ color: band.color }}>
          {score.total}
          <span>/100</span>
        </div>
        <div className="score-meta">
          <strong style={{ color: band.color }}>{band.label}</strong>
          <p>
            Composite stress index — a transparent weighted blend of open indicators and what
            Terrafeed observed in the last 48 hours. Not a forecast.
          </p>
        </div>
      </section>

      <section className="components">
        {score.components.map((component) => (
          <div key={component.key} className="component">
            <span className="component-label">
              {component.label}
              <em>{component.detail}</em>
            </span>
            <span className="meter">
              <span
                className="meter-fill"
                style={{ width: `${Math.round(component.score)}%`, background: band.color }}
              />
            </span>
            <span className="component-score">{Math.round(component.score)}</span>
          </div>
        ))}
      </section>

      <section className="indicators">
        <h3>
          Structural indicators <em>{WORLD_BANK_ATTRIBUTION}</em>
        </h3>
        {loading && <p className="empty">Loading World Bank series…</p>}
        {!loading && !indicators.length && <p className="empty">No series published for {iso3}.</p>}
        <div className="indicator-grid">
          {indicators.map((series) => (
            <div key={series.code} className="indicator">
              <span className="indicator-label">{series.label}</span>
              <span className="indicator-value">
                {series.latest ? `${formatIndicator(series.latest.value)} ` : '— '}
                <em>{series.unit}</em>
              </span>
              <Sparkline series={series} />
              {series.latest && <span className="indicator-year">{series.latest.year}</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="drivers">
        <h3>Recent observations in country</h3>
        {!score.drivers.length && <p className="empty">Nothing recorded in the last 48 hours.</p>}
        {score.drivers.map((signal) => (
          <button
            key={signal.id}
            type="button"
            className="feed-row"
            onClick={() => select(signal)}
            style={{ borderLeftColor: layerColor(signal.layer) }}
          >
            <span className="feed-head">
              <span className="feed-source">{signal.source}</span>
              <span className="ago">{fmtAgo(signal.time)}</span>
            </span>
            <span className="feed-title">{signal.title}</span>
          </button>
        ))}
      </section>

      <section className="brief">
        <h3>Analyst brief</h3>
        {!anthropicKey.trim() ? (
          <p className="empty">
            Optional. Add an Anthropic API key under Settings to have a brief written from the
            observations above. Everything else on this panel works without it.
          </p>
        ) : (
          <>
            <button
              type="button"
              className="primary"
              onClick={() => void runBrief()}
              disabled={briefState === 'running'}
            >
              {briefState === 'running' ? 'Writing…' : brief ? 'Rewrite brief' : 'Write brief'}
            </button>
            {briefError && <p className="error">{briefError}</p>}
            {brief && <div className="brief-body">{brief}</div>}
          </>
        )}
      </section>
    </aside>
  );
}
