import { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  Animated,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter, Redirect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';

import { useAppContext, type DiagnosisRecord } from '@/context/AppContext';
import { ResultAiActions } from '@/components/ResultAiActions';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import { buildDiagnosisSession, diagnosisSuggestions } from '@/utils/aiAdvisor';
import { scheduleDiagnosisCompleteNotification } from '@/utils/notifications';
import ProfileHeader from '@/components/ProfileHeader';
import { palette, gradients } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { spacing, radius, getResponsiveSpacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { elevation } from '@/theme/elevation';
import apiService from '@/services/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { useResponsiveDimensions, responsiveFontSize, moderateScale } from '@/utils/responsive';
import { getLanguageCode } from '@/constants/languages';
import { DISEASE_DETECTION_CROPS, matchSupportedCrop, type SupportedCrop } from '@/constants/crops';

type ScreenStep = 'capture' | 'processing' | 'results';

const SCAN_TIPS = [
  { icon: 'white-balance-sunny', text: 'Use natural light — avoid direct sun glare' },
  { icon: 'image-filter-center-focus', text: 'Frame one leaf or affected area clearly' },
  { icon: 'ruler', text: 'Hold the camera 20–30 cm from the leaf' },
  { icon: 'leaf', text: 'Ensure the leaf fills at least half the frame' },
];

export function DiagnosisScreen({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const { addDiagnosisRecord, state, isOffline } = useAppContext();
  const { openSeeded } = useAiAdvisor();
  const profile = state.profile;
  const { width: screenWidth, height: screenHeight, isSmall, deviceType } = useResponsiveDimensions();
  const responsiveSpacing = getResponsiveSpacing();

  const [currentStep, setCurrentStep] = useState<ScreenStep>('capture');
  const [selectedCrop, setSelectedCrop] = useState<SupportedCrop | undefined>();
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisRecord | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMitigation, setAiMitigation] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [contextPrompt, setContextPrompt] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0.4)).current;
  const stepFadeAnim = useRef(new Animated.Value(1)).current;
  const autoAnalyzeRef = useRef(false);

  useEffect(() => {
    if (isProcessing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isProcessing]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [imageUri]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: processingProgress / 100,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [processingProgress]);

  useEffect(() => {
    if (isAiLoading) {
      const shimmer = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(shimmerAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        ])
      );
      shimmer.start();
      return () => shimmer.stop();
    }
  }, [isAiLoading]);

  useEffect(() => {
    ImagePicker.requestCameraPermissionsAsync();
  }, []);

  // Prefill the crop from the user's profile (first crop we actually support).
  useEffect(() => {
    if (selectedCrop) return;
    const fromProfile = (profile?.cropsGrown ?? [])
      .map((c) => matchSupportedCrop(c))
      .find(Boolean);
    if (fromProfile) setSelectedCrop(fromProfile);
  }, [profile?.cropsGrown]);

  const transitionToStep = (step: ScreenStep) => {
    Animated.timing(stepFadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setCurrentStep(step);
      Animated.timing(stepFadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  };

  const captureFromCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera Permission Required', 'Please grant camera permission to capture photos.', [{ text: 'OK' }]);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setImageUri(result.assets[0].uri);
        setError(null);
        autoAnalyzeRef.current = true;
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }
    } catch (err: any) {
      setError('Failed to capture image. Please try again.');
    }
  };

  const selectFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Gallery Permission Required', 'Please grant gallery permission to select photos.', [{ text: 'OK' }]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setImageUri(result.assets[0].uri);
        setError(null);
        autoAnalyzeRef.current = true;
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }
    } catch (err: any) {
      setError('Failed to select image. Please try again.');
    }
  };

  const runDiagnosis = async () => {
    if (!imageUri || isProcessing) return;
    if (!selectedCrop) {
      setError('Please select the crop you are scanning before analyzing.');
      return;
    }
    if (isOffline) {
      setError('Diagnosis requires an internet connection. Please try again when online.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProcessingProgress(0);
    transitionToStep('processing');

    try {
      setProcessingProgress(20);
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 800 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );

      setProcessingProgress(40);
      const imageBase64 = await FileSystem.readAsStringAsync(manipulatedImage.uri, { encoding: 'base64' });

      setProcessingProgress(60);
      const targetLang = getLanguageCode(profile?.preferredLanguage);
      const diagnosisResponse = await apiService.diagnoseFromImage(imageBase64, targetLang, selectedCrop.value);

      setProcessingProgress(80);

      if (!diagnosisResponse || !diagnosisResponse.suspected_issues?.length) {
        throw new Error('Invalid response from diagnosis API');
      }

      setProcessingProgress(100);

      // Pipeline rejected the image (not a clear leaf / unsupported crop / model
      // unavailable). Surface the server's message and send the user back to capture.
      if (diagnosisResponse.status === 'rejected') {
        throw new Error(
          diagnosisResponse.summary ||
            diagnosisResponse.suspected_issues[0] ||
            'This image could not be diagnosed. Please retake a clear photo of a single leaf.',
        );
      }

      // Check if confidence is 0 (bad image)
      if (diagnosisResponse.confidence === 0) {
        throw new Error('Bad image quality. Please retake the photo with better lighting and focus.');
      }
      
      const record: DiagnosisRecord = {
        id: diagnosisResponse.id,
        imageUri,
        suspectedIssues: diagnosisResponse.suspected_issues,
        confidence: diagnosisResponse.confidence,
        summary: diagnosisResponse.summary,
        recommendations: diagnosisResponse.recommendations,
        timestamp: new Date(diagnosisResponse.timestamp).toISOString(),
      };

      setDiagnosisResult(record);
      addDiagnosisRecord(record);
      transitionToStep('results');

      const isHealthyResult = record.suspectedIssues[0]?.toLowerCase().includes('healthy');
      scheduleDiagnosisCompleteNotification(
        record.suspectedIssues[0] ?? 'Unknown issue',
        record.confidence,
        isHealthyResult,
      );

      if (!isHealthyResult || record.suspectedIssues[0]?.toLowerCase().includes('other disease')) {
        fetchAiMitigation(record.suspectedIssues[0], selectedCrop?.label ?? selectedCrop?.value);
      }
    } catch (err: any) {
      let errorMessage = 'Diagnosis failed. Please try again.';
      if (err.message?.includes('timeout') || err.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      } else if (err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      transitionToStep('capture');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  useEffect(() => {
    // Auto-analyze only once a crop is selected (routing requires it).
    if (!imageUri || !selectedCrop || !autoAnalyzeRef.current || isProcessing || currentStep !== 'capture') return;
    autoAnalyzeRef.current = false;
    runDiagnosis();
  }, [imageUri, selectedCrop, isProcessing, currentStep]);

  const fetchAiMitigation = async (disease: string, plantType?: string) => {
    if (!profile?.id) return;
    setIsAiLoading(true);
    setAiMitigation(null);
    setConversationId(null);
    setContextPrompt(null);
    try {
      const crop = plantType || 'the detected crop';
      const prompt = `I am a farmer growing ${crop}. My crop has been diagnosed with ${disease}.

Please provide a professional, concise mitigation guide for ${disease} on ${crop}. Use clear headings and bullet points covering:
1. What the disease is and how it spreads
2. Immediate treatment steps I can take now
3. Recommended farm inputs and treatments (fungicides, pesticides, fertilizers, or other products by type/active ingredient) that I can buy on the AgriSense marketplace to treat this disease — name specific product types a farmer should search for
4. Prevention so it does not return

IMPORTANT: Only provide recommendations relevant to ${crop}. Keep advice practical for smallholder farmers.`;
      setContextPrompt(prompt);
      const response = await apiService.askQuestion({
        prompt,
        user_id: profile.id,
        target_lang: getLanguageCode(profile.preferredLanguage),
      });
      if (response?.results) setAiMitigation(response.results);
      if (response?.conversation_id) setConversationId(response.conversation_id);
    } catch (err) {
      setAiMitigation('Failed to load expert advice. Please try again later.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const treatmentSearchQuery = () => {
    const raw = diagnosisResult?.suspectedIssues[0] || '';
    return raw
      .replace(/\s*\(.*?\)\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);
  };

  const openDiagnosisAdvisor = (followUp?: string) => {
    if (!aiMitigation || !diagnosisResult) return;
    const disease = diagnosisResult.suspectedIssues[0];
    const crop = selectedCrop?.label ?? selectedCrop?.value ?? 'my crop';
    const isHealthy = disease?.toLowerCase().includes('healthy') ?? false;
    const userContent =
      contextPrompt ||
      `My ${crop} was diagnosed with ${disease} (${Math.round(diagnosisResult.confidence * 100)}% confidence). ${diagnosisResult.summary || ''} Please help me treat it and suggest products from AgriSense marketplace.`;

    const session = buildDiagnosisSession({
      disease,
      confidence: diagnosisResult.confidence,
      cropLabel: crop,
      isHealthy,
      conversationId,
      sourceRecordId: diagnosisResult.id,
    });

    openSeeded({
      session,
      messages: [
        { role: 'user', modality: 'text', content: userContent },
        { role: 'assistant', modality: 'text', content: aiMitigation },
      ],
      followUp,
    });
  };

  const browseTreatments = () => {
    const q = treatmentSearchQuery();
    router.push({
      pathname: '/(tabs)/marketplace',
      params: {
        mode: 'buy',
        ...(q ? { q } : {}),
      },
    });
  };

  const resetDiagnosis = () => {
    autoAnalyzeRef.current = false;
    setImageUri(undefined);
    setDiagnosisResult(undefined);
    setAiMitigation(null);
    setConversationId(null);
    setContextPrompt(null);
    setIsAiLoading(false);
    setError(null);
    setCurrentStep('capture');
    setProcessingProgress(0);
    fadeAnim.setValue(0);
  };

  // ── Capture step ────────────────────────────────────────────────────────────
  const renderCaptureStep = () => (
    <View style={styles.stepContainer}>
      {error && (
        <View style={styles.errorContainer} accessibilityRole="alert">
          <MaterialCommunityIcons name="alert-circle" size={20} color={palette.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Crop selector — the pipeline routes to the correct model by crop */}
      <View style={styles.cropSelector}>
        <View style={styles.cropSelectorHeader}>
          <MaterialCommunityIcons name="sprout" size={18} color={palette.brandGreen} />
          <Text style={styles.cropSelectorTitle}>Which crop are you scanning?</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cropChipRow}
        >
          {DISEASE_DETECTION_CROPS.map((crop) => {
            const active = selectedCrop?.value === crop.value;
            return (
              <Pressable
                key={crop.value}
                onPress={() => {
                  setSelectedCrop(crop);
                  setError(null);
                }}
                style={[styles.cropChip, active && styles.cropChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Select ${crop.label}`}
              >
                <Text style={[styles.cropChipText, active && styles.cropChipTextActive]}>
                  {crop.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Card variant="elevated" style={styles.imageCard}>
        {imageUri ? (
          <Animated.View style={[styles.imageWrapper, { opacity: fadeAnim }]}>
            <Image
              source={{ uri: imageUri }}
              style={styles.previewImage}
              resizeMode="cover"
              accessibilityLabel="Selected crop image"
              onError={() => setError('Failed to load image. Please try again.')}
            />
            <Pressable
              style={styles.removeImageButton}
              onPress={resetDiagnosis}
              accessibilityLabel="Remove image"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="close-circle" size={32} color={palette.white} />
            </Pressable>
          </Animated.View>
        ) : (
          <Pressable
            style={styles.placeholder}
            onPress={captureFromCamera}
            accessibilityLabel="Tap to capture a photo of your crop"
            accessibilityRole="button"
            accessibilityHint="Opens camera to capture an image for diagnosis"
          >
            <LinearGradient colors={gradients.light} style={styles.placeholderGradient}>
              <View style={styles.placeholderIconContainer}>
                <Animated.View style={[styles.pulsingCircle, { transform: [{ scale: pulseAnim }], opacity: shimmerAnim }]} />
                <MaterialCommunityIcons name="image-filter-center-focus" size={48} color={palette.brandGreen} />
              </View>
              <Text style={styles.placeholderText}>Tap to Capture</Text>
              <Text style={styles.placeholderHint}>Natural lighting works best for accuracy</Text>
            </LinearGradient>
          </Pressable>
        )}

        {/* Action buttons */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              imageUri ? styles.retakeButton : styles.captureButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={imageUri ? resetDiagnosis : captureFromCamera}
            accessibilityLabel={imageUri ? 'Retake photo' : 'Open camera'}
            accessibilityRole="button"
          >
            {!imageUri && (
              <LinearGradient
                colors={gradients.hero}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <MaterialCommunityIcons
              name={imageUri ? 'refresh' : 'camera'}
              size={22}
              color={imageUri ? palette.brandGreen : palette.white}
            />
            <Text style={[styles.actionButtonText, imageUri && styles.actionButtonTextSecondary]}>
              {imageUri ? 'Retake' : 'Camera'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionButton, styles.galleryButton, pressed && styles.buttonPressed]}
            onPress={selectFromGallery}
            accessibilityLabel="Choose from gallery"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="image-multiple" size={22} color={palette.brandGreen} />
            <Text style={styles.actionButtonTextSecondary}>Gallery</Text>
          </Pressable>
        </View>

        {/* Analyze button */}
        {imageUri && (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.analyzeButton,
                (!selectedCrop || isProcessing) && styles.analyzeButtonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={runDiagnosis}
              disabled={isProcessing || !selectedCrop}
              accessibilityLabel="Analyze image for crop diseases"
              accessibilityRole="button"
              accessibilityState={{ disabled: isProcessing || !selectedCrop }}
            >
              <LinearGradient
                colors={gradients.hero}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.analyzeButtonGradient}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={palette.white} />
                ) : (
                  <MaterialCommunityIcons name="magnify-scan" size={24} color={palette.white} />
                )}
                <Text style={styles.analyzeButtonText}>
                  {isProcessing ? 'Analyzing…' : 'Analyze Image'}
                </Text>
              </LinearGradient>
            </Pressable>
            {!selectedCrop && (
              <Text style={styles.cropHint}>Select a crop above to analyze.</Text>
            )}
          </>
        )}
      </Card>

      {/* Tips card */}
      {!imageUri && (
        <View style={styles.tipsCard}>
          <Pressable
            style={styles.tipsHeader}
            onPress={() => setShowTips((v) => !v)}
            accessibilityLabel={showTips ? 'Collapse tips' : 'Expand tips'}
            accessibilityRole="button"
          >
            <View style={styles.tipsHeaderLeft}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color={palette.brandGreen} />
              <Text style={styles.tipsTitle}>Photo Tips for Best Results</Text>
            </View>
            <MaterialCommunityIcons
              name={showTips ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={palette.brandGreen}
            />
          </Pressable>
          {showTips && (
            <View style={styles.tipsList}>
              {SCAN_TIPS.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <View style={styles.tipIconWrap}>
                    <MaterialCommunityIcons name={tip.icon as any} size={16} color={palette.brandGreen} />
                  </View>
                  <Text style={styles.tipText}>{tip.text}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );

  // ── Processing step ─────────────────────────────────────────────────────────
  const renderProcessingStep = () => (
    <View style={styles.stepContainer}>
      <Card variant="elevated" style={styles.processingCard}>
        <Animated.View style={[styles.processingIconContainer, { transform: [{ scale: pulseAnim }] }]}>
          {imageUri ? (
            <View style={styles.scanningImageWrapper}>
              <Image source={{ uri: imageUri }} style={styles.scanningImage} resizeMode="cover" />
              <View style={[styles.scanningOverlay, { backgroundColor: 'rgba(27, 94, 32, 0.4)' }]} />
              <Animated.View style={[
                styles.scanningLaser,
                {
                  transform: [{
                    translateY: pulseAnim.interpolate({ inputRange: [1, 1.15], outputRange: [0, 180] }),
                  }],
                },
              ]} />
            </View>
          ) : (
            <LinearGradient
              colors={[palette.brandGreen + '33', palette.brandGreenLight + '33']}
              style={styles.processingIconBackground}
            >
              <MaterialCommunityIcons name="magnify-expand" size={72} color={palette.brandGreen} />
            </LinearGradient>
          )}
        </Animated.View>

        <Text style={styles.processingTitle}>Analyzing Your Crop</Text>
        <Text style={styles.processingSubtitle}>
          Our AI is examining your image for diseases and health issues
        </Text>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View style={[styles.progressFill, {
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }]}>
              <LinearGradient
                colors={[palette.brandGreen, palette.brandGreenLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
          <Text style={styles.progressText}>{processingProgress}%</Text>
        </View>

        <View style={styles.processingSteps}>
          {[
            { label: 'Preparing image', progress: 20 },
            { label: 'Running AI analysis', progress: 60 },
            { label: 'Generating results', progress: 100 },
          ].map((step, index) => (
            <View key={index} style={styles.processingStep}>
              <View style={[styles.processingStepIcon, processingProgress >= step.progress && styles.processingStepIconActive]}>
                <MaterialCommunityIcons
                  name={processingProgress >= step.progress ? 'check-circle' : 'circle-outline'}
                  size={24}
                  color={processingProgress >= step.progress ? palette.white : palette.gray300}
                />
              </View>
              <Text style={[styles.processingStepText, processingProgress >= step.progress && styles.processingStepTextActive]}>
                {step.label}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );

  // ── Results step ────────────────────────────────────────────────────────────
  const renderResultsStep = () => {
    if (!diagnosisResult) return null;

    const topIssue = diagnosisResult.suspectedIssues[0]?.toLowerCase() || '';
    const isHealthy = topIssue.includes('healthy');
    const isInconclusive = topIssue.includes('other');
    const isDiseased = !isHealthy;

    return (
      <View style={styles.stepContainer}>
        <Card variant="elevated" style={styles.resultCard}>
          {/* Status badge */}
          <View style={styles.resultHeader}>
            <LinearGradient
              colors={
                isHealthy
                  ? [palette.semantic.success, palette.brandGreenLight]
                  : isInconclusive
                    ? [palette.gray500, palette.gray600]
                    : [palette.semantic.warning, '#FFB74D']
              }
              style={styles.resultStatusBadge}
            >
              <MaterialCommunityIcons
                name={isHealthy ? 'leaf-circle' : isInconclusive ? 'help-circle' : 'alert-circle'}
                size={28}
                color={palette.white}
              />
              <Text style={styles.resultStatusText}>
                {isHealthy ? 'Healthy Crop' : isInconclusive ? 'Other Condition' : 'Disease Detected'}
              </Text>
            </LinearGradient>
            <Text style={styles.resultTimestamp}>
              {new Date(diagnosisResult.timestamp).toLocaleString()}
            </Text>
          </View>

          {/* Image preview */}
          {imageUri && (
            <View style={styles.resultImageContainer}>
              <Image
                source={{ uri: imageUri }}
                style={styles.resultImage}
                resizeMode="cover"
                accessibilityLabel="Analyzed crop image"
              />
            </View>
          )}

          <View style={styles.resultDetails}>
            <Text style={styles.resultDiseaseTitle}>{diagnosisResult.suspectedIssues[0]}</Text>

            {/* AI Specialist Guide — with proper markdown rendering */}
            {isDiseased && (
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
                    <Animated.View style={[styles.skeletonLine, { opacity: shimmerAnim }]} />
                    <Animated.View style={[styles.skeletonLine, { opacity: shimmerAnim, width: '90%' }]} />
                    <Animated.View style={[styles.skeletonLine, { opacity: shimmerAnim, width: '75%' }]} />
                    <Animated.View style={[styles.skeletonLine, { opacity: shimmerAnim, marginTop: 8 }]} />
                    <Animated.View style={[styles.skeletonLine, { opacity: shimmerAnim, width: '85%' }]} />
                  </View>
                ) : aiMitigation ? (
                  <LinearGradient colors={gradients.aiGuide} style={styles.aiResultCard}>
                    <MarkdownRenderer text={aiMitigation} />
                  </LinearGradient>
                ) : (
                  <Text style={styles.summaryText}>{diagnosisResult.summary}</Text>
                )}
              </View>
            )}

            {/* Healthy: summary + recommendations */}
            {isHealthy && diagnosisResult.summary && (
              <View style={styles.summarySection}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="information" size={20} color={palette.brandGreen} />
                  <Text style={styles.sectionTitle}>Summary</Text>
                </View>
                <Text style={styles.summaryText}>{diagnosisResult.summary}</Text>
              </View>
            )}

            {isHealthy && diagnosisResult.recommendations.length > 0 && (
              <View style={styles.recommendationsSection}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="lightbulb-on" size={20} color={palette.brandGreen} />
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                </View>
                {diagnosisResult.recommendations.map((rec, index) => (
                  <View key={index} style={styles.recommendationItem}>
                    <MaterialCommunityIcons name="check-circle" size={18} color={palette.brandGreen} />
                    <Text style={styles.recommendationText}>{rec}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Card>

        {isDiseased && aiMitigation && !isAiLoading ? (
          <ResultAiActions
            onAskAi={() => openDiagnosisAdvisor()}
            onShop={browseTreatments}
            shopLabel="Find treatments"
            suggestions={diagnosisSuggestions(diagnosisResult.suspectedIssues[0], false)}
            onSuggestion={(q) => openDiagnosisAdvisor(q)}
          />
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.newDiagnosisButton,
            pressed && styles.buttonPressed,
            isDiseased && aiMitigation && !isAiLoading ? { marginTop: spacing.sm } : null,
          ]}
          onPress={resetDiagnosis}
          accessibilityLabel="Start a new diagnosis"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="camera-plus" size={20} color={palette.brandGreen} />
          <Text style={styles.newDiagnosisText}>New Diagnosis</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={embedded ? ['left', 'right', 'bottom'] : undefined}>
      {!embedded && <ProfileHeader />}
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Symptom Scan</Text>
          <Text style={styles.subtitle}>Photo of visible signs — spots, yellowing, wilting, lesions</Text>
        </View>

        {/* Step content with fade transition */}
        <Animated.View style={[styles.contentSection, { opacity: stepFadeAnim }]}>
          {currentStep === 'capture' && renderCaptureStep()}
          {currentStep === 'processing' && renderProcessingStep()}
          {currentStep === 'results' && renderResultsStep()}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.surface.screen,
  },
  scrollContainer: {
    paddingBottom: moderateScale(48),
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
  },
  heroSection: {
    paddingTop: moderateScale(48),
    paddingBottom: moderateScale(28),
    paddingHorizontal: moderateScale(24),
    borderBottomLeftRadius: moderateScale(32),
    borderBottomRightRadius: moderateScale(32),
  },
  heroContent: {
    alignItems: 'center',
    gap: moderateScale(8),
  },
  logoBadge: {
    width: moderateScale(72),
    height: moderateScale(72),
    borderRadius: moderateScale(36),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: moderateScale(4),
  },
  heroTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: responsiveFontSize(26),
    color: palette.white,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  heroSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: responsiveFontSize(13),
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  contentSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  stepContainer: {
    gap: spacing.lg,
  },

  // ── Error ────────────────────────────────────────────────────────────────────
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.ui.errorBg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.ui.errorBorder,
  },
  errorText: {
    ...typography.body.small,
    color: palette.ui.errorText,
    flex: 1,
    fontFamily: Fonts.medium,
  },

  // ── Crop selector ───────────────────────────────────────────────────────────
  cropSelector: {
    gap: spacing.sm,
  },
  cropSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cropSelectorTitle: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: palette.charcoal,
  },
  cropChipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  cropChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.gray300,
    backgroundColor: palette.white,
  },
  cropChipActive: {
    borderColor: palette.brandGreen,
    backgroundColor: palette.brandGreen + '18',
  },
  cropChipText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: palette.gray500,
  },
  cropChipTextActive: {
    color: palette.brandGreen,
    fontFamily: Fonts.bold,
  },
  cropHint: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: palette.gray500,
    textAlign: 'center',
  },

  // ── Image card ────────────────────────────────────────────────────────────────
  imageCard: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  imageWrapper: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    minHeight: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  previewImage: {
    width: '100%',
    height: 320,
  },
  removeImageButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.pill,
    padding: spacing.xs,
  },
  placeholder: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    minHeight: 280,
  },
  placeholderGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl * 2,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: palette.brandGreen + '30',
    borderStyle: 'dashed',
  },
  placeholderIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.brandGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  pulsingCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: palette.brandGreen,
  },
  placeholderText: {
    fontFamily: Fonts.bold,
    fontSize: 17,
    color: palette.text.primary,
    marginTop: spacing.sm,
  },
  placeholderHint: {
    ...typography.body.small,
    color: palette.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },

  // ── Action buttons ────────────────────────────────────────────────────────────
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  captureButton: {
    backgroundColor: palette.brandGreen,
  },
  galleryButton: {
    backgroundColor: palette.white,
    borderWidth: 1.5,
    borderColor: palette.brandGreen,
  },
  retakeButton: {
    backgroundColor: palette.white,
    borderWidth: 1.5,
    borderColor: palette.brandGreen,
  },
  actionButtonText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: palette.white,
  },
  actionButtonTextSecondary: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: palette.brandGreen,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  analyzeButton: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: palette.brandGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  analyzeButtonDisabled: {
    opacity: 0.5,
  },
  analyzeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  analyzeButtonText: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: palette.white,
  },

  // ── Tips card ────────────────────────────────────────────────────────────────
  tipsCard: {
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border.greenLight,
    overflow: 'hidden',
    shadowColor: palette.brandGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  tipsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tipsTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: palette.text.primary,
  },
  tipsList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tipIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: palette.tint[100],
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tipText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: palette.text.secondary,
    flex: 1,
    lineHeight: 19,
  },

  // ── Processing ────────────────────────────────────────────────────────────────
  processingCard: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  processingIconContainer: {
    marginBottom: spacing.xl,
  },
  processingIconBackground: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingTitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: palette.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  processingSubtitle: {
    ...typography.body.medium,
    color: palette.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  progressContainer: {
    width: '100%',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  progressBar: {
    height: 10,
    backgroundColor: palette.gray200,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  progressText: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: palette.brandGreen,
    textAlign: 'center',
  },
  processingSteps: {
    width: '100%',
    gap: spacing.md,
  },
  processingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  processingStepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingStepIconActive: {
    backgroundColor: palette.brandGreen,
  },
  processingStepText: {
    ...typography.body.medium,
    color: palette.text.secondary,
    flex: 1,
  },
  processingStepTextActive: {
    fontFamily: Fonts.semiBold,
    color: palette.text.primary,
  },
  scanningImageWrapper: {
    width: 200,
    height: 180,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: palette.brandGreen,
    position: 'relative',
    backgroundColor: palette.gray100,
  },
  scanningImage: { width: '100%', height: '100%' },
  scanningOverlay: { ...StyleSheet.absoluteFillObject },
  scanningLaser: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: palette.brandGreenLight,
    shadowColor: palette.brandGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },

  // ── Results ────────────────────────────────────────────────────────────────
  resultCard: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  resultHeader: {
    gap: spacing.sm,
  },
  resultStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  resultStatusText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: palette.white,
  },
  resultTimestamp: {
    ...typography.body.small,
    color: palette.text.secondary,
  },
  resultImageContainer: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  resultImage: {
    width: '100%',
    height: 240,
  },
  resultDetails: {
    gap: spacing.lg,
  },
  resultDiseaseTitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: palette.text.primary,
    lineHeight: 28,
  },
  summarySection: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: palette.text.primary,
  },
  summaryText: {
    ...typography.body.medium,
    color: palette.text.secondary,
    lineHeight: 24,
  },
  recommendationsSection: {
    gap: spacing.md,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: palette.tint[50],
  },
  recommendationText: {
    ...typography.body.medium,
    color: palette.text.primary,
    flex: 1,
    lineHeight: 22,
  },
  aiLoadingContainer: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: palette.ui.skeleton,
    borderRadius: radius.xs,
    width: '100%',
  },
  aiResultCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.brandGreen + '20',
  },
  treatmentHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: palette.brandGreen + '12',
    borderRadius: radius.md,
  },
  treatmentHintText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: palette.text.secondary,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.brandGreen,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 4,
    marginBottom: spacing.sm,
  },
  primaryActionText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: palette.white,
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 4,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: palette.brandGreen + '40',
  },
  secondaryActionText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: palette.brandGreen,
  },
  newDiagnosisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 4,
    borderWidth: 1.5,
    borderColor: palette.brandGreen + '40',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  newDiagnosisText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: palette.brandGreen,
  },
});

export default function DiagnosisRedirect() {
  return <Redirect href="/(tabs)/scan?mode=symptom" />;
}
