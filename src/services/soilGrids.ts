/**
 * SoilGrids (ISRIC) — global soil property estimates from lat/lon.
 * pH is returned as phh2o mapped units (pH × 10); divide by d_factor (10).
 * https://rest.isric.org/soilgrids/v2.0/properties/query
 *
 * Some urban / water cells return null means — we fall back to quantiles
 * and then sample nearby grid points until a usable value is found.
 */

export type SoilPhDepth = {
  label: string;
  topCm: number;
  bottomCm: number;
  mean: number;
  q05?: number;
  q95?: number;
};

export type SoilPhEstimate = {
  latitude: number;
  longitude: number;
  /** Coordinates actually used for the SoilGrids query (may differ if nearby fallback) */
  sampleLatitude: number;
  sampleLongitude: number;
  source: 'SoilGrids';
  depths: SoilPhDepth[];
  /** Topsoil mean (0–5 cm), preferred for field advice */
  topsoilPh: number;
  fetchedAt: string;
  sampledNearby?: boolean;
  note?: string;
};

type SoilGridsResponse = {
  properties?: {
    layers?: Array<{
      name: string;
      unit_measure?: { d_factor?: number };
      depths?: Array<{
        label: string;
        range?: { top_depth: number; bottom_depth: number };
        values?: Record<string, number | string | null | undefined>;
      }>;
    }>;
  };
};

const SOILGRIDS_URL = 'https://rest.isric.org/soilgrids/v2.0/properties/query';

/** ~1.1 km per 0.01° near equator — spiral out to find a mapped cell */
const NEARBY_OFFSETS_DEG: Array<[number, number]> = [
  [0, 0],
  [0.02, 0],
  [0, 0.02],
  [-0.02, 0],
  [0, -0.02],
  [0.03, 0.03],
  [0.03, -0.03],
  [-0.03, 0.03],
  [-0.03, -0.03],
  [0.05, 0],
  [0, 0.05],
  [-0.05, 0],
  [0, -0.05],
  [0.05, 0.05],
  [0.05, -0.05],
  [-0.05, 0.05],
  [-0.05, -0.05],
  [0.08, 0],
  [0, 0.08],
  [-0.08, 0],
  [0, -0.08],
  [0.1, 0.05],
  [-0.1, 0.05],
  [0.12, 0],
  [0, 0.12],
  [0.15, 0.1],
  [-0.15, 0.1],
];

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function pickQuantile(
  values: Record<string, number | string | null | undefined> | undefined,
  key: '05' | '95',
): number | undefined {
  if (!values) return undefined;
  const candidates =
    key === '05'
      ? [values['Q0.05'], values.Q0_05, values['q0.05']]
      : [values['Q0.95'], values.Q0_95, values['q0.95']];
  for (const c of candidates) {
    const n = toFiniteNumber(c);
    if (n != null) return n;
  }
  return undefined;
}

/** Prefer mean; otherwise midpoint of 5th–95th percentiles. */
function resolvePhRaw(
  values: Record<string, number | string | null | undefined> | undefined,
): { mean?: number; q05?: number; q95?: number } | null {
  if (!values) return null;
  const mean = toFiniteNumber(values.mean);
  const q05 = pickQuantile(values, '05');
  const q95 = pickQuantile(values, '95');
  if (mean != null) return { mean, q05, q95 };
  if (q05 != null && q95 != null) return { mean: (q05 + q95) / 2, q05, q95 };
  if (q05 != null) return { mean: q05, q05, q95 };
  if (q95 != null) return { mean: q95, q05, q95 };
  return null;
}

async function querySoilGridsPoint(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<SoilPhDepth[]> {
  const params = new URLSearchParams();
  params.set('lat', String(latitude));
  params.set('lon', String(longitude));
  params.append('property', 'phh2o');
  params.append('depth', '0-5cm');
  params.append('depth', '5-15cm');
  params.append('depth', '15-30cm');
  params.append('value', 'mean');
  params.append('value', 'Q0.05');
  params.append('value', 'Q0.95');

  const response = await fetch(`${SOILGRIDS_URL}?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`Soil data unavailable (${response.status}).`);
  }

  const data = (await response.json()) as SoilGridsResponse;
  const layer = data.properties?.layers?.find((l) => l.name === 'phh2o');
  if (!layer?.depths?.length) return [];

  const factor =
    layer.unit_measure?.d_factor && layer.unit_measure.d_factor > 0
      ? layer.unit_measure.d_factor
      : 10;

  return layer.depths
    .map((d) => {
      const resolved = resolvePhRaw(d.values);
      if (!resolved || resolved.mean == null) return null;
      return {
        label: d.label,
        topCm: d.range?.top_depth ?? 0,
        bottomCm: d.range?.bottom_depth ?? 0,
        mean: resolved.mean / factor,
        q05: resolved.q05 != null ? resolved.q05 / factor : undefined,
        q95: resolved.q95 != null ? resolved.q95 / factor : undefined,
      } satisfies SoilPhDepth;
    })
    .filter((d): d is SoilPhDepth => d != null);
}

export async function fetchSoilPhFromGps(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<SoilPhEstimate> {
  let lastNetworkError: Error | null = null;

  for (const [dLat, dLon] of NEARBY_OFFSETS_DEG) {
    const sampleLat = latitude + dLat;
    const sampleLon = longitude + dLon;
    try {
      const depths = await querySoilGridsPoint(sampleLat, sampleLon, signal);
      if (!depths.length) continue;

      const topsoil = depths.find((d) => d.label === '0-5cm') ?? depths[0];
      const sampledNearby = dLat !== 0 || dLon !== 0;
      const distanceKm = Math.sqrt(dLat * dLat + dLon * dLon) * 111;

      return {
        latitude,
        longitude,
        sampleLatitude: sampleLat,
        sampleLongitude: sampleLon,
        source: 'SoilGrids',
        depths,
        topsoilPh: topsoil.mean,
        fetchedAt: new Date().toISOString(),
        sampledNearby,
        note: sampledNearby
          ? `Your exact GPS cell had no SoilGrids value; used a nearby sample (~${distanceKm.toFixed(1)} km away). Confirm with a kit when you can.`
          : undefined,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      lastNetworkError = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (lastNetworkError) {
    throw new Error(
      lastNetworkError.message.includes('Network') || lastNetworkError.message.includes('fetch')
        ? 'Could not reach soil data. Check your internet connection, or enter a kit reading below.'
        : lastNetworkError.message,
    );
  }

  throw new Error(
    'No usable pH values near this location. Enter a kit or lab reading below, or try again outdoors.',
  );
}
