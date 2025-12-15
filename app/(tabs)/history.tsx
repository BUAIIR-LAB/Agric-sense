import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppContext } from '@/context/AppContext';
import { PieChart } from '@/components/charts/PieChart';
import { BarChart } from '@/components/charts/BarChart';
import { useSweetAlert } from '@/components/AlertProvider';
import { useTranslation } from '@/localization/useTranslation';
import { EmptyState } from '@/components/EmptyState';
import { NetworkStatusBar } from '@/components/NetworkStatusBar';
import { SkeletonCard } from '@/components/SkeletonLoader';
import { palette } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';

const appFont = Platform.select({ ios: 'HelveticaNeue', android: 'sans-serif' }) ?? 'System';
const summarize = (value: string, limit = 140) => (value.length > limit ? `${value.slice(0, limit - 1)}…` : value);

type HistoryView = 'timeline' | 'diagnosis' | 'spectroscopy';

type TimelineEvent = {
  id: string;
  recordId: string;
  timestamp: string;
  type: Exclude<HistoryView, 'timeline'>;
  title: string;
  content: string;
  meta: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

export default function HistoryScreen() {
  const { showAlert } = useSweetAlert();
  const { 
    state, 
    removeDiagnosisRecord, 
    removeSpectroscopyRecord,
    removeDiagnosisRecordWithAPI,
    removeSpectroscopyRecordWithAPI,
    loadDiagnosisHistory,
    loadSpectroscopyHistory,
    isLoading 
  } = useAppContext();
  const router = useRouter();
  const { t, tp, formatNumber, formatDateTime } = useTranslation();

  const [activeView, setActiveView] = useState<HistoryView>('timeline');
  const [menuTarget, setMenuTarget] = useState<{ type: Exclude<HistoryView, 'timeline'>; id: string } | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(10); // Pagination limit

  // Reset pagination when view changes or search query changes
  useEffect(() => {
    setDisplayLimit(10);
  }, [activeView, searchQuery]);

  const loadData = useCallback(async (showLoading = true) => {
    // Only load if user is authenticated and has a profile
    if (state.isAuthenticated && state.profile) {
      if (showLoading) {
        setIsLoadingData(true);
      }
      setError(null);
      try {
        await Promise.all([
          loadDiagnosisHistory(),
          loadSpectroscopyHistory(),
        ]);
      } catch (error: any) {
        if (__DEV__) {
          console.error('Failed to load history data:', error);
        }
        // If 401 error, user might not be logged in properly
        if (error?.response?.status === 401) {
          if (__DEV__) {
            console.warn('Authentication failed. User may need to log in again.');
          }
          setError('Authentication failed. Please log in again.');
        } else {
          setError('Failed to load history. Please try again.');
        }
      } finally {
        if (showLoading) {
          setIsLoadingData(false);
        }
      }
    }
  }, [state.isAuthenticated, state.profile, loadDiagnosisHistory, loadSpectroscopyHistory]);

  // Load data from API when screen mounts or when user is authenticated
  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(false);
    setRefreshing(false);
  }, [loadData]);

  const totalDiagnoses = state.diagnosisHistory.length;
  const totalSpectra = state.spectroscopyHistory.length;

  // Calculate disease distribution for pie chart
  const diseaseDistribution = useMemo(() => {
    const diseaseCounts: Record<string, number> = {};
    state.diagnosisHistory.forEach((diagnosis) => {
      const disease = diagnosis.suspectedIssues[0] || 'Unknown';
      diseaseCounts[disease] = (diseaseCounts[disease] || 0) + 1;
    });

    const colors = [
      palette.brandGreen,
      palette.success,
      palette.warning,
      palette.danger,
      palette.semantic.info,
      palette.brandGreenLight,
    ];

    return Object.entries(diseaseCounts)
      .map(([label, value], index) => ({
        label: label.length > 20 ? label.substring(0, 20) + '...' : label,
        value,
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6); // Top 6 diseases
  }, [state.diagnosisHistory]);

  // Calculate activity timeline for bar chart (last 7 days)
  const activityTimeline = useMemo(() => {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const diagnosisCount = state.diagnosisHistory.filter(
        (d) => new Date(d.timestamp).toDateString() === date.toDateString()
      ).length;
      const spectraCount = state.spectroscopyHistory.filter(
        (s) => new Date(s.timestamp).toDateString() === date.toDateString()
      ).length;
      return {
        label: dayName,
        value: diagnosisCount + spectraCount,
        color: palette.brandGreen,
      };
    });
    return days;
  }, [state.diagnosisHistory, state.spectroscopyHistory]);

  const timelineEvents: TimelineEvent[] = useMemo(() => {
    const diagnosisEvents: TimelineEvent[] = state.diagnosisHistory.map((entry) => {
      const confidence = formatNumber(Math.round(entry.confidence * 100));
      const recommendationsLabel = tp('history.meta.recommendations', entry.recommendations.length, {
        value: formatNumber(entry.recommendations.length),
      });
      return {
        id: `diagnosis-${entry.id}`,
        recordId: entry.id,
        timestamp: entry.timestamp,
        type: 'diagnosis' as const,
        title: entry.suspectedIssues[0] ?? t('history.fallbacks.diagnosisTitle'),
        content: entry.summary,
        meta: `${t('history.meta.confidence', { value: confidence })} • ${recommendationsLabel}`,
        icon: 'microscope',
      };
    });

    const spectroscopyEvents: TimelineEvent[] = state.spectroscopyHistory.map((entry) => {
      const insightsLabel = tp('history.meta.insights', entry.insights.length, {
        value: formatNumber(entry.insights.length),
      });
      return {
        id: `spectroscopy-${entry.id}`,
        recordId: entry.id,
        timestamp: entry.timestamp,
        type: 'spectroscopy' as const,
        title: entry.sampleName || t('history.fallbacks.spectrumTitle'),
        content: entry.summary,
        meta: insightsLabel,
        icon: 'chart-timeline-variant',
      };
    });

    return [...diagnosisEvents, ...spectroscopyEvents]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 24);
  }, [formatNumber, state.diagnosisHistory, state.spectroscopyHistory, t, tp]);
  
  // Filter data based on search query
  const filteredTimelineEvents = useMemo(() => {
    if (!searchQuery.trim()) return timelineEvents;
    const query = searchQuery.toLowerCase();
    return timelineEvents.filter(
      (event) =>
        event.title.toLowerCase().includes(query) ||
        event.content.toLowerCase().includes(query) ||
        event.meta.toLowerCase().includes(query)
    );
  }, [timelineEvents, searchQuery]);

  const diagnosisRecordsBase = useMemo(
    () => state.diagnosisHistory.slice().reverse(),
    [state.diagnosisHistory],
  );
  const spectroscopyRecordsBase = useMemo(
    () => state.spectroscopyHistory.slice().reverse(),
    [state.spectroscopyHistory],
  );

  const filteredDiagnosisRecords = useMemo(() => {
    if (!searchQuery.trim()) return diagnosisRecordsBase;
    const query = searchQuery.toLowerCase();
    return diagnosisRecordsBase.filter(
      (entry) =>
        entry.suspectedIssues.some((issue) => issue.toLowerCase().includes(query)) ||
        entry.summary.toLowerCase().includes(query) ||
        entry.recommendations.some((rec) => rec.toLowerCase().includes(query))
    );
  }, [diagnosisRecordsBase, searchQuery]);

  const filteredSpectroscopyRecords = useMemo(() => {
    if (!searchQuery.trim()) return spectroscopyRecordsBase;
    const query = searchQuery.toLowerCase();
    return spectroscopyRecordsBase.filter(
      (entry) =>
        entry.sampleName.toLowerCase().includes(query) ||
        entry.summary.toLowerCase().includes(query) ||
        entry.insights.some((insight) => insight.toLowerCase().includes(query))
    );
  }, [spectroscopyRecordsBase, searchQuery]);

  // Pagination: Show limited items initially, load more on scroll
  const timelinePreview = useMemo(() => filteredTimelineEvents.slice(0, displayLimit), [filteredTimelineEvents, displayLimit]);
  const hasMoreTimeline = filteredTimelineEvents.length > displayLimit;
  const diagnosisRecords = useMemo(() => filteredDiagnosisRecords.slice(0, displayLimit), [filteredDiagnosisRecords, displayLimit]);
  const hasMoreDiagnosis = filteredDiagnosisRecords.length > displayLimit;
  const spectroscopyRecords = useMemo(() => filteredSpectroscopyRecords.slice(0, displayLimit), [filteredSpectroscopyRecords, displayLimit]);
  const hasMoreSpectroscopy = filteredSpectroscopyRecords.length > displayLimit;

  const goToDetail = (type: HistoryView, id: string) => {
    if (type === 'timeline') {
      return;
    }
    setMenuTarget(null);
    router.push(`/history/${type}/${id}`);
  };

  const confirmDelete = (type: HistoryView, id: string) => {
    if (type === 'timeline') {
      return;
    }
    const title =
      type === 'diagnosis'
        ? t('history.dialog.removeDiagnosisTitle')
        : t('history.dialog.removeSpectrumTitle');
    const message =
      type === 'diagnosis'
        ? t('history.dialog.removeDiagnosisMessage')
        : t('history.dialog.removeSpectrumMessage');

    showAlert(
      'warning',
      title,
      message,
      {
        showCancel: true,
        confirmText: t('common.actions.delete'),
        cancelText: t('common.actions.cancel'),
        onCancel: () => setMenuTarget(null),
        onConfirm: async () => {
          setMenuTarget(null);
          try {
            if (type === 'diagnosis') {
              console.log('Deleting diagnosis record:', id);
              // Try API delete first, fallback to local if needed
              const success = await removeDiagnosisRecordWithAPI(id);
              console.log('Delete result:', success);
              if (!success) {
                // Fallback to local delete if API fails
                console.log('API delete failed, using local delete');
                removeDiagnosisRecord(id);
              }
              showAlert('success', 'Record Deleted', 'The diagnosis record has been successfully deleted.');
            } else {
              console.log('Deleting spectroscopy record:', id);
              // Try API delete first, fallback to local if needed
              const success = await removeSpectroscopyRecordWithAPI(id);
              console.log('Delete result:', success);
              if (!success) {
                // Fallback to local delete if API fails
                console.log('API delete failed, using local delete');
                removeSpectroscopyRecord(id);
              }
              showAlert('success', 'Deleted', 'Record removed.');
            }
          } catch (error: any) {
            console.error('Failed to delete record:', error);
            // Fallback to local delete on any error
            if (type === 'diagnosis') {
              console.log('Error occurred, using local delete for diagnosis');
              removeDiagnosisRecord(id);
            } else {
              console.log('Error occurred, using local delete for spectroscopy');
              removeSpectroscopyRecord(id);
            }
            showAlert('error', 'Delete Failed', 'Failed to delete the record. It has been removed locally.');
          }
        },
      }
    );
  };

  const toggleMenu = (type: Exclude<HistoryView, 'timeline'>, id: string) => {
    setMenuTarget((previous) => {
      if (previous?.type === type && previous.id === id) {
        return null;
      }
      return { type, id };
    });
  };

  const isMenuOpen = (type: Exclude<HistoryView, 'timeline'>, id: string) =>
    menuTarget?.type === type && menuTarget?.id === id;
  const handleSeeAllActivity = () => {
    router.push('/history/timeline');
  };

  const hasData = activeView === 'timeline' 
    ? timelineEvents.length > 0
    : activeView === 'diagnosis'
    ? diagnosisRecords.length > 0
    : spectroscopyRecords.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <NetworkStatusBar />
      <ScrollView 
        contentContainerStyle={styles.container} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.brandGreen}
            colors={[palette.brandGreen]}
          />
        }
        onScroll={(event) => {
          const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
          const paddingToBottom = 20;
          const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
          
          if (isCloseToBottom && !isLoadingData) {
            // Load more items when scrolling near bottom
            if (activeView === 'timeline' && hasMoreTimeline) {
              setDisplayLimit((prev) => Math.min(prev + 10, filteredTimelineEvents.length));
            } else if (activeView === 'diagnosis' && hasMoreDiagnosis) {
              setDisplayLimit((prev) => Math.min(prev + 10, filteredDiagnosisRecords.length));
            } else if (activeView === 'spectroscopy' && hasMoreSpectroscopy) {
              setDisplayLimit((prev) => Math.min(prev + 10, filteredSpectroscopyRecords.length));
            }
          }
        }}
        scrollEventThrottle={400}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={[palette.brandGreen, palette.brandGreenDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          <View style={styles.heroContent}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="history" size={40} color={palette.white} />
            </View>

            <Text style={styles.heroSubtitle}>{t('history.heroSubtitle')}</Text>
          </View>
        </LinearGradient>

        {/* Main Content */}
        <View style={styles.contentSection}>
          {/* Loading Indicator */}
          {(isLoadingData || isLoading) && (
            <View style={styles.loadingContainer}>
              {[...Array(3)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </View>
          )}
          
          {/* Stats Cards */}
          {!(isLoadingData || isLoading) && (
            <>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <MaterialCommunityIcons name="microscope" size={24} color={palette.white} />
              </View>
              <Text style={styles.statValue}>{formatNumber(totalDiagnoses)}</Text>
              <Text style={styles.statLabel}>{t('history.stats.diagnoses')}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <MaterialCommunityIcons name="chart-timeline-variant" size={24} color={palette.white} />
              </View>
              <Text style={styles.statValue}>{formatNumber(totalSpectra)}</Text>
              <Text style={styles.statLabel}>{t('history.stats.spectra')}</Text>
            </View>
          </View>

          {/* Disease Distribution Chart */}
          {!(isLoadingData || isLoading) && totalDiagnoses > 0 && diseaseDistribution.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Disease Distribution</Text>
              <PieChart
                data={diseaseDistribution}
                size={200}
                showLegend={true}
                showLabels={true}
              />
            </View>
          )}

          {/* Activity Timeline Chart */}
          {!(isLoadingData || isLoading) && totalDiagnoses + totalSpectra > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Activity Timeline (Last 7 Days)</Text>
              <BarChart
                data={activityTimeline}
                height={150}
                showLabels={true}
                showValues={false}
              />
            </View>
          )}

          {/* Search Bar */}
          {!(isLoadingData || isLoading) && (
            <View style={styles.searchContainer}>
              <MaterialCommunityIcons name="magnify" size={20} color={palette.gray500} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search..."
                placeholderTextColor={palette.gray500}
                value={searchQuery}
                onChangeText={setSearchQuery}
                accessibilityLabel="Search history"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  style={styles.searchClear}
                  accessibilityLabel="Clear search"
                >
                  <MaterialCommunityIcons name="close-circle" size={20} color={palette.gray500} />
                </Pressable>
              )}
            </View>
          )}

          {/* Professional Tab Switcher */}
          <View style={styles.tabContainer}>
            <View style={styles.tabWrapper}>
              {[
                {
                  key: 'timeline' as HistoryView,
                  label: t('history.filters.timeline'),
                  icon: 'timeline-clock-outline',
                  count: formatNumber(timelineEvents.length),
                },
                {
                  key: 'diagnosis' as HistoryView,
                  label: t('history.filters.diagnosis'),
                  icon: 'microscope',
                  count: formatNumber(totalDiagnoses),
                },
                {
                  key: 'spectroscopy' as HistoryView,
                  label: t('history.filters.spectroscopy'),
                  icon: 'chart-timeline-variant',
                  count: formatNumber(totalSpectra),
                },
              ].map((filter) => {
                const isActive = activeView === filter.key;
                return (
                  <Pressable
                    key={filter.key}
                    onPress={() => setActiveView(filter.key)}
                    style={({ pressed }) => [
                      styles.tabButton,
                      isActive && styles.tabButtonActive,
                      pressed && styles.tabButtonPressed,
                    ]}
                  >
                    <View style={[styles.tabIconContainer, isActive && styles.tabIconContainerActive]}>
                      <MaterialCommunityIcons
                        name={filter.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                        size={20}
                        color={isActive ? palette.white : palette.brandGreen}
                      />
                    </View>
                    <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                      {filter.label}
                    </Text>
                    {filter.count !== '0' && (
                      <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                        <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                          {filter.count}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Timeline View */}
          {activeView === 'timeline' && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('history.sections.latest')}</Text>
              </View>
              {timelinePreview.length > 0 ? (
                <>
                  {searchQuery && (
                    <Text style={styles.searchResultsText}>
                      {filteredTimelineEvents.length} result{filteredTimelineEvents.length !== 1 ? 's' : ''} found
                    </Text>
                  )}
                  <View style={styles.timelineList}>
                    {timelinePreview.map((event) => (
                      <Pressable
                        key={event.id}
                        style={({ pressed }) => [
                          styles.activityCard,
                          pressed && styles.activityCardPressed,
                        ]}
                        onPress={() => goToDetail(event.type, event.recordId)}
                      >
                        {/* Card Header */}
                        <View style={styles.activityCardHeader}>
                          <View style={styles.activityCardHeaderLeft}>
                            <View
                              style={[
                                styles.activityIcon,
                                event.type === 'diagnosis' ? styles.activityIconDiagnosis : styles.activityIconSpectroscopy,
                              ]}
                            >
                              <MaterialCommunityIcons name={event.icon} size={22} color={palette.white} />
                            </View>
                            <View style={styles.activityCardHeaderContent}>
                              <Text style={styles.activityTitle} numberOfLines={2}>
                                {event.title}
                              </Text>
                              <Text style={styles.activityTimestamp}>
                                {formatDateTime(event.timestamp, { dateStyle: 'medium', timeStyle: 'short' })}
                              </Text>
                            </View>
                          </View>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              toggleMenu(event.type, event.recordId);
                            }}
                            style={styles.actionDots}
                            accessibilityRole="button"
                            accessibilityLabel={t('history.accessibility.showActions')}
                          >
                            <MaterialCommunityIcons name="dots-vertical" size={20} color={palette.gray500} />
                          </Pressable>
                        </View>

                        {/* Context Menu */}
                        {isMenuOpen(event.type, event.recordId) && (
                          <View style={styles.contextMenu}>
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation();
                                setMenuTarget(null);
                                goToDetail(event.type, event.recordId);
                              }}
                              style={styles.contextMenuItem}
                              accessibilityRole="button"
                              accessibilityLabel={t('common.actions.view')}
                            >
                              <MaterialCommunityIcons name="eye-outline" size={18} color={palette.brandGreen} />
                              <Text style={styles.contextMenuLabel}>{t('common.actions.view')}</Text>
                            </Pressable>
                            <View style={styles.contextMenuDivider} />
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation();
                                setMenuTarget(null);
                                confirmDelete(event.type, event.recordId);
                              }}
                              style={styles.contextMenuItem}
                              accessibilityRole="button"
                              accessibilityLabel={t('common.actions.delete')}
                            >
                              <MaterialCommunityIcons name="trash-can-outline" size={18} color={palette.danger} />
                              <Text style={[styles.contextMenuLabel, styles.contextMenuDanger]}>
                                {t('common.actions.delete')}
                              </Text>
                            </Pressable>
                          </View>
                        )}

                        {/* Card Body */}
                        <View style={styles.activityCardBody}>
                          <Text style={styles.activitySummary} numberOfLines={3}>
                            {summarize(event.content, 120)}
                          </Text>
                        </View>

                        {/* Card Footer */}
                        <View style={styles.activityCardFooter}>
                          <View
                            style={[
                              styles.typeChip,
                              event.type === 'diagnosis' ? styles.typeChipDiagnosis : styles.typeChipSpectroscopy,
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={event.type === 'diagnosis' ? 'microscope' : 'chart-timeline-variant'}
                              size={14}
                              color={event.type === 'diagnosis' ? palette.brandGreen : palette.success}
                            />
                            <Text style={styles.typeChipLabel}>
                              {event.type === 'diagnosis'
                                ? t('history.chips.diagnosis')
                                : t('history.chips.spectrum')}
                            </Text>
                          </View>
                          <View style={styles.activityMetaContainer}>
                            <MaterialCommunityIcons name="information-outline" size={14} color={palette.gray500} />
                            <Text style={styles.activityMeta} numberOfLines={1}>
                              {event.meta}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                  {hasMoreTimeline && (
                    <Pressable
                      onPress={handleSeeAllActivity}
                      style={styles.viewMoreButton}
                      accessibilityRole="button"
                      accessibilityLabel={t('history.buttons.seeAll')}
                    >
                      <Text style={styles.viewMoreLabel}>{t('history.buttons.seeAll')}</Text>
                      <MaterialCommunityIcons name="arrow-right" size={16} color={palette.brandGreenDark} />
                    </Pressable>
                  )}
                </>
              ) : (
                <EmptyState
                  icon="timeline-clock-outline"
                  title="No History"
                  message="Start using the app to see your records here."
                  actionLabel="Start"
                  onAction={() => router.push('/(tabs)/diagnosis')}
                />
              )}
            </View>
          )}

          {/* Diagnosis View */}
          {activeView === 'diagnosis' && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('history.sections.diagnosis')}</Text>
              </View>
              {filteredDiagnosisRecords.length ? (
                <>
                  {searchQuery && (
                    <Text style={styles.searchResultsText}>
                      {filteredDiagnosisRecords.length} result{filteredDiagnosisRecords.length !== 1 ? 's' : ''} found
                    </Text>
                  )}
                  {filteredDiagnosisRecords.map((entry) => (
                  <Pressable
                    key={entry.id}
                    style={({ pressed }) => [
                      styles.recordCard,
                      pressed && styles.recordCardPressed
                    ]}
                    onPress={() => goToDetail('diagnosis', entry.id)}
                  >
                    <View style={styles.recordHeader}>
                      <View style={styles.recordHeaderLeft}>
                        <Text style={styles.recordLabel}>
                          {formatDateTime(entry.timestamp, { dateStyle: 'medium' })}
                        </Text>
                        <Text style={styles.recordMeta}>
                          {formatDateTime(entry.timestamp, { timeStyle: 'short' })}
                        </Text>
                      </View>
                      <View style={styles.recordHeaderRight}>
                        <View
                          style={[styles.typeTag, styles.typeTagDiagnosis]}
                          accessibilityLabel={t('history.chips.diagnosis')}
                        >
                          <Text style={styles.typeTagLabel}>{t('history.chips.diagnosis')}</Text>
                        </View>
                        <Pressable
                          onPress={() => toggleMenu('diagnosis', entry.id)}
                          style={styles.actionDots}
                          accessibilityRole="button"
                          accessibilityLabel={t('history.accessibility.showDiagnosisActions')}
                        >
                          <MaterialCommunityIcons name="dots-horizontal" size={18} color={palette.brandGreenDark} />
                        </Pressable>
                        {isMenuOpen('diagnosis', entry.id) && (
                          <View style={styles.contextMenu}>
                            <Pressable
                              onPress={() => goToDetail('diagnosis', entry.id)}
                              style={styles.contextMenuItem}
                            >
                              <MaterialCommunityIcons name="eye-outline" size={16} color={palette.brandGreenDark} />
                              <Text style={styles.contextMenuLabel}>{t('common.actions.view')}</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => confirmDelete('diagnosis', entry.id)}
                              style={styles.contextMenuItem}
                            >
                              <MaterialCommunityIcons name="trash-can-outline" size={16} color={palette.danger} />
                              <Text style={[styles.contextMenuLabel, styles.contextMenuDanger]}>
                                {t('common.actions.delete')}
                              </Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={styles.recordConfidence}>
                      {t('history.meta.confidence', {
                        value: formatNumber(Math.round(entry.confidence * 100)),
                      })}
                    </Text>
                    <Text style={styles.recordHighlight}>{entry.suspectedIssues.join(', ')}</Text>
                    <Text style={styles.recordBody}>{summarize(entry.summary, 200)}</Text>
                  </Pressable>
                  ))}
                  {hasMoreDiagnosis && (
                    <Pressable
                      onPress={() => setDisplayLimit((prev) => Math.min(prev + 10, filteredDiagnosisRecords.length))}
                      style={styles.viewMoreButton}
                      accessibilityRole="button"
                      accessibilityLabel="Load more"
                    >
                      <Text style={styles.viewMoreLabel}>
                        Load More ({filteredDiagnosisRecords.length - displayLimit} remaining)
                      </Text>
                      <MaterialCommunityIcons name="arrow-down" size={16} color={palette.brandGreenDark} />
                    </Pressable>
                  )}
                </>
              ) : (
                <EmptyState
                  icon="microscope"
                  title="No Diagnoses Yet"
                  message="Start by capturing a photo of your crop to get AI-powered diagnosis and recommendations."
                  actionLabel="Start Diagnosis"
                  onAction={() => router.push('/(tabs)/diagnosis')}
                />
              )}
            </View>
          )}

          {/* Spectroscopy View */}
          {activeView === 'spectroscopy' && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('history.sections.spectroscopy')}</Text>
              </View>
              {filteredSpectroscopyRecords.length ? (
                <>
                  {searchQuery && (
                    <Text style={styles.searchResultsText}>
                      {filteredSpectroscopyRecords.length} result{filteredSpectroscopyRecords.length !== 1 ? 's' : ''} found
                    </Text>
                  )}
                  {filteredSpectroscopyRecords.map((entry) => (
                  <View key={entry.id} style={styles.recordCard}>
                    <View style={styles.recordHeader}>
                      <View style={styles.recordHeaderLeft}>
                        <Text style={styles.recordLabel}>{entry.sampleName}</Text>
                        <Text style={styles.recordMeta}>
                          {formatDateTime(entry.timestamp, { dateStyle: 'medium', timeStyle: 'short' })}
                        </Text>
                      </View>
                      <View style={styles.recordHeaderRight}>
                        <View
                          style={[styles.typeTag, styles.typeTagSpectroscopy]}
                          accessibilityLabel={t('history.chips.spectrum')}
                        >
                          <Text style={styles.typeTagLabel}>{t('history.chips.spectrum')}</Text>
                        </View>
                        <Pressable
                          onPress={() => toggleMenu('spectroscopy', entry.id)}
                          style={styles.actionDots}
                          accessibilityRole="button"
                          accessibilityLabel={t('history.accessibility.showSpectrumActions')}
                        >
                          <MaterialCommunityIcons name="dots-horizontal" size={18} color={palette.brandGreenDark} />
                        </Pressable>
                        {isMenuOpen('spectroscopy', entry.id) && (
                          <View style={styles.contextMenu}>
                            <Pressable
                              onPress={() => goToDetail('spectroscopy', entry.id)}
                              style={styles.contextMenuItem}
                            >
                              <MaterialCommunityIcons name="eye-outline" size={16} color={palette.brandGreenDark} />
                              <Text style={styles.contextMenuLabel}>{t('common.actions.view')}</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => confirmDelete('spectroscopy', entry.id)}
                              style={styles.contextMenuItem}
                            >
                              <MaterialCommunityIcons name="trash-can-outline" size={16} color={palette.danger} />
                              <Text style={[styles.contextMenuLabel, styles.contextMenuDanger]}>
                                {t('common.actions.delete')}
                              </Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={styles.recordConfidence}>
                      {tp('history.meta.insights', entry.insights.length, {
                        value: formatNumber(entry.insights.length),
                      })}
                    </Text>
                    <Text style={styles.recordBody}>{summarize(entry.summary, 200)}</Text>
                  </View>
                  ))}
                  {hasMoreSpectroscopy && (
                    <Pressable
                      onPress={() => setDisplayLimit((prev) => Math.min(prev + 10, filteredSpectroscopyRecords.length))}
                      style={styles.viewMoreButton}
                      accessibilityRole="button"
                      accessibilityLabel="Load more"
                    >
                      <Text style={styles.viewMoreLabel}>
                        Load More ({filteredSpectroscopyRecords.length - displayLimit} remaining)
                      </Text>
                      <MaterialCommunityIcons name="arrow-down" size={16} color={palette.brandGreenDark} />
                    </Pressable>
                  )}
                </>
              ) : (
                <EmptyState
                  icon="chart-timeline-variant"
                  title={searchQuery ? "No Results" : "No Data"}
                  message={searchQuery ? "Try different search terms." : "Capture spectral data to get started."}
                  actionLabel={searchQuery ? undefined : "Start"}
                  onAction={searchQuery ? undefined : () => router.push('/(tabs)/spectroscopy')}
                />
              )}
            </View>
          )}
            </>
          )}
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
  container: {
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
  heroTitle: {
    fontFamily: appFont,
    fontSize: 32,
    fontWeight: '800',
    color: palette.white,
    textAlign: 'center',
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
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  chartCard: {
    backgroundColor: palette.white,
    borderRadius: spacing.xl,
    padding: spacing.xl,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: '#E1EDE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 12,
  },
  chartTitle: {
    fontFamily: appFont,
    fontSize: 18,
    fontWeight: '700',
    color: palette.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  statCard: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: spacing.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#E1EDE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontFamily: appFont,
    fontSize: 28,
    fontWeight: '800',
    color: palette.charcoal,
  },
  statLabel: {
    fontFamily: appFont,
    fontSize: 13,
    fontWeight: '600',
    color: palette.gray500,
    textAlign: 'center',
  },
  tabContainer: {
    marginBottom: spacing.lg,
  },
  tabWrapper: {
    flexDirection: 'row',
    backgroundColor: palette.white,
    borderRadius: spacing.xl,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: '#E1EDE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.lg,
    backgroundColor: 'transparent',
    gap: spacing.xs,
    minHeight: 80,
  },
  tabButtonActive: {
    backgroundColor: palette.brandGreen,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 12,
  },
  tabButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  tabIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(46, 125, 50, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(46, 125, 50, 0.2)',
  },
  tabIconContainerActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  tabLabel: {
    fontFamily: appFont,
    fontSize: 12,
    fontWeight: '600',
    color: palette.brandGreen,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: palette.white,
    fontWeight: '700',
  },
  tabBadge: {
    marginTop: spacing.xs / 2,
    backgroundColor: 'rgba(46, 125, 50, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  tabBadgeText: {
    fontFamily: appFont,
    fontSize: 10,
    fontWeight: '700',
    color: palette.brandGreen,
  },
  tabBadgeTextActive: {
    color: palette.white,
  },
  sectionCard: {
    backgroundColor: palette.white,
    borderRadius: spacing.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: '#E1EDE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 12,
  },
  sectionHeader: {
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontFamily: appFont,
    fontSize: 20,
    fontWeight: '700',
    color: palette.charcoal,
  },
  timelineList: {
    gap: spacing.lg,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  timelineRail: {
    width: 32,
    alignItems: 'center',
  },
  timelineNode: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 12,
  },
  timelineNodeDiagnosis: {
    backgroundColor: '#2E7D32',
  },
  timelineNodeSpectroscopy: {
    backgroundColor: '#1B5E20',
  },
  timelineConnector: {
    width: 2,
    flexGrow: 1,
    backgroundColor: '#DCE8DE',
    marginTop: spacing.xs,
  },
  feedContent: {
    flex: 1,
    gap: spacing.sm,
    backgroundColor: '#F8FCF9',
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E0EDE3',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 12,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignItems: 'baseline',
  },
  feedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  feedTitle: {
    fontFamily: appFont,
    fontSize: 15,
    fontWeight: '700',
    color: palette.charcoal,
    flex: 1,
  },
  feedHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    position: 'relative',
  },
  feedTimestamp: {
    fontFamily: appFont,
    fontSize: 12,
    color: palette.gray500,
  },
  feedBody: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.charcoal,
    lineHeight: 20,
  },
  feedMeta: {
    fontFamily: appFont,
    fontSize: 12,
    color: palette.gray500,
  },
  viewMoreButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#D9E6DD',
    backgroundColor: '#EEF7F0',
  },
  viewMoreLabel: {
    fontFamily: appFont,
    fontSize: 13,
    fontWeight: '600',
    color: palette.brandGreenDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  activityCard: {
    backgroundColor: palette.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#E1EDE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
    marginBottom: spacing.md,
  },
  activityCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  activityCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  activityCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    flex: 1,
  },
  activityCardHeaderContent: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0, // Prevents text overflow
  },
  activityCardBody: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  activityCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F0F5F1',
  },
  activityIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  activityIconDiagnosis: {
    backgroundColor: '#2E7D32',
  },
  activityIconSpectroscopy: {
    backgroundColor: '#1B5E20',
  },
  activityTitle: {
    fontFamily: appFont,
    fontSize: 16,
    fontWeight: '700',
    color: palette.text.primary,
    lineHeight: 22,
    marginBottom: spacing.xs / 2,
  },
  activityTimestamp: {
    fontFamily: appFont,
    fontSize: 12,
    color: palette.text.secondary,
    lineHeight: 16,
  },
  activitySummary: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.text.secondary,
    lineHeight: 20,
  },
  activityMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    minWidth: 0,
  },
  activityMeta: {
    fontFamily: appFont,
    fontSize: 12,
    color: palette.text.secondary,
    flex: 1,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
  },
  typeChipDiagnosis: {
    backgroundColor: 'rgba(46,125,50,0.12)',
  },
  typeChipSpectroscopy: {
    backgroundColor: 'rgba(27,94,32,0.12)',
  },
  typeChipLabel: {
    fontFamily: appFont,
    fontSize: 11,
    fontWeight: '700',
    color: palette.brandGreenDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  typeTag: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
  },
  typeTagDiagnosis: {
    backgroundColor: 'rgba(46,125,50,0.12)',
  },
  typeTagSpectroscopy: {
    backgroundColor: 'rgba(27,94,32,0.12)',
  },
  typeTagLabel: {
    fontFamily: appFont,
    fontSize: 11,
    fontWeight: '700',
    color: palette.brandGreenDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  timelineMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineLabel: {
    fontFamily: appFont,
    fontSize: 13,
    fontWeight: '600',
    color: palette.gray500,
  },
  timelineTimestamp: {
    fontFamily: appFont,
    fontSize: 12,
    color: palette.gray500,
  },
  timelineContent: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.charcoal,
    lineHeight: 20,
  },
  recordCard: {
    backgroundColor: palette.white,
    borderRadius: spacing.xl,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#E1EDE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 12,
  },
  recordCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordHeaderLeft: {
    gap: spacing.xs / 2,
  },
  recordHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    position: 'relative',
  },
  recordLabel: {
    fontFamily: appFont,
    fontSize: 13,
    fontWeight: '600',
    color: palette.gray500,
  },
  recordMeta: {
    fontFamily: appFont,
    fontSize: 12,
    color: palette.gray500,
  },
  recordConfidence: {
    fontFamily: appFont,
    fontSize: 12,
    color: palette.gray500,
  },
  recordHighlight: {
    fontFamily: appFont,
    fontSize: 16,
    fontWeight: '700',
    color: palette.brandGreen,
  },
  recordBody: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.charcoal,
    lineHeight: 20,
  },
  actionDots: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: '#F5FBF6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E1EDE4',
  },
  contextMenu: {
    position: 'absolute',
    top: 48,
    right: 0,
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E1EDE4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
    minWidth: 160,
    zIndex: 1000,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  contextMenuDivider: {
    height: 1,
    backgroundColor: '#E1EDE4',
    marginVertical: spacing.xs / 2,
  },
  contextMenuLabel: {
    fontFamily: appFont,
    fontSize: 14,
    fontWeight: '600',
    color: palette.text.primary,
    flex: 1,
  },
  contextMenuDanger: {
    color: palette.danger,
  },
  empty: {
    fontFamily: appFont,
    fontSize: 13,
    color: palette.gray500,
    fontStyle: 'italic',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.gray500,
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  errorTitle: {
    fontFamily: appFont,
    fontSize: 18,
    fontWeight: '700',
    color: palette.charcoal,
    textAlign: 'center',
  },
  errorMessage: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.gray500,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.brandGreen,
    borderRadius: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  retryButtonText: {
    fontFamily: appFont,
    fontSize: 16,
    fontWeight: '700',
    color: palette.white,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.gray200,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: palette.text.primary,
    fontFamily: appFont,
  },
  searchClear: {
    marginLeft: spacing.xs,
  },
  searchResultsText: {
    fontSize: 14,
    color: palette.gray600,
    marginBottom: spacing.sm,
    fontFamily: appFont,
  },
});

