import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { DiagnosisRecord, SpectroscopyRecord } from '@/context/AppContext';

export const summarize = (value: string, limit = 140) =>
  value.length > limit ? `${value.slice(0, limit - 1)}…` : value;

export type TimelineEntry = {
  id: string;
  recordId: string;
  timestamp: string;
  title: string;
  summary: string;
  meta: string;
  type: 'diagnosis' | 'spectroscopy';
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

type TimelineLabels = {
  diagnosisTitle: string;
  spectrumTitle: string;
  confidence: (value: string) => string;
  recommendations: (value: string, count: number) => string;
  insights: (value: string, count: number) => string;
};

export function buildTimelineEntries(
  diagnosisHistory: DiagnosisRecord[],
  spectroscopyHistory: SpectroscopyRecord[],
  labels: TimelineLabels,
  formatNumber: (value: number) => string,
  limit?: number,
): TimelineEntry[] {
  const diagnosisEntries: TimelineEntry[] = diagnosisHistory.map((entry) => {
    const confidence = formatNumber(Math.round(entry.confidence * 100));
    return {
      id: `diagnosis-${entry.id}`,
      recordId: entry.id,
      timestamp: entry.timestamp,
      title: entry.suspectedIssues[0] ?? labels.diagnosisTitle,
      summary: entry.summary,
      meta: `${labels.confidence(confidence)} • ${labels.recommendations(formatNumber(entry.recommendations.length), entry.recommendations.length)}`,
      type: 'diagnosis' as const,
      icon: 'microscope',
    };
  });

  const spectroscopyEntries: TimelineEntry[] = spectroscopyHistory.map((entry) => ({
    id: `spectroscopy-${entry.id}`,
    recordId: entry.id,
    timestamp: entry.timestamp,
    title: entry.sampleName || labels.spectrumTitle,
    summary: entry.summary,
    meta: labels.insights(formatNumber(entry.insights.length), entry.insights.length),
    type: 'spectroscopy' as const,
    icon: 'chart-timeline-variant',
  }));

  const sorted = [...diagnosisEntries, ...spectroscopyEntries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return limit ? sorted.slice(0, limit) : sorted;
}
