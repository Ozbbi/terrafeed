import { chokepointsLayer } from './chokepoints';
import { firesLayer } from './fires';
import { gdacsLayer } from './gdacs';
import { hazardsLayer } from './hazards';
import { milairLayer } from './milair';
import { newsLayer, sportLayer } from './news';
import { quakesLayer } from './quakes';
import { reliefLayer } from './relief';
import { satsLayer } from './sats';
import { vesselsLayer } from './vessels';
import { weatherLayer } from './weather';
import type { LayerDef, LayerId } from './types';

export const LAYERS: LayerDef[] = [
  quakesLayer,
  hazardsLayer,
  gdacsLayer,
  weatherLayer,
  firesLayer,
  reliefLayer,
  newsLayer,
  sportLayer,
  milairLayer,
  vesselsLayer,
  satsLayer,
  chokepointsLayer,
];

export const LAYER_BY_ID = new Map<LayerId, LayerDef>(LAYERS.map((layer) => [layer.id, layer]));

export const layerColor = (id: LayerId): string => LAYER_BY_ID.get(id)?.color ?? '#8899aa';
export const layerLabel = (id: LayerId): string => LAYER_BY_ID.get(id)?.label ?? id;

export interface Monitor {
  id: string;
  label: string;
  description: string;
  layers: LayerId[];
}

/** Saved layer combinations, so switching focus is one click rather than nine. */
export const MONITORS: Monitor[] = [
  {
    id: 'world',
    label: 'World',
    description: 'Everything that is on by default — the general-purpose view.',
    layers: ['quakes', 'hazards', 'gdacs', 'news', 'milair', 'chokepoints'],
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Movement and escalation signals, with the noise of natural hazards removed.',
    layers: ['news', 'milair', 'vessels', 'chokepoints', 'relief'],
  },
  {
    id: 'hazard',
    label: 'Hazard',
    description: 'Geophysical and meteorological only.',
    layers: ['quakes', 'hazards', 'gdacs', 'weather', 'fires'],
  },
  {
    id: 'trade',
    label: 'Trade',
    description: 'Chokepoints, shipping and the headlines that move them.',
    layers: ['chokepoints', 'vessels', 'news'],
  },
  {
    id: 'orbit',
    label: 'Orbit',
    description: 'Satellite ground tracks over a quiet map.',
    layers: ['sats', 'chokepoints'],
  },
  {
    id: 'calm',
    label: 'Calm',
    description: 'Slow-moving layers only. No headlines competing for attention.',
    layers: ['quakes', 'chokepoints'],
  },
];
