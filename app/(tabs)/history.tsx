import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppContext, type DiagnosisRecord, type SpectroscopyRecord } from '@/context/AppContext';
import { useSweetAlert } from '@/components/AlertProvider';
import { useDeleteRecord } from '@/hooks/useDeleteRecord';
import { buildTimelineEntries, summarize } from '@/utils/historyTimeline';
import { useTranslation } from '@/localization/useTranslation';
import ProfileHeader from '@/components/ProfileHeader';
import { EmptyState } from '@/components/EmptyState';
import { palette } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Fonts } from '@/theme/fonts';

type HistoryView = 'timeline' | 'diagnosis' | 'spectroscopy';
type RecordType = Exclude<HistoryView, 'timeline'>;

type TimelineEvent = {
  id: string;
  recordId: string;
  timestamp: string;
  type: RecordType;
  title: string;
  content: string;
  meta: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

type HistoryListItem =
  | { key: string; kind: 'timeline'; event: TimelineEvent }
  | { key: string; kind: 'diagnosis'; record: DiagnosisRecord }
  | { key: string; kind: 'spectroscopy'; record: SpectroscopyRecord };

const PAGE_SIZE = 15;

function formatSyncLabel(timestamp: number | null, isSyncing: boolean): string {
  if (isSyncing) return 'Syncing…';
  if (!timestamp) return 'Saved on device';
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return 'Saved on device';
}

export default function HistoryScreen() {
  const { showAlert } = useSweetAlert();
  const { deleteRecord } = useDeleteRecord();
  const {
    state,
    isHydrated,
    isSyncingHistory,
    lastHistorySyncAt,
    syncHistoryFromAPI,
    isOffline,
  } = useAppContext();
  const router = useRouter();
  const { t, tp, formatNumber, formatDateTime } = useTranslation();

  const [activeView, setActiveView] = useState<HistoryView>('timeline');
  const [menuTarget, setMenuTarget] = useState<{ type: RecordType; id: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);

  const totalDiagnoses = state.diagnosisHistory.length;
  const totalSpectra = state.spectroscopyHistory.length;
  const totalRecords = totalDiagnoses + totalSpectra;

  useFocusEffect(
    useCallback(() => {
      if (state.isAuthenticated && !isOffline) {
        syncHistoryFromAPI();
      }
    }, [state.isAuthenticated, isOffline, syncHistoryFromAPI]),
  );

  const onRefresh = useCallback(async () => {
    if (isOffline) {
      showAlert('info', 'Offline', 'Showing saved records from your device.');
      return;
    }
    setRefreshing(true);
    await syncHistoryFromAPI();
    setRefreshing(false);
  }, [isOffline, showAlert, syncHistoryFromAPI]);

  const timelineEvents: TimelineEvent[] = useMemo(() => {
    return buildTimelineEntries(
      state.diagnosisHistory,
      state.spectroscopyHistory,
      {
        diagnosisTitle: 'Symptom Scan',
        spectrumTitle: 'Early Scan',
        confidence: (value) => t('history.meta.confidence', { value }),
        recommendations: (value, count) => tp('history.meta.recommendations', count, { value }),
        insights: (value, count) => tp('history.meta.insights', count, { value }),
      },
      formatNumber,
    ).map((entry) => ({
      id: entry.id,
      recordId: entry.recordId,
      timestamp: entry.timestamp,
      type: entry.type,
      title: entry.title,
      content: entry.summary,
      meta: entry.meta,
      icon: entry.icon,
    }));
  }, [formatNumber, state.diagnosisHistory, state.spectroscopyHistory, t, tp]);

  const filteredTimelineEvents = useMemo(() => {
    if (!searchQuery.trim()) return timelineEvents;
    const query = searchQuery.toLowerCase();
    return timelineEvents.filter(
      (event) =>
        event.title.toLowerCase().includes(query) ||
        event.content.toLowerCase().includes(query) ||
        event.meta.toLowerCase().includes(query),
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
        entry.recommendations.some((rec) => rec.toLowerCase().includes(query)),
    );
  }, [diagnosisRecordsBase, searchQuery]);

  const filteredSpectroscopyRecords = useMemo(() => {
    if (!searchQuery.trim()) return spectroscopyRecordsBase;
    const query = searchQuery.toLowerCase();
    return spectroscopyRecordsBase.filter(
      (entry) =>
        entry.sampleName.toLowerCase().includes(query) ||
        entry.summary.toLowerCase().includes(query) ||
        entry.insights.some((insight) => insight.toLowerCase().includes(query)),
    );
  }, [spectroscopyRecordsBase, searchQuery]);

  const activeSourceLength = useMemo(() => {
    if (activeView === 'timeline') return filteredTimelineEvents.length;
    if (activeView === 'diagnosis') return filteredDiagnosisRecords.length;
    return filteredSpectroscopyRecords.length;
  }, [activeView, filteredTimelineEvents.length, filteredDiagnosisRecords.length, filteredSpectroscopyRecords.length]);

  const listData: HistoryListItem[] = useMemo(() => {
    if (activeView === 'timeline') {
      return filteredTimelineEvents.slice(0, displayLimit).map((event) => ({
        key: event.id,
        kind: 'timeline' as const,
        event,
      }));
    }
    if (activeView === 'diagnosis') {
      return filteredDiagnosisRecords.slice(0, displayLimit).map((record) => ({
        key: record.id,
        kind: 'diagnosis' as const,
        record,
      }));
    }
    return filteredSpectroscopyRecords.slice(0, displayLimit).map((record) => ({
      key: record.id,
      kind: 'spectroscopy' as const,
      record,
    }));
  }, [activeView, displayLimit, filteredTimelineEvents, filteredDiagnosisRecords, filteredSpectroscopyRecords]);

  const hasMore = activeSourceLength > displayLimit;

  const resetPagination = useCallback(() => {
    setDisplayLimit(PAGE_SIZE);
  }, []);

  const goToDetail = (type: RecordType, id: string) => {
    setMenuTarget(null);
    router.push(`/history/${type}/${id}`);
  };

  const confirmDelete = async (type: RecordType, id: string) => {
    setMenuTarget(null);
    await deleteRecord(type, id);
  };

  const toggleMenu = (type: RecordType, id: string) => {
    setMenuTarget((previous) =>
      previous?.type === type && previous.id === id ? null : { type, id },
    );
  };

  const isMenuOpen = (type: RecordType, id: string) =>
    menuTarget?.type === type && menuTarget?.id === id;

  const renderTypeBadge = (type: RecordType) => {
    const isDiagnosis = type === 'diagnosis';
    return (
      <View style={[styles.typeBadge, isDiagnosis ? styles.typeBadgeDiagnosis : styles.typeBadgeSpectrum]}>
        <MaterialCommunityIcons
          name={isDiagnosis ? 'camera-plus' : 'chart-timeline-variant'}
          size={12}
          color={isDiagnosis ? palette.brandGreen : '#1565C0'}
        />
        <Text style={[styles.typeBadgeText, isDiagnosis ? styles.typeBadgeTextDiagnosis : styles.typeBadgeTextSpectrum]}>
          {isDiagnosis ? 'Symptom' : 'Early'}
        </Text>
      </View>
    );
  };

  const renderContextMenu = (type: RecordType, id: string) => {
    if (!isMenuOpen(type, id)) return null;
    return (
      <View style={styles.contextMenu}>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            goToDetail(type, id);
          }}
          style={styles.contextMenuItem}
        >
          <MaterialCommunityIcons name="eye-outline" size={16} color={palette.brandGreenDark} />
          <Text style={styles.contextMenuLabel}>{t('common.actions.view')}</Text>
        </Pressable>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            confirmDelete(type, id);
          }}
          style={styles.contextMenuItem}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={16} color={palette.danger} />
          <Text style={[styles.contextMenuLabel, styles.contextMenuDanger]}>{t('common.actions.delete')}</Text>
        </Pressable>
      </View>
    );
  };

  const renderItem = ({ item }: { item: HistoryListItem }) => {
    if (item.kind === 'timeline') {
      const { event } = item;
      return (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => goToDetail(event.type, event.recordId)}
        >
          <View style={styles.cardTopRow}>
            <View style={[styles.cardIcon, event.type === 'diagnosis' ? styles.cardIconDiagnosis : styles.cardIconSpectrum]}>
              <MaterialCommunityIcons name={event.icon} size={20} color={palette.white} />
            </View>
            <View style={styles.cardMain}>
              <Text style={styles.cardTitle} numberOfLines={1}>{event.title}</Text>
              <Text style={styles.cardDate}>
                {formatDateTime(event.timestamp, { dateStyle: 'medium', timeStyle: 'short' })}
              </Text>
            </View>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                toggleMenu(event.type, event.recordId);
              }}
              style={styles.menuButton}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="dots-vertical" size={20} color={palette.gray500} />
            </Pressable>
          </View>
          {renderContextMenu(event.type, event.recordId)}
          <Text style={styles.cardSummary} numberOfLines={2}>{summarize(event.content, 140)}</Text>
          <View style={styles.cardFooter}>
            {renderTypeBadge(event.type)}
            <Text style={styles.cardMeta} numberOfLines={1}>{event.meta}</Text>
          </View>
        </Pressable>
      );
    }

    if (item.kind === 'diagnosis') {
      const entry = item.record;
      return (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => goToDetail('diagnosis', entry.id)}
        >
          <View style={styles.cardTopRow}>
            <View style={[styles.cardIcon, styles.cardIconDiagnosis]}>
              <MaterialCommunityIcons name="camera-plus" size={20} color={palette.white} />
            </View>
            <View style={styles.cardMain}>
              <Text style={styles.cardTitle} numberOfLines={1}>{entry.suspectedIssues[0] ?? 'Symptom Scan'}</Text>
              <Text style={styles.cardDate}>
                {formatDateTime(entry.timestamp, { dateStyle: 'medium', timeStyle: 'short' })}
              </Text>
            </View>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                toggleMenu('diagnosis', entry.id);
              }}
              style={styles.menuButton}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="dots-vertical" size={20} color={palette.gray500} />
            </Pressable>
          </View>
          {renderContextMenu('diagnosis', entry.id)}
          <Text style={styles.cardHighlight}>
            {t('history.meta.confidence', { value: formatNumber(Math.round(entry.confidence * 100)) })}
          </Text>
          <Text style={styles.cardSummary} numberOfLines={2}>{summarize(entry.summary, 140)}</Text>
          <View style={styles.cardFooter}>{renderTypeBadge('diagnosis')}</View>
        </Pressable>
      );
    }

    const entry = item.record;
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => goToDetail('spectroscopy', entry.id)}
      >
        <View style={styles.cardTopRow}>
          <View style={[styles.cardIcon, styles.cardIconSpectrum]}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={20} color={palette.white} />
          </View>
          <View style={styles.cardMain}>
            <Text style={styles.cardTitle} numberOfLines={1}>{entry.sampleName}</Text>
            <Text style={styles.cardDate}>
              {formatDateTime(entry.timestamp, { dateStyle: 'medium', timeStyle: 'short' })}
            </Text>
          </View>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              toggleMenu('spectroscopy', entry.id);
            }}
            style={styles.menuButton}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="dots-vertical" size={20} color={palette.gray500} />
          </Pressable>
        </View>
        {renderContextMenu('spectroscopy', entry.id)}
        <Text style={styles.cardHighlight}>
          {tp('history.meta.insights', entry.insights.length, { value: formatNumber(entry.insights.length) })}
        </Text>
        <Text style={styles.cardSummary} numberOfLines={2}>{summarize(entry.summary, 140)}</Text>
        <View style={styles.cardFooter}>{renderTypeBadge('spectroscopy')}</View>
      </Pressable>
    );
  };

  const emptyMessage = useMemo(() => {
    if (searchQuery.trim()) {
      return { title: 'No Results', message: 'Try a different search term.', action: undefined as (() => void) | undefined };
    }
    if (activeView === 'diagnosis') {
      return {
        title: 'No Symptom Scans',
        message: 'Capture visible disease signs with a photo.',
        action: () => router.push('/(tabs)/scan?mode=symptom'),
      };
    }
    if (activeView === 'spectroscopy') {
      return {
        title: 'No Early Scans',
        message: 'Detect issues before visible symptoms appear.',
        action: () => router.push('/(tabs)/scan?mode=early'),
      };
    }
    return {
      title: 'No Activity Yet',
      message: 'Your scans will appear here instantly and stay saved on this device.',
      action: () => router.push('/(tabs)/scan?mode=symptom'),
    };
  }, [activeView, router, searchQuery]);

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>Activity</Text>
          <Text style={styles.subtitle}>Saved on your device · syncs in background</Text>
        </View>
        <View style={styles.syncPill}>
          {isSyncingHistory ? (
            <ActivityIndicator size="small" color={palette.brandGreen} />
          ) : (
            <MaterialCommunityIcons
              name={isOffline ? 'cloud-off-outline' : 'cloud-check-outline'}
              size={14}
              color={isOffline ? palette.gray500 : palette.brandGreen}
            />
          )}
          <Text style={styles.syncText}>{isOffline ? 'Offline' : formatSyncLabel(lastHistorySyncAt, isSyncingHistory)}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatNumber(totalDiagnoses)}</Text>
          <Text style={styles.statLabel}>Symptom Scans</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, styles.statValueBlue]}>{formatNumber(totalSpectra)}</Text>
          <Text style={styles.statLabel}>Early Scans</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatNumber(totalRecords)}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {([
          { key: 'timeline' as HistoryView, label: 'All', count: totalRecords },
          { key: 'diagnosis' as HistoryView, label: 'Symptoms', count: totalDiagnoses },
          { key: 'spectroscopy' as HistoryView, label: 'Early', count: totalSpectra },
        ]).map((tab) => {
          const isActive = activeView === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setActiveView(tab.key);
                resetPagination();
              }}
              style={[styles.tab, isActive && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
                {tab.label}
              </Text>
              {tab.count > 0 && (
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                    {formatNumber(tab.count)}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={20} color={palette.gray500} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search records…"
          placeholderTextColor={palette.gray500}
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            resetPagination();
          }}
          accessibilityLabel="Search history"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={18} color={palette.gray400} />
          </Pressable>
        )}
      </View>

      {searchQuery.trim() && activeSourceLength > 0 && (
        <Text style={styles.resultsHint}>
          {activeSourceLength} result{activeSourceLength !== 1 ? 's' : ''}
        </Text>
      )}
    </View>
  );

  const listEmpty = !isHydrated ? (
    <View style={styles.loadingBlock}>
      <ActivityIndicator color={palette.brandGreen} />
      <Text style={styles.loadingText}>Loading saved records…</Text>
    </View>
  ) : (
    <EmptyState
      icon={activeView === 'spectroscopy' ? 'chart-timeline-variant' : activeView === 'diagnosis' ? 'camera-plus' : 'timeline-clock-outline'}
      title={emptyMessage.title}
      message={emptyMessage.message}
      actionLabel={emptyMessage.action ? 'Get Started' : undefined}
      onAction={emptyMessage.action}
    />
  );

  const listFooter = hasMore ? (
    <Pressable
      style={styles.loadMore}
      onPress={() => setDisplayLimit((prev) => Math.min(prev + PAGE_SIZE, activeSourceLength))}
    >
      <Text style={styles.loadMoreText}>
        Load more ({formatNumber(activeSourceLength - displayLimit)} remaining)
      </Text>
      <MaterialCommunityIcons name="chevron-down" size={18} color={palette.brandGreen} />
    </Pressable>
  ) : (
    <View style={styles.listFooterSpacer} />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ProfileHeader />
      <FlatList
        data={listData}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.brandGreen}
            colors={[palette.brandGreen]}
          />
        }
        onEndReached={() => {
          if (hasMore) {
            setDisplayLimit((prev) => Math.min(prev + PAGE_SIZE, activeSourceLength));
          }
        }}
        onEndReachedThreshold={0.4}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5FBF6',
  },
  listContent: {
    paddingBottom: spacing.xxl * 2,
    flexGrow: 1,
  },
  headerBlock: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 28,
    color: palette.charcoal,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: palette.gray500,
    marginTop: 4,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.white,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: palette.border.light,
    maxWidth: 150,
  },
  syncText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: palette.gray600,
    flexShrink: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border.light,
  },
  statValue: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: palette.brandGreen,
  },
  statValueBlue: {
    color: '#1565C0',
  },
  statLabel: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: palette.gray500,
    marginTop: 2,
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border.light,
  },
  tabActive: {
    backgroundColor: palette.tint[100],
    borderColor: palette.brandGreen,
  },
  tabLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: palette.gray500,
    textAlign: 'center',
  },
  tabLabelActive: {
    fontFamily: Fonts.bold,
    color: palette.brandGreen,
  },
  tabBadge: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.gray100,
  },
  tabBadgeActive: {
    backgroundColor: palette.brandGreen,
  },
  tabBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: palette.gray600,
  },
  tabBadgeTextActive: {
    color: palette.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.white,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.border.light,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: palette.charcoal,
    padding: 0,
  },
  resultsHint: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: palette.gray500,
  },
  card: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border.light,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconDiagnosis: {
    backgroundColor: palette.brandGreen,
  },
  cardIconSpectrum: {
    backgroundColor: '#1565C0',
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: palette.charcoal,
  },
  cardDate: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: palette.gray500,
    marginTop: 2,
  },
  menuButton: {
    padding: 4,
  },
  cardHighlight: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: palette.brandGreenDark,
    marginTop: spacing.sm,
  },
  cardSummary: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: palette.gray600,
    marginTop: spacing.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  cardMeta: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: palette.gray500,
    textAlign: 'right',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeDiagnosis: {
    backgroundColor: palette.tint[100],
  },
  typeBadgeSpectrum: {
    backgroundColor: '#E3F2FD',
  },
  typeBadgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
  },
  typeBadgeTextDiagnosis: {
    color: palette.brandGreen,
  },
  typeBadgeTextSpectrum: {
    color: '#1565C0',
  },
  contextMenu: {
    marginTop: spacing.sm,
    backgroundColor: palette.gray100,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border.light,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  contextMenuLabel: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: palette.charcoal,
  },
  contextMenuDanger: {
    color: palette.danger,
  },
  loadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.lg,
  },
  loadMoreText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: palette.brandGreen,
  },
  listFooterSpacer: {
    height: spacing.xl,
  },
  loadingBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: palette.gray500,
  },
});
