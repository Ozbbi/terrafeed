import { useEffect, useMemo, useState } from 'react';

import { fmtAgo } from '../lib/format';
import { openArticle } from '../lib/open';
import type { Signal } from '../sources/types';
import { useStore } from '../state/store';

const ROTATE_MS = 5000;
const MAX_STORIES = 60;

/**
 * One story per country, so the rotation actually travels: without this the
 * list fills with whichever place the wires are hammering that hour and the
 * panel shows the same conflict eight times running.
 */
/** Two outlets running the same story word-for-word should occupy one slot. */
const titleKey = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 7)
    .join(' ');

function oneStoryPerCountry(signals: Signal[]): Signal[] {
  const now = Date.now();
  const score = (s: Signal) => s.severity * 100 + (s.image ? 4 : 0) - (now - s.time) / 3_600_000;
  const keep = (map: Map<string, Signal>, key: string, signal: Signal) => {
    const current = map.get(key);
    if (!current || score(signal) > score(current)) map.set(key, signal);
  };

  const byStory = new Map<string, Signal>();
  for (const signal of signals) {
    if (signal.layer !== 'news' && signal.layer !== 'gdacs' && signal.layer !== 'relief') continue;
    if (now - signal.time > 24 * 3_600_000) continue;
    keep(byStory, titleKey(signal.title) || signal.id, signal);
  }

  // Then one slot per place, so the rotation travels instead of parking on
  // whichever conflict the wires are hammering this hour.
  const byPlace = new Map<string, Signal>();
  for (const signal of byStory.values()) {
    keep(byPlace, signal.iso3 ?? `region:${signal.meta?.region ?? signal.source}`, signal);
  }

  return [...byPlace.values()]
    .sort((a, b) => b.severity - a.severity || b.time - a.time)
    .slice(0, MAX_STORIES);
}

export function BreakingPanel() {
  const signals = useStore((s) => s.visibleSignals);
  const select = useStore((s) => s.select);
  const selected = useStore((s) => s.selected);
  const db = useStore((s) => s.db);
  const settings = useStore((s) => s.settings);

  const [index, setIndex] = useState(0);
  const [holding, setHolding] = useState(false);

  const stories = useMemo(() => oneStoryPerCountry(signals), [signals]);

  useEffect(() => {
    if (holding || stories.length < 2) return;
    const id = window.setInterval(() => setIndex((n) => n + 1), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [holding, stories.length]);

  // The list is rebuilt on every poll; wrapping keeps the position valid
  // without resetting to the top and losing the reader's place.
  const story = stories.length ? stories[index % stories.length] : null;

  if (!story) {
    return (
      <section className="panel breaking">
        <h2>Breaking</h2>
        <p className="empty">Waiting for the first stories to land.</p>
      </section>
    );
  }

  const country = story.iso3 ? db?.byIso3.get(story.iso3)?.name : null;
  // Never label a publisher as if it were a place: fall back to the desk's
  // region, and only then to nothing at all.
  const place = country ?? (story.meta?.region ? String(story.meta.region) : null);
  const position = (index % stories.length) + 1;

  return (
    <section
      className="panel breaking"
      onMouseEnter={() => setHolding(true)}
      onMouseLeave={() => setHolding(false)}
    >
      <h2>
        Breaking
        <span className="breaking-pos">
          {position}/{stories.length}
          {holding ? ' · held' : ''}
        </span>
      </h2>

      <article className={['breaking-card', selected?.id === story.id ? 'active' : '', story.stale ? 'stale' : ''].filter(Boolean).join(' ')}>
        <button type="button" className="breaking-body" onClick={() => select(story)}>
          {story.image && (
            <img
              className="breaking-image"
              src={story.image}
              alt=""
              referrerPolicy="no-referrer"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          )}
          <span className="breaking-meta">
            <span className="breaking-country">{place ?? story.source}</span>
            <span className="ago">{fmtAgo(story.time)}</span>
          </span>
          <span className="breaking-title">{story.title}</span>
          <span className="breaking-source">{place ? story.source : ''}</span>
        </button>

        {story.url && (
          <button
            type="button"
            className="breaking-open"
            onClick={() =>
              void openArticle(
                story.url!,
                story.title,
                settings.useInAppBrowser ? 'in-app' : 'system',
              )
            }
          >
            Read →
          </button>
        )}
      </article>

      <div className="breaking-progress" aria-hidden="true">
        <span
          key={`${story.id}-${holding}`}
          className={holding ? 'breaking-bar paused' : 'breaking-bar'}
        />
      </div>

      <div className="breaking-nav">
        <button type="button" onClick={() => setIndex((n) => n - 1 + stories.length)}>
          ‹
        </button>
        <span className="hint">rotates every 5s · hover to hold</span>
        <button type="button" onClick={() => setIndex((n) => n + 1)}>
          ›
        </button>
      </div>
    </section>
  );
}
