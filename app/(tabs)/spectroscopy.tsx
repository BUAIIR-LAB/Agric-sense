import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';

import { useAppContext } from '@/context/AppContext';
import { useSweetAlert } from '@/components/AlertProvider';
import LiveSpectrumCapture from '@/components/LiveSpectrumCapture';
import ProfileHeader from '@/components/ProfileHeader';
import { Button } from '@/components/ui/Button';
import { palette, gradients } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { SpectrumData } from '@/utils/spectrumProcessing';
import apiService from '@/services/api';
import { getLanguageCode } from '@/constants/languages';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { Card } from '@/components/ui/Card';

type Step = 'plant' | 'growth' | 'mode' | 'capture' | 'result';
type CaptureMode = 'spectrum' | 'image-spectrum';

const PLANT_TYPES = ['Bean', 'Cassava', 'Maize'] as const;
const WEEK_RANGES = ['Week 1-3', 'Week 3-5', 'Week 5-7', 'Week 7-9', 'Week 9-12', 'Week 12-15'] as const;

const STEP_LABELS = ['Crop', 'Stage', 'Mode', 'Capture', 'Results'] as const;
const PREFS_KEY = 'spectroscopy-prefs-v1';

type SpectroscopyPrefs = {
  infoDismissed: boolean;
  plant: typeof PLANT_TYPES[number] | null;
  week: typeof WEEK_RANGES[number] | null;
  mode: CaptureMode | null;
};

export function SpectroscopyScreen({ embedded = false }: { embedded?: boolean }) {
  const { state, isOffline, addSpectroscopyRecord, createSpectroscopyWithAPI } = useAppContext();
  const { showAlert } = useSweetAlert();
  const profile = state.profile;
  const [currentStep, setCurrentStep] = useState<Step>('plant');
  const [isInfoModalVisible, setInfoModalVisible] = useState(false);
  const [showLiveCapture, setShowLiveCapture] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const autoAnalyzeTriggered = useRef(false);

  // Form state
  const [selectedPlant, setSelectedPlant] = useState<typeof PLANT_TYPES[number] | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<typeof WEEK_RANGES[number] | null>(null);
  const [selectedMode, setSelectedMode] = useState<CaptureMode | null>(null);
  const [spectrumData, setSpectrumData] = useState<SpectrumData | null>(null);
  const [plantImage, setPlantImage] = useState<string | null>(null);

  // Analysis results state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    predicted_class: string;
    disease_name: string;
    confidence: number;
  } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMitigation, setAiMitigation] = useState<string | null>(null);

  const savePrefs = useCallback(async (overrides: Partial<SpectroscopyPrefs> = {}) => {
    const prefs: SpectroscopyPrefs = {
      infoDismissed: overrides.infoDismissed ?? true,
      plant: overrides.plant ?? selectedPlant,
      week: overrides.week ?? selectedWeek,
      mode: overrides.mode ?? selectedMode,
    };
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)).catch(() => undefined);
  }, [selectedPlant, selectedWeek, selectedMode]);

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const raw = await AsyncStorage.getItem(PREFS_KEY);
        if (raw) {
          const prefs = JSON.parse(raw) as SpectroscopyPrefs;
          if (prefs.plant) setSelectedPlant(prefs.plant);
          if (prefs.week) setSelectedWeek(prefs.week);
          if (prefs.mode) setSelectedMode(prefs.mode);
          setInfoModalVisible(!prefs.infoDismissed);
        } else {
          setInfoModalVisible(true);
        }
      } catch {
        setInfoModalVisible(true);
      } finally {
        setPrefsLoaded(true);
      }
    };
    loadPrefs();
  }, []);

  const dismissInfoModal = () => {
    setInfoModalVisible(false);
    savePrefs({ infoDismissed: true });
  };

  const buildSpectrumPoints = (data: SpectrumData) =>
    data.intensity.map((intensity, index) => ({
      wavelength: data.wavelength?.[index] ?? Math.round(400 + index * (300 / Math.max(data.intensity.length - 1, 1))),
      intensity,
    }));

  const saveToHistory = useCallback(async (result: { disease_name: string; confidence: number }, data: SpectrumData) => {
    const sampleName = `${selectedPlant ?? 'Crop'} · ${selectedWeek ?? 'Scan'}`;
    const insights = [
      `Detected: ${result.disease_name}`,
      `Mode: ${selectedMode === 'image-spectrum' ? 'Spectrum + Image' : 'Spectrum only'}`,
    ];
    const summary = result.disease_name.toLowerCase().includes('healthy')
      ? `Early scan shows healthy ${selectedPlant ?? 'crop'} at ${selectedWeek ?? 'current stage'}.`
      : `Early detection flagged ${result.disease_name} in ${selectedPlant ?? 'crop'} before visible symptoms.`;

    const record = {
      sampleName,
      spectrum: buildSpectrumPoints(data),
      summary,
      insights,
    };

    if (!isOffline) {
      await createSpectroscopyWithAPI(record);
    } else {
      addSpectroscopyRecord(record);
    }
  }, [selectedPlant, selectedWeek, selectedMode, isOffline, createSpectroscopyWithAPI, addSpectroscopyRecord]);

  const handleNextStep = () => {
    switch (currentStep) {
      case 'plant':
        if (selectedPlant) {
          savePrefs({ plant: selectedPlant });
          setCurrentStep('growth');
        } else showAlert('warning', 'Required', 'Please select a plant type');
        break;
      case 'growth':
        if (selectedWeek) {
          savePrefs({ week: selectedWeek });
          setCurrentStep('mode');
        } else showAlert('warning', 'Required', 'Please select a growth stage');
        break;
      case 'mode':
        if (selectedMode) {
          savePrefs({ mode: selectedMode });
          setCurrentStep('capture');
        } else showAlert('warning', 'Required', 'Please select a capture mode');
        break;
      case 'capture':
        break;
    }
  };

  const handlePreviousStep = () => {
    switch (currentStep) {
      case 'growth':
        setCurrentStep('plant');
        break;
      case 'mode':
        setCurrentStep('growth');
        break;
      case 'capture':
        setCurrentStep('mode');
        break;
      case 'result':
        setCurrentStep('capture');
        break;
    }
  };

  const handleStartSpectrumCapture = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert('warning', 'Camera Access Needed', 'Please grant camera permission to capture spectral data.');
      return;
    }
    setShowLiveCapture(true);
  };

  const handleSpectrumCapture = (data: SpectrumData) => {
    setSpectrumData(data);
    setShowLiveCapture(false);

    // If mode is spectrum only, go to result
    // If mode is image-spectrum, capture image next
    if (selectedMode === 'spectrum') {
      setCurrentStep('result');
    } else {
      handleCapturePlantImage();
    }
  };

  const handleCancelCapture = () => {
    setShowLiveCapture(false);
  };

  const handleCapturePlantImage = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert('warning', 'Camera Access Needed', 'Please grant camera permission to capture plant images.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      setPlantImage(result.assets[0].uri);
      setCurrentStep('result');
    }
  };

  const runSpectralAnalysis = useCallback(async () => {
    if (!spectrumData || !selectedPlant || !selectedWeek || isAnalyzing) return;
    if (isOffline) {
      showAlert('warning', 'Offline', 'Spectral analysis requires an internet connection. Please try again when online.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAiMitigation(null);

    try {
      const spectralArray = spectrumData.intensity;
      const spectralDataNormalized = spectralArray.length === 381
        ? spectralArray
        : spectralArray.length > 381
          ? spectralArray.slice(0, 381)
          : [...spectralArray, ...new Array(381 - spectralArray.length).fill(0)];

      let result;
      if (selectedMode === 'spectrum') {
        result = await apiService.analyzeSpectralOnly(spectralDataNormalized, selectedWeek, selectedPlant);
      } else if (selectedMode === 'image-spectrum' && plantImage) {
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          plantImage,
          [{ resize: { width: 800 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );
        const imageBase64 = await FileSystem.readAsStringAsync(manipulatedImage.uri, { encoding: 'base64' });
        result = await apiService.analyzeSpectralWithImage(
          spectralDataNormalized,
          selectedWeek,
          selectedPlant,
          imageBase64
        );
      } else {
        throw new Error('Invalid mode or missing image');
      }

      if (result.confidence === 0) {
        throw new Error('Poor quality data. Please retake the measurement with better conditions.');
      }

      setAnalysisResult(result);
      await saveToHistory(result, spectrumData);

      const isHealthy = result.disease_name.toLowerCase().includes('healthy');
      if (!isHealthy && !result.disease_name.toLowerCase().includes('other')) {
        fetchAiMitigation(result.disease_name);
      }
    } catch (err: any) {
      console.error('Spectral analysis error:', err);
      showAlert('error', 'Analysis Failed', err.message || 'Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [spectrumData, selectedPlant, selectedWeek, selectedMode, plantImage, isOffline, isAnalyzing, showAlert, saveToHistory]);

  useEffect(() => {
    if (currentStep !== 'result' || !spectrumData || analysisResult || isAnalyzing) return;
    if (selectedMode === 'image-spectrum' && !plantImage) return;
    if (autoAnalyzeTriggered.current) return;
    autoAnalyzeTriggered.current = true;
    runSpectralAnalysis();
  }, [currentStep, spectrumData, plantImage, selectedMode, analysisResult, isAnalyzing, runSpectralAnalysis]);

  const fetchAiMitigation = async (disease: string) => {
    if (!profile?.id) return;
    setIsAiLoading(true);
    setAiMitigation(null);
    try {
      const plantContext = selectedPlant ? ` growing ${selectedPlant}` : '';
      const prompt = `I am a farmer${plantContext}. My crop has been diagnosed with ${disease}${plantContext} based on spectral analysis. Please provide a professional, concise mitigation guide and best treatment steps for ${disease} in ${selectedPlant || 'the detected crop'}. Use clear headings and bullet points. IMPORTANT: Only provide recommendations relevant to ${selectedPlant || 'the detected crop'}.`;
      const response = await apiService.askQuestion({
        prompt,
        user_id: profile.id,
        target_lang: getLanguageCode(profile.preferredLanguage),
      });
      if (response?.results) setAiMitigation(response.results);
    } catch (err) {
      setAiMitigation('Failed to load expert advice. Please try again later.');
    } finally {
      setIsAiLoading(false);
    }
  };


  return (
    <SafeAreaView style={styles.safeArea} edges={embedded ? ['left', 'right', 'bottom'] : undefined}>
      {!embedded && <ProfileHeader />}
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={16} color={palette.brandGreen} />
            <Text style={styles.headerBadgeText}>Early Detection</Text>
          </View>
          <Text style={styles.title}>Spectrum Scan</Text>
          <Text style={styles.subtitle}>
            Catch disease before visible symptoms — use when leaves still look healthy
          </Text>
        </View>

        {/* Step Progress */}
        <View style={styles.stepProgress}>
          {(['plant', 'growth', 'mode', 'capture', 'result'] as Step[]).map((step, index) => (
            <View key={step} style={styles.stepIndicator}>
              <View style={[styles.stepDot, currentStep === step && styles.stepDotActive,
                ['plant', 'growth', 'mode', 'capture', 'result'].indexOf(currentStep) > index && styles.stepDotCompleted]}>
                {['plant', 'growth', 'mode', 'capture', 'result'].indexOf(currentStep) > index ? (
                  <MaterialCommunityIcons name="check" size={14} color={palette.white} />
                ) : (
                  <Text style={[styles.stepNumber, currentStep === step && styles.stepNumberActive]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              {index < 4 && <View style={[styles.stepLine, ['plant', 'growth', 'mode', 'capture', 'result'].indexOf(currentStep) > index && styles.stepLineCompleted]} />}
            </View>
          ))}
        </View>
        <View style={styles.stepLabelsRow}>
          {STEP_LABELS.map((label) => (
            <Text key={label} style={styles.stepLabelText}>{label}</Text>
          ))}
        </View>

        {/* Step Content */}
        <View style={styles.contentSection}>
          {currentStep === 'plant' && (
            <View style={styles.stepCard}>
              <Text style={styles.stepTitle}>Select Plant Type</Text>
              <Text style={styles.stepSubtitle}>Choose the crop you want to analyze</Text>
              <View style={styles.selectionGrid}>
                {PLANT_TYPES.map((plant) => (
                  <Pressable
                    key={plant}
                    style={[styles.selectionCard, selectedPlant === plant && styles.selectionCardActive]}
                    onPress={() => setSelectedPlant(plant)}
                  >
                    <Text style={[styles.selectionText, selectedPlant === plant && styles.selectionTextActive]}>
                      {plant}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={({ pressed }) => [styles.nextButton, pressed && { opacity: 0.85 }]}
                onPress={handleNextStep}
              >
                <Text style={styles.nextButtonText}>Next</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={palette.white} />
              </Pressable>
            </View>
          )}

          {currentStep === 'growth' && (
            <View style={styles.stepCard}>
              <Text style={styles.stepTitle}>Select Growth Stage</Text>
              <Text style={styles.stepSubtitle}>Choose the current stage of your crop</Text>
              <View style={styles.weekGrid}>
                {WEEK_RANGES.map((week) => (
                  <Pressable
                    key={week}
                    style={[styles.weekCard, selectedWeek === week && styles.weekCardActive]}
                    onPress={() => setSelectedWeek(week)}
                  >
                    <Text style={[styles.weekText, selectedWeek === week && styles.weekTextActive]}>
                      {week}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.buttonRow}>
                <Pressable
                  style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.85 }]}
                  onPress={handlePreviousStep}
                >
                  <MaterialCommunityIcons name="chevron-left" size={20} color={palette.brandGreen} />
                  <Text style={styles.backButtonText}>Back</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.nextButton, pressed && { opacity: 0.85 }]}
                  onPress={handleNextStep}
                >
                  <Text style={styles.nextButtonText}>Next</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={palette.white} />
                </Pressable>
              </View>
            </View>
          )}

          {currentStep === 'mode' && (
            <View style={styles.stepCard}>
              <Text style={styles.stepTitle}>Select Capture Mode</Text>
              <Text style={styles.stepSubtitle}>Choose how you want to capture data</Text>
              <View style={styles.modeGrid}>
                <Pressable
                  style={[styles.modeCard, selectedMode === 'spectrum' && styles.modeCardActive]}
                  onPress={() => setSelectedMode('spectrum')}
                >
                  <View style={styles.modeIcon}>
                    <MaterialCommunityIcons name="chart-line" size={40} color={selectedMode === 'spectrum' ? palette.white : palette.brandGreen} />
                  </View>
                  <View style={styles.modeTextContainer}>
                    <Text style={[styles.modeTitle, selectedMode === 'spectrum' && styles.modeTextActive]}>Spectrum Only</Text>
                    <Text style={[styles.modeSubtitle, selectedMode === 'spectrum' && styles.modeSubtitleActive]}>Light signature scan — best for early detection</Text>
                  </View>
                </Pressable>
                <Pressable
                  style={[styles.modeCard, selectedMode === 'image-spectrum' && styles.modeCardActive]}
                  onPress={() => setSelectedMode('image-spectrum')}
                >
                  <View style={styles.modeIcon}>
                    <MaterialCommunityIcons name="camera-iris" size={40} color={selectedMode === 'image-spectrum' ? palette.white : palette.brandGreen} />
                  </View>
                  <View style={styles.modeTextContainer}>
                    <Text style={[styles.modeTitle, selectedMode === 'image-spectrum' && styles.modeTextActive]}>Spectrum + Photo</Text>
                    <Text style={[styles.modeSubtitle, selectedMode === 'image-spectrum' && styles.modeSubtitleActive]}>Combines light scan with a plant photo</Text>
                  </View>
                </Pressable>
              </View>
              <View style={styles.buttonRow}>
                <Pressable
                  style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.85 }]}
                  onPress={handlePreviousStep}
                >
                  <MaterialCommunityIcons name="chevron-left" size={20} color={palette.brandGreen} />
                  <Text style={styles.backButtonText}>Back</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.nextButton, pressed && { opacity: 0.85 }]}
                  onPress={handleNextStep}
                >
                  <Text style={styles.nextButtonText}>Next</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={palette.white} />
                </Pressable>
              </View>
            </View>
          )}

          {currentStep === 'capture' && (
            <View style={styles.stepCard}>
              <Text style={styles.stepTitle}>
                {selectedMode === 'spectrum' ? 'Capture Spectrometer' : 'Capture Spectrometer & Image'}
              </Text>
              <Text style={styles.stepSubtitle}>
                {selectedMode === 'spectrum' 
                  ? 'Point the spectroscope at your crop sample' 
                  : 'First capture spectrum, then take an image'}
              </Text>
              <View style={styles.captureArea}>
                <View style={styles.captureIconContainer}>
                  <View style={styles.captureIconBadge}>
                    <MaterialCommunityIcons name="camera-iris" size={64} color={palette.white} />
                  </View>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.captureButton, pressed && { opacity: 0.85 }]}
                  onPress={handleStartSpectrumCapture}
                >
                  <MaterialCommunityIcons name="camera" size={24} color={palette.white} />
                  <Text style={styles.captureButtonText}>Start Spectrometer Capture</Text>
                </Pressable>
              </View>
              <View style={styles.buttonRow}>
                <Pressable
                  style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.85 }]}
                  onPress={handlePreviousStep}
                >
                  <MaterialCommunityIcons name="chevron-left" size={20} color={palette.brandGreen} />
                  <Text style={styles.backButtonText}>Back</Text>
                </Pressable>
              </View>
            </View>
          )}

          {currentStep === 'result' && (
            <View style={styles.stepCard}>
              {!analysisResult ? (
                <>
                  <Text style={styles.stepTitle}>Analyzing Spectrum</Text>
                  <Text style={styles.stepSubtitle}>Reading spectral signature for early disease signs</Text>
                  
                  <View style={styles.summarySection}>
                    <View style={styles.summaryItem}>
                      <MaterialCommunityIcons name="sprout" size={20} color={palette.brandGreen} />
                      <Text style={styles.summaryLabel}>Plant Type</Text>
                      <Text style={styles.summaryValue}>{selectedPlant}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <MaterialCommunityIcons name="calendar-clock" size={20} color={palette.brandGreen} />
                      <Text style={styles.summaryLabel}>Growth Stage</Text>
                      <Text style={styles.summaryValue}>{selectedWeek}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <MaterialCommunityIcons name="chart-line" size={20} color={palette.brandGreen} />
                      <Text style={styles.summaryLabel}>Spectrometer Data</Text>
                      <Text style={styles.summaryValue}>{spectrumData ? 'Captured' : 'Not captured'}</Text>
                    </View>
                    {selectedMode === 'image-spectrum' && (
                      <View style={styles.summaryItem}>
                        <MaterialCommunityIcons name="image" size={20} color={palette.brandGreen} />
                        <Text style={styles.summaryLabel}>Image</Text>
                        <Text style={styles.summaryValue}>{plantImage ? 'Captured' : 'Not captured'}</Text>
                      </View>
                    )}
                  </View>

                  {isAnalyzing && (
                    <View style={styles.analyzingBanner}>
                      <ActivityIndicator size="small" color={palette.brandGreen} />
                      <Text style={styles.analyzingText}>Running early detection analysis…</Text>
                    </View>
                  )}

                  <View style={styles.buttonRow}>
                    <Button
                      label="Back"
                      variant="secondary"
                      icon="chevron-left"
                      onPress={handlePreviousStep}
                      style={{ flex: 1 }}
                    />
                    {!isAnalyzing && (
                      <Button
                        label="Analyze Again"
                        variant="primary"
                        icon="refresh"
                        onPress={() => {
                          autoAnalyzeTriggered.current = false;
                          runSpectralAnalysis();
                        }}
                        style={{ flex: 1 }}
                      />
                    )}
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.stepTitle}>Analysis Results</Text>
                  <Text style={styles.stepSubtitle}>Spectral analysis complete</Text>

                  <Card variant="elevated" style={styles.resultCard}>
                    {/* Status badge */}
                    <View style={styles.resultHeader}>
                      <LinearGradient
                        colors={
                          analysisResult.disease_name.toLowerCase().includes('healthy')
                            ? [palette.semantic.success, palette.brandGreenLight]
                            : [palette.semantic.warning, '#FFB74D']
                        }
                        style={styles.resultStatusBadge}
                      >
                        <MaterialCommunityIcons
                          name={analysisResult.disease_name.toLowerCase().includes('healthy') ? 'leaf-circle' : 'alert-circle'}
                          size={28}
                          color={palette.white}
                        />
                        <Text style={styles.resultStatusText}>
                          {analysisResult.disease_name.toLowerCase().includes('healthy') ? 'Healthy Crop' : 'Disease Detected'}
                        </Text>
                      </LinearGradient>
                    </View>

                    <View style={styles.resultDetails}>
                      <Text style={styles.resultDiseaseTitle}>{analysisResult.disease_name}</Text>

                      {/* AI Specialist Guide */}
                      {!analysisResult.disease_name.toLowerCase().includes('healthy') && (
                        <View style={styles.summarySection}>
                          <View style={[styles.sectionHeader, { justifyContent: 'space-between' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                              <MaterialCommunityIcons name="leaf" size={20} color={palette.brandGreen} />
                              <Text style={styles.sectionTitle}>AI Specialist Guide</Text>
                            </View>
                            {isAiLoading && <ActivityIndicator size="small" color={palette.brandGreen} />}
                          </View>

                          {isAiLoading ? (
                            <View style={styles.aiLoadingContainer}>
                              <ActivityIndicator size="small" color={palette.brandGreen} />
                              <Text style={styles.aiLoadingText}>Loading expert advice...</Text>
                            </View>
                          ) : aiMitigation ? (
                            <LinearGradient colors={gradients.aiGuide} style={styles.aiResultCard}>
                              <MarkdownRenderer text={aiMitigation} />
                            </LinearGradient>
                          ) : null}
                        </View>
                      )}
                    </View>
                  </Card>

                  <View style={styles.buttonRow}>
                    <Pressable
                      style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.85 }]}
                      onPress={() => {
                        setAnalysisResult(null);
                        setAiMitigation(null);
                        autoAnalyzeTriggered.current = false;
                        handlePreviousStep();
                      }}
                    >
                      <MaterialCommunityIcons name="chevron-left" size={20} color={palette.brandGreen} />
                      <Text style={styles.backButtonText}>Back</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.submitButton, pressed && { opacity: 0.85 }]}
                      onPress={() => {
                        autoAnalyzeTriggered.current = false;
                        setCurrentStep('plant');
                        setSelectedPlant(null);
                        setSelectedWeek(null);
                        setSelectedMode(null);
                        setSpectrumData(null);
                        setPlantImage(null);
                        setAnalysisResult(null);
                        setAiMitigation(null);
                      }}
                    >
                      <MaterialCommunityIcons name="camera-plus" size={20} color={palette.white} />
                      <Text style={styles.submitButtonText}>New Analysis</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Live Spectrum Capture Modal */}
      <Modal
        visible={showLiveCapture}
        animationType="slide"
        onRequestClose={handleCancelCapture}
      >
        <View style={styles.captureModal}>
          <LiveSpectrumCapture
            onCapture={handleSpectrumCapture}
            onCancel={handleCancelCapture}
            stepLabel="Spectrometer Capture"
            height={600}
          />
        </View>
      </Modal>

      {/* Tips Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={prefsLoaded && isInfoModalVisible}
        onRequestClose={dismissInfoModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <MaterialCommunityIcons name="chart-timeline-variant" size={24} color={palette.white} />
              </View>
              <View style={styles.modalHeading}>
                <Text style={styles.modalTitle}>Early Disease Detection</Text>
                <Text style={styles.modalSubtitle}>Find problems before you can see them on the leaf</Text>
              </View>
              <Pressable
                onPress={dismissInfoModal}
                style={styles.modalCloseButton}
                accessibilityLabel="Close tips"
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="close" size={20} color={palette.gray500} />
              </Pressable>
            </View>

            {/* Demo notice inside modal */}
            <View style={styles.modalDemoNotice}>
              <MaterialCommunityIcons name="flask-outline" size={14} color={palette.semantic.info} />
              <Text style={styles.modalDemoText}>
                This feature uses simulated data for demonstration. A compatible spectroscope device is needed for real measurements.
              </Text>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Tips for Best Results</Text>
                <View style={styles.modalTipRow}>
                  <MaterialCommunityIcons name="gesture-tap-hold" size={20} color={palette.brandGreen} />
                  <Text style={styles.modalTipText}>Hold the spectroscope 20 cm above the canopy</Text>
                </View>
                <View style={styles.modalTipRow}>
                  <MaterialCommunityIcons name="weather-sunny-off" size={20} color={palette.brandGreen} />
                  <Text style={styles.modalTipText}>Shade the sensor to minimise glare</Text>
                </View>
                <View style={styles.modalTipRow}>
                  <MaterialCommunityIcons name="chart-timeline-variant" size={20} color={palette.brandGreen} />
                  <Text style={styles.modalTipText}>Watch for sudden dips in the green band</Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={dismissInfoModal}
              style={({ pressed }) => [styles.modalPrimary, pressed && { opacity: 0.85 }]}
              accessibilityLabel="Start spectral diagnosis"
              accessibilityRole="button"
            >
              <Text style={styles.modalPrimaryLabel}>Get Started</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.surface.screen,
  },
  container: {
    paddingBottom: spacing.xxl * 2,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 28,
    color: palette.charcoal,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: palette.gray500,
    marginTop: 4,
    lineHeight: 20,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: palette.tint[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  headerBadgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: palette.brandGreen,
  },
  stepLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  stepLabelText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Fonts.medium,
    fontSize: 10,
    color: palette.gray500,
  },
  analyzingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.tint[100],
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  analyzingText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: palette.brandGreen,
  },

  // ── Step Progress ───────────────────────────────────────────────────────────
  stepProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    backgroundColor: palette.white,
    marginHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border.card,
    shadowColor: palette.brandGreenDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  stepIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.surface.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  stepDotActive: {
    backgroundColor: palette.brandGreen,
    borderColor: palette.brandGreenDark,
    shadowColor: palette.brandGreenDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  stepDotCompleted: {
    backgroundColor: palette.brandGreen,
    borderColor: palette.brandGreenDark,
  },
  stepNumber: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: palette.gray500,
  },
  stepNumberActive: {
    fontFamily: Fonts.bold,
    color: palette.white,
    fontSize: 16,
  },
  stepLine: {
    flex: 1,
    height: 3,
    backgroundColor: palette.surface.secondary,
    marginHorizontal: 6,
    borderRadius: 2,
  },
  stepLineCompleted: {
    backgroundColor: palette.brandGreen,
  },

  // ── Content Section ───────────────────────────────────────────────────────────
  contentSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  stepCard: {
    backgroundColor: palette.white,
    borderRadius: 20,
    padding: spacing.xxl,
    gap: spacing.xl,
    borderWidth: 1,
    borderColor: palette.border.card,
    shadowColor: palette.brandGreenDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  stepTitle: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: palette.charcoal,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: palette.gray500,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Selection Grid ───────────────────────────────────────────────────────────
  selectionGrid: {
    flexDirection: 'column',
    gap: spacing.md,
  },
  selectionCard: {
    backgroundColor: palette.surface.secondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectionCardActive: {
    backgroundColor: palette.brandGreen,
    borderColor: palette.brandGreenDark,
    shadowColor: palette.brandGreenDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  selectionText: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: palette.charcoal,
    textAlign: 'center',
  },
  selectionTextActive: {
    fontFamily: Fonts.bold,
    color: palette.white,
    fontSize: 17,
  },

  // ── Week Grid ────────────────────────────────────────────────────────────────
  weekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  weekCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: palette.surface.secondary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  weekCardActive: {
    backgroundColor: palette.brandGreen,
    borderColor: palette.brandGreenDark,
  },
  weekText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: palette.gray500,
  },
  weekTextActive: {
    fontFamily: Fonts.bold,
    color: palette.white,
  },

  // ── Mode Grid ────────────────────────────────────────────────────────────────
  modeGrid: {
    gap: spacing.md,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface.secondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeCardActive: {
    backgroundColor: palette.brandGreen,
    borderColor: palette.brandGreenDark,
  },
  modeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modeTextContainer: {
    flex: 1,
    gap: 4,
  },
  modeTitle: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: palette.charcoal,
  },
  modeTextActive: {
    color: palette.white,
  },
  modeSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: palette.gray500,
    lineHeight: 18,
  },
  modeSubtitleActive: {
    color: 'rgba(255,255,255,0.85)',
  },

  // ── Capture Area ─────────────────────────────────────────────────────────────
  captureArea: {
    alignItems: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  captureIconContainer: {
    marginBottom: spacing.md,
  },
  captureIconBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.brandGreenDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.brandGreen,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    shadowColor: palette.brandGreenDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  captureButtonText: {
    fontFamily: Fonts.bold,
    color: palette.white,
    fontSize: 16,
  },

  // ── Summary Section ──────────────────────────────────────────────────────────
  summarySection: {
    gap: spacing.md,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.surface.secondary,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  summaryLabel: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: palette.gray500,
    flex: 1,
  },
  summaryValue: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: palette.charcoal,
  },

  // ── Result Card ───────────────────────────────────────────────────────────────
  resultCard: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  resultHeader: {
    marginBottom: spacing.md,
  },
  resultStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
  },
  resultStatusText: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: palette.white,
  },
  resultDetails: {
    gap: spacing.lg,
  },
  resultDiseaseTitle: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: palette.charcoal,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: palette.charcoal,
  },
  aiLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: palette.surface.secondary,
    borderRadius: radius.lg,
  },
  aiLoadingText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: palette.gray500,
  },
  aiResultCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
  },

  // ── Buttons ───────────────────────────────────────────────────────────────────
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderWidth: 2,
    borderColor: palette.brandGreen,
  },
  backButtonText: {
    fontFamily: Fonts.bold,
    color: palette.brandGreen,
    fontSize: 16,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.brandGreen,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    shadowColor: palette.brandGreenDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButtonText: {
    fontFamily: Fonts.bold,
    color: palette.white,
    fontSize: 16,
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.brandGreen,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    shadowColor: palette.brandGreenDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  submitButtonText: {
    fontFamily: Fonts.bold,
    color: palette.white,
    fontSize: 16,
  },

  // ── Modal ────────────────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: palette.white,
    borderRadius: spacing.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeading: {
    flex: 1,
    gap: spacing.xs,
  },
  modalTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: palette.charcoal,
  },
  modalSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: palette.gray500,
    lineHeight: 18,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.surface.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDemoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  modalDemoText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: '#1565C0',
    flex: 1,
    lineHeight: 17,
  },
  modalContent: {
    gap: spacing.lg,
  },
  modalSection: {
    gap: spacing.md,
  },
  modalSectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: palette.charcoal,
    marginBottom: spacing.xs,
  },
  modalTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: palette.surface.secondary,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  modalTipText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: palette.charcoal,
    lineHeight: 20,
  },
  modalPrimary: {
    borderRadius: radius.lg,
    backgroundColor: palette.brandGreen,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    shadowColor: palette.brandGreenDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalPrimaryLabel: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: palette.white,
  },
  captureModal: {
    flex: 1,
    backgroundColor: '#000',
  },
});

export default function SpectroscopyRedirect() {
  return <Redirect href="/(tabs)/scan?mode=early" />;
}
