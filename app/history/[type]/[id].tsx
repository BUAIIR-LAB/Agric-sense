import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState, useEffect } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppContext } from '@/context/AppContext';
import { useSweetAlert } from '@/components/AlertProvider';
import { ResultAiActions } from '@/components/ResultAiActions';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import { buildDiagnosisSession, diagnosisSuggestions } from '@/utils/aiAdvisor';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { palette } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { shadows } from '@/theme/shadows';
import { useTranslation } from '@/localization/useTranslation';
import apiService from '@/services/api';

// Language mapping for API
const languageToCode: Record<string, string> = {
  English: 'en',
  Luganda: 'lg',
  Ateso: 'at',
  Acholi: 'ac',
  Japadhola: 'jp',
  Runyankore: 'nyn',
};

import { appFont, Fonts } from '@/theme/fonts';

type Params = {
  type?: string;
  id?: string;
};

interface DiagnosisRecord {
  id: string;
  imageUri: string | null;
  image_base64?: string;
  suspectedIssues: string[];
  confidence: number;
  summary: string;
  recommendations: string[];
  followUpQuestion?: string;
  followUpResponse?: string;
  timestamp: string;
}

interface SpectroscopyRecord {
  id: string;
  sampleName: string;
  spectrum: Array<{ wavelength: number; intensity: number }>;
  summary: string;
  insights: string[];
  timestamp: string;
}

export default function HistoryDetailScreen() {
  const { type, id } = useLocalSearchParams<Params>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isReady } = useAuthGuard();
  const { state, removeDiagnosisRecord, removeSpectroscopyRecord, removeDiagnosisRecordWithAPI, removeSpectroscopyRecordWithAPI } = useAppContext();
  const { openSeeded } = useAiAdvisor();
  const profile = state.profile;
  const { width } = useWindowDimensions();
  const { t, formatNumber, formatDateTime } = useTranslation();
  const [advisoryResponse, setAdvisoryResponse] = useState<string | null>(null);
  const [isLoadingAdvisory, setIsLoadingAdvisory] = useState(false);
  const [advisoryConversationId, setAdvisoryConversationId] = useState<string | null>(null);
  const [advisoryPrompt, setAdvisoryPrompt] = useState<string | null>(null);

  const recordType = type === 'diagnosis' || type === 'spectroscopy' ? type : null;
  const [record, setRecord] = useState<DiagnosisRecord | SpectroscopyRecord | null>(null);
  const [isLoadingRecord, setIsLoadingRecord] = useState(true);

  const isInconclusive = useMemo(() => {
    if (recordType === 'diagnosis' && record) {
      const diag = record as DiagnosisRecord;
      return diag.suspectedIssues[0]?.toLowerCase().includes('other');
    }
    return false;
  }, [recordType, record]);

  // Load record from local state or API
  useEffect(() => {
    const loadRecord = async () => {
      if (!recordType || !id) {
        setIsLoadingRecord(false);
        return;
      }

      // First try to find in local state
      let foundRecord: any = null;
      if (recordType === 'diagnosis') {
        foundRecord = state.diagnosisHistory.find((entry) => entry.id === id);
      } else {
        foundRecord = state.spectroscopyHistory.find((entry) => entry.id === id);
      }

      if (foundRecord) {
        // Add image_base64 if available from API response
        if (recordType === 'diagnosis' && (foundRecord as any).image_base64) {
          setRecord({ ...foundRecord, image_base64: (foundRecord as any).image_base64 });
        } else {
          setRecord(foundRecord);
        }
        setIsLoadingRecord(false);
        return;
      }

      // If not found locally, fetch from API
      try {
        setIsLoadingRecord(true);
        if (recordType === 'diagnosis') {
          const apiRecord = await apiService.getDiagnosis(id);
          // Map API response to local format
          const mappedRecord = {
            id: apiRecord.id,
            imageUri: apiRecord.image_uri || null,
            image_base64: apiRecord.image_base64,
            suspectedIssues: apiRecord.suspected_issues,
            confidence: apiRecord.confidence,
            summary: apiRecord.summary,
            recommendations: apiRecord.recommendations,
            followUpQuestion: apiRecord.follow_up_question || undefined,
            followUpResponse: apiRecord.follow_up_response || undefined,
            timestamp: apiRecord.timestamp,
          };
          setRecord(mappedRecord);
        } else {
          const apiRecord = await apiService.getSpectroscopy(id);
          const mappedRecord = {
            id: apiRecord.id,
            sampleName: apiRecord.sample_name,
            spectrum: apiRecord.spectrum,
            summary: apiRecord.summary,
            insights: apiRecord.insights,
            timestamp: apiRecord.timestamp,
          };
          setRecord(mappedRecord);
        }
      } catch (error: any) {
        console.error('Failed to load record from API:', error);
        setRecord(null);
      } finally {
        setIsLoadingRecord(false);
      }
    };

    loadRecord();
  }, [id, recordType, state.diagnosisHistory, state.spectroscopyHistory]);

  // Fetch advisory for diagnosis records
  useEffect(() => {
    if (recordType === 'diagnosis' && record && profile && !isInconclusive) {
      fetchAdvisory(record as DiagnosisRecord);
    }
  }, [recordType, record, profile, isInconclusive]);

  const fetchAdvisory = async (diagnosis: DiagnosisRecord) => {
    if (!profile) return;

    setIsLoadingAdvisory(true);
    setAdvisoryResponse(null);
    setAdvisoryConversationId(null);
    setAdvisoryPrompt(null);

    try {
      const isHealthy = diagnosis.suspectedIssues[0]?.toLowerCase().includes('healthy');
      const topDisease = diagnosis.suspectedIssues[0];
      const confidence = Math.round(diagnosis.confidence * 100);

      let prompt: string;
      const cropsContext = profile.cropsGrown.length > 0
        ? `I grow: ${profile.cropsGrown.join(', ')}. `
        : '';

      if (isHealthy) {
        prompt = `I am a farmer ${cropsContext}and I just scanned my crop using an AI-powered diagnosis tool. The diagnosis shows my crop is healthy with ${confidence}% confidence.

Please provide me with comprehensive agricultural advisory:
1. Best practices to maintain this healthy condition
2. Preventive measures to avoid future diseases and pests
3. Optimal care recommendations for continued growth and productivity
4. Seasonal advice for maintaining crop health throughout the year
5. Nutrient management and soil health tips

Please provide practical, actionable advice that I can implement immediately. Use clear, simple language that is easy to understand.`;
      } else {
        const recommendationsContext = diagnosis.recommendations.length > 0
          ? `\n\nRecommended actions: ${diagnosis.recommendations.join('; ')}`
          : '';

        prompt = `I am a farmer ${cropsContext}and I just scanned my crop using an AI-powered diagnosis tool. The diagnosis detected: ${diagnosis.suspectedIssues.join(', ')} with ${confidence}% confidence.

Diagnosis Summary: ${diagnosis.summary}${recommendationsContext}

Please provide me with comprehensive agricultural advisory:
1. Detailed information about ${topDisease} - what causes it, how it spreads, and its impact on crops
2. Immediate treatment options and management strategies I can apply right now
3. Recommended farm inputs and treatments (fungicides, pesticides, fertilizers, or other products by type/active ingredient) that I can buy on the AgriSense marketplace — name specific product types to search for
4. How to prevent this disease from spreading to other plants
5. Long-term prevention measures to avoid future outbreaks
6. When to consult an agricultural extension officer or seek professional help

Please provide practical, actionable advice that I can implement immediately. Use clear, simple language that is easy to understand.`;
      }

      setAdvisoryPrompt(prompt);
      const targetLang = languageToCode[profile.preferredLanguage] || 'en';

      const response = await apiService.askQuestion({
        prompt,
        user_id: profile.id,
        target_lang: targetLang,
        user_profile: {
          name: profile.name,
          area: profile.area,
          crops_grown: profile.cropsGrown,
          preferred_language: profile.preferredLanguage,
        },
      });

      setAdvisoryResponse(response.results);
      if (response.conversation_id) setAdvisoryConversationId(response.conversation_id);
    } catch (error: any) {
      console.error('❌ Failed to fetch advisory:', error);
      setAdvisoryResponse(null);
    } finally {
      setIsLoadingAdvisory(false);
    }
  };

  const continueDiagnosisChat = (followUp?: string) => {
    const diagnosis = recordType === 'diagnosis' ? (record as DiagnosisRecord) : null;
    if (!advisoryResponse || !diagnosis) return;
    const disease = diagnosis.suspectedIssues[0] || 'an unknown condition';
    const isHealthy = disease.toLowerCase().includes('healthy');
    const userContent =
      advisoryPrompt ||
      `My crop was diagnosed with ${disease}. ${diagnosis.summary || ''} Please help me treat it and suggest AgriSense marketplace products.`;

    const session = buildDiagnosisSession({
      disease,
      confidence: diagnosis.confidence,
      isHealthy,
      conversationId: advisoryConversationId,
      sourceRecordId: diagnosis.id,
    });

    openSeeded({
      session,
      messages: [
        { role: 'user', modality: 'text', content: userContent },
        { role: 'assistant', modality: 'text', content: advisoryResponse },
      ],
      followUp,
    });
  };

  const browseTreatmentsFromHistory = () => {
    const diagnosis = recordType === 'diagnosis' ? (record as DiagnosisRecord) : null;
    if (!diagnosis) return;
    const q = (diagnosis.suspectedIssues[0] || '')
      .replace(/\s*\(.*?\)\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);
    router.push({
      pathname: '/(tabs)/marketplace',
      params: {
        mode: 'buy',
        ...(q ? { q } : {}),
      },
    });
  };

  const { showAlert } = useSweetAlert();

  const handleDelete = async () => {
    if (!recordType || !record) {
      return;
    }
    showAlert(
      'warning',
      recordType === 'diagnosis'
        ? t('history.dialog.removeDiagnosisTitle')
        : t('history.dialog.removeSpectrumTitle'),
      recordType === 'diagnosis'
        ? t('history.dialog.removeDiagnosisMessage')
        : t('history.dialog.removeSpectrumMessage'),
      {
        showCancel: true,
        confirmText: t('common.actions.delete'),
        cancelText: t('common.actions.cancel'),
        onConfirm: async () => {
          try {
            if (recordType === 'diagnosis') {
              // Try API delete first
              const success = await removeDiagnosisRecordWithAPI(record.id);
              if (!success) {
                // Fallback to local delete if API fails
                removeDiagnosisRecord(record.id);
              }
            } else {
              // Try API delete first
              const success = await removeSpectroscopyRecordWithAPI(record.id);
              if (!success) {
                // Fallback to local delete if API fails
                removeSpectroscopyRecord(record.id);
              }
            }
            showAlert('success', 'Record Deleted', 'The record has been successfully deleted.', {
              onConfirm: () => {
                router.back();
              },
            });
          } catch (error: any) {
            console.error('Delete error:', error);
            // Still delete locally on error
            if (recordType === 'diagnosis') {
              removeDiagnosisRecord(record.id);
            } else {
              removeSpectroscopyRecord(record.id);
            }
            showAlert('success', 'Record Deleted', 'The record has been deleted locally.', {
              onConfirm: () => {
                router.back();
              },
            });
          }
        },
      }
    );
  };

  if (isLoadingRecord) {
    return (
      <View style={[styles.emptyState, { paddingTop: insets.top + spacing.xl }]}>
        <ActivityIndicator size="large" color={palette.brandGreen} />
        <Text style={styles.emptyTitle}>Loading diagnosis...</Text>
      </View>
    );
  }

  if (!recordType || !record) {
    return (
      <View style={[styles.emptyState, { paddingTop: insets.top + spacing.xl }]}>
        <MaterialCommunityIcons name="information-outline" size={32} color={palette.gray500} />
        <Text style={styles.emptyTitle}>{t('common.status.notFoundTitle')}</Text>
        <Text style={styles.emptySubtitle}>{t('common.status.notFoundMessage')}</Text>
        <Pressable
          onPress={() => router.back()}
          style={styles.emptyAction}
          accessibilityRole="button"
          accessibilityLabel={t('common.buttons.goBack')}
        >
          <MaterialCommunityIcons name="arrow-left" size={16} color={palette.brandGreenDark} />
          <Text style={styles.emptyActionLabel}>{t('common.buttons.goBack')}</Text>
        </Pressable>
      </View>
    );
  }

  const spectroscopyDataset =
    recordType === 'spectroscopy' && record && 'spectrum' in record
      ? {
        labels: record.spectrum.map((point) => point.wavelength.toString()),
        datasets: [
          {
            data: record.spectrum.map((point) => point.intensity),
            strokeWidth: 2,
          },
        ],
      }
      : null;
  const chartWidth = Math.min(width - spacing.xl * 2, 520);
  const chartHeight = Math.min(280, Math.max(200, chartWidth * 0.45));
  const diagRecord = recordType === 'diagnosis' ? (record as DiagnosisRecord) : null;
  const spectroRecord = recordType === 'spectroscopy' ? (record as SpectroscopyRecord) : null;

  if (!isReady) {
    return null;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroPanel}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.iconButton, styles.heroIconButton]}
            accessibilityRole="button"
            accessibilityLabel={t('common.buttons.goBack')}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={palette.brandGreen} />
          </Pressable>
          <Text style={styles.heroTitle}>
            {recordType === 'diagnosis'
              ? t('historyDetail.diagnosisTitle')
              : t('historyDetail.spectrumTitle')}
          </Text>
          <Pressable
            onPress={handleDelete}
            style={[styles.iconButton, styles.heroIconButton]}
            accessibilityRole="button"
            accessibilityLabel={t('common.actions.delete')}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={palette.brandGreen} />
          </Pressable>
        </View>
        <Text style={styles.heroSubtitle}>
          {recordType === 'diagnosis'
            ? t('history.heroSubtitle')
            : t('historyDetail.summary')}
        </Text>
      </View>

      <View style={styles.contentCard}>
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons
              name={recordType === 'diagnosis' ? 'microscope' : 'chart-timeline-variant'}
              size={18}
              color={palette.brandGreenDark}
            />
            <Text style={styles.metaLabel}>
              {recordType === 'diagnosis' ? t('historyDetail.diagnosisLabel') : t('historyDetail.spectrumLabel')}
            </Text>
          </View>
          <Text style={styles.metaValue}>
            {formatDateTime(record.timestamp, { dateStyle: 'medium', timeStyle: 'short' })}
          </Text>
        </View>

        {diagRecord && (
          <View style={styles.detailCard}>
            {diagRecord.imageUri ? (
              <Image source={{ uri: diagRecord.imageUri }} style={styles.previewImage} resizeMode="cover" />
            ) : diagRecord.image_base64 ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${diagRecord.image_base64}` }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.previewPlaceholder}>
                <MaterialCommunityIcons name="image-off-outline" size={28} color={palette.gray500} />
                <Text style={styles.previewPlaceholderText}>{t('common.labels.noImage')}</Text>
              </View>
            )}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('historyDetail.suspectedIssues')}</Text>
              {diagRecord.suspectedIssues.map((issue) => {
                const isOther = issue.toLowerCase().includes('other');
                return (
                  <View key={issue} style={[styles.chip, isOther && styles.chipInconclusive]}>
                    <Text style={[styles.chipLabel, isOther && styles.chipLabelInconclusive]}>
                      {isOther ? "Low Quality Image" : issue}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('historyDetail.summary')}</Text>
              <Text style={styles.sectionBody}>
                {isInconclusive
                  ? "The image provided was not clear enough for a definitive plant disease diagnosis. Please try taking a closer, more well-lit photo of the affected plant area."
                  : diagRecord.summary}
              </Text>
            </View>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {isInconclusive ? "Result Status" : t('historyDetail.recommendations')}
                </Text>
                {!isInconclusive && (
                  <Text style={styles.sectionMeta}>
                    {t('historyDetail.confidence', {
                      value: formatNumber(Math.round(diagRecord.confidence * 100)),
                    })}
                  </Text>
                )}
              </View>
              {isInconclusive ? (
                <View style={styles.listItem}>
                  <MaterialCommunityIcons name="camera-off" size={16} color={palette.gray500} />
                  <Text style={[styles.sectionBody, { color: palette.gray600 }]}>Bad Image</Text>
                </View>
              ) : (
                diagRecord.recommendations.map((recommendation, index) => (
                  <View key={`${recommendation}-${index}`} style={styles.listItem}>
                    <MaterialCommunityIcons name="check-circle-outline" size={16} color={palette.brandGreen} />
                    <Text style={styles.sectionBody}>{recommendation}</Text>
                  </View>
                ))
              )}
            </View>
            {diagRecord.followUpQuestion && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('historyDetail.followUp')}</Text>
                <Text style={styles.sectionMeta}>{diagRecord.followUpQuestion}</Text>
                {diagRecord.followUpResponse ? (
                  <Text style={styles.sectionBody}>{diagRecord.followUpResponse}</Text>
                ) : (
                  <Text style={styles.sectionBodyMuted}>{t('common.labels.noResponse')}</Text>
                )}
              </View>
            )}

            {/* Professional Advisory Section */}
            {!isInconclusive && (
              <View style={styles.advisoryCard}>
                <View style={styles.advisoryHeader}>
                  <View style={styles.advisoryHeaderContent}>
                    <View style={[
                      styles.advisoryIconBadge,
                      diagRecord.suspectedIssues[0]?.toLowerCase().includes('healthy')
                        ? styles.advisoryIconBadgeHealthy
                        : styles.advisoryIconBadgeDiseased
                    ]}>
                      <MaterialCommunityIcons
                        name={diagRecord.suspectedIssues[0]?.toLowerCase().includes('healthy') ? 'leaf-circle' : 'shield-check'}
                        size={28}
                        color={palette.white}
                      />
                    </View>
                    <View style={styles.advisoryHeaderText}>
                      <Text style={styles.advisoryTitle}>
                        {diagRecord.suspectedIssues[0]?.toLowerCase().includes('healthy')
                          ? 'Crop Health Advisory'
                          : 'Expert Advisory'}
                      </Text>
                      <Text style={styles.advisorySubtitle}>
                        {diagRecord.suspectedIssues[0]?.toLowerCase().includes('healthy')
                          ? 'Maintain your healthy crop'
                          : 'Professional guidance & prevention'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.advisoryDivider} />

                {isLoadingAdvisory ? (
                  <View style={styles.advisoryLoading}>
                    <ActivityIndicator size="small" color={palette.brandGreen} />
                    <View style={styles.advisoryLoadingContent}>
                      <Text style={styles.advisoryLoadingText}>Getting expert advice...</Text>
                      <Text style={styles.advisoryLoadingSubtext}>This may take a few moments</Text>
                    </View>
                  </View>
                ) : advisoryResponse ? (
                  <View style={styles.advisoryContent}>
                    <View style={styles.advisoryTextContainer}>
                      <Text style={styles.advisoryText}>{advisoryResponse}</Text>
                    </View>
                    <ResultAiActions
                      onAskAi={() => continueDiagnosisChat()}
                      onShop={
                        !diagRecord.suspectedIssues[0]?.toLowerCase().includes('healthy')
                          ? browseTreatmentsFromHistory
                          : undefined
                      }
                      shopLabel="Find treatments"
                      suggestions={diagnosisSuggestions(
                        diagRecord.suspectedIssues[0] || 'crop health',
                        !!diagRecord.suspectedIssues[0]?.toLowerCase().includes('healthy'),
                      )}
                      onSuggestion={(q) => continueDiagnosisChat(q)}
                    />
                  </View>
                ) : (
                  <View style={styles.advisoryPlaceholder}>
                    <View style={styles.advisoryPlaceholderIcon}>
                      <MaterialCommunityIcons name="information-outline" size={40} color={palette.gray500} />
                    </View>
                    <Text style={styles.advisoryPlaceholderText}>
                      Advisory information will appear here
                    </Text>
                    <Text style={styles.advisoryPlaceholderSubtext}>
                      Expert guidance based on your diagnosis
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {spectroRecord && (
          <View style={styles.detailCard}>
            {spectroscopyDataset && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('historyDetail.spectralTrace')}</Text>
                <LineChart
                  data={spectroscopyDataset}
                  width={chartWidth}
                  height={chartHeight}
                  withDots={false}
                  withInnerLines
                  chartConfig={{
                    backgroundColor: 'transparent',
                    backgroundGradientFrom: palette.white,
                    backgroundGradientFromOpacity: 0,
                    backgroundGradientTo: palette.white,
                    backgroundGradientToOpacity: 0,
                    color: (opacity = 1) => `rgba(46,125,50,${opacity})`,
                    strokeWidth: 2,
                    propsForBackgroundLines: {
                      strokeDasharray: '4 8',
                      stroke: 'rgba(46,125,50,0.25)',
                    },
                  }}
                  bezier
                  style={styles.chart}
                />
              </View>
            )}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('historyDetail.sampleName')}</Text>
              <Text style={styles.sectionBody}>{spectroRecord.sampleName}</Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('historyDetail.summary')}</Text>
              <Text style={styles.sectionBody}>{spectroRecord.summary}</Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('historyDetail.insights')}</Text>
              {spectroRecord.insights.map((insight, index) => (
                <View key={`${insight}-${index}`} style={styles.listItem}>
                  <MaterialCommunityIcons name="pulse" size={16} color={palette.brandGreen} />
                  <Text style={styles.sectionBody}>{insight}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F5FBF6',
  },
  container: {
    paddingHorizontal: 0,
    gap: spacing.lg,
    backgroundColor: '#F5FBF6',
    alignItems: 'stretch',
  },
  heroPanel: {
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: 'rgba(48, 82, 30, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    backgroundColor: palette.white,
    width: '100%',
    marginHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: '#E8F1EB',
  },
  contentCard: {
    alignSelf: 'stretch',
    backgroundColor: palette.white,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
    shadowColor: palette.brandGreenDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginTop: spacing.lg,
  },
  heroTitle: {
    fontFamily: appFont,
    fontSize: 18,
    fontWeight: '700',
    color: palette.brandGreenDark,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: appFont,
    fontSize: 13,
    color: palette.gray600,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: '#EAF7EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconButton: {
    backgroundColor: '#F0F7F1',
    borderWidth: 1,
    borderColor: '#E1EAE4',
  },
  iconButtonDanger: {
    backgroundColor: 'rgba(216,67,21,0.1)',
  },
  metaCard: {
    borderRadius: radius.xl,
    backgroundColor: '#F4F9F5',
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#D9E6DD',
    width: '100%',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaLabel: {
    fontFamily: appFont,
    fontSize: 13,
    fontWeight: '600',
    color: palette.brandGreenDark,
  },
  metaValue: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.charcoal,
  },
  detailCard: {
    borderRadius: radius.xl,
    backgroundColor: palette.white,
    padding: spacing.xl,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: '#E1EAE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 12,
    width: '100%',
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitle: {
    fontFamily: appFont,
    fontSize: 15,
    fontWeight: '700',
    color: palette.charcoal,
  },
  sectionMeta: {
    fontFamily: appFont,
    fontSize: 12,
    color: palette.gray500,
  },
  sectionBody: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.charcoal,
    lineHeight: 20,
  },
  sectionBodyMuted: {
    fontFamily: appFont,
    fontSize: 13,
    color: palette.gray500,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.lg,
    backgroundColor: '#E0F2E6',
  },
  chipLabel: {
    fontFamily: appFont,
    fontSize: 13,
    fontWeight: '600',
    color: palette.brandGreenDark,
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: radius.xl,
  },
  previewPlaceholder: {
    width: '100%',
    height: 220,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#E1EAE4',
    backgroundColor: '#F6FBF7',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  previewPlaceholderText: {
    fontFamily: appFont,
    fontSize: 13,
    color: palette.gray500,
  },
  chart: {
    borderRadius: radius.lg,
    marginTop: spacing.sm,
  },
  chipInconclusive: {
    backgroundColor: palette.gray100,
  },
  chipLabelInconclusive: {
    color: palette.gray600,
  },
  emptyState: {
    flex: 1,
    backgroundColor: '#F5FBF6',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  emptyTitle: {
    fontFamily: appFont,
    fontSize: 18,
    fontWeight: '700',
    color: palette.charcoal,
  },
  emptySubtitle: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.gray500,
    textAlign: 'center',
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: '#EAF7EC',
    borderWidth: 1,
    borderColor: '#D9E6DD',
  },
  emptyActionLabel: {
    fontFamily: appFont,
    fontSize: 13,
    fontWeight: '600',
    color: palette.brandGreenDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  advisoryCard: {
    backgroundColor: palette.white,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: '#E8F5E9',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  advisoryHeader: {
    marginBottom: spacing.md,
  },
  advisoryHeaderContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  advisoryIconBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 12,
  },
  advisoryIconBadgeHealthy: {
    backgroundColor: palette.brandGreen,
  },
  advisoryIconBadgeDiseased: {
    backgroundColor: '#FF9800',
  },
  advisoryHeaderText: {
    flex: 1,
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  advisoryTitle: {
    fontFamily: appFont,
    fontSize: 20,
    fontWeight: '700',
    color: palette.charcoal,
    letterSpacing: -0.3,
  },
  advisorySubtitle: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.gray500,
    lineHeight: 20,
  },
  advisoryDivider: {
    height: 1,
    backgroundColor: '#E8F5E9',
    marginVertical: spacing.md,
    marginHorizontal: -spacing.xl,
  },
  advisoryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  advisoryLoadingContent: {
    flex: 1,
    gap: spacing.xs,
  },
  advisoryLoadingText: {
    fontFamily: appFont,
    fontSize: 15,
    fontWeight: '600',
    color: palette.charcoal,
  },
  advisoryLoadingSubtext: {
    fontFamily: appFont,
    fontSize: 13,
    color: palette.gray500,
  },
  advisoryContent: {
    gap: spacing.lg,
  },
  advisoryTextContainer: {
    backgroundColor: '#F8FBF9',
    borderRadius: radius.md,
    padding: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: palette.brandGreen,
  },
  advisoryText: {
    fontFamily: appFont,
    fontSize: 15,
    lineHeight: 24,
    color: palette.charcoal,
    letterSpacing: 0.1,
  },
  advisoryPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  advisoryPlaceholderIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: palette.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advisoryPlaceholderText: {
    fontFamily: appFont,
    fontSize: 15,
    fontWeight: '600',
    color: palette.charcoal,
    textAlign: 'center',
  },
  advisoryPlaceholderSubtext: {
    fontFamily: appFont,
    fontSize: 13,
    color: palette.gray500,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.brandGreen,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 12,
  },
  marketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: palette.brandGreen + '50',
  },
  marketButtonText: {
    fontFamily: appFont,
    color: palette.brandGreen,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  chatButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  chatButtonText: {
    fontFamily: appFont,
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

