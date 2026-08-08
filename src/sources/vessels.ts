import type { BBox } from '../lib/geo';
import { clamp01, signalId, type LayerDef, type Signal } from './types';

/**
 * AIS is a stream, not a poll: one WebSocket stays open and fills a buffer that
 * `load()` snapshots. The socket is re-opened when the key or the viewport
 * changes materially.
 */

interface VesselFix {
  mmsi: string;
  name: string;
  lon: number;
  lat: number;
  cog: number;
  sog: number;
  status: number;
  time: number;
}

const buffer = new Map<string, VesselFix>();

let socket: WebSocket | null = null;
let currentKey = '';
let currentBox: BBox | null = null;
let retryAt = 0;

/** Navigational status codes worth surfacing rather than plain "under way". */
const STATUS_LABEL: Record<number, string> = {
  1: 'at anchor',
  2: 'not under command',
  3: 'restricted manoeuvrability',
  4: 'constrained by draught',
  5: 'moored',
  6: 'aground',
  7: 'engaged in fishing',
};

const boxChanged = (a: BBox | null, b: BBox): boolean =>
  !a || a.some((value, index) => Math.abs(value - b[index]) > 4);

function connect(key: string, bbox: BBox): void {
  socket?.close();
  buffer.clear();

  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
  socket = ws;
  currentKey = key;
  currentBox = bbox;

  ws.addEventListener('open', () => {
    ws.send(
      JSON.stringify({
        APIKey: key,
        // aisstream orders corners as [lat, lon], south-west then north-east.
        BoundingBoxes: [
          [
            [bbox[1], bbox[0]],
            [bbox[3], bbox[2]],
          ],
        ],
        FilterMessageTypes: ['PositionReport'],
      }),
    );
  });

  ws.addEventListener('message', (event) => {
    try {
      const payload = JSON.parse(String(event.data));
      const report = payload?.Message?.PositionReport;
      const meta = payload?.MetaData;
      if (!report || !meta) return;

      const mmsi = String(meta.MMSI ?? report.UserID ?? '');
      if (!mmsi) return;

      buffer.set(mmsi, {
        mmsi,
        name: String(meta.ShipName ?? '').trim() || `MMSI ${mmsi}`,
        lon: report.Longitude,
        lat: report.Latitude,
        cog: report.Cog ?? 0,
        sog: report.Sog ?? 0,
        status: report.NavigationalStatus ?? 0,
        time: Date.parse(meta.time_utc) || Date.now(),
      });

      // The stream is unbounded; keep only the freshest fixes.
      if (buffer.size > 3000) {
        const oldest = [...buffer.entries()].sort((a, b) => a[1].time - b[1].time).slice(0, 500);
        for (const [id] of oldest) buffer.delete(id);
      }
    } catch {
      // Malformed frame; the next one will do.
    }
  });

  ws.addEventListener('close', () => {
    if (socket === ws) socket = null;
    retryAt = Date.now() + 15_000;
  });
  ws.addEventListener('error', () => ws.close());
}

export function disconnectVessels(): void {
  socket?.close();
  socket = null;
  currentKey = '';
  currentBox = null;
  buffer.clear();
}

export const vesselsLayer: LayerDef = {
  id: 'vessels',
  label: 'Vessel traffic',
  group: 'Movement',
  color: '#38bdf8',
  description: 'Live AIS position reports inside the current view. Needs a free AISStream key.',
  attribution: 'aisstream.io',
  refreshMs: 20_000,
  requiresKey: 'aisstream',
  defaultOn: false,
  async load({ settings, bbox, db }) {
    const key = settings.keys.aisstream.trim();
    if (!key) {
      disconnectVessels();
      return [];
    }

    const stale = !socket && Date.now() > retryAt;
    if (stale || key !== currentKey || boxChanged(currentBox, bbox)) {
      connect(key, bbox);
    }

    const cutoff = Date.now() - 20 * 60_000;
    return [...buffer.values()]
      .filter((fix) => fix.time > cutoff)
      .slice(0, 2000)
      .map<Signal>((fix) => ({
        id: signalId('vessels', fix.mmsi),
        layer: 'vessels',
        source: 'AISStream',
        title: fix.name,
        summary: STATUS_LABEL[fix.status]
          ? `Navigational status: ${STATUS_LABEL[fix.status]}`
          : undefined,
        time: fix.time,
        lon: fix.lon,
        lat: fix.lat,
        severity: clamp01(fix.status === 6 || fix.status === 2 ? 0.8 : 0.22),
        iso3: db.countryAt([fix.lon, fix.lat])?.iso3 ?? null,
        live: true,
        heading: fix.cog,
        meta: {
          mmsi: fix.mmsi,
          speedKt: fix.sog,
          courseDeg: Math.round(fix.cog),
          status: STATUS_LABEL[fix.status] ?? 'under way',
        },
      }));
  },
};
