import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl';

import { LAYERS } from '../sources/registry';
import type { Signal } from '../sources/types';

/** `match` on the layer id so every point is coloured by its own source. */
function colorByLayer(): ExpressionSpecification {
  const stops = LAYERS.flatMap((layer) => [layer.id, layer.color]);
  return ['match', ['get', 'layer'], ...stops, '#8899aa'] as unknown as ExpressionSpecification;
}

/**
 * Radius, as a function of both zoom and severity.
 *
 * The zoom expression has to be the OUTERMOST one: the style spec allows `zoom`
 * only as the direct input of a top-level `step` or `interpolate`. Writing it as
 * `['*', <severity term>, <zoom curve>]` parses fine in TypeScript and is then
 * rejected at runtime, which silently drops the whole layer — the dots simply
 * never appear while symbol layers around them keep working. Severity therefore
 * varies *inside* each zoom stop instead of multiplying the curve.
 */
function radius(scale = 1): ExpressionSpecification {
  const at = (base: number, perSeverity: number): ExpressionSpecification =>
    ['+', base * scale, ['*', ['get', 'severity'], perSeverity * scale]] as ExpressionSpecification;

  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    0,
    at(2.8, 5),
    3,
    at(4, 7),
    6,
    at(6, 11),
    10,
    at(9, 15),
  ] as unknown as ExpressionSpecification;
}

/**
 * Colour ramp shared by arcs and severity rings: quiet cyan through amber to
 * red. `interpolate` on a plain data expression is fine — only `zoom` has to be
 * the outermost input.
 */
const severityRamp = (input: ExpressionSpecification): ExpressionSpecification =>
  [
    'interpolate',
    ['linear'],
    input,
    0,
    '#5ef2dc',
    0.45,
    '#f2d13b',
    0.7,
    '#f5a531',
    1,
    '#ff4d4d',
  ] as unknown as ExpressionSpecification;

export function addLinkLayers(map: MapLibreMap): void {
  // Soft underlay so a busy corridor reads as a glow rather than a hard wire.
  map.addLayer({
    id: 'link-glow',
    type: 'line',
    source: 'links',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': severityRamp(['get', 'severity']),
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0,
        ['interpolate', ['linear'], ['get', 'count'], 1, 2.5, 12, 7],
        6,
        ['interpolate', ['linear'], ['get', 'count'], 1, 5, 12, 14],
      ],
      'line-opacity': 0.14,
      'line-blur': 3,
    },
  });

  map.addLayer({
    id: 'link-line',
    type: 'line',
    source: 'links',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': severityRamp(['get', 'severity']),
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0,
        ['interpolate', ['linear'], ['get', 'count'], 1, 0.6, 12, 2.2],
        6,
        ['interpolate', ['linear'], ['get', 'count'], 1, 1.2, 12, 4],
      ],
      'line-opacity': ['interpolate', ['linear'], ['get', 'count'], 1, 0.45, 6, 0.85],
    },
  });
}

export const LINK_HIT_LAYERS = ['link-line'];

export function addSignalLayers(map: MapLibreMap): void {
  // Soft bloom underneath, so dense regions read as heat rather than clutter.
  map.addLayer({
    id: 'signal-glow',
    type: 'circle',
    source: 'signals',
    paint: {
      'circle-color': colorByLayer(),
      'circle-radius': radius(2.4),
      'circle-opacity': ['*', 0.18, ['+', 0.35, ['get', 'severity']]],
      'circle-blur': 0.75,
    },
  });

  map.addLayer({
    id: 'signal-core',
    type: 'circle',
    source: 'signals',
    paint: {
      'circle-color': colorByLayer(),
      'circle-radius': radius(),
      'circle-opacity': 0.95,
      'circle-stroke-color': '#05080e',
      'circle-stroke-width': 0.8,
    },
  });

  // Anything serious gets a red ring regardless of which layer it came from, so
  // the eye lands on severity first and provenance second.
  map.addLayer({
    id: 'signal-hot',
    type: 'circle',
    source: 'signals',
    filter: ['>=', ['get', 'severity'], 0.7],
    paint: {
      'circle-color': 'rgba(0,0,0,0)',
      'circle-radius': radius(1.8),
      'circle-stroke-color': '#ff4d4d',
      'circle-stroke-width': 1.4,
      'circle-stroke-opacity': 0.85,
    },
  });

  map.addLayer({
    id: 'signal-selected',
    type: 'circle',
    source: 'selection',
    paint: {
      'circle-color': 'rgba(0,0,0,0)',
      'circle-radius': radius(2.6),
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.8,
      'circle-stroke-opacity': 0.9,
    },
  });
}

export const SIGNAL_HIT_LAYERS = ['signal-core'];

export function toFeatureCollection(signals: Signal[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: signals.map((signal) => ({
      type: 'Feature',
      id: signal.id,
      properties: {
        id: signal.id,
        layer: signal.layer,
        severity: signal.severity,
        title: signal.title,
        source: signal.source,
        live: signal.live === true,
        time: signal.time,
      },
      geometry: { type: 'Point', coordinates: [signal.lon, signal.lat] },
    })),
  };
}
