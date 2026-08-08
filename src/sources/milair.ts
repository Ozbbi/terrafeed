import { cached } from '../lib/cache';
import { getJson } from '../lib/net';
import { clamp01, signalId, type LayerDef, type Signal } from './types';

interface AdsbResponse {
  ac?: {
    hex: string;
    flight?: string;
    r?: string;
    t?: string;
    lat?: number;
    lon?: number;
    alt_baro?: number | 'ground';
    gs?: number;
    track?: number;
    squawk?: string;
    desc?: string;
  }[];
}

const FEED = 'https://api.adsb.lol/v2/mil';

/** Transponder codes that mean something is wrong on board. */
const EMERGENCY: Record<string, string> = {
  '7500': 'unlawful interference',
  '7600': 'radio failure',
  '7700': 'general emergency',
};

/** Airframes whose presence is usually itself the story. */
const NOTABLE = /^(RC135|E3TF|E3CF|E6|P8|U2|B52|B1|B2|E4|C17|KC135|KC46|RQ4|MQ4|WC135|VC25)/i;

export const milairLayer: LayerDef = {
  id: 'milair',
  label: 'Military aviation',
  group: 'Movement',
  color: '#9fe870',
  description: 'Military aircraft currently broadcasting ADS-B, from the adsb.lol feeder network.',
  attribution: 'adsb.lol community ADS-B network',
  refreshMs: 60_000,
  defaultOn: true,
  async load({ db }) {
    const data = await cached('adsb:mil', 45_000, () => getJson<AdsbResponse>(FEED));

    return (data.ac ?? []).flatMap<Signal>((ac) => {
      if (typeof ac.lat !== 'number' || typeof ac.lon !== 'number') return [];

      const type = (ac.t ?? '').trim();
      const callsign = (ac.flight ?? '').trim() || ac.r || ac.hex.toUpperCase();
      const emergency = ac.squawk ? EMERGENCY[ac.squawk] : undefined;
      const altitude = typeof ac.alt_baro === 'number' ? ac.alt_baro : 0;

      let severity = 0.3;
      if (NOTABLE.test(type)) severity = 0.6;
      if (emergency) severity = 0.95;

      return [
        {
          id: signalId('milair', ac.hex),
          layer: 'milair',
          source: 'adsb.lol',
          title: `${callsign}${type ? ` · ${type}` : ''}`,
          summary: emergency ? `Squawk ${ac.squawk} — ${emergency}` : ac.desc || undefined,
          time: Date.now(),
          lon: ac.lon,
          lat: ac.lat,
          severity: clamp01(severity),
          iso3: db.countryAt([ac.lon, ac.lat])?.iso3 ?? null,
          live: true,
          heading: ac.track,
          url: `https://globe.adsb.lol/?icao=${ac.hex}`,
          meta: {
            icao24: ac.hex,
            ...(type ? { airframe: type } : {}),
            ...(ac.r ? { registration: ac.r } : {}),
            altitudeFt: ac.alt_baro === 'ground' ? 'on ground' : altitude,
            ...(ac.gs != null ? { groundSpeedKt: Math.round(ac.gs) } : {}),
            ...(ac.squawk ? { squawk: ac.squawk } : {}),
          },
        },
      ];
    });
  },
};
