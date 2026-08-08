import { useEffect, useRef, useState } from 'react';

import { CHANNELS, embedUrl, watchUrl, type Channel } from '../data/channels';
import { openArticle } from '../lib/open';
import { useStore } from '../state/store';

interface Position {
  x: number;
  y: number;
}

/**
 * Live rolling news, floating over the map.
 *
 * It sits above the map rather than inside a rail so it survives switching
 * tabs — the point of having it is to keep watching while you read something
 * else. Muted autoplay is deliberate: a panel that starts talking the moment
 * the app opens is a panel people close and never reopen.
 */
export function VideoPanel() {
  const visible = useStore((s) => s.videoOpen);
  const close = useStore((s) => s.closeVideo);

  const [channel, setChannel] = useState<Channel>(CHANNELS[0]);
  const [large, setLarge] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 24, y: 90 });

  const dragging = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    if (!dragging.current) return undefined;

    const onMove = (event: MouseEvent) => {
      if (!dragging.current) return;
      setPosition({
        x: Math.max(8, event.clientX - dragging.current.dx),
        y: Math.max(8, event.clientY - dragging.current.dy),
      });
    };
    const onUp = () => {
      dragging.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  });

  if (!visible) return null;

  const width = large ? 560 : 340;

  return (
    <aside
      className="video-panel"
      style={{ left: position.x, top: position.y, width }}
      onMouseDown={(event) => {
        // Only the header drags; clicks inside the player must reach the player.
        if (!(event.target as HTMLElement).closest('.video-head')) return;
        dragging.current = { dx: event.clientX - position.x, dy: event.clientY - position.y };
      }}
    >
      <header className="video-head">
        <span className="video-live">LIVE</span>
        <span className="video-name">{channel.name}</span>
        <span className="video-region">{channel.region}</span>
        <button type="button" onClick={() => setLarge(!large)} title="Resize">
          {large ? '⤡' : '⤢'}
        </button>
        <button type="button" onClick={close} title="Close" aria-label="Close">
          ×
        </button>
      </header>

      <div className="video-frame">
        <iframe
          key={channel.id}
          src={embedUrl(channel)}
          title={`${channel.name} live`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>

      <div className="video-channels">
        {CHANNELS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={option.id === channel.id ? 'video-chip on' : 'video-chip'}
            onClick={() => setChannel(option)}
          >
            {option.name}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="video-fallback"
        onClick={() => void openArticle(watchUrl(channel), `${channel.name} live`, 'in-app')}
      >
        Blank player? Open {channel.name} in a window →
      </button>
    </aside>
  );
}
