import {
  bboxFromPoints,
  polygonCentroid,
  toGeoJsonPolygon,
  type LatLng,
} from '@/utils/geo';

const STAC_SEARCH = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
const ITEM_STATS = 'https://planetarycomputer.microsoft.com/api/data/v1/item/statistics';

export type NdviScene = {
  itemId: string;
  datetime: string;
  cloudCover: number;
  meanNdvi: number;
  medianNdvi?: number;
  validPercent?: number;
};

export type SatelliteNdviResult = {
  source: 'Sentinel-2 (Planetary Computer)';
  scenes: NdviScene[];
  /** Peak mean NDVI across sampled scenes */
  peakNdvi: number;
  /** Average of scene means */
  meanNdvi: number;
  centroid: LatLng;
  dateRange: { start: string; end: string };
};

type StacFeature = {
  id: string;
  properties?: {
    datetime?: string;
    'eo:cloud_cover'?: number;
  };
};

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Growing-window dates from planting (or last ~90 days if unknown). */
export function resolveNdviWindow(plantingDateIso?: string): { start: string; end: string } {
  const end = new Date();
  let start = new Date(end);
  start.setDate(start.getDate() - 90);

  if (plantingDateIso) {
    const planted = new Date(plantingDateIso);
    if (!Number.isNaN(planted.getTime())) {
      start = new Date(planted);
      // Sample from ~30 days after planting through now (or +150 days max)
      start.setDate(start.getDate() + 25);
      const maxEnd = new Date(planted);
      maxEnd.setDate(maxEnd.getDate() + 150);
      if (end > maxEnd) {
        // Prefer mid/late season window ending at maxEnd
        return { start: toIsoDate(start), end: toIsoDate(maxEnd) };
      }
    }
  }

  if (start > end) {
    start = new Date(end);
    start.setDate(start.getDate() - 60);
  }

  return { start: toIsoDate(start), end: toIsoDate(end) };
}

async function searchSentinelScenes(
  points: LatLng[],
  start: string,
  end: string,
  signal?: AbortSignal,
): Promise<StacFeature[]> {
  const [minLon, minLat, maxLon, maxLat] = bboxFromPoints(points);
  // Small pad so tiny fields still intersect tiles
  const pad = 0.001;
  const body = {
    collections: ['sentinel-2-l2a'],
    bbox: [minLon - pad, minLat - pad, maxLon + pad, maxLat + pad],
    datetime: `${start}T00:00:00Z/${end}T23:59:59Z`,
    query: { 'eo:cloud_cover': { lt: 45 } },
    limit: 12,
  };

  const res = await fetch(STAC_SEARCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Satellite search failed (${res.status}).`);
  }
  const data = (await res.json()) as { features?: StacFeature[] };
  return data.features ?? [];
}

async function ndviForItem(
  itemId: string,
  points: LatLng[],
  signal?: AbortSignal,
): Promise<{ mean: number; median?: number; validPercent?: number }> {
  const polygon = toGeoJsonPolygon(points);
  const fc = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: polygon }],
  };

  const url =
    `${ITEM_STATS}?collection=sentinel-2-l2a` +
    `&item=${encodeURIComponent(itemId)}` +
    `&expression=${encodeURIComponent('(B08-B04)/(B08+B04)')}` +
    `&asset_as_band=true`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/geo+json', Accept: 'application/json' },
    body: JSON.stringify(fc),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`NDVI stats failed (${res.status}): ${text.slice(0, 120)}`);
  }

  const data = (await res.json()) as {
    features?: Array<{
      properties?: {
        statistics?: Record<string, { mean?: number; median?: number; valid_percent?: number }>;
      };
    }>;
  };

  const stats = data.features?.[0]?.properties?.statistics;
  const key = stats ? Object.keys(stats)[0] : undefined;
  const block = key ? stats![key] : undefined;
  if (typeof block?.mean !== 'number' || !Number.isFinite(block.mean)) {
    throw new Error('No NDVI mean returned for this field.');
  }
  return {
    mean: block.mean,
    median: typeof block.median === 'number' ? block.median : undefined,
    validPercent: typeof block.valid_percent === 'number' ? block.valid_percent : undefined,
  };
}

/**
 * Estimate field NDVI from Sentinel-2 via Microsoft Planetary Computer
 * (STAC search + zonal statistics). No API key required for public use.
 */
export async function fetchFieldNdvi(
  points: LatLng[],
  plantingDateIso?: string,
  signal?: AbortSignal,
): Promise<SatelliteNdviResult> {
  if (points.length < 3) {
    throw new Error('Map at least 3 GPS points around the field.');
  }

  const dateRange = resolveNdviWindow(plantingDateIso);
  const features = await searchSentinelScenes(points, dateRange.start, dateRange.end, signal);
  if (!features.length) {
    throw new Error(
      'No clear Sentinel-2 scenes found for this field and date range. Try again later or adjust planting date.',
    );
  }

  // Prefer clearest scenes; compute NDVI for up to 3
  const candidates = [...features]
    .sort(
      (a, b) =>
        (a.properties?.['eo:cloud_cover'] ?? 100) - (b.properties?.['eo:cloud_cover'] ?? 100),
    )
    .slice(0, 3);

  const scenes: NdviScene[] = [];
  for (const feature of candidates) {
    try {
      const stats = await ndviForItem(feature.id, points, signal);
      scenes.push({
        itemId: feature.id,
        datetime: feature.properties?.datetime ?? '',
        cloudCover: feature.properties?.['eo:cloud_cover'] ?? 0,
        meanNdvi: stats.mean,
        medianNdvi: stats.median,
        validPercent: stats.validPercent,
      });
    } catch {
      // skip failed scene
    }
  }

  if (!scenes.length) {
    throw new Error('Could not compute NDVI for available satellite scenes.');
  }

  const means = scenes.map((s) => s.meanNdvi);
  const peakNdvi = Math.max(...means);
  const meanNdvi = means.reduce((a, b) => a + b, 0) / means.length;

  return {
    source: 'Sentinel-2 (Planetary Computer)',
    scenes,
    peakNdvi,
    meanNdvi,
    centroid: polygonCentroid(points),
    dateRange,
  };
}
