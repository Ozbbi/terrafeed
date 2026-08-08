import { useMemo, useState } from 'react';

import { fmtAgo } from '../lib/format';
import { TOPIC_BY_ID } from '../data/topics';
import { layerColor, layerLabel, LAYERS } from '../sources/registry';
import type { LayerId } from '../sources/types';
import { useStore } from '../state/store';

/** Layers that produce discrete, timestamped events worth listing. */
const LIVE_TRACKING: LayerId[] = ['milair', 'vessels', 'sats'];
const FEED_LAYERS = LAYERS.filter(
  (layer) => layer.id !== 'chokepoints' && !LIVE_TRACKING.includes(layer.id),
);

export function FeedPanel() {
  const signals = useStore((s) => s.visibleSignals);
  const settings = useStore((s) => s.settings);
  const select = useStore((s) => s.select);
  const selected = useStore((s) => s.selected);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LayerId | 'all'>('all');

  const watching = settings.topics.length + settings.customTopics.length > 0;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return signals
      // Continuously-tracked objects carry "now" as their timestamp, so in a
      // time-sorted list a few hundred aircraft bury every story on the page.
      // They belong on the map, not in a feed of things that happened.
      .filter((signal) => !signal.live)
      .filter((signal) => signal.layer !== 'chokepoints')
      .filter((signal) => filter === 'all' || signal.layer === filter)
      .filter(
        (signal) =>
          !needle ||
          signal.title.toLowerCase().includes(needle) ||
          (signal.summary ?? '').toLowerCase().includes(needle),
      )
      .sort((a, b) => b.time - a.time)
      .slice(0, 250);
  }, [signals, query, filter]);

  const labelFor = (topicId: string): string =>
    TOPIC_BY_ID.get(topicId)?.label ??
    settings.customTopics.find((topic) => topic.id === topicId)?.label ??
    topicId;

  return (
    <div className="panel scroll">
      <div className="feed-controls">
        <input
          type="search"
          placeholder="Filter the feed…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select value={filter} onChange={(event) => setFilter(event.target.value as LayerId)}>
          <option value="all">All layers</option>
          {FEED_LAYERS.map((layer) => (
            <option key={layer.id} value={layer.id}>
              {layer.label}
            </option>
          ))}
        </select>
      </div>

      {!rows.length && (
        <p className="empty">
          {watching
            ? 'Nothing in the feed matches the topics you are watching yet.'
            : 'Nothing matches yet.'}
        </p>
      )}

      {rows.map((signal) => (
        <button
          key={signal.id}
          type="button"
          className={['feed-row', selected?.id === signal.id ? 'selected' : '', signal.stale ? 'stale' : ''].filter(Boolean).join(' ')}
          onClick={() => select(signal)}
          style={{ borderLeftColor: layerColor(signal.layer) }}
        >
          <span className="feed-head">
            <span className="feed-source">{signal.source}</span>
            <span className="ago">{fmtAgo(signal.time)}</span>
            {signal.stale && <span className="stale-tag" title="Still on the map past its feed window because of how serious it is">held</span>}
          </span>

          <span className="feed-main">
            {/* Every row gets a picture slot, so the list keeps one rhythm
                instead of jumping between tall and short rows. Publishers that
                ship no art fall back to a tile in the layer's own colour. */}
            <span
              className={signal.image ? 'feed-thumb' : 'feed-thumb placeholder'}
              style={
                signal.image
                  ? undefined
                  : { background: `${layerColor(signal.layer)}22`, color: layerColor(signal.layer) }
              }
            >
              {signal.image ? (
                <img
                  src={signal.image}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    const slot = event.currentTarget.parentElement;
                    if (!slot) return;
                    slot.classList.add('placeholder');
                    slot.style.background = `${layerColor(signal.layer)}22`;
                    slot.style.color = layerColor(signal.layer);
                    event.currentTarget.remove();
                  }}
                />
              ) : (
                signal.source.slice(0, 2).toUpperCase()
              )}
            </span>
            <span className="feed-title">{signal.title}</span>
          </span>

          <span className="feed-meta">
            {layerLabel(signal.layer)}
            {signal.topics?.map((topicId) => (
              <span key={topicId} className="chip topic">
                {labelFor(topicId)}
              </span>
            ))}
            {signal.url && <span className="feed-read">Read →</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
