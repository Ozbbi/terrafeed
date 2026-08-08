import { DEFAULT_FEEDS, type NewsFeedDef } from '../data/feeds';
import type { CustomTopic } from '../data/topics';
import type { LayerId } from '../sources/types';
import { isTauri } from '../lib/net';

export interface AlertRule {
  id: string;
  label: string;
  enabled: boolean;
  /** Minimum severity a signal must carry to count towards the rule. */
  minSeverity: number;
  /** Layers the rule listens to; empty means every layer. */
  layers: LayerId[];
  /** Optional case-insensitive text filter on title and summary. */
  keyword: string;
  /** Optional geofence: centre plus radius in kilometres. */
  area?: { lon: number; lat: number; radiusKm: number; label: string };
  /** Distinct sources that must agree inside the window before the rule fires. */
  corroboration: number;
  windowMinutes: number;
}

export interface Settings {
  keys: {
    firms: string;
    aisstream: string;
    anthropic: string;
  };
  feeds: NewsFeedDef[];
  /** Extra hosts the user authorised for custom feeds; mirrored into Rust. */
  customHosts: string[];
  layers: Partial<Record<LayerId, boolean>>;
  monitor: string;
  alertRules: AlertRule[];
  notifications: boolean;
  /** Pauses satellite/aircraft animation for lower GPU load. */
  reducedMotion: boolean;
  /** Catalogue topic ids the user is watching. Empty means everything. */
  topics: string[];
  /** Topics the user described in their own words. */
  customTopics: CustomTopic[];
  /** Scales every layer's own refresh interval. 1 = as designed. */
  refreshScale: number;
  /** Open article links inside the app rather than the system browser. */
  useInAppBrowser: boolean;
}

export const DEFAULT_RULES: AlertRule[] = [
  {
    id: 'major-quake',
    label: 'Major earthquake',
    enabled: true,
    minSeverity: 0.6,
    layers: ['quakes', 'gdacs'],
    keyword: '',
    corroboration: 1,
    windowMinutes: 90,
  },
  {
    id: 'chokepoint-activity',
    label: 'Chokepoint escalation',
    enabled: true,
    minSeverity: 0.6,
    layers: [],
    keyword: '',
    area: { lon: 56.25, lat: 26.57, radiusKm: 500, label: 'Strait of Hormuz' },
    corroboration: 2,
    windowMinutes: 180,
  },
  {
    id: 'escalation-language',
    label: 'Escalation language across outlets',
    enabled: true,
    minSeverity: 0.75,
    layers: ['news'],
    keyword: '',
    corroboration: 3,
    windowMinutes: 120,
  },
];

export const DEFAULT_SETTINGS: Settings = {
  keys: { firms: '', aisstream: '', anthropic: '' },
  feeds: DEFAULT_FEEDS,
  customHosts: [],
  layers: {},
  monitor: 'world',
  alertRules: DEFAULT_RULES,
  notifications: true,
  reducedMotion: false,
  topics: [],
  customTopics: [],
  refreshScale: 1,
  useInAppBrowser: true,
};

const STORAGE_KEY = 'terrafeed.settings';

function merge(stored: unknown): Settings {
  const value = (stored ?? {}) as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    keys: { ...DEFAULT_SETTINGS.keys, ...(value.keys ?? {}) },
    feeds: value.feeds?.length ? value.feeds : DEFAULT_FEEDS,
    layers: { ...(value.layers ?? {}) },
    alertRules: value.alertRules?.length ? value.alertRules : DEFAULT_RULES,
    topics: value.topics ?? [],
    customTopics: value.customTopics ?? [],
    refreshScale: value.refreshScale && value.refreshScale > 0 ? value.refreshScale : 1,
  };
}

export async function loadSettings(): Promise<Settings> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return merge(await invoke('settings_load'));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
  try {
    return merge(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('settings_save', { value: settings });
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
