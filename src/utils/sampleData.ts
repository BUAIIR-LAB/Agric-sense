import { DiagnosisRecord, SpectroscopyRecord } from '@/context/AppContext';

const diseaseInsights = [
  {
    name: 'Maize Leaf Blight',
    summary:
      'Symptoms include elongated lesions on leaves. Caused by Exserohilum turcicum, often triggered by humid conditions.',
    recommendations: [
      'Remove and destroy heavily infected leaves to limit spread.',
      'Apply a protective fungicide containing mancozeb or propiconazole.',
      'Rotate crops with non-host species for at least one season.',
    ],
  },
  {
    name: 'Cassava Mosaic Disease',
    summary:
      'Characterised by mosaic patterns on leaves and stunted growth. Virus transmitted by whiteflies and infected cuttings.',
    recommendations: [
      'Plant certified disease-free cuttings from tolerant varieties.',
      'Control whitefly populations using yellow sticky traps or neem-based sprays.',
      'Rogue out and destroy infected plants promptly.',
    ],
  },
  {
    name: 'Bean Anthracnose',
    summary:
      'Dark, sunken lesions on pods and stems. Thrives in cool, wet weather and spreads through contaminated seed.',
    recommendations: [
      'Use clean, treated seed and resistant varieties.',
      'Practice field sanitation and avoid working in wet fields.',
      'Consider copper-based fungicide sprays at early signs.',
    ],
  },
  {
    name: 'Coffee Leaf Rust',
    summary:
      'Orange powdery pustules on leaf undersides leading to premature leaf drop.',
    recommendations: [
      'Apply systemic fungicides such as triazoles during outbreaks.',
      'Maintain good pruning practices to improve airflow.',
      'Provide balanced nutrition with emphasis on potassium.',
    ],
  },
];

const spectroscopyNarratives = [
  {
    summary: 'Spectral signature indicates healthy chlorophyll content with minimal stress markers.',
    insights: [
      'Peak around 680nm shows strong chlorophyll absorption indicating robust photosynthetic activity.',
      'Near-infrared reflectance remains high suggesting intact cellular structure.',
      'No significant water stress indicators detected in 900-950nm band.',
    ],
  },
  {
    summary: 'Moderate nutrient stress inferred from reduced red-edge reflectance.',
    insights: [
      'Shifted red-edge around 720nm points to potential nitrogen deficiency.',
      'Visible green band reflectance slightly elevated, typical in chlorophyll stress.',
      'Consider foliar feeding with nitrogen-rich fertilizer.',
    ],
  },
  {
    summary: 'Thermal stress signature with drops in NIR reflectance.',
    insights: [
      'Lower reflectance above 800nm indicates water stress or heat damage.',
      'Visible spectrum remains stable, implying early-stage stress.',
      'Recommend irrigation review and mulching to conserve moisture.',
    ],
  },
];

const assistantResponses = [
  'Based on the information, consider monitoring the crop over the next 3-5 days and apply preventive measures.',
  'I recommend consulting with your nearest extension officer if symptoms persist after recommended actions.',
  'Remember to capture clear, well-lit photos for improved diagnosis accuracy.',
  'You can follow up with soil testing to rule out nutrient imbalances contributing to these symptoms.',
];

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;

export const generateMockDiagnosis = (imageUri?: string): DiagnosisRecord => {
  const selection = diseaseInsights[Math.floor(Math.random() * diseaseInsights.length)];
  return {
    id: createId(),
    imageUri,
    suspectedIssues: [selection.name],
    confidence: Number(randomBetween(0.6, 0.95).toFixed(2)),
    summary: selection.summary,
    recommendations: selection.recommendations,
    timestamp: new Date().toISOString(),
  };
};

const generateSpectrumPoints = () =>
  Array.from({ length: 30 }, (_, index) => {
    const wavelength = 400 + index * 10;
    const modulation = Math.sin(index / 4) * 15 + Math.random() * 5;
    const intensity = Number((60 + modulation + index * 1.5).toFixed(2));
    return { wavelength, intensity };
  });

export const generateMockSpectroscopy = (sampleName: string): SpectroscopyRecord => {
  const selection = spectroscopyNarratives[Math.floor(Math.random() * spectroscopyNarratives.length)];
  return {
    id: createId(),
    sampleName,
    spectrum: generateSpectrumPoints(),
    summary: selection.summary,
    insights: selection.insights,
    timestamp: new Date().toISOString(),
  };
};

export const generateAssistantResponse = () =>
  assistantResponses[Math.floor(Math.random() * assistantResponses.length)];
