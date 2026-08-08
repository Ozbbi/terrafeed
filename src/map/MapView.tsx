import { useEffect, useRef, useState } from 'react';
import maplibregl, { type MapGeoJSONFeature, type Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { countryPressure } from '../analysis/pressure';
import { useStore } from '../state/store';
import type { BBox } from '../lib/geo';
import { signalsUnder, type QueryableMap } from './hitTest';
import { linksToGeoJson } from '../analysis/links';
import {
  addLinkLayers,
  addSignalLayers,
  LINK_HIT_LAYERS,
  SIGNAL_HIT_LAYERS,
  toFeatureCollection,
} from './signalLayers';
import { buildStyle, EMPTY_FC } from './style';

const hitSignals = (map: MapLibreMap, point: maplibregl.Point) =>
  signalsUnder(map as unknown as QueryableMap, point, SIGNAL_HIT_LAYERS);

interface Hover {
  x: number;
  y: number;
  title: string;
  subtitle: string;
}

export function MapView() {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const hoveredCountry = useRef<string | null>(null);
  // Pointer handlers are attached at creation but the layers they query only
  // exist once the style has loaded. Without this guard a click during startup
  // (or a hot reload) throws out of MapLibre's event dispatcher.
  const layersReady = useRef(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const [loaded, setLoaded] = useState(false);

  const db = useStore((s) => s.db);
  // The map shows what the topic watchlist lets through, so selecting a topic
  // visibly clears the map rather than only trimming the list.
  const signals = useStore((s) => s.visibleSignals);
  const selected = useStore((s) => s.selected);
  const selectedCountry = useStore((s) => s.selectedCountry);
  const pressureOverlay = useStore((s) => s.pressureOverlay);
  const links = useStore((s) => s.links);
  const linkOverlay = useStore((s) => s.linkOverlay);

  // --- create the map once the country geometry is in memory ---------------
  useEffect(() => {
    if (!db || !container.current || map.current) return;

    const instance = new maplibregl.Map({
      container: container.current,
      style: buildStyle(db.geojson),
      center: [18, 26],
      zoom: 1.6,
      minZoom: 0.8,
      maxZoom: 11,
      attributionControl: false,
      dragRotate: false,
      renderWorldCopies: true,
    });
    map.current = instance;
    if (import.meta.env.DEV) {
      (window as unknown as { __terrafeedMap: MapLibreMap }).__terrafeedMap = instance;
    }

    // An invalid paint expression makes MapLibre drop the layer and carry on, so
    // a whole class of mistakes shows up as "the dots are missing" and nothing
    // else. Surfacing them is the difference between a five-minute fix and a
    // hunt through a map that looks almost right.
    instance.on('error', (event) => {
      console.error('[terrafeed/map]', event.error?.message ?? event);
    });

    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    instance.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    instance.on('load', () => {
      // Arcs first: they belong under the dots, not over them.
      addLinkLayers(instance);
      addSignalLayers(instance);
      layersReady.current = true;
      setLoaded(true);
      const bounds = instance.getBounds();
      useStore
        .getState()
        .setBBox([
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ] as BBox);
    });

    instance.on('moveend', () => {
      const bounds = instance.getBounds();
      useStore
        .getState()
        .setBBox([
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ] as BBox);
    });

    // --- hover: signal tooltip wins over country tooltip ------------------
    instance.on('mousemove', (event) => {
      if (!layersReady.current) return;
      const hits = hitSignals(instance, event.point);
      if (hits.length) {
        const props = hits[0].properties as Record<string, string>;
        instance.getCanvas().style.cursor = 'pointer';
        setHover({
          x: event.point.x,
          y: event.point.y,
          title: props.title ?? '',
          subtitle: props.source ?? '',
        });
        return;
      }

      // An arc is only worth drawing if it can say what it represents.
      const arcs = instance.getLayer('link-line')
        ? instance.queryRenderedFeatures(
            [
              [event.point.x - 4, event.point.y - 4],
              [event.point.x + 4, event.point.y + 4],
            ],
            { layers: LINK_HIT_LAYERS },
          )
        : [];
      if (arcs.length) {
        const props = arcs[0].properties as Record<string, string>;
        instance.getCanvas().style.cursor = 'pointer';
        setHover({
          x: event.point.x,
          y: event.point.y,
          title: props.headline ?? '',
          subtitle: `${props.pair} · ${props.count} ${
            Number(props.count) === 1 ? 'story' : 'stories'
          } · ${props.source ?? ''}`,
        });
        return;
      }

      instance.getCanvas().style.cursor = '';
      const countries = instance.queryRenderedFeatures(event.point, { layers: ['country-fill'] });
      const feature = countries[0] as MapGeoJSONFeature | undefined;

      if (hoveredCountry.current && hoveredCountry.current !== feature?.id) {
        instance.setFeatureState(
          { source: 'countries', id: hoveredCountry.current },
          { hover: false },
        );
        hoveredCountry.current = null;
      }
      if (!feature) {
        setHover(null);
        return;
      }

      hoveredCountry.current = String(feature.id);
      instance.setFeatureState({ source: 'countries', id: feature.id }, { hover: true });
      const props = feature.properties as Record<string, string>;
      setHover({
        x: event.point.x,
        y: event.point.y,
        title: props.name ?? '',
        subtitle: props.subregion ?? props.continent ?? '',
      });
    });

    instance.on('mouseout', () => setHover(null));

    instance.on('click', (event) => {
      if (!layersReady.current) return;
      const hits = hitSignals(instance, event.point);
      if (hits.length) {
        const id = (hits[0].properties as Record<string, string>).id;
        const match = useStore.getState().visibleSignals.find((signal) => signal.id === id);
        if (match) {
          useStore.getState().select(match);
          return;
        }
      }
      const countries = instance.queryRenderedFeatures(event.point, { layers: ['country-fill'] });
      useStore
        .getState()
        .selectCountry(countries.length ? String(countries[0].id) : null);
    });

    return () => {
      layersReady.current = false;
      instance.remove();
      map.current = null;
      setLoaded(false);
    };
  }, [db]);

  // --- push signals into the GL source ------------------------------------
  useEffect(() => {
    if (!loaded || !map.current) return;
    const source = map.current.getSource('signals') as maplibregl.GeoJSONSource | undefined;
    source?.setData(toFeatureCollection(signals));
  }, [signals, loaded]);

  // --- story arcs between co-mentioned countries ---------------------------
  useEffect(() => {
    if (!loaded || !map.current) return;
    const instance = map.current;

    for (const id of ['link-glow', 'link-line']) {
      if (instance.getLayer(id)) {
        instance.setLayoutProperty(id, 'visibility', linkOverlay ? 'visible' : 'none');
      }
    }

    const source = instance.getSource('links') as maplibregl.GeoJSONSource | undefined;
    source?.setData(linksToGeoJson(linkOverlay ? links : []));
  }, [links, linkOverlay, loaded]);

  // --- choropleth of observed pressure ------------------------------------
  useEffect(() => {
    if (!loaded || !map.current || !db) return;
    const instance = map.current;
    instance.setLayoutProperty(
      'country-pressure',
      'visibility',
      pressureOverlay ? 'visible' : 'none',
    );
    if (!pressureOverlay) return;

    const scores = countryPressure(signals);
    for (const country of db.list) {
      instance.setFeatureState(
        { source: 'countries', id: country.iso3 },
        { pressure: scores.get(country.iso3) ?? 0 },
      );
    }
  }, [signals, pressureOverlay, loaded, db]);

  // --- selection highlight -------------------------------------------------
  useEffect(() => {
    if (!loaded || !map.current) return;
    const source = map.current.getSource('selection') as maplibregl.GeoJSONSource | undefined;
    if (!selected) {
      source?.setData(EMPTY_FC);
      return;
    }
    source?.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { severity: selected.severity },
          geometry: { type: 'Point', coordinates: [selected.lon, selected.lat] },
        },
      ],
    });
    map.current.easeTo({
      center: [selected.lon, selected.lat],
      zoom: Math.max(map.current.getZoom(), 3.4),
      duration: 700,
    });
  }, [selected, loaded]);

  useEffect(() => {
    if (!loaded || !map.current || !db) return;
    map.current.setFilter('country-selected', [
      '==',
      ['get', 'iso3'],
      selectedCountry ?? '__none__',
    ]);
    if (!selectedCountry) return;

    const country = db.byIso3.get(selectedCountry);
    if (country) {
      map.current.fitBounds(
        [
          [country.bbox[0], country.bbox[1]],
          [country.bbox[2], country.bbox[3]],
        ],
        { padding: 160, maxZoom: 5, duration: 800 },
      );
    }
  }, [selectedCountry, loaded, db]);

  return (
    <div className="map-wrap">
      <div ref={container} className="map-canvas" />
      {hover && (
        <div className="map-tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <strong>{hover.title}</strong>
          {hover.subtitle && <span>{hover.subtitle}</span>}
        </div>
      )}
    </div>
  );
}
