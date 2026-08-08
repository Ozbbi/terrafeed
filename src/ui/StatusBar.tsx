import { fmtAgo, fmtNumber, fmtPct } from '../lib/format';
import { MARKET_ATTRIBUTION } from '../sources/markets';
import { LAYERS } from '../sources/registry';
import { useStore } from '../state/store';

export function StatusBar() {
  const quotes = useStore((s) => s.quotes);
  const quotesUpdatedAt = useStore((s) => s.quotesUpdatedAt);
  const layerState = useStore((s) => s.layerState);
  const layerOn = useStore((s) => s.layerOn);
  const signals = useStore((s) => s.signals);
  const paused = useStore((s) => s.paused);

  const active = LAYERS.filter((layer) => layerOn[layer.id]);
  const failing = active.filter((layer) => layerState[layer.id]?.status === 'error');
  const oldest = active
    .map((layer) => layerState[layer.id]?.updatedAt ?? 0)
    .filter(Boolean)
    .sort((a, b) => a - b)[0];

  return (
    <footer className="statusbar">
      <div className="ticker" title={MARKET_ATTRIBUTION}>
        <div className="ticker-track">
          {quotes.concat(quotes).map((quote, index) => (
            <span className="quote" key={`${quote.symbol}-${index}`}>
              <span className="quote-label">{quote.label}</span>
              <span className="quote-last">{fmtNumber(quote.last)}</span>
              <span className={quote.changePct >= 0 ? 'quote-up' : 'quote-down'}>
                {fmtPct(quote.changePct, 2)}
              </span>
            </span>
          ))}
          {!quotes.length && <span className="quote muted">Market data unavailable</span>}
        </div>
      </div>

      <div className="status-meta">
        {paused && <span className="pill warn">paused</span>}
        {failing.length > 0 && (
          <span
            className="pill error"
            title={failing
              .map((layer) => `${layer.label}: ${layerState[layer.id]?.error}`)
              .join('\n')}
          >
            {failing.length} layer{failing.length > 1 ? 's' : ''} failing
          </span>
        )}
        <span className="pill">{fmtNumber(signals.length)} signals</span>
        <span className="pill">{active.length} layers</span>
        {oldest ? <span className="pill">oldest {fmtAgo(oldest)}</span> : null}
        {quotesUpdatedAt ? (
          <span className="pill" title={MARKET_ATTRIBUTION}>
            quotes {fmtAgo(quotesUpdatedAt)}
          </span>
        ) : null}
      </div>
    </footer>
  );
}
