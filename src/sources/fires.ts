import { cached } from '../lib/cache';
import { getText } from '../lib/net';
import { clamp01, signalId, type LayerDef, type Signal } from './types';

/** FIRMS answers per area, so the query follows the viewport. Rounding keeps the
 *  cache key stable while panning slightly. */
const round = (n: number): number => Math.round(n * 2) / 2;

const CONFIDENCE: Record<string, number> = { h: 1, n: 0.75, l: 0.4 };

export const firesLayer: LayerDef = {
  id: 'fires',
  label: 'Thermal anomalies',
  group: 'Hazards',
  color: '#ff4d4d',
  description:
    'VIIRS active-fire detections in the current view, last 24 hours. Needs a free NASA FIRMS key.',
  attribution: 'NASA FIRMS (VIIRS NOAA-20)',
  refreshMs: 10 * 60_000,
  requiresKey: 'firms',
  defaultOn: false,
  async load({ db, settings, bbox }) {
    const key = settings.keys.firms.trim();
    if (!key) return [];

    const area = [round(bbox[0]), round(bbox[1]), round(bbox[2]), round(bbox[3])].join(',');
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_NOAA20_NRT/${area}/1`;
    const csv = await cached(`firms:${area}`, 8 * 60_000, () => getText(url, 'text/csv'));

    const [header, ...rows] = csv.trim().split(/\r?\n/);
    if (!header?.includes('latitude')) return [];
    const columns = header.split(',');
    const at = (row: string[], name: string): string => row[columns.indexOf(name)] ?? '';

    return rows
      .slice(0, 4000)
      .flatMap<Signal>((line) => {
        const row = line.split(',');
        const lat = Number(at(row, 'latitude'));
        const lon = Number(at(row, 'longitude'));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];

        const frp = Number(at(row, 'frp')) || 0;
        const confidence = at(row, 'confidence').toLowerCase();
        const date = at(row, 'acq_date');
        const clock = at(row, 'acq_time').padStart(4, '0');
        const time = Date.parse(`${date}T${clock.slice(0, 2)}:${clock.slice(2)}:00Z`);

        return [
          {
            id: signalId('fires', `${lat},${lon},${date}${clock}`),
            layer: 'fires',
            source: 'NASA FIRMS',
            title: `Thermal anomaly · ${frp.toFixed(0)} MW`,
            summary: `VIIRS detection, ${at(row, 'daynight') === 'D' ? 'daytime' : 'night'} pass.`,
            time: Number.isFinite(time) ? time : Date.now(),
            lon,
            lat,
            // Radiative power is the closest thing to intensity FIRMS gives.
            severity: clamp01((frp / 120) * (CONFIDENCE[confidence] ?? 0.6)),
            iso3: db.countryAt([lon, lat])?.iso3 ?? null,
            meta: {
              radiativePowerMW: frp,
              confidence: confidence || 'unknown',
              brightnessK: Number(at(row, 'bright_ti4')) || 0,
            },
          },
        ];
      })
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 1500);
  },
};
