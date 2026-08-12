import type { AppState, DiagnosisRecord, SpectroscopyRecord } from '@/context/AppContext';

/** Strip heavy API-only fields before writing history to SQLite / AsyncStorage. */
export function sanitizeDiagnosisForStorage(record: DiagnosisRecord): DiagnosisRecord {
  const { image_base64: _removed, ...rest } = record as DiagnosisRecord & { image_base64?: string };
  return rest;
}

export function sanitizeSpectroscopyForStorage(record: SpectroscopyRecord): SpectroscopyRecord {
  return record;
}

export function sanitizeStateForStorage(state: AppState): AppState {
  return {
    ...state,
    diagnosisHistory: state.diagnosisHistory.map(sanitizeDiagnosisForStorage),
    spectroscopyHistory: state.spectroscopyHistory.map(sanitizeSpectroscopyForStorage),
  };
}
