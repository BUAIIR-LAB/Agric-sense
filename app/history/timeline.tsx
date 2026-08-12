import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAppContext } from '@/context/AppContext';
import { useDeleteRecord } from '@/hooks/useDeleteRecord';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { buildTimelineEntries, summarize } from '@/utils/historyTimeline';
import { palette } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { shadows } from '@/theme/shadows';
import { useTranslation } from '@/localization/useTranslation';

import { appFont, Fonts } from '@/theme/fonts';

export default function TimelineScreen() {
  const { state } = useAppContext();
  const { deleteRecord } = useDeleteRecord();
  const { isReady } = useAuthGuard();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, tp, formatNumber, formatDateTime } = useTranslation();

  const [menuTarget, setMenuTarget] = useState<{ type: 'diagnosis' | 'spectroscopy'; id: string } | null>(null);

  const events = useMemo(
    () =>
      buildTimelineEntries(state.diagnosisHistory, state.spectroscopyHistory, {
        diagnosisTitle: t('history.fallbacks.diagnosisTitle'),
        spectrumTitle: t('history.fallbacks.spectrumTitle'),
        confidence: (value) => t('history.meta.confidence', { value }),
        recommendations: (value, count) => tp('history.meta.recommendations', count, { value }),
        insights: (value, count) => tp('history.meta.insights', count, { value }),
      }, formatNumber),
    [formatNumber, state.diagnosisHistory, state.spectroscopyHistory, t, tp],
  );

  if (!isReady) {
    return null;
  }

  const toggleMenu = (type: 'diagnosis' | 'spectroscopy', id: string) => {
    setMenuTarget((previous) => {
      if (previous?.type === type && previous.id === id) {
        return null;
      }
      return { type, id };
    });
  };

  const isMenuOpen = (type: 'diagnosis' | 'spectroscopy', id: string) =>
    menuTarget?.type === type && menuTarget.id === id;

  const navigateToRecord = (type: 'diagnosis' | 'spectroscopy', id: string) => {
    setMenuTarget(null);
    router.push(`/history/${type}/${id}`);
  };

  const confirmDelete = async (type: 'diagnosis' | 'spectroscopy', id: string) => {
    setMenuTarget(null);
    await deleteRecord(type, id);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.buttons.goBack')}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={palette.white} />
        </Pressable>
        <Text style={styles.title}>{t('historyTimeline.title')}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <View style={styles.heroPanel}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="timeline-text-outline" size={28} color={palette.white} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>{t('historyTimeline.title')}</Text>
          <Text style={styles.heroSubtitle}>{t('historyTimeline.subtitle')}</Text>
        </View>
      </View>

      <View style={styles.contentCard}>
      {events.length ? (
        <View style={styles.timelineList}>
          {events.map((event, index) => (
            <View key={event.id} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View
                  style={[
                    styles.timelineNode,
                    event.type === 'diagnosis' ? styles.timelineNodeDiagnosis : styles.timelineNodeSpectroscopy,
                  ]}
                >
                  <MaterialCommunityIcons name={event.icon} size={16} color={palette.white} />
                </View>
                {index < events.length - 1 && <View style={styles.timelineConnector} />}
              </View>
              <View style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <View style={styles.entryHeaderLeft}>
                    <Text style={styles.entryTitle}>{event.title}</Text>
                    <View
                      style={[
                        styles.typeTag,
                        event.type === 'diagnosis' ? styles.typeTagDiagnosis : styles.typeTagSpectroscopy,
                      ]}
                    >
                    <Text style={styles.typeTagLabel}>
                      {event.type === 'diagnosis' ? t('history.chips.diagnosis') : t('history.chips.spectrum')}
                    </Text>
                    </View>
                  </View>
                  <View style={styles.entryHeaderRight}>
                    <Text style={styles.entryTimestamp}>
                    {formatDateTime(event.timestamp, { dateStyle: 'medium', timeStyle: 'short' })}
                    </Text>
                    <Pressable
                      onPress={() => toggleMenu(event.type, event.recordId)}
                      style={styles.actionDots}
                      accessibilityRole="button"
                    accessibilityLabel={t('history.accessibility.showActions')}
                    >
                      <MaterialCommunityIcons name="dots-horizontal" size={18} color={palette.white} />
                    </Pressable>
                    {isMenuOpen(event.type, event.recordId) && (
                      <View style={styles.contextMenu}>
                        <Pressable onPress={() => navigateToRecord(event.type, event.recordId)} style={styles.menuItem}>
                          <MaterialCommunityIcons name="eye-outline" size={16} color={palette.white} />
                        <Text style={styles.menuLabel}>{t('common.actions.view')}</Text>
                        </Pressable>
                        <Pressable onPress={() => confirmDelete(event.type, event.recordId)} style={styles.menuItem}>
                          <MaterialCommunityIcons name="trash-can-outline" size={16} color={palette.danger} />
                        <Text style={[styles.menuLabel, styles.menuDanger]}>{t('common.actions.delete')}</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={styles.entrySummary}>{summarize(event.summary)}</Text>
                <Text style={styles.entryMeta}>{event.meta}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>{t('historyTimeline.empty')}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  headerPlaceholder: {
    width: 40,
    height: 40,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: '#EAF7EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: appFont,
    fontSize: 18,
    fontWeight: '700',
    color: palette.white,
  },
  heroPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 20,
    padding: spacing.xl,
    backgroundColor: palette.brandGreen,
    width: '100%',
    marginHorizontal: spacing.xl,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  contentCard: {
    alignSelf: 'stretch',
    backgroundColor: palette.white,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
    shadowColor: '#1B5E20',
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
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  heroTitle: {
    fontFamily: appFont,
    fontSize: 22,
    fontWeight: '700',
    color: palette.white,
  },
  heroSubtitle: {
    fontFamily: appFont,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
  },
  timelineList: {
    gap: spacing.lg,
    width: '100%',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    width: '100%',
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
    ...shadows.soft,
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
  entryCard: {
    flex: 1,
    backgroundColor: '#F8FCF9',
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E0EDE3',
    gap: spacing.sm,
    ...shadows.soft,
    width: '100%',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  entryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  entryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    position: 'relative',
  },
  entryTitle: {
    fontFamily: appFont,
    fontSize: 15,
    fontWeight: '700',
    color: palette.charcoal,
    flex: 1,
  },
  entryTimestamp: {
    fontFamily: appFont,
    fontSize: 12,
    color: palette.gray500,
  },
  entrySummary: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.charcoal,
    lineHeight: 20,
  },
  entryMeta: {
    fontFamily: appFont,
    fontSize: 12,
    color: palette.gray500,
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
  actionDots: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    backgroundColor: '#EAF7EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextMenu: {
    position: 'absolute',
    top: spacing.xl,
    right: 0,
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#D9E6DD',
    ...shadows.soft,
    paddingVertical: spacing.xs,
    gap: spacing.xs / 2,
    minWidth: 140,
    zIndex: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  menuLabel: {
    fontFamily: appFont,
    fontSize: 13,
    fontWeight: '600',
    color: palette.brandGreenDark,
  },
  menuDanger: {
    color: palette.danger,
  },
  empty: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.gray500,
    lineHeight: 20,
    width: '100%',
  },
});

