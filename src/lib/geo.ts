export type LngLat = [number, number];

const R_EARTH_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

export function distanceKm(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type BBox = [number, number, number, number]; // west, south, east, north

export function bboxOf(coordinates: unknown): BBox {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  const walk = (node: unknown): void => {
    if (Array.isArray(node) && typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as LngLat;
      west = Math.min(west, lon);
      east = Math.max(east, lon);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
      return;
    }
    if (Array.isArray(node)) node.forEach(walk);
  };
  walk(coordinates);
  return [west, south, east, north];
}

export const inBBox = (point: LngLat, box: BBox): boolean =>
  point[0] >= box[0] && point[0] <= box[2] && point[1] >= box[1] && point[1] <= box[3];

/** Pads a bbox by a degree margin and clamps to valid ranges. */
export const padBBox = (box: BBox, margin: number): BBox => [
  Math.max(-180, box[0] - margin),
  Math.max(-85, box[1] - margin),
  Math.min(180, box[2] + margin),
  Math.min(85, box[3] + margin),
];

/**
 * Points along the great circle between two places — the path an aircraft or a
 * cable actually takes, not the straight line a flat projection would draw.
 *
 * Longitudes are unwrapped as they are emitted: without that, a Tokyo–Los
 * Angeles arc crosses the antimeridian and the renderer draws it the long way
 * round, straight across the middle of the map.
 */
export function greatCircle(a: LngLat, b: LngLat, steps = 48): LngLat[] {
  const [lon1, lat1] = a.map(toRad) as LngLat;
  const [lon2, lat2] = b.map(toRad) as LngLat;

  const d =
    2 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin((lat2 - lat1) / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
        ),
      ),
    );

  // Coincident endpoints have no defined great circle; a two-point line is the
  // only sane answer and keeps the caller from special-casing it.
  if (!Number.isFinite(d) || d < 1e-9) return [a, b];

  const out: LngLat[] = [];
  let previousLon: number | null = null;

  for (let i = 0; i <= steps; i += 1) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);

    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);

    const lat = Math.atan2(z, Math.hypot(x, y)) * (180 / Math.PI);
    let lon = Math.atan2(y, x) * (180 / Math.PI);

    if (previousLon !== null) {
      while (lon - previousLon > 180) lon -= 360;
      while (lon - previousLon < -180) lon += 360;
    }
    previousLon = lon;
    out.push([lon, lat]);
  }

  return out;
}

/** Deterministic jitter so co-located signals do not stack into one dot. */
export function jitter(point: LngLat, seed: string, amountDeg = 0.35): LngLat {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const angle = ((hash >>> 0) % 360) * (Math.PI / 180);
  const radius = (((hash >>> 9) % 100) / 100) * amountDeg;
  return [point[0] + Math.cos(angle) * radius, point[1] + Math.sin(angle) * radius];
}
