export const COMMON_CROPS = [
  'Maize',
  'Cassava',
  'Beans',
  'Coffee',
  'Sorghum',
  'Rice',
  'Groundnuts',
  'Sunflower',
  'Cotton',
  'Bananas (Matooke)',
  'Sweet Potatoes',
  'Soybeans',
  'Millet',
  'Tomatoes',
  'Onions',
] as const;

// Which disease-detection model backs a given crop.
export type DiseaseModel = 'cropnet' | 'plantvillage';

export interface SupportedCrop {
  /** Human-readable label shown in the crop picker. */
  label: string;
  /** Canonical value sent to the backend as `crop_type`. */
  value: string;
  /** Backend model that handles this crop. */
  model: DiseaseModel;
}

/**
 * Crops the Symptom Scan pipeline can actually diagnose today.
 * Cassava is routed to CropNet (wired in Phase 2); the rest go to the
 * PlantVillage model. Keep this in sync with the backend routing
 * (ml_service.py: CROPNET_CROPS / PLANTVILLAGE_CROPS).
 */
export const DISEASE_DETECTION_CROPS: SupportedCrop[] = [
  { label: 'Cassava', value: 'cassava', model: 'cropnet' },
  { label: 'Tomato', value: 'tomato', model: 'plantvillage' },
  { label: 'Maize', value: 'maize', model: 'plantvillage' },
  { label: 'Potato', value: 'potato', model: 'plantvillage' },
  { label: 'Apple', value: 'apple', model: 'plantvillage' },
  { label: 'Grape', value: 'grape', model: 'plantvillage' },
  { label: 'Bell Pepper', value: 'bellpepper', model: 'plantvillage' },
  { label: 'Cherry', value: 'cherry', model: 'plantvillage' },
  { label: 'Peach', value: 'peach', model: 'plantvillage' },
  { label: 'Strawberry', value: 'strawberry', model: 'plantvillage' },
];

/** Map a free-text crop name (e.g. from the user's profile) to a supported crop, if any. */
export function matchSupportedCrop(name?: string): SupportedCrop | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return DISEASE_DETECTION_CROPS.find(
    (c) => c.value === n || c.label.toLowerCase() === n || n.startsWith(c.value),
  );
}
