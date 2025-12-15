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
  Japadhola: 'jap',
  Swahili: 'sw',
  Runyankore: 'nyn',
};

const appFont = Platform.select({ ios: 'HelveticaNeue', android: 'sans-serif' }) ?? 'System';
const wallBackground = require('../../../assets/images/wall.jpg');

type Params = {
  type?: string;
  id?: string;
};

export default function HistoryDetailScreen() {
  const { type, id } = useLocalSearchParams<Params>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, removeDiagnosisRecord, removeSpectroscopyRecord, removeDiagnosisRecordWithAPI, removeSpectroscopyRecordWithAPI, profile } = useAppContext();
  const { width } = useWindowDimensions();
  const { t, formatNumber, formatDateTime } = useTranslation();
  const [advisoryResponse, setAdvisoryResponse] = useState<string | null>(null);
  const [isLoadingAdvisory, setIsLoadingAdvisory] = useState(false);

  const recordType = type === 'diagnosis' || type === 'spectroscopy' ? type : null;

  const [record, setRecord] = useState<any>(null);
  const [isLoadingRecord, setIsLoadingRecord] = useState(true);

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
            imageUri: apiRecord.image_uri,
            image_base64: apiRecord.image_base64,
            suspectedIssues: apiRecord.suspected_issues,
            confidence: apiRecord.confidence,
            summary: apiRecord.summary,
            recommendations: apiRecord.recommendations,
            followUpQuestion: apiRecord.follow_up_question,
            followUpResponse: apiRecord.follow_up_response,
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
    if (recordType === 'diagnosis' && record && profile) {
      fetchAdvisory(record);
    }
  }, [recordType, record, profile]);

  const fetchAdvisory = async (diagnosis: any) => {
    if (!profile) return;

    setIsLoadingAdvisory(true);
    setAdvisoryResponse(null);

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
3. How to prevent this disease from spreading to other plants
4. Long-term prevention measures to avoid future outbreaks
5. When to consult an agricultural extension officer or seek professional help
6. Best practices for crop management to minimize disease risk

Please provide practical, actionable advice that I can implement immediately. Use clear, simple language that is easy to understand.`;
      }

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
    } catch (error: any) {
      console.error('❌ Failed to fetch advisory:', error);
      setAdvisoryResponse(null);
    } finally {
      setIsLoadingAdvisory(false);
    }
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
    recordType === 'spectroscopy'
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
            <MaterialCommunityIcons name="arrow-left" size={20} color={palette.white} />
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
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={palette.white} />
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

      {recordType === 'diagnosis' ? (
        <View style={styles.detailCard}>
          {record.imageUri ? (
            <Image source={{ uri: record.imageUri }} style={styles.previewImage} resizeMode="cover" />
          ) : (record as any).image_base64 ? (
            <Image 
              source={{ uri: `data:image/jpeg;base64,${(record as any).image_base64}` }} 
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
            {record.suspectedIssues.map((issue) => (
              <View key={issue} style={styles.chip}>
                <Text style={styles.chipLabel}>{issue}</Text>
              </View>
            ))}
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('historyDetail.summary')}</Text>
            <Text style={styles.sectionBody}>{record.summary}</Text>
          </View>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('historyDetail.recommendations')}</Text>
              <Text style={styles.sectionMeta}>
                {t('historyDetail.confidence', {
                  value: formatNumber(Math.round(record.confidence * 100)),
                })}
              </Text>
            </View>
            {record.recommendations.map((recommendation, index) => (
              <View key={`${recommendation}-${index}`} style={styles.listItem}>
                <MaterialCommunityIcons name="check-circle-outline" size={16} color={palette.brandGreen} />
                <Text style={styles.sectionBody}>{recommendation}</Text>
              </View>
            ))}
          </View>
          {record.followUpQuestion && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('historyDetail.followUp')}</Text>
              <Text style={styles.sectionMeta}>{record.followUpQuestion}</Text>
              {record.followUpResponse ? (
                <Text style={styles.sectionBody}>{record.followUpResponse}</Text>
              ) : (
                <Text style={styles.sectionBodyMuted}>{t('common.labels.noResponse')}</Text>
              )}
            </View>
          )}

          {/* Professional Advisory Section */}
          <View style={styles.advisoryCard}>
            <View style={styles.advisoryHeader}>
              <View style={styles.advisoryHeaderContent}>
                <View style={[
                  styles.advisoryIconBadge,
                  record.suspectedIssues[0]?.toLowerCase().includes('healthy') 
                    ? styles.advisoryIconBadgeHealthy 
                    : styles.advisoryIconBadgeDiseased
                ]}>
                  <MaterialCommunityIcons 
                    name={record.suspectedIssues[0]?.toLowerCase().includes('healthy') ? 'leaf-circle' : 'shield-check'} 
                    size={28} 
                    color={palette.white} 
                  />
                </View>
                <View style={styles.advisoryHeaderText}>
                  <Text style={styles.advisoryTitle}>
                    {record.suspectedIssues[0]?.toLowerCase().includes('healthy') 
                      ? 'Crop Health Advisory' 
                      : 'Expert Advisory'}
                  </Text>
                  <Text style={styles.advisorySubtitle}>
                    {record.suspectedIssues[0]?.toLowerCase().includes('healthy')
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
                <Pressable
                  style={({ pressed }) => [
                    styles.chatButton,
                    pressed && styles.chatButtonPressed
                  ]}
                  onPress={() => router.push('/(tabs)/chat')}
                >
                  <MaterialCommunityIcons name="message-text-outline" size={20} color={palette.white} />
                  <Text style={styles.chatButtonText}>Ask More Questions</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={palette.white} />
                </Pressable>
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
        </View>
      ) : (
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
                  backgroundGradientFrom: '#FFFFFF',
                  backgroundGradientFromOpacity: 0,
                  backgroundGradientTo: '#FFFFFF',
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
            <Text style={styles.sectionBody}>{record.sampleName}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('historyDetail.summary')}</Text>
            <Text style={styles.sectionBody}>{record.summary}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('historyDetail.insights')}</Text>
            {record.insights.map((insight, index) => (
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
    backgroundColor: palette.brandGreen,
  },
  container: {
    paddingHorizontal: 0,
    gap: spacing.lg,
    backgroundColor: palette.brandGreen,
    alignItems: 'stretch',
  },
  heroPanel: {
    borderRadius: radius.xl * 1.2,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: 'rgba(48, 82, 30, 0.3)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    backgroundColor: palette.brandGreen,
    width: '100%',
    marginHorizontal: spacing.xl,
  },
  contentCard: {
    alignSelf: 'stretch',
    backgroundColor: palette.white,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginTop: spacing.lg,
  },
  heroTitle: {
    fontFamily: appFont,
    fontSize: 18,
    fontWeight: '700',
    color: palette.white,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: appFont,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
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
  emptyState: {
    flex: 1,
    backgroundColor: palette.brandGreen,
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
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

