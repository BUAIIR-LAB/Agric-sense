import type { AiToolKind, AiToolSession } from '@/types/aiToolSession';
import { createAiSessionId } from '@/types/aiToolSession';
import type { WeatherRange, WeatherSnapshot } from '@/services/weather';
import { daysForRange } from '@/services/weather';

export function soilSuggestions(bandLabel: string): string[] {
  if (bandLabel === 'Acidic') {
    return [
      'What lime rate should I apply?',
      'Which crops still grow well in acidic soil?',
      'What AgriSense inputs should I buy first?',
    ];
  }
  if (bandLabel === 'Alkaline') {
    return [
      'How do I safely lower soil pH?',
      'Which crops tolerate alkaline soil?',
      'What AgriSense inputs should I buy first?',
    ];
  }
  return [
    'How do I keep this pH stable?',
    'What fertilizer plan fits this soil?',
    'What AgriSense inputs should I buy first?',
  ];
}

export function yieldSuggestions(cropLabel: string): string[] {
  return [
    `How can I improve this ${cropLabel} yield?`,
    'What fertilizer plan fits this field?',
    'When should I harvest for best returns?',
  ];
}

export function mixedYieldSuggestions(cropLabels: string[]): string[] {
  const list = cropLabels.slice(0, 3).join(' + ');
  return [
    `How should I harvest ${list} in the right order?`,
    'Does the NDVI suggest any crop is struggling?',
    'What inputs should I buy for this mixed field?',
  ];
}

export function weatherSuggestions(range: WeatherRange): string[] {
  const window =
    range === 'today' ? 'today' : range === 'week' ? 'this week' : 'the next 16 days';
  return [
    `When should I irrigate ${window}?`,
    `Is field work safe ${window}?`,
    'What pest or disease risk does this weather create?',
  ];
}

export function diagnosisSuggestions(disease: string, isHealthy: boolean): string[] {
  if (isHealthy) {
    return [
      'How do I keep this crop healthy?',
      'What preventive sprays should I consider?',
      'What AgriSense inputs help maintenance?',
    ];
  }
  return [
    `Is ${disease} urgent to treat now?`,
    'How do I apply the recommended treatment?',
    'How do I stop this spreading to other plants?',
  ];
}

export function buildSoilSession(input: {
  ph: number;
  bandLabel: string;
  locationLabel?: string | null;
  conversationId?: string | null;
}): AiToolSession {
  const place = input.locationLabel?.trim() || 'your farm';
  return {
    id: createAiSessionId('soil'),
    tool: 'soil',
    title: `Soil pH · ${place}`,
    provenance: `Based on live SoilGrids reading · pH ${input.ph.toFixed(1)} (${input.bandLabel})`,
    metrics: [
      { label: 'pH', value: input.ph.toFixed(1) },
      { label: 'Status', value: input.bandLabel },
    ],
    suggestions: soilSuggestions(input.bandLabel),
    marketQuery:
      input.bandLabel === 'Acidic' ? 'lime' : input.bandLabel === 'Alkaline' ? 'sulfur' : 'fertilizer',
    conversationId: input.conversationId ?? undefined,
    createdAt: new Date().toISOString(),
  };
}

export function buildYieldSession(input: {
  cropLabel: string;
  acres: number;
  expectedYield: string;
  conversationId?: string | null;
  isMixed?: boolean;
  ndviSummary?: string;
}): AiToolSession {
  return {
    id: createAiSessionId('yield'),
    tool: 'yield',
    title: input.isMixed ? `Yield · Mixed · ${input.acres.toFixed(2)} ac` : `Yield · ${input.cropLabel}`,
    provenance: input.ndviSummary
      ? `Mapped field + NDVI · ${input.expectedYield}`
      : `Based on your field estimate · ${input.acres.toFixed(2)} acres`,
    metrics: [
      { label: input.isMixed ? 'Crops' : 'Crop', value: input.cropLabel },
      { label: 'Area', value: `${input.acres.toFixed(2)} ac` },
      { label: 'Estimate', value: input.expectedYield },
    ],
    suggestions: input.isMixed
      ? mixedYieldSuggestions(input.cropLabel.split(' + '))
      : yieldSuggestions(input.cropLabel),
    marketQuery: 'fertilizer',
    conversationId: input.conversationId ?? undefined,
    createdAt: new Date().toISOString(),
  };
}

export function buildWeatherSession(input: {
  weather: WeatherSnapshot;
  range: WeatherRange;
  conversationId?: string | null;
}): AiToolSession {
  const rangeLabel =
    input.range === 'today' ? 'Today' : input.range === 'week' ? '7 days' : '16 days';
  const days = daysForRange(input.weather, input.range);
  const place = input.weather.locationLabel || 'your farm';
  return {
    id: createAiSessionId('weather'),
    tool: 'weather',
    title: `Weather · ${rangeLabel} · ${place}`,
    provenance: `Based on your ${rangeLabel.toLowerCase()} forecast for ${place}`,
    metrics: [
      {
        label: 'Now',
        value: `${Math.round(input.weather.currentTemperature)}° · ${input.weather.currentConditionLabel}`,
      },
      { label: 'Days', value: String(Math.max(days.length, 1)) },
    ],
    suggestions: weatherSuggestions(input.range),
    marketQuery: undefined,
    conversationId: input.conversationId ?? undefined,
    createdAt: new Date().toISOString(),
  };
}

export function buildDiagnosisSession(input: {
  disease: string;
  confidence: number;
  cropLabel?: string | null;
  isHealthy: boolean;
  conversationId?: string | null;
  sourceRecordId?: string | null;
}): AiToolSession {
  const crop = input.cropLabel?.trim() || 'Crop';
  const titleCore = input.isHealthy ? 'Healthy' : input.disease;
  return {
    id: createAiSessionId('diagnosis'),
    tool: 'diagnosis',
    title: `Diagnosis · ${titleCore}`,
    provenance: input.isHealthy
      ? `Based on your ${crop} scan · ${Math.round(input.confidence * 100)}% confidence`
      : `Based on your ${crop} scan · ${input.disease} · ${Math.round(input.confidence * 100)}% confidence`,
    metrics: [
      { label: 'Finding', value: input.disease },
      { label: 'Confidence', value: `${Math.round(input.confidence * 100)}%` },
    ],
    suggestions: diagnosisSuggestions(input.disease, input.isHealthy),
    marketQuery: input.isHealthy ? 'fertilizer' : input.disease.replace(/\s*\(.*?\)\s*/g, ' ').trim().slice(0, 60),
    conversationId: input.conversationId ?? undefined,
    sourceRecordId: input.sourceRecordId ?? undefined,
    createdAt: new Date().toISOString(),
  };
}

export function toolKindFromFlags(flags: {
  continueSoil?: string;
  continueYield?: string;
  continueWeather?: string;
  continueDiagnosis?: string;
  continueTool?: string;
}): AiToolKind | null {
  const on = (v?: string) => v === '1' || v === 'true';
  if (on(flags.continueSoil)) return 'soil';
  if (on(flags.continueYield)) return 'yield';
  if (on(flags.continueWeather)) return 'weather';
  if (on(flags.continueDiagnosis)) return 'diagnosis';
  if (on(flags.continueTool)) return null; // session already set
  return null;
}
