import { fmtAgo, fmtCoord, fmtNumber, fmtTime, severityLabel } from '../lib/format';
import { openArticle } from '../lib/open';
import { TOPIC_BY_ID } from '../data/topics';
import { layerColor, layerLabel } from '../sources/registry';
import { ResearchBlock } from './ResearchBlock';
import { useStore } from '../state/store';

export function DetailCard() {
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const selectCountry = useStore((s) => s.selectCountry);
  const db = useStore((s) => s.db);
  const settings = useStore((s) => s.settings);

  if (!selected) return null;

  const country = selected.iso3 ? db?.byIso3.get(selected.iso3) : null;
  const preferInApp = settings.useInAppBrowser;

  const labelFor = (topicId: string): string =>
    TOPIC_BY_ID.get(topicId)?.label ??
    settings.customTopics.find((topic) => topic.id === topicId)?.label ??
    topicId;

  return (
    <aside className="detail" style={{ borderTopColor: layerColor(selected.layer) }}>
      <header>
        <span className="detail-layer" style={{ color: layerColor(selected.layer) }}>
          {layerLabel(selected.layer)}
        </span>
        <button type="button" className="close" onClick={() => select(null)} aria-label="Close">
          ×
        </button>
      </header>

      {selected.image && (
        <img
          className="detail-image"
          src={selected.image}
          alt=""
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}

      <h3>{selected.title}</h3>

      {/* The whole point of clicking a dot is to reach the story, so the way
          there is the largest thing on the card rather than a footer link. */}
      {selected.url && (
        <button
          type="button"
          className="read-cta"
          onClick={() =>
            void openArticle(selected.url!, selected.title, preferInApp ? 'in-app' : 'system')
          }
        >
          <span className="read-cta-label">Read here</span>
          <span className="read-cta-sub">{selected.source}</span>
          <span className="read-cta-arrow" aria-hidden="true">
            →
          </span>
        </button>
      )}

      {selected.summary && <p className="detail-summary">{selected.summary}</p>}

      {selected.topics?.length ? (
        <div className="alert-sources">
          {selected.topics.map((topicId) => (
            <span key={topicId} className="chip topic">
              {labelFor(topicId)}
            </span>
          ))}
        </div>
      ) : null}

      <dl className="detail-grid">
        <div>
          <dt>Source</dt>
          <dd>{selected.source}</dd>
        </div>
        <div>
          <dt>Observed</dt>
          <dd title={new Date(selected.time).toISOString()}>
            {fmtTime(selected.time)} · {fmtAgo(selected.time)} ago
          </dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>{fmtCoord(selected.lon, selected.lat)}</dd>
        </div>
        <div>
          <dt>Severity</dt>
          <dd className={`sev ${severityLabel(selected.severity)}`}>
            {severityLabel(selected.severity)} · {Math.round(selected.severity * 100)}
          </dd>
        </div>
        {country && (
          <div>
            <dt>Country</dt>
            <dd>
              <button type="button" className="link" onClick={() => selectCountry(country.iso3)}>
                {country.name}
              </button>
            </dd>
          </div>
        )}
        {Object.entries(selected.meta ?? {}).map(([key, value]) => (
          <div key={key}>
            <dt>{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt>
            <dd>{typeof value === 'number' ? fmtNumber(value) : String(value)}</dd>
          </div>
        ))}
      </dl>

      {/* The main way in is the button at the top; this is just the other
          browser, for when the reader window will not do. */}
      {selected.url && (
        <button
          type="button"
          className="ghost wide"
          onClick={() =>
            void openArticle(selected.url!, selected.title, preferInApp ? 'system' : 'in-app')
          }
        >
          {preferInApp ? 'Open in system browser instead' : 'Open in the Terrafeed reader instead'}
        </button>
      )}

      {(selected.layer === 'news' || selected.layer === 'sport' || selected.layer === 'relief') && (
        <ResearchBlock signal={selected} />
      )}
    </aside>
  );
}
