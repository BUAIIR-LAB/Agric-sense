export type LatLng = { latitude: number; longitude: number };

export type GeoJsonPolygon = {
  type: 'Polygon';
  coordinates: number[][][];
};

const EARTH_RADIUS_M = 6371008.8;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Haversine distance in meters */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Close a ring if first/last are not the same point */
export function closeRing(points: LatLng[]): LatLng[] {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (distanceMeters(first, last) < 1) return points;
  return [...points, { ...first }];
}

/**
 * Polygon area in m² using equirectangular projection relative to centroid.
 */
export function polygonAreaSquareMeters(points: LatLng[]): number {
  const ring = closeRing(points);
  if (ring.length < 4) return 0;

  const lats = ring.map((p) => p.latitude);
  const lons = ring.map((p) => p.longitude);
  const meanLat = lats.reduce((s, v) => s + v, 0) / lats.length;
  const meanLon = lons.reduce((s, v) => s + v, 0) / lons.length;
  const cosLat = Math.cos(toRad(meanLat));

  const xy = ring.map((p) => ({
    x: toRad(p.longitude - meanLon) * cosLat * EARTH_RADIUS_M,
    y: toRad(p.latitude - meanLat) * EARTH_RADIUS_M,
  }));

  let sum = 0;
  for (let i = 0; i < xy.length - 1; i++) {
    sum += xy[i].x * xy[i + 1].y - xy[i + 1].x * xy[i].y;
  }
  return Math.abs(sum) / 2;
}

export function squareMetersToAcres(m2: number): number {
  return m2 / 4046.8564224;
}

export function squareMetersToHectares(m2: number): number {
  return m2 / 10000;
}

export function polygonPerimeterMeters(points: LatLng[]): number {
  const ring = closeRing(points);
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    total += distanceMeters(ring[i], ring[i + 1]);
  }
  return total;
}

export function polygonCentroid(points: LatLng[]): LatLng {
  const ring = points.length ? points : [{ latitude: 0, longitude: 0 }];
  const lat = ring.reduce((s, p) => s + p.latitude, 0) / ring.length;
  const lon = ring.reduce((s, p) => s + p.longitude, 0) / ring.length;
  return { latitude: lat, longitude: lon };
}

/** GeoJSON Polygon coordinates [lon, lat][] */
export function toGeoJsonPolygon(points: LatLng[]): GeoJsonPolygon {
  const ring = closeRing(points);
  return {
    type: 'Polygon',
    coordinates: [ring.map((p) => [p.longitude, p.latitude])],
  };
}

export function bboxFromPoints(points: LatLng[]): [number, number, number, number] {
  const lats = points.map((p) => p.latitude);
  const lons = points.map((p) => p.longitude);
  return [
    Math.min(...lons),
    Math.min(...lats),
    Math.max(...lons),
    Math.max(...lats),
  ];
}
