import { fmtAgo, severityLabel } from '../lib/format';
import { layerColor } from '../sources/registry';
import { useStore } from '../state/store';

export function AlertsPanel() {
  const alerts = useStore((s) => s.alerts);
  const acknowledge = useStore((s) => s.acknowledge);
  const select = useStore((s) => s.select);

  if (!alerts.length) {
    return (
      <div className="panel scroll">
        <p className="empty">
          No rule has enough corroboration to fire. Rules need several independent sources to agree
          before an alert appears — quiet here is the expected state.
        </p>
      </div>
    );
  }

  return (
    <div className="panel scroll">
      {alerts.map((alert) => (
        <article
          key={alert.id}
          className={alert.acknowledged ? 'alert acked' : 'alert'}
          style={{ borderLeftColor: layerColor(alert.signals[0]?.layer ?? 'news') }}
        >
          <header>
            <span className={`sev ${severityLabel(alert.severity)}`}>
              {severityLabel(alert.severity)}
            </span>
            <span className="rule">{alert.ruleLabel}</span>
            <span className="ago">{fmtAgo(alert.time)}</span>
          </header>

          <button type="button" className="alert-title" onClick={() => select(alert.signals[0])}>
            {alert.title}
          </button>

          <p className="alert-detail">{alert.detail}</p>

          <div className="alert-sources">
            {alert.sources.slice(0, 6).map((source) => (
              <span key={source} className="chip">
                {source}
              </span>
            ))}
          </div>

          {!alert.acknowledged && (
            <button type="button" className="ack" onClick={() => acknowledge(alert.id)}>
              Acknowledge
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
