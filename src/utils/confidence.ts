import { palette } from '@/theme/colors';

/** Normalize API values that may be 0–1 or 0–100 into 0–1. */
export function normalizeConfidence(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(raw)) return 0;
  const value = raw > 1 ? raw / 100 : raw;
  return Math.max(0, Math.min(value, 1));
}

export function confidencePercent(raw: number | null | undefined): number {
  return Math.round(normalizeConfidence(raw) * 100);
}

export type ConfidencePresentation = {
  text: string;
  color: string;
  icon: 'check-circle-outline' | 'alert-circle-outline' | 'information-outline';
};

export function getConfidencePresentation(raw: number | null | undefined): ConfidencePresentation {
  const value = normalizeConfidence(raw);
  if (value >= 0.75) {
    return {
      text: 'High confidence result',
      color: palette.semantic.success,
      icon: 'check-circle-outline',
    };
  }
  if (value >= 0.5) {
    return {
      text: 'Moderate confidence — consider a second scan',
      color: palette.semantic.warning,
      icon: 'alert-circle-outline',
    };
  }
  return {
    text: 'Low confidence — retake in better lighting',
    color: palette.semantic.error,
    icon: 'information-outline',
  };
}
