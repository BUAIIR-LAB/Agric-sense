export const resources = {
  en: {
    common: {
      actions: {
        view: 'View',
        delete: 'Delete',
        cancel: 'Cancel',
      },
      buttons: {
        goBack: 'Go back',
        delete: 'Delete',
        dismiss: 'Dismiss',
      },
      labels: {
        noImage: 'No image attached',
        followUp: 'Follow-up',
        noResponse: 'No response captured.',
      },
      status: {
        notFoundTitle: 'Record not found',
        notFoundMessage: 'The requested history item could not be located.',
      },
    },
    history: {
      heroTitle: 'Activity timeline',
      heroSubtitle: 'Review diagnoses and spectral captures from one place.',
      stats: {
        diagnoses: 'Diagnoses',
        spectra: 'Spectra',
      },
      filters: {
        timeline: 'Timeline',
        diagnosis: 'Diagnoses',
        spectroscopy: 'Spectra',
      },
      sections: {
        latest: 'Latest activity',
        diagnosis: 'Diagnosis history',
        spectroscopy: 'Spectroscopy history',
      },
      empty: {
        timeline: 'Your activity timeline will appear here once you start capturing data.',
        diagnosis: 'Run your first disease diagnosis to populate history.',
        spectroscopy: 'Capture a spectrum to build trends over time.',
      },
      buttons: {
        seeAll: 'See all activity',
        viewDetails: 'View details',
      },
      accessibility: {
        showActions: 'Show actions',
        showDiagnosisActions: 'Show diagnosis actions',
        showSpectrumActions: 'Show spectrum actions',
        openRecord: 'Open record details',
      },
      dialog: {
        removeDiagnosisTitle: 'Remove diagnosis?',
        removeDiagnosisMessage: 'This diagnosis will be removed from your records. This action cannot be undone.',
        removeSpectrumTitle: 'Remove spectrum?',
        removeSpectrumMessage: 'This spectrum record will be removed from your history. This action cannot be undone.',
      },
      meta: {
        confidence: 'Confidence {{value}}%',
        recommendations_one: '{{value}} recommendation',
        recommendations_other: '{{value}} recommendations',
        insights_one: '{{value}} insight',
        insights_other: '{{value}} insights',
      },
      chips: {
        diagnosis: 'Diagnosis',
        spectrum: 'Spectrum',
      },
      fallbacks: {
        diagnosisTitle: 'Crop diagnosis',
        spectrumTitle: 'Spectral capture',
      },
    },
    historyTimeline: {
      title: 'All activity',
      subtitle: 'Review every diagnosis and spectral capture in chronological order.',
      empty: 'No activity captured yet. Diagnoses and spectral captures will appear here.',
    },
    historyDetail: {
      diagnosisTitle: 'Diagnosis detail',
      spectrumTitle: 'Spectrum detail',
      diagnosisLabel: 'Disease diagnosis',
      spectrumLabel: 'Spectral capture',
      suspectedIssues: 'Suspected issues',
      summary: 'Summary',
      recommendations: 'Recommendations',
      insights: 'Insights',
      confidence: 'Confidence {{value}}%',
      sampleName: 'Sample',
      spectralTrace: 'Spectral trace',
      followUp: 'Follow-up',
      noResponse: 'No response captured.',
    },
  },
} as const;

export type SupportedLocale = keyof typeof resources;

