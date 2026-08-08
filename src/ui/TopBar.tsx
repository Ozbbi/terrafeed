import { useEffect, useState } from 'react';

import { Wordmark } from '../brand/Logo';
import { LAYERS, MONITORS } from '../sources/registry';
import { useStore } from '../state/store';

function utcClock(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}Z`;
}

/** Multipliers on each layer's own cadence, so a fast-moving layer stays faster
 *  than a slow one at every setting. */
const REFRESH_CHOICES: { label: string; scale: number }[] = [
  { label: 'Fast', scale: 0.5 },
  { label: 'Normal', scale: 1 },
  { label: 'Relaxed', scale: 2 },
  { label: 'Slow', scale: 4 },
];

function nextRefreshIn(): number | null {
  const { layerOn, layerState, settings } = useStore.getState();
  const scale = settings.refreshScale || 1;

  const due = LAYERS.filter((layer) => layerOn[layer.id])
    .map((layer) => {
      const updatedAt = layerState[layer.id]?.updatedAt;
      return updatedAt ? updatedAt + layer.refreshMs * scale : null;
    })
    .filter((value): value is number => value != null);

  if (!due.length) return null;
  return Math.max(0, Math.min(...due) - Date.now());
}

export function TopBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const monitor = useStore((s) => s.settings.monitor);
  const refreshScale = useStore((s) => s.settings.refreshScale);
  const paused = useStore((s) => s.paused);
  const pressureOverlay = useStore((s) => s.pressureOverlay);
  const linkOverlay = useStore((s) => s.linkOverlay);
  const linkCount = useStore((s) => s.links.length);
  const videoOpen = useStore((s) => s.videoOpen);
  const toggleLinks = useStore((s) => s.toggleLinkOverlay);
  const toggleVideo = useStore((s) => s.toggleVideo);
  const applyMonitor = useStore((s) => s.applyMonitor);
  const setPaused = useStore((s) => s.setPaused);
  const setRefreshScale = useStore((s) => s.setRefreshScale);
  const togglePressure = useStore((s) => s.togglePressureOverlay);
  const refreshAll = useStore((s) => s.refreshAll);

  const layerState = useStore((s) => s.layerState);
  const layerOn = useStore((s) => s.layerOn);

  const [clock, setClock] = useState(utcClock);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setClock(utcClock());
      setCountdown(nextRefreshIn());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // A refresh is only believable if you can see it happening: count the layers
  // currently in flight rather than showing a spinner on a timer.
  const enabled = LAYERS.filter((layer) => layerOn[layer.id]);
  const loading = enabled.filter((layer) => layerState[layer.id]?.status === 'loading').length;
  const refreshing = loading > 0;
  const progress = enabled.length ? ((enabled.length - loading) / enabled.length) * 100 : 100;

  const countdownLabel =
    paused || countdown == null
      ? '—'
      : countdown < 1000
        ? 'now'
        : countdown < 60_000
          ? `${Math.ceil(countdown / 1000)}s`
          : `${Math.ceil(countdown / 60_000)}m`;

  return (
    <header className="topbar">
      {refreshing && (
        <div className="refresh-progress" role="progressbar" aria-label="Refreshing sources">
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
      <Wordmark />

      <nav className="monitors">
        {MONITORS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.description}
            className={monitor === preset.id ? 'monitor active' : 'monitor'}
            onClick={() => applyMonitor(preset.layers, preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </nav>

      <div className="topbar-actions">
        <button
          type="button"
          className={linkOverlay ? 'ghost active' : 'ghost'}
          onClick={toggleLinks}
          title="Draw an arc between countries named together in the same story — thicker means more stories, redder means more serious"
        >
          Links{linkCount > 0 ? ` ${linkCount}` : ''}
        </button>
        <button
          type="button"
          className={pressureOverlay ? 'ghost active' : 'ghost'}
          onClick={togglePressure}
          title="Shade countries by the pressure Terrafeed has observed in the last 48 hours"
        >
          Pressure map
        </button>
        <button
          type="button"
          className={videoOpen ? 'ghost active' : 'ghost'}
          onClick={toggleVideo}
          title="Live rolling news, floating over the map"
        >
          Live TV
        </button>

        <div className="refresh" title="Auto-refresh cadence and time to the next layer update">
          <select
            value={refreshScale}
            onChange={(event) => setRefreshScale(Number(event.target.value))}
          >
            {REFRESH_CHOICES.map((choice) => (
              <option key={choice.scale} value={choice.scale}>
                {choice.label}
              </option>
            ))}
          </select>
          <span className={paused ? 'countdown paused' : 'countdown'}>
            {refreshing ? `${enabled.length - loading}/${enabled.length}` : countdownLabel}
          </span>
        </div>

        <button
          type="button"
          className={refreshing ? 'ghost refreshing' : 'ghost'}
          onClick={() => void refreshAll()}
          disabled={refreshing}
        >
          {refreshing ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Refreshing
            </>
          ) : (
            'Refresh now'
          )}
        </button>
        <button
          type="button"
          className={paused ? 'ghost active' : 'ghost'}
          onClick={() => setPaused(!paused)}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" className="ghost" onClick={onOpenSettings}>
          Settings
        </button>
        <span className="clock" title="Coordinated Universal Time">
          {clock}
        </span>
      </div>
    </header>
  );
}
