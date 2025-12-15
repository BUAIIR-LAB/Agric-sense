import { useState, useEffect, useRef } from 'react';
import { 
  ActivityIndicator, 
  Image, 
  Platform, 
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
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';

import { useAppContext, type DiagnosisRecord } from '@/context/AppContext';
import { palette } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { elevation } from '@/theme/elevation';
import apiService from '@/services/api';
import { ConfidenceGauge } from '@/components/charts/ConfidenceGauge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const appFont = Platform.select({ ios: 'HelveticaNeue', android: 'sans-serif' }) ?? 'System';

type ScreenStep = 'capture' | 'processing' | 'results';

export default function DiagnosisScreen() {
  const router = useRouter();
  const { addDiagnosisRecord, profile } = useAppContext();
  
  // State management
  const [currentStep, setCurrentStep] = useState<ScreenStep>('capture');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisRecord | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Animation for processing
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (isProcessing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isProcessing, pulseAnim]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [imageUri]);

  // Request camera permissions on mount
  useEffect(() => {
    ImagePicker.requestCameraPermissionsAsync();
  }, []);

  // Image capture from camera
  const captureFromCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please grant camera permission to capture photos.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const originalUri = result.assets[0].uri;
        console.log('📸 Image captured:', originalUri);
        setImageUri(originalUri);
        setError(null);
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }
    } catch (error: any) {
      console.error('❌ Camera error:', error);
      setError('Failed to capture image. Please try again.');
    }
  };

  // Image selection from gallery
  const selectFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Gallery Permission Required',
          'Please grant gallery permission to select photos.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const originalUri = result.assets[0].uri;
        console.log('📸 Image selected:', originalUri);
        setImageUri(originalUri);
        setError(null);
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }
    } catch (error: any) {
      console.error('❌ Gallery error:', error);
      setError('Failed to select image. Please try again.');
    }
  };

  // Run diagnosis
  const runDiagnosis = async () => {
    if (!imageUri || isProcessing) {
      return;
    }

    console.log('🔬 Starting diagnosis...');
    setIsProcessing(true);
    setError(null);
    setProcessingProgress(0);
    setCurrentStep('processing');

    try {
      // Step 1: Compress image
      setProcessingProgress(20);
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 800 } }],
        {
          compress: 0.6,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // Step 2: Convert to base64
      setProcessingProgress(40);
      const imageBase64 = await FileSystem.readAsStringAsync(manipulatedImage.uri, {
        encoding: 'base64',
      });

      // Step 3: Send to API
      setProcessingProgress(60);
      const diagnosisResponse = await apiService.diagnoseFromImage(imageBase64);
      
      // Step 4: Process results
      setProcessingProgress(80);
      
      if (!diagnosisResponse || !diagnosisResponse.suspected_issues?.length) {
        throw new Error('Invalid response from diagnosis API');
      }

      // Step 5: Create record
      setProcessingProgress(100);
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
      setCurrentStep('results');
      
      console.log('✅ Diagnosis complete');
    } catch (error: any) {
      console.error('❌ Diagnosis error:', error);
      
      let errorMessage = 'Diagnosis failed. Please try again.';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = 'Request timed out. Please check your connection.';
      } else if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        errorMessage = 'Network error. Please check your internet connection.';
      }
      
      setError(errorMessage);
      setCurrentStep('capture');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  // Reset to start new diagnosis
  const resetDiagnosis = () => {
    setImageUri(undefined);
    setDiagnosisResult(undefined);
    setError(null);
    setCurrentStep('capture');
    setProcessingProgress(0);
    fadeAnim.setValue(0);
  };

  // Render capture step
  const renderCaptureStep = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <View style={styles.headerTextContainer}>
        <Text style={styles.stepTitle}>Plant Diagnosis</Text>
        <Text style={styles.stepSubtitle}>
          Capture or upload an image of your crop for AI-powered analysis
        </Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={22} color={palette.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Card variant="elevated" style={styles.imageCard}>
        {imageUri ? (
          <Animated.View style={[styles.imageWrapper, { opacity: fadeAnim }]}>
            <Image 
              source={{ uri: imageUri }} 
              style={styles.previewImage}
              resizeMode="cover"
              onLoad={() => {
                console.log('✅ Image loaded successfully:', imageUri);
              }}
              onError={(error) => {
                console.error('❌ Image load error:', error);
                setError('Failed to load image. Please try again.');
              }}
            />
            <Pressable 
              style={styles.removeImageButton}
              onPress={resetDiagnosis}
              accessibilityLabel="Remove image"
            >
              <MaterialCommunityIcons name="close-circle" size={32} color={palette.white} />
            </Pressable>
          </Animated.View>
        ) : (
          <Pressable 
            style={styles.placeholder}
            onPress={captureFromCamera}
            accessibilityLabel="Capture image"
          >
            <LinearGradient
              colors={['#E8F5E9', '#F1F8E9']}
              style={styles.placeholderGradient}
            >
              <View style={styles.placeholderIconContainer}>
                <MaterialCommunityIcons name="camera-plus" size={56} color={palette.brandGreen} />
              </View>
              <Text style={styles.placeholderText}>Tap to Capture</Text>
              <Text style={styles.placeholderHint}>
                Use natural lighting for best results
              </Text>
            </LinearGradient>
          </Pressable>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.captureButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={imageUri ? resetDiagnosis : captureFromCamera}
          >
            <MaterialCommunityIcons 
              name="camera" 
              size={22} 
              color={imageUri ? palette.brandGreen : palette.white} 
            />
            <Text style={[
              styles.actionButtonText,
              imageUri && styles.actionButtonTextSecondary
            ]}>
              {imageUri ? "Retake" : "Capture"}
            </Text>
          </Pressable>
          
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.galleryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={selectFromGallery}
          >
            <MaterialCommunityIcons name="image" size={22} color={palette.brandGreen} />
            <Text style={styles.actionButtonTextSecondary}>Gallery</Text>
          </Pressable>
        </View>

        {/* Analyze Button */}
        {imageUri && (
          <Pressable
            style={({ pressed }) => [
              styles.analyzeButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={runDiagnosis}
            disabled={isProcessing}
          >
            <LinearGradient
              colors={[palette.brandGreen, palette.brandGreenDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.analyzeButtonGradient}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={palette.white} />
              ) : (
                <MaterialCommunityIcons name="robot" size={24} color={palette.white} />
              )}
              <Text style={styles.analyzeButtonText}>
                {isProcessing ? "Analyzing..." : "Analyze Image"}
              </Text>
            </LinearGradient>
          </Pressable>
        )}
      </Card>
    </Animated.View>
  );

  // Render processing step
  const renderProcessingStep = () => (
    <View style={styles.stepContainer}>
      <Card variant="elevated" style={styles.processingCard}>
        <Animated.View style={[styles.processingIconContainer, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient
            colors={[palette.brandGreen + '20', palette.brandGreenLight + '20']}
            style={styles.processingIconBackground}
          >
            <MaterialCommunityIcons name="robot" size={72} color={palette.brandGreen} />
          </LinearGradient>
        </Animated.View>
        
        <Text style={styles.processingTitle}>Analyzing Your Crop</Text>
        <Text style={styles.processingSubtitle}>
          Our AI is examining your image for diseases and health issues
        </Text>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View 
              style={[
                styles.progressFill, 
                { width: `${processingProgress}%` }
              ]} 
            />
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
              <View style={[
                styles.processingStepIcon,
                processingProgress >= step.progress && styles.processingStepIconActive
              ]}>
                <MaterialCommunityIcons 
                  name={processingProgress >= step.progress ? "check-circle" : "circle-outline"} 
                  size={24} 
                  color={processingProgress >= step.progress ? palette.white : palette.gray300} 
                />
              </View>
              <Text style={[
                styles.processingStepText,
                processingProgress >= step.progress && styles.processingStepTextActive
              ]}>
                {step.label}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );

  // Render results step
  const renderResultsStep = () => {
    if (!diagnosisResult) return null;

    const isHealthy = diagnosisResult.suspectedIssues[0]?.toLowerCase().includes('healthy');

    return (
      <View style={styles.stepContainer}>
        <Card variant="elevated" style={styles.resultCard}>
          {/* Result Header */}
          <View style={styles.resultHeader}>
            <LinearGradient
              colors={isHealthy ? [palette.success, '#66BB6A'] : [palette.warning, '#FFB74D']}
              style={styles.resultStatusBadge}
            >
              <MaterialCommunityIcons 
                name={isHealthy ? "leaf-circle" : "alert-circle"} 
                size={28} 
                color={palette.white} 
              />
              <Text style={styles.resultStatusText}>
                {isHealthy ? 'Healthy Crop' : 'Disease Detected'}
              </Text>
            </LinearGradient>
            <Text style={styles.resultTimestamp}>
              {new Date(diagnosisResult.timestamp).toLocaleString()}
            </Text>
          </View>

          {/* Image Preview */}
          {imageUri && (
            <View style={styles.resultImageContainer}>
              <Image source={{ uri: imageUri }} style={styles.resultImage} resizeMode="cover" />
            </View>
          )}

          {/* Diagnosis Details */}
          <View style={styles.resultDetails}>
            <Text style={styles.resultDiseaseTitle}>
              {diagnosisResult.suspectedIssues[0]}
            </Text>
            
            {diagnosisResult.suspectedIssues.length > 1 && (
              <View style={styles.otherIssuesContainer}>
                <Text style={styles.otherIssuesLabel}>Other suspected issues:</Text>
                {diagnosisResult.suspectedIssues.slice(1).map((issue, index) => (
                  <View key={index} style={styles.otherIssueItem}>
                    <MaterialCommunityIcons name="circle-small" size={16} color={palette.brandGreen} />
                    <Text style={styles.otherIssueText}>{issue}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Confidence Gauge */}
            <View style={styles.confidenceSection}>
              <Text style={styles.confidenceLabel}>Confidence Level</Text>
              <ConfidenceGauge 
                confidence={diagnosisResult.confidence} 
                size={140}
                showLabel={true}
              />
            </View>

            {/* Summary */}
            <View style={styles.summarySection}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="information" size={20} color={palette.brandGreen} />
                <Text style={styles.sectionTitle}>Summary</Text>
              </View>
              <Text style={styles.summaryText}>{diagnosisResult.summary}</Text>
            </View>

            {/* Recommendations */}
            {diagnosisResult.recommendations.length > 0 && (
              <View style={styles.recommendationsSection}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="lightbulb-on" size={20} color={palette.brandGreen} />
                  <Text style={styles.sectionTitle}>Recommended Actions</Text>
                </View>
                {diagnosisResult.recommendations.map((rec, index) => (
                  <View key={index} style={styles.recommendationItem}>
                    <View style={styles.recommendationIcon}>
                      <MaterialCommunityIcons 
                        name="check-circle" 
                        size={20} 
                        color={palette.brandGreen} 
                      />
                    </View>
                    <Text style={styles.recommendationText}>{rec}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Card>

        {/* Action Buttons */}
        <View style={styles.resultActions}>
          <Pressable
            style={({ pressed }) => [
              styles.resultActionButton,
              styles.secondaryActionButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={resetDiagnosis}
          >
            <MaterialCommunityIcons name="refresh" size={22} color={palette.brandGreen} />
            <Text style={styles.resultActionButtonTextSecondary}>New Diagnosis</Text>
          </Pressable>
          
          <Pressable
            style={({ pressed }) => [
              styles.resultActionButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push('/(tabs)/chat')}
          >
            <LinearGradient
              colors={[palette.brandGreen, palette.brandGreenDark]}
              style={styles.resultActionButtonGradient}
            >
              <MaterialCommunityIcons name="message-text" size={22} color={palette.white} />
              <Text style={styles.resultActionButtonText}>Ask Questions</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <LinearGradient
          colors={[palette.brandGreen, palette.brandGreenDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          <View style={styles.heroContent}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="microscope" size={40} color={palette.white} />
            </View>
            <Text style={styles.heroSubtitle}>
              AI-powered plant health analysis
            </Text>
          </View>
        </LinearGradient>

        {/* Main Content */}
        <View style={styles.contentSection}>
          {currentStep === 'capture' && renderCaptureStep()}
          {currentStep === 'processing' && renderProcessingStep()}
          {currentStep === 'results' && renderResultsStep()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5FBF6',
  },
  scrollContainer: {
    paddingBottom: spacing.xxl * 2,
  },
  heroSection: {
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl * 1.5,
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: spacing.xl * 2,
    borderBottomRightRadius: spacing.xl * 2,
  },
  heroContent: {
    alignItems: 'center',
    gap: spacing.md,
  },
  logoBadge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  heroSubtitle: {
    fontFamily: appFont,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  contentSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.xl,
  },
  stepContainer: {
    gap: spacing.lg,
  },
  headerTextContainer: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  stepTitle: {
    ...typography.heading.h3,
    color: palette.text.primary,
    textAlign: 'center',
    fontWeight: '700',
  },
  stepSubtitle: {
    ...typography.body.medium,
    color: palette.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.danger + '15',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.danger + '30',
  },
  errorText: {
    ...typography.body.medium,
    color: palette.danger,
    flex: 1,
    fontWeight: '500',
  },
  imageCard: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  imageWrapper: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: palette.surface.soft,
    width: '100%',
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
    backgroundColor: palette.surface.soft,
  },
  removeImageButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: radius.pill,
    padding: spacing.xs,
  },
  placeholder: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    minHeight: 320,
  },
  placeholderGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl * 2.5,
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
  },
  placeholderText: {
    ...typography.heading.h4,
    color: palette.text.primary,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  placeholderHint: {
    ...typography.body.small,
    color: palette.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    lineHeight: 18,
  },
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
  },
  captureButton: {
    backgroundColor: palette.brandGreen,
  },
  galleryButton: {
    backgroundColor: palette.white,
    borderWidth: 2,
    borderColor: palette.brandGreen,
  },
  actionButtonText: {
    ...typography.label.medium,
    color: palette.white,
    fontWeight: '700',
  },
  actionButtonTextSecondary: {
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
  analyzeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  analyzeButtonText: {
    ...typography.label.large,
    color: palette.white,
    fontWeight: '700',
  },
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
    ...typography.heading.h3,
    color: palette.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontWeight: '700',
  },
  processingSubtitle: {
    ...typography.body.medium,
    color: palette.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
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
    backgroundColor: palette.brandGreen,
    borderRadius: radius.pill,
  },
  progressText: {
    ...typography.label.medium,
    color: palette.brandGreen,
    textAlign: 'center',
    fontWeight: '700',
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
    color: palette.text.primary,
    fontWeight: '600',
  },
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
    ...typography.label.large,
    color: palette.white,
    fontWeight: '700',
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
    height: 280,
    backgroundColor: palette.surface.soft,
  },
  resultDetails: {
    gap: spacing.lg,
  },
  resultDiseaseTitle: {
    ...typography.heading.h3,
    color: palette.text.primary,
    fontWeight: '700',
    lineHeight: 32,
  },
  otherIssuesContainer: {
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: palette.surface.soft,
    borderRadius: radius.lg,
  },
  otherIssuesLabel: {
    ...typography.label.medium,
    color: palette.text.secondary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  otherIssueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  otherIssueText: {
    ...typography.body.medium,
    color: palette.text.primary,
    flex: 1,
  },
  confidenceSection: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: palette.surface.soft,
    borderRadius: radius.xl,
  },
  confidenceLabel: {
    ...typography.label.medium,
    color: palette.text.secondary,
    marginBottom: spacing.md,
    fontWeight: '600',
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
    ...typography.heading.h5,
    color: palette.text.primary,
    fontWeight: '700',
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
    backgroundColor: palette.surface.soft,
    borderRadius: radius.lg,
  },
  recommendationIcon: {
    marginTop: 2,
  },
  recommendationText: {
    ...typography.body.medium,
    color: palette.text.primary,
    flex: 1,
    lineHeight: 22,
  },
  resultActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  resultActionButton: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryActionButton: {
    backgroundColor: palette.white,
    borderWidth: 2,
    borderColor: palette.brandGreen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  resultActionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  resultActionButtonText: {
    ...typography.label.large,
    color: palette.white,
    fontWeight: '700',
  },
  resultActionButtonTextSecondary: {
    ...typography.label.large,
    color: palette.brandGreen,
    fontWeight: '700',
  },
});
