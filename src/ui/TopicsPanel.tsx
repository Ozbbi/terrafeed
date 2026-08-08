import { useState } from 'react';

import { buildTopic, manualTopic } from '../analysis/topicBuilder';
import { TOPIC_CATALOG, TOPIC_GROUPS } from '../data/topics';
import { useStore } from '../state/store';

export function TopicsPanel() {
  const settings = useStore((s) => s.settings);
  const topicCounts = useStore((s) => s.topicCounts);
  const toggleTopic = useStore((s) => s.toggleTopic);
  const clearTopics = useStore((s) => s.clearTopics);
  const addCustomTopic = useStore((s) => s.addCustomTopic);
  const removeCustomTopic = useStore((s) => s.removeCustomTopic);
  const signals = useStore((s) => s.signals);
  const visible = useStore((s) => s.visibleSignals);

  const [request, setRequest] = useState('');
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  const hasKey = settings.keys.anthropic.trim().length > 0;

  const query = search.trim().toLowerCase();
  const picked = TOPIC_CATALOG.filter((topic) => settings.topics.includes(topic.id));
  // Search the terms too, so "chip" finds Semiconductors even though the label
  // never says it.
  const matches = query
    ? TOPIC_CATALOG.filter(
        (topic) =>
          topic.label.toLowerCase().includes(query) ||
          topic.terms.some((term) => term.toLowerCase().includes(query)),
      )
    : [];
  const active = settings.topics.length + settings.customTopics.length;

  const newsTotal = signals.filter((s) => s.layer === 'news' || s.layer === 'relief').length;
  const newsShown = visible.filter((s) => s.layer === 'news' || s.layer === 'relief').length;

  async function submit() {
    const text = request.trim();
    if (!text || building) return;

    setError('');
    setBuilding(true);
    try {
      const topic = hasKey ? await buildTopic(settings.keys.anthropic.trim(), text) : manualTopic(text);
      addCustomTopic(topic);
      setRequest('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="panel scroll">
      <div className="topic-intro">
        <p>
          Pick what you want on the map. With nothing selected every story is shown; select a topic
          and the feed narrows to stories matching it. Alerts are not affected — they keep watching
          everything you armed.
        </p>
        <div className="topic-status">
          <span className="pill">
            {active ? `${newsShown} of ${newsTotal} stories` : `${newsTotal} stories`}
          </span>
          {active > 0 && (
            <button type="button" className="ghost" onClick={clearTopics}>
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="topic-builder">
        <label htmlFor="topic-request">Describe a topic in your own words</label>
        <textarea
          id="topic-request"
          rows={2}
          value={request}
          placeholder={
            hasKey
              ? 'e.g. anything that could disrupt chip supply out of Taiwan'
              : 'e.g. semiconductor, chip export, foundry'
          }
          onChange={(event) => setRequest(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void submit();
          }}
        />
        <div className="topic-builder-actions">
          <span className="hint-block">
            {hasKey
              ? 'Claude turns this into the words headlines actually use.'
              : 'Matched literally. Add an Anthropic key in Settings to have it expanded into synonyms and jargon.'}
          </span>
          <button type="button" className="primary" onClick={() => void submit()} disabled={building}>
            {building ? 'Building…' : 'Add topic'}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      {settings.customTopics.length > 0 && (
        <div className="topic-group">
          <h3>Yours</h3>
          {settings.customTopics.map((topic) => (
            <div key={topic.id} className="custom-topic">
              <div className="custom-topic-head">
                <strong>{topic.label}</strong>
                <span className="topic-count">{topicCounts[topic.id] ?? 0}</span>
                <button
                  type="button"
                  className="close"
                  onClick={() => removeCustomTopic(topic.id)}
                  aria-label={`Remove ${topic.label}`}
                >
                  ×
                </button>
              </div>
              {topic.note && <p className="custom-topic-note">{topic.note}</p>}
              <div className="alert-sources">
                {topic.terms.slice(0, 12).map((term) => (
                  <span key={term} className="chip">
                    {term}
                  </span>
                ))}
                {topic.terms.length > 12 && (
                  <span className="chip">+{topic.terms.length - 12}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <input
        type="search"
        className="topic-search"
        placeholder="Search topics…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {picked.length > 0 && (
        <div className="topic-group">
          <h3>Watching</h3>
          <div className="topic-chips">
            {picked.map((topic) => (
              <button
                key={topic.id}
                type="button"
                className="topic-chip on"
                onClick={() => toggleTopic(topic.id)}
                title="Click to stop watching"
              >
                {topic.label}
                <span className="topic-count">{topicCounts[topic.id] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {query ? (
        <div className="topic-group">
          <h3>{matches.length} matching</h3>
          <div className="topic-chips">
            {matches.map((topic) => (
              <button
                key={topic.id}
                type="button"
                className={settings.topics.includes(topic.id) ? 'topic-chip on' : 'topic-chip'}
                onClick={() => toggleTopic(topic.id)}
                title={topic.terms.join(', ')}
              >
                {topic.label}
              </button>
            ))}
          </div>
          {!matches.length && <p className="empty">Nothing matches — try the box above to make your own.</p>}
        </div>
      ) : (
        TOPIC_GROUPS.map((group) => {
          const topics = TOPIC_CATALOG.filter(
            (topic) => topic.group === group && !settings.topics.includes(topic.id),
          );
          if (!topics.length) return null;
          // Groups start closed: the point of the panel is the handful you are
          // watching, not a wall of everything on offer.
          const open = expanded[group] ?? false;

          return (
            <div className="topic-group" key={group}>
              <h3>
                <button
                  type="button"
                  className="group-toggle"
                  onClick={() => setExpanded({ ...expanded, [group]: !open })}
                >
                  {open ? '▾' : '▸'} {group}
                  <span className="group-count">{topics.length}</span>
                </button>
              </h3>
              {open && (
                <div className="topic-chips">
                  {topics.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      className="topic-chip"
                      onClick={() => toggleTopic(topic.id)}
                      title={topic.terms.join(', ')}
                    >
                      {topic.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
