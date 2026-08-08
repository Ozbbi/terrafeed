import { useState } from 'react';

import { DEFAULT_FEEDS, FEED_REGIONS, type FeedRegion } from '../data/feeds';
import { LAYERS } from '../sources/registry';
import { useStore } from '../state/store';

/** Hosts the built-in feeds already cover; anything else the user adds has to be
 *  authorised explicitly before the Rust side will fetch it. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const refreshAll = useStore((s) => s.refreshAll);

  const [keys, setKeys] = useState(settings.keys);
  const [feedName, setFeedName] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [feedRegion, setFeedRegion] = useState<FeedRegion>('Global');
  const [notifications, setNotifications] = useState(settings.notifications);
  const [rules, setRules] = useState(settings.alertRules);

  const keyedLayers = LAYERS.filter((layer) => layer.requiresKey);

  function addFeed() {
    const host = hostOf(feedUrl);
    if (!feedName.trim() || !host) return;

    void updateSettings({
      feeds: [...settings.feeds, { name: feedName.trim(), url: feedUrl.trim(), region: feedRegion }],
      customHosts: [...new Set([...settings.customHosts, host])],
    });
    setFeedName('');
    setFeedUrl('');
  }

  function removeFeed(url: string) {
    void updateSettings({ feeds: settings.feeds.filter((feed) => feed.url !== url) });
  }

  function save() {
    void updateSettings({ keys, notifications, alertRules: rules }).then(() => void refreshAll());
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>Settings</h2>
          <button type="button" className="close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="modal-body">
          <section>
            <h3>Optional API keys</h3>
            <p className="hint-block">
              Every layer above works without a key. These unlock the three that cannot: they are
              stored locally and sent only to the service they belong to.
            </p>

            {keyedLayers.map((layer) => (
              <label key={layer.id} className="field">
                <span>
                  {layer.label} <em>{layer.attribution}</em>
                </span>
                <input
                  type="password"
                  value={keys[layer.requiresKey!]}
                  placeholder="not set"
                  onChange={(event) =>
                    setKeys({ ...keys, [layer.requiresKey!]: event.target.value })
                  }
                />
              </label>
            ))}

            <label className="field">
              <span>
                Analyst brief <em>Anthropic API — optional, used only in the country panel</em>
              </span>
              <input
                type="password"
                value={keys.anthropic}
                placeholder="not set"
                onChange={(event) => setKeys({ ...keys, anthropic: event.target.value })}
              />
            </label>
          </section>

          <section>
            <h3>News feeds</h3>
            <div className="feed-list">
              {settings.feeds.map((feed) => (
                <div key={feed.url} className="feed-item">
                  <span>
                    {feed.name}
                    <em>
                      {feed.region} · {hostOf(feed.url)}
                    </em>
                  </span>
                  {!DEFAULT_FEEDS.some((preset) => preset.url === feed.url) && (
                    <button type="button" className="ghost" onClick={() => removeFeed(feed.url)}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="feed-add">
              <input
                placeholder="Name"
                value={feedName}
                onChange={(event) => setFeedName(event.target.value)}
              />
              <input
                placeholder="https://example.com/rss.xml"
                value={feedUrl}
                onChange={(event) => setFeedUrl(event.target.value)}
              />
              <select
                value={feedRegion}
                onChange={(event) => setFeedRegion(event.target.value as FeedRegion)}
              >
                {FEED_REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
              <button type="button" className="primary" onClick={addFeed}>
                Add
              </button>
            </div>
            <p className="hint-block">
              Adding a feed also authorises its host for outbound requests. Nothing outside that
              list and the built-in providers is ever fetched.
            </p>
          </section>

          <section>
            <h3>Alert rules</h3>
            <p className="hint-block">
              A rule fires only when the required number of independent sources describe the same
              place inside the window.
            </p>
            {rules.map((rule, index) => (
              <div key={rule.id} className="rule">
                <label className="rule-head">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(event) => {
                      const next = [...rules];
                      next[index] = { ...rule, enabled: event.target.checked };
                      setRules(next);
                    }}
                  />
                  <strong>{rule.label}</strong>
                </label>
                <div className="rule-body">
                  <label>
                    <span>Sources required</span>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={rule.corroboration}
                      onChange={(event) => {
                        const next = [...rules];
                        next[index] = { ...rule, corroboration: Number(event.target.value) || 1 };
                        setRules(next);
                      }}
                    />
                  </label>
                  <label>
                    <span>Window (minutes)</span>
                    <input
                      type="number"
                      min={15}
                      max={1440}
                      step={15}
                      value={rule.windowMinutes}
                      onChange={(event) => {
                        const next = [...rules];
                        next[index] = { ...rule, windowMinutes: Number(event.target.value) || 60 };
                        setRules(next);
                      }}
                    />
                  </label>
                  <label>
                    <span>Min severity</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={rule.minSeverity}
                      onChange={(event) => {
                        const next = [...rules];
                        next[index] = { ...rule, minSeverity: Number(event.target.value) };
                        setRules(next);
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}

            <label className="checkbox">
              <input
                type="checkbox"
                checked={notifications}
                onChange={(event) => setNotifications(event.target.checked)}
              />
              Send a desktop notification when a rule fires
            </label>
          </section>

          <section>
            <h3>Reading</h3>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={settings.useInAppBrowser}
                onChange={(event) =>
                  void updateSettings({ useInAppBrowser: event.target.checked })
                }
              />
              Open articles in a Terrafeed reader window instead of the system browser
            </label>
            <p className="hint-block">
              The reader is a plain window with no access to the app. Either way, the other option
              stays one click away on each story.
            </p>
          </section>
        </div>

        <footer>
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={save}>
            Save
          </button>
        </footer>
      </div>
    </div>
  );
}
