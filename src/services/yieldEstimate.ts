import type { SatelliteNdviResult } from '@/services/satelliteNdvi';
import {
  polygonAreaSquareMeters,
  squareMetersToAcres,
  squareMetersToHectares,
  type LatLng,
} from '@/utils/geo';

export type YieldCropId = 'maize' | 'beans' | 'cassava' | 'rice' | 'groundnuts' | 'sorghum';

export type FertilizerLevel = 'none' | 'some' | 'good';
export type WaterRegime = 'rainfed' | 'irrigated';
export type FieldMode = 'single' | 'mixed';
export type CroppingPattern = 'intercrop' | 'strip' | 'relay' | 'mixed_blocks';
export type CropRole = 'main' | 'companion' | 'relay';

export type YieldCrop = {
  id: YieldCropId;
  label: string;
  /** Typical Uganda smallholder yield kg/acre under average management */
  kgPerAcre: number;
  /** NDVI at which vigor factor ≈ 1.0 (mid-late season) */
  targetNdvi: number;
};

export const YIELD_CROPS: YieldCrop[] = [
  { id: 'maize', label: 'Maize', kgPerAcre: 1800, targetNdvi: 0.72 },
  { id: 'beans', label: 'Beans', kgPerAcre: 700, targetNdvi: 0.68 },
  { id: 'cassava', label: 'Cassava', kgPerAcre: 8000, targetNdvi: 0.7 },
  { id: 'rice', label: 'Rice', kgPerAcre: 2200, targetNdvi: 0.75 },
  { id: 'groundnuts', label: 'Groundnuts', kgPerAcre: 900, targetNdvi: 0.65 },
  { id: 'sorghum', label: 'Sorghum', kgPerAcre: 1200, targetNdvi: 0.68 },
];

export const CROPPING_PATTERN_LABELS: Record<CroppingPattern, string> = {
  intercrop: 'Intercrop (same rows)',
  strip: 'Strip cropping',
  relay: 'Relay (staggered planting)',
  mixed_blocks: 'Mixed blocks',
};

export const MIXED_CROP_PRESETS: {
  label: string;
  pattern: CroppingPattern;
  crops: { cropId: YieldCropId; sharePercent: number; role: CropRole }[];
}[] = [
  {
    label: 'Maize + beans',
    pattern: 'intercrop',
    crops: [
      { cropId: 'maize', sharePercent: 65, role: 'main' },
      { cropId: 'beans', sharePercent: 35, role: 'companion' },
    ],
  },
  {
    label: 'Cassava + maize',
    pattern: 'intercrop',
    crops: [
      { cropId: 'cassava', sharePercent: 75, role: 'main' },
      { cropId: 'maize', sharePercent: 25, role: 'companion' },
    ],
  },
  {
    label: 'Maize + beans + groundnuts',
    pattern: 'intercrop',
    crops: [
      { cropId: 'maize', sharePercent: 55, role: 'main' },
      { cropId: 'beans', sharePercent: 30, role: 'companion' },
      { cropId: 'groundnuts', sharePercent: 15, role: 'companion' },
    ],
  },
];

export type MixedCropEntry = {
  cropId: YieldCropId;
  areaSharePercent: number;
  role?: CropRole;
  plantingDate?: string;
  previousYieldKg?: number;
};

export type FarmerYieldInputs = {
  fieldMode: FieldMode;
  cropId: YieldCropId;
  plantingDate?: string;
  fertilizer: FertilizerLevel;
  water: WaterRegime;
  previousYieldKg?: number;
  manualAcres?: number;
  croppingPattern?: CroppingPattern;
  mixedCrops?: MixedCropEntry[];
  fieldNotes?: string;
};

export type YieldEstimateResult = {
  crop: YieldCrop;
  acres: number;
  hectares: number;
  areaSource: 'gps' | 'manual';
  satellite?: SatelliteNdviResult;
  vigorFactor: number;
  managementFactor: number;
  estimatedKg: number;
  lowKg: number;
  highKg: number;
  kgPerAcre: number;
  notes: string[];
};

export type PerCropYieldLine = {
  crop: YieldCrop;
  areaSharePercent: number;
  acresAllocated: number;
  role?: CropRole;
  plantingDate?: string;
  vigorFactor: number;
  estimatedKg: number;
  lowKg: number;
  highKg: number;
  kgPerAcre: number;
};

export type MixedYieldEstimateResult = {
  fieldMode: 'mixed';
  croppingPattern: CroppingPattern;
  acres: number;
  hectares: number;
  areaSource: 'gps' | 'manual';
  satellite?: SatelliteNdviResult;
  managementFactor: number;
  lines: PerCropYieldLine[];
  estimatedKg: number;
  lowKg: number;
  highKg: number;
  notes: string[];
};

export type YieldRunResult = YieldEstimateResult | MixedYieldEstimateResult;

export function isMixedYieldResult(r: YieldRunResult): r is MixedYieldEstimateResult {
  return 'fieldMode' in r && r.fieldMode === 'mixed';
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function managementFactor(fertilizer: FertilizerLevel, water: WaterRegime): number {
  const fert = fertilizer === 'none' ? 0.82 : fertilizer === 'some' ? 1.0 : 1.12;
  const waterF = water === 'irrigated' ? 1.08 : 1.0;
  return fert * waterF;
}

/**
 * Map observed NDVI to a yield vigor multiplier.
 */
export function ndviToVigorFactor(ndvi: number, targetNdvi: number): number {
  if (!Number.isFinite(ndvi)) return 1;
  const floor = 0.2;
  const ceiling = Math.min(0.92, targetNdvi + 0.15);
  if (ndvi <= floor) return 0.45;
  if (ndvi >= ceiling) return 1.22;
  if (ndvi <= targetNdvi) {
    const t = (ndvi - floor) / (targetNdvi - floor);
    return 0.55 + t * (1.0 - 0.55);
  }
  const t = (ndvi - targetNdvi) / (ceiling - targetNdvi);
  return 1.0 + t * (1.22 - 1.0);
}

function intercropVigorMultiplier(
  pattern: CroppingPattern,
  role: CropRole | undefined,
  isMixed: boolean,
): number {
  if (!isMixed) return 1;
  if (role === 'companion') return pattern === 'intercrop' ? 0.9 : 0.93;
  if (role === 'relay') return 0.95;
  return 1;
}

export function resolveFieldAcres(args: {
  points?: LatLng[];
  manualAcres?: number;
}): { acres: number; hectares: number; areaSource: 'gps' | 'manual'; notes: string[] } {
  const notes: string[] = [];
  let acres = 0;
  let hectares = 0;
  let areaSource: 'gps' | 'manual' = 'manual';

  if (args.points && args.points.length >= 3) {
    const m2 = polygonAreaSquareMeters(args.points);
    acres = squareMetersToAcres(m2);
    hectares = squareMetersToHectares(m2);
    areaSource = 'gps';
    if (acres < 0.02) {
      notes.push('Mapped area looks very small — walk the full boundary slowly.');
    }
  }

  if (args.manualAcres && args.manualAcres > 0) {
    if (!(areaSource === 'gps' && acres > 0)) {
      acres = args.manualAcres;
      hectares = acres * 0.40468564224;
      areaSource = 'manual';
    }
  }

  if (!(acres > 0)) {
    throw new Error('Provide a mapped field or enter area in acres.');
  }

  return { acres, hectares, areaSource, notes };
}

function computeCropLine(args: {
  crop: YieldCrop;
  acresAllocated: number;
  sharePercent: number;
  role?: CropRole;
  plantingDate?: string;
  previousYieldKg?: number;
  peakNdvi?: number;
  mgmt: number;
  pattern: CroppingPattern;
  isMixed: boolean;
}): PerCropYieldLine {
  let vigor = 1;
  if (args.peakNdvi != null) {
    vigor =
      ndviToVigorFactor(args.peakNdvi, args.crop.targetNdvi) *
      intercropVigorMultiplier(args.pattern, args.role, args.isMixed);
  }

  let modelKg = args.acresAllocated * args.crop.kgPerAcre * vigor * args.mgmt;

  if (args.previousYieldKg && args.previousYieldKg > 0) {
    modelKg = modelKg * 0.6 + args.previousYieldKg * 0.4;
  }

  const estimatedKg = Math.round(
    clamp(modelKg, 0, args.acresAllocated * args.crop.kgPerAcre * 2.2),
  );

  return {
    crop: args.crop,
    areaSharePercent: args.sharePercent,
    acresAllocated: Number(args.acresAllocated.toFixed(3)),
    role: args.role,
    plantingDate: args.plantingDate,
    vigorFactor: Number(vigor.toFixed(3)),
    estimatedKg,
    lowKg: Math.round(estimatedKg * 0.82),
    highKg: Math.round(estimatedKg * 1.18),
    kgPerAcre: args.acresAllocated > 0 ? Math.round(estimatedKg / args.acresAllocated) : 0,
  };
}

export function computeYieldEstimate(args: {
  points?: LatLng[];
  inputs: FarmerYieldInputs;
  satellite?: SatelliteNdviResult | null;
}): YieldRunResult {
  if (args.inputs.fieldMode === 'mixed' && args.inputs.mixedCrops?.length) {
    return computeMixedYieldEstimate(args);
  }

  const crop = YIELD_CROPS.find((c) => c.id === args.inputs.cropId) ?? YIELD_CROPS[0];
  const { acres, hectares, areaSource, notes } = resolveFieldAcres({
    points: args.points,
    manualAcres: args.inputs.manualAcres,
  });

  const mgmt = managementFactor(args.inputs.fertilizer, args.inputs.water);
  const sat = args.satellite ?? undefined;
  const peakNdvi = sat?.peakNdvi;

  if (sat) {
    notes.push(
      `Satellite peak NDVI ${sat.peakNdvi.toFixed(2)} · mean ${sat.meanNdvi.toFixed(2)} from ${sat.scenes.length} scene(s).`,
    );
  } else {
    notes.push('No satellite NDVI — using management-adjusted regional average.');
  }

  const line = computeCropLine({
    crop,
    acresAllocated: acres,
    sharePercent: 100,
    plantingDate: args.inputs.plantingDate,
    previousYieldKg: args.inputs.previousYieldKg,
    peakNdvi,
    mgmt,
    pattern: 'intercrop',
    isMixed: false,
  });

  notes.push(
    'Baseline combines field area, satellite greenness, and your farm inputs — AI refines the final estimate.',
  );

  return {
    crop,
    acres: Number(acres.toFixed(3)),
    hectares: Number(hectares.toFixed(3)),
    areaSource,
    satellite: sat,
    vigorFactor: line.vigorFactor,
    managementFactor: Number(mgmt.toFixed(3)),
    estimatedKg: line.estimatedKg,
    lowKg: line.lowKg,
    highKg: line.highKg,
    kgPerAcre: line.kgPerAcre,
    notes,
  };
}

export function computeMixedYieldEstimate(args: {
  points?: LatLng[];
  inputs: FarmerYieldInputs;
  satellite?: SatelliteNdviResult | null;
}): MixedYieldEstimateResult {
  const entries = args.inputs.mixedCrops ?? [];
  if (entries.length < 2) {
    throw new Error('Add at least 2 crops for mixed cropping.');
  }

  const shareSum = entries.reduce((s, e) => s + e.areaSharePercent, 0);
  if (Math.abs(shareSum - 100) > 0.5) {
    throw new Error(`Crop shares must total 100% (currently ${Math.round(shareSum)}%).`);
  }

  const { acres, hectares, areaSource, notes } = resolveFieldAcres({
    points: args.points,
    manualAcres: args.inputs.manualAcres,
  });

  const pattern = args.inputs.croppingPattern ?? 'intercrop';
  const mgmt = managementFactor(args.inputs.fertilizer, args.inputs.water);
  const sat = args.satellite ?? undefined;
  const peakNdvi = sat?.peakNdvi;

  if (sat) {
    notes.push(
      `Satellite peak NDVI ${sat.peakNdvi.toFixed(2)} · mean ${sat.meanNdvi.toFixed(2)} — reflects the whole mixed field.`,
    );
  } else {
    notes.push('No satellite NDVI — mixed estimate uses area shares and management only.');
  }

  const lines: PerCropYieldLine[] = entries.map((entry) => {
    const crop = YIELD_CROPS.find((c) => c.id === entry.cropId) ?? YIELD_CROPS[0];
    const allocated = acres * (entry.areaSharePercent / 100);
    return computeCropLine({
      crop,
      acresAllocated: allocated,
      sharePercent: entry.areaSharePercent,
      role: entry.role,
      plantingDate: entry.plantingDate,
      previousYieldKg: entry.previousYieldKg,
      peakNdvi,
      mgmt,
      pattern,
      isMixed: true,
    });
  });

  const estimatedKg = lines.reduce((s, l) => s + l.estimatedKg, 0);
  const lowKg = lines.reduce((s, l) => s + l.lowKg, 0);
  const highKg = lines.reduce((s, l) => s + l.highKg, 0);

  notes.push(
    `Mixed pattern: ${CROPPING_PATTERN_LABELS[pattern]}. AI adjusts per-crop totals for intercrop effects.`,
  );

  return {
    fieldMode: 'mixed',
    croppingPattern: pattern,
    acres: Number(acres.toFixed(3)),
    hectares: Number(hectares.toFixed(3)),
    areaSource,
    satellite: sat,
    managementFactor: Number(mgmt.toFixed(3)),
    lines,
    estimatedKg,
    lowKg,
    highKg,
    notes,
  };
}

export function formatNdviBlock(sat?: SatelliteNdviResult | null): string {
  if (!sat) {
    return 'Satellite NDVI: not available for this field window.';
  }
  const bestCloud = Math.min(...sat.scenes.map((s) => s.cloudCover));
  return [
    `Satellite: ${sat.source}`,
    `Peak NDVI: ${sat.peakNdvi.toFixed(2)}`,
    `Mean NDVI: ${sat.meanNdvi.toFixed(2)}`,
    `Observation window: ${sat.dateRange.start} → ${sat.dateRange.end}`,
    `Scenes: ${sat.scenes.length}, best cloud cover ${bestCloud.toFixed(0)}%`,
    'Note: NDVI is for the whole mapped polygon — allocate vigor to each crop using shares and cropping pattern.',
  ].join('\n');
}

const FERT_LABEL: Record<FertilizerLevel, string> = {
  none: 'No fertilizer',
  some: 'Some fertilizer',
  good: 'Good fertilizer use',
};

const WATER_LABEL: Record<WaterRegime, string> = {
  rainfed: 'Rainfed',
  irrigated: 'Irrigated',
};

export function buildYieldEstimateAiPrompt(args: {
  result: YieldRunResult;
  inputs: FarmerYieldInputs;
  language: string;
  gpsPointsCount?: number;
}): string {
  const { result, inputs, language, gpsPointsCount } = args;
  const lines: string[] = [
    'You are AgriSense AI helping a Ugandan smallholder estimate harvest yield.',
    `Reply only in ${language}. Use clear headings and bullet points.`,
    '',
    `Field area: ${result.acres} acres (${result.areaSource === 'gps' ? 'GPS mapped' : 'manual entry'}${gpsPointsCount ? `, ${gpsPointsCount} boundary points` : ''}).`,
    `Fertilizer: ${FERT_LABEL[inputs.fertilizer]}. Water: ${WATER_LABEL[inputs.water]}.`,
  ];

  if (inputs.fieldNotes?.trim()) {
    lines.push(`Farmer notes: ${inputs.fieldNotes.trim()}`);
  }

  lines.push('', formatNdviBlock(result.satellite));

  if (isMixedYieldResult(result)) {
    lines.push(
      '',
      `Field mode: MIXED CROPPING — pattern: ${CROPPING_PATTERN_LABELS[result.croppingPattern]}.`,
      'Crops and baseline model (calibrate your answer to these, then adjust for intercrop competition/shade/nitrogen sharing):',
    );
    for (const line of result.lines) {
      lines.push(
        `- ${line.crop.label}${line.role ? ` (${line.role})` : ''}: ${line.areaSharePercent}% of field (${line.acresAllocated} ac) · baseline ${line.lowKg}–${line.highKg} kg (mid ${line.estimatedKg} kg) · vigor ×${line.vigorFactor}${line.plantingDate ? ` · planted ${line.plantingDate}` : ''}`,
      );
    }
    lines.push(
      `Combined baseline total: ${result.lowKg}–${result.highKg} kg (mid ≈ ${result.estimatedKg} kg).`,
    );
    lines.push(
      '',
      'Provide:',
      '1. Per-crop estimated harvest (low / mid / high kg) adjusted for mixed cropping',
      '2. Combined field total',
      '3. Confidence (high/medium/low) and key assumptions',
      '4. How NDVI supports or limits the estimate',
      '5. Harvest timing per crop and practical input advice',
      'Keep under 280 words. Do not invent NDVI values.',
    );
  } else {
    lines.push(
      '',
      `Field mode: SINGLE CROP — ${result.crop.label}.`,
      `Baseline model: ${result.lowKg}–${result.highKg} kg (mid ≈ ${result.estimatedKg} kg), ≈ ${result.kgPerAcre} kg/acre.`,
      `Vigor factor ×${result.vigorFactor}, management ×${result.managementFactor}.`,
      inputs.plantingDate ? `Planted: ${inputs.plantingDate}.` : '',
      inputs.previousYieldKg ? `Previous harvest: ${inputs.previousYieldKg} kg.` : '',
      '',
      'Provide:',
      '1. Refined yield estimate (low / mid / high kg)',
      '2. Confidence and how NDVI influenced the estimate',
      '3. Practical tips to improve yield and fertilizer/water advice',
      'Keep under 220 words. Do not invent NDVI values.',
    );
  }

  return lines.filter(Boolean).join('\n');
}

export function earliestPlantingDate(
  inputs: FarmerYieldInputs,
): string | undefined {
  if (inputs.fieldMode === 'single') return inputs.plantingDate;
  const dates = (inputs.mixedCrops ?? [])
    .map((c) => c.plantingDate)
    .filter((d): d is string => !!d?.trim());
  if (!dates.length) return undefined;
  return dates.sort()[0];
}
