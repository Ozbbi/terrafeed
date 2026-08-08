import { create } from 'zustand';

import { evaluateRules, newAlerts, notify, type Alert } from '../alerts/engine';
import { loadCountries, type CountryDb } from '../data/countries';
import { TOPIC_BY_ID, topicMatches, type CustomTopic } from '../data/topics';
import type { BBox } from '../lib/geo';
import { storyLinks, type StoryLink } from '../analysis/links';
import { chokepointPressure, type ChokepointStatus } from '../sources/chokepoints';
import { loadCountryNews } from '../sources/countryNews';
import { loadQuotes, type Quote } from '../sources/markets';
import { LAYERS, LAYER_BY_ID } from '../sources/registry';
import type { LayerId, Signal } from '../sources/types';
import { mergeWithRetention } from './retention';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './settings';

export interface LayerState {
  status: 'idle' | 'loading' | 'ok' | 'error' | 'locked';
  error?: string;
  updatedAt: number;
  /** Everything on the map for this layer, fresh plus retained. */
  count: number;
  /** How many the source returned on the last poll. */
  fresh?: number;
  /** How many are being held past their disappearance from the feed. */
  retained?: number;
}

interface AppState {
  ready: boolean;
  db: CountryDb | null;
  settings: Settings;
  layerOn: Partial<Record<LayerId, boolean>>;
  layerState: Partial<Record<LayerId, LayerState>>;
  signalsByLayer: Partial<Record<LayerId, Signal[]>>;
  signals: Signal[];
  /** `signals` after the topic watchlist is applied — what the map and feed show. */
  visibleSignals: Signal[];
  /** How many current signals each watched topic matched. */
  topicCounts: Record<string, number>;
  chokepoints: ChokepointStatus[];
  links: StoryLink[];
  alerts: Alert[];
  quotes: Quote[];
  quotesUpdatedAt: number;
  selected: Signal | null;
  selectedCountry: string | null;
  /** Countries whose extra coverage has already been pulled in. */
  focusedCountries: Set<string>;
  /** That extra coverage, held apart from the polled layers. */
  focusSignals: Signal[];
  bbox: BBox;
  paused: boolean;
  pressureOverlay: boolean;
  linkOverlay: boolean;
  videoOpen: boolean;

  boot(): Promise<void>;
  refreshLayer(id: LayerId, force?: boolean): Promise<void>;
  refreshAll(): Promise<void>;
  toggleLayer(id: LayerId, on?: boolean): void;
  applyMonitor(layers: LayerId[], monitorId: string): void;
  select(signal: Signal | null): void;
  selectCountry(iso3: string | null): void;
  focusCountryNews(iso3: string): Promise<void>;
  setBBox(bbox: BBox): void;
  setPaused(paused: boolean): void;
  togglePressureOverlay(): void;
  toggleLinkOverlay(): void;
  toggleVideo(): void;
  closeVideo(): void;
  toggleTopic(topicId: string): void;
  clearTopics(): void;
  addCustomTopic(topic: CustomTopic): void;
  removeCustomTopic(topicId: string): void;
  setRefreshScale(scale: number): void;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  reevaluate(): void;
  acknowledge(alertId: string): void;
}

const WORLD: BBox = [-180, -85, 180, 85];

function flatten(byLayer: Partial<Record<LayerId, Signal[]>>): Signal[] {
  return Object.values(byLayer).flatMap((list) => list ?? []);
}

/**
 * Chokepoint markers ship with a flat placeholder severity; the number that
 * actually means something is the derived pressure. Folding it back in is what
 * makes the strait dots grow and redden as activity gathers around them, now
 * that the pressure has no panel of its own.
 */
function withChokepointPressure(signals: Signal[], pressure: ChokepointStatus[]): Signal[] {
  if (!signals.some((signal) => signal.layer === 'chokepoints')) return signals;

  const byId = new Map(pressure.map((status) => [`chokepoints:${status.point.id}`, status]));
  return signals.map((signal) => {
    const status = byId.get(signal.id);
    if (!status) return signal;
    return {
      ...signal,
      severity: status.pressure,
      meta: {
        ...signal.meta,
        pressure: Math.round(status.pressure * 100),
        signalsInRadius: status.nearby.length,
      },
    };
  });
}

/**
 * Recomputes everything derived from the raw signal set, in one place.
 *
 * Focused country coverage is kept in its own bucket rather than merged into the
 * news layer: the layer array is replaced wholesale on every poll, so anything
 * merged into it disappears at the next refresh.
 */
function commit(
  signalsByLayer: Partial<Record<LayerId, Signal[]>>,
  settings: Settings,
  focusSignals: Signal[] = [],
  db: CountryDb | null = null,
) {
  const known = new Set(flatten(signalsByLayer).map((signal) => signal.id));
  const flat = [
    ...flatten(signalsByLayer),
    ...focusSignals.filter((signal) => !known.has(signal.id)),
  ];
  const chokepoints = chokepointPressure(flat);
  const signals = withChokepointPressure(flat, chokepoints);
  const topics = applyTopics(signals, settings);
  // Links follow the *visible* set, so narrowing the watchlist narrows the web
  // of relations too rather than leaving arcs to stories you filtered out.
  const links = db ? storyLinks(topics.visibleSignals, db) : [];

  return { signalsByLayer, focusSignals, signals, chokepoints, links, ...topics };
}

interface ActiveTopic {
  id: string;
  terms: string[];
}

function activeTopics(settings: Settings): ActiveTopic[] {
  const fromCatalogue = settings.topics.flatMap((id) => {
    const topic = TOPIC_BY_ID.get(id);
    return topic ? [{ id: topic.id, terms: topic.terms }] : [];
  });
  const custom = settings.customTopics.map((topic) => ({ id: topic.id, terms: topic.terms }));
  return [...fromCatalogue, ...custom];
}

/**
 * The watchlist is a *view* filter: it decides what the map and feed show, and
 * deliberately does not touch the alert engine. A rule the user armed should not
 * fall silent because they narrowed their reading list.
 *
 * Only text-bearing layers are filtered. Hiding earthquakes because they do not
 * mention "semiconductors" would be nonsense, so non-news layers pass through.
 */
function applyTopics(signals: Signal[], settings: Settings) {
  const topics = activeTopics(settings);
  const counts: Record<string, number> = {};
  for (const topic of topics) counts[topic.id] = 0;

  if (!topics.length) return { visibleSignals: signals, topicCounts: counts };

  const visible: Signal[] = [];
  for (const signal of signals) {
    if (signal.layer !== 'news' && signal.layer !== 'relief') {
      visible.push(signal);
      continue;
    }

    const haystack = `${signal.title} ${signal.summary ?? ''}`;
    const matched = topics.filter((topic) => topicMatches(haystack, topic.terms));
    if (!matched.length) continue;

    for (const topic of matched) counts[topic.id] += 1;
    visible.push({ ...signal, topics: matched.map((topic) => topic.id) });
  }

  return { visibleSignals: visible, topicCounts: counts };
}

export const useStore = create<AppState>((set, get) => ({
  ready: false,
  db: null,
  settings: DEFAULT_SETTINGS,
  layerOn: {},
  layerState: {},
  signalsByLayer: {},
  signals: [],
  visibleSignals: [],
  topicCounts: {},
  chokepoints: [],
  links: [],
  alerts: [],
  quotes: [],
  quotesUpdatedAt: 0,
  selected: null,
  selectedCountry: null,
  focusedCountries: new Set<string>(),
  focusSignals: [],
  bbox: WORLD,
  paused: false,
  pressureOverlay: false,
  linkOverlay: true,
  videoOpen: false,

  async boot() {
    const [db, settings] = await Promise.all([loadCountries(), loadSettings()]);

    const layerOn: Partial<Record<LayerId, boolean>> = {};
    for (const layer of LAYERS) {
      layerOn[layer.id] = settings.layers[layer.id] ?? layer.defaultOn;
    }

    set({ db, settings, layerOn, ready: true, ...applyTopics([], settings) });
    void get().refreshAll();
  },

  async refreshLayer(id, force = false) {
    const { db, settings, layerOn, bbox, layerState, paused } = get();
    const layer = LAYER_BY_ID.get(id);
    if (!db || !layer || !layerOn[id]) return;
    if (paused && !force) return;

    if (layer.requiresKey && !settings.keys[layer.requiresKey].trim()) {
      set((state) => ({
        layerState: {
          ...state.layerState,
          [id]: { status: 'locked', updatedAt: Date.now(), count: 0 },
        },
      }));
      return;
    }

    const previous = layerState[id];
    const interval = layer.refreshMs * (settings.refreshScale || 1);
    if (!force && previous?.updatedAt && Date.now() - previous.updatedAt < interval) return;

    set((state) => ({
      layerState: {
        ...state.layerState,
        [id]: { ...(previous ?? { updatedAt: 0, count: 0 }), status: 'loading' },
      },
    }));

    try {
      const incoming = await layer.load({ db, settings, bbox });
      set((state) => {
        const { signals, retained } = mergeWithRetention(
          id,
          state.signalsByLayer[id] ?? [],
          incoming,
        );
        return {
          ...commit(
            { ...state.signalsByLayer, [id]: signals },
            state.settings,
            state.focusSignals,
            state.db,
          ),
          layerState: {
            ...state.layerState,
            [id]: {
              status: 'ok',
              updatedAt: Date.now(),
              count: signals.length,
              fresh: incoming.length,
              retained,
            },
          },
        };
      });
      get().reevaluate();
    } catch (error) {
      set((state) => ({
        layerState: {
          ...state.layerState,
          [id]: {
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            updatedAt: Date.now(),
            count: previous?.count ?? 0,
          },
        },
      }));
    }
  },

  async refreshAll() {
    const { layerOn } = get();
    const enabled = LAYERS.filter((layer) => layerOn[layer.id]);
    await Promise.allSettled(enabled.map((layer) => get().refreshLayer(layer.id)));

    if (Date.now() - get().quotesUpdatedAt > 90_000) {
      try {
        set({ quotes: await loadQuotes(), quotesUpdatedAt: Date.now() });
      } catch {
        // A quote outage should not disturb the rest of the dashboard.
      }
    }
  },

  toggleLayer(id, on) {
    const next = on ?? !get().layerOn[id];
    set((state) => ({ layerOn: { ...state.layerOn, [id]: next } }));

    if (next) {
      void get().refreshLayer(id, true);
    } else {
      set((state) => {
        const signalsByLayer = { ...state.signalsByLayer };
        delete signalsByLayer[id];
        return commit(signalsByLayer, state.settings, state.focusSignals, state.db);
      });
    }
    void get().updateSettings({ layers: { ...get().settings.layers, [id]: next } });
  },

  applyMonitor(layers, monitorId) {
    const layerOn: Partial<Record<LayerId, boolean>> = {};
    for (const layer of LAYERS) layerOn[layer.id] = layers.includes(layer.id);

    set((state) => {
      const signalsByLayer = { ...state.signalsByLayer };
      for (const id of Object.keys(signalsByLayer) as LayerId[]) {
        if (!layerOn[id]) delete signalsByLayer[id];
      }
      return { layerOn, ...commit(signalsByLayer, state.settings, state.focusSignals, state.db) };
    });

    void get().updateSettings({ layers: layerOn, monitor: monitorId });
    void get().refreshAll();
  },

  select(signal) {
    set({ selected: signal });
  },

  selectCountry(iso3) {
    set({ selectedCountry: iso3 });
    if (iso3) void get().focusCountryNews(iso3);
  },

  async focusCountryNews(iso3) {
    const { db, focusedCountries } = get();
    const country = db?.byIso3.get(iso3);
    // One fetch per country per session; the cache would cover a repeat anyway,
    // but this keeps the map from flickering every time it is reselected.
    if (!db || !country || focusedCountries.has(iso3)) return;

    set({ focusedCountries: new Set([...focusedCountries, iso3]) });

    try {
      const extra = await loadCountryNews(country, db);
      if (!extra.length) return;

      set((state) => {
        const held = new Set(state.focusSignals.map((signal) => signal.id));
        const focusSignals = [
          ...state.focusSignals,
          ...extra.filter((signal) => !held.has(signal.id)),
        ];
        return commit(state.signalsByLayer, state.settings, focusSignals, state.db);
      });
    } catch {
      // Focus coverage is a bonus; the base map is unaffected if it fails.
      set((state) => ({
        focusedCountries: new Set([...state.focusedCountries].filter((id) => id !== iso3)),
      }));
    }
  },

  setBBox(bbox) {
    set({ bbox });
  },

  setPaused(paused) {
    set({ paused });
  },

  togglePressureOverlay() {
    set((state) => ({ pressureOverlay: !state.pressureOverlay }));
  },

  toggleLinkOverlay() {
    set((state) => ({ linkOverlay: !state.linkOverlay }));
  },

  toggleVideo() {
    set((state) => ({ videoOpen: !state.videoOpen }));
  },

  closeVideo() {
    set({ videoOpen: false });
  },

  toggleTopic(topicId) {
    const current = get().settings.topics;
    const topics = current.includes(topicId)
      ? current.filter((id) => id !== topicId)
      : [...current, topicId];
    void get().updateSettings({ topics });
  },

  clearTopics() {
    void get().updateSettings({ topics: [], customTopics: [] });
  },

  addCustomTopic(topic) {
    void get().updateSettings({ customTopics: [...get().settings.customTopics, topic] });
  },

  removeCustomTopic(topicId) {
    void get().updateSettings({
      customTopics: get().settings.customTopics.filter((topic) => topic.id !== topicId),
    });
  },

  setRefreshScale(scale) {
    void get().updateSettings({ refreshScale: scale });
  },

  async updateSettings(patch) {
    const settings = { ...get().settings, ...patch };
    // Topic edits have to take effect on the current signal set immediately —
    // waiting for the next poll would make the watchlist feel broken.
    set({ settings, ...applyTopics(get().signals, settings) });
    try {
      await saveSettings(settings);
    } catch {
      // Persisting is best-effort; the session keeps the change either way.
    }
  },

  reevaluate() {
    // Runs after every layer update so the alert list stays in step with the
    // signals actually on screen. Acknowledgement survives re-evaluation.
    const { settings, signals, alerts: previous } = get();
    const current = evaluateRules(settings.alertRules, signals).map((alert) => ({
      ...alert,
      acknowledged: previous.find((p) => p.id === alert.id)?.acknowledged === true,
    }));

    const fresh = newAlerts(previous, current);
    if (settings.notifications) fresh.forEach((alert) => void notify(alert));

    set({ alerts: current });
  },

  acknowledge(alertId) {
    set((state) => ({
      alerts: state.alerts.map((alert) =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert,
      ),
    }));
  },
}));

if (import.meta.env.DEV) {
  // Handy when poking at live state from the console; never shipped.
  (window as unknown as { __terrafeed: unknown }).__terrafeed = useStore;
}

/** Drives every layer on its own cadence from a single timer. */
export function startEngine(): () => void {
  const tick = window.setInterval(() => {
    const { layerOn, paused } = useStore.getState();
    if (paused) return;
    for (const layer of LAYERS) {
      if (layerOn[layer.id]) void useStore.getState().refreshLayer(layer.id);
    }
  }, 10_000);

  const quotes = window.setInterval(() => {
    if (useStore.getState().paused) return;
    void loadQuotes()
      .then((list) => useStore.setState({ quotes: list, quotesUpdatedAt: Date.now() }))
      .catch(() => undefined);
  }, 120_000);

  return () => {
    window.clearInterval(tick);
    window.clearInterval(quotes);
  };
}
