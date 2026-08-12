export type AiToolKind = 'soil' | 'yield' | 'weather' | 'diagnosis';

export type AiToolMetric = {
  label: string;
  value: string;
};

export type AiToolSession = {
  id: string;
  tool: AiToolKind;
  /** Short chip title, e.g. "Soil pH · Tororo" */
  title: string;
  /** Provenance line under the banner */
  provenance: string;
  metrics: AiToolMetric[];
  suggestions: string[];
  /** Prefill marketplace search when shopping from this result */
  marketQuery?: string;
  conversationId?: string;
  /** Diagnosis history id etc. */
  sourceRecordId?: string;
  createdAt: string;
};

export const AI_TOOL_ICONS: Record<AiToolKind, string> = {
  soil: 'flask-outline',
  yield: 'sprout-outline',
  weather: 'weather-partly-cloudy',
  diagnosis: 'leaf-circle-outline',
};

export const AI_TOOL_LABELS: Record<AiToolKind, string> = {
  soil: 'Soil pH',
  yield: 'Yield estimate',
  weather: 'Weather',
  diagnosis: 'Scan & diagnosis',
};

export function createAiSessionId(tool: AiToolKind): string {
  return `${tool}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
