import type { CountryDb } from '../data/countries';
import type { BBox } from '../lib/geo';
import type { Settings } from '../state/settings';

export type LayerId =
  | 'quakes'
  | 'hazards'
  | 'gdacs'
  | 'weather'
  | 'relief'
  | 'news'
  | 'sport'
  | 'milair'
  | 'sats'
  | 'chokepoints'
  | 'fires'
  | 'vessels';

export type LayerGroup =
  | 'Hazards'
  | 'Security'
  | 'Humanitarian'
  | 'Movement'
  | 'Information'
  | 'Trade';

/** One normalised observation. Every adapter produces these and nothing else,
 *  which is what makes cross-source corroboration possible downstream. */
export interface Signal {
  id: string;
  layer: LayerId;
  /** Provider shown in the UI and used as the corroboration identity. */
  source: string;
  title: string;
  summary?: string;
  /** Epoch milliseconds. */
  time: number;
  lon: number;
  lat: number;
  /** 0..1, comparable across layers. */
  severity: number;
  iso3?: string | null;
  url?: string;
  /** Free-form extras rendered in the detail pane. */
  meta?: Record<string, string | number>;
  /** Article thumbnail, when the publisher supplied one. */
  image?: string;
  /** Topic ids this signal matched, filled in by the topic filter. */
  topics?: string[];
  /** Every country named in the text, strongest first — the basis for links. */
  countries?: string[];
  /** True for continuously moving objects (aircraft, satellites, vessels). */
  live?: boolean;
  /** Held by retention: the source has stopped listing it, but it still matters. */
  stale?: boolean;
  heading?: number;
}

export interface FetchContext {
  db: CountryDb;
  settings: Settings;
  /** Current map viewport. Layers whose upstream demands a bounded query use it. */
  bbox: BBox;
}

export interface LayerDef {
  id: LayerId;
  label: string;
  group: LayerGroup;
  color: string;
  description: string;
  attribution: string;
  /** How often the adapter is polled, in milliseconds. */
  refreshMs: number;
  /** Layers behind an optional user-supplied key stay dark until it is set. */
  requiresKey?: keyof Settings['keys'];
  /** Default on/off for a fresh install. */
  defaultOn: boolean;
  load(ctx: FetchContext): Promise<Signal[]>;
}

export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Stable id so repeated polls update rather than duplicate a signal. */
export const signalId = (layer: LayerId, key: string | number): string => `${layer}:${key}`;
