import { useEffect, useState } from 'react';

import { MapView } from './map/MapView';
import { startEngine, useStore } from './state/store';
import { AlertsPanel } from './ui/AlertsPanel';
import { BreakingPanel } from './ui/BreakingPanel';
import { CountryPanel } from './ui/CountryPanel';
import { DetailCard } from './ui/DetailCard';
import { FeedPanel } from './ui/FeedPanel';
import { LayerPanel } from './ui/LayerPanel';
import { SettingsDialog } from './ui/SettingsDialog';
import { StatusBar } from './ui/StatusBar';
import { TopBar } from './ui/TopBar';
import { VideoPanel } from './ui/VideoPanel';
import { TopicsPanel } from './ui/TopicsPanel';

type RailTab = 'alerts' | 'feed' | 'topics';

export function App() {
  const ready = useStore((s) => s.ready);
  const boot = useStore((s) => s.boot);
  const selectedCountry = useStore((s) => s.selectedCountry);
  const alerts = useStore((s) => s.alerts);

  const [rail, setRail] = useState<RailTab>('topics');
  const watchedTopics = useStore(
    (s) => s.settings.topics.length + s.settings.customTopics.length,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void boot();
    return startEngine();
  }, [boot]);

  const unacknowledged = alerts.filter((alert) => !alert.acknowledged).length;

  if (!ready) {
    return (
      <div className="boot">
        <div className="boot-inner">
          <div className="boot-ring" />
          <p>Loading world geometry and saved configuration…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <TopBar onOpenSettings={() => setSettingsOpen(true)} />

      <div className="body">
        <aside className="rail rail-left">
          <BreakingPanel />
          <LayerPanel />
        </aside>

        <main className="stage">
          <MapView />
          <VideoPanel />
          <DetailCard />
          {selectedCountry && <CountryPanel iso3={selectedCountry} />}
        </main>

        <aside className="rail rail-right">
          <div className="tabs">
            <button
              type="button"
              className={rail === 'topics' ? 'tab active' : 'tab'}
              onClick={() => setRail('topics')}
            >
              Topics
              {watchedTopics > 0 && <span className="badge accent">{watchedTopics}</span>}
            </button>
            <button
              type="button"
              className={rail === 'feed' ? 'tab active' : 'tab'}
              onClick={() => setRail('feed')}
            >
              Feed
            </button>
            <button
              type="button"
              className={rail === 'alerts' ? 'tab active' : 'tab'}
              onClick={() => setRail('alerts')}
            >
              Alerts
              {unacknowledged > 0 && <span className="badge">{unacknowledged}</span>}
            </button>
          </div>
          {rail === 'topics' && <TopicsPanel />}
          {rail === 'feed' && <FeedPanel />}
          {rail === 'alerts' && <AlertsPanel />}
        </aside>
      </div>

      <StatusBar />
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
