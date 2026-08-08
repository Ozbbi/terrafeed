import type { StyleSpecification } from 'maplibre-gl';

/** Palette for the basemap. Kept here so the map and the chrome stay in step. */
export const MAP_COLORS = {
  ocean: '#070d16',
  land: '#152233',
  landHover: '#1e3148',
  border: '#2a3f5a',
  graticule: '#111d2b',
  accent: '#5ef2dc',
};

/** Meridians and parallels every 20°, generated rather than shipped. */
export function graticule(step = 20): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (let lon = -180; lon <= 180; lon += step) {
    const line: [number, number][] = [];
    for (let lat = -80; lat <= 80; lat += 2) line.push([lon, lat]);
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: line },
    });
  }
  for (let lat = -80; lat <= 80; lat += step) {
    const line: [number, number][] = [];
    for (let lon = -180; lon <= 180; lon += 4) line.push([lon, lat]);
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: line },
    });
  }

  return { type: 'FeatureCollection', features };
}

export const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * A complete style with no tile server and no font server behind it: country
 * polygons come from the bundled Natural Earth extract, everything else is drawn
 * from live data. The app therefore works offline and stays clear of basemap
 * licensing entirely.
 */
export function buildStyle(countries: GeoJSON.FeatureCollection): StyleSpecification {
  return {
    version: 8,
    name: 'Terrafeed Dark',
    sources: {
      countries: { type: 'geojson', data: countries, promoteId: 'iso3' },
      graticule: { type: 'geojson', data: graticule() },
      links: { type: 'geojson', data: EMPTY_FC },
      signals: { type: 'geojson', data: EMPTY_FC },
      selection: { type: 'geojson', data: EMPTY_FC },
    },
    layers: [
      { id: 'ocean', type: 'background', paint: { 'background-color': MAP_COLORS.ocean } },
      {
        id: 'graticule',
        type: 'line',
        source: 'graticule',
        paint: { 'line-color': MAP_COLORS.graticule, 'line-width': 0.6 },
      },
      {
        id: 'country-fill',
        type: 'fill',
        source: 'countries',
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            MAP_COLORS.landHover,
            MAP_COLORS.land,
          ],
        },
      },
      {
        id: 'country-pressure',
        type: 'fill',
        source: 'countries',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['coalesce', ['feature-state', 'pressure'], 0],
            0,
            'rgba(94, 242, 220, 0)',
            0.25,
            'rgba(242, 209, 59, 0.28)',
            0.6,
            'rgba(245, 165, 49, 0.45)',
            1,
            'rgba(229, 72, 77, 0.6)',
          ],
        },
      },
      {
        id: 'country-line',
        type: 'line',
        source: 'countries',
        paint: { 'line-color': MAP_COLORS.border, 'line-width': 0.8 },
      },
      {
        id: 'country-selected',
        type: 'line',
        source: 'countries',
        filter: ['==', ['get', 'iso3'], '__none__'],
        paint: { 'line-color': MAP_COLORS.accent, 'line-width': 1.8 },
      },
    ],
  };
}
