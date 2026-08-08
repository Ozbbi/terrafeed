import type { MapGeoJSONFeature, Point, PointLike } from 'maplibre-gl';

/**
 * A routine news dot is about four pixels across at world zoom. Querying the
 * single pixel under the cursor means the pointer has to land on its centre,
 * which in practice reads as "the dots aren't clickable". Hit-testing a small
 * box around the pointer is what makes them behave like targets.
 */
export const HIT_PADDING = 10;

/** The slice of the map API this needs, so it can be exercised without a GPU. */
export interface QueryableMap {
  queryRenderedFeatures(
    geometry: [PointLike, PointLike],
    options: { layers: string[] },
  ): MapGeoJSONFeature[];
  project(lngLat: [number, number]): { x: number; y: number };
}

export function signalsUnder(
  map: QueryableMap,
  point: Pick<Point, 'x' | 'y'>,
  layers: string[],
): MapGeoJSONFeature[] {
  const hits = map.queryRenderedFeatures(
    [
      [point.x - HIT_PADDING, point.y - HIT_PADDING],
      [point.x + HIT_PADDING, point.y + HIT_PADDING],
    ],
    { layers },
  );
  if (hits.length < 2) return hits;

  // Several dots inside the box: take the one actually nearest the pointer, so
  // the click lands on what the user was aiming at rather than on whichever
  // feature the renderer happened to list first.
  return [...hits].sort((a, b) => {
    const pa = map.project((a.geometry as GeoJSON.Point).coordinates as [number, number]);
    const pb = map.project((b.geometry as GeoJSON.Point).coordinates as [number, number]);
    return (
      Math.hypot(pa.x - point.x, pa.y - point.y) - Math.hypot(pb.x - point.x, pb.y - point.y)
    );
  });
}
